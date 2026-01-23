/**
 * NewsAPI client for fetching news articles
 */

import type { NewsAPIResponse, NewsAPIArticle } from './types.js';

const NEWS_API_BASE = 'https://newsapi.org/v2';

export class NewsAPIClient {
  private apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('NewsAPI key is required');
    }
    this.apiKey = apiKey;
  }

  /**
   * Search for articles matching a query
   */
  async searchArticles(
    query: string,
    options: {
      from?: string;
      to?: string;
      language?: string;
      sortBy?: 'relevancy' | 'popularity' | 'publishedAt';
      pageSize?: number;
    } = {}
  ): Promise<NewsAPIArticle[]> {
    const {
      from = this.getDefaultFromDate(),
      to = new Date().toISOString().split('T')[0],
      language = 'en',
      sortBy = 'publishedAt',
      pageSize = 100,
    } = options;

    const params = new URLSearchParams({
      q: query,
      from,
      to,
      language,
      sortBy,
      pageSize: pageSize.toString(),
      apiKey: this.apiKey,
    });

    const url = `${NEWS_API_BASE}/everything?${params}`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`NewsAPI error: ${error.message || response.statusText}`);
      }

      const data: NewsAPIResponse = await response.json();

      if (data.status !== 'ok') {
        throw new Error(`NewsAPI returned status: ${data.status}`);
      }

      return data.articles;
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Failed to fetch articles for query "${query}": ${error.message}`);
      }
      return [];
    }
  }

  /**
   * Search multiple queries and deduplicate results
   */
  async searchMultipleQueries(
    queries: string[],
    options: {
      from?: string;
      to?: string;
      language?: string;
      sortBy?: 'relevancy' | 'popularity' | 'publishedAt';
      pageSize?: number;
    } = {}
  ): Promise<NewsAPIArticle[]> {
    const allArticles: NewsAPIArticle[] = [];
    const seenUrls = new Set<string>();

    for (const query of queries) {
      console.log(`Searching for: "${query}"`);
      const articles = await this.searchArticles(query, options);

      for (const article of articles) {
        // Deduplicate by URL
        if (!seenUrls.has(article.url)) {
          seenUrls.add(article.url);
          allArticles.push(article);
        }
      }

      // Rate limiting - be nice to the API
      await this.sleep(500);
    }

    console.log(`Found ${allArticles.length} unique articles from ${queries.length} queries`);
    return allArticles;
  }

  /**
   * Get default "from" date (7 days ago)
   */
  private getDefaultFromDate(): string {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date.toISOString().split('T')[0];
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
