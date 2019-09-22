import * as lsProtocol from 'vscode-languageserver-protocol';
import { CodeMirrorLSPFeature, IFeatureCommand } from '../feature';
import { InputDialog } from '@jupyterlab/apputils';

export class Rename extends CodeMirrorLSPFeature {
  static commands: Array<IFeatureCommand> = [
    {
      id: 'rename-symbol',
      execute: ({ connection, virtual_position }) => {
        InputDialog.getText({ title: 'Rename to' }).then(value => {
          connection.rename(virtual_position, value.value);
        });
      },
      is_enabled: ({ connection }) => connection.isRenameSupported(),
      label: 'Rename symbol'
    }
  ];

  register(): void {
    this.connection_handlers.set('renamed', this.handleRename.bind(this));
  }

  protected handleRename(edit: lsProtocol.WorkspaceEdit) {
    // TODO: apply the edit as a change in the
    console.log(edit)
  }
}
