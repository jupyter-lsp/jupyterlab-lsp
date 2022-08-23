import { CodeEditor } from '@jupyterlab/codeeditor';
import { expect } from 'chai';
import type * as lsProtocol from 'vscode-languageserver-types';

import { BrowserConsole } from '../../virtual/console';

import { transformLSPCompletions } from './completion_handler';

describe('transformLSPCompletions', () => {
  const browserConsole = new BrowserConsole();

  const transform = (
    token: CodeEditor.IToken,
    position: number,
    completions: lsProtocol.CompletionItem[]
  ) => {
    return transformLSPCompletions(
      token,
      position,
      completions,
      (kind: string, match: lsProtocol.CompletionItem) => {
        return { kind, match };
      },
      browserConsole
    );
  };

  it('Harmonizes `insertText` from `undefined` when adjusting path-like completions', () => {
    // `import { } from '@lumino/<TAB>'`
    const result = transform(
      {
        offset: 16,
        value: "'@lumino/'",
        type: 'string'
      },
      8,
      [
        {
          label: 'algorithm',
          kind: 19,
          sortText: '1',
          data: {
            entryNames: ['algorithm']
          }
        },
        {
          label: 'application',
          kind: 19,
          sortText: '1',
          data: {
            entryNames: ['application']
          }
        }
      ]
    );
    expect(result.items.length).to.equal(2);
    // insert text should keep `'` as it was part of original token
    expect(result.items[0].match.insertText).to.equal("'@lumino/algorithm");
    // label should not include `'`
    expect(result.items[0].match.label).to.equal('@lumino/algorithm');
    expect(result.source.name).to.equal('LSP');
  });

  it('Harmonizes `insertText` for paths', () => {
    // `'./Hov`
    const result = transform(
      {
        offset: 0,
        value: "'./Hov",
        type: 'string'
      },
      5,
      [
        {
          label: "Hover.ipynb'",
          kind: 17,
          sortText: "aHover.ipynb'",
          insertText: "Hover.ipynb'"
        }
      ]
    );
    // insert text should keep `'` as it was part of original token
    expect(result.items[0].match.insertText).to.equal("'./Hover.ipynb'");
    // label should not include initial `'`
    expect(result.items[0].match.label).to.equal("./Hover.ipynb'");
  });
});
