import { LabIcon } from '@jupyterlab/ui-components';
import { MainAreaWidget, ICommandPalette } from '@jupyterlab/apputils';
import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { ICompletionManager } from '@jupyterlab/completer';

import { ILSPCompletionThemeManager } from '@krassowski/completion-theme/lib/types';

import { FeatureSettings } from '../../feature';
import { CodeCompletion } from '../../_completion';

import {
  ILSPAdapterManager,
  ILSPFeatureManager,
  PLUGIN_ID
} from '../../tokens';

import { LSP_CATEGORY } from '../../command_manager';

import { CompletionCM, CompletionLabIntegration } from './completion';

// style imports
import '../../../style/completion.css';
import completionSvg from '../../../style/icons/completion.svg';

export const completionIcon = new LabIcon({
  name: 'lsp:completion',
  svgstr: completionSvg
});

const FEATURE_ID = PLUGIN_ID + ':completion';

export namespace CommandIds {
  export const configure = 'lsp:show-completion-config';
  export const setTheme = 'lsp:set-completion-theme';
}

export const COMPLETION_PLUGIN: JupyterFrontEndPlugin<void> = {
  id: FEATURE_ID,
  requires: [
    ICommandPalette,
    ISettingRegistry,
    ICompletionManager,
    ILSPFeatureManager,
    ILSPAdapterManager,
    ILSPCompletionThemeManager
  ],
  autoStart: true,
  activate: (
    app: JupyterFrontEnd,
    commandPalette: ICommandPalette,
    settingRegistry: ISettingRegistry,
    completionManager: ICompletionManager,
    featureManager: ILSPFeatureManager,
    adapterManager: ILSPAdapterManager,
    iconsThemeManager: ILSPCompletionThemeManager
  ) => {
    const settings = new FeatureSettings<CodeCompletion>(
      settingRegistry,
      FEATURE_ID
    );
    const labIntegration = new CompletionLabIntegration(
      app,
      completionManager,
      settings,
      adapterManager,
      iconsThemeManager
    );

    featureManager.register({
      feature: {
        editorIntegrationFactory: new Map([['CodeMirrorEditor', CompletionCM]]),
        id: FEATURE_ID,
        name: 'LSP Completion',
        labIntegration: labIntegration,
        settings: settings
      }
    });

    // commands
    app.commands.addCommand(CommandIds.setTheme, {
      execute: (args: Partial<CodeCompletion>) =>
        settings.set('theme', args.theme)
    });

    const label = 'Code Completion Settings';
    app.commands.addCommand(CommandIds.configure, {
      label,
      execute: async () => {
        const { Configurer } = await import('./config');
        const model = new Configurer.Model();
        model.iconsThemeManager = iconsThemeManager;
        model.settings = settings;
        const content = new Configurer(model);
        const main = new MainAreaWidget({ content });
        main.title.label = label;
        main.title.icon = completionIcon;
        app.shell.add(main);
      }
    });

    commandPalette.addItem({
      category: LSP_CATEGORY,
      command: CommandIds.configure
    });
  }
};
