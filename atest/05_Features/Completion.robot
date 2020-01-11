*** Settings ***
Suite Setup       Setup Suite For Screenshots    completion
Resource          ../Keywords.robot

*** Variables ***
${STATUSBAR}      css:div.lsp-statusbar-item
${COMPLETER_BOX}    css:.jp-Completer.jp-HoverBox

*** Test Cases ***
Works With Kernel Running
    [Documentation]    The suggestions from kernel and LSP should get integrated.
    Setup Notebook    Python    Completion.ipynb
    Wait Until Element Contains    ${STATUSBAR}    Fully initialized    timeout=20s
    Enter Cell Editor    1    line=2
    Capture Page Screenshot    01-entered-cell.png
    Trigger Completer
    Capture Page Screenshot    02-completions-shown.png
    # lowercase and uppercase suggestions:
    Completer Should Suggest    TabError
    # this comes from LSP:
    Completer Should Suggest    test
    # this comes from kernel
    Completer Should Suggest    %%timeit
    Press Keys    None    ENTER
    Capture Page Screenshot    03-completion-confirmed.png
    ${content} =    Get Cell Editor Content    1
    Should Contain    ${content}    TabError
    [Teardown]    Clean Up After Working With File    Completion.ipynb

Works When Kernel Is Shut Down
    Setup Notebook    Python    Completion.ipynb
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
    [Teardown]    Clean Up After Working With File    Completion.ipynb

Autocompletes If Only One Option
    Setup Notebook    Python    Completion.ipynb
    Enter Cell Editor    3    line=1
    Press Keys    None    cle
    Press Keys    None    TAB
    Wait Until Keyword Succeeds    20x    0.5s    Cell Editor Should Equal    3    list.clear
    [Teardown]    Clean Up After Working With File    Completion.ipynb

*** Keywords ***
Enter Cell Editor
    [Arguments]    ${cell_nr}    ${line}=1
    Click Element    css:.jp-CodeCell:nth-child(${cell_nr}) .CodeMirror-line:nth-child(${line})
    Wait Until Page Contains Element    css:.jp-CodeCell:nth-child(${cell_nr}) .CodeMirror-focused

Get Cell Editor Content
    [Arguments]    ${cell_nr}
    ${content}    Execute JavaScript    return document.querySelector('.jp-CodeCell:nth-child(${cell_nr}) .CodeMirror').CodeMirror.getValue()
    [Return]    ${content}

Cell Editor Should Equal
    [Arguments]    ${cell}    ${value}
    ${content} =    Get Cell Editor Content    ${cell}
    Should Be Equal    ${content}    ${value}

Completer Should Suggest
    [Arguments]    ${text}
    Page Should Contain Element    ${COMPLETER_BOX} .jp-Completer-item[data-value="${text}"]

Completer Should Not Suggest
    [Arguments]    ${text}
    Page Should Not Contain Element    ${COMPLETER_BOX} .jp-Completer-item[data-value="${text}"]

Trigger Completer
    Press Keys    None    TAB
    Wait Until Page Contains Element    ${COMPLETER_BOX}    timeout=6s
