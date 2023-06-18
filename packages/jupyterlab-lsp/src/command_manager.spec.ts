import { IDocumentWidget } from '@jupyterlab/docregistry';
import { WidgetLSPAdapter } from '@jupyterlab/lsp';

import {
  CommandEntryPoint,
  ContextCommandManager,
  IContextMenuOptions
} from './command_manager';
import { IFeatureCommand } from './feature';
import { BrowserConsole } from './virtual/console';

describe('ContextMenuCommandManager', () => {
  class ManagerImplementation extends ContextCommandManager {
    constructor(options: IContextMenuOptions) {
      super({
        app: null as any,
        palette: null as any,
        tracker: null as any,
        suffix: null as any,
        entry_point: null as any,
        console: new BrowserConsole(),
        ...options
      });
    }

    public get_rank(command: IFeatureCommand): number {
      return super.get_rank(command);
    }

    entry_point: CommandEntryPoint;
    selector: string;

    get current_adapter(): WidgetLSPAdapter<IDocumentWidget> {
      return undefined as any;
    }
  }
  let manager: ManagerImplementation;

  let base_command = {
    id: 'cmd',
    execute: () => {
      // nothing here yet
    },
    is_enabled: () => {
      return true;
    },
    label: 'Command'
  } as IFeatureCommand;

  describe('#get_rank()', () => {
    it('uses in-group (relative) positioning by default', () => {
      manager = new ManagerImplementation({
        selector: 'body',
        rank_group: 0,
        rank_group_size: 5
      });
      let rank = manager.get_rank(base_command);
      expect(rank).toBe(0);

      rank = manager.get_rank({ ...base_command, rank: 1 });
      expect(rank).toBe(1 / 5);

      manager = new ManagerImplementation({
        selector: 'body',
        rank_group: 1,
        rank_group_size: 5
      });

      rank = manager.get_rank({ ...base_command, rank: 1 });
      expect(rank).toBe(1 + 1 / 5);

      manager = new ManagerImplementation({
        selector: 'body'
      });
      rank = manager.get_rank(base_command);
      expect(rank).toBe(Infinity);
    });
  });

  it('respects is_rank_relative value', () => {
    manager = new ManagerImplementation({
      selector: 'body',
      rank_group: 0,
      rank_group_size: 5
    });

    let rank = manager.get_rank({
      ...base_command,
      rank: 1,
      is_rank_relative: false
    });
    expect(rank).toBe(1);

    rank = manager.get_rank({
      ...base_command,
      rank: 1,
      is_rank_relative: true
    });
    expect(rank).toBe(1 / 5);
  });
});
