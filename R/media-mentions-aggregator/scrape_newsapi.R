# NewsAPI Integration for Dr. Ian Adams Media Mentions
# Uses NewsAPI.org free tier (100 requests/day)

library(httr2)
library(jsonlite)
library(dplyr)
library(purrr)

source(here::here("R", "media-mentions-aggregator", "utils.R"))

#' Search NewsAPI for articles
#'
#' @param query Search query string
#' @param api_key NewsAPI key (from environment variable)
#' @param from_date Start date for search (YYYY-MM-DD)
#' @param log_file Path to log file
#' @return Data frame of articles
search_newsapi <- function(query, api_key = NULL, from_date = NULL, log_file = NULL) {
  # Get API key from environment if not provided
  if (is.null(api_key)) {
    api_key <- Sys.getenv("NEWSAPI_KEY")
  }

  if (api_key == "" || is.null(api_key)) {
    log_message("NewsAPI key not found - skipping NewsAPI search", log_file, "WARN")
    return(data.frame())
  }

  # Default to last 14 days if no date specified
  if (is.null(from_date)) {
    from_date <- format(Sys.Date() - 14, "%Y-%m-%d")
  }

  log_message(sprintf("Searching NewsAPI for: '%s' since %s", query, from_date), log_file)

  tryCatch(
    {
      # Build request
      response <- request("https://newsapi.org/v2/everything") %>%
        req_url_query(
          q = query,
          from = from_date,
          language = "en",
          sortBy = "publishedAt",
          pageSize = 100
        ) %>%
        req_headers(`X-Api-Key` = api_key) %>%
        req_timeout(30) %>%
        req_perform()

      # Parse response
      content <- resp_body_json(response)

      if (content$status != "ok") {
        log_message(sprintf("  NewsAPI error: %s", content$message %||% "Unknown error"), log_file, "ERROR")
        return(data.frame())
      }

      if (length(content$articles) == 0) {
        log_message(sprintf("  No articles found for '%s'", query), log_file)
        return(data.frame())
      }

      # Convert to data frame
      articles <- map_dfr(content$articles, function(article) {
        data.frame(
          url = article$url %||% NA,
          title = article$title %||% NA,
          summary = article$description %||% "",
          date_published = parse_date(article$publishedAt %||% NA),
          source = article$source$name %||% "Unknown",
          date_discovered = format(Sys.time(), "%Y-%m-%d"),
          stringsAsFactors = FALSE
        )
      })

      # Clean and filter
      articles <- articles %>%
        filter(!is.na(url), !is.na(title), url != "", title != "") %>%
        mutate(
          title = sapply(title, clean_text),
          summary = sapply(summary, clean_text)
        )

      log_message(sprintf("  Found %d articles from NewsAPI", nrow(articles)), log_file)

      return(articles)
    },
    error = function(e) {
      log_message(sprintf("  Error searching NewsAPI: %s", e$message), log_file, "ERROR")
      return(data.frame())
    }
  )
}

#' Search NewsAPI with multiple queries
#'
#' @param search_terms Vector of search terms
#' @param api_key NewsAPI key
#' @param from_date Start date for search
#' @param log_file Path to log file
#' @return Combined data frame of articles
search_newsapi_multiple <- function(search_terms, api_key = NULL, from_date = NULL, log_file = NULL) {
  log_message("Starting NewsAPI multi-query search", log_file)

  all_articles <- map_dfr(search_terms, function(term) {
    # Rate limiting (NewsAPI free tier allows 2 requests per second)
    Sys.sleep(1)

    search_newsapi(term, api_key, from_date, log_file)
  })

  # Remove duplicates
  if (nrow(all_articles) > 0) {
    all_articles <- all_articles %>%
      distinct(url, .keep_all = TRUE)

    log_message(sprintf("Total unique articles from NewsAPI: %d", nrow(all_articles)), log_file)
  } else {
    log_message("No articles found from NewsAPI", log_file, "WARN")
  }

  return(all_articles)
}
