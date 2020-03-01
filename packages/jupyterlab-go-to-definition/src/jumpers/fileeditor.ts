import { FileEditor } from '@jupyterlab/fileeditor';
import { IJump, IJumpPosition } from '../jump';
import { CodeJumper, jumpers } from './jumper';
import { JumpHistory } from '../history';
import { TokenContext } from '../languages/analyzer';
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

  jump(jump_position: IJumpPosition) {
    let { token } = jump_position;

    // TODO: this is common
    // place cursor in the line with the definition
    let position = this.editor.editor.getPositionAt(token.offset);
    this.editor.editor.setSelection({ start: position, end: position });
    this.editor.editor.focus();
  }

  jump_to_definition(jump: IJump) {
    let cell_of_origin_editor = this.editors[0];
    let cell_of_origin_analyzer = this._getLanguageAnalyzerForCell(
      cell_of_origin_editor
    );

    cell_of_origin_analyzer._maybe_setup_tokens();

    let context = new TokenContext(
      jump.token,
      cell_of_origin_analyzer.tokens,
      cell_of_origin_analyzer._get_token_index(jump.token)
    );

    if (cell_of_origin_analyzer.isCrossFileReference(context)) {
      this.jump_to_cross_file_reference(context, cell_of_origin_analyzer);
    } else {
      let { token } = this._findLastDefinition(jump.token, 0);

      // nothing found
      if (!token) {
        return;
      }

      this.history.store({ token: jump.token });

      this.jump({ token: token });
    }
  }

  jump_back() {
    let previous_position = this.history.recollect();
    if (previous_position) this.jump(previous_position);
  }

  getOffset(position: CodeEditor.IPosition) {
    return this.editor.editor.getOffsetAt(position);
  }

  getJumpPosition(position: CodeEditor.IPosition): IJumpPosition {
    return {
      token: {
        offset: this.getOffset(position),
        value: ''
      },
      index: 0
    };
  }
}

jumpers.set('fileeditor', FileEditorJumper);
