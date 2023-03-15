*** Settings ***
Resource            ../Keywords.resource
Library             ../mouse_over_extension.py

Suite Setup         Setup Suite For Screenshots    hover
Test Setup          Setup Hover Test
Test Teardown       Clean Up After Working With File    Hover.ipynb

Test Tags           feature:hover


*** Variables ***
${HOVER_BOX}        css:.lsp-hover
${HOVER_SIGNAL}     css:.cm-lsp-hover-available


*** Test Cases ***
Hover Does Not Trigger Automatically
    Enter Cell Editor    1
    ${sel} =    Last Occurrence    python_add
    Configure JupyterLab Plugin    {"autoActivate": false}
    ...    plugin id=${HOVER PLUGIN ID}
    Trigger Automatically By Hover    ${sel}
    Sleep    1s
    Element Text Should Be    ${HOVER_SIGNAL}    python_add
    Page Should Not Contain Element    ${HOVER_BOX}

Hover Triggers Automatically
    Enter Cell Editor    1
    ${sel} =    Last Occurrence    python_add
    Configure JupyterLab Plugin    {"delay": 100, "autoActivate": true}
    ...    plugin id=${HOVER PLUGIN ID}
    Trigger Automatically By Hover    ${sel}
    Wait Until Keyword Succeeds    4x    0.1s    Page Should Contain Element    ${HOVER_BOX}

Hover works in notebooks
    Enter Cell Editor    1
    Trigger Tooltip    python_add
    Element Text Should Be    ${HOVER_SIGNAL}    python_add
    Capture Page Screenshot    02-hover-shown.png
    Element Should Contain    ${HOVER_BOX}    python_add(a: int, b: int)
    # syntax highlight should work
    Page Should Contain Element    ${HOVER_BOX} code.language-python
    # testing multi-element responses
    Element Should Contain    ${HOVER_BOX}    Add documentation
    # it should be possible to move the mouse over the tooltip in order to copy/scroll
    Mouse Over    ${HOVER_BOX}

Hover can be triggered via modifier key once cursor stopped moving
    Enter Cell Editor    1
    ${element} =    Last Occurrence    python_add
    Wait Until Keyword Succeeds    5x    0.1 s    Trigger Via Modifier Key Press    ${element}

Hover works in foreign code (javascript)
    Enter Cell Editor    2
    Trigger Tooltip    js_add
    Capture Page Screenshot    02-hover-shown.png
    Element Should Contain    ${HOVER_BOX}    function js_add(a: any, b: any): any
    Page Should Contain Element    ${HOVER_BOX} code.language-typescript
    # should be hidden once moving the mouse away
    Mouse Over    ${STATUSBAR}
    Page Should Not Contain Element    ${HOVER_BOX}
    Page Should Not Contain Element    ${HOVER_SIGNAL}
    # also for multiple cells of the same document
    Enter Cell Editor    3
    Trigger Tooltip    Math
    Element Should Contain    ${HOVER_BOX}    Math: Math

Update hover after character deletion
    Enter Cell Editor    4
    Trigger Tooltip    atan2
    Element Text Should Be    ${HOVER_SIGNAL}    atan2
    Capture Page Screenshot    01-hover-before-delection.png
    Element Should Contain    ${HOVER_BOX}    atan2(y: SupportsFloat, x: SupportsFloat, /)
    Place Cursor In Cell Editor At    4    line=2    character=13
    Press Keys    None    DELETE
    Trigger Tooltip    atan
    Element Text Should Be    ${HOVER_SIGNAL}    atan
    Capture Page Screenshot    02-hover-after-delection.png
    Element Should Contain    ${HOVER_BOX}    atan(x: SupportsFloat, /)


*** Keywords ***
Last Occurrence
    [Arguments]    ${symbol}
    ${sel} =    Set Variable If    "${symbol}".startswith(("xpath", "css"))    ${symbol}
    ...    xpath:(//span[@role="presentation"][contains(., "${symbol}")])[last()]
    RETURN    ${sel}

Trigger Automatically By Hover
    [Arguments]    ${sel}
    # bring the cursor to the element
    Wokraround Visibility Problem    ${sel}
    Mouse Over    ${sel}
    Wait Until Page Contains Element    ${HOVER_SIGNAL}    timeout=10s
    Mouse Over And Wiggle    ${sel}    5

Trigger Via Hover With Modifier
    [Arguments]    ${sel}
    # bring the cursor to the element
    Wokraround Visibility Problem    ${sel}
    Mouse Over    ${sel}
    # move it back and forth (wiggle) while hodling the ctrl modifier
    Mouse Over With Control    ${sel}    x_wiggle=5
    Wait Until Keyword Succeeds    4x    0.1s    Page Should Contain Element    ${HOVER_BOX}

Trigger Via Modifier Key Press
    [Arguments]    ${sel}
    # bring the cursor to the element
    Wokraround Visibility Problem    ${sel}
    Mouse Over    ${sel}
    Wait Until Page Contains Element    ${HOVER_SIGNAL}    timeout=10s
    Mouse Over And Wiggle    ${sel}    5
    Press Keys    ${sel}    CTRL
    Wait Until Keyword Succeeds    4x    0.1s    Page Should Contain Element    ${HOVER_BOX}

Trigger Tooltip
    [Documentation]    The default way to trigger the hover tooltip
    [Arguments]    ${symbol}
    ${sel} =    Last Occurrence    ${symbol}
    Wait Until Keyword Succeeds    4x    0.1 s    Trigger Via Hover With Modifier    ${sel}

Setup Hover Test
    Setup Notebook    Python    Hover.ipynb

Wokraround Visibility Problem
    [Arguments]    ${sel}
    ${width}    ${height} =    Get Element Size    ${sel}
    IF    ${width} == 0    Cover Element    ${sel}
