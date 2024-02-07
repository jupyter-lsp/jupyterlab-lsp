""" antidisinformationarianism
"""

import shutil
import sys
from pathlib import Path
from subprocess import call
from tempfile import TemporaryDirectory

ROOT = Path(__file__).parent.parent
DOCS = ROOT / "docs"
OUT = ROOT / "build/docs"

CHECK_INI = """
[pytest]
addopts =
    --check-links
    -k "not ipynb {extra_k}"

filterwarnings =
    ignore::PendingDeprecationWarning
    ignore::DeprecationWarning
"""


def docs(watch=False, check=False, local_only=False):
    """build (and test) docs.

    because readthedocs, this gets called twice from inside sphinx
    """
    if watch:
        return call(["sphinx-autobuild", str(DOCS), str(OUT)])

    elif check:
        ini = CHECK_INI.format(extra_k="and not http" if local_only else "")
        # do this in a temporary directory to avoid surprises
        with TemporaryDirectory() as td:
            tdp = Path(td)
            dest = tdp / "a/deep/path"
            dest.parent.mkdir(parents=True)
            shutil.copytree(DOCS / "_build/html", dest)
            (dest / "pytest.ini").write_text(ini)

            return call(["pytest"], cwd=dest)
    else:
        return call(["sphinx-build", "-M", "html", str(DOCS), str(OUT)])


if __name__ == "__main__":
    sys.exit(
        docs(
            watch="--watch" in sys.argv,
            check="--check" in sys.argv,
            local_only="--local-only" in sys.argv,
        )
    )
