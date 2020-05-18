*** Settings ***
Documentation     Configuration of language servers
Suite Setup       Setup Suite For Screenshots    config
Force Tags        feature:config
Resource          ./Keywords.robot

*** Variables ***
${CONFIG PYLS}    {"language_servers": {"pyls": {"serverSettings": {"pyls": {"plugins": {"flake8": {"enabled": true},"pyflakes": {"enabled": false}}}}}}}
# pyflakes is enabled by default, but flake8 is not
${PYFLAKES DIAGNOSTIC}    ${CSS DIAGNOSTIC}-Error[title="undefined name 'foo' (pyflakes)"]
${FLAKE8 DIAGNOSTIC}    ${CSS DIAGNOSTIC}-Warning[title="undefined name 'foo' (flake8)"]

${CONFIG YAML SCHEMA}    {"language_servers": {"yaml-language-server": {"serverSettings": {"yaml.schemas": {"http://json.schemastore.org/composer": "*"}}}}}
${YAML DIAGNOSTIC}    ${CSS DIAGNOSTIC}-Error[title="duplicate key"]
# Composer YAML files don't allow a "greetings" key
${SCHEMA DIAGNOSTIC}    ${CSS DIAGNOSTIC}-Error[title="Property greetings is not allowed."]

*** Test Cases ***
Pyls Configuration
    ${file} =    Set Variable    style.py
    ${tab} =    Set Variable    ${JLAB XP DOCK TAB}\[contains(., '${file}')]
    Prepare File for Editing    PYTHON    config    ${file}
    Open in Advanced Settings    ${LSP PLUGIN ID}
    Drag and Drop By Offset    ${tab}    0    100
    Wait Until Fully Initialized
    Open Diagnostics Panel
    Drag and Drop By Offset    ${JLAB XP DOCK TAB}\[contains(., 'Diagnostics Panel')]    600    -200
    Ensure Sidebar Is Closed
    Capture Page Screenshot    01-diagnostics-and-settings.png
    # Diagnostic panel should show pyflakes diagnostics, but no flake8
    Wait Until Page Contains Element    ${PYFLAKES DIAGNOSTIC}    timeout=60s
    Page Should Not Contain    ${FLAKE8 DIAGNOSTIC}
    Set Editor Content    ${CONFIG PYLS}    ${CSS USER SETTINGS}
    Click Element    css:button[title\='Save User Settings']
    Drag and Drop By Offset    ${tab}    0    100
    Lab Command    Save Python File
    Capture Page Screenshot    02-settings-changed.png
    # After updating settings, we should see flake8 but no pyflakes
    Wait Until Page Contains Element    ${FLAKE8 DIAGNOSTIC}    timeout=60s
    Page Should Not Contain    ${PYFLAKES DIAGNOSTIC}
    Capture Page Screenshot    03-schema-diagnostic-found.png
    [Teardown]    Clean Up After Working with File and Settings    ${file}

YAML Schema
    ${file} =    Set Variable    example.yaml
    ${tab} =    Set Variable    ${JLAB XP DOCK TAB}\[contains(., '${file}')]
    Prepare File for Editing    YAML    config    ${file}
    Open in Advanced Settings    ${LSP PLUGIN ID}
    Drag and Drop By Offset    ${tab}    0    100
    Wait Until Fully Initialized
    Open Diagnostics Panel
    Drag and Drop By Offset    ${JLAB XP DOCK TAB}\[contains(., 'Diagnostics Panel')]    600    -200
    Ensure Sidebar Is Closed
    Capture Page Screenshot    01-diagnostics-and-settings.png
    # Diagnostic panel shouldn't show "Property ... is not allowed"
    Wait Until Page Contains Element    ${YAML DIAGNOSTIC}    timeout=20s
    Page Should Not Contain    ${SCHEMA DIAGNOSTIC}
    Set Editor Content    ${CONFIG YAML SCHEMA}    ${CSS USER SETTINGS}
    Click Element    css:button[title\='Save User Settings']
    Capture Page Screenshot    02-settings-changed.png
    # Now show the Composer YAML error
    Wait Until Page Contains Element    ${SCHEMA DIAGNOSTIC}    timeout=20s
    Capture Page Screenshot    03-schema-diagnostic-found.png
    [Teardown]    Clean Up After Working with File and Settings    ${file}

*** Keywords ***
Clean Up After Working with File and Settings
    [Arguments]    ${file}
    Clean Up After Working With File    ${file}
    Reset Plugin Settings
