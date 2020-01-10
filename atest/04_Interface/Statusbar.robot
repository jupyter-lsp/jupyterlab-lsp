*** Settings ***
Suite Setup       Setup Suite For Screenshots    statusbar
Resource          ../Keywords.robot

*** Variables ***
${STATUSBAR}      css:div.lsp-statusbar-item
${DIAGNOSTIC}     W291 trailing whitespace (pycodestyle)

*** Test Cases ***
Statusbar Popup Opens
    Setup Notebook    Python    Python.ipynb
    Wait Until Page Contains Element    css:.cm-lsp-diagnostic[title*="${DIAGNOSTIC}"]    timeout=20s
    Element Should Contain    ${STATUSBAR}    Fully initialized
    Click Element   ${STATUSBAR}
    Wait Until Page Contains Element    css:.lsp-popover   timeout=10s
