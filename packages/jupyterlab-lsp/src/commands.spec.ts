import type { ILSPConnection } from '@jupyterlab/lsp';
import { nullTranslator } from '@jupyterlab/translation';
import { CommandRegistry } from '@lumino/commands';

import {
  ALLOWED_LSP_REQUESTS,
  LSPCommandIDs,
  LSP_COMMANDS_PLUGIN
} from './commands';

function createEnvironment() {
  const commands = new CommandRegistry();
  const featureManager = { register: jest.fn() };
  const languageServerManager = {
    ready: Promise.resolve(),
    specs: new Map(),
    sessions: new Map()
  };
  const connectionManager = {
    connections: new Map(),
    documents: new Map(),
    languageServerManager
  };
  const app = { commands };

  void LSP_COMMANDS_PLUGIN.activate!(
    app as any,
    featureManager as any,
    connectionManager as any,
    nullTranslator
  );

  return { commands, connectionManager, featureManager, languageServerManager };
}

function createConnection(
  options: {
    serverId?: string;
    request?: jest.Mock;
    capabilities?: Record<string, unknown>;
  } = {}
): ILSPConnection {
  const capabilities = options.capabilities ?? { hoverProvider: true };
  return {
    serverIdentifier: options.serverId ?? 'pylsp',
    serverLanguage: 'python',
    isConnected: true,
    isInitialized: true,
    isReady: true,
    serverCapabilities: capabilities,
    provides: jest.fn(capability => Boolean(capabilities[capability])),
    request: options.request ?? jest.fn().mockResolvedValue({ contents: [] })
  } as any;
}

describe('LSP commands', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('registers pull diagnostics capabilities', () => {
    const { featureManager } = createEnvironment();

    expect(featureManager.register).toHaveBeenCalledWith({
      id: LSP_COMMANDS_PLUGIN.id,
      capabilities: {
        textDocument: {
          diagnostic: {
            dynamicRegistration: false,
            relatedDocumentSupport: true
          }
        }
      }
    });
  });

  it('describes the allowed request arguments', async () => {
    const { commands } = createEnvironment();

    const description = await commands.describedBy(LSPCommandIDs.request);
    expect(description.args).toMatchObject({
      type: 'object',
      additionalProperties: false,
      required: ['serverId', 'method', 'params']
    });
    expect((description.args!.properties as any).method.enum).toEqual(
      ALLOWED_LSP_REQUESTS
    );
  });

  it('returns sorted, detached server information', async () => {
    const { commands, languageServerManager } = createEnvironment();
    const spec = { display_name: 'Python', languages: ['python'] };
    languageServerManager.specs.set('z-server', spec);
    languageServerManager.specs.set('a-server', {
      display_name: 'Another',
      languages: ['python']
    });
    languageServerManager.sessions.set('z-server', {
      status: 'started'
    });

    const result = await commands.execute(LSPCommandIDs.serverInfo);

    expect(Object.keys(result.specs)).toEqual(['a-server', 'z-server']);
    expect(Object.keys(result.sessions)).toEqual(['z-server']);
    expect(result.specs['z-server']).not.toBe(spec);
  });

  it('deduplicates connections and lists their documents', async () => {
    const { commands, connectionManager } = createEnvironment();
    const connection = createConnection();
    connectionManager.connections.set('b.py', connection);
    connectionManager.connections.set('a.py', connection);
    connectionManager.documents.set('a.py', {
      path: 'a.py',
      language: 'python',
      documentInfo: { uri: 'file:///a.py', version: 2, text: 'secret' }
    });
    connectionManager.documents.set('b.py', {
      path: 'b.py',
      language: 'python',
      documentInfo: { uri: 'file:///b.py', version: 1, text: 'secret' }
    });

    const result = await commands.execute(LSPCommandIDs.connectionInfo);

    expect(result.connections).toHaveLength(1);
    expect(result.connections[0].documents).toEqual([
      {
        virtualUri: 'a.py',
        uri: 'file:///a.py',
        path: 'a.py',
        language: 'python',
        version: 2
      },
      {
        virtualUri: 'b.py',
        uri: 'file:///b.py',
        path: 'b.py',
        language: 'python',
        version: 1
      }
    ]);
    expect(JSON.stringify(result)).not.toContain('secret');
  });

  it('sends an allowed request through the selected connection', async () => {
    const { commands, connectionManager } = createEnvironment();
    const request = jest.fn().mockResolvedValue({ contents: 'result' });
    const connection = createConnection({ request });
    connectionManager.connections.set('test.py', connection);
    const params = {
      textDocument: { uri: 'file:///test.py' },
      position: { line: 0, character: 1 }
    };

    const result = await commands.execute(LSPCommandIDs.request, {
      serverId: 'pylsp',
      method: 'textDocument/hover',
      params
    });

    expect(result).toEqual({ contents: 'result' });
    expect(request).toHaveBeenCalledWith(
      'textDocument/hover',
      params,
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it('rejects requests outside the allowlist', async () => {
    const { commands } = createEnvironment();

    await expect(
      commands.execute(LSPCommandIDs.request, {
        serverId: 'pylsp',
        method: 'shutdown',
        params: {}
      })
    ).rejects.toThrow('Unsupported LSP request method: shutdown.');
  });

  it('rejects requests unsupported by the selected server', async () => {
    const { commands, connectionManager } = createEnvironment();
    connectionManager.connections.set(
      'test.py',
      createConnection({ capabilities: {} })
    );

    await expect(
      commands.execute(LSPCommandIDs.request, {
        serverId: 'pylsp',
        method: 'textDocument/hover',
        params: {}
      })
    ).rejects.toThrow('Server pylsp does not provide textDocument/hover.');
  });

  it('rejects requests while the selected connection is not ready', async () => {
    const { commands, connectionManager } = createEnvironment();
    const connection = createConnection();
    Object.assign(connection, { isReady: false });
    connectionManager.connections.set('test.py', connection);

    await expect(
      commands.execute(LSPCommandIDs.request, {
        serverId: 'pylsp',
        method: 'textDocument/hover',
        params: {}
      })
    ).rejects.toThrow('LSP connection for server pylsp is not ready.');
  });

  it('propagates in-flight request failures from the connection', async () => {
    jest.useFakeTimers();
    const { commands, connectionManager } = createEnvironment();
    const request = jest.fn((_method, _params, options) => {
      expect(options.signal.aborted).toBe(false);
      return Promise.reject(new Error('Request cancelled by connection.'));
    });
    connectionManager.connections.set('test.py', createConnection({ request }));

    await expect(
      commands.execute(LSPCommandIDs.request, {
        serverId: 'pylsp',
        method: 'textDocument/hover',
        params: {},
        timeoutMs: 1000
      })
    ).rejects.toThrow('Request cancelled by connection.');
    expect(jest.getTimerCount()).toBe(0);
  });

  it('cancels requests which exceed the timeout', async () => {
    jest.useFakeTimers();
    const { commands, connectionManager } = createEnvironment();
    const request = jest.fn(
      (_method, _params, options) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () => {
            reject(options.signal.reason);
          });
        })
    );
    connectionManager.connections.set('test.py', createConnection({ request }));

    const result = commands.execute(LSPCommandIDs.request, {
      serverId: 'pylsp',
      method: 'textDocument/hover',
      params: {},
      timeoutMs: 25
    });
    jest.advanceTimersByTime(25);

    await expect(result).rejects.toThrow(
      'LSP request textDocument/hover timed out after 25 ms.'
    );
  });
});
