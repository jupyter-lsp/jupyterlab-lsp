import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { TranslationBundle } from '@jupyterlab/translation';
import { JSONExt } from '@lumino/coreutils';

import { LanguageServer } from './_plugin';
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

export class SettingsUIManager {
  constructor(
    protected options: {
      setting_registry: ISettingRegistry;
      language_server_manager: LanguageServerManager;
      console: ILSPLogConsole;
      trans: TranslationBundle;
    }
  ) {
    // no-op
  }

  protected get console(): ILSPLogConsole {
    return this.options.console;
  }

  setupSchemaForUI(plugin_id: string): void {
    let canonical: ISettingRegistry.ISchema | null;
    type ValueOf<T> = T[keyof T];
    type ServerSchemaWrapper = ValueOf<
      Required<LanguageServer>['language_servers']
    >;
    const languageServerManager = this.options.language_server_manager;
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

      const knownServersConfig: Record<string, any> = {};
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
            'Settings passed to `%1` server (this server was not detected as installed during startup)',
            serverSpec.display_name
          );
        } else {
          configSchema.description = this.options.trans.__(
            'Settings passed to %1',
            serverSpec.display_name
          );
        }

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

        const schema = JSONExt.deepCopy(baseServerSchema);
        schema.properties.serverSettings = configSchema;
        knownServersConfig[serverKey] = schema;
      }
      schema.properties!.language_servers.properties = knownServersConfig;
    };

    languageServerManager.sessionsChanged.connect(async () => {
      canonical = null;
      await this.options.setting_registry.reload(plugin_id);
    });

    // Transform the plugin object to return different schema than the default.
    this.options.setting_registry.transform(plugin_id, {
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
}
