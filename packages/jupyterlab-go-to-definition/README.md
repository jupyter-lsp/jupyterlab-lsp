# Go to definition extension for JupyterLab

[![Build Status](https://travis-ci.org/krassowski/jupyterlab-go-to-definition.svg?branch=master)](https://travis-ci.org/krassowski/jupyterlab-go-to-definition) [![codebeat badge](https://codebeat.co/badges/89f4b78a-c28e-43a0-9b4c-35d36dbd9d5e)](https://codebeat.co/projects/github-com-krassowski-jupyterlab-go-to-definition-master) [![Binder](https://beta.mybinder.org/badge.svg)](https://mybinder.org/v2/gh/krassowski/jupyterlab-go-to-definition/master?urlpath=lab/tree/examples/demo.ipynb)

Jump to definition of a variable or function in JupyterLab notebook and file editor.

Use <kbd>Alt</kbd> + <kbd>click</kbd> to jump to a definition using your mouse, or <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>B</kbd> keyboard-only alternative.

![Go to definition](https://raw.githubusercontent.com/krassowski/jupyterlab-go-to-definition/master/examples/demo.gif)

You can replace the key modifier for mouse click from <kbd>Alt</kbd> to <kbd>Control</kbd>, <kbd>Shift</kbd>, <kbd>Meta</kbd> or <kbd>AltGraph</kbd> in the settings (see remarks below).

To jump back to the variable/function usage, use <kbd>Alt</kbd> + <kbd>o</kbd>.

The plugin is language-agnostic, though optimized for Python and R.
Support for other languages is possible (PRs welcome).

#### Jumping to definitions in other files

Python:

- alt-click on the name of a module in Python (e.g. `from x.y import z` - alt-click on `x` or `z`) (new in v0.5)
- alt-click on a class, function or method imported from any module (except for builtin modules written in C as such do not have a corresponding Python source file) **in a notebook with active Python 3 kernel** (new in v0.6)

R (new in v0.5):

- alt-click on `source` function (e.g. alt-clicking on `source` in `source('test.R')` will open `test.R` file)
- alt-click on `.from` of `import::here(x, y, .from='some_file.R')`

Background: there are two ways to solve the definitions location: static analysis and inspection performed in the kernel. The latter is more accurate, although it currently only works in notebooks (not in the file editor). For the implementation overview, please see [the design page](https://github.com/krassowski/jupyterlab-go-to-definition/wiki). In order to jump to a file outside of the JupyterLab project directory (e.g. the built-in Python libraries) a [symlink-based workaround is required](https://github.com/krassowski/jupyterlab-go-to-definition#symlink-workaround-jump-to-any-file-outside-of-the-project-root).

#### Changing the modifiers key from `alt`

Please go to `Settings > Advanced Setting Editor > Go-to-definition` and set a modifier of your choice in the User Preferences panel. For full list of physical keys mapped to the modifiers (which depend on your Operating System), please see [the MDN documentation](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/getModifierState).

Safari users: Safari does not implement `MouseEvent.getModifierState` (see [#3](https://github.com/krassowski/jupyterlab-go-to-definition/issues/3)), thus only <kbd>Alt</kbd>, <kbd>Control</kbd>, <kbd>Shift</kbd> and <kbd>Meta</kbd> are supported.

#### Related extensions

[jupyterlab-lsp](https://github.com/krassowski/jupyterlab-lsp) provides advanced autocompletion, code navigation, hover suggestions, linters, etc. It depends on this extension for the jumping functionality, thus all the jumps are recorded in a shared history and the "go back" option should work with jumps performed with both: shortcuts from this extension and context-menu actions of jupyterlab-lsp.

## Prerequisites

- JupyterLab 1.0+

## Installation

```bash
jupyter labextension install @krassowski/jupyterlab_go_to_definition
```

To update already installed extension:

```bash
jupyter labextension update @krassowski/jupyterlab_go_to_definition
```

## Development

For a development install (requires npm version 4 or later), do the following in the repository directory:

```bash
npm install
npm run build
jupyter labextension link .
```

To rebuild the package and the JupyterLab app:

```bash
npm run build
jupyter lab build
```

To run tests suite:

```bash
npm test
```

### Adding support for additional languages

Support for new languages should be provided by implementation of abstract `LanguageAnalyzer` class (in case of languages which support use of semicolons to terminate statements `LanguageWithOptionalSemicolons` helper class can be utilized).

Each new language class needs to be included in `chooseLanguageAnalyzer` function and the developer needs to verify if `setLanguageFromMime` in `fileeditor.ts` will be able to recognize the language properly.

## Symlink workaround (jump to any file outside of the project root)

JupyterLab attempts to protect users from accessing system files by restricting the accessible files to those within the directory it was started in (so called project root). If you wish to jump to files outside of the project root, you cold use a symlink workaround as follows:

1. create `.jupyter_symlinks` in the top directory of your JupyterLab project, and
2. symlink your `home`, `usr`, or any other location which includes the files that you wish to make possible to open in there. The Linux following commands demonstrate the idea:

```bash
mkdir .jupyter_symlinks
cd .jupyter_symlinks
ln -s /home home
ln -s /usr usr
```

### Which directories to symlink?

To find out which paths you need to symlink for Python you could run `python3 -v` which will list where are the specific built-in modules imported from. Look out for lines like these:

```python
# /srv/conda/envs/notebook/lib/python3.7/__pycache__/_collections_abc.cpython-37.pyc matches /srv/conda/envs/notebook/lib/python3.7/_collections_abc.py
# code object from '/srv/conda/envs/notebook/lib/python3.7/__pycache__/_collections_abc.cpython-37.pyc'
import '_collections_abc' # <_frozen_importlib_external.SourceFileLoader object at 0x7f77ba22c400>
```

which mean that you want `/srv/conda/envs/notebook/lib/python3.7/` to be symlinked to access `_collections_abc`. You can do this by:

```bash
# still in .jupyter_symlinks
mkdir -p srv/conda/envs/notebook/lib
# note: no slash (/) at the begining of the second path
ln -s /srv/conda/envs/notebook/lib/python3.7 srv/conda/envs/notebook/lib/python3.7
```

Please note that not every Python built-in module has a corresponding Python file, as many are written in C for performance reasons.
