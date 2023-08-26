import {
  extractCode,
  getTheOnlyVirtual,
  mockExtractorsManager
} from '../../extractors/testutils';
import { VirtualDocument } from '../../virtual/document';

import { foreignCodeExtractors } from './extractors';

describe('IPython extractors', () => {
  let document: VirtualDocument;

  function extract(code: string) {
    return extractCode(document, code);
  }

  beforeEach(() => {
    document = new VirtualDocument({
      language: 'python',
      path: 'test.ipynb',
      overridesRegistry: {},
      foreignCodeExtractors: mockExtractorsManager(foreignCodeExtractors),
      standalone: false,
      fileExtension: 'py',
      hasLspSupportedFile: false
    });
  });

  afterEach(() => {
    document.clear();
  });

  describe('handles %%python cell magic', () => {
    it('extracts simple commands', () => {
      let code = '%%python\nsys.exit()';
      let { cellCodeKept, foreignDocumentsMap } = extract(code);

      expect(cellCodeKept).toBe(code);
      let pythonDocument = getTheOnlyVirtual(foreignDocumentsMap);
      expect(pythonDocument.language).toBe('python');
      expect(pythonDocument.value).toBe('sys.exit()\n');
    });
  });

  describe('handles %%html cell magic', () => {
    it('works with html in normal mode', () => {
      let code = '%%html\n<div>safe</div>';
      let { foreignDocumentsMap } = extract(code);

      let htmlDocument = getTheOnlyVirtual(foreignDocumentsMap);
      expect(htmlDocument.language).toBe('html');
      expect(htmlDocument.value).toBe('<div>safe</div>\n');
    });

    it('works with html in isolated mode', () => {
      let code = '%%html --isolated\n<div>dangerous</div>';
      let { foreignDocumentsMap } = extract(code);

      let htmlDocument = getTheOnlyVirtual(foreignDocumentsMap);
      expect(htmlDocument.language).toBe('html');
      expect(htmlDocument.value).toBe('<div>dangerous</div>\n');
    });
  });
});
