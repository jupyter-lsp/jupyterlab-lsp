import { expect } from 'chai';
import { Rename } from './rename';
import { FileEditorFeatureTestEnvironment } from '../testutils';
import * as LSP from '../../../lsp';

describe('Rename', () => {
  let env: FileEditorFeatureTestEnvironment;

  beforeEach(() => (env = new FileEditorFeatureTestEnvironment()));
  afterEach(() => env.dispose());

  describe('Works with VirtualFileEditor', () => {
    let feature: Rename;

    beforeEach(() => (feature = env.init_feature(Rename)));
    afterEach(() => env.dispose_feature(feature));

    it('renders inspections', async () => {
      env.ce_editor.model.value.text = 'x = 1\n';
      await env.virtual_editor.update_documents();
      let main_document = env.virtual_editor.virtual_document;

      await feature.handleRename({
        changes: {
          [env.path()]: [
            {
              range: {
                start: { line: 0, character: 0 },
                end: { line: 2, character: 0 }
              },
              newText: 'y = 1\n'
            } as LSP.TextEdit
          ]
        }
      });

      await env.virtual_editor.update_documents();

      expect(feature.status_message.message).to.be.equal('Renamed a variable');
      expect(main_document.value).to.be.equal('y = 1\n');
    });
  });
});
