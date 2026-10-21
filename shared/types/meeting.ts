/**
 * Meeting-related type definitions
 * Shared between frontend and backend to ensure type safety
 */

export interface Meeting {
  meeting_id: string;
  deal_id?: string;
  account_id?: string;
  title: string;
  meeting_date: string | null;
  duration_minutes: number | null;
  internal_attendees: string[];
  external_attendees: string[];
  transcript?: string;
  recording_url?: string;
  notes?: string;
  analysis_id?: string;
  has_transcript: boolean;
  has_analysis: boolean;
  sentiment?: MeetingSentiment;
  opportunity_score?: number;
  key_points?: string[];
  action_items?: string[];
  created_at: string;
  updated_at: string;
  account?: {
    account_id: string;
    name: string;
  } | null;
}

export type MeetingSentiment =
  | 'positive'
  | 'neutral'
  | 'negative'
  | 'mixed';

export interface AttendeeInfo {
  name: string;
  email?: string;
  role?: string;
  company?: string;
}

export interface CreateMeetingRequest {
  deal_id?: string;
  account_id?: string;
  title: string;
  meeting_date?: string;
  duration_minutes?: number;
  internal_attendees?: string[];
  external_attendees?: string[];
  transcript?: string;
  recording_url?: string;
  notes?: string;
}

export interface UpdateMeetingRequest {
  deal_id?: string;
  account_id?: string | null;
  title?: string;
  meeting_date?: string;
  duration_minutes?: number;
  internal_attendees?: string[];
  external_attendees?: string[];
  transcript?: string;
  recording_url?: string;
  notes?: string;
}

export interface MeetingAnalysisSummary {
  meeting_id: string;
  title: string;
  meeting_date: string | null;
  sentiment?: MeetingSentiment;
  opportunity_score?: number;
  key_points_count: number;
  action_items_count: number;
  has_transcript: boolean;
}
