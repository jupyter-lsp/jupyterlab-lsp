""" Run acceptance tests with robot framework
"""
# pylint: disable=broad-except
import json
import multiprocessing
import os
import platform
import shutil
import sys
import time
from pathlib import Path

import robot
from pabot import pabot

OS = platform.system()
PY = "".join(map(str, sys.version_info[:2]))

ROOT = Path(__file__).parent.parent.resolve()
ATEST = ROOT / "atest"
OUT = ATEST / "output"

ATEST_RETRIES = json.loads(os.environ.get("ATEST_RETRIES", "0"))
ATEST_PROCESSES = json.loads(os.environ.get("ATEST_PROCESSES", "1"))

if not ATEST_PROCESSES:
    # each test incurs a jupyter server, a browser, and a bunch of language
    # servers and kernels, so be a bit more conservative than the default
    # $CPU_COUNT + 1
    ATEST_PROCESSES = max(int(multiprocessing.cpu_count() / 2), 1) + 1

OS_PY_ARGS = {
    # notebook and ipykernel releases do not yet support python 3.8 on windows
    # ("Windows", "38"): ["--include", "not-supported", "--runemptysuite"]
}

NON_CRITICAL = [
    # TODO: restore when yaml-language-server supports both config and...
    # everything else: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/245
    ["language:yaml", "feature:config"],
]

# because we use diagnostics as a litmus for "working", revert to behavior
# from before https://github.com/bash-lsp/bash-language-server/pull/269
os.environ["HIGHLIGHT_PARSING_ERRORS"] = "true"


def get_stem(attempt, extra_args):
    stem = "_".join([OS, PY, str(attempt)]).replace(".", "_").lower()

    if "--dryrun" in extra_args:
        stem = f"dry_run_{stem}"

    return stem


def atest(attempt, extra_args):
    """perform a single attempt of the acceptance tests"""

    extra_args += OS_PY_ARGS.get((OS, PY), [])

    stem = get_stem(attempt, extra_args)

    for non_critical in NON_CRITICAL:
        extra_args += ["--skiponfailure", "AND".join(non_critical)]

    if attempt != 1:
        previous = OUT / get_stem(attempt - 1, extra_args) / "output.xml"
        if previous.exists():
            extra_args += ["--rerunfailed", str(previous)]

    out_dir = OUT / stem

    args = [
        "--name",
        f"{OS}{PY}",
        "--outputdir",
        out_dir,
        "--variable",
        f"OS:{OS}",
        "--variable",
        f"PY:{PY}",
        # don't ever test our examples
        "--exclude",
        "atest:example",
        # random ensures there's not inter-test coupling
        "--randomize",
        "all",
        *(extra_args or []),
        ATEST,
    ]

    print("Robot Arguments\n", " ".join(["robot"] + list(map(str, args))))

    if out_dir.exists():
        print("trying to clean out {}".format(out_dir))
        try:
            shutil.rmtree(out_dir)
        except Exception as err:
            print("Error deleting {}, hopefully harmless: {}".format(out_dir, err))

    os.chdir(ATEST)

    str_args = list(map(str, args))

    try:
        if "--dryrun" in extra_args or ATEST_PROCESSES == 1:
            robot.run_cli(str_args)
        else:
            pabot.main(
                [
                    *("--processes", f"{ATEST_PROCESSES}"),
                    *("--artifacts", "png,log"),
                    "--artifactsinsubfolders",
                    "--testlevelsplit",
                    *str_args,
                ]
            )
        return 0
    except SystemExit as err:
        return err.code


def attempt_atest_with_retries(*extra_args):
    """retry the robot tests a number of times"""
    attempt = 0
    error_count = -1

    retries = ATEST_RETRIES

    while error_count != 0 and attempt <= retries:
        attempt += 1
        print("attempt {} of {}...".format(attempt, retries + 1))
        start_time = time.time()
        error_count = atest(attempt=attempt, extra_args=list(extra_args))
        print(error_count, "errors in", int(time.time() - start_time), "seconds")

    return error_count


if __name__ == "__main__":
    sys.exit(attempt_atest_with_retries(*sys.argv[1:]))
