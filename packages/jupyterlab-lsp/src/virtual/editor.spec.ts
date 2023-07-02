/*
import { PageConfig } from '@jupyterlab/coreutils';
import { Document, CodeExtractorsManager, DocumentConnectionManager } from '@jupyterlab/lsp';

import {
  FileEditorTestEnvironment,
  MockLanguageServerManager,
  NotebookTestEnvironment
} from '../editor_integration/testutils';
import { RegExpForeignCodeExtractor } from '../extractors/regexp';
import { IRootPosition } from '@jupyterlab/lsp';

import { BrowserConsole } from './console';
import { VirtualDocument } from './document';

describe('VirtualEditor', () => {
  let rLineExtractor = new RegExpForeignCodeExtractor({
    language: 'R',
    pattern: '(^|\n)%R (.*)\n?',
    foreignCaptureGroups: [2],
    isStandalone: false,
    fileExtension: 'R'
  });

  PageConfig.setOption('rootUri', '/home/username/project');
  PageConfig.setOption(
    'virtualDocumentsUri',
    '/home/username/project/.virtualDocuments'
  );

  const LANGSERVER_MANAGER = new MockLanguageServerManager();
  const CONNECTION_MANAGER = new DocumentConnectionManager({
    languageServerManager: LANGSERVER_MANAGER,
  });

  const DEBUG = false;

  if (DEBUG) {
    console.log(CONNECTION_MANAGER);
  }

  let notebook_env: NotebookTestEnvironment;
  let file_editor_env: FileEditorTestEnvironment;

  const extractorManager = new CodeExtractorsManager();
  extractorManager.register(rLineExtractor, 'python');
  
  const options: Partial<VirtualDocument.IOptions> = {
    foreignCodeExtractors: extractorManager
  };

  beforeAll(() => {
    notebook_env = new NotebookTestEnvironment(options);
    file_editor_env = new FileEditorTestEnvironment(options);
  });

  describe('#has_lsp_supported', () => {
    it('gets passed on to the virtual document & used for connection uri base', () => {
      const rootUri = PageConfig.getOption('rootUri');
      const virtualDocumentsUri = PageConfig.getOption('virtualDocumentsUri');
      expect(rootUri).not.toBe(virtualDocumentsUri);

      let document = notebook_env.virtual_editor.virtualDocument;
      let uris = DocumentConnectionManager.solve_uris(document, 'python');
      expect(uris.base.startsWith(virtualDocumentsUri)).toBe(true);

      document = file_editor_env.virtual_editor.virtualDocument;
      uris = DocumentConnectionManager.solve_uris(document, 'python');
      expect(uris.base.startsWith(virtualDocumentsUri)).toBe(false);
    });
  });

  describe('#document_at_root_position()', () => {
    it('returns correct document', () => {
      let ceEditor_for_cell_1 = {} as Document.IEditor;
      let ceEditor_for_cell_2 = {} as Document.IEditor;
      let editor = notebook_env.virtual_editor;

      editor.virtualDocument.appendCodeBlock({
        value: 'test line in Python 1\n%R test line in R 1',
        ceEditor: ceEditor_for_cell_1,
        type: 'code'
      });
      editor.virtualDocument.appendCodeBlock({
        value: 'test line in Python 2\n%R test line in R 2',
        ceEditor: ceEditor_for_cell_2,
        type: 'code'
      });

      // The first (Python) line in the first block
      let root_position = { line: 0, ch: 0 } as IRootPosition;
      let document = editor.document_at_root_position(root_position);
      let virtual_position =
        editor.root_position_to_virtual_position(root_position);
      expect(document).toBe(editor.virtualDocument);
      expect(virtual_position.line).toBe(0);

      // The second (Python | R) line in the first block - Python fragment
      root_position = { line: 1, ch: 0 } as IRootPosition;
      document = editor.document_at_root_position(root_position);
      virtual_position =
        editor.root_position_to_virtual_position(root_position);
      expect(document).toBe(editor.virtualDocument);
      expect(virtual_position.line).toBe(1);

      // The second (Python | R) line in the first block - R fragment
      root_position = { line: 1, ch: 3 } as IRootPosition;
      document = editor.document_at_root_position(root_position);
      virtual_position =
        editor.root_position_to_virtual_position(root_position);
      expect(document).not.toBe(editor.virtualDocument);
      expect(virtual_position.line).toBe(0);

      // The first (Python) line in the second block
      root_position = { line: 2, ch: 0 } as IRootPosition;
      document = editor.document_at_root_position(root_position);
      virtual_position =
        editor.root_position_to_virtual_position(root_position);
      expect(document).toBe(editor.virtualDocument);
      expect(virtual_position.line).toBe(2 + 2);

      // The second (Python | R) line in the second block - Python fragment
      root_position = { line: 3, ch: 0 } as IRootPosition;
      document = editor.document_at_root_position(root_position);
      virtual_position =
        editor.root_position_to_virtual_position(root_position);
      expect(document).toBe(editor.virtualDocument);
      expect(virtual_position.line).toBe(2 + 2 + 1);

      // The second (Python | R) line in the second block - R fragment
      root_position = { line: 3, ch: 3 } as IRootPosition;
      document = editor.document_at_root_position(root_position);
      virtual_position =
        editor.root_position_to_virtual_position(root_position);
      expect(document).not.toBe(editor.virtualDocument);
      // 0 + 1 (next line) + 2 (between-block spacing)
      expect(virtual_position.line).toBe(1 + 2);
    });
  });
});

*/
