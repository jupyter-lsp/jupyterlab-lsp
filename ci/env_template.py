from pathlib import Path
import sys

Path("..", "env-test.yml").write_text(
    Path("env-test.yml.in").read_text().format(
        lab=sys.argv[1],
        nodejs=sys.argv[2]
    )
)
