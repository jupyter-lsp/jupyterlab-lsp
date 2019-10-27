*** Variables ***
${SPLASH}  id:jupyterlab-splash

# to help catch hard-coded paths
${BASE}   /@est/

# override with `python scripts/atest.py --variable HEADLESS:0`
${HEADLESS}  1


${CMD PALETTE INPUT}   css:.p-CommandPalette-input

${CMD PALETTE ITEM ACTIVE}  css:.p-CommandPalette-item.p-mod-active
