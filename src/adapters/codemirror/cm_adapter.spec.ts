import { expect } from 'chai';
import { CodeMirrorAdapter} from './cm_adapter';
import { VirtualFileEditor } from '../../virtual/editors/file_editor';
import {
  CodeMirrorEditor,
  CodeMirrorEditorFactory
} from '@jupyterlab/codemirror';
import { CodeEditor } from '@jupyterlab/codeeditor';
import { LSPConnection } from '../../connection';
import { FreeTooltip } from '../jupyterlab/components/free_tooltip';
import { IJupyterLabComponentsManager } from '../jupyterlab/jl_adapter';
import { IRootPosition } from '../../positioning';
import CodeMirror = require('codemirror');
import { CodeMirrorLSPFeature } from './feature';

describe('CodeMirrorAdapter', () => {
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
    let dummy_components_manager: IJupyterLabComponentsManager;
    let connection: LSPConnection;

    beforeEach(() => {
      connection = new LSPConnection({
        languageId: 'python',
        serverUri: '',
        documentUri: '/x.py',
        rootUri: '/',
        documentText: () => {
          virtual_editor.update_documents();
          return virtual_editor.virtual_document.value;
        }
      });

      dummy_components_manager = {
        invoke_completer: () => {},
        create_tooltip: () => {
          return {} as FreeTooltip;
        },
        remove_tooltip: () => {}
      };
    });

    it('updates on change', async () => {
      class UpdateReceivingFeature extends CodeMirrorLSPFeature {
        public received_update = false;
        public last_change: CodeMirror.EditorChange = null;
        public last_change_position: IRootPosition;

        afterChange(
          change: CodeMirror.EditorChange,
          root_position: IRootPosition
        ): void {
          this.received_update = true;
          this.last_change = change;
          this.last_change_position = root_position;
        }
      }
      let feature = new UpdateReceivingFeature(
        virtual_editor,
        virtual_editor.virtual_document,
        connection,
        dummy_components_manager
      );

      let adapter = new CodeMirrorAdapter(
        virtual_editor,
        virtual_editor.virtual_document,
        dummy_components_manager,
        [feature]
      );
      ce_editor.model.value.text = 'f';
      await virtual_editor.update_documents();
      expect(feature.received_update).to.equal(false);

      ce_editor.model.value.text = 'fo';
      await virtual_editor.update_documents();
      await adapter.updateAfterChange();

      expect(feature.received_update).to.equal(true);
      expect(feature.last_change.text[0]).to.equal('fo');
    });
  });
});
