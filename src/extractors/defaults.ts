import { IForeignCodeExtractorsRegistry } from './types';
import { RegExpForeignCodeExtractor } from './regexp';

// TODO: make the regex code extractors configurable
export let foreign_code_extractors: IForeignCodeExtractorsRegistry = {
  // general note: to match new lines use [^] instead of dot, unless the target is ES2018, then use /s
  python: [
    //
    // R magics (non-standalone: the R code will always be in the same, single R-namespace)
    //
    new RegExpForeignCodeExtractor({
      language: 'R',
      pattern: '^%%R( .*?)?\n([^]*)',
      extract_to_foreign: '$2',
      keep_in_host: true,
      is_standalone: false
    }),
    new RegExpForeignCodeExtractor({
      language: 'R',
      pattern: '(^|\n)%R (.*)\n?',
      extract_to_foreign: '$2',
      keep_in_host: true,
      is_standalone: false
    }),
    //
    // Standalone IPython magics
    // (script magics are standalone, i.e. consecutive code cells with the same magic create two different namespaces)
    //
    new RegExpForeignCodeExtractor({
      language: 'python',
      pattern: '^%%(python|python2|python3|pypy)( .*?)?\n([^]*)',
      extract_to_foreign: '$3',
      keep_in_host: false,
      is_standalone: true
    }),
    new RegExpForeignCodeExtractor({
      language: 'perl',
      pattern: '^%%(perl)( .*?)?\n([^]*)',
      extract_to_foreign: '$3',
      keep_in_host: false,
      is_standalone: true
    }),
    new RegExpForeignCodeExtractor({
      language: 'ruby',
      pattern: '^%%(ruby)( .*?)?\n([^]*)',
      extract_to_foreign: '$3',
      keep_in_host: false,
      is_standalone: true
    }),
    new RegExpForeignCodeExtractor({
      language: 'sh',
      pattern: '^%%(sh)( .*?)?\n([^]*)',
      extract_to_foreign: '$3',
      keep_in_host: false,
      is_standalone: true
    }),
    new RegExpForeignCodeExtractor({
      language: 'html',
      pattern: '^%%(html --isolated)( .*?)?\n([^]*)',
      extract_to_foreign: '$3',
      keep_in_host: false,
      is_standalone: true
    }),
    //
    // IPython magics producing continuous documents (non-standalone):
    //
    new RegExpForeignCodeExtractor({
      language: 'js',
      pattern: '^%%(js|javascript)( .*?)?\n([^]*)',
      extract_to_foreign: '$3',
      keep_in_host: false,
      is_standalone: false
    }),
    new RegExpForeignCodeExtractor({
      language: 'html',
      pattern: '^%%(html)( .*?)?\n([^]*)',
      extract_to_foreign: '$3',
      keep_in_host: false,
      is_standalone: false
    }),
    new RegExpForeignCodeExtractor({
      language: 'latex',
      pattern: '^%%(latex)( .*?)?\n([^]*)',
      extract_to_foreign: '$3',
      keep_in_host: false,
      is_standalone: false
    }),
    new RegExpForeignCodeExtractor({
      language: 'markdown',
      pattern: '^%%(markdown)( .*?)?\n([^]*)',
      extract_to_foreign: '$3',
      keep_in_host: false,
      is_standalone: false
    })
  ]
};
