# Releasing `jupyterlab-lsp` and `jupyter_lsp`

Releases may require building both the python package and nodejs packages.

## Updating Version Strings

The version for PyPI must be updated in two places:

- `py_src/jupyter_lsp/_version.py`
- `azure-pipelines.yml`

The version for npm must be updated in three places:

- `package.json`
- `azure-pipelines.yml`
- `README.md`
