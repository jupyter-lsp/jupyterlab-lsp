import { JupyterLabWidgetAdapter } from './jupyterlab';
import { FileEditor } from '@jupyterlab/fileeditor';
import { IDocumentWidget } from '@jupyterlab/docregistry';
import { FileEditorJumper } from '@krassowski/jupyterlab_go_to_definition/lib/jumpers/fileeditor';
import { CodeMirror, CodeMirrorAdapterExtension } from './codemirror';
import { LspWsConnection } from 'lsp-editor-adapter';
import { JupyterFrontEnd } from '@jupyterlab/application';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { CodeMirrorEditor } from '@jupyterlab/codemirror';
import { ICompletionManager } from '@jupyterlab/completer';
import * as lsProtocol from 'vscode-languageserver-protocol';
import { FreeTooltip } from '../free_tooltip';
import { PositionConverter } from '../converter';
import { Widget } from '@phosphor/widgets';
import { LSPConnector } from '../completion';

export class FileEditorAdapter extends JupyterLabWidgetAdapter {
  editor: FileEditor;
  widget: IDocumentWidget;
  jumper: FileEditorJumper;
  connection: LspWsConnection;
  rendermime_registry: IRenderMimeRegistry;

  get document_path() {
    return this.widget.context.path;
  }

  get language() {
    return this.jumper.language;
  }

  get_document_content(): string {
    return this.cm_editor.getValue();
  }

  get ce_editor(): CodeMirrorEditor {
    return this.editor.editor as CodeMirrorEditor;
  }

  get cm_editor(): CodeMirror.Editor {
    return this.ce_editor.editor;
  }

  constructor(
    editor_widget: IDocumentWidget<FileEditor>,
    jumper: FileEditorJumper,
    app: JupyterFrontEnd,
    completion_manager: ICompletionManager,
    rendermime_registry: IRenderMimeRegistry
  ) {
    super(app);
    this.jumper = jumper;
    this.widget = editor_widget;
    this.editor = editor_widget.content;
    this.rendermime_registry = rendermime_registry;

    this.connect();

    this.adapter = new CodeMirrorAdapterExtension(
      this.connection,
      {
        quickSuggestionsDelay: 50
      },
      this.cm_editor,
      (
        markup: lsProtocol.MarkupContent,
        cm_editor: CodeMirror.Editor,
        position: CodeMirror.Position
      ) => {
        const bundle =
          markup.kind === 'plaintext'
            ? { 'text/plain': markup.value }
            : { 'text/markdown': markup.value };
        const tooltip = new FreeTooltip({
          anchor: this.widget.content,
          bundle: bundle,
          editor: this.editor.editor,
          rendermime: rendermime_registry,
          position: PositionConverter.cm_to_ce(position),
          moveToLineEnd: false
        });
        Widget.attach(tooltip, document.body);
        return tooltip;
      }
    );

    const connector = new LSPConnector({
      editor: this.editor.editor,
      connection: this.connection,
      coordinates_transform: null
    });
    completion_manager.register({
      connector,
      editor: this.editor.editor,
      parent: editor_widget
    });

    console.log('LSP: Connected adapter');
  }

  get path() {
    return this.widget.context.path;
  }
}
