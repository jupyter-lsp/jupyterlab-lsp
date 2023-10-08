import { JupyterFrontEndPlugin } from '@jupyterlab/application';
import { ILSPCodeExtractorsManager } from '@jupyterlab/lsp';

import { ILSPCodeOverridesManager } from '../../overrides/tokens';
import { PLUGIN_ID } from '../../tokens';

import { foreignCodeExtractors } from './extractors';
import { overrides } from './overrides';

export const IPYTHON_TRANSCLUSIONS: JupyterFrontEndPlugin<void> = {
  id: PLUGIN_ID + ':ipython',
  requires: [ILSPCodeExtractorsManager, ILSPCodeOverridesManager],
  activate: (
    app,
    extractorsManager: ILSPCodeExtractorsManager,
    overrideManager: ILSPCodeOverridesManager
  ) => {
    for (let language of Object.keys(foreignCodeExtractors)) {
      for (let extractor of foreignCodeExtractors[language]) {
        extractorsManager.register(extractor, language);
      }
    }
    for (let override of overrides) {
      overrideManager.register(override, 'python');
    }
  },
  autoStart: true
};
