import json

from ._paths import MAIN_PACKAGE_PATH

_js_version = json.loads(
    (MAIN_PACKAGE_PATH / "package.json").read_text(encoding="utf-8")
)["version"]

__all__ = ["__version__"]
__version__ = _js_version + "rc0"
