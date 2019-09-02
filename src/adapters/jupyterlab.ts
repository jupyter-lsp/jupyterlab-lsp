import { IPosition, LspWsConnection } from 'lsp-editor-adapter';
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

interface IDocumentConnectedData {
  document: VirtualDocument;
  connection: LspWsConnection;
}

/**
 * Foreign code: low level adapter is not aware of the presence of foreign languages;
 * it operates on the virtual document and must not attempt to infer the language dependencies
 * as this would make the logic of inspections caching impossible to maintain, thus the WidgetAdapter
 * has to handle that, keeping multiple connections and multiple virtual documents.
 */
export abstract class JupyterLabWidgetAdapter {
  app: JupyterFrontEnd;
  connections: Map<VirtualDocument.id_path, LspWsConnection>;
  jumper: CodeJumper;
  adapter: CodeMirrorAdapterExtension;
  rendermime_registry: IRenderMimeRegistry;
  widget: IDocumentWidget;
  private invoke_command: string;
  protected document_connected: Signal<
    JupyterLabWidgetAdapter,
    IDocumentConnectedData
  >;

  protected constructor(
    app: JupyterFrontEnd,
    rendermime_registry: IRenderMimeRegistry,
    invoke: string
  ) {
    this.app = app;
    this.rendermime_registry = rendermime_registry;
    this.invoke_command = invoke;
    this.connections = new Map();
    this.document_connected = new Signal(this);
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

  abstract get_document_content(): string;

  abstract find_ce_editor(cm_editor: CodeMirror.Editor): CodeEditor.IEditor;

  invoke_completer() {
    return this.app.commands.execute(this.invoke_command);
  }

  get main_connection(): LspWsConnection {
    return this.connections.get(this.virtual_editor.virtual_document.id_path);
  }

  async connect(virtual_document: VirtualDocument) {
    virtual_document.foreign_document_opened.connect((host, context) => {
      this.connect(context.foreign_document);
    });
    virtual_document.foreign_document_closed.connect((host, context) => {
      let connection = this.connections.get(context.foreign_document.id_path);
      connection.close();
    });

    let language = virtual_document.language;
    console.log(
      `LSP: will connect using root path: ${this.root_path} and language: ${language}`
    );
    let connection = new LspWsConnection({
      serverUri: 'ws://localhost/' + language,
      languageId: language,
      // paths handling needs testing on Windows and with other language servers
      rootUri: 'file:///' + this.root_path,
      documentUri: 'file:///' + virtual_document.uri,
      documentText: () => {
        // TODO VirtualEditor should have "update(force=false)" method with debouncer;
        //  current getValue() should be moved to update(), while getValue should be
        //  made private in the virtual editor; possibly the virtual editor should no
        //  longer expose the full implementation of CodeMirror but rather hide it inside.
        this.virtual_editor.getValue();
        try {
          return virtual_document.value;
        } catch (e) {
          console.log(e);
        }
      }
    }).connect(new WebSocket('ws://localhost:3000/' + language));

    // @ts-ignore
    connection.on('goTo', locations => this.handle_jump(locations, language));
    this.connections.set(virtual_document.id_path, connection);

    // @ts-ignore
    await until_ready(() => connection.isConnected, -1, 150);
    console.log('LSP:', this.document_path, 'connected.');

    this.create_adapter(virtual_document, connection);

    this.document_connected.emit({ document: virtual_document, connection: connection });
  }

  handle_jump(locations: lsProtocol.Location[], language: string) {
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
    connection: LspWsConnection
  ) {
    this.adapter = new CodeMirrorAdapterExtension(
      connection,
      { quickSuggestionsDelay: 50 },
      this.virtual_editor,
      this.create_tooltip.bind(this),
      this.invoke_completer.bind(this),
      virtual_document
    );
    console.log('LSP: Adapter for', this.document_path, 'is ready.');
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
