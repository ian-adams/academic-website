import { defineCollection, z } from 'astro:content';

const publications = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    authors: z.array(z.string()),
    date: z.coerce.date(),
    publishDate: z.coerce.date().optional(),
    publication_types: z.array(z.string()).optional(),
    publication: z.string().optional(),
    publication_short: z.string().optional(),
    abstract: z.string().optional(),
    summary: z.string().optional(),
    featured: z.boolean().default(false),
    url_pdf: z.string().optional(),
    url_code: z.string().optional(),
    url_dataset: z.string().optional(),
    url_poster: z.string().optional(),
    url_project: z.string().optional(),
    url_slides: z.string().optional(),
    url_source: z.string().optional(),
    url_video: z.string().optional(),
    projects: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    categories: z.array(z.string()).optional(),
    links: z.array(z.object({
      name: z.string(),
      url: z.string(),
    })).optional(),
    image: z.object({
      caption: z.string().optional(),
      focal_point: z.string().optional(),
    }).optional(),
  }),
});

const posts = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    subtitle: z.string().optional(),
    summary: z.string().optional(),
    authors: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    categories: z.array(z.string()).optional(),
    date: z.coerce.date(),
    lastmod: z.coerce.date().optional(),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
    image: z.object({
      caption: z.string().optional(),
      focal_point: z.string().optional(),
      preview_only: z.boolean().optional(),
    }).optional(),
    projects: z.array(z.string()).optional(),
  }),
});

export const collections = {
  publications,
  posts,
};
