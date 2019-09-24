import * as lsProtocol from 'vscode-languageserver-protocol';
import { CodeMirrorLSPFeature, IFeatureCommand } from '../feature';
import { InputDialog } from '@jupyterlab/apputils';
import { PositionConverter } from '../../../converter';
import { IVirtualPosition } from '../../../positioning';

function toDocumentChanges(changes: {[uri: string]: lsProtocol.TextEdit[]}): lsProtocol.TextDocumentEdit[] {
  let documentChanges = [];
  for (let uri of Object.keys(changes)) {
    documentChanges.push({
      textDocument: { uri },
      edits: changes[uri]
    } as lsProtocol.TextDocumentEdit);
  }
  return documentChanges;
}

export class Rename extends CodeMirrorLSPFeature {
  static commands: Array<IFeatureCommand> = [
    {
      id: 'rename-symbol',
      execute: ({ connection, virtual_position, document }) => {
        let old_value = document.getTokenAt(virtual_position).string;
        InputDialog.getText({ title: 'Rename to', text: old_value }).then(
          value => {
            connection.rename(virtual_position, value.value);
          }
        );
      },
      is_enabled: ({ connection }) => connection.isRenameSupported(),
      label: 'Rename symbol'
    }
  ];

  register(): void {
    this.connection_handlers.set('renamed', this.handleRename.bind(this));
    super.register();
  }

  protected handleRename(workspaceEdit: lsProtocol.WorkspaceEdit) {
    console.log(workspaceEdit);
    let current_uri = this.connection.getDocumentUri();
    // Specs: documentChanges are preferred over changes
    let changes = workspaceEdit.documentChanges
      ? workspaceEdit.documentChanges.map(
          change => change as lsProtocol.TextDocumentEdit
        )
      : toDocumentChanges(workspaceEdit.changes);
    for (let change of changes) {
      let uri = change.textDocument.uri;
      if (uri !== current_uri) {
        console.warn('Workspace-wide rename not implemented yet');
      } else {
        // TODO: show "Renamed X to Y in {change.edits.length} places" in statusbar;
        for (let edit of change.edits) {
          let start = PositionConverter.lsp_to_cm(edit.range.start);
          let end = PositionConverter.lsp_to_cm(edit.range.end);

          let start_editor = this.virtual_document.get_editor_at_virtual_line(
            start as IVirtualPosition
          );
          let end_editor = this.virtual_document.get_editor_at_virtual_line(
            end as IVirtualPosition
          );
          if (start_editor !== end_editor) {
            console.log('Rename not implemented for notebooks yet');
          } else {
            let doc = start_editor.getDoc();
            doc.replaceRange(edit.newText, start, end);
          }
        }
      }
    }
  }
}
