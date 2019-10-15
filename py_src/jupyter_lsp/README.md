# jupyter-lsp

> a Multi-[Language Server][language-server] WebSocket proxy for your Jupyter
> `notebook` or `lab` server. For Python 3.5+.

See the parent of this repository, [jupyterlab-lsp](../../README.md) for the
reference client implementation for [JupyterLab][]

## batteries expected

`jupyter-lsp` doesn't come with any Language Servers! However, we will try to use
them if they _are_ installed and we know about them.

> You can disable this behavior by configuring [`autodetect`](#autodetect)

Use a package manager to install a [language server][lsp-implementations].
from the table below. These implementations are tested to work with `jupyter-lsp`.

Don't see an implementation for the language server you want? You can
[bring your own language server](#bring-your-own-language-server).

> Please consider [contributing your language server spec](./CONTRIBUTING.md#spec)
> to `jupyter-lsp`!

| language                  | `npm install (-g)` <br/>`yarn/jlpm add (-g)` |      `pip install`       | `conda install -c conda-forge` | `Rscript -e 'install.packages()'` |
| ------------------------- | :------------------------------------------: | :----------------------: | :----------------------------: | :-------------------------------: |
| bash                      |            `bash-language-server`            |                          |                                |                                   |
| css<br/>less<br/>css      |       `vscode-css-languageserver-bin`        |                          |                                |                                   |
| docker                    |     `dockerfile-language-server-nodejs`      |                          |                                |                                   |
| html                      |       `vscode-html-languageserver-bin`       |                          |                                |                                   |
| javascript<br/>typescript |      `javascript-typescript-langserver`      |                          |                                |                                   |
| json                      |       `vscode-json-languageserver-bin`       |                          |                                |                                   |
| markdown                  |          `unified-language-server`           |                          |                                |                                   |
| python                    |                                              | `python-language-server` |    `python-language-server`    |                                   |
| r                         |                                              |                          |       `r-languageserver`       |         `languageserver`          |
| yaml                      |            `yaml-language-server`            |                          |                                |                                   |

[language-server]: https://microsoft.github.io/language-server-protocol/specification
[jupyter-server-proxy]: https://github.com/jupyterhub/jupyter-server-proxy
[lsp-implementations]: https://microsoft.github.io/language-server-protocol/implementors/servers
[jupyter-lsp]: https://github.com/krassowski/jupyterlab-lsp.git
[jupyterlab]: https://github.com/jupyterlab/jupyterlab

> possible future namespace...

## bring your own language server

### Jupyter config via `traitlets`

Like the Jupyter Notebook server, JupyterHub and other Jupyter interactive computing
tools, `jupyter-lsp` can be configured via [Python or JSON files][notebook-config]
in _well-known locations_. You can find out where to put them on your system with:

[notebook-config]: https://jupyter-notebook.readthedocs.io/en/stable/config.html

```bash
jupyter --paths
```

They will be merged from bottom to top, and the directory where you launch your
`notebook` server wins, making it easy to check in to version control.

```python
# ./jupyter_notebook_config.json                 ---------- unique! -----------
#                                               |                              |
# or e.g.                                       V                              V
# $PREFIX/etc/jupyter/jupyter_notebook_config.d/a-language-server-implementation.json
{
  "LanguageServerManager": {
      "language_servers": {
          "a-language-server-implementation": {
              "argv": ["/absolute/path/to/a-language-server", "--stdio"],
              "languages": ["a-language"]
            }
        }
    }
}
```

More complex configurations that can't be hard-coded may benefit from the python approach:

```py
# jupyter_notebook_config.py
import shutil

# c is a magic, lazy variable
c.LanguageServerManager.language_servers = {
    "a-language-server-implementation": {
        # if installed as a binary
        "argv": [shutil.which("a-language-server")],
        "languages": ["a-language"]
    },
    "another-language-implementation": {
        # if run like a script
        "argv": [shutil.which("another-language-interpreter"), "another-language-server"],
        "languages": ["another-language"]
    }
  }
}
```

### Python `entry_points`

`pip`-installable packages in the same environment as the Jupyter `notebook` server
can be automatically detected as providing a language server spec. These are a
little more involved: see [CONTRIBUTING](./CONTRIBUTING.md).

# Other Configuration Options

Like `language_servers`, these can be configured via `jupyter_notebook_config.json`
(or .py) or via command line arguments to `jupyter notebook` or `jupyter lab`.

## nodejs

> default: autodetect

A custom absolute path to your `nodejs` executable.

## autodetect

> default: True

`jupyter-lsp` will look for all [known language servers](#batteries-expected).
User-configured `language_servers` of the same implementation will be preferred
over `autodetect`ed ones.

## node_roots

> default: []

Absolute paths to search for `node_modules`, such as `nodejs`-backed language servers.
The order is, roughly:

- the folder where `notebook` or `lab` was launched
- the JupyterLab `staging` folder
- wherever `conda` puts global node modules
- wherever some other conventions put it

## extra_node_roots

> default: []

Additional places `jupyter-lsp` will look for `node_modules`. These will be checked
before `node_roots`
