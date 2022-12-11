*** Settings ***
Resource        Keywords.resource
Resource        Variables.resource
Library         Collections

Suite Setup     Setup Suite For Screenshots    style

Test Tags       ui:editor    aspect:style


*** Variables ***
${THEME NAMES}      ${EMPTY}


*** Test Cases ***
Light
    Screenshot Editor Themes with Lab Theme    JupyterLab Light

Dark
    Screenshot Editor Themes with Lab Theme    JupyterLab Dark


*** Keywords ***
Screenshot Editor Themes with Lab Theme
    [Arguments]    ${lab theme}    ${file}=style.py    ${notebook}=Diagnostic.ipynb
    ${norm lab theme} =    Set Variable    ${lab theme.lower().replace(" ", "-")}
    Set Tags    theme:lab:${norm lab theme}
    Set Screenshot Directory    ${SCREENSHOTS DIR}${/}style${/}${norm lab theme}
    Copy File    examples${/}${file}    ${NOTEBOOK DIR}${/}${file}
    IF    "${THEME NAMES}" == ""
        Wait Until Keyword Succeeds    3x    1s    Get Theme Names
    END
    Lab Command    Use Theme: ${lab theme}
    Try to Close All Tabs
    Setup Notebook    python    ${notebook}    isolated=${False}
    Open ${file} in ${MENU EDITOR}
    Drag and Drop By Offset    ${JLAB XP DOCK TAB}\[contains(., '${file}')]    -400    400
    Ensure Sidebar Is Closed
    Click Element    ${JLAB XP DOCK TAB}\[contains(., '${file}')]
    Click the second Accumulate in Notebook
    Capture Page Screenshot    00-notebook.png
    FOR    ${editor theme}    IN    @{THEME NAMES}
        Capture Theme Screenshot    ${editor theme}
    END
    # Reset theme
    Lab Command    Use Theme: JupyterLab Light
    [Teardown]    Clean Up After Working With File    ${file}

Capture Theme Screenshot
    [Arguments]    ${editor theme}
    Change Editor Theme    ${editor theme}
    Wait Until Fully Initialized
    Wait Until Page Contains Element    css:.cm-lsp-diagnostic    timeout=20s
    Click the second Accumulate in FileEditor
    Capture Page Screenshot    01-editor-${editor theme.replace(' ', '-')}.png

Click the second Accumulate in ${editor}
    Click Element
    ...    //div[contains(@class, 'jp-${editor}')]//div[contains(@class,'CodeMirror')]//span[text() = 'accumulate']

Change Editor Theme
    [Arguments]    ${editor theme}
    Open Editor Theme Menu
    ${sel} =    Set Variable
    ...    xpath://div[contains(@class, 'lm-Menu-itemLabel')][contains(text(), "${editor theme}")]
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
