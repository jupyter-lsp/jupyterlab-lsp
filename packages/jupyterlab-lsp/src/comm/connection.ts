import { Signal } from '@lumino/signaling';

import * as LSP from '../lsp';
import { ILSPConnection } from '../tokens';

import { ICommRPC } from '.';
import { CommLSP } from './lsp';
import {
  registerServerCapability,
  unregisterServerCapability
} from './server-capability-registration';

export class CommLSPConnection extends CommLSP implements ILSPConnection {
  protected _isConnected = false;
  protected _isInitialized = false;
  public serverCapabilities: LSP.ServerCapabilities;

  protected documentsToOpen: ILSPConnection.IDocumentInfo[] = [];

  private _rootUri: string;
  private _signals: Map<
    keyof ILSPConnection.IEventSignalArgs,
    Signal<
      ILSPConnection,
      ILSPConnection.IEventSignalArgs[keyof ILSPConnection.IEventSignalArgs]
    >
  > = new Map();

  private _listeners = new Map<any, any>();
  private _openDocuments = new Map<string, boolean>();

  private closingManually = false;

  constructor(options: CommLSPConnection.IOptions) {
    super(options);
    this._rootUri = options.rootUri;
    this.initSignals();
    this.initHandlers();
    this.commChanged.connect(() => this._openDocuments.clear());
  }

  get rootUri() {
    return this._rootUri;
  }

  get isReady() {
    return this._isConnected && this._isInitialized;
  }

  get isConnected() {
    return this._isConnected;
  }

  get isInitialized() {
    return this._isInitialized;
  }

  on<
    T extends keyof ILSPConnection.IEventSignalArgs,
    U extends ILSPConnection.IEventSignalArgs,
    V extends (args: U) => void
  >(evt: T, listener: V) {
    const wrapped = (sender: any, args: any) => listener(args);
    this._listeners.set([evt, listener], wrapped);
    this._signals.get(evt).connect(wrapped);
  }

  off<
    T extends keyof ILSPConnection.IEventSignalArgs,
    U extends ILSPConnection.IEventSignalArgs,
    V extends (args: U) => void
  >(evt: T, listener: V) {
    const wrapped = this._listeners.get([evt, listener]);
    this._signals.get(evt).disconnect(wrapped);
    this._listeners.delete([evt, listener]);
  }

  close() {
    try {
      this.closingManually = true;
    } catch (e) {
      this.closingManually = false;
    }
  }

  protected initSignals() {
    this._signals = new Map([
      [ILSPConnection.LegacyEvents.ON_CLOSE, new Signal(this)],
      [ILSPConnection.LegacyEvents.ON_DIAGNOSTIC, new Signal(this)],
      [ILSPConnection.LegacyEvents.ON_LOGGING, new Signal(this)],
      [ILSPConnection.LegacyEvents.ON_INITIALIZED, new Signal(this)]
    ]);
  }

  protected initHandlers() {
    // logging
    this.onNotification(LSP.Method.SHOW_MESSAGE, {
      onMsg: async params => {
        this._signals.get(ILSPConnection.LegacyEvents.ON_LOGGING).emit(params);
      }
    });

    this.onRequest(LSP.Method.SHOW_MESSAGE_REQUEST, {
      onMsg: async params => {
        this._signals.get(ILSPConnection.LegacyEvents.ON_LOGGING).emit(params);
        // nb: this seems important
        return null;
      }
    });

    // diagnostics
    this.onNotification(LSP.Method.PUBLISH_DIAGNOSTICS, {
      onMsg: async params => {
        this._signals
          .get(ILSPConnection.LegacyEvents.ON_DIAGNOSTIC)
          .emit(params);
      }
    });

    // capabilities
    this.onRequest(LSP.Method.REGISTER_CAPABILITY, {
      onMsg: async params => {
        for (const registration of params.registrations) {
          this.serverCapabilities = registerServerCapability(
            this.serverCapabilities,
            registration
          );
        }
      }
    });

    this.onRequest(LSP.Method.UNREGISTER_CAPABILITY, {
      onMsg: async params => {
        for (const registration of params.unregisterations) {
          this.serverCapabilities = unregisterServerCapability(
            this.serverCapabilities,
            registration
          );
        }
      }
    });
  }

  async connect(): Promise<void> {
    this.comm.onClose = () => {
      this._isConnected = false;
      this._signals
        .get(ILSPConnection.LegacyEvents.ON_CLOSE)
        .emit(this.closingManually);
    };

    this._isConnected = true;

    await this.initialize();
  }

  /**
   * Initialization parameters to be sent to the language server.
   * Subclasses can overload this when adding more features.
   */
  protected initializeParams(): LSP.InitializeParams {
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
        } as LSP.ClientCapabilities,
        workspace: {
          didChangeConfiguration: {
            dynamicRegistration: true
          }
        } as LSP.WorkspaceClientCapabilities
      } as LSP.ClientCapabilities,
      initializationOptions: null,
      processId: null,
      rootUri: this._rootUri,
      workspaceFolders: null
    };
  }

  async initialize(): Promise<void> {
    this._isInitialized = false;

    if (!this.isConnected) {
      return;
    }

    const initialized = await this.request(
      LSP.Method.INITIALIZE,
      this.initializeParams()
    );

    const { capabilities } = initialized;

    this.serverCapabilities = capabilities;

    await this.notify(LSP.Method.INITIALIZED, null).catch(err =>
      console.warn(err)
    );

    await this.notify(LSP.Method.DID_CHANGE_CONFIGURATION, {
      settings: {}
    }).catch(err => console.warn(err));

    while (this.documentsToOpen.length) {
      this.sendOpen(this.documentsToOpen.pop());
    }

    this._isInitialized = true;

    this._signals
      .get(ILSPConnection.LegacyEvents.ON_INITIALIZED)
      .emit(this.serverCapabilities);
  }

  // capabilities
  provides(provider: keyof LSP.ServerCapabilities): boolean {
    return (
      this.isReady &&
      !!(this.serverCapabilities && this.serverCapabilities[provider])
    );
  }

  getLanguageCompletionCharacters() {
    return this.serverCapabilities?.completionProvider?.triggerCharacters || [];
  }

  getLanguageSignatureCharacters() {
    return (
      this.serverCapabilities?.signatureHelpProvider?.triggerCharacters || []
    );
  }

  sendConfigurationChange(settings: LSP.DidChangeConfigurationParams) {
    if (!this.isReady) {
      return;
    }

    this.notify(LSP.Method.DID_CHANGE_CONFIGURATION, settings).catch(err =>
      console.warn(err)
    );
  }

  sendOpenWhenReady(documentInfo: ILSPConnection.IDocumentInfo) {
    if (this.isReady) {
      this.sendOpen(documentInfo);
    } else {
      this.documentsToOpen.push(documentInfo);
    }
  }

  sendOpen(documentInfo: ILSPConnection.IDocumentInfo) {
    this.notify(LSP.Method.DID_OPEN, {
      textDocument: {
        uri: documentInfo.uri,
        languageId: documentInfo.languageId,
        text: documentInfo.text,
        version: documentInfo.version
      }
    }).catch(err => console.warn(err));
    this._openDocuments.set(documentInfo.uri, true);
    this.sendChange(documentInfo);
  }

  sendChange(documentInfo: ILSPConnection.IDocumentInfo) {
    if (!this.isReady) {
      return;
    }
    if (!this._openDocuments.get(documentInfo.uri)) {
      this.sendOpen(documentInfo);
    }
    this.notify(LSP.Method.DID_CHANGE, {
      textDocument: {
        uri: documentInfo.uri,
        version: documentInfo.version
      },
      contentChanges: [{ text: documentInfo.text }]
    }).catch(err => console.warn(err));
    documentInfo.version++;
  }

  sendSelectiveChange(
    changeEvent: LSP.TextDocumentContentChangeEvent,
    documentInfo: ILSPConnection.IDocumentInfo
  ) {
    this._sendChange([changeEvent], documentInfo);
  }

  sendFullTextChange(
    text: string,
    documentInfo: ILSPConnection.IDocumentInfo
  ): void {
    this._sendChange([{ text }], documentInfo);
  }

  async rename(
    location: ILSPConnection.IPosition,
    documentInfo: ILSPConnection.IDocumentInfo,
    newName: string
  ): Promise<LSP.WorkspaceEdit> {
    if (!this.provides(LSP.Provider.RENAME)) {
      return;
    }
    return await this.request(LSP.Method.RENAME, {
      textDocument: {
        uri: documentInfo.uri
      },
      position: {
        line: location.line,
        character: location.ch
      },
      newName
    });
  }

  async getDocumentHighlights(
    location: ILSPConnection.IPosition,
    documentInfo: ILSPConnection.IDocumentInfo
  ) {
    if (!this.isReady) {
      return;
    }

    return await this.request(LSP.Method.DOCUMENT_HIGHLIGHT, {
      textDocument: {
        uri: documentInfo.uri
      },
      position: {
        line: location.line,
        character: location.ch
      }
    });
  }

  async getHoverTooltip(
    location: ILSPConnection.IPosition,
    documentInfo: ILSPConnection.IDocumentInfo
  ) {
    if (!this.provides(LSP.Provider.HOVER)) {
      return;
    }
    return await this.request(LSP.Method.HOVER, {
      textDocument: {
        uri: documentInfo.uri
      },
      position: {
        line: location.line,
        character: location.ch
      }
    });
  }

  async getSignatureHelp(
    location: ILSPConnection.IPosition,
    documentInfo: ILSPConnection.IDocumentInfo
  ): Promise<LSP.SignatureHelp> {
    if (!this.provides(LSP.Provider.SIGNATURE_HELP)) {
      return;
    }

    const code = documentInfo.text;
    const lines = code.split('\n');
    const typedCharacter = lines[location.line][location.ch - 1];

    const triggers = this.getLanguageSignatureCharacters();
    if (triggers.indexOf(typedCharacter) === -1) {
      // Not a signature character
      return;
    }

    return await this.request(LSP.Method.SIGNATURE_HELP, {
      textDocument: {
        uri: documentInfo.uri
      },
      position: {
        line: location.line,
        character: location.ch
      }
    });
  }

  public async getCompletion(
    location: ILSPConnection.IPosition,
    token: ILSPConnection.ITokenInfo,
    documentInfo: ILSPConnection.IDocumentInfo,
    triggerCharacter?: string,
    triggerKind?: LSP.CompletionTriggerKind
  ) {
    if (!this.provides(LSP.Provider.COMPLETION)) {
      return;
    }

    const items = await this.request(LSP.Method.COMPLETION, {
      textDocument: {
        uri: documentInfo.uri
      },
      position: {
        line: location.line,
        character: location.ch
      },
      context: {
        triggerKind: triggerKind || LSP.CompletionTriggerKind.Invoked,
        triggerCharacter
      }
    });

    if (Array.isArray(items)) {
      return items;
    }
    return items.items;
  }

  public async getReferences(
    location: ILSPConnection.IPosition,
    documentInfo: ILSPConnection.IDocumentInfo
  ) {
    if (!this.provides(LSP.Provider.REFERENCES)) {
      return;
    }

    return this.request(LSP.Method.REFERENCES, {
      context: {
        includeDeclaration: true
      },
      textDocument: {
        uri: documentInfo.uri
      },
      position: {
        line: location.line,
        character: location.ch
      }
    });
  }

  public sendSaved(documentInfo: ILSPConnection.IDocumentInfo) {
    if (!this.isReady) {
      return;
    }

    this.notify(LSP.Method.DID_SAVE, {
      textDocument: {
        uri: documentInfo.uri,
        version: documentInfo.version
      },
      text: documentInfo.text
    }).catch(err => console.warn(err));
  }

  async getTypeDefinition(
    location: ILSPConnection.IPosition,
    documentInfo: ILSPConnection.IDocumentInfo
  ) {
    if (!this.provides(LSP.Provider.TYPE_DEFINITION)) {
      return;
    }

    return await this.request(LSP.Method.TYPE_DEFINITION, {
      textDocument: {
        uri: documentInfo.uri
      },
      position: {
        line: location.line,
        character: location.ch
      }
    });
  }

  public async getDefinition(
    location: ILSPConnection.IPosition,
    documentInfo: ILSPConnection.IDocumentInfo
  ) {
    if (!this.provides(LSP.Provider.DEFINITION)) {
      return;
    }

    return this.request(LSP.Method.DEFINITION, {
      textDocument: {
        uri: documentInfo.uri
      },
      position: {
        line: location.line,
        character: location.ch
      }
    });
  }

  // private methods from connection
  private _sendChange(
    changeEvents: LSP.TextDocumentContentChangeEvent[],
    documentInfo: ILSPConnection.IDocumentInfo
  ) {
    if (!this.isReady) {
      return;
    }

    if (!this._openDocuments.get(documentInfo.uri)) {
      this.sendOpen(documentInfo);
    }

    this.notify(LSP.Method.DID_CHANGE, {
      textDocument: {
        uri: documentInfo.uri,
        version: documentInfo.version
      },
      contentChanges: changeEvents
    }).catch(err => console.warn(err));
    documentInfo.version++;
  }
}

export namespace CommLSPConnection {
  export interface IOptions extends ICommRPC.IOptions {
    rootUri: string;
  }
}
