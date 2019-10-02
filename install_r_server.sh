mkdir -p "$HOME/lib/R/site-library"
if [ "$TRAVIS" == true ]; then
  echo "options(repos='http://cran.r-project.org')" > .Rprofile
fi
# Rscript -e "install.packages('languageserver', lib='$HOME/lib/R/site-library')"
# use the master for now (waiting for a release which will include https://github.com/REditorSupport/languageserver/issues/77)
sudo Rscript -e "install.packages('remotes')"
sudo Rscript -e "remotes::install_github('REditorSupport/languageserver@master', upgrade='never')"
