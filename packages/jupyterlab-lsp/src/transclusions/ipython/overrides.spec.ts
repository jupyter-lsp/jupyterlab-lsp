import { ReversibleOverridesMap } from '../../overrides/maps';

import { overrides } from './overrides';

const CELL_MAGIC_EXISTS = `%%MAGIC
some text
`;

const CELL_MAGIC_WITH_DOCSTRINGS = `%%MAGIC
text
"""a docstring"""
'''a less common docstring'''
'single quotes'
"double quotes"
text
`;

const ESCAPED_TEXT_WITH_DOCSTRINGS = `text
\\"\\"\\"a docstring\\"\\"\\"
'''a less common docstring'''
'single quotes'
"double quotes"
text
`;

const NO_CELL_MAGIC = `%MAGIC
some text
%%MAGIC
some text
`;

const LINE_MAGIC_WITH_SPACE = `%MAGIC line = dd`;

describe('Default IPython overrides', () => {
  describe('IPython cell magics', () => {
    let cellMagicsMap = new ReversibleOverridesMap(
      overrides.filter(override => override.scope == 'cell')
    );
    it('overrides cell magics', () => {
      let override = cellMagicsMap.overrideFor(CELL_MAGIC_EXISTS)!;
      expect(override).toBe(
        'get_ipython().run_cell_magic("MAGIC", "", """some text\n""")'
      );

      let reverse = cellMagicsMap.reverse.overrideFor(override);
      expect(reverse).toBe(CELL_MAGIC_EXISTS);
    });

    it('works for empty cells', () => {
      // those are not correct syntax, but will happen when users are in the process of writing
      const cellMagicWithArgs = '%%MAGIC\n';
      let override = cellMagicsMap.overrideFor(cellMagicWithArgs)!;
      expect(override).toBe(
        'get_ipython().run_cell_magic("MAGIC", "", """""")'
      );

      let reverse = cellMagicsMap.reverse.overrideFor(override);
      expect(reverse).toBe(cellMagicWithArgs);
    });

    it('escapes arguments in the first line', () => {
      const cellMagicWithArgs = '%%MAGIC "arg in quotes"\ntext';
      let override = cellMagicsMap.overrideFor(cellMagicWithArgs)!;
      expect(override).toBe(
        'get_ipython().run_cell_magic("MAGIC", " \\"arg in quotes\\"", """text""")'
      );

      let reverse = cellMagicsMap.reverse.overrideFor(override);
      expect(reverse).toBe(cellMagicWithArgs);
    });

    it('some cell magic commands are unwrapped', () => {
      const cellMagicToUnwrap = "%%capture --no-display\ntext";
      let override = cellMagicsMap.overrideFor(cellMagicToUnwrap)!;
      expect(override).toBe(
        '# START_CELL_MAGIC("capture", " --no-display")\ntext\n# END_CELL_MAGIC'
      );

      let reverse = cellMagicsMap.reverse.overrideFor(override);
      expect(reverse).toBe(cellMagicToUnwrap);
    });

    it('escapes docstrings properly', () => {
      let override = cellMagicsMap.overrideFor(CELL_MAGIC_WITH_DOCSTRINGS)!;
      expect(override).toBe(
        'get_ipython().run_cell_magic("MAGIC", "", """' +
          ESCAPED_TEXT_WITH_DOCSTRINGS +
          '""")'
      );

      let reverse = cellMagicsMap.reverse.overrideFor(override);
      expect(reverse).toBe(CELL_MAGIC_WITH_DOCSTRINGS);
    });

    it('does not override cell-magic-like constructs', () => {
      let override = cellMagicsMap.overrideFor(NO_CELL_MAGIC);
      expect(override).toBe(null);

      override = cellMagicsMap.overrideFor(LINE_MAGIC_WITH_SPACE);
      expect(override).toBe(null);
    });
  });

  describe('IPython line magics', () => {
    let lineMagicsMap = new ReversibleOverridesMap(
      overrides.filter(override => override.scope == 'line')
    );
    it('overrides line magics', () => {
      let override = lineMagicsMap.overrideFor(LINE_MAGIC_WITH_SPACE)!;
      expect(override).toBe(
        'get_ipython().run_line_magic("MAGIC", " line = dd")'
      );

      let reverse = lineMagicsMap.reverse.overrideFor(override);
      expect(reverse).toBe(LINE_MAGIC_WITH_SPACE);
    });

    it('overrides x =%ls and x = %ls', () => {
      // this is a corner-case as described in
      // https://github.com/jupyter-lsp/jupyterlab-lsp/issues/281#issuecomment-645286076
      let override = lineMagicsMap.overrideFor('x =%ls');
      expect(override).toBe('x =get_ipython().run_line_magic("ls", "")');

      override = lineMagicsMap.overrideFor('x = %ls');
      expect(override).toBe('x = get_ipython().run_line_magic("ls", "")');
    });

    it('does not override line-magic-like constructs', () => {
      let override = lineMagicsMap.overrideFor('list("%")');
      expect(override).toBe(null);

      override = lineMagicsMap.overrideFor('list(" %test")');
      expect(override).toBe(null);
    });

    it('does not override modulo operators', () => {
      let override = lineMagicsMap.overrideFor('3 % 2');
      expect(override).toBe(null);

      override = lineMagicsMap.overrideFor('3%2');
      expect(override).toBe(null);
    });

    it('escapes arguments', () => {
      let lineMagicWithArgs = '%MAGIC "arg"';
      let override = lineMagicsMap.overrideFor(lineMagicWithArgs)!;
      expect(override).toBe(
        'get_ipython().run_line_magic("MAGIC", " \\"arg\\"")'
      );

      let reverse = lineMagicsMap.reverse.overrideFor(override);
      expect(reverse).toBe(lineMagicWithArgs);

      lineMagicWithArgs = '%MAGIC "arg\\"';
      override = lineMagicsMap.overrideFor(lineMagicWithArgs)!;
      expect(override).toBe(
        'get_ipython().run_line_magic("MAGIC", " \\"arg\\\\\\"")'
      );

      reverse = lineMagicsMap.reverse.overrideFor(override);
      expect(reverse).toBe(lineMagicWithArgs);
    });

    it('overrides shell commands', () => {
      let override = lineMagicsMap.overrideFor('!ls -o')!;
      expect(override).toBe('get_ipython().getoutput("ls -o")')!;

      let reverse = lineMagicsMap.reverse.overrideFor(override);
      expect(reverse).toBe('!ls -o');
    });

    it('overrides shell commands assignments: x =!ls and x = !ls', () => {
      let override = lineMagicsMap.overrideFor('x =!ls');
      expect(override).toBe('x =get_ipython().getoutput("ls")');

      override = lineMagicsMap.overrideFor('x = !ls');
      expect(override).toBe('x = get_ipython().getoutput("ls")');
    });

    it('does not override shell-like constructs', () => {
      let override = lineMagicsMap.overrideFor('"!ls"');
      expect(override).toBe(null);
    });

    it('does not override != comparisons', () => {
      let override = lineMagicsMap.overrideFor('1 != None');
      expect(override).toBe(null);
    });
  });

  describe('IPython help line magics', () => {
    let lineMagicsMap = new ReversibleOverridesMap(
      overrides.filter(override => override.scope == 'line')
    );

    it('overrides pinfo', () => {
      let override = lineMagicsMap.overrideFor('?int')!;
      expect(override).toBe("get_ipython().run_line_magic('pinfo', 'int')");

      let reverse = lineMagicsMap.reverse.overrideFor(override);
      expect(reverse).toBe('?int');

      override = lineMagicsMap.overrideFor('int?')!;
      expect(override).toBe("get_ipython().run_line_magic('pinfo',  'int')");

      reverse = lineMagicsMap.reverse.overrideFor(override);
      expect(reverse).toBe('int?');
    });

    it('overrides pinfo2', () => {
      let override = lineMagicsMap.overrideFor('??int')!;
      expect(override).toBe("get_ipython().run_line_magic('pinfo2', 'int')");

      let reverse = lineMagicsMap.reverse.overrideFor(override);
      expect(reverse).toBe('??int');

      override = lineMagicsMap.overrideFor('int??')!;
      expect(override).toBe("get_ipython().run_line_magic('pinfo2',  'int')");

      reverse = lineMagicsMap.reverse.overrideFor(override);
      expect(reverse).toBe('int??');

      override = lineMagicsMap.overrideFor('some_func??')!;
      expect(override).toBe(
        "get_ipython().run_line_magic('pinfo2',  'some_func')"
      );
      reverse = lineMagicsMap.reverse.overrideFor(override);
      expect(reverse).toBe('some_func??');
    });

    it('does not override standalone question marks', () => {
      let override = lineMagicsMap.overrideFor("'q?'");
      expect(override).toBe(null);

      override = lineMagicsMap.overrideFor('#?');
      expect(override).toBe(null);

      override = lineMagicsMap.overrideFor("?q'");
      expect(override).toBe(null);

      override = lineMagicsMap.overrideFor("?#'");
      expect(override).toBe(null);
    });
  });
});
