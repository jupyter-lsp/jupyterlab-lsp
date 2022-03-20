*** Settings ***
Documentation     Configuration of language servers
Suite Setup       Setup Suite For Screenshots    config
Force Tags        feature:config
Resource          ./Keywords.robot

*** Test Cases ***
Python
    [Documentation]    pyflakes is enabled by default, but flake8 is not
    Settings Should Change Editor Diagnostics    Python    style.py    pylsp
    ...    {"pylsp": {"plugins": {"flake8": {"enabled": true},"pyflakes": {"enabled": false}}}}
    ...    undefined name 'foo' (pyflakes)
    ...    undefined name 'foo' (flake8)

YAML
    [Documentation]    Composer YAML files don't allow a "greetings" key
    Settings Should Change Editor Diagnostics    YAML    example.yaml    yaml-language-server
    ...    {"yaml.schemas": {"http://json.schemastore.org/composer": "*"}}
    ...    Map keys must be unique
    ...    Property greetings is not allowed.

Markdown
    [Documentation]    different englishes spell colou?r differently
    Settings Should Change Editor Diagnostics    Markdown    example.md    unified-language-server
    ...    {"unified-language-server":{"remark-parse":{"plugins":[["#remark-retext","#parse-latin"],["#retext-spell","#dictionary-en"]]}}}
    ...    `Color` is misspelt
    ...    `Colour` is misspelt

LaTeX
    [Documentation]    diagnostics only appear if configured
    [Tags]    language:latex
    ${needs reload} =    Set Variable    "${OS}" == "Windows"
    Settings Should Change Editor Diagnostics    LaTeX    example.tex    texlab
    ...    {"chktex.onOpenAndSave": true}
    ...    ${EMPTY}
    ...    Command terminated with space. (chktex)
    ...    Save File
    ...    ${needs reload}

*** Keywords ***
Settings Should Change Editor Diagnostics
    [Arguments]    ${language}    ${file}    ${server}    ${settings}    ${before}    ${after}    ${save command}=${EMPTY}    ${needs reload}=${False}
    ${before diagnostic} =    Set Variable    ${CSS DIAGNOSTIC}\[title*="${before}"]
    ${after diagnostic} =    Set Variable    ${CSS DIAGNOSTIC}\[title*="${after}"]
    ${tab} =    Set Variable    ${JLAB XP DOCK TAB}\[contains(., '${file}')]
    ${close icon} =    Set Variable    *[contains(@class, 'm-TabBar-tabCloseIcon')]
    ${save command} =    Set Variable If    "${save command}"    ${save command}    Save ${language} File
    Prepare File for Editing    ${language}    config    ${file}
    Open in Advanced Settings    ${LSP PLUGIN ID}
    Drag and Drop By Offset    ${tab}    0    100
    Wait Until Fully Initialized
    Open Diagnostics Panel
    Drag and Drop By Offset    ${JLAB XP DOCK TAB}\[contains(., 'Diagnostics Panel')]    600    -200
    Click Element    ${JLAB XP DOCK TAB}\[contains(., 'Launcher')]/${close icon}
    Run Keyword If    "${before}"    Wait Until Page Contains Element    ${before diagnostic}    timeout=30s
    Page Should Not Contain    ${after diagnostic}
    Capture Page Screenshot    01-default-diagnostics-and-settings.png
    Set Editor Content    {"language_servers": {"${server}": {"serverSettings": ${settings}}}}    ${CSS USER SETTINGS}
    Wait Until Page Contains    No errors found
    Capture Page Screenshot    02-default-diagnostics-and-unsaved-settings.png
    Click Element    css:button[title^\='Save User Settings']
    Click Element    ${JLAB XP CLOSE SETTINGS}
    Drag and Drop By Offset    ${tab}    0    100
    Lab Command    ${save command}
    Ensure Sidebar Is Closed
    Capture Page Screenshot    03-settings-changed.png
    Run Keyword If    ${needs reload}    Reload After Configuration    ${language}    ${file}
    Wait Until Page Contains Element    ${after diagnostic}    timeout=30s
    Capture Page Screenshot    04-configured-diagnostic-found.png
    [Teardown]    Clean Up After Working with File and Settings    ${file}

Reload After Configuration
    [Arguments]    ${language}    ${file}
    Reload Page
    Wait Until Keyword Succeeds    3x    5s    Wait For Splash
    Reset Application State
    Prepare File for Editing    ${language}    config    ${file}
    Wait Until Fully Initialized
    Open Diagnostics Panel
    Ensure Sidebar Is Closed
