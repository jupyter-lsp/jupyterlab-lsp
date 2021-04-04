import { CodeEditor } from '@jupyterlab/codeeditor';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { IDocumentWidget } from '@jupyterlab/docregistry';
import { FileEditor } from '@jupyterlab/fileeditor';

import { JumpHistory } from '../history';
import { IGlobalPosition, ILocalPosition } from '../positions';

import { CodeJumper, jumpers } from './jumper';

export class FileEditorJumper extends CodeJumper {
  editor: FileEditor;
  widget: IDocumentWidget;

  constructor(
    editor_widget: IDocumentWidget<FileEditor>,
    document_manager: IDocumentManager
  ) {
    super();
    this.widget = editor_widget;
    this.document_manager = document_manager;
    this.editor = editor_widget.content;
    this.history = new JumpHistory(this.editor.model.modelDB);
  }

  get path() {
    return this.widget.context.path;
  }

  get editors() {
    return [this.editor.editor];
  }

  jump(jump_position: ILocalPosition) {
    let { token } = jump_position;

    // TODO: this is common
    // place cursor in the line with the definition
    let position = this.editor.editor.getPositionAt(token.offset);
    this.editor.editor.setSelection({ start: position, end: position });
    this.editor.editor.focus();
  }

  getOffset(position: CodeEditor.IPosition) {
    return this.editor.editor.getOffsetAt(position);
  }

  getJumpPosition(position: CodeEditor.IPosition): ILocalPosition {
    return {
      token: {
        offset: this.getOffset(position),
        value: ''
      },
      index: 0
    };
  }

  getCurrentPosition(): IGlobalPosition {
    let position = this.editor.editor.getCursorPosition();
    return {
      editor_index: null,
      line: position.line,
      column: position.column,
      contents_path: this.editor.context.path,
      is_symlink: false
    };
  }
}

jumpers.set('fileeditor', FileEditorJumper);
