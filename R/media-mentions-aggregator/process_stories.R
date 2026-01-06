# Story Processing and Filtering for Dr. Ian Adams Media Mentions
# Filters articles for relevance with aggressive name disambiguation

library(dplyr)
library(tidyr)
library(stringr)
library(purrr)

source(here::here("R", "media-mentions-aggregator", "utils.R"))

#' Process raw articles: filter, classify, and enrich
#'
#' @param articles Data frame of raw articles
#' @param min_relevance_score Minimum relevance score to keep (default 0.35)
#' @param log_file Path to log file
#' @return Processed data frame
process_articles <- function(articles, min_relevance_score = 0.35, log_file = NULL) {
  if (nrow(articles) == 0) {
    log_message("No articles to process", log_file)
    return(data.frame())
  }

  log_message(sprintf("Processing %d raw articles", nrow(articles)), log_file)

  # Calculate relevance scores and confidence with name disambiguation
  articles <- articles %>%
    mutate(
      relevance_result = mapply(
        function(t, s) calculate_relevance_score(t, s, NULL),
        title,
        summary,
        SIMPLIFY = FALSE
      ),
      relevance_score = sapply(relevance_result, function(r) r$score),
      relevance_confidence = sapply(relevance_result, function(r) r$confidence),
      exclusion_reason = sapply(relevance_result, function(r) r$exclusion_reason %||% NA_character_)
    ) %>%
    select(-relevance_result)

  # Log exclusion statistics
  exclusion_counts <- table(articles$exclusion_reason, useNA = "ifany")
  if (length(exclusion_counts) > 0) {
    log_message(sprintf("Exclusion breakdown: %s",
      paste(capture.output(exclusion_counts), collapse = "; ")
    ), log_file)
  }

  # Filter out explicitly excluded articles (wrong Ian Adams)
  articles_not_excluded <- articles %>%
    filter(relevance_confidence != "excluded" | is.na(relevance_confidence))

  excluded_count <- nrow(articles) - nrow(articles_not_excluded)
  if (excluded_count > 0) {
    log_message(sprintf("Excluded %d articles (wrong Ian Adams)", excluded_count), log_file)
  }

  # Filter by minimum relevance
  articles_filtered <- articles_not_excluded %>%
    filter(relevance_score >= min_relevance_score)

  log_message(
    sprintf(
      "After relevance filtering (>= %.2f): %d articles (removed %d)",
      min_relevance_score,
      nrow(articles_filtered),
      nrow(articles_not_excluded) - nrow(articles_filtered)
    ),
    log_file
  )

  if (nrow(articles_filtered) == 0) {
    return(data.frame())
  }

  # Classify mention and story types
  articles_filtered <- articles_filtered %>%
    mutate(
      mention_type = mapply(classify_mention_type, title, summary),
      story_type = mapply(classify_story_type, title, summary)
    )

  # Extract topics, entities, and tags
  articles_filtered <- articles_filtered %>%
    mutate(
      topics = sapply(paste(title, summary), extract_topics),
      key_entities = sapply(paste(title, summary), extract_entities),
      tags = sapply(paste(title, summary), function(text) {
        paste(extract_keywords(text), collapse = ", ")
      }),
      snippet = sapply(summary, extract_mention_snippet)
    )

  # Extract location if possible
  articles_filtered <- articles_filtered %>%
    mutate(
      location = sapply(paste(title, summary), extract_location)
    )

  # Flag stories that need manual review
  # Review if: medium confidence OR score in borderline range
  articles_filtered <- articles_filtered %>%
    mutate(
      needs_review = ifelse(
        relevance_confidence == "medium" |
          relevance_confidence == "low" |
          (relevance_score >= 0.35 & relevance_score < 0.55),
        1, 0
      )
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
      featured = 0,
      full_text = NA_character_
    )

  # Remove exclusion_reason column (no longer needed)
  articles_filtered <- articles_filtered %>%
    select(-exclusion_reason)

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
    sprintf(
      "Mention type breakdown: %s",
      paste(
        capture.output(table(articles_filtered$mention_type)),
        collapse = "; "
      )
    ),
    log_file
  )

  log_message(
    sprintf(
      "Relevance confidence breakdown: High=%d, Medium=%d, Low=%d",
      sum(articles_filtered$relevance_confidence == "high"),
      sum(articles_filtered$relevance_confidence == "medium"),
      sum(articles_filtered$relevance_confidence == "low")
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

  # Look for US states
  for (state in us_states) {
    if (grepl(state, text, ignore.case = FALSE)) {
      return(state)
    }
  }

  return("")
}

#' Filter out stories that match exclusion criteria
#'
#' @param articles Data frame of articles
#' @param log_file Path to log file
#' @return Filtered data frame
apply_negative_filters <- function(articles, log_file = NULL) {
  if (nrow(articles) == 0) return(articles)

  original_count <- nrow(articles)

  # Exclusion 1: Press release aggregators and content farms
  spam_sources <- c(
    "prweb.com", "prnewswire", "businesswire", "globenewswire",
    "pr.com", "prlog.org", "24-7pressrelease"
  )

  articles_filtered <- articles %>%
    filter(!sapply(tolower(paste(url, source)), function(text) {
      any(sapply(spam_sources, function(src) grepl(src, text, fixed = TRUE)))
    }))

  removed_spam <- original_count - nrow(articles_filtered)
  if (removed_spam > 0) {
    log_message(sprintf("Removed %d press release/spam content", removed_spam), log_file)
  }

  # Exclusion 2: Definitive wrong Ian Adams contexts
  # (This is also handled in calculate_relevance_score, but double-checking here)

  # Sports context filter
  articles_filtered <- articles_filtered %>%
    filter(
      !sapply(tolower(paste(title, summary)), function(text) {
        has_sports <- grepl("rugby|cricket|scored.*match|match.*scored|wicket|goalkeeper|midfielder", text)
        has_police <- grepl("police|law enforcement|criminal|officer", text)
        has_sports && !has_police
      })
    )

  # Entertainment context filter
  articles_filtered <- articles_filtered %>%
    filter(
      !sapply(tolower(paste(title, summary)), function(text) {
        has_entertainment <- grepl("album|concert tour|movie.*starring|starring.*movie|band.*tour", text)
        has_police <- grepl("police|law enforcement|criminal|officer", text)
        has_entertainment && !has_police
      })
    )

  final_removed <- original_count - nrow(articles_filtered)
  if (final_removed > removed_spam) {
    log_message(
      sprintf("Removed %d additional off-topic stories via negative filters",
              final_removed - removed_spam),
      log_file
    )
  }

  return(articles_filtered)
}

#' Check if article is from high-priority source
#'
#' @param source Source name
#' @param url Article URL
#' @return Priority level (1, 2, 3, or 0 for deprioritized)
get_source_priority <- function(source, url) {
  text <- tolower(paste(source, url))

  tier1 <- c(
    "npr", "new york times", "nytimes", "washington post", "washingtonpost",
    "associated press", "apnews", "reuters", "wired", "mit technology review"
  )

  tier2 <- c(
    "the state", "post and courier", "marshall project", "the conversation",
    "govtech", "ars technica", "arstechnica"
  )

  tier3 <- c(
    "police1", "eurekalert", "university"
  )

  if (any(sapply(tier1, function(src) grepl(src, text, fixed = TRUE)))) {
    return(1)
  } else if (any(sapply(tier2, function(src) grepl(src, text, fixed = TRUE)))) {
    return(2)
  } else if (any(sapply(tier3, function(src) grepl(src, text, fixed = TRUE)))) {
    return(3)
  }

  return(4)  # Default priority
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

  # Step 1: Apply negative filters (exclusion criteria)
  articles <- apply_negative_filters(raw_articles, log_file)

  # Step 2: Process and enrich with name disambiguation
  min_score <- config$filtering$min_relevance_score %||% 0.35
  articles <- process_articles(articles, min_score, log_file)

  # Step 3: Sort by confidence (high first), then relevance score, then date
  if (nrow(articles) > 0) {
    articles <- articles %>%
      mutate(
        confidence_order = factor(relevance_confidence,
                                  levels = c("high", "medium", "low"),
                                  ordered = TRUE),
        source_priority = mapply(get_source_priority, source, url)
      ) %>%
      arrange(confidence_order, source_priority, desc(relevance_score), desc(date_published)) %>%
      select(-confidence_order, -source_priority)
  }

  log_message(sprintf("Processing pipeline complete: %d articles ready", nrow(articles)), log_file)

  return(articles)
}
