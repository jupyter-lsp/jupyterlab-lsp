// Disclaimer/acknowledgement: Some code based on LspWsConnection, which is copyright of wylieconlon and contributors and ISC licenced.
// ISC licence is, quote, "functionally equivalent to the simplified BSD and MIT licenses,
// but without language deemed unnecessary following the Berne Convention." (Wikipedia).
// Introduced modifications are BSD licenced, copyright JupyterLab development team.
import * as lsProtocol from 'vscode-languageserver-protocol';
import { ILspOptions, LspWsConnection } from 'lsp-editor-adapter';

interface ILSPOptions extends ILspOptions {

}

export class LSPConnection extends LspWsConnection {
  constructor(options: ILSPOptions) {
    super(options);
  }

  public async sendSelectiveChange(
    changeEvent: lsProtocol.TextDocumentContentChangeEvent
  ): Promise<void> {
    await this._sendChange([changeEvent]);
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
}
