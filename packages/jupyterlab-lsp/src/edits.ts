import {
  IVirtualPosition,
  offsetAtPosition,
  WidgetLSPAdapter,
  Document,
  IPosition
} from '@jupyterlab/lsp';
import type * as lsProtocol from 'vscode-languageserver-protocol';

import { PositionConverter } from './converter';
import { DefaultMap, uris_equal } from './utils';
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
    let current_uri = this.virtualDocument.documentInfo.uri;

    // Specs: documentChanges are preferred over changes
    let changes = workspaceEdit.documentChanges
      ? workspaceEdit.documentChanges.map(
          change => change as lsProtocol.TextDocumentEdit
        )
      : toDocumentChanges(workspaceEdit.changes!);
    let applied_changes = 0;
    let edited_cells: number = 0;
    let _isWholeDocumentEdit: boolean = false;
    let errors: string[] = [];

    for (let change of changes) {
      let uri = change.textDocument.uri;

      if (!uris_equal(uri, current_uri)) {
        errors.push(
          `Workspace-wide edits not implemented: ${uri} != ${current_uri}`
        );
      } else {
        _isWholeDocumentEdit =
          change.edits.length === 1 &&
          this._isWholeDocumentEdit(change.edits[0]);

        let edit: lsProtocol.TextEdit;

        if (!_isWholeDocumentEdit) {
          applied_changes = 0;
          let value = this.virtualDocument.value;
          // TODO: make sure that it was not changed since the request was sent (using the returned document version)
          let lines = value.split('\n');

          let edits_by_offset = new Map<number, lsProtocol.TextEdit>();
          for (let e of change.edits) {
            let offset = offsetFromLsp(e.range.start, lines);
            if (edits_by_offset.has(offset)) {
              console.warn(
                'Edits should not overlap, ignoring an overlapping edit'
              );
            } else {
              edits_by_offset.set(offset, e);
              applied_changes += 1;
            }
          }

          // TODO make use of old_to_new_line for edits which add of remove lines:
          //  this is crucial to preserve cell boundaries in notebook in such cases
          let old_to_new_line = new DefaultMap<number, number[]>(() => []);
          let new_text = '';
          let last_end = 0;
          let current_old_line = 0;
          let current_new_line = 0;
          // going over the edits in descending order of start points:
          let start_offsets = [...edits_by_offset.keys()].sort((a, b) => a - b);
          for (let start of start_offsets) {
            let edit = edits_by_offset.get(start)!;
            let prefix = value.slice(last_end, start);
            for (let i = 0; i < prefix.split('\n').length; i++) {
              let new_lines = old_to_new_line.get_or_create(current_old_line);
              new_lines.push(current_new_line);
              current_old_line += 1;
              current_new_line += 1;
            }
            new_text += prefix + edit.newText;
            let end = offsetFromLsp(edit.range.end, lines);
            let replaced_fragment = value.slice(start, end);
            for (let i = 0; i < edit.newText.split('\n').length; i++) {
              if (i < replaced_fragment.length) {
                current_old_line += 1;
              }
              current_new_line += 1;
              let new_lines = old_to_new_line.get_or_create(current_old_line);
              new_lines.push(current_new_line);
            }
            last_end = end;
          }
          new_text += value.slice(last_end, value.length);

          edit = {
            range: {
              start: { line: 0, character: 0 },
              end: {
                line: lines.length - 1,
                character: lines[lines.length - 1].length
              }
            },
            newText: new_text
          };
          console.assert(this._isWholeDocumentEdit(edit));
        } else {
          edit = change.edits[0];
          applied_changes += 1;
        }
        edited_cells = this._applySingleEdit(edit);
      }
    }
    const all_empty = changes.every(change => change.edits.length === 0);
    return {
      appliedChanges: applied_changes,
      modifiedCells: edited_cells,
      wasGranular: !_isWholeDocumentEdit && !all_empty,
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
    fragment_start: IPosition,
    fragment_end: IPosition,
    start: IPosition,
    end: IPosition,
    _isWholeDocumentEdit = false
  ): number {
    let document = this.virtualDocument;
    let newFragmentText = newText
      .split('\n')
      .slice(fragment_start.line - start.line, fragment_end.line - start.line)
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
    let old_value = lines.join('\n');

    if (_isWholeDocumentEdit) {
      // partial edit
      let cm_to_ce = PositionConverter.cm_to_ce;
      let up_to_offset = offsetAtPosition(cm_to_ce(start), lines);
      let from_offset = offsetAtPosition(cm_to_ce(end), lines);
      newFragmentText =
        old_value.slice(0, up_to_offset) +
        newText +
        old_value.slice(from_offset);
    }

    if (old_value === newFragmentText) {
      return 0;
    }

    let newValue = document.decodeCodeBlock(newFragmentText);

    const cursor = editor.getCursorPosition();

    model.sharedModel.updateSource(
      editor.getOffsetAt({ line: 0, column: 0 }),
      editor.getOffsetAt({
        line: fragment_end.line - fragment_start.line + 1,
        column: 0
      }),
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
    let applied_changes = 0;
    let start = PositionConverter.lsp_to_cm(edit.range.start);
    let end = PositionConverter.lsp_to_cm(edit.range.end);

    let start_editor = document.getEditorAtVirtualLine(
      start as IVirtualPosition
    );
    let end_editor = document.getEditorAtVirtualLine(end as IVirtualPosition);
    if (start_editor !== end_editor) {
      let last_editor = start_editor;
      let fragment_start = start;
      let fragment_end = { ...start };

      let line = start.line;
      let recently_replaced = false;
      while (line <= end.line) {
        line++;
        let editor = document.getEditorAtVirtualLine({
          line: line,
          ch: 0
        } as IVirtualPosition);

        if (editor === last_editor) {
          fragment_end.line = line;
          fragment_end.ch = 0;
          recently_replaced = false;
        } else {
          applied_changes += this._replaceFragment(
            edit.newText,
            last_editor,
            fragment_start,
            fragment_end,
            start,
            end
          );
          recently_replaced = true;
          fragment_start = {
            line: line,
            ch: 0
          };
          fragment_end = {
            line: line,
            ch: 0
          };
          last_editor = editor;
        }
      }
      if (!recently_replaced) {
        applied_changes += this._replaceFragment(
          edit.newText,
          last_editor,
          fragment_start,
          fragment_end,
          start,
          end
        );
      }
    } else {
      applied_changes += this._replaceFragment(
        edit.newText,
        start_editor,
        start,
        end,
        start,
        end
      );
    }
    return applied_changes;
  }
}
