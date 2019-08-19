# Language Server Protocol integration for JupyterLab

<!--[![Build Status](https://travis-ci.org/krassowski/jupyterlab-lsp.svg?branch=master)](https://travis-ci.org/krassowski/jupyterlab-lsp) [![codebeat badge](TODO)](https://codebeat.co/projects/github-com-krassowski-jupyterlab-lsp-master) -->
[![Binder](https://beta.mybinder.org/badge.svg)](https://mybinder.org/v2/gh/krassowski/jupyterlab-lsp/master?urlpath=lab/tree/examples/demo.ipynb)

### Features overview:

##### Working:
- hover over any piece of code; if an underline appears, you can press <kbd>Control</kbd> to get a tooltip with function/class signature, module documentation or any other piece of information that the language server provides
- linting: critical errors have red underline, warnings are orange, etc. Hover over the underlined code to see the linter's message
- go to definition: use context menu entries to jump to definition (currently only in the file editor) 
- highlight usages: just place your cursor on a variable, funciton ect and all the usages will be highlighted

##### In progress:
- completer (autocompletion), including auto invokation on certain characters (e.g. '.' (dot) in Python)
- better got to definition, including notebook


##### Planned:
- "rename" action

### This extension is highly experimental!

```bash
git clone https://github.com/krassowski/jupyterlab-lsp.git
cd jupyterlab-lsp
# dev-dependencies may be needed as well
npm install .
jupyter labextension install .
```

Install servers for languages of your choice. Below are examples for Python (with [pyls](https://github.com/palantir/python-language-server)) and R (with [languageserver](https://github.com/REditorSupport/languageserver)):

```bash
pip install python-language-server[all]
```

```bash
R -e 'install.packages("languageserver")'
```

create file called `servers.yml`:

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

For the full list of language servers see the [Microsoft's list](https://microsoft.github.io/language-server-protocol/implementors/servers/); it may also be good to visit the repository of each server as many provide some additional configuration options.

Then run (TODO: could this be started by the extension?):
```bash
node node_modules/jsonrpc-ws-proxy/dist/server.js --port 3000 --languageServers servers.yml
```

To enable opening files outside of the root directory (the place where you start JupyterLab),
create `.lsp_symlink` and symlink your `home`, `usr`, or any other location which include the files that you wish to make possible to open in there:
```bash
mkdir .lsp_symlink
cd .lsp_symlink
ln -s /home home
ln -s /usr usr
```

If your user does not have sufficient permissions to traverse the entire path, you will not be able to open the file.

### Under the hood

This would not be possible if not the fantastic work of https://github.com/wylieconlon/lsp-editor-adapter.


## Prerequisites

* JupyterLab

## Installation (not published yet!)

```bash
jupyter labextension install @krassowski/jupyterlab_lsp
```

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
