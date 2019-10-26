# Contribute to jupyter-lsp

`jupyter-lsp` is [open source](../../LICENSE) software, and all contributions
conforming to good sense, good taste, and the
[Jupyter Code of Conduct][code-of-conduct] are welcome, and will be reviewed
by the contributors, time-permitting.

## How to Help

You can contribute to `jupyter-lsp` by:

- creating [specs](#Specs)
  - you can publish them yourself (it might be a single file)...
  - or advocate for adding your spec to the [github repository][jupyterlab-lsp]
    and its various distributions
    - these are great first issues, as you might not need to know any python or
      javascript
- improving [documentation](#Documentation)
- tackling Big Issues from the [future roadmap](#Future-Roadmap-Items)
- improving [testing](#Testing)
- reviewing pull requests

## Roadmap

- release on `pip`
- release on `conda`
- [#49](https://github.com/krassowski/jupyterlab-lsp/issues/49)
  cookiecutter for pip-installable specs

## Future Roadmap Items

- add hook system to allow serverextensions/kernels to modify, inspect and
  react to LSP messages

## Specs

It is convenient to collect common patterns for connecting to installed language
servers as `pip`-installable packages that Just Work with `jupyter-lsp`.

If an advanced user installs, locates, and configures, their own language
server it will always win vs an auto-configured one.

### Writing a spec

> See the built-in [specs](./specs) for implementations and some
> [helpers](./specs/utils.py).

A spec is a python function that accepts a single argument, the
`LanguageServerManager`, and returns a dictionary of the form:

```python
{
  "python-language-server": {            # the name of the implementation
      "argv": ["python", "-m", "pyls"],  # a list of command line arguments
      "languages": ["python"]            # a list of languages it supports
  }
}
```

The spec should only be advertised if the command _could actually_ be run:

- its runtime (e.g. `julia`, `nodejs`, `python`, `r`, `ruby`) is installed
- the language server itself is installed (e.g. `python-language-server`)

#### Common Concerns

- some language servers need to have their connection mode specified
  - the `stdio` interface is the only one supported by `jupyter_lsp`
    - PRs welcome to support other modes!
- because of its VSCode heritage, many language servers use `nodejs`
  - `LanguageServerManager.nodejs` will provide the location of our best
    guess at where a user's `nodejs` might be found
- some language servers are hard to start purely from the command line
  - use a helper script to encapsulate some complexity.
    - See the [r spec](./specs/r_languageserver.py) for an example

#### Example: making a pip-installable `cool-language-server` spec

Consider the following (absolutely minimal) directory structure:

```
- setup.py
- jupyter_lsp_my_cool_language_server.py
```

> You should consider adding a LICENSE, some documentation, etc.

Define your spec:

```python
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

Tell `pip` how to package your spec:

```python
# setup.py
import setuptools
setuptools.setup(
    name="jupyter-lsp-my-cool-language-server",
    py_modules=["jupyter_lsp_my_cool_language_server"],
    entry_points={
        "jupyter_lsp_spec_v0": [
            "cool-language-server":
              "jupyter_lsp_my_cool_language_server:cool"
        ]
    }
)
```

Test it!

```bash
python -m pip install -e .
```

Build it!

```bash
python setup.py sdist bdist_wheel
```

## Contributing to `jupyter-lsp`

### Set up the environment

```bash
conda env update -n jupyterlab-lsp   # create a conda env
source activate jupyterlab-lsp       # activate it
# or...
pip install -r requirements-dev.txt  # in a virtualenv, probably
                                     # ... and install nodejs, somehow
```

## Testing `jupyter-lsp`

### Unit & Code Style Tests

```bash
python scripts/utest.py
```

### Browser-based Acceptance Tests

Prepare the enviroment:

```bash
conda env update -n jupyterlab-lsp --file environment-atest.yml
# or
pip install -r requirements-atest.txt  # ... and install geckodriver, somehow
```

> To use with `jupyterlab-lsp` in JupyterLab, ensure you've
>
> ```
> jlpm
> jlpm build
> jupyter labextension install .
> ```

````
> in the root of this repo. See the [README](../../README.md#development) for more

Run the tests:

```bash
python scripts/atest.py
````

### Formatting

Minimal code style is enforced with `flake8` during unit testing. If installed,
`pytest-black` and `pytest-isort` can help find potential problems, and lead to
cleaner commits, but are not enforced during CI.

You can clean up your code using the project's style guide with:

```bash
isort -y -rc py_src
black py_src
```

> TBD
>
> - hypothesis
> - mypy

## Documentation

> TBD
>
> - sphinx
> - one of the sphinx/ipynb connectors

[language-server]: https://microsoft.github.io/language-server-protocol/specification
[jupyter-server-proxy]: https://github.com/jupyterhub/jupyter-server-proxy
[lsp-implementations]: https://microsoft.github.io/language-server-protocol/implementors/servers
[jupyterlab-lsp]: https://github.com/krassowski/jupyterlab-lsp.git
[code-of-conduct]: https://github.com/jupyter/governance/blob/master/conduct/code_of_conduct.md
