# RSS Feed Scraper for Dr. Ian Adams Media Mentions
# Scrapes RSS feeds from news sources for relevant stories

library(tidyRSS)
library(dplyr)
library(purrr)
library(lubridate)
library(xml2)
library(httr2)

source(here::here("R", "media-mentions-aggregator", "utils.R"))

#' Scrape a single RSS feed
#'
#' @param feed_url URL of RSS feed
#' @param source_name Name of the source
#' @param log_file Path to log file
#' @return Data frame of articles
scrape_single_rss <- function(feed_url, source_name, log_file = NULL) {
  log_message(sprintf("Scraping RSS feed: %s (%s)", source_name, feed_url), log_file)

  tryCatch(
    {
      # Fetch feed
      feed_data <- tidyfeed(feed_url)

      if (nrow(feed_data) == 0) {
        log_message(sprintf("  No items found in %s", source_name), log_file, "WARN")
        return(data.frame())
      }

      # Get column names
      cols <- names(feed_data)

      # Extract URL - try common column names
      url <- NULL
      for (col in c("item_link", "link", "item_guid", "guid")) {
        if (col %in% cols && is.null(url)) {
          url <- feed_data[[col]]
        }
      }

      # Extract title
      title <- NULL
      for (col in c("item_title", "title")) {
        if (col %in% cols && is.null(title)) {
          title <- feed_data[[col]]
        }
      }

      # Extract description/summary
      summary <- NULL
      for (col in c("item_description", "description", "item_summary", "summary", "content")) {
        if (col %in% cols && is.null(summary)) {
          summary <- feed_data[[col]]
        }
      }
      if (is.null(summary)) summary <- ""

      # Extract publication date
      date_pub <- NULL
      for (col in c("item_pub_date", "item_date", "pubDate", "pub_date", "published", "item_published")) {
        if (col %in% cols && is.null(date_pub)) {
          date_pub <- feed_data[[col]]
        }
      }

      # Create standardized data frame
      articles <- data.frame(
        url = as.character(url),
        title = as.character(title),
        summary = as.character(summary),
        date_published_raw = if (!is.null(date_pub)) as.character(date_pub) else NA_character_,
        source = source_name,
        date_discovered = format(Sys.time(), "%Y-%m-%d"),
        stringsAsFactors = FALSE
      )

      # Remove rows with missing critical fields
      articles <- articles %>%
        filter(
          !is.na(url), !is.na(title),
          url != "", title != "",
          url != "NULL", title != "NULL"
        )

      if (nrow(articles) == 0) {
        log_message(sprintf("  No valid items found in %s", source_name), log_file, "WARN")
        return(data.frame())
      }

      # Clean text fields and parse dates
      articles <- articles %>%
        mutate(
          title = sapply(title, clean_text),
          summary = sapply(summary, clean_text),
          date_published = sapply(date_published_raw, parse_date)
        ) %>%
        select(-date_published_raw)

      log_message(sprintf("  Found %d items from %s", nrow(articles), source_name), log_file)

      return(articles)
    },
    error = function(e) {
      log_message(sprintf("  Error scraping %s: %s", source_name, e$message), log_file, "ERROR")
      return(data.frame())
    }
  )
}

#' Scrape all RSS feeds from configuration
#'
#' @param config Configuration list with RSS feed URLs
#' @param log_file Path to log file
#' @return Combined data frame of all articles
scrape_all_rss_feeds <- function(config, log_file = NULL) {
  log_message("Starting RSS feed scraping", log_file)

  rss_feeds <- config$rss_feeds

  if (is.null(rss_feeds) || length(rss_feeds) == 0) {
    log_message("No RSS feeds configured", log_file, "WARN")
    return(data.frame())
  }

  all_articles <- map_dfr(seq_along(rss_feeds), function(i) {
    feed <- rss_feeds[[i]]
    # Rate limiting
    if (i > 1) Sys.sleep(2)

    scrape_single_rss(feed$url, feed$name, log_file)
  })

  if (nrow(all_articles) > 0) {
    log_message(sprintf("Total articles from RSS feeds: %d", nrow(all_articles)), log_file)
  } else {
    log_message("No articles found from any RSS feed", log_file, "WARN")
  }

  return(all_articles)
}

#' Search Google News RSS for specific terms
#'
#' @param search_terms Vector of search terms
#' @param log_file Path to log file
#' @return Data frame of articles
search_google_news_rss <- function(search_terms, log_file = NULL) {
  log_message("Searching Google News RSS", log_file)

  total_attempts <- 0
  successful_searches <- 0

  all_articles <- map_dfr(search_terms, function(term) {
    total_attempts <<- total_attempts + 1

    # Rate limiting - slightly longer delay to avoid rate limits
    Sys.sleep(3)

    # Google News RSS URL - try multiple URL formats for better reliability
    encoded_term <- URLencode(term)

    # Primary URL format
    feed_url <- sprintf("https://news.google.com/rss/search?q=%s&hl=en-US&gl=US&ceid=US:en", encoded_term)

    log_message(sprintf("  Searching for: '%s'", term), log_file)

    result <- tryCatch(
      {
        articles <- scrape_single_rss(feed_url, "Google News", log_file)

        if (nrow(articles) > 0) {
          articles$search_term <- term
          successful_searches <<- successful_searches + 1
          log_message(sprintf("    Found %d articles for '%s'", nrow(articles), term), log_file)
        } else {
          log_message(sprintf("    No articles found for '%s'", term), log_file, "WARN")
        }

        return(articles)
      },
      error = function(e) {
        log_message(sprintf("  Error searching Google News for '%s': %s", term, e$message), log_file, "ERROR")

        # Try alternate URL format on error
        alt_url <- sprintf("https://news.google.com/rss/search?q=%s&when=30d", encoded_term)
        Sys.sleep(2)

        tryCatch({
          articles <- scrape_single_rss(alt_url, "Google News (alt)", log_file)
          if (nrow(articles) > 0) {
            articles$search_term <- term
            successful_searches <<- successful_searches + 1
          }
          return(articles)
        }, error = function(e2) {
          log_message(sprintf("  Alternate search also failed for '%s': %s", term, e2$message), log_file, "ERROR")
          return(data.frame())
        })
      }
    )

    return(result)
  })

  # Log search statistics
  log_message(sprintf("Google News search complete: %d/%d searches returned results",
                      successful_searches, total_attempts), log_file)

  # Remove duplicates from multiple search terms
  if (nrow(all_articles) > 0) {
    all_articles <- all_articles %>%
      distinct(url, .keep_all = TRUE)

    log_message(sprintf("Total unique articles from Google News: %d", nrow(all_articles)), log_file)
  } else {
    log_message("WARNING: Google News returned 0 total articles. This may indicate rate limiting or connectivity issues.", log_file, "WARN")
  }

  return(all_articles)
}
