/**
 * Anthropic Claude client for article analysis
 */

import Anthropic from '@anthropic-ai/sdk';
import type { NewsAPIArticle, ClaudeAnalysis } from './types.js';

export class ArticleAnalyzer {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model: string = 'claude-sonnet-4-20250514') {
    if (!apiKey) {
      throw new Error('Anthropic API key is required');
    }
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  /**
   * Analyze a single article and return structured metadata
   */
  async analyzeArticle(
    article: NewsAPIArticle,
    systemPrompt: string
  ): Promise<ClaudeAnalysis | null> {
    const articleText = this.formatArticleForAnalysis(article);

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 500,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Analyze this article and respond with ONLY a JSON object (no markdown, no explanation):

${articleText}

Respond with this exact JSON structure:
{
  "story_type": "research" | "incident" | "investigative" | "general",
  "relevance_score": 0.0-1.0,
  "key_entities": "comma-separated string",
  "location": "location string or null",
  "tags": ["tag1", "tag2"],
  "needs_review": 0 or 1
}`,
          },
        ],
      });

      // Extract text from response
      const textBlock = response.content.find((block) => block.type === 'text');
      if (!textBlock || textBlock.type !== 'text') {
        console.error('No text response from Claude');
        return null;
      }

      // Parse JSON response
      const jsonStr = textBlock.text.trim();
      const analysis = JSON.parse(jsonStr) as ClaudeAnalysis;

      // Validate required fields
      if (!analysis.story_type || typeof analysis.relevance_score !== 'number') {
        console.error('Invalid analysis structure:', analysis);
        return null;
      }

      return analysis;
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Failed to analyze article "${article.title}": ${error.message}`);
      }
      return null;
    }
  }

  /**
   * Analyze multiple articles with rate limiting
   */
  async analyzeArticles(
    articles: NewsAPIArticle[],
    systemPrompt: string,
    options: {
      batchSize?: number;
      delayMs?: number;
      onProgress?: (completed: number, total: number) => void;
    } = {}
  ): Promise<Map<string, ClaudeAnalysis>> {
    const { batchSize = 5, delayMs = 1000, onProgress } = options;

    const results = new Map<string, ClaudeAnalysis>();
    let completed = 0;

    for (let i = 0; i < articles.length; i += batchSize) {
      const batch = articles.slice(i, i + batchSize);

      // Process batch in parallel
      const batchPromises = batch.map(async (article) => {
        const analysis = await this.analyzeArticle(article, systemPrompt);
        if (analysis) {
          results.set(article.url, analysis);
        }
        completed++;
        onProgress?.(completed, articles.length);
      });

      await Promise.all(batchPromises);

      // Rate limiting between batches
      if (i + batchSize < articles.length) {
        await this.sleep(delayMs);
      }
    }

    return results;
  }

  private formatArticleForAnalysis(article: NewsAPIArticle): string {
    const parts = [
      `Title: ${article.title}`,
      `Source: ${article.source.name}`,
      `Published: ${article.publishedAt}`,
    ];

    if (article.description) {
      parts.push(`Description: ${article.description}`);
    }

    if (article.content) {
      // NewsAPI truncates content with "[+N chars]" - clean it up
      const cleanContent = article.content.replace(/\[\+\d+ chars\]$/, '').trim();
      parts.push(`Content: ${cleanContent}`);
    }

    return parts.join('\n');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
