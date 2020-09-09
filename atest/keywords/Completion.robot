*** Settings ***
Resource          Common.robot

*** Keywords ***
Setup Completion Test
    Setup Notebook    Python    Completion.ipynb

Clean Up Completion Test
    Reset Plugin Settings
    Clean Up After Working With Files    Completion.ipynb    completion.py

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
    Wait Until Element Is Visible    ${suggestion}    timeout=10s
    Mouse Over    ${suggestion}
    Click Element    ${suggestion} code

Completer Should Suggest
    [Arguments]    ${text}
    Wait Until Page Contains Element    ${CSS COMPLETER BOX} .jp-Completer-item[data-value="${text}"]    timeout=10s
    Capture Page Screenshot    ${text.replace(' ', '_')}.png

Completer Should Include Icon
    [Arguments]    ${icon}
    Wait Until Page Contains Element    ${CSS COMPLETER BOX} svg[data-icon="${icon}"]

Completer Should Not Suggest
    [Arguments]    ${text}
    Wait Until Page Does Not Contain Element    ${CSS COMPLETER BOX} .jp-Completer-item[data-value="${text}"]

Trigger Completer
    Press Keys    None    TAB
    Wait Until Page Contains Element    ${CSS COMPLETER BOX}    timeout=35s
