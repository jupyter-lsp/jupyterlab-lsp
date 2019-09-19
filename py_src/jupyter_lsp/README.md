# jupyter-lsp

A [Language Server][language-server] proxy for Jupyter, powered by [jupyter-server-proxy][],
[jsonrpc-ws-proxy][] and [nodejs][].

## batteries expected
Use your package manager of choice to install a [language server][lsp-implementations]
of choice. The following implementations are known to work with [jupyter-lsp][]

> Don't see an implementation for the language server you want? Consider
  [contributing](./CONTRIBUTING.md#connectors)

|        | `pip install ...` | `npm install (-g)` <br/>`yarn/jlpm add (-g)` |
|--------|-------------------|:--------------------------------------------:|
| python | `pyls`            |                                              |
| javascript<br/>typescript  | `pyls`            |                                              |

[language-server]: https://microsoft.github.io/language-server-protocol/specification
[jupyter-server-proxy]: https://github.com/jupyterhub/jupyter-server-proxy
[jsonrpc-ws-proxy]: https://github.com/wylieconlon/jsonrpc-ws-proxy
[nodejs]: https://github.com/nodejs/node
[lsp-implementations]: https://microsoft.github.io/language-server-protocol/implementors/servers
[jupyter-lsp]: https://github.com/krassowski/jupyterlab-lsp.git

> possible future namespace...
  ```
  [jupyter-lsp]: https://github.com/jupyter/lsp
  ```
