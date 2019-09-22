import { CodeMirrorLSPFeature, IFeatureCommand } from '../feature';
import * as lsProtocol from 'vscode-languageserver-protocol';
import { PositionConverter } from '../../../converter';
import { IVirtualPosition } from '../../../positioning';

export class JumpToDefinition extends CodeMirrorLSPFeature {
  static commands: Array<IFeatureCommand> = [
    {
      id: 'jump-to-definition',
      execute: ({ connection, virtual_position }) =>
        connection.getDefinition(virtual_position),
      is_enabled: ({ connection }) => connection.isDefinitionSupported(),
      label: 'Jump to definition'
    }
  ];

  register(): void {
    this.connection_handlers.set('goTo', this.handle_jump.bind(this));
    super.register();
  }

  get jumper() {
    return this.jupyterlab_components.jumper;
  }

  handle_jump(locations: lsProtocol.Location[]) {
    let connection = this.connection;

    // TODO: implement selector for multiple locations
    //  (like when there are multiple definitions or usages)
    //  could use the showHints() or completion frontend as a reference
    if (locations.length === 0) {
      console.log('No jump targets found');
      return;
    }
    console.log('Will jump to the first of suggested locations:', locations);

    let location = locations[0];

    let uri: string = decodeURI(location.uri);
    let current_uri = connection.getDocumentUri();

    let virtual_position = PositionConverter.lsp_to_cm(
      location.range.start
    ) as IVirtualPosition;

    if (uri === current_uri) {
      let editor_index = this.virtual_editor.get_editor_index(virtual_position);
      // if in current file, transform from the position within virtual document to the editor position:
      let editor_position = this.virtual_editor.transform_virtual_to_editor(
        virtual_position
      );
      let editor_position_ce = PositionConverter.cm_to_ce(editor_position);
      console.log(`Jumping to ${editor_index}th editor of ${uri}`);
      console.log('Jump target within editor:', editor_position_ce);
      this.jumper.jump({
        token: {
          offset: this.jumper.getOffset(editor_position_ce, editor_index),
          value: ''
        },
        index: editor_index
      });
    } else {
      // otherwise there is no virtual document and we expect the returned position to be source position:
      let source_position_ce = PositionConverter.cm_to_ce(virtual_position);
      console.log(`Jumping to external file: ${uri}`);
      console.log('Jump target (source location):', source_position_ce);

      if (uri.startsWith('file://')) {
        uri = uri.slice(7);
      }

      let jump_data = {
        editor_index: 0,
        line: source_position_ce.line,
        column: source_position_ce.column
      };

      // assume that we got a relative path to a file within the project
      // TODO use is_relative() or something? It would need to be not only compatible
      //  with different OSes but also with JupyterHub and other platforms.
      this.jumper.document_manager.services.contents
        .get(uri, { content: false })
        .then(() => {
          this.jumper.global_jump({ uri, ...jump_data }, false);
        })
        .catch(() => {
          // fallback to an absolute location using a symlink (will only work if manually created)
          this.jumper.global_jump(
            { uri: '.lsp_symlink/' + uri, ...jump_data },
            true
          );
        });
    }
  }
}
