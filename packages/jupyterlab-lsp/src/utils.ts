import mergeWith from 'lodash.mergewith';
import { ReadonlyJSONObject, ReadonlyJSONValue } from '@lumino/coreutils';

const RE_PATH_ANCHOR = /^file:\/\/([^\/]+|\/[A-Z]:)/;

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
  interval_modifier = (i: number) => i
) {
  return new Promise(async (resolve, reject) => {
    let i = 0;
    while (is_ready() !== true) {
      i += 1;
      if (max_retrials !== -1 && i > max_retrials) {
        reject('Too many retrials');
        break;
      }
      interval = interval_modifier(interval);
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
      let v = this.default_factory(k, ...args);
      this.set(k, v);
      return v;
    }
  }
}

/**
 * compare two URIs, discounting:
 * - drive capitalization
 * TODO: probably use vscode-uri
 */
export function uris_equal(a: string, b: string) {
  const win_paths = is_win_path(a) && is_win_path(b);
  if (win_paths) {
    return normalize_win_path(a) === normalize_win_path(b);
  } else {
    return a === b;
  }
}

/**
 * grossly detect whether a URI represents a file on a windows drive
 */
export function is_win_path(uri: string) {
  return uri.match(RE_PATH_ANCHOR);
}

/**
 * lowercase the drive component of a URI
 */
export function normalize_win_path(uri: string) {
  return uri.replace(RE_PATH_ANCHOR, it => it.toLowerCase());
}

export function uri_to_contents_path(child: string, parent: string) {
  if (parent == null) {
    return null;
  }
  if (child.startsWith(parent)) {
    return child.replace(parent, '');
  }
  return null;
}

/**
 * The docs for many language servers show settings in the
 * VSCode format, e.g.: "pyls.plugins.pyflakes.enabled"
 *
 * VSCode converts that dot notation to JSON behind the scenes,
 * as the language servers themselves don't accept that syntax.
 */
export const expandPath = (
  path: string[],
  value: ReadonlyJSONValue
): ReadonlyJSONObject => {
  const obj: any = {};

  let curr = obj;
  path.forEach((prop: string, i: any) => {
    curr[prop] = {};

    if (i === path.length - 1) {
      curr[prop] = value;
    } else {
      curr = curr[prop];
    }
  });

  return obj;
};

export const expandDottedPaths = (
  obj: ReadonlyJSONObject
): ReadonlyJSONObject => {
  const settings: any = [];
  for (let key in obj) {
    const parsed = expandPath(key.split('.'), obj[key]);
    settings.push(parsed);
  }
  return mergeWith({}, ...settings);
};
