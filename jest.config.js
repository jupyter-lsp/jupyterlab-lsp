const func = require('@jupyterlab/testutils/lib/jest-config');
const upstream = func('jupyterlab_go_to_definition', __dirname);

const reuseFromUpstream = [
  'moduleNameMapper',
  'setupFilesAfterEnv',
  'setupFiles',
  'moduleFileExtensions'
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
