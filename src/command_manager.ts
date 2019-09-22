import { JupyterFrontEnd } from '@jupyterlab/application';
import { IWidgetTracker } from '@jupyterlab/apputils';
import { JupyterLabWidgetAdapter } from './adapters/jupyterlab/jl_adapter';
import { IFeatureCommand } from './adapters/codemirror/feature';
import { IEditorTracker } from '@jupyterlab/fileeditor';
import { FileEditorAdapter } from './adapters/jupyterlab/file_editor';
import { NotebookAdapter } from './adapters/jupyterlab/notebook';
import { INotebookTracker } from '@jupyterlab/notebook';
import { VirtualDocument } from './virtual/document';
import { LSPConnection } from './connection';
import { IRootPosition, IVirtualPosition } from './positioning';

export const file_editor_adapters: Map<string, FileEditorAdapter> = new Map();
export const notebook_adapters: Map<string, NotebookAdapter> = new Map();

function is_context_menu_over_token(adapter: JupyterLabWidgetAdapter) {
  let position = adapter.get_position_from_context_menu();
  if (!position) {
    return false;
  }
  let token = adapter.virtual_editor.getTokenAt(position);
  return token.string !== '';
}

abstract class LSPCommandManager {
  constructor(
    protected app: JupyterFrontEnd,
    protected tracker: IWidgetTracker,
    protected selector: string,
    protected suffix: string,
    protected rank_group?: number,
    protected rank_group_size?: number
  ) {}

  abstract get current_adapter(): JupyterLabWidgetAdapter;

  add(commands: Array<IFeatureCommand>) {
    for (let cmd of commands) {
      this.app.commands.addCommand(this.create_id(cmd), {
        execute: () => this.execute(cmd),
        isEnabled: this.is_context_menu_over_token,
        isVisible: () => this.is_visible(cmd),
        label: cmd.label
      });

      this.app.contextMenu.addItem({
        selector: this.selector,
        command: cmd.id,
        rank: this.get_rank(cmd)
      });
    }
  }

  execute(command: IFeatureCommand): void {
    let context = this.current_adapter.get_context_from_context_menu();
    command.execute(context);
  }

  is_visible(command: IFeatureCommand): boolean {
    let context = this.current_adapter.get_context_from_context_menu();
    return (
      this.current_adapter && context.connection && command.is_enabled(context)
    );
  }

  is_context_menu_over_token() {
    return is_context_menu_over_token(this.current_adapter);
  }

  protected create_id(command: IFeatureCommand): string {
    return 'lsp_' + command.id + '_' + this.suffix;
  }

  protected get_rank(command: IFeatureCommand): number {
    if (command.is_rank_relative && this.rank_group && this.rank_group_size) {
      let relative = typeof command.rank !== 'undefined' ? command.rank : 0;
      return this.rank_group + Number.EPSILON + relative / this.rank_group_size;
    } else {
      return typeof command.rank !== 'undefined' ? command.rank : Infinity;
    }
  }
}

export class NotebookCommandManager extends LSPCommandManager {
  protected tracker: INotebookTracker;

  get current_adapter() {
    let notebook = this.tracker.currentWidget;
    return notebook_adapters.get(notebook.id);
  }
}

export class FileEditorCommandManager extends LSPCommandManager {
  protected tracker: IEditorTracker;

  get current_adapter() {
    let fileEditor = this.tracker.currentWidget.content;
    return file_editor_adapters.get(fileEditor.id);
  }
}

export interface ICommandContext {
  document: VirtualDocument;
  connection: LSPConnection;
  virtual_position: IVirtualPosition;
  root_position: IRootPosition;
}
