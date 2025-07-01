import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ILSPCodeExtractorsManager } from '@jupyterlab/lsp';
import { ISettingRegistry } from '@jupyterlab/settingregistry';

import { CustomTransclusionsManager } from './manager';
import { PLUGIN_ID, ILSPCustomTransclusionsManager } from './tokens';

export const SETTINGS_TRANSCLUSIONS: JupyterFrontEndPlugin<ILSPCustomTransclusionsManager> =
  {
    id: PLUGIN_ID,
    autoStart: true,
    requires: [ISettingRegistry, ILSPCodeExtractorsManager],
    activate: (
      app: JupyterFrontEnd,
      settingsRegistry: ISettingRegistry,
      extractorsManager: ILSPCodeExtractorsManager
    ): ILSPCustomTransclusionsManager => {
      const options = { settingsRegistry, extractorsManager };
      const manager = new CustomTransclusionsManager(options);
      void manager.initialize().catch(console.warn);
      return manager;
    }
  };
