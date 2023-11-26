import { SettingsSchemaManager } from './settings';

const DEAULT_SERVER_PRIORITY = 50;

describe('SettingsSchemaManager', () => {
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
