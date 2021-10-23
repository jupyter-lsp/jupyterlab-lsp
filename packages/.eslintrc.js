module.exports = {
  env: {
    browser: true,
    es6: true,
    commonjs: true,
    node: true,
    'jest/globals': true
  },
  globals: { JSX: 'readonly' },
  root: true,
  extends: [
    'eslint:recommended',
    'plugin:import/errors',
    'plugin:import/warnings',
    'plugin:import/typescript',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier/@typescript-eslint',
    'plugin:react/recommended',
    'plugin:jest/recommended'
  ],
  ignorePatterns: [
    '**/node_modules/**/*',
    'python_packages/jupyterlab_lsp/jupyterlab_lsp/labextensions/**/*',
    '**/lib/**/*',
    '**/_*.ts',
    '**/_*.d.ts',
    '**/typings/**/*.d.ts',
    '**/dist/*',
    'packages/.eslintrc.js'
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'packages/tsconfig.eslint.json'
  },
  plugins: ['@typescript-eslint', 'jest', 'import'],
  rules: {
    '@typescript-eslint/camelcase': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-empty-interface': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-floating-promises': ['error', { ignoreVoid: true }],
    '@typescript-eslint/no-inferrable-types': 'off',
    '@typescript-eslint/no-namespace': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { args: 'none' }],
    '@typescript-eslint/no-use-before-define': 'off',
    '@typescript-eslint/no-var-requires': 'off',
    'jest/expect-expect': 'off',
    'jest/no-export': 'warn',
    'jest/no-jest-import': 'off',
    'jest/no-try-expect': 'warn',
    'no-case-declarations': 'warn',
    'no-control-regex': 'warn',
    'no-inner-declarations': 'off',
    'no-prototype-builtins': 'off',
    'no-undef': 'warn',
    'no-useless-escape': 'off',
    'prefer-const': 'off',
    'import/no-unresolved': 'off',
    // the default, but for reference...
    'import/order': [
      'warn',
      {
        groups: [
          'builtin',
          'external',
          'parent',
          'sibling',
          'index',
          'object',
          'unknown'
        ],
        pathGroups: [
          { pattern: 'react/**', group: 'builtin', order: 'after' },
          { pattern: 'codemirror/**', group: 'external', order: 'before' },
          { pattern: '@lumino/**', group: 'external', order: 'before' },
          { pattern: '@jupyterlab/**', group: 'external', order: 'after' }
        ],
        'newlines-between': 'always',
        alphabetize: { order: 'asc' }
      }
    ],
    // deviations from jupyterlab, should probably be fixed
    'import/no-cycle': 'off', // somehow we lapsed here... ~200 cycles now
    'import/export': 'off', // we do class/interface + NS pun exports _all over_
    '@typescript-eslint/triple-slash-reference': 'off',
    'jest/no-test-callback': 'off',
    'jest/valid-expect': 'off',
    'no-async-promise-executor': 'off',
    'prefer-spread': 'off',
    'react/display-name': 'off',
    // TODO: re-enable once the lsp-ws-connection tests are re-written to jest
    'jest/no-done-callback': 'off'
  },
  settings: {
    react: {
      version: 'detect'
    }
  }
};
