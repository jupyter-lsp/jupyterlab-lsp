*** Settings ***
Documentation     Configuration of client-side Completion settings
...               Thought should be given while writing to ease integration with e.g.
...               https://github.com/deathbeds/jupyterlab-starters/tree/master/packages/jupyterlab-rjsf
Suite Setup       Setup Suite For Screenshots    ${SCREENS}
Force Tags        settings:completion    feature:completion    settings-ui:form
Resource          ../keywords/Completion.robot
Test Setup        Close All Tabs
Test Teardown     Clean Up Completion Form Test

*** Variables ***
${SCREENS}        settings-completion-form
@{THEMES}         vscode    material
@{SCHEMES}        themed    unthemed    muted

*** Test Cases ***
Completion Form Handles Known Icon Themes and Color Schemes
    [Template]    The Completion Form Should Change Settings on Disk
    # TODO: this should be generated, zipped, etc.
    material    Material Design    muted    Muted
    material    Material Design    themed    Themed
    material    Material Design    unthemed    Unthemed
    ${None}    No Icons    muted    Muted
    ${None}    No Icons    themed    Themed
    ${None}    No Icons    unthemed    Unthemed
    vscode    VSCode    muted    Muted
    vscode    VSCode    themed    Themed
    vscode    VSCode    unthemed    Unthemed

*** Keywords ***
The Completion Form Should Change Settings on Disk
    [Documentation]    Verify an icon/color scheme pair
    ...    These are tested together to give better visual coverage e.g.
    ...
    ...    ```python
    ...    display(sorted(Path("atest/output").rglob("20-schemed-*.png")))
    ...    ```
    [Arguments]    ${icon theme}    ${icon theme label}    ${color scheme}    ${color scheme label}
    ${stem} =    Set Variable    -form-theme-${icon theme}-${color scheme}
    Lab Command    Code Completion Settings Editor
    Ensure Sidebar Is Closed
    Navigate to Section    theme    Theme
    Capture Page Screenshot    00-before-${stem}.png
    Navigate to Section    theme-icons    Icons
    Click Form Field Radio    theme    ${icon theme label}
    Capture Page Screenshot    10-themed-${stem}.png
    Navigate to Section    theme-colors    Colors
    Click Form Field Radio    color-scheme    ${color scheme label}
    Capture Page Screenshot    20-schemed-${stem}.png
    ${settings} =    Get Plugin Settings    ${COMPLETION PLUGIN ID}
    Should Be Equal    ${settings["theme"]}    ${icon theme}
    Should Be Equal    ${settings["colorScheme"]}    ${color scheme}
    [Teardown]    Clean Up Completion Form Test

Navigate to Section
    [Documentation]    Sections (and individual settings) should have useful navigation tools
    [Arguments]    ${anchor}    ${anchor label}
    ${sel} =    Set Variable    xpath://a[contains(., "${anchor label}")][@href="#completion-settings-${anchor}"]
    Wait Until Page Contains Element    ${sel}
    Click Element    ${sel}
    [Return]    ${sel}

Click Form Field Radio
    [Documentation]    Use of this should be easy to refactor for e.g. RJSF
    # NOTE: HTML5 radios don't show up well in headless firefox on Linux
    # GOAL: A human readable label should _always_ be a clickable alternative to a form control
    [Arguments]    ${name}    ${label}
    ${sel} =    Set Variable    xpath://label[contains(., "${label}")]/input[@name="completion-icon-${name}"]
    Wait Until Page Contains Element    ${sel}
    Click Element    ${sel}
    [Return]    ${sel}

Clean Up Completion Form Test
    Lab Command    Close All Tabs
    Reset Plugin Settings
