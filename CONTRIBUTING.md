## Contributing

`jupyter-lsp` and `jupyterlab-lsp` are [open source][license] software, and
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
- proposing parts of the architecture that can be [extended][extending]
- improving [documentation](#Documentation)
- tackling Big Issues from the [future roadmap][roadmap]
- improving testing
- reviewing pull requests

Thank you for all your contributions :heart:

[license]: https://github.com/jupyter-lsp/jupyterlab-lsp/blob/main/LICENSE
[extending]: ./docs/Extending.html
[roadmap]: ./docs/Roadmap.html
[jupyterlab-lsp]: https://github.com/jupyter-lsp/jupyterlab-lsp.git
[code-of-conduct]: https://github.com/jupyter/governance/blob/main/conduct/code_of_conduct.md

### Provision the environment

A development environment requires, at a minimum:

- `python >=3.9,<3.13.0a0`
- `jupyterlab >=4.1.0,<5.0.0a0`
- `nodejs >=20,!=21,!=23,<25`

It is recommended to use a virtual environment (e.g. `virtualenv` or `conda env`)
for development.

#### conda

To use the same environment as the binder demo (recommended), start with a
[Mambaforge](https://conda-forge.org/miniforge/) `base` environment.

> While the `conda` commands can be used below, `mamba` provides both faster
> solves and better error messages.

```bash
mamba env update -p ./.venv --file binder/environment.yml  # build, lint, unit test deps
source activate ./.venv                                    # activate on POSIX
activate ./.venv                                           # activate on Windows
```

Optionally extend your environment further for browser testing, and/or docs:

```bash
mamba env update -p ./.venv --file requirements/atest.yml  # browser test deps
mamba env update -p ./.venv --file requirements/docs.yml   # docs deps
```

#### pip

`pip` can be used to install most of the basic Python build and test dependencies:

```bash
pip install -r requirements/dev.txt  # in a virtualenv, probably
```

[`nodejs`](https://nodejs.org/en/download/current) must be installed by other means,
with a Long Term Support version (even numbered) version recommended:

```bash
sudo apt-get install nodejs  # ... on debian/ubuntu
sudo dnf install nodejs      # ... on fedora/redhat
```

#### Single-step setup

Once your environment is created and activated, you can run:

```bash
python3 binder/postBuild
```

This performs all the basic setup steps, and is used for the binder demo.

This approach may not always work. Continue reading for a step-by-step
instructions which also show all the underlying pieces.

#### Manual installation

Install `jupyter-lsp` from source in your virtual environment:

```bash
python -m pip install -e python_packages/jupyter_lsp --ignore-installed --no-deps -vv
```

Enable the server extension:

```bash
jupyter server extension enable --sys-prefix --py jupyter_lsp
```

Install `npm` dependencies, build TypeScript packages, and link
to JupyterLab for development:

```bash
jlpm bootstrap
# if you installed `jupyterlab_lsp` before uninstall it before running the next line
jupyter labextension develop python_packages/jupyterlab_lsp --overwrite
# optional, only needed for running a few tests for behaviour with missing language servers
jupyter labextension develop python_packages/klingon_ls_specification --overwrite
```

> Note: on Windows you may need to enable Developer Mode first, as discussed in [jupyterlab#9564](https://github.com/jupyterlab/jupyterlab/issues/9564)

### Frontend Development

To rebuild the schemas, packages, and the JupyterLab app:

```bash
jlpm build
```

To watch the files and build continuously:

```bash
jlpm watch           # leave this running...
```

Now after a change to TypesScript files, wait until both watchers finish compilation,
and refresh JupyterLab in your browser.

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

To verify the webpack build wouldn't include problematic vendored dependencies:

```bash
python scripts/distcheck.py
```

### Server Development

#### Testing `jupyter-lsp`

```bash
python scripts/utest.py
```

### Documentation

To build the documentation:

```bash
python scripts/docs.py
```

To watch documentation sources and build continuously:

```bash
python scripts/docs.py --watch
```

To check internal links in the docs after building:

```bash
python scripts/docs.py --check --local-only
```

To check internal _and_ external links in the docs after building:

```bash
python scripts/docs.py --check
```

> Note: you may get spurious failures due to rate limiting, especially in CI,
> but it's good to test locally

### Browser-based Acceptance Tests

The browser tests will launch JupyterLab on a random port and exercise the
Language Server features with [Robot Framework][] and [SeleniumLibrary][]. It
is recommended to peruse the [Robot Framework User's Guide][rfug] (and the existing
`.robot` files in `atest`) before working on tests in anger.

[robot framework]: https://github.com/robotframework/robotframework
[seleniumlibrary]: https://github.com/robotframework/seleniumlibrary
[rfug]: https://robotframework.org/robotframework/latest/RobotFrameworkUserGuide.html

First, ensure you've prepared JupyterLab for `jupyterlab-lsp`
[frontend](#frontend-development) and [server](#server-development) development.

Prepare the environment:

```bash
mamba env update -n jupyterlab-lsp --file requirements/atest.yml
```

or with `pip`

```
pip install -r requirements/atest.txt    # ... and install geckodriver, somehow
sudo apt-get install firefox-geckodriver # ... e.g. on debian/ubuntu
```

Run the tests:

```bash
python scripts/atest.py
```

The Robot Framework reports and screenshots will be in
`build/reports/{os}_{py}/atest/{attempt}`, with `(log|report).html` and subsequent
captured `screenshots` being the most interesting artifact, e.g.

```
build/
  reports/
    linux_310/
      atest/
        1/
          log.html
          report.html
          screenshots/
```

#### Customizing the Acceptance Test Run

By default, all of the tests will be run, once.

The underlying `robot` command supports a vast number of options and many
support wildcards (`*` and `?`) and boolean operators (`NOT`, `OR`). For more,
start with
[simple patterns](https://robotframework.org/robotframework/latest/RobotFrameworkUserGuide.html#simple-patterns).

##### Find robot options

```bash
robot --help
```

##### Run a suite

```bash
python scripts/atest.py --suite "05_Features.Completion"
```

##### Run a single test

```bash
python scripts/atest.py --test "Works When Kernel Is Idle"
```

##### Run test with a tag

Tags are preferable to file names and test name matching in many settings, as
they are aggregated nicely between runs.

```bash
python scripts/atest.py --include feature:completion
```

... or only Python completion

```bash
python scripts/atest.py --include feature:completionANDlanguage:python
```

##### Just Keep Testing with `ATEST_RETRIES`

Run tests, and _rerun_ only failed tests up to two times:

```bash
ATEST_RETRIES=2 python scripts/atest.py --include feature:completion
```

After running a bunch of tests, it may be helpful to combine them back together
into a single `log.html` and `report.html` with
[rebot](https://robotframework.org/robotframework/latest/RobotFrameworkUserGuide.html#rebot).
Like `atest.py`, `combine.py` also passes through extra arguments

```bash
python scripts/combine.py
```

#### Troubleshooting

- If you see the following error message:

  ```python
  Parent suite setup failed:
  TypeError: expected str, bytes or os.PathLike object, not NoneType
  ```

  it may indicate that you have no `firefox`, or `geckodriver` installed (or discoverable
  in the search path).

- If a test suite for a specific language fails it may indicate that you have no
  appropriate server language installed (see [LANGUAGESERVERS][])

[languageservers]: https://jupyterlab-lsp.readthedocs.io/en/latest/Language%20Servers.html

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

- To display logs on the screenshots, configure the built-in `ILSPLogConsole` console,
  to use the `'floating'` implementation.

- If you see:

  > `SessionNotCreatedException: Message: Unable to find a matching set of capabilities`

  `geckodriver >=0.27.0` requires an _actual_ Firefox executable. Several places
  will be checked (including where `conda-forge` installs, as in CI): to test
  a Firefox _not_ on your `PATH`, set the following environment variable:

  ```bash
  export FIREFOX_BINARY=/path/to/firefox      # ... unix
  set FIREFOX_BINARY=C:\path\to\firefox.exe   # ... windows
  ```

- If you see `Element ... could not be scrolled into view` in the `Open Context Menu for File` step check if you have an alternative file browser installed (such as `jupyterlab-unfold`) which might interfere with testing (it is recommended to run the tests in an separated environment)

### Formatting

You can clean up your code, and check for using the project's style guide with:

```bash
python scripts/lint.py
```

Optionally, to fail on the first linter failure, provide `--fail-fast`. Additional
arguments are treated as filters for the linters to run.

```bash
python scripts/lint.py --fail-fast py  # or "js", "robot"
```

### Specs

While language servers can be configured by the user using a simple JSON or Python [configuration file](./docs/Configuring.ipynb),
it is preferable to provide users with an option that does not require manual configuration. The language server specifications (specs)
wrap the configuration (as would be defined by the user) into a Python class or function that can be either:

- distributed using PyPI/conda-forge and made conveniently available to users for `pip install` and/or `conda install`
- contributed to the collection of built-in specs of jupyter-lsp by opening a PR (preferable for popular language servers, say >100 users)

In either case the detection of available specifications uses Python `entry_points` (see the `[options.entry_points]` section in jupyter-lsp [setup.cfg]).

> If an advanced user installs, locates, and configures, their own language server it will always win vs an auto-configured one.

#### Writing a spec

A spec is a Python callable (a function, or a class with `__call__` method) that accepts a single argument, the
`LanguageServerManager` instance, and returns a dictionary of the form:

```python
{
  "python-language-server": {            # the name of the implementation
      "version":  SPEC_VERSION,          # the version of the spec schema (an integer)
      "argv": ["python", "-m", "pyls"],  # a list of command line arguments
      "languages": ["python"],           # a list of languages it supports
      "mime_types": ["text/python", "text/x-ipython"]
  }
}
```

The above example is only intended as an illustration and not as an up-to-date guide.
For details on the dictionary contents, see the [schema][] definition and [built-in specs][].
Basic concepts (meaning of the `argv` and `languages` arguments) are also explained in the [configuration files](./docs/Configuring.ipynb) documentation.

When contributing a specification we recommend to make use of the helper classes and other [utilities][] that take care of the common use-cases:

- `ShellSpec` helps to create specs for servers that can be started from command-line
- `PythonModuleSpec` is useful for servers which are Python modules
- `NodeModuleSpec` will take care of finding Node.js modules

See the built-in [built-in specs][] for example implementations.

The spec should only be advertised if the command _could actually_ be run:

- its runtime/interpreter (e.g. `julia`, `nodejs`, `python`, `r`, `ruby`) is installed
- the language server itself is installed (e.g. `python-language-server`)

otherwise an empty dictionary (`{}`) should be returned.

[built-in specs]: https://github.com/jupyter-lsp/jupyterlab-lsp/tree/main/python_packages/jupyter_lsp/jupyter_lsp/specs
[setup.cfg]: https://github.com/jupyter-lsp/jupyterlab-lsp/blob/main/python_packages/jupyter_lsp/setup.cfg
[schema]: https://github.com/jupyter-lsp/jupyterlab-lsp/blob/main/python_packages/jupyter_lsp/jupyter_lsp/schema/schema.json
[utilities]: https://github.com/jupyter-lsp/jupyterlab-lsp/blob/main/python_packages/jupyter_lsp/jupyter_lsp/specs/utils.py

##### Common Concerns

- some language servers need to have their connection mode specified
  - the `stdio` interface is the only one supported by `jupyter_lsp`
    - PRs welcome to support other modes!
- many language servers use `nodejs`
  - `LanguageServerManager.nodejs` will provide the location of our best
    guess at where a user's `nodejs` might be found
- some language servers are hard to start purely from the command line
  - use a helper script to encapsulate some complexity, or
  - use a `command` argument of the interpreter is available (see the [r spec][] and [julia spec] for examples)

[r spec]: https://github.com/jupyter-lsp/jupyterlab-lsp/blob/main/python_packages/jupyter_lsp/jupyter_lsp/specs/r_languageserver.py
[julia spec]: https://github.com/jupyter-lsp/jupyterlab-lsp/blob/main/python_packages/jupyter_lsp/jupyter_lsp/specs/julia_language_server.py

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
            "languages": ["cool"],
            "mime_types": ["text/cool", "text/x-cool"]
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
            "cool-language-server = jupyter_lsp_my_cool_language_server:cool"
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

### Debugging

To see more see more log messages navigate to `Settings` ❯ `Settings Editor` ❯ `Language Servers` and adjust:

- adjust `Logging console verbosity level`
- switch `Ask servers to send trace notifications` to `verbose`
- toggle `Log all LSP communication with the LSP servers`

For robot tests set:

```robot
Configure JupyterLab Plugin  {"loggingConsole": "floating", "loggingLevel": "debug"}
```

### Reporting

The human- and machine-readable outputs of many of the above tasks can be combined
into a single output. This is used by CI to check overall code coverage across
all of the jobs, collecting and linking everything in `build/reports/index.html`.

```bash
python scripts/report.py
```
