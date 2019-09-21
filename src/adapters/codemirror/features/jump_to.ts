import { CodeMirrorLSPFeature, IFeatureCommand } from '../feature';

export class JumpToDefinition extends CodeMirrorLSPFeature {
  static commands: Array<IFeatureCommand> = [
    {
      id: 'jump_to_definition',
      execute: ({ connection, virtual_position }) =>
        connection.getDefinition(virtual_position),
      is_enabled: ({ connection }) => connection.isDefinitionSupported(),
      label: 'Jump to definition'
    }
  ];
}
