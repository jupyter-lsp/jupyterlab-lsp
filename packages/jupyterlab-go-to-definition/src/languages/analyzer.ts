import { CodeEditor } from '@jupyterlab/codeeditor';
import { ITokensProvider } from '../editors/editor';

export type RuleFunction = (context: TokenContext) => boolean;
export type QueryFunction = (context: TokenContext) => string[];

export class TokenContext implements CodeEditor.IToken {
  // ReadonlyArray ?
  tokens: Array<CodeEditor.IToken>;

  _previous: TokenContext;
  token: CodeEditor.IToken;
  _next: TokenContext;

  index: number;

  constructor(
    token: CodeEditor.IToken,
    tokens: Array<CodeEditor.IToken>,
    index: number
  ) {
    this.token = token;
    this.index = index;
    this.tokens = tokens;
  }

  get simple_next() {
    return this.index + 1 < this.tokens.length
      ? this.tokens[this.index + 1].value
      : null;
  }

  get simple_previous() {
    return this.index - 1 >= 0 ? this.tokens[this.index - 1].value : null;
  }

  get previous() {
    if (!this._previous) {
      let { token, index } = _closestMeaningfulTokenWithIndex(
        this.index,
        this.tokens,
        -1
      );
      // TODO: null!!
      this._previous = new TokenContext(token, this.tokens, index);
    }
    return this._previous;
  }

  get next() {
    if (!this._next) {
      let { token, index } = _closestMeaningfulTokenWithIndex(
        this.index,
        this.tokens,
        +1
      );
      this._next = new TokenContext(token, this.tokens, index);
    }
    return this._next;
  }

  get value() {
    return this.token ? this.token.value : undefined;
  }
  get type() {
    return this.token.type;
  }
  get offset() {
    return this.token.offset;
  }
  get exists() {
    return !!this.token;
  }
}

export abstract class LanguageAnalyzer {
  tokens: Array<CodeEditor.IToken>;
  tokensProvider: ITokensProvider;
  supportsKernel = false;
  /**
   * Name of a variable for which a definition is sought
   */

  constructor(tokensProvider: ITokensProvider) {
    this.tokensProvider = tokensProvider;
  }

  abstract definitionRules: Array<RuleFunction>;

  isCrossFileReference(context: TokenContext) {
    // identify Python import, and R source(), library(), require()
    return false;
  }

  guessReferencePath(context: TokenContext) {
    // more than one guess allowed
    return [''];
  }

  referencePathQuery(context: TokenContext) {
    return '';
  }

  definitionLocationQuery(context: TokenContext) {
    return '';
  }

  _maybe_setup_tokens() {
    if (!this.tokens) {
      this.tokens = this.tokensProvider.getTokens();
    }
  }

  _get_token_index(token: CodeEditor.IToken) {
    this._maybe_setup_tokens();
    return this.tokens.findIndex(
      t =>
        t.value === token.value &&
        t.offset === token.offset &&
        t.type === token.type
    );
  }

  isDefinition(token: CodeEditor.IToken, i: number) {
    if (token.type === 'variable') {
      let token_context = new TokenContext(token, this.tokens, i);

      let isVariableDefinition: RuleFunction;

      for (isVariableDefinition of this.definitionRules) {
        if (isVariableDefinition.bind(this)(token_context)) {
          return true;
        }
      }

      // nothing matched
      return false;
    } else if (token.type === 'def') {
      // Matching function definition.

      // We could double-check that an opening parenthesis follows,
      // but we can assume that it is the responsibility of CodeMirror.
      return true;
    } else {
      // nothing matched
      return false;
    }
  }

  nameMatches(name: string, token: CodeEditor.IToken) {
    return token.value === name;
  }

  getDefinitions(variable: string) {
    this.tokens = this.tokensProvider.getTokens();

    return Array.from(this.tokens).filter(
      (token, i) =>
        this.nameMatches(variable, token) && this.isDefinition(token, i)
    );
  }

  isAssignment(token: CodeEditor.IToken) {
    return token.type === 'operator' && token.value === '=';
  }

  /**
   * Check whether testedToken belongs to same assignment expression as originToken
   *
   * #### Notes
   * To verify if token belongs to same assignment expression, the tokens
   * between testedToken and originToken as tested. The token is in same
   * assignment expression if there is an assignment token in between and
   * there are no expression-terminating tokens after such an assignment.
   *
   * We only need to look at the first assignment token, see this example:
   * a = 1; b = a
   */
  isTokenInSameAssignmentExpression(
    testedToken: CodeEditor.IToken,
    originToken: CodeEditor.IToken
  ): boolean {
    // Find tokens between token.offset and otherToken.offset.
    let tokensSet = new Set<CodeEditor.IToken>();

    for (
      let offset = testedToken.offset + 1;
      offset < originToken.offset + 1;
      offset++
    ) {
      let token = this.tokensProvider.getTokenAt(offset);
      if (token.offset === testedToken.offset) {
        continue;
      }
      tokensSet.add(token);
    }
    let tokensBetween = Array.from(tokensSet);

    // If there is no assignment token, we don't need to worry
    let assignments = tokensBetween.filter(this.isAssignment);

    if (!assignments.length) {
      return false;
    }

    let firstAssignment = assignments.sort((a, b) =>
      a.offset > b.offset ? 1 : -1
    )[0];

    // Select terminating tokens:
    let terminatingTokens = this._selectTerminatingTokens(tokensBetween);

    let terminatorsAfterAssignment = terminatingTokens.filter(
      token => token.offset > firstAssignment.offset
    );

    if (!terminatorsAfterAssignment.length) {
      return true;
    }

    return false;
  }

  abstract _selectTerminatingTokens(
    tokens: Array<CodeEditor.IToken>
  ): Array<CodeEditor.IToken>;
}

export abstract class LanguageWithOptionalSemicolons extends LanguageAnalyzer {
  _selectTerminatingTokens(tokens: Array<CodeEditor.IToken>) {
    // terminating tokens are:
    // semicolons and new lines (which are locally outside of brackets)
    let terminatingTokens = [];
    let openedBrackets = 0;
    const openingBrackets = '([{';
    const closingBrackets = ')]}';
    for (let token of tokens) {
      // let's assume that the code is properly formatted,
      // and do not check the order of brackets
      if (token.value !== '') {
        if (openingBrackets.includes(token.value)) {
          openedBrackets += 1;
          continue;
        } else if (closingBrackets.includes(token.value)) {
          openedBrackets -= 1;
          continue;
        }
      }
      // empty string is used as a token representing new-line
      let terminator = token.value === ';' || token.value === '';
      // if there is a closing bracket, completing a previously opened one,
      // which proceeds the token of origin, that is fine too (hence <= 0)
      if (openedBrackets <= 0 && terminator) {
        terminatingTokens.push(token);
      }
    }
    return terminatingTokens;
  }

  traverse_left(previous: TokenContext, step_on: string) {
    let is_sep = step_on.includes(previous.simple_next);

    while (is_sep && previous.exists) {
      previous = previous.previous;
      is_sep = step_on.includes(previous.simple_next);
    }
    return previous;
  }

  traverse_right(next: TokenContext, step_on: string) {
    let is_sep = step_on.includes(next.simple_previous);

    while (is_sep && next.exists) {
      next = next.next;
      is_sep = step_on.includes(next.simple_previous);
    }
    return next;
  }
}

interface ITokenWithIndex {
  index: number;
  token: CodeEditor.IToken;
}

export function _closestMeaningfulTokenWithIndex(
  tokenIndex: number,
  tokens: Array<CodeEditor.IToken>,
  direction: number
): ITokenWithIndex {
  let nextMeaningfulToken = null;
  while (nextMeaningfulToken == null) {
    tokenIndex += direction;
    if (tokenIndex < 0 || tokenIndex >= tokens.length) {
      return { index: null, token: null };
    }
    let nextToken = tokens[tokenIndex];
    if (nextToken.type !== '') {
      nextMeaningfulToken = nextToken;
    }
  }
  return { index: tokenIndex, token: nextMeaningfulToken };
}
