import json
from pathlib import Path
from re import findall

ROOT = Path(__file__).resolve().parent


JUPYTER_LSP_PATH = ROOT / "python_packages" / "jupyter_lsp"
_VERSION_PY = JUPYTER_LSP_PATH / "jupyter_lsp" / "_version.py"
JUPYTER_LSP_VERSION = findall(r'= "(.*)"$', _VERSION_PY.read_text(encoding="utf-8"))[0]

with open(ROOT / "packages/jupyterlab-lsp/package.json") as f:
    jupyterlab_lsp_package = json.load(f)

JUPYTERLAB_LSP_VERSION = jupyterlab_lsp_package['version']
JUPYTERLAB_VERSION = (
    jupyterlab_lsp_package
    ['devDependencies']
    ['@jupyterlab/application']
    .lstrip('~^')
)
JUPYTERLAB_NEXT_MAJOR_VERSION = int(JUPYTERLAB_VERSION.split('.')[0]) + 1
REQUIRED_JUPYTERLAB = f'>={JUPYTERLAB_VERSION},<{JUPYTERLAB_NEXT_MAJOR_VERSION}.0.0a0'
REQUIRED_JUPYTER_SERVER = '>=1.1.2'
REQUIRED_PYTHON = '>=3.6,<3.9.0a0'

RF_LSP_VERSION = "robotframework-lsp >=0.14,<0.15"
