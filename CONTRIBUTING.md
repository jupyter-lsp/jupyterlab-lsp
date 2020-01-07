# Contribute to jupyterlab-lsp and jupyter-lsp :heart:

`jupyter-lsp` and `jupyterlab-lsp` are [open source](./LICENSE) software, and
all contributions conforming to good sense, good taste, and the
[Jupyter Code of Conduct][code-of-conduct] are welcome, and will be reviewed
by the contributors, time-permitting.

You can contribute to the project through:

- creating language server [specs](#Specs)
  - you can publish them yourself (it might be a single file)...
  - or advocate for adding your spec to the [github repository][jupyterlab-lsp]
    and its various distributions
    - these are great first issues, as you might not need to know any python or
      javascript
- proposing parts of the architecture that can be [extended](./EXTENDING.md)
- improving [documentation](#Documentation)
- tackling Big Issues from the [future roadmap](./ROADMAP.md)
- improving [testing](#Testing)
- reviewing pull requests

[jupyterlab-lsp]: https://github.com/krassowski/jupyterlab-lsp.git
[code-of-conduct]: https://github.com/jupyter/governance/blob/master/conduct/code_of_conduct.md

## Set up the environment

Development requires:

- `nodejs` 8 or later
- `python` 3.5+
- `jupyterlab` 1.1

It is recommended to use a virtual environment (e.g. `virtualenv` or `conda env`)
for development.

```bash
conda env update -n jupyterlab-lsp   # create a conda env
source activate jupyterlab-lsp       # activate it
# or...
pip install -r requirements-dev.txt  # in a virtualenv, probably
                                     # ... and install nodejs, somehow
```

### The Easy Way

Once your environment is created and activated, on Linux/OSX you can run:

```bash
bash postBuild
```

This performs all of the basic setup steps, and is used for the binder demo.

### The Hard Way

Install `jupyter-lsp` from source in your virtual environment:

```bash
python -m pip install -e .
```

Enable the server extension:

```bash
jupyter serverextension enable --sys-prefix --py jupyter_lsp
```

Install `npm` dependencies, build TypeScript packages, and link
to JupyterLab for development:

```bash
jlpm
jlpm build
jlpm lab:link
```

## Frontend Development

To rebuild the schemas, packages, and the JupyterLab app:

```bash
jlpm build
jupyter lab build
```

To watch the files and build continuously:

```bash
jlpm watch   # leave this running...
jupyter lab --watch  # ...in another terminal
```

> Note: the backend schema is not included in `watch`, and is only refreshed by `build`

To check and fix code style:

```bash
jlpm lint
```

To run test the suite (after running `jlpm build` or `watch`):

```bash
jlpm test
```

To run tests matching specific phrase, forward `-t` argument over yarn and lerna to the test runners with two `--`:

```bash
jlpm test -- -- -t match_phrase
```

## Server Development

### Testing `jupyter-lsp`

```bash
python scripts/utest.py
```

## Browser-based Acceptance Tests

The browser tests will launch JupyterLab on a random port and exercise the
Language Server features with [Robot Framework][] and [SeleniumLibrary][].

[robot framework]: https://github.com/robotframework/robotframework
[seleniumlibrary]: https://github.com/robotframework/seleniumlibrary

First, ensure you've prepared JupyterLab for `jupyterlab-lsp`
[frontend](#frontend-development) and [server](#server-development) development.

Prepare the enviroment:

```bash
conda env update -n jupyterlab-lsp --file environment-atest.yml
# or
pip install -r requirements-atest.txt  # ... and install geckodriver, somehow
apt-get install firefox-geckodriver    # ... e.g. on debian/ubuntu
```

Run the tests:

```bash
python scripts/atest.py
```

The Robot Framework reports and screenshots will be in `atest/output`, with
`<operating system>_<python version>_<attempt>.<log|report>.html` and subsequent `screenshots` being the most interesting
artifact, e.g.

```
atest/
  output/
    linux_37_1.log.html
    linux_37_1.report.html
    linux_37_1/
      screenshots/
```

#### Troubleshooting

- If you see the following error message:

  ```
  Parent suite setup failed:
  TypeError: expected str, bytes or os.PathLike object, not NoneType
  ```

  it may indicate that you have no `firefox`, or `geckodriver` installed (or discoverable
  in the search path).

- If a test suite for a specific language fails it may indicate that you have no
  appropriate server language installed (see [LANGUAGESERVERS.md](./LANGUAGESERVERS.md))

- If you are seeing errors like `Element is blocked by .jp-Dialog`, caused by
  the JupyterLab _Build suggested_ dialog, (likely if you have been using
  `jlpm watch`) ensure you have a "clean" lab (with production assets) with:

  ```bash
  jupyter lab clean
  jlpm build
  jlpm lab:link
  jupyter lab build --dev-build=False --minimize=True
  ```

  and re-run the tests.

### Formatting

Minimal code style is enforced with `pytest-flake8` during unit testing. If installed,
`pytest-black` and `pytest-isort` can help find potential problems, and lead to
cleaner commits, but are not enforced during CI tests (but are checked during lint).

You can clean up your code, and check for using the project's style guide with:

```bash
python scripts/lint.py
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

### Specs

It is convenient to collect common patterns for connecting to installed language
servers as `pip`-installable packages that Just Work with `jupyter-lsp`.

If an advanced user installs, locates, and configures, their own language
server it will always win vs an auto-configured one.

#### Writing a spec

> See the built-in [specs](./py_src/jupyter_lsp/specs) for implementations and some
> [helpers](./py_src/jupyter_lsp/specs/utils.py).

A spec is a python function that accepts a single argument, the
`LanguageServerManager`, and returns a dictionary of the form:

```python
{
  "python-language-server": {            # the name of the implementation
      "version": 1,                      # the version of the spec schema
      "argv": ["python", "-m", "pyls"],  # a list of command line arguments
      "languages": ["python"]            # a list of languages it supports
  }
}
```

The absolute minimum listing requires `argv` (a list of shell tokens to launch
the server) and `languages` (which languages to respond to), but many number of
other options to enrich the user experience are available in the
[schema](./py_src/jupyter_lsp/schema/schema.json) and are exercised by the
current `entry_points`-based [specs]().

The spec should only be advertised if the command _could actually_ be run:

- its runtime (e.g. `julia`, `nodejs`, `python`, `r`, `ruby`) is installed
- the language server itself is installed (e.g. `python-language-server`)

##### Common Concerns

- some language servers need to have their connection mode specified
  - the `stdio` interface is the only one supported by `jupyter_lsp`
    - PRs welcome to support other modes!
- because of its VSCode heritage, many language servers use `nodejs`
  - `LanguageServerManager.nodejs` will provide the location of our best
    guess at where a user's `nodejs` might be found
- some language servers are hard to start purely from the command line
  - use a helper script to encapsulate some complexity.
    - See the [r spec](./py_src/jupyter_lsp/specs/r_languageserver.py) for an example

##### Example: making a pip-installable `cool-language-server` spec

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
            "version": 1,
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
        "jupyter_lsp_spec_v1": [
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
