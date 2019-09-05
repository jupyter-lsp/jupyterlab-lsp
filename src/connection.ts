// Disclaimer/acknowledgement: Fragments are based on LspWsConnection, which is copyright of wylieconlon and contributors and ISC licenced.
// ISC licence is, quote, "functionally equivalent to the simplified BSD and MIT licenses,
// but without language deemed unnecessary following the Berne Convention." (Wikipedia).
// Introduced modifications are BSD licenced, copyright JupyterLab development team.
import * as lsProtocol from 'vscode-languageserver-protocol';
import {
  ILspOptions,
  IPosition,
  ITokenInfo,
  LspWsConnection
} from 'lsp-editor-adapter';
import { CompletionTriggerKind } from './lsp';

interface ILSPOptions extends ILspOptions {}

export class LSPConnection extends LspWsConnection {
  constructor(options: ILSPOptions) {
    super(options);
  }

  public sendSelectiveChange(
    changeEvent: lsProtocol.TextDocumentContentChangeEvent
  ) {
    this._sendChange([changeEvent]);
  }

  public sendFullTextChange(text: string): void {
    this._sendChange([{ text }]);
  }

  private _sendChange(
    changeEvents: lsProtocol.TextDocumentContentChangeEvent[]
  ) {
    // @ts-ignore
    if (!this.isConnected) {
      return;
    }
    // @ts-ignore
    let documentInfo = this.documentInfo;
    const textDocumentChange: lsProtocol.DidChangeTextDocumentParams = {
      textDocument: {
        uri: documentInfo.documentUri,
        // @ts-ignore
        version: this.documentVersion
      } as lsProtocol.VersionedTextDocumentIdentifier,
      contentChanges: changeEvents
    };
    // @ts-ignore
    this.connection.sendNotification(
      'textDocument/didChange',
      textDocumentChange
    );
    // @ts-ignore
    this.documentVersion++;
  }

  public async getCompletion(
    location: IPosition,
    token: ITokenInfo,
    triggerCharacter: string,
    triggerKind: CompletionTriggerKind
  ): Promise<lsProtocol.CompletionItem[]> {
    // @ts-ignore
    if (!this.isConnected) {
      return;
    }
    if (
      // @ts-ignore
      !(this.serverCapabilities && this.serverCapabilities.completionProvider)
    ) {
      return;
    }

    // @ts-ignore
    let connection = this.connection;
    return new Promise<lsProtocol.CompletionItem[]>(resolve => {
      connection
        .sendRequest('textDocument/completion', {
          textDocument: {
            // @ts-ignore
            uri: this.documentInfo.documentUri
          },
          position: {
            line: location.line,
            character: location.ch
          },
          context: {
            triggerKind: triggerKind,
            triggerCharacter
          }
        } as lsProtocol.CompletionParams)
        .then(
          (
            params:
              | lsProtocol.CompletionList
              | lsProtocol.CompletionItem[]
              | null
          ) => {
            if (params) {
              params = 'items' in params ? params.items : params;
            }
            resolve(params as lsProtocol.CompletionItem[]);
          }
        );
    });
  }
}
