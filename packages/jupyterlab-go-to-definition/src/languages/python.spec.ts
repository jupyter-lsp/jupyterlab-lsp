import { expect } from 'chai';

import { CodeEditor } from '@jupyterlab/codeeditor';
import { CodeMirrorEditor } from '@jupyterlab/codemirror';

import { CodeMirrorTokensProvider } from '../editors/codemirror/tokens';

import { QueryFunction, RuleFunction, TokenContext } from './analyzer';
import { PythonAnalyzer } from './python';
import { Jumper, matchToken } from '../testutils';
import IToken = CodeEditor.IToken;

describe('PythonAnalyzer', () => {
  let analyzer: PythonAnalyzer;
  let editor: CodeMirrorEditor;
  let tokensProvider: CodeMirrorTokensProvider;
  let model: CodeEditor.Model;
  let host: HTMLElement;

  function runWithSelectedToken(
    method: RuleFunction,
    tokenName: string,
    tokenOccurrence = 1,
    tokenType = 'variable'
  ) {
    let tokens = tokensProvider.getTokens();
    let token = matchToken(tokens, tokenName, tokenOccurrence, tokenType);
    let tokenId = tokens.indexOf(token);

    analyzer.tokens = tokens;

    return method.bind(analyzer)(new TokenContext(token, tokens, tokenId));
  }

  function queryWithSelectedToken(
    method: QueryFunction,
    tokenName: string,
    tokenOccurrence = 1,
    tokenType = 'variable'
  ) {
    let tokens = tokensProvider.getTokens();
    let token = matchToken(tokens, tokenName, tokenOccurrence, tokenType);
    let tokenId = tokens.indexOf(token);

    analyzer.tokens = tokens;

    return method.bind(analyzer)(new TokenContext(token, tokens, tokenId));
  }

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);

    model = new CodeEditor.Model({ mimeType: 'text/x-python' });
    editor = new CodeMirrorEditor({ host, model, config: { mode: 'python' } });
    tokensProvider = new CodeMirrorTokensProvider(editor);
    analyzer = new PythonAnalyzer(tokensProvider);
  });

  afterEach(() => {
    editor.dispose();
    document.body.removeChild(host);
  });

  describe('#isStandaloneAssignment()', () => {
    it('should recognize assignments', () => {
      model.value.text = 'x = 1';
      expect(runWithSelectedToken(analyzer.isStandaloneAssignment, 'x')).to.be
        .true;
    });

    it('should recognize transitive assignments', () => {
      model.value.text = 'x = y = 1';
      expect(runWithSelectedToken(analyzer.isStandaloneAssignment, 'x')).to.be
        .true;
      expect(runWithSelectedToken(analyzer.isStandaloneAssignment, 'y')).to.be
        .true;
    });

    it('should ignore increments', () => {
      model.value.text = 'x += 1';
      expect(runWithSelectedToken(analyzer.isStandaloneAssignment, 'x')).to.be
        .false;
    });
  });

  // TODO: output of R cell magic (%%R), which usually comes along many other parameters:
  //  %%R -o x                  # simple case
  //  %%R -i y -o x -w 800      # case with other parameters
  //  should this be handled by R or Python analyzer?
  //  in broader terms, should the variables scopes be separated between languages?
  describe('#isRMagicOutput()', () => {
    it('should simple line magic export from R', () => {
      model.value.text = '%R -o x';
      expect(runWithSelectedToken(analyzer.isRMagicOutput, 'x')).to.be.true;

      model.value.text = '%R -o x x = 1';
      expect(runWithSelectedToken(analyzer.isRMagicOutput, 'x')).to.be.true;
      expect(runWithSelectedToken(analyzer.isRMagicOutput, 'x', 2)).to.be.false;
    });
  });

  describe('#isStoreMagic()', () => {
    it('should recognize IPython %store -r magic function', () => {
      model.value.text = '%store -r x';
      expect(runWithSelectedToken(analyzer.isStoreMagic, 'x')).to.be.true;

      model.value.text = '%store -r x y';
      expect(runWithSelectedToken(analyzer.isStoreMagic, 'x')).to.be.true;
      expect(runWithSelectedToken(analyzer.isStoreMagic, 'y')).to.be.true;

      model.value.text = '%store -r r store';
      expect(runWithSelectedToken(analyzer.isStoreMagic, 'r', 1)).to.be.false;
      expect(runWithSelectedToken(analyzer.isStoreMagic, 'store', 1)).to.be
        .false;
      expect(runWithSelectedToken(analyzer.isStoreMagic, 'r', 2)).to.be.true;
      expect(runWithSelectedToken(analyzer.isStoreMagic, 'store', 2)).to.be
        .true;
    });

    it('should ignore other look-alikes', () => {
      model.value.text = '%store x';
      expect(runWithSelectedToken(analyzer.isStoreMagic, 'x')).to.be.false;

      model.value.text = '%store -r xx';
      expect(runWithSelectedToken(analyzer.isStoreMagic, 'x')).to.be.false;

      model.value.text = 'store -r x';
      expect(runWithSelectedToken(analyzer.isStoreMagic, 'x')).to.be.false;

      model.value.text = '# %store -r x';
      expect(runWithSelectedToken(analyzer.isStoreMagic, 'x')).to.be.false;
    });
  });

  describe('#isTupleUnpacking', () => {
    it('should recognize simple tuples', () => {
      model.value.text = 'a, b = 1, 2';
      expect(runWithSelectedToken(analyzer.isTupleUnpacking, 'a')).to.be.true;
      expect(runWithSelectedToken(analyzer.isTupleUnpacking, 'b')).to.be.true;
    });

    it('should handle brackets', () => {
      const cases = [
        'x, (y, z) = a, [b, c]',
        'x, (y, z) = a, (b, c)',
        '(x, y), z = (a, b), c',
        '(x, y), z = [a, b], c'
      ];

      for (let testCase of cases) {
        model.value.text = testCase;

        for (let definition of ['x', 'y', 'z']) {
          expect(runWithSelectedToken(analyzer.isTupleUnpacking, definition)).to
            .be.true;
        }

        for (let usage of ['a', 'b', 'c']) {
          expect(runWithSelectedToken(analyzer.isTupleUnpacking, usage)).to.be
            .false;
        }
      }
    });

    it('should not be mistaken with a simple function call', () => {
      model.value.text = 'x = y(a, b, c=1)';
      for (let notATupleMember of ['a', 'b', 'c', 'y']) {
        expect(runWithSelectedToken(analyzer.isTupleUnpacking, notATupleMember))
          .to.be.false;
      }

      // this is a very trivial tuple with just one member
      expect(runWithSelectedToken(analyzer.isTupleUnpacking, 'x')).to.be.true;
    });

    it('should not be mistaken with a complex function call', () => {
      model.value.text = 'x = y(a, b, c=(1, 2), d=[(1, 3)], e={})';
      for (let notATupleMember of ['a', 'b', 'c', 'd', 'e', 'y']) {
        expect(runWithSelectedToken(analyzer.isTupleUnpacking, notATupleMember))
          .to.be.false;
      }

      // see above
      expect(runWithSelectedToken(analyzer.isTupleUnpacking, 'x')).to.be.true;
    });
  });

  describe('#isForLoopOrComprehension', () => {
    it('should recognize variables declared inside of loops', () => {
      model.value.text = 'for x in range(10): pass';
      expect(runWithSelectedToken(analyzer.isForLoopOrComprehension, 'x')).to.be
        .true;
    });

    it('should recognize list and set comprehensions', () => {
      // list
      model.value.text = '[x for x in range(10)]';
      expect(runWithSelectedToken(analyzer.isForLoopOrComprehension, 'x', 2)).to
        .be.true;

      // with new lines
      model.value.text = '[\nx\nfor x in range(10)\n]';
      expect(runWithSelectedToken(analyzer.isForLoopOrComprehension, 'x', 2)).to
        .be.true;

      // set
      model.value.text = '{x for x in range(10)}';
      expect(runWithSelectedToken(analyzer.isForLoopOrComprehension, 'x', 2)).to
        .be.true;
    });
  });

  describe('#isCrossFileReference', () => {
    it('should handle "from y import x" upon clicking on "y"', () => {
      model.value.text = 'from y import x';
      expect(runWithSelectedToken(analyzer.isCrossFileReference, 'y')).to.be
        .true;
      // this will be handled separately as it requires opening cross-referenced file AND jumping to a position in it
      model.value.text = 'from y import x';
      expect(runWithSelectedToken(analyzer.isCrossFileReference, 'x')).to.be
        .false;

      expect(queryWithSelectedToken(analyzer.guessReferencePath, 'y')).to.eql([
        'y.py',
        'y/__init__.py'
      ]);
    });

    it('should handle "import y" upon clicking on "y"', () => {
      model.value.text = 'import y';
      expect(runWithSelectedToken(analyzer.isCrossFileReference, 'y')).to.be
        .true;
    });

    it('should handle "from a.b import c" when clicking on "b" (open a/b.py) or "a" (open a/__init__.py)', () => {
      model.value.text = 'from a.b import c';
      expect(runWithSelectedToken(analyzer.isCrossFileReference, 'a')).to.be
        .true;

      expect(
        runWithSelectedToken(analyzer.isCrossFileReference, 'b', 1, 'property')
      ).to.be.true;

      expect(
        queryWithSelectedToken(analyzer.guessReferencePath, 'b', 1, 'property')
      ).to.eql(['a/b.py', 'a/b/__init__.py']);
    });

    it('should handle import all, relatives and underscores', () => {
      model.value.text = 'a_b = 1; from .a_b import *';
      expect(
        runWithSelectedToken(
          analyzer.isCrossFileReference,
          'a_b',
          1,
          'property'
        )
      ).to.be.true;

      expect(
        queryWithSelectedToken(
          analyzer.guessReferencePath,
          'a_b',
          1,
          'property'
        )
      ).to.eql(['a_b.py', 'a_b/__init__.py']);
    });

    it('should handle "import a.b" upon clicking on "a" or "b"', () => {
      model.value.text = 'import a.b';
      expect(runWithSelectedToken(analyzer.isCrossFileReference, 'a')).to.be
        .true;

      expect(runWithSelectedToken(analyzer.isCrossFileReference, 'b')).to.be
        .true;

      expect(queryWithSelectedToken(analyzer.guessReferencePath, 'a')).to.eql([
        'a.py',
        'a/__init__.py'
      ]);

      expect(
        queryWithSelectedToken(analyzer.guessReferencePath, 'b', 1, 'property')
      ).to.eql(['a/b.py', 'a/b/__init__.py']);
    });

    // TODO:
    //  from . import b
    //  %run helpers/notebook_setup.ipynb
    //  %R source('a.R') # line magic of R in Python
  });
});

describe('Jumper with PythonAnalyzer', () => {
  let editor: CodeMirrorEditor;
  let tokensProvider: CodeMirrorTokensProvider;
  let model: CodeEditor.Model;
  let host: HTMLElement;
  let jumper: Jumper;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);

    model = new CodeEditor.Model({ mimeType: 'text/x-python' });
    editor = new CodeMirrorEditor({ host, model, config: { mode: 'python' } });
    tokensProvider = new CodeMirrorTokensProvider(editor);

    jumper = new Jumper(editor);
  });

  afterEach(() => {
    editor.dispose();
    document.body.removeChild(host);
  });

  function test_jump(
    token: IToken,
    first_position: CodeEditor.IPosition,
    second_position: CodeEditor.IPosition
  ) {
    editor.setCursorPosition(first_position);

    expect(editor.getCursorPosition()).to.deep.equal(first_position);
    expect(editor.getTokenForPosition(first_position)).to.deep.equal(token);

    jumper.jump_to_definition({ token: token, origin: null, mouseEvent: null });

    expect(editor.getCursorPosition()).to.deep.equal(second_position);
  }

  describe('Jumper', () => {
    it('should handle simple jumps', () => {
      model.value.text = 'a = 1\nx = a';

      let tokens = tokensProvider.getTokens();
      let token = matchToken(tokens, 'a', 2);

      let firstAPosition = { line: 0, column: 0 };
      let secondAPosition = { line: 1, column: 5 };

      test_jump(token, secondAPosition, firstAPosition);
    });

    it('handles variable usage inside definitions overriding the same variable', () => {
      model.value.text = 'a = 1\na = a + 1';

      let tokens = tokensProvider.getTokens();
      let token = matchToken(tokens, 'a', 3);

      let firstAPosition = { line: 0, column: 0 };
      let thirdAPosition = { line: 1, column: 5 };

      test_jump(token, thirdAPosition, firstAPosition);
    });

    it('should work in functions', () => {
      model.value.text = `def x():
    a = 1
    x = a
a = 2`;
      // note: the 'a = 2' was good enough to confuse script in previous version

      let tokens = tokensProvider.getTokens();
      let token = matchToken(tokens, 'a', 2);

      let firstAPosition = { line: 1, column: 4 };
      let secondAPosition = { line: 2, column: 4 + 5 };

      test_jump(token, secondAPosition, firstAPosition);
    });

    it('should recognize namespaces', () => {
      model.value.text = `def x():
    a = 1
    x = a

a = 2
y = a`;

      let tokens = tokensProvider.getTokens();
      let token = matchToken(tokens, 'a', 4);

      let thirdAPosition = { line: 4, column: 0 };
      let fourthAPosition = { line: 5, column: 5 };

      test_jump(token, fourthAPosition, thirdAPosition);
    });
  });
});
