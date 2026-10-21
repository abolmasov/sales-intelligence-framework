/**
 * Research-related type definitions
 * Shared between frontend and backend to ensure type safety
 */

export interface ResearchSession {
  session_id: string;
  deal_id?: string;
  company_name: string;
  purpose_of_meeting?: string;
  meeting_title?: string;
  meeting_date?: string;
  status: ResearchStatus;
  result?: ResearchResult;
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

export type ResearchStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'error';

export interface ResearchRequest {
  companyName: string;
  dealId?: string;
  meetingId?: string;
  purposeOfMeeting?: string;
  meetingTitle?: string;
  meetingDate?: string;
  meetingTime?: string;
  attendees?: ResearchAttendee[];
  meetingContext?: string;
  accessToken?: string; // Microsoft access token for InternalKnowledge authentication
}

export interface ResearchAttendee {
  name: string;
  email?: string;
  role?: string;
  company?: string;
}

export interface Citation {
  title: string;
  url: string;
  snippet: string;
  publishedDate?: string;
  score?: number;
}

export interface CitedInsight {
  insight: string;
  citations: Citation[];
}

export interface ResearchResult {
  companyOverview?: string;
  executiveSummary?: string;
  financialPerformance?: string;
  salesOpportunities?: string;
  keyInsights?: string[];
  strategicInitiatives?: string[];
  challenges?: string[];
  competitiveLandscape?: string;
  recommendedApproach?: string[];
  relevantCaseStudies?: CaseStudy[];
  news?: NewsAnalysis;

  // Enhanced intensive research with citations
  intensiveResearch?: {
    companyOverview: CitedInsight;
    whatTheyDo: CitedInsight;
    industryAndMarket: CitedInsight;
    competitorLandscape: CitedInsight;
    whatDistinguishesThem: CitedInsight;
    enterpriseClientFit: CitedInsight;
    digitalTransformationSignals: CitedInsight;
    allSources: Citation[];
  };
}

export interface CaseStudy {
  title: string;
  client?: string;
  industry?: string;
  description: string;
  outcomes?: string[];
  relevanceScore?: number;
}

export interface NewsAnalysis {
  total_articles: number;
  recent_headlines: NewsArticle[];
  key_topics: string[];
  overall_sentiment: NewsSentiment;
  trending_stories: string[];
  sources_count: number;
  date_range: string;
}

export interface NewsArticle {
  title: string;
  source: string;
  date: string;
  link: string;
  description: string;
}

export type NewsSentiment =
  | 'positive'
  | 'negative'
  | 'mixed'
  | 'unknown';

export interface ResearchProgress {
  currentStep: string;
  percentage: number;
  message?: string;
}

export interface CompanyIntelligence {
  company_name: string;
  overview: string;
  financial_summary: string;
  strategic_priorities: string[];
  recent_news: NewsArticle[];
  sales_opportunities: string[];
  recommended_approach: string[];
  generated_at: string;
}

// Enhanced Research Types for Sales Intelligence UI
export interface DealHealthSignals {
  overallScore: number; // 0-100
  budgetMentioned: boolean;
  timelineUrgency: 'high' | 'medium' | 'low' | 'unknown';
  decisionMakerPresent: boolean;
  painPointsIdentified: string[];
  competitorMentions: string[];
  riskFactors: string[];
  opportunitySignals: string[];
}

export interface ActionItem {
  id: string;
  priority: 'high' | 'medium' | 'low';
  action: string;
  rationale: string;
  dueWithin: string;
  category?: 'follow-up' | 'meeting' | 'research' | 'internal' | 'other';
}

export interface EnhancedCompanyIntelligence {
  employeeCount?: string;
  revenue?: string;
  industry: string;
  sector?: string;
  techStack?: string[];
  recentNewsSentiment: 'positive' | 'neutral' | 'negative';
  keyHighlights: string[];
  fundingInfo?: string;
  headquarters?: string;
}

export interface StakeholderInsight {
  name: string;
  role: string;
  company?: string;
  email?: string;
  influenceLevel: 'high' | 'medium' | 'low';
  talkingPoints: string[];
  linkedInSummary?: string;
  department?: string;
  isDecisionMaker?: boolean;
}

export interface PastEngagement {
  id: string;
  date: string;
  type: 'meeting' | 'proposal' | 'email' | 'call' | 'deal';
  title: string;
  description: string;
  outcome?: string;
  participants?: string[];
}

export interface RelatedCaseStudy {
  id: string;
  title: string;
  industry: string;
  relevanceScore: number;
  summary: string;
  url?: string;
  highlights?: string[];
}

export interface InternalContact {
  name: string;
  role: string;
  relationship: string;
  lastContact?: string;
}

export interface EnhancedResearchResult extends ResearchResult {
  // Deal Health Signals
  dealHealthSignals?: DealHealthSignals;

  // Action Items
  suggestedActions?: ActionItem[];

  // Company Intelligence
  companyIntelligence?: EnhancedCompanyIntelligence;

  // Stakeholder Insights
  stakeholderInsights?: StakeholderInsight[];

  // Relationship Context
  pastEngagements?: PastEngagement[];
  relatedCaseStudies?: RelatedCaseStudy[];
  internalContacts?: InternalContact[];
}
