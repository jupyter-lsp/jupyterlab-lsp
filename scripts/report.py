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
* {
  font-family: sans-serif;
}
body {
    display: flex;
    padding: 0;
    margin: 0;
}
code {
  font-family: monospace;
}
td, th {
  text-align: left;
  padding: 0.5em;
}
tbody tr:nth-child(odd) {
  background-color: rgba(0, 0, 128, 0.125);
}
header {
    padding: 0 1em;
    position: absolute;
    z-index: -1;
}
table {
    padding: 1em;
    max-height: 100%;
    overflow-y: auto;
}
iframe {
    flex: 1;
    width: 100%;
    background-color: #fff;
    max-height: 100vh;
    border: 0;
}
"""
INDEX_TMPL = """
<html>
  <head>
    <title>{{ title }}</title>
    <style>{{ css }}</style>
  </head>
  <body>
    <header>
        <h1>{{ title }}</h1>
        <p>
            Click a report to the left to view it.
        </p>
    </header>
    <iframe name="report" id="report"></iframe>
    <table>
        <thead>
            <tr>
                <th>folder</>
                <th>name</>
                <th>type</th>
            </tr>
        </thead>
        <tbody>
        {% for file in files %}
            {% set path = file.parent.relative_to(reports).as_posix() %}
            {% set stat = file.stat() %}
            {% set name = file.name %}
            <tr>
                <th>
                    <code>{{ path }}</code>
                </th>
                <th>
                    <a href="./{{ path }}/{{ name }}" target="report">
                        <code>{{ name }}</code></a>
                        ({{ (stat.st_size / 1024) | round(0) | int }}kb)
                </th>
                <td>
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
                </td>
            </tr>
        {% endfor %}
        </tbody>
    </table>
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


def report_index():
    if INDEX.exists():
        INDEX.unlink()
    context = dict(
        title="jupyter-lsp reports",
        css=INDEX_CSS,
        reports=REPORTS,
        files=sorted(
            [
                *REPORTS.rglob("index.html"),
                *REPORTS.rglob("log.html"),
                *REPORTS.rglob("report.html"),
                *REPORTS.rglob("*.log.txt"),
            ]
        ),
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
