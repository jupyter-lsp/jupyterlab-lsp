import shutil
import subprocess
import sys
from pathlib import Path

import black
import isort
from isort.api import sort_code_string
import nbformat

OK = 0
ERROR = 1

ROOT = Path(__file__).parent.parent

DOCS_IPYNB = [
    nb
    for nb in (ROOT / "docs").rglob("*.ipynb")
    if "_build" not in str(nb) and "checkpoints" not in str(nb)
]
NODE = shutil.which("node")

ISORT_CONFIG = isort.settings.Config(settings_path=ROOT / "setup.cfg")

def blacken(source):
    return black.format_str(source, mode=black.FileMode(line_length=88))


def nblint():
    for nb_path in DOCS_IPYNB:
        print(".", end="", flush=True)
        nb_text = nb_path.read_text(encoding="utf-8")
        nb_node = nbformat.reads(nb_text, 4)
        changes = 0
        has_empty = 0
        for cell in nb_node.cells:
            cell_type = cell["cell_type"]
            source = "".join(cell["source"])
            if not source.strip():
                has_empty += 1
            if cell_type == "markdown":
                prettier = subprocess.Popen(
                    [
                        NODE,
                        ROOT / "node_modules" / ".bin" / "prettier",
                        "--stdin-filepath",
                        "foo.md",
                        "--prose-wrap",
                        "always",
                    ],
                    stdin=subprocess.PIPE,
                    stdout=subprocess.PIPE,
                )
                out, err = prettier.communicate(source.encode("utf-8"))
                new = out.decode("utf-8").rstrip()
                if new != source:
                    cell["source"] = new.splitlines(True)
                    changes += 1
            elif cell_type == "code":
                if cell["outputs"] or cell["execution_count"]:
                    cell["outputs"] = []
                    cell["execution_count"] = None
                    changes += 1
                if source.startswith("%"):
                    continue
                new = isort.sort_code_string(source, config=ISORT_CONFIG)
                new = blacken(new).rstrip()
                if new != source:
                    cell["source"] = new.splitlines(True)
                    changes += 1

        if has_empty:
            changes += 1
            nb_node.cells = [
                cell for cell in nb_node.cells if "".join(cell["source"]).strip()
            ]

        if changes:
            with nb_path.open("w") as fpt:
                nbformat.write(nb_node, fpt)
            print(nb_path, changes, "changes", flush=True)

    print(len(DOCS_IPYNB), "notebooks formatted")

    return OK


if __name__ == "__main__":
    sys.exit(nblint())
