import { expect } from 'chai';
import { VirtualFileEditor } from '../../../virtual/editors/file_editor';
import {
  CodeMirrorEditor,
  CodeMirrorEditorFactory
} from '@jupyterlab/codemirror';
import { CodeEditor } from '@jupyterlab/codeeditor';
import { TextMarker } from 'codemirror';
import { LSPConnection } from '../../../connection';
import { FreeTooltip } from '../../jupyterlab/components/free_tooltip';
import { Diagnostics } from './diagnostics';

// TODO remove duplicate initialization (see cm_adapter.spec.ts)
describe('CodeMirrorAdapterExtension', () => {
  const factoryService = new CodeMirrorEditorFactory();

  let host: HTMLElement;
  let ce_editor: CodeMirrorEditor;
  let virtual_editor: VirtualFileEditor;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    let model = new CodeEditor.Model();

    ce_editor = factoryService.newDocumentEditor({ host, model });
    virtual_editor = new VirtualFileEditor('python', 'x.py', ce_editor.editor);
  });

  afterEach(() => {
    document.body.removeChild(host);
  });

  describe('Works with VirtualFileEditor', () => {
    let diagnostics_feature: Diagnostics;

    beforeEach(() => {
      let connection = new LSPConnection({
        languageId: 'python',
        serverUri: '',
        documentUri: '/x.py',
        rootUri: '/',
        documentText: () => {
          virtual_editor.update_documents();
          return virtual_editor.virtual_document.value;
        }
      });

      let dummy_components_manager = {
        invoke_completer: () => {},
        create_tooltip: () => {
          return {} as FreeTooltip;
        },
        remove_tooltip: () => {}
      };

      diagnostics_feature = new Diagnostics(
        virtual_editor,
        virtual_editor.virtual_document,
        connection,
        dummy_components_manager
      );
      diagnostics_feature.register();
    });

    it('renders inspections', async () => {
      ce_editor.model.value.text = ' foo \n bar \n baz ';
      await virtual_editor.update_documents();

      let markers: TextMarker[];

      markers = ce_editor.editor.getDoc().getAllMarks();
      expect(markers.length).to.equal(0);

      diagnostics_feature.handleDiagnostic({
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
