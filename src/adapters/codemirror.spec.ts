import { expect } from 'chai';
import { CodeMirrorAdapterExtension } from './codemirror';
import { LspWsConnection } from 'lsp-editor-adapter';
import { VirtualFileEditor } from '../virtual/editors/file_editor';
import {
  CodeMirrorEditor,
  CodeMirrorEditorFactory
} from '@jupyterlab/codemirror';
import { CodeEditor } from '@jupyterlab/codeeditor';
import { TextMarker } from 'codemirror';

describe('CodeMirrorAdapterExtension', () => {
  const factoryService = new CodeMirrorEditorFactory();

  let host: HTMLElement;
  let model: CodeEditor.IModel;
  let ce_editor: CodeMirrorEditor;
  let virtual_editor: VirtualFileEditor;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    model = new CodeEditor.Model();

    ce_editor = factoryService.newDocumentEditor({ host, model });
    virtual_editor = new VirtualFileEditor('python', 'x.py', ce_editor.editor);
  });

  afterEach(() => {
    document.body.removeChild(host);
  });

  describe('Works with VirtualFileEditor', () => {

    let adapter: CodeMirrorAdapterExtension;

    beforeEach(() => {
      let connection = new LspWsConnection({
        languageId: 'python',
        serverUri: '',
        documentUri: '/x.py',
        rootUri: '/',
        documentText: () => {
          virtual_editor.update_value();
          return virtual_editor.virtual_document.value;
        }
      });

      adapter = new CodeMirrorAdapterExtension(
        connection,
        {},
        virtual_editor,
        (markup, cm_editor, position) => {
          return null;
        },
        () => {
          return;
        },
        virtual_editor.virtual_document
      );
    });

    it('renders inspections', () => {
      ce_editor.model.value.text = ' foo \n bar \n baz ';
      virtual_editor.update_value();

      let markers: TextMarker[];

      markers = ce_editor.editor.getDoc().getAllMarks();
      expect(markers.length).to.equal(0);

      adapter.handleDiagnostic({
        uri: '',
        diagnostics: [
          {
            range: {
              start: { line: 0, character: 1 },
              end: { line: 0, character: 4 }
            },
            message: 'Undefined symbol'
          }
        ]
      });

      let marks = ce_editor.editor.getDoc().getAllMarks();
      expect(marks.length).to.equal(1);
    });
  });
});
