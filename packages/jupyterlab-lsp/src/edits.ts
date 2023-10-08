import {
  IVirtualPosition,
  offsetAtPosition,
  WidgetLSPAdapter,
  Document,
  IPosition
} from '@jupyterlab/lsp';
import type * as lsProtocol from 'vscode-languageserver-protocol';

import { PositionConverter } from './converter';
import { DefaultMap, urisEqual } from './utils';
import { VirtualDocument } from './virtual/document';

export interface IEditOutcome {
  appliedChanges: number | null;
  modifiedCells: number;
  wasGranular: boolean;
  errors: string[];
}

function offsetFromLsp(position: lsProtocol.Position, lines: string[]) {
  return offsetAtPosition(PositionConverter.lsp_to_ce(position), lines);
}

function toDocumentChanges(changes: {
  [uri: string]: lsProtocol.TextEdit[];
}): lsProtocol.TextDocumentEdit[] {
  let documentChanges = [];
  for (let uri of Object.keys(changes)) {
    documentChanges.push({
      textDocument: { uri },
      edits: changes[uri]
    } as lsProtocol.TextDocumentEdit);
  }
  return documentChanges;
}

export class EditApplicator {
  constructor(
    protected virtualDocument: VirtualDocument,
    protected adapter: WidgetLSPAdapter<any>
  ) {
    // no-op
  }

  async applyEdit(
    workspaceEdit: lsProtocol.WorkspaceEdit
  ): Promise<IEditOutcome> {
    let currentUri = this.virtualDocument.documentInfo.uri;

    // Specs: documentChanges are preferred over changes
    let changes = workspaceEdit.documentChanges
      ? workspaceEdit.documentChanges.map(
          change => change as lsProtocol.TextDocumentEdit
        )
      : toDocumentChanges(workspaceEdit.changes!);
    let appliedChanges = 0;
    let editedCells: number = 0;
    let isWholeDocumentEdit: boolean = false;
    let errors: string[] = [];

    for (let change of changes) {
      let uri = change.textDocument.uri;

      if (!urisEqual(uri, currentUri)) {
        errors.push(
          `Workspace-wide edits not implemented: ${uri} != ${currentUri}`
        );
      } else {
        isWholeDocumentEdit =
          change.edits.length === 1 &&
          this._isWholeDocumentEdit(change.edits[0]);

        let edit: lsProtocol.TextEdit;

        if (!isWholeDocumentEdit) {
          appliedChanges = 0;
          let value = this.virtualDocument.value;
          // TODO: make sure that it was not changed since the request was sent (using the returned document version)
          let lines = value.split('\n');

          let editsByOffset = new Map<number, lsProtocol.TextEdit>();
          for (let e of change.edits) {
            let offset = offsetFromLsp(e.range.start, lines);
            if (editsByOffset.has(offset)) {
              console.warn(
                'Edits should not overlap, ignoring an overlapping edit'
              );
            } else {
              editsByOffset.set(offset, e);
              appliedChanges += 1;
            }
          }

          // TODO make use of oldToNewLine for edits which add of remove lines:
          //  this is crucial to preserve cell boundaries in notebook in such cases
          let oldToNewLine = new DefaultMap<number, number[]>(() => []);
          let newText = '';
          let lastEnd = 0;
          let currentOldLine = 0;
          let currentNewLine = 0;
          // going over the edits in descending order of start points:
          let startOffsets = [...editsByOffset.keys()].sort((a, b) => a - b);
          for (let start of startOffsets) {
            let edit = editsByOffset.get(start)!;
            let prefix = value.slice(lastEnd, start);
            for (let i = 0; i < prefix.split('\n').length; i++) {
              let newLines = oldToNewLine.getOrCreate(currentOldLine);
              newLines.push(currentNewLine);
              currentOldLine += 1;
              currentNewLine += 1;
            }
            newText += prefix + edit.newText;
            let end = offsetFromLsp(edit.range.end, lines);
            let replacedFragment = value.slice(start, end);
            for (let i = 0; i < edit.newText.split('\n').length; i++) {
              if (i < replacedFragment.length) {
                currentOldLine += 1;
              }
              currentNewLine += 1;
              let newLines = oldToNewLine.getOrCreate(currentOldLine);
              newLines.push(currentNewLine);
            }
            lastEnd = end;
          }
          newText += value.slice(lastEnd, value.length);

          edit = {
            range: {
              start: { line: 0, character: 0 },
              end: {
                line: lines.length - 1,
                character: lines[lines.length - 1].length
              }
            },
            newText: newText
          };
          console.assert(this._isWholeDocumentEdit(edit));
        } else {
          edit = change.edits[0];
          appliedChanges += 1;
        }
        editedCells = this._applySingleEdit(edit);
      }
    }
    const allEmpty = changes.every(change => change.edits.length === 0);
    return {
      appliedChanges: appliedChanges,
      modifiedCells: editedCells,
      wasGranular: !isWholeDocumentEdit && !allEmpty,
      errors: errors
    };
  }

  /**
   * Does the edit cover the entire document?
   */
  private _isWholeDocumentEdit(edit: lsProtocol.TextEdit) {
    let value = this.virtualDocument.value;
    let lines = value.split('\n');
    let range = edit.range;
    let lsp_to_ce = PositionConverter.lsp_to_ce;
    return (
      offsetAtPosition(lsp_to_ce(range.start), lines) === 0 &&
      offsetAtPosition(lsp_to_ce(range.end), lines) === value.length
    );
  }

  private _replaceFragment(
    newText: string,
    editorAccessor: Document.IEditor,
    fragmentStart: IPosition,
    fragmentEnd: IPosition,
    start: IPosition,
    end: IPosition,
    isWholeDocumentEdit = false
  ): number {
    let document = this.virtualDocument;
    let newFragmentText = newText
      .split('\n')
      .slice(fragmentStart.line - start.line, fragmentEnd.line - start.line)
      .join('\n');

    if (newFragmentText.endsWith('\n')) {
      newFragmentText = newFragmentText.slice(0, -1);
    }

    const editor = editorAccessor.getEditor();
    if (!editor) {
      throw Error('Editor is not accessible');
    }
    // TODO: should accessor present the model even if editor is not created yet?
    const model = editor.model;

    let rawValue = model.sharedModel.source;
    // extract foreign documents and substitute magics,
    // as it was done when the shadow virtual document was being created
    let { lines } = document.prepareCodeBlock({
      value: rawValue,
      ceEditor: editorAccessor,
      type: 'code'
    });
    let oldValue = lines.join('\n');

    if (isWholeDocumentEdit) {
      // partial edit
      let cm_to_ce = PositionConverter.cm_to_ce;
      let upToOffset = offsetAtPosition(cm_to_ce(start), lines);
      let fromOffset = offsetAtPosition(cm_to_ce(end), lines);
      newFragmentText =
        oldValue.slice(0, upToOffset) + newText + oldValue.slice(fromOffset);
    }

    if (oldValue === newFragmentText) {
      return 0;
    }

    let newValue = document.decodeCodeBlock(newFragmentText);

    const cursor = editor.getCursorPosition();

    model.sharedModel.updateSource(
      editor.getOffsetAt({ line: 0, column: 0 }),
      oldValue.length,
      newValue
    );

    try {
      // try to restore the cursor to the position prior to the edit
      // (this might not be the best UX, but definitely better than
      // the cursor jumping to the very end of the cell/file).
      editor.setSelection({ start: cursor, end: cursor });
      // note: this does not matter for actions invoke from context menu
      // as those loose focus anyways (this might be addressed elsewhere)
    } catch (e) {
      console.log('Could not place the cursor back', e);
    }

    return 1;
  }

  private _applySingleEdit(edit: lsProtocol.TextEdit): number {
    let document = this.virtualDocument;
    let appliedChanges = 0;
    let start = PositionConverter.lsp_to_cm(edit.range.start);
    let end = PositionConverter.lsp_to_cm(edit.range.end);

    let startEditor = document.getEditorAtVirtualLine(
      start as IVirtualPosition
    );
    let endEditor = document.getEditorAtVirtualLine(end as IVirtualPosition);
    if (startEditor !== endEditor) {
      let lastEditor = startEditor;
      let fragmentStart = start;
      let fragmentEnd = { ...start };

      let line = start.line;
      let recentlyReplaced = false;
      while (line <= end.line) {
        line++;
        let editor = document.getEditorAtVirtualLine({
          line: line,
          ch: 0
        } as IVirtualPosition);

        if (editor === lastEditor) {
          fragmentEnd.line = line;
          fragmentEnd.ch = 0;
          recentlyReplaced = false;
        } else {
          appliedChanges += this._replaceFragment(
            edit.newText,
            lastEditor,
            fragmentStart,
            fragmentEnd,
            start,
            end
          );
          recentlyReplaced = true;
          fragmentStart = {
            line: line,
            ch: 0
          };
          fragmentEnd = {
            line: line,
            ch: 0
          };
          lastEditor = editor;
        }
      }
      if (!recentlyReplaced) {
        appliedChanges += this._replaceFragment(
          edit.newText,
          lastEditor,
          fragmentStart,
          fragmentEnd,
          start,
          end
        );
      }
    } else {
      appliedChanges += this._replaceFragment(
        edit.newText,
        startEditor,
        start,
        end,
        start,
        end
      );
    }
    return appliedChanges;
  }
}
