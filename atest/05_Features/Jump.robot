*** Settings ***
Suite Setup       Setup Suite For Screenshots    gh-403
Force Tags        feature:jump-to-definition    gh:403
Resource          ../Keywords.robot

*** Variables ***
${FOLDER WITH SPACE}    a földer

*** Test Cases ***
Python Jumps between Files
    Copy Files to Folder With Spaces    jump_a.py    jump_b.py
    ${def} =    Set Variable    a_function_definition
    Open ${FOLDER WITH SPACE}/jump_b.py in ${MENU EDITOR}
    Wait Until Fully Initialized
    ${sel} =    Set Variable    xpath:(//span[contains(@class, 'cm-variable')][contains(text(), '${def}')])[last()]
    Jump To Definition    ${sel}
    Wait Until Page Contains    ANOTHER_CONSTANT
    Capture Page Screenshot    10-jumped.png

Ctrl Click And Jumping Back Works
    [Setup]    Prepare File for Editing    Python    editor    jump.py
    Wait Until Fully Initialized
    ${usage} =    Set Variable    a_variable
    ${sel} =    Set Variable    xpath:(//span[contains(@class, 'cm-variable')][contains(text(), '${usage}')])[last()]
    Click Element    ${sel}
    ${original} =    Measure Cursor Position
    Capture Page Screenshot    01-ready-to-jump.png
    ${key} =    Evaluate    'COMMAND' if platform.system() == 'Darwin' else 'CTRL'    platform
    Click Element    ${sel}    modifier=${key}
    Capture Page Screenshot    02-jumped.png
    Wait Until Keyword Succeeds    10 x    1 s    Cursor Should Jump    ${original}
    ${new} =    Measure Cursor Position
    Press Keys    None    ALT+o
    Wait Until Keyword Succeeds    10 x    1 s    Cursor Should Jump    ${new}
    ${back} =    Measure Cursor Position
    Should Be Equal    ${original}    ${back}
    [Teardown]    Clean Up After Working With File    jump.py

*** Keywords ***
Copy Files to Folder With Spaces
    [Arguments]    @{files}
    FOR    ${file}    IN    @{files}
        Copy File    examples${/}${file}    ${NOTEBOOK DIR}${/}${FOLDER WITH SPACE}${/}${file}
    END
