""" antidisinformationarianism
"""
import sys
from pathlib import Path
from subprocess import check_call

ROOT = Path(__file__).parent.parent
DOCS = ROOT / "docs"


def docs(watch=False):
    """ build (and test) docs.

        because readthedocs, this gets called twice from inside sphinx
    """
    if watch:
        check_call(["sphinx-autobuild", ".", "_build"], cwd=DOCS)
    else:
        check_call(["sphinx-build", "-M", "html", ".", "_build"], cwd=DOCS)
    return 0


if __name__ == "__main__":
    sys.exit(docs(watch="--watch" in sys.argv))
