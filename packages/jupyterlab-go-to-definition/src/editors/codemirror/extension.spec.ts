import { expect } from 'chai';

import { CodeEditor } from '@jupyterlab/codeeditor';
import { CodeMirrorEditor, Mode } from '@jupyterlab/codemirror';

import { CodeMirrorTokensProvider } from '../../editors/codemirror/tokens';

import { Jumper, matchToken } from '../../testutils';
import { CodeMirrorExtension } from '../../editors/codemirror';

describe('CodeMirrorExtension', () => {
  let editor: CodeMirrorEditor;
  let tokensProvider: CodeMirrorTokensProvider;
  let model: CodeEditor.Model;
  let host: HTMLElement;
  let jumper: Jumper;
  let extension: CodeMirrorExtension;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);

    model = new CodeEditor.Model({ mimeType: 'text/x-python' });
    editor = new CodeMirrorEditor({ host, model, config: { mode: 'python' } });
    tokensProvider = new CodeMirrorTokensProvider(editor);

    jumper = new Jumper(editor);

    extension = new CodeMirrorExtension(editor, jumper);
    extension.connect();
  });

  afterEach(() => {
    editor.dispose();
    document.body.removeChild(host);
  });

  describe('#selectToken', () => {
    it('should select token based on given DOM element of event origin', () => {
      model.value.text = `def x():
    a = 1
    a

a = 1
y = a`;

      let tokens = tokensProvider.getTokens();
      let token = matchToken(tokens, 'a', 4);

      let position = { line: 5, column: 5 };

      editor.setCursorPosition(position);

      expect(editor.getCursorPosition()).to.deep.equal(position);
      expect(editor.getTokenForPosition(position)).to.deep.equal(token);

      let mode = editor.editor.getOption('mode');
      Mode.run(model.value.text, mode, editor.host);

      let node = editor.host;

      while (node.className !== 'cm-variable')
        node = node.lastElementChild as HTMLElement;

      // sanity checks
      expect(node.innerHTML).to.be.equal('a');
      expect(
        node.previousElementSibling.previousElementSibling.innerHTML
      ).to.be.equal('y');

      expect(extension.selectToken('a', node)).to.deep.equal(token);
    });
  });
});
