import { expect } from 'chai';
import { RegExpForeignCodeExtractor } from '../extractors/regexp';
import { VirtualDocument } from './document';

let R_LINE_MAGICS = `%R df = data.frame()
print("df created")
%R ggplot(df)
print("plotted")
`;

describe('RegExpForeignCodeExtractor', () => {
  let r_line_extractor_removing = new RegExpForeignCodeExtractor({
    language: 'R',
    pattern: '(^|\n)%R (.*)\n?',
    extract_to_foreign: '$2',
    keep_in_host: false,
    is_standalone: false
  });

  describe('#extract_foreign_code', () => {
    it('joins non-standalone fragments together for both foreign and host code', () => {
      let document = new VirtualDocument(
        'python',
        'test.ipynb',
        {},
        { python: [r_line_extractor_removing] },
        false
      );

      let {
        cell_code_kept,
        foreign_document_map
      } = document.extract_foreign_code(R_LINE_MAGICS, null);

      expect(cell_code_kept).to.equal(
        'print("df created")\nprint("plotted")\n'
      );
      expect(foreign_document_map.size).to.equal(2);

      let { virtual_document: r_document } = foreign_document_map.get(
        foreign_document_map.keys().next().value
      );
      expect(r_document.language).to.equal('R');
      expect(r_document.value).to.equal('df = data.frame()\n\n\nggplot(df)\n');
    });
  });
});
