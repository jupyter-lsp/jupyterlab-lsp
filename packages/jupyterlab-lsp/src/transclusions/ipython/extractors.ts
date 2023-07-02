import { IForeignCodeExtractor } from '@jupyterlab/lsp';

import { RegExpForeignCodeExtractor } from '../../extractors/regexp';

interface IForeignCodeExtractorsRegistry {
  [host_language: string]: IForeignCodeExtractor[];
}

export let foreignCodeExtractors: IForeignCodeExtractorsRegistry = {
  // general note: to match new lines use [^] instead of dot, unless the target is ES2018, then use /s
  python: [
    //
    // Standalone IPython magics
    // (script magics are standalone, i.e. consecutive code cells with the same magic create two different namespaces)
    //
    new RegExpForeignCodeExtractor({
      language: 'python',
      pattern: '^%%(python|python2|python3|pypy)( .*?)?\n([^]*)',
      foreignCaptureGroups: [3],
      isStandalone: true,
      fileExtension: 'py'
    }),
    new RegExpForeignCodeExtractor({
      language: 'perl',
      pattern: '^%%(perl)( .*?)?\n([^]*)',
      foreignCaptureGroups: [3],
      isStandalone: true,
      fileExtension: 'pl'
    }),
    new RegExpForeignCodeExtractor({
      language: 'ruby',
      pattern: '^%%(ruby)( .*?)?\n([^]*)',
      foreignCaptureGroups: [3],
      isStandalone: true,
      fileExtension: 'rb'
    }),
    new RegExpForeignCodeExtractor({
      language: 'sh',
      pattern: '^%%(sh|bash)( .*?)?\n([^]*)',
      foreignCaptureGroups: [3],
      isStandalone: true,
      fileExtension: 'sh'
    }),
    new RegExpForeignCodeExtractor({
      language: 'html',
      pattern: '^%%(html --isolated)( .*?)?\n([^]*)',
      foreignCaptureGroups: [3],
      isStandalone: true,
      fileExtension: 'html'
    }),
    //
    // IPython magics producing continuous documents (non-standalone):
    //
    new RegExpForeignCodeExtractor({
      language: 'javascript',
      pattern: '^%%(js|javascript)( .*?)?\n([^]*)',
      foreignCaptureGroups: [3],
      isStandalone: false,
      fileExtension: 'js'
    }),
    new RegExpForeignCodeExtractor({
      language: 'html',
      pattern: '^%%(?!html --isolated)(html)( .*?)?\n([^]*)',
      foreignCaptureGroups: [3],
      isStandalone: false,
      fileExtension: 'html'
    }),
    new RegExpForeignCodeExtractor({
      language: 'latex',
      pattern: '^%%(latex)( .*?)?\n([^]*)',
      foreignCaptureGroups: [3],
      isStandalone: false,
      fileExtension: 'tex'
    }),
    new RegExpForeignCodeExtractor({
      language: 'markdown',
      pattern: '^%%(markdown)( .*?)?\n([^]*)',
      foreignCaptureGroups: [3],
      isStandalone: false,
      fileExtension: 'md'
    })
  ]
};
