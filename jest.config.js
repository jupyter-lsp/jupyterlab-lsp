const func = require('@jupyterlab/testutils/lib/jest-config');
const upstream = func('jupyterlab-lsp', __dirname);

const reuseFromUpstream = [
  'moduleFileExtensions',
  'moduleNameMapper',
  'reporters',
  'setupFiles',
  'setupFilesAfterEnv',
];

let local = {
  globals: { 'ts-jest': { tsConfig: 'tsconfig.json' } },
  testRegex: `.*\.spec\.tsx?$`,
  transform: {
    '\\.(ts|tsx)?$': 'ts-jest',
    '\\.(js|jsx)?$': './transform.js'
  },
  transformIgnorePatterns: ['/node_modules/(?!(@jupyterlab/.*)/)']
};

for (option of reuseFromUpstream) {
  local[option] = upstream[option];
}

module.exports = local;
