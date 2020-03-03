*** Settings ***
Suite Setup       Setup Suite For Screenshots    editor
Force Tags        ui:editor
Resource          Keywords.robot

*** Variables ***
${MENU EDITOR}    xpath://div[contains(@class, 'lm-Menu-itemLabel')][contains(., "Editor")]
${MENU JUMP}      xpath://div[contains(@class, 'lm-Menu-itemLabel')][contains(text(), "Jump to definition")]
${CM CURSOR}      css:.CodeMirror-cursor
${CM CURSORS}     css:.CodeMirror-cursors:not([style='visibility: hidden'])

*** Test Cases ***
Bash
    Editor Shows Features for Language    Bash    example.sh    Diagnostics=Failed to parse expression    Jump to Definition=fib

CSS
    ${def} =    Set Variable    xpath:(//span[contains(@class, 'cm-variable-2')][contains(text(), '--some-var')])[last()]
    Editor Shows Features for Language    CSS    example.css    Diagnostics=Do not use empty rulesets    Jump to Definition=${def}    Rename=${def}

Docker
    ${def} =    Set Variable    xpath://span[contains(@class, 'cm-string')][contains(text(), 'PLANET')]
    Wait Until Keyword Succeeds    3x    100ms    Editor Shows Features for Language    Docker    Dockerfile    Diagnostics=Instruction has no arguments
    ...    Jump to Definition=${def}    Rename=${def}

JS
    ${def} =    Set Variable    xpath:(//span[contains(@class, 'cm-variable')][contains(text(), 'fib')])[last()]
    Editor Shows Features for Language    JS    example.js    Diagnostics=Expression expected    Jump to Definition=${def}    Rename=${def}

JSON
    Editor Shows Features for Language    JSON    example.json    Diagnostics=Duplicate object key

JSX
    ${def} =    Set Variable    xpath:(//span[contains(@class, 'cm-variable')][contains(text(), 'hello')])[last()]
    Editor Shows Features for Language    JSX    example.jsx    Diagnostics=Expression expected    Jump to Definition=${def}    Rename=${def}

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
    Editor Shows Features for Language    TSX    example.tsx    Diagnostics=Cannot find module 'react'    Jump to Definition=${def}    Rename=${def}

TypeScript
    ${def} =    Set Variable    xpath:(//span[contains(@class, 'cm-variable')][contains(text(), 'inc')])[last()]
    Editor Shows Features for Language    TypeScript    example.ts    Diagnostics=The left-hand side of an arithmetic    Jump to Definition=${def}    Rename=${def}

YAML
    Editor Shows Features for Language    YAML    example.yaml    Diagnostics=duplicate key

*** Keywords ***
Editor Shows Features for Language
    [Arguments]    ${Language}    ${file}    &{features}
    Set Tags    language:${Language.lower()}
    Set Screenshot Directory    ${OUTPUT DIR}${/}screenshots${/}editor${/}${Language.lower()}
    Copy File    examples${/}${file}    ${OUTPUT DIR}${/}home${/}${file}
    Try to Close All Tabs
    Open ${file} in ${MENU EDITOR}
    Capture Page Screenshot    00-opened.png
    FOR    ${f}    IN    @{features}
        Run Keyword If    "${f}" == "Diagnostics"    Editor Should Show Diagnostics    ${features["${f}"]}
        ...    ELSE IF    "${f}" == "Jump to Definition"    Editor Should Jump To Definition    ${features["${f}"]}
        ...    ELSE IF    "${f}" == "Rename"    Editor Should Rename    ${features["${f}"]}
    END
    Capture Page Screenshot    99-done.png
    [Teardown]    Clean Up After Working With File    ${file}

Editor Should Show Diagnostics
    [Arguments]    ${diagnostic}
    Set Tags    feature:diagnostics
    Wait Until Page Contains Element    css:.cm-lsp-diagnostic[title*="${diagnostic}"]    timeout=20s
    Capture Page Screenshot    01-diagnostics.png
    Open Diagnostics Panel
    Capture Page Screenshot    02-diagnostics.png
    ${count} =    Count Diagnostics In Panel
    Should Be True    ${count} >= 1
    Close Diagnostics Panel

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

Get Editor Content
    ${content}    Execute JavaScript    return document.querySelector('.CodeMirror').CodeMirror.getValue()
    [Return]    ${content}

Editor Content Changed
    [Arguments]    ${old_content}
    ${new_content}    Get Editor Content
    Should Not Be Equal    ${old_content}    ${new_content}
    [Return]    ${new_content}

Editor Should Rename
    [Arguments]    ${symbol}
    Set Tags    feature:rename
    ${sel} =    Set Variable If    "${symbol}".startswith(("xpath", "css"))    ${symbol}    xpath:(//span[@role="presentation"][contains(., "${symbol}")])[last()]
    Open Context Menu Over    ${sel}
    ${old_content}    Get Editor Content
    Capture Page Screenshot    03-rename-0.png
    Mouse Over    ${MENU RENAME}
    Capture Page Screenshot    03-rename-1.png
    Click Element    ${MENU RENAME}
    Capture Page Screenshot    03-rename-2.png
    Input Into Dialog    new_name
    Sleep    2s
    Capture Page Screenshot    03-rename-3.png
    ${new_content}    Wait Until Keyword Succeeds    10 x    0.1 s    Editor Content Changed    ${old_content}
    Should Be True    "new_name" in """${new_content}"""
