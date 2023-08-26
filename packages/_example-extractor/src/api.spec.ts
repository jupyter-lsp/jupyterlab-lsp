import { IExtractedCode } from '@jupyter-lsp/jupyterlab-lsp';

import { extractor } from '.';

const EXAMPLE = `%%foo
bar
`;

let FIXTURES: { [key: string]: IExtractedCode } = {
  'does extract foo': {
    foreignCode: 'bar\n',
    hostCode: EXAMPLE,
    range: { end: { column: 0, line: 2 }, start: { column: 0, line: 1 } },
    virtualShift: null
  },
  'does NOT extract bar': {
    foreignCode: null,
    hostCode: 'baz',
    range: null,
    virtualShift: null
  },
  'does NOT extract foobar': {
    foreignCode: null,
    hostCode: EXAMPLE.replace('foo', 'foobar'),
    range: null,
    virtualShift: null
  }
};

FIXTURES['does extract foo -v bar'] = {
  ...FIXTURES['does extract foo'],
  hostCode: EXAMPLE.replace('foo', 'foo -v')
};

describe('The foo extractor', () => {
  test.each(Object.entries(FIXTURES))(
    '%s',
    (_: string, expected: IExtractedCode) => {
      const extracted = extractor.extractForeignCode(expected.hostCode!);
      expect(extracted.length).toBe(1);
      expect(extracted[0]).toEqual(expected);
    }
  );
});
