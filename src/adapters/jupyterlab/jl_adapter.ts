import { PathExt, PageConfig } from '@jupyterlab/coreutils';
import { CodeMirror, CodeMirrorAdapter } from '../codemirror/cm_adapter';
import { JupyterFrontEnd } from '@jupyterlab/application';
import { CodeJumper } from '@krassowski/jupyterlab_go_to_definition/lib/jumpers/jumper';
import { PositionConverter } from '../../converter';
import { CodeEditor } from '@jupyterlab/codeeditor';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import * as lsProtocol from 'vscode-languageserver-protocol';
import { FreeTooltip } from './components/free_tooltip';
import { Widget } from '@phosphor/widgets';
import { IDocumentWidget } from '@jupyterlab/docregistry';
import { until_ready } from '../../utils';
import { VirtualEditor } from '../../virtual/editor';
import { VirtualDocument } from '../../virtual/document';
import { Signal } from '@phosphor/signaling';
import {
  IEditorPosition,
  IRootPosition,
  IVirtualPosition
} from '../../positioning';
import { LSPConnection } from '../../connection';
import { LSPConnector } from './components/completion';
import { CompletionTriggerKind } from '../../lsp';
import { Completion } from '../codemirror/features/completion';
import { Diagnostics } from '../codemirror/features/diagnostics';
import { Highlights } from '../codemirror/features/highlights';
import { Hover } from '../codemirror/features/hover';
import { Signature } from '../codemirror/features/signature';
import { CodeMirrorLSPFeature, ILSPFeature } from '../codemirror/feature';
import { JumpToDefinition } from '../codemirror/features/jump_to';

export const lsp_features: Array<typeof CodeMirrorLSPFeature> = [
  Completion,
  Diagnostics,
  Highlights,
  Hover,
  Signature,
  JumpToDefinition
];

interface IDocumentConnectionData {
  document: VirtualDocument;
  connection: LSPConnection;
}

export interface ICommandContext {
  document: VirtualDocument;
  connection: LSPConnection;
  virtual_position: IVirtualPosition;
  root_position: IRootPosition;
}

export interface IJupyterLabComponentsManager {
  invoke_completer: (kind: CompletionTriggerKind) => void;
  create_tooltip: (
    markup: lsProtocol.MarkupContent,
    cm_editor: CodeMirror.Editor,
    position: IEditorPosition
  ) => FreeTooltip;
  remove_tooltip: () => void;
  jumper: CodeJumper;
}

/**
 * Foreign code: low level adapter is not aware of the presence of foreign languages;
 * it operates on the virtual document and must not attempt to infer the language dependencies
 * as this would make the logic of inspections caching impossible to maintain, thus the WidgetAdapter
 * has to handle that, keeping multiple connections and multiple virtual documents.
 */
export abstract class JupyterLabWidgetAdapter
  implements IJupyterLabComponentsManager {
  app: JupyterFrontEnd;
  connections: Map<VirtualDocument.id_path, LSPConnection>;
  documents: Map<VirtualDocument.id_path, VirtualDocument>;
  jumper: CodeJumper;
  protected adapters: Map<VirtualDocument.id_path, CodeMirrorAdapter>;
  protected rendermime_registry: IRenderMimeRegistry;
  widget: IDocumentWidget;
  private readonly invoke_command: string;
  protected document_connected: Signal<
    JupyterLabWidgetAdapter,
    IDocumentConnectionData
  >;
  protected abstract current_completion_connector: LSPConnector;
  private ignored_languages: Set<string>;
  private _tooltip: FreeTooltip;

  protected constructor(
    app: JupyterFrontEnd,
    widget: IDocumentWidget,
    rendermime_registry: IRenderMimeRegistry,
    invoke: string
  ) {
    this.app = app;
    this.rendermime_registry = rendermime_registry;
    this.invoke_command = invoke;
    this.connections = new Map();
    this.documents = new Map();
    this.document_connected = new Signal(this);
    this.adapters = new Map();
    this.ignored_languages = new Set();
    this.widget = widget;
  }

  abstract virtual_editor: VirtualEditor;
  abstract get document_path(): string;

  // TODO use mime types instead? Mime types would be set instead of language in servers.yml.
  abstract get language(): string;

  get root_path() {
    // TODO: serverRoot may need to be included for Hub or Windows, requires testing.
    // let root = PageConfig.getOption('serverRoot');
    return PathExt.dirname(this.document_path);
  }

  abstract find_ce_editor(cm_editor: CodeMirror.Editor): CodeEditor.IEditor;

  invoke_completer(kind: CompletionTriggerKind) {
    this.current_completion_connector.with_trigger_kind(kind, () => {
      return this.app.commands.execute(this.invoke_command);
    });
  }

  get main_connection(): LSPConnection {
    return this.connections.get(this.virtual_editor.virtual_document.id_path);
  }

  private async retry_to_connect(
    virtual_document: VirtualDocument,
    reconnect_delay: number,
    retrials_left = -1
  ): Promise<IDocumentConnectionData> {
    if (this.ignored_languages.has(virtual_document.language)) {
      throw Error(
        'Cancelling further attempts to connect ' +
          virtual_document.id_path +
          ' and other documents for this language (no support from the server)'
      );
    }

    let data: IDocumentConnectionData | null;

    let connect = () => {
      this.connect_socket_then_lsp(virtual_document)
        .then(d => {
          data = d;
        })
        .catch(e => {
          console.log(e);
          data = null;
        });
    };
    connect();

    await until_ready(
      () => {
        if (data === null) {
          connect();
        }
        return typeof data !== 'undefined' && data !== null;
      },
      retrials_left,
      reconnect_delay * 1000,
      // gradually increase the time delay, up to 5 sec
      interval => {
        interval = interval < 5 * 1000 ? interval + 500 : interval;
        console.log(
          'LSP: will attempt to re-connect in ' + interval / 1000 + ' seconds'
        );
        return interval;
      }
    );

    return new Promise<IDocumentConnectionData>(resolve => {
      resolve(data);
    });
  }

  protected async on_lsp_connected(data: IDocumentConnectionData) {
    let { connection, document: virtual_document } = data;

    connection.on('close', closed_manually => {
      if (!closed_manually) {
        console.warn('LSP: Connection unexpectedly closed or lost');
        this.disconnect_adapter(virtual_document);
        this.retry_to_connect(virtual_document, 0.5)
          .then(data => {
            this.on_lsp_connected(data);
          })
          .catch(console.warn);
      }
    });

    await this.connect_adapter(data.document, data.connection);
    this.document_connected.emit(data);

    await this.virtual_editor.update_documents().then(() => {
      // refresh the document on the LSP server
      this.document_changed(virtual_document);
      console.log(
        'LSP: virtual document(s) for',
        this.document_path,
        'have been initialized'
      );
    });
  }

  protected async connect_document(virtual_document: VirtualDocument) {
    virtual_document.foreign_document_opened.connect((host, context) => {
      console.log(
        'LSP: Connecting foreign document: ',
        context.foreign_document.id_path
      );
      this.connect_document(context.foreign_document);
    });
    virtual_document.foreign_document_closed.connect(
      (host, { foreign_document }) => {
        this.connections.get(foreign_document.id_path).close();
        this.connections.delete(foreign_document.id_path);
        this.documents.delete(foreign_document.id_path);
      }
    );
    virtual_document.changed.connect(this.document_changed.bind(this));
    this.documents.set(virtual_document.id_path, virtual_document);

    await this.connect_socket_then_lsp(virtual_document)
      .then(this.on_lsp_connected.bind(this))
      .catch(e => {
        console.warn(e);
        this.retry_to_connect(virtual_document, 1)
          .then(this.on_lsp_connected.bind(this))
          .catch(console.warn);
      });
  }

  document_changed(virtual_document: VirtualDocument) {
    // TODO only send the difference, using connection.sendSelectiveChange()
    let connection = this.connections.get(virtual_document.id_path);
    let adapter = this.adapters.get(virtual_document.id_path);

    if (typeof connection === 'undefined' || typeof adapter === 'undefined') {
      console.log(
        'LSP: Skipping document update signal - connection or adapter not ready yet'
      );
      return;
    }

    console.log(
      'LSP: virtual document',
      virtual_document.id_path,
      'has changed sending update'
    );
    connection.sendFullTextChange(virtual_document.value);
    // guarantee that the virtual editor won't perform an update of the virtual documents while
    // the changes are recorded...
    // TODO this is not ideal - why it solves the problem of some errors,
    //  it introduces an unnecessary delay. a better way could be to invalidate some of the updates when a new one comes in.
    //  but maybe not every one (then the outdated state could be kept for too long fo a user who writes very quickly)
    //  also we would not want to invalidate the updates for the purpose of autocompletion (the trigger characters)
    this.virtual_editor
      .with_update_lock(async () => {
        await adapter.updateAfterChange();
      })
      .then();
  }

  private async connect_adapter(
    virtual_document: VirtualDocument,
    connection: LSPConnection
  ) {
    let adapter = this.create_adapter(virtual_document, connection);
    this.adapters.set(virtual_document.id_path, adapter);
  }

  private disconnect_adapter(virtual_document: VirtualDocument) {
    let adapter = this.adapters.get(virtual_document.id_path);
    this.adapters.delete(virtual_document.id_path);
    if (typeof adapter !== 'undefined') {
      adapter.remove();
    }
  }

  private async connect_socket_then_lsp(
    virtual_document: VirtualDocument
  ): Promise<IDocumentConnectionData> {
    let language = virtual_document.language;
    console.log(
      `LSP: will connect using root path: ${this.root_path} and language: ${language}`
    );

    // capture just the s?://*
    const wsBase = PageConfig.getBaseUrl().replace(/^http/, '');
    const wsUrl = `ws${wsBase}lsp/${language}`;
    let socket = new WebSocket(wsUrl);

    let connection = new LSPConnection({
      serverUri: 'ws://jupyter-lsp/' + language,
      languageId: language,
      // paths handling needs testing on Windows and with other language servers
      rootUri: 'file:///' + this.root_path,
      documentUri: 'file:///' + virtual_document.uri,
      documentText: () => {
        // NOTE: Update is async now and this is not really used, as an alternative method
        // which is compatible with async is used.
        // This should be only used in the initialization step.
        // @ts-ignore
        if (this.main_connection.isConnected) {
          console.warn('documentText is deprecated for use in JupyterLab LSP');
        }
        return virtual_document.value;
      }
    }).connect(socket);

    connection.on('error', e => {
      let error: Error = e.length && e.length >= 1 ? e[0] : new Error();
      // TODO: those codes may be specific to my proxy client, need to investigate
      if (error.message.indexOf('code = 1005') !== -1) {
        console.warn('LSP: Connection failed for ' + virtual_document.id_path);
        console.log('LSP: disconnecting ' + virtual_document.id_path);
        this.disconnect_adapter(virtual_document);
        this.ignored_languages.add(virtual_document.language);
      } else if (error.message.indexOf('code = 1006') !== -1) {
        console.warn(
          'LSP: Connection closed by the server ' + virtual_document.id_path
        );
      } else {
        console.error(
          'LSP: Connection error of ' + virtual_document.id_path + ':',
          e
        );
      }
    });

    this.connections.set(virtual_document.id_path, connection);

    await until_ready(
      () => {
        // @ts-ignore
        return connection.isConnected;
      },
      50,
      50
    ).catch(() => {
      throw Error('LSP: Connect timed out for ' + virtual_document.id_path);
    });
    console.log(
      'LSP:',
      this.document_path,
      virtual_document.id_path,
      'connected.'
    );
    return {
      connection,
      document: virtual_document
    };
  }

  /**
   * Connect the change signal in order to update all virtual documents after a change.
   *
   * Update to the state of a notebook may be done without a notice on the CodeMirror level,
   * e.g. when a cell is deleted. Therefore a JupyterLab-specific signals are watched instead.
   *
   * While by not using the change event of CodeMirror editors we loose an easy way to send selective,
   * (range) updates this can be still implemented by comparison of before/after states of the
   * virtual documents, which is even more resilient and -obviously - editor-independent.
   */
  connect_contentChanged_signal() {
    this.widget.context.model.contentChanged.connect(
      this.update_documents.bind(this)
    );
  }

  create_adapter(
    virtual_document: VirtualDocument,
    connection: LSPConnection
  ): CodeMirrorAdapter {
    let adapter_features = new Array<ILSPFeature>();
    for (let feature_type of lsp_features) {
      let feature = new feature_type(
        this.virtual_editor,
        virtual_document,
        connection,
        this
      );
      adapter_features.push(feature);
    }

    let adapter = new CodeMirrorAdapter(
      this.virtual_editor,
      virtual_document,
      this,
      adapter_features
    );
    console.log('LSP: Adapter for', this.document_path, 'is ready.');
    return adapter;
  }

  update_documents(slot: any) {
    // update the virtual documents (sending the updates to LSP is out of scope here)
    this.virtual_editor.update_documents().then(() => {
      for (let adapter of this.adapters.values()) {
        // force clean old changes cached in the adapters
        adapter.invalidateLastChange();
      }
    });
  }

  get_position_from_context_menu(): IRootPosition {
    // get the first node as it gives the most accurate approximation
    let leaf_node = this.app.contextMenuHitTest(() => true);

    let { left, top } = leaf_node.getBoundingClientRect();

    // @ts-ignore
    let event = this.app._contextMenuEvent;

    // if possible, use more accurate position from the actual event
    // (but this relies on an undocumented and unstable feature)
    if (event !== undefined) {
      left = event.clientX;
      top = event.clientY;
      event.stopPropagation();
    }
    return this.virtual_editor.coordsChar(
      {
        left: left,
        top: top
      },
      'window'
    ) as IRootPosition;
  }

  get_context_from_context_menu(): ICommandContext {
    let root_position = this.get_position_from_context_menu();
    let document = this.virtual_editor.document_at_root_position(root_position);
    let connection = this.connections.get(document.id_path);
    let virtual_position = this.virtual_editor.root_position_to_virtual_position(
      root_position
    );
    return { document, connection, virtual_position, root_position };
  }

  public create_tooltip(
    markup: lsProtocol.MarkupContent,
    cm_editor: CodeMirror.Editor,
    position: IEditorPosition
  ): FreeTooltip {
    this.remove_tooltip();
    const bundle =
      markup.kind === 'plaintext'
        ? { 'text/plain': markup.value }
        : { 'text/markdown': markup.value };
    const tooltip = new FreeTooltip({
      anchor: this.widget.content,
      bundle: bundle,
      editor: this.find_ce_editor(cm_editor),
      rendermime: this.rendermime_registry,
      position: PositionConverter.cm_to_ce(position),
      moveToLineEnd: false
    });
    Widget.attach(tooltip, document.body);
    this._tooltip = tooltip;
    return tooltip;
  }

  remove_tooltip() {
    if (this._tooltip !== undefined) {
      this._tooltip.dispose();
    }
  }
}
