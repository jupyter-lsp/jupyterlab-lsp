import sys
from pathlib import Path

from robot.rebot import rebot_cli

ROOT = Path(__file__).parent.parent.resolve()
ATEST = ROOT / "atest"
OUT = ATEST / "output"

args = [
    "--outputdir",
    OUT,
    "--output",
    "output.xml",
    *sys.argv[1:],
    *OUT.glob("*.robot.xml"),
]


if __name__ == "__main__":
    rebot_cli(args, exit=False)
