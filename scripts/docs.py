""" antidisinformationarianism
"""
import shutil
import sys
from pathlib import Path
from subprocess import check_call
from tempfile import TemporaryDirectory

ROOT = Path(__file__).parent.parent
DOCS = ROOT / "docs"


def docs(watch=False, check=False):
    """ build (and test) docs.

        because readthedocs, this gets called twice from inside sphinx
    """
    if watch:
        check_call(["sphinx-autobuild", ".", "_build"], cwd=DOCS)
        return 0

    if check:
        # do this in a temporary directory to avoid surprises
        with TemporaryDirectory() as td:
            tdp = Path(td)
            dest = tdp / "a" / "deep" / "path"
            dest.parent.mkdir(parents=True)
            shutil.copytree(DOCS / "_build", dest)
            check_call(["pytest-check-links", "-vv", "-k", "not ipynb"], cwd=dest)

    check_call(["sphinx-build", "-M", "html", ".", "_build"], cwd=DOCS)
    return 0


if __name__ == "__main__":
    sys.exit(docs(watch="--watch" in sys.argv, check="--check" in sys.argv))
