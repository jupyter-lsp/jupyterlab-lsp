## Releasing `jupyterlab-lsp` and `jupyter_lsp`

Releases may require building both the python package and nodejs packages.

### Updating Version Strings

Check the version strings across the various files:

```bash
python scripts/integrity.py
```

> TODO: create a `release.py` script
> [#88](https://github.com/krassowski/jupyterlab-lsp/issues/88)

The PyPI version must be updated in the following places:

- `py_src/jupyter_lsp/_version.py` (canonical)
- `azure-pipelines.yml`
- `CHANGELOG.md`

The npm version must be updated in the following places

- `packages/jupyterlab-lsp/package.json` (canonical)
- `azure-pipelines.yml`
- `packages/metapackage/package.json`
- `CHANGELOG.md`
