import { FileEditor } from '@jupyterlab/fileeditor';
import { IGlobalPosition, ILocalPosition } from '../jump';
import { CodeJumper, jumpers } from './jumper';
import { JumpHistory } from '../history';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { IDocumentWidget } from '@jupyterlab/docregistry';
import { CodeEditor } from '@jupyterlab/codeeditor';
import { PathExt } from '@jupyterlab/coreutils';

export class FileEditorJumper extends CodeJumper {
  editor: FileEditor;
  language: string;
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
    this.setLanguageFromMime(this.editor.model.mimeType);

    this.editor.model.mimeTypeChanged.connect((session, mimeChanged) => {
      this.setLanguageFromMime(mimeChanged.newValue);
    });
  }

  get path() {
    return this.widget.context.path;
  }

  get cwd() {
    return PathExt.dirname(this.path);
  }

  setLanguageFromMime(mime: string) {
    let type = mime.replace('text/x-', '');
    switch (type) {
      case 'rsrc':
        this.language = 'R';
        break;
      default:
        this.language = type;
    }
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
    console.log('file path: ', this.editor.context.path);
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
