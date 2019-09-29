ve# jupyter-lsp

A [Language Server][language-server] proxy for Jupyter, powered by [python-jsonrpc-server][].

## batteries expected: `autodetect`

Use your package manager of choice to install a [language server][lsp-implementations]
of choice. The following implementations are tested to work with `jupyter-lsp`.
Don't see an implementation for the language server you want? You can
[bring your own language server](#bring-your-own-language-server)

> Consider [contributing your language server spec](./CONTRIBUTING.md#spec)!

| language<br>`/lsp/...`    | `pip install ...`        | `npm install (-g) ...` <br/>`yarn/jlpm add (-g) ...` |
| ------------------------- | ------------------------ | :--------------------------------------------------: |
| css<br/>less<br/>css      |                          |           `vscode-css-languageserver-bin`            |
| html                      |                          |           `vscode-html-languageserver-bin`           |
| javascript<br/>typescript |                          |          `javascript-typescript-langserver`          |
| json                      |                          |           `vscode-json-languageserver-bin`           |
| python                    | `python-language-server` |                                                      |
| yaml                      |                          |                `yaml-language-server`                |

[language-server]: https://microsoft.github.io/language-server-protocol/specification
[jupyter-server-proxy]: https://github.com/jupyterhub/jupyter-server-proxy
[python-jsonrpc-server]: https://github.com/palantir/python-jsonrpc-server
[lsp-implementations]: https://microsoft.github.io/language-server-protocol/implementors/servers
[jupyter-lsp]: https://github.com/krassowski/jupyterlab-lsp.git

> possible future namespace...

## bring your own language server

### Jupyter config via `traitlets`

Like the Jupyter Notebook server, JupyterHub and others, `jupyter-lsp` can be
configured via Python or JSON files in well-known locations. You can find out
where to put them on your system with:

```bash
jupyter --paths
```

They will be merged from bottom to top, and the directory where you launch your
`notebook` server wins, making it easy to check in to version control.

```yaml
# jupyter_notebook_config.json or e.g.         -- unique!
#                                              |
#                                              v
# PREFIX/etc/jupyter/jupyter_notebook_config.d/a-language-server.json
{
  'LanguageServerApp':
    {
      'language_servers':
        {
          'a-language-server-implementation':
            {
              'argv': ['/absolute/path/to/a-language-server'],
              'languages': ['a-language'],
            },
        },
    },
}
```

More complex configurations that can't be hard-coded benefit from the python approach

```py
# jupyter_notebook_config.py
import shutil

c.LanguageServerApp.language_servers = {
    "a-language-server-implementation": {
        "argv": [shutil.which("a-language-server")],
        "languages": ["a-language"]
    },
    "another-language-implementation": {
        "argv": [shutil.which("a-language-interpreter"), "language-server"],
        "languages": ["another-language"]
    }
  }
}
```

### Python `entry_points`

`pip`-installable packages in the same environment as the Jupyter `notebook` server
can be automatically detected. These are a little more involved: see
[CONTRIBUTING](./CONTRIBUTING.md).

# Other Configuration

## `nodejs`

> default: autodetect

A custom absolute path to your `nodejs` executable.

## `autodetect`

> default: True

Will look for all [known language servers](#batteries-expected). Same-named
`language_servers` will be preferred.

## `node_roots`

> default: []

Paths to search for `node_modules`, such as `jsonrpc-ws-proxy`,
`nodejs`-backed language servers, etc.

## `extra_node_roots`

> default: []

Additional places to look first for `node_modules`.
