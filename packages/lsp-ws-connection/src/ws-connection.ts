import * as events from 'events';
import { LocationLink } from 'vscode-languageserver-protocol';
import * as protocol from 'vscode-languageserver-protocol';
import { ConsoleLogger, listen, MessageConnection } from 'vscode-ws-jsonrpc';
import {
  registerServerCapability,
  unregisterServerCapability
} from './server-capability-registration';
import {
  ILspConnection,
  ILspOptions,
  IPosition,
  ITokenInfo,
  IDocumentInfo
} from './types';

/**
 * Changes as compared to upstream:
 *  - markdown is preferred over plaintext
 *  - informative members are public and others are protected, not private
 *  - onServerInitialized() was extracted; it also emits a message once connected
 *  - initializeParams() was extracted, and can be modified by subclasses
 *  - typescript 3.7 was adopted to clean up deep references
 */
export class LspWsConnection extends events.EventEmitter
  implements ILspConnection {
  public isConnected = false;
  public isInitialized = false;
  public documentInfo: ILspOptions;
  public serverCapabilities: protocol.ServerCapabilities;
  protected socket: WebSocket;
  protected connection: MessageConnection;
  private rootUri: string;

  constructor(options: ILspOptions) {
    super();
    this.rootUri = options.rootUri;
  }

  get isReady() {
    return this.isConnected && this.isInitialized;
  }

  /**
   * Initialize a connection over a web socket that speaks the LSP protocol
   */
  public connect(socket: WebSocket): this {
    this.socket = socket;

    listen({
      webSocket: this.socket,
      logger: new ConsoleLogger(),
      onConnection: (connection: MessageConnection) => {
        connection.listen();
        this.isConnected = true;

        this.connection = connection;
        this.sendInitialize();

        this.connection.onNotification(
          'textDocument/publishDiagnostics',
          (params: protocol.PublishDiagnosticsParams) => {
            this.emit('diagnostic', params);
          }
        );

        this.connection.onNotification(
          'window/showMessage',
          (params: protocol.ShowMessageParams) => {
            this.emit('logging', params);
          }
        );

        this.connection.onRequest(
          'client/registerCapability',
          (params: protocol.RegistrationParams) => {
            params.registrations.forEach(
              (capabilityRegistration: protocol.Registration) => {
                this.serverCapabilities = registerServerCapability(
                  this.serverCapabilities,
                  capabilityRegistration
                );
              }
            );

            this.emit('logging', params);
          }
        );

        this.connection.onRequest(
          'client/unregisterCapability',
          (params: protocol.UnregistrationParams) => {
            params.unregisterations.forEach(
              (capabilityUnregistration: protocol.Unregistration) => {
                this.serverCapabilities = unregisterServerCapability(
                  this.serverCapabilities,
                  capabilityUnregistration
                );
              }
            );

            this.emit('logging', params);
          }
        );

        this.connection.onRequest(
          'window/showMessageRequest',
          (params: protocol.ShowMessageRequestParams) => {
            this.emit('logging', params);
          }
        );

        this.connection.onError(e => {
          this.emit('error', e);
        });

        this.connection.onClose(() => {
          this.isConnected = false;
        });
      }
    });

    return this;
  }

  public close() {
    if (this.connection) {
      this.connection.dispose();
    }
    this.socket.close();
  }

  /**
   * Initialization parameters to be sent to the language server.
   * Subclasses can overload this when adding more features.
   */
  protected initializeParams(): protocol.InitializeParams {
    return {
      capabilities: {
        textDocument: {
          hover: {
            dynamicRegistration: true,
            contentFormat: ['markdown', 'plaintext']
          },
          synchronization: {
            dynamicRegistration: true,
            willSave: false,
            didSave: true,
            willSaveWaitUntil: false
          },
          completion: {
            dynamicRegistration: true,
            completionItem: {
              snippetSupport: false,
              commitCharactersSupport: true,
              documentationFormat: ['markdown', 'plaintext'],
              deprecatedSupport: false,
              preselectSupport: false
            },
            contextSupport: false
          },
          signatureHelp: {
            dynamicRegistration: true,
            signatureInformation: {
              documentationFormat: ['markdown', 'plaintext']
            }
          },
          declaration: {
            dynamicRegistration: true,
            linkSupport: true
          },
          definition: {
            dynamicRegistration: true,
            linkSupport: true
          },
          typeDefinition: {
            dynamicRegistration: true,
            linkSupport: true
          },
          implementation: {
            dynamicRegistration: true,
            linkSupport: true
          }
        } as protocol.ClientCapabilities,
        workspace: {
          didChangeConfiguration: {
            dynamicRegistration: true
          }
        } as protocol.WorkspaceClientCapabilities
      } as protocol.ClientCapabilities,
      initializationOptions: null,
      processId: null,
      rootUri: this.rootUri,
      workspaceFolders: null
    };
  }

  public sendInitialize() {
    if (!this.isConnected) {
      return;
    }

    const message: protocol.InitializeParams = this.initializeParams();

    this.connection
      .sendRequest<protocol.InitializeResult>('initialize', message)
      .then(
        params => {
          this.onServerInitialized(params);
        },
        e => {
          console.warn('lsp-ws-connection initialization failure', e);
        }
      );
  }

  public sendOpen(documentInfo: IDocumentInfo) {
    const textDocumentMessage: protocol.DidOpenTextDocumentParams = {
      textDocument: {
        uri: documentInfo.uri,
        languageId: documentInfo.languageId,
        text: documentInfo.text,
        version: documentInfo.version
      } as protocol.TextDocumentItem
    };
    this.connection.sendNotification(
      'textDocument/didOpen',
      textDocumentMessage
    );
    this.sendChange(documentInfo);
  }

  public sendChange(documentInfo: IDocumentInfo) {
    if (!this.isReady) {
      return;
    }
    const textDocumentChange: protocol.DidChangeTextDocumentParams = {
      textDocument: {
        uri: documentInfo.uri,
        version: documentInfo.version
      } as protocol.VersionedTextDocumentIdentifier,
      contentChanges: [{ text: documentInfo.text }]
    };
    this.connection.sendNotification(
      'textDocument/didChange',
      textDocumentChange
    );
    documentInfo.version++;
  }

  public sendSaved(documentInfo: IDocumentInfo) {
    if (!this.isReady) {
      return;
    }

    const textDocumentChange: protocol.DidSaveTextDocumentParams = {
      textDocument: {
        uri: documentInfo.uri,
        version: documentInfo.version
      } as protocol.VersionedTextDocumentIdentifier,
      text: documentInfo.text
    };
    this.connection.sendNotification(
      'textDocument/didSave',
      textDocumentChange
    );
  }

  public getHoverTooltip(location: IPosition, documentInfo: IDocumentInfo) {
    if (!this.isInitialized) {
      return;
    }
    this.connection
      .sendRequest<protocol.Hover>('textDocument/hover', {
        textDocument: {
          uri: documentInfo.uri
        },
        position: {
          line: location.line,
          character: location.ch
        }
      } as protocol.TextDocumentPositionParams)
      .then(params => {
        this.emit('hover', params);
      });
  }

  public getCompletion(
    location: IPosition,
    token: ITokenInfo,
    documentInfo: IDocumentInfo,
    triggerCharacter?: string,
    triggerKind?: protocol.CompletionTriggerKind
  ) {
    if (!this.isConnected || !this.serverCapabilities?.completionProvider) {
      return;
    }

    this.connection
      .sendRequest<protocol.CompletionList | protocol.CompletionItem[]>(
        'textDocument/completion',
        {
          textDocument: {
            uri: documentInfo.uri
          },
          position: {
            line: location.line,
            character: location.ch
          },
          context: {
            triggerKind: triggerKind || protocol.CompletionTriggerKind.Invoked,
            triggerCharacter
          }
        } as protocol.CompletionParams
      )
      .then(params => {
        if (!params) {
          this.emit('completion', params);
          return;
        }
        this.emit('completion', 'items' in params ? params.items : params);
      });
  }

  public getDetailedCompletion(completionItem: protocol.CompletionItem) {
    if (!this.isReady) {
      return;
    }
    this.connection
      .sendRequest<protocol.CompletionItem>(
        'completionItem/resolve',
        completionItem
      )
      .then(result => {
        this.emit('completionResolved', result);
      });
  }

  public getSignatureHelp(location: IPosition, documentInfo: IDocumentInfo) {
    if (!this.isReady || !this.serverCapabilities?.signatureHelpProvider) {
      return;
    }

    const code = documentInfo.text;
    const lines = code.split('\n');
    const typedCharacter = lines[location.line][location.ch - 1];

    const triggers =
      this.serverCapabilities?.signatureHelpProvider?.triggerCharacters || [];
    if (triggers.indexOf(typedCharacter) === -1) {
      // Not a signature character
      return;
    }

    this.connection
      .sendRequest<protocol.SignatureHelp>('textDocument/signatureHelp', {
        textDocument: {
          uri: documentInfo.uri
        },
        position: {
          line: location.line,
          character: location.ch
        }
      } as protocol.TextDocumentPositionParams)
      .then(params => {
        this.emit('signature', params);
      });
  }

  /**
   * Request the locations of all matching document symbols
   */
  public getDocumentHighlights(
    location: IPosition,
    documentInfo: IDocumentInfo
  ) {
    if (!this.isReady || !this.serverCapabilities?.documentHighlightProvider) {
      return;
    }

    this.connection
      .sendRequest<protocol.DocumentHighlight[]>(
        'textDocument/documentHighlight',
        {
          textDocument: {
            uri: documentInfo.uri
          },
          position: {
            line: location.line,
            character: location.ch
          }
        } as protocol.TextDocumentPositionParams
      )
      .then(highlights => {
        this.emit('highlight', highlights, documentInfo.uri);
      });
  }

  /**
   * Request a link to the definition of the current symbol. The results will not be displayed
   * unless they are within the same file URI
   */
  public getDefinition(location: IPosition, documentInfo: IDocumentInfo) {
    if (!this.isReady || !this.isDefinitionSupported()) {
      return;
    }

    this.connection
      .sendRequest<Location | Location[] | LocationLink[]>(
        'textDocument/definition',
        {
          textDocument: {
            uri: documentInfo.uri
          },
          position: {
            line: location.line,
            character: location.ch
          }
        } as protocol.TextDocumentPositionParams
      )
      .then(result => {
        this.emit('goTo', result);
      });
  }

  /**
   * Request a link to the type definition of the current symbol. The results will not be displayed
   * unless they are within the same file URI
   */
  public getTypeDefinition(location: IPosition, documentInfo: IDocumentInfo) {
    if (!this.isReady || !this.isTypeDefinitionSupported()) {
      return;
    }

    this.connection
      .sendRequest<Location | Location[] | LocationLink[]>(
        'textDocument/typeDefinition',
        {
          textDocument: {
            uri: documentInfo.uri
          },
          position: {
            line: location.line,
            character: location.ch
          }
        } as protocol.TextDocumentPositionParams
      )
      .then(result => {
        this.emit('goTo', result);
      });
  }

  /**
   * Request a link to the implementation of the current symbol. The results will not be displayed
   * unless they are within the same file URI
   */
  public getImplementation(location: IPosition, documentInfo: IDocumentInfo) {
    if (!this.isReady || !this.isImplementationSupported()) {
      return;
    }

    this.connection
      .sendRequest<Location | Location[] | LocationLink[]>(
        'textDocument/implementation',
        {
          textDocument: {
            uri: documentInfo.uri
          },
          position: {
            line: location.line,
            character: location.ch
          }
        } as protocol.TextDocumentPositionParams
      )
      .then(result => {
        this.emit('goTo', result);
      });
  }

  /**
   * Request a link to all references to the current symbol. The results will not be displayed
   * unless they are within the same file URI
   */
  public getReferences(location: IPosition, documentInfo: IDocumentInfo) {
    if (!this.isReady || !this.isReferencesSupported()) {
      return;
    }

    this.connection
      .sendRequest<Location[]>('textDocument/references', {
        textDocument: {
          uri: documentInfo.uri
        },
        position: {
          line: location.line,
          character: location.ch
        }
      } as protocol.ReferenceParams)
      .then(result => {
        this.emit('goTo', result);
      });
  }

  /**
   * The characters that trigger completion automatically.
   */
  public getLanguageCompletionCharacters(): string[] {
    return this.serverCapabilities?.completionProvider?.triggerCharacters || [];
  }

  /**
   * The characters that trigger signature help automatically.
   */
  public getLanguageSignatureCharacters(): string[] {
    return (
      this.serverCapabilities?.signatureHelpProvider?.triggerCharacters || []
    );
  }

  /**
   * Does the server support go to definition?
   */
  public isDefinitionSupported() {
    return !!this.serverCapabilities?.definitionProvider;
  }

  /**
   * Does the server support go to type definition?
   */
  public isTypeDefinitionSupported() {
    return !!this.serverCapabilities?.typeDefinitionProvider;
  }

  /**
   * Does the server support go to implementation?
   */
  public isImplementationSupported() {
    return !!this.serverCapabilities?.implementationProvider;
  }

  /**
   * Does the server support find all references?
   */
  public isReferencesSupported() {
    return !!this.serverCapabilities?.referencesProvider;
  }

  protected onServerInitialized(params: protocol.InitializeResult) {
    this.isInitialized = true;
    this.serverCapabilities = params.capabilities;
    this.connection.sendNotification('initialized');
    this.connection.sendNotification('workspace/didChangeConfiguration', {
      settings: {}
    });
    this.emit('serverInitialized', this.serverCapabilities);
  }
}
