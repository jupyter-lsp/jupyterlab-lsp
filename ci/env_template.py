from pathlib import Path
import sys

Path("..", "env-test.yml").write_text(
    Path("env-test.yml.in").read_text().format(sys.argv[1])
)
