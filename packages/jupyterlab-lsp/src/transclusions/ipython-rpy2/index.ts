import { JupyterFrontEndPlugin } from '@jupyterlab/application';
import { ILSPCodeExtractorsManager } from '@jupyterlab/lsp';

import { ILSPCodeOverridesManager } from '../../overrides/tokens';
import { PLUGIN_ID } from '../../tokens';

import { foreignCodeExtractors } from './extractors';
import { overrides } from './overrides';

export const IPYTHON_RPY2_TRANSCLUSIONS: JupyterFrontEndPlugin<void> = {
  id: PLUGIN_ID + ':ipython-rpy2',
  requires: [ILSPCodeExtractorsManager, ILSPCodeOverridesManager],
  activate: (
    app,
    extractorsMmanager: ILSPCodeExtractorsManager,
    overridesManager: ILSPCodeOverridesManager
  ) => {
    for (let language of Object.keys(foreignCodeExtractors)) {
      for (let extractor of foreignCodeExtractors[language]) {
        extractorsMmanager.register(extractor, language);
      }
    }
    for (let override of overrides) {
      overridesManager.register(override, 'python');
    }
  },
  autoStart: true
};
