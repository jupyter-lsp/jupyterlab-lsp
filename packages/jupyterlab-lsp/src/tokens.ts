import { ISignal } from '@lumino/signaling';
import { ServerConnection, ServiceManager } from '@jupyterlab/services';
import * as LSP from 'vscode-languageserver-protocol';

import * as SCHEMA from './_schema';
import { CommLSP } from './comm/lsp';

export type TLanguageServerId = string;
export type TLanguageId = string;

export type TSessionMap = Map<TLanguageServerId, SCHEMA.LanguageServerSession>;

export type TCommMap = Map<TLanguageServerId, any>;

export interface ILanguageServerManager {
  sessionsChanged: ISignal<ILanguageServerManager, void>;
  sessions: TSessionMap;
  getServerId(
    options: ILanguageServerManager.IGetServerIdOptions
  ): TLanguageServerId;
  statusUrl: string;
}

export namespace ILanguageServerManager {
  export const URL_NS = 'lsp';
  export interface IOptions {
    settings?: ServerConnection.ISettings;
    baseUrl?: string;
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

  // legacy capabilities api
  isRenameSupported(): boolean;
  isReferencesSupported(): boolean;
  isTypeDefinitionSupported(): boolean;
  isDefinitionSupported(): boolean;

  // legacy connection API
  connect(socket: WebSocket): Promise<void>;
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
  rename(
    location: ILSPConnection.IPosition,
    documentInfo: ILSPConnection.IDocumentInfo,
    newName: string,
    emit: false
  ): Promise<LSP.WorkspaceEdit>;
  getLanguageCompletionCharacters(): string[];
  getLanguageSignatureCharacters(): string[];
  getDocumentHighlights(
    location: ILSPConnection.IPosition,
    documentInfo: ILSPConnection.IDocumentInfo,
    emit: false
  ): Promise<LSP.DocumentHighlight[]>;
  getHoverTooltip(
    location: ILSPConnection.IPosition,
    documentInfo: ILSPConnection.IDocumentInfo,
    emit: false
  ): Promise<LSP.Hover>;
  getSignatureHelp(
    location: ILSPConnection.IPosition,
    documentInfo: ILSPConnection.IDocumentInfo,
    emit: false
  ): Promise<LSP.SignatureHelp>;
  getCompletion(
    location: ILSPConnection.IPosition,
    token: ILSPConnection.ITokenInfo,
    documentInfo: ILSPConnection.IDocumentInfo,
    emit: false,
    triggerCharacter?: string,
    triggerKind?: LSP.CompletionTriggerKind
  ): Promise<LSP.CompletionList | LSP.CompletionItem[]>;
  getReferences(
    location: ILSPConnection.IPosition,
    documentInfo: ILSPConnection.IDocumentInfo,
    emit?: false
  ): Promise<LSP.Location[]>;
  getTypeDefinition(
    location: ILSPConnection.IPosition,
    documentInfo: ILSPConnection.IDocumentInfo,
    emit?: false
  ): Promise<CommLSP.TAnyLocation>;
  getDefinition(
    location: ILSPConnection.IPosition,
    documentInfo: ILSPConnection.IDocumentInfo,
    emit?: false
  ): Promise<CommLSP.TAnyLocation>;
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
