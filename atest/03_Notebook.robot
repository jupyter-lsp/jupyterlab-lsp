*** Settings ***
Suite Setup       Setup Suite For Screenshots    notebook
Resource          Keywords.robot

*** Test Cases ***
Python
    [Setup]    Reset Application State
    Setup Notebook    Python    Python.ipynb
    Capture Page Screenshot    01-python.png
    ${diagnostic} =    Set Variable    W291 trailing whitespace (pycodestyle)
    Wait Until Page Contains Element    css:.cm-lsp-diagnostic[title="${diagnostic}"]    timeout=20s
    Capture Page Screenshot    02-python.png
    Clean Up After Working With File    Python.ipynb

Foregin Extractors
    [Setup]    Reset Application State
    Setup Notebook    Python    Foreign extractors.ipynb
    @{diagnostics} =    Create List    Failed to parse expression    Name 'valid' is not defined (mypy)    Trailing whitespace is superfluous. (lintr)
    FOR    ${diagnostic}    IN    @{diagnostics}
        Wait Until Page Contains Element    css:.cm-lsp-diagnostic[title="${diagnostic}"]    timeout=30s
        Capture Page Screenshot    0x-${diagnostic}.png
    END
    Clean Up After Working With File    Foreign Extractors.ipynb
