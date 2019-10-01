mkdir -p "$HOME/lib/R/site-library"
Rscript -e "install.packages('languageserver', repos='http://cran.r-project.org', lib='$HOME/lib/R/site-library')"
