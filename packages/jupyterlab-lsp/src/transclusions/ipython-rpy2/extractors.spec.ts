import {
  extractCode,
  getTheOnlyPair,
  getTheOnlyVirtual,
  wrapInPythonLines,
  mockExtractorsManager
} from '../../extractors/testutils';
import { VirtualDocument } from '../../virtual/document';

import { foreignCodeExtractors } from './extractors';

describe('IPython rpy2 extractors', () => {
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

  describe('%R line magic', () => {
    it('should not extract parts of non-code commands', () => {
      let code = wrapInPythonLines('%Rdevice svg');
      let { cellCodeKept, foreignDocumentsMap } = extract(code);

      expect(cellCodeKept).toBe(code);
      expect(foreignDocumentsMap.size).toBe(0);
    });

    it('correctly gives ranges in source', () => {
      let code = '%R ggplot()';
      let { foreignDocumentsMap } = extract(code);
      let { range } = getTheOnlyPair(foreignDocumentsMap);
      expect(range.start.line).toBe(0);
      // note: the space before ggplot() should NOT be included in the range
      expect(range.start.column).toBe(3);

      expect(range.end.line).toBe(0);
      expect(range.end.column).toBe(3 + 8);
    });

    it('correctly gives ranges in source when wrapped in lines', () => {
      let code = wrapInPythonLines('%R ggplot()');
      let { foreignDocumentsMap } = extract(code);
      let { range } = getTheOnlyPair(foreignDocumentsMap);
      expect(range.start.line).toBe(1);
      expect(range.start.column).toBe(3);

      expect(range.end.line).toBe(1);
      expect(range.end.column).toBe(3 + 8);
    });

    it('extracts simple commands', () => {
      let code = wrapInPythonLines('%R ggplot()');
      let { cellCodeKept, foreignDocumentsMap } = extract(code);

      // should not be removed, but left for the static analysis (using magic overrides)
      expect(cellCodeKept).toBe(code);
      let rDocument = getTheOnlyVirtual(foreignDocumentsMap);
      expect(rDocument.language).toBe('r');
      expect(rDocument.value).toBe('ggplot()\n');
    });

    it('parses input (into a dummy data frame)', () => {
      let code = wrapInPythonLines('%R -i df ggplot(df)');
      let { foreignDocumentsMap } = extract(code);

      let rDocument = getTheOnlyVirtual(foreignDocumentsMap);
      expect(rDocument.language).toBe('r');
      expect(rDocument.value).toBe('df <- data.frame(); ggplot(df)\n');
    });

    it('parses input when no code is given', () => {
      let code = '%R -i df';
      let { foreignDocumentsMap } = extract(code);

      let rDocument = getTheOnlyVirtual(foreignDocumentsMap);
      expect(rDocument.value).toBe('df <- data.frame();\n');
    });

    it('parses multiple inputs (into dummy data frames)', () => {
      let code = wrapInPythonLines('%R -i df -i x ggplot(df)');
      let { virtualDocument: rDocument } = getTheOnlyPair(
        extract(code).foreignDocumentsMap
      );
      expect(rDocument.value).toBe(
        'df <- data.frame(); x <- data.frame(); ggplot(df)\n'
      );
    });

    it('parses inputs ignoring other arguments', () => {
      let code = wrapInPythonLines('%R -i df --width 300 -o x ggplot(df)');
      let rDocument = getTheOnlyVirtual(extract(code).foreignDocumentsMap);
      expect(rDocument.value).toBe('df <- data.frame(); ggplot(df)\n');
    });
  });

  describe('%%R cell magic', () => {
    it('extracts simple commands', () => {
      let code = '%%R\nggplot()';
      let { cellCodeKept, foreignDocumentsMap } = extract(code);

      expect(cellCodeKept).toBe(code);
      let rDocument = getTheOnlyVirtual(foreignDocumentsMap);
      expect(rDocument.language).toBe('r');
      expect(rDocument.value).toBe('ggplot()\n');
    });
  });

  it('parses input (into a dummy data frame)', () => {
    let code = '%%R -i df\nggplot(df)';
    let { foreignDocumentsMap } = extract(code);

    let rDocument = getTheOnlyVirtual(foreignDocumentsMap);
    expect(rDocument.language).toBe('r');
    expect(rDocument.value).toBe('df <- data.frame(); ggplot(df)\n');
  });

  it('correctly gives ranges in source', () => {
    let code = '%%R\nggplot()';
    let { foreignDocumentsMap } = extract(code);
    let { range } = getTheOnlyPair(foreignDocumentsMap);
    expect(range.start.line).toBe(1);
    expect(range.start.column).toBe(0);

    expect(range.end.line).toBe(1);
    expect(range.end.column).toBe(8);
  });
});
