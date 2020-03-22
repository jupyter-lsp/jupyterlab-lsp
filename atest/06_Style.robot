*** Settings ***
Suite Setup       Setup Suite For Screenshots    style
Force Tags        ui:editor    aspect:style
Resource          Keywords.robot
Resource          Variables.robot
Library           Collections

*** Variables ***
${THEME NAMES}    ${EMPTY}

*** Test Cases ***
Light
    Screenshot Editor Themes with Lab Theme    JupyterLab Light

Dark
    Screenshot Editor Themes with Lab Theme    JupyterLab Dark

*** Keywords ***
Screenshot Editor Themes with Lab Theme
    [Arguments]    ${lab theme}    ${file}=example.py
    ${norm lab theme} =    Set Variable    ${lab theme.lower().replace(" ", "-")}
    Set Tags    theme:lab:${norm lab theme}
    Set Screenshot Directory    ${OUTPUT DIR}${/}style${/}${norm lab theme}
    Copy File    examples${/}${file}    ${OUTPUT DIR}${/}home${/}${file}
    Run Keyword If    "${THEME NAMES}" == ""    Wait Until Keyword Succeeds    3x    1s    Get Theme Names
    Lab Command    Use ${lab theme} Theme
    Try to Close All Tabs
    Open ${file} in ${MENU EDITOR}
    Capture Page Screenshot    00-opened.png
    FOR    ${editor theme}    IN    @{THEME NAMES}
        Capture Theme Screenshot    ${editor theme}
    END
    [Teardown]    Clean Up After Working With File    ${file}

Capture Theme Screenshot
    [Arguments]    ${editor theme}
    Change Editor Theme    ${editor theme}
    Wait Until Fully Initialized
    Wait Until Page Contains Element    css:.cm-lsp-diagnostic    timeout=20s
    Click the second Accumulate
    Capture Page Screenshot    ${editor theme.replace(' ', '-')}.png

Click the second Accumulate
    Click Element    xpath://span[text()\='accumulate'][2]

Change Editor Theme
    [Arguments]    ${editor theme}
    Open Editor Theme Menu
    ${sel} =    Set Variable    xpath://div[contains(@class, 'lm-Menu-itemLabel')][contains(text(), "${editor theme}")]
    Wait Until Page Contains Element    ${sel}
    Mouse Over    ${sel}
    Click Element    ${sel}

Open Editor Theme Menu
    Wait Until Page Contains Element    ${MENU SETTINGS}
    Mouse Over    ${MENU SETTINGS}
    Click Element    ${MENU SETTINGS}
    Wait Until Page Contains Element    ${MENU EDITOR THEME}
    Mouse Over    ${MENU EDITOR THEME}
    Click Element    ${MENU EDITOR THEME}

Get Theme Names
    Open Editor Theme Menu
    ${els} =    Get WebElements    css:[data-command\="codemirror:change-theme"]
    ${theme names} =    Create List
    FOR    ${element}    IN    @{els}
        Append To List    ${theme names}    ${element.text}
    END
    Set Suite Variable    ${THEME NAMES}    ${theme names}
