import type * as lsProtocol from 'vscode-languageserver-protocol';

export interface IPosition {
  line: number;
  ch: number;
}

export interface ITokenInfo {
  start: IPosition;
  end: IPosition;
  text: string;
}

export interface IDocumentInfo {
  uri: string;
  version: number;
  text: string;
  languageId: string;
}

export type AnyLocation =
  | lsProtocol.Location
  | lsProtocol.Location[]
  | lsProtocol.LocationLink[]
  | null;

export type AnyCompletion =
  | lsProtocol.CompletionList
  | lsProtocol.CompletionItem[];

export enum CompletionTriggerKind {
  Invoked = 1,
  TriggerCharacter = 2,
  TriggerForIncompleteCompletions = 3
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
  on(
    event: 'hover',
    callback: (hover: lsProtocol.Hover, documentUri: string) => void
  ): void;
  on(
    event: 'diagnostic',
    callback: (diagnostic: lsProtocol.PublishDiagnosticsParams) => void
  ): void;
  on(
    event: 'highlight',
    callback: (
      highlights: lsProtocol.DocumentHighlight[],
      documentUri: string
    ) => void
  ): void;
  on(
    event: 'signature',
    callback: (signatures: lsProtocol.SignatureHelp) => void
  ): void;
  on(
    event: 'goTo',
    callback: (location: AnyLocation, documentUri: string) => void
  ): void;
  on(
    event: 'rename',
    callback: (edit: lsProtocol.WorkspaceEdit | null) => void
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
   * Inform the server that the document was opened
   */
  sendOpen(documentInfo: IDocumentInfo): void;
  /**
   * Sends the full text of the document to the server
   */
  sendChange(documentInfo: IDocumentInfo): void;
  /**
   * Requests additional information for a particular character
   */
  getHoverTooltip(position: IPosition, documentInfo: IDocumentInfo): void;
  /**
   * Request possible completions from the server
   */
  getCompletion(
    location: IPosition,
    token: ITokenInfo,
    documentInfo: IDocumentInfo,
    emit?: boolean,
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
  getSignatureHelp(position: IPosition, documentInfo: IDocumentInfo): void;
  /**
   * Request all matching symbols in the document scope
   */
  getDocumentHighlights(position: IPosition, documentInfo: IDocumentInfo): void;
  /**
   * Request a link to the definition of the current symbol. The results will not be displayed
   * unless they are within the same file URI
   */
  getDefinition(position: IPosition, documentInfo: IDocumentInfo): void;
  /**
   * Request a link to the type definition of the current symbol. The results will not be displayed
   * unless they are within the same file URI
   */
  getTypeDefinition(position: IPosition, documentInfo: IDocumentInfo): void;
  /**
   * Request a link to the implementation of the current symbol. The results will not be displayed
   * unless they are within the same file URI
   */
  getImplementation(position: IPosition, documentInfo: IDocumentInfo): void;
  /**
   * Request a link to all references to the current symbol. The results will not be displayed
   * unless they are within the same file URI
   */
  getReferences(position: IPosition, documentInfo: IDocumentInfo): void;

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

export interface ILspOptions {
  serverUri: string;
  languageId: string;
  rootUri: string;
}
