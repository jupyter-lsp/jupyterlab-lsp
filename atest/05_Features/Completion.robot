*** Settings ***
Suite Setup       Setup Suite For Screenshots    completion
Test Setup        Setup Completion Test
Test Teardown     Clean Up After Working With File    Completion.ipynb
Force Tags        feature:completion
Resource          ../Keywords.robot

*** Variables ***
${COMPLETER_BOX}    css:.jp-Completer.jp-HoverBox

*** Test Cases ***
Works With Kernel Running
    [Documentation]    The suggestions from kernel and LSP should get integrated.
    Enter Cell Editor    1    line=2
    Capture Page Screenshot    01-entered-cell.png
    Trigger Completer
    Capture Page Screenshot    02-completions-shown.png
    # lowercase and uppercase suggestions:
    Completer Should Suggest    TabError
    # this comes from LSP:
    Completer Should Suggest    test
    # this comes from kernel; sometimes the kernel response may come a bit later
    Wait Until Keyword Succeeds    20x    0.5s    Completer Should Suggest    %%timeit
    Press Keys    None    ENTER
    Capture Page Screenshot    03-completion-confirmed.png
    ${content} =    Get Cell Editor Content    1
    Should Contain    ${content}    TabError

Works When Kernel Is Shut Down
    Lab Command    Shut Down All Kernels…
    Capture Page Screenshot    01-shutting-kernels.png
    Accept Default Dialog Option
    Capture Page Screenshot    02-kernels-shut.png
    Enter Cell Editor    1    line=2
    Trigger Completer
    Capture Page Screenshot    03-completions-shown.png
    # this comes from LSP:
    Completer Should Suggest    test
    # this comes from kernel:
    Completer Should Not Suggest    %%timeit

Autocompletes If Only One Option
    Enter Cell Editor    3    line=1
    Press Keys    None    cle
    Wait Until Fully Initialized
    # First tab brings up the completer
    Press Keys    None    TAB
    Completer Should Suggest    clear
    # Second tab inserts the only suggestion
    Press Keys    None    TAB
    # depends on Python list type having only one method with prefix "cle"
    Wait Until Keyword Succeeds    40x    0.5s    Cell Editor Should Equal    3    list.clear

Does Not Autocomplete If Multiple Options
    Enter Cell Editor    3    line=1
    Press Keys    None    c
    Wait Until Fully Initialized
    # First tab brings up the completer
    Press Keys    None    TAB
    Completer Should Suggest    copy
    # Second tab inserts should not insert the first of many choices.
    Press Keys    None    TAB
    # depends on Python list type having multiple methods with prefix "c"
    # in this case "Completer Should Suggest" means that the completer is still shown!
    Completer Should Suggest    copy

User Can Select Lowercase After Starting Uppercase
    # `from time import Tim<tab>` → `from time import time`
    Enter Cell Editor    5    line=1
    Trigger Completer
    Completer Should Suggest    time
    Press Keys    None    ENTER
    Wait Until Keyword Succeeds    40x    0.5s    Cell Editor Should Equal    5    from time import time

Mid Token Completions Do Not Overwrite
    # `disp<tab>data` → `display_table<cursor>data`
    Place Cursor In Cell Editor At    9    line=1    character=4
    Capture Page Screenshot    01-cursor-placed.png
    Trigger Completer
    Completer Should Suggest    display_table
    Select Completer Suggestion    display_table
    Capture Page Screenshot    02-completed.png
    Wait Until Keyword Succeeds    40x    0.5s    Cell Editor Should Equal    9    display_tabledata
    # `disp<tab>lay` → `display_table<cursor>`
    Place Cursor In Cell Editor At    11    line=1    character=4
    Trigger Completer
    Completer Should Suggest    display_table
    Select Completer Suggestion    display_table
    Wait Until Keyword Succeeds    40x    0.5s    Cell Editor Should Equal    11    display_table

Completion Works For Tokens Separated By Space
    # `from statistics <tab>` → `from statistics import<cursor>`
    Enter Cell Editor    13    line=1
    Trigger Completer
    Completer Should Suggest    import
    Press Keys    None    ENTER
    Wait Until Keyword Succeeds    40x    0.5s    Cell Editor Should Equal    13    from statistics import

Kernel And LSP Completions Merge Prefix Conflicts Are Resolved
    [Documentation]    Reconciliate Python kernel returning prefixed completions and LSP (pyls) not-prefixed ones
    # For more details see: https://github.com/krassowski/jupyterlab-lsp/issues/30#issuecomment-576003987
    # `import os.pat<tab>` → `import os.pathsep`
    Enter Cell Editor    15    line=1
    Trigger Completer
    Completer Should Suggest    pathsep
    Select Completer Suggestion    pathsep
    Wait Until Keyword Succeeds    40x    0.5s    Cell Editor Should Equal    15    import os.pathsep

Triggers Completer On Dot
    Enter Cell Editor    2    line=1
    Press Keys    None    .
    Wait Until Keyword Succeeds    10x    0.5s    Cell Editor Should Equal    2    list.
    Wait Until Page Contains Element    ${COMPLETER_BOX}    timeout=35s
    Completer Should Suggest    append

*** Keywords ***
Setup Completion Test
    Setup Notebook    Python    Completion.ipynb

Get Cell Editor Content
    [Arguments]    ${cell_nr}
    ${content}    Execute JavaScript    return document.querySelector('.jp-Cell:nth-child(${cell_nr}) .CodeMirror').CodeMirror.getValue()
    [Return]    ${content}

Cell Editor Should Equal
    [Arguments]    ${cell}    ${value}
    ${content} =    Get Cell Editor Content    ${cell}
    Should Be Equal    ${content}    ${value}

Select Completer Suggestion
    [Arguments]    ${text}
    ${suggestion} =    Set Variable    css:.jp-Completer-item[data-value="${text}"]
    Mouse Over    ${suggestion}
    Click Element    ${suggestion} code

Completer Should Suggest
    [Arguments]    ${text}
    Wait Until Page Contains Element    ${COMPLETER_BOX} .jp-Completer-item[data-value="${text}"]
    Capture Page Screenshot    ${text.replace(' ', '_')}.png

Completer Should Not Suggest
    [Arguments]    ${text}
    Wait Until Page Does Not Contain Element    ${COMPLETER_BOX} .jp-Completer-item[data-value="${text}"]

Trigger Completer
    Press Keys    None    TAB
    Wait Until Page Contains Element    ${COMPLETER_BOX}    timeout=35s
