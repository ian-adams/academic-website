# Utility Functions for Dr. Ian Adams Media Mentions Aggregator
# Author: Research Watch System
# Purpose: Helper functions for data processing, logging, and name disambiguation

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
  log_dir <- here::here("data", "media-mentions", "logs")
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
init_database <- function(db_path = here::here("data", "media-mentions", "stories.sqlite")) {
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
      snippet TEXT,
      mention_type TEXT,
      story_type TEXT,
      relevance_score REAL,
      relevance_confidence TEXT,
      key_entities TEXT,
      location TEXT,
      tags TEXT,
      topics TEXT,
      full_text TEXT,
      needs_review INTEGER DEFAULT 0,
      reviewed INTEGER DEFAULT 0,
      published_on_site INTEGER DEFAULT 1,
      featured INTEGER DEFAULT 0
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

  # Create index on featured for filtering
  dbExecute(con, "
    CREATE INDEX IF NOT EXISTS idx_featured ON stories(featured)
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
    json_path <- here::here("static", "data", "media-mentions.json")
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
    list_cols <- c("tags", "topics", "key_entities")
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
      "summary", "snippet", "mention_type", "story_type",
      "relevance_score", "relevance_confidence",
      "key_entities", "location", "tags", "topics", "full_text",
      "needs_review", "reviewed", "published_on_site", "featured"
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
    stories$featured[is.na(stories$featured)] <- 0

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

#' Check if article contains Ian Adams name
#'
#' @param text Text to check
#' @return TRUE if name found
contains_ian_adams <- function(text) {
  if (is.null(text) || is.na(text) || text == "") return(FALSE)

  text_lower <- tolower(text)

  # Check for various name patterns
  name_patterns <- c(
    "ian adams",
    "dr. adams",
    "dr adams",
    "professor adams"
  )

  any(sapply(name_patterns, function(p) grepl(p, text_lower, fixed = TRUE)))
}

#' Extract keywords from text for tagging
#'
#' @param text Input text
#' @return Vector of keywords
extract_keywords <- function(text) {
  if (is.null(text) || is.na(text) || text == "") return(character(0))

  # Dr. Ian Adams research topic keywords
  keywords <- c(
    # Identity markers
    "University of South Carolina", "USC", "South Carolina",
    "criminology", "criminologist", "criminal justice",
    "assistant professor", "professor", "researcher",

    # Research topics
    "police", "policing", "law enforcement",
    "artificial intelligence", "AI", "machine learning",
    "body camera", "body-worn camera", "BWC",
    "use of force", "force", "excessive force",
    "K9", "canine", "police dog",
    "report writing", "police reports",
    "technology", "surveillance",

    # Policy and reform
    "policy", "reform", "accountability",
    "training", "de-escalation",
    "transparency", "oversight"
  )

  text_lower <- tolower(text)
  found_keywords <- keywords[sapply(keywords, function(kw) {
    grepl(tolower(kw), text_lower, fixed = TRUE)
  })]

  return(unique(found_keywords))
}

#' Calculate relevance score and confidence for Dr. Ian Adams mentions
#' Uses aggressive disambiguation to filter out other Ian Adamses
#'
#' @param title Article title
#' @param summary Article summary
#' @param full_text Full article text (optional)
#' @return List with score, confidence, and exclusion_reason
calculate_relevance_score <- function(title, summary, full_text = NULL) {
  text <- paste(
    tolower(title %||% ""),
    tolower(summary %||% ""),
    tolower(substr(full_text %||% "", 1, 2000))
  )

  score <- 0
  confidence <- "low"
  exclusion_reason <- NULL

  # First, check if "Ian Adams" is even mentioned
  if (!grepl("ian adams", text, fixed = TRUE) &&
      !grepl("dr. adams", text, fixed = TRUE) &&
      !grepl("dr adams", text, fixed = TRUE) &&
      !grepl("professor adams", text, fixed = TRUE)) {
    return(list(score = 0, confidence = "none", exclusion_reason = "Name not found"))
  }

  # ========== EXCLUSION CHECKS (definitive false positives) ==========

  # Sports exclusions - other Ian Adamses who are athletes
  sports_terms <- c(
    "rugby", "cricket", "football", "goalkeeper", "midfielder",
    "striker", "wicket", "batting", "bowling", "scored", "match",
    "tournament", "season", "team roster", "league", "championship",
    "fixture", "premier league", "afl", "all blacks", "try", "tackle"
  )
  sports_matches <- sum(sapply(sports_terms, function(t) grepl(t, text, fixed = TRUE)))
  if (sports_matches >= 2) {
    return(list(score = 0, confidence = "excluded", exclusion_reason = "Sports context - wrong Ian Adams"))
  }

  # Entertainment exclusions
  entertainment_terms <- c(
    "album", "concert", "film", "starring", "cast", "movie",
    "song", "track", "band", "tour", "gig", "streaming", "spotify"
  )
  entertainment_matches <- sum(sapply(entertainment_terms, function(t) grepl(t, text, fixed = TRUE)))
  if (entertainment_matches >= 2) {
    return(list(score = 0, confidence = "excluded", exclusion_reason = "Entertainment context - wrong Ian Adams"))
  }

  # Corporate exclusions (without policing context)
  if (grepl("ceo|chairman|board of directors|shareholders|quarterly", text)) {
    if (!grepl("police|law enforcement|policing|criminal justice", text)) {
      return(list(score = 0, confidence = "excluded", exclusion_reason = "Corporate context - wrong Ian Adams"))
    }
  }

  # Obituary exclusion (unless about academic work)
  if (grepl("obituary|passed away|died|funeral|survived by", text)) {
    if (!grepl("research|legacy.*policing|contribution.*criminal justice", text)) {
      return(list(score = 0, confidence = "excluded", exclusion_reason = "Obituary - likely wrong Ian Adams"))
    }
  }

  # ========== HIGH CONFIDENCE INCLUSION (auto-include) ==========

  # Explicit University of South Carolina mention near name
  if (grepl("ian adams.*university of south carolina|university of south carolina.*ian adams", text) ||
      grepl("ian adams.*usc|usc.*ian adams", text) ||
      grepl("adams.*south carolina.*professor|professor.*south carolina.*adams", text)) {
    score <- score + 0.5
    confidence <- "high"
  }

  # Explicit academic titles with policing context
  if (grepl("dr\\.? ian adams", text) && grepl("police|policing|criminal|law enforcement", text)) {
    score <- score + 0.4
    if (confidence == "low") confidence <- "high"
  }

  if (grepl("professor ian adams|ian adams.*professor", text) &&
      grepl("police|policing|criminal|law enforcement", text)) {
    score <- score + 0.4
    if (confidence == "low") confidence <- "high"
  }

  # Explicit criminology/criminologist mention
  if (grepl("ian adams.*criminolog|criminolog.*ian adams", text)) {
    score <- score + 0.45
    if (confidence == "low") confidence <- "high"
  }

  # Explicit researcher/expert in policing context
  if (grepl("ian adams.*researcher|researcher.*ian adams", text) &&
      grepl("police|policing|law enforcement", text)) {
    score <- score + 0.35
    if (confidence == "low") confidence <- "high"
  }

  # Quoted (strong signal of being a source)
  if (grepl("adams said|said adams|according to adams|adams told|adams explained|adams noted", text)) {
    score <- score + 0.2
    if (grepl("police|policing|criminal|law enforcement|force|officer", text)) {
      score <- score + 0.15
      if (confidence == "low") confidence <- "medium"
    }
  }

  # ========== MEDIUM CONFIDENCE (policing context without explicit ID) ==========

  # Policing context keywords
  policing_terms <- c(
    "police", "policing", "law enforcement", "officer",
    "sheriff", "deputy", "department"
  )
  policing_matches <- sum(sapply(policing_terms, function(t) grepl(t, text, fixed = TRUE)))

  if (policing_matches >= 2 && confidence == "low") {
    score <- score + 0.15
    confidence <- "medium"
  }

  # Research topic signals (Ian Adams's specific research areas)
  research_topics <- c(
    "body camera", "body-worn camera", "bwc",
    "use of force", "police shooting",
    "k9", "canine", "police dog",
    "artificial intelligence", " ai ", "machine learning",
    "report writing", "police report"
  )
  topic_matches <- sum(sapply(research_topics, function(t) grepl(t, text, fixed = TRUE)))
  if (topic_matches >= 1) {
    score <- score + topic_matches * 0.1
    if (confidence == "low" && policing_matches >= 1) {
      confidence <- "medium"
    }
  }

  # ========== LOW CONFIDENCE BONUSES ==========

  # Academic/research context
  if (grepl("study|research|paper|journal|finding|data", text)) {
    score <- score + 0.05
  }

  # Policy context
  if (grepl("policy|reform|accountability|training|transparency", text)) {
    score <- score + 0.05
  }

  # ========== PENALTY FOR AMBIGUOUS CASES ==========

  # If only last name "Adams" is used after first mention and context is unclear
  # (can't reliably detect this without more context, so just reduce confidence)
  if (!grepl("ian adams", text, fixed = TRUE) && grepl("adams", text, fixed = TRUE)) {
    if (confidence == "medium") confidence <- "low"
    score <- score * 0.7  # Reduce score for ambiguous cases
  }

  return(list(score = min(score, 1.0), confidence = confidence, exclusion_reason = exclusion_reason))
}

#' Classify mention type based on content
#'
#' @param title Article title
#' @param summary Article summary
#' @return Mention type: quoted, cited, referenced, byline
classify_mention_type <- function(title, summary) {
  text <- tolower(paste(title %||% "", summary %||% ""))

  # Check if likely a byline (author)
  if (grepl("^by ian adams|by dr\\.? ian adams|ian adams.*opinion|op-ed.*ian adams", text)) {
    return("byline")
  }

  # Check if quoted
  if (grepl("adams said|said adams|according to adams|adams told|adams explained|adams noted|adams argues|adams wrote", text) ||
      grepl("\".*\".*adams|adams.*\".*\"", text)) {
    return("quoted")
  }

  # Check if cited (research mentioned)
  if (grepl("adams.*study|study.*adams|research.*adams|adams.*research|adams.*found|found.*adams|according to.*research", text)) {
    return("cited")
  }

  # Default to referenced
  return("referenced")
}

#' Classify story type based on content
#'
#' @param title Article title
#' @param summary Article summary
#' @return Story type: research, interview, opinion, news, feature, policy
classify_story_type <- function(title, summary) {
  text <- tolower(paste(title %||% "", summary %||% ""))

  # Opinion/editorial
  if (grepl("opinion|editorial|commentary|perspective|column|op-ed", text)) {
    return("opinion")
  }

  # Research publication/study
  if (grepl("study finds|new research|study shows|published.*journal|research reveals|data shows", text)) {
    return("research")
  }

  # Interview/Q&A
  if (grepl("interview|q&a|talks to|speaks with|conversation with", text)) {
    return("interview")
  }

  # Policy focus
  if (grepl("policy|reform|legislation|bill|law|regulation|commission|oversight", text)) {
    return("policy")
  }

  # Feature/in-depth
  if (grepl("feature|in-depth|deep dive|investigation|special report|long read", text)) {
    return("feature")
  }

  return("news")
}

#' Extract topics from text based on research areas
#'
#' @param text Input text
#' @return Comma-separated string of topics
extract_topics <- function(text) {
  if (is.null(text) || is.na(text) || text == "") return("")

  text_lower <- tolower(text)
  topics <- c()

  # AI/Technology
  if (grepl("artificial intelligence| ai |machine learning|algorithm", text_lower)) {
    topics <- c(topics, "AI/Technology")
  }

  # Body cameras
  if (grepl("body camera|body-worn camera|bwc|bodycam", text_lower)) {
    topics <- c(topics, "Body Cameras")
  }

  # Use of force
  if (grepl("use of force|excessive force|deadly force|police shooting|officer-involved", text_lower)) {
    topics <- c(topics, "Use of Force")
  }

  # K9/Canine
  if (grepl("k9|k-9|canine|police dog", text_lower)) {
    topics <- c(topics, "Police K9")
  }

  # Police report writing
  if (grepl("report writing|police report|narrative|documentation", text_lower)) {
    topics <- c(topics, "Report Writing")
  }

  # Training
  if (grepl("training|academy|de-escalation", text_lower)) {
    topics <- c(topics, "Training")
  }

  # Policy/Reform
  if (grepl("policy|reform|accountability|transparency|oversight", text_lower)) {
    topics <- c(topics, "Policy/Reform")
  }

  return(paste(unique(topics), collapse = ", "))
}

#' Extract entities (agencies, people, organizations) from text
#'
#' @param text Input text
#' @return Comma-separated string of entities
extract_entities <- function(text) {
  if (is.null(text) || is.na(text) || text == "") return("")

  entities <- c()

  # University of South Carolina
  if (grepl("University of South Carolina|USC", text, ignore.case = FALSE)) {
    entities <- c(entities, "University of South Carolina")
  }

  # Police departments/agencies
  dept_pattern <- "\\b([A-Z][a-z]+(?: [A-Z][a-z]+)*) (?:Police Department|Sheriff|Police|PD)\\b"
  depts <- str_extract_all(text, dept_pattern)[[1]]
  entities <- c(entities, depts)

  # Federal agencies
  federal <- c("DOJ", "Department of Justice", "FBI", "ATF", "DHS")
  federal_found <- federal[sapply(federal, function(a) grepl(a, text, fixed = TRUE))]
  entities <- c(entities, federal_found)

  # Research organizations
  orgs <- c("NIJ", "National Institute of Justice", "Bureau of Justice Statistics", "PERF")
  orgs_found <- orgs[sapply(orgs, function(o) grepl(o, text, fixed = TRUE))]
  entities <- c(entities, orgs_found)

  return(paste(unique(entities[entities != ""]), collapse = ", "))
}

#' Extract snippet containing name mention for display
#'
#' @param text Full text
#' @return Snippet string around name mention
extract_mention_snippet <- function(text) {
  if (is.null(text) || is.na(text) || text == "") return("")

  # Find position of name mention
  name_pos <- regexpr("ian adams|dr\\.? adams|professor adams", tolower(text), ignore.case = TRUE)

  if (name_pos == -1) return(substr(text, 1, 200))

  # Extract ~100 chars before and after
  start <- max(1, name_pos - 100)
  end <- min(nchar(text), name_pos + 150)

  snippet <- substr(text, start, end)

  # Clean up to start/end at word boundaries
  if (start > 1) {
    snippet <- sub("^[^ ]* ", "...", snippet)
  }
  if (end < nchar(text)) {
    snippet <- sub(" [^ ]*$", "...", snippet)
  }

  return(clean_text(snippet))
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
