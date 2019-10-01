mkdir -p "$HOME/lib/R/site-library"
if [ "$TRAVIS" == true ]; then
  echo "options(repos='http://cran.r-project.org')" > .Rprofile
fi
Rscript -e "install.packages('languageserver', lib='$HOME/lib/R/site-library')"
