import subprocess
from pathlib import Path
from tempfile import TemporaryDirectory
from time import sleep
from warnings import warn

HERE = Path(__file__).parent
EXAMPLE = HERE.parent / "atest/examples/example.tex"
ATTEMPTS = 3
SLEEP = 5


def tectonic_cache():
    """ warm up the tectonic cache so that it doesn't fail the acceptance test
    """
    with TemporaryDirectory() as td:
        tdp = Path(td)
        tex = tdp / "example.tex"
        tex.write_text(
            "\n".join(
                [
                    line
                    for line in EXAMPLE.read_text().splitlines()
                    if "\\foo" not in line
                ]
            )
        )
        for attempt in range(ATTEMPTS):
            try:
                subprocess.check_call(["tectonic", str(tex)], cwd=td)
                break
            except subprocess.CalledProcessError as e:
                warn(
                    "Tectonic cache attempt {attempt} failed: {e},"
                    " retrying in {time} seconds".format(
                        e=e, attempt=attempt, time=SLEEP
                    )
                )
                sleep(SLEEP)


if __name__ == "__main__":
    tectonic_cache()
