import subprocess
from pathlib import Path
from tempfile import TemporaryDirectory

HERE = Path(__file__).parent
EXAMPLE = HERE.parent / "atest/examples/example.tex"


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
        subprocess.check_call(["tectonic", str(tex)], cwd=td)


if __name__ == "__main__":
    tectonic_cache()
