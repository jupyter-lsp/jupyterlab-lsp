ve# jupyter-lsp

A [Language Server][language-server] proxy for Jupyter, powered by [jupyter-server-proxy][],
[jsonrpc-ws-proxy][] and [nodejs][].

## batteries expected: `autodetect`

Use your package manager of choice to install a [language server][lsp-implementations]
of choice. The following implementations are known to work with `jupyter-lsp`.
Don't see an implementation for the language server you want? You can
[bring your own language server](#bring-your-own-language-server)

> Consider [contributing](./CONTRIBUTING.md#connectors) one!

| language<br>`/lsp/...`    | `pip install ...`        | `npm install (-g) ...` <br/>`yarn/jlpm add (-g) ...` |
| ------------------------- | ------------------------ | :--------------------------------------------------: |
| python                    | `python-language-server` |                                                      |
| javascript<br/>typescript |                          |          `javascript-typescript-langserver`          |
| json                      |                          |            `vscode-json-languageservice`             |
| yaml                      |                          |                `yaml-language-server`                |
| css<br/>less<br/>css      |                          |             `vscode-css-languageservice`             |
| html                      |                          |            `vscode-html-languageservice`             |

[language-server]: https://microsoft.github.io/language-server-protocol/specification
[jupyter-server-proxy]: https://github.com/jupyterhub/jupyter-server-proxy
[jsonrpc-ws-proxy]: https://github.com/wylieconlon/jsonrpc-ws-proxy
[nodejs]: https://github.com/nodejs/node
[lsp-implementations]: https://microsoft.github.io/language-server-protocol/implementors/servers
[jupyter-lsp]: https://github.com/krassowski/jupyterlab-lsp.git

> possible future namespace...

## bring your own language server

### Jupyter config via `traitlets`

Like the Jupyter Notebook server, JupyterHub and others, `jupyter-lsp` can be
configured via Python or JSON. You can find out where to put them on your with:

```bash
jupyter --paths
```

They will be merged from bottom to top, and the directory where you launch your
`notebook` server wins, making it easy to check in to version control.

```yaml
# jupyter_notebook_config.json
{
  'LanguageServerApp':
    {
      'language_servers':
        {
          'my-language': ['/absolute/path/to/executable'],
          'my-other-language':
            ['/absolute/path/to/interpreter', 'language-server'],
        },
    },
}
```

```py
# jupyter_notebook_config.py
import shutil

c.LanguageServerApp.language_servers = {
    "my-language": shutil.which("some-language-server"),
    "my-other-language": ["/absolute/path/to/interpreter", "language-server"]
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

## `jsonrpc_ws_proxy`

> default: autodetect

A custom absolute path to the installation of `jsonrpc-ws-proxy/dist/server.js`

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

## `cmd`

> default: `<autodetected>/nodejs(.exe) <autodetect>/node_modules/jsonrpc-ws-proxy/dist/server.js`

An alternate command to start the proxy.
