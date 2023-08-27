import {
  extractCode,
  getTheOnlyVirtual,
  wrapInPythonLines,
  mockExtractorsManager
} from '../../extractors/testutils';
import { VirtualDocument } from '../../virtual/document';

import { SQL_URL_PATTERN, foreignCodeExtractors } from './extractors';

describe('IPython SQL extractors', () => {
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

  describe('SQL url pattern', () => {
    it('matches connection strings', () => {
      const correctUrls = [
        'mysql+pymysql://scott:tiger@localhost/foo',
        'oracle://scott:tiger@127.0.0.1:1521/sidname',
        'sqlite://',
        'sqlite:///foo.db',
        'mssql+pyodbc://username:password@host/database?driver=SQL+Server+Native+Client+11.0',
        'impala://hserverhost:port/default?kerberos_service_name=hive&auth_mechanism=GSSAPI'
      ];
      const pattern = new RegExp(SQL_URL_PATTERN);
      for (let url of correctUrls) {
        expect(pattern.test(url)).toBe(true);
      }
    });
  });

  describe('%sql line magic', () => {
    it('extracts simple commands', () => {
      let code = wrapInPythonLines('%sql select * from work');
      let { cellCodeKept, foreignDocumentsMap } = extract(code);

      // should not be removed, but left for the static analysis (using magic overrides)
      expect(cellCodeKept).toBe(code);
      let document = getTheOnlyVirtual(foreignDocumentsMap);
      expect(document.language).toBe('sql');
      expect(document.value).toBe('select * from work\n');
    });

    it('leaves out the connection specification', () => {
      let code = wrapInPythonLines(
        '%sql postgresql://will:longliveliz@localhost/shakes'
      );
      let foreignDocumentsMap = extract(code).foreignDocumentsMap;
      let document = getTheOnlyVirtual(foreignDocumentsMap);
      expect(document.language).toBe('sql');
      expect(document.value).toBe('\n');
    });

    it('leaves out options', () => {
      let code = wrapInPythonLines('%sql -l');
      let foreignDocumentsMap = extract(code).foreignDocumentsMap;
      let document = getTheOnlyVirtual(foreignDocumentsMap);
      expect(document.language).toBe('sql');
      expect(document.value).toBe('\n');
    });
  });

  describe('%%sql cell magic', () => {
    it('extracts simple commands', () => {
      let code = "%%sql\nselect * from character\nwhere abbrev = 'ALICE'";
      let { cellCodeKept, foreignDocumentsMap } = extract(code);

      expect(cellCodeKept).toBe(code);
      let document = getTheOnlyVirtual(foreignDocumentsMap);
      expect(document.language).toBe('sql');
      expect(document.value).toBe(
        "select * from character\nwhere abbrev = 'ALICE'\n"
      );
    });

    it('leaves out the connection specification', () => {
      let code =
        "%%sql postgresql://will:longliveliz@localhost/shakes\nselect * from character\nwhere abbrev = 'ALICE'";
      let { foreignDocumentsMap } = extract(code);

      let document = getTheOnlyVirtual(foreignDocumentsMap);
      expect(document.language).toBe('sql');
      expect(document.value).toBe(
        "select * from character\nwhere abbrev = 'ALICE'\n"
      );
    });

    it('leaves out the variable assignment', () => {
      let code = '%%sql works << SELECT title, year\nFROM work';
      let { foreignDocumentsMap } = extract(code);

      let document = getTheOnlyVirtual(foreignDocumentsMap);
      expect(document.language).toBe('sql');
      expect(document.value).toBe('SELECT title, year\nFROM work\n');
    });

    it('leaves out existing connection references', () => {
      let code = '%%sql will@shakes\nSELECT title, year\nFROM work';
      let { foreignDocumentsMap } = extract(code);

      let document = getTheOnlyVirtual(foreignDocumentsMap);
      expect(document.language).toBe('sql');
      expect(document.value).toBe('SELECT title, year\nFROM work\n');
    });

    it('leaves out persist option', () => {
      let code = '%%sql --persist dataframe\nSELECT * FROM dataframe;';
      let { foreignDocumentsMap } = extract(code);
      let document = getTheOnlyVirtual(foreignDocumentsMap);
      expect(document.language).toBe('sql');
      expect(document.value).toBe('SELECT * FROM dataframe;\n');
    });
  });
});
