*** Settings ***
Suite Setup       Setup Suite For Screenshots    signature
Force Tags        feature:signature
Resource          ../Keywords.robot

*** Variables ***
${SIGNATURE_BOX}    css:.lsp-signature-help

*** Test Cases ***
Triggers Signature Help After A Keystroke
    Setup Notebook    Python    Signature.ipynb
    Enter Cell Editor    1    line=6
    Capture Page Screenshot    01-entered-cell.png
    Press Keys    None    (
    Capture Page Screenshot    02-signature-shown.png
    Wait Until Keyword Succeeds    20x    0.5s    Page Should Contain Element    ${SIGNATURE_BOX}
    Element Should Contain    ${SIGNATURE_BOX}    Important docstring of abc()
    [Teardown]    Clean Up After Working With File    Signature.ipynb

Invalidates On Cell Change
    Setup Notebook    Python    Signature.ipynb
    Enter Cell Editor    1    line=6
    Press Keys    None    (
    Enter Cell Editor    2
    # just to increase chances of caching this on CI (which is slow)
    Sleep    5s
    Page Should Not Contain Element    ${SIGNATURE_BOX}
