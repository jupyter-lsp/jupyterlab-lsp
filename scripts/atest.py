""" Run acceptance tests with robot framework
"""
# pylint: disable=broad-except
import os
import platform
import shutil
import sys
import time
from os.path import join
from pathlib import Path

import robot

ROOT = Path(__file__).parent.parent.resolve()
ATEST = ROOT / "atest"
OUT = ATEST / "output"

OS = platform.system()
PY = "".join(map(str, sys.version_info[:2]))

OS_PY_ARGS = {
    # notebook and ipykernel releases do not yet support python 3.8 on windows
    # ("Windows", "38"): ["--include", "not-supported", "--runemptysuite"]
    # TODO: restore when we figure out win36 vs jedi on windows
    ("Windows", "36"): ["--exclude", "feature:completion", "--runemptysuite"]
}

NON_CRITICAL = [
    # TODO: restore when yaml-language-server supports both config and...
    # everything else: https://github.com/krassowski/jupyterlab-lsp/pull/245
    # ["language:yaml", "feature:config"],
    # TODO: restore when we figure out win36 vs jedi on windows
    ["language:python", "py:36", "os:windows"],
    # TODO: need to make an upstream issue to clean "plain", or fix test
    ["gh-493:rflsp-claims-plain"],
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

    # TODO: investigate whether this is still required vs geckodriver 0.28
    if "FIREFOX_BINARY" not in os.environ:
        os.environ["FIREFOX_BINARY"] = shutil.which("firefox")

        prefix = os.environ.get("CONDA_PREFIX")

        if prefix:
            app_dir = join(prefix, "bin", "FirefoxApp")
            os.environ["FIREFOX_BINARY"] = {
                "Windows": join(prefix, "Library", "bin", "firefox.exe"),
                "Linux": join(app_dir, "firefox"),
                "Darwin": join(app_dir, "Contents", "MacOS", "firefox"),
            }[OS]

    print("Will use firefox at", os.environ["FIREFOX_BINARY"])

    assert os.path.exists(os.environ["FIREFOX_BINARY"])

    extra_args += OS_PY_ARGS.get((OS, PY), [])

    stem = get_stem(attempt, extra_args)

    for non_critical in NON_CRITICAL:
        extra_args += ["--skiponfailure", "AND".join(non_critical)]

    if attempt != 1:
        previous = OUT / f"{get_stem(attempt - 1, extra_args)}.robot.xml"
        if previous.exists():
            extra_args += ["--rerunfailed", str(previous)]

    out_dir = OUT / stem

    args = [
        "--name",
        f"{OS}{PY}",
        "--outputdir",
        out_dir,
        "--output",
        OUT / f"{stem}.robot.xml",
        "--log",
        OUT / f"{stem}.log.html",
        "--report",
        OUT / f"{stem}.report.html",
        "--xunit",
        OUT / f"{stem}.xunit.xml",
        "--variable",
        f"OS:{OS}",
        "--variable",
        f"PY:{PY}",
        # don't ever test our examples
        "--exclude",
        "atest:example",
        "--randomize",
        "all",
        *(extra_args or []),
        ATEST,
    ]

    print("Robot Arguments\n", " ".join(["robot"] + list(map(str, args))))

    os.chdir(ATEST)

    if out_dir.exists():
        print("trying to clean out {}".format(out_dir))
        try:
            shutil.rmtree(out_dir)
        except Exception as err:
            print("Error deleting {}, hopefully harmless: {}".format(out_dir, err))

    try:
        robot.run_cli(list(map(str, args)))
        return 0
    except SystemExit as err:
        return err.code


def attempt_atest_with_retries(*extra_args):
    """retry the robot tests a number of times"""
    attempt = 0
    error_count = -1

    retries = int(os.environ.get("ATEST_RETRIES") or "0")

    while error_count != 0 and attempt <= retries:
        attempt += 1
        print("attempt {} of {}...".format(attempt, retries + 1))
        start_time = time.time()
        error_count = atest(attempt=attempt, extra_args=list(extra_args))
        print(error_count, "errors in", int(time.time() - start_time), "seconds")

    return error_count


if __name__ == "__main__":
    sys.exit(attempt_atest_with_retries(*sys.argv[1:]))
