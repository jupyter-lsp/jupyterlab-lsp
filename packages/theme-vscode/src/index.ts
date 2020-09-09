import { JupyterFrontEndPlugin } from '@jupyterlab/application';

import { ILSPCompletionThemeManager } from '@krassowski/completion-theme/lib/types';

import '../style/completer.css';

export const plugin: JupyterFrontEndPlugin<void> = {
  id: '@krassowski/theme-vscode',
  requires: [ILSPCompletionThemeManager],
  activate: (app, completionThemeManager: ILSPCompletionThemeManager) => {
    completionThemeManager.register_theme({
      id: 'vscode',
      name: 'VSCode',
      icons: {
        license: {
          name: 'Creative Commons Attribution 4.0 International Public License',
          spdx: 'CC-BY-4.0',
          licensor: 'Microsoft',
          modifications: 'Added JupyterLab icon classes',
          url: 'https://github.com/microsoft/vscode-icons/blob/master/LICENSE'
        },
        svg: async () =>
          (await import(/* webpackChunkName: "theme-vscode" */ './icons'))
            .iconSet
      }
    });
  },
  autoStart: true
};

export default plugin;
