import { CodeEditor } from '@jupyterlab/codeeditor';
import {
  IEditorPosition
} from '@jupyterlab/lsp';

export interface IEditorRange {
  start: IEditorPosition;
  end: IEditorPosition;
  editor: CodeEditor.IEditor;
}
