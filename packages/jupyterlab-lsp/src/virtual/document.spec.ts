import { CodeEditor } from '@jupyterlab/codeeditor';
import {
  ISourcePosition,
  IVirtualPosition,
  isWithinRange,
  Document
} from '@jupyterlab/lsp';

import { mockExtractorsManager } from '../extractors/testutils';
import { foreignCodeExtractors } from '../transclusions/ipython-rpy2/extractors';

import { VirtualDocument } from './document';

let R_LINE_MAGICS = `%R df = data.frame()
print("df created")
%R ggplot(df)
print("plotted")
`;

describe('isWithinRange', () => {
  let lineRange: CodeEditor.IRange = {
    start: { line: 1, column: 0 },
    end: { line: 1, column: 10 }
  };
  let longRange: CodeEditor.IRange = {
    start: { line: 0, column: 3 },
    end: { line: 1, column: 0 }
  };
  it('recognizes positions within range in a single-line case', () => {
    expect(isWithinRange({ line: 1, column: 0 }, lineRange)).toEqual(true);
    expect(isWithinRange({ line: 1, column: 5 }, lineRange)).toEqual(true);
    expect(isWithinRange({ line: 1, column: 10 }, lineRange)).toEqual(true);
  });

  it('recognizes positions outside of range in a single-line case', () => {
    expect(isWithinRange({ line: 0, column: 0 }, lineRange)).toEqual(false);
    expect(isWithinRange({ line: 2, column: 0 }, lineRange)).toEqual(false);
  });

  it('recognizes positions within range in multi-line case', () => {
    expect(isWithinRange({ line: 0, column: 3 }, longRange)).toEqual(true);
    expect(isWithinRange({ line: 0, column: 5 }, longRange)).toEqual(true);
    expect(isWithinRange({ line: 1, column: 0 }, longRange)).toEqual(true);
  });

  it('recognizes positions outside of range in multi-line case', () => {
    expect(isWithinRange({ line: 0, column: 0 }, longRange)).toEqual(false);
    expect(isWithinRange({ line: 0, column: 1 }, longRange)).toEqual(false);
    expect(isWithinRange({ line: 0, column: 2 }, longRange)).toEqual(false);
    expect(isWithinRange({ line: 1, column: 1 }, longRange)).toEqual(false);
  });
});

describe('VirtualDocument', () => {
  let document: VirtualDocument;
  beforeEach(() => {
    document = new VirtualDocument({
      language: 'python',
      path: 'test.ipynb',
      overridesRegistry: {},
      foreignCodeExtractors: mockExtractorsManager(foreignCodeExtractors),
      standalone: false,
      fileExtension: 'py',
      hasLspSupportedFile: false
    });
  });

  let initDocumentWithPythonAndR = () => {
    let ceEditorForCell1 = {} as Document.IEditor;
    let ceEditorForCell2 = {} as Document.IEditor;
    let ceEditorForCell3 = {} as Document.IEditor;
    let ceEditorForCell4 = {} as Document.IEditor;
    // first block
    document.appendCodeBlock({
      value: 'test line in Python 1\n%R 1st test line in R line magic 1',
      ceEditor: ceEditorForCell1,
      type: 'code'
    });
    // second block
    document.appendCodeBlock({
      value: 'test line in Python 2\n%R 1st test line in R line magic 2',
      ceEditor: ceEditorForCell2,
      type: 'code'
    });
    // third block
    document.appendCodeBlock({
      value:
        'test line in Python 3\n%R -i imported_variable 1st test line in R line magic 3',
      ceEditor: ceEditorForCell2,
      type: 'code'
    });
    // fourth block
    document.appendCodeBlock({
      value: '%%R\n1st test line in R cell magic 1',
      ceEditor: ceEditorForCell3,
      type: 'code'
    });
    // fifth block
    document.appendCodeBlock({
      value: '%%R -i imported_variable\n1st test line in R cell magic 2',
      ceEditor: ceEditorForCell4,
      type: 'code'
    });
  };

  // TODO: upstream this test
  describe('#extractForeignCode', () => {
    it('joins non-standalone fragments together', () => {
      let { cellCodeKept, foreignDocumentsMap } = document.extractForeignCode(
        { value: R_LINE_MAGICS, ceEditor: null as any, type: 'code' },
        {
          line: 0,
          column: 0
        }
      );

      // note R cell lines are kept in code (keepInHost=true)
      expect(cellCodeKept).toEqual(R_LINE_MAGICS);
      expect(foreignDocumentsMap.size).toEqual(2);

      let { virtualDocument: rDocument } = foreignDocumentsMap.get(
        foreignDocumentsMap.keys().next().value
      )!;
      expect(rDocument.language).toEqual('r');
      expect(rDocument.value).toEqual('df = data.frame()\n\n\nggplot(df)\n');
    });
  });

  describe('#transformVirtualToEditor', () => {
    it('transforms positions for the top level document', () => {
      initDocumentWithPythonAndR();
      // The first (Python) line in the first block
      let editorPosition = document.transformVirtualToEditor({
        line: 0,
        ch: 0
      } as IVirtualPosition)!;
      expect(editorPosition.line).toEqual(0);
      expect(editorPosition.ch).toEqual(0);

      // The first (Python) line in the second block
      editorPosition = document.transformVirtualToEditor({
        line: 4,
        ch: 0
      } as IVirtualPosition)!;
      expect(editorPosition.line).toEqual(0);
      expect(editorPosition.ch).toEqual(0);
    });

    it('transforms positions for the nested foreign documents', () => {
      initDocumentWithPythonAndR();
      let foreignDocument = document.documentAtSourcePosition({
        line: 1,
        ch: 3
      } as ISourcePosition);
      expect(foreignDocument).not.toBe(document);
      expect(foreignDocument.value).toEqual(
        '1st test line in R line magic 1\n\n\n' +
          '1st test line in R line magic 2\n\n\n' +
          'imported_variable <- data.frame(); 1st test line in R line magic 3\n\n\n' +
          // 23456789012345678901234567890123456 - 's' is 36th
          '1st test line in R cell magic 1\n\n\n' +
          'imported_variable <- data.frame(); 1st test line in R cell magic 2\n'
        // 0123456789012345678901234567890123456 - 's' is 36th
      );

      // The first R line (in source); second in the first block;
      // targeting "s" in "1st", "1st" in "1st test line in R line magic" (first virtual line == line 0)
      let virtualR1s1line = {
        line: 0,
        ch: 1
      } as IVirtualPosition;

      // For future reference, the code below would be wrong:
      // let source_position = foreignDocument.transform_virtual_to_source(virtualR1s1line);
      // expect(source_position.line).toEqual(1);
      // expect(source_position.ch).toEqual(4);
      // because it checks R source position, rather than checking root source positions.

      let editorPosition =
        foreignDocument.transformVirtualToEditor(virtualR1s1line)!;
      expect(editorPosition.line).toEqual(1);
      expect(editorPosition.ch).toEqual(4);

      // The second R line (in source), second in the second block
      // targeting 1 in "1st test line in R line magic 2" (4th virtual line == line 3)
      editorPosition = foreignDocument.transformVirtualToEditor({
        line: 3,
        ch: 0
      } as IVirtualPosition)!;
      // 0th editor line is 'test line in Python 2\n'
      expect(editorPosition.line).toEqual(1);
      // 1st editor lines is '%R 1st test line in R line magic 2'
      //                      0123 - 3rd character
      expect(editorPosition.ch).toEqual(3);

      // The third R line (in source), second in the third block;
      // targeting "s" in "1st" in "1st test line in R line magic 3" (7th virtual line == line 6)
      editorPosition = foreignDocument.transformVirtualToEditor({
        line: 6,
        ch: 36
      } as IVirtualPosition)!;
      // 0th editor line is 'test line in Python 3\n'
      expect(editorPosition.line).toEqual(1);
      // 1st editor line is '%R -i imported_variable 1st test line in R line magic 3'
      //                     01234567890123456789012345 - 25th character
      expect(editorPosition.ch).toEqual(25);

      // The fifth R line (in source), second in the fifth block;
      // targeting "s" in "1st" in "1st test line in R cell magic 2" (13th virtual lines == line 12)
      editorPosition = foreignDocument.transformVirtualToEditor({
        line: 12,
        ch: 36
      } as IVirtualPosition)!;
      // 0th editor line is '%%R -i imported_variable\n'
      expect(editorPosition.line).toEqual(1);
      // 1st editor line is '1st test line in R cell magic 2'
      //                     01
      expect(editorPosition.ch).toEqual(1);
    });
  });
});
