# Roadmap

> If a feature you need is not on the lists above, please feel free to suggest it
> by opening a new [issue](https://github.com/krassowski/jupyterlab-lsp/issues).

## Front End

- improved code navigation when there are multiple jump targets
- autocompleter with documentation and sorting based on LSP suggestions
- system of settings, including options:
  - to enable aggressive autocompletion (like in hinterland)
  - to change the verbosity of signature hints (whether to show documentation, number of lines to be shown)
- "rename" action in notebooks
- gutter with linter results (low priority)
- use the kernel session for autocompletion in FileEditor if available (PR welcome)

## Backend

- release on `conda`
- [#49](https://github.com/krassowski/jupyterlab-lsp/issues/49)
  cookiecutter for pip-installable specs
- add hook system to allow serverextensions/kernels to modify, inspect and
  react to LSP messages
