# `jupyterlab-lsp` Acceptance Tests

This folder contains the [acceptance tests] for this project. These tests assess
using JupyterLab with the `lsp` extensions installed, including language runtimes,
kernels, and language servers.

The tests are written described in the English-like [Robot Framework] syntax, with
supporting Python files and fixtures in many different languages.

A single run of `python scripts/atest.py` will do many of the same steps as human user:

  - start a `jupyter_server`
  - open a real browser
  - click, drag-and-drop, and type on the keyboard
  - observe the effects of LSP-related interaction
  - remember what was seen at an exact time with screenshots
  - write reports of expected behavior
  - complain if something doesn't work the right way


> For more detailed instructions, see the [contributing guide].

[contributing guide]: ./CONTRIBUTING.md
[acceptance tests]: https://en.wikipedia.org/wiki/Acceptance_testing
[Robot Framework]: https://github.com/robotframework/robotframework/

## File Structure

### Input

In addition to a working development installation of the python and javascript
packages, this folder and some supporting files are used.

```
/scripts/
    atest.py                # the entrypoint for (re)running the test suitess
/atest/
    README.md               # this file
    /suites/
        __init__.robot      # top-level suite settings, setup and teardown
        *.robot             # actual test cases
        */                  # sub-suites for more in-depth features
            __init__.robot  # sub-suite settings, setup and teardown
            *.robot         # sub-suite test cases
    /_resources/            # keywords and variables definitions in robot syntax
        *.resource
    /_libraries/            # custom python scripts, called from robot files
        *.py
    /_examples/
        *.ipynb             # notebooks used in tests
        *.*                 # language-specific, often malformed, files for test cases
    /_fixtures/             # Jupyter configuration files
        *.json
        *.py
```

### Output

While `atest.py` is running, the console will be updated with the current state
of tests, with summaries at each suite level.

At the end of the run, `file://` links to reports will be printed out, which
can be viewed in a browser.

```
/build/
    /robot/
        /{os}_{py}_{try}/  # a folder containing all reports from a robot run
            log.html       # human-readable, step-by-step log with screenshots
            report.html    # high-level summary by suites and tags
            output.xml     # custom, machine-readable XML output of the test
```
