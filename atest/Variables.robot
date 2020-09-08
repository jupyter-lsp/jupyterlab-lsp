*** Variables ***
${FIXTURES}       ${CURDIR}${/}fixtures
${NBSERVER CONF}    jupyter_notebook_config.json
${SPLASH}         id:jupyterlab-splash
# to help catch hard-coded paths
${BASE}           /@est/
# override with `python scripts/atest.py --variable HEADLESS:0`
${HEADLESS}       1
${CMD PALETTE INPUT}    css:#command-palette .lm-CommandPalette-input
${CMD PALETTE ITEM ACTIVE}    css:#command-palette .lm-CommandPalette-item.lm-mod-active
${JLAB XP TOP}    //div[@id='jp-top-panel']
${JLAB XP MENU ITEM LABEL}    xpath://div[contains(@class, 'lm-Menu-itemLabel')]
${JLAB XP MENU LABEL}    //div[@class='lm-MenuBar-itemLabel']
${JLAB XP DOCK TAB}    xpath://div[contains(@class, 'lm-DockPanel-tabBar')]//li[contains(@class, 'lm-TabBar-tab')]
${JLAB CSS VERSION}    css:.jp-About-version
${CSS DIALOG OK}    css:.jp-Dialog .jp-mod-accept
${MENU OPEN WITH}    ${JLAB XP MENU ITEM LABEL}\[contains(text(), "Open With")]
# R is missing on purpose (may need to use .)
${MENU RENAME}    ${JLAB XP MENU ITEM LABEL}\[contains(., "ename")]
# N is missing on purpose
${MENU NOTEBOOK}    ${JLAB XP MENU ITEM LABEL}\[contains(., "otebook")]
${DIAGNOSTICS PANEL}    id:lsp-diagnostics-panel
${DIAGNOSTIC PANEL CLOSE}    css:.lm-DockPanel-tabBar .lm-TabBar-tab[data-id="lsp-diagnostics-panel"] .lm-TabBar-tabCloseIcon
${DIALOG WINDOW}    css:.jp-Dialog
${DIALOG INPUT}    css:.jp-Input-Dialog input
${DIALOG ACCEPT}    css:button.jp-Dialog-button.jp-mod-accept
${STATUSBAR}      css:div.lsp-statusbar-item
${MENU EDITOR}    ${JLAB XP MENU ITEM LABEL}\[contains(., "Editor")]
${MENU JUMP}      ${JLAB XP MENU ITEM LABEL}\[contains(text(), "Jump to definition")]
${MENU SETTINGS}    xpath://div[contains(@class, 'lm-MenuBar-itemLabel')][contains(text(), "Settings")]
${MENU EDITOR THEME}    ${JLAB XP MENU ITEM LABEL}\[contains(text(), "Text Editor Theme")]
${CM CURSOR}      css:.CodeMirror-cursor
${CM CURSORS}     css:.CodeMirror-cursors:not([style='visibility: hidden'])
# settings
${LSP PLUGIN ID}    @krassowski/jupyterlab-lsp:plugin
${COMPLETION PLUGIN ID}    @krassowski/jupyterlab-lsp:completion
${DIAGNOSTICS PLUGIN ID}    @krassowski/jupyterlab-lsp:diagnostics
@{ALL LSP PLUGIN IDS}    ${LSP PLUGIN ID}    ${COMPLETION PLUGIN ID}    ${DIAGNOSTICS PLUGIN ID}
# more settings css
${CSS USER SETTINGS}    .jp-SettingsRawEditor-user
${JLAB XP CLOSE SETTINGS}    ${JLAB XP DOCK TAB}\[contains(., 'Settings')]/*[contains(@class, 'm-TabBar-tabCloseIcon')]
# diagnostics
${CSS DIAGNOSTIC}    css:.cm-lsp-diagnostic
# log messages
@{KNOWN BAD ERRORS}
...               pyls_jsonrpc.endpoint - Failed to handle notification
...               pyls_jsonrpc.endpoint - Failed to handle request
