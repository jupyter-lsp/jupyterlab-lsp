""" Documentation configuration and workflow for jupyter-starters
"""
# pylint: disable=invalid-name,redefined-builtin,import-error

import pathlib
import subprocess
import sys

sys.path.insert(
    0,
    str(
        (
            pathlib.Path.cwd().parent / "python_packages" / "jupyter_lsp" / "src"
        ).resolve()
    ),
)

project = "Jupyter[Lab] Language Server"
copyright = "2021, Jupyter[Lab] Language Server Contributors"
author = "Jupyter[Lab] Language Server Contributors"

version = ""
release = ""

extensions = [
    "myst_nb",
    "sphinx.ext.autodoc",
    "sphinx.ext.napoleon",
    "sphinx.ext.coverage",
    "sphinx.ext.doctest",
    "sphinx.ext.githubpages",
    "sphinx.ext.ifconfig",
    "sphinx.ext.intersphinx",
    "sphinx.ext.mathjax",
    "sphinx.ext.todo",
    "sphinx.ext.viewcode",
    "sphinx_copybutton",
    "sphinx_autodoc_typehints",
]

templates_path = ["_templates"]

source_suffix = [".rst", ".md"]

master_doc = "index"

language = None

exclude_patterns = [
    ".ipynb_checkpoints/**",
    "**/.ipynb_checkpoints/**",
    "**/~.*",
    "~.*",
    "_build/**",
]

html_theme = "sphinx_book_theme"

html_static_path = ["_static"]

htmlhelp_basename = "jupyterlab-lsp"

intersphinx_mapping = {
    "python": ("https://docs.python.org/3", None),
    "jsonschema": ("https://python-jsonschema.readthedocs.io/en/stable/", None),
}

github_url = "https://github.com"
github_repo_org = "jupyter-lsp"
github_repo_name = "jupyterlab-lsp"
github_repo_slug = f"{github_repo_org}/{github_repo_name}"
github_repo_url = f"{github_url}/{github_repo_slug}"

extlinks = {
    "issue": (f"{github_repo_url}/issues/%s", "#"),
    "pr": (f"{github_repo_url}/pull/%s", "PR #"),
    "commit": (f"{github_repo_url}/commit/%s", ""),
    "gh": (f"{github_url}/%s", "GitHub: "),
}

html_show_sourcelink = True

html_context = {
    "display_github": True,
    # these automatically-generated pages will create broken links
    "hide_github_pagenames": ["search", "genindex"],
    "github_user": github_repo_org,
    "github_repo": github_repo_name,
    "github_version": "master",
    "conf_py_path": "/docs/",
}

html_logo = "images/logo.png"
html_title = "Language Server Protocol integration for Jupyter[Lab]"


html_theme_options = {
    "repository_url": github_repo_url,
    "path_to_docs": "docs",
    "use_fullscreen_button": True,
    "use_repository_button": True,
    "use_issues_button": True,
    "use_edit_page_button": True,
    "use_download_button": True,
}

# MyST-{NB}

jupyter_execute_notebooks = "force"
nb_output_stderr = "remove-warn"
myst_enable_extensions = [
    "amsmath",
    "deflist",
    "dollarmath",
    "html_admonition",
    "html_image",
    "smartquotes",
]


def setup(app):
    """Runs before the "normal business" of sphinx. Don't go too crazy here."""
    app.add_css_file("css/custom.css")
    subprocess.check_call(["jlpm", "--ignore-optional"])
