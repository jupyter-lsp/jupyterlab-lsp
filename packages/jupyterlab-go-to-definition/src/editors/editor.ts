import { CodeEditor } from '@jupyterlab/codeeditor';

export type KeyModifier = 'Alt' | 'Control' | 'Shift' | 'Meta' | 'AltGraph';

export interface ITokensProvider {
  getTokens(): Array<CodeEditor.IToken>;

  getTokenAt(offset: number): CodeEditor.IToken;
}

export interface IEditorExtension extends ITokensProvider {
  editor: CodeEditor.IEditor;

  selectToken(lookupName: string, target: Node): CodeEditor.IToken;

  connect(modifierKey: KeyModifier): void;
}
