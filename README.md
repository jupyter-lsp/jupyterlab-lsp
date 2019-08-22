# Language Server Protocol integration for JupyterLab

<!--[![Build Status](https://travis-ci.org/krassowski/jupyterlab-lsp.svg?branch=master)](https://travis-ci.org/krassowski/jupyterlab-lsp) [![codebeat badge](TODO)](https://codebeat.co/projects/github-com-krassowski-jupyterlab-lsp-master) -->
<!--[![Binder](https://beta.mybinder.org/badge.svg)](https://mybinder.org/v2/gh/krassowski/jupyterlab-lsp/master?urlpath=lab/tree/examples/demo.ipynb)-->

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

- highlight usages: just place your cursor on a variable, function etc and all the usages will be highlighted (works only in the file editor or within a single cell)

- auto invocation of completer on certain characters, for example '.' (dot) in Python

  ![invoke](https://raw.githubusercontent.com/krassowski/jupyterlab-lsp/master/examples/screenshots/auto_invoke.png)

- automatic signature suggestions

  ![signature](https://raw.githubusercontent.com/krassowski/jupyterlab-lsp/master/examples/screenshots/signature.png)

- advanced autocompletion (even when the kernel is off);

  ![autocompletion](https://raw.githubusercontent.com/krassowski/jupyterlab-lsp/master/examples/screenshots/autocompletion.png)

  when a kernel is available the suggestions from the kernel (such as keys of a dict and columns of a DataFrame autocompletion) are merged with the suggestions from LSP (currently only in notebook).

### Coming soon:

- multiple LSP connections per notebook, e.g. SQL embedded in a Python notebook, or R (using rpy2) embedded in Python notebook.
- autocompleter with documentation and sorting based on LSP suggestions
- unit tests
- system of settings, including option for aggressive autocompletion (like in hinterland)

### Planned:

- "rename" action (PR welcome)

### Low priority:

- Gutter with linter results
- Use the kernel session for autocompletion in FileEditor if available (PR welcome)

## Under the hood

This would not be possible if not the fantastic work of https://github.com/wylieconlon/lsp-editor-adapter.

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
   create `.lsp_symlink` and symlink your `home`, `usr`, or any other location which include the files that you wish to make possible to open in there:

```bash
mkdir .lsp_symlink
cd .lsp_symlink
ln -s /home home
ln -s /usr usr
```

If your user does not have sufficient permissions to traverse the entire path, you will not be able to open the file.

### Updatng the extension

To update already installed extension:

```bash
jupyter labextension update @krassowski/jupyterlab-lsp
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
