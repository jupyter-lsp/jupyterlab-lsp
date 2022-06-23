*** Variables ***
${FIXTURES}                     ${CURDIR}${/}fixtures
${NBSERVER CONF}                jupyter_server_config.json
${SPLASH}                       id:jupyterlab-splash
# to help catch hard-coded paths and encoding issues
${BASE URL}                     /@est/
${NOTEBOOK DIR NAME}            nöte bòóks
# core paths
${HOME}                         ${OUTPUT DIR}${/}home
${LAB LOG}                      ${OUTPUT DIR}${/}lab.log
${GECKODRIVER LOG}              ${OUTPUT DIR}${/}geckodriver.log
${SETTINGS DIR}                 ${OUTPUT DIR}${/}user-settings
${WORKSPACES DIR}               ${OUTPUT DIR}${/}workspaces
${NOTEBOOK DIR}                 ${HOME}${/}${NOTEBOOK DIR NAME}
${VIRTUALDOCS DIR}              ${NOTEBOOK DIR}${/}.virtual_documents
${SCREENSHOTS DIR}              ${OUTPUT DIR}${/}screenshots
# override with `python scripts/atest.py --variable HEADLESS:0`
${HEADLESS}                     1
${CMD PALETTE INPUT}            css:#command-palette .lm-CommandPalette-input
${CMD PALETTE ITEM ACTIVE}      css:#command-palette .lm-CommandPalette-item.lm-mod-active
${JLAB XP TOP}                  //div[@id='jp-top-panel']
${JLAB XP MENU ITEM LABEL}      //div[contains(@class, 'lm-Menu-itemLabel')]
${JLAB XP MENU LABEL}           //div[contains(@class, 'lm-MenuBar-itemLabel')]
${JLAB XP DOCK TAB}             xpath://div[contains(@class, 'lm-DockPanel-tabBar')]//li[contains(@class, 'lm-TabBar-tab')]
${JLAB CSS VERSION}             css:.jp-About-version
${JLAB CSS REFRESH F_OLD}       css:button[title="Refresh File List"]
${JLAB CSS REFRESH FILES}       css:button[data-command="filebrowser:refresh"]
${CSS DIALOG OK}                css:.jp-Dialog .jp-mod-accept
${MENU OPEN WITH}               xpath://div[contains(@class, 'lm-Menu-itemLabel')][contains(text(), "Open With")]
# R is missing on purpose (may need to use .)
${MENU RENAME}                  xpath://div[contains(@class, 'lm-Menu-itemLabel')][contains(., "ename")]
# N is missing on purpose
${MENU NOTEBOOK}                xpath://div[contains(@class, 'lm-Menu-itemLabel')][contains(., "otebook")]
${DIAGNOSTICS PANEL}            id:lsp-diagnostics-panel
${DIAGNOSTIC PANEL CLOSE}       css:.lm-DockPanel-tabBar .lm-TabBar-tab[data-id="lsp-diagnostics-panel"] .lm-TabBar-tabCloseIcon
${DIALOG WINDOW}                css:.jp-Dialog
${DIALOG INPUT}                 css:.jp-Input-Dialog input
${DIALOG ACCEPT}                css:button.jp-Dialog-button.jp-mod-accept
${STATUSBAR}                    css:div.lsp-statusbar-item
${MENU EDITOR}                  xpath://div[contains(@class, 'lm-Menu-itemLabel')][contains(., "Editor")]
${MENU JUMP}                    xpath://div[contains(@class, 'lm-Menu-itemLabel')][contains(text(), "Jump to definition")]
${MENU SETTINGS}                xpath://div[contains(@class, 'lm-MenuBar-itemLabel')][contains(text(), "Settings")]
${MENU EDITOR THEME}            xpath://div[contains(@class, 'lm-Menu-itemLabel')][contains(text(), "Text Editor Theme")]
${LAB MENU}                     css:.lm-Menu
${CM CURSOR}                    css:.CodeMirror-cursor
${CM CURSORS}                   css:.jp-MainAreaWidget:not(.lm-mod-hidden) .CodeMirror-cursors:not([style='visibility: hidden'])
# settings
${LSP PLUGIN ID}                @krassowski/jupyterlab-lsp:plugin
${COMPLETION PLUGIN ID}         @krassowski/jupyterlab-lsp:completion
${HIGHLIGHTS PLUGIN ID}         @krassowski/jupyterlab-lsp:highlights
${JUMP PLUGIN ID}               @krassowski/jupyterlab-lsp:jump_to
${DIAGNOSTICS PLUGIN ID}        @krassowski/jupyterlab-lsp:diagnostics
${CSS USER SETTINGS}            .jp-SettingsRawEditor-user
${JLAB XP CLOSE SETTINGS}       ${JLAB XP DOCK TAB}\[contains(., 'Settings')]/*[contains(@class, 'm-TabBar-tabCloseIcon')]
# diagnostics
${CSS DIAGNOSTIC}               css:.cm-lsp-diagnostic
# log messages
@{KNOWN BAD ERRORS}
...                             pylsp_jsonrpc.endpoint - Failed to handle notification
...                             pylsp_jsonrpc.endpoint - Failed to handle request
