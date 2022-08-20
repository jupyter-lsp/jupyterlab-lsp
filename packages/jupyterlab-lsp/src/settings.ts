import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { TranslationBundle } from '@jupyterlab/translation';
import { IFormComponentRegistry } from '@jupyterlab/ui-components';
import { JSONExt, ReadonlyPartialJSONObject } from '@lumino/coreutils';
import { FieldProps } from '@rjsf/core';

import { LanguageServer } from './_plugin';
import { renderLanguageServerSettings } from './components/serverSettings';
import { LanguageServerManager } from './manager';
import { ILSPLogConsole } from './tokens';

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

export class SettingsUIManager {
  constructor(
    protected options: {
      settingRegistry: ISettingRegistry;
      formRegistry: IFormComponentRegistry | null;
      languageServerManager: LanguageServerManager;
      console: ILSPLogConsole;
      trans: TranslationBundle;
    }
  ) {
    this._defaults = {};
    // register custom UI field for `language_servers` property
    if (this.options.formRegistry != null) {
      this.options.formRegistry.addRenderer(
        'language_servers',
        (props: FieldProps) => {
          return renderLanguageServerSettings({
            settingRegistry: this.options.settingRegistry,
            languageServerManager: this.options.languageServerManager,
            trans: this.options.trans,
            defaults: this._defaults,
            ...props
          });
        }
      );
    }
  }

  protected get console(): ILSPLogConsole {
    return this.options.console;
  }

  setupSchemaForUI(pluginId: string): void {
    let canonical: ISettingRegistry.ISchema | null;
    type ValueOf<T> = T[keyof T];
    type ServerSchemaWrapper = ValueOf<
      Required<LanguageServer>['language_servers']
    >;
    const languageServerManager = this.options.languageServerManager;
    /**
     * Populate the plugin's schema defaults.
     */
    let populate = (schema: ISettingRegistry.ISchema) => {
      const baseServerSchema = (schema.definitions as any)[
        'language-server'
      ] as {
        description: string;
        title: string;
        definitions: Record<string, any>;
        properties: ServerSchemaWrapper;
      };

      const defaults: Record<string, any> = {};
      const knownServersConfig: Record<string, any> = {};
      const sharedDefaults = getDefaults(
        schema.properties!.language_servers.properties
      );
      for (let [
        serverKey,
        serverSpec
      ] of languageServerManager.specs.entries()) {
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

        const defaultMap = getDefaults(configSchema.properties);

        const schema = JSONExt.deepCopy(baseServerSchema);
        schema.properties.serverSettings = configSchema;
        knownServersConfig[serverKey] = schema;
        defaults[serverKey] = {
          ...sharedDefaults,
          serverSettings: defaultMap
        };
      }
      schema.properties!.language_servers.properties = knownServersConfig;
      schema.properties!.language_servers.default = defaults;
      this._defaults = defaults;
    };

    languageServerManager.sessionsChanged.connect(async () => {
      canonical = null;
      await this.options.settingRegistry.reload(pluginId);
    });

    // Transform the plugin object to return different schema than the default.
    this.options.settingRegistry.transform(pluginId, {
      fetch: plugin => {
        // Only override the canonical schema the first time.
        if (!canonical) {
          canonical = JSONExt.deepCopy(plugin.schema);
          populate(canonical);
        }
        return {
          data: plugin.data,
          id: plugin.id,
          raw: plugin.raw,
          schema: canonical,
          version: plugin.version
        };
      }
    });
  }

  private _defaults: ReadonlyPartialJSONObject;
}
