import { JupyterFrontEndPlugin } from '@jupyterlab/application';
import { ILSPCodeExtractorsManager } from '@jupyterlab/lsp';

import { PLUGIN_ID } from '../../tokens';

import { foreignCodeExtractors } from './extractors';

/**
 * Implements extraction of code for ipython-sql, see:
 * https://github.com/catherinedevlin/ipython-sql.
 * No dedicated code overrides are provided (but the default IPython
 * overrides should prevent any syntax errors in the virtual documents)
 */
export const IPYTHON_SQL_TRANSCLUSIONS: JupyterFrontEndPlugin<void> = {
  id: PLUGIN_ID + ':ipython-sql',
  requires: [ILSPCodeExtractorsManager],
  activate: (app, extractors_manager: ILSPCodeExtractorsManager) => {
    for (let language of Object.keys(foreignCodeExtractors)) {
      for (let extractor of foreignCodeExtractors[language]) {
        extractors_manager.register(extractor, language);
      }
    }
  },
  autoStart: true
};
