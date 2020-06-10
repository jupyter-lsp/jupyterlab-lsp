## CHANGELOG

### `@krassowski/jupyterlab-lsp 1.0.1` (unreleased)

- bug fixes

  - fixes currently-highlighted token in dark editor themes against light lab theme
    (and vice versa) ([#195][])
  - restores sorting order-indicating caret icons in diagnostics panel table ([#261][])

[#195]: https://github.com/krassowski/jupyterlab-lsp/issues/195
[#261]: https://github.com/krassowski/jupyterlab-lsp/issues/261

### `@krassowski/jupyterlab-lsp 1.0.0` (2020-03-14)

- features

  - supports JupyterLab 2.0

### `@krassowski/jupyterlab_go_to_definition 1.0.0` (2020-03-14)

- features

  - supports JupyterLab 2.0

### `@krassowski/jupyterlab-lsp 0.8.0` (2020-03-12)

- features

  - opens a maximum of one WebSocket per language server ([#165][], [#199][])
  - lazy-loads language server protocol machinery ([#165][])
  - waits much longer for slow-starting language servers ([#165][])
  - cleans up documents, handlers, events, and signals more aggressively ([#165][])
  - ignores malformed diagnostic ranges, enabling markdown support ([#165][])
  - passes tests on Python 3.8 on Windows ([#165][])
  - improves support for rpy2 magic cells with parameters (
    [#206](https://github.com/krassowski/jupyterlab-lsp/pull/206)
    )

- bug fixes

  - reports files are open only after installing all handlers to avoid missing messages ([#201][])

[#201]: https://github.com/krassowski/jupyterlab-lsp/issues/201

### `lsp-ws-connection 0.4.0` (2020-03-12)

- breaking changes

  - no longer assumes one document per connection ([#165][])
  - requires documents be opened explicitly ([#165][])
  - use of the `eventEmitter` pattern mostly deprecated in favor of `Promise`s
    ([#165][])

[#165]: https://github.com/krassowski/jupyterlab-lsp/pull/165

### `jupyter-lsp 0.8.0` (2020-03-12)

- breaking changes

  - websockets are now serviced by implementation key, rather than language
    under `lsp/ws/<server key>` ([#199][])
  - introduces schema version `2`, reporting status by server at `lsp/status` ([#199][])

- bugfixes:
  - handles language server reading/writing and shadow file operations in threads ([#199][])

[#199]: https://github.com/krassowski/jupyterlab-lsp/pull/199

### `jupyter-lsp 0.7.0`

- bugfixes
  - didSave no longer causes unwanted messages in logs (
    [#187](https://github.com/krassowski/jupyterlab-lsp/pull/187)
    )

### `@krassowski/jupyterlab-lsp 0.7.1`

- features

  - users can now choose which columns to display
    in the diagnostic panel, using a context menu action (
    [#159](https://github.com/krassowski/jupyterlab-lsp/pull/159)
    )
  - start the diagnostics panel docked at the bottom and improve
    the re-spawning of the diagnostics panel (
    [#166](https://github.com/krassowski/jupyterlab-lsp/pull/166)
    )

- bugfixes

  - fixed various small bugs in the completer (
    [#162](https://github.com/krassowski/jupyterlab-lsp/pull/162)
    )
  - fix documentation display in signature for LSP servers which
    return MarkupContent (
    [#164](https://github.com/krassowski/jupyterlab-lsp/pull/164)
    )

### `lsp-ws-connection 0.3.1`

- added `sendSaved()` method (textDocument/didSave) (
  [#147](https://github.com/krassowski/jupyterlab-lsp/pull/147)
  )
- fixed `getSignatureHelp()` off-by-one error (
  [#140](https://github.com/krassowski/jupyterlab-lsp/pull/140)
  )

### `@krassowski/jupyterlab-lsp 0.7.0`

- features

  - reduced space taken up by the statusbar indicator (
    [#106](https://github.com/krassowski/jupyterlab-lsp/pull/106)
    )
  - implemented statusbar popover with connections statuses (
    [#106](https://github.com/krassowski/jupyterlab-lsp/pull/106)
    )
  - generates types for server data responses from JSON schema (
    [#110](https://github.com/krassowski/jupyterlab-lsp/pull/110)
    )
  - added 'rename' function for notebooks, using shadow filesystem (
    [#115](https://github.com/krassowski/jupyterlab-lsp/pull/115)
    )
  - added a UX workaround for rope rename issues when there is a
    SyntaxError in the Python code (
    [#127](https://github.com/krassowski/jupyterlab-lsp/pull/127)
    )
  - added a widget panel with diagnostics (inspections), allowing to
    sort and explore diagnostics, and to go to the respective location
    in code (with a click); accessible from the context menu (
    [#129](https://github.com/krassowski/jupyterlab-lsp/pull/129)
    )
  - all commands are now accessible from the command palette (
    [#142](https://github.com/krassowski/jupyterlab-lsp/pull/142)
    )
  - bash LSP now also covers `%%bash` magic cell in addition to `%%sh` (
    [#144](https://github.com/krassowski/jupyterlab-lsp/pull/144)
    )
  - rpy2 magics received enhanced support for argument parsing
    in both parent Python document (re-written overrides) and
    exctracted R documents (improved foreign code extractor) (
    [#148](https://github.com/krassowski/jupyterlab-lsp/pull/148),
    [#153](https://github.com/krassowski/jupyterlab-lsp/pull/153)
    )
  - console logs can now easily be redirected to a floating console
    windows for debugging of the browser tests (see CONTRIBUTING.md)

- bugfixes
  - diagnostics in foreign documents are now correctly updated (
    [133fd3d](https://github.com/krassowski/jupyterlab-lsp/pull/129/commits/133fd3d71401c7e5affc0a8637ee157de65bef62)
    )
  - diagnostics are now always correctly displayed in the document they were intended for
  - the workaround for relative root path is now also applied on Mac (
    [#139](https://github.com/krassowski/jupyterlab-lsp/pull/139)
    )
  - fixed LSP of R in Python (`%%R` magic cell from rpy2) (
    [#144](https://github.com/krassowski/jupyterlab-lsp/pull/144)
    )
  - completion now work properly when the kernel is shut down (
    [#146](https://github.com/krassowski/jupyterlab-lsp/pull/146)
    )
  - a lowercase completion option selected from an uppercase token
    will now correctly substitute the incomplete token (
    [#143](https://github.com/krassowski/jupyterlab-lsp/pull/143)
    )
  - `didSave()` is emitted on file save, enabling the workaround
    used by R language server to lazily load `library(tidyverse)` (
    [#95](https://github.com/krassowski/jupyterlab-lsp/pull/95),
    [#147](https://github.com/krassowski/jupyterlab-lsp/pull/147),
    )
  - signature feature is now correctly working in notebooks (
    [#140](https://github.com/krassowski/jupyterlab-lsp/pull/140)
    )

### `lsp-ws-connection 0.3.0`

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

### `jupyter-lsp 0.7.0b0`

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

### `@krassowski/jupyterlab-lsp 0.6.1`

- features
  - adds an indicator to the statusbar
  - and many other improvements, see the [release notes](https://github.com/krassowski/jupyterlab-lsp/releases/tag/v0.6.1)
- dependencies
  - removes unused npm dependencies

### `@krassowski/jupyterlab-lsp 0.6.0`

- features
  - allows "rename" action in file editor
- bugfixes
  - handles some non-standard diagnostic responses
- testing
  - adds browser-based testing for file editor
- dependencies
  - requires `jupyter-lsp`

### `jupyter-lsp 0.6.0b0`

- features
  - starts language servers on demand
  - accepts configuration via Jupyter config system (traitlets) and python
    `entry_point`s
  - autodetects language servers for bash, CSS, LESS, SASS, Dockerfile, YAML, JS,
    TypeScript, JSX, TSX, JSON, YAML
