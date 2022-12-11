*** Settings ***
Resource            ../Keywords.resource

Suite Setup         Setup Suite For Screenshots    signature
Test Setup          Setup Notebook    Python    Signature.ipynb
Test Teardown       Clean Up After Working With File    Signature.ipynb

Test Tags           feature:signature


*** Variables ***
${SIGNATURE PLUGIN ID}          @jupyter-lsp/jupyterlab-lsp:signature
${SIGNATURE_BOX}                css:.lsp-signature-help
${SIGNATURE_HIGHLIGHTED_ARG}    css:.lsp-signature-help mark
${SIGNATURE_DETAILS_CSS}        .lsp-signature-help details
${SIGNATURE_DETAILS}            css:${SIGNATURE_DETAILS_CSS}


*** Test Cases ***
Triggers Signature Help After A Keystroke
    Enter Cell Editor    2    line=6
    Capture Page Screenshot    01-entered-cell.png
    Press Keys    None    (
    Capture Page Screenshot    02-signature-shown.png
    Wait Until Keyword Succeeds    20x    0.5s    Page Should Contain Element    ${SIGNATURE_BOX}
    Element Should Be Visible    ${SIGNATURE_BOX}
    Wait Until Keyword Succeeds    10x    0.5s    Element Should Contain    ${SIGNATURE_BOX}
    ...    Important docstring of abc()
    Element Should Contain    ${SIGNATURE_HIGHLIGHTED_ARG}    x
    # should remain visible after typing an argument
    Press Keys    None    x=2,
    Wait For Ready State
    Wait Until Keyword Succeeds    10x    0.5s    Element Should Contain    ${SIGNATURE_BOX}
    ...    Important docstring of abc()
    # and should switch highlight to y
    Wait Until Keyword Succeeds    20x    0.5s    Element Should Contain    ${SIGNATURE_HIGHLIGHTED_ARG}    y
    Press Keys    None    LEFT
    # should switch back to x
    Wait Until Keyword Succeeds    20x    0.5s    Element Should Contain    ${SIGNATURE_HIGHLIGHTED_ARG}    x
    # should close on closing bracket
    Press Keys    None    )
    Wait Until Keyword Succeeds    20x    0.5s    Page Should Not Contain Element    ${SIGNATURE_BOX}

Triggered Signature Is Visible In First Cell
    # test boundary conditions for out of view behaviour
    Enter Cell Editor    1
    Press Keys    None    (
    Wait Until Keyword Succeeds    20x    0.5s    Page Should Contain Element    ${SIGNATURE_BOX}
    Element Should Be Visible    ${SIGNATURE_BOX}

Should Close After Moving Cursor Prior To Start
    Enter Cell Editor    2    line=6
    Press Keys    None    (
    Wait Until Keyword Succeeds    20x    0.5s    Page Should Contain Element    ${SIGNATURE_BOX}
    Press Keys    None    LEFT
    Wait Until Keyword Succeeds    20x    0.5s    Page Should Not Contain Element    ${SIGNATURE_BOX}
    # retrigger
    Press Keys    None    DELETE
    Press Keys    None    (
    Wait Until Keyword Succeeds    20x    0.5s    Page Should Contain Element    ${SIGNATURE_BOX}
    Press Keys    None    UP
    Wait Until Keyword Succeeds    20x    0.5s    Page Should Not Contain Element    ${SIGNATURE_BOX}

Should Close After Executing The Cell
    Enter Cell Editor    2    line=6
    Press Keys    None    (
    Wait Until Keyword Succeeds    20x    0.5s    Page Should Contain Element    ${SIGNATURE_BOX}
    Press Keys    None    SHIFT+ENTER
    Wait Until Keyword Succeeds    20x    0.5s    Page Should Not Contain Element    ${SIGNATURE_BOX}

Invalidates On Cell Change
    Enter Cell Editor    2    line=6
    Press Keys    None    (
    Wait Until Keyword Succeeds    20x    0.5s    Page Should Contain Element    ${SIGNATURE_BOX}
    Enter Cell Editor    1
    Wait Until Keyword Succeeds    20x    0.5s    Page Should Not Contain Element    ${SIGNATURE_BOX}

Details Should Expand On Click
    Configure JupyterLab Plugin    {"maxLines": 4}    plugin id=${SIGNATURE PLUGIN ID}
    Enter Cell Editor    3    line=11
    Press Keys    None    (
    Wait Until Keyword Succeeds    20x    0.5s    Page Should Contain Element    ${SIGNATURE_BOX}
    Element Should Be Visible    ${SIGNATURE_BOX}
    Wait Until Keyword Succeeds    10x    0.5s    Element Should Contain    ${SIGNATURE_BOX}    Short description.
    Page Should Contain Element    ${SIGNATURE_DETAILS}
    Details Should Be Collapsed    ${SIGNATURE_DETAILS_CSS}
    Click Element    ${SIGNATURE_DETAILS}
    Details Should Be Expanded    ${SIGNATURE_DETAILS_CSS}


*** Keywords ***
Details Should Be Expanded
    [Arguments]    ${css_locator}
    ${is_open}    Execute JavaScript    return document.querySelector('${css_locator}').open
    Should Be True    ${is_open} == True

Details Should Be Collapsed
    [Arguments]    ${css_locator}
    ${is_open}    Execute JavaScript    return document.querySelector('${css_locator}').open
    Should Be True    ${is_open} == False
