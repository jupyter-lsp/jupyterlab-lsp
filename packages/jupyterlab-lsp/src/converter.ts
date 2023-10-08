import { CodeEditor } from '@jupyterlab/codeeditor';
import type {
  ISourcePosition,
  IVirtualPosition,
  IRootPosition,
  IPosition,
  IEditorPosition,
  WidgetLSPAdapter,
  Document
} from '@jupyterlab/lsp';
import type * as lsProtocol from 'vscode-languageserver-protocol';

import { VirtualDocument } from './virtual/document';

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

/** TODO should it be wrapped into an object? Where should these live? */

export interface IEditorRange {
  start: IEditorPosition;
  end: IEditorPosition;
  editor: CodeEditor.IEditor;
}

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

export function rangeToEditorRange(
  adapter: WidgetLSPAdapter<any>,
  range: lsProtocol.Range,
  editor: CodeEditor.IEditor | null,
  virtualDocument: VirtualDocument
): IEditorRange {
  let start = PositionConverter.lsp_to_cm(range.start) as IVirtualPosition;
  let end = PositionConverter.lsp_to_cm(range.end) as IVirtualPosition;

  // because `openForeign()` does not use new this.constructor, we need to workaround it for now:
  // const startInRoot = virtualDocument.transformVirtualToRoot(start);
  // https://github.com/jupyterlab/jupyterlab/issues/15126
  const startInRoot = VirtualDocument.prototype.transformVirtualToRoot.call(
    virtualDocument,
    start
  );

  if (!startInRoot) {
    throw Error('Could not determine position in root');
  }

  if (editor == null) {
    let editorAccessor = editorAtRootPosition(adapter, startInRoot);
    const candidate = editorAccessor.getEditor();
    if (!candidate) {
      throw Error('Editor could not be accessed');
    }
    editor = candidate;
  }

  const document = documentAtRootPosition(adapter, startInRoot);

  return {
    start: document.transformVirtualToEditor(start)!,
    end: document.transformVirtualToEditor(end)!,
    editor: editor
  };
}
