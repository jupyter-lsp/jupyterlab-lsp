# Language Server Protocol integration for Jupyter(Lab)

![tests](https://github.com/krassowski/jupyterlab-lsp/workflows/tests/badge.svg) [![Documentation Status](https://readthedocs.org/projects/jupyterlab-lsp/badge/?version=latest)](https://jupyterlab-lsp.readthedocs.io/en/latest/?badge=latest) [![Binder](https://mybinder.org/badge_logo.svg)](https://mybinder.org/v2/gh/krassowski/jupyterlab-lsp/master?urlpath=lab%2Ftree%2Fexamples%2FPython.ipynb)

> _This project is still maturing, but you are welcome to check it out, leave feedback and/or a PR_

Quick Links: **[Installation](#installation) | [Configuring](./docs/Configuring.ipynb) | [Updating](#updating) | [Changelog](./CHANGELOG.md) | [Roadmap](./docs/Roadmap.ipynb) | [Contributing](./CONTRIBUTING.md) | [Extending](./docs/Extending.ipynb)**

## Features

> Examples show Python code, but most features also work in R, bash, typescript, and [many other languages][language-servers].

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

Use the context menu entry, or <kbd>Alt</kbd> + :computer_mouse: to jump to definitions (you can change it to <kbd>Ctrl</kbd>/<kbd>⌘</kbd> in settings); use <kbd>Alt</kbd> + <kbd>o</kbd> to jump back

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
Use context menu on rows in the panel to filter out diagnostics or copy their message.

![panel](https://raw.githubusercontent.com/krassowski/jupyterlab-lsp/master/examples/screenshots/panel.png)

## Prerequisites

You will need to have both of the following installed:

- JupyterLab >=3.0.0,<4.0.0a0
- Python 3.6+

In addition, if you wish to use javascript, html, markdown or any other NodeJS-based language server you will need to have appropriate NodeJS version installed.

> Note: Installation for JupyterLab 2.x requires a different procedure, please consult the documentation for the extension [version 2.x][version 2.x docs].

## Installation

> For more extensive installation instructions, see the [documentation][installation-documentation].

For the current stable version, the following steps are recommended.
Use of a python `virtualenv` or a conda env is also recommended.

1. install python 3

   ```bash
   conda install -c conda-forge python=3
   ```

1. install JupyterLab and the extensions

   ```bash
   conda install -c conda-forge 'jupyterlab>=3.0.0,<4.0.0a0' jupyterlab-lsp
   # or
   pip install 'jupyterlab>=3.0.0,<4.0.0a0' jupyterlab-lsp
   ```

   > Note: `jupyterlab-lsp` provides both the server extension and the lab extension.

   > Note: With conda, you could take advantage of the bundles: `jupyter-lsp-python`
   > or `jupyter-lsp-r` to install both the server extension and the language server.

1. install LSP servers for languages of your choice; for example, for Python
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
   [supported language servers][language-servers]
   which includes installation hints for the common package managers (npm/pip/conda).
   In general, any LSP server from the
   [Microsoft list](https://microsoft.github.io/language-server-protocol/implementors/servers/)
   should work after [some additional configuration](./CONTRIBUTING.md#specs).

   Note: it is worth visiting the repository of each server you install as
   many provide additional configuration options.

1. (Optional, Linux/OSX-only) to enable opening files outside of the root
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

### Configuring the servers

Server configurations can be edited using the Advanced Settings editor in JupyterLab (_Settings > Advanced Settings Editor_). For settings specific to each server, please see the [table of language servers][language-servers]. Example settings might include:

```json
{
  "language_servers": {
    "pyls": {
      "serverSettings": {
        "pyls.plugins.pydocstyle.enabled": true,
        "pyls.plugins.pyflakes.enabled": false,
        "pyls.plugins.flake8.enabled": true
      }
    },
    "r-languageserver": {
      "serverSettings": {
        "r.lsp.debug": false,
        "r.lsp.diagnostics": false
      }
    }
  }
}
```

The `serverSettings` key specifies the configurations sent to the language servers. These can be written using stringified dot accessors like above (in the VSCode style), or as nested JSON objects, e.g.:

```json
{
  "language_servers": {
    "pyls": {
      "serverSettings": {
        "pyls": {
          "plugins": {
            "pydocstyle": {
              "enabled": true
            },
            "pyflakes": {
              "enabled": false
            },
            "flake8": {
              "enabled": true
            }
          }
        }
      }
    }
  }
}
```

#### Other configuration methods

Some language servers, such as `pyls`, provide other configuration methods _in addition_ to language-server configuration messages (accessed using the Advanced Settings Editor). For example, `pyls` allows users to configure the server using a local configuration file. You can change the inspection/diagnostics for server plugins like `pycodestyle` there.

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

[language-servers]: https://jupyterlab-lsp.readthedocs.io/en/latest/Language%20Servers.html
[installation-documentation]: https://jupyterlab-lsp.readthedocs.io/en/latest/Installation.html
[version 2.x docs]: https://jupyterlab-lsp.readthedocs.io/en/2.x/Installation.html
