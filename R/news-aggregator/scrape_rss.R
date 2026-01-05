# RSS Feed Scraper for AI Police News
# Scrapes RSS feeds from news sources for relevant stories

library(tidyRSS)
library(dplyr)
library(purrr)
library(lubridate)
library(xml2)
library(httr2)

source(here::here("R", "news-aggregator", "utils.R"))

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

      # Standardize column names (RSS feeds have varying structures)
      articles <- feed_data %>%
        mutate(
          url = item_link %||% link %||% item_guid,
          title = item_title %||% title,
          summary = item_description %||% description %||% "",
          date_published = item_pub_date %||% item_date %||% pubDate %||% NA,
          source = source_name,
          date_discovered = format(Sys.time(), "%Y-%m-%d")
        ) %>%
        select(url, title, summary, date_published, source, date_discovered) %>%
        # Remove any rows with missing critical fields
        filter(!is.na(url), !is.na(title), url != "", title != "")

      # Clean text fields
      articles <- articles %>%
        mutate(
          title = sapply(title, clean_text),
          summary = sapply(summary, clean_text),
          date_published = sapply(date_published, parse_date)
        )

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

  all_articles <- map_dfr(search_terms, function(term) {
    # Rate limiting
    Sys.sleep(2)

    # Google News RSS URL
    encoded_term <- URLencode(term)
    feed_url <- sprintf("https://news.google.com/rss/search?q=%s&hl=en-US&gl=US&ceid=US:en", encoded_term)

    log_message(sprintf("  Searching for: '%s'", term), log_file)

    tryCatch(
      {
        articles <- scrape_single_rss(feed_url, "Google News", log_file)

        if (nrow(articles) > 0) {
          articles$search_term <- term
        }

        return(articles)
      },
      error = function(e) {
        log_message(sprintf("  Error searching Google News for '%s': %s", term, e$message), log_file, "ERROR")
        return(data.frame())
      }
    )
  })

  # Remove duplicates from multiple search terms
  if (nrow(all_articles) > 0) {
    all_articles <- all_articles %>%
      distinct(url, .keep_all = TRUE)

    log_message(sprintf("Total unique articles from Google News: %d", nrow(all_articles)), log_file)
  }

  return(all_articles)
}
