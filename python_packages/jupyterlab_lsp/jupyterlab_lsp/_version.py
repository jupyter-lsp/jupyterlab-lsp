import json

from ._paths import MAIN_PACKAGE_PATH

_js_version = json.loads(
    (MAIN_PACKAGE_PATH / "package.json").read_text(encoding="utf-8")
)["version"]

__all__ = ["__version__"]
# value should conform to https://www.python.org/dev/peps/pep-0440/
__release__ = ""
__version__ = f"{_js_version}{__release__}"
