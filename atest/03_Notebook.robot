*** Settings ***
Suite Setup       Setup Suite For Screenshots    notebook
Test Setup        Try to Close All Tabs
Resource          Keywords.robot

*** Test Cases ***
Python
    Setup Notebook    Python    Python.ipynb
    Capture Page Screenshot    01-python.png
    ${diagnostic} =    Set Variable    W291 trailing whitespace (pycodestyle)
    Wait Until Page Contains Element    css:.cm-lsp-diagnostic[title="${diagnostic}"]    timeout=35s
    Capture Page Screenshot    02-python.png
    Clean Up After Working With File    Python.ipynb

Foreign Extractors
    ${file} =    Set Variable    Foreign extractors.ipynb
    # #288: this would need to be restored for latex
    #
    # Configure JupyterLab Plugin    {"language_servers": {"texlab": {"serverSettings": {"latex.lint.onChange": true}}}}
    #
    Setup Notebook    Python    ${file}
    # if mypy and pyflakes will fight over `(N|n)ame 'valid'`, just hope for the best
    @{diagnostics} =    Create List
    ...    Failed to parse expression    # bash
    ...    ame 'valid'    # python
    ...    Trailing whitespace is superfluous.    # r
    ...    `frob` is misspelt    # markdown
    #
    # #288: once configured, diagnostics are coming back over the wire, but not displaying
    #
    # ...    Command terminated with space    # latex
    #
    FOR    ${diagnostic}    IN    @{diagnostics}
        Wait Until Page Contains Element    css:.cm-lsp-diagnostic[title*\="${diagnostic}"]    timeout=35s
        Capture Page Screenshot    0x-${diagnostic}.png
    END
    [Teardown]    Clean Up After Working with File and Settings    ${file}
