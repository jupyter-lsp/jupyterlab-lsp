import { JupyterFrontEndPlugin } from '@jupyterlab/application';

import { ILSPCompletionThemeManager } from '@krassowski/completion-theme/lib/types';

import '../style/completer.css';

export const plugin: JupyterFrontEndPlugin<void> = {
  // while for now it only styles completion,
  // we may decide to allow styling of more
  // components, reusing these plugins.
  id: '@krassowski/theme-material',
  requires: [ILSPCompletionThemeManager],
  activate: (app, completionThemeManager: ILSPCompletionThemeManager) => {
    completionThemeManager.register_theme({
      id: 'material',
      name: 'Material Design',
      icons: {
        license: {
          name: 'SIL Open Font License 1.1',
          spdx: 'OFL-1.1',
          licensor: 'Austin Andrews and Google',
          modifications: 'Added JupyterLab icon classes',
          url:
            'https://github.com/Templarian/MaterialDesign/blob/master/LICENSE'
        },
        svg: async () =>
          (await import(/* webpackChunkName: "theme-material" */ './icons'))
            .iconSet
      }
    });
  },
  autoStart: true
};

export default plugin;
