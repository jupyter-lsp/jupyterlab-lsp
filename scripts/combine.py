""" Combine multiple runs of robot into a single report and log
"""

import sys
from pathlib import Path

from robot.rebot import rebot_cli

ROOT = Path(__file__).parent.parent.resolve()
ATEST = ROOT / "atest"
OUT = ATEST / "output"


def combine_robot_reports():
    """generate a single report/log.html and output.xml from all available outputs"""

    args = [
        "--outputdir",
        OUT,
        "--output",
        "output.xml",
        *sys.argv[1:],
        *OUT.glob("*.robot.xml"),
    ]

    return_code = rebot_cli(args, exit=False)
    print("rebot returned", return_code)

    return 0


if __name__ == "__main__":
    sys.exit(combine_robot_reports())
