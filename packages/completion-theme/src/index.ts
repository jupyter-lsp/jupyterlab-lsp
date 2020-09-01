import { JupyterFrontEndPlugin } from '@jupyterlab/application';

import { ILSPCompletionThemeManager, PLUGIN_ID } from './types';

import { CompletionThemeManager } from './manager';

import { defaultColorSchemes } from './schemes';

export const COMPLETION_THEME_MANAGER: JupyterFrontEndPlugin<ILSPCompletionThemeManager> = {
  id: PLUGIN_ID,
  activate: app => {
    let manager = new CompletionThemeManager();
    defaultColorSchemes.map(manager.register_color_scheme, manager);
    return manager;
  },
  provides: ILSPCompletionThemeManager,
  autoStart: true
};
