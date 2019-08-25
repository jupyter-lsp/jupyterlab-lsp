import { IExtractedCode, IForeignCodeExtractor } from './types';

export class RegExpForeignCodeExtractor implements IForeignCodeExtractor {
  options: RegExpForeignCodeExtractor.IOptions;
  language: string;
  expression: RegExp;

  constructor(options: RegExpForeignCodeExtractor.IOptions) {
    this.language = options.language;
    this.options = options;
    this.expression = new RegExp(options.pattern);
  }

  extract_foreign_code(code: string): IExtractedCode {
    let match = code.match(this.expression);
    if (match) {
      let host_code: string | null;

      if (this.options.keep_in_host === true) {
        host_code = code;
      } else if (this.options.keep_in_host === false) {
        host_code = null;
      } else {
        host_code = code.replace(this.expression, this.options.keep_in_host);
      }

      return {
        host_code: host_code,
        foreign_code: code.replace(
          this.expression,
          this.options.extract_to_foreign
        ),
        foreign_coordinates: {
          start: match.index,
          end: match.index + match[0].length
        },
        is_standalone: this.options.is_standalone
      };
    } else {
      return {
        host_code: code,
        foreign_code: null,
        foreign_coordinates: null,
        is_standalone: this.options.is_standalone
      };
    }
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
     *   - %%R( (.*))?\n(.*) will match R cells of rpy2
     *   - (.*)'<html>(.*)</html>'(.*) will match html documents in strings of any language using single ticks
     */
    pattern: string;
    /**
     * String specifying match groups to be extracted from the regular expression match,
     * for the use in virtual document of the foreign language.
     * For the R example this should be '$3'
     */
    extract_to_foreign: string;
    /**
     * String specifying match groups to be extracted from the regular expression match,
     * for the use in virtual document of the host language, or boolean if everything (true)
     * or nothing (false) should be kept in the host document.
     *
     * For the R example this should be empty if we wish to ignore the cell,
     * but usually a better option is to retain the foreign code and use language
     * specific overrides to suppress the magic in a more controlled way.
     */
    keep_in_host: string | boolean;
    /**
     * Should the foreign code be appended (False) to the previously established virtual document of the same language,
     * or is it standalone snippet which requires separate connection?
     */
    is_standalone: boolean;
  }
}
