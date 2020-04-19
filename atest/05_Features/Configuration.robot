*** Settings ***
Documentation     Configuration of language servers
Suite Setup       Setup Suite For Screenshots    config
Force Tags        feature:config
Resource          ../Keywords.robot

*** Variables ***
${CONFIG YAML SCHEMA}    {"language_servers": {"yaml-language-server": {"config": {"yaml.schemas": {"http://json.schemastore.org/composer": "*"}}}}}

*** Test Cases ***
YAML Schema
    [Documentation]
    ${file} =   Set Variable    config-schema.yaml
    Prepare File for Editing  YAML  config   ${file}
    Open in Advanced Settings    ${LSP PLUGIN ID}
    Drag and Drop By Offset    ${JLAB XP DOCK TAB}\[contains(., '${file}')]    0     100
    Capture Page Screenshot   01-file-and-settings.png
    ${els} =   Get WebElements    ${CSS DIAGNOSTIC}-Error
    Should Be Equal as Numbers   ${els.__len__()}   4
    Set Editor Content     ${CONFIG YAML SCHEMA}   ${CSS USER SETTINGS}
    Click Element    css:button[title\='Save User Settings']
    Capture Page Screenshot   02-settings-changed.png
    Should Be Equal as Numbers   ${els.__len__()}   6
    [Teardown]    Clean Up After Working With File    ${file}
