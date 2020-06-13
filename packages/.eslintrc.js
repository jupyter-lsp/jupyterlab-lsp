module.exports = {
  env: {
    browser: true,
    es6: true,
    commonjs: true,
    node: true,
    'jest/globals': true
  },
  root: true,
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier/@typescript-eslint',
    'plugin:react/recommended',
    'plugin:jest/recommended'
  ],
  ignorePatterns: [
    '**/node_modules/**/*',
    '**/lib/**/*',
    '**/_*.ts',
    '**/_*.d.ts',
    '**/typings/**/*.d.ts',
    '**/dist/*'
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'packages/tsconfig.eslint.json'
  },
  plugins: ['@typescript-eslint', 'jest'],
  rules: {
    '@typescript-eslint/ban-ts-ignore': 'warn',
    '@typescript-eslint/camelcase': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/interface-name-prefix': [
      'error',
      { prefixWithI: 'always' }
    ],
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
    // deviations from jupyterlab, should probably be fixed
    'jest/valid-expect': 'off',
    'jest/no-test-callback': 'off',
    '@typescript-eslint/ban-ts-ignore': 'off',
    'react/display-name': 'off',
    'prefer-spread': 'off',
    '@typescript-eslint/triple-slash-reference': 'off',
    'no-async-promise-executor': 'off'
  },
  settings: {
    react: {
      version: 'detect'
    }
  }
};
