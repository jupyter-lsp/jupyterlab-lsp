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
import { JSONExt } from '@lumino/coreutils';

import '../style/index.css';

import { LanguageServers } from './_plugin';
import { FILEEDITOR_ADAPTER_PLUGIN } from './adapters/fileeditor';
import { NOTEBOOK_ADAPTER_PLUGIN } from './adapters/notebook';
import { StatusButtonExtension } from './components/statusbar';
import {
  COMPLETION_PLUGIN,
  COMPLETION_FALLBACK_PLUGIN
} from './features/completion';
import { DIAGNOSTICS_PLUGIN } from './features/diagnostics';
import { HIGHLIGHTS_PLUGIN } from './features/highlights';
import { HOVER_PLUGIN } from './features/hover';
import { JUMP_PLUGIN } from './features/jump_to';
import { RENAME_PLUGIN } from './features/rename';
import { SIGNATURE_PLUGIN } from './features/signature';
import { SYMBOL_PLUGIN } from './features/symbol';
import { SYNTAX_HIGHLIGHTING_PLUGIN } from './features/syntax_highlighting';
import { CODE_OVERRIDES_MANAGER } from './overrides';
import { SettingsUIManager, SettingsSchemaManager } from './settings';
import {
  ILSPLogConsole,
  PLUGIN_ID as PLUGIN_ID_BASE,
  TLanguageServerConfigurations
} from './tokens';
import { DEFAULT_TRANSCLUSIONS } from './transclusions/defaults';
import { SETTINGS_TRANSCLUSIONS } from './transclusions/settings';
import { LOG_CONSOLE } from './virtual/console';

const PLUGIN_ID = PLUGIN_ID_BASE + ':plugin';

export class LSPExtension {
  get connectionManager(): ILSPDocumentConnectionManager {
    return this._connectionManager;
  }
  private _connectionManager: DocumentConnectionManager;
  languageServerManager: ILanguageServerManager;
  private _settingsSchemaManager: SettingsSchemaManager;

  private _isAnyActive(): boolean {
    const adapters = [...this._connectionManager.adapters.values()];
    return (
      this.app.shell.currentWidget !== null &&
      adapters.some(adapter => adapter.widget == this.app.shell.currentWidget)
    );
  }

  constructor(
    public app: JupyterFrontEnd,
    private settingRegistry: ISettingRegistry,
    connectionManager: DocumentConnectionManager,
    public console: ILSPLogConsole,
    public translator: ITranslator,
    public userConsole: ILoggerRegistry | null,
    statusBar: IStatusBar | null,
    formRegistry: IFormRendererRegistry | null
  ) {
    const trans = (translator || nullTranslator).load('jupyterlab_lsp');
    this.languageServerManager = connectionManager.languageServerManager;
    this._connectionManager = connectionManager;

    const statusButtonExtension = new StatusButtonExtension({
      languageServerManager: this.languageServerManager,
      connectionManager: this.connectionManager,
      translatorBundle: trans,
      shell: app.shell
    });

    if (statusBar !== null) {
      statusBar.registerStatusItem(PLUGIN_ID_BASE + ':language-server-status', {
        item: statusButtonExtension.createItem(),
        align: 'left',
        rank: 1,
        isActive: () => this._isAnyActive()
      });
    } else {
      app.docRegistry.addWidgetExtension('Notebook', statusButtonExtension);
    }

    this._settingsSchemaManager = new SettingsSchemaManager({
      settingRegistry: this.settingRegistry,
      languageServerManager: this.languageServerManager,
      trans: trans,
      console: this.console.scope('SettingsSchemaManager'),
      restored: app.restored
    });

    if (formRegistry != null) {
      const settingsUI = new SettingsUIManager({
        settingRegistry: this.settingRegistry,
        console: this.console.scope('SettingsUIManager'),
        languageServerManager: this.languageServerManager,
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
    this.settingRegistry
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
    let languageServerSettings = (options.language_servers ||
      {}) as TLanguageServerConfigurations;

    // Rename `serverSettings` to `configuration` to work with changed name upstream,
    // rename `priority` to `rank` for the same reason.
    languageServerSettings = Object.fromEntries(
      Object.entries(languageServerSettings).map(([key, value]) => {
        const copy = JSONExt.deepCopy(value);
        copy.configuration = copy.serverSettings;
        copy.rank = copy.priority;
        delete copy.priority;
        delete copy.serverSettings;
        return [key, copy];
      })
    );

    const previousInitialConfig = this._connectionManager.initialConfigurations;
    this._connectionManager.initialConfigurations = languageServerSettings;
    // TODO: if priorities changed reset connections

    // update the server-independent part of configuration immediately
    this.connectionManager.updateConfiguration(languageServerSettings);
    if (afterInitialization) {
      this.connectionManager.updateServerConfigurations(languageServerSettings);
    } else {
      // This would not be needed if we controlled the connection manager, but because
      // it is now an independent plugin it may have started and finished initialization
      // earlier, so it potentially sent wrong `initialConfigurations` and we have no way
      // to avoid this, so we need to send a reconfiguration request instead.
      //
      // TODO: this is comparing objects which is always false,
      // we should have a proper comparison to avoid redundant calls,
      // but in practice because upstream never populates defaults and
      // we always do, this means it would be false anyways,
      // so for now the comparison serves more as a comment than logic.
      if (previousInitialConfig != languageServerSettings) {
        this.connectionManager.ready
          .then(() => {
            this.connectionManager.updateServerConfigurations(
              languageServerSettings
            );
          })
          .catch(console.error);
      }
    }
    this._connectionManager.updateLogging(
      options.logAllCommunication,
      options.setTrace!
    );
  }
}

/**
 * The plugin registration information.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: PLUGIN_ID,
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
  autoStart: true
};

const DEFAULT_FEATURES: JupyterFrontEndPlugin<any>[] = [
  JUMP_PLUGIN,
  COMPLETION_PLUGIN,
  SIGNATURE_PLUGIN,
  HOVER_PLUGIN,
  RENAME_PLUGIN,
  HIGHLIGHTS_PLUGIN,
  DIAGNOSTICS_PLUGIN,
  SYNTAX_HIGHLIGHTING_PLUGIN,
  SYMBOL_PLUGIN
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
  SETTINGS_TRANSCLUSIONS,
  ...DEFAULT_TRANSCLUSIONS,
  ...DEFAULT_FEATURES,
  COMPLETION_FALLBACK_PLUGIN
];

/**
 * Export the plugins as default.
 */
export default plugins;
