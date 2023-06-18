import { VirtualDocument, ISourcePosition, IVirtualPosition, IRootPosition, IPosition } from '@jupyterlab/lsp';
import { CodeEditor } from '@jupyterlab/codeeditor';
import type * as lsProtocol from 'vscode-languageserver-protocol';

export class PositionConverter {
  static lsp_to_cm(position: lsProtocol.Position): IPosition {
    return { line: position.line, ch: position.character };
  }

  static cm_to_lsp(position: IPosition): lsProtocol.Position {
    return { line: position.line, character: position.ch };
  }

  static lsp_to_ce(position: lsProtocol.Position): CodeEditor.IPosition {
    return { line: position.line, column: position.character };
  }

  static cm_to_ce(position: IPosition): CodeEditor.IPosition {
    return { line: position.line, column: position.ch };
  }

  static ce_to_cm(position: CodeEditor.IPosition): IPosition {
    return { line: position.line, ch: position.column };
  }
}


export function rootPositionToVirtualPosition(virtualDocument: VirtualDocument, position: IRootPosition): IVirtualPosition {
  let rootAsSource = position as ISourcePosition;
  return virtualDocument.root.virtualPositionAtDocument(
    rootAsSource
  );
}


export function documentAtRootPosition(virtualDocument: VirtualDocument, position: IRootPosition): VirtualDocument {
  let rootAsSource = position as ISourcePosition;
  return virtualDocument.root.documentAtSourcePosition(
    rootAsSource
  );
}