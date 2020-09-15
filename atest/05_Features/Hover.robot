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
    Page Should Contain Element    ${HOVER_BOX} code.language-python
    Element Should Contain    ${HOVER_BOX}    Add documentation

Hover works in foreign code (javascript)
    Enter Cell Editor    2
    Hover Over    js_add
    Capture Page Screenshot    02-hover-shown.png
    Element Should Contain    ${HOVER_BOX}    function js_add(a: any, b: any): any
    Page Should Contain Element    ${HOVER_BOX} code.language-typescript
    # also for multiple cells of the same document
    Hover Over    Math
    Element Should Contain    ${HOVER_BOX}    const Math: Math

*** Keywords ***
Hover Over
    [Arguments]    ${symbol}
    ${sel} =    Set Variable If    "${symbol}".startswith(("xpath", "css"))    ${symbol}    xpath:(//span[@role="presentation"][contains(., "${symbol}")])[last()]
    Wait Until Keyword Succeeds    10 x    0.1 s    Trigger Tooltip    ${sel}

Trigger Tooltip
    [Arguments]    ${sel}
    Wait Until Keyword Succeeds    10 x    0.1 s    Mouse Over    ${sel}
    Wait Until Page Contains Element    ${HOVER_SIGNAL}
    Press Keys    None    CTRL
    Wait Until Keyword Succeeds    20x    0.5s    Page Should Contain Element    ${HOVER_BOX}

Setup Hover Test
    Setup Notebook    Python    Hover.ipynb
