import { JupyterLabWidgetAdapter } from './jupyterlab';
import { Notebook, NotebookPanel } from '@jupyterlab/notebook';
import { CodeMirror, CodeMirrorAdapterExtension } from './codemirror';
import { NotebookAsSingleEditor } from '../notebook_mapper';
import { ICompletionManager } from '@jupyterlab/completer';
import { NotebookJumper } from '@krassowski/jupyterlab_go_to_definition/lib/jumpers/notebook';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { JupyterFrontEnd } from '@jupyterlab/application';
import { until_ready } from '../utils';
import * as lsProtocol from 'vscode-languageserver-protocol';
import { FreeTooltip } from '../free_tooltip';
import { PositionConverter } from '../converter';
import { Widget } from '@phosphor/widgets';
import { LSPConnector } from '../completion';

export class NotebookAdapter extends JupyterLabWidgetAdapter {
  editor: Notebook;
  widget: NotebookPanel;
  notebook_as_editor: NotebookAsSingleEditor;
  completion_manager: ICompletionManager;
  // TODO: make jumper optional?
  jumper: NotebookJumper;
  rendermime_registry: IRenderMimeRegistry;

  constructor(
    editor_widget: NotebookPanel,
    jumper: NotebookJumper,
    app: JupyterFrontEnd,
    completion_manager: ICompletionManager,
    rendermime_registry: IRenderMimeRegistry
  ) {
    super(app);
    this.widget = editor_widget;
    this.editor = editor_widget.content;
    this.completion_manager = completion_manager;
    this.jumper = jumper;
    this.rendermime_registry = rendermime_registry;
    this.init_once_ready().then();
  }

  is_ready() {
    return (
      this.widget.context.isReady &&
      this.widget.content.isVisible &&
      this.widget.content.widgets.length > 0 &&
      this.language != ''
    );
  }

  get document_path(): string {
    return this.widget.context.path;
  }

  get language(): string {
    let language_metadata = this.widget.model.metadata.get('language_info');
    // @ts-ignore
    return language_metadata.name;
  }

  async init_once_ready() {
    console.log('LSP: waiting for', this.document_path, 'to fully load');
    await until_ready(this.is_ready.bind(this), -1);
    console.log('LSP:', this.document_path, 'ready for connection');

    // TODO
    // this.widget.context.pathChanged

    this.notebook_as_editor = new NotebookAsSingleEditor(
      this.widget,
      // filter out line magics if the language is python
      this.language == 'python' ? '^%.*' : '',
      // the pass is used to silence the linters in places where the line would otherwise be filtered out
      this.language == 'python' ? 'pass' : ''
      // TODO: ideally we would allow to substitute code for magics, etc
    );

    let cm_editor = this.notebook_as_editor as CodeMirror.Editor;

    this.connect();

    // @ts-ignore
    await until_ready(() => this.connection.isConnected, -1, 150);
    console.log('LSP:', this.document_path, 'connected');

    this.adapter = new CodeMirrorAdapterExtension(
      this.connection,
      {
        quickSuggestionsDelay: 50
      },
      cm_editor,
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
          editor: this.notebook_as_editor.cm_editor_to_ieditor.get(cm_editor),
          rendermime: this.rendermime_registry,
          position: PositionConverter.cm_to_ce(
            this.notebook_as_editor.transform(position)
          ),
          moveToLineEnd: false
        });
        Widget.attach(tooltip, document.body);
        return tooltip;
      }
    );

    // refresh server held state after every change
    // note this may be changed soon: https://github.com/jupyterlab/jupyterlab/issues/5382#issuecomment-515643504
    this.widget.model.contentChanged.connect(
      this.refresh_lsp_notebook_image.bind(this)
    );

    // and refresh it after the cell was activated, just to make sure that the first experience is ok
    this.widget.content.activeCellChanged.connect(
      this.refresh_lsp_notebook_image.bind(this)
    );

    // register completion connectors on cells

    // see https://github.com/jupyterlab/jupyterlab/blob/c0e9eb94668832d1208ad3b00a9791ef181eca4c/packages/completer-extension/src/index.ts#L198-L213
    const cell = this.widget.content.activeCell;
    const connector = new LSPConnector({
      editor: cell.editor,
      connection: this.connection,
      coordinates_transform: (position: CodeMirror.Position) =>
        this.notebook_as_editor.transform_to_notebook(cell, position)
    });
    const handler = this.completion_manager.register({
      connector,
      editor: cell.editor,
      parent: this.widget
    });
    this.widget.content.activeCellChanged.connect((notebook, cell) => {
      const connector = new LSPConnector({
        editor: cell.editor,
        connection: this.connection,
        coordinates_transform: (position: CodeMirror.Position) =>
          this.notebook_as_editor.transform_to_notebook(cell, position)
      });

      handler.editor = cell.editor;
      handler.connector = connector;
    });
  }

  get_notebook_content() {
    return this.notebook_as_editor.getValue();
  }

  get cm_editor() {
    return this.notebook_as_editor;
  }

  get_document_content() {
    return this.get_notebook_content();
  }

  refresh_lsp_notebook_image(slot: any) {
    // TODO this is fired too often currently, debounce!
    this.connection.sendChange();
  }
}
