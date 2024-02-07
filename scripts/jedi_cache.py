""" utility script to warm up/validate the jedi cache
what does it do:
- Deletes the jedi cache (usually already empty on CI)
- Imports a bunch of libraries
- Prints out some versions, especially ones that are
  at times troublesome
- Forces indexing all of the loaded libraries and their
  dependencies

why is this needed:
- Before we had this, a couple of browser tests appeared
  "consistently flakier" than they were, as they were
  time-bounded by creating the jedi cache.
- This was taking up to a minute to get a single
  completion value back
- Further, were this cache to get corrupted (perhaps due to
  killing a running test :P) things go very mysteriously bad.
- We need a way for the cache to be right before testing

how does it work:
- When _using_ jedi for the first time, the cache gets
  created in  `jedi.settings.cache_directory`, usually
  somewhere in $HOME.
- As different libraries are inspected by jedi, they get
  added to the cache.
- This is very slow, especially on windows, and cannot
  feasibly be cached, today.
- This script accelerates this process, so it can be done
  in a controlled manner rather than during some other test
- also, by running it ahead of time, if the jedi dependency
  chain is broken in any way, this should help determine
  if faster, before trying to build everything

see more:
- https://jedi.readthedocs.io/en/latest/docs/settings.html
- https://github.com/jupyter-lsp/jupyterlab-lsp/pull/284

"""

import os
import pathlib
import pprint
import sys
import time

import IPython
import jedi
import jupyter_server
import jupyterlab
import parso

SOURCE_TEMPLATE = """
import {module}
{module}."""

MODULES_TO_CACHE = [
    "itertools",
    "statistics",
    *sys.modules,
]


ENV = jedi.InterpreterEnvironment()


def print_line():
    print("-" * 80)


def warm_up_one(module):
    print(module, end="\t")
    start = time.time()
    script = jedi.Script(SOURCE_TEMPLATE.format(module=module), environment=ENV)
    completions = len(script.complete(3, len("{}.".format(module))))
    end = time.time()
    print("\t", completions, end - start)


def print_versions():
    print("Relevant versions:")
    pprint.pprint(
        dict(
            python=".".join(map(str, sys.version_info[:3])),
            ipython=IPython.__version__,
            jedi=jedi.__version__,
            jupyterlab=jupyterlab.__version__,
            jupyter_serer=jupyter_server.__version__,
            parso=parso.__version__,
        )
    )


def print_env():
    print("CONDA and XDG environment variables:")
    pprint.pprint(
        {
            key: value
            for key, value in sorted(os.environ.items())
            if value and "CONDA" in key or "XDG" in key
        }
    )


def setup_jedi():
    print("default jedi environment", jedi.api.environment.get_default_environment())
    print("jedi environment", ENV)
    jedi_cache = pathlib.Path(jedi.settings.cache_directory)
    print("jedi cache", str(jedi_cache))
    return jedi_cache.exists()


def warm_up(modules):
    print_env()
    print_line()
    print_versions()
    print_line()
    cache_exists = setup_jedi()
    if cache_exists:
        print("jedi cache already exists, aborting warm up!")
        return
    else:
        print("no jedi cache was found, warming up!")
    print_line()
    start = time.time()
    [warm_up_one(module) for module in modules]
    end = time.time()
    print_line()
    print(len(modules), "modules in", jedi.settings.cache_directory, end - start)


if __name__ == "__main__":
    warm_up(sorted(set(sys.argv[2:] or MODULES_TO_CACHE)))
