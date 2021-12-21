---
name: Bug report
about: Create a report to help us improve
---

<!--
Welcome! Before creating a new issue:
* Search for relevant issues
* Follow the issue reporting guidelines:
https://jupyterlab.readthedocs.io/en/latest/getting_started/issue.html
-->

## Description

<!--Describe the bug clearly and concisely. Include screenshots (or even better - gifs) if possible-->

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
- Language server and version:

<details><summary>Required: installed server extensions</summary>
<pre>
Paste the output from running `jupyter server extension list` (JupyterLab >= 3)
or `jupyter serverextension list` (JupyterLab < 3) from the command line here.
You may want to sanitize the paths in the output.
</pre>
</details>

<details><summary>Required: installed lab extensions</summary>
<pre>
Paste the output from running `jupyter labextension list` from the command line here.
You may want to sanitize the paths in the output.
</pre>
</details>

<!--The more content you provide, the more we can help! Please fill in the below:-->

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

<details><summary>Browser Output (recommended for all interface issues)</summary>
<pre>
Paste the output from your browser JavaScript console replacing the text in here.

To learn how to open the developer tools in your browser:
https://developer.mozilla.org/en-US/docs/Learn/Common_questions/What_are_browser_developer_tools#How_to_open_the_devtools_in_your_browser
If too many messages accumulated after many hours of working in JupyterLab,
consider refreshing the window and then reproducing the bug to reduce the noise in the logs.

</pre>
</details>
