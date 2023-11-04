import { IScopedCodeOverride } from '../../overrides/tokens';

function escape(x: string) {
  return x.replace(/(["\\])/g, '\\$1');
}

function unescape(x: string) {
  return x.replace(/\\([\\"])/g, '$1');
}

function emptyOrEscaped(x: string) {
  if (!x) {
    return '';
  } else {
    return escape(x);
  }
}

const MAGICS_TO_UNWRAP = ['time', 'capture'];

function unwrapCellMagic(name: string, firstLine: string, content: string) {
  return `# START_CELL_MAGIC("${name}", "${firstLine}")
${content}
# END_CELL_MAGIC`;
}

/**
 * Line magics do not have to start with the new line, for example:
 *    x = !ls
 *    x = %ls
 *    x =%ls
 * are all valid.
 *
 * The percent may also appear in strings, e.g. ls('%').
 *
 * IPython allows magics on start of a line or in assignments (but only there!), thus:
 *    x = (!ls)
 * is invalid syntax!
 *
 * Therefore we can require that the match starts with either:
 * - zero or more whitespaces right after the beginning of a line, or
 * - variable then equals (with optional whitespaces)
 *
 * This will not always work: e.g.:
 *    x['a = !ls'] = !ls
 * is perfectly valid IPython, but regular expressions cannot help here.
 *
 * Look behind could be used to avoid capturing the group,
 * but at the time of writing support is only at 77%.
 */
export const LINE_MAGIC_PREFIX = '^(\\s*|\\s*\\S+\\s*=\\s*)';

export const PYTHON_IDENTIFIER = '([^?\\s\'"\\(\\)-\\+\\/#]+)';

export let overrides: IScopedCodeOverride[] = [
  /**
   * Line magics
   */
  // filter out IPython line magics and shell assignments:
  //  keep the content, keep magic/command name and new line at the end
  {
    pattern: LINE_MAGIC_PREFIX + '!([^=\\s]+)(.*)(\n)?',
    replacement: '$1get_ipython().getoutput("$2$3")$4',
    scope: 'line',
    reverse: {
      pattern: 'get_ipython\\(\\).getoutput\\("(.*?)"\\)(\n)?',
      replacement: '!$1$2',
      scope: 'line'
    }
  },
  {
    // note: assignments of pinfo/pinfo2 are not supported by IPython
    // and only "simple" identifiers are supported, i.e.
    //    ?x['a']
    // would not be solved, leading to "Object `x['a']` not found."
    pattern: '^(\\s*)' + '(\\?{1,2})' + PYTHON_IDENTIFIER + '(\n)?$',
    replacement: (match, prefix, marks, name, lineBreak) => {
      const cmd = marks == '?' ? 'pinfo' : 'pinfo2';
      lineBreak = lineBreak || '';
      // trick: use single quotes to distinguish
      return `${prefix}get_ipython().run_line_magic(\'${cmd}\', \'${name}\')${lineBreak}`;
    },
    scope: 'line',
    reverse: {
      pattern:
        "get_ipython\\(\\).run_line_magic\\('(pinfo2?)', '(.*?)'\\)(\n)?",
      replacement: (match, cmd, name) => {
        const marks = cmd == 'pinfo' ? '?' : '??';
        return `${marks}${name}`;
      },
      scope: 'line'
    }
  },
  {
    pattern: '^(\\s*)' + PYTHON_IDENTIFIER + '(\\?{1,2})(\n)?',
    replacement: (match, prefix, name, marks, lineBreak) => {
      const cmd = marks == '?' ? 'pinfo' : 'pinfo2';
      lineBreak = lineBreak || '';
      // trick: use two spaces to distinguish pinfo using suffix (int?) from the one using prefix (?int)
      return `${prefix}get_ipython().run_line_magic(\'${cmd}\',  \'${name}\')${lineBreak}`;
    },
    scope: 'line',
    reverse: {
      pattern:
        "get_ipython\\(\\).run_line_magic\\('(pinfo2?)',  '(.*?)'\\)(\n)?",
      replacement: (match, cmd, name) => {
        const marks = cmd == 'pinfo' ? '?' : '??';
        return `${name}${marks}`;
      },
      scope: 'line'
    }
  },
  {
    pattern: LINE_MAGIC_PREFIX + '%(\\S+)(.*)(\n)?',
    replacement: (match, prefix, name, args, lineBreak) => {
      args = emptyOrEscaped(args);
      lineBreak = lineBreak || '';
      return `${prefix}get_ipython().run_line_magic("${name}", "${args}")${lineBreak}`;
    },
    scope: 'line',
    reverse: {
      pattern: 'get_ipython\\(\\).run_line_magic\\("(.*?)", "(.*?)"\\)(\n)?',
      replacement: (match, name, args) => {
        args = unescape(args);
        return `%${name}${args}`;
      },
      scope: 'line'
    }
  },
  /**
   * Cell magics
   */
  {
    pattern: '^%%(\\S+)(.*\n)([\\s\\S]*)',
    replacement: (match, name, firstLine, content, offset, entire) => {
      firstLine = emptyOrEscaped(firstLine);
      if (firstLine) {
        // remove the new line
        firstLine = firstLine.slice(0, -1);
      }
      content = content.replace(/"""/g, '\\"\\"\\"');

      let replaced: string;
      if (MAGICS_TO_UNWRAP.includes(name)) {
        replaced = unwrapCellMagic(name, firstLine, content);
      } else {
        replaced = `get_ipython().run_cell_magic("${name}", "${firstLine}", """${content}""")`;
      }
      return replaced;
    },
    scope: 'cell',
    reverse: {
      pattern: '^get_ipython[\\s\\S]*|^# START_CELL_MAGIC[\\s\\S]*',
      replacement: code => {
        const regCellMagic = RegExp(
          '^get_ipython\\(\\).run_cell_magic\\("(.*?)", "(.*?)", """([\\s\\S]*)"""\\)'
        );
        const regUnwrapped = RegExp(
          '^# START_CELL_MAGIC\\("(.*?)", "(.*?)"\\)\\n([\\s\\S]*)\\n# END_CELL_MAGIC$'
        );
        let m = code.match(regCellMagic) || code.match(regUnwrapped);
        let [name, line, content] = m?.slice(1, 4) || ['', '', ''];
        content = content.replace(/\\"\\"\\"/g, '"""');
        line = unescape(line);
        return `%%${name}${line}\n${content}`;
      },
      scope: 'cell'
    }
  }
];
