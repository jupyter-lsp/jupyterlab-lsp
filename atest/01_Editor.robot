*** Settings ***
Suite Setup       Setup Suite For Screenshots    editor
Force Tags        ui:editor    aspect:ls:features
Resource          Keywords.robot
Resource          Variables.robot

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
#    Julia
#    ${def} =    Set Variable    xpath:(//span[contains(@class, 'cm-builtin')][contains(text(), 'add_together')])[last()]
#    Editor Shows Features for Language    Julia    example.jl    Jump to Definition=${def}    Rename=${def}

LaTeX
    [Tags]    language:latex
    ${def} =    Set Variable    xpath:(//span[contains(@class, 'cm-atom')][contains(text(), 'foo')])[last()]
    Editor Shows Features for Language    LaTeX    example.tex    Jump to Definition=${def}    Rename=${def}

Less
    ${def} =    Set Variable    xpath:(//span[contains(@class, 'cm-variable-2')][contains(text(), '@width')])[last()]
    Editor Shows Features for Language    Less    example.less    Diagnostics=Do not use empty rulesets    Jump to Definition=${def}

Markdown
    Editor Shows Features for Language    Markdown    example.md    Diagnostics=`Color` is misspelt

Python
    ${def} =    Set Variable    xpath:(//span[contains(@class, 'cm-variable')][contains(text(), 'fib')])[last()]
    Editor Shows Features for Language    Python    example.py    Diagnostics=multiple spaces after keyword    Jump to Definition=${def}    Rename=${def}

R
    ${def} =    Set Variable    xpath:(//span[contains(@class, 'cm-variable')][contains(text(), 'fib')])[last()]
    Editor Shows Features for Language    R    example.R    Diagnostics=Put spaces around all infix operators    Jump to Definition=${def}

Robot Framework
    [Tags]    gh:332
    ${def} =    Set Variable    xpath:(//span[contains(@class, 'cm-keyword')][contains(text(), 'Special Log')])[last()]
    Editor Shows Features for Language    Robot Framework    example.robot    Diagnostics=Undefined keyword    Jump to Definition=${def}

SCSS
    ${def} =    Set Variable    xpath:(//span[contains(@class, 'cm-variable-2')][contains(text(), 'primary-color')])[last()]
    Editor Shows Features for Language    SCSS    example.scss    Diagnostics=Do not use empty rulesets    Jump to Definition=${def}

TSX
    ${def} =    Set Variable    xpath:(//span[contains(@class, 'cm-tag')][contains(text(), 'HelloWorld')])[last()]
    Editor Shows Features for Language    TSX    example.tsx    Diagnostics=Cannot find module 'react'    Jump to Definition=${def}    Rename=${def}

TypeScript
    ${def} =    Set Variable    xpath:(//span[contains(@class, 'cm-variable')][contains(text(), 'inc')])[last()]
    Editor Shows Features for Language    TypeScript    example.ts    Diagnostics=The left-hand side of an arithmetic    Jump to Definition=${def}    Rename=${def}

SQL
    Editor Shows Features for Language    SQL    example.sql    Diagnostics=Expected

YAML
    Editor Shows Features for Language    YAML    example.yaml    Diagnostics=duplicate key

*** Keywords ***
Editor Shows Features for Language
    [Arguments]    ${Language}    ${file}    &{features}
    Prepare File for Editing    ${Language}    editor    ${file}
    # Run Keyword If    "${Language}" == "Julia"    Sleep    35s
    Wait Until Fully Initialized
    # Run Keyword If    "${Language}" == "Julia"    Sleep    5s
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

Editor Content Changed
    [Arguments]    ${old_content}
    ${new_content} =    Get Editor Content
    Should Not Be Equal    ${old_content}    ${new_content}
    [Return]    ${new_content}

Editor Should Rename
    [Arguments]    ${symbol}
    Set Tags    feature:rename
    ${sel} =    Set Variable If    "${symbol}".startswith(("xpath", "css"))
    ...    ${symbol}
    ...    xpath:(//span[@role="presentation"][contains(., "${symbol}")])[last()]
    Open Context Menu Over    ${sel}
    ${old_content} =    Get Editor Content
    Capture Page Screenshot    03-rename-0.png
    Mouse Over    ${MENU RENAME}
    Capture Page Screenshot    03-rename-1.png
    Click Element    ${MENU RENAME}
    Capture Page Screenshot    03-rename-2.png
    Input Into Dialog    new_name
    Sleep    2s
    Capture Page Screenshot    03-rename-3.png
    ${new_content} =    Wait Until Keyword Succeeds    10 x    0.1 s    Editor Content Changed    ${old_content}
    Should Be True    "new_name" in """${new_content}"""
