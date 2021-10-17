import { CodeEditor } from '@jupyterlab/codeeditor';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { Notebook, NotebookPanel } from '@jupyterlab/notebook';

import { JumpHistory } from '../history';
import { _ensureFocus } from '../notebook_private';
import { IGlobalPosition, ILocalPosition } from '../positions';

import { CodeJumper, jumpers } from './jumper';

export class NotebookJumper extends CodeJumper {
  notebook: Notebook;
  widget: NotebookPanel;

  constructor(
    notebook_widget: NotebookPanel,
    document_manager: IDocumentManager
  ) {
    super();
    this.widget = notebook_widget;
    this.notebook = notebook_widget.content;
    this.history = new JumpHistory(this.notebook.model.modelDB);
    this.document_manager = document_manager;
  }

  get editors() {
    return this.notebook.widgets.map(cell => cell.editor);
  }

  jump(position: ILocalPosition) {
    let { token, index } = position;

    // Prevents event propagation issues
    setTimeout(() => {
      this.notebook.deselectAll();
      this.notebook.activeCellIndex = index;
      _ensureFocus(this.notebook);
      this.notebook.mode = 'edit';

      // find out offset for the element
      let activeEditor = this.notebook.activeCell.editor;

      // place cursor in the line with the definition
      let position = activeEditor.getPositionAt(token.offset);
      activeEditor.setSelection({ start: position, end: position });
    }, 0);
  }

  getOffset(position: CodeEditor.IPosition, cell: number = 0) {
    return this.editors[cell].getOffsetAt(position);
  }

  getCurrentPosition(): IGlobalPosition {
    let position =
      this.editors[this.notebook.activeCellIndex].getCursorPosition();

    return {
      editor_index: this.notebook.activeCellIndex,
      line: position.line,
      column: position.column,
      contents_path: this.widget.context.path,
      is_symlink: false
    };
  }

  getJumpPosition(position: CodeEditor.IPosition, input_number: number) {
    return {
      token: {
        offset: this.getOffset(position, input_number),
        value: ''
      },
      index: input_number
    };
  }
}

jumpers.set('notebook', NotebookJumper);
