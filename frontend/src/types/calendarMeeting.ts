export interface CalendarAttendee {
  name: string;
  email?: string;
  role?: string;
}

export interface CalendarDeal {
  deal_id: string;
  opportunity_name: string;
  company_name: string;
  stage: string;
  progress_percentage: number;
  estimated_value?: number;
  close_date?: string;
  status: string;
  priority?: string;
  win_themes?: any[];
  story?: string;
}

export type MeetingStatus = 'scheduled' | 'completed' | 'analyzing' | 'analyzed';
export type MeetingSource = 'graph' | 'manual' | 'demo';

export interface PreCallQuestion {
  id: number;
  question: string;
  category: string;
  context: string;
  northstar_connection: string;
  product_focus: string;
  target_persona: string;
}

export interface PreCallQuestionnaire {
  questions: PreCallQuestion[];
  metadata?: {
    services_count?: number;
    products_count?: number;
    insights_count?: number;
  };
}

export interface PreCallAnalysisSummary {
  sessionId: string;
  status: string;
  completedAt: string | null;
  startedAt: string | null;
  currentStep: string | null;
}

export interface PostCallAnalysisSummary {
  analysisId: string;
  status: string;
  analyzedAt: string | null;
  companyName: string | null;
  meetingTitle: string | null;
}

export interface ProposalAnalysisSummary {
  jobId: string;
  status: string;
  analysisType: string;
  currentStep: string | null;
  completedAt: string | null;
}

export interface MeetingAnalysisSummary {
  preCall: PreCallAnalysisSummary[];
  postCall: PostCallAnalysisSummary[];
  proposals: ProposalAnalysisSummary[];
}

export interface MeetingAnalysisJob {
  jobId: string;
  status: string;
  transcriptStatus: string;
  transcriptAnalysisId?: string | null;
  proposalStatus: string;
  proposalJobId?: string | null;
  pptStatus: string;
  pptJobId?: string | null;
  pptDownloadUrl?: string | null;
  pptFileName?: string | null;
  pptSlideCount?: number | null;
  errorMessage?: string | null;
  updatedAt?: string | null;
  completedAt?: string | null;
}

export interface CalendarMeeting {
  id: string;
  eventId?: string | null;
  onlineMeetingId?: string | null;
  icalUid?: string | null;
  title: string;
  company: string;
  date: string;
  time: string;
  duration: number;
  attendees: CalendarAttendee[];
  internalAttendees?: CalendarAttendee[];
  externalAttendees?: CalendarAttendee[];
  purpose: string;
  status: MeetingStatus;
  analysisSessionId?: string;
  analysisSummary?: MeetingAnalysisSummary;
  analysisJob?: MeetingAnalysisJob | null;
  isFromTeams?: boolean;
  deal_id?: string;
  deal?: CalendarDeal;
  accountId?: string | null;
  accountName?: string | null;
  transcriptAvailable?: boolean;
  location?: string | null;
  joinUrl?: string | null;
  startDateTime?: string | null;
  source?: MeetingSource;
  notes?: string | null;
  displayDate?: string | null;
  displayTime?: string | null;
  timeZoneLabel?: string | null;
}
