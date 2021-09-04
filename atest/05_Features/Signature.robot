*** Settings ***
Suite Setup       Setup Suite For Screenshots    signature
Force Tags        feature:signature
Resource          ../Keywords.robot
Test Setup        Setup Notebook    Python    Signature.ipynb
Test Teardown     Clean Up After Working With File    Signature.ipynb

*** Variables ***
${SIGNATURE_BOX}    css:.lsp-signature-help
${SIGNATURE_HIGHLIGHTED_ARG}    css:.lsp-signature-help mark

*** Test Cases ***
Triggers Signature Help After A Keystroke
    Enter Cell Editor    1    line=6
    Capture Page Screenshot    01-entered-cell.png
    Press Keys    None    (
    Capture Page Screenshot    02-signature-shown.png
    Wait Until Keyword Succeeds    20x    0.5s    Page Should Contain Element    ${SIGNATURE_BOX}
    Wait Until Keyword Succeeds    10x    0.5s    Element Should Contain    ${SIGNATURE_BOX}    Important docstring of abc()
    Element Should Contain    ${SIGNATURE_HIGHLIGHTED_ARG}   x
    # should remain visible after typing an argument
    Press Keys    None    x=2,
    Element Should Contain    ${SIGNATURE_BOX}    Important docstring of abc()
    # and should switch highlight to y
    Wait Until Keyword Succeeds    20x    0.5s    Element Should Contain    ${SIGNATURE_HIGHLIGHTED_ARG}    y
    Press Keys    None    LEFT
    # should switch back to x
    Wait Until Keyword Succeeds    20x    0.5s    Element Should Contain    ${SIGNATURE_HIGHLIGHTED_ARG}    x
    # should close on closing bracket
    Press Keys    None    )
    Wait Until Keyword Succeeds    20x    0.5s    Page Should Not Contain Element    ${SIGNATURE_BOX}

Invalidates On Cell Change
    Enter Cell Editor    1    line=6
    Press Keys    None    (
    Enter Cell Editor    2
    Wait Until Keyword Succeeds    20x    0.5s    Page Should Not Contain Element    ${SIGNATURE_BOX}
