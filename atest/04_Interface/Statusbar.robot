*** Settings ***
Suite Setup       Setup Suite For Screenshots    statusbar
Resource          ../keywords/Common.robot

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
    [Teardown]    Clean Up After Working With Files    Python.ipynb

Status Changes Correctly Between Editors
    Prepare File for Editing    Python    status    example.py
    Wait Until Fully Initialized
    Open File    example.plain
    Wait Until Element Contains    ${STATUSBAR}    Initialized (additional servers needed)    timeout=60s
    Capture Page Screenshot    01-both-open.png
    Switch To Tab    example.py
    Wait Until Fully Initialized
    Switch To Tab    example.plain
    Wait Until Element Contains    ${STATUSBAR}    Initialized (additional servers needed)    timeout=60s
    [Teardown]    Clean Up After Working With Files    example.plain

*** Keywords ***
Switch To Tab
    [Arguments]    ${file}
    Click Element    ${JLAB XP DOCK TAB}\[contains(., '${file}')]
