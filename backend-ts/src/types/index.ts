/**
 * Backend Types Index
 * Re-exports shared types and adds backend-specific types
 */

// Re-export all shared types
export * from '../../../shared/types';

/**
 * OpenAI Service types
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

/**
 * Web search types (used by research pipeline)
 */
export interface SearchOptions {
  query: string;
  maxResults?: number;
  includeDomains?: string[];
  excludeDomains?: string[];
}

export interface SearchResult {
  title: string;
  url: string;
  content: string;
  score?: number;
  publishedDate?: string;
}

export interface CitedInsight {
  insight: string;
  citations: Citation[];
}

export interface Citation {
  title: string;
  url: string;
  snippet: string;
  publishedDate?: string;
  score?: number;
}

export interface IntensiveResearchResult {
  companyOverview: CitedInsight;
  whatTheyDo: CitedInsight;
  industryAndMarket: CitedInsight;
  competitorLandscape: CitedInsight;
  whatDistinguishesThem: CitedInsight;
  enterpriseClientFit: CitedInsight;
  digitalTransformationSignals: CitedInsight;
  allSources: Citation[];
}

/**
 * NewsData.io Service types
 */
export interface NewsSearchOptions {
  query: string;
  category?: string;
  size?: number;
}

export type NewsTopicType =
  | 'Financial Performance'
  | 'Leadership Changes'
  | 'Corporate Strategy'
  | 'Market Position'
  | 'Mergers & Acquisitions'
  | 'Partnerships & Alliances'
  | 'Product & Innovation'
  | 'Technology & Digital'
  | 'Legal & Compliance'
  | 'Operations & Facilities'
  | 'Investment & Funding';

export interface CompanyNewsResult {
  news_intelligence_complete: boolean;
  news_analysis: any; // Uses NewsAnalysis from shared types
  news_summary: string;
  recent_headlines: any[]; // Uses NewsArticle from shared types
  news_sentiment: string; // Uses NewsSentiment from shared types
  key_topics: string[];
}
