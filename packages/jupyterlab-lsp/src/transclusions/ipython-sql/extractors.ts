import { RegExpForeignCodeExtractor } from '../../extractors/regexp';
import { IForeignCodeExtractorsRegistry } from '../../extractors/types';

export const SQL_URL_PATTERN = '(?:(?:.*?)://(?:.*))';
// note: -a/--connection_arguments and -f/--file are not supported yet
const singleArgumentOptions = [
  '-x',
  '--close',
  '-c',
  '--creator',
  '-p',
  '--persist',
  '--append'
];
const zeroArgumentOptions = ['-l', '--connections'];

const COMMAND_PATTERN =
  '(?:' +
  (zeroArgumentOptions.join('|') +
    '|' +
    singleArgumentOptions.map(command => command + ' \\w+').join('|')) +
  ')';

export let foreignCodeExtractors: IForeignCodeExtractorsRegistry = {
  // general note: to match new lines use [^] instead of dot, unless the target is ES2018, then use /s
  python: [
    new RegExpForeignCodeExtractor({
      language: 'sql',
      pattern: `^%%sql(?: (?:${SQL_URL_PATTERN}|${COMMAND_PATTERN}|(?:\\w+ << )|(?:\\w+@\\w+)))?\n?((?:.+\n)?(?:[^]*))`,
      foreignCaptureGroups: [1],
      isStandalone: true,
      fileExtension: 'sql'
    }),
    new RegExpForeignCodeExtractor({
      language: 'sql',
      pattern: `(?:^|\n)%sql (?:${SQL_URL_PATTERN}|${COMMAND_PATTERN}|(.*))\n?`,
      foreignCaptureGroups: [1],
      isStandalone: false,
      fileExtension: 'sql'
    })
  ]
};
