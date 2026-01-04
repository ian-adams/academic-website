# MPV Data Analysis - Auto-Updating Blog Post

## Overview

This blog post **automatically updates** whenever the website is rebuilt. It downloads the latest data from Mapping Police Violence and regenerates all visualizations.

## How It Works

1. **R Markdown**: The post is written in R Markdown (`index.Rmd`), which contains both text and R code
2. **Automatic Download**: When the site builds, the R code downloads the latest MPV Excel file
3. **Data Processing**: The code cleans and analyzes the data
4. **Visualization Generation**: All charts are generated fresh with the latest data
5. **HTML Output**: The `.Rmd` file is knitted to `index.html`, which is then served by Hugo

## Build Process

When you rebuild your website (either locally or via Netlify):

1. Hugo/blogdown processes all `.Rmd` files
2. The R code chunks execute in order
3. Fresh data is downloaded from: `https://mappingpoliceviolence.us/s/MPVDatasetDownload.xlsx`
4. Visualizations are created and embedded in the post
5. The HTML output includes the latest data and charts

## Key Features

### Data Disclaimers
The post includes prominent warnings that:
- This data captures **killings only**, not all uses of lethal force
- Most police shootings are survived, so these numbers undercount total incidents
- The statistics are descriptive only and don't establish causation

### Automatic Updates
- **No manual intervention needed** - just rebuild the site
- Data is always current as of the last build
- Date stamps update automatically

### Comprehensive Analysis
Includes visualizations for:
- Cumulative trends (all deaths and shootings only)
- Demographic patterns (race, age)
- Behavioral context (armed status, mental health)
- Temporal patterns (seasonal, day of week)
- Geographic distribution (maps, states, cities)
- Per capita rates
- Accountability and socioeconomic factors

## Required R Packages

The analysis requires:
- tidyverse
- readxl
- lubridate
- gghighlight
- ggthemes
- ggrepel
- slider
- sf
- rnaturalearth
- rnaturalearthdata

These should be installed in your R environment where the site builds.

## Customization

To modify the analysis:
1. Edit `index.Rmd`
2. Rebuild the site locally to test: `blogdown::serve_site()`
3. Commit and push changes

## Data Source

Data automatically downloaded from:
**Mapping Police Violence**: https://mappingpoliceviolence.org/

The database is continuously updated and currently includes data through 12/31/2025.

## Notes

- The download happens at build time, so there's a brief delay
- The `.Rmd` file has `cache=FALSE` on the download chunk to ensure fresh data
- All file paths are temporary to avoid cluttering the repository
- Visualizations are embedded directly in the HTML (no separate image files needed)
