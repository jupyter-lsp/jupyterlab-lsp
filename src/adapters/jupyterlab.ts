import { IPosition, LspWsConnection } from 'lsp-editor-adapter';
import { PathExt } from '@jupyterlab/coreutils';
import { CodeMirror } from './codemirror';
import { JupyterFrontEnd } from '@jupyterlab/application';
import { CodeJumper } from '@krassowski/jupyterlab_go_to_definition/lib/jumpers/jumper';

export abstract class JupyterLabWidgetAdapter {
  app: JupyterFrontEnd;
  connection: LspWsConnection;
  jumper: CodeJumper;

  protected constructor(app: JupyterFrontEnd) {
    this.app = app;
  }

  abstract get document_path(): string;

  // TODO use mime types instead? Mime types would be set instead of language in servers.yml.
  abstract get language(): string;

  get root_path() {
    // TODO: serverRoot may need to be included for Hub or Windows, requires testing.
    // let root = PageConfig.getOption('serverRoot');
    return PathExt.dirname(this.document_path);
  }

  abstract get_document_content(): string;

  abstract get cm_editor(): CodeMirror.Editor;

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
      rootUri: 'file:///' + this.root_path,
      documentUri: 'file:///' + this.document_path,
      documentText: this.get_document_content.bind(this)
    }).connect(new WebSocket('ws://localhost:3000/' + this.language));

    // @ts-ignore
    this.connection.on('goTo', locations => {
      // TODO: implement selector for multiple locations
      //  (like when there are multiple definitions or usages)
      console.log('Will jump:', locations);

      let location = locations[0];

      // @ts-ignore
      let uri: string = location.uri;

      let current_uri = this.connection.getDocumentUri();

      // @ts-ignore
      let line = location.range.start.line;
      // @ts-ignore
      let column = location.range.start.character;

      if (uri == current_uri) {
        this.jumper.jump(
          this.jumper.getJumpPosition({ line: line, column: column })
        );
        return;
      }

      if (uri.startsWith('file://')) {
        uri = uri.slice(7);
      }

      console.log(uri);
      this.jumper.global_jump(
        {
          // TODO: there are many files which are not symlinks
          uri: '.lsp_symlink/' + uri,
          editor_index: 0,
          line: line,
          column: column
        },
        true
      );
    });
  }

  get_doc_position_from_context_menu(): IPosition {
    // get the first node as it gives the most accurate approximation
    let leaf_node = this.app.contextMenuHitTest(() => true);

    let { left, top } = leaf_node.getBoundingClientRect();

    // @ts-ignore
    let event = this.app._contextMenuEvent;

    // if possible, use more accurate position from the actual event
    // (but this relies on an undocumented and unstable feature)
    if (event !== undefined) {
      left = event.clientX;
      top = event.clientY;
      event.stopPropagation();
    }
    return this.cm_editor.coordsChar(
      {
        left: left,
        top: top
      },
      'window'
    );
  }
}
