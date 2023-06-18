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
    extractors_manager: ILSPCodeExtractorsManager,
    overrides_manager: ILSPCodeOverridesManager
  ) => {
    for (let language of Object.keys(foreignCodeExtractors)) {
      for (let extractor of foreignCodeExtractors[language]) {
        extractors_manager.register(extractor, language);
      }
    }
    for (let override of overrides) {
      overrides_manager.register(override, 'python');
    }
  },
  autoStart: true
};
