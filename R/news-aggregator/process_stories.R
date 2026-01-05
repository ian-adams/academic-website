# Story Processing and Filtering
# Filters articles for relevance, classifies, and extracts metadata

library(dplyr)
library(tidyr)
library(stringr)
library(purrr)

source(here::here("R", "news-aggregator", "utils.R"))

#' Process raw articles: filter, classify, and enrich
#'
#' @param articles Data frame of raw articles
#' @param min_relevance_score Minimum relevance score to keep (default 0.3)
#' @param log_file Path to log file
#' @return Processed data frame
process_articles <- function(articles, min_relevance_score = 0.3, log_file = NULL) {
  if (nrow(articles) == 0) {
    log_message("No articles to process", log_file)
    return(data.frame())
  }

  log_message(sprintf("Processing %d raw articles", nrow(articles)), log_file)

  # Calculate relevance scores
  articles <- articles %>%
    mutate(
      relevance_score = mapply(
        calculate_relevance_score,
        title,
        summary,
        MoreArgs = list(full_text = NULL)
      )
    )

  # Filter by minimum relevance
  articles_filtered <- articles %>%
    filter(relevance_score >= min_relevance_score)

  log_message(
    sprintf(
      "After relevance filtering (>= %.2f): %d articles (removed %d)",
      min_relevance_score,
      nrow(articles_filtered),
      nrow(articles) - nrow(articles_filtered)
    ),
    log_file
  )

  if (nrow(articles_filtered) == 0) {
    return(data.frame())
  }

  # Classify story types
  articles_filtered <- articles_filtered %>%
    mutate(
      story_type = mapply(classify_story_type, title, summary)
    )

  # Extract entities and tags
  articles_filtered <- articles_filtered %>%
    mutate(
      key_entities = sapply(paste(title, summary), extract_entities),
      tags = sapply(paste(title, summary), function(text) {
        paste(extract_keywords(text), collapse = ", ")
      })
    )

  # Extract location if possible
  articles_filtered <- articles_filtered %>%
    mutate(
      location = sapply(paste(title, summary), extract_location)
    )

  # Flag stories that need manual review (0.4 - 0.7 range)
  articles_filtered <- articles_filtered %>%
    mutate(
      needs_review = ifelse(relevance_score >= 0.4 & relevance_score < 0.7, 1, 0)
    )

  # Generate unique IDs
  articles_filtered <- articles_filtered %>%
    mutate(
      id = sapply(url, generate_story_id)
    )

  # Add metadata fields
  articles_filtered <- articles_filtered %>%
    mutate(
      reviewed = 0,
      published_on_site = 1,
      full_text = NA_character_
    )

  log_message(
    sprintf(
      "Story type breakdown: %s",
      paste(
        capture.output(table(articles_filtered$story_type)),
        collapse = "; "
      )
    ),
    log_file
  )

  log_message(
    sprintf("Stories flagged for review: %d", sum(articles_filtered$needs_review)),
    log_file
  )

  return(articles_filtered)
}

#' Extract location from text using simple pattern matching
#'
#' @param text Input text
#' @return Location string or empty string
extract_location <- function(text) {
  if (is.null(text) || is.na(text) || text == "") return("")

  # US state abbreviations and names
  us_states <- c(
    "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
    "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho",
    "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana",
    "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota",
    "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada",
    "New Hampshire", "New Jersey", "New Mexico", "New York",
    "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon",
    "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
    "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington",
    "West Virginia", "Wisconsin", "Wyoming", "Washington DC", "D.C."
  )

  # Look for city, state pattern
  city_state <- str_extract(text, "[A-Z][a-z]+(?:[ -][A-Z][a-z]+)?,\\s*(?:[A-Z]{2}|[A-Z][a-z]+)")
  if (!is.na(city_state)) return(city_state)

  # Look for just states
  for (state in us_states) {
    if (grepl(state, text, ignore.case = FALSE)) {
      return(state)
    }
  }

  return("")
}

#' Filter out stories that are too generic or off-topic
#'
#' @param articles Data frame of articles
#' @param log_file Path to log file
#' @return Filtered data frame
apply_negative_filters <- function(articles, log_file = NULL) {
  if (nrow(articles) == 0) return(articles)

  original_count <- nrow(articles)

  # Negative keywords that indicate off-topic stories
  negative_patterns <- c(
    "facial recognition",
    "predictive policing",
    "license plate reader",
    "gunshot detection",
    "surveillance camera",
    "crime prediction",
    "risk assessment",
    "gang database"
  )

  # Only filter if the story is ONLY about these topics and doesn't mention reports
  articles_filtered <- articles %>%
    filter(
      !(
        str_detect(tolower(paste(title, summary)), paste(negative_patterns, collapse = "|")) &
          !str_detect(tolower(paste(title, summary)), "report")
      )
    )

  removed <- original_count - nrow(articles_filtered)
  if (removed > 0) {
    log_message(sprintf("Removed %d off-topic stories via negative filters", removed), log_file)
  }

  return(articles_filtered)
}

#' Enhance stories with additional context from full article text
#' (Placeholder for future enhancement - would require web scraping)
#'
#' @param articles Data frame of articles
#' @param log_file Path to log file
#' @return Enhanced articles
enhance_with_full_text <- function(articles, log_file = NULL) {
  # This is a placeholder for future enhancement
  # Would fetch full article text and improve relevance scoring
  # For now, just return articles as-is

  log_message("Full text enhancement not yet implemented", log_file)
  return(articles)
}

#' Main processing pipeline
#'
#' @param raw_articles Data frame of raw articles
#' @param config Configuration list
#' @param log_file Path to log file
#' @return Processed articles ready for database
main_processing_pipeline <- function(raw_articles, config, log_file = NULL) {
  if (nrow(raw_articles) == 0) {
    log_message("No articles to process in pipeline", log_file)
    return(data.frame())
  }

  log_message("Starting processing pipeline", log_file)

  # Step 1: Apply negative filters
  articles <- apply_negative_filters(raw_articles, log_file)

  # Step 2: Process and enrich
  min_score <- config$filtering$min_relevance_score %||% 0.3
  articles <- process_articles(articles, min_score, log_file)

  # Step 3: Sort by relevance score (highest first)
  if (nrow(articles) > 0) {
    articles <- articles %>%
      arrange(desc(relevance_score), desc(date_published))
  }

  log_message(sprintf("Processing pipeline complete: %d articles ready", nrow(articles)), log_file)

  return(articles)
}
