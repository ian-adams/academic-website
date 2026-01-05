# Output Generation for AI Police News
# Generates JSON, RSS, and markdown files for website integration

library(jsonlite)
library(dplyr)
library(stringr)
library(lubridate)
library(xml2)

source(here::here("R", "news-aggregator", "utils.R"))

#' Generate JSON output for website
#'
#' @param con Database connection
#' @param output_path Path to output JSON file
#' @param max_stories Maximum number of stories to include
#' @param log_file Path to log file
generate_json_output <- function(con, output_path = NULL, max_stories = 100, log_file = NULL) {
  if (is.null(output_path)) {
    output_path <- here::here("static", "data", "ai-police-news.json")
  }

  log_message("Generating JSON output", log_file)

  # Get published stories from database
  stories <- dbGetQuery(
    con,
    "SELECT * FROM stories
     WHERE published_on_site = 1
     ORDER BY date_published DESC, relevance_score DESC
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
        # Convert comma-separated strings to arrays
        tags = lapply(strsplit(tags, ",\\s*"), function(x) if (length(x) == 0 || x[1] == "") NULL else x),
        key_entities = lapply(strsplit(key_entities, ",\\s*"), function(x) if (length(x) == 0 || x[1] == "") NULL else x)
      ) %>%
      select(
        id, url, title, source, date_published, date_discovered,
        summary, story_type, relevance_score, key_entities,
        location, tags, needs_review
      ) %>%
      pmap(function(...) {
        story <- list(...)
        # Remove empty fields
        story[sapply(story, function(x) is.null(x) || is.na(x) || x == "")] <- NULL
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
    output_path <- here::here("static", "data", "ai-police-news.xml")
  }

  log_message("Generating RSS feed", log_file)

  # Get recent stories
  stories <- dbGetQuery(
    con,
    "SELECT * FROM stories
     WHERE published_on_site = 1
     ORDER BY date_published DESC, relevance_score DESC
     LIMIT ?",
    params = list(max_stories)
  )

  # Create RSS XML
  rss <- xml_new_root("rss", version = "2.0")
  channel <- xml_add_child(rss, "channel")

  xml_add_child(channel, "title", "Research Watch: AI in Police Report Writing")
  xml_add_child(channel, "link", "https://ianadamsresearch.com/ai-news/")
  xml_add_child(channel, "description", "Curated news and research on artificial intelligence in police report writing and documentation")
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
        "%s<br/><br/><strong>Source:</strong> %s<br/><strong>Type:</strong> %s<br/><strong>Relevance:</strong> %.0f%%",
        story$summary,
        story$source,
        tools::toTitleCase(story$story_type),
        story$relevance_score * 100
      )

      if (!is.na(story$location) && story$location != "") {
        description <- paste0(description, sprintf("<br/><strong>Location:</strong> %s", story$location))
      }

      xml_add_child(item, "description", description)

      # Add pub date
      if (!is.na(story$date_published)) {
        # Convert to RFC 822 format
        pub_date <- as.POSIXct(story$date_published)
        xml_add_child(item, "pubDate", format(pub_date, "%a, %d %b %Y 00:00:00 %z"))
      }

      # Add category for story type
      xml_add_child(item, "category", tools::toTitleCase(story$story_type))
    }
  }

  # Write RSS file
  dir.create(dirname(output_path), showWarnings = FALSE, recursive = TRUE)
  write_xml(rss, output_path)

  log_message(sprintf("RSS feed written: %s (%d stories)", output_path, nrow(stories)), log_file)

  return(output_path)
}

#' Generate markdown files for individual stories (for static site)
#'
#' @param con Database connection
#' @param output_dir Directory for markdown files
#' @param log_file Path to log file
generate_markdown_stories <- function(con, output_dir = NULL, log_file = NULL) {
  if (is.null(output_dir)) {
    output_dir <- here::here("data", "ai-police-news", "stories")
  }

  log_message("Generating markdown story files", log_file)

  # Get all published stories
  stories <- dbGetQuery(
    con,
    "SELECT * FROM stories WHERE published_on_site = 1"
  )

  if (nrow(stories) == 0) {
    log_message("No stories to export as markdown", log_file)
    return(NULL)
  }

  dir.create(output_dir, showWarnings = FALSE, recursive = TRUE)

  for (i in 1:nrow(stories)) {
    story <- stories[i, ]

    # Create filename from ID
    filename <- file.path(output_dir, paste0(story$id, ".md"))

    # Build YAML frontmatter
    frontmatter <- c(
      "---",
      sprintf("title: \"%s\"", gsub("\"", "\\\"", story$title)),
      sprintf("url: \"%s\"", story$url),
      sprintf("source: \"%s\"", story$source),
      sprintf("date: \"%s\"", story$date_published),
      sprintf("discovered: \"%s\"", story$date_discovered),
      sprintf("type: \"%s\"", story$story_type),
      sprintf("relevance: %.2f", story$relevance_score)
    )

    if (!is.na(story$location) && story$location != "") {
      frontmatter <- c(frontmatter, sprintf("location: \"%s\"", story$location))
    }

    if (!is.na(story$tags) && story$tags != "") {
      tags <- paste0("  - ", strsplit(story$tags, ",\\s*")[[1]])
      frontmatter <- c(frontmatter, "tags:", tags)
    }

    frontmatter <- c(frontmatter, "---", "")

    # Build content
    content <- c(
      frontmatter,
      "## Summary",
      "",
      story$summary,
      "",
      sprintf("[Read full article](%s)", story$url)
    )

    if (!is.na(story$key_entities) && story$key_entities != "") {
      content <- c(
        content,
        "",
        "## Key Entities",
        "",
        paste0("- ", strsplit(story$key_entities, ",\\s*")[[1]])
      )
    }

    # Write file
    writeLines(content, filename)
  }

  log_message(sprintf("Markdown files written: %d stories in %s", nrow(stories), output_dir), log_file)

  return(output_dir)
}

#' Generate summary report for stories needing review
#'
#' @param con Database connection
#' @param output_path Path to output file
#' @param log_file Path to log file
generate_review_report <- function(con, output_path = NULL, log_file = NULL) {
  if (is.null(output_path)) {
    output_path <- here::here("data", "ai-police-news", "needs_review.json")
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
        select(id, title, url, source, date_published, relevance_score, story_type, summary) %>%
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

  # Generate markdown files (optional)
  # md_dir <- generate_markdown_stories(con, log_file = log_file)

  log_message("All output files generated successfully", log_file)

  return(list(
    json = json_path,
    rss = rss_path,
    review = review_path
  ))
}
