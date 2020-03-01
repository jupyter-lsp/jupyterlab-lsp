import { expect } from 'chai';

import { CodeEditor } from '@jupyterlab/codeeditor';
import { CodeMirrorEditor } from '@jupyterlab/codemirror';

import { CodeMirrorTokensProvider } from '../editors/codemirror/tokens';

import { TokenContext } from './analyzer';
import { RAnalyzer } from './r';

describe('RAnalyzer', () => {
  let analyzer: RAnalyzer;
  let editor: CodeMirrorEditor;
  let tokensProvider: CodeMirrorTokensProvider;
  let model: CodeEditor.Model;
  let host: HTMLElement;

  function tokenNeighbourhood(
    tokenName: string,
    tokenOccurrence = 1,
    tokenType = 'variable'
  ) {
    let tokens = tokensProvider.getTokens();
    let matchedTokens = tokens.filter(
      token => token.value == tokenName && token.type == tokenType
    );
    let token = matchedTokens[tokenOccurrence - 1];
    let tokenId = tokens.indexOf(token);

    return new TokenContext(token, tokens, tokenId);
  }

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);

    model = new CodeEditor.Model({ mimeType: 'text/x-rsrc' });
    editor = new CodeMirrorEditor({ host, model, config: { mode: 'rsrc' } });
    tokensProvider = new CodeMirrorTokensProvider(editor);
    analyzer = new RAnalyzer(tokensProvider);
  });

  afterEach(() => {
    editor.dispose();
    document.body.removeChild(host);
  });

  describe('#isStandaloneAssignment()', () => {
    it('should recognize assignments', () => {
      const cases = ['x = 1', 'x <- 1', 'x <<- 1', '1 -> x', '1 ->> x'];
      let text: string;

      for (text of cases) {
        model.value.text = text;
        expect(analyzer.isStandaloneAssignment(tokenNeighbourhood('x'))).to.be
          .true;
      }
    });

    it('should ignore increments', () => {
      model.value.text = 'x += 1';
      expect(analyzer.isStandaloneAssignment(tokenNeighbourhood('x'))).not.to.be
        .true;
    });
  });

  describe('#isForLoop', () => {
    it('should recognize variables declared inside of loops', () => {
      model.value.text = 'for (x in 1:10){}';
      expect(analyzer.isForLoop(tokenNeighbourhood('x'))).to.be.true;
    });
  });

  describe('#isImport', () => {
    it('should recognize the most common ways to load namespaces', () => {
      model.value.text = 'library(shiny)\nshiny::p';
      expect(analyzer.isImport(tokenNeighbourhood('shiny'))).to.be.true;

      model.value.text = 'require(dplyr)\ndplyr:filter';
      expect(analyzer.isImport(tokenNeighbourhood('dplyr'))).to.be.true;
    });

    it('should work with R "import" package', () => {
      model.value.text =
        'import::here(fun_a, fun_b, .from = "other_resources.R")';
      expect(analyzer.isImport(tokenNeighbourhood('fun_a'))).to.be.true;
      expect(analyzer.isImport(tokenNeighbourhood('fun_b'))).to.be.true;

      // TODO: import::from
    });
  });

  describe('#isCrossFileReference', () => {
    it('should recognize source', () => {
      model.value.text = "source('test.R')";
      expect(analyzer.isCrossFileReference(tokenNeighbourhood('source'))).to.be
        .true;

      model.value.text = 'source("test.R")';
      expect(analyzer.isCrossFileReference(tokenNeighbourhood('source'))).to.be
        .true;
    });

    it('should work with R "import" package', () => {
      model.value.text =
        'import::here(fun_a, fun_b, .from = "other_resources.R")';
      expect(analyzer.isCrossFileReference(tokenNeighbourhood('.from'))).to.be
        .true;

      expect(analyzer.guessReferencePath(tokenNeighbourhood('.from'))).to.eql([
        'other_resources.R'
      ]);
    });
  });
});
