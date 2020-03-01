import { CodeEditor } from '@jupyterlab/codeeditor';
import { LanguageWithOptionalSemicolons, TokenContext } from './analyzer';
import IToken = CodeEditor.IToken;
import { PathExt } from '@jupyterlab/coreutils';

function evaluateSkippingBrackets(
  tokens: ReadonlyArray<IToken>,
  indexShift: number,
  callback: Function,
  allowNegativeBrackets = false
) {
  // here `nextToken` is any token, not necessarily a meaningful one
  let nextToken = tokens[indexShift];

  // unpacking with curly braces is not possible
  const openingBrackets = '([';
  const closingBrackets = ')]';
  let openedBrackets = 0;

  // value of token is equal to an empty string for line breaks

  // a line break is the latest when the search should terminate,
  // unless the left-hand tuple is spread over several lines (in brackets)
  while (nextToken && (nextToken.value !== '' || openedBrackets > 0)) {
    if (nextToken.value === '') {
      // ignoring new-lines (when within brackets)
    } else if (openingBrackets.includes(nextToken.value)) {
      openedBrackets += 1;
    } else if (
      closingBrackets.includes(nextToken.value) &&
      (allowNegativeBrackets || openedBrackets > 0)
    ) {
      openedBrackets -= 1;
    } else if (nextToken.value === ' ' || nextToken.value === '\t') {
      // ignoring whitespaces
    } else {
      let result = callback(nextToken, indexShift);
      if (result !== undefined) return result;
    }
    indexShift += 1;
    nextToken = tokens[indexShift];
  }

  return false;
}

const python_setup = `
import json
from pathlib import Path

def jupyter_lab_consumable_path(path):
    # if the definition is in current notebook, the path is not known on the kernel side
    if not path:
        return {'path': None, 'is_symlink': False}

    path = Path(path)
    cwd = Path.cwd()

    # the simple case
    if cwd in path.parents:
        return {
            'path': str(path.relative_to(cwd)),
            'is_symlink': False
        }

    symlinks_dir = Path('.jupyter_symlinks')
    symlinks_dir.mkdir(exist_ok=True)
    # relative pathways could lead out of the starting dir as well (e.g. using .. construct on Linux)
    path = path.absolute().resolve()

    # remove anchor (root slash/drive etc)
    sub_path = path.relative_to(path.anchor)

    # TODO: add drive to avoid confusion on Windows
    symlink = symlinks_dir / sub_path
    symlink.parent.mkdir(exist_ok=True, parents=True)
    try:
        symlink.unlink()
    except FileNotFoundError:
        pass
    assert not symlink.is_absolute()
    symlink.symlink_to(path)
    return {
        'path': str(symlink),
        'is_symlink': True
    }
`;

export class PythonAnalyzer extends LanguageWithOptionalSemicolons {
  // idea for improvement:
  //  rename Analyzer to RuleTester, define class Rule, make Rule instances take a callback on init,
  //  possibly add a string with rule's name (it could be displayed as "defined in >for< loop, line 9",
  //  or "imported from xyz module" and in case of multiple hits, user could choose which one to jump to),
  //  and make the rules interface the way to go for other languages.
  definitionRules = [
    this.isStandaloneAssignment,
    this.isImport,
    this.isWithStatement,
    this.isForLoopOrComprehension,
    this.isTupleUnpacking,
    this.isStoreMagic,
    this.isRMagicOutput
  ];

  // Matching standalone variable assignment:
  isStandaloneAssignment(siblings: TokenContext) {
    let { next } = siblings;

    return next.exists && this.isAssignment(next);
  }

  _is_magic_switch(candidate: TokenContext, key: string, max_args = 20) {
    while (max_args && candidate.exists) {
      if (candidate.value === key && candidate.simple_previous === '-') {
        break;
      }
      candidate = candidate.previous;
      max_args -= 1;
    }

    let is_switch = max_args !== 0;

    return {
      is_switch: is_switch,
      switch: is_switch ? candidate : null
    };
  }

  _is_magic_export(
    context: TokenContext,
    magic: string,
    export_arg: string,
    nargs: number = 1
  ) {
    let { previous } = context;

    let switch_test = this._is_magic_switch(previous, export_arg, nargs);
    if (!switch_test.is_switch) return false;

    let magic_token = switch_test.switch.previous.previous;
    let percent = magic_token.simple_previous;
    return magic_token.value === magic && percent === '%';
  }

  // IPython %store -r magic:
  isStoreMagic(context: TokenContext) {
    return this._is_magic_export(context, 'store', 'r', 20);
  }

  isRMagicOutput(context: TokenContext) {
    return this._is_magic_export(context, 'R', 'o', 1);
  }

  // Matching imports:
  isImport(context: TokenContext) {
    let { previous } = context;

    return (
      previous.exists &&
      previous.type === 'keyword' &&
      previous.value === 'import'
    );
  }

  isCrossFileReference(context: TokenContext): boolean {
    // from a import b; from a.b import c

    let previous = context.previous;
    let next = context.next;

    previous = this.traverse_left(previous, '.');
    next = this.traverse_right(next, '.');

    if (
      previous.exists &&
      previous.type == 'keyword' &&
      previous.value == 'from' &&
      next.exists &&
      next.type === 'keyword' &&
      next.value === 'import'
    )
      return true;

    // import x, import a.b

    let before_previous = previous.previous.previous;

    if (
      this.isImport(previous.next) &&
      !(
        before_previous.exists &&
        before_previous.type === 'keyword' &&
        before_previous.value === 'from'
      )
    )
      return true;

    return false;
  }

  supportsKernel = true;

  _breadcrumbs(context: TokenContext, allow_import_dots_upfront = false) {
    let { previous, token } = context;

    let parts: string[] = [];
    let is_dot = previous.simple_next === '.';

    while (is_dot && previous.exists) {
      parts.push(previous.value);
      previous = previous.previous;
      is_dot = previous.simple_next === '.';
    }

    if (allow_import_dots_upfront) {
      // relative imports
      if (previous.simple_previous === '.') {
        parts.push('');
      }
      if (previous.simple_previous === '..') {
        parts.push('.');
      }
    }

    parts = parts.reverse();

    parts.push(token.value);

    return parts;
  }

  _imports_breadcrumbs(context: TokenContext) {
    return this._breadcrumbs(context, true);
  }

  definitionLocationQuery(context: TokenContext) {
    let parts = this._breadcrumbs(context);
    let value = parts.join('.');

    if (/^[a-zA-Z_.]+$/.test(value)) {
      return (
        python_setup +
        `

def _extract_object(breadcrumbs, available_objects):
    obj = available_objects[breadcrumbs[0]]

    for name in breadcrumbs[1:]:
        obj = getattr(obj, name)
    return obj


def _locate_definition(name):
    """Returns (line_number, path, is_sym_link) tuple"""
    from inspect import getsourcefile, getsourcelines

    available_objects = globals()
    input_number = None

    try:
        obj = _extract_object(name.split('.'), available_objects)
    except (KeyError, AttributeError):
        return

    try:
        path = getsourcefile(obj)
        path_exists = Path(path).exists()
        if not path_exists:
            assert path.startswith('<ipython-input-')
            input_number = int(path.split('-')[2])
            path = None
    except (TypeError, AssertionError):
        path = None

    try:
        source, line_number = getsourcelines(obj)
    except OSError:
        line_number = 0

    return {
        'line_number': line_number,
        'input_number': input_number,
        'column': len(source[0]) - len(source[0].lstrip()),
        **jupyter_lab_consumable_path(path)
    } 

print(json.dumps(_locate_definition('` +
        value +
        `')), end='')
`
      );
    }
  }

  referencePathQuery(context: TokenContext) {
    let parts = this._imports_breadcrumbs(context);
    let value = parts.join('.');

    // TODO: recognize Python version and return no query (or another Python2-compatible query)

    if (/^[a-zA-Z_.]+$/.test(value)) {
      // just in case to prevent arbitrary execution
      return (
        python_setup +
        `
def _get_path(value):
    """Returns (path, is_sym_link) tuple"""
    from importlib.util import find_spec

    path = find_spec(value).origin

    return jupyter_lab_consumable_path(path)

print(json.dumps(_get_path('` +
        value +
        `')), end='')
`
      );
    }
  }

  guessReferencePath(context: TokenContext) {
    let parts = this._imports_breadcrumbs(context);
    let prefix = parts.join('/');
    return [prefix + '.py', PathExt.join(prefix, '__init__.py')];
  }

  // Matching `as`:
  // e.g. `with open('name') as f:` or `except Exception as e:`
  isWithStatement(context: TokenContext) {
    let { previous } = context;
    return (
      previous.exists && previous.type === 'keyword' && previous.value === 'as'
    );
  }

  // Matching `for` loop and comprehensions:
  isForLoopOrComprehension(context: TokenContext) {
    let { previous, next } = context;
    return (
      previous.exists &&
      previous.type === 'keyword' &&
      previous.value === 'for' &&
      next.exists &&
      next.type === 'keyword' &&
      next.value === 'in'
    );
  }

  isTupleUnpacking(context: TokenContext) {
    // Matching variables in tuple unpacking:
    let { tokens, index } = context;

    // Considering: `a, [b, c], (d, ) = 1, [1, 2], (1,)`, if the tested
    // token is `a`, then the next expected token would be a comma,
    // and then one of following: a variable, an assignment symbol,
    // or an opening bracket (for simplicity brackets can be ignored).
    let commaExpected = true;

    return evaluateSkippingBrackets(
      tokens,
      index + 1,
      (nextToken: IToken, indexShift: number) => {
        if (nextToken.type === 'operator' && nextToken.value === '=') {
          let lastToken: IToken;

          evaluateSkippingBrackets(
            tokens,
            indexShift + 1,
            (nextToken: IToken) => {
              lastToken = nextToken;
            }
          );

          // return true unless in a function call
          if (!lastToken || lastToken.value !== ')') return true;
        }

        if (commaExpected && nextToken.value !== ',') {
          return false;
        }

        commaExpected = !commaExpected;
      },
      true
    );
  }
}
