import { CodeEditor } from '@jupyterlab/codeeditor';

export interface IJump {
  /**
   * The token of origin (variable/function usage).
   */
  token: CodeEditor.IToken;
  /**
   * The clicked (or active) element of origin used to find the cell from which
   * the request originated.
   */
  origin: HTMLElement;
  /**
   * Optional mouse event used as a fallback to determine the cell of origin in
   * Firefox 57.
   */
  mouseEvent?: MouseEvent;
}

export interface IJumpPosition {
  /**
   * The token of origin (variable/function usage).
   */
  token: CodeEditor.IToken;
  /**
   * Optional number identifying the cell in a notebook
   */
  index?: number;
}

export interface IGlobalJump {
  /**
   * In notebooks, the index of the target editor
   */
  editor_index: number;

  line: number;
  column: number;

  uri: string;
}
