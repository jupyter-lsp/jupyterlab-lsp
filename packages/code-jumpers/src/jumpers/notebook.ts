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
    notebookWidget: NotebookPanel,
    documentManager: IDocumentManager
  ) {
    super();
    this.widget = notebookWidget;
    this.notebook = notebookWidget.content;
    this.history = new JumpHistory();
    this.documentManager = documentManager;
  }

  get editors() {
    return this.notebook.widgets.map(cell => cell.editor!);
  }

  jump(position: ILocalPosition) {
    let { token, index } = position;

    // Prevents event propagation issues
    setTimeout(() => {
      this.notebook.deselectAll();
      this.notebook.activeCellIndex = index!;
      _ensureFocus(this.notebook);
      this.notebook.mode = 'edit';

      // find out offset for the element
      let activeEditor = this.notebook.activeCell!.editor!;

      // place cursor in the line with the definition
      let position = activeEditor.getPositionAt(token.offset)!;
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
      editorIndex: this.notebook.activeCellIndex,
      line: position.line,
      column: position.column,
      contentsPath: this.widget.context.path,
      isSymlink: false
    };
  }

  getJumpPosition(position: CodeEditor.IPosition, inputNumber: number) {
    return {
      token: {
        offset: this.getOffset(position, inputNumber),
        value: ''
      },
      index: inputNumber
    };
  }
}

jumpers.set('notebook', NotebookJumper);
