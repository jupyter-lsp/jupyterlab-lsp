import json
from sys import path

path.insert(0, '../py_src/jupyter_lsp')

import _version   # noqa


JUPYTER_LSP_VERSION = _version.__version__

with open('../packages/jupyterlab-lsp/package.json') as f:
    jupyterlab_lsp_package = json.load(f)

JUPYTERLAB_LSP_VERSION = jupyterlab_lsp_package['version']
JUPYTERLAB_VERSION = (
    jupyterlab_lsp_package
    ['devDependencies']
    ['@jupyterlab/application']
    .lstrip('~^')
)
JUPYTERLAB_NEXT_MAJOR_VERSION = int(JUPYTERLAB_VERSION.split('.')[0]) + 1
REQUIRED_JUPYTERLAB = f'>={JUPYTERLAB_VERSION},<{JUPYTERLAB_NEXT_MAJOR_VERSION}'
