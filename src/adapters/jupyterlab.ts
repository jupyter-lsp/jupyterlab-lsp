import { IPosition } from 'lsp-editor-adapter';
import { PathExt } from '@jupyterlab/coreutils';
import { CodeMirror, CodeMirrorAdapterExtension } from './codemirror';
import { JupyterFrontEnd } from '@jupyterlab/application';
import { CodeJumper } from '@krassowski/jupyterlab_go_to_definition/lib/jumpers/jumper';
import { PositionConverter } from '../converter';
import { CodeEditor } from '@jupyterlab/codeeditor';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import * as lsProtocol from 'vscode-languageserver-protocol';
import { FreeTooltip } from '../free_tooltip';
import { Widget } from '@phosphor/widgets';
import { IDocumentWidget } from '@jupyterlab/docregistry';
import { until_ready } from '../utils';
import { VirtualEditor } from '../virtual/editor';
import { VirtualDocument} from '../virtual/document';
import { Signal } from '@phosphor/signaling';
import { IEditorPosition, IVirtualPosition } from '../positioning';
import { LSPConnection } from '../connection';

interface IDocumentConnectedData {
  document: VirtualDocument;
  connection: LSPConnection;
}

/**
 * Foreign code: low level adapter is not aware of the presence of foreign languages;
 * it operates on the virtual document and must not attempt to infer the language dependencies
 * as this would make the logic of inspections caching impossible to maintain, thus the WidgetAdapter
 * has to handle that, keeping multiple connections and multiple virtual documents.
 */
export abstract class JupyterLabWidgetAdapter {
  app: JupyterFrontEnd;
  connections: Map<VirtualDocument.id_path, LSPConnection>;
  documents: Map<VirtualDocument.id_path, VirtualDocument>;
  jumper: CodeJumper;
  protected adapters: Map<VirtualDocument.id_path, CodeMirrorAdapterExtension>;
  protected rendermime_registry: IRenderMimeRegistry;
  widget: IDocumentWidget;
  private readonly invoke_command: string;
  protected document_connected: Signal<
    JupyterLabWidgetAdapter,
    IDocumentConnectedData
  >;

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

  invoke_completer() {
    return this.app.commands.execute(this.invoke_command);
  }

  get main_connection(): LSPConnection {
    return this.connections.get(this.virtual_editor.virtual_document.id_path);
  }

  async connect(virtual_document: VirtualDocument) {
    virtual_document.foreign_document_opened.connect((host, context) => {
      this.connect(context.foreign_document);
    });
    virtual_document.foreign_document_closed.connect(
      (host, { foreign_document }) => {
        this.connections.get(foreign_document.id_path).close();
        this.connections.delete(foreign_document.id_path);
        this.documents.delete(foreign_document.id_path);
      }
    );

    let language = virtual_document.language;
    console.log(
      `LSP: will connect using root path: ${this.root_path} and language: ${language}`
    );
    let connection = new LSPConnection({
      serverUri: 'ws://localhost/' + language,
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
    }).connect(new WebSocket('ws://localhost:3000/' + language));

    // @ts-ignore
    connection.on('goTo', locations => this.handle_jump(locations, language));
    this.connections.set(virtual_document.id_path, connection);
    this.documents.set(virtual_document.id_path, virtual_document);

    // TODO use Pool instead?
    // @ts-ignore
    await until_ready(() => connection.isConnected, -1, 150);
    console.log('LSP:', this.document_path, 'connected.');

    let adapter = this.create_adapter(virtual_document, connection);
    this.adapters.set(virtual_document.id_path, adapter);

    this.document_connected.emit({
      document: virtual_document,
      connection: connection
    });

    virtual_document.changed.connect(() => {
      // TODO only send the difference, using connection.sendSelectiveChange()
      connection.sendFullTextChange(virtual_document.value);
      console.log(
        'virtual document',
        virtual_document.id_path,
        'has changed sending for'
      );
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
    });

    await this.virtual_editor.update_documents().then(() => {
      console.log(
        'LSP: virtual document(s) for',
        this.document_path,
        'have been initialized'
      );
    });
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

  handle_jump(locations: lsProtocol.Location[], language: string) {
    // TODO: not language anymore
    let connection = this.connections.get(language);

    // TODO: implement selector for multiple locations
    //  (like when there are multiple definitions or usages)
    if (locations.length === 0) {
      console.log('No jump targets found');
      return;
    }
    console.log('Will jump to the first of suggested locations:', locations);

    let location = locations[0];

    let uri: string = decodeURI(location.uri);
    let current_uri = connection.getDocumentUri();

    let cm_position = PositionConverter.lsp_to_cm(
      location.range.start
    ) as IVirtualPosition;
    let editor_index = this.virtual_editor.get_editor_index(cm_position);
    let transformed_position = this.virtual_editor.transform_virtual_to_source(
      cm_position
    );
    let transformed_ce_position = PositionConverter.cm_to_ce(
      transformed_position
    );

    console.log(
      `Jumping to ${transformed_position} in ${editor_index} editor of ${uri}`
    );

    if (uri === current_uri) {
      this.jumper.jump({
        token: {
          offset: this.jumper.getOffset(transformed_ce_position, editor_index),
          value: ''
        },
        index: editor_index
      });
      return;
    }

    if (uri.startsWith('file://')) {
      uri = uri.slice(7);
    }

    this.jumper.global_jump(
      {
        // TODO: there are many files which are not symlinks
        uri: '.lsp_symlink/' + uri,
        editor_index: editor_index,
        line: transformed_ce_position.line,
        column: transformed_ce_position.column
      },
      true
    );
  }

  create_adapter(
    virtual_document: VirtualDocument,
    connection: LSPConnection
  ): CodeMirrorAdapterExtension {
    let adapter = new CodeMirrorAdapterExtension(
      connection,
      { quickSuggestionsDelay: 50 },
      this.virtual_editor,
      this.create_tooltip.bind(this),
      this.invoke_completer.bind(this),
      virtual_document
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

  get_doc_position_from_context_menu(): IPosition {
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
    );
  }

  protected create_tooltip(
    markup: lsProtocol.MarkupContent,
    cm_editor: CodeMirror.Editor,
    position: IEditorPosition
  ): FreeTooltip {
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
    return tooltip;
  }
}
