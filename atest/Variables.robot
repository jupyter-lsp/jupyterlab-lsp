*** Variables ***
${SPLASH}  id:jupyterlab-splash

# to help catch hard-coded paths
${BASE}   /@est/

# override with `python scripts/atest.py --variable HEADLESS:0`
${HEADLESS}  1


${CMD PALETTE INPUT}   css:.p-CommandPalette-input

${CMD PALETTE ITEM ACTIVE}  css:.p-CommandPalette-item.p-mod-active

${JLAB XP TOP}            //div[@id='jp-top-panel']
${JLAB XP MENU ITEM LABEL}  //div[@class='p-Menu-itemLabel']
${JLAB XP MENU LABEL}       //div[@class='p-MenuBar-itemLabel']
${JLAB CSS VERSION}    css:.jp-About-version
