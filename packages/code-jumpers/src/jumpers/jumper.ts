import { Dialog, showDialog } from '@jupyterlab/apputils';
import { CodeEditor } from '@jupyterlab/codeeditor';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { IDocumentWidget } from '@jupyterlab/docregistry';
import { FileEditor } from '@jupyterlab/fileeditor';

import { JumpHistory } from '../history';
import { IGlobalPosition, ILocalPosition } from '../positions';

import IEditor = CodeEditor.IEditor;

const movement_keys = [
  'ArrowRight',
  'ArrowLeft',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
  'PageUp',
  'PageDown'
];

const modifiers = ['Alt', 'AltGraph', 'Control', 'Shift'];

const system_keys = [
  'F1',
  'F2',
  'F3',
  'F4',
  'F5',
  'F6',
  'F7',
  'F8',
  'F9',
  'F10',
  'F11',
  'F12',
  'ContextMenu'
];

export abstract class CodeJumper {
  document_manager: IDocumentManager;
  widget: IDocumentWidget;

  history: JumpHistory;

  abstract get editors(): ReadonlyArray<CodeEditor.IEditor>;

  private go_to_position(
    document_widget: IDocumentWidget,
    jumper: string,
    column: number,
    line_number: number,
    input_number = 0
  ) {
    let document_jumper: CodeJumper;
    let position = { line: line_number, column: column };
    let document_jumper_type = jumpers.get(jumper);

    document_jumper = new document_jumper_type(
      document_widget,
      this.document_manager
    );
    let jump_position = document_jumper.getJumpPosition(position, input_number);
    document_jumper.jump(jump_position);
  }

  private _global_jump(position: IGlobalPosition) {
    let document_widget = this.document_manager.openOrReveal(
      position.contents_path
    );
    let is_symlink = position.is_symlink;

    document_widget.revealed
      .then(() => {
        this.go_to_position(
          document_widget,
          position.contents_path.endsWith('.ipynb') ? 'notebook' : 'fileeditor',
          position.column,
          position.line,
          position.editor_index
        );

        // protect external files from accidental edition
        if (is_symlink) {
          this.protectFromAccidentalEditing(document_widget);
        }
      })
      .catch(console.warn);
  }

  private protectFromAccidentalEditing(document_widget: IDocumentWidget) {
    let editor_widget = document_widget as IDocumentWidget<FileEditor>;
    // We used to adjust `editor_widget.title.label` here but an upstream
    // bug (https://github.com/jupyterlab/jupyterlab/issues/10856) prevents
    // us from doing so anymore.
    let editor = editor_widget.content.editor;
    let disposable = editor.addKeydownHandler(
      (editor: IEditor, event: KeyboardEvent) => {
        // allow to move around, select text and use modifiers & browser keys freely
        if (
          movement_keys.indexOf(event.key) !== -1 ||
          modifiers.indexOf(event.key) !== -1 ||
          system_keys.indexOf(event.key) !== -1
        ) {
          return false;
        }

        // allow to copy text (here assuming that, as on majority of OSs, copy is associated with ctrl+c)
        // this is not foolproof, but should work in majority of sane settings (unfortunately, not in vim)
        if (event.key === 'c' && event.ctrlKey) {
          return false;
        }

        let dialog_promise = showDialog({
          title: 'Edit external file?',
          body:
            'This file is located outside of the root of the JupyterLab start directory. ' +
            'do you really wish to edit it?',
          buttons: [
            Dialog.cancelButton({ label: 'Cancel' }),
            Dialog.warnButton({ label: 'Edit anyway' })
          ]
        });

        dialog_promise
          .then(result => {
            if (result.button.accept) {
              disposable.dispose();
            }
          })
          .catch(console.warn);

        // prevent default
        return true;
      }
    );
  }

  protected abstract jump(position: ILocalPosition): void;

  global_jump_back() {
    let previous_position = this.history.recollect();
    if (previous_position) {
      this._global_jump(previous_position);
    }
  }

  global_jump(position: IGlobalPosition) {
    const current_position = this.getCurrentPosition();
    this.history.store(current_position);
    this._global_jump(position);
  }

  abstract getCurrentPosition(): IGlobalPosition;

  abstract getOffset(position: CodeEditor.IPosition, cell?: number): number;

  abstract getJumpPosition(
    position: CodeEditor.IPosition,
    input_number?: number
  ): ILocalPosition;
}

export let jumpers: Map<string, any> = new Map();
