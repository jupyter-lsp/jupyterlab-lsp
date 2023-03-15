*** Settings ***
Resource        ../Keywords.resource

Suite Setup     Setup Suite For Screenshots    gh-403

Test Tags       feature:jump-to-definition    gh:403


*** Variables ***
${FOLDER WITH SPACE}    a föl@der


*** Test Cases ***
Python Jumps Between Files
    Copy Files to Folder With Spaces    jump_a.py    jump_b.py
    Open ${FOLDER WITH SPACE}/jump_b.py in ${MENU EDITOR}
    Wait Until Fully Initialized
    ${sel} =    Select Token Occurrence    a_function_definition
    Jump To Definition    ${sel}
    Wait Until Page Contains    ANOTHER_CONSTANT
    Capture Page Screenshot    10-jumped.png
    [Teardown]    Clean Up Folder With Spaces    jump_a.py    jump_b.py

Jumps To References With Modifier Click
    [Setup]    Prepare File for Editing    Python    editor    jump_references.py
    Configure JupyterLab Plugin    {"modifierKey": "Accel"}    plugin id=${JUMP PLUGIN ID}
    Wait Until Fully Initialized
    ${token} =    Select Token Occurrence    func    type=def
    Click Element    ${token}
    ${original} =    Measure Cursor Position
    Ctrl Click Element    ${token}
    Wait Until Page Contains    Choose the jump target
    ${references_count} =    Get Element Count    css:.jp-Dialog select option
    Should Be True    ${references_count} == ${3}
    Select From List By Index    css:.jp-Dialog select    2
    Click Element    css:.jp-Dialog-button.jp-mod-accept
    Wait Until Keyword Succeeds    10 x    1 s    Cursor Should Jump    ${original}
    [Teardown]    Clean Up After Working With File    jump_references.py

Jumps To References From Context Menu
    [Setup]    Prepare File for Editing    Python    editor    jump_references.py
    Wait Until Fully Initialized
    ${token} =    Select Token Occurrence    func    type=def
    Click Element    ${token}
    ${original} =    Measure Cursor Position
    Open Context Menu Over    ${token}
    Select Menu Entry    Jump to references
    Wait Until Page Contains    Choose the jump target
    ${references_count} =    Get Element Count    css:.jp-Dialog select option
    Should Be True    ${references_count} == ${3}
    Select From List By Index    css:.jp-Dialog select    2
    Click Element    css:.jp-Dialog-button.jp-mod-accept
    Wait Until Keyword Succeeds    10 x    1 s    Cursor Should Jump    ${original}
    [Teardown]    Clean Up After Working With File    jump_references.py

Ctrl Click And Jumping Back Works
    [Setup]    Prepare File for Editing    Python    editor    jump.py
    Configure JupyterLab Plugin    {"modifierKey": "Accel"}    plugin id=${JUMP PLUGIN ID}
    Wait Until Fully Initialized
    ${sel} =    Select Token Occurrence    a_variable
    Click Element    ${sel}
    ${original} =    Measure Cursor Position
    Capture Page Screenshot    01-ready-to-jump.png
    Ctrl Click Element    ${sel}
    Capture Page Screenshot    02-jumped.png
    Wait Until Keyword Succeeds    10 x    1 s    Cursor Should Jump    ${original}
    ${new} =    Measure Cursor Position
    Press Keys    None    ALT+o
    Wait Until Keyword Succeeds    10 x    1 s    Cursor Should Jump    ${new}
    ${back} =    Measure Cursor Position
    Should Be Equal    ${original}    ${back}
    Configure JupyterLab Plugin    {"modifierKey": "Alt"}    plugin id=${JUMP PLUGIN ID}
    Click Element    ${sel}    modifier=ALT
    Wait Until Keyword Succeeds    10 x    1 s    Cursor Should Jump    ${original}
    [Teardown]    Clean Up After Working With File    jump.py


*** Keywords ***
Copy Files to Folder With Spaces
    [Arguments]    @{files}
    FOR    ${file}    IN    @{files}
        Copy File    examples${/}${file}    ${NOTEBOOK DIR}${/}${FOLDER WITH SPACE}${/}${file}
    END

Clean Up Folder With Spaces
    [Arguments]    @{files}
    Try to Close All Tabs
    Navigate to Root Folder
    FOR    ${file}    IN    @{files}
        Remove File    ${NOTEBOOK DIR}${/}${FOLDER WITH SPACE}${/}${file}
    END
    Remove Directory    ${NOTEBOOK DIR}${/}${FOLDER WITH SPACE}    recursive=True

Select Token Occurrence
    [Arguments]    ${token}    ${type}=variable    ${which}=last
    ${sel} =    Set Variable
    ...    xpath:(//span[contains(@class, 'cm-${type}')][contains(text(), '${token}')])[${which}()]
    RETURN    ${sel}

Ctrl Click Element
    [Arguments]    ${element}
    ${key} =    Evaluate    'COMMAND' if platform.system() == 'Darwin' else 'CTRL'    platform
    Click Element    ${element}    modifier=${key}
