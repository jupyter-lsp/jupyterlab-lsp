import * as LSP from 'vscode-languageserver-protocol';

import { ILSPConnection } from '../tokens';
import { CommLSP } from './lsp';
import { ICommRPC } from '.';
import { Signal } from '@lumino/signaling';

export class CommConnection extends CommLSP implements ILSPConnection {
  protected _isConnected = false;
  protected _isInitialized = false;

  protected documentsToOpen: ILSPConnection.IDocumentInfo[];

  private _signals: Map<
    keyof ILSPConnection.IEventSignalArgs,
    Signal<
      ILSPConnection,
      ILSPConnection.IEventSignalArgs[keyof ILSPConnection.IEventSignalArgs]
    >
  > = new Map();

  private _listeners = new Map<any, any>();

  private closingManually = false;

  constructor(options: ICommRPC.IOptions) {
    super(options);
    this._signals = new Map();
    this._signals.set(ILSPConnection.Events.ON_CLOSE, new Signal(this));
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

  get isReady() {
    return this._isConnected && this._isInitialized;
  }

  get isConnected() {
    return this._isConnected;
  }

  get isInitialized() {
    return this._isInitialized;
  }

  isRenameSupported() {
    // nb: populate capabilities
    return this.capabilities.has(CommLSP.Capabilities.SERVER_RENAME_PROVIDER);
  }

  isReferencesSupported() {
    return this.capabilities.has(CommLSP.Capabilities.REFERENCES_PROVIDER);
  }

  isTypeDefinitionSupported() {
    return this.capabilities.has(CommLSP.Capabilities.TYPE_DEFINITION_PROVIDER);
  }

  isDefinitionSupported() {
    return this.capabilities.has(CommLSP.Capabilities.DEFINITION_PROVIDER);
  }

  sendOpenWhenReady(documentInfo: ILSPConnection.IDocumentInfo) {
    if (this.isReady) {
      this.sendOpen(documentInfo);
    } else {
      this.documentsToOpen.push(documentInfo);
    }
  }

  sendOpen(documentInfo: ILSPConnection.IDocumentInfo) {
    this.notify(CommLSP.DID_OPEN, {
      textDocument: {
        uri: documentInfo.uri,
        languageId: documentInfo.languageId,
        text: documentInfo.text,
        version: documentInfo.version
      }
    }).catch(err => console.warn(err));
    this.sendChange(documentInfo);
  }

  sendChange(documentInfo: ILSPConnection.IDocumentInfo) {
    if (!this.isReady) {
      return;
    }
    this.notify(CommLSP.DID_CHANGE, {
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
    newName: string,
    emit?: false
  ): Promise<LSP.WorkspaceEdit> {
    if (!this.isReady || !this.isRenameSupported()) {
      return;
    }
    return await this.request(CommLSP.RENAME, {
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

  protected onServerInitialized(params: LSP.InitializeResult) {
    // super.onServerInitialized(params);
    while (this.documentsToOpen.length) {
      this.sendOpen(this.documentsToOpen.pop());
    }
  }

  connect(socket?: WebSocket): ILSPConnection {
    // nb: look into this
    // super.connect(socket);

    this.comm.onClose = () => {
      this._isConnected = false;
      this._signals
        .get(ILSPConnection.Events.ON_CLOSE)
        .emit(this.closingManually);
    };
    return this;
  }

  close() {
    try {
      this.closingManually = true;
      // nb: look into this
      // super.close();
    } catch (e) {
      this.closingManually = false;
    }
  }

  // methods from ws-connection
  getLanguageCompletionCharacters() {
    return (
      this.capabilities.get(
        CommLSP.Capabilities.COMPLETION_TRIGGER_CHARACTERS
      ) || []
    );
  }

  getLanguageSignatureCharacters() {
    return (
      this.capabilities.get(
        CommLSP.Capabilities.SIGNATURE_HELP_TRIGGER_CHARACTERS
      ) || []
    );
  }

  async getDocumentHighlights(
    location: ILSPConnection.IPosition,
    documentInfo: ILSPConnection.IDocumentInfo,
    emit?: false
  ) {
    if (!this.isReady) {
      return;
    }

    return await this.request(CommLSP.DOCUMENT_HIGHLIGHT, {
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
    documentInfo: ILSPConnection.IDocumentInfo,
    emit?: false
  ) {
    if (
      !this.isReady &&
      !this.capabilities.has(CommLSP.Capabilities.HOVER_PROVIDER)
    ) {
      return;
    }
    return await this.request(CommLSP.HOVER, {
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
    documentInfo: ILSPConnection.IDocumentInfo,
    emit?: false
  ): Promise<LSP.SignatureHelp> {
    if (
      !(
        this.isReady &&
        this.capabilities.get(CommLSP.Capabilities.SIGNATURE_HELP_PROVIDER)
      )
    ) {
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

    return await this.request(CommLSP.SIGNATURE_HELP, {
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
    emit: false,
    triggerCharacter?: string,
    triggerKind?: LSP.CompletionTriggerKind
  ) {
    if (
      !(
        this.isReady &&
        this.capabilities.get(CommLSP.Capabilities.SIGNATURE_HELP_PROVIDER)
      )
    ) {
      return;
    }

    const items = await this.request(CommLSP.COMPLETION, {
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
    documentInfo: ILSPConnection.IDocumentInfo,
    emit?: false
  ) {
    if (!this.isReady || !this.isReferencesSupported()) {
      return;
    }

    return this.request(CommLSP.REFERENCES, {
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

    this.notify(CommLSP.DID_SAVE, {
      textDocument: {
        uri: documentInfo.uri,
        version: documentInfo.version
      } as LSP.VersionedTextDocumentIdentifier,
      text: documentInfo.text
    }).catch(err => console.warn(err));
  }

  async getTypeDefinition(
    location: ILSPConnection.IPosition,
    documentInfo: ILSPConnection.IDocumentInfo,
    emit?: false
  ) {
    if (!this.isReady || !this.isTypeDefinitionSupported()) {
      return;
    }

    return await this.request(CommLSP.TYPE_DEFINITION, {
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
    documentInfo: ILSPConnection.IDocumentInfo,
    emit?: false
  ) {
    if (!(this.isReady && this.isDefinitionSupported())) {
      return;
    }

    return this.request(CommLSP.DEFINITION, {
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
    this.notify(CommLSP.DID_CHANGE, {
      textDocument: {
        uri: documentInfo.uri,
        version: documentInfo.version
      },
      contentChanges: changeEvents
    }).catch(err => console.warn(err));
    documentInfo.version++;
  }
}
