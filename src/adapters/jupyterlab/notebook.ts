import { JupyterLabWidgetAdapter } from './jl_adapter';
import { Notebook, NotebookPanel } from '@jupyterlab/notebook';
import { CodeMirror } from '../codemirror/cm_adapter';
import { VirtualEditorForNotebook } from '../../virtual/editors/notebook';
import { ICompletionManager } from '@jupyterlab/completer';
import { NotebookJumper } from '@krassowski/jupyterlab_go_to_definition/lib/jumpers/notebook';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { JupyterFrontEnd } from '@jupyterlab/application';
import { until_ready } from '../../utils';
import { LSPConnector } from './components/completion';
import { CodeEditor } from '@jupyterlab/codeeditor';
import { language_specific_overrides } from '../../magics/defaults';
import { foreign_code_extractors } from '../../extractors/defaults';
import { Cell } from '@jupyterlab/cells';

export class NotebookAdapter extends JupyterLabWidgetAdapter {
  editor: Notebook;
  widget: NotebookPanel;
  virtual_editor: VirtualEditorForNotebook;
  completion_manager: ICompletionManager;
  jumper: NotebookJumper;

  protected current_completion_connector: LSPConnector;

  constructor(
    editor_widget: NotebookPanel,
    jumper: NotebookJumper,
    app: JupyterFrontEnd,
    completion_manager: ICompletionManager,
    rendermime_registry: IRenderMimeRegistry
  ) {
    super(app, editor_widget, rendermime_registry, 'completer:invoke-notebook');
    this.editor = editor_widget.content;
    this.completion_manager = completion_manager;
    this.jumper = jumper;
    this.init_once_ready().then();
  }

  is_ready() {
    return (
      this.widget.context.isReady &&
      this.widget.content.isVisible &&
      this.widget.content.widgets.length > 0 &&
      this.language !== ''
    );
  }

  get document_path(): string {
    return this.widget.context.path;
  }

  get mime_type(): string {
    let language_metadata = this.widget.model.metadata.get('language_info');
    // @ts-ignore
    return language_metadata.mimetype;
  }

  get language_file_extension(): string {
    let language_metadata = this.widget.model.metadata.get('language_info');
    // @ts-ignore
    return language_metadata.file_extension.replace('.', '');
  }

  find_ce_editor(cm_editor: CodeMirror.Editor): CodeEditor.IEditor {
    return this.virtual_editor.cm_editor_to_cell.get(cm_editor).editor;
  }

  async init_once_ready() {
    console.log('LSP: waiting for', this.document_path, 'to fully load');
    await until_ready(this.is_ready.bind(this), -1);
    console.log('LSP:', this.document_path, 'ready for connection');

    // TODO
    // this.widget.context.pathChanged

    this.virtual_editor = new VirtualEditorForNotebook(
      this.widget,
      this.language,
      this.language_file_extension,
      language_specific_overrides,
      foreign_code_extractors,
      this.document_path
    );
    this.connect_contentChanged_signal();

    // register completion connectors on cells
    this.document_connected.connect(() => this.connect_completion());

    await this.connect_document(this.virtual_editor.virtual_document);
  }

  private set_completion_connector(cell: Cell) {
    if (this.current_completion_connector) {
      delete this.current_completion_connector;
    }
    this.current_completion_connector = new LSPConnector({
      editor: cell.editor,
      connections: this.connections,
      virtual_editor: this.virtual_editor,
      session: this.widget.session
    });
  }

  connect_completion() {
    // see https://github.com/jupyterlab/jupyterlab/blob/c0e9eb94668832d1208ad3b00a9791ef181eca4c/packages/completer-extension/src/index.ts#L198-L213
    const cell = this.widget.content.activeCell;
    this.set_completion_connector(cell);
    const handler = this.completion_manager.register({
      connector: this.current_completion_connector,
      editor: cell.editor,
      parent: this.widget
    });
    this.widget.content.activeCellChanged.connect((notebook, cell) => {
      this.set_completion_connector(cell);

      handler.editor = cell.editor;
      handler.connector = this.current_completion_connector;
    });
  }
}
