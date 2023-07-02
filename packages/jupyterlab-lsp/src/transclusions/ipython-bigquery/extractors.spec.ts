import {
  extractCode,
  getTheOnlyVirtual,
  mockExtractorsManager
} from '../../extractors/testutils';
import { VirtualDocument } from '../../virtual/document';

import { foreignCodeExtractors } from './extractors';

describe('Bigquery SQL extractors', () => {
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

  describe('%%bigquery cell magic', () => {
    it('extracts simple commands', () => {
      let code = "%%bigquery\nselect * from character\nwhere abbrev = 'ALICE'";
      let { cellCodeKept, foreignDocumentsMap } = extract(code);

      expect(cellCodeKept).toBe(code);
      let document = getTheOnlyVirtual(foreignDocumentsMap);
      expect(document.language).toBe('sql');
      expect(document.value).toBe(
        "select * from character\nwhere abbrev = 'ALICE'\n"
      );
    });
  });
});
