""" utility script to warm up/validate the jedi cache
"""
import os
import pathlib
import shutil
import sys
import time

import IPython
import jedi
import jupyterlab
import notebook
import parso
import pyls

SOURCE_TEMPLATE = """
import {module}
{module}."""

MODULES_TO_CACHE = [
    "itertools",
    "statistics",
    *sys.modules,
]


def warm_up_one(module):
    print(module, end="\t")
    start = time.time()
    script = jedi.Script(SOURCE_TEMPLATE.format(module=module))
    completions = len(script.complete(3, len("{}.".format(module))))
    end = time.time()
    print("\t", completions, end - start)


def print_versions():
    print(".".join(map(str, sys.version_info[:3])), "\t", "python")
    print(IPython.__version__, "\t", "ipython")
    print(jedi.__version__, "\t", "jedi")
    print(jupyterlab.__version__, "\t", "jupyterlab")
    print(notebook.__version__, "\t", "notebook")
    print(parso.__version__, "\t", "parso")
    print(pyls.__version__, "\t", "pyls")


def print_env():
    [
        print(key, "\t", value)
        for key, value in sorted(os.environ.items())
        if "CONDA" in key
    ]


def setup_jedi():
    print("default jedi environment", jedi.api.environment.get_default_environment())
    jedi_cache = pathlib.Path(
        jedi.settings.cache_directory, environment=jedi.InterpreterEnvironment()
    )
    if jedi_cache.exists():
        shutil.rmtree(jedi_cache)
        print("removed jedi cache!")
    else:
        print("no jedi cache was found!")


def warm_up(modules):
    print_env()
    print("-" * 80)
    print_versions()
    print("-" * 80)
    setup_jedi()
    print("-" * 80)
    start = time.time()
    [warm_up_one(module) for module in modules]
    end = time.time()
    print("-" * 80)
    print(len(modules), "modules in", jedi.settings.cache_directory, end - start)


if __name__ == "__main__":
    warm_up(sorted(set(sys.argv[1:] or MODULES_TO_CACHE)))
