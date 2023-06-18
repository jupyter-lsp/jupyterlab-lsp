/*
import { PageConfig } from '@jupyterlab/coreutils';
import * as lsProtocol from 'vscode-languageserver-protocol';

import { FileEditorFeatureTestEnvironment } from '../editor_integration/testutils';

import { RenameFeature } from './rename';

describe('Rename', () => {
  let env: FileEditorFeatureTestEnvironment;

  beforeEach(() => {
    env = new FileEditorFeatureTestEnvironment();
  });
  afterEach(() => env.dispose());

  describe('Works with VirtualFileEditor', () => {
    let feature: RenameFeature;

    beforeEach(
      () =>
        (feature = env.init_integration({
          constructor: RenameFeature,
          id: 'Rename'
        }))
    );
    afterEach(() => env.dispose_feature(feature));

    PageConfig.setOption('rootUri', 'file://');

    it('renames files', async () => {
      env.ceEditor.model.sharedModel.setSource('x = 1\n');
      await env.adapter.updateDocuments();
      let main_document = env.virtual_editor.virtualDocument;

      await feature.handleRename(
        {
          changes: {
            ['file:///' + env.document_options.path]: [
              {
                range: {
                  start: { line: 0, character: 0 },
                  end: { line: 2, character: 0 }
                },
                newText: 'y = 1\n'
              } as lsProtocol.TextEdit
            ]
          }
        },
        'x',
        'y',
        env.adapter
      );

      await env.adapter.updateDocuments();

      expect(env.status_message.message).toBe('Renamed x to y');
      expect(main_document.value).toBe('y = 1\n');
    });
  });
});
*/