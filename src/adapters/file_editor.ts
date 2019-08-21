import {JupyterLabWidgetAdapter} from "./jupyterlab";
import {FileEditor} from "@jupyterlab/fileeditor";
import {IDocumentWidget} from "@jupyterlab/docregistry";
import {FileEditorJumper} from "@krassowski/jupyterlab_go_to_definition/lib/jumpers/fileeditor";
import {CodeMirror, CodeMirrorAdapterExtension} from "./codemirror";
import {IPosition, LspWsConnection} from "lsp-editor-adapter";
import {JupyterFrontEnd} from "@jupyterlab/application";
import {IRenderMimeRegistry} from "@jupyterlab/rendermime";
import {CodeMirrorEditor} from "@jupyterlab/codemirror";
import {ICompletionManager} from "@jupyterlab/completer";
import * as lsProtocol from "vscode-languageserver-protocol";
import {FreeTooltip} from "../free_tooltip";
import {PositionConverter} from "../converter";
import {Widget} from "@phosphor/widgets";
import {LSPConnector} from "../completion";

export class FileEditorAdapter extends JupyterLabWidgetAdapter {

  editor: FileEditor;
  widget: IDocumentWidget;
  jumper: FileEditorJumper;
  adapter: CodeMirrorAdapterExtension;
  connection: LspWsConnection;
  app: JupyterFrontEnd;
  rendermime_registry: IRenderMimeRegistry;

  get document_path() {
    return this.widget.context.path;
  }

  get language() {
    return this.jumper.language;
  }

  get_document_content(): string {
    let cm_editor = this.editor.editor as CodeMirrorEditor;
    return cm_editor.editor.getValue();
  }

  constructor(editor_widget: IDocumentWidget<FileEditor>, jumper: FileEditorJumper, app: JupyterFrontEnd, completion_manager: ICompletionManager, rendermime_registry: IRenderMimeRegistry) {
    super();
    this.jumper = jumper;
    this.widget = editor_widget;
    this.editor = editor_widget.content;
    this.rendermime_registry = rendermime_registry;

    this.app = app;
    let cm_editor = this.editor.editor as CodeMirrorEditor;

    this.connect();

    // @ts-ignore
    this.adapter = new CodeMirrorAdapterExtension(
      this.connection,
      {
        quickSuggestionsDelay: 50,
      },
      cm_editor.editor,
      (markup: lsProtocol.MarkupContent, cm_editor: CodeMirror.Editor, position: CodeMirror.Position) => {
        const bundle = markup.kind === 'plaintext' ? {'text/plain': markup.value} : {'text/markdown': markup.value};
        const tooltip = new FreeTooltip({
          anchor: this.widget.content,
          bundle: bundle,
          editor: this.editor.editor,
          rendermime: rendermime_registry,
          position: PositionConverter.cm_to_jl(position),
          moveToLineEnd: false
        });
        Widget.attach(tooltip, document.body);
        return tooltip
      });

    // detach the adapters contextmenu for now:
    // @ts-ignore
    this.adapter.editor.getWrapperElement().removeEventListener('contextmenu', this.adapter.editorListeners.contextmenu);
    // TODO: actually we only need the connection... the tooltips and suggestions will need re-writing to JL standards anyway

    // @ts-ignore
    this.connection.on('goTo', (locations) => {
      // TODO: implement selector for multiple locations
      //  (like when there are multiple definitions or usages)

      let location = locations[0];

      // @ts-ignore
      let uri: string = location.uri;

      let current_uri = this.connection.getDocumentUri();

      // @ts-ignore
      let line = location.range.start.line;
      // @ts-ignore
      let column = location.range.start.character;

      if (uri == current_uri) {
        jumper.jump(
          jumper.getJumpPosition({line: line, column: column})
        );
        return;
      }

      if (uri.startsWith('file://'))
        uri = uri.slice(7);

      console.log(uri);
      jumper.global_jump({
        // TODO: there are many files which are not symlinks
        uri: '.lsp_symlink/' + uri,
        editor_index: 0,
        line: line,
        column: column
      }, true);

    });

    const connector = new LSPConnector({
      editor: this.editor.editor,
      connection: this.connection,
      coordinates_transform: null
    });
    completion_manager.register({
      connector,
      editor: this.editor.editor,
      parent: editor_widget,
    });

    console.log('Connected adapter');
  }

  get path() {
    return this.widget.context.path
  }

  get_doc_position_from_context_menu(): IPosition {
    // get the first node as it gives the most accurate approximation
    let leaf_node = this.app.contextMenuHitTest(() => true);

    let cm_editor = this.editor.editor as CodeMirrorEditor;
    let {left, top} = leaf_node.getBoundingClientRect();

    // @ts-ignore
    let event = this.app._contextMenuEvent;

    // if possible, use more accurate position from the actual event
    // (but this relies on an undocumented and unstable feature)
    if (event !== undefined) {
      left = event.clientX;
      top = event.clientY;
      event.stopPropagation()
    }
    return cm_editor.editor.coordsChar({
      left: left,
      top: top,
    }, 'window');
  }

}
