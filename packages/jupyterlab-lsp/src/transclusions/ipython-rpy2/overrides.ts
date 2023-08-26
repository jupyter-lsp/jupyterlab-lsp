import { IScopedCodeOverride } from '../../overrides/tokens';
import { LINE_MAGIC_PREFIX } from '../ipython/overrides';

import {
  RPY2_MAX_ARGS,
  parseArgs,
  argsPattern,
  reversePattern,
  reverseReplacement
} from './rpy2';

export let overrides: IScopedCodeOverride[] = [
  {
    // support up to 10 arguments
    pattern:
      LINE_MAGIC_PREFIX + '%R' + argsPattern(RPY2_MAX_ARGS) + '( .*)?(\n|$)',
    replacement: (match, prefix, ...args) => {
      let r = parseArgs(args, -4);
      // note: only supports assignment or -o/--output, not both
      // TODO assignment like in x = %R 1 should be distinguished from -o
      return `${prefix}${r.outputs}rpy2.ipython.rmagic.RMagics.R("${
        r.content || ''
      }", "${r.others}"${r.inputs})`;
    },
    scope: 'line',
    reverse: {
      pattern: reversePattern(),
      replacement: (match, ...args) => {
        let r = reverseReplacement(match, ...args);
        return '%R' + r.input + r.output + r.other + r.contents;
      },
      scope: 'line'
    }
  },
  // rpy2 extension R magic - this should likely go as an example to the user documentation, rather than being a default
  //   only handles simple one input - one output case
  {
    pattern: '^%%R' + argsPattern(RPY2_MAX_ARGS) + '(\n)?([\\s\\S]*)',
    replacement: (match, ...args) => {
      let r = parseArgs(args, -3);
      return `${r.outputs}rpy2.ipython.rmagic.RMagics.R("""${r.content}""", "${r.others}"${r.inputs})`;
    },
    scope: 'cell',
    reverse: {
      pattern: reversePattern('"""', true),
      replacement: (match, ...args) => {
        let r = reverseReplacement(match, ...args);
        return '%%R' + r.input + r.output + r.other + '\n' + r.contents;
      },
      scope: 'cell'
    }
  },
  {
    pattern: LINE_MAGIC_PREFIX + '%Rdevice( .*)?(\n|$)',
    replacement: (match, prefix, ...args) => {
      return `${prefix}rpy2.ipython.rmagic.RMagics.Rdevice("${args[0]}", "")`;
    },
    scope: 'line',
    reverse: {
      pattern: reversePattern('"', false, 'Rdevice'),
      replacement: (match, ...args) => {
        let r = reverseReplacement(match, ...args);
        return '%Rdevice' + r.input + r.output + r.other + r.contents;
      },
      scope: 'line'
    }
  }
];
