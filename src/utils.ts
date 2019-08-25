export async function sleep(timeout: number) {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve();
    }, timeout);
  });
}

// TODO: there is a JL native version of this which uses adaptive rate, maybe use instead?
export function until_ready(
  is_ready: any,
  max_retrials: number = 35,
  interval = 50,
  verbose = false
) {
  return new Promise(async (resolve, reject) => {
    let i = 0;
    while (is_ready() !== true) {
      i += 1;
      if (max_retrials != -1 && i > max_retrials) {
        reject('Too many retrials');
        break;
      }
      if (verbose) {
        console.log('waiting');
      }
      await sleep(interval);
    }
    resolve(is_ready);
  });
}

/**
 * TODO: this is slightly modified copy paste from jupyterlab-go-to-definition/editors/codemirror/extension.ts;
 */
export function getModifierState(
  event: MouseEvent | KeyboardEvent,
  modifierKey: string
): boolean {
  // Note: Safari does not support getModifierState on MouseEvent, see:
  // https://github.com/krassowski/jupyterlab-go-to-definition/issues/3
  // thus AltGraph and others are not supported on Safari
  // Full list of modifier keys and mappings to physical keys on different OSes:
  // https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/getModifierState

  if (event.getModifierState !== undefined) {
    return event.getModifierState(modifierKey);
  }

  switch (modifierKey) {
    case 'Shift':
      return event.shiftKey;
    case 'Alt':
      return event.altKey;
    case 'Control':
      return event.ctrlKey;
    case 'Meta':
      return event.metaKey;
    default:
      console.warn(
        `State of the modifier key "${modifierKey}" could not be determined.`
      );
  }
}

export class DefaultMap<K, V> extends Map<K, V> {
  constructor(
    private default_factory: (...args: any[]) => V,
    entries?: ReadonlyArray<readonly [K, V]> | null
  ) {
    super(entries);
  }

  get(k: K): V {
    return this.get_or_create(k);
  }

  get_or_create(k: K, ...args: any[]): V {
    if (this.has(k)) {
      return super.get(k);
    } else {
      let v = this.default_factory(...args);
      this.set(k, v);
      return v;
    }
  }
}
