# Language Server Protocol integration for JupyterLab

[![Build Status](https://travis-ci.org/krassowski/jupyterlab-lsp.svg?branch=master)](https://travis-ci.org/krassowski/jupyterlab-lsp) [![Build Status](https://dev.azure.com/krassowskimichal/jupyterlab-lsp/_apis/build/status/jupyterlab-lsp?branchName=master)](https://dev.azure.com/krassowskimichal/jupyterlab-lsp/_build/latest?definitionId=1&branchName=master) [![codebeat badge](https://codebeat.co/badges/f55d0f28-8a84-4199-bc88-f2c306a9ce65)](https://codebeat.co/projects/github-com-krassowski-jupyterlab-lsp-master)  [![Binder](https://mybinder.org/badge_logo.svg)](https://mybinder.org/v2/gh/krassowski/jupyterlab-lsp/master?urlpath=lab%2Ftree%2Fexamples%2FPython.ipynb) 

_This extension is in its early days, but you are welcome to check it out, leave feedback and/or a PR_

## Features overview:

### Implemented

Examples below are for Python, but it works as well for R:

- hover over any piece of code; if an underline appears, you can press <kbd>Ctrl</kbd> to get a tooltip with function/class signature, module documentation or any other piece of information that the language server provides

  ![hover](https://raw.githubusercontent.com/krassowski/jupyterlab-lsp/master/examples/screenshots/hover.png)

- linting: critical errors have red underline, warnings are orange, etc. Hover over the underlined code to see the linter's message

  ![inspections](https://raw.githubusercontent.com/krassowski/jupyterlab-lsp/master/examples/screenshots/inspections.png)

- go to definition: use the context menu entries to jump to definitions

  ![jump](https://raw.githubusercontent.com/krassowski/jupyterlab-lsp/master/examples/screenshots/jump_to_definition.png)

- highlight usages: just place your cursor on a variable, function etc and all the usages will be highlighted

- auto invocation of completer on certain characters, for example '.' (dot) in Python

  ![invoke](https://raw.githubusercontent.com/krassowski/jupyterlab-lsp/master/examples/screenshots/auto_invoke.png)

- automatic signature suggestions

  ![signature](https://raw.githubusercontent.com/krassowski/jupyterlab-lsp/master/examples/screenshots/signature.png)

- advanced autocompletion (even when the kernel is off);

  ![autocompletion](https://raw.githubusercontent.com/krassowski/jupyterlab-lsp/master/examples/screenshots/autocompletion.png)

  when a kernel is available the suggestions from the kernel (such as keys of a dict and columns of a DataFrame autocompletion) are merged with the suggestions from LSP (currently only in notebook).

New in 0.6.0:

- automated LSP servers start and traitlets-based configuration
- "rename" action in file editor
- improved code navigation when there are multiple jump targets
- and many other improvements, see the [release notes](https://github.com/krassowski/jupyterlab-lsp/releases/tag/v0.6.0).

### Coming soon:

- autocompleter with documentation and sorting based on LSP suggestions
- system of settings, including options:
  - to enable aggressive autocompletion (like in hinterland)
  - to change the verbosity of signature hints (whether to show documentation, number of lines to be shown)
 - "rename" action in notebooks
 - gutter with linter results (low priority)
 - use the kernel session for autocompletion in FileEditor if available (PR welcome)

If a feature you need is not on the lists above, please feel free to suggest it by opening a new [issue](https://github.com/krassowski/jupyterlab-lsp/issues).

#### Hints

- just like in old notebooks, you can still use the built-in <kbd>Shift</kbd> + <kbd>Tab</kbd> to get a signature in JupyterLab.
  This extension behaves well with this feature.

## Prerequisites

- JupyterLab

## Installation

For 0.6 version:

1. install and enable the server extension:

   ```bash
   pip install jupyter-lsp
   jupyter serverextension enable --sys-prefix --py jupyter_lsp
   ```

2. install the frontend extension:

   ```bash
   jupyter labextension install @krassowski/jupyterlab-lsp
   ```

3. install LSP servers for languages of your choice; for example, for Python ([pyls](https://github.com/palantir/python-language-server)) and R ([languageserver](https://github.com/REditorSupport/languageserver)) servers, use:

   ```bash
   pip install python-language-server[all]
   R -e 'install.packages("languageserver")'
   ```

   Please see our full list of [supported language servers](./py_src/jupyter_lsp/README.md#installing-language-servers) which includes installation hints for the common package managers (npm/pip/conda).
   In general, any LSP server from the [Microsoft's list](https://microsoft.github.io/language-server-protocol/implementors/servers/) should work after [some additional configuration](./py_src/jupyter_lsp/CONTRIBUTING.md#specs).

   Note: it may be worth visiting the repository of each server you install as many provide additional configuration options.

4. (Optional) to enable opening files outside of the root directory (the place where you start JupyterLab),
   create `.lsp_symlink` and symlink your `home`, or any other location which includes the files that you wish to make possible to open in there:

   ```bash
   mkdir .lsp_symlink
   cd .lsp_symlink
   ln -s /home home
   ```

   If your user does not have sufficient permissions to traverse the entire path, you will not be able to open the file. A more detailed guide on symlinking (written for a related jupyterlab-go-to-definition extension) is available [here](https://github.com/krassowski/jupyterlab-go-to-definition/blob/master/README.md#which-directories-to-symlink).

### Updating the extension

To update already installed extension:

```bash
pip install -U jupyter-lsp
jupyter labextension update @krassowski/jupyterlab-lsp
```

#### Getting the latest alpha/beta/RC version

Use install command (update does not seem to work) appending `@version` to the extension name, like this:

```bash
jupyter labextension install @krassowski/jupyterlab-lsp@0.5.0-rc.0
```

## Development

For a development install (requires `nodejs` 8 or later and `jupyterlab` 1.1),
run the following in the repository directory:

```bash
jlpm
jlpm build
jupyter labextension install .
```

To rebuild the package and the JupyterLab app:

```bash
jlpm build
jupyter lab build
```

To watch the files and build continuously:

```bash
jlpm watch           # leave this running...
jupyter lab --watch  # ...in another terminal
```

To check and fix code style:

```bash
jlpm lint
```

To run test the suite:

```bash
jlpm test
```

## Acknowledgements

This would not be possible if not the fantastic work at [wylieconlon/lsp-editor-adapter](https://github.com/wylieconlon/lsp-editor-adapter).
