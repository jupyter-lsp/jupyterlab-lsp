const func = require('@jupyterlab/testing/lib/jest-config');
const upstream = func('jupyterlab-lsp', __dirname);

const reuseFromUpstream = [
  'moduleFileExtensions',
  'moduleNameMapper',
  'reporters',
  'setupFiles',
  'setupFilesAfterEnv'
];

const esModules = [
  '@microsoft',
  '@jupyter/react-components',
  '@jupyter/web-components',
  'exenv-es6',
  '@jupyterlab/',
  'lib0',
  'y\\-protocols',
  'y\\-websocket',
  '@jupyter/ydoc',
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
  transformIgnorePatterns: [`/node_modules/(?!${esModules}).*`]
};

for (const option of reuseFromUpstream) {
  local[option] = upstream[option];
}

module.exports = local;
