import { ISignal } from '@lumino/signaling';
import { ServerConnection, ServiceManager } from '@jupyterlab/services';

import * as SCHEMA from './_schema';

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
