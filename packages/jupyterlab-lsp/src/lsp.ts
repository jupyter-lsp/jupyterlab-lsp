/**
 * TODO: automate this extraction
 *
 * Why not simply import vscode-languageserver-protocol?
 *
 * Because this triggers some strange webpack issue as an additional package
 * would need to be included at runtime.
 */

import type {
  CompletionList,
  CompletionItem,
  Location,
  LocationLink,
  PublishDiagnosticsParams,
  ShowMessageParams,
  RegistrationParams,
  UnregistrationParams,
  MessageActionItem,
  ShowMessageRequestParams,
  InitializeParams,
  InitializedParams,
  DidOpenTextDocumentParams,
  DidChangeTextDocumentParams,
  DidSaveTextDocumentParams,
  DidChangeConfigurationParams,
  CompletionParams,
  TextDocumentPositionParams,
  ReferenceParams,
  RenameParams,
  DocumentSymbolParams,
  DocumentHighlight,
  Hover,
  InitializeResult,
  SignatureHelp,
  WorkspaceEdit,
  DocumentSymbol,
  ServerCapabilities,
  ClientCapabilities,
  WorkspaceClientCapabilities,
  TextDocumentContentChangeEvent,
  Position,
  TextDocumentEdit,
  TextEdit,
  Range,
  Diagnostic,
  MarkupContent,
  MarkedString,
  SignatureInformation,
  Registration,
  Unregistration,
} from 'vscode-languageserver-protocol';

export type {
  CompletionList,
  CompletionItem,
  Location,
  LocationLink,
  PublishDiagnosticsParams,
  ShowMessageParams,
  RegistrationParams,
  UnregistrationParams,
  MessageActionItem,
  ShowMessageRequestParams,
  InitializeParams,
  InitializedParams,
  DidOpenTextDocumentParams,
  DidChangeTextDocumentParams,
  DidSaveTextDocumentParams,
  DidChangeConfigurationParams,
  CompletionParams,
  TextDocumentPositionParams,
  ReferenceParams,
  RenameParams,
  DocumentSymbolParams,
  DocumentHighlight,
  Hover,
  InitializeResult,
  SignatureHelp,
  WorkspaceEdit,
  DocumentSymbol,
  ServerCapabilities,
  ClientCapabilities,
  WorkspaceClientCapabilities,
  TextDocumentContentChangeEvent,
  Position,
  TextDocumentEdit,
  TextEdit,
  Range,
  Diagnostic,
  MarkupContent,
  MarkedString,
  SignatureInformation,
  Registration,
  Unregistration,
};

namespace DiagnosticSeverity {
  export const Error = 1;
  export const Warning = 2;
  export const Information = 3;
  export const Hint = 4;
}

export namespace CompletionItemKind {
  export const Text = 1;
  export const Method = 2;
  export const Function = 3;
  export const Constructor = 4;
  export const Field = 5;
  export const Variable = 6;
  export const Class = 7;
  export const Interface = 8;
  export const Module = 9;
  export const Property = 10;
  export const Unit = 11;
  export const Value = 12;
  export const Enum = 13;
  export const Keyword = 14;
  export const Snippet = 15;
  export const Color = 16;
  export const File = 17;
  export const Reference = 18;
  export const Folder = 19;
  export const EnumMember = 20;
  export const Constant = 21;
  export const Struct = 22;
  export const Event = 23;
  export const Operator = 24;
  export const TypeParameter = 25;
}

export namespace DocumentHighlightKind {
  export const Text = 1;
  export const Read = 2;
  export const Write = 3;
}

export function inverse_namespace(namespace: object): Record<number, string> {
  const records: Record<number, string> = {};
  for (let key of Object.keys(namespace)) {
    // @ts-ignore
    records[namespace[key]] = key;
  }
  return records;
}

/**
 * Why programmatic solution rather than hard-coding the namespace the other way around?
 *
 * Because the namespaces are copy-paste from the LSP specification, and it will be easier
 * to maintain this way in the future.
 */
export const diagnosticSeverityNames = inverse_namespace(DiagnosticSeverity);
export const completionItemKindNames = inverse_namespace(CompletionItemKind);
export const documentHighlightKindNames = inverse_namespace(
  DocumentHighlightKind
);

export namespace CompletionTriggerKind {
  export const Invoked = 1;
  export const TriggerCharacter = 2;
  export const TriggerForIncompleteCompletions = 3;
}
export type CompletionTriggerKind = 1 | 2 | 3;

/**
 * Method strings are reproduced here because a non-typing import of
 * `vscode-languageserver-protocol` is ridiculously expensive
 */
export namespace Method {
  /** Server notifications */
  export const PUBLISH_DIAGNOSTICS = 'textDocument/publishDiagnostics';
  export const SHOW_MESSAGE = 'window/showMessage';

  /** Server requests */
  export const REGISTER_CAPABILITY = 'client/registerCapability';
  export const SHOW_MESSAGE_REQUEST = 'window/showMessageRequest';
  export const UNREGISTER_CAPABILITY = 'client/unregisterCapability';

  /** Client notifications */
  export const DID_CHANGE = 'textDocument/didChange';
  export const DID_CHANGE_CONFIGURATION = 'workspace/didChangeConfiguration';
  export const DID_OPEN = 'textDocument/didOpen';
  export const DID_SAVE = 'textDocument/didSave';
  export const INITIALIZED = 'initialized';

  /** Client requests */
  export const COMPLETION = 'textDocument/completion';
  export const COMPLETION_ITEM_RESOLVE = 'completionItem/resolve';
  export const DEFINITION = 'textDocument/definition';
  export const DOCUMENT_HIGHLIGHT = 'textDocument/documentHighlight';
  export const DOCUMENT_SYMBOL = 'textDocument/documentSymbol';
  export const HOVER = 'textDocument/hover';
  export const IMPLEMENTATION = 'textDocument/implementation';
  export const INITIALIZE = 'initialize';
  export const REFERENCES = 'textDocument/references';
  export const RENAME = 'textDocument/rename';
  export const SIGNATURE_HELP = 'textDocument/signatureHelp';
  export const TYPE_DEFINITION = 'textDocument/typeDefinition';
}

/* keys of ServerCapabilities as constants */
export const Provider: { [key: string]: keyof ServerCapabilities } = {
  TEXT_DOCUMENT_SYNC: 'textDocumentSync',
  COMPLETION: 'completionProvider',
  HOVER: 'hoverProvider',
  SIGNATURE_HELP: 'signatureHelpProvider',
  DECLARATION: 'declarationProvider',
  DEFINITION: 'definitionProvider',
  TYPE_DEFINITION: 'typeDefinitionProvider',
  IMPLEMENTATION: 'implementationProvider',
  REFERENCES: 'referencesProvider',
  DOCUMENT_HIGHLIGHT: 'documentHighlightProvider',
  DOCUMENT_SYMBOL: 'documentSymbolProvider',
  CODE_ACTION: 'codeActionProvider',
  CODE_LENS: 'codeLensProvider',
  DOCUMENT_LINK: 'documentLinkProvider',
  COLOR: 'colorProvider',
  DOCUMENT_FORMATTING: 'documentFormattingProvider',
  DOCUMENT_RANGE_FORMATTING: 'documentRangeFormattingProvider',
  DOCUMENT_ON_TYPE_FORMATTING: 'documentOnTypeFormattingProvider',
  RENAME: 'renameProvider',
  FOLDING_RANGE: 'foldingRangeProvider',
  EXECUTE_COMMAND: 'executeCommandProvider',
  SELECTION_RANGE: 'selectionRangeProvider',
  WORKSPACE_SYMBOL: 'workspaceSymbolProvider',
  WORKSPACE: 'workspace',
};

/** compound types for some responses */
export type TAnyCompletion = CompletionList | CompletionItem[] | null;

export type TAnyLocation = Location | Location[] | LocationLink[] | null;

export interface IServerNotifyParams {
  [Method.PUBLISH_DIAGNOSTICS]: PublishDiagnosticsParams;
  [Method.SHOW_MESSAGE]: ShowMessageParams;
}

export interface IServerRequestParams {
  [Method.REGISTER_CAPABILITY]: RegistrationParams;
  [Method.SHOW_MESSAGE_REQUEST]: ShowMessageRequestParams;
  [Method.UNREGISTER_CAPABILITY]: UnregistrationParams;
}

export interface IServerResult {
  [Method.REGISTER_CAPABILITY]: void;
  [Method.SHOW_MESSAGE_REQUEST]: MessageActionItem | null;
  [Method.UNREGISTER_CAPABILITY]: void;
}

export interface IClientNotifyParams {
  [Method.DID_CHANGE_CONFIGURATION]: DidChangeConfigurationParams;
  [Method.DID_CHANGE]: DidChangeTextDocumentParams;
  [Method.DID_OPEN]: DidOpenTextDocumentParams;
  [Method.DID_SAVE]: DidSaveTextDocumentParams;
  [Method.INITIALIZED]: InitializedParams;
}

export interface IClientRequestParams {
  [Method.COMPLETION_ITEM_RESOLVE]: CompletionItem;
  [Method.COMPLETION]: CompletionParams;
  [Method.DEFINITION]: TextDocumentPositionParams;
  [Method.DOCUMENT_HIGHLIGHT]: TextDocumentPositionParams;
  [Method.DOCUMENT_SYMBOL]: DocumentSymbolParams;
  [Method.HOVER]: TextDocumentPositionParams;
  [Method.IMPLEMENTATION]: TextDocumentPositionParams;
  [Method.INITIALIZE]: InitializeParams;
  [Method.REFERENCES]: ReferenceParams;
  [Method.RENAME]: RenameParams;
  [Method.SIGNATURE_HELP]: TextDocumentPositionParams;
  [Method.TYPE_DEFINITION]: TextDocumentPositionParams;
}

export interface IClientResult {
  [Method.COMPLETION_ITEM_RESOLVE]: CompletionItem;
  [Method.COMPLETION]: TAnyCompletion;
  [Method.DEFINITION]: TAnyLocation;
  [Method.DOCUMENT_HIGHLIGHT]: DocumentHighlight[];
  [Method.DOCUMENT_SYMBOL]: DocumentSymbol[];
  [Method.HOVER]: Hover;
  [Method.IMPLEMENTATION]: TAnyLocation;
  [Method.INITIALIZE]: InitializeResult;
  [Method.REFERENCES]: Location[];
  [Method.RENAME]: WorkspaceEdit;
  [Method.SIGNATURE_HELP]: SignatureHelp;
  [Method.TYPE_DEFINITION]: TAnyLocation;
}
