*** Settings ***
Documentation     Configuration of language servers
Suite Setup       Setup Suite For Screenshots    config
Force Tags        feature:config
Resource          ./Keywords.robot

*** Test Cases ***
Pyls Configuration
    [Documentation]    pyflakes is enabled by default, but flake8 is not
    Settings Should Change Editor Diagnostics    Python    style.py    pyls
    ...    {"pyls": {"plugins": {"flake8": {"enabled": true},"pyflakes": {"enabled": false}}}}
    ...    undefined name 'foo' (pyflakes)
    ...    undefined name 'foo' (flake8)

YAML Schema
    [Documentation]    EXPECT FAIL Composer YAML files don't allow a "greetings" key
    Settings Should Change Editor Diagnostics    YAML    example.yaml    yaml-language-server
    ...    {"yaml.schemas": {"http://json.schemastore.org/composer": "*"}}
    ...    duplicate key
    ...    Property greetings is not allowed.

*** Keywords ***
Clean Up After Working with File and Settings
    [Arguments]    ${file}
    Clean Up After Working With File    ${file}
    Reset Plugin Settings

Settings Should Change Editor Diagnostics
    [Arguments]    ${language}    ${file}    ${server}    ${settings}    ${before}    ${after}
    ${before diagnostic} =    Set Variable    ${CSS DIAGNOSTIC}\[title="${before}"]
    ${after diagnostic} =    Set Variable    ${CSS DIAGNOSTIC}\[title="${after}"]
    ${tab} =    Set Variable    ${JLAB XP DOCK TAB}\[contains(., '${file}')]
    ${close icon} =    Set Variable    *[contains(@class, 'm-TabBar-tabCloseIcon')]
    Prepare File for Editing    ${language}    config    ${file}
    Open in Advanced Settings    ${LSP PLUGIN ID}
    Drag and Drop By Offset    ${tab}    0    100
    Wait Until Fully Initialized
    Open Diagnostics Panel
    Drag and Drop By Offset    ${JLAB XP DOCK TAB}\[contains(., 'Diagnostics Panel')]    600    -200
    Click Element    ${JLAB XP DOCK TAB}\[contains(., 'Launcher')]/${close icon}
    Wait Until Page Contains Element    ${before diagnostic}    timeout=30s
    Page Should Not Contain    ${after diagnostic}
    Capture Page Screenshot    01-default-diagnostics-and-settings.png
    Set Editor Content    {"language_servers": {"${server}": {"serverSettings": ${settings}}}}    ${CSS USER SETTINGS}
    Wait Until Page Contains    No errors found
    Capture Page Screenshot    01-default-diagnostics-and-settings.png
    Click Element    css:button[title\='Save User Settings']
    Click Element    ${JLAB XP DOCK TAB}\[contains(., 'Settings')]/${close icon}
    Drag and Drop By Offset    ${tab}    0    100
    Lab Command    Save ${language} File
    Ensure Sidebar Is Closed
    Capture Page Screenshot    02-settings-changed.png
    Wait Until Page Contains Element    ${after diagnostic}    timeout=30s
    Capture Page Screenshot    03-configured-diagnostic-found.png
    [Teardown]    Clean Up After Working with File and Settings    ${file}
