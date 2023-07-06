/** The Public API, as exposed in the `main` field of package.json */

/** General public tokens, including lumino Tokens and namespaces */
export * from './tokens';

/** Generated JSON Schema types for server responses and settings */
export * as SCHEMA from './_schema';

/** Component- and feature-specific APIs */
export * from './api';

import { COMPLETION_THEME_MANAGER } from '@jupyter-lsp/completion-theme';
import { plugin as THEME_MATERIAL } from '@jupyter-lsp/theme-material';
import { plugin as THEME_VSCODE } from '@jupyter-lsp/theme-vscode';
import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ILoggerRegistry } from '@jupyterlab/logconsole';
import {
  ILSPDocumentConnectionManager,
  DocumentConnectionManager,
  ILanguageServerManager
} from '@jupyterlab/lsp';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { IStatusBar } from '@jupyterlab/statusbar';
import { ITranslator, nullTranslator } from '@jupyterlab/translation';
import { IFormRendererRegistry } from '@jupyterlab/ui-components';

import '../style/index.css';

import { LanguageServers } from './_plugin';
import { FILEEDITOR_ADAPTER_PLUGIN } from './adapters/fileeditor';
import { NOTEBOOK_ADAPTER_PLUGIN } from './adapters/notebook';
import { StatusButtonExtension } from './components/statusbar';
import { COMPLETION_PLUGIN } from './features/completion';
import { DIAGNOSTICS_PLUGIN } from './features/diagnostics';
//import { HIGHLIGHTS_PLUGIN } from './features/highlights';
import { HOVER_PLUGIN } from './features/hover';
//import { JUMP_PLUGIN } from './features/jump_to';
import { RENAME_PLUGIN } from './features/rename';
import { SIGNATURE_PLUGIN } from './features/signature';
//import { SYNTAX_HIGHLIGHTING_PLUGIN } from './features/syntax_highlighting';

import { CODE_OVERRIDES_MANAGER } from './overrides';
import { SettingsUIManager, SettingsSchemaManager } from './settings';
import {
  ILSPLogConsole,
  PLUGIN_ID,
  TLanguageServerConfigurations
} from './tokens';
import { DEFAULT_TRANSCLUSIONS } from './transclusions/defaults';
import { LOG_CONSOLE } from './virtual/console';

export class LSPExtension {
  get connection_manager(): ILSPDocumentConnectionManager {
    return this._connection_manager;
  }
  private _connection_manager: DocumentConnectionManager;
  language_server_manager: ILanguageServerManager;
  private _settingsSchemaManager: SettingsSchemaManager;

  private _isAnyActive(): boolean {
    const adapters = [...this._connection_manager.adapters.values()];
    return (
      this.app.shell.currentWidget !== null &&
      adapters.some(adapter => adapter.widget == this.app.shell.currentWidget)
    );
  }

  constructor(
    public app: JupyterFrontEnd,
    private setting_registry: ISettingRegistry,
    connection_manager: DocumentConnectionManager,
    public console: ILSPLogConsole,
    public translator: ITranslator,
    public user_console: ILoggerRegistry | null,
    status_bar: IStatusBar | null,
    formRegistry: IFormRendererRegistry | null
  ) {
    const trans = (translator || nullTranslator).load('jupyterlab_lsp');
    this.language_server_manager = connection_manager.languageServerManager;
    this._connection_manager = connection_manager;

    const statusButtonExtension = new StatusButtonExtension({
      language_server_manager: this.language_server_manager,
      connection_manager: this.connection_manager,
      translator_bundle: trans
    });

    if (status_bar !== null) {
      status_bar.registerStatusItem(PLUGIN_ID + ':language-server-status', {
        item: statusButtonExtension.createItem(),
        align: 'left',
        rank: 1,
        isActive: () => this._isAnyActive()
      });
    } else {
      app.docRegistry.addWidgetExtension('Notebook', statusButtonExtension);
    }

    this._settingsSchemaManager = new SettingsSchemaManager({
      settingRegistry: this.setting_registry,
      languageServerManager: this.language_server_manager,
      trans: trans,
      console: this.console.scope('SettingsSchemaManager'),
      restored: app.restored
    });

    if (formRegistry != null) {
      const settingsUI = new SettingsUIManager({
        settingRegistry: this.setting_registry,
        console: this.console.scope('SettingsUIManager'),
        languageServerManager: this.language_server_manager,
        trans: trans,
        schemaValidated: this._settingsSchemaManager.schemaValidated
      });
      // register custom UI field for `language_servers` property
      formRegistry.addRenderer(`${PLUGIN_ID}.language_servers`, {
        fieldRenderer: settingsUI.renderForm.bind(settingsUI)
      });
    }

    this._settingsSchemaManager
      .setupSchemaTransform(plugin.id)
      .then(this._activate.bind(this))
      .catch(this._activate.bind(this));
  }

  private _activate(): void {
    this.setting_registry
      .load(plugin.id)
      .then(async settings => {
        await this._updateOptions(settings, false);
        settings.changed.connect(async () => {
          await this._updateOptions(settings, true);
        });
      })
      .catch((reason: Error) => {
        console.error(reason.message);
      });
  }

  private async _updateOptions(
    settings: ISettingRegistry.ISettings,
    afterInitialization = false
  ) {
    const options = await this._settingsSchemaManager.normalizeSettings(
      settings.composite as Required<LanguageServers>
    );
    // Store the initial server settings, to be sent asynchronously
    // when the servers are initialized.
    const languageServerSettings = (options.language_servers ||
      {}) as TLanguageServerConfigurations;

    this._connection_manager.initialConfigurations = languageServerSettings;
    // TODO: if priorities changed reset connections

    // update the server-independent part of configuration immediately
    this.connection_manager.updateConfiguration(languageServerSettings);
    if (afterInitialization) {
      this.connection_manager.updateServerConfigurations(
        languageServerSettings
      );
    }
    this._connection_manager.updateLogging(
      options.logAllCommunication,
      options.setTrace!
    );
  }
}

/**
 * The plugin registration information.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: PLUGIN_ID + ':plugin',
  requires: [
    ISettingRegistry,
    ILSPDocumentConnectionManager,
    ILSPLogConsole,
    ITranslator
  ],
  optional: [ILoggerRegistry, IStatusBar, IFormRendererRegistry],
  activate: (app, ...args) => {
    new LSPExtension(
      app,
      ...(args as [
        ISettingRegistry,
        DocumentConnectionManager,
        ILSPLogConsole,
        ITranslator,
        ILoggerRegistry | null,
        IStatusBar | null,
        IFormRendererRegistry | null
      ])
    );
  },
  //provides: ILSPExtension,
  autoStart: true
};

const default_features: JupyterFrontEndPlugin<void>[] = [
  //JUMP_PLUGIN,
  COMPLETION_PLUGIN,
  SIGNATURE_PLUGIN,
  HOVER_PLUGIN,
  RENAME_PLUGIN,
  //HIGHLIGHTS_PLUGIN,
  DIAGNOSTICS_PLUGIN
  //SYNTAX_HIGHLIGHTING_PLUGIN
];
const plugins: JupyterFrontEndPlugin<any>[] = [
  LOG_CONSOLE,
  COMPLETION_THEME_MANAGER,
  THEME_VSCODE,
  THEME_MATERIAL,
  CODE_OVERRIDES_MANAGER,
  NOTEBOOK_ADAPTER_PLUGIN,
  FILEEDITOR_ADAPTER_PLUGIN,
  plugin,
  ...DEFAULT_TRANSCLUSIONS,
  ...default_features
];

/**
 * Export the plugins as default.
 */
export default plugins;
