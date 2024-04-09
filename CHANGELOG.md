## Changelog

### `jupyter-lsp 2.2.5`

- bug fixes:
  - fix for environment variables leaking into the parent environment (#1078)

### `jupyter-lsp 2.2.4`

- bug fixes:
  - fix websocket handler incorrectly inheriting from `APIHandler` rather than `JupyterHandler` (#1069)
  - remove unused notebook config entry point (#1069)
  - support latest version of `typescript-language-server` (#1064)

### `@jupyter-lsp/jupyterlab-lsp 5.1.0`

Requires JupyterLab `>=4.1.0,<5.0.0a0`

- new features:
  - populate table of contents with code symbols outline (experimental, file editor only)
- bug fixes:
  - fix settings reconciliation for nested properties (#1051)
  - fix a regression introduced in v5.0.2 which meant that overrides for native kernel and context completion providers were never active (#1057)
  - reduces some warnings in places known to have false positives to debug statements (#1057)
  - highlights no longer get instantly removed when navigating to a beginning of cell from another cell (#1057)
  - with the use of the new `extensionFactory` API (#1057):
    - LSP features work more reliably as the correct virtual document and editor is known rather than found from heuristics
    - LSP CodeMirror extensions are not added to editors which do not have an LSP-enabled editor reducing spurious warnings and improving performance
    - LSP CodeMirror extensions are only added once the LSP server was connected
- maintenance:
  - use new `extensionFactory` API allowing to remove workarounds that were needed to make the extension work in JupyterLab 4.0 (#1057)
  - remove no-longer needed patches for `VirtualDocument` as these were merged upstream and released in JupyterLab 4.1 (#1057)
  - update coverage, robot version and reporting approaches (#1052)
  - build against JupyterLab 4.1, fix tests (#1057)
  - bump ip from 2.0.0 to 2.0.1 (#1055)

### `jupyter-lsp 2.2.3`

- maintenance:
  - updates pyright config schema to v1.1.350

### `@jupyter-lsp/jupyterlab-lsp 5.0.3`

- bug fixes:
  - fix nested transclusions in JupyterLab 4.0.7+ (#1045)
  - fix completions when `type` is not defined (#1044)

### `@jupyter-lsp/jupyterlab-lsp 5.0.2`

- bug fixes:
  - fix native JupyterLab completion not working when LSP completion plugin is disabled (#1036)

### `jupyter-lsp 2.2.2`

- bug fixes:
  - address warning about renamed `extension_points` (#1035)
  - fix compatibility with jupyter server 1.x
  - fix an authentication-related security vulnerability (see [the advisory](https://github.com/jupyter-lsp/jupyterlab-lsp/security/advisories/GHSA-4qhp-652w-c22x) for details)
- enhancements:
  - add authorization support (`lsp` resource, jupyter-server v2+ only) - this allows server operators for fine grained access control, e.g. in case if specific users (such as guest or read-only users) should not be allowed to access LSP; this is in addition to authentication fixes

### `@jupyter-lsp/jupyterlab-lsp 5.0.1`

- bug fixes:
  - fix false “undefined name” in `%%time` and `%%capture` magics #1007 (thanks @i-aki-y!)
  - fix completion items for paths and other long items being cut off #1025
  - workaround issue with markdown lost on edit #1016
  - fix latex/Greek letters insertion and other completions which do not match prefix (do not pre-filter completions from kernel) #1022
  - fix completions in Console #1023
  - fix customising `priority` after pre-setting it with `overrides.json` #1027
  - fix jump to definitions in a file inside root in Pyright on Windows #1024
  - fix typos in setting title and help message #999 and #1010
- maintenance:
  - fix bootstrap script #1021
  - bump axios from 1.2.1 to 1.6.2 #1019
  - bump @babel/traverse from 7.22.5 to 7.23.4 #1020

### `jupyter-lsp 2.2.1`

- bug fixes:
  - use `APIHandler` over `JupyterHandler` to get CORS OPTIONS #952 (thanks @zhanba!)
  - use `shutil.which` to discover `npm` executable on Windows (thanks @jameshurst!)
- maintenance:
  - resolve traitlets type warnings, lint, remove six #1015
  - use `sys.executable` in stdio tests #998

### `@jupyter-lsp/jupyterlab-lsp 5.0.0`

- enhancements:
  - uses toast notifications instead of messages on status bar
  - diagnostics panel will be re-opened on reload
- maintenance:
  - support JupyterLab 4
  - use upstream `@jupyterlab/lsp` package
  - use camelCase convention in TypeScript/JavaScript code
  - use `@codemirror/linter` to show diagnostics
    - this comes with a different style of underlines and custom tooltips
- known issues/limitations:
  - configuration of language servers via JSON Settings Editor may result in a spurious warning
    due to a transitive clash with settings from the UI editor when using nested pattern (e.g.
    `{pylsp: {flake8: {enabled: true}}}`); the dotted pattern (e.g. `{"pylsp.flake8.enabled": true}`)
    does not lead to such problem.
  - enabling auto-invoke of completer requires toggling checkbox in both native and LSP `Code Completion` settings
  - robot mode does not support JupyterLab 4.0, hence robot LSP will not work either
  - renaming in docker files may not work on certain variables due to upstream tokenizer issue

Requires JupyterLab `>=4.0.6,<5.0.0a0`

### `@jupyter-lsp/jupyterlab-lsp 5.0.0-rc.1`

- restore re-use of unused standalone connections

### `@jupyter-lsp/jupyterlab-lsp 5.0.0-rc.0`

- fixes diagnostics not showing up in text editor in certain circumstances
- fixes signature hover box not being clickable
- improves performance by not creating a temporary editor to setup linter underline style
- JSON overrides work again
- fixes issue with syntax highlighting breaking when pasting multiple cells

Requires JupyterLab `>=4.0.6,<5.0.0a0`

### `@jupyter-lsp/jupyterlab-lsp 5.0.0-beta.1`

- fix highlights conflict with selection
- fix scrolling to diagnostics and diagnostic rendering in windowed notebook
- suppress kernel completer in transclusions

### `@jupyter-lsp/jupyterlab-lsp 5.0.0-beta.0`

- fix most regressions caught by tests in alpha
- reopen diagnostics panel on reload
- use toasts for notifications

### `@jupyter-lsp/jupyterlab-lsp 5.0.0-alpha.0`

- maintenance:
  - support JupyterLab 4

Requires JupyterLab `>=4.0.5,<5.0.0a0`

### `@jupyter-lsp/jupyterlab-lsp 4.3.0` (2023-09-21)

- features:
- extractor for spark SQL magic was added ([#980], thanks @skbitsp)
- classes needed to register custom adapters are now exported ([#980], thanks @skbitsp)
  - using these classes is not recommended for new code as registration mechanism was rewritten in JupyterLab 4.0 and moved to `@jupyterlab/lsp`

[#980]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/980

### `@jupyter-lsp/jupyterlab-lsp 4.2.0` (2023-05-28)

- features:
  - diagnostics can be ignored by severity level with new `ignoreSeverities` setting ([#940])

### `jupyter-lsp 2.2.0` (2023-05-28)

- bug fixes:
  - await `sleep()` coroutine ([#939], thanks @jinzhen-lin)
  - limit attempts to initialise shadow file system to three trials ([#936])
- maintenance:
  - support `bash-language-sever` 4.3.2+ ([#938], thanks @ackalker)

[#936]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/936
[#938]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/938
[#939]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/939
[#940]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/940

### `@jupyter-lsp/jupyterlab-lsp 4.1.0` (2023-04-24)

- features:
  - make `.virtual_documents` optional - logic for solving URIs will now check if the server does not require it ([#930])
- bug fixes:
  - fix contrast of mark highlights in dark mode ([#928])
  - fix conflict with block/rectangular selections on Alt + click ([#927])
- maintenance:
  - update texlab expectation ([#929])

[#927]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/927
[#928]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/928
[#929]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/929
[#930]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/930

### `jupyter-lsp 2.1.0` (2023-04-24)

- features:
  - make `.virtual_documents` optional - added `requires_documents_on_disk` spec field (default `True`, will become `False` in next major version) ([#930])

### `@jupyter-lsp/jupyterlab-lsp 4.0.1` (2023-03-21)

- bug fixes
  - overrides from `overrides.json` are now picked up again ([#919])

### `jupyter-lsp 2.0.1` (2023-03-21)

- bug fixes:
  - pyright schema now includes required `python.` prefixes ([#919])

[#919]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/919

### `@jupyter-lsp/jupyterlab-lsp 4.0.0` (2023-03-15)

Requires JupyterLab `>=3.6.0,<4.0.0a0` and Python 3.8 or newer.

- features:
  - implement jump target selector and jump to references ([#739])
  - implement settings UI using native JupyterLab 3.3 UI ([#778])
  - add option to show hover tooltip automatically ([#864], thanks @yamaton)
  - implement eliding for long paths/files in completer ([#893])
  - allow to pass default workspace config (`serverSettings`) in specs ([#856])
- bug fixes:
  - use correct websocket URL if configured as different from base URL ([#820], thanks @MikeSem)
  - clean up all completer styles when completer feature is disabled ([#829]).
  - fix `undefined` being inserted for path-like completion items with no `insertText` ([#833])
  - reduce signature flickering when typing and hover flicker when moving mouse ([#836])
  - fix sporadic misplacement of hover tooltips ([#860], thanks @yamaton)
  - fix hover tooltip not updated after character deletions ([#867], thanks @yamaton)
  - handle potential race condition in feature settings loading ([#882])
- refactoring:
  - changed NPM packages namespace from `@krassowski` to `@jupyter-lsp` ([#862])
  - move client capabilities to features ([#738])
- downstreams:
  - use the host application's HTTP settings for requests to the REST and WebSocket routes ([#881])
  - source maps are provided for improved debugging ([#882])
  - the derived JSON Schema types are avilable as `SCHEMA` ([#882])
- documentation:
  - add missing `--channel` to conda instruction for texlab ([#789], thanks @justin-f-perez)
  - remove references to pylsp fork ([#800] and [#814], thanks @joelostblom and @nickfong)
  - add Robot Framework language server ([#724], thanks @bollwyvl)
  - add a list of third-party and community language servers ([#826], thanks @cccs-jc)
  - fix documentation of `.lsp_symlink` workaround ([#828])
- maintenance:
  - bump minimum required JupyterLab version to 3.3 (`>=3.3.0,<4.0.0a0`)
  - bump minimum required Node.js version to 14.0 (12.0 reached EOL in April)
  - use newer `@jupyterlab/builder` which provides third-party license information ([#882])

### `lsp-ws-connection 0.7.1` (2023-03-15)

- downstreams:
  - includes sourcemaps for easier debugging ([#882])
- maintenance:
  - handle notification promises more explicitly ([#882])

### `jupyter-lsp 2.0.0` (2023-03-15)

- dependencies:
  - uses `importlib_metadata` (or `importlib.metadata` on 3.10+) for `entry_points` ([#882])
  - supports Python versions are 3.8 or newer
- performance:
  - `entry_point` discovery is deferred until server has started, improving
    `jupyter_server` startup time ([#852])
- allow to pass default workspace config (`serverSettings`) in specs ([#856])

[#724]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/724
[#738]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/738
[#778]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/778
[#789]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/789
[#800]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/800
[#814]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/814
[#820]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/820
[#826]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/826
[#829]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/829
[#833]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/833
[#836]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/836
[#852]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/852
[#856]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/856
[#860]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/860
[#864]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/864
[#867]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/867
[#882]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/882
[#893]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/893

### `@krassowski/jupyterlab-lsp 3.10.1` (2022-03-21)

- bug fixes:
  - fix navigation to files with names including characters which require encoding ([#758])
  - fix omissions in the main settings schema for correct rendering in JupyterLab 3.3 Settings Editor UI ([#779])
- maintenance
  - make tests pass with new JupyterLab 3.3 ([#777])
  - pin r-base version to fix Binder ([#766])
  - pin node-gyp to fix CI on Windows ([#772])
  - pin pytest-flake8 to fix CI
  - update development/testing environment dependencies: urijs, typedoc, url-parse

[#758]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/758
[#766]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/766
[#772]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/772
[#777]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/777
[#779]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/779

### `@krassowski/jupyterlab-lsp 3.10.0` (2022-01-01)

- features:
  - enable pre-filtering of completion matches by default ([#735])
  - add support for diagnostic tags: Deprecated, Unnecessary ([#736], [#737])
- bug fixes:
  - squash warnings and errors in web console ([#732])
  - fix signature blur and fix formatting when no arguments are present ([#734])
  - fixed with enabling of strict null checks:
    - previously changing kernels always led to restarting of LSP connection, even if the kernel language did not change; now the connection will be retained if possible
    - `markdownRenderer` is no longer implicitly required
    - diagnostics sorting with missing values for `source` and `severity` was improved and missing values will be consistently shown at the end
    - diagnostics placeholder was split into `Diagnostics are not available` and `No issues detected, great job!` which will now show up properly
- maintenance:
  - enable strict null checks and other strict settings ([#733])
  - specify client capabilities in features instead of hard-coding them ([#738])
  - bump minimum required JupyterLab version to 3.1 (`>=3.1.0,<4.0.0a0`)

[#732]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/732
[#733]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/733
[#734]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/734
[#735]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/735
[#736]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/736
[#737]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/737
[#738]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/738

### `@krassowski/code-jumpers 1.2.0` (2022-01-01)

- maintenance:
  - updates to API with respect to `null`/`undefined` values in course strict null checks activation ([#733])

### `@krassowski/jupyterlab-lsp 3.9.3` (2021-12-19)

- bug fixes:
  - workaround upstream issue in merging translation ([#726], thanks @fcollonval)

[#726]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/726

### `@krassowski/jupyterlab-lsp 3.9.2` (2021-12-12)

- bug fixes:
  - prevent very long completion details text from extending the completer indefinitely ([#698])
  - correct status translations ([#700], thanks @fcollonval)
  - fix translations in status pop-up ([#703])
  - workaround issue causing file rename when opening external files by jumping to them ([#712], thanks @jepcor97)
  - fix sorting by "Line:Ch" and "Cell" in Diagnostics Panel ([#717])
  - fix header border missing when scrolling in Diagnostics Panel ([#717])
- documentation improvements:
  - clarify that JupyterLab restart is needed after installation ([#714], thanks @3coins)

[#698]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/698
[#700]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/700
[#703]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/703
[#712]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/712
[#714]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/714
[#717]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/717

### `@krassowski/completion-theme 3.2.0` (2021-12-12)

- features:
  - add `details-below` layout allowing to change the completer arrangement ([#698])

### `jupyter-lsp 1.5.1` (2021-12-12)

- documentation improvements:
  - document troubleshooting steps for `texlab` server([#702])
- maintenance and upkeep:
  - migrate test configuration to `ServerApp` as needed ([#713])
  - address deprecation warnings ([#713])

[#702]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/702
[#713]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/713

### `@krassowski/jupyterlab-lsp 3.9.1` (2021-10-24)

- bug fixes:
  - fix build issues making it difficult to reuse/extend the package ([#696], thanks @cccs-jc)

[#696]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/696

### `jupyter-lsp 1.5.0` (2021-10-24):

- features:
  - add support for new `typescript-language-server` replacing `javascript-typescript-langserver`;
    despite the name both packages provide support for all four: JavaScript, JSX, TypeScript and TSX;
    the old `javascript-typescript-langserver` can still be used, but it is no longer maintained
    and we will not be supported, and specs may be removed in the next major release ([#697]).

[#697]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/697

### `@krassowski/jupyterlab-lsp 3.9.0` (2021-10-17)

- features:
  - signature help box will now persist while typing the arguments of a function ([#671])
  - the currently active argument will be highlighted in the signature help box
  - if the documentation exceeds a user-configurable number of lines the signature
    help box will only display the first line of the documentation and the following
    lines will be collapsed into an expandable details section.
  - the signature box is now displayed above the current line
  - the signature box takes up less space
  - you can now disable specific features in settings ([#689])
- bug fixes:
  - fix missing translation strings ([#675])
  - fix kernel completions not showing up for R ([#686])
  - fix tab completions not showing up in strings due to incomplete trigger kind invalidation ([#686])
  - fix path completions reconciliation for `pyls`/`pylsp` with `IPython` ([#686])
  - improve escaping rule for IPython magics overrides ([#688])
  - fix documentation panel not showing up when typing fast ([#692])

[#671]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/671
[#675]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/675
[#686]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/686
[#688]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/688
[#689]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/689
[#692]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/692

### `@krassowski/jupyterlab-lsp 3.8.1` (2021-08-02)

- bug fixes:
  - `%Rdevice` magic is now properly overridden and won't be extracted to R code ([#646])
  - Fix hover rendering for `MarkedString`s, fix hover disappearing when moving mouse towards it ([#653])

[#646]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/646
[#653]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/653

### `jupyter-lsp 1.4.1` (2021-08-02)

- bug fixes:
  - remove spurious `ValidationError` warnings for non-installed servers ([#645], thanks @karlaspuldaro)
  - reduce number and verbosity of logs on startup

[#645]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/645

### `@krassowski/jupyterlab-lsp 3.8.0` (2021-07-04)

- improvements:

  - add a note on manually enabling backend extension ([#621], thanks @icankeep)
  - in-app troubleshooting/installation help is now offered for servers which are needed but could not be detected
    (if auto-detection specification for those is present) ([#634])

- bug fixes:
  - fix rename shortcut registration in file editor ([#614])
  - improve performance of icon rendering in completer ([#625])
  - fix cache misses and concurrency issues for hover ([#630])

[#614]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/614
[#621]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/621
[#625]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/625
[#630]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/630
[#634]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/634

### `jupyter-lsp 1.4.0` (2021-07-04)

- features:

  - `troubleshoot` property was added to the language server spec, allowing to describe auto-detection troubleshooting
    ([#634])
  - new endpoint `specs` will list all language server specifications known to `jupyter-lsp` allowing frontends
    to suggest installation of specific language servers ([#634])

- changes:
  - `ShellSpec.is_installed()` signature changed; it now accepts the `LanguageServerManagerAPI` rather than the resolved
    command location (of `str` type); the specs using only `is_installed_args` are not affected; as this method was only
    used by internally by the `__call__` implementation (which was adjusted accordingly) this change should not break
    existing specs unless any of these methods were overridden in sub-classes.
  - `SpecBase` was moved to `types.py`; it can still be imported from `utils`, but doing so is discouraged
  - `ShellSpec.solve()` was added to facilitate discovery of command location

[#634]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/634

### `jupyter-lsp 1.3.0` (2021-06-02)

- features:
  - add auto-detection of pyright server ([#587], thanks @yuntan)

[#587]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/587

### `@krassowski/jupyterlab-lsp 3.7.0` (2021-05-31)

- features:

  - add ability to deactivate Kernel completions or LSP completion through the settings ([#586], thanks @Carreau)
  - allow to set a priority for LSP server, allowing to choose which server to use when multiple servers are installed ([#588])
  - add auto-detection of pyright server ([#587], thanks @yuntan)
  - update from JupyterLab Classic to RetroLab ([#602])
  - log server messages in user-accessible console ([#606])

- bug fixes:

  - workaround url-parse issue causing problems when using JupyterLab 3.0.15 ([#599])

- other changes:
  - drop Node 10 (EOL 2 weeks ago) testing on CI, add Node 15 ([#587])
  - update lsp-ws-connection dependencies ([#606])
  - old emit-based API of lsp-ws-connection is new deprecated and will be removed in the next major version; please use `serverNotifications`, `clientNotifications`, `clientRequests` and `serverRequests` instead ([#606])

[#586]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/586
[#588]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/588
[#599]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/599
[#602]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/602
[#606]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/606

### `jupyter-lsp 1.2.0` (2021-04-26)

- features:

  - add support for python-lsp-server, a community fork of pyls ([#584] and [#582], thanks @maresb)

- bug fixes:
  - fix encoding on Windows for non-conda installs ([#580], thanks @stonebig)

[#580]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/580
[#582]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/582
[#584]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/584

### `@krassowski/code-jumpers 1.1.0` (2021-04-26)

- features:

  - added translation support ([#557], thanks @JessicaBarh)

### `@krassowski/jupyterlab-lsp 3.6.0` (2021-04-26)

- features:

  - added translation support ([#557], thanks @JessicaBarh)

- bug fixes:

  - fixed name of jupyterlab-lsp package displayed in JupyterLab UI ([#570], thanks @marimeireles)
  - removed vendored CodeMirror from distribution ([#576])

[#557]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/557
[#570]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/570
[#576]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/576

### `@krassowski/jupyterlab-lsp 3.5.0` (2021-03-22)

- features:

  - adds `%%bigquery` IPython cell magic support for BigQuery ([#553], thanks @julioyildo)
  - completions filtering can be set to case-insensitive in settings ([#549])
  - completions filtering can hide exact matches ([#549])
  - the extra information displayed next to the completion label now can include 'detail' (usually module/package of origin), and can be customized in settings ([#549])

- bug fixes:

  - prevents throwing a highlights error when adding new cell with <kbd>Shift</kbd> + <kbd>Enter</kbd> ([#544])
  - fixes IPython `pinfo` and `pinfo2` (`?` and `??`) for identifiers containing `s` ([#547])
  - fixes incorrect behaviour of LSP features in some IPython magics with single line of content ([#560])
  - fixes name of jupyterlab-lsp package in JupyterLab

- for extension authors:

  - minimal functional extractor and code overrides APIs are now exported; these APIs cab be subject to change in future releases ([#562])

[#544]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/544
[#547]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/547
[#549]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/549
[#553]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/553
[#560]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/560
[#562]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/562

### `jupyter-lsp 1.1.4` (2021-02-21)

- bug fixes:

  - ensures `jupyter*_config.d` paths are searched for `language_servers`
    as documented in _Configuring_ ([#535])
  - uses more explicit file name for enabling `jupyter-lsp` in `notebook` and
    `jupyter_server ([#535])

[#535]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/535

### `@krassowski/jupyterlab-lsp 3.4.1` (2021-02-16)

- bug fixes:

  - fixed installation of the source version of the extension (causing build error if classic was not installed) ([#526])

[#526]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/526

### `@krassowski/jupyterlab-lsp 3.4.0` (2021-02-14)

- features:

  - the priority of the completions from kernel can now be changed by switching new `kernelCompletionsFirst` setting ([#520])
  - completer panel will now always render markdown documentation if available ([#520])
    - the implementation re-renders the panel as it is the best we can do until [jupyterlab#9663](https://github.com/jupyterlab/jupyterlab/pull/9663) is merged
  - the completer now uses `filterText` and `sortText` if available to better filter and sort completions ([#520], [#523])
  - completer `suppressInvokeIn` setting was removed; `suppressContinuousHintingIn` and `suppressTriggerCharacterIn` settings were added ([#521])
  - `suppressContinuousHintingIn` by default includes `def` to improve the experience when writing function names ([#521])
  - long file paths are now collapsed if composed of more than two segments to avoid status popover and diagnostics panel getting too wide ([#524])

- bug fixes:

  - user-invoked completion in strings works again ([#521])
  - completer documentation will now consistently show up after filtering the completion items ([#520])
  - completions containing HTML-like syntax will be displayed properly (an upstream issue) ([#520], [#523])
  - diagnostics panel will no longer break when foreign documents (e.g. `%%R` cell magics) are removed ([#522])

[#520]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/520
[#521]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/521
[#522]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/522
[#523]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/523
[#524]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/524

### `@krassowski/jupyterlab-lsp 3.3.1` (2021-02-07)

- bug fixes:

  - completion and signature suggestions get invalidated when editor changes ([#507])
  - signature suggestions now invalidate on cursor move to another line or backwards too ([#507])
  - LaTeX is now rendered in documentation panel of completer ([#506])
  - completion response returned as plain text use pre tag to retain whitespace formatting ([#506])
  - pre-formatted code font size was reduced to match font-size of the text in completion panel ([#506])
  - completer no longer spans the entire screen if it has long entries ([#506])

[#506]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/506
[#507]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/507
[#508]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/508

### `jupyter-lsp 1.1.3` (2020-02-07)

- features:

  - add config for the classic notebook server extension ([#504])

[#504]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/504

### `@krassowski/jupyterlab-lsp 3.3.0` (2021-01-31)

- features:

  - added a timeout for kernel completion, with the default of 600ms ([#496])
  - added an option to skip waiting for kernel completions if busy, off by default ([#496])

- bug fixes:

  - delayed completion suggestions will no longer show up if cursor moved to another line ([#496])
  - changes in notebooks after kernel restart or file rename will now be recorded by the language server again ([#496])
  - when either of kernel providers: kernel or LSP server fails, the completion from the other will still be shown ([#496])

[#496]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/496

### `jupyter-lsp 1.1.2` (2021-01-31)

- bug fixes:

  - fixed issues with language server messages being truncated in certain circumstances on Windows

[#494]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/494

### `@krassowski/jupyterlab-lsp 3.2.0` (2021-01-24)

- features:

  - documentation panel in completer now works for R language too: implemented `completionItem/resolve` ([#487])
  - kernel types returned by IPython and IJulia are now mapped to LSP types; you can customize the mappings in settings ([#487])

- bug fixes:

  - diagnostics panel works after kernel restart properly ([#485])
  - workaround was added to enable `jedi-language-server` diagnostics ([#485])
  - Julia language server will not crash when saving a non-Julia file: fixed sendSaved notification scope ([#491])

### `jupyter-lsp 1.1.1` (2021-01-24)

- bug fixes:

  - `PythonModuleSpec` no longer raises exception when the server module does not exist ([#485])

[#485]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/485
[#487]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/487
[#491]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/491

### `@krassowski/jupyterlab-lsp 3.1.0` (2021-01-17)

- features

  - make the extension work with `jupyterlab-classic` - experimental, not all features are functional yet ([#465])
  - new status "Server extension missing" and a dialog with advice was added to help users with atypical configurations ([#476])
  - for developers: the verbosity of console logs is now controllable from settings and set to warn by default ([#480])

- bug fixes:

  - namespace completions in R (after double and triple colon) now work properly ([#449])
  - improved status icon contrast when status item is active ([#465])
  - connection manager now properly keeps track of notebooks when multiple notebooks are open ([#474])
  - new cells added after kernel restart now work properly; kernel changes are handled correctly ([#478])
  - increase total timeout for language server connection ([#479])
  - fix status communication during initialization ([#479])

[#449]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/449
[#465]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/465
[#474]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/474
[#476]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/476
[#478]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/478
[#479]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/479
[#480]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/480

### `jupyter-lsp 1.1.0` (2021-01-17)

- features

  - added experimental detection of Julia and Jedi language servers ([#481])

- bug fixes:

  - send periodic pings on websocket channels to maintain connection ([#459], thanks @franckchen)
  - R languageserver is no longer incorrectly shown as available when not installed ([#463])
  - fix completion of very large namespaces (e.g. in R's base or in JavaScript) due to truncated message relay ([#477])

[#459]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/459
[#463]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/463
[#477]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/477
[#481]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/481

### `@krassowski/jupyterlab-lsp 3.0.0` (2021-01-06)

- features

  - support for JupyterLab 3.0 ([#452], [#402])

### `jupyter-lsp 1.0.0` (2021-01-06)

- features

  - support for JupyterLab 3.0 ([#452], [#402])

[#402]: https://github.com/jupyter-lsp/jupyterlab-lsp/issues/402
[#452]: https://github.com/jupyter-lsp/jupyterlab-lsp/issues/452

### `@krassowski/jupyterlab-lsp 2.1.2` (2021-01-02)

- features

  - highlights can now be auto-removed from the cells/editors on blur (set `removeOnBlur` to `true` in settings) ([#446])

- bug fixes
  - improved performance of completion and highlights by minimising the number of highlight requests and GUI redraws (token checking, debouncing, acting on a single response only) ([#433])
  - highlights now update after cell focus/blur events even if those do not trigger cursor movement ([#433])
  - trigger characters auto-invoke now works in continuous hinting mode again ([#434])

[#433]: https://github.com/jupyter-lsp/jupyterlab-lsp/issues/433
[#434]: https://github.com/jupyter-lsp/jupyterlab-lsp/issues/434
[#446]: https://github.com/jupyter-lsp/jupyterlab-lsp/issues/446

### `@krassowski/jupyterlab-lsp 2.1.1` (2020-12-15)

- bug fixes

  - fix crash "blank screen" caused by Mac command character included in jump-to schema file ([#429])

[#429]: https://github.com/jupyter-lsp/jupyterlab-lsp/issues/429

### `jupyter-lsp 0.9.3` (2020-12-13)

- features

  - the virtual documents' folder can be configured with `JP_LSP_VIRTUAL_DIR` or
    `LanguageServerManager.virtual_documents_dir`, with a potential benefit for
    JupyterHub installations (the default value remains _contents.root_dir_ / `.virtual_documents`)
    ([#416], thanks @fcollonval)

[#416]: https://github.com/jupyter-lsp/jupyterlab-lsp/issues/416

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

[#399]: https://github.com/jupyter-lsp/jupyterlab-lsp/issues/399
[#403]: https://github.com/jupyter-lsp/jupyterlab-lsp/issues/403
[#412]: https://github.com/jupyter-lsp/jupyterlab-lsp/issues/412
[#413]: https://github.com/jupyter-lsp/jupyterlab-lsp/issues/413
[#414]: https://github.com/jupyter-lsp/jupyterlab-lsp/issues/414
[#421]: https://github.com/jupyter-lsp/jupyterlab-lsp/issues/421

### `@krassowski/code-jumpers 1.0.0` (2020-12-13)

- breaking changes
  - split away from `@krassowski/jupyterlab_go_to_definition`, renamed to `@krassowski/code-jumpers` ([#423]):
    - removed unused code
    - refactored history operations to track files and always use global location data
  - renamed `uri` to `contents_path` to help avoid programmer issues
    with characters requiring URI encoding ([#406])

[#406]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/406
[#423]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/423

### `@krassowski/jupyterlab-lsp 2.0.8` (2020-10-25)

- bug fixes

  - custom cell syntax highlighting is now properly removed when no longer needed ([#387])
  - the completer in continuous hinting now works well with the pasted text ([#389])
  - continuous hinting suggestions will no longer show up if the only hint is the same as the current token ([#391])
  - available options for hover modifier keys are now listed in the setting descriptions ([#377])

[#377]: https://github.com/jupyter-lsp/jupyterlab-lsp/issues/377
[#387]: https://github.com/jupyter-lsp/jupyterlab-lsp/issues/387
[#389]: https://github.com/jupyter-lsp/jupyterlab-lsp/issues/389
[#391]: https://github.com/jupyter-lsp/jupyterlab-lsp/issues/391

### `@krassowski/jupyterlab-lsp 2.0.7` (2020-09-18)

- bug fixes

  - fix syntax highlighting in hover tooltips and reduce unnecessary padding and margin ([#363])
  - greatly improve performance of hover action ([#363])
  - improve support for expanded hovers tooltips using deprecated API ([#363])
  - do not hide hover tooltips too eagerly (allowing selecting text/easy scrolling of longer tooltips) ([#363])

[#363]: https://github.com/jupyter-lsp/jupyterlab-lsp/issues/363

### `@krassowski/jupyterlab-lsp 2.0.6` (2020-09-15)

- bug fixes

  - fix syntax highlighting of %%language cells slowing down editing in notebooks ([#361])

[#361]: https://github.com/jupyter-lsp/jupyterlab-lsp/issues/361

### `@krassowski/jupyterlab-lsp 2.0.5` (2020-09-11)

- bug fixes

  - fix too aggressive overrides of IPython's pinfo (`?`) and pinfo2 (`??`) ([#352])

[#352]: https://github.com/jupyter-lsp/jupyterlab-lsp/issues/352

### `@krassowski/jupyterlab-lsp 2.0.4` (2020-09-11)

- bug fixes

  - improve code overrides for IPython line magics ([#346])
  - implement missing code overrides for IPython's pinfo (`?`) and pinfo2 (`??`) syntactic sugar ([#346])

[#346]: https://github.com/jupyter-lsp/jupyterlab-lsp/issues/346

### `@krassowski/jupyterlab-lsp 2.0.2` (2020-09-07)

- bug fixes

  - fix code overrides not being registered properly ([#340])

[#340]: https://github.com/jupyter-lsp/jupyterlab-lsp/issues/340

### `@krassowski/jupyterlab-lsp 2.0.1` (2020-09-07)

- bug fixes

  - bump version of `lsp-ws-connection` dependency to fix the LaTeX server issues (see [#337])

[#337]: https://github.com/jupyter-lsp/jupyterlab-lsp/issues/337

### `jupyter-lsp 0.9.2` (2020-09-03)

- autodetects the `sql` language server for `.sql` files ([#328][])
  - diagnostics are provided by `sqlint` which requires Node 11+
    to work well (in contrast to currently required Node 10+).

[#328]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/328

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

[#301]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/301
[#315]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/315
[#318]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/318
[#319]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/319
[#322]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/322
[#329]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/329
[#330]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/330
[00448d0]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/318/commits/00448d0c55e7f9a1e7e0a5322f17610daac47dfe
[bacc006]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/318/commits/bacc0066da0727ff7397574914bf0401e4d8f7cb
[4e5b2ad]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/318/commits/4e5b2adf655120458cc8be4b453fe9a78c98e061
[8798f2d]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/318/commits/8798f2dcfd28da10a2b8d8f648974111caa52307

### `@krassowski/jupyterlab-lsp 1.1.2` (2020-08-05)

- bug fixes

  - emits console warnings instead of throwing errors in hover handlers and connections ([#299][], [#300][])
  - improve URL checks in message handling to enable LaTeX diagnostics to work when configured ([#288][])

[#299]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/299
[#300]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/300

### `jupyter-lsp 0.9.1` (2020-08-05)

- autodetects the `texlab` language server for `.tex` files ([#288][])
  - diagnostics _should_ be provided by `chktex` on save, but don't yet appear,
    but can be configured through the Advanced Settings Editor to appear on save or change

[#288]: https://github.com/jupyter-lsp/jupyterlab-lsp/issues/288

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

[#195]: https://github.com/jupyter-lsp/jupyterlab-lsp/issues/195
[#261]: https://github.com/jupyter-lsp/jupyterlab-lsp/issues/261
[#293]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/293
[#294]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/294

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

[#245]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/245
[#284]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/284

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
    [#206](https://github.com/jupyter-lsp/jupyterlab-lsp/pull/206)
    )

- bug fixes

  - reports files are open only after installing all handlers to avoid missing messages ([#201][])

[#201]: https://github.com/jupyter-lsp/jupyterlab-lsp/issues/201

### `lsp-ws-connection 0.4.0` (2020-03-12)

- breaking changes

  - no longer assumes one document per connection ([#165][])
  - requires documents be opened explicitly ([#165][])
  - use of the `eventEmitter` pattern mostly deprecated in favor of `Promise`s
    ([#165][])

[#165]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/165

### `jupyter-lsp 0.8.0` (2020-03-12)

- breaking changes

  - websockets are now serviced by implementation key, rather than language
    under `lsp/ws/<server key>` ([#199][])
  - introduces schema version `2`, reporting status by server at `lsp/status` ([#199][])

- bugfixes:
  - handles language server reading/writing and shadow file operations in threads ([#199][])

[#199]: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/199

### `jupyter-lsp 0.7.0`

- bugfixes
  - didSave no longer causes unwanted messages in logs (
    [#187](https://github.com/jupyter-lsp/jupyterlab-lsp/pull/187)
    )

### `@krassowski/jupyterlab-lsp 0.7.1`

- features

  - users can now choose which columns to display
    in the diagnostic panel, using a context menu action (
    [#159](https://github.com/jupyter-lsp/jupyterlab-lsp/pull/159)
    )
  - start the diagnostics panel docked at the bottom and improve
    the re-spawning of the diagnostics panel (
    [#166](https://github.com/jupyter-lsp/jupyterlab-lsp/pull/166)
    )

- bugfixes

  - fixed various small bugs in the completer (
    [#162](https://github.com/jupyter-lsp/jupyterlab-lsp/pull/162)
    )
  - fix documentation display in signature for LSP servers which
    return MarkupContent (
    [#164](https://github.com/jupyter-lsp/jupyterlab-lsp/pull/164)
    )

### `lsp-ws-connection 0.3.1`

- added `sendSaved()` method (textDocument/didSave) (
  [#147](https://github.com/jupyter-lsp/jupyterlab-lsp/pull/147)
  )
- fixed `getSignatureHelp()` off-by-one error (
  [#140](https://github.com/jupyter-lsp/jupyterlab-lsp/pull/140)
  )

### `@krassowski/jupyterlab-lsp 0.7.0`

- features

  - reduced space taken up by the statusbar indicator (
    [#106](https://github.com/jupyter-lsp/jupyterlab-lsp/pull/106)
    )
  - implemented statusbar popover with connections statuses (
    [#106](https://github.com/jupyter-lsp/jupyterlab-lsp/pull/106)
    )
  - generates types for server data responses from JSON schema (
    [#110](https://github.com/jupyter-lsp/jupyterlab-lsp/pull/110)
    )
  - added 'rename' function for notebooks, using shadow filesystem (
    [#115](https://github.com/jupyter-lsp/jupyterlab-lsp/pull/115)
    )
  - added a UX workaround for rope rename issues when there is a
    SyntaxError in the Python code (
    [#127](https://github.com/jupyter-lsp/jupyterlab-lsp/pull/127)
    )
  - added a widget panel with diagnostics (inspections), allowing to
    sort and explore diagnostics, and to go to the respective location
    in code (with a click); accessible from the context menu (
    [#129](https://github.com/jupyter-lsp/jupyterlab-lsp/pull/129)
    )
  - all commands are now accessible from the command palette (
    [#142](https://github.com/jupyter-lsp/jupyterlab-lsp/pull/142)
    )
  - bash LSP now also covers `%%bash` magic cell in addition to `%%sh` (
    [#144](https://github.com/jupyter-lsp/jupyterlab-lsp/pull/144)
    )
  - rpy2 magics received enhanced support for argument parsing
    in both parent Python document (re-written overrides) and
    exctracted R documents (improved foreign code extractor) (
    [#148](https://github.com/jupyter-lsp/jupyterlab-lsp/pull/148),
    [#153](https://github.com/jupyter-lsp/jupyterlab-lsp/pull/153)
    )
  - console logs can now easily be redirected to a floating console
    windows for debugging of the browser tests (see CONTRIBUTING.md)

- bugfixes
  - diagnostics in foreign documents are now correctly updated (
    [133fd3d](https://github.com/jupyter-lsp/jupyterlab-lsp/pull/129/commits/133fd3d71401c7e5affc0a8637ee157de65bef62)
    )
  - diagnostics are now always correctly displayed in the document they were intended for
  - the workaround for relative root path is now also applied on Mac (
    [#139](https://github.com/jupyter-lsp/jupyterlab-lsp/pull/139)
    )
  - fixed LSP of R in Python (`%%R` magic cell from rpy2) (
    [#144](https://github.com/jupyter-lsp/jupyterlab-lsp/pull/144)
    )
  - completion now work properly when the kernel is shut down (
    [#146](https://github.com/jupyter-lsp/jupyterlab-lsp/pull/146)
    )
  - a lowercase completion option selected from an uppercase token
    will now correctly substitute the incomplete token (
    [#143](https://github.com/jupyter-lsp/jupyterlab-lsp/pull/143)
    )
  - `didSave()` is emitted on file save, enabling the workaround
    used by R language server to lazily load `library(tidyverse)` (
    [#95](https://github.com/jupyter-lsp/jupyterlab-lsp/pull/95),
    [#147](https://github.com/jupyter-lsp/jupyterlab-lsp/pull/147),
    )
  - signature feature is now correctly working in notebooks (
    [#140](https://github.com/jupyter-lsp/jupyterlab-lsp/pull/140)
    )

### `lsp-ws-connection 0.3.0`

- infrastructure
  - brought into monorepo [#107](https://github.com/jupyter-lsp/jupyterlab-lsp/pull/107)
- dev
  - allows `initializeParams` to be overloaded by subclasses
  - adopts
    - typescript 3.7
    - prettier
    - tslint
  - added initialization checks before executing sendChange to comply
    with LSP specs [#115](https://github.com/jupyter-lsp/jupyterlab-lsp/pull/115)

### `jupyter-lsp 0.7.0b0`

- features
  - adds a language server status endpoint (
    [#81](https://github.com/jupyter-lsp/jupyterlab-lsp/pull/81)
    )
  - adds more descriptive information to the language server spec (
    [#90](https://github.com/jupyter-lsp/jupyterlab-lsp/pulls/100)
    )
  - adds an extensible listener API (
    [#99](https://github.com/jupyter-lsp/jupyterlab-lsp/issues/99),
    [#100](https://github.com/jupyter-lsp/jupyterlab-lsp/pulls/100)
    )

### `@krassowski/jupyterlab-lsp 0.6.1`

- features
  - adds an indicator to the statusbar
  - and many other improvements, see the [release notes](https://github.com/jupyter-lsp/jupyterlab-lsp/releases/tag/v0.6.1)
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

- bugfixes
  - fix issue that variables declared in cell magics(%%time, %%capture) are masked(
    [#635](https://github.com/jupyter-lsp/jupyterlab-lsp/issues/635)
    )
