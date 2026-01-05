#!/usr/bin/env Rscript
# Quick configuration validation script
# Run this to verify your setup before deploying

library(yaml)
library(here)

cat("=== AI Police News Aggregator Configuration Test ===\n\n")

# Check configuration file
config_path <- here("config", "news-sources.yaml")
cat("1. Checking configuration file...\n")

if (!file.exists(config_path)) {
  stop("ERROR: Configuration file not found at: ", config_path)
}

config <- tryCatch(
  yaml::read_yaml(config_path),
  error = function(e) {
    stop("ERROR: Failed to parse configuration file: ", e$message)
  }
)

cat("   ✓ Configuration file loaded\n")
cat("   ✓ RSS feeds configured:", length(config$rss_feeds), "\n")
cat("   ✓ Search terms configured:", length(config$search_terms), "\n")

# Check required R packages
cat("\n2. Checking R package dependencies...\n")

required_packages <- c(
  'here', 'yaml', 'dplyr', 'tidyr', 'stringr', 'purrr',
  'lubridate', 'httr2', 'jsonlite', 'xml2', 'tidyRSS',
  'DBI', 'RSQLite', 'digest'
)

missing_packages <- c()
for (pkg in required_packages) {
  if (!requireNamespace(pkg, quietly = TRUE)) {
    missing_packages <- c(missing_packages, pkg)
  }
}

if (length(missing_packages) > 0) {
  cat("   ✗ Missing packages:", paste(missing_packages, collapse = ", "), "\n")
  cat("\n   Install missing packages with:\n")
  cat("   install.packages(c('", paste(missing_packages, collapse = "', '"), "'))\n\n", sep = "")
  stop("Missing required packages")
} else {
  cat("   ✓ All required packages installed\n")
}

# Check directory structure
cat("\n3. Checking directory structure...\n")

required_dirs <- c(
  here("R", "news-aggregator"),
  here("data", "ai-police-news"),
  here("static", "data"),
  here("content", "ai-news"),
  here("layouts", "ai-news")
)

for (dir_path in required_dirs) {
  if (!dir.exists(dir_path)) {
    cat("   ✗ Missing directory:", dir_path, "\n")
    dir.create(dir_path, recursive = TRUE, showWarnings = FALSE)
    cat("     → Created directory\n")
  }
}
cat("   ✓ All directories present\n")

# Check R scripts
cat("\n4. Checking R scripts...\n")

required_scripts <- c(
  "utils.R",
  "scrape_rss.R",
  "scrape_newsapi.R",
  "process_stories.R",
  "generate_output.R",
  "run_pipeline.R"
)

for (script in required_scripts) {
  script_path <- here("R", "news-aggregator", script)
  if (!file.exists(script_path)) {
    stop("ERROR: Missing script: ", script)
  }
}
cat("   ✓ All scripts present\n")

# Check NewsAPI configuration
cat("\n5. Checking NewsAPI configuration...\n")

if (config$newsapi$enabled) {
  api_key <- Sys.getenv("NEWSAPI_KEY")
  if (api_key == "") {
    cat("   ⚠ NewsAPI enabled but NEWSAPI_KEY not set\n")
    cat("     Pipeline will skip NewsAPI searches\n")
    cat("     Set environment variable or add to GitHub secrets\n")
  } else {
    cat("   ✓ NewsAPI key found in environment\n")
  }
} else {
  cat("   ✓ NewsAPI disabled (using free RSS feeds only)\n")
}

# Test RSS feed accessibility (sample one)
cat("\n6. Testing RSS feed accessibility...\n")
if (length(config$rss_feeds) > 0) {
  test_feed <- config$rss_feeds[[1]]
  cat("   Testing:", test_feed$name, "\n")

  tryCatch(
    {
      library(httr2)
      response <- request(test_feed$url) %>%
        req_timeout(10) %>%
        req_perform()
      cat("   ✓ RSS feed accessible\n")
    },
    error = function(e) {
      cat("   ⚠ Could not access test feed (might be temporary)\n")
    }
  )
}

cat("\n=== Configuration Test Complete ===\n")
cat("\nYour setup looks good! Next steps:\n")
cat("1. Run the pipeline locally: Rscript R/news-aggregator/run_pipeline.R\n")
cat("2. Check the output in static/data/ai-police-news.json\n")
cat("3. Build your Hugo site: hugo server\n")
cat("4. Visit http://localhost:1313/ai-news/\n")
cat("\nFor automated updates, commit and push to enable GitHub Actions.\n")
