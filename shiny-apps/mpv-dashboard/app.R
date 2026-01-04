library(shiny)
library(bslib)
library(tidyverse)
library(lubridate)
library(plotly)
library(scales)
library(readxl)
library(here)
library(gghighlight)
library(ggthemes)
library(sf)
library(rnaturalearth)
library(rnaturalearthdata)

# --- POPULATION REGISTRY (US Census Projections 2013-2025) ---
pop_data_manual <- tibble(
  year = 2013:2025,
  estimate = c(
    316128839, 318857056, 320738994, 323071755, 325084756, 326687501,
    328239523, 331449281, 331893745, 333287557, 334914895, 336673595, 338289857
  )
)

# --- UI DEFINITION ---
ui <- page_navbar(
  title = "MPV Analytical Engine",
  theme = bs_theme(version = 5, bootswatch = "flatly", primary = "#2c3e50"),

  sidebar = sidebar(
    title = "Analytical Controls",
    hr(),
    selectInput("cause_filter", "Death Subset:",
                choices = c("All Deaths" = "all", "Fatal Shootings" = "shootings")),
    selectInput("year_filter", "Temporal Focus:",
                choices = "All", selected = "All"),
    hr(),
    markdown("
      **Empirical Note:**
      Data is automatically synced from Mapping Police Violence.
      Descriptive results are reported as observed; causal inference
      requires controls for local crime rates and deployment density
      not present in this view.
    ")
  ),

  nav_panel("Overview",
            layout_column_wrap(
              width = 1/4,
              value_box(title = "Total Observations", value = textOutput("stat_total"), showcase = icon("users")),
              value_box(title = "Mean Rate (per 1M)", value = textOutput("stat_rate"), showcase = icon("chart-line")),
              value_box(title = "Black Victim Share", value = textOutput("stat_black_pct"), showcase = icon("scale-unbalanced")),
              value_box(title = "Unarmed Share", value = textOutput("stat_unarmed_pct"), showcase = icon("hand"))
            ),
            navset_card_underline(
              nav_panel("Cumulative Trajectory", plotlyOutput("plot_cumulative")),
              nav_panel("Per Capita (Normalized)", plotlyOutput("plot_per_capita")),
              nav_panel("Temporal Heatmap", plotlyOutput("plot_heatmap")),
              nav_panel("Day of Week", plotlyOutput("plot_dow"))
            )
  ),

  nav_panel("Demographics",
            navset_card_underline(
              nav_panel("Race Distribution", plotlyOutput("plot_race_dist")),
              nav_panel("Race by Year", plotlyOutput("plot_race_year")),
              nav_panel("Age Distribution", plotlyOutput("plot_age_dist")),
              nav_panel("Unarmed by Race", plotlyOutput("plot_unarmed_race")),
              nav_panel("Age & Race", plotlyOutput("plot_age_race"))
            )
  ),

  nav_panel("Behavioral & Context",
            navset_card_underline(
              nav_panel("Armed Status", plotlyOutput("plot_armed_status")),
              nav_panel("Alleged Weapons", plotlyOutput("plot_weapons")),
              nav_panel("Fleeing Outcomes", plotlyOutput("plot_fleeing_race")),
              nav_panel("Mental Health Trend", plotlyOutput("plot_mental_trend")),
              nav_panel("Body Camera Growth", plotlyOutput("plot_bodycam"))
            )
  ),

  nav_panel("Geography",
            navset_card_underline(
              nav_panel("National Map", plotOutput("plot_map", height = "600px")),
              nav_panel("Top 15 States", plotlyOutput("plot_states")),
              nav_panel("Top 20 Cities", plotlyOutput("plot_cities"))
            )
  ),

  nav_panel("Accountability & Income",
            layout_column_wrap(
              width = 1/2,
              card(card_header("Criminal Charges Trend"), plotlyOutput("plot_charges")),
              card(card_header("Neighborhood Income Disparities"), plotlyOutput("plot_income"))
            )
  )
)

# --- SERVER LOGIC ---
server <- function(input, output, session) {

  # Automated data ingestion and cleaning pipeline
  raw_data <- reactive({
    mpv_url <- "https://mappingpoliceviolence.us/s/MPVDatasetDownload.xlsx"
    raw_dir <- here("Data", "Raw")
    destfile <- file.path(raw_dir, "MPVDatasetDownload.xlsx")

    dir.create(raw_dir, showWarnings = FALSE, recursive = TRUE)
    if (!file.exists(destfile) || (Sys.Date() - as.Date(file.info(destfile)$mtime) > 1)) {
      download.file(mpv_url, destfile, mode = "wb")
    }

    df_mpv <- read_excel(destfile)
    names(df_mpv) <- names(df_mpv) %>% str_replace_all(" ", "_") %>% str_replace_all("[^[:alnum:]_]", "") %>% str_to_lower()
    date_col <- names(df_mpv) %>% str_subset("date") %>% first()

    df_mpv %>%
      rename(date = all_of(date_col)) %>%
      mutate(
        date = as.Date(date),
        year = year(date),
        month = month(date, label = TRUE, abbr = TRUE),
        day = wday(date, label = TRUE, abbr = TRUE),
        day_of_year = yday(date),
        age_numeric = as.numeric(victims_age),
        race_clean = case_when(
          is.na(victims_race) | victims_race == "" | victims_race == "Unknown race" ~ "Unknown",
          str_detect(victims_race, "White") ~ "White",
          str_detect(victims_race, "Black") ~ "Black",
          str_detect(victims_race, "Hispanic") | str_detect(victims_race, "Latino") ~ "Hispanic",
          str_detect(victims_race, "Asian") ~ "Asian",
          str_detect(victims_race, "Native American") ~ "Native American",
          str_detect(victims_race, "Pacific Islander") ~ "Pacific Islander",
          TRUE ~ "Other"
        ),
        fleeing_clean = case_when(
          str_detect(tolower(fleeing_source_wapo_and_review_of_cases_not_included_in_wapo_database), "not|no") ~ "Not Fleeing",
          str_detect(tolower(fleeing_source_wapo_and_review_of_cases_not_included_in_wapo_database), "car|foot|other") ~ "Fleeing",
          TRUE ~ "Unknown"
        ),
        mental_illness_symptoms = str_detect(tolower(symptoms_of_mental_illness), "yes|drug|alcohol")
      ) %>%
      filter(!is.na(date))
  })

  observeEvent(raw_data(), {
    choices <- c("All", sort(unique(raw_data()$year), decreasing = TRUE))
    updateSelectInput(session, "year_filter", choices = choices)
  })

  filtered_data <- reactive({
    df <- raw_data()
    if (input$cause_filter == "shootings") df <- df %>% filter(str_detect(tolower(cause_of_death), "gunshot"))
    if (input$year_filter != "All") df <- df %>% filter(year == as.numeric(input$year_filter))
    df
  })

  long_data <- reactive({
    df <- raw_data()
    if (input$cause_filter == "shootings") df <- df %>% filter(str_detect(tolower(cause_of_death), "gunshot"))
    df
  })

  # --- KPI OUTPUTS ---
  output$stat_total <- renderText({ comma(nrow(filtered_data())) })
  output$stat_rate <- renderText({
    df <- filtered_data()
    rates <- df %>% group_by(year) %>% summarise(n = n(), .groups = "drop") %>%
      inner_join(pop_data_manual, by = "year") %>% mutate(rate = (n / estimate) * 1000000)
    if(nrow(rates) == 0) return("N/A")
    round(mean(rates$rate), 2)
  })
  output$stat_black_pct <- renderText({
    df <- filtered_data(); if(nrow(df) == 0) return("0%")
    percent(sum(df$race_clean == "Black", na.rm = TRUE) / nrow(df), accuracy = 0.1)
  })
  output$stat_unarmed_pct <- renderText({
    df <- filtered_data(); if(nrow(df) == 0) return("0%")
    percent(sum(str_detect(tolower(df$armedunarmed_status), "unarmed"), na.rm = TRUE) / nrow(df), accuracy = 0.1)
  })

  # --- PLOTS ---

  output$plot_cumulative <- renderPlotly({
    df <- long_data()
    latest_yr <- max(df$year)
    plot_df <- df %>% group_by(year, date) %>% summarize(daily = n(), .groups = 'drop') %>%
      group_by(year) %>% arrange(date) %>% mutate(cum = cumsum(daily), mmdd = format(date, "%m-%d"))

    p <- ggplot(plot_df, aes(x = mmdd, y = cum, group = year, color = as.factor(year))) +
      geom_line(alpha = 0.4) +
      gghighlight(year == latest_yr, use_direct_label = FALSE) +
      theme_minimal() + labs(x = "Month-Day", y = "Cumulative Deaths", color = "Year")
    ggplotly(p)
  })

  output$plot_per_capita <- renderPlotly({
    plot_df <- long_data() %>% group_by(year) %>% summarize(n = n()) %>%
      inner_join(pop_data_manual, by = "year") %>%
      mutate(rate = (n / estimate) * 1000000, se = rate / sqrt(0.92 * n))

    p <- ggplot(plot_df, aes(x = year, y = rate)) +
      geom_col(fill = "#7777AB") +
      geom_errorbar(aes(ymin = rate, ymax = rate + 1.96 * se), width = 0.2) +
      theme_minimal() + labs(y = "Rate per 1M People")
    ggplotly(p)
  })

  output$plot_heatmap <- renderPlotly({
    plot_df <- filtered_data() %>% count(month, day = day(date))
    p <- ggplot(plot_df, aes(x = day, y = month, fill = n)) +
      geom_tile() + scale_fill_gradient(low = "lightyellow", high = "darkred") +
      theme_minimal() + labs(x = "Day of Month", y = NULL)
    ggplotly(p)
  })

  output$plot_dow <- renderPlotly({
    plot_df <- filtered_data() %>% count(day) %>% mutate(pct = n/sum(n)*100)
    p <- ggplot(plot_df, aes(x = day, y = pct)) +
      geom_col(fill = "steelblue") + geom_hline(yintercept = 100/7, linetype = "dashed", color = "red") +
      theme_minimal() + labs(y = "% of Incidents", x = NULL)
    ggplotly(p)
  })

  output$plot_race_dist <- renderPlotly({
    plot_df <- filtered_data() %>% count(race_clean) %>% mutate(pct = n/sum(n))
    p <- ggplot(plot_df, aes(x = reorder(race_clean, n), y = n)) +
      geom_col(fill = "steelblue") + coord_flip() + theme_minimal() + labs(x = NULL)
    ggplotly(p)
  })

  output$plot_race_year <- renderPlotly({
    p <- filtered_data() %>% ggplot(aes(x = year, fill = race_clean)) +
      geom_bar(position = "stack") + theme_minimal() + labs(fill = "Race")
    ggplotly(p)
  })

  output$plot_age_dist <- renderPlotly({
    p <- filtered_data() %>% filter(!is.na(age_numeric)) %>%
      ggplot(aes(x = age_numeric)) + geom_histogram(bins = 30, fill = "steelblue", color = "white") +
      theme_minimal() + labs(x = "Age", y = "Count")
    ggplotly(p)
  })

  output$plot_unarmed_race <- renderPlotly({
    plot_df <- filtered_data() %>% filter(race_clean %in% c("White", "Black", "Hispanic", "Asian")) %>%
      mutate(unarmed = str_detect(tolower(armedunarmed_status), "unarmed")) %>%
      group_by(race_clean) %>% summarize(pct = mean(unarmed, na.rm = TRUE) * 100)
    p <- ggplot(plot_df, aes(x = reorder(race_clean, -pct), y = pct, fill = race_clean)) +
      geom_col() + theme_minimal() + labs(x = NULL, y = "% Unarmed")
    ggplotly(p)
  })

  output$plot_age_race <- renderPlotly({
    plot_df <- filtered_data() %>% filter(!is.na(age_numeric), race_clean %in% c("White", "Black", "Hispanic")) %>%
      mutate(age_group = cut(age_numeric, breaks = c(0, 18, 25, 35, 45, 55, 65, 100)))
    p <- ggplot(plot_df, aes(x = age_group, fill = race_clean)) +
      geom_bar(position = "dodge") + theme_minimal() + labs(x = "Age Group", y = "Deaths")
    ggplotly(p)
  })

  output$plot_map <- renderPlot({
    df <- filtered_data() %>% filter(!is.na(latitude), !is.na(longitude))
    world <- ne_countries(scale = "medium", returnclass = "sf")
    sites <- st_as_sf(df, coords = c("longitude", "latitude"), crs = 4326)
    ggplot(data = world) + geom_sf() +
      geom_sf(data = sites, size = .5, shape = 10, color = "darkred", alpha = 0.5) +
      coord_sf(xlim = c(-125, -66), ylim = c(24, 49)) + theme_void()
  })

  output$plot_states <- renderPlotly({
    plot_df <- filtered_data() %>% count(state) %>% slice_max(n, n = 15)
    p <- ggplot(plot_df, aes(x = reorder(state, n), y = n)) +
      geom_col(fill = "steelblue") + coord_flip() + theme_minimal() + labs(x = NULL)
    ggplotly(p)
  })

  output$plot_cities <- renderPlotly({
    plot_df <- filtered_data() %>% mutate(city_state = paste0(city, ", ", state)) %>%
      group_by(city_state) %>% summarize(n = n(), unarmed_pct = mean(str_detect(tolower(armedunarmed_status), "unarmed"), na.rm = TRUE)*100) %>%
      slice_max(n, n = 20)
    p <- ggplot(plot_df, aes(x = n, y = reorder(city_state, n), fill = unarmed_pct)) +
      geom_col() + scale_fill_gradient(low = "lightblue", high = "darkred") +
      theme_minimal() + labs(x = "Deaths", y = NULL, fill = "% Unarmed")
    ggplotly(p)
  })

  output$plot_armed_status <- renderPlotly({
    plot_df <- filtered_data() %>% mutate(status = replace_na(armedunarmed_status, "Unknown")) %>% count(status)
    p <- ggplot(plot_df, aes(x = n, y = reorder(status, n))) + geom_col(fill = "navy") + theme_minimal()
    ggplotly(p)
  })

  output$plot_weapons <- renderPlotly({
    col_name <- "alleged_weapon_source_wapo_and_review_of_cases_not_included_in_wapo_database"
    plot_df <- filtered_data() %>% rename(weapon = !!sym(col_name)) %>% count(weapon) %>% slice_max(n, n = 15)
    p <- ggplot(plot_df, aes(x = n, y = reorder(weapon, n))) + geom_col(fill = "navy") + theme_minimal()
    ggplotly(p)
  })

  output$plot_fleeing_race <- renderPlotly({
    plot_df <- filtered_data() %>% filter(race_clean %in% c("White", "Black", "Hispanic"), fleeing_clean != "Unknown") %>%
      group_by(race_clean, fleeing_clean) %>% summarize(n = n(), .groups = 'drop') %>%
      group_by(race_clean) %>% mutate(pct = n/sum(n)*100)
    p <- ggplot(plot_df, aes(x = race_clean, y = pct, fill = fleeing_clean)) +
      geom_col(position = "dodge") + theme_minimal() + labs(y = "% of Victims", x = NULL, fill = "Status")
    ggplotly(p)
  })

  output$plot_mental_trend <- renderPlotly({
    plot_df <- long_data() %>% group_by(year) %>% summarize(pct = mean(mental_illness_symptoms, na.rm = TRUE)*100)
    p <- ggplot(plot_df, aes(x = year, y = pct)) + geom_line(color = "darkblue", size = 1) + geom_point() +
      geom_smooth(method = "lm", se = FALSE, color = "red", linetype = "dashed") + theme_minimal()
    ggplotly(p)
  })

  output$plot_bodycam <- renderPlotly({
    plot_df <- long_data() %>% group_by(year) %>%
      summarize(pct = mean(str_detect(tolower(body_camera_source_wapo), "true|yes"), na.rm = TRUE)*100)
    p <- ggplot(plot_df, aes(x = year, y = pct)) + geom_area(fill = "darkgreen", alpha = 0.3) +
      geom_line(color = "darkgreen", size = 1) + theme_minimal() + labs(y = "% with Body Camera")
    ggplotly(p)
  })

  output$plot_charges <- renderPlotly({
    plot_df <- long_data() %>%
      mutate(charged = !str_detect(tolower(criminal_charges), "no charges|no known|pending")) %>%
      group_by(year) %>% summarize(pct = mean(charged, na.rm = TRUE)*100)
    p <- ggplot(plot_df, aes(x = year, y = pct)) + geom_line(color = "darkblue", size = 1) +
      geom_hline(yintercept = mean(plot_df$pct), linetype = "dashed", color = "red") + theme_minimal()
    ggplotly(p)
  })

  output$plot_income <- renderPlotly({
    plot_df <- filtered_data() %>% filter(!is.na(median_household_income_acs_census_tract), race_clean %in% c("White", "Black", "Hispanic")) %>%
      mutate(income_bracket = cut(median_household_income_acs_census_tract, breaks = c(0, 35000, 50000, 75000, 100000, 250001))) %>%
      count(income_bracket, race_clean)
    p <- ggplot(plot_df, aes(x = income_bracket, y = n, fill = race_clean)) +
      geom_col(position = "dodge") + theme_minimal() + labs(x = "Neighborhood Income", y = "Deaths")
    ggplotly(p)
  })
}

shinyApp(ui, server)
