// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { Notebook } from '@jupyterlab/notebook';
import { ArrayExt } from '@phosphor/algorithm';

/**
 * Ensure that the notebook has proper focus.
 */
function _ensureFocus(notebook: Notebook, force = false): void {
  let activeCell = notebook.activeCell;
  if (notebook.mode === 'edit' && activeCell) {
    if (!activeCell.editor.hasFocus()) {
      activeCell.editor.focus();
    }
  }
  if (force && !notebook.node.contains(document.activeElement)) {
    notebook.node.focus();
  }
}

/**
 * The class name added to notebook widget cells.
 */
const NB_CELL_CLASS = 'jp-Notebook-cell';

/**
 * Find the cell index containing the target html element.
 *
 * #### Notes
 * Returns -1 if the cell is not found.
 */
function _findCell(notebook: Notebook, node: HTMLElement): number {
  // Trace up the DOM hierarchy to find the root cell node.
  // Then find the corresponding child and select it.
  while (node && node !== notebook.node) {
    if (node.classList.contains(NB_CELL_CLASS)) {
      let i = ArrayExt.findFirstIndex(
        notebook.widgets,
        widget => widget.node === node
      );
      if (i !== -1) {
        return i;
      }
      break;
    }
    node = node.parentElement;
  }
  return -1;
}

function _findTargetCell(notebook: Notebook, event: MouseEvent) {
  let target = event.target as HTMLElement;
  let index = _findCell(notebook, target);
  if (index === -1) {
    // `event.target` sometimes gives an orphaned node in
    // Firefox 57, which can have `null` anywhere in its parent line. If we fail
    // to find a cell using `event.target`, try again using a target
    // reconstructed from the position of the click event.
    target = document.elementFromPoint(
      event.clientX,
      event.clientY
    ) as HTMLElement;
    index = _findCell(notebook, target);
  }
  return { target: target, index: index };
}

export { _ensureFocus, _findCell, _findTargetCell };
