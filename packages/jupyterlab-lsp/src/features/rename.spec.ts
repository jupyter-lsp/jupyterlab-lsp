import { PageConfig } from '@jupyterlab/coreutils';
import { nullTranslator } from '@jupyterlab/translation';
import * as lsProtocol from 'vscode-languageserver-protocol';

import { FileEditorTestEnvironment } from '../testutils';
import { VirtualDocument } from '../virtual/document';

import { RenameFeature } from './rename';

describe('Rename', () => {
  let env: FileEditorTestEnvironment;

  beforeEach(async () => {
    env = new FileEditorTestEnvironment();
    await env.init();
  });
  afterEach(() => env.dispose());

  describe('Works with VirtualFileEditor', () => {
    let feature: RenameFeature;

    beforeEach(() => {
      feature = new RenameFeature({
        trans: nullTranslator.load(''),
        connectionManager: env.connectionManager
      });
    });

    PageConfig.setOption('rootUri', 'file://');

    it('renames files', async () => {
      env.activeEditor.model.sharedModel.setSource('x = 1\n');
      await env.adapter.updateDocuments();
      let mainDocument = env.adapter.virtualDocument!;

      await feature.handleRename(
        {
          changes: {
            ['file:///' + env.documentOptions.path]: [
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
        env.adapter,
        mainDocument as VirtualDocument
      );

      await env.adapter.updateDocuments();

      // TODO: intercept notifications
      // expect(env.status_message.message).toBe('Renamed x to y');
      expect(mainDocument.value).toBe('y = 1\n');
    });
  });
});
