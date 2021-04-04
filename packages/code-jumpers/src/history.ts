import { IModelDB, IObservableUndoableList } from '@jupyterlab/observables';
import { JSONValue } from '@lumino/coreutils';

import { IGlobalPosition } from './positions';

const DB_ENTRY = 'jumpy_history';

export class JumpHistory {
  jump_history: IObservableUndoableList<JSONValue>;
  model_db: IModelDB;

  constructor(model_db: IModelDB) {
    this.model_db = model_db;
  }

  ensure_history_is_ready() {
    if (this.jump_history === undefined) {
      if (this.model_db.has(DB_ENTRY)) {
        this.jump_history = this.model_db.get(
          DB_ENTRY
        ) as IObservableUndoableList<JSONValue>;
      } else {
        this.jump_history = this.model_db.createList(DB_ENTRY);
      }
    }
  }

  store(position: IGlobalPosition) {
    this.ensure_history_is_ready();
    this.jump_history.push(JSON.stringify(position));
  }

  recollect(): IGlobalPosition {
    this.ensure_history_is_ready();
    if (this.jump_history.length === 0) {
      return;
    }
    let last_position = this.jump_history.get(this.jump_history.length - 1);
    // being lazy here - undo addition instead of removal ;)
    this.jump_history.undo();

    return JSON.parse(last_position as string) as IGlobalPosition;
  }
}
