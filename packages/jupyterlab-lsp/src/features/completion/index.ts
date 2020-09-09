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

import { defaultColorSchemes } from './color_schemes';
import { defaultThemes } from './themes';

// style imports
import '../../../style/completion.css';
import completionSvg from '../../../style/icons/completion.svg';

export const completionIcon = new LabIcon({
  name: 'lsp:completion',
  svgstr: completionSvg
});

const FEATURE_ID = `${PLUGIN_ID}:completion`;

export namespace CommandIds {
  export const showSettings = 'lsp:completion-show-settings';
  export const setTheme = 'lsp:completion-set-theme';
  export const setColorScheme = 'lsp:completion-set-color-scheme';
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

    // icons
    for (const theme of defaultThemes) {
      iconsThemeManager.register_theme(theme);
    }
    for (const color_scheme of defaultColorSchemes) {
      iconsThemeManager.register_color_scheme(color_scheme);
    }

    // commands
    const label = 'Code Completion Settings';

    app.commands.addCommand(CommandIds.showSettings, {
      label: `${label} Editor`,
      execute: async () => {
        const { SettingsEditor } = await import('./settings');
        const content = new SettingsEditor(
          new SettingsEditor.Model({ iconsThemeManager, settings })
        );
        const main = new MainAreaWidget({ content });
        main.title.label = label;
        main.title.icon = completionIcon;
        app.shell.add(main);
      }
    });

    app.commands.addCommand(CommandIds.setTheme, {
      label: args => `Use ${args.theme} Code Completion Icon Theme`,
      execute: (args: Partial<CodeCompletion>) =>
        settings.set('theme', args.theme)
    });

    app.commands.addCommand(CommandIds.setColorScheme, {
      label: args =>
        `Use ${args.colorScheme} Code Completion Icon Color Scheme`,
      execute: (args: Partial<CodeCompletion>) =>
        settings.set('colorScheme', args.colorScheme)
    });

    // palette
    commandPalette.addItem({
      category: LSP_CATEGORY,
      command: CommandIds.showSettings
    });

    const addThemeToPalette = (themeId: string) => {
      commandPalette.addItem({
        category: LSP_CATEGORY,
        command: CommandIds.setTheme,
        args: { theme: themeId }
      });
    };

    const addColorSchemeToPalette = (colorSchemeId: string) => {
      commandPalette.addItem({
        category: LSP_CATEGORY,
        command: CommandIds.setColorScheme,
        args: { colorScheme: colorSchemeId }
      });
    };

    iconsThemeManager.theme_registered.connect((_, theme) =>
      addThemeToPalette(theme.id)
    );
    iconsThemeManager.color_scheme_registered.connect((_, colorScheme) => {
      addColorSchemeToPalette(colorScheme.id);
    });

    // backfill any themes/schemes
    iconsThemeManager.theme_ids().map(addThemeToPalette);
    iconsThemeManager.color_scheme_ids().map(addColorSchemeToPalette);
  }
};
