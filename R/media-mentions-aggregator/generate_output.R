# Output Generation for Dr. Ian Adams Media Mentions
# Generates JSON, RSS, and markdown files for website integration

library(jsonlite)
library(dplyr)
library(stringr)
library(lubridate)
library(xml2)

source(here::here("R", "media-mentions-aggregator", "utils.R"))

#' Generate JSON output for website
#'
#' @param con Database connection
#' @param output_path Path to output JSON file
#' @param max_stories Maximum number of stories to include
#' @param log_file Path to log file
generate_json_output <- function(con, output_path = NULL, max_stories = 200, log_file = NULL) {
  if (is.null(output_path)) {
    output_path <- here::here("static", "data", "media-mentions.json")
  }

  log_message("Generating JSON output", log_file)

  # Get published stories from database
  # Order by date_published if available, otherwise use date_discovered
  # Featured stories first
  stories <- dbGetQuery(
    con,
    "SELECT * FROM stories
     WHERE published_on_site = 1
     ORDER BY featured DESC, COALESCE(NULLIF(date_published, ''), date_discovered) DESC, relevance_score DESC
     LIMIT ?",
    params = list(max_stories)
  )

  if (nrow(stories) == 0) {
    log_message("No stories to export to JSON", log_file, "WARN")
    # Create empty but valid JSON
    output <- list(
      updated = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ"),
      count = 0,
      stories = list()
    )
  } else {
    # Format for JSON output
    stories_list <- stories %>%
      mutate(
        # Use date_published if available, otherwise fall back to date_discovered
        date = ifelse(!is.na(date_published) & date_published != "",
                     date_published,
                     date_discovered),
        # Convert comma-separated strings to arrays
        tags = lapply(strsplit(tags, ",\\s*"), function(x) if (length(x) == 0 || x[1] == "") NULL else x),
        topics = lapply(strsplit(topics, ",\\s*"), function(x) if (length(x) == 0 || x[1] == "") NULL else x),
        key_entities = lapply(strsplit(key_entities, ",\\s*"), function(x) if (length(x) == 0 || x[1] == "") NULL else x)
      ) %>%
      select(
        id, url, title, source, date, date_discovered,
        summary, snippet, mention_type, story_type,
        relevance_score, relevance_confidence,
        key_entities, location, tags, topics,
        needs_review, featured
      ) %>%
      pmap(function(...) {
        story <- list(...)
        # Remove empty fields - handle vectors/lists safely
        story[sapply(story, function(x) {
          if (is.null(x)) return(TRUE)
          if (length(x) == 0) return(TRUE)
          if (is.list(x) && length(x) == 1 && is.null(x[[1]])) return(TRUE)
          if (length(x) == 1 && is.na(x)) return(TRUE)
          if (length(x) == 1 && x == "") return(TRUE)
          return(FALSE)
        })] <- NULL
        story
      })

    output <- list(
      updated = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ"),
      count = length(stories_list),
      stories = stories_list
    )
  }

  # Write JSON file
  dir.create(dirname(output_path), showWarnings = FALSE, recursive = TRUE)
  write_json(
    output,
    output_path,
    pretty = TRUE,
    auto_unbox = TRUE,
    null = "null"
  )

  log_message(sprintf("JSON output written: %s (%d stories)", output_path, output$count), log_file)

  return(output_path)
}

#' Generate RSS feed
#'
#' @param con Database connection
#' @param output_path Path to output RSS file
#' @param max_stories Maximum number of stories in feed
#' @param log_file Path to log file
generate_rss_feed <- function(con, output_path = NULL, max_stories = 50, log_file = NULL) {
  if (is.null(output_path)) {
    output_path <- here::here("static", "data", "media-mentions.xml")
  }

  log_message("Generating RSS feed", log_file)

  # Get recent stories
  stories <- dbGetQuery(
    con,
    "SELECT * FROM stories
     WHERE published_on_site = 1
     ORDER BY COALESCE(NULLIF(date_published, ''), date_discovered) DESC, relevance_score DESC
     LIMIT ?",
    params = list(max_stories)
  )

  # Create RSS XML
  rss <- xml_new_root("rss", version = "2.0")
  channel <- xml_add_child(rss, "channel")

  xml_add_child(channel, "title", "In the Media - Dr. Ian Adams")
  xml_add_child(channel, "link", "https://ianadamsresearch.com/media/")
  xml_add_child(channel, "description", "Media coverage and interviews featuring Dr. Ian Adams on policing, technology, and criminal justice research")
  xml_add_child(channel, "language", "en-us")
  xml_add_child(channel, "lastBuildDate", format(Sys.time(), "%a, %d %b %Y %H:%M:%S %z"))

  if (nrow(stories) > 0) {
    for (i in 1:nrow(stories)) {
      story <- stories[i, ]

      item <- xml_add_child(channel, "item")
      xml_add_child(item, "title", story$title)
      xml_add_child(item, "link", story$url)
      xml_add_child(item, "guid", story$url, isPermaLink = "true")

      # Build description with metadata
      description <- sprintf(
        "%s<br/><br/><strong>Source:</strong> %s<br/><strong>Type:</strong> %s<br/><strong>Mention:</strong> %s",
        story$summary %||% story$snippet %||% "",
        story$source,
        tools::toTitleCase(story$story_type %||% "news"),
        tools::toTitleCase(story$mention_type %||% "referenced")
      )

      if (!is.na(story$topics) && story$topics != "") {
        description <- paste0(description, sprintf("<br/><strong>Topics:</strong> %s", story$topics))
      }

      xml_add_child(item, "description", description)

      # Add pub date
      pub_date_str <- if (!is.na(story$date_published) && story$date_published != "") {
        story$date_published
      } else {
        story$date_discovered
      }
      if (!is.na(pub_date_str) && pub_date_str != "") {
        pub_date <- as.POSIXct(pub_date_str)
        xml_add_child(item, "pubDate", format(pub_date, "%a, %d %b %Y 00:00:00 %z"))
      }

      # Add category for story type
      xml_add_child(item, "category", tools::toTitleCase(story$story_type %||% "news"))
    }
  }

  # Write RSS file
  dir.create(dirname(output_path), showWarnings = FALSE, recursive = TRUE)
  write_xml(rss, output_path)

  log_message(sprintf("RSS feed written: %s (%d stories)", output_path, nrow(stories)), log_file)

  return(output_path)
}

#' Generate summary report for stories needing review
#'
#' @param con Database connection
#' @param output_path Path to output file
#' @param log_file Path to log file
generate_review_report <- function(con, output_path = NULL, log_file = NULL) {
  if (is.null(output_path)) {
    output_path <- here::here("data", "media-mentions", "needs_review.json")
  }

  log_message("Generating review report", log_file)

  # Get stories that need review
  stories <- dbGetQuery(
    con,
    "SELECT * FROM stories
     WHERE needs_review = 1 AND reviewed = 0
     ORDER BY date_discovered DESC, relevance_score DESC"
  )

  if (nrow(stories) == 0) {
    log_message("No stories need review", log_file)
    output <- list(
      generated = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ"),
      count = 0,
      stories = list()
    )
  } else {
    output <- list(
      generated = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ"),
      count = nrow(stories),
      stories = stories %>%
        select(id, title, url, source, date_published, relevance_score,
               relevance_confidence, mention_type, story_type, summary, snippet) %>%
        pmap(list)
    )

    log_message(sprintf("%d stories flagged for review", nrow(stories)), log_file, "WARN")
  }

  # Write JSON file
  dir.create(dirname(output_path), showWarnings = FALSE, recursive = TRUE)
  write_json(
    output,
    output_path,
    pretty = TRUE,
    auto_unbox = TRUE
  )

  log_message(sprintf("Review report written: %s", output_path), log_file)

  return(output_path)
}

#' Generate all outputs
#'
#' @param con Database connection
#' @param log_file Path to log file
generate_all_outputs <- function(con, log_file = NULL) {
  log_message("Generating all output files", log_file)

  # Generate JSON for website
  json_path <- generate_json_output(con, log_file = log_file)

  # Generate RSS feed
  rss_path <- generate_rss_feed(con, log_file = log_file)

  # Generate review report
  review_path <- generate_review_report(con, log_file = log_file)

  log_message("All output files generated successfully", log_file)

  return(list(
    json = json_path,
    rss = rss_path,
    review = review_path
  ))
}
