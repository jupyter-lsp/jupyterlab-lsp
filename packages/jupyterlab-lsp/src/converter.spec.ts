import {
  Document,
  CodeExtractorsManager,
  IRootPosition
} from '@jupyterlab/lsp';

import {
  documentAtRootPosition,
  rootPositionToVirtualPosition
} from './converter';
import { RegExpForeignCodeExtractor } from './extractors/regexp';
import { TestEnvironment, NotebookTestEnvironment } from './testutils';

describe('Position conversion', () => {
  let rLineExtractor = new RegExpForeignCodeExtractor({
    language: 'R',
    pattern: '(^|\n)%R (.*)\n?',
    foreignCaptureGroups: [2],
    isStandalone: false,
    fileExtension: 'R'
  });

  let environment: NotebookTestEnvironment;

  const extractorManager = new CodeExtractorsManager();
  extractorManager.register(rLineExtractor, 'python');

  const options: Partial<TestEnvironment.IOptions> = {
    document: {
      foreignCodeExtractors: extractorManager
    }
  };

  beforeAll(async () => {
    environment = new NotebookTestEnvironment(options);
    await environment.init();
  });

  describe('#documentAtRootPosition()', () => {
    it('returns correct document', () => {
      let ceEditor_for_cell_1 = {} as Document.IEditor;
      let ceEditor_for_cell_2 = {} as Document.IEditor;
      const adapter = environment.adapter!;
      const mainDocument = environment.adapter.virtualDocument!;

      mainDocument.clear();
      mainDocument.appendCodeBlock({
        value: 'test line in Python 1\n%R test line in R 1',
        ceEditor: ceEditor_for_cell_1,
        type: 'code'
      });
      mainDocument.appendCodeBlock({
        value: 'test line in Python 2\n%R test line in R 2',
        ceEditor: ceEditor_for_cell_2,
        type: 'code'
      });

      // The first (Python) line in the first block
      let rootPosition = { line: 0, ch: 0 } as IRootPosition;
      let document = documentAtRootPosition(adapter, rootPosition);
      let virtualPosition = rootPositionToVirtualPosition(
        adapter,
        rootPosition
      );
      expect(document).toBe(mainDocument);
      expect(virtualPosition.line).toBe(0);

      // The second (Python | R) line in the first block - Python fragment
      rootPosition = { line: 1, ch: 0 } as IRootPosition;
      document = documentAtRootPosition(adapter, rootPosition);
      virtualPosition = rootPositionToVirtualPosition(adapter, rootPosition);
      expect(document).toBe(mainDocument);
      expect(virtualPosition.line).toBe(1);

      // The second (Python | R) line in the first block - R fragment
      rootPosition = { line: 1, ch: 3 } as IRootPosition;
      document = documentAtRootPosition(adapter, rootPosition);
      virtualPosition = rootPositionToVirtualPosition(adapter, rootPosition);
      expect(document).not.toBe(mainDocument);
      expect(virtualPosition.line).toBe(0);

      // The first (Python) line in the second block
      rootPosition = { line: 2, ch: 0 } as IRootPosition;
      document = documentAtRootPosition(adapter, rootPosition);
      virtualPosition = rootPositionToVirtualPosition(adapter, rootPosition);
      expect(document).toBe(mainDocument);
      expect(virtualPosition.line).toBe(2 + 2);

      // The second (Python | R) line in the second block - Python fragment
      rootPosition = { line: 3, ch: 0 } as IRootPosition;
      document = documentAtRootPosition(adapter, rootPosition);
      virtualPosition = rootPositionToVirtualPosition(adapter, rootPosition);
      expect(document).toBe(mainDocument);
      expect(virtualPosition.line).toBe(2 + 2 + 1);

      // The second (Python | R) line in the second block - R fragment
      rootPosition = { line: 3, ch: 3 } as IRootPosition;
      document = documentAtRootPosition(adapter, rootPosition);
      virtualPosition = rootPositionToVirtualPosition(adapter, rootPosition);
      expect(document).not.toBe(mainDocument);
      // 0 + 1 (next line) + 2 (between-block spacing)
      expect(virtualPosition.line).toBe(1 + 2);
    });
  });
});
