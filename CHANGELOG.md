# CHANGELOG

## `@krassowski/jupyterlab-lsp 0.7.0-beta.1`

- features
  - reduced space taken up by the statusbar indicator
  - implemented statusbar popover with connections statuses
  - generates types for server data responses from JSON schema (
    [#110](https://github.com/krassowski/jupyterlab-lsp/pull/110)
    )
  - added 'rename' function for notebooks, using shadow filesystem (
    [#115](https://github.com/krassowski/jupyterlab-lsp/pull/115)
    )
  - added a UX workaround for rope rename issues when there is a
    SyntaxError in the Python code (
    [#129](https://github.com/krassowski/jupyterlab-lsp/pull/129)
    )
  - added a widget panel with diagnostics (inspections), allowing to
    sort and explore diagnostics, and to go-to the respective location
    in code (on click); accessible from the context menu (
    [#127](https://github.com/krassowski/jupyterlab-lsp/pull/127)
    )
- bugfixes
  - diagnostics in foreign documents are now correctly updated (
    [133fd3d](https://github.com/krassowski/jupyterlab-lsp/pull/129/commits/133fd3d71401c7e5affc0a8637ee157de65bef62)
    )
  - diagnostics are now always correctly displayed in the document they were intended for
  - the workaround for relative root path is now also applied on Mac (
    [#139](https://github.com/krassowski/jupyterlab-lsp/pull/139)
    )

## `lsp-ws-connection 0.3.0`

- infrastructure
  - brought into monorepo [#107](https://github.com/krassowski/jupyterlab-lsp/pull/107)
- dev
  - allows `initializeParams` to be overloaded by subclasses
  - adopts
    - typescript 3.7
    - prettier
    - tslint
  - added initialization checks before executing sendChange to comply
    with LSP specs [#115](https://github.com/krassowski/jupyterlab-lsp/pull/115)

## `jupyter-lsp 0.7.0b0`

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
