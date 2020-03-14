import { ITokensProvider } from '../editor';
import { CodeMirrorEditor } from '@jupyterlab/codemirror';

export class CodeMirrorTokensProvider implements ITokensProvider {
  editor: CodeMirrorEditor;

  constructor(editor: CodeMirrorEditor) {
    this.editor = editor;
  }

  getTokens() {
    return this.editor.getTokens();
  }

  getTokenAt(offset: number) {
    let position = this.editor.getPositionAt(offset);
    return this.editor.getTokenForPosition(position);
  }
}
