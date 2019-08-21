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

export abstract class JupyterLabWidgetAdapter {
  app: JupyterFrontEnd;
  connection: LspWsConnection;
  jumper: CodeJumper;
  adapter: CodeMirrorAdapterExtension;
  rendermime_registry: IRenderMimeRegistry;
  widget: IDocumentWidget;

  protected constructor(
    app: JupyterFrontEnd,
    rendermime_registry: IRenderMimeRegistry
  ) {
    this.app = app;
    this.rendermime_registry = rendermime_registry;
  }

  abstract get document_path(): string;

  // TODO use mime types instead? Mime types would be set instead of language in servers.yml.
  abstract get language(): string;

  get root_path() {
    // TODO: serverRoot may need to be included for Hub or Windows, requires testing.
    // let root = PageConfig.getOption('serverRoot');
    return PathExt.dirname(this.document_path);
  }

  abstract get_document_content(): string;

  abstract get cm_editor(): CodeMirror.Editor;
  abstract find_ce_editor(cm_editor: CodeMirror.Editor): CodeEditor.IEditor;

  async connect() {
    console.log(
      'LSP: will connect using root path:',
      this.root_path,
      'and language:',
      this.language
    );
    this.connection = new LspWsConnection({
      serverUri: 'ws://localhost/' + this.language,
      languageId: this.language,
      // paths handling needs testing on Windows and with other language servers
      rootUri: 'file:///' + this.root_path,
      documentUri: 'file:///' + this.document_path,
      documentText: this.get_document_content.bind(this)
    }).connect(new WebSocket('ws://localhost:3000/' + this.language));

    // @ts-ignore
    this.connection.on('goTo', this.handle_jump.bind(this));

    // @ts-ignore
    await until_ready(() => this.connection.isConnected, -1, 150);
    console.log('LSP:', this.document_path, 'connected.');
  }

  handle_jump(locations: lsProtocol.Location[]) {
    // TODO: implement selector for multiple locations
    //  (like when there are multiple definitions or usages)
    if (locations.length === 0) {
      console.log('No jump targets found');
      return;
    }
    console.log('Will jump to the first of suggested locations:', locations);

    let location = locations[0];

    let uri: string = decodeURI(location.uri);
    let current_uri = this.connection.getDocumentUri();

    let cm_position = PositionConverter.lsp_to_cm(location.range.start);
    let editor_index = this.adapter.get_editor_index(cm_position);
    let transformed_position = this.adapter.transform(cm_position);
    let transformed_ce_position = PositionConverter.cm_to_ce(
      transformed_position
    );

    console.log(
      'Jumping to',
      transformed_position,
      'in',
      editor_index,
      'editor of',
      uri
    );

    if (uri == current_uri) {
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

  create_adapter() {
    this.adapter = new CodeMirrorAdapterExtension(
      this.connection,
      { quickSuggestionsDelay: 50 },
      this.cm_editor,
      this.create_tooltip.bind(this)
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
    return this.cm_editor.coordsChar(
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
    position: CodeMirror.Position
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
      position: PositionConverter.cm_to_ce(this.adapter.transform(position)),
      moveToLineEnd: false
    });
    Widget.attach(tooltip, document.body);
    return tooltip;
  }
}
