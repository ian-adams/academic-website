# Ian T. Adams - Academic Website

[![Netlify Status](https://api.netlify.com/api/v1/badges/41cec13b-04b9-449c-a3c0-583902841e83/deploy-status)](https://app.netlify.com/sites/ianadams/deploys)

Personal academic website for Ian T. Adams, Ph.D., Assistant Professor at the University of South Carolina.

**Live site:** [ianadamsresearch.com](https://www.ianadamsresearch.com)

## Tech Stack

- **[Astro](https://astro.build/)** - Static site generator
- **[React](https://react.dev/)** - Interactive components
- **[Tailwind CSS](https://tailwindcss.com/)** - Styling
- **[Plotly.js](https://plotly.com/javascript/)** - Data visualizations
- **[Netlify](https://netlify.com/)** - Hosting & deployment

## Project Structure

```
academic-website-astro/
├── public/
│   ├── data/          # JSON data feeds
│   ├── media/         # Images
│   └── pdfs/          # PDF documents
├── src/
│   ├── components/    # Astro & React components
│   ├── content/       # Markdown content (posts, publications)
│   ├── layouts/       # Page layouts
│   ├── pages/         # Route pages
│   └── styles/        # Global CSS
└── scripts/           # Data processing scripts
```

## Local Development

```bash
cd academic-website-astro
npm install
npm run dev
```

Site runs at `http://localhost:4321`

## Adding Content

### New Blog Post
1. Copy `src/content/posts/_template.md`
2. Rename and edit with your content
3. Commit and push

### Update MPV Dashboard Data
```bash
python scripts/preprocess-mpv-data.py
```

## Deployment

Pushes to `master` automatically deploy via Netlify.

## License

Content © Ian T. Adams. Code available under MIT License.
