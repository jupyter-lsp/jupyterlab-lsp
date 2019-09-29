# Contribute to jupyter-lsp

`jupyter-lsp` is [open source](../../LICENSE) software, and all contributions
conforming to good sense, good taste, and the
[Jupyter Code of Conduct][code-of-conduct] are welcome, and will be reviewed,
time-permitting, by the contributors.

## How to Help

You can contribute to `jupyter-lsp` by:

- creating [specs](#Specs)
  - you can publish them yourself (it might be a single file)...
  - or advocate for adding your spec to the [github repository][jupyter-lsp]
    and its various distributions
    - these are great first issues, as you might not need to know any python or
      javascript
- improving [documentation](#Documentation)
- tackle Big Issues from the [future roadmap](#Future-Roadmap-Items)
- improving [testing](#Testing)
- reviewing pull requests

## Roadmap

- release on `pip` and `conda`

## Future Roadmap Items

- add hook system to allow serverextensions to modify, inspect and react to
  LSP messages

## Specs

It is convenient to collect common patterns for connecting to installed language
servers as pip-installable packages that Just Work.

If an advanced user installs, locates, and configures, their own language
server it will always win vs an auto-configured one.

### Writing a spec

> See the built-in [specs](./specs) for implementations and some
> [helpers](./specs/utils.py).

A spec is a python function that accepts a single argument, the
`LanguageServerManager`, and returns a dictionary of the form:

```python
{
  "unique-implementation-name": {
      "argv": ["server", "command"],
      "languages": ["a", "lang"]
  }
}
```

The spec should check to ensure that the command _could_ be run:

- its runtime (e.g. `nodejs`, `ruby`, `julia`) is installed
- the language server itself is installed

#### Common Concerns

- some language servers need to have their connection mode specified
  - the `stdio` interface is the only one supported
    - PRs welcome to support other modes!
- because of its VSCode heritage, many language servers use `nodejs`
  - `LanguageServerManager.nodejs` will provide the location of our best
    guess at where a user's `nodejs` might be found

#### Example: making a pip-installable `cool-language-server` spec

Consider the following (absolutely minimal) directory structure:

```
- setup.py
- jupyter_lsp_my_cool_language_server.py
```

> You should consider adding a LICENSE, some documentation, etc.
> TODO: cookiecutter

Define your spec:

```
# jupyter_lsp_my_cool_language_server.py
from shutil import which


def cool(app):
    cool_language_server = shutil.which("cool-language-server")

    if not cool_language_server:
        return {}

    return {
        "cool-language-server": {
            "argv": [cool_language_server],
            "languages": ["cool"]
        }
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
            "cool-language-server":
              'jupyter_lsp_my_cool_language_server:cool'
        ]
    }
)
```

## Testing

### Unit tests

```bash
python setup.py test
```

> TBD
>
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
[lsp-implementations]: https://microsoft.github.io/language-server-protocol/implementors/servers
[jupyter-lsp]: https://github.com/krassowski/jupyterlab-lsp.git
[code-of-conduct]: https://github.com/jupyter/governance/blob/master/conduct/code_of_conduct.md
