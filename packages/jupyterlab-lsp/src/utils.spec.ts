import {
  collapseToDotted,
  escapeMarkdown,
  uriToContentsPath,
  urisEqual
} from './utils';

describe('urisEqual', () => {
  it('should workaround Windows paths/Pyright issues', () => {
    const result = urisEqual(
      'file:///d%3A/a/jupyterlab-lsp/jupyterlab-lsp/atest/output/windows_39_4/home/n%C3%B6te%20b%C3%B2%C3%B3ks/example.py',
      'file:///d:/a/jupyterlab-lsp/jupyterlab-lsp/atest/output/windows_39_4/home/n%C3%B6te%20b%C3%B2%C3%B3ks/example.py'
    );
    expect(result).toBe(true);
  });
});

describe('uriToContentsPath', () => {
  it('should decode special characters', () => {
    const result = uriToContentsPath(
      '/node_modules/%40organization/package/lib/file.d.ts',
      ''
    );
    expect(result).toBe('/node_modules/@organization/package/lib/file.d.ts');
  });

  it('should remove shared prefix', () => {
    const result = uriToContentsPath(
      'file:///home/user/project/.virtual_documents/test.ipynb',
      'file:///home/user/project'
    );
    expect(result).toBe('/.virtual_documents/test.ipynb');
  });

  it('should workaround Windows paths/Pyright issues', () => {
    let result = uriToContentsPath(
      'file:///d%3A/user/project/.virtual_documents/test.ipynb',
      'file:///d:/user/project'
    );
    expect(result).toBe('/.virtual_documents/test.ipynb');
    result = uriToContentsPath(
      'file:///d%3A/user/project/.virtual_documents/test.ipynb',
      'file:///d%3A/user/project'
    );
    expect(result).toBe('/.virtual_documents/test.ipynb');
  });
});

describe('collapseToDotted', () => {
  it('collapses simple objects', () => {
    expect(
      collapseToDotted({
        bashIde: {
          globPattern: '**/*@(.sh|.inc|.bash|.command)',
          highlightParsingErrors: true,
          explainshellEndpoint: ''
        }
      }).result
    ).toEqual({
      'bashIde.globPattern': '**/*@(.sh|.inc|.bash|.command)',
      'bashIde.highlightParsingErrors': true,
      'bashIde.explainshellEndpoint': ''
    });
  });

  it('collapses objects with both nested and flat records', () => {
    expect(
      collapseToDotted({
        bashIde: {
          globPattern: '**/*@(.sh|.inc|.bash|.command)',
          highlightParsingErrors: true
        },
        'bashIde.explainshellEndpoint': ''
      }).result
    ).toEqual({
      'bashIde.globPattern': '**/*@(.sh|.inc|.bash|.command)',
      'bashIde.highlightParsingErrors': true,
      'bashIde.explainshellEndpoint': ''
    });
  });

  it('returns empty objects as-is', () => {
    // otherwise, if someone wants to overrirde
    // a default object it would not be possible
    expect(
      collapseToDotted({
        'pylsp.plugins': {
          'jedi.env_vars': {}
        }
      }).result
    ).toEqual({
      'pylsp.plugins.jedi.env_vars': {}
    });
  });

  it('returns arrays as-is', () => {
    // otherwise, if someone wants to overrirde
    // a default object it would not be possible
    expect(
      collapseToDotted({
        'pylsp.configurationSources': ['pycodestyle']
      }).result
    ).toEqual({
      'pylsp.configurationSources': ['pycodestyle']
    });
  });

  it('returns null as-is', () => {
    // otherwise, if someone wants to overrirde
    // a default object it would not be possible
    expect(
      collapseToDotted({
        'pylsp.plugins.flake8.config': null
      }).result
    ).toEqual({
      'pylsp.plugins.flake8.config': null
    });
  });

  it('records conflicts when multiple values are passed for the same key', () => {
    expect(
      collapseToDotted({
        bashIde: {
          globPattern: '**/*@(.sh|.inc|.bash|.command)',
          highlightParsingErrors: true,
          explainshellEndpoint: 'a'
        },
        'bashIde.explainshellEndpoint': 'b'
      }).conflicts
    ).toEqual({
      'bashIde.explainshellEndpoint': ['a', 'b']
    });
  });

  it('records conflicts for arrays', () => {
    // otherwise, if someone wants to overrirde
    // a default object it would not be possible
    expect(
      collapseToDotted({
        pylsp: {
          configurationSources: ['flake8']
        },
        'pylsp.configurationSources': ['pycodestyle']
      }).conflicts
    ).toEqual({
      'pylsp.configurationSources': [['flake8'], ['pycodestyle']]
    });
  });
});

describe('escapeMarkdown', () => {
  it('escapes italics', () => {
    expect(escapeMarkdown('pre *italic* post')).toBe('pre \\*italic\\* post');
  });
  it('escapes underscore italics', () => {
    expect(escapeMarkdown('pre _italic_ post')).toBe('pre \\_italic\\_ post');
  });
  it('escapes escaped italics', () => {
    expect(escapeMarkdown('pre \\*non-italic\\* post')).toBe(
      'pre \\\\\\*non-italic\\\\\\* post'
    );
  });
  it('escapes bold', () => {
    expect(escapeMarkdown('pre **bold** post')).toBe(
      'pre \\*\\*bold\\*\\* post'
    );
  });
  it('escapes headers', () => {
    expect(escapeMarkdown('pre #heading post')).toBe('pre \\#heading post');
  });
  it('escapes URLs', () => {
    expect(escapeMarkdown('pre [link](https://example.com) post')).toBe(
      'pre \\[link\\](https://example.com) post'
    );
  });
  it('replaces indents with non-breaking spaces', () => {
    expect(escapeMarkdown('    indented')).toBe(
      '\u00A0\u00A0\u00A0\u00A0indented'
    );
  });
});
