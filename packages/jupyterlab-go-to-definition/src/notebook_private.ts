// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { Notebook } from '@jupyterlab/notebook';

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

export { _ensureFocus };
