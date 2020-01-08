*** Settings ***
Suite Setup       Setup Suite For Screenshots    notebook
Resource          Keywords.robot

*** Test Cases ***
Diagnostics Panel
    [Setup]    Reset Application State
    # TODO: should we split those into test cases, and promote this case to a suite called "Diagnostics_Panel"?
    Setup Notebook    Python    Python.ipynb
    Capture Page Screenshot    01-panel.png
    ${diagnostic} =    Set Variable    W291 trailing whitespace (pycodestyle)
    Wait Until Page Contains Element    css:.cm-lsp-diagnostic[title*="${diagnostic}"]    timeout=20s
    Capture Page Screenshot    02-panel.png
    Open Diagnostics Panel
    ${count} =    Count Diagnostics In Panel
    Capture Page Screenshot    03-panel.png
    Should Be True    ${count} == 1
    # Test for #141 bug (diagnostics were not cleared after rename)
    Rename Jupyter File    Python.ipynb    PythonRenamed.ipynb
    Sleep    2s
    Capture Page Screenshot    04-panel.png
    ${new_count} =    Count Diagnostics In Panel
    Should Be True    ${new_count} == ${count}
    # Test for re-opening the panel
    Close Diagnostics Panel
    Open Diagnostics Panel
    ${reopened_count} =    Count Diagnostics In Panel
    Should Be True    ${reopened_count} == ${count}
    Clean Up After Working With File    PythonRenamed.ipynb
    # TODO: StatusBar
