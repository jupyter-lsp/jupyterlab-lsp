""" dodo commands for jupyter[lab]-lsp
"""
import os
from pathlib import Path
import json
from ruamel_yaml import safe_load, safe_dump
import tempfile
import subprocess
import platform

DOIT_CONFIG = {
    "backend": "sqlite3",
    "verbosity": 2,
    "par_type": "thread",
    "default_tasks": ["ci"]
}

WIN = platform.system() == "Windows"
OSX = platform.system() == "Darwin"
LINUX = platform.system() == "Linux"

ROOT = Path(__file__).parent.parent.resolve()

GITHUB = ROOT / ".github"
WORKFLOWS = GITHUB / "workflows"
LOCKS = GITHUB / "conda.locks"

WORKFLOW_LINT = WORKFLOWS / "job.lint.yml"
WORKFLOW_TEST = WORKFLOWS / "job.test.yml"

WORKFLOW_LINT_YML = safe_load(WORKFLOW_LINT.read_text())
WORKFLOW_TEST_YML = safe_load(WORKFLOW_TEST.read_text())

GH_MATRIX = WORKFLOW_TEST_YML["jobs"]["acceptance"]["strategy"]["matrix"]

REQS = ROOT / "requirements"
ACTIONS_ENV_YML = REQS / "github-actions.yml"
WIN_ENV_YML = REQS / "win.yml"

OS_2_CONDA_PLATFORM = {
    "ubuntu-": "linux-64",
    "macos-": "osx-64",
    "-win": "win-64"
}


CHN = "channels"
DEP = "dependencies"


def _make_lock_task(os_, platform_, python_, nodejs_, lab_):
    """ generate a single dodo excursion for conda-lock
    """
    lockfile = LOCKS / f"conda.{os_}-{python_}-{nodejs_}-{lab_}.lock"
    file_dep = [ACTIONS_ENV_YML]

    if platform_ == "win-64":
        file_dep += [WIN_ENV_YML]

    def expand_specs(specs):
        from conda.models.match_spec import MatchSpec

        for raw in specs:
            match = MatchSpec(raw)
            yield match.name, [raw, match]

    def merge(composite, env):
        for channel in reversed(env.get(CHN, [])):
            if channel not in composite.get(CHN, []):
                composite[CHN] = [channel, *composite.get(CHN, [])]

        comp_specs = dict(expand_specs(composite.get(DEP, [])))
        env_specs = dict(expand_specs(env.get(DEP, [])))

        composite[DEP] = [
            raw for (raw, match) in env_specs.values()
        ] + [
            raw for name, (raw, match) in comp_specs.items() if name not in env_specs
        ]

        return composite


    def _lock():
        composite = dict()

        for env_dep in file_dep:
            composite = merge(composite, safe_load(env_dep.read_text()))

        fake_env = {
            DEP: [
                f"python={python_}",
                f"jupyterlab={lab_}",
                f"nodejs={nodejs_}",
            ]
        }
        composite = merge(composite, fake_env)

        with tempfile.TemporaryDirectory() as td:
            tdp = Path(td)
            composite_yml = tdp / "composite.yml"
            composite_yml.write_text(safe_dump(composite, default_flow_style=False))
            print("composite\n\n", composite_yml.read_text(), "\n\n", flush=True)
            rc = 1
            for extra_args in [[], ["--no-mamba"]]:
                args = [
                    "conda-lock", "-p", platform_,
                    "-f", str(composite_yml)
                ] + extra_args
                print(">>>", " ".join(args), flush=True)
                rc = subprocess.call(args, cwd=str(tdp))
                if rc == 0:
                    break

            if rc != 0:
                raise Exception("couldn't solve at all", composite)

            tmp_lock = tdp / f"conda-{platform_}.lock"
            tmp_lock_txt = tmp_lock.read_text()
            tmp_lock_lines = tmp_lock_txt.splitlines()
            urls = [line for line in tmp_lock_lines if line.startswith("https://")]
            print(len(urls), "urls")
            if not lockfile.parent.exists():
                lockfile.parent.mkdir()
            lockfile.write_text(tmp_lock_txt)

    return dict(
        name=lockfile.name,
        file_dep=[*file_dep, WORKFLOW_TEST],
        actions=[_lock],
        targets=[lockfile]
    )


# Not part of normal business

def task_lock():
    """lock conda envs so they don't need to be solved in CI
    This should be run semi-frequently (e.g. after merge to master).
    Requires `conda-lock` CLI to be available
    """
    matrix = GH_MATRIX

    for os_ in matrix["os"]:
        platform_ = [v for k, v in OS_2_CONDA_PLATFORM.items() if k in os_][0]
        for python_ in matrix["python"]:
            for nodejs_ in matrix["nodejs"]:
                for lab_ in matrix["lab"]:
                    yield _make_lock_task(os_, platform_, python_, nodejs_, lab_)


if __name__ == '__main__':
    import doit
    doit.run(globals())
