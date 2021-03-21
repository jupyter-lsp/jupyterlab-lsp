import { extractor } from '.';

const EXAMPLE = `%%foo
bar
`;

describe('The extractor', () => {
  describe('extracts', () => {
    extractor.extract_foreign_code(EXAMPLE);
  });
});
