import { PageConfig } from '@jupyterlab/coreutils';
import { DocumentConnectionManager } from '@jupyterlab/lsp';

import {
  FileEditorTestEnvironment,
  NotebookTestEnvironment
} from '../testutils';

describe('Integration of adapters', () => {
  PageConfig.setOption('rootUri', '/home/username/project');
  PageConfig.setOption(
    'virtualDocumentsUri',
    '/home/username/project/.virtualDocuments'
  );

  let fileEnvironment: FileEditorTestEnvironment;
  let notebookEnvironment: NotebookTestEnvironment;

  beforeEach(async () => {
    notebookEnvironment = new NotebookTestEnvironment();
    await notebookEnvironment.init();
    fileEnvironment = new FileEditorTestEnvironment();
    await fileEnvironment.init();
  });

  // TODO: upstream this test
  describe('#hasLspSupportedFile', () => {
    it('gets passed on to the virtual document & used for connection uri base', () => {
      const rootUri = PageConfig.getOption('rootUri');
      const virtualDocumentsUri = PageConfig.getOption('virtualDocumentsUri');
      expect(rootUri).not.toBe(virtualDocumentsUri);

      let document = notebookEnvironment.adapter.virtualDocument!;
      let uris = DocumentConnectionManager.solveUris(document, 'python')!;
      expect(uris.base.startsWith(virtualDocumentsUri)).toBe(true);

      document = fileEnvironment.adapter.virtualDocument!;
      uris = DocumentConnectionManager.solveUris(document, 'python')!;
      expect(uris.base.startsWith(virtualDocumentsUri)).toBe(false);
    });
  });
});
