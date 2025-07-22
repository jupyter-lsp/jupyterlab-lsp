import { IEditorPosition, WidgetLSPAdapter, Document } from '@jupyterlab/lsp';
import { Token } from '@lumino/coreutils';
import * as lsProtocol from 'vscode-languageserver-protocol';

import { PLUGIN_ID } from '../../tokens';
import { VirtualDocument } from '../../virtual/document';

/**
 * Diagnostic which is localized at a specific editor (cell) within a notebook
 * (if used in the context of a FileEditor, then there is just a single editor)
 */
export interface IEditorDiagnostic {
  diagnostic: lsProtocol.Diagnostic;
  editorAccessor: Document.IEditor;
  range: {
    start: IEditorPosition;
    end: IEditorPosition;
  };
  document: VirtualDocument
}

export interface IReadonlyDiagnosticsDatabase {
  /**
   * @alpha
   */
  get all(): IEditorDiagnostic[];
}

export interface IDiagnosticsFeature {
  /**
   * @alpha
   */
  getDiagnosticsDB(
    adapter: WidgetLSPAdapter<any>
  ): IReadonlyDiagnosticsDatabase;
}

export const IDiagnosticsFeature = new Token<IDiagnosticsFeature>(
  PLUGIN_ID + ':IDiagnosticsFeature'
);
