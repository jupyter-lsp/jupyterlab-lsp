import type {
  ISourcePosition,
  IVirtualPosition,
  IRootPosition,
  IPosition,
  IEditorPosition,
  WidgetLSPAdapter,
  Document
} from '@jupyterlab/lsp';
import type { VirtualDocument } from './virtual/document';
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

/** TODO should it be wrapped into an object? */

export function documentAtRootPosition(
  adapter: WidgetLSPAdapter<any>,
  position: IRootPosition
): VirtualDocument {
  let rootAsSource = position as ISourcePosition;
  if (!adapter.virtualDocument) {
    throw Error('Virtual document of adapter disposed!');
  }
  if (adapter.virtualDocument.root !== adapter.virtualDocument) {
    throw Error('Virtual document on adapter must be the root document');
  }
  return adapter.virtualDocument.documentAtSourcePosition(
    rootAsSource
  ) as VirtualDocument;
}

export function editorAtRootPosition(
  adapter: WidgetLSPAdapter<any>,
  position: IRootPosition
): Document.IEditor {
  let rootAsSource = position as ISourcePosition;
  if (!adapter.virtualDocument) {
    throw Error('Virtual document of adapter disposed!');
  }
  if (adapter.virtualDocument.root !== adapter.virtualDocument) {
    throw Error('Virtual document on adapter must be the root document');
  }
  return adapter.virtualDocument.getEditorAtSourceLine(rootAsSource);
}

export function rootPositionToVirtualPosition(
  adapter: WidgetLSPAdapter<any>,
  position: IRootPosition
): IVirtualPosition {
  let rootAsSource = position as ISourcePosition;
  if (!adapter.virtualDocument) {
    throw Error('Virtual document of adapter disposed!');
  }
  if (adapter.virtualDocument.root !== adapter.virtualDocument) {
    throw Error('Virtual document on adapter must be the root document');
  }
  return adapter.virtualDocument!.virtualPositionAtDocument(rootAsSource);
}

export function virtualPositionToRootPosition(
  adapter: WidgetLSPAdapter<any>,
  position: IVirtualPosition
): IRootPosition | null {
  if (!adapter.virtualDocument) {
    throw Error('Virtual document of adapter disposed!');
  }
  return (adapter.virtualDocument as VirtualDocument).transformVirtualToRoot(
    position
  );
}

export function rootPositionToEditorPosition(
  adapter: WidgetLSPAdapter<any>,
  position: IRootPosition
): IEditorPosition {
  let rootAsSource = position as ISourcePosition;
  if (!adapter.virtualDocument) {
    throw Error('Virtual document of adapter disposed!');
  }
  if (adapter.virtualDocument.root !== adapter.virtualDocument) {
    throw Error('Virtual document on adapter must be the root document');
  }
  return adapter.virtualDocument.transformSourceToEditor(rootAsSource);
}

export function editorPositionToRootPosition(
  adapter: WidgetLSPAdapter<any>,
  editor: Document.IEditor,
  position: IEditorPosition
): IRootPosition | null {
  if (!adapter.virtualDocument) {
    throw Error('Virtual document of adapter disposed!');
  }
  return adapter.virtualDocument.transformFromEditorToRoot(editor, position);
}
