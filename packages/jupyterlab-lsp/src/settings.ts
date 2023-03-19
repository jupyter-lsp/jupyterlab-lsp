import { showDialog, Dialog } from '@jupyterlab/apputils';
import {
  ISettingRegistry,
  ISchemaValidator
} from '@jupyterlab/settingregistry';
import { TranslationBundle } from '@jupyterlab/translation';
import {
  JSONExt,
  ReadonlyPartialJSONObject,
  ReadonlyJSONObject
} from '@lumino/coreutils';
import { Signal, ISignal } from '@lumino/signaling';
import { FieldProps } from '@rjsf/core';

import { LanguageServer } from './_plugin';
import {
  renderLanguageServerSettings,
  renderCollapseConflicts
} from './components/serverSettings';
import { LanguageServerManager } from './manager';
import { ILSPLogConsole } from './tokens';
import { collapseToDotted } from './utils';

type ValueOf<T> = T[keyof T];
type ServerSchemaWrapper = ValueOf<
  Required<LanguageServer>['language_servers']
>;

/**
 * Only used for TypeScript type coercion, not meant to represent a property fully.
 */
interface IJSONProperty {
  type?: string | string[];
  description?: string;
  $ref?: string;
}

function isJSONProperty(obj: unknown): obj is IJSONProperty {
  return (
    typeof obj === 'object' && obj !== null && ('type' in obj || '$ref' in obj)
  );
}

/**
 * Settings keyed by language server name with values including
 * multiple properties, such as priority or workspace configuration
 */
type LanguageServerSettings = Record<string, ServerSchemaWrapper>;

/**
 * Get default values from JSON Schema properties field.
 */
function getDefaults(
  properties: ReadonlyPartialJSONObject | undefined
): Record<string, any> {
  if (properties == null) {
    return {};
  }
  // TODO: also get defaults from ref?
  const defaults: Record<string, any> = {};
  const entries = Object.entries(properties)
    .map(([key, value]) => [key, (value as any)?.default])
    .filter(([key, value]) => typeof value !== 'undefined');
  // TODO: use Object.fromEntries once we switch target
  for (let [key, value] of entries) {
    defaults[key] = value;
  }
  return defaults;
}

/**
 * Schema and user data that for validation
 */
interface IValidationData {
  rawUserSettings: string;
  schema: ISettingRegistry.ISchema;
}

/**
 * Conflicts encounteredn when dot-collapsing settings
 * organised by server ID, and then as a mapping between
 * (dotted) setting ID and list of encoutnered values.
 * The last encountered values is preferred for use.
 */
type SettingsMergeConflicts = Record<string, Record<string, any[]>>;

interface ISettingsCollapseResult {
  settings: LanguageServerSettings;
  conflicts: SettingsMergeConflicts;
}

export class SettingsUIManager {
  constructor(
    protected options: {
      settingRegistry: ISettingRegistry;
      languageServerManager: LanguageServerManager;
      console: ILSPLogConsole;
      trans: TranslationBundle;
      schemaValidated: ISignal<
        SettingsSchemaManager,
        ISchemaValidator.IError[]
      >;
    }
  ) {
    options.schemaValidated.connect((_, errors) => {
      this._validationErrors = errors;
    });
    this._validationErrors = [];
  }

  renderForm(props: FieldProps) {
    return renderLanguageServerSettings({
      settingRegistry: this.options.settingRegistry,
      languageServerManager: this.options.languageServerManager,
      trans: this.options.trans,
      validationErrors: this._validationErrors,
      ...props
    });
  }

  private _validationErrors: ISchemaValidator.IError[];
}

/**
 * Harmonize settings from schema, defaults from specification, and values set by user.
 */
export class SettingsSchemaManager {
  constructor(
    protected options: {
      settingRegistry: ISettingRegistry;
      languageServerManager: LanguageServerManager;
      console: ILSPLogConsole;
      trans: TranslationBundle;
      /**
       * Promise resolved when JupyterLab splash screen disappears.
       */
      restored: Promise<void>;
    }
  ) {
    this._schemaValidated = new Signal(this);
    this._defaults = {};
    this._canonical = null;
    this._original = null;
    this._validationAttempt = 0;
    this._lastValidation = null;
    this._lastUserServerSettings = null;
    this._lastUserServerSettingsDoted = null;
    this._defaultsPopulated = this._createDefaultsPromise();
    this._validationErrors = [];
  }

  private _defaultsPopulated: Promise<void>;
  private _populatedAccept: (value: unknown) => void;
  private _createDefaultsPromise(): Promise<void> {
    return new Promise(accept => {
      this._populatedAccept = accept;
    });
  }

  get schemaValidated(): ISignal<
    SettingsSchemaManager,
    ISchemaValidator.IError[]
  > {
    return this._schemaValidated;
  }

  protected get console(): ILSPLogConsole {
    return this.options.console;
  }

  /**
   * Add schema for individual language servers into JSON schema.
   * This method has to be called before any other action
   * is performed on settingRegistry with regard to pluginId.
   */
  async setupSchemaTransform(pluginId: string): Promise<void> {
    const languageServerManager = this.options.languageServerManager;

    // Transform the plugin object to return different schema than the default.
    this.options.settingRegistry.transform(pluginId, {
      fetch: plugin => {
        // Profiling data (earlier version):
        // Initial fetch: 61-64 ms
        // Subsequent without change: <1ms
        // Session change: 642 ms.
        // 91% spent on `validateData()` of which 10% in addSchema().
        // 1.8% spent on `deepCopy()`
        // 1.79% spend on other tasks in `populate()`
        // There is a limit on the transformation time, and failing to transform
        // in the default 1 second means that no settigns whatsoever are available.
        // Therefore validation in `populate()` was moved into an async function;
        // this means that we need to trigger re-load of settings
        // if there validation errors.

        // Only store the original schema the first time.
        if (!this._original) {
          this._original = JSONExt.deepCopy(plugin.schema);
        }
        // Only override the canonical schema the first time (or after reset).
        if (!this._canonical) {
          this._canonical = JSONExt.deepCopy(plugin.schema);
          this._populate(plugin, this._canonical);
          this._populatedAccept(void 0);
        }

        return {
          data: plugin.data,
          id: plugin.id,
          raw: plugin.raw,
          schema: this._validationErrors.length
            ? this._original
            : this._canonical,
          version: plugin.version
        };
      }
    });

    // note: has to be after transform is called for the first time to avoid
    // race condition, see https://github.com/jupyterlab/jupyterlab/issues/12978
    languageServerManager.sessionsChanged.connect(async () => {
      this._canonical = null;
      this._defaultsPopulated = this._createDefaultsPromise();
      await this.options.settingRegistry.reload(pluginId);
    });
  }

  /**
   * Populate the plugin's schema defaults, transform descriptions.
   */
  private _populate(
    plugin: ISettingRegistry.IPlugin,
    schema: ISettingRegistry.ISchema
  ) {
    const languageServerManager = this.options.languageServerManager;
    const baseServerSchema = (schema.definitions as any)['language-server'] as {
      description: string;
      title: string;
      definitions: Record<string, any>;
      properties: ServerSchemaWrapper;
    };

    const defaults: Record<string, any> = {};
    const knownServersConfig: Record<string, any> = {};
    // `sharedDefaults` may be empty as we do not define/receive custom
    // per-property defaults in schema as of the day of writing.
    const sharedDefaults = getDefaults(
      schema.properties!.language_servers.properties
    );
    const defaultsOverrides = schema.properties!.language_servers.default as
      | Record<string, any>
      | undefined;

    for (let [serverKey, serverSpec] of languageServerManager.specs.entries()) {
      if ((serverKey as string) === '') {
        this.console.warn(
          'Empty server key - skipping transformation for',
          serverSpec
        );
        continue;
      }

      const configSchema = serverSpec.config_schema;
      if (!configSchema) {
        this.console.warn(
          'No config schema - skipping transformation for',
          serverKey
        );
        continue;
      }
      if (!configSchema.properties) {
        this.console.warn(
          'No properites in config schema - skipping transformation for',
          serverKey
        );
        continue;
      }

      // let user know if server not available (installed, etc)
      if (!languageServerManager.sessions.has(serverKey)) {
        configSchema.description = this.options.trans.__(
          'Settings that would be passed to `%1` server (this server was not detected as installed during startup) in `workspace/didChangeConfiguration` notification.',
          serverSpec.display_name
        );
      } else {
        configSchema.description = this.options.trans.__(
          'Settings to be passed to %1 in `workspace/didChangeConfiguration` notification.',
          serverSpec.display_name
        );
      }
      configSchema.title = this.options.trans.__('Workspace Configuration');

      // resolve refs
      for (let [key, value] of Object.entries(configSchema.properties)) {
        if (!isJSONProperty(value)) {
          continue;
        }
        if (typeof value.$ref === 'undefined') {
          continue;
        }
        if (value.$ref.startsWith('#/definitions/')) {
          const definitionID = value['$ref'].substring(14);
          const definition = configSchema.definitions[definitionID];
          if (definition == null) {
            this.console.warn('Definition not found');
          }
          for (let [defKey, defValue] of Object.entries(definition)) {
            configSchema.properties[key][defKey] = defValue;
          }
          delete value.$ref;
        } else {
          this.console.warn('Unsupported $ref', value['$ref']);
        }
      }

      // add default overrides from spec
      const workspaceConfigurationDefaults =
        serverSpec.workspace_configuration as Record<string, any> | undefined;
      if (workspaceConfigurationDefaults) {
        for (const [key, value] of Object.entries(
          workspaceConfigurationDefaults
        )) {
          if (!configSchema.properties.hasOwnProperty(key)) {
            this.console.warn(
              '`workspace_configuration` includes an override for key not in schema',
              key,
              serverKey
            );
            continue;
          }
          configSchema.properties[key].default = value;
        }
      }
      // add server-speficic default overrides from overrides.json (and pre-defined in schema)
      const serverDefaultsOverrides =
        defaultsOverrides && defaultsOverrides.hasOwnProperty(serverKey)
          ? defaultsOverrides[serverKey]
          : {};
      if (serverDefaultsOverrides.serverSettings) {
        for (const [key, value] of Object.entries(
          serverDefaultsOverrides.serverSettings
        )) {
          if (!configSchema.properties.hasOwnProperty(key)) {
            this.console.warn(
              '`overrides.json` includes an override for key not in schema',
              key,
              serverKey
            );
            continue;
          }
          configSchema.properties[key].default = value;
        }
      }

      const defaultMap = getDefaults(configSchema.properties);

      const baseSchemaCopy = JSONExt.deepCopy(baseServerSchema);
      baseSchemaCopy.properties.serverSettings = configSchema;
      knownServersConfig[serverKey] = baseSchemaCopy;
      defaults[serverKey] = {
        ...sharedDefaults,
        ...serverDefaultsOverrides,
        serverSettings: defaultMap
      };
    }

    schema.properties!.language_servers.properties = knownServersConfig;
    schema.properties!.language_servers.default = defaults;

    this._validateSchemaLater(plugin, schema).catch(this.console.warn);
    this._defaults = defaults;
  }

  async normalizeSettings(
    composite: Required<LanguageServer>
  ): Promise<Required<LanguageServer>> {
    await this._defaultsPopulated;
    // Cache collapsed settings for speed and to only show dialog once.
    // Note that JupyterLab attempts to transform in "preload" step (before splash screen end)
    // and then again for deferred extensions if the initial transform in preload timed out.
    // We are hitting the timeout in preload step.
    if (
      this._lastUserServerSettings === null ||
      this._lastUserServerSettingsDoted === null ||
      !JSONExt.deepEqual(
        this._lastUserServerSettings,
        composite.language_servers
      )
    ) {
      this._lastUserServerSettings = composite.language_servers;

      const collapsedDefaults = this._collapseServerSettingsDotted(
        this._defaults
      );
      const collapsedUser = this._collapseServerSettingsDotted(
        composite.language_servers
      );

      composite.language_servers = this._mergeByServer(
        collapsedDefaults.settings,
        collapsedUser.settings
      );
      this._lastUserServerSettingsDoted = composite.language_servers;

      if (Object.keys(collapsedUser.conflicts).length > 0) {
        this._warnConflicts(
          collapsedUser.conflicts,
          'Conflicts in user settings'
        ).catch(this.console.warn);
      }
      if (Object.keys(collapsedDefaults.conflicts).length > 0) {
        this._warnConflicts(
          collapsedDefaults.conflicts,
          'Conflicts in defaults'
        ).catch(this.console.warn);
      }
    } else {
      composite.language_servers = this._lastUserServerSettingsDoted;
    }

    // We do not filter out defaults at this level,
    // as it does not provide an obvious benefit:
    // - we would need to explicitly save the updated settings
    //   to get a clean version in JSON Setting Editor.
    // - if default changed on the LSP server side but schema did not get
    //   updated, LSP server would be using a different value than communicated
    //   to the user. It would be optimal to filter out defaults from
    //   user data and always keep them in composite,
    // - making Jupyter server-side `workspace_configuration` work would
    //   be more difficult

    // TODO: trigger update of settings to ensure that UI uses the same settings as collapsed?
    return composite;
  }

  private _wasPreviouslyValidated(
    plugin: ISettingRegistry.IPlugin,
    schema: ISettingRegistry.ISchema
  ) {
    return (
      this._lastValidation !== null &&
      this._lastValidation.rawUserSettings === plugin.raw &&
      JSONExt.deepEqual(this._lastValidation.schema, schema)
    );
  }

  /**
   * Validate user settings from plugin against provided schema,
   * asynchronously to avoid blocking the main thread.
   * Stores validation reult in `this._validationErrors`.
   */
  private async _validateSchemaLater(
    plugin: ISettingRegistry.IPlugin,
    schema: ISettingRegistry.ISchema
  ) {
    // Ensure the subsequent code runs asynchronously; also reduce the CPU load on startup.
    await this.options.restored;

    // Do not re-validate if neither schema, nor user settings changed
    if (this._wasPreviouslyValidated(plugin, schema)) {
      return;
    }
    // Test if we can apply the schema without causing validation error
    // (is the configuration held by the user compatible with the schema?)
    this._validationAttempt += 1;
    // the validator will parse raw plugin data into this object;
    // we do not do anything with those right now.
    const parsedData = { composite: {}, user: {} };
    const validationErrors =
      this.options.settingRegistry.validator.validateData(
        {
          // The plugin schema is cached so we have to provide a dummy ID;
          // can be simplified once https://github.com/jupyterlab/jupyterlab/issues/12978 is fixed.
          id: `lsp-validation-attempt-${this._validationAttempt}`,
          raw: plugin.raw,
          data: parsedData,
          version: plugin.version,
          schema: schema
        },
        true
      );

    this._lastValidation = {
      rawUserSettings: plugin.raw,
      schema: schema
    };

    if (validationErrors) {
      console.error(
        'LSP server settings validation failed; graphical interface for settings will run in schema-free mode; errors:',
        validationErrors
      );
      this._validationErrors = validationErrors;
      this._schemaValidated.emit(validationErrors);
      if (!this._original) {
        console.error(
          'Original language servers schema not available to restore non-transformed values.'
        );
      } else {
        if (!this._original.properties!.language_servers.properties) {
          delete schema.properties!.language_servers.properties;
        }
        if (!this._original.properties!.language_servers.default) {
          delete schema.properties!.language_servers.default;
        }
      }

      // Reload settings to use non-restrictive schema; this requires fixing
      // https://github.com/jupyterlab/jupyterlab/issues/12978 upstream to work.
      await this.options.settingRegistry.reload(plugin.id);
    }
  }

  private async _warnConflicts(
    conflicts: SettingsMergeConflicts,
    title: string
  ) {
    // Ensure the subsequent code runs asynchronously, and delay
    // showing the dialog until the splash screen disappeared.
    await this.options.restored;

    showDialog({
      body: renderCollapseConflicts({
        conflicts: conflicts,
        trans: this.options.trans
      }),
      title: title,
      buttons: [Dialog.okButton()]
    }).catch(console.warn);
  }

  private _collapseServerSettingsDotted(
    settings: LanguageServerSettings
  ): ISettingsCollapseResult {
    const conflicts: Record<string, Record<string, any[]>> = {};
    const result = JSONExt.deepCopy(settings) as LanguageServerSettings;
    for (let [serverKey, serverSettingsGroup] of Object.entries(settings)) {
      if (!serverSettingsGroup || !serverSettingsGroup.serverSettings) {
        continue;
      }
      const collapsed = collapseToDotted(
        serverSettingsGroup.serverSettings as ReadonlyJSONObject
      );
      if (Object.keys(collapsed.conflicts).length) {
        conflicts[serverKey] = collapsed.conflicts;
      }
      result[serverKey]!.serverSettings = collapsed.result;
    }
    return {
      settings: result,
      conflicts: conflicts
    };
  }

  private _mergeByServer(
    defaults: LanguageServerSettings,
    userSettings: LanguageServerSettings
  ): LanguageServerSettings {
    const result = JSONExt.deepCopy(defaults) as LanguageServerSettings;
    for (let [serverKey, serverSettingsGroup] of Object.entries(userSettings)) {
      if (!serverSettingsGroup || !serverSettingsGroup.serverSettings) {
        continue;
      }
      if (typeof result[serverKey] === 'undefined') {
        // nothing to merge with
        result[serverKey] = JSONExt.deepCopy(serverSettingsGroup);
      } else {
        const merged: Required<ServerSchemaWrapper> = {
          priority: (result[serverKey].priority ||
            serverSettingsGroup.priority) as any,
          // `serverSettings` entries are expected to be flattened to dot notation here.
          serverSettings: {
            ...(result[serverKey].serverSettings || {}),
            ...(serverSettingsGroup.serverSettings || {})
          }
        };
        result[serverKey] = merged;
      }
    }
    return result;
  }

  private _defaults: LanguageServerSettings;
  private _validationErrors: ISchemaValidator.IError[];
  private _schemaValidated: Signal<
    SettingsSchemaManager,
    ISchemaValidator.IError[]
  >;
  private _validationAttempt: number;
  private _lastValidation: IValidationData | null;
  private _lastUserServerSettings: LanguageServerSettings | null;
  private _lastUserServerSettingsDoted: LanguageServerSettings | null;
  private _canonical: ISettingRegistry.ISchema | null;
  private _original: ISettingRegistry.ISchema | null;
}
