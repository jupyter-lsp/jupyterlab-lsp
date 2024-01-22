"""Post-processing for generated reports."""
import os
import sys
from pathlib import Path
from shutil import rmtree
from subprocess import call, check_output

import jinja2

GITHUB_STEP_SUMMARY = os.environ.get("GITHUB_STEP_SUMMARY")
UTF8 = dict(encoding="utf-8")

SCRIPTS = Path(__file__).parent
ROOT = SCRIPTS.parent
REPORTS = ROOT / "build/reports"

COV_OUT = REPORTS / "coverage"
PY_COV = [*REPORTS.rglob(".coverage*")]
PY_COV = [p for p in PY_COV if p.parent != COV_OUT]
COV_DATA = COV_OUT / ".coverage"

BASE_ARGS = ["--data-file", str(COV_OUT / ".coverage")]
COMBINE_ARGS = [*BASE_ARGS, "--keep", *list(map(str, PY_COV))]
HTML_ARGS = [*BASE_ARGS, "--show-contexts", "--directory", str(COV_OUT)]
REPORT_ARGS = [*BASE_ARGS, "--skip-covered", "--show-missing", "--skip-empty"]
MD_ARGS = [*REPORT_ARGS, "--format=markdown"]

INDEX = REPORTS / "index.html"
INDEX_CSS = """
:root {
    --tiger-bg: rgba(0, 0, 128, 0.125);
    --bg: #fff;
}

@media (prefers-color-scheme: dark) {
    :root {
        color-scheme: dark;
        --tiger-bg: rgba(128, 128, 255, 0.125);
        --bg: #000;
    }
}
* {
    font-family: sans-serif;
}
body {
    padding: 0;
    margin: 0;
    background-color: var(--bg);
}
.main {
    display: flex;
}
code {
  font-family: monospace;
}
.main > .files {
    padding: 1em;
    max-height: 100vh;
    overflow-y: auto;
}
.main > iframe {
    flex: 1;
    width: 100%;
    background-color: var(--bg);
    max-height: 100vh;
    border: 0;
    height: 100vh;
}
ul {
    margin: 0;
    padding: 0;
}
li {
    margin: 0;
    padding: 0;
    padding-left: 0.5em;
}
"""
INDEX_TMPL = """
{% macro get_type(path, name) %}
    {% if "htmlcov" in path %}
        <code>coverage.py</code>
    {% elif "utest" in path %}
        <code>pytest</code>
    {% elif "atest" in path %}
        {% if name == "log.html" %}
            <code>robot</code> log
        {% elif name == "report.html" %}
            <code>robot</code> summary
        {% elif "geckodriver" in name %}
            <code>geckodriver</code> browser log
        {% elif "lab.log" in name %}
            <code>jupyterlab</code> log
        {% endif %}
    {% elif "coverage" in path and name == "index.html" %}
        <code>coverage.py</code> summary
    {% endif %}
{% endmacro %}

{% macro make_tree(name, tree) %}
<li>
    <label><code>{{ name }}/</code></label>
    <ul>
    {% for child_name, child in tree["children"].items() %}
        {% if child.href %}
            {{ make_leaf(child_name, child.href) }}
        {% else %}
            {% if child.children["index.html"] and (child.children | count) == 1 %}
                {{ make_leaf(child_name, child.children["index.html"].href) }}
            {% else %}
                {{ make_tree(child_name, child) }}
            {% endif %}
        {% endif %}
    {% endfor %}
    </ul>
</li>
{% endmacro %}

{% macro make_leaf(name, href) %}
<li>
    <a href="./{{ href }}" target="report">
        <strong>
            <code>{{ name }}</code>
        </strong>
    </a>
</li>
{% endmacro %}

<html>
  <head>
    <title>{{ title }}</title>
    <style>{{ css }}</style>
  </head>
  <body>
    <div class="main">
        <ul class="files">{{ make_tree(".", file_tree) }}</ul>
        <iframe name="report" id="report"></iframe>
    </div>
  </body>
</html>
"""


def report_python_coverage(*extra_args):
    if not PY_COV:
        print(f"!!! No python coverage files found in {REPORTS}")
        return 1
    print("... combining", len(PY_COV), ".coverage files")

    rc = 0

    if COV_OUT.exists():
        rmtree(COV_OUT)

    COV_OUT.mkdir(parents=True)

    rc or call(["coverage", "combine", *COMBINE_ARGS])

    if not rc and GITHUB_STEP_SUMMARY:
        path = Path(GITHUB_STEP_SUMMARY)
        old_text = path.read_text(**UTF8) if path.exists() else ""
        try:
            md = check_output(["coverage", "report", *MD_ARGS], **UTF8)
            path.write_text("\n\n".join([old_text.strip(), md]), **UTF8)
        except Exception:
            rc = 1

    final_rc = rc or call(["coverage", "report", *REPORT_ARGS, *extra_args])

    rc or call(["coverage", "html", *HTML_ARGS])

    return final_rc


def find_files():
    files = sorted(
        [
            *REPORTS.rglob("index.html"),
            *REPORTS.rglob("log.html"),
            *REPORTS.rglob("*.log.txt"),
        ]
    )
    file_tree = {"children": {}}

    for file in files:
        rel = file.relative_to(REPORTS).as_posix()
        bits = rel.split("/")
        current = file_tree["children"]
        for bit in bits[:-1]:
            current = current.setdefault(bit, {"children": {}})["children"]
        current[file.name] = {"href": rel}
    return file_tree


def report_index():
    if INDEX.exists():
        INDEX.unlink()

    file_tree = find_files()

    context = dict(
        title="jupyter-lsp reports",
        css=INDEX_CSS,
        reports=REPORTS,
        file_tree=file_tree,
    )
    INDEX.write_text(jinja2.Template(INDEX_TMPL).render(context))
    print("Wrote HTML index to", INDEX.as_uri())
    return 0


def report(*extra_args):
    rcs = []
    rcs += [report_python_coverage(*extra_args)]
    rcs += [report_index(*extra_args)]
    return max(rcs)


if __name__ == "__main__":
    sys.exit(report(*sys.argv[1:]))
