""" antidisinformationarianism
"""
import sys
from pathlib import Path
from subprocess import check_call

ROOT = Path(__file__).parent.parent
DOCS = ROOT / "docs"
DOCS_BUILD = DOCS / "_build"


def docs():
    """ build (and test) docs.

        because readthedocs, this gets called twice from inside sphinx
    """
    check_call(["sphinx-build", "-M", "html", DOCS, DOCS_BUILD])
    return 0


if __name__ == "__main__":
    sys.exit(docs())
