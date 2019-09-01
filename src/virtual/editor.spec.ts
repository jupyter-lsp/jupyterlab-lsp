import { expect } from 'chai';
import { VirtualEditor } from './editor';
import { RegExpForeignCodeExtractor } from '../extractors/regexp';
import {
  IEditorPosition,
  IRootPosition,
  IVirtualPosition
} from '../positioning';
import CodeMirror = require('codemirror');

class VirtualEditorImplementation extends VirtualEditor {
  get_cm_editor(position: IRootPosition): CodeMirror.Editor {
    return undefined;
  }

  get_editor_index(position: IVirtualPosition): number {
    return 0;
  }

  transform_editor_to_root(
    cm_editor: CodeMirror.Editor,
    position: IEditorPosition
  ): IRootPosition {
    return undefined;
  }

  transform_virtual_to_source(
    position: CodeMirror.Position
  ): CodeMirror.Position {
    return undefined;
  }
}


describe('VirtualEditor', () => {
  let r_line_extractor = new RegExpForeignCodeExtractor({
    language: 'R',
    pattern: '(^|\n)%R (.*)\n?',
    extract_to_foreign: '$2',
    keep_in_host: true,
    is_standalone: false
  });

  let editor = new VirtualEditorImplementation(
    'python',
    'test.ipynb',
    {},
    { python: [r_line_extractor] }
  );
  describe('#get_virtual_document()', () => {
    it('returns correct document', () => {
      let cm_editor_for_cell_1 = {} as CodeMirror.Editor;
      let cm_editor_for_cell_2 = {} as CodeMirror.Editor;
      editor.virtual_document.append_code_block(
        'test line in Python 1\n%R test line in R 1',
        cm_editor_for_cell_1
      );
      editor.virtual_document.append_code_block(
        'test line in Python 2\n%R test line in R 2',
        cm_editor_for_cell_2
      );

      // The first (Python) line in the first block
      let { document, virtual_position } = editor.get_virtual_document({
        line: 0,
        ch: 0
      } as IRootPosition);
      expect(document).to.equal(editor.virtual_document);
      expect(virtual_position.line).to.equal(0);

      // The second (Python | R) line in the first block - Python fragment
      ({ document, virtual_position } = editor.get_virtual_document({
        line: 1,
        ch: 0
      } as IRootPosition));
      expect(document).to.equal(editor.virtual_document);
      expect(virtual_position.line).to.equal(1);

      // The second (Python | R) line in the first block - R fragment
      ({ document, virtual_position } = editor.get_virtual_document({
        line: 1,
        ch: 3
      } as IRootPosition));
      expect(document).to.not.equal(editor.virtual_document);
      expect(virtual_position.line).to.equal(0);

      // The first (Python) line in the second block
      ({ document, virtual_position } = editor.get_virtual_document({
        line: 2,
        ch: 0
      } as IRootPosition));
      expect(document).to.equal(editor.virtual_document);
      expect(virtual_position.line).to.equal(2 + 2);

      // The second (Python | R) line in the second block - Python fragment
      ({ document, virtual_position } = editor.get_virtual_document({
        line: 3,
        ch: 0
      } as IRootPosition));
      expect(document).to.equal(editor.virtual_document);
      expect(virtual_position.line).to.equal(2 + 2 + 1);

      // The second (Python | R) line in the second block - R fragment
      ({ document, virtual_position } = editor.get_virtual_document({
        line: 3,
        ch: 3
      } as IRootPosition));
      expect(document).to.not.equal(editor.virtual_document);
      // 0 + 1 (next line) + 2 (between-block spacing)
      expect(virtual_position.line).to.equal(1 + 2);
    });
  });
});
