# Story Processing and Filtering for Force Science News
# Filters articles for relevance, classifies, and extracts metadata

library(dplyr)
library(tidyr)
library(stringr)
library(purrr)

source(here::here("R", "force-science-aggregator", "utils.R"))

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

  # Calculate relevance scores and confidence
  articles <- articles %>%
    mutate(
      relevance_result = mapply(
        function(t, s) calculate_relevance_score(t, s, NULL),
        title,
        summary,
        SIMPLIFY = FALSE
      ),
      relevance_score = sapply(relevance_result, function(r) r$score),
      relevance_confidence = sapply(relevance_result, function(r) r$confidence)
    ) %>%
    select(-relevance_result)

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

  # Flag stories that need manual review
  # Review if: low confidence OR score in 0.3-0.5 range
  articles_filtered <- articles_filtered %>%
    mutate(
      needs_review = ifelse(
        relevance_confidence == "low" |
          (relevance_score >= 0.3 & relevance_score < 0.5),
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

  # International locations
  international <- c("Canada", "Ontario", "British Columbia", "Alberta",
                     "United Kingdom", "UK", "Britain", "Australia")

  # Look for city, state pattern
  city_state <- str_extract(text, "[A-Z][a-z]+(?:[ -][A-Z][a-z]+)?,\\s*(?:[A-Z]{2}|[A-Z][a-z]+)")
  if (!is.na(city_state)) return(city_state)

  # Look for US states
  for (state in us_states) {
    if (grepl(state, text, ignore.case = FALSE)) {
      return(state)
    }
  }

  # Look for international
  for (loc in international) {
    if (grepl(loc, text, ignore.case = FALSE)) {
      return(loc)
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

  # Exclusion 1: FSI's own publications
  fsi_sources <- c(
    "forcescience.com", "forcescience.org",
    "force science news", "fsi press release"
  )

  articles_filtered <- articles %>%
    filter(!sapply(tolower(paste(url, source, title)), function(text) {
      any(sapply(fsi_sources, function(src) grepl(src, text, fixed = TRUE)))
    }))

  removed_fsi <- original_count - nrow(articles_filtered)
  if (removed_fsi > 0) {
    log_message(sprintf("Removed %d FSI promotional content", removed_fsi), log_file)
  }

  # Exclusion 2: PoliceOne promotional content (unless controversial)
  # Keep if mentions controversy, criticism, or legal challenge
  policeone_count <- sum(grepl("police1|policeone", tolower(articles_filtered$source)))
  if (policeone_count > 0) {
    controversy_terms <- c(
      "critic", "controversy", "challenge", "lawsuit", "sued",
      "question", "debunk", "problem", "concern", "dispute"
    )

    articles_filtered <- articles_filtered %>%
      filter(
        !grepl("police1|policeone", tolower(source)) |
          sapply(tolower(paste(title, summary)), function(text) {
            any(sapply(controversy_terms, function(term) grepl(term, text, fixed = TRUE)))
          })
      )

    removed_policeone <- policeone_count - sum(grepl("police1|policeone", tolower(articles_filtered$source)))
    if (removed_policeone > 0) {
      log_message(sprintf("Removed %d PoliceOne promotional content", removed_policeone), log_file)
    }
  }

  # Exclusion 3: Generic training announcements
  # Remove if just a training announcement with Force Science as one vendor among many
  training_announcement_patterns <- c(
    "training schedule", "upcoming training", "training announcement",
    "register now", "sign up for training", "training course available"
  )

  articles_filtered <- articles_filtered %>%
    filter(
      !sapply(tolower(paste(title, summary)), function(text) {
        is_training_announcement <- any(sapply(training_announcement_patterns, function(p) grepl(p, text, fixed = TRUE)))
        # Keep if it has substantive content beyond announcement
        has_substantive <- grepl("controversy|lawsuit|critic|study|research|policy change|adopt", text)
        is_training_announcement && !has_substantive
      })
    )

  # Exclusion 4: Unrelated "human factors" or "action beats reaction" contexts
  # These terms appear in aviation, sports, gaming without police connection
  articles_filtered <- articles_filtered %>%
    filter(
      # If article contains these terms...
      !sapply(tolower(paste(title, summary)), function(text) {
        has_generic_term <- grepl("human factors|action beats reaction", text)
        # ...it must also have police context
        has_police_context <- grepl("police|officer|law enforcement|shooting|force|deputy|sheriff", text)
        has_generic_term && !has_police_context
      })
    )

  final_removed <- original_count - nrow(articles_filtered)
  if (final_removed > removed_fsi) {
    log_message(
      sprintf("Removed %d additional off-topic stories via negative filters",
              final_removed - removed_fsi),
      log_file
    )
  }

  return(articles_filtered)
}

#' Check if article is from deprioritized source
#'
#' @param source Source name
#' @param url Article URL
#' @return TRUE if should be deprioritized
is_deprioritized_source <- function(source, url) {
  deprioritized <- c(
    "police1", "policeone", "police magazine", "law officer",
    "officer.com", "policemag"
  )

  text <- tolower(paste(source, url))
  any(sapply(deprioritized, function(src) grepl(src, text, fixed = TRUE)))
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

  # Step 1: Apply negative filters (exclusion criteria)
  articles <- apply_negative_filters(raw_articles, log_file)

  # Step 2: Process and enrich
  min_score <- config$filtering$min_relevance_score %||% 0.3
  articles <- process_articles(articles, min_score, log_file)

  # Step 3: Sort by relevance score (highest first), then by confidence
  if (nrow(articles) > 0) {
    # Create confidence order factor
    articles <- articles %>%
      mutate(
        confidence_order = factor(relevance_confidence,
                                  levels = c("high", "medium", "low"),
                                  ordered = TRUE)
      ) %>%
      arrange(confidence_order, desc(relevance_score), desc(date_published)) %>%
      select(-confidence_order)
  }

  log_message(sprintf("Processing pipeline complete: %d articles ready", nrow(articles)), log_file)

  return(articles)
}
