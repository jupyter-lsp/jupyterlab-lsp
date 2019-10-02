mkdir -p "$HOME/lib/R/site-library"
echo "options(repos='http://cran.r-project.org')" > .Rprofile
# Rscript -e "install.packages('languageserver', lib='$HOME/lib/R/site-library')"
# use the master for now (waiting for a release which will include https://github.com/REditorSupport/languageserver/issues/77)
Rscript -e "install.packages('remotes')"
Rscript -e "remotes::install_github('REditorSupport/languageserver@f0ec93e64109988e73c3a46fe04e3fdffd2547d3', upgrade='never')"
