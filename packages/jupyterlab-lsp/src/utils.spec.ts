import { expect } from 'chai';

import { collapseToDotted, escapeMarkdown, uris_equal } from './utils';

describe('uris_equal', () => {
  it('should workaround Windows paths/Pyright issues', () => {
    const result = uris_equal(
      'file:///d%3A/a/jupyterlab-lsp/jupyterlab-lsp/atest/output/windows_39_4/home/n%C3%B6te%20b%C3%B2%C3%B3ks/example.py',
      'file:///d:/a/jupyterlab-lsp/jupyterlab-lsp/atest/output/windows_39_4/home/n%C3%B6te%20b%C3%B2%C3%B3ks/example.py'
    );
    expect(result).to.equal(true);
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
    ).to.deep.equal({
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
    ).to.deep.equal({
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
    ).to.deep.equal({
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
    ).to.deep.equal({
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
    ).to.deep.equal({
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
    ).to.deep.equal({
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
    ).to.deep.equal({
      'pylsp.configurationSources': [['flake8'], ['pycodestyle']]
    });
  });
});

describe('escapeMarkdown', () => {
  it('escapes italics', () => {
    expect(escapeMarkdown('pre *italic* post')).to.equal(
      'pre \\*italic\\* post'
    );
  });
  it('escapes underscore italics', () => {
    expect(escapeMarkdown('pre _italic_ post')).to.equal(
      'pre \\_italic\\_ post'
    );
  });
  it('escapes escaped italics', () => {
    expect(escapeMarkdown('pre \\*non-italic\\* post')).to.equal(
      'pre \\\\\\*non-italic\\\\\\* post'
    );
  });
  it('escapes bold', () => {
    expect(escapeMarkdown('pre **bold** post')).to.equal(
      'pre \\*\\*bold\\*\\* post'
    );
  });
  it('escapes headers', () => {
    expect(escapeMarkdown('pre #heading post')).to.equal('pre \\#heading post');
  });
  it('escapes URLs', () => {
    expect(escapeMarkdown('pre [link](https://example.com) post')).to.equal(
      'pre \\[link\\](https://example.com) post'
    );
  });
  it('replaces indents with non-breaking spaces', () => {
    expect(escapeMarkdown('    indented')).to.equal(
      '\u00A0\u00A0\u00A0\u00A0indented'
    );
  });
});
