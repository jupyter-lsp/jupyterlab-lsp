*** Settings ***
Library           SeleniumLibrary
Force Tags        atest:example

*** Variables ***
${ABC}            abc

*** Keywords ***
Special Log
    [Arguments]    ${log}
    [Documentation]    a special log
    Log    ${log.upper()}!

*** Test Cases ***
Log Something
    Special Log    ${ABC}
    Something that doesn't exist
