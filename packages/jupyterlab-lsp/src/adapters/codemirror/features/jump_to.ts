import { CodeMirrorLSPFeature, IFeatureCommand } from '../feature';
import * as lsProtocol from 'vscode-languageserver-protocol';
import { PositionConverter } from '../../../converter';
import { IVirtualPosition } from '../../../positioning';
import { InputDialog } from '@jupyterlab/apputils';
import { uri_to_contents_path, uris_equal } from '../../../utils';

export class JumpToDefinition extends CodeMirrorLSPFeature {
  name = 'JumpToDefinition';
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

  async do_jump(location: lsProtocol.Location) {
    let uri: string = decodeURI(location.uri);
    let current_uri = this.connection.getDocumentUri();

    let virtual_position = PositionConverter.lsp_to_cm(
      location.range.start
    ) as IVirtualPosition;

    if (uris_equal(uri, current_uri)) {
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

      // can it be resolved vs our guessed server root?
      const contents_path = uri_to_contents_path(uri);

      if (contents_path) {
        uri = contents_path;
      } else if (uri.startsWith('file://')) {
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

      try {
        await this.jumper.document_manager.services.contents.get(uri, {
          content: false
        });
        this.jumper.global_jump({ uri, ...jump_data }, false);
        return;
      } catch (err) {
        console.warn(err);
      }

      this.jumper.global_jump(
        { uri: '.lsp_symlink/' + uri, ...jump_data },
        true
      );
    }
  }

  async handle_jump(locations: lsProtocol.Location[]) {
    if (locations.length === 0) {
      console.log('No jump targets found');
      return;
    }
    if (locations.length > 1) {
      let location_by_id = new Map<string, lsProtocol.Location>();
      let getItemOptions = {
        title: 'Choose the jump target',
        okLabel: 'Jump',
        items: locations.map(location => {
          // TODO: extract the line, the line above and below, and show it;
          //  also, strip the server from the location.
          let id = location.uri + ', line: ' + location.range.start.line;
          location_by_id.set(id, location);
          return id;
        })
      };
      // TODO: use showHints() or completion-like widget instead?
      InputDialog.getItem(getItemOptions)
        .then(choice => {
          this.do_jump(location_by_id.get(choice.value)).catch(console.warn);
        })
        .catch(console.warn);
    } else {
      this.do_jump(locations[0]).catch(console.warn);
    }
  }
}
