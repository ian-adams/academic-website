# MPV Analytical Engine - Deployment Guide

This guide will help you deploy your Mapping Police Violence dashboard to ShinyApps.io and integrate it with your academic website.

## Option 1: Deploy to ShinyApps.io (Recommended)

ShinyApps.io is the easiest way to deploy Shiny apps online. They offer a free tier that should work well for academic projects.

### Step 1: Create a ShinyApps.io Account

1. Go to [https://www.shinyapps.io/](https://www.shinyapps.io/)
2. Click "Sign Up" and create a free account
3. Choose the free tier (allows 5 apps, 25 active hours/month)

### Step 2: Install Required Packages

Open R/RStudio and install the deployment package:

```r
install.packages("rsconnect")
```

### Step 3: Configure Your Account

1. Log into your ShinyApps.io account
2. Click on your name (top right) → Tokens
3. Click "Show" next to your token
4. Copy the `rsconnect::setAccountInfo()` command shown
5. Paste and run it in your R console

It will look something like:

```r
rsconnect::setAccountInfo(
  name='your-account-name',
  token='ABC123...',
  secret='XYZ789...'
)
```

### Step 4: Deploy Your App

Navigate to the app directory and deploy:

```r
# Set working directory to the app folder
setwd("~/academic-website/shiny-apps/mpv-dashboard")

# Deploy the app
library(rsconnect)
deployApp(
  appName = "mpv-dashboard",  # Choose a unique name
  appTitle = "MPV Analytical Engine"
)
```

The deployment process will:
- Bundle your app.R file
- Install all required packages on the server
- Upload everything to ShinyApps.io
- Provide you with a URL like: `https://YOUR-USERNAME.shinyapps.io/mpv-dashboard/`

### Step 5: Update Your Blog Post

Once deployed, update the blog post with your actual app URL:

1. Open `content/post/2026-01-04-mapping-police-violence-dashboard/index.Rmd`
2. Replace `YOUR_SHINYAPPS_URL_HERE` with your actual URL (appears twice)
3. Rebuild your website

### Step 6: Rebuild and Deploy Your Website

```bash
# In RStudio or R terminal
blogdown::build_site()

# If using Netlify (which you are), commit and push:
git add .
git commit -m "Add MPV dashboard post"
git push origin claude/deploy-shiny-dashboard-1ltkl
```

Netlify will automatically rebuild your site when you push to your branch.

## Option 2: Self-Hosted with Shiny Server (Advanced)

If you have your own server, you can install Shiny Server:

1. Install Shiny Server: [https://posit.co/download/shiny-server/](https://posit.co/download/shiny-server/)
2. Copy your app to `/srv/shiny-server/mpv-dashboard/`
3. Configure nginx/apache to proxy to Shiny Server
4. Update your blog post with your self-hosted URL

## Option 3: Embed as Static HTML (Limited Interactivity)

If you want to avoid external hosting, you can create static plots, but you'll lose the interactive filtering:

```r
# Not recommended - you'll lose the dynamic filtering
# But this creates standalone HTML widgets
library(htmlwidgets)
# ... create individual plots and save as HTML files
```

## Troubleshooting

### App won't deploy - package errors

Make sure all packages are installed locally first:

```r
packages <- c("shiny", "bslib", "tidyverse", "lubridate", "plotly",
              "scales", "readxl", "here", "gghighlight", "ggthemes",
              "sf", "rnaturalearth", "rnaturalearthdata")
install.packages(packages)
```

### App times out or runs slowly

The app downloads ~25MB of data on first load. ShinyApps.io free tier has limited resources. Consider:

- Caching the data file to reduce download frequency
- Using ShinyApps.io's paid tier for better performance
- Pre-processing the data and storing as .rds file

### CORS errors when embedding

Some browsers block iframes from different domains. Users may need to click through to the full app.

## Updating the Dashboard

To update your deployed app after making changes:

```r
setwd("~/academic-website/shiny-apps/mpv-dashboard")
deployApp(appName = "mpv-dashboard")
```

ShinyApps.io will replace the old version with your updated code.

## Resource Management (ShinyApps.io Free Tier)

The free tier includes:
- 5 applications
- 25 active hours per month
- 1 concurrent user per app

The app will "sleep" after 15 minutes of inactivity and wake up when someone visits (takes ~10 seconds).

Monitor your usage at: https://www.shinyapps.io/admin/#/dashboard

## Alternative: GitHub + Binder (Free, but slower)

You can also use Binder to run Shiny apps from GitHub:

1. Create a GitHub repo with your app
2. Add a `runtime.txt` with R version
3. Add an `install.R` with package installations
4. Use mybinder.org to generate a link

This is free but much slower than ShinyApps.io.

## Questions?

- ShinyApps.io documentation: https://docs.posit.co/shinyapps.io/
- Shiny gallery: https://shiny.posit.co/r/gallery/
- Community help: https://forum.posit.co/c/shiny/
