import { VirtualEditor } from '../editor';
import { CodeMirror } from '../../adapters/codemirror';

export class VirtualFileEditor extends VirtualEditor {
  protected cm_editor: CodeMirror.Editor;

  constructor(language: string, cm_editor: CodeMirror.Editor) {
    // TODO: for now the magics and extractors are not used in FileEditor,
    //  although it would make sense to pass extractors (e.g. for CSS in HTML,
    //  or SQL in Python files) in the future.
    super(language, {}, {});
    this.cm_editor = cm_editor;
    let handler = {
      get: function(
        target: VirtualFileEditor,
        prop: keyof CodeMirror.Editor,
        receiver: any
      ) {
        if (prop in cm_editor) {
          return cm_editor[prop];
        } else {
          return Reflect.get(target, prop, receiver);
        }
      }
    };
    return new Proxy(this, handler);
  }

  // duck typing: to enable use of notebook mapper
  public get transform(): (
    position: CodeMirror.Position
  ) => CodeMirror.Position {
    return position => position;
  }

  public get_editor_index(position: CodeMirror.Position): number {
    return 0;
  }

  public get get_cell_id(): (position: CodeMirror.Position) => string {
    return position => '';
  }

  get_cm_editor(position: CodeMirror.Position): CodeMirror.Editor {
    return undefined;
  }
}
