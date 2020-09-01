import { JupyterFrontEndPlugin } from '@jupyterlab/application';

import { ILSPCompletionThemeManager, PLUGIN_ID } from './types';

import { CompletionThemeManager } from './manager';

export const COMPLETION_THEME_MANAGER: JupyterFrontEndPlugin<ILSPCompletionThemeManager> = {
  id: PLUGIN_ID,
  activate: app => {
    let manager = new CompletionThemeManager();
    return manager;
  },
  provides: ILSPCompletionThemeManager,
  autoStart: true
};
