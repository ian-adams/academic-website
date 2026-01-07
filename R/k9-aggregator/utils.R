# Utility Functions for Police K9 Incident Aggregator
# Author: Research Watch System
# Purpose: Helper functions for data processing, logging, and API interactions

library(httr2)
library(dplyr)
library(tidyr)
library(stringr)
library(lubridate)
library(DBI)
library(RSQLite)
library(jsonlite)
library(digest)

#' Setup logging directory and return log file path
#'
#' @return Path to log file
setup_logging <- function() {
  log_dir <- here::here("data", "k9-incidents", "logs")
  dir.create(log_dir, showWarnings = FALSE, recursive = TRUE)

  log_file <- file.path(
    log_dir,
    paste0("run_", format(Sys.time(), "%Y%m%d_%H%M%S"), ".log")
  )

  return(log_file)
}

#' Write message to log file and console
#'
#' @param msg Message to log
#' @param log_file Path to log file
#' @param level Log level (INFO, WARN, ERROR)
log_message <- function(msg, log_file = NULL, level = "INFO") {
  timestamp <- format(Sys.time(), "%Y-%m-%d %H:%M:%S")
  formatted_msg <- sprintf("[%s] %s: %s", timestamp, level, msg)

  message(formatted_msg)

  if (!is.null(log_file)) {
    cat(formatted_msg, "\n", file = log_file, append = TRUE)
  }
}

#' Initialize or connect to SQLite database
#'
#' @param db_path Path to database file
#' @return DBI connection object
init_database <- function(db_path = here::here("data", "k9-incidents", "stories.sqlite")) {
  dir.create(dirname(db_path), showWarnings = FALSE, recursive = TRUE)

  con <- dbConnect(RSQLite::SQLite(), db_path)

  # Create stories table if it doesn't exist
  dbExecute(con, "
    CREATE TABLE IF NOT EXISTS stories (
      id TEXT PRIMARY KEY,
      url TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      source TEXT,
      date_published TEXT,
      date_discovered TEXT NOT NULL,
      summary TEXT,
      story_type TEXT,
      relevance_score REAL,
      key_entities TEXT,
      location TEXT,
      tags TEXT,
      full_text TEXT,
      needs_review INTEGER DEFAULT 0,
      reviewed INTEGER DEFAULT 0,
      published_on_site INTEGER DEFAULT 1
    )
  ")

  # Create index on URL for faster deduplication
  dbExecute(con, "
    CREATE INDEX IF NOT EXISTS idx_url ON stories(url)
  ")

  # Create index on date_published for sorting
  dbExecute(con, "
    CREATE INDEX IF NOT EXISTS idx_date_published ON stories(date_published DESC)
  ")

  return(con)
}

#' Normalize URL for deduplication
#'
#' @param url URL string
#' @return Normalized URL
normalize_url <- function(url) {
  if (is.null(url) || is.na(url) || url == "") return("")

  url <- tolower(url)
  # Remove trailing slashes
  url <- sub("/$", "", url)
  # Remove URL parameters (everything after ?)
  url <- sub("\\?.*$", "", url)
  # Remove anchors
  url <- sub("#.*$", "", url)

  return(url)
}

#' Seed database from existing JSON file
#' This ensures historical stories persist even if cache fails
#' CRITICAL: This is the key to persistent story retention
#'
#' @param con Database connection
#' @param json_path Path to existing JSON file
#' @param log_file Path to log file
#' @return Number of stories seeded
seed_database_from_json <- function(con, json_path = NULL, log_file = NULL) {
  if (is.null(json_path)) {
    json_path <- here::here("static", "data", "k9-incidents.json")
  }

  if (!file.exists(json_path)) {
    log_message("No existing JSON file found to seed database", log_file)
    return(0)
  }

  # Check if database already has stories (cache was restored)
  existing_count <- dbGetQuery(con, "SELECT COUNT(*) as count FROM stories")$count
  if (existing_count > 0) {
    log_message(sprintf("Database already has %d stories from cache, skipping seed", existing_count), log_file)
    return(existing_count)
  }

  log_message("Seeding database from existing JSON file (ensures story retention)", log_file)

  tryCatch({
    json_data <- fromJSON(json_path, flatten = TRUE)

    if (is.null(json_data$stories) || length(json_data$stories) == 0) {
      log_message("JSON file contains no stories", log_file, "WARN")
      return(0)
    }

    stories <- as.data.frame(json_data$stories, stringsAsFactors = FALSE)

    # Ensure required columns exist
    if (!"date_discovered" %in% names(stories)) {
      stories$date_discovered <- format(Sys.Date(), "%Y-%m-%d")
    }
    if (!"id" %in% names(stories)) {
      stories$id <- sapply(stories$url, generate_story_id)
    }

    # Handle list columns (convert to comma-separated strings)
    list_cols <- c("tags", "key_entities")
    for (col in list_cols) {
      if (col %in% names(stories) && is.list(stories[[col]])) {
        stories[[col]] <- sapply(stories[[col]], function(x) {
          if (is.null(x) || length(x) == 0) return("")
          paste(unlist(x), collapse = ", ")
        })
      }
    }

    # Rename date to date_published if needed
    if ("date" %in% names(stories) && !"date_published" %in% names(stories)) {
      stories$date_published <- stories$date
    }

    # Add missing columns with defaults
    db_columns <- c(
      "id", "url", "title", "source", "date_published", "date_discovered",
      "summary", "story_type", "relevance_score", "key_entities",
      "location", "tags", "full_text", "needs_review", "reviewed",
      "published_on_site"
    )

    for (col in db_columns) {
      if (!col %in% names(stories)) {
        stories[[col]] <- NA
      }
    }

    # Set defaults for integer columns
    stories$needs_review[is.na(stories$needs_review)] <- 0
    stories$reviewed[is.na(stories$reviewed)] <- 0
    stories$published_on_site[is.na(stories$published_on_site)] <- 1

    # Select only database columns
    stories <- stories[, db_columns, drop = FALSE]

    # Insert into database
    dbWriteTable(con, "stories", stories, append = TRUE)

    inserted_count <- nrow(stories)
    log_message(sprintf("Seeded database with %d historical stories from JSON", inserted_count), log_file)

    return(inserted_count)
  }, error = function(e) {
    log_message(sprintf("Error seeding database from JSON: %s", e$message), log_file, "ERROR")
    return(0)
  })
}

#' Generate unique ID for a story based on URL
#'
#' @param url Story URL
#' @return MD5 hash of URL
generate_story_id <- function(url) {
  digest::digest(url, algo = "md5")
}

#' Check if story already exists in database
#'
#' @param con Database connection
#' @param url Story URL
#' @return TRUE if exists, FALSE otherwise
story_exists <- function(con, url) {
  result <- dbGetQuery(
    con,
    "SELECT COUNT(*) as count FROM stories WHERE url = ?",
    params = list(url)
  )

  return(result$count[1] > 0)
}

#' Clean and normalize text
#'
#' @param text Input text
#' @return Cleaned text
clean_text <- function(text) {
  if (is.null(text) || is.na(text) || text == "") return("")

  text %>%
    # Remove extra whitespace
    str_squish() %>%
    # Remove special characters that might break JSON
    str_replace_all("[\r\n\t]", " ") %>%
    # Remove zero-width characters
    str_replace_all("[\u200B-\u200D\uFEFF]", "")
}

#' Extract domain from URL
#'
#' @param url URL string
#' @return Domain name
extract_domain <- function(url) {
  if (is.null(url) || is.na(url)) return(NA)

  domain <- str_extract(url, "(?<=://)([^/]+)")
  # Remove www.
  domain <- str_replace(domain, "^www\\.", "")

  return(domain)
}

#' Parse date from various formats
#'
#' @param date_str Date string
#' @return ISO 8601 formatted date or NA
parse_date <- function(date_str) {
  if (is.null(date_str) || is.na(date_str) || date_str == "") {
    return(NA)
  }

  # Try multiple date formats
  date_formats <- c(
    "%Y-%m-%d",
    "%Y-%m-%dT%H:%M:%S",
    "%Y-%m-%dT%H:%M:%SZ",
    "%a, %d %b %Y %H:%M:%S",
    "%d %b %Y",
    "%B %d, %Y",
    "%m/%d/%Y"
  )

  for (fmt in date_formats) {
    result <- tryCatch(
      {
        parsed <- parse_date_time(date_str, fmt, quiet = TRUE)
        if (!is.na(parsed)) {
          return(format(parsed, "%Y-%m-%d"))
        }
      },
      error = function(e) NA
    )
  }

  return(NA)
}

#' Rate limiting function
#'
#' @param last_request_time Time of last request
#' @param min_interval Minimum interval between requests (seconds)
rate_limit <- function(last_request_time, min_interval = 1) {
  if (!is.null(last_request_time)) {
    elapsed <- as.numeric(Sys.time() - last_request_time)
    if (elapsed < min_interval) {
      Sys.sleep(min_interval - elapsed)
    }
  }
  return(Sys.time())
}

#' Safely make HTTP request with error handling
#'
#' @param url URL to fetch
#' @param timeout Timeout in seconds
#' @return Response object or NULL on error
safe_http_get <- function(url, timeout = 30) {
  tryCatch(
    {
      response <- request(url) %>%
        req_timeout(timeout) %>%
        req_user_agent("ResearchWatchBot/1.0 (Academic Research; +https://ianadamsresearch.com)") %>%
        req_perform()

      return(response)
    },
    error = function(e) {
      warning(sprintf("HTTP request failed for %s: %s", url, e$message))
      return(NULL)
    }
  )
}

#' Extract keywords from text for tagging
#'
#' @param text Input text
#' @return Vector of keywords
extract_keywords <- function(text) {
  if (is.null(text) || is.na(text) || text == "") return(character(0))

  # K9-specific keywords
  keywords <- c(
    "K9", "K-9", "canine", "police dog", "police dogs",
    "bite", "attack", "injury", "injured",
    "lawsuit", "settlement", "excessive force", "civil rights",
    "use of force", "deployment",
    "heat death", "left in car", "died", "killed",
    "apprehension", "suspect", "capture", "track",
    "training", "policy", "standard", "certification",
    "handler", "officer", "unit",
    "innocent", "wrong person", "mistaken identity", "child",
    "racial disparity", "discrimination", "accountability",
    "Belgian Malinois", "German Shepherd", "bloodhound",
    "verdict", "jury", "court", "legal",
    "reform", "controversy", "statistics", "data"
  )

  text_lower <- tolower(text)
  found_keywords <- keywords[sapply(keywords, function(kw) {
    grepl(tolower(kw), text_lower, fixed = TRUE)
  })]

  return(unique(found_keywords))
}

#' Calculate relevance score based on content
#'
#' @param title Article title
#' @param summary Article summary
#' @param full_text Full article text (optional)
#' @return Relevance score between 0 and 1
calculate_relevance_score <- function(title, summary, full_text = NULL) {
  text <- paste(
    tolower(title %||% ""),
    tolower(summary %||% ""),
    tolower(substr(full_text %||% "", 1, 500))
  )

  score <- 0

  # High relevance terms (0.3 points each, max 0.6)
  high_terms <- c(
    "police k9 bite", "police dog attack", "k9 bite incident",
    "police canine bite", "k9 bite lawsuit", "police dog bite lawsuit",
    "k9 excessive force", "canine bite settlement", "k9 death",
    "k9 heat death", "police dog died"
  )
  high_matches <- sum(sapply(high_terms, function(t) grepl(t, text, fixed = TRUE)))
  score <- score + min(high_matches * 0.3, 0.6)

  # Medium relevance terms (0.15 points each, max 0.3)
  medium_terms <- c(
    "k9 unit", "canine unit", "police dog", "k9 officer",
    "k9 policy", "k9 training", "canine deployment",
    "k9 apprehension", "police canine", "k-9"
  )
  medium_matches <- sum(sapply(medium_terms, function(t) grepl(t, text, fixed = TRUE)))
  score <- score + min(medium_matches * 0.15, 0.3)

  # Low relevance terms (0.05 points each, max 0.1)
  low_terms <- c("k9", "canine", "police", "dog")
  low_matches <- sum(sapply(low_terms, function(t) grepl(t, text, fixed = TRUE)))
  score <- score + min(low_matches * 0.05, 0.1)

  # Bonus for legal/settlement terms
  if (grepl("lawsuit|settlement|verdict|jury|civil rights|excessive force", text)) {
    score <- score + 0.1
  }

  # Bonus for specific incidents
  if (grepl("bite|attack|injury|death|killed|died|wrong person|innocent", text)) {
    score <- score + 0.1
  }

  return(min(score, 1.0))
}

#' Classify story type based on content
#'
#' @param title Article title
#' @param summary Article summary
#' @return Story type: incident, legal, policy, training, death, capture, opinion
classify_story_type <- function(title, summary) {
  text <- tolower(paste(title %||% "", summary %||% ""))

  # Legal cases and lawsuits
  if (grepl("lawsuit|settlement|verdict|jury|court|civil rights|excessive force|legal case", text)) {
    return("legal")
  }

  # K9 deaths (heat, killed in line of duty, etc.)
  if (grepl("k9.*death|k9.*died|k9.*killed|heat death|left in car|canine.*died", text)) {
    return("death")
  }

  # Policy and reform
  if (grepl("policy|standard|reform|accountability|training.*standard|certification|regulation", text)) {
    return("policy")
  }

  # Training issues
  if (grepl("training|handler.*train|k9.*train|certification", text)) {
    return("training")
  }

  # Bite incidents and attacks
  if (grepl("bite|attack|injury|injured|mauled|wrong person|innocent|child", text)) {
    return("incident")
  }

  # Successful captures/apprehensions
  if (grepl("apprehend|capture|track|suspect.*found|fugitive", text)) {
    return("capture")
  }

  # Opinion pieces
  if (grepl("opinion|editorial|commentary|should|must|perspective", text)) {
    return("opinion")
  }

  return("general")
}

#' Extract entities (agencies, companies, locations) from text
#'
#' @param text Input text
#' @return Comma-separated string of entities
extract_entities <- function(text) {
  if (is.null(text) || is.na(text) || text == "") return("")

  entities <- c()

  # Police departments/agencies
  dept_pattern <- "\\b([A-Z][a-z]+(?: [A-Z][a-z]+)*) (?:Police Department|Sheriff|Police|PD)\\b"
  depts <- str_extract_all(text, dept_pattern)[[1]]
  entities <- c(entities, depts)

  # Federal agencies
  federal <- c("ICE", "FBI", "DEA", "ATF", "CBP", "Border Patrol", "Homeland Security")
  federal_found <- federal[sapply(federal, function(a) grepl(a, text, fixed = TRUE))]
  entities <- c(entities, federal_found)

  # K9 breeds (often mentioned in stories)
  breeds <- c("Belgian Malinois", "German Shepherd", "Bloodhound", "Labrador", "Dutch Shepherd")
  breeds_found <- breeds[sapply(breeds, function(b) grepl(b, text, fixed = TRUE))]
  entities <- c(entities, breeds_found)

  return(paste(unique(entities[entities != ""]), collapse = ", "))
}

#' Deduplicate stories by checking for similar URLs or titles
#'
#' @param con Database connection
#' @param new_stories Data frame of new stories
#' @return Deduplicated data frame
deduplicate_stories <- function(con, new_stories) {
  if (nrow(new_stories) == 0) return(new_stories)

  # Get existing URLs from database
  existing_urls <- dbGetQuery(con, "SELECT url FROM stories")$url

  # Filter out exact URL matches
  new_stories <- new_stories %>%
    filter(!url %in% existing_urls)

  # Check for near-duplicate titles within new batch
  if (nrow(new_stories) > 1) {
    new_stories <- new_stories %>%
      group_by(title) %>%
      slice(1) %>%
      ungroup()
  }

  return(new_stories)
}
