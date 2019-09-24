import * as lsProtocol from 'vscode-languageserver-protocol';
import { CodeMirrorLSPFeature, IFeatureCommand } from '../feature';
import { InputDialog } from '@jupyterlab/apputils';
import { PositionConverter } from '../../../converter';
import { IVirtualPosition } from '../../../positioning';

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
    // TODO: apply the edit as a change in the CodeMirror editor (and then trigger document update?)
    console.log(workspaceEdit);
    let current_uri = this.connection.getDocumentUri();
    for (let change of workspaceEdit.documentChanges) {
      change = change as lsProtocol.TextDocumentEdit;
      if (change.textDocument.uri !== current_uri) {
        console.warn('Workspace-wide rename not implemented yet');
      } else {
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
