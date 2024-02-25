""" Run acceptance tests with robot framework
"""

# pylint: disable=broad-except
import os
import platform
import shutil
import sys
import time
from pathlib import Path

import robot

OS = platform.system()
PY = "".join(map(str, sys.version_info[:2]))
RETRIES = int(os.environ.get("ATEST_RETRIES") or "0")
ATTEMPT = int(os.environ.get("ATEST_ATTEMPT") or "0")

SCRIPTS = Path(__file__).parent
ROOT = SCRIPTS.parent.resolve()
SETUP_CFG = ROOT / "setup.cfg"

ATEST = ROOT / "atest"
SUITES = ATEST / "suites"
BUILD = ROOT / "build"
OUT = BUILD / "reports" / f"{OS}_{PY}".lower() / "atest"

OS_PY_ARGS = {
    # example:
    # notebook and ipykernel releases did not yet support python 3.8 on windows
    # ("Windows", "38"): ["--include", "not-supported", "--runemptysuite"]
}

NON_CRITICAL = [
    # TODO: restore when yaml-language-server supports both config and...
    # everything else: https://github.com/jupyter-lsp/jupyterlab-lsp/pull/245
    ["language:yaml", "feature:config"],
    # TODO: restore when we figure out win36 vs jedi on windows
    # ["language:python", "py:36", "os:windows"],
]

NON_CRITICAL_ARGS = sum(
    [["--skiponfailure", "AND".join(nc)] for nc in NON_CRITICAL], []
)

DEFAULT_ARGS = [
    # page title, etc: useful information instead of `suites`
    f"--name={OS}_{PY}",
    # random ensures there's no inter-test coupling
    "--randomize=all",
    # use wide, colorful output for more readable console logs
    "--consolewidth=120",
    "--consolecolors=on",
    *NON_CRITICAL_ARGS,
]


os.environ.update(
    # because we use diagnostics as a litmus for "working", revert to behavior
    # from before https://github.com/bash-lsp/bash-language-server/pull/269
    HIGHLIGHT_PARSING_ERRORS="true",
    # use the top-level coverage config to get consistent paths, etc.
    COVERAGE_RCFILE=str(SETUP_CFG),
)


def atest(attempt, extra_args):
    """perform a single attempt of the acceptance tests"""
    extra_args = [*(extra_args or []), *OS_PY_ARGS.get((OS, PY), [])]
    stem = get_stem(attempt, extra_args)
    out_dir = ensure_out_dir(stem)
    args = build_args(out_dir, attempt, extra_args)

    # remember the original working directory
    old_cwd = Path.cwd()

    rc = 1

    try:
        # run in a "clean" directory
        os.chdir(str(out_dir))
        rc = robot.run_cli(args, exit=False)
    finally:
        os.chdir(str(old_cwd))

    return rc


def build_args(out_dir: Path, attempt: int, extra_args):
    """Build full ``robot`` CLI arguments."""
    args = [
        *DEFAULT_ARGS,
        # use the standard output layout
        f"--outputdir={out_dir}",
        *build_variable_args(OS=OS, PY=PY),
        *extra_args,
    ]

    if attempt != 1:
        previous = OUT / get_stem(attempt - 1, extra_args) / "output.xml"
        if previous.exists():
            print("Robot rerun failed:", previous.parent.name)
            args += ["--rerunfailed", str(previous)]
        args += ["--loglevel=TRACE"]

    # the tests to run _must_ come last
    args += [f"{SUITES}"]

    print("Robot CLI Arguments:\n", "  ".join(["robot", *args]))

    return args


def build_variable_args(**variables):
    """build arguments for variables"""
    return sum(
        [["--variable", f"{key}:{value}"] for key, value in variables.items()], []
    )


def attempt_atest_with_retries(*extra_args):
    """retry the robot tests a number of times"""
    attempt = ATTEMPT
    error_count = -1

    while error_count != 0 and attempt <= RETRIES:
        attempt += 1
        print("attempt {} of {}...".format(attempt, RETRIES + 1))
        start_time = time.time()
        error_count = atest(attempt=attempt, extra_args=list(extra_args))
        print(error_count, "errors in", int(time.time() - start_time), "seconds")

    return error_count


def get_stem(attempt, extra_args):
    """Build the stem, used in the output directory name"""

    if "--dryrun" in extra_args:
        return "dry_run"

    return str(attempt)


def ensure_out_dir(stem: str):
    """Make a clean output folder, also used as the working directory."""
    out_dir = OUT / stem

    print("Robot Output Folder:\t", out_dir)

    if out_dir.exists():
        shutil.rmtree(out_dir)

    if out_dir.exists():
        print("trying to clean out {}".format(out_dir))
        try:
            shutil.rmtree(out_dir)
        except Exception as err:
            print("Error deleting {}, hopefully harmless: {}".format(out_dir, err))

    out_dir.mkdir(parents=True, exist_ok=True)

    return out_dir


if __name__ == "__main__":
    sys.exit(attempt_atest_with_retries(*sys.argv[1:]))
