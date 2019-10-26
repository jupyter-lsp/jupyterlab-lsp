# Releasing `jupyterlab-lsp` and `jupyter_lsp`

Releases may require building both the python package and nodejs packages.

## Updating Versions

The version for PyPI must be updated in two places:

- `py_src/jupyter_lsp/_version.py`
- `azure-pipelines.yml`

The version for npm must be updated in two places:

- `package.json`
- `azure-pipelines.yml`
