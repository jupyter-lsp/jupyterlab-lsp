*** Settings ***
Suite Setup       Setup Suite For Screenshots    highlights
Test Setup        Setup Highlights Test
Test Teardown     Clean Up After Working With File    Highlights.ipynb
Force Tags        feature:highlights
Resource          ../Keywords.robot

*** Test Cases ***
# cursor is symbolized by pipe (|), for example when
# it is at the end of line, after `1` in `test = 1`
# it is presented as: `test = 1|`
Highlights work at the start of a token
    Enter Cell Editor    1    line=1
    Press Keys    None    END    # cursor to the end of first line (`test = 1|`)
    Should Not Highlight Any Tokens
    Press Keys    None    HOME    # cursor before the token (`|test = 1`)
    Should Highlight Token    test
    Should Not Highlight Token    gist

Highlights work at the end of a token
    Enter Cell Editor    1    line=1
    Press Keys    None    END    # cursor to the end of first line (`test = 1|`)
    Press Keys    None    DOWN    # cursor to the end of the token in second line (`test`)
    Should Highlight Token    test
    Should Not Highlight Token    gist

Highlights are changed when moving cursor between cells
    [Documentation]    GH431
    Enter Cell Editor    1    line=2
    Press Keys    None    END    # cursor after the token in second line (`test|`)
    Should Highlight Token    test
    Should Not Highlight Token    gist
    Press Keys    None    DOWN    # cursor to next cell, which is empty
    Should Not Highlight Any Tokens
    Press Keys    None    DOWN    # cursor to third cell (`|gist = 1`)
    Should Highlight Token    gist
    Press Keys    None    DOWN    # cursor to third cell, second line (`|test `)
    Should Highlight Token    test

Highlights are modified after typing
    Enter Cell Editor    1    line=2
    Press Keys    None    END    # cursor after the token in second line (`test|`)
    Should Highlight Token    test
    Press Keys    None    a    # cursor after the token in second line (`testa|`)
    Should Highlight Token    testa

Highlights are removed when no cell is focused
    # Remove when turned on
    Configure JupyterLab Plugin    {"removeOnBlur": true}    plugin id=${HIGHLIGHTS PLUGIN ID}
    Enter Cell Editor    1    line=2
    Should Highlight Token    test
    Blur Cell Editor    1
    Should Not Highlight Any Tokens
    # Do not remove when turned off
    Configure JupyterLab Plugin    {"removeOnBlur": false}    plugin id=${HIGHLIGHTS PLUGIN ID}
    Enter Cell Editor    1    line=2
    Should Highlight Token    test
    Blur Cell Editor    1
    Should Highlight Token    test

*** Keywords ***
Should Not Highlight Any Tokens
    Page Should Not Contain    css:.cm-lsp-highlight

Should Highlight Token
    [Arguments]    ${token}    ${timeout}=15s
    ${token_element} =    Set Variable    xpath://span[contains(@class, 'cm-lsp-highlight')][contains(text(), '${token}')]
    Wait Until Page Contains Element    ${token_element}    timeout=${timeout}

Should Not Highlight Token
    [Arguments]    ${token}    ${timeout}=15s
    ${token_element} =    Set Variable    xpath://span[contains(@class, 'cm-lsp-highlight')][contains(text(), '${token}')]
    Wait Until Page Does Not Contain Element    ${token_element}    timeout=${timeout}

Setup Highlights Test
    Setup Notebook    Python    Highlights.ipynb

Blur Cell Editor
    [Arguments]    ${cell_nr}
    Click Element    css:.jp-Cell:nth-child(${cell_nr}) .jp-InputPrompt
