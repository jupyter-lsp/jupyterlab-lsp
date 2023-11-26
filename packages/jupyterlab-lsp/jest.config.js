const func = require('@jupyterlab/testing/lib/jest-config');
const upstream = func('jupyterlab-lsp', __dirname);

const reuseFromUpstream = [
  'moduleFileExtensions',
  'moduleNameMapper',
  'setupFilesAfterEnv',
  'testPathIgnorePatterns',
  'setupFiles',
  'testEnvironment'
];

const esModules = [
  '@jupyterlab/',
  '@jupyter-notebook/',
  'lib0',
  'nanoid',
  'vscode-ws-jsonrpc',
  'y\\-protocols',
  'y\\-websocket',
  '@jupyter/ydoc',
  'yjs'
].join('|');

let local = {
  testRegex: `.*\.spec\.tsx?$`,
  transformIgnorePatterns: [`/node_modules/(?!${esModules}).*`],
  testLocationInResults: true,
  transform: {
    '\\.(ts|tsx)?$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
    '\\.(js|jsx)?$': './transform.js',
    '\\.svg$': '@jupyterlab/testing/lib/jest-raw-loader.js'
  },
  reporters: [
    ...new Set([...upstream['reporters'], 'github-actions', 'summary'])
  ]
};

for (const option of reuseFromUpstream) {
  local[option] = upstream[option];
}

module.exports = local;
