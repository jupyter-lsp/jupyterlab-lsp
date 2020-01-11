import * as lsProtocol from 'vscode-languageserver-protocol';
import { Location, LocationLink } from 'vscode-languageserver-protocol';

export interface IPosition {
  line: number;
  ch: number;
}

export interface ITokenInfo {
  start: IPosition;
  end: IPosition;
  text: string;
}

type ConnectionEvent =
  | 'completion'
  | 'completionResolved'
  | 'hover'
  | 'diagnostic'
  | 'highlight'
  | 'signature'
  | 'goTo'
  | 'error'
  | 'logging';

export interface ILspConnection {
  on(
    event: 'completion',
    callback: (items: lsProtocol.CompletionItem[]) => void
  ): void;
  on(
    event: 'completionResolved',
    callback: (item: lsProtocol.CompletionItem) => void
  ): void;
  on(event: 'hover', callback: (hover: lsProtocol.Hover) => void): void;
  on(
    event: 'diagnostic',
    callback: (diagnostic: lsProtocol.PublishDiagnosticsParams) => void
  ): void;
  on(
    event: 'highlight',
    callback: (highlights: lsProtocol.DocumentHighlight[]) => void
  ): void;
  on(
    event: 'signature',
    callback: (signatures: lsProtocol.SignatureHelp) => void
  ): void;
  on(
    event: 'goTo',
    callback: (location: Location | Location[] | LocationLink[] | null) => void
  ): void;
  on(event: 'error', callback: (error: any) => void): void;
  on(event: 'logging', callback: (log: any) => void): void;

  off(event: ConnectionEvent, listener: (arg: any) => void): void;

  /**
   * Close the connection
   */
  close(): void;

  // This should support every method from https://microsoft.github.io/language-server-protocol/specification
  /**
   * The initialize request tells the server which options the client supports
   */
  sendInitialize(): void;
  /**
   * Sends the full text of the document to the server
   */
  sendChange(): void;
  /**
   * Requests additional information for a particular character
   */
  getHoverTooltip(position: IPosition): void;
  /**
   * Request possible completions from the server
   */
  getCompletion(
    location: IPosition,
    token: ITokenInfo,
    triggerCharacter?: string,
    triggerKind?: lsProtocol.CompletionTriggerKind
  ): void;
  /**
   * If the server returns incomplete information for completion items, more information can be requested
   */
  getDetailedCompletion(item: lsProtocol.CompletionItem): void;
  /**
   * Request possible signatures for the current method
   */
  getSignatureHelp(position: IPosition): void;
  /**
   * Request all matching symbols in the document scope
   */
  getDocumentHighlights(position: IPosition): void;
  /**
   * Request a link to the definition of the current symbol. The results will not be displayed
   * unless they are within the same file URI
   */
  getDefinition(position: IPosition): void;
  /**
   * Request a link to the type definition of the current symbol. The results will not be displayed
   * unless they are within the same file URI
   */
  getTypeDefinition(position: IPosition): void;
  /**
   * Request a link to the implementation of the current symbol. The results will not be displayed
   * unless they are within the same file URI
   */
  getImplementation(position: IPosition): void;
  /**
   * Request a link to all references to the current symbol. The results will not be displayed
   * unless they are within the same file URI
   */
  getReferences(position: IPosition): void;

  // TODO:
  // Workspaces: Not in scope
  // Text Synchronization:
  // willSave
  // willSaveWaitUntil
  // didSave
  // didClose
  // Language features:
  // getDocumentSymbols
  // codeAction
  // codeLens
  // codeLensResolve
  // documentLink
  // documentLinkResolve
  // documentColor
  // colorPresentation
  // formatting
  // rangeFormatting
  // onTypeFormatting
  // rename
  // prepareRename
  // foldingRange

  getLanguageCompletionCharacters(): string[];
  getLanguageSignatureCharacters(): string[];

  getDocumentUri(): string;

  /**
   * Does the server support go to definition?
   */
  isDefinitionSupported(): boolean;
  /**
   * Does the server support go to type definition?
   */
  isTypeDefinitionSupported(): boolean;
  /**
   * Does the server support go to implementation?
   */
  isImplementationSupported(): boolean;
  /**
   * Does the server support find all references?
   */
  isReferencesSupported(): boolean;
}

/**
 * Configuration map for codeActionsOnSave
 */
export interface ICodeActionsOnSaveOptions {
  [kind: string]: boolean;
}

export interface ITextEditorOptions {
  /**
   * Enable the suggestion box to pop-up on trigger characters.
   * Defaults to true.
   */
  suggestOnTriggerCharacters?: boolean;
  /**
   * Accept suggestions on ENTER.
   * Defaults to 'on'.
   */
  acceptSuggestionOnEnter?: boolean | 'on' | 'smart' | 'off';
  /**
   * Accept suggestions on TAB.
   * Defaults to 'on'.
   */
  acceptSuggestionOnTab?: boolean | 'on' | 'smart' | 'off';
  /**
   * Accept suggestions on provider defined characters.
   * Defaults to true.
   */
  acceptSuggestionOnCommitCharacter?: boolean;
  /**
   * Enable selection highlight.
   * Defaults to true.
   */
  selectionHighlight?: boolean;
  /**
   * Enable semantic occurrences highlight.
   * Defaults to true.
   */
  occurrencesHighlight?: boolean;
  /**
   * Show code lens
   * Defaults to true.
   */
  codeLens?: boolean;
  /**
   * Code action kinds to be run on save.
   */
  codeActionsOnSave?: ICodeActionsOnSaveOptions;
  /**
   * Timeout for running code actions on save.
   */
  codeActionsOnSaveTimeout?: number;
  /**
   * Enable code folding
   * Defaults to true.
   */
  folding?: boolean;
  /**
   * Selects the folding strategy. 'auto' uses the strategies contributed for the current document,
   * 'indentation' uses the indentation based folding strategy.
   * Defaults to 'auto'.
   */
  foldingStrategy?: 'auto' | 'indentation';
  /**
   * Controls whether the fold actions in the gutter stay always visible or hide unless the mouse is over the gutter.
   * Defaults to 'mouseover'.
   */
  showFoldingControls?: 'always' | 'mouseover';
  /**
   * Whether to suggest while typing
   */
  suggest?: boolean;
  /**
   * Debounce (in ms) for suggestions while typing.
   * Defaults to 200ms
   */
  debounceSuggestionsWhileTyping?: number;
  /**
   * Enable quick suggestions (shadow suggestions)
   * Defaults to true.
   */
  quickSuggestions?:
    | boolean
    | {
        other: boolean;
        comments: boolean;
        strings: boolean;
      };
  /**
   * Quick suggestions show delay (in ms)
   * Defaults to 200 (ms)
   */
  quickSuggestionsDelay?: number;
  /**
   * Parameter hint options. Defaults to true.
   */
  enableParameterHints?: boolean;
  /**
   * Render icons in suggestions box.
   * Defaults to true.
   */
  iconsInSuggestions?: boolean;
  /**
   * Enable format on type.
   * Defaults to false.
   */
  formatOnType?: boolean;
  /**
   * Enable format on paste.
   * Defaults to false.
   */
  formatOnPaste?: boolean;
}

export interface ILspOptions {
  serverUri: string;
  languageId: string;
  documentUri: string;
  documentText: () => string;
  rootUri: string;
}

/**
 * An adapter is responsible for connecting a particular text editor with a LSP connection
 * and will send messages over the connection and display responses in the editor
 */
export abstract class IEditorAdapter<T> {
  constructor(
    connection: ILspConnection,
    options: ITextEditorOptions,
    editor: T
  ) {
    // no implementation
  }

  /**
   * Removes the adapter from the editor and closes the connection
   */
  public abstract remove(): void;
}

export function getFilledDefaults(
  options: ITextEditorOptions
): ITextEditorOptions {
  return Object.assign(
    {},
    {
      suggestOnTriggerCharacters: true,
      acceptSuggestionOnEnter: true,
      acceptSuggestionOnTab: true,
      acceptSuggestionOnCommitCharacter: true,
      selectionHighlight: true,
      occurrencesHighlight: true,
      codeLens: true,
      folding: true,
      foldingStrategy: 'auto',
      showFoldingControls: 'mouseover',
      suggest: true,
      debounceSuggestionsWhileTyping: 200,
      quickSuggestions: true,
      quickSuggestionsDelay: 200,
      enableParameterHints: true,
      iconsInSuggestions: true,
      formatOnType: false,
      formatOnPaste: false
    },
    options
  );
}
