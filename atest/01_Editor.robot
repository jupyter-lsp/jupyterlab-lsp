*** Settings ***
Suite Setup       Setup Suite For Screenshots    editor
Force Tags        ui:editor
Resource          Keywords.robot

*** Variables ***
${MENU EDITOR}    xpath://div[contains(@class, 'p-Menu-itemLabel')][contains(., "Editor")]
${MENU OPEN WITH}    xpath://div[contains(@class, 'p-Menu-itemLabel')][contains(text(), "Open With")]
${MENU JUMP}      xpath://div[contains(@class, 'p-Menu-itemLabel')][contains(text(), "Jump to definition")]
${MENU RENAME}    xpath://div[contains(@class, 'p-Menu-itemLabel')][contains(text(), "Rename")]
${CM CURSOR}      css:.CodeMirror-cursor
${CM CURSORS}     css:.CodeMirror-cursors:not([style='visibility: hidden'])
${DIALOG WINDOW}    css:.jp-Dialog
${DIALOG INPUT}    css:.jp-Input-Dialog input

*** Test Cases ***
Bash
    [Documentation]    TODO: figure out why the first server is extra flaky
    Wait Until Keyword Succeeds    3x    10s    Editor Shows Features for Language    Bash    example.sh    Diagnostics=Failed to parse expression
    ...    Jump to Definition=fib

CSS
    ${def} =    Set Variable    xpath:(//span[contains(@class, 'cm-variable-2')][contains(text(), '--some-var')])[last()]
    Editor Shows Features for Language    CSS    example.css    Diagnostics=Do not use empty rulesets    Jump to Definition=${def}    Rename=${def}

Docker
    ${def} =    Set Variable    xpath://span[contains(@class, 'cm-string')][contains(text(), 'PLANET')]
    Editor Shows Features for Language    Docker    Dockerfile    Diagnostics=Instruction has no arguments    Jump to Definition=${def}

JS
    ${def} =    Set Variable    xpath:(//span[contains(@class, 'cm-variable')][contains(text(), 'fib')])[last()]
    Editor Shows Features for Language    JS    example.js    Diagnostics=Expression expected    Jump to Definition=${def}    Rename=${def}

JSON
    Editor Shows Features for Language    JSON    example.json    Diagnostics=Duplicate object key

JSX
    ${def} =    Set Variable    xpath:(//span[contains(@class, 'cm-variable')][contains(text(), 'hello')])[last()]
    Editor Shows Features for Language    JSX    example.jsx    Diagnostics=Expression expected    Jump to Definition=${def}

Less
    ${def} =    Set Variable    xpath:(//span[contains(@class, 'cm-variable-2')][contains(text(), '@width')])[last()]
    Editor Shows Features for Language    Less    example.less    Diagnostics=Do not use empty rulesets    Jump to Definition=${def}

Python
    ${def} =    Set Variable    xpath:(//span[contains(@class, 'cm-variable')][contains(text(), 'fib')])[last()]
    Editor Shows Features for Language    Python    example.py    Diagnostics=multiple spaces after keyword    Jump to Definition=${def}    Rename=${def}

R
    ${def} =    Set Variable    xpath:(//span[contains(@class, 'cm-variable')][contains(text(), 'fib')])[last()]
    Editor Shows Features for Language    R    example.R    Diagnostics=Put spaces around all infix operators    Jump to Definition=${def}

SCSS
    ${def} =    Set Variable    xpath:(//span[contains(@class, 'cm-variable-2')][contains(text(), 'primary-color')])[last()]
    Editor Shows Features for Language    SCSS    example.scss    Diagnostics=Do not use empty rulesets    Jump to Definition=${def}

TSX
    ${def} =    Set Variable    xpath:(//span[contains(@class, 'cm-tag')][contains(text(), 'HelloWorld')])[last()]
    Editor Shows Features for Language    TSX    example.tsx    Diagnostics=Cannot find module 'react'    Jump to Definition=${def}

TypeScript
    ${def} =    Set Variable    xpath:(//span[contains(@class, 'cm-variable')][contains(text(), 'inc')])[last()]
    Editor Shows Features for Language    TypeScript    example.ts    Diagnostics=The left-hand side of an arithmetic    Jump to Definition=${def}

YAML
    Editor Shows Features for Language    YAML    example.yaml    Diagnostics=duplicate key

*** Keywords ***
Editor Shows Features for Language
    [Arguments]    ${Language}    ${file}    &{features}
    Set Tags    language:${Language.lower()}
    Set Screenshot Directory    ${OUTPUT DIR}${/}screenshots${/}editor${/}${Language.lower()}
    Copy File    examples${/}${file}    ${OUTPUT DIR}${/}home${/}${file}
    Lab Command    Close All Tabs
    Open ${file} in Editor
    Capture Page Screenshot    00-opened.png
    FOR    ${f}    IN    @{features}
        Run Keyword If    "${f}" == "Diagnostics"    Editor Should Show Diagnostics    ${features["${f}"]}
        ...    ELSE IF    "${f}" == "Jump to Definition"    Editor Should Jump To Definition    ${features["${f}"]}
        ...    ELSE IF    "${f}" == "Rename"    Editor Should Rename    ${features["${f}"]}
    END
    Capture Page Screenshot    99-done.png
    [Teardown]    Clean Up After Working With File    ${file}

Clean Up After Working With File
    [Arguments]    ${file}
    Remove File    ${OUTPUT DIR}${/}home${/}${file}
    Reset Application State

Open ${file} in Editor
    Ensure File Browser is Open
    Click Element    css:button[title="Refresh File List"]
    Open Context Menu    css:.jp-DirListing-item[title="${file}"]
    Mouse Over    ${MENU OPEN WITH}
    Wait Until Page Contains Element    ${MENU EDITOR}
    Mouse Over    ${MENU EDITOR}
    Click Element    ${MENU EDITOR}

Ensure File Browser is Open
    ${sel} =    Set Variable    css:.p-TabBar-tab[data-id="filebrowser"]:not(.p-mod-current)
    ${els} =    Get WebElements    ${sel}
    Run Keyword If    ${els.__len__()}    Click Element    ${sel}

Editor Should Show Diagnostics
    [Arguments]    ${diagnostic}
    Set Tags    feature:diagnostics
    Wait Until Page Contains Element    css:.cm-lsp-diagnostic[title*="${diagnostic}"]    timeout=20s
    Capture Page Screenshot    01-diagnostics.png

Editor Should Jump To Definition
    [Arguments]    ${symbol}
    Set Tags    feature:jump-to-definition
    ${sel} =    Set Variable If    "${symbol}".startswith(("xpath", "css"))    ${symbol}    xpath:(//span[@role="presentation"][contains(., "${symbol}")])[last()]
    Open Context Menu Over    ${sel}
    ${cursor} =    Measure Cursor Position
    Capture Page Screenshot    02-jump-to-definition-0.png
    Mouse Over    ${MENU JUMP}
    Capture Page Screenshot    02-jump-to-definition-1.png
    Click Element    ${MENU JUMP}
    Wait Until Keyword Succeeds    10 x    1 s    Cursor Should Jump    ${cursor}
    Capture Page Screenshot    02-jump-to-definition-2.png

Cursor Should Jump
    [Arguments]    ${original}
    ${current} =    Measure Cursor Position
    Should Not Be Equal    ${original}    ${current}

Measure Cursor Position
    Wait Until Page Contains Element    ${CM CURSORS}
    ${position} =    Wait Until Keyword Succeeds    20 x    0.05s    Get Vertical Position    ${CM CURSOR}
    [Return]    ${position}

Wait For Dialog
    Wait Until Page Contains Element    ${DIALOG WINDOW}    timeout=180s

Open Context Menu Over
    [Arguments]    ${sel}
    Mouse Over    ${sel}
    Sleep    10s
    Mouse Over    ${sel}
    Wait Until Keyword Succeeds    10 x    0.1 s    Click Element    ${sel}
    Wait Until Keyword Succeeds    10 x    0.1 s    Open Context Menu    ${sel}

Editor Content Changed
    [Arguments]    ${old_content}
    ${new_content}    Execute JavaScript    return document.querySelector('.CodeMirror').CodeMirror.getValue()
    Should Not Be Equal    ${old_content}    ${new_content}
    [Return]    ${new_content}

Editor Should Rename
    [Arguments]    ${symbol}
    Set Tags    feature:rename
    ${sel} =    Set Variable If    "${symbol}".startswith(("xpath", "css"))    ${symbol}    xpath:(//span[@role="presentation"][contains(., "${symbol}")])[last()]
    Open Context Menu Over    ${sel}
    ${old_content}    Execute JavaScript    return document.querySelector('.CodeMirror').CodeMirror.getValue()
    Capture Page Screenshot    03-rename-0.png
    Mouse Over    ${MENU RENAME}
    Capture Page Screenshot    03-rename-1.png
    Click Element    ${MENU RENAME}
    Wait For Dialog
    Click Element    ${DIALOG INPUT}
    Capture Page Screenshot    03-rename-3.png
    Input Text    ${DIALOG INPUT}    new_name
    Capture Page Screenshot    03-rename-4.png
    Click Element    css:button.jp-Dialog-button.jp-mod-accept
    Sleep    3s
    Capture Page Screenshot    03-rename-5.png
    ${new_content}    Wait Until Keyword Succeeds    10 x    0.1 s    Editor Content Changed    ${old_content}
    Should Be True    "new_name" in """${new_content}"""
