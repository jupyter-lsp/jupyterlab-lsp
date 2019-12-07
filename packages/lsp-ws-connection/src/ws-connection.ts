import * as events from 'events';
import { LocationLink } from 'vscode-languageserver-protocol';
import * as protocol from 'vscode-languageserver-protocol';
import { ConsoleLogger, listen, MessageConnection } from 'vscode-ws-jsonrpc';
import {
  registerServerCapability,
  unregisterServerCapability
} from './server-capability-registration';
import { ILspConnection, ILspOptions, IPosition, ITokenInfo } from './types';

/**
 * Changes as compared to master:
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
  protected documentVersion = 0;
  protected connection: MessageConnection;

  constructor(options: ILspOptions) {
    super();
    this.documentInfo = options;
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

  public getDocumentUri() {
    return this.documentInfo.documentUri;
  }

  public initializeParams(): protocol.InitializeParams {
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
            didSave: false,
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
      rootUri: this.documentInfo.rootUri,
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
      .then(this.onServerInitialized.bind(this), e => {
        console.warn(e);
      });
  }

  public sendChange() {
    if (!this.isConnected) {
      return;
    }
    const textDocumentChange: protocol.DidChangeTextDocumentParams = {
      textDocument: {
        uri: this.documentInfo.documentUri,
        version: this.documentVersion
      } as protocol.VersionedTextDocumentIdentifier,
      contentChanges: [
        {
          text: this.documentInfo.documentText()
        }
      ]
    };
    this.connection.sendNotification(
      'textDocument/didChange',
      textDocumentChange
    );
    this.documentVersion++;
  }

  public getHoverTooltip(location: IPosition) {
    if (!this.isInitialized) {
      return;
    }
    this.connection
      .sendRequest<protocol.Hover>('textDocument/hover', {
        textDocument: {
          uri: this.documentInfo.documentUri
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
            uri: this.documentInfo.documentUri
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
    if (!this.isConnected) {
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

  public getSignatureHelp(location: IPosition) {
    if (!this.isConnected || !this.serverCapabilities?.signatureHelpProvider) {
      return;
    }

    const code = this.documentInfo.documentText();
    const lines = code.split('\n');
    const typedCharacter = lines[location.line][location.ch];

    const triggers =
      this.serverCapabilities?.signatureHelpProvider?.triggerCharacters || [];
    if (triggers.indexOf(typedCharacter) === -1) {
      // Not a signature character
      return;
    }

    this.connection
      .sendRequest<protocol.SignatureHelp>('textDocument/signatureHelp', {
        textDocument: {
          uri: this.documentInfo.documentUri
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
  public getDocumentHighlights(location: IPosition) {
    if (
      !this.isConnected ||
      !this.serverCapabilities?.documentHighlightProvider
    ) {
      return;
    }

    this.connection
      .sendRequest<protocol.DocumentHighlight[]>(
        'textDocument/documentHighlight',
        {
          textDocument: {
            uri: this.documentInfo.documentUri
          },
          position: {
            line: location.line,
            character: location.ch
          }
        } as protocol.TextDocumentPositionParams
      )
      .then(params => {
        this.emit('highlight', params);
      });
  }

  /**
   * Request a link to the definition of the current symbol. The results will not be displayed
   * unless they are within the same file URI
   */
  public getDefinition(location: IPosition) {
    if (!this.isConnected || !this.isDefinitionSupported()) {
      return;
    }

    this.connection
      .sendRequest<Location | Location[] | LocationLink[]>(
        'textDocument/definition',
        {
          textDocument: {
            uri: this.documentInfo.documentUri
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
  public getTypeDefinition(location: IPosition) {
    if (!this.isConnected || !this.isTypeDefinitionSupported()) {
      return;
    }

    this.connection
      .sendRequest<Location | Location[] | LocationLink[]>(
        'textDocument/typeDefinition',
        {
          textDocument: {
            uri: this.documentInfo.documentUri
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
  public getImplementation(location: IPosition) {
    if (!this.isConnected || !this.isImplementationSupported()) {
      return;
    }

    this.connection
      .sendRequest<Location | Location[] | LocationLink[]>(
        'textDocument/implementation',
        {
          textDocument: {
            uri: this.documentInfo.documentUri
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
  public getReferences(location: IPosition) {
    if (!this.isConnected || !this.isReferencesSupported()) {
      return;
    }

    this.connection
      .sendRequest<Location[]>('textDocument/references', {
        textDocument: {
          uri: this.documentInfo.documentUri
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
    const textDocumentMessage: protocol.DidOpenTextDocumentParams = {
      textDocument: {
        uri: this.documentInfo.documentUri,
        languageId: this.documentInfo.languageId,
        text: this.documentInfo.documentText(),
        version: this.documentVersion
      } as protocol.TextDocumentItem
    };
    this.connection.sendNotification('initialized');
    this.connection.sendNotification('workspace/didChangeConfiguration', {
      settings: {}
    });
    this.connection.sendNotification(
      'textDocument/didOpen',
      textDocumentMessage
    );
    this.sendChange();
    this.emit('serverInitialized', this.serverCapabilities);
  }
}
