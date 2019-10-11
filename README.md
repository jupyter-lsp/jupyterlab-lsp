# Language Server Protocol integration for JupyterLab

[![Build Status](https://travis-ci.org/krassowski/jupyterlab-lsp.svg?branch=master)](https://travis-ci.org/krassowski/jupyterlab-lsp) [![codebeat badge](https://codebeat.co/badges/f55d0f28-8a84-4199-bc88-f2c306a9ce65)](https://codebeat.co/projects/github-com-krassowski-jupyterlab-lsp-master) [![Binder](https://mybinder.org/badge_logo.svg)](https://mybinder.org/v2/gh/krassowski/jupyterlab-lsp/master?urlpath=lab%2Ftree%2Fexamples%2FPython.ipynb)

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

New in 0.5.0:

- multiple LSP connections per notebook, e.g. SQL or R (using rpy2) embedded in Python notebook [(example)](https://github.com/krassowski/jupyterlab-lsp/blob/master/examples/Magics_and_rpy2.ipynb),
- symbol highlight under cursor now works in both file editors and notebooks,
- and many other improvements, see the [release notes](https://github.com/krassowski/jupyterlab-lsp/releases/tag/v0.5.0).

Coming in 0.6.0:

- automated LSP servers start and traitlets-based configuration
- "rename" action in file editor
- improved code navigation when there are multiple jump targets

### Coming soon:

- autocompleter with documentation and sorting based on LSP suggestions
- more unit tests
- system of settings, including options:
  - to enable aggressive autocompletion (like in hinterland)
  - to change the verbosity of signature hints (whether to show documentation, number of lines to be shown)

### Planned:

- "rename" action in notebooks

### Low priority:

- Gutter with linter results
- Use the kernel session for autocompletion in FileEditor if available (PR welcome)

If a feature you need is not on the lists above, please feel free to suggest it by opening a new [issue](https://github.com/krassowski/jupyterlab-lsp/issues).

#### Hints

- just like in old notebooks, you can still use the built-in <kbd>Shift</kbd> + <kbd>Tab</kbd> to get a signature in JupyterLab.
  This extension behaves well with this feature.

## Under the hood

This would not be possible if not the fantastic work at [wylieconlon/lsp-editor-adapter](https://github.com/wylieconlon/lsp-editor-adapter).

## Prerequisites

- JupyterLab

## Installation

1. install the extension:

```bash
jupyter labextension install @krassowski/jupyterlab-lsp
```

2. install servers for languages of your choice. Below are examples for Python (with [pyls](https://github.com/palantir/python-language-server)) and R (with [languageserver](https://github.com/REditorSupport/languageserver)):

```bash
pip install python-language-server[all]
```

```bash
R -e 'install.packages("languageserver")'
```

For the full list of language servers see the [Microsoft's list](https://microsoft.github.io/language-server-protocol/implementors/servers/); it may also be good to visit the repository of each server as many provide some additional configuration options.

3. create `servers.yml` file:

```yaml
langservers:
  python:
    - pyls
  R:
    - R
    - --slave
    - -e
    - languageserver::run()
```

4. Each time before starting JupyterLab, run:

```bash
node path_to_jupyterlab_staging/node_modules/jsonrpc-ws-proxy/dist/server.js --port 3000 --languageServers servers.yml
```

where `path_to_jupyterlab_staging` is the location of JupyterLab staging directory. Here are example locations on Ubuntu:

- if you use pyenv it should be in `~/.pyenv/versions/YOUR_VERSION_OR_VENV/share/jupyter/lab/staging/`
- if you use local installation, it might be in `~/.local/lib/python3.6/site-packages/jupyterlab/staging/` (where instead of python3.6 you should use your Python3 version having JupyterLab installed)

5. (Optional) to enable opening files outside of the root directory (the place where you start JupyterLab),
   create `.lsp_symlink` and symlink your `home`, `usr`, or any other location which includes the files that you wish to make possible to open in there:

```bash
mkdir .lsp_symlink
cd .lsp_symlink
ln -s /home home
ln -s /usr usr
```

If your user does not have sufficient permissions to traverse the entire path, you will not be able to open the file. A more detailed guide on symlinking (written for a related jupyterlab-go-to-definition extension) is available [here](https://github.com/krassowski/jupyterlab-go-to-definition/blob/master/README.md#which-directories-to-symlink).

### Updating the extension

To update already installed extension:

```bash
jupyter labextension update @krassowski/jupyterlab-lsp
```

#### Getting the latest alpha/beta/RC version

Use install command (update does not seem to work) appending `@version` to the extension name, like this:

```bash
jupyter labextension install @krassowski/jupyterlab-lsp@0.5.0-rc.0
```

## Development

For a development install (requires npm version 4 or later), do the following in the repository directory:

```bash
npm install
npm run build
jupyter labextension link .
```

To rebuild the package and the JupyterLab app:

```bash
npm run build
jupyter lab build
```

To run tests suite:

```bash
npm test
```
