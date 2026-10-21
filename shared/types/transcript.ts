/**
 * Transcript and Analysis-related type definitions
 * Shared between frontend and backend to ensure type safety
 */

export interface TranscriptAnalysis {
  analysis_id: string;
  deal_id?: string;
  meeting_id?: string;
  account_id?: string;
  transcript_text: string;
  analysis_result: TranscriptAnalysisResult;
  sentiment: AnalysisSentiment;
  opportunity_score: number;
  success_probability?: number;
  created_at: string;
  updated_at: string;
  status?: 'processing' | 'completed' | 'error';
  error_message?: string;
  sentiment_short?: string;
  auto_proposal_requested?: boolean;
  auto_ppt_requested?: boolean;
  proposal_job_id?: string | null;
  ppt_job_id?: string | null;
  requested_by?: string | null;
}

export type AnalysisSentiment =
  | 'positive'
  | 'neutral'
  | 'negative'
  | 'mixed';

export interface TranscriptAnalysisRequest {
  transcriptText: string;
  dealId?: string;
  meetingId?: string;
  accountId?: string;
  companyName?: string;
  meetingTitle?: string;
  meetingContext?: string;
  runProposal?: boolean;
  runPpt?: boolean;
}

export interface TranscriptCallDetails {
  callID?: string;
  date?: string;
  duration?: string;
  participants?: string[];
  salesRepresentative?: string;
  client?: string;
}

export interface TranscriptSpeaker {
  id?: string;
  name?: string;
  speakingTime?: string;
  talkRatio?: string;
}

export interface TranscriptKeyMoment {
  timestamp?: string;
  speaker?: string;
  description?: string;
  type?: string;
  responseStrategy?: string;
}

export interface TranscriptOpportunityDetected {
  id?: string;
  description?: string;
  confidence?: string;
  relatedSegment?: string;
  timestamp?: string;
  similarCaseStudy?: string;
  source?: string;
}

export interface TranscriptPastOpportunity {
  caseStudy?: string;
  keyChallenge?: string;
  enterpriseSolutionOutcomes?: string;
}

export interface TranscriptSentimentInsight {
  opportunityID?: string;
  sentiment?: string;
  confidence?: string;
  notes?: string;
}

export interface TranscriptReferences {
  summary?: string;
  links?: string[];
}

export type TranscriptPursuitBrief = Record<string, string>;

export interface TranscriptTimelineBudget {
  timeline?: string;
  budget?: string;
  urgency?: string;
}

export interface TranscriptRecommendedProducts {
  atlassian?: Array<string | Record<string, any>>;
  enterprise_services?: Array<string | Record<string, any>>;
  [key: string]: Array<string | Record<string, any>> | undefined;
}

export interface TranscriptRecommendedTeamMember {
  role?: string;
  name?: string;
  rationale?: string;
  reason?: string;
  description?: string;
}

export interface TranscriptStakeholder {
  name?: string;
  role?: string;
  influence?: string;
  notes?: string;
}

export interface TranscriptAnalysisResult {
  summary?: string;
  keyPoints?: string[];
  actionItems?: string[];
  sentiment?: AnalysisSentiment | string;
  opportunityScore?: number;
  successProbability?: number;
  attendeeInsights?: AttendeeInsight[];
  technicalRequirements?: string[];
  nextSteps?: string[];
  concerns?: string[];
  competitorsmention?: string[];
  competitorMentions?: any[];
  budgetDiscussion?: string;
  decisionMakers?: string[];
  executiveSummary?: string;
  keyDiscussionPoints?: string[];
  buyingSignals?: any[];
  painPoints?: any[];
  riskFactors?: string[] | any[];
  stakeholders?: TranscriptStakeholder[];
  timelineBudget?: TranscriptTimelineBudget;
  recommendedProducts?: TranscriptRecommendedProducts;
  recommendedTeam?: TranscriptRecommendedTeamMember[];
  relevantCaseStudies?: any[];
  callDetails?: TranscriptCallDetails;
  speakers?: TranscriptSpeaker[];
  transcriptSummary?: string;
  keyMoments?: TranscriptKeyMoment[];
  opportunitiesDetected?: TranscriptOpportunityDetected[];
  pastSimilarOpportunities?: TranscriptPastOpportunity[];
  opportunitySummary?: string;
  sentimentAnalysis?: TranscriptSentimentInsight[];
  overallSentiment?: string;
  sentimentNarrative?: string;
  references?: TranscriptReferences;
  pursuitBrief?: TranscriptPursuitBrief;
  data?: any;
}

export interface AttendeeInsight {
  name?: string;
  role?: string;
  sentiment?: AnalysisSentiment;
  engagementLevel?: 'high' | 'medium' | 'low';
  keyPoints?: string[];
  concerns?: string[];
}

export interface OpportunityDetection {
  opportunity_id: string;
  transcript_analysis_id?: string;
  opportunity_type: OpportunityType;
  description: string;
  confidence_score: number;
  recommended_actions: string[];
  created_at: string;
}

export type OpportunityType =
  | 'immediate'
  | 'short_term'
  | 'long_term'
  | 'upsell'
  | 'cross_sell';

export interface CreateTranscriptAnalysisRequest {
  transcript_text: string;
  deal_id?: string;
  meeting_id?: string;
  company_name?: string;
  meeting_title?: string;
  attendees?: string[];
}
