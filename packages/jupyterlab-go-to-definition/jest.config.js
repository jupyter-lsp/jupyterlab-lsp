const func = require('@jupyterlab/testutils/lib/jest-config');
const upstream = func('jupyterlab-lsp', __dirname);

const reuseFromUpstream = [
  'moduleFileExtensions',
  'moduleNameMapper',
  'reporters',
  'setupFiles',
  'setupFilesAfterEnv'
];

let local = {
  globals: { 'ts-jest': { tsconfig: 'tsconfig.json' } },
  testRegex: `.*\.spec\.tsx?$`,
  transform: {
    '\\.(ts|tsx)?$': 'ts-jest',
    '\\.(js|jsx)?$': './transform.js',
    '\\.svg$': 'jest-raw-loader'
  },
  transformIgnorePatterns: ['/node_modules/(?!(@jupyterlab/.*)/)']
};

for (const option of reuseFromUpstream) {
  local[option] = upstream[option];
}

module.exports = local;
