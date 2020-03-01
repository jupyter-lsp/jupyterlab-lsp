import { expect } from 'chai';

import { CodeEditor } from '@jupyterlab/codeeditor';

import { ITokensProvider } from '../editors/editor';

import { LanguageWithOptionalSemicolons, RuleFunction } from './analyzer';

class TextBasedTokensProvider implements ITokensProvider {
  tokens: Array<CodeEditor.IToken>;

  setTokensFromText(text: string) {
    this.tokens = text.split(' ').map((value, i) => {
      return { value: value, offset: i };
    });
  }

  getTokens(): Array<CodeEditor.IToken> {
    return this.tokens;
  }

  getTokenAt(offset: number): CodeEditor.IToken {
    return;
  }
}

class TestLanguageAnalyzer extends LanguageWithOptionalSemicolons {
  definitionRules: Array<RuleFunction> = [];

  isTokenInSameAssignmentExpression(
    testedToken: CodeEditor.IToken,
    originToken: CodeEditor.IToken
  ): boolean {
    return false;
  }
}

describe('LanguageAnalyzer', () => {
  let analyzer: TestLanguageAnalyzer;
  let testToken: CodeEditor.IToken;
  let tokensProvider: TextBasedTokensProvider;

  beforeEach(() => {
    tokensProvider = new TextBasedTokensProvider();
    analyzer = new TestLanguageAnalyzer(tokensProvider);
  });

  describe('#nameMatches()', () => {
    beforeEach(() => {
      tokensProvider.setTokensFromText('test_token');
      testToken = { value: null, offset: null };
    });

    it('should recognize tokens by name', () => {
      testToken.value = 'test_token';
      let match = analyzer.nameMatches('test_token', testToken);
      expect(match).to.be.true;
    });

    it('should be case-sensitive', () => {
      testToken.value = 'Test_token';
      let match = analyzer.nameMatches('test_token', testToken);
      expect(match).to.be.false;
    });
  });
});
