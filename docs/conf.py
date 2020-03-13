""" Documentation configuration and workflow for jupyter-starters
"""
# pylint: disable=invalid-name,redefined-builtin,import-error

import pathlib
import sys
import subprocess
import nbsphinx

HERE = pathlib.Path(__file__).parent
ROOT = HERE.parent

nbsphinx.RST_TEMPLATE = nbsphinx.RST_TEMPLATE.replace(
    """{% block input -%}""",
    """{% block input -%}""" """{% if not cell.metadata.get("hide_input", False) -%}""",
).replace("""{% endblock input %}""", """{%- endif -%}{%- endblock input %}""")

nbsphinx_prompt_width = "0"

sys.path.insert(
    0, str((pathlib.Path.cwd().parent / "py_src" / "jupyter_lsp").resolve())
)

project = "Jupyter[Lab] Language Server"
copyright = "2020, Jupyter[Lab] Language Server Contributors"
author = "Jupyter[Lab] Language Server Contributors"

version = "0.7.0"
release = "0"

extensions = [
    "recommonmark",
    "nbsphinx",
    "sphinx_markdown_tables",
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

pygments_style = "monokai"

html_theme = "sphinx_rtd_theme"

html_static_path = ["_static"]

htmlhelp_basename = "jupyterlab-lsp"

intersphinx_mapping = {
    "python": ("https://docs.python.org/3", None),
    "jsonschema": ("https://python-jsonschema.readthedocs.io/en/stable/", None),
}

github_url = "https://github.com"
github_repo_org = "krassowski"
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


def setup(app):
    """ Runs before the "normal business" of sphinx. Don't go too crazy here.
    """
    app.add_css_file("css/custom.css")
    subprocess.Popen(["jlpm", "--ignore-optional"])
