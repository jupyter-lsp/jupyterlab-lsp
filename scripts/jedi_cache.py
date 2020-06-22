""" utility script to warm up/validate the jedi cache
"""
import sys
import time

import IPython
import jedi
import jupyterlab

SOURCE_TEMPLATE = """
import {module}
{module}."""

MODULES_TO_CACHE = [
    "sys",
    "itertools",
    "IPython",
    "statistics",
    "os",
    "time",
    *sys.modules,
]


def warm_up_one(module):
    start = time.time()
    script = jedi.Script(SOURCE_TEMPLATE.format(module=module))
    completions = len(script.complete(3, len("{}.".format(module))))
    end = time.time()
    print(module, completions, end - start)


if __name__ == "__main__":
    print(IPython.__version__)
    print(jupyterlab.__version__)
    start = time.time()
    modules = sorted(set(sys.argv[1:] or MODULES_TO_CACHE))
    [warm_up_one(module) for module in modules]
    end = time.time()
    print("------------------")
    print(len(modules), "modules", end - start)
