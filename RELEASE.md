# Releasing `jupyterlab-lsp` and `jupyter_lsp`

Releases may require building both the python package and nodejs packages.

## Updating Version Strings

The version for PyPI must be updated in two places:

- `py_src/jupyter_lsp/_version.py`
- `azure-pipelines.yml`

The version for npm must be updated in five places (TODO create a `release.sh` or `release.py` script):

- `package.json`
- `azure-pipelines.yml`
- `packages/jupyterlab-lsp/package.json`
- `packages/metapackage/package.json`
- `README.md`
