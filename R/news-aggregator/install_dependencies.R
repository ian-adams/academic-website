#!/usr/bin/env Rscript
# Install R package dependencies for AI Police News Aggregator

cat("Installing R package dependencies for AI Police News Aggregator...\n\n")

required_packages <- c(
  'here',
  'yaml',
  'dplyr',
  'tidyr',
  'stringr',
  'purrr',
  'lubridate',
  'httr2',
  'jsonlite',
  'xml2',
  'tidyRSS',
  'DBI',
  'RSQLite',
  'digest'
)

cat("Required packages:\n")
cat(paste("  -", required_packages), sep = "\n")
cat("\n")

# Check which packages are already installed
installed <- rownames(installed.packages())
to_install <- required_packages[!required_packages %in% installed]

if (length(to_install) == 0) {
  cat("All packages already installed!\n")
} else {
  cat("Installing", length(to_install), "packages...\n\n")

  for (pkg in to_install) {
    cat("Installing", pkg, "...\n")
    install.packages(pkg, repos = "https://cloud.r-project.org", quiet = TRUE)
  }

  cat("\nInstallation complete!\n")
}

cat("\nVerifying installation...\n")
failed <- c()
for (pkg in required_packages) {
  if (!requireNamespace(pkg, quietly = TRUE)) {
    failed <- c(failed, pkg)
  }
}

if (length(failed) > 0) {
  cat("\nERROR: Failed to install:", paste(failed, collapse = ", "), "\n")
  cat("Try installing manually:\n")
  cat("  install.packages(c('", paste(failed, collapse = "', '"), "'))\n", sep = "")
} else {
  cat("✓ All packages successfully installed!\n")
  cat("\nNext steps:\n")
  cat("1. Test configuration: Rscript R/news-aggregator/test_config.R\n")
  cat("2. Run pipeline: Rscript R/news-aggregator/run_pipeline.R\n")
}
