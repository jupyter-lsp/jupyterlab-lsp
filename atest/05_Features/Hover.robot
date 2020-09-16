*** Settings ***
Suite Setup       Setup Suite For Screenshots    hover
Test Setup        Setup Hover Test
Test Teardown     Clean Up After Working With File    Hover.ipynb
Force Tags        feature:hover
Resource          ../Keywords.robot

*** Variables ***
${HOVER_BOX}      css:.lsp-hover
${HOVER_SIGNAL}    css:.cm-lsp-hover-available

*** Test Cases ***
Hover works in notebooks
    Enter Cell Editor    1
    Hover Over    python_add
    Element Text Should Be    ${HOVER_SIGNAL}    python_add
    Capture Page Screenshot    02-hover-shown.png
    Element Should Contain    ${HOVER_BOX}    python_add(a: int, b: int)
    # syntax highlight should work
    Page Should Contain Element    ${HOVER_BOX} code.language-python
    # testing multi-element responses
    Element Should Contain    ${HOVER_BOX}    Add documentation
    # it should be possible to move the mouse over the tooltip in order to copy/scroll
    Mouse Over    ${HOVER_BOX}

Hover works in foreign code (javascript)
    Enter Cell Editor    2
    Hover Over    js_add
    Capture Page Screenshot    02-hover-shown.png
    Element Should Contain    ${HOVER_BOX}    function js_add(a: any, b: any): any
    Page Should Contain Element    ${HOVER_BOX} code.language-typescript
    # should be hidden once moving the mouse away
    Mouse Over    ${STATUSBAR}
    Page Should Not Contain Element    ${HOVER_BOX}
    Page Should Not Contain Element    ${HOVER_SIGNAL}
    # also for multiple cells of the same document
    Enter Cell Editor    3
    Hover Over    Math
    Element Should Contain    ${HOVER_BOX}    const Math: Math

*** Keywords ***
Hover Over
    [Arguments]    ${symbol}
    ${sel} =    Set Variable If    "${symbol}".startswith(("xpath", "css"))    ${symbol}    xpath:(//span[@role="presentation"][contains(., "${symbol}")])[last()]
    Wait Until Keyword Succeeds    2x    0.1 s    Trigger Tooltip    ${sel}

Trigger Tooltip
    [Arguments]    ${sel}
    Mouse Over    ${sel}
    Wait Until Page Contains Element    ${HOVER_SIGNAL}
    Click Element    ${sel}
    Press Keys    ${sel}    CTRL
    Wait Until Keyword Succeeds    2x    0.1s    Page Should Contain Element    ${HOVER_BOX}

Setup Hover Test
    Setup Notebook    Python    Hover.ipynb
