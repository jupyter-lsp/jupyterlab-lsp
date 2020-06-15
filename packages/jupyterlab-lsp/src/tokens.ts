import { ISignal } from '@lumino/signaling';
import { ServiceManager } from '@jupyterlab/services';
import * as LSP from './lsp';

import * as SCHEMA from './_schema';
import { IComm } from '@jupyterlab/services/lib/kernel/kernel';

export type TLanguageServerId = string;
export type TLanguageId = string;

export type TSessionMap = Map<TLanguageServerId, SCHEMA.LanguageServerSession>;

export type TCommMap = Map<TLanguageServerId, IComm>;
/**
 * TODO: Should this support custom server keys?
 */
export type TServerKeys =
  | 'pyls'
  | 'bash-language-server'
  | 'dockerfile-language-server-nodejs'
  | 'javascript-typescript-langserver'
  | 'unified-language-server'
  | 'vscode-css-languageserver-bin'
  | 'vscode-html-languageserver-bin'
  | 'vscode-json-languageserver-bin'
  | 'yaml-language-server'
  | 'r-languageserver';

export type TLanguageServerConfigurations = {
  [k in TServerKeys]: {
    serverSettings: any;
  };
};

export interface ILanguageServerManager {
  sessionsChanged: ISignal<ILanguageServerManager, void>;
  sessions: TSessionMap;
  getServerId(
    options: ILanguageServerManager.IGetServerIdOptions
  ): Promise<TLanguageServerId>;
  getComm(languageServerId: TLanguageServerId): Promise<IComm>;
  getRootUri(): string;
  getVirtualDocumentsUri(): string;
}

export interface ILanguageServerConfiguration {
  /**
   * The config params must be nested inside the settings keyword
   */
  settings: {
    [k: string]: any;
  };
}

export namespace ILanguageServerManager {
  export const URL_NS = 'lsp';
  export interface IOptions {
    serviceManager: ServiceManager;
  }
  export interface IGetServerIdOptions {
    language?: TLanguageId;
    mimeType?: string;
  }
}

/** Compatibility layer with previous bespoke WebSocket connection. */
export interface ILSPConnection {
  isReady: boolean;
  isConnected: boolean;
  isInitialized: boolean;
  serverCapabilities: LSP.ServerCapabilities;
  rootUri: string;

  /** Does the language server support a given provider? */
  provides(provider: keyof LSP.ServerCapabilities): boolean;

  // legacy connection API
  connect(): Promise<void>;
  close(): void;

  // legacy event api
  on<
    T extends keyof ILSPConnection.IEventSignalArgs,
    U extends ILSPConnection.IEventSignalArgs,
    V extends (args: U) => void
  >(
    evt: T,
    listener: V
  ): void;

  off<
    T extends keyof ILSPConnection.IEventSignalArgs,
    U extends ILSPConnection.IEventSignalArgs,
    V extends (args: U) => void
  >(
    evt: T,
    listener: V
  ): void;

  /* legacy method api */
  sendOpenWhenReady(documentInfo: ILSPConnection.IDocumentInfo): void;
  sendOpen(documentInfo: ILSPConnection.IDocumentInfo): void;
  sendChange(documentInfo: ILSPConnection.IDocumentInfo): void;
  sendFullTextChange(
    text: string,
    documentInfo: ILSPConnection.IDocumentInfo
  ): void;
  sendSelectiveChange(
    changeEvent: LSP.TextDocumentContentChangeEvent,
    documentInfo: ILSPConnection.IDocumentInfo
  ): void;
  sendSaved(documentInfo: ILSPConnection.IDocumentInfo): void;
  sendConfigurationChange(settings: LSP.DidChangeConfigurationParams): void;

  rename(
    location: ILSPConnection.IPosition,
    documentInfo: ILSPConnection.IDocumentInfo,
    newName: string
  ): Promise<LSP.WorkspaceEdit>;
  getLanguageCompletionCharacters(): string[];
  getLanguageSignatureCharacters(): string[];
  getDocumentHighlights(
    location: ILSPConnection.IPosition,
    documentInfo: ILSPConnection.IDocumentInfo
  ): Promise<LSP.DocumentHighlight[]>;
  getHoverTooltip(
    location: ILSPConnection.IPosition,
    documentInfo: ILSPConnection.IDocumentInfo
  ): Promise<LSP.Hover>;
  getSignatureHelp(
    location: ILSPConnection.IPosition,
    documentInfo: ILSPConnection.IDocumentInfo
  ): Promise<LSP.SignatureHelp>;
  getCompletion(
    location: ILSPConnection.IPosition,
    token: ILSPConnection.ITokenInfo,
    documentInfo: ILSPConnection.IDocumentInfo,
    triggerCharacter?: string,
    triggerKind?: LSP.CompletionTriggerKind
  ): Promise<LSP.CompletionList | LSP.CompletionItem[]>;
  getReferences(
    location: ILSPConnection.IPosition,
    documentInfo: ILSPConnection.IDocumentInfo
  ): Promise<LSP.Location[]>;
  getTypeDefinition(
    location: ILSPConnection.IPosition,
    documentInfo: ILSPConnection.IDocumentInfo
  ): Promise<LSP.TAnyLocation>;
  getDefinition(
    location: ILSPConnection.IPosition,
    documentInfo: ILSPConnection.IDocumentInfo
  ): Promise<LSP.TAnyLocation>;
}

export namespace ILSPConnection {
  export namespace LegacyEvents {
    export const ON_CLOSE = 'close';
    export const ON_DIAGNOSTIC = 'diagnostic';
    export const ON_LOGGING = 'logging';
    export const ON_INITIALIZED = 'serverInitialized';
  }

  export interface IEventSignalArgs {
    [LegacyEvents.ON_CLOSE]: boolean;
    [LegacyEvents.ON_DIAGNOSTIC]: LSP.PublishDiagnosticsParams;
    [LegacyEvents.ON_LOGGING]: LSP.ShowMessageParams | LSP.MessageActionItem;
    [LegacyEvents.ON_INITIALIZED]: LSP.ServerCapabilities;
  }

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
}
