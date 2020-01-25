# Language Server Protocol integration for Jupyter(Lab)

[![Build Status](https://travis-ci.org/krassowski/jupyterlab-lsp.svg?branch=master)](https://travis-ci.org/krassowski/jupyterlab-lsp) [![Build Status](https://dev.azure.com/krassowskimichal/jupyterlab-lsp/_apis/build/status/jupyterlab-lsp?branchName=master)](https://dev.azure.com/krassowskimichal/jupyterlab-lsp/_build/latest?definitionId=1&branchName=master) [![Binder](https://mybinder.org/badge_logo.svg)](https://mybinder.org/v2/gh/krassowski/jupyterlab-lsp/master?urlpath=lab%2Ftree%2Fexamples%2FPython.ipynb)

> _This project is still maturing, but you are welcome to check it out, leave feedback and/or a PR_

Quick Links: **[Installation](#installation) | [Language Servers](./docs/LANGUAGESERVERS.md) | [Updating](#updating) | [Changelog](./CHANGELOG.md) | [Roadmap](./docs/ROADMAP.md) | [Contributing](./CONTRIBUTING.md) | [Extending](./docs/EXTENDING.md)**

## Features

> Examples show Python code, but most features also work in R, bash, typescript and [many other languages](./docs/LANGUAGESERVERS.md).

### Hover

Hover over any piece of code; if an underline appears, you can press <kbd>Ctrl</kbd>
to get a tooltip with function/class signature, module documentation or any other
piece of information that the language server provides

![hover](https://raw.githubusercontent.com/krassowski/jupyterlab-lsp/master/examples/screenshots/hover.png)

### Diagnostics

Critical errors have red underline, warnings are orange, etc. Hover
over the underlined code to see a more detailed message

![inspections](https://raw.githubusercontent.com/krassowski/jupyterlab-lsp/master/examples/screenshots/inspections.png)

### Jump to Definition

Use the context menu entries to jump to definitions

![jump](https://raw.githubusercontent.com/krassowski/jupyterlab-lsp/master/examples/screenshots/jump_to_definition.png)

### Highlight References

Place your cursor on a variable, function, etc and all the usages will be highlighted

### Automatic Completion

Certain characters, for example '.' (dot) in Python, will automatically trigger
completion

![invoke](https://raw.githubusercontent.com/krassowski/jupyterlab-lsp/master/examples/screenshots/auto_invoke.png)

### Automatic Signature Suggestions

Function signatures will automatically be displayed

![signature](https://raw.githubusercontent.com/krassowski/jupyterlab-lsp/master/examples/screenshots/signature.png)

### Kernel-less Autocompletion

Advanced static-analysis autocompletion without a running kernel

![autocompletion](https://raw.githubusercontent.com/krassowski/jupyterlab-lsp/master/examples/screenshots/autocompletion.png)

> When a kernel is available the suggestions from the kernel (such as keys of a
> dict and columns of a DataFrame autocompletion) are merged with the suggestions
> from the Language Server (currently only in notebook).

### Rename

Rename variables, functions and more, in both: notebooks and the file editor.
Use the context menu option or the <kbd>F2</kbd> shortcut to invoke.

![rename](https://raw.githubusercontent.com/krassowski/jupyterlab-lsp/master/examples/screenshots/rename.png)

### Diagnostics panel

Sort and jump between the diagnostics using the diagnostics panel.
Open it searching for "Show diagnostics panel" in JupyterLab commands palette or from the context menu.

![panel](https://raw.githubusercontent.com/krassowski/jupyterlab-lsp/master/examples/screenshots/panel.png)

## Prerequisites

Either:

- JupyterLab >=1.1.4,<1.2
- JupyterLab >=1.2.4,<1.3.0a0
- Python 3.5+
- nodejs 8+

## Installation

For the current stable version:

1. install the server extension:

   ```bash
   pip install --pre jupyter-lsp
   ```

2. install the frontend extension:

   ```bash
   jupyter labextension install @krassowski/jupyterlab-lsp
   ```

3. install LSP servers for languages of your choice; for example, for Python
   ([pyls](https://github.com/palantir/python-language-server)) and
   R ([languageserver](https://github.com/REditorSupport/languageserver)) servers:

   ```bash
   pip install python-language-server[all]
   R -e 'install.packages("languageserver")'
   ```

   or from `conda-forge`

   ```bash
   conda install -c conda-forge python-language-server r-languageserver
   ```

   Please see our full list of
   [supported language servers](./docs/LANGUAGESERVERS.md)
   which includes installation hints for the common package managers (npm/pip/conda).
   In general, any LSP server from the
   [Microsoft list](https://microsoft.github.io/language-server-protocol/implementors/servers/)
   should work after [some additional configuration](./CONTRIBUTING.md#specs).

   Note: it may be worth visiting the repository of each server you install as
   many provide additional configuration options.

4. (Optional, Linux/OSX-only) to enable opening files outside of the root
   directory (the place where you start JupyterLab), create `.lsp_symlink` and
   symlink your `/home`, or any other location which includes the files that you
   wish to make possible to open in there:

   ```bash
   mkdir .lsp_symlink
   cd .lsp_symlink
   ln -s /home home
   ```

   If your user does not have sufficient permissions to traverse the entire path,
   you will not be able to open the file. A more detailed guide on symlinking
   (written for a related jupyterlab-go-to-definition extension) is available
   [here](https://github.com/krassowski/jupyterlab-go-to-definition/blob/master/README.md#which-directories-to-symlink).

### Updating

To update previously installed extensions:

```bash
pip install -U jupyter-lsp
jupyter labextension update @krassowski/jupyterlab-lsp
```

### Getting the latest alpha/beta/RC version

Use `install` command (update does not seem to work) appending `@<0.x.y.rc-z>` to the
extension name, like this:

```bash
jupyter labextension install @krassowski/jupyterlab-lsp@0.7.0-rc.0
```

### Configuring the servers

We plan to provide a configuration GUI at some time ([#25](https://github.com/krassowski/jupyterlab-lsp/issues/25)), but in the meantime, you can use the instructions for the specific servers as described on their websites (see the table in [LANGUAGESERVERS.md](./docs/LANGUAGESERVERS.md) for links).

#### I want to hide specific diagnostics/inspections/warnings

For example, the Python server that we support by default ([pyls](https://github.com/palantir/python-language-server)) has a [configuration section](https://github.com/palantir/python-language-server#configuration) in ther documentation which refers to the providers of specific features, including `pycodestyle` for inspections/diagnostics.

The exact configuration details will vary between operating systems (please see the [configuration section of pycodestyle documentation](https://pycodestyle.readthedocs.io/en/latest/intro.html#configuration)), but as an example, on Linux you would simply need to create a file called `~/.config/pycodestyle`, which may look like that:

```cfg
[pycodestyle]
ignore = E402, E703
max-line-length = 120
```

In the example above:

- ignoring E402 allows imports which are not on the very top of the file,
- ignoring E703 allows terminating semicolon (useful for matplotlib plots),
- the maximal allowed line length is increased to 120.

After changing the configuration you may need to restart the JupyterLab, and please be advised that the errors in configuration may prevent the servers from functioning properly.

Again, please do check the pycodestyle documentation for specific error codes, and check the configuration of other feature providers and language servers as needed.

## Acknowledgements

This would not be possible without the fantastic initial work at
[wylieconlon/lsp-editor-adapter](https://github.com/wylieconlon/lsp-editor-adapter).
