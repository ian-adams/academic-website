#!/usr/bin/env Rscript
# Main Pipeline for Dr. Ian Adams Media Mentions Aggregator
# Orchestrates the entire news gathering, processing, and output generation

library(here)
library(yaml)
library(dplyr)
library(DBI)

# Source all modules
source(here("R", "media-mentions-aggregator", "utils.R"))
source(here("R", "media-mentions-aggregator", "scrape_rss.R"))
source(here("R", "media-mentions-aggregator", "scrape_newsapi.R"))
source(here("R", "media-mentions-aggregator", "process_stories.R"))
source(here("R", "media-mentions-aggregator", "generate_output.R"))

#' Main pipeline execution
#'
#' @param config_path Path to configuration file
main <- function(config_path = NULL) {
  # Setup logging
  log_file <- setup_logging()
  log_message("=== Dr. Ian Adams Media Mentions Aggregator Pipeline Started ===", log_file)
  log_message(sprintf("Run time: %s", Sys.time()), log_file)

  # Load configuration
  if (is.null(config_path)) {
    config_path <- here("config", "media-mentions-sources.yaml")
  }

  if (!file.exists(config_path)) {
    log_message(sprintf("Configuration file not found: %s", config_path), log_file, "ERROR")
    stop("Configuration file not found")
  }

  config <- yaml::read_yaml(config_path)
  log_message("Configuration loaded", log_file)

  # Initialize database
  db_path <- here("data", "media-mentions", "stories.sqlite")
  con <- init_database(db_path)
  log_message(sprintf("Database initialized: %s", db_path), log_file)

  # Track statistics
  stats <- list(
    start_time = Sys.time(),
    total_fetched = 0,
    total_processed = 0,
    new_stories = 0,
    duplicates = 0,
    excluded = 0
  )

  tryCatch(
    {
      # Step 1: Scrape RSS feeds
      log_message("--- Step 1: Scraping RSS Feeds ---", log_file)
      rss_articles <- scrape_all_rss_feeds(config, log_file)
      stats$total_fetched <- stats$total_fetched + nrow(rss_articles)

      # Step 2: Search Google News RSS
      log_message("--- Step 2: Searching Google News ---", log_file)
      google_articles <- data.frame()
      if (!is.null(config$search_terms) && length(config$search_terms) > 0) {
        google_articles <- search_google_news_rss(config$search_terms, log_file)
        stats$total_fetched <- stats$total_fetched + nrow(google_articles)
      }

      # Step 3: Search NewsAPI (if enabled)
      log_message("--- Step 3: Searching NewsAPI ---", log_file)
      newsapi_articles <- data.frame()
      if (config$newsapi$enabled %||% FALSE) {
        newsapi_articles <- search_newsapi_multiple(
          config$search_terms,
          api_key = Sys.getenv("NEWSAPI_KEY"),
          from_date = format(Sys.Date() - (config$newsapi$days_back %||% 14), "%Y-%m-%d"),
          log_file = log_file
        )
        stats$total_fetched <- stats$total_fetched + nrow(newsapi_articles)
      } else {
        log_message("NewsAPI disabled in configuration", log_file)
      }

      # Step 4: Combine all articles
      log_message("--- Step 4: Combining Articles ---", log_file)
      all_articles <- bind_rows(
        rss_articles,
        google_articles,
        newsapi_articles
      )

      if (nrow(all_articles) == 0) {
        log_message("No articles found from any source", log_file, "WARN")
      } else {
        log_message(sprintf("Total articles fetched: %d", nrow(all_articles)), log_file)

        # Step 5: Deduplicate against database
        log_message("--- Step 5: Deduplication ---", log_file)
        new_articles <- deduplicate_stories(con, all_articles)
        stats$duplicates <- nrow(all_articles) - nrow(new_articles)
        log_message(sprintf("New articles after deduplication: %d (removed %d duplicates)",
          nrow(new_articles), stats$duplicates
        ), log_file)

        if (nrow(new_articles) > 0) {
          # Step 6: Process and filter articles (with name disambiguation)
          log_message("--- Step 6: Processing Articles (Name Disambiguation) ---", log_file)
          processed_articles <- main_processing_pipeline(new_articles, config, log_file)
          stats$total_processed <- nrow(processed_articles)

          if (nrow(processed_articles) > 0) {
            # Step 7: Save to database
            log_message("--- Step 7: Saving to Database ---", log_file)

            # Select only the columns that exist in the database
            db_columns <- c(
              "id", "url", "title", "source", "date_published", "date_discovered",
              "summary", "snippet", "mention_type", "story_type",
              "relevance_score", "relevance_confidence",
              "key_entities", "location", "tags", "topics", "full_text",
              "needs_review", "reviewed", "published_on_site", "featured"
            )

            processed_articles_db <- processed_articles %>%
              select(any_of(db_columns))

            # Write to database
            dbWriteTable(con, "stories", processed_articles_db, append = TRUE)
            stats$new_stories <- nrow(processed_articles)

            log_message(sprintf("Saved %d new stories to database", stats$new_stories), log_file)
          } else {
            log_message("No articles passed relevance filtering (name disambiguation)", log_file, "WARN")
          }
        }
      }

      # Step 8: Generate outputs
      log_message("--- Step 8: Generating Outputs ---", log_file)
      outputs <- generate_all_outputs(con, log_file)

      # Step 9: Generate statistics
      log_message("--- Step 9: Pipeline Statistics ---", log_file)
      stats$end_time <- Sys.time()
      stats$duration <- difftime(stats$end_time, stats$start_time, units = "secs")

      total_stories <- dbGetQuery(con, "SELECT COUNT(*) as count FROM stories")$count
      stories_needing_review <- dbGetQuery(
        con,
        "SELECT COUNT(*) as count FROM stories WHERE needs_review = 1 AND reviewed = 0"
      )$count
      featured_stories <- dbGetQuery(
        con,
        "SELECT COUNT(*) as count FROM stories WHERE featured = 1"
      )$count

      # Confidence breakdown
      confidence_stats <- dbGetQuery(
        con,
        "SELECT relevance_confidence, COUNT(*) as count FROM stories GROUP BY relevance_confidence"
      )

      # Mention type breakdown
      mention_stats <- dbGetQuery(
        con,
        "SELECT mention_type, COUNT(*) as count FROM stories GROUP BY mention_type"
      )

      log_message(sprintf("Total articles fetched: %d", stats$total_fetched), log_file)
      log_message(sprintf("Duplicates removed: %d", stats$duplicates), log_file)
      log_message(sprintf("Articles processed: %d", stats$total_processed), log_file)
      log_message(sprintf("New stories added: %d", stats$new_stories), log_file)
      log_message(sprintf("Total stories in database: %d", total_stories), log_file)
      log_message(sprintf("Featured stories: %d", featured_stories), log_file)
      log_message(sprintf("Stories needing review: %d", stories_needing_review), log_file)
      log_message(sprintf("Pipeline duration: %.2f seconds", as.numeric(stats$duration)), log_file)

      log_message("=== Pipeline Completed Successfully ===", log_file)
    },
    error = function(e) {
      log_message(sprintf("FATAL ERROR: %s", e$message), log_file, "ERROR")
      log_message(sprintf("Traceback: %s", paste(capture.output(traceback()), collapse = "\n")), log_file, "ERROR")
      stop(e)
    },
    finally = {
      # Always close database connection
      if (exists("con") && !is.null(con)) {
        dbDisconnect(con)
        log_message("Database connection closed", log_file)
      }
    }
  )

  return(invisible(stats))
}

# Run if called directly
if (!interactive()) {
  main()
}
