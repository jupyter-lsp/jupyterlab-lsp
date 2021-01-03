import json
from ._paths import MAIN_PACKAGE_PATH

__all__ = ['__version__']
__version__ = json.loads(MAIN_PACKAGE_PATH / "package.json").read_text(encoding='utf-8')

