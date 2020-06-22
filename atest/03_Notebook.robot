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

Foregin Extractors
    Setup Notebook    Python    Foreign extractors.ipynb
    # if mypy and pyflakes will fight over `(N|n)ame 'valid'`, just hope for the best
    @{diagnostics} =    Create List    Failed to parse expression    ame 'valid'    Trailing whitespace is superfluous.
    FOR    ${diagnostic}    IN    @{diagnostics}
        Wait Until Page Contains Element    css:.cm-lsp-diagnostic[title*\="${diagnostic}"]    timeout=35s
        Capture Page Screenshot    0x-${diagnostic}.png
    END
    Clean Up After Working With File    Foreign Extractors.ipynb
