*** Settings ***
Resource            ../Keywords.resource

Suite Setup         Setup Suite For Screenshots    diagnostics
Test Setup          Setup Notebook    Python    Diagnostic.ipynb
Test Teardown       Clean Up After Working With File    Diagnostic.ipynb

Test Tags           feature:diagnostics
# note: diagnostics are also tested in 01_Editor and 04_Interface/DiagnosticsPanel.robot


*** Test Cases ***
Diagnostics with deprecated tag have strike-through decoration
    Wait Until Page Contains Element    css:.cm-lsp-diagnostic[title*="is deprecated"]    timeout=25s
    Wait Until Page Contains Element    css:.cm-lsp-diagnostic[title*="Unreachable code"]    timeout=5s
    Page Should Contain Element    css:.cm-lsp-diagnostic-tag-Deprecated
    Page Should Contain Element    css:.cm-lsp-diagnostic-tag-Unnecessary
