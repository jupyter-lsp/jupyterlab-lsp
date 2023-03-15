const func = require('@jupyterlab/testutils/lib/jest-config');
const upstream = func('jupyterlab-lsp', __dirname);

const reuseFromUpstream = [
  'moduleFileExtensions',
  'moduleNameMapper',
  'setupFilesAfterEnv',
  'testPathIgnorePatterns'
];

const esModules = [
  '@jupyterlab/',
  '@retrolab/',
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
  transformIgnorePatterns: [`/node_modules/(?!${esModules}).*`],
  testLocationInResults: true,
  reporters: [...upstream['reporters'], 'jest-github-actions-reporter'],
  setupFiles: [
    ...upstream['setupFiles'],
    '@jupyter-lsp/jupyterlab-lsp/lib/jest-shim.js'
  ]
};

for (const option of reuseFromUpstream) {
  local[option] = upstream[option];
}

module.exports = local;
