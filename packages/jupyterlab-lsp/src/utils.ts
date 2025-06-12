import { PageConfig } from '@jupyterlab/coreutils';
import { ReadonlyJSONObject, ReadonlyJSONValue } from '@lumino/coreutils';
import mergeWith from 'lodash.mergewith';

const RE_PATH_ANCHOR = /^file:\/\/([^\/]+|\/[a-zA-Z](?::|%3A))/;

export async function sleep(timeout: number) {
  return new Promise<void>(resolve => {
    setTimeout(() => {
      resolve();
    }, timeout);
  });
}

export type ModifierKey =
  | 'Shift'
  | 'Alt'
  | 'AltGraph'
  | 'Control'
  | 'Meta'
  | 'Accel';

/**
 * CodeMirror-proof implementation of event.getModifierState()
 */
export function getModifierState(
  event: MouseEvent | KeyboardEvent,
  modifierKey: ModifierKey
): boolean {
  // Note: Safari does not support getModifierState on MouseEvent, see:
  // https://github.com/krassowski/jupyterlab-go-to-definition/issues/3
  // thus AltGraph and others are not supported on Safari
  // Full list of modifier keys and mappings to physical keys on different OSes:
  // https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/getModifierState

  // the key approach is needed for CodeMirror events which do not set
  // *key (e.g. ctrlKey) correctly
  const key = (event as KeyboardEvent).key || null;
  let value = false;

  switch (modifierKey) {
    case 'Shift':
      value = event.shiftKey || key == 'Shift';
      break;
    case 'Alt':
      value = event.altKey || key == 'Alt';
      break;
    case 'AltGraph':
      value = key == 'AltGraph';
      break;
    case 'Control':
      value = event.ctrlKey || key == 'Control';
      break;
    case 'Meta':
      value = event.metaKey || key == 'Meta';
      break;
    case 'Accel':
      value =
        event.metaKey || key == 'Meta' || event.ctrlKey || key == 'Control';
      break;
  }

  if (event.getModifierState !== undefined) {
    return value || event.getModifierState(modifierKey);
  }

  return value;
}

export class DefaultMap<K, V> extends Map<K, V> {
  constructor(
    private defaultFactory: (...args: any[]) => V,
    entries?: ReadonlyArray<readonly [K, V]> | null
  ) {
    super(entries);
  }

  get(k: K): V {
    return this.getOrCreate(k);
  }

  getOrCreate(k: K, ...args: any[]): V {
    if (this.has(k)) {
      return super.get(k)!;
    } else {
      let v = this.defaultFactory(k, ...args);
      this.set(k, v);
      return v;
    }
  }
}

function serverRootUri() {
  return PageConfig.getOption('rootUri');
}

/**
 * compare two URIs, discounting:
 * - drive capitalization
 * - uri encoding
 * TODO: probably use vscode-uri
 */
export function urisEqual(a: string, b: string) {
  const winPaths = isWinPath(a) && isWinPath(b);
  if (winPaths) {
    a = normalizeWinPath(a);
    b = normalizeWinPath(b);
  }
  return (
    a === b ||
    decodeURIComponent(a) === decodeURIComponent(b)  
    // decodeURIComponent is needed to handle special characters like ','
  );
}

/**
 * grossly detect whether a URI represents a file on a windows drive
 */
export function isWinPath(uri: string) {
  return uri.match(RE_PATH_ANCHOR);
}

/**
 * lowercase the drive component of a URI
 */
export function normalizeWinPath(uri: string) {
  // Pyright encodes colon on Windows, see:
  // https://github.com/jupyter-lsp/jupyterlab-lsp/pull/587#issuecomment-844225253
  return uri.replace(RE_PATH_ANCHOR, it =>
    it.replace('%3A', ':').toLowerCase()
  );
}

export function uriToContentsPath(child: string, parent?: string) {
  parent = parent || serverRootUri();
  if (parent == null) {
    return null;
  }
  const winPaths = isWinPath(parent) && isWinPath(child);
  if (winPaths) {
    parent = normalizeWinPath(parent);
    child = normalizeWinPath(child);
  }
  if (child.startsWith(parent)) {
    // 'decodeURIComponent' is needed over 'decodeURI' for '@' in TS/JS paths
    return decodeURIComponent(child.replace(parent, ''));
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

interface ICollapsingResult {
  result: Record<string, ReadonlyJSONValue>;
  conflicts: Record<string, any[]>;
}

export function collapseToDotted(obj: ReadonlyJSONObject): ICollapsingResult {
  const result: Record<string, ReadonlyJSONValue> = {};
  const conflicts: Record<string, any[]> = {};

  const collapse = (obj: any, root = ''): void => {
    for (let [key, value] of Object.entries(obj)) {
      const prefix = root ? root + '.' + key : key;
      if (
        value != null &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        Object.keys(value!).length !== 0
      ) {
        collapse(value, prefix);
      } else {
        if (result.hasOwnProperty(prefix) && result[prefix] !== value) {
          if (!conflicts.hasOwnProperty(prefix)) {
            conflicts[prefix] = [];
            conflicts[prefix].push(result[prefix]);
          }
          if (!conflicts[prefix].includes(value)) {
            conflicts[prefix].push(value);
          }
        }
        result[prefix] = value as ReadonlyJSONValue;
      }
    }
  };
  collapse(obj);

  return {
    result: result as any as ReadonlyJSONObject,
    conflicts: conflicts
  };
}

export function escapeMarkdown(text: string) {
  // note: keeping backticks for highlighting of code sections
  text = text.replace(/([\\#*_[\]])/g, '\\$1');
  // escape HTML
  const span = document.createElement('span');
  span.textContent = text;
  return span.innerHTML.replace(/\n/g, '<br>').replace(/ {2}/g, '\u00A0\u00A0');
}
