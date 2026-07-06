import type {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ILSPDocumentConnectionManager, Method } from '@jupyterlab/lsp';
import type {
  IClientRequestParams,
  IDocumentInfo,
  ILSPConnection
} from '@jupyterlab/lsp';
import { ITranslator, nullTranslator } from '@jupyterlab/translation';
import { JSONExt } from '@lumino/coreutils';
import type {
  ReadonlyJSONObject,
  ReadonlyJSONValue,
  ReadonlyPartialJSONObject
} from '@lumino/coreutils';
import type * as lsp from 'vscode-languageserver-protocol';

import type * as SCHEMA from './_schema';
import { PLUGIN_ID } from './tokens';
import type { TLanguageServerSpec } from './tokens';

export namespace LSPCommandIDs {
  export const serverInfo = 'jupyter-lsp:server-info';
  export const connectionInfo = 'jupyter-lsp:connection-info';
  export const request = 'jupyter-lsp:lsp-request';
}

export const ALLOWED_LSP_REQUESTS = [
  Method.ClientRequest.DIAGNOSTIC,
  Method.ClientRequest.SIGNATURE_HELP,
  Method.ClientRequest.REFERENCES,
  Method.ClientRequest.WORKSPACE_SYMBOL,
  Method.ClientRequest.DOCUMENT_SYMBOL,
  Method.ClientRequest.HOVER
] as const;

export type AllowedLSPRequest = (typeof ALLOWED_LSP_REQUESTS)[number];

export interface ILSPRequestArguments {
  serverId: string;
  method: AllowedLSPRequest;
  params: ReadonlyJSONObject;
  timeoutMs?: number;
}

export interface ILSPServerInfo {
  specs: Record<string, TLanguageServerSpec>;
  sessions: Record<string, SCHEMA.LanguageServerSession>;
}

export interface ILSPDocumentInfo
  extends Pick<IDocumentInfo, 'uri' | 'version'> {
  virtualUri: string;
  path: string;
  language: string;
}

export interface ILSPConnectionInfo {
  serverId: string | null;
  serverLanguage: string | null;
  isConnected: boolean;
  isInitialized: boolean;
  isReady: boolean;
  capabilities: lsp.ServerCapabilities;
  documents: ILSPDocumentInfo[];
}

export interface ILSPConnectionsInfo {
  connections: ILSPConnectionInfo[];
}

const DEFAULT_LSP_REQUEST_TIMEOUT = 10_000;
const MAX_LSP_REQUEST_TIMEOUT = 60_000;

const REQUEST_CAPABILITIES: Record<
  AllowedLSPRequest,
  keyof lsp.ServerCapabilities
> = {
  [Method.ClientRequest.DIAGNOSTIC]: 'diagnosticProvider',
  [Method.ClientRequest.SIGNATURE_HELP]: 'signatureHelpProvider',
  [Method.ClientRequest.REFERENCES]: 'referencesProvider',
  [Method.ClientRequest.WORKSPACE_SYMBOL]: 'workspaceSymbolProvider',
  [Method.ClientRequest.DOCUMENT_SYMBOL]: 'documentSymbolProvider',
  [Method.ClientRequest.HOVER]: 'hoverProvider'
};

const EMPTY_ARGS_SCHEMA: ReadonlyJSONObject = {
  type: 'object',
  additionalProperties: false
};

const REQUEST_ARGS_SCHEMA: ReadonlyJSONObject = {
  type: 'object',
  additionalProperties: false,
  required: ['serverId', 'method', 'params'],
  properties: {
    serverId: {
      type: 'string',
      minLength: 1,
      description: 'Language server identifier from connection-info.'
    },
    method: {
      type: 'string',
      enum: [...ALLOWED_LSP_REQUESTS],
      description: 'Read-only LSP request method.'
    },
    params: {
      type: 'object',
      description: 'Parameters defined by the selected LSP request.'
    },
    timeoutMs: {
      type: 'integer',
      minimum: 1,
      maximum: MAX_LSP_REQUEST_TIMEOUT,
      default: DEFAULT_LSP_REQUEST_TIMEOUT,
      description: 'Request timeout in milliseconds.'
    }
  }
};

function copyJSON<T>(value: T): T {
  return JSONExt.deepCopy(
    value as unknown as ReadonlyJSONValue
  ) as unknown as T;
}

async function getServerInfo(
  connectionManager: ILSPDocumentConnectionManager
): Promise<ILSPServerInfo> {
  const manager = connectionManager.languageServerManager;
  await manager.ready;

  const specs = Object.fromEntries(
    [...manager.specs.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([id, spec]) => [id, copyJSON(spec)])
  );
  const sessions = Object.fromEntries(
    [...manager.sessions.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([id, session]) => [id, copyJSON(session)])
  );

  return { specs, sessions };
}

function getConnectionInfo(
  connectionManager: ILSPDocumentConnectionManager
): ILSPConnectionsInfo {
  const connections = new Map<ILSPConnection, ILSPConnectionInfo>();

  for (const [virtualUri, connection] of connectionManager.connections) {
    let info = connections.get(connection);
    if (!info) {
      info = {
        serverId: connection.serverIdentifier ?? null,
        serverLanguage: connection.serverLanguage ?? null,
        isConnected: connection.isConnected,
        isInitialized: connection.isInitialized,
        isReady: connection.isReady,
        capabilities: copyJSON(connection.serverCapabilities ?? {}),
        documents: []
      };
      connections.set(connection, info);
    }

    const document = connectionManager.documents.get(virtualUri);
    if (document) {
      info.documents.push({
        virtualUri,
        uri: document.documentInfo.uri,
        path: document.path,
        language: document.language,
        version: document.documentInfo.version
      });
    }
  }

  const result = [...connections.values()];
  for (const connection of result) {
    connection.documents.sort((left, right) =>
      left.virtualUri.localeCompare(right.virtualUri)
    );
  }
  result.sort((left, right) =>
    (left.serverId ?? '').localeCompare(right.serverId ?? '')
  );

  return { connections: result };
}

function parseRequestArguments(
  args: ReadonlyPartialJSONObject
): ILSPRequestArguments {
  const { serverId, method, params, timeoutMs } = args;

  if (typeof serverId !== 'string' || serverId.length === 0) {
    throw new Error('serverId must be a non-empty string.');
  }
  if (
    typeof method !== 'string' ||
    !ALLOWED_LSP_REQUESTS.includes(method as AllowedLSPRequest)
  ) {
    throw new Error(`Unsupported LSP request method: ${String(method)}.`);
  }
  if (params === undefined || !JSONExt.isObject(params)) {
    throw new Error('params must be a JSON object.');
  }
  if (
    timeoutMs !== undefined &&
    (typeof timeoutMs !== 'number' ||
      !Number.isInteger(timeoutMs) ||
      timeoutMs < 1 ||
      timeoutMs > MAX_LSP_REQUEST_TIMEOUT)
  ) {
    throw new Error(
      `timeoutMs must be an integer between 1 and ${MAX_LSP_REQUEST_TIMEOUT}.`
    );
  }

  return {
    serverId,
    method: method as AllowedLSPRequest,
    params: params as ReadonlyJSONObject,
    timeoutMs: timeoutMs as number | undefined
  };
}

function findConnection(
  connectionManager: ILSPDocumentConnectionManager,
  serverId: string
): ILSPConnection {
  const matches = [...new Set(connectionManager.connections.values())].filter(
    connection => connection.serverIdentifier === serverId
  );
  if (matches.length === 0) {
    throw new Error(`No LSP connection found for server ${serverId}.`);
  }
  if (matches.length > 1) {
    throw new Error(`Multiple LSP connections found for server ${serverId}.`);
  }
  return matches[0];
}

async function sendRequest(
  connectionManager: ILSPDocumentConnectionManager,
  args: ReadonlyPartialJSONObject
): Promise<unknown> {
  const { serverId, method, params, timeoutMs } = parseRequestArguments(args);
  const connection = findConnection(connectionManager, serverId);
  const capability = REQUEST_CAPABILITIES[method];

  if (!connection.isReady) {
    throw new Error(`LSP connection for server ${serverId} is not ready.`);
  }
  if (!connection.provides(capability)) {
    throw new Error(`Server ${serverId} does not provide ${method}.`);
  }

  const controller = new AbortController();
  const timeout = timeoutMs ?? DEFAULT_LSP_REQUEST_TIMEOUT;
  const timeoutHandle = setTimeout(() => {
    controller.abort(
      new Error(`LSP request ${method} timed out after ${timeout} ms.`)
    );
  }, timeout);

  try {
    return await connection.request(
      method,
      params as unknown as IClientRequestParams[AllowedLSPRequest],
      {
        signal: controller.signal
      }
    );
  } finally {
    clearTimeout(timeoutHandle);
  }
}

export const LSP_COMMANDS_PLUGIN: JupyterFrontEndPlugin<void> = {
  id: PLUGIN_ID + ':commands',
  requires: [ILSPDocumentConnectionManager],
  optional: [ITranslator],
  autoStart: true,
  activate: (
    app: JupyterFrontEnd,
    connectionManager: ILSPDocumentConnectionManager,
    translator: ITranslator | null
  ) => {
    const trans = (translator || nullTranslator).load('jupyterlab_lsp');

    app.commands.addCommand(LSPCommandIDs.serverInfo, {
      describedBy: { args: EMPTY_ARGS_SCHEMA },
      execute: () => getServerInfo(connectionManager),
      label: trans.__('List available language servers')
    });

    app.commands.addCommand(LSPCommandIDs.connectionInfo, {
      describedBy: { args: EMPTY_ARGS_SCHEMA },
      execute: () => getConnectionInfo(connectionManager),
      label: trans.__('List active language server connections')
    });

    app.commands.addCommand(LSPCommandIDs.request, {
      describedBy: { args: REQUEST_ARGS_SCHEMA },
      execute: args => sendRequest(connectionManager, args),
      label: trans.__('Send a read-only language server request')
    });
  }
};
