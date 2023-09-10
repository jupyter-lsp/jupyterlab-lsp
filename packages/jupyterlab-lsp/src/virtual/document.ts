// TODO: develop a better API upstream
import { CodeEditor } from '@jupyterlab/codeeditor';
import type {
  IVirtualPosition,
  IRootPosition,
  Document,
  ForeignDocumentsMap
} from '@jupyterlab/lsp';
import { VirtualDocument as VirtualDocumentBase } from '@jupyterlab/lsp';

import { ReversibleOverridesMap } from '../overrides/maps';
import { ICodeOverridesRegistry } from '../overrides/tokens';

export namespace VirtualDocument {
  export interface IOptions extends VirtualDocumentBase.IOptions {
    overridesRegistry: ICodeOverridesRegistry;
  }
}

export class VirtualDocument extends VirtualDocumentBase {
  private cellMagicsOverrides: ReversibleOverridesMap;
  private lineMagicsOverrides: ReversibleOverridesMap;

  constructor(options: VirtualDocument.IOptions) {
    super(options);
    const overrides =
      this.language in options.overridesRegistry
        ? options.overridesRegistry[this.language]
        : null;
    this.cellMagicsOverrides = new ReversibleOverridesMap(
      overrides ? overrides.cell : []
    );
    this.lineMagicsOverrides = new ReversibleOverridesMap(
      overrides ? overrides.line : []
    );
  }

  // TODO: this could be moved out
  decodeCodeBlock(rawCode: string): string {
    // TODO: add back previously extracted foreign code
    const cellOverride = this.cellMagicsOverrides.reverse.overrideFor(rawCode);
    if (cellOverride != null) {
      return cellOverride;
    } else {
      let lines = this.lineMagicsOverrides.reverseReplaceAll(
        rawCode.split('\n')
      );
      return lines.join('\n');
    }
  }

  /**
   * Extends parent method to hook cell magics overrides.
   */
  prepareCodeBlock(
    block: Document.ICodeBlockOptions,
    editorShift: CodeEditor.IPosition = { line: 0, column: 0 }
  ) {
    let lines: Array<string>;
    let skipInspect: Array<Array<VirtualDocumentBase.idPath>>;

    let { cellCodeKept, foreignDocumentsMap } = this.extractForeignCode(
      block,
      editorShift
    );
    const cellCode = cellCodeKept;

    // cell magics are replaced if requested and matched
    const cellOverride = this.cellMagicsOverrides.overrideFor(cellCode);
    if (cellOverride != null) {
      lines = cellOverride.split('\n');
      skipInspect = lines.map(_line => [this.idPath]);
    } else {
      // otherwise, we replace line magics - if any
      let result = this.lineMagicsOverrides.replaceAll(cellCode.split('\n'));
      lines = result.lines;
      skipInspect = result.skipInspect.map(skip => (skip ? [this.idPath] : []));
    }

    return { lines, foreignDocumentsMap, skipInspect };
  }

  appendCodeBlock(
    block: Document.ICodeBlockOptions,
    editorShift: CodeEditor.IPosition = { line: 0, column: 0 },
    virtualShift?: CodeEditor.IPosition
  ): void {
    let cellCode = block.value;
    let ceEditor = block.ceEditor;

    if (this.isDisposed) {
      console.warn('Cannot append code block: document disposed');
      return;
    }
    let sourceCellLines = cellCode.split('\n');
    let { lines, foreignDocumentsMap, skipInspect } = this.prepareCodeBlock(
      block,
      editorShift
    );

    for (let i = 0; i < lines.length; i++) {
      this.virtualLines.set(this.lastVirtualLine + i, {
        skipInspect: skipInspect[i],
        editor: ceEditor,
        // TODO this is incorrect, wont work if something was extracted
        sourceLine: this.lastSourceLine + i
      });
    }
    for (let i = 0; i < sourceCellLines.length; i++) {
      this.sourceLines.set(this.lastSourceLine + i, {
        editorLine: i,
        editorShift: {
          line: editorShift.line - (virtualShift?.line || 0),
          column: i === 0 ? editorShift.column - (virtualShift?.column || 0) : 0
        },
        // TODO: move those to a new abstraction layer (DocumentBlock class)
        editor: ceEditor,
        foreignDocumentsMap,
        // TODO this is incorrect, wont work if something was extracted
        virtualLine: this.lastVirtualLine + i
      });
    }

    this.lastVirtualLine += lines.length;

    // one empty line is necessary to separate code blocks, next 'n' lines are to silence linters;
    // the final cell does not get the additional lines (thanks to the use of join, see below)

    this.lineBlocks.push(lines.join('\n') + '\n');

    // adding the virtual lines for the blank lines
    for (let i = 0; i < this.blankLinesBetweenCells; i++) {
      this.virtualLines.set(this.lastVirtualLine + i, {
        skipInspect: [this.idPath],
        editor: ceEditor,
        sourceLine: null
      });
    }

    this.lastVirtualLine += this.blankLinesBetweenCells;
    this.lastSourceLine += sourceCellLines.length;
  }

  /**
   * Close all expired documents.
   */
  closeExpiredDocuments(): void {
    const usedDocuments = new Set<VirtualDocument>();
    for (const line of this.sourceLines.values()) {
      for (const block of line.foreignDocumentsMap.values()) {
        usedDocuments.add(block.virtualDocument as VirtualDocument);
      }
    }

    const documentIDs = new Map<VirtualDocument, string[]>();
    for (const [id, document] of (
      this.foreignDocuments as Map<string, VirtualDocument>
    ).entries()) {
      const ids = documentIDs.get(document);
      if (typeof ids !== 'undefined') {
        documentIDs.set(document, [...ids, id]);
      }
      documentIDs.set(document, [id]);
    }
    const allDocuments = new Set<VirtualDocument>(documentIDs.keys());
    const unusedVirtualDocuments = new Set(
      [...allDocuments].filter(x => !usedDocuments.has(x))
    );

    for (let document of unusedVirtualDocuments.values()) {
      document.remainingLifetime -= 1;
      if (document.remainingLifetime <= 0) {
        document.dispose();
        const ids = documentIDs.get(document)!;
        for (const id of ids) {
          this.foreignDocuments.delete(id);
        }
      }
    }
  }

  /**
   * @experimental
   */
  transformVirtualToRoot(position: IVirtualPosition): IRootPosition | null {
    // a method which was previously implemented in CodeMirrorIntegration
    // but probably should have been in VirtualDocument all along
    let editor = this.virtualLines.get(position.line)!.editor;
    let editorPosition = this.transformVirtualToEditor(position);
    return this.transformFromEditorToRoot(editor, editorPosition!);
  }

  /**
   * @experimental
   */
  getForeignDocuments(editorAccessor: Document.IEditor): ForeignDocumentsMap[] {
    let maps = new Set<ForeignDocumentsMap>();
    for (let line of this.sourceLines.values()) {
      if (line.editor === editorAccessor) {
        maps.add(line.foreignDocumentsMap);
      }
    }
    return [...maps.values()];
  }
}
