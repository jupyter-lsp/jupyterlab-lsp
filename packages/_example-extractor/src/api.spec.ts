import { expect } from 'chai';

import { extractor } from '.';

import { IExtractedCode } from '@krassowski/jupyterlab-lsp';

const EXAMPLE = `%%foo
bar
`;

const EXPECTED: IExtractedCode = {
  foreign_code: 'bar\n',
  host_code: EXAMPLE,
  range: { end: { column: 0, line: 2 }, start: { column: 0, line: 1 } },
  virtual_shift: null
};

const NOT_EXPECTED: IExtractedCode = {
  foreign_code: null,
  host_code: 'baz',
  range: null,
  virtual_shift: null
};

describe('The foo extractor', () => {
  it('extracts %%foo bar', () => {
    const extracted = extractor.extract_foreign_code(EXAMPLE);
    expect(extracted).to.have.length(1);
    expect(extracted[0]).to.deep.equal(EXPECTED);
  });
  it('does not extract baz', () => {
    const extracted = extractor.extract_foreign_code('baz');
    expect(extracted).to.have.length(1);
    expect(extracted[0]).to.deep.equal(NOT_EXPECTED);
  });
});
