*** Settings ***
Resource            ../../_resources/Keywords.resource

Suite Setup         Setup Suite For Screenshots    syntax_highlighting
Test Setup          Setup Highlighting Test
Test Teardown       Clean Up After Working With File    Syntax highlighting.ipynb

Test Tags           feature:syntax_highlighting


*** Test Cases ***
Syntax Highlighting Mode Stays Normal In Normal Cells
    ${mode} =    Get Mode Of A Cell    1
    should be equal    ${mode}    python

Syntax Highlighting Mode Changes In Cells Dominated By Foreign Documents
    ${mode} =    Get Mode Of A Cell    2
    should be equal    ${mode}    markdown
    ${mode} =    Get Mode Of A Cell    3
    should be equal    ${mode}    html
    ${mode} =    Get Mode Of A Cell    4
    should be equal    ${mode}    javascript

Highlighing Mode Works For Multiple Documents
    ${mode} =    Get Mode Of A Cell    4
    should be equal    ${mode}    javascript
    ${mode} =    Get Mode Of A Cell    6
    should be equal    ${mode}    javascript

Highlighting Mode Changes Back And Forth After Edits
    ${mode} =    Get Mode Of A Cell    2
    should be equal    ${mode}    markdown
    Enter Cell Editor    2    line=1
    Press Keys    None    BACKSPACE
    Capture Page Screenshot    backapse.png
    wait until keyword succeeds    5x    2s    Mode Of A Cell Should Equal    2    python
    Enter Cell Editor    2    line=1
    Press Keys    None    n
    wait until keyword succeeds    5x    2s    Mode Of A Cell Should Equal    2    markdown


*** Keywords ***
Get Mode Of A Cell
    [Arguments]    ${cell_number}
    Click Element    css:.jp-Cell:nth-child(${cell_number})
    Wait Until Page Contains Element    css:.jp-Cell:nth-child(${cell_number}) .cm-focused
    ${mode} =    Execute JavaScript
    ...    return document.querySelector('.jp-Cell:nth-child(${cell_number}) .cm-content').dataset.language
    RETURN    ${mode}

Setup Highlighting Test
    Setup Notebook    Python    Syntax highlighting.ipynb

Mode Of A Cell Should Equal
    [Arguments]    ${cell_number}    ${expected_mode}
    ${mode} =    Get Mode Of A Cell    ${cell_number}
    should be equal    ${mode}    ${expected_mode}
