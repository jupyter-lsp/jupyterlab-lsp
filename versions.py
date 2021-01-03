import json
from pathlib import Path
from re import findall
from configparser import ConfigParser

ROOT = Path(__file__).resolve().parent
config = ConfigParser()
config.read('setup.cfg')


_VERSION_PY = ROOT / "py_src" / "jupyter_lsp" / "_version.py"
JUPYTER_LSP_VERSION = findall(r'= "(.*)"$', (_VERSION_PY).read_text(encoding="utf-8"))[0]

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
REQUIRED_PYTHON = config['options']['python_requires']
