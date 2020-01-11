*** Settings ***
Suite Setup       Setup Suite For Screenshots    statusbar
Resource          ../Keywords.robot

*** Variables ***
${STATUSBAR}      css:div.lsp-statusbar-item
${DIAGNOSTIC}     W291 trailing whitespace (pycodestyle)
${POPOVER}        css:.lsp-popover

*** Test Cases ***
Statusbar Popup Opens
    Setup Notebook    Python    Python.ipynb
    Wait Until Page Contains Element    css:.cm-lsp-diagnostic[title*="${DIAGNOSTIC}"]    timeout=20s
    Element Should Contain    ${STATUSBAR}    Fully initialized
    Click Element    ${STATUSBAR}
    Wait Until Page Contains Element    ${POPOVER}    timeout=10s
    Capture Page Screenshot    01-statusbar.png
    Element Should Contain    ${POPOVER}    python
    Element Should Contain    ${POPOVER}    initialized
    [Teardown]    Clean Up After Working With File    Python.ipynb
