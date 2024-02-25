*** Settings ***
Resource        ../_resources/Keywords.resource
Resource        ../_resources/Variables.resource

Suite Setup     Setup Suite For Screenshots    editor

Test Tags       ui:editor    aspect:ls:features


*** Test Cases ***
Bash
    ${def} =    Set Variable    lastToken:fib
    Editor Shows Features for Language
    ...    Bash
    ...    example.sh
    ...    Diagnostics=Double quote to prevent globbing and word splitting.
    ...    Jump to Definition=${def}

CSS
    ${def} =    Set Variable    lastToken:--some-var
    Editor Shows Features for Language    CSS    example.css    Diagnostics=Do not use empty rulesets
    ...    Jump to Definition=${def}    Rename=${def}

Docker
    ${def} =    Set Variable    lastToken:PLANET
    Wait Until Keyword Succeeds    3x    100ms    Editor Shows Features for Language    Docker    Dockerfile
    ...    Diagnostics=Instructions should be written in uppercase letters    Jump to Definition=${def}
    # skipping rename part because of https://github.com/jupyterlab/jupyterlab/issues/15104
    skip
    # ...    Rename=${def}

JS
    ${def} =    Set Variable    lastToken:fib
    Editor Shows Features for Language    JS    example.js    Diagnostics=Expression expected
    ...    Jump to Definition=${def}    Rename=${def}

JSON
    Editor Shows Features for Language    JSON    example.json    Diagnostics=Duplicate object key

JSX
    ${def} =    Set Variable    lastToken:hello
    Editor Shows Features for Language    JSX    example.jsx    Diagnostics=Expression expected
    ...    Jump to Definition=${def}    Rename=${def}
# Julia
#    ${def} =    Set Variable    lastToken:add_together
#    Editor Shows Features for Language    Julia    example.jl    Jump to Definition=${def}    Rename=${def}

LaTeX
    [Tags]    language:latex
    ${def} =    Set Variable    lastToken:foo
    Editor Shows Features for Language    LaTeX    example.tex    Jump to Definition=${def}    Rename=${def}

Less
    ${def} =    Set Variable    lastToken:@width
    Editor Shows Features for Language    Less    example.less    Diagnostics=Do not use empty rulesets
    ...    Jump to Definition=${def}

Markdown
    Editor Shows Features for Language    Markdown    example.md    Diagnostics=`Color` is misspelt

Python (pylsp)
    ${def} =    Set Variable    lastToken:fib
    Editor Shows Features for Server
    ...    pylsp
    ...    Python
    ...    example.py
    ...    Diagnostics=undefined name 'result' (pyflakes)
    ...    Jump to Definition=${def}
    ...    Rename=${def}

Python (pyright)
    ${def} =    Set Variable    lastToken:fib
    Editor Shows Features for Server    pyright    Python    example.py    Diagnostics=is not defined (Pyright)
    ...    Jump to Definition=${def}

R
    ${def} =    Set Variable    lastToken:fib
    Editor Shows Features for Language    R    example.R    Diagnostics=Put spaces around all infix operators
    ...    Jump to Definition=${def}

Robot Framework
    [Tags]    gh:332
    # skipping as no support for JupyterLab 4.0 to https://github.com/MarketSquare/jupyterlab_robotmode/issues/14
    skip
    ${def} =    Set Variable    lastToken:Special Log
    Editor Shows Features for Language    Robot Framework    example.robot    Diagnostics=Undefined keyword
    ...    Jump to Definition=${def}

SCSS
    ${def} =    Set Variable    lastToken:primary-color
    Editor Shows Features for Language    SCSS    example.scss    Diagnostics=Do not use empty rulesets
    ...    Jump to Definition=${def}

TSX
    ${def} =    Set Variable    lastToken:HelloWorld
    Editor Shows Features for Language    TSX    example.tsx
    ...    Diagnostics='hello' is declared but its value is never read.    Jump to Definition=${def}    Rename=${def}

TypeScript
    ${def} =    Set Variable    lastToken:inc
    Editor Shows Features for Language    TypeScript    example.ts    Diagnostics=The left-hand side of an arithmetic
    ...    Jump to Definition=${def}    Rename=${def}

SQL
    Editor Shows Features for Language    SQL    example.sql    Diagnostics=Expected

YAML
    Editor Shows Features for Language    YAML    example.yaml    Diagnostics=Map keys must be unique


*** Keywords ***
Editor Shows Features for Server
    [Arguments]    ${server}    ${Language}    ${file}    &{features}
    Configure JupyterLab Plugin
    ...    {"language_servers": {"${server}": {"priority": 10000}}}
    Editor Shows Features for Language    ${Language}    ${file}    &{features}
    # reset to empty settings
    Configure JupyterLab Plugin
    ...    {}

Editor Shows Features for Language
    [Arguments]    ${Language}    ${file}    &{features}
    Prepare File for Editing    ${Language}    editor    ${file}
    # Run Keyword If    "${Language}" == "Julia"    Sleep    35s
    Wait Until Fully Initialized
    # Run Keyword If    "${Language}" == "Julia"    Sleep    5s
    FOR    ${f}    IN    @{features}
        IF    "${f}" == "Diagnostics"
            Editor Should Show Diagnostics    ${features["${f}"]}
        ELSE IF    "${f}" == "Jump to Definition"
            Editor Should Jump To Definition    ${features["${f}"]}
        ELSE IF    "${f}" == "Rename"
            Editor Should Rename    ${features["${f}"]}
        END
    END
    Capture Page Screenshot    99-done.png
    [Teardown]    Clean Up After Working With File    ${file}

Editor Should Show Diagnostics
    [Arguments]    ${diagnostic}
    Set Tags    feature:diagnostics
    Wait Until Page Contains Diagnostic    [title*="${diagnostic}"]    timeout=25s
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
    RETURN    ${new_content}

Editor Should Rename
    [Arguments]    ${symbol}
    Set Tags    feature:rename
    Open Context Menu Over Token    ${symbol}
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
