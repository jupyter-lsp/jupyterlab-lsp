// TODO: use upstream
import { CodeEditor } from '@jupyterlab/codeeditor';
import { Document } from '@jupyterlab/lsp';
import { VirtualDocument as VirtualDocumentBase } from '@jupyterlab/lsp/lib/virtual/document';

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
  decodeCodeBlock(raw_code: string): string {
    // TODO: add back previously extracted foreign code
    const cellOverride =
      this.cellMagicsOverrides.reverse.override_for(raw_code);
    if (cellOverride != null) {
      return cellOverride;
    } else {
      let lines = this.lineMagicsOverrides.reverse_replace_all(
        raw_code.split('\n')
      );
      return lines.join('\n');
    }
  }

  prepareCodeBlock(
    block: Document.ICodeBlockOptions,
    editorShift: CodeEditor.IPosition = { line: 0, column: 0 }
  ) {
    let lines: Array<string>;
    let skipInspect: Array<Array<VirtualDocument.id_path>>;

    let { cellCodeKept, foreignDocumentsMap } = this.extractForeignCode(
      block,
      editorShift
    );
    const cellCode = cellCodeKept;

    // cell magics are replaced if requested and matched
    const cellOverride = this.cellMagicsOverrides.override_for(cellCode);
    if (cellOverride != null) {
      lines = cellOverride.split('\n');
      skipInspect = lines.map(l => [this.idPath]);
    } else {
      // otherwise, we replace line magics - if any
      let result = this.lineMagicsOverrides.replace_all(
        cellCode.split('\n')
      );
      lines = result.lines;
      skipInspect = result.skipInspect.map(skip =>
        skip ? [this.idPath] : []
      );
    }

    return { lines, foreignDocumentsMap, skipInspect };
  }
}

export namespace VirtualDocument {
  /**
   * Identifier composed of `virtual_id`s of a nested structure of documents,
   * used to aide assignment of the connection to the virtual document
   * handling specific, nested language usage; it will be appended to the file name
   * when creating a connection.
   */
  export type id_path = string;
  /**
   * Instance identifier for standalone documents (snippets), or language identifier
   * for documents which should be interpreted as one when stretched across cells.
   */
  export type virtual_id = string;
  /**
   * Identifier composed of the file path and id_path.
   */
  export type uri = string;
}