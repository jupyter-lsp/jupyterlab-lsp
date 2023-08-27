import { RegExpForeignCodeExtractor } from '../../extractors/regexp';
import { IForeignCodeExtractorsRegistry } from '../../extractors/types';

import { RPY2_MAX_ARGS, extractArgs, argsPattern } from './rpy2';

function createExtractor(stripLeadingSpace: boolean) {
  function codeExtractor(match: string, ...args: string[]) {
    let r = extractArgs(args, -3);
    let code: string;
    if (r.rest == null) {
      code = '';
    } else if (stripLeadingSpace) {
      code = r.rest.startsWith(' ') ? r.rest.slice(1) : r.rest;
    } else {
      code = r.rest;
    }
    return code;
  }

  return codeExtractor;
}

const extractorNonStripping = createExtractor(false);

function args(match: string, ...args: string[]) {
  let r = extractArgs(args, -3);
  // define dummy input variables using empty data frames
  let inputs = r.inputs.map(i => i + ' <- data.frame();').join(' ');
  let code = extractorNonStripping(match, ...args);
  if (inputs !== '' && code) {
    inputs += ' ';
  }
  return inputs;
}

export let foreignCodeExtractors: IForeignCodeExtractorsRegistry = {
  // general note: to match new lines use [^] instead of dot, unless the target is ES2018, then use /s
  python: [
    //
    // R magics (non-standalone: the R code will always be in the same, single R-namespace)
    //
    new RegExpForeignCodeExtractor({
      language: 'r',
      pattern: '^%%R' + argsPattern(RPY2_MAX_ARGS) + '\n([^]*)',
      foreignCaptureGroups: [RPY2_MAX_ARGS * 2 + 1],
      // it is important to not strip any leading spaces
      foreignReplacer: extractorNonStripping,
      extractArguments: args,
      isStandalone: false,
      fileExtension: 'R'
    }),
    new RegExpForeignCodeExtractor({
      language: 'r',
      // it is very important to not include the space which will be trimmed in the capture group,
      // otherwise the offset will be off by one and the R language server will crash
      pattern: '(?:^|\n)%R' + argsPattern(RPY2_MAX_ARGS) + '(?: (.*))?(?:\n|$)',
      foreignCaptureGroups: [RPY2_MAX_ARGS * 2 + 1],
      foreignReplacer: createExtractor(true),
      extractArguments: args,
      isStandalone: false,
      fileExtension: 'R'
    })
  ]
};
