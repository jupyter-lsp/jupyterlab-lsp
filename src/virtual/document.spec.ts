import { expect } from 'chai';
import { RegExpForeignCodeExtractor } from '../extractors/regexp';
import { VirtualDocument } from './document';
import CodeMirror = require("codemirror");
import { ISourcePosition, IVirtualPosition } from "../positioning";

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
  let document = new VirtualDocument(
    'python',
    'test.ipynb',
    {},
    { python: [r_line_extractor_removing] },
    false
  );

  describe('#extract_foreign_code', () => {
    it('joins non-standalone fragments together for both foreign and host code', () => {
      let {
        cell_code_kept,
        foreign_document_map
      } = document.extract_foreign_code(R_LINE_MAGICS, null, { line: 0, column: 0 });

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

  afterEach(() => {
    document.clear();
  });

  let init_document_with_Python_and_R = () => {
    let cm_editor_for_cell_1 = {} as CodeMirror.Editor;
    let cm_editor_for_cell_2 = {} as CodeMirror.Editor;
    document.append_code_block(
      'test line in Python 1\n%R test line in R 1',
      cm_editor_for_cell_1
    );
    document.append_code_block(
      'test line in Python 2\n%R test line in R 2',
      cm_editor_for_cell_2
    );
  };

  describe('transform_virtual_to_editor', () => {
    it('transforms positions for the top level document', () => {
      init_document_with_Python_and_R();
      // The first (Python) line in the first block
      let editor_position = document.transform_virtual_to_editor({
        line: 0,
        ch: 0
      } as IVirtualPosition);
      expect(editor_position.line).to.equal(0);
      expect(editor_position.ch).to.equal(0);

      // The first (Python) line in the second block
      editor_position = document.transform_virtual_to_editor({
        line: 4,
        ch: 0
      } as IVirtualPosition);
      expect(editor_position.line).to.equal(0);
      expect(editor_position.ch).to.equal(0);
    });

    it('transforms positions for the nested foreign documents', () => {
      init_document_with_Python_and_R();
      let foreign_document = document.document_at_source_position({
        line: 1,
        ch: 3
      } as ISourcePosition);
      expect(foreign_document).to.not.equal(document);

      // The second (R) line in the first block
      let editor_position = foreign_document.transform_virtual_to_editor({
        line: 0,
        ch: 0
      } as IVirtualPosition);
      expect(editor_position.line).to.equal(1);
      expect(editor_position.ch).to.equal(3);

      // The second (R) line in the second block
      editor_position = foreign_document.transform_virtual_to_editor({
        line: 3,
        ch: 0
      } as IVirtualPosition);
      expect(editor_position.line).to.equal(1);
      expect(editor_position.ch).to.equal(3);
    });
  });
});
