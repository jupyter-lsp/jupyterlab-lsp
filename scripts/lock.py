""" environment locking for jupyter[lab]-lsp
"""
import platform
import subprocess
import tempfile
from pathlib import Path

from ruamel_yaml import safe_dump, safe_load

from doit.tools import config_changed

DOIT_CONFIG = {
    "backend": "sqlite3",
    "verbosity": 2,
    "par_type": "thread",
    "default_tasks": ["lock"],
}

WIN = platform.system() == "Windows"
OSX = platform.system() == "Darwin"
LINUX = platform.system() == "Linux"

CONDA_PLATFORM = "win-64" if WIN else "osx-64" if OSX else "linux-64"
CONDA_CMD = "conda"

ROOT = Path(__file__).parent.parent.resolve()

GITHUB = ROOT / ".github"
WORKFLOWS = GITHUB / "workflows"
LOCKS = GITHUB / "conda.locks"

WORKFLOW_LINT = WORKFLOWS / "job.lint.yml"
WORKFLOW_TEST = WORKFLOWS / "job.test.yml"

WORKFLOW_LINT_YML = safe_load(WORKFLOW_LINT.read_text())
WORKFLOW_TEST_YML = safe_load(WORKFLOW_TEST.read_text())

TEST_MATRIX = WORKFLOW_TEST_YML["jobs"]["acceptance"]["strategy"]["matrix"]
LINT_MATRIX = WORKFLOW_LINT_YML["jobs"]["lint"]["strategy"]["matrix"]

REQS = ROOT / "requirements"


class ENV:
    atest = REQS / "atest.yml"
    ci = REQS / "ci.yml"
    lab = REQS / "lab.yml"
    lint = REQS / "lint.yml"
    lock = REQS / "lock.yml"
    utest = REQS / "utest.yml"
    win = REQS / "win.yml"


# here (and above) would stay in a "real" dodo file
def task_lock():
    """lock conda envs so they don't need to be solved in CI
    This should be run semi-frequently (e.g. after merge to master).
    Requires `conda-lock` CLI to be available
    """

    test_envs = [ENV.ci, ENV.lab, ENV.utest, ENV.atest]

    for task_args in _iter_lock_args(TEST_MATRIX):
        yield _make_lock_task("test", test_envs, TEST_MATRIX, *task_args)

    for task_args in _iter_lock_args(LINT_MATRIX):
        yield _make_lock_task("lint", [*test_envs, ENV.lint], LINT_MATRIX, *task_args)

    yield _make_lock_task("lock", [ENV.lock], {}, CONDA_PLATFORM, "3.8")


# below here could move to a separate file

CHN = "channels"
DEP = "dependencies"


def _make_lock_task(
    kind_, env_files, config, platform_, python_, nodejs_=None, lab_=None
):
    """generate a single dodo excursion for conda-lock"""
    if platform_ == "win-64":
        env_files = [*env_files, ENV.win]

    lockfile = (
        LOCKS / f"conda.{kind_}.{platform_}-{python_}-{lab_ if lab_ else ''}.lock"
    )
    file_dep = [*env_files]

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

        deps = [raw for (raw, match) in env_specs.values()]
        deps += [
            raw for name, (raw, match) in comp_specs.items() if name not in env_specs
        ]

        composite[DEP] = sorted(deps)

        return composite

    def _lock():
        composite = dict()

        for env_dep in env_files:
            print(f"merging {env_dep.name}", flush=True)
            composite = merge(composite, safe_load(env_dep.read_text()))

        fake_deps = []

        if python_:
            fake_deps += [f"python ={python_}.*"]
        if nodejs_:
            fake_deps += [f"nodejs ={nodejs_}.*"]

        fake_env = {DEP: fake_deps}

        composite = merge(composite, fake_env)

        with tempfile.TemporaryDirectory() as td:
            tdp = Path(td)
            composite_yml = tdp / "composite.yml"
            composite_yml.write_text(safe_dump(composite, default_flow_style=False))
            print("composite\n\n", composite_yml.read_text(), "\n\n", flush=True)
            rc = 1
            for extra_args in [[], ["--no-mamba"]]:
                args = [
                    "conda-lock",
                    "-p",
                    platform_,
                    "-f",
                    str(composite_yml),
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
        uptodate=[config_changed(config)],
        file_dep=file_dep,
        actions=[_lock],
        targets=[lockfile],
    )


def _iter_lock_args(matrix):
    for platform_ in matrix["platform"]:
        for python_ in matrix["python"]:
            for lab_ in matrix["lab"]:
                nodejs_ = None

                for include in matrix["include"]:
                    if "nodejs" not in include:
                        continue
                    if include["python"] == python_:
                        nodejs_ = include["nodejs"]
                        break

                assert nodejs_ is not None
                yield platform_, python_, nodejs_, lab_


# would not be needed if put in the "well-known" location ./dodo.py
if __name__ == "__main__":
    import doit

    doit.run(globals())
