# Releasing `jupyterlab-lsp` and `jupyter_lsp`

Releases may require building both the python package and nodejs packages.

## Updating Version Strings

Check the version strings across the various files:

```bash
python scripts/integrity.py
```

> TODO: create a `release.py` script

The PyPI version must be updated in at least two places:

- `py_src/jupyter_lsp/_version.py` (canonical)
- `azure-pipelines.yml`

The npm version must be updated in at least three places

- `packages/jupyterlab-lsp/package.json` (canonical)
- `azure-pipelines.yml`
- `packages/metapackage/package.json`
