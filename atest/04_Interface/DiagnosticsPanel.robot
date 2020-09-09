*** Settings ***
Suite Setup       Setup Suite For Screenshots    diagnostics_panel
Resource          ../keywords/Common.robot
Test Setup        Set Up Diagnostic Panel Test
Test Teardown     Clean Up Diagnostic Panel Test

*** Variables ***
${EXPECTED_COUNT}    1
${DIAGNOSTIC}     W291 trailing whitespace (pycodestyle)
${DIAGNOSTIC MESSAGE}    trailing whitespace
${MENU COLUMNS}    ${JLAB XP MENU ITEM LABEL}\[contains(text(), "columns")]
${LAB MENU}       css:.lm-Menu

*** Test Cases ***
Diagnostics Panel Opens
    Capture Page Screenshot    03-panel-opens.png
    Wait Until Keyword Succeeds    10 x    1s    Should Have Expected Rows Count    ${EXPECTED_COUNT}

Diagnostics Panel Works After Rename
    [Documentation]    Test for #141 bug (diagnostics were not cleared after rename)
    Rename Jupyter File    Panel.ipynb    PanelRenamed.ipynb
    Close Diagnostics Panel
    Wait Until Page Contains Element    css:.cm-lsp-diagnostic[title*="${DIAGNOSTIC}"]    timeout=20s
    Capture Page Screenshot    00-panel-rename.png
    Open Diagnostics Panel
    Capture Page Screenshot    01-panel-rename.png
    Wait Until Keyword Succeeds    10 x    1s    Should Have Expected Rows Count    ${EXPECTED_COUNT}
    Clean Up After Working With Files    PanelRenamed.ipynb

Diagnostics Panel Can Be Restored
    Close Diagnostics Panel
    Open Diagnostics Panel
    Wait Until Keyword Succeeds    10 x    1s    Should Have Expected Rows Count    ${EXPECTED_COUNT}

Columns Can Be Hidden
    Wait Until Keyword Succeeds    10 x    1s    Element Should Contain    ${DIAGNOSTICS PANEL}    ${DIAGNOSTIC MESSAGE}
    Open Context Menu Over    css:.lsp-diagnostics-listing th
    Capture Page Screenshot    01-menu-visible.png
    Expand Menu Entry    columns
    Select Menu Entry    Message
    Capture Page Screenshot    03-message-column-toggled.png
    Wait Until Keyword Succeeds    10 x    1s    Element Should Not Contain    ${DIAGNOSTICS PANEL}    ${DIAGNOSTIC MESSAGE}

Diagnostics Can Be Ignored By Code
    Wait Until Keyword Succeeds    10 x    1s    Should Have Expected Rows Count    1
    Open Context Menu Over    css:.lsp-diagnostics-listing tbody tr
    Expand Menu Entry    Ignore diagnostics
    Select Menu Entry    code
    Open in Advanced Settings    ${DIAGNOSTICS PLUGIN ID}
    Capture Page Screenshot    02-code-pressed.png
    Wait Until Keyword Succeeds    10 x    1s    Should Have Expected Rows Count    0

Diagnostics Can Be Ignored By Message
    Wait Until Keyword Succeeds    10 x    1s    Should Have Expected Rows Count    1
    Open Context Menu Over    css:.lsp-diagnostics-listing tbody tr
    Expand Menu Entry    Ignore diagnostics
    Capture Page Screenshot    02-menu-visible.png
    Select Menu Entry    Ignore diagnostics with "W291 trailing whitespace" message
    Open in Advanced Settings    ${DIAGNOSTICS PLUGIN ID}
    Capture Page Screenshot    02-message-pressed.png
    Wait Until Keyword Succeeds    10 x    1s    Should Have Expected Rows Count    0

Diagnostic Message Can Be Copied
    Wait Until Keyword Succeeds    10 x    1s    Element Should Contain    ${DIAGNOSTICS PANEL}    ${DIAGNOSTIC MESSAGE}
    Open Context Menu Over    css:.lsp-diagnostics-listing tbody tr
    Select Menu Entry    Copy diagnostic
    Close Diagnostics Panel
    Wait Until Element Contains    css:.lsp-statusbar-item    Successfully copied    timeout=10s

*** Keywords ***
Expand Menu Entry
    [Arguments]    ${label}
    ${entry} =    Set Variable    ${JLAB XP MENU ITEM LABEL}\[contains(text(), "${label}")]
    Wait Until Page Contains Element    ${entry}    timeout=10s
    ${menus before} =    Get Element Count    ${LAB MENU}
    Mouse Over    ${entry}
    ${expected menus} =    Evaluate    ${menus before} + 1
    Wait Until Keyword Succeeds    10 x    1s    Menus Count Equal    ${expected menus}

Menus Count Equal
    [Arguments]    ${count}
    ${menus count} =    Get Element Count    ${LAB MENU}
    Should Be Equal    ${menus count}    ${count}

Select Menu Entry
    [Arguments]    ${label}
    ${entry}    Set Variable    ${JLAB XP MENU ITEM LABEL}\[contains(text(), '${label}')]
    Wait Until Page Contains Element    ${entry}    timeout=10s
    Mouse Over    ${entry}
    Click Element    ${entry}
    Wait Until Page Does Not Contain Element    ${entry}    timeout=10s

Open Notebook And Panel
    [Arguments]    ${notebook}
    Setup Notebook    Python    ${notebook}
    Capture Page Screenshot    00-notebook-and-panel-opening.png
    Wait Until Page Contains Element    css:.cm-lsp-diagnostic[title*="${DIAGNOSTIC}"]    timeout=20s
    Open Diagnostics Panel
    Capture Page Screenshot    00-notebook-and-panel-opened.png

Should Have Expected Rows Count
    [Arguments]    ${expected_count}
    ${count} =    Count Diagnostics In Panel
    Should Be True    ${count} == ${expected_count}

Set Up Diagnostic Panel Test
    Gently Reset Workspace
    Open Notebook And Panel    Panel.ipynb

Clean Up Diagnostic Panel Test
    Clean Up After Working With Files    Panel.ipynb
    Reset Plugin Settings
    Reset Application State
