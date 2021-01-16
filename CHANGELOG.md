## CHANGELOG

### `@krassowski/jupyterlab-lsp 3.1.0` (unreleased)

- features

  - make the extension work with `jupyterlab-classic` - experimental, not all features are functional yet ([#465])
  - new status "Server extension missing" and a dialog with advice was added to help users with atypical configurations ([#476])

- bug fixes:

  - fix completions with R double and triple colon prefix ([#449])
  - fix contrast on status icon when status item is active ([#465])
  - fix connection manager loosing track of notebooks when multiple were open ([#474])

[#449]: https://github.com/krassowski/jupyterlab-lsp/pull/449
[#465]: https://github.com/krassowski/jupyterlab-lsp/pull/465
[#474]: https://github.com/krassowski/jupyterlab-lsp/pull/474
[#476]: https://github.com/krassowski/jupyterlab-lsp/pull/476

### `jupyter-lsp 1.0.1` (unreleased)

- bug fixes:

  - send periodic pings on websocket channels to maintain connection ([#459], thanks @franckchen)
  - R languageserver is no longer incorrectly shown as available when not installed ([#463])

[#459]: https://github.com/krassowski/jupyterlab-lsp/pull/459
[#463]: https://github.com/krassowski/jupyterlab-lsp/pull/463

### `@krassowski/jupyterlab-lsp 3.0.0` (2021-01-06)

- features

  - support for JupyterLab 3.0 ([#452], [#402])

### `jupyter-lsp 1.0.0` (2021-01-06)

- features

  - support for JupyterLab 3.0 ([#452], [#402])

[#402]: https://github.com/krassowski/jupyterlab-lsp/issues/402
[#452]: https://github.com/krassowski/jupyterlab-lsp/issues/452

### `@krassowski/jupyterlab-lsp 2.1.2` (2021-01-02)

- features

  - highlights can now be auto-removed from the cells/editors on blur (set `removeOnBlur` to `true` in settings) ([#446])

- bug fixes
  - improved performance of completion and highlights by minimising the number of highlight requests and GUI redraws (token checking, debouncing, acting on a single response only) ([#433])
  - highlights now update after cell focus/blur events even if those do not trigger cursor movement ([#433])
  - trigger characters auto-invoke now works in continuous hinting mode again ([#434])

[#433]: https://github.com/krassowski/jupyterlab-lsp/issues/433
[#434]: https://github.com/krassowski/jupyterlab-lsp/issues/434
[#446]: https://github.com/krassowski/jupyterlab-lsp/issues/446

### `@krassowski/jupyterlab-lsp 2.1.1` (2020-12-15)

- bug fixes

  - fix crash "blank screen" caused by Mac command character included in jump-to schema file ([#429])

[#429]: https://github.com/krassowski/jupyterlab-lsp/issues/429

### `jupyter-lsp 0.9.3` (2020-12-13)

- features

  - the virtual documents' folder can be configured with `JP_LSP_VIRTUAL_DIR` or
    `LanguageServerManager.virtual_documents_dir`, with a potential benefit for
    JupyterHub installations (the default value remains _contents.root_dir_ / `.virtual_documents`)
    ([#416], thanks @fcollonval)

[#416]: https://github.com/krassowski/jupyterlab-lsp/issues/416

### `@krassowski/jupyterlab-lsp 2.1.0` (2020-12-13)

- features

  - added "click to jump" functionality (by default using <kbd>Alt</kbd> modifier) ([#423])
  - added "jump back" command, by default activated with <kbd>Alt</kbd> + <kbd>o</kbd> ([#423])
  - `.virtual_documents` location can now be customized ([#416])
  - tokens are now exported making them available for import from other extensions ([#414], thanks @martinRenou)

- bug fixes

  - context menu commands are now correctly registered where previously specific conditions were leading to race conditions ([#399], thanks @mnowacki-b)
  - handles characters that need escaping (spaces, non-ASCII characters) more
    robustly in files and folder names ([#403], thanks @bollwyvl and @avaissi)
  - moving cells now triggers the document update immediately leading to immediate diagnostics update ([#421])
  - changing cell type to `raw` or `markdown` and then back to `code` properly unbinds/binds event handlers and updates document ([#421])
  - pasted cells are added to the LSP document immediately, without the need for the user to enter them ([#421])
  - improved error message when language server cannot be found ([#413], thanks @martinRenou)
  - developer documentation got improved ([#412], thanks @karlaspuldaro)

[#399]: https://github.com/krassowski/jupyterlab-lsp/issues/399
[#403]: https://github.com/krassowski/jupyterlab-lsp/issues/403
[#412]: https://github.com/krassowski/jupyterlab-lsp/issues/412
[#413]: https://github.com/krassowski/jupyterlab-lsp/issues/413
[#414]: https://github.com/krassowski/jupyterlab-lsp/issues/414
[#421]: https://github.com/krassowski/jupyterlab-lsp/issues/421

### `@krassowski/code-jumpers 1.0.0` (2020-12-13)

- breaking changes
  - split away from `@krassowski/jupyterlab_go_to_definition`, renamed to `@krassowski/code-jumpers` ([#423]):
    - removed unused code
    - refactored history operations to track files and always use global location data
  - renamed `uri` to `contents_path` to help avoid programmer issues
    with characters requiring URI encoding ([#406])

[#406]: https://github.com/krassowski/jupyterlab-lsp/pull/406
[#423]: https://github.com/krassowski/jupyterlab-lsp/pull/423

### `@krassowski/jupyterlab-lsp 2.0.8` (2020-10-25)

- bug fixes

  - custom cell syntax highlighting is now properly removed when no longer needed ([#387])
  - the completer in continuous hinting now works well with the pasted text ([#389])
  - continuous hinting suggestions will no longer show up if the only hint is the same as the current token ([#391])
  - available options for hover modifier keys are now listed in the setting descriptions ([#377])

[#377]: https://github.com/krassowski/jupyterlab-lsp/issues/377
[#387]: https://github.com/krassowski/jupyterlab-lsp/issues/387
[#389]: https://github.com/krassowski/jupyterlab-lsp/issues/389
[#391]: https://github.com/krassowski/jupyterlab-lsp/issues/391

### `@krassowski/jupyterlab-lsp 2.0.7` (2020-09-18)

- bug fixes

  - fix syntax highlighting in hover tooltips and reduce unnecessary padding and margin ([#363])
  - greatly improve performance of hover action ([#363])
  - improve support for expanded hovers tooltips using deprecated API ([#363])
  - do not hide hover tooltips too eagerly (allowing selecting text/easy scrolling of longer tooltips) ([#363])

[#363]: https://github.com/krassowski/jupyterlab-lsp/issues/363

### `@krassowski/jupyterlab-lsp 2.0.6` (2020-09-15)

- bug fixes

  - fix syntax highlighting of %%language cells slowing down editing in notebooks ([#361])

[#361]: https://github.com/krassowski/jupyterlab-lsp/issues/361

### `@krassowski/jupyterlab-lsp 2.0.5` (2020-09-11)

- bug fixes

  - fix too aggressive overrides of IPython's pinfo (`?`) and pinfo2 (`??`) ([#352])

[#352]: https://github.com/krassowski/jupyterlab-lsp/issues/352

### `@krassowski/jupyterlab-lsp 2.0.4` (2020-09-11)

- bug fixes

  - improve code overrides for IPython line magics ([#346])
  - implement missing code overrides for IPython's pinfo (`?`) and pinfo2 (`??`) syntactic sugar ([#346])

[#346]: https://github.com/krassowski/jupyterlab-lsp/issues/346

### `@krassowski/jupyterlab-lsp 2.0.2` (2020-09-07)

- bug fixes

  - fix code overrides not being registered properly ([#340])

[#340]: https://github.com/krassowski/jupyterlab-lsp/issues/340

### `@krassowski/jupyterlab-lsp 2.0.1` (2020-09-07)

- bug fixes

  - bump version of lsp-ws-connection dependency to fix the LaTeX server issues (see [#337])

[#337]: https://github.com/krassowski/jupyterlab-lsp/issues/337

### `jupyter-lsp 0.9.2` (2020-09-03)

- autodetects the `sql` language server for `.sql` files ([#328][])
  - diagnostics are provided by `sqlint` which requires Node 11+
    to work well (in contrast to currently required Node 10+).

[#328]: https://github.com/krassowski/jupyterlab-lsp/pull/328

### `@krassowski/jupyterlab-lsp 2.0.0` (2020-09-03)

- features

  - support for JupyterLab 2.2 ([#301][])
  - completer now displays server-provided documentation,
    and a kernel icon for kernel suggestions without type information ([#301][])
  - add two icons themes for the completer (material and vscode) ([#322])
  - the documentation by the completer can be turned on or off ([#315])
  - continuous hinting (Hinterland mode) can be enabled in settings ([#315])
  - tokens in which the completer should not be triggered can be changed ([#315])
  - configuration for the following features is now exposed in the settings editor ([#318]):
    - diagnostics (display, filtering)
    - hover (modifier key)
  - rename operation status reporting got improved ([#318])
  - replaced the generic status icons with code check icon (coloured differently according to the status) ([#318])
  - added icons for all the features and their commands ([#318])
  - refactored the codebase with a new architecture which allows dynamic features, document widget adapter, and code editor registration ([#318])
  - the document in the connections list in the statusbar popover are now represented by easy-to-understand DocumentLocator (breadcrumbs) widget rather than an internal id ([bacc006])
  - syntax highlighting mode is adjusted to the language with the majority of the code in an editor ([#319])
  - copy diagnostics message and filter diagnostics from context menu of Diagnostic Panel ([#330])

- bug fixes

  - path-autocompletion issues were resolved upstream and this release adopts these changes
  - the missing caret and document connection icons were restored in the statusbar popover ([#318])
  - pressing "Cancel" rename during rename now correctly aborts the rename operation ([#318])
  - when a language server for a foreign document is not available an explanation is displayed (rather than the "Connecting..." status as before) ([4e5b2ad])
  - when jump target is not found a message is now shown instead of raising an exception ([00448d0])
  - fixed status message expiration and replacement ([8798f2d]), ([#329])
  - fixed some context command rank issues introduced after an attempt of migration to nulls ([#318])

[#301]: https://github.com/krassowski/jupyterlab-lsp/pull/301
[#315]: https://github.com/krassowski/jupyterlab-lsp/pull/315
[#318]: https://github.com/krassowski/jupyterlab-lsp/pull/318
[#319]: https://github.com/krassowski/jupyterlab-lsp/pull/319
[#322]: https://github.com/krassowski/jupyterlab-lsp/pull/322
[#329]: https://github.com/krassowski/jupyterlab-lsp/pull/329
[#330]: https://github.com/krassowski/jupyterlab-lsp/pull/330
[00448d0]: https://github.com/krassowski/jupyterlab-lsp/pull/318/commits/00448d0c55e7f9a1e7e0a5322f17610daac47dfe
[bacc006]: https://github.com/krassowski/jupyterlab-lsp/pull/318/commits/bacc0066da0727ff7397574914bf0401e4d8f7cb
[4e5b2ad]: https://github.com/krassowski/jupyterlab-lsp/pull/318/commits/4e5b2adf655120458cc8be4b453fe9a78c98e061
[8798f2d]: https://github.com/krassowski/jupyterlab-lsp/pull/318/commits/8798f2dcfd28da10a2b8d8f648974111caa52307

### `@krassowski/jupyterlab-lsp 1.1.2` (2020-08-05)

- bug fixes

  - emits console warnings instead of throwing errors in hover handlers and connections ([#299][], [#300][])
  - improve URL checks in message handling to enable LaTeX diagnostics to work when configured ([#288][])

[#299]: https://github.com/krassowski/jupyterlab-lsp/pull/299
[#300]: https://github.com/krassowski/jupyterlab-lsp/pull/300

### `jupyter-lsp 0.9.1` (2020-08-05)

- autodetects the `texlab` language server for `.tex` files ([#288][])
  - diagnostics _should_ be provided by `chktex` on save, but don't yet appear,
    but can be configured through the Advanced Settings Editor to appear on save or change

[#288]: https://github.com/krassowski/jupyterlab-lsp/issues/288

### `@krassowski/jupyterlab-lsp 1.1.0` (2020-07-20)

- features

  - language servers can now be configured from the Advanced Settings Editor ([#245][])

- bug fixes

  - fixes currently-highlighted token in dark editor themes against light lab theme
    (and vice versa) ([#195][])
  - restores sorting order-indicating caret icons in diagnostics panel table ([#261][])
  - handles document open and change operation ordering more predictably ([#284][])
  - fixes some pyflakes issues caused by line magics substitution ([#293][])
  - updated the link to the documentation of language servers ([#294][])

[#195]: https://github.com/krassowski/jupyterlab-lsp/issues/195
[#261]: https://github.com/krassowski/jupyterlab-lsp/issues/261
[#293]: https://github.com/krassowski/jupyterlab-lsp/pull/293
[#294]: https://github.com/krassowski/jupyterlab-lsp/pull/294

### `jupyter-lsp 0.9.0` (2020-07-20)

- features

  - language servers can now be configured from the Advanced Settings Editor ([#245][])

- bug fixes

  - handles document open and change operation ordering more predictably ([#284][])

### `lsp-ws-connection 0.5.0` (2020-07-20)

- features

  - language servers can now be configured from the Advanced Settings Editor ([#245][])

- bug fixes

  - handles document open and change operation ordering more predictably ([#284][])

[#245]: https://github.com/krassowski/jupyterlab-lsp/pull/245
[#284]: https://github.com/krassowski/jupyterlab-lsp/pull/284

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
