/**
 * Deal-related type definitions
 * Shared between frontend and backend to ensure type safety
 */

import { OpportunityInsight } from './opportunity';

export interface Deal {
  deal_id: string;
  opportunity_name: string;
  company_name: string;
  account_id?: string | null;
  account_name?: string | null;
  stage: DealStage;
  progress_percentage: number;
  status: DealStatus;
  priority?: DealPriority;
  owner?: string;
  team_members?: string;
  estimated_value?: number;
  close_date?: string;
  win_themes?: string[];
  story?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  salesforce_id?: string | null;
  opportunities?: OpportunityInsight[];
}

export type DealStage =
  | 'prospecting'
  | 'qualification'
  | 'proposal_sent'
  | 'negotiation'
  | 'closed_won'
  | 'closed_lost';

export type DealStatus =
  | 'active'
  | 'won'
  | 'lost'
  | 'on_hold';

export type DealPriority =
  | 'high'
  | 'medium'
  | 'low';

export interface DealStageInfo {
  value: DealStage;
  label: string;
  progress: number;
  description?: string;
}

export interface DealStats {
  total: number;
  active: number;
  won: number;
  lost: number;
  on_hold: number;
  total_value: number;
  average_value: number;
}

export interface CreateDealRequest {
  opportunityName: string;
  companyName: string;
  stage?: DealStage;
  priority?: DealPriority;
  owner?: string;
  estimatedValue?: number;
  closeDate?: string;
  notes?: string;
  accountId?: string;
}

export interface UpdateDealRequest {
  opportunity_name?: string;
  company_name?: string;
  stage?: DealStage;
  progress_percentage?: number;
  status?: DealStatus;
  priority?: DealPriority;
  owner?: string;
  estimated_value?: number;
  close_date?: string;
  win_themes?: string[];
  story?: string;
  notes?: string;
}

export interface DealWithRelations extends Deal {
  meetings?: any[];
  analyses?: any[];
  transcripts?: any[];
  research_sessions?: any[];
  proposalJobs?: any[];
  pptxJobs?: any[];
}
