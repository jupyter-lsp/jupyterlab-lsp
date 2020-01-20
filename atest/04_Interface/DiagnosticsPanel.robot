*** Settings ***
Suite Setup       Setup Suite For Screenshots    diagnostics_panel
Resource          ../Keywords.robot

*** Variables ***
${EXPECTED_COUNT}    1
${DIAGNOSTIC}     W291 trailing whitespace (pycodestyle)
${DIAGNOSTIC MESSAGE}    trailing whitespace
${MENU COLUMNS}    xpath://div[contains(@class, 'p-Menu-itemLabel')][contains(text(), "columns")]
${MENU COLUMN MESSAGE}    xpath://div[contains(@class, 'p-Menu-itemLabel')][contains(text(), "Message")]

*** Test Cases ***
Diagnostics Panel Opens
    [Setup]    Gently Reset Workspace
    Open Notebook And Panel    Panel.ipynb
    Capture Page Screenshot    03-panel-opens.png
    Wait Until Keyword Succeeds    10 x    1s    Should Have Expected Rows Count
    [Teardown]    Clean Up After Working With File    Panel.ipynb

Diagnostics Panel Works After Rename
    [Documentation]    Test for #141 bug (diagnostics were not cleared after rename)
    [Setup]    Gently Reset Workspace
    Open Notebook And Panel    Panel.ipynb
    Rename Jupyter File    Panel.ipynb    PanelRenamed.ipynb
    Close Diagnostics Panel
    Wait Until Page Contains Element    css:.cm-lsp-diagnostic[title*="${DIAGNOSTIC}"]    timeout=20s
    Capture Page Screenshot    00-panel-rename.png
    Open Diagnostics Panel
    Capture Page Screenshot    01-panel-rename.png
    Wait Until Keyword Succeeds    10 x    1s    Should Have Expected Rows Count
    Clean Up After Working With File    PanelRenamed.ipynb
    [Teardown]    Clean Up After Working With File    Panel.ipynb

Diagnostics Panel Can Be Restored
    [Setup]    Gently Reset Workspace
    Open Notebook And Panel    Panel.ipynb
    Close Diagnostics Panel
    Open Diagnostics Panel
    Wait Until Keyword Succeeds    10 x    1s    Should Have Expected Rows Count
    [Teardown]    Clean Up After Working With File    Panel.ipynb

Columns Can Be Hidden
    [Setup]    Gently Reset Workspace
    Open Notebook And Panel    Panel.ipynb
    Wait Until Keyword Succeeds    10 x    1s    Element Should Contain    ${DIAGNOSTICS PANEL}    ${DIAGNOSTIC MESSAGE}
    Open Context Menu Over    css:.lsp-diagnostics-listing th
    Capture Page Screenshot    01-menu-visible.png
    Mouse Over    ${MENU COLUMNS}
    Wait Until Page Contains Element    ${MENU COLUMN MESSAGE}    timeout=10s
    Mouse Over    ${MENU COLUMN MESSAGE}
    Capture Page Screenshot    02-message-column-visible.png
    Click Element    ${MENU COLUMN MESSAGE}
    Capture Page Screenshot    03-message-column-toggled.png
    Wait Until Keyword Succeeds    10 x    1s    Element Should Not Contain    ${DIAGNOSTICS PANEL}    ${DIAGNOSTIC MESSAGE}
    [Teardown]    Clean Up After Working With File    Panel.ipynb

*** Keywords ***
Open Notebook And Panel
    [Arguments]    ${notebook}
    Setup Notebook    Python    ${notebook}
    Capture Page Screenshot    00-notebook-and-panel-openeing.png
    Wait Until Page Contains Element    css:.cm-lsp-diagnostic[title*="${DIAGNOSTIC}"]    timeout=20s
    Open Diagnostics Panel
    Capture Page Screenshot    00-notebook-and-panel-opened.png

Should Have Expected Rows Count
    ${count} =    Count Diagnostics In Panel
    Should Be True    ${count} == ${EXPECTED_COUNT}
