# To run just this suite:
#
#   python -m scripts.atest --include feature:config
#
*** Settings ***
Documentation     Configuration of language servers
Suite Setup       Setup Suite For Screenshots    config
Force Tags        feature:config
Resource          ../Keywords.robot

*** Variables ***
${CONFIG YAML SCHEMA}    {"language_servers": {"yaml-language-server": {"config": {"yaml.schemas": {"http://json.schemastore.org/composer": "*"}}}}}
${YAML DIAGNOSTIC}    ${CSS DIAGNOSTIC}-Error[title="duplicate key"]
# TODO: fix this for the actual schema error we expect to see
${SCHEMA DIAGNOSTIC}    ${CSS DIAGNOSTIC}-Error[title="??NAME IS NOT VALID???"]

*** Test Cases ***
YAML Schema
    [Documentation]
    ${file} =   Set Variable    composer-schema.yaml
    Prepare File for Editing  YAML  config   ${file}
    Open in Advanced Settings    ${LSP PLUGIN ID}
    Drag and Drop By Offset    ${JLAB XP DOCK TAB}\[contains(., '${file}')]    0     100
    Capture Page Screenshot   01-file-and-settings.png
    Wait Until Page Contains Element   ${YAML DIAGNOSTIC}  timeout=20s
    Page Should Not Contain   ${SCHEMA DIAGNOSTIC}
    Set Editor Content     ${CONFIG YAML SCHEMA}   ${CSS USER SETTINGS}
    Click Element    css:button[title\='Save User Settings']
    Capture Page Screenshot   02-settings-changed.png
    Wait Until Page Contains Element   ${SCHEMA DIAGNOSTIC}  timeout=20s
    Capture Page Screenshot   03-schema-diagnostic-found.png
    [Teardown]    Clean Up After Working with File and Settings    ${file}

*** Keywords ***
Clean Up After Working with File and Settings
    [Arguments]   ${file}
    Clean Up After Working With File    ${file}
    Reset Plugin Settings
