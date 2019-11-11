---
name: Request Bring-your-own Language Server Support
about: Help us improve language servers we don't know about
---

<!--
Welcome! Before creating a new issue:
* Search for relevant issues
* Ensure your language server is not supported in LANGUAGESERVERS.md
* Follow the issue reporting guidelines:
https://jupyterlab.readthedocs.io/en/latest/getting_started/issue.html
-->

## Description

<!--Describe the bug clearly and concisely. Clearly indicate the language -->

## Reproduce

<!--Describe step-by-step instructions to reproduce the behavior-->

1. Go to '...'
2. Click on '...'
3. Scroll down to '...'
4. See error '...'

<!--Describe how you diagnosed the issue. See the guidelines at
 https://jupyterlab.readthedocs.io/en/latest/getting_started/issue.html -->

## Expected behavior

<!--Describe what you expected to happen-->

## Context

<!--Complete the following for context, and add any other relevant context-->

- Operating System and version:
- Browser and version:
- JupyterLab version:
- `jupyter-lsp` version:
- `@krassowski/jupyterlab-lsp` version:
- Language Server:
- Language Server version:
- Language Server installed with: <!-- e.g. system package manager, app package manager -->
- Language Server Spec
```python
# jupyter_notebook_config.json
{
  "LanguageServerManager": {
    "language_servers": {
      "my-language-server": {
        "languages": ["my-language"],
        "argv": ["echo"]
      }
    }
  }
}
```

<details><summary>Troubleshoot Output</summary>
<pre>
Paste the output from running `jupyter troubleshoot` from the command line here.
You may want to sanitize the paths in the output.
</pre>
</details>

<details><summary>Command Line Output</summary>
<pre>
Paste the output from your command line running `jupyter lab` here, use `--debug` if possible.
</pre>
</details>

<details><summary>Browser Output</summary>
<pre>
Paste the output from your browser Javascript console here.
</pre>
</details>
