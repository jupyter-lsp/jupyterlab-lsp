*** Settings ***
Resource            ../../_resources/Keywords.resource

Suite Setup         Setup Suite For Screenshots    diagnostics_panel
Test Setup          Set Up
Test Teardown       Clean Up

Test Tags           ui:notebook    aspect:ls:features


*** Variables ***
${DIAGNOSTIC MESSAGE R}     Opening curly braces should never go on their own line
${DIAGNOSTIC MESSAGE}       trailing whitespace
${DIAGNOSTIC}               W291 trailing whitespace (pycodestyle)
${EXPECTED_COUNT}           4
${MENU COLUMNS}             xpath://div[contains(@class, 'lm-Menu-itemLabel')][contains(text(), "columns")]


*** Test Cases ***
Diagnostics Panel Opens
    Capture Page Screenshot    03-panel-opens.png
    Wait Until Keyword Succeeds    10 x    1s    Should Have Expected Rows Count    ${EXPECTED_COUNT}

Diagnostics Panel Works After Rename
    [Documentation]    Test for #141 bug (diagnostics were not cleared after rename)
    Rename Jupyter File    Panel.ipynb    PanelRenamed.ipynb
    Close Diagnostics Panel
    Wait Until Page Contains Diagnostic    [title*="${DIAGNOSTIC}"]    timeout=20s
    Capture Page Screenshot    00-panel-rename.png
    Open Diagnostics Panel
    Capture Page Screenshot    01-panel-rename.png
    Wait Until Keyword Succeeds    10 x    1s    Should Have Expected Rows Count    ${EXPECTED_COUNT}
    Clean Up After Working With File    PanelRenamed.ipynb

Diagnostics Panel Works After Kernel Restart
    [Documentation]    Test for #475 bug
    Close Diagnostics Panel
    Restart Kernel
    Wait Until Page Contains Diagnostic    [title*="${DIAGNOSTIC}"]    timeout=20s
    Open Diagnostics Panel
    Wait Until Keyword Succeeds    10 x    1s    Should Have Expected Rows Count    ${EXPECTED_COUNT}

Diagnostics Panel Can Be Restored
    Close Diagnostics Panel
    Open Diagnostics Panel
    Wait Until Keyword Succeeds    10 x    1s    Should Have Expected Rows Count    ${EXPECTED_COUNT}

Columns Can Be Hidden
    Wait Until Keyword Succeeds    10 x    1s    Element Should Contain    ${DIAGNOSTICS PANEL}
    ...    ${DIAGNOSTIC MESSAGE}
    Open Context Menu Over    css:.lsp-diagnostics-listing th:nth-child(1)
    Capture Page Screenshot    01-menu-visible.png
    Expand Menu Entry    columns
    Capture Page Screenshot    03-message-column-on.png
    Select Menu Entry    Message
    # TODO: restore this test - it seems fine locally
    Skip
    Wait Until Keyword Succeeds    10 x    1s    Element Should Not Contain    ${DIAGNOSTICS PANEL}
    ...    ${DIAGNOSTIC MESSAGE}

Can Sort By Cell
    # https://github.com/jupyter-lsp/jupyterlab-lsp/issues/707
    Wait Until Keyword Succeeds    10 x    1s    Element Should Contain    ${DIAGNOSTICS PANEL}
    ...    ${DIAGNOSTIC MESSAGE}
    Click Element    css:.lsp-diagnostics-listing th[data-id="Line:Ch"]
    Table Cell Should Equal    Line:Ch    row=1    column=-1
    Table Cell Should Equal    0:0    row=2    column=-1
    Table Cell Should Equal    0:8    row=3    column=-1
    Table Cell Should Equal    1:0    row=4    column=-1
    Table Cell Should Equal    1:4    row=5    column=-1
    Click Element    css:.lsp-diagnostics-listing th[data-id="Line:Ch"]
    Table Cell Should Equal    1:4    row=2    column=-1

Diagnostics Can Be Ignored By Code
    Wait Until Keyword Succeeds    10 x    1s    Should Have Expected Rows Count    ${EXPECTED_COUNT}
    # W291 should be shown twice, lets try to hide it
    ${EXPECTED_AFTER} =    Evaluate    ${EXPECTED_COUNT}-2
    Open Context Menu Over W291
    Expand Menu Entry    Ignore diagnostics
    Select Menu Entry    code
    Wait Until Keyword Succeeds    10 x    1s    Should Have Expected Rows Count    ${EXPECTED_AFTER}
    Configure JupyterLab Plugin    {}    plugin id=${DIAGNOSTICS PLUGIN ID}

Diagnostics Can Be Ignored By Message
    Wait Until Keyword Succeeds    10 x    1s    Should Have Expected Rows Count    ${EXPECTED_COUNT}
    # W291 should be shown twice, lets try to hide it
    ${EXPECTED_AFTER} =    Evaluate    ${EXPECTED_COUNT}-2
    Open Context Menu Over W291
    Expand Menu Entry    Ignore diagnostics
    Capture Page Screenshot    02-menu-visible.png
    Select Menu Entry    Ignore diagnostics with "W291 trailing whitespace" message
    Wait Until Keyword Succeeds    10 x    1s    Should Have Expected Rows Count    ${EXPECTED_AFTER}
    Configure JupyterLab Plugin    {}    plugin id=${DIAGNOSTICS PLUGIN ID}

Diagnostic Message Can Be Copied
    Wait Until Keyword Succeeds    10 x    1s    Element Should Contain    ${DIAGNOSTICS PANEL}
    ...    ${DIAGNOSTIC MESSAGE}
    Open Context Menu Over    css:.lsp-diagnostics-listing tbody tr
    Select Menu Entry    Copy diagnostic
    Close Diagnostics Panel
    Wait Until Element Contains    css:.jp-toast-message    Successfully copied    timeout=10s

Diagnostics Panel Works After Removing Foreign Document
    Enter Cell Editor    2
    Lab Command    Insert Cell Below
    Enter Cell Editor    3
    Press Keys    None    %%R\n
    # these two steps ideally would not be needed (they show that for slow-starting server
    # update may not be triggered until user manually makes another action).
    Wait Until Fully Initialized
    Press Keys    None    {}
    Wait Until Keyword Succeeds    10 x    1s    Element Should Contain    ${DIAGNOSTICS PANEL}
    ...    ${DIAGNOSTIC MESSAGE}
    Sleep    5
    Wait Until Keyword Succeeds    10 x    1s    Element Should Contain    ${DIAGNOSTICS PANEL}
    ...    ${DIAGNOSTIC MESSAGE R}
    Lab Command    Delete Cell
    # regain focus by entering cell
    Enter Cell Editor    2
    # trigger 7 document updates to trigger the garbage collector that removes unused documents
    # (search for VirtualDocument.remainingLifetime for more)
    Press Keys    None    1234567
    Wait Until Keyword Succeeds    10 x    1s    Element Should Contain    ${DIAGNOSTICS PANEL}
    ...    ${DIAGNOSTIC MESSAGE}
    Wait Until Keyword Succeeds    10 x    1s    Element Should Not Contain    ${DIAGNOSTICS PANEL}
    ...    ${DIAGNOSTIC MESSAGE R}
    # it should be possible to get the diagnostic back after re-creatign the cell
    Lab Command    Insert Cell Below
    Enter Cell Editor    3
    Press Keys    None    %%R\n{}
    Wait Until Keyword Succeeds    10 x    1s    Element Should Contain    ${DIAGNOSTICS PANEL}
    ...    ${DIAGNOSTIC MESSAGE}
    Wait Until Keyword Succeeds    10 x    1s    Element Should Contain    ${DIAGNOSTICS PANEL}
    ...    ${DIAGNOSTIC MESSAGE R}


*** Keywords ***
Open Context Menu Over W291
    Click Element    css:.lsp-diagnostics-listing th[data-id="Code"]
    Table Cell Should Equal    Code    row=1    column=2
    Table Cell Should Equal    W291    row=-1    column=2
    Open Context Menu Over    css:.lsp-diagnostics-listing tbody > tr:last-child

Open Notebook And Panel
    [Arguments]    ${notebook}
    Setup Notebook    Python    ${notebook}
    Capture Page Screenshot    00-notebook-and-panel-opening.png
    Wait Until Page Contains Diagnostic    [title*="${DIAGNOSTIC}"]    timeout=20s
    Open Diagnostics Panel
    Capture Page Screenshot    00-notebook-and-panel-opened.png

Should Have Expected Rows Count
    [Arguments]    ${expected_count}
    ${count} =    Count Diagnostics In Panel
    Should Be True    ${count} == ${expected_count}

Table Cell Should Equal
    [Arguments]    ${expected}    ${row}    ${column}
    ${cell} =    Get Table Cell    css:table.lsp-diagnostics-listing    ${row}    ${column}
    Should Be Equal As Strings    ${cell}    ${expected}

Set Up
    Gently Reset Workspace
    Open Notebook And Panel    Panel.ipynb

Clean Up
    Clean Up After Working With File    Panel.ipynb
    Reset Plugin Settings    plugin=diagnostics
    Reset Application State
