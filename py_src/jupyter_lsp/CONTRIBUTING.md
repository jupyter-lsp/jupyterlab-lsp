# Contribute to jupyter-lsp

`jupyter-lsp` is open source software, and all contributions that adhere to
good sense, good taste, and the [Jupyter Code of Conduct][code-of-conduct] are
welcome, and will be reviewed, time-permitting, by the contributors.

## How to Help

You can contribute to `jupyter-lsp` by:

- creating [connectors](#Connectors)
  - you can publish them yourself (it might be a single file)...
  - or advocate for adding your connector to the [github repository][jupyter-lsp]
    and its various distributions
    - these are great first issues, as you might not need to know any python or
      javascript
- improving [documentation](#Documentation)
- tackle big issues from the [future roadmap](#Future-Roadmap-Items)
- improving [testing](#Testing)
- reviewing pull requests

## Roadmap

- release on `pip` and `conda`

## Future Roadmap Items

- websocket uri multiplexing
  - allow a single language server process to provide multiple JSON-RPC WebSocket
    endpoints
    - this could be an upstream contribution to [jsonrpc-ws-proxy][] or part of
- remove the hard requirement on [nodejs][] and [jsonrpc-ws-proxy][]
  - though many...
    - language servers and
    - frontend extensions
      ... will _still_ require a `nodejs`-backed, `npm`-delivered server or build
      chain, other approaches _should_ be possible
  - this would likely be an asynchronous, Python 3.6+ implementation

## Connectors

It is convenient to collect common patterns for connecting to installed language
servers as pip-installable packages that Just Work.

If an advanced user installs, locates, and configures, their own language
server it will always win an auto-configured one.

### Writing a connector

> See the connectors in this directory for implementations.

A connector is a python function that accepts as single argument, the
`LanguageServerApp`, and returns a dictionary of the form:

```python
{
  "language-name": ["server", "command"]
}
```

The connector should check to ensure that the command _could_ be run:

- its runtime (e.g. `nodejs`, `ruby`, `julia`) is installed
- the language server itself is installed

#### Common Concerns

- some language servers need to have their connection mode specified
  - the `stdio` interface is the only one supported
    - PRs welcome to support other modes!
- because of its VSCode heritage, many language servers use `nodejs`
  - `LanguageServerApp.nodejs` will provide the location of the `nodejs` that
    will be used for the underlying [jsonrpc-ws-proxy][]

#### Example: making a connector pip-installable `my-cool-language` connector

Consider the following (absolutely minimal) directory structure:

```
- setup.py
- jupyter_lsp_my_cool_language_server.py
```

> You should consider adding a LICENSE, some documentation, etc.
> TODO: cookiecutter

Define your connector:

```
# jupyter_lsp_my_cool_language_server.py
from shutil import which


def connect_my_cool_language_server(app):
    cool_language_server = shutil.which("cool-language-server")

    if not cool_language_server:
        return {}

    return {
        "cool-language": [cool_language_server]
    }
```

Tell `pip` how to package your connector:

```
# setup.py
from setuptools import setup
setup(
    name="jupyter-lsp-my-cool-language-server",
    py_modules=[""],
    entry_points={
        "jupyter_lsp_connector_v0": [
            "my-cool-language-server":
              'jupyter_lsp_my_cool_language_server:connect_my_cool_language_server'
        ]
    }
)
```

## Testing

> TBD
>
> - pytest
> - hypothesis
> - conda/docker

## Documentation

> TBD
>
> - sphinx
> - one of the sphinx/ipynb connectors
> - cookiecutter

[language-server]: https://microsoft.github.io/language-server-protocol/specification
[jupyter-server-proxy]: https://github.com/jupyterhub/jupyter-server-proxy
[jsonrpc-ws-proxy]: https://github.com/wylieconlon/jsonrpc-ws-proxy
[nodejs]: https://github.com/nodejs/node
[lsp-implementations]: https://microsoft.github.io/language-server-protocol/implementors/servers
[jupyter-lsp]: https://github.com/krassowski/jupyterlab-lsp.git
[code-of-conduct]: https://github.com/jupyter/governance/blob/master/conduct/code_of_conduct.md
