export interface AccountMetrics {
  deals: number;
  meetings: number;
  post_calls: number;
  proposals: number;
  meetings_last_30: number;
  deals_won: number;
  deals_lost: number;
}

export interface AccountSummary {
  account_id: string;
  name: string;
  domain?: string | null;
  owner?: string | null;
  industry?: string | null;
  location?: string | null;
  summary?: string | null;
  summary_updated?: string | null;
  salesforce_id?: string | null;
  created_at: string;
  updated_at: string;
  metrics: AccountMetrics;
}

export interface MeetingAnalysisJobSummary {
  job_id: string;
  status: string;
  transcript_status: string;
  transcript_analysis_id?: string | null;
  proposal_status: string;
  proposal_job_id?: string | null;
  ppt_status: string;
  error_message?: string | null;
  ppt_job_id?: string | null;
  ppt_download_url?: string | null;
  ppt_file_name?: string | null;
  ppt_slide_count?: number | null;
  updated_at?: string | null;
  completed_at?: string | null;
}

export interface AccountMeeting {
  meeting_id: string;
  title: string;
  meeting_date: string | null;
  duration_minutes?: number | null;
  deal_id?: string | null;
  deal_name?: string | null;
  pre_call_done?: boolean;
  post_call_done?: boolean;
  proposal_generated?: boolean;
  notes?: string | null;
  analysis_job?: MeetingAnalysisJobSummary | null;
}

export interface AccountDeal {
  deal_id: string;
  opportunity_name: string;
  stage: string;
  status: string;
  progress_percentage: number;
  estimated_value?: number;
  updated_at: string;
  meetings: AccountMeeting[];
}

export interface AccountDetail extends AccountSummary {
  deals: AccountDeal[];
  meetings: AccountMeeting[];
}
