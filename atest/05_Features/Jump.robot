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

*** Keywords ***
Copy Files to Folder With Spaces
    [Arguments]    @{files}
    FOR    ${file}    IN    @{files}
        Copy File    examples${/}${file}    ${NOTEBOOK DIR}${/}${FOLDER WITH SPACE}${/}${file}
    END
