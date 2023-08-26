import { RegExpForeignCodeExtractor, getIndexOfCaptureGroup } from './regexp';

let R_CELL_MAGIC_EXISTS = `%%R
some text
`;

let PYTHON_CELL_MAGIC_WITH_H = `%%python
h`;

let NO_CELL_MAGIC = `%R
some text
%%R
some text
`;

let R_LINE_MAGICS = `%R df = data.frame()
print("df created")
%R ggplot(df)
print("plotted")
`;

let HTML_IN_PYTHON = `
x = """<a href="#">
<b>important</b> link
</a>""";
print(x)`;

describe('getIndexOfCaptureGroup', () => {
  it('extracts index of a captured group', () => {
    // tests for https://github.com/jupyter-lsp/jupyterlab-lsp/issues/559
    let result = getIndexOfCaptureGroup(
      new RegExp('^%%(python|python2|python3|pypy)( .*?)?\\n([^]*)'),
      '%%python\nh',
      'h'
    );
    expect(result).toBe(9);
  });
});

describe('RegExpForeignCodeExtractor', () => {
  let r_cell_extractor = new RegExpForeignCodeExtractor({
    language: 'R',
    pattern: '^%%R( .*?)?\n([^]*)',
    foreignCaptureGroups: [2],
    keepInHost: true,
    isStandalone: false,
    fileExtension: 'R'
  });

  let r_line_extractor = new RegExpForeignCodeExtractor({
    language: 'R',
    pattern: '(^|\n)%R (.*)\n?',
    foreignCaptureGroups: [2],
    keepInHost: true,
    isStandalone: false,
    fileExtension: 'R'
  });

  let python_cell_extractor = new RegExpForeignCodeExtractor({
    language: 'python',
    pattern: '^%%(python|python2|python3|pypy)( .*?)?\\n([^]*)',
    foreignCaptureGroups: [3],
    keepInHost: true,
    isStandalone: true,
    fileExtension: 'py'
  });

  describe('#hasForeignCode()', () => {
    it('detects cell magics', () => {
      let result = r_cell_extractor.hasForeignCode(R_CELL_MAGIC_EXISTS);
      expect(result).toBe(true);

      result = r_cell_extractor.hasForeignCode(R_LINE_MAGICS);
      expect(result).toBe(false);

      result = r_cell_extractor.hasForeignCode(NO_CELL_MAGIC);
      expect(result).toBe(false);
    });

    it('is not stateful', () => {
      // stateful implementation of regular expressions in JS can easily lead to
      // an error manifesting it two consecutive checks giving different results,
      // as the last index was moved in between:
      let result = r_cell_extractor.hasForeignCode(R_CELL_MAGIC_EXISTS);
      expect(result).toBe(true);

      result = r_cell_extractor.hasForeignCode(R_CELL_MAGIC_EXISTS);
      expect(result).toBe(true);
    });

    it('detects line magics', () => {
      let result = r_line_extractor.hasForeignCode(R_LINE_MAGICS);
      expect(result).toBe(true);

      result = r_line_extractor.hasForeignCode(R_CELL_MAGIC_EXISTS);
      expect(result).toBe(false);
    });
  });

  describe('#extractForeignCode()', () => {
    it('should correctly return the range', () => {
      let results = python_cell_extractor.extractForeignCode(
        PYTHON_CELL_MAGIC_WITH_H
      );
      expect(results.length).toBe(1);

      let result = results[0];

      // test against https://github.com/jupyter-lsp/jupyterlab-lsp/issues/559
      expect(result.hostCode).toBe(PYTHON_CELL_MAGIC_WITH_H);
      expect(result.foreignCode).toBe('h');

      expect(result.range!.start.line).toBe(1);
      expect(result.range!.start.column).toBe(0);
      expect(result.range!.end.line).toBe(1);
      expect(result.range!.end.column).toBe(1);
    });

    it('should work with non-line magic and non-cell magic code snippets as well', () => {
      // Note: in the real application, one should NOT use regular expressions for HTML extraction

      let html_extractor = new RegExpForeignCodeExtractor({
        language: 'HTML',
        pattern: '(<(.*?)( .*?)?>([^]*?)</\\2>)',
        foreignCaptureGroups: [1],
        keepInHost: false,
        isStandalone: false,
        fileExtension: 'html'
      });

      let results = html_extractor.extractForeignCode(HTML_IN_PYTHON);
      expect(results.length).toBe(2);
      let result = results[0];
      // TODO: is tolerating the new line added here ok?
      expect(result.hostCode).toBe('\nx = """\n');
      expect(result.foreignCode).toBe(
        '<a href="#">\n<b>important</b> link\n</a>'
      );
      expect(result.range!.start.line).toBe(1);
      expect(result.range!.start.column).toBe(7);
      expect(result.range!.end.line).toBe(3);
      expect(result.range!.end.column).toBe(4);
      let last_bit = results[1];
      expect(last_bit.hostCode).toBe('""";\nprint(x)');
    });

    it('should extract cell magics and keep in host', () => {
      let results = r_cell_extractor.extractForeignCode(R_CELL_MAGIC_EXISTS);
      expect(results.length).toBe(1);
      let result = results[0];

      expect(result.hostCode).toBe(R_CELL_MAGIC_EXISTS);
      expect(result.foreignCode).toBe('some text\n');
      expect(result.range!.start.line).toBe(1);
      expect(result.range!.start.column).toBe(0);
    });

    it('should extract and remove from host', () => {
      let extractor = new RegExpForeignCodeExtractor({
        language: 'R',
        pattern: '^%%R( .*?)?\n([^]*)',
        foreignCaptureGroups: [2],
        keepInHost: false,
        isStandalone: false,
        fileExtension: 'R'
      });
      let results = extractor.extractForeignCode(R_CELL_MAGIC_EXISTS);
      expect(results.length).toBe(1);

      let result = results[0];

      expect(result.foreignCode).toBe('some text\n');
      expect(result.hostCode).toBe('');
    });

    it('should extract multiple line magics deleting them from host', () => {
      let r_line_extractor = new RegExpForeignCodeExtractor({
        language: 'R',
        pattern: '(^|\n)%R (.*)\n?',
        foreignCaptureGroups: [2],
        keepInHost: false,
        isStandalone: false,
        fileExtension: 'R'
      });
      let results = r_line_extractor.extractForeignCode(R_LINE_MAGICS);

      // 2 line magics to be extracted + the unprocessed host code
      expect(results.length).toBe(3);

      let first_magic = results[0];

      expect(first_magic.foreignCode).toBe('df = data.frame()');
      expect(first_magic.hostCode).toBe('');

      let second_magic = results[1];

      expect(second_magic.foreignCode).toBe('ggplot(df)');
      expect(second_magic.hostCode).toBe('print("df created")\n');

      let final_bit = results[2];

      expect(final_bit.foreignCode).toBe(null);
      expect(final_bit.hostCode).toBe('print("plotted")\n');
    });

    it('should extract multiple line magics preserving them in host', () => {
      let results = r_line_extractor.extractForeignCode(R_LINE_MAGICS);

      // 2 line magics to be extracted + the unprocessed host code
      expect(results.length).toBe(3);

      let first_magic = results[0];

      expect(first_magic.foreignCode).toBe('df = data.frame()');
      expect(first_magic.hostCode).toBe('%R df = data.frame()\n');
      expect(first_magic.range!.end.line).toBe(0);
      expect(first_magic.range!.end.column).toBe(20);

      let second_magic = results[1];

      expect(second_magic.foreignCode).toBe('ggplot(df)');
      expect(second_magic.hostCode).toBe(
        'print("df created")\n%R ggplot(df)\n'
      );

      let final_bit = results[2];

      expect(final_bit.foreignCode).toBe(null);
      expect(final_bit.hostCode).toBe('print("plotted")\n');
    });

    it('should extract single line magic which does not end with a blank line', () => {
      let results = r_line_extractor.extractForeignCode('%R test');

      expect(results.length).toBe(1);
      let result = results[0];
      expect(result.foreignCode).toBe('test');
    });

    it('should not extract magic-like text from the middle of the cell', () => {
      let results = r_cell_extractor.extractForeignCode(NO_CELL_MAGIC);

      expect(results.length).toBe(1);
      let result = results[0];
      expect(result.foreignCode).toBe(null);
      expect(result.hostCode).toBe(NO_CELL_MAGIC);
      expect(result.range).toBe(null);
    });
  });
});
