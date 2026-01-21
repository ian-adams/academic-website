import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://ianadamsresearch.com',
  integrations: [
    react(),
    tailwind({
      applyBaseStyles: false,
    }),
    mdx(),
    sitemap(),
  ],
  output: 'static',
  build: {
    assets: '_assets',
  },
  vite: {
    ssr: {
      noExternal: ['react-plotly.js'],
    },
    optimizeDeps: {
      exclude: ['plotly.js-dist-min'],
    },
  },
});
