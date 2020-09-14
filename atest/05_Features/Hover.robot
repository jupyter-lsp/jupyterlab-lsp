*** Settings ***
Suite Setup       Setup Suite For Screenshots    hover
Test Setup        Setup Hover Test
Test Teardown     Clean Up After Working With File    Hover.ipynb
Force Tags        feature:hover
Resource          ../Keywords.robot

*** Variables ***
${HOVER_BOX}    css:.lsp-hover

*** Test Cases ***
Hover works in notebooks
    Hover Over  python_add
    Capture Page Screenshot    02-hover-shown.png
    Element Should Contain    ${HOVER_BOX}    python_add(a: int, b: int)
    Page Should Contain Element    ${HOVER_BOX} code.language-python

Hover works in foreign code (javascript)
    Hover Over  js_add
    Capture Page Screenshot    02-hover-shown.png
    Element Should Contain    ${HOVER_BOX}    function js_add(a: any, b: any): any
    Page Should Contain Element    ${HOVER_BOX} code.language-typescript
    # also for multiple cells of the same document
    Hover Over  Math
    Element Should Contain    ${HOVER_BOX}    const Math: Math

*** Keywords ***
Hover Over
    [Arguments]   ${symbol}
    ${sel} =    Set Variable If    "${symbol}".startswith(("xpath", "css"))    ${symbol}    xpath:(//span[@role="presentation"][contains(., "${symbol}")])[last()]
    Wait Until Keyword Succeeds    10 x    0.1 s    Mouse Over    ${sel}
    Press Keys   ${sel}    CTRL
    Wait Until Keyword Succeeds    20x    0.5s    Page Should Contain Element    ${HOVER_BOX}

Setup Hover Test
    Setup Notebook    Python    Hover.ipynb
