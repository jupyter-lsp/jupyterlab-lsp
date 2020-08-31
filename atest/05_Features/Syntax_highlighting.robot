*** Settings ***
Suite Setup       Setup Suite For Screenshots    syntax_highlighting
Test Setup        Setup Highlighting Test
Test Teardown     Clean Up After Working With File    Syntax highlighting.ipynb
Force Tags        feature:syntax_highlighting
Resource          ../Keywords.robot

*** Test Cases ***
Syntax Highlighting Mode Stays Normal In Normal Cells
    ${mode} =    Get Mode Of A Cell    1
    should be equal    ${mode['name']}    ipython

Syntax Highlighting Mode Changes In Cells Dominated By Foreign Documents
    ${mode} =    Get Mode Of A Cell    2
    should be equal    ${mode['name']}    markdown
    ${mode} =    Get Mode Of A Cell    3
    should be equal    ${mode['name']}    xml
    ${mode} =    Get Mode Of A Cell    4
    should be equal    ${mode['name']}    javascript

Highlighing Mode Works For Multiple Documents
    ${mode} =    Get Mode Of A Cell    4
    should be equal    ${mode['name']}    javascript
    ${mode} =    Get Mode Of A Cell    6
    should be equal    ${mode['name']}    javascript

*** Keywords ***
Get Mode Of A Cell
    [Arguments]    ${cell_nr}
    Click Element    css:.jp-Cell:nth-child(${cell_nr})
    Wait Until Page Contains Element    css:.jp-Cell:nth-child(${cell_nr}) .CodeMirror-focused
    ${mode} =    Execute JavaScript    return document.querySelector('.jp-Cell:nth-child(${cell_nr}) .CodeMirror').CodeMirror.getMode()
    [Return]    ${mode}

Setup Highlighting Test
    Setup Notebook    Python    Syntax highlighting.ipynb
