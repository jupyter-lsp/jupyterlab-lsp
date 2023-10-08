import { JupyterFrontEndPlugin } from '@jupyterlab/application';
import { ILSPCodeExtractorsManager } from '@jupyterlab/lsp';

import { PLUGIN_ID } from '../../tokens';

import { foreignCodeExtractors } from './extractors';

/**
 * Implements extraction of code for IPython Magics for BigQuery, see:
 * https://googleapis.dev/python/bigquery/latest/magics.html.
 */
export const IPYTHON_BIGQUERY_TRANSCLUSIONS: JupyterFrontEndPlugin<void> = {
  id: PLUGIN_ID + ':ipython-bigquery',
  requires: [ILSPCodeExtractorsManager],
  activate: (app, extractorsManager: ILSPCodeExtractorsManager) => {
    for (let language of Object.keys(foreignCodeExtractors)) {
      for (let extractor of foreignCodeExtractors[language]) {
        extractorsManager.register(extractor, language);
      }
    }
  },
  autoStart: true
};
