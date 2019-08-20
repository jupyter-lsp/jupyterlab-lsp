# Language Server Protocol integration for JupyterLab

<!--[![Build Status](https://travis-ci.org/krassowski/jupyterlab-lsp.svg?branch=master)](https://travis-ci.org/krassowski/jupyterlab-lsp) [![codebeat badge](TODO)](https://codebeat.co/projects/github-com-krassowski-jupyterlab-lsp-master) -->
<!--[![Binder](https://beta.mybinder.org/badge.svg)](https://mybinder.org/v2/gh/krassowski/jupyterlab-lsp/master?urlpath=lab/tree/examples/demo.ipynb)-->

**This extension is highly experimental, though you are encouraged to try it, leave feedback and/or a PR**

## Features overview:

### Implemented:
- hover over any piece of code; if an underline appears, you can press <kbd>Ctrl</kbd> to get a tooltip with function/class signature, module documentation or any other piece of information that the language server provides

![hover](https://raw.githubusercontent.com/krassowski/jupyterlab-lsp/master/examples/screenshots/hover.png)

- linting: critical errors have red underline, warnings are orange, etc. Hover over the underlined code to see the linter's message

![inspections](https://raw.githubusercontent.com/krassowski/jupyterlab-lsp/master/examples/screenshots/inspections.png)

- go to definition: use context menu entries to jump to definition (currently only in the file editor) 
- highlight usages: just place your cursor on a variable, function etc and all the usages will be highlighted (works only in the file editor or within a single cell)
- advanced autocompletion - even when the kernel is off!

![autocompletion](https://raw.githubusercontent.com/krassowski/jupyterlab-lsp/master/examples/screenshots/autocompletion.png)

### In progress:
- auto invocation of completer on certain characters (e.g. '.' (dot) in Python)
- completer: merge suggestions from LSP, kernel and tokens (currently LSP and tokens only)
- better go-to-definition functionality, including notebook


### Planned:
- "rename" action

### May be included:
- Gutter with linter results


## Under the hood

This would not be possible if not the fantastic work of https://github.com/wylieconlon/lsp-editor-adapter.

## Prerequisites

* JupyterLab

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
node node_modules/jsonrpc-ws-proxy/dist/server.js --port 3000 --languageServers servers.yml
```

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
jupyter labextension update @krassowski/jupyterlab_lsp
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
