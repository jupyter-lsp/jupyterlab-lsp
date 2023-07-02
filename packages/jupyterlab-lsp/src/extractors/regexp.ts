import { CodeEditor } from '@jupyterlab/codeeditor';

import { replacer } from '../overrides/tokens';
import {
  positionAtOffset,
  IExtractedCode,
  IForeignCodeExtractor
} from '@jupyterlab/lsp';

export function getIndexOfCaptureGroup(
  expression: RegExp,
  matchedString: string,
  valueOfCapturedGroup: string
): number {
  // TODO: use https://github.com/tc39/proposal-regexp-match-indices once supported in >95% of browsers
  //  (probably around 2025)

  // get index of the part that is being extracted to foreign document
  let capturedGroups = expression.exec(matchedString);

  if (capturedGroups == null) {
    console.warn(
      `No capture group found for ${expression} in ${matchedString}`
    );
    return -1;
  }

  let offsetInMatch = 0;

  // first element is a full match
  let fullMatched = capturedGroups[0];

  for (let group of capturedGroups.slice(1)) {
    if (typeof group === 'undefined') {
      continue;
    }

    if (group === valueOfCapturedGroup) {
      offsetInMatch += fullMatched.indexOf(group);
      break;
    }

    let groupEndOffset = fullMatched.indexOf(group) + group.length;

    fullMatched = fullMatched.slice(groupEndOffset);
    offsetInMatch += groupEndOffset;
  }

  return offsetInMatch;
}

export class RegExpForeignCodeExtractor implements IForeignCodeExtractor {
  options: RegExpForeignCodeExtractor.IOptions;
  language: string;
  globalExpression: RegExp;
  testExpression: RegExp;
  expression: RegExp;
  standalone: boolean;
  fileExtension: string;
  cellType: string[] = ['code'];

  constructor(options: RegExpForeignCodeExtractor.IOptions) {
    this.language = options.language;
    this.options = options;
    this.globalExpression = new RegExp(options.pattern, 'g');
    this.testExpression = new RegExp(options.pattern, 'g');
    this.expression = new RegExp(options.pattern);
    this.standalone = this.options.isStandalone;
    this.fileExtension = this.options.fileExtension;
  }

  hasForeignCode(code: string): boolean {
    const result = this.testExpression.test(code);
    this.testExpression.lastIndex = 0;
    return result;
  }

  extractForeignCode(code: string): IExtractedCode[] {
    const lines = code.split('\n');

    const extracts = new Array<IExtractedCode>();

    let startedFrom = this.globalExpression.lastIndex;
    let match: RegExpExecArray | null = this.globalExpression.exec(code);
    let hostCodeFragment: string;

    let chosenReplacer: string | replacer;
    let isNewApiReplacer: boolean = false;

    if (typeof this.options.foreignReplacer !== 'undefined') {
      chosenReplacer = this.options.foreignReplacer;
      isNewApiReplacer = true;
    } else if (typeof this.options.foreignCaptureGroups !== 'undefined') {
      chosenReplacer = '$' + this.options.foreignCaptureGroups.join('$');
      isNewApiReplacer = true;
    } else if (this.options.extractToForeign) {
      chosenReplacer = this.options.extractToForeign;
    } else {
      console.warn(
        `Foreign replacer not defined for extractor: {this.expression} - this is deprecated; use 'foreignReplacer' to define it`
      );
      return [];
    }

    while (match != null) {
      let matchedString = match[0];
      let positionShift: CodeEditor.IPosition | null = null;

      let foreignCodeFragment = matchedString.replace(
        this.expression,
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        chosenReplacer
      );
      let prefix = '';
      if (typeof this.options.extractArguments !== 'undefined') {
        prefix = matchedString.replace(
          this.expression,
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          this.options.extractArguments
        );
        positionShift = positionAtOffset(prefix.length, prefix.split('\n'));
      }

      // NOTE:
      // match.index + matchedString.length === this.sticky_expression.lastIndex

      let endIndex = this.globalExpression.lastIndex;

      if (this.options.keepInHost || this.options.keepInHost == null) {
        hostCodeFragment = code.substring(startedFrom, endIndex);
      } else {
        if (startedFrom === match.index) {
          hostCodeFragment = '';
        } else {
          hostCodeFragment = code.substring(startedFrom, match.index) + '\n';
        }
      }

      let foreignCodeGroupValue = foreignCodeFragment;

      if (isNewApiReplacer) {
        foreignCodeGroupValue = matchedString.replace(
          this.expression,
          '$' + Math.min(...this.options.foreignCaptureGroups!)
        );
      }

      const foreignGroupIndexInMatch = getIndexOfCaptureGroup(
        this.expression,
        matchedString,
        foreignCodeGroupValue
      );

      let startOffset = match.index + foreignGroupIndexInMatch;

      let start = positionAtOffset(startOffset, lines);
      let end = positionAtOffset(
        startOffset + foreignCodeFragment.length,
        lines
      );

      extracts.push({
        hostCode: hostCodeFragment,
        foreignCode: prefix + foreignCodeFragment,
        range: { start, end },
        virtualShift: positionShift
      });

      startedFrom = this.globalExpression.lastIndex;
      match = this.globalExpression.exec(code);
    }

    if (startedFrom !== code.length) {
      let finalHostCodeFragment = code.substring(startedFrom, code.length);
      extracts.push({
        hostCode: finalHostCodeFragment,
        foreignCode: null,
        range: null,
        virtualShift: null
      });
    }

    return extracts;
  }
}

namespace RegExpForeignCodeExtractor {
  export interface IOptions {
    /**
     * The foreign language.
     */
    language: string;
    /**
     * String giving regular expression to test cells for the foreign language presence.
     *
     * For example:
     *   - `%%R( (.*))?\n(.*)` will match R cells of rpy2
     *   - `(.*)'<html>(.*)</html>'(.*)` will match html documents in strings of any language using single ticks
     */
    pattern: string;
    /**
     * Array of numbers specifying match groups to be extracted from the regular expression match,
     * for the use in virtual document of the foreign language.
     * For the R example this should be `3`. Please not that these are 1-based, as the 0th index is the full match.
     * If multiple groups are given, those will be concatenated.
     *
     * If additional code is needed in between the groups, use `foreignReplacer` in addition to
     * `foreignCaptureGroups` (but not instead!).
     *
     * `foreignCaptureGroups` is required for proper offset calculation and will no longer be optional in 4.0.
     */
    foreignCaptureGroups?: number[];
    /**
     * Function to compose the foreign document code, in case if using a capture group alone is not sufficient;
     * If specified, `foreign_capture_group` should be specified as well, so that it points to the first occurrence
     * of the foreign code. When both are specified, `foreignReplacer` takes precedence.
     *
     * See:
     * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replace#specifying_a_function_as_a_parameter
     */
    foreignReplacer?: replacer;
    /**
     * @deprecated `extractToForeign` will be removed in 4.0; use `foreign_capture_group` or `foreignReplacer` instead
     */
    extractToForeign?: string | replacer;
    /**
     * If arguments from the cell or line magic are to be extracted and prepended before the extracted code,
     * set extractArguments to a replacer function taking the code and returning the string to be prepended.
     */
    extractArguments?: replacer;
    /**
     * Boolean if everything (true, default) or nothing (false) should be kept in the host document.
     *
     * For the R example this should be empty if we wish to ignore the cell,
     * but usually a better option is to retain the foreign code and use language
     * specific overrides to suppress the magic in a more controlled way, providing
     * dummy python code to handle cell input/output.
     *
     * Setting to false is DEPRECATED as it breaks the edit feature (while it could be fixed,
     * it would make the code considerably more complex).
     *
     * @deprecated `keepInHost` will be removed in 4.0
     */
    keepInHost?: boolean;
    /**
     * Should the foreign code be appended (False) to the previously established virtual document of the same language,
     * or is it standalone snippet which requires separate connection?
     */
    isStandalone: boolean;
    fileExtension: string;
  }
}
