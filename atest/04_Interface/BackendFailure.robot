*** Settings ***
Resource            ../Keywords.resource

Suite Setup         Setup Missing Extension Test
Suite Teardown      Teardown Missing Extension Test


*** Variables ***
${STATUSBAR}    css:div.lsp-statusbar-item
${POPOVER}      css:.lsp-popover


*** Test Cases ***
Handles Server Extension Failure
    Setup Notebook    Python    Python.ipynb    wait=${False}
    Element Should Contain    ${STATUSBAR}    Server extension missing
    Click Element    ${STATUSBAR}
    Wait For Dialog
    Accept Default Dialog Option
    Page Should Not Contain Element    ${POPOVER}
    [Teardown]    Clean Up After Working With File    Python.ipynb


*** Keywords ***
Setup Missing Extension Test
    Set Server Extension State    enabled=${False}
    Setup Server and Browser

Teardown Missing Extension Test
    Set Server Extension State    enabled=${True}
    Setup Server and Browser
