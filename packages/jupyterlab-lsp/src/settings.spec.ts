import { LanguageServerManager } from '@jupyterlab/lsp';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { JSONExt } from '@lumino/coreutils';

import { SettingsSchemaManager } from './settings';

const DEAULT_SERVER_PRIORITY = 50;

const SCHEMA: ISettingRegistry.ISchema = {
  type: 'object',
  definitions: {
    'language-server': {
      type: 'object',
      default: {},
      properties: {
        priority: {
          title: 'Priority of the server',
          type: 'number',
          default: 50,
          minimum: 1
        },
        serverSettings: {
          title: 'Language Server Configurations',
          type: 'object',
          default: {},
          additionalProperties: true
        }
      }
    }
  },
  properties: {
    language_servers: {
      title: 'Language Server',
      type: 'object',
      default: {
        pyright: {
          serverSettings: {
            'python.analysis.useLibraryCodeForTypes': true
          }
        },
        'bash-language-server': {
          serverSettings: {
            'bashIde.enableSourceErrorDiagnostics': true
          }
        }
      },
      patternProperties: {
        '.*': {
          $ref: '#/definitions/language-server'
        }
      },
      additionalProperties: {
        $ref: '#/definitions/language-server'
      }
    }
  }
};

const PYRIGHT_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Pyright Language Server Configuration',
  description:
    'Pyright Configuration Schema. Distributed under MIT License, Copyright (c) Microsoft Corporation.',
  type: 'object',
  properties: {
    'python.analysis.diagnosticSeverityOverrides': {
      type: 'object',
      description:
        'Allows a user to override the severity levels for individual diagnostics.',
      scope: 'resource',
      properties: {
        reportGeneralTypeIssues: {
          type: 'string',
          description:
            'Diagnostics for general type inconsistencies, unsupported operations, argument/parameter mismatches, etc. Covers all of the basic type-checking rules not covered by other rules. Does not include syntax errors.',
          default: 'error',
          enum: ['none', 'information', 'warning', 'error']
        },
        reportPropertyTypeMismatch: {
          type: 'string',
          description:
            'Diagnostics for property whose setter and getter have mismatched types.',
          default: 'none',
          enum: ['none', 'information', 'warning', 'error']
        },
        reportFunctionMemberAccess: {
          type: 'string',
          description: 'Diagnostics for member accesses on functions.',
          default: 'none',
          enum: ['none', 'information', 'warning', 'error']
        },
        reportMissingImports: {
          type: 'string',
          description:
            'Diagnostics for imports that have no corresponding imported python file or type stub file.',
          default: 'error',
          enum: ['none', 'information', 'warning', 'error']
        },
        reportUnusedImport: {
          type: 'string',
          description:
            'Diagnostics for an imported symbol that is not referenced within that file.',
          default: 'none',
          enum: ['none', 'information', 'warning', 'error']
        },
        reportUnusedClass: {
          type: 'string',
          description:
            'Diagnostics for a class with a private name (starting with an underscore) that is not accessed.',
          default: 'none',
          enum: ['none', 'information', 'warning', 'error']
        }
      }
    },
    'python.analysis.logLevel': {
      type: 'string',
      default: 'Information',
      description: 'Specifies the level of logging for the Output panel',
      enum: ['Error', 'Warning', 'Information', 'Trace']
    },
    'python.analysis.useLibraryCodeForTypes': {
      type: 'boolean',
      default: false,
      description:
        'Use library implementations to extract type information when type stub is not present.',
      scope: 'resource'
    },
    'python.pythonPath': {
      type: 'string',
      default: 'python',
      description: 'Path to Python, you can use a custom version of Python.',
      scope: 'resource'
    }
  }
};

const COLLAPSED_PYRIGHT_SETTINGS = {
  pyright: {
    priority: 50,
    serverSettings: {
      'python.analysis.autoImportCompletions': false,
      'python.analysis.extraPaths': [],
      'python.analysis.stubPath': 'typings',
      'python.pythonPath': 'python',
      'python.analysis.diagnosticSeverityOverrides.reportGeneralTypeIssues':
        'error',
      'python.analysis.diagnosticSeverityOverrides.reportPropertyTypeMismatch':
        'none',
      'python.analysis.diagnosticSeverityOverrides.reportFunctionMemberAccess':
        'none',
      'python.analysis.diagnosticSeverityOverrides.reportMissingImports': 'none'
    }
  }
};

function map(object: Record<string, any>) {
  return new Map(Object.entries(object));
}

const AVAILABLE_SESSIONS = map({
  pyright: null as any,
  pylsp: null as any
}) as LanguageServerManager['sessions'];

describe('SettingsSchemaManager', () => {
  describe('#expandDottedAsNeeded()', () => {
    it('should uncollapse pyright defaults', () => {
      const partiallyExpaneded = SettingsSchemaManager.expandDottedAsNeeded({
        dottedSettings: COLLAPSED_PYRIGHT_SETTINGS,
        specs: map({
          pyright: {
            display_name: 'pyright',
            // server-specific defaults and allowed values
            config_schema: PYRIGHT_SCHEMA
          }
        }) as LanguageServerManager['specs']
      });
      expect(partiallyExpaneded).toEqual({
        pyright: {
          priority: 50,
          serverSettings: {
            'python.analysis.autoImportCompletions': false,
            'python.analysis.diagnosticSeverityOverrides': {
              reportFunctionMemberAccess: 'none',
              reportGeneralTypeIssues: 'error',
              reportMissingImports: 'none',
              reportPropertyTypeMismatch: 'none'
            },
            'python.analysis.extraPaths': [],
            'python.analysis.stubPath': 'typings',
            'python.pythonPath': 'python'
          }
        }
      });
    });
  });

  describe('#transformSchemas()', () => {
    it('should merge dotted defaults', () => {
      const schema = JSONExt.deepCopy(SCHEMA) as any;

      // Set a few defaults as if these came from `overrides.json`:
      // - using fully dotted name
      schema.properties.language_servers.default.pyright.serverSettings[
        'python.analysis.diagnosticSeverityOverrides.reportGeneralTypeIssues'
      ] = 'warning';
      // - using nesting on final level (as defined in source pyright schema)
      schema.properties.language_servers.default.pyright.serverSettings[
        'python.analysis.diagnosticSeverityOverrides'
      ] = {
        reportPropertyTypeMismatch: 'warning'
      };

      const { defaults } = SettingsSchemaManager.transformSchemas({
        // plugin schema which includes overrides from `overrides.json`
        schema,
        specs: map({
          pyright: {
            display_name: 'pyright',
            // server-specific defaults and allowed values
            config_schema: PYRIGHT_SCHEMA,
            // overrides defined in specs files e.g. `jupyter_server_config.py`
            workspace_configuration: {
              // using fully dotted name
              'python.analysis.diagnosticSeverityOverrides.reportFunctionMemberAccess':
                'warning',
              // using nesting on final level (as defined in source pyright schema)
              'python.analysis.diagnosticSeverityOverrides': {
                reportUnusedImport: 'warning'
              }
            }
          }
        }) as LanguageServerManager['specs'],
        sessions: AVAILABLE_SESSIONS
      });
      const defaultOverrides =
        defaults.pyright.serverSettings[
          'python.analysis.diagnosticSeverityOverrides'
        ];
      expect(defaultOverrides).toEqual({
        // `overrides.json`:
        // - should provide `reportGeneralTypeIssues` defined with fully dotted key
        reportGeneralTypeIssues: 'warning',
        // - should provide `reportPropertyTypeMismatch` defined with nesting on final level
        // `jupyter_server_config.py`:
        reportPropertyTypeMismatch: 'warning',
        // - should provide `reportFunctionMemberAccess` defined with fully dotted key
        reportFunctionMemberAccess: 'warning',
        // - should provide `reportUnusedImport` defined with nesting on final level
        reportUnusedImport: 'warning'
        // should NOT include `reportUnusedClass` default defined in server schema
      });
    });
  });

  describe('#mergeByServer()', () => {
    it('prioritises user `priority` over the default', () => {
      const defaults = {
        pyright: {
          priority: 500,
          serverSettings: {}
        }
      };
      const user = {
        pyright: {
          priority: 100,
          serverSettings: {}
        }
      };
      const result = SettingsSchemaManager.mergeByServer(defaults, user);
      expect(result.pyright.priority).toBe(100);
    });
    it('should use default `priority` if no user value', () => {
      const defaults = {
        pyright: {
          priority: 500,
          serverSettings: {}
        }
      };
      const user = {
        pyright: {
          serverSettings: {}
        }
      };
      const result = SettingsSchemaManager.mergeByServer(defaults, user);
      expect(result.pyright.priority).toBe(500);
    });
    it('should prefer `priority` from `overrides.json` (which is recorded in defaults) if user value is set to the default value', () => {
      const defaults = {
        pyright: {
          priority: 500,
          serverSettings: {}
        }
      };
      const user = {
        pyright: {
          priority: DEAULT_SERVER_PRIORITY,
          serverSettings: {}
        }
      };
      const result = SettingsSchemaManager.mergeByServer(defaults, user);
      expect(result.pyright.priority).toBe(500);
    });
  });
});
