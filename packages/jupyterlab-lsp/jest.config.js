const func = require('@jupyterlab/testutils/lib/jest-config');
const upstream = func('jupyterlab-lsp', __dirname);

const reuseFromUpstream = [
  'moduleFileExtensions',
  'moduleNameMapper',
  'setupFiles',
  'setupFilesAfterEnv',
  'testPathIgnorePatterns'
];

const esModules = [
  '@jupyterlab/',
  '@retrolab/',
  'lib0',
  'y\\-protocols',
  'y\\-websocket',
  'yjs'
].join('|');

let local = {
  globals: { 'ts-jest': { tsconfig: 'tsconfig.json' } },
  testRegex: `.*\.spec\.tsx?$`,
  transform: {
    '\\.(ts|tsx)?$': 'ts-jest',
    '\\.(js|jsx)?$': './transform.js',
    '\\.svg$': 'jest-raw-loader'
  },
  transformIgnorePatterns: [`/node_modules/(?!${esModules}).+`],
  testLocationInResults: true,
  reporters: [...upstream['reporters'], 'jest-github-actions-reporter']
};

for (const option of reuseFromUpstream) {
  local[option] = upstream[option];
}

module.exports = local;
