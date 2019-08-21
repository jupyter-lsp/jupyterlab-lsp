import { LspWsConnection } from 'lsp-editor-adapter';
import { PathExt } from '@jupyterlab/coreutils';

export abstract class JupyterLabWidgetAdapter {
  connection: LspWsConnection;

  abstract get document_path(): string;

  // TODO use mime types instead? Mime types would be set instead of language in servers.yml.
  abstract get language(): string;

  get root_path() {
    // TODO: serverRoot may need to be included for Hub or Windows, requires testing.
    // let root = PageConfig.getOption('serverRoot');
    return PathExt.dirname(this.document_path);
  }

  abstract get_document_content(): string;

  connect() {
    console.log(
      'LSP: will connect using root path:',
      this.root_path,
      'and language:',
      this.language
    );
    this.connection = new LspWsConnection({
      serverUri: 'ws://localhost/' + this.language,
      languageId: this.language,
      // paths handling needs testing on Windows and with other language servers
      rootUri: 'file://' + this.root_path,
      documentUri: 'file://' + this.document_path,
      documentText: this.get_document_content.bind(this)
    }).connect(new WebSocket('ws://localhost:3000/' + this.language));
  }
}
