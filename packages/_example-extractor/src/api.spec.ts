import { IExtractedCode } from '@krassowski/jupyterlab-lsp';
import { expect } from 'chai';

import { extractor } from '.';

const EXAMPLE = `%%foo
bar
`;

let FIXTURES: { [key: string]: IExtractedCode } = {
  'does extract foo': {
    foreign_code: 'bar\n',
    host_code: EXAMPLE,
    range: { end: { column: 0, line: 2 }, start: { column: 0, line: 1 } },
    virtual_shift: null
  },
  'does NOT extract bar': {
    foreign_code: null,
    host_code: 'baz',
    range: null,
    virtual_shift: null
  },
  'does NOT extract foobar': {
    foreign_code: null,
    host_code: EXAMPLE.replace('foo', 'foobar'),
    range: null,
    virtual_shift: null
  }
};

FIXTURES['does extract foo -v bar'] = {
  ...FIXTURES['does extract foo'],
  host_code: EXAMPLE.replace('foo', 'foo -v')
};

describe('The foo extractor', () => {
  test.each(Object.entries(FIXTURES))(
    '%s',
    (_: string, expected: IExtractedCode) => {
      const extracted = extractor.extract_foreign_code(expected.host_code);
      expect(extracted).to.have.length(1);
      expect(extracted[0]).to.deep.equal(expected);
    }
  );
});
