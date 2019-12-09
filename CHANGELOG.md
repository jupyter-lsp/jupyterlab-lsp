# CHANGELOG

## `lsp-ws-connection` (unreleased)

- infrastructure
  - brought into monorepo
- dev
  - allows `initializeParams` to be overloaded by subclasses
  - adopts
    - typescript 3.7
    - prettier
    - tslint

## `jupyter-lsp` (unreleased)

- features
  - adds a language server status endpoint (
    [#81](https://github.com/krassowski/jupyterlab-lsp/pull/81)
    )
  - adds more descriptive information to the language server spec (
    [#90](https://github.com/krassowski/jupyterlab-lsp/pulls/100)
    )
  - adds an extensible listener API (
    [#99](https://github.com/krassowski/jupyterlab-lsp/issues/99),
    [#100](https://github.com/krassowski/jupyterlab-lsp/pulls/100)
    )

## `@krassowski/jupyterlab-lsp 0.6.1`

- features
  - adds an indicator to the statusbar
- dependencies
  - removes unused npm dependencies

## `@krassowski/jupyterlab-lsp 0.6.0`

- features
  - allows "rename" action in file editor
  - and many other improvements, see the [release notes](https://github.com/krassowski/jupyterlab-lsp/releases/tag/v0.6.0)
- bugfixes
  - handles some non-standard diagnostic responses
- testing
  - adds browser-based testing for file editor
- dependencies
  - requires `jupyter-lsp`

## `jupyter-lsp 0.6.0b0`

- features
  - starts language servers on demand
  - accepts configuration via Jupyter config system (traitlets) and python
    `entry_point`s
  - autodetects language servers for bash, CSS, LESS, SASS, Dockerfile, YAML, JS,
    TypeScript, JSX, TSX, JSON, YAML
