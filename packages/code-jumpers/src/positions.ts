import { CodeEditor } from '@jupyterlab/codeeditor';

export interface ILocalPosition {
  /**
   * The token of origin (variable/function usage).
   */
  token: CodeEditor.IToken;
  /**
   * Optional number identifying the cell in a notebook.
   * 0 in widgets with single editor
   */
  index: number;
}

export interface IGlobalPosition {
  /**
   * In notebooks, the index of the target editor; 0 in widgets with single editor.
   */
  editor_index: number;

  line: number;
  column: number;

  /**
   * The Jupyter ContentsManager path, _not_ passed through encode URI.
   */
  contents_path: string;

  is_symlink: boolean;
}
