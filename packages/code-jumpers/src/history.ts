import { IGlobalPosition } from './positions';

const DATABASE: Array<IGlobalPosition> = [];

export class JumpHistory {
  store(position: IGlobalPosition) {
    DATABASE.push(position);
  }

  // TODO: recollect should take a param with current position;
  // It shold only go back if current contents_path is the same
  // as the last one on the stack (or a previous disjoint one).
  // Probably the jump paths should not be in an array of arrays.
  recollect(): IGlobalPosition | undefined {
    return DATABASE.pop();
  }
}
