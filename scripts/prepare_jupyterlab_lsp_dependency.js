#!/usr/bin/env node

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LSP_PACKAGE = path.join(ROOT, 'node_modules', '@jupyterlab', 'lsp');
const LSP_PACKAGE_JSON = path.join(LSP_PACKAGE, 'package.json');
const LSP_SOURCE = path.join(LSP_PACKAGE, 'src');
const LSP_LIB = path.join(LSP_PACKAGE, 'lib');
const LSP_NODE_MODULES = path.join(LSP_PACKAGE, 'node_modules');

// Temporary support for testing jupyterlab/jupyterlab#19067 before
// @jupyterlab/lsp is released. The git workspace dependency is installed from
// source, so CI needs a built lib/ directory and must avoid nested Jupyter/Lumino
// copies that break singleton token/type identity in this repo's tests.
if (!fs.existsSync(LSP_PACKAGE_JSON)) {
  console.error('Missing @jupyterlab/lsp dependency. Run jlpm install first.');
  process.exit(1);
}

if (!fs.existsSync(LSP_SOURCE)) {
  process.exit(0);
}

for (const packageScope of [
  '@codemirror',
  '@jupyter',
  '@jupyterlab',
  '@lezer',
  '@lumino'
]) {
  fs.rmSync(path.join(LSP_NODE_MODULES, packageScope), {
    force: true,
    recursive: true
  });
}

const indexDeclaration = path.join(LSP_LIB, 'index.d.ts');
const tokensDeclaration = path.join(LSP_LIB, 'tokens.d.ts');
if (fs.existsSync(indexDeclaration) && fs.existsSync(tokensDeclaration)) {
  process.exit(0);
}

const tsconfigPath = path.join(LSP_PACKAGE, 'tsconfig.build.json');
if (!fs.existsSync(tsconfigPath)) {
  const tsconfig = {
    compilerOptions: {
      allowSyntheticDefaultImports: true,
      alwaysStrict: true,
      declaration: true,
      esModuleInterop: true,
      incremental: false,
      jsx: 'react',
      lib: [
        'DOM',
        'DOM.Iterable',
        'ES2018',
        'ES2020.BigInt',
        'ES2020.Intl',
        'ES2020.String'
      ],
      module: 'esnext',
      moduleResolution: 'node',
      noEmitOnError: true,
      noImplicitAny: true,
      noImplicitThis: true,
      noUnusedLocals: true,
      outDir: 'lib',
      preserveWatchOutput: true,
      resolveJsonModule: true,
      rootDir: 'src',
      skipLibCheck: true,
      sourceMap: true,
      strictBindCallApply: true,
      strictNullChecks: true,
      target: 'ES2018',
      types: [],
      verbatimModuleSyntax: true
    },
    include: ['src/**/*']
  };

  fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2));
}

const tsc = path.join(
  ROOT,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'tsc.cmd' : 'tsc'
);
execFileSync(tsc, ['-p', tsconfigPath], {
  cwd: LSP_PACKAGE,
  stdio: 'inherit'
});
