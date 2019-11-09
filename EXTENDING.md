# Extend jupyterlab-lsp and jupyter-lsp

## jupyterlab-lsp

> At present, `jupyterlab-lsp` is still in very early development, and does not
> expose any runtime extension points. The [roadmap](./ROADMAP.md) lists several
> potential points of extension, but will require some refactoring to achieve.

## jupyter-lsp

### Language Server Specs

Language Server Specs can be [configured](./LANGUAGESERVERS.ms) by Jupyter users,
or distributed by third parties as python or JSON files. Since we'd like to see
as many Language Servers work out of the box as possible, consider
[contributing a spec](./CONTRIBUTING.md#specs), if it works well for you!

### Message Listeners

Message listeners may choose to receive LSP messages immediately after being
received from the client (e.g. `jupyterlab-lsp`) or a language server. All
listeners of a message are scheduled concurrently, and the message is passed
along once all processing has completed.

#### Python API

This listener receives _all_ messages from the client and server, and prints them
out.

```python
from jupyter_lsp import lsp_message_listener

@lsp_message_listener("all")
async def my_listener(scope, message, languages, manager):
    print("received a {} {} message about {}".format(
      scope, message["method"], languages
    ))
```

#### Listener options

Fine-grained controls are available as part of the python API, which can be
accessed as part of a `serverextension`

- `scope`: one of `client`, `server` or `all`
- `languages`: a regular expression of languages
- `method`: a regular expression of LSP JSON-RPC method names

#### Listener entry_points

> TBD

#### Listener traitlets

Like Language Servers Listeners can be added via `traitlets` configuration, e.g.

```json
{
  "LanguageServerManager": {
    "all_listeners": ["some_module.some_function"],
    "client_listeners": ["some_module.some_other_function"],
    "server_listeners": ["some_module.yet_some_function"]
  }
}
```
