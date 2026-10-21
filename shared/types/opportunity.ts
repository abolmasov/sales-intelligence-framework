export interface OpportunityInsight {
  opportunity_id: string;
  deal_id?: string | null;
  meeting_id?: string | null;
  meeting_title?: string | null;
  transcript_analysis_id?: string | null;
  title?: string | null;
  description?: string | null;
  confidence_score?: number | null;
  status?: string;
  source?: string | null;
  created_at: string;
  updated_at: string;
  details?: Record<string, any> | null;
}
