import { EditorView } from '@codemirror/view';
import { Dialog, showDialog } from '@jupyterlab/apputils';
import { CodeEditor } from '@jupyterlab/codeeditor';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { IDocumentWidget } from '@jupyterlab/docregistry';
import { FileEditor } from '@jupyterlab/fileeditor';

import { JumpHistory } from '../history';
import { IGlobalPosition, ILocalPosition } from '../positions';

const movementKeys = [
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

const systemKeys = [
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
  documentManager: IDocumentManager;
  widget: IDocumentWidget;

  history: JumpHistory;

  abstract get editors(): ReadonlyArray<CodeEditor.IEditor>;

  private goToPosition(
    documentWidget: IDocumentWidget,
    jumper: string,
    column: number,
    lineNumber: number,
    inputNumber = 0
  ) {
    let documentJumper: CodeJumper;
    let position = { line: lineNumber, column: column };
    let documentJumperType = jumpers.get(jumper);

    documentJumper = new documentJumperType(
      documentWidget,
      this.documentManager
    );
    let jumpPosition = documentJumper.getJumpPosition(position, inputNumber);
    documentJumper.jump(jumpPosition);
  }

  private _globalJump(position: IGlobalPosition) {
    let documentWidget = this.documentManager.openOrReveal(
      position.contentsPath
    );
    if (!documentWidget) {
      console.log('Widget failed to open for jump');
      return;
    }
    let isSymlink = position.isSymlink;

    documentWidget.revealed
      .then(() => {
        this.goToPosition(
          documentWidget!,
          position.contentsPath.endsWith('.ipynb') ? 'notebook' : 'fileeditor',
          position.column,
          position.line,
          position.editorIndex
        );

        // protect external files from accidental edition
        if (isSymlink) {
          this.protectFromAccidentalEditing(documentWidget!);
        }
      })
      .catch(console.warn);
  }

  private protectFromAccidentalEditing(documentWidget: IDocumentWidget) {
    let editorWidget = documentWidget as IDocumentWidget<FileEditor>;
    // We used to adjust `editorWidget.title.label` here but an upstream
    // bug (https://github.com/jupyterlab/jupyterlab/issues/10856) prevents
    // us from doing so anymore.
    let editor = editorWidget.content.editor;
    let active = true;
    editor.injectExtension(
      EditorView.domEventHandlers({
        keydown: (event: KeyboardEvent) => {
          if (!active) {
            return false;
          }
          // allow to move around, select text and use modifiers & browser keys freely
          if (
            movementKeys.indexOf(event.key) !== -1 ||
            modifiers.indexOf(event.key) !== -1 ||
            systemKeys.indexOf(event.key) !== -1
          ) {
            return false;
          }

          // allow to copy text (here assuming that, as on majority of OSs, copy is associated with ctrl+c)
          // this is not foolproof, but should work in majority of sane settings (unfortunately, not in vim)
          if (event.key === 'c' && event.ctrlKey) {
            return false;
          }

          let dialogPromise = showDialog({
            title: 'Edit external file?',
            body:
              'This file is located outside of the root of the JupyterLab start directory. ' +
              'do you really wish to edit it?',
            buttons: [
              Dialog.cancelButton({ label: 'Cancel' }),
              Dialog.warnButton({ label: 'Edit anyway' })
            ]
          });

          dialogPromise
            .then(result => {
              if (result.button.accept) {
                active = false;
              }
            })
            .catch(console.warn);

          // prevent default
          return true;
        }
      })
    );
  }

  protected abstract jump(position: ILocalPosition): void;

  globalJumpBack() {
    let previousPosition = this.history.recollect();
    if (previousPosition) {
      this._globalJump(previousPosition);
    }
  }

  globalJump(position: IGlobalPosition) {
    const currentPosition = this.getCurrentPosition();
    this.history.store(currentPosition);
    this._globalJump(position);
  }

  abstract getCurrentPosition(): IGlobalPosition;

  abstract getOffset(position: CodeEditor.IPosition, cell?: number): number;

  abstract getJumpPosition(
    position: CodeEditor.IPosition,
    inputNumber?: number
  ): ILocalPosition;
}

export let jumpers: Map<string, any> = new Map();
