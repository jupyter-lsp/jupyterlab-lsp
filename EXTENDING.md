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
along **once all listeners return** (or fail). This allows listeners to, for example,
modify files on disk before the language server reads them.

If a listener is going to perform an expensive activity that _shouldn't_ block
delivery of a message, a non-blocking technique like
[IOLoop.add_callback][add_callback] and/or a
[queue](https://www.tornadoweb.org/en/stable/queues.html) should be used.

[add_callback]: https://www.tornadoweb.org/en/stable/ioloop.html#tornado.ioloop.IOLoop.add_callback

#### Add a Listener with `entry_points`

Listeners can be added via [entry_points][] by a package installed in the same
environment as `notebook`:

```toml
# setup.cfg

[options.entry_points]
jupyter_lsp_listener_all_v1 =
  some-unique-name = some.module:some_function
jupyter_lsp_listener_client_v1 =
  some-other-unique-name = some.module:some_other_function
jupyter_lsp_listener_server_v1 =
  yet-another-unique-name = some.module:yet_another_function
```

At present, the entry point names generally have no impact on functionality
aside from logging in the event of an error on import.

[entry_points]: https://packaging.python.org/specifications/entry-points/

#### Add a Listener with Jupyter Configuration

Listeners can be added via `traitlets` configuration, e.g.

```yaml
# jupyter_notebook_config.jsons
{
  'LanguageServerManager':
    {
      'all_listeners': ['some.module.some_function'],
      'client_listeners': ['some.module.some_other_function'],
      'server_listeners': ['some.module.yet_another_function'],
    },
}
```

#### Add a listener with the Python API

`lsp_message_listener` can be used as a decorator, accessed as part of a
`serverextension`.

This listener receives _all_ messages from the client and server, and prints them
out.

```python
from jupyter_lsp import lsp_message_listener

def load_jupyter_server_extension(nbapp):

    @lsp_message_listener("all")
    async def my_listener(scope, message, languages, manager):
        print("received a {} {} message about {}".format(
          scope, message["method"], languages
        ))
```

`scope` is one of `client`, `server` or `all`, and is required.

#### Listener options

Fine-grained controls are available as part of the Python API. Pass these as
named arguments to `lsp_message_listener`.

- `languages`: a regular expression of languages
- `method`: a regular expression of LSP JSON-RPC method names
