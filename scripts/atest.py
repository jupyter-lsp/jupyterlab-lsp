import os
import platform
import shutil
import sys
from pathlib import Path

import robot

ROOT = Path(__file__).parent.parent.resolve()
ATEST = ROOT / "atest"
OUT = ATEST / "output"

OS = platform.system()
PY = "".join(map(str, sys.version_info[:2]))

STEM = "_".join([OS, PY]).replace(".", "_").lower()

args = [
    "--name",
    f"{OS}{PY}",
    "--outputdir",
    OUT / STEM,
    "--output",
    OUT / f"{STEM}.robot.xml",
    "--log",
    OUT / f"{STEM}.log.html",
    "--report",
    OUT / f"{STEM}.report.html",
    "--xunit",
    OUT / f"{STEM}.xunit.xml",
    "--variable",
    f"OS:{OS}",
    "--variable",
    f"PY:{PY}",
    *sys.argv[1:],
    ATEST,
]

if __name__ == "__main__":
    if (OUT / STEM).exists():
        shutil.rmtree(OUT / STEM)

    os.chdir(ATEST)
    sys.exit(robot.run_cli(list(map(str, args))))
