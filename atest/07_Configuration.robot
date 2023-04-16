*** Settings ***
Documentation       Configuration of language servers

Resource            ./Keywords.resource

Suite Setup         Setup Suite For Screenshots    config

Test Tags           feature:config


*** Test Cases ***
Python
    [Documentation]    pyflakes is enabled by default, but flake8 is not
    Settings Should Change Editor Diagnostics    Python    style.py    pylsp
    ...    {"pylsp": {"plugins": {"flake8": {"enabled": true},"pyflakes": {"enabled": false}}}}
    ...    undefined name 'foo' (pyflakes)
    ...    undefined name 'foo' (flake8)

Python (server-side via overrides.json)
    [Documentation]    same as "Python" but changing the defaults in server specification via `overrides.json`
    Settings Should Change Editor Diagnostics    Python    style.py    pylsp-with-override-json
    ...    settings=100
    ...    before=undefined name 'foo' (pyflakes)
    ...    after=undefined name 'foo' (flake8)
    ...    setting_key=priority
    ...    needs reload=${True}

Python (server-side via spec)
    [Documentation]    same as "Python" but changing the defaults in server specification via `workspace_configuration`
    Settings Should Change Editor Diagnostics    Python    style.py    pylsp-with-override-spec
    ...    settings=100
    ...    before=undefined name 'foo' (pyflakes)
    ...    after=undefined name 'foo' (flake8)
    ...    setting_key=priority
    ...    needs reload=${True}

YAML
    [Documentation]    Composer YAML files don't allow a "greetings" key
    Settings Should Change Editor Diagnostics    YAML    example.yaml    yaml-language-server
    ...    {"yaml.schemas": {"http://json.schemastore.org/composer": "*"}}
    ...    Map keys must be unique
    ...    Property greetings is not allowed.

Markdown
    [Documentation]    different englishes spell colou?r differently
    Settings Should Change Editor Diagnostics
    ...    Markdown
    ...    example.md
    ...    unified-language-server
    ...    {"unified-language-server":{"remark-parse":{"plugins":[["#remark-retext","#parse-latin"],["#retext-spell","#dictionary-en"]]}}}
    ...    `Color` is misspelt
    ...    `Colour` is misspelt

LaTeX
    [Documentation]    diagnostics only appear if configured
    [Tags]    language:latex
    ${needs reload} =    Set Variable    "${OS}" == "Windows"
    Settings Should Change Editor Diagnostics    LaTeX    example.tex    texlab
    ...    {"chktex.onOpenAndSave": true, "chktex.onEdit": true}
    ...    ${EMPTY}
    ...    Command terminated with space.
    ...    Save File
    ...    ${needs reload}


*** Keywords ***
Settings Should Change Editor Diagnostics
    [Arguments]    ${language}    ${file}    ${server}    ${settings}    ${before}    ${after}    ${save command}=${EMPTY}    ${needs reload}=${False}    ${setting_key}=serverSettings
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
    IF    "${before}"
        Wait Until Page Contains Element    ${before diagnostic}    timeout=30s
    END
    Page Should Not Contain    ${after diagnostic}
    Capture Page Screenshot    01-default-diagnostics-and-settings.png
    Set Editor Content    {"language_servers": {"${server}": {"${setting_key}": ${settings}}}}    ${CSS USER SETTINGS}
    Wait Until Page Contains    No errors found
    Capture Page Screenshot    02-default-diagnostics-and-unsaved-settings.png
    Click Element    css:button[title^\='Save User Settings']
    Click Element    ${JLAB XP CLOSE SETTINGS}
    Drag and Drop By Offset    ${tab}    0    100
    Lab Command    ${save command}
    Ensure Sidebar Is Closed
    Capture Page Screenshot    03-settings-changed.png
    IF    ${needs reload}
        Reload After Configuration    ${language}    ${file}
        # allow longer after reload
        Wait Until Page Contains Element    ${after diagnostic}    timeout=60s
    ELSE
        Wait Until Page Contains Element    ${after diagnostic}    timeout=30s
    END
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
