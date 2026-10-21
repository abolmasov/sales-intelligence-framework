import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardHeader,
  CardContent,
  Chip,
  LinearProgress,
  Tabs,
  Tab,
  Stack,
  Alert,
  Avatar,
  FormControl,
  InputLabel,
  Select,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Stepper,
  Step,
  StepLabel,
  Paper,
  Divider,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Grid,
  FormControlLabel,
  Checkbox,
  Fade,
  Link,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  ArrowBack,
  Edit,
  CheckCircle,
  Schedule,
  TrendingUp,
  Business,
  Person,
  AttachMoney,
  CalendarToday,
  Notes,
  Save,
  Cancel,
  Search,
  Assignment,
  Lightbulb,
  Event,
  Assessment,
  Group,
  Description,
  Timeline,
  PlayArrow,
  Insights,
  Psychology,
  Hub,
  CloudUpload,
  Cloud as CloudIcon,
  Link as LinkIcon,
  Add as AddIcon,
  Email,
  Quiz,
  AutoFixHigh,
  InsertDriveFile,
  Launch,
  LinkOff,
  Download,
  Slideshow,
  Article,
  BatchPrediction,
} from '@mui/icons-material';
import { apiGet, apiPost, apiPut } from '../utils/api';
import { useAppShell } from '../context/AppShellContext';
import CancelAnalysisFlowButton from '../components/CancelAnalysisFlowButton';
import { downloadArtifactFile } from '../utils/artifactDownloads';
import {
  Deal,
  DealStage,
  DealStageInfo,
  DealStatus,
  DealPriority,
  DealWithRelations,
  Meeting,
} from '../../../shared/types';
import RecentArtifacts, { RecentArtifact } from '../components/RecentArtifacts';
import LinkMeetingDialog from '../components/LinkMeetingDialog';
import AIQuestionnaire from '../components/AIQuestionnaire';
import PageBreadcrumbs from '../components/PageBreadcrumbs';
import DealPlaybookAutomation from '../components/DealPlaybookAutomation';
import BulkAnalysisDialog from '../components/BulkAnalysisDialog';
import type { CalendarMeeting } from '../types/calendarMeeting';
import { useSyncEvent, useSyncEmitters } from '../hooks/useStoreSync';

const BASE_STAGE_DEFS: DealStageInfo[] = [
  {
    value: 'prospecting',
    label: 'Prospecting',
    progress: 10,
    description: 'Identify and engage target accounts',
  },
  {
    value: 'qualification',
    label: 'Qualification',
    progress: 25,
    description: 'Validate fit, budget, and stakeholders',
  },
  {
    value: 'proposal_sent',
    label: 'Proposal Sent',
    progress: 50,
    description: 'Deliver solution proposal for client review',
  },
  {
    value: 'negotiation',
    label: 'Negotiation',
    progress: 75,
    description: 'Align on pricing, scope, and agreements',
  },
];

const CLOSING_STAGE_DEFS: Record<'closed_won' | 'closed_lost', DealStageInfo> = {
  closed_won: {
    value: 'closed_won',
    label: 'Closed-Won',
    progress: 100,
    description: 'Deal signed and ready for delivery',
  },
  closed_lost: {
    value: 'closed_lost',
    label: 'Closed-Lost',
    progress: 100,
    description: 'Opportunity closed without a win',
  },
};

const STAGE_SELECT_OPTIONS: DealStageInfo[] = [
  ...BASE_STAGE_DEFS,
  ...Object.values(CLOSING_STAGE_DEFS),
];

type MeetingAnalysisJobLite = {
  job_id: string;
  status: string;
  transcript_status: string;
  transcript_analysis_id?: string | null;
  transcriptAnalysisId?: string | null;
  proposal_status: string;
  proposal_job_id?: string | null;
  proposalJobId?: string | null;
  ppt_status: string;
  ppt_job_id?: string | null;
  ppt_download_url?: string | null;
  pptDownloadUrl?: string | null;
  ppt_file_name?: string | null;
  pptFileName?: string | null;
  ppt_slide_count?: number | null;
  pptSlideCount?: number | null;
  updated_at?: string | null;
  completed_at?: string | null;
};

type MeetingAnalysisSummaryLite = {
  pre_call?: Array<{
    status?: string | null;
    completed_at?: string | null;
    started_at?: string | null;
    session_id?: string | null;
    sessionId?: string | null;
  }>;
  post_call?: Array<{ status?: string | null; analysis_id?: string }>;
  proposals?: Array<{ status?: string | null; job_id?: string }>;
};

type DealResearchEntry = {
  session_id: string;
  company_name: string;
  meeting_id?: string | null;
  meeting_title?: string | null;
  meeting_date?: string | null;
  completed_at?: string | null;
  status: string;
  purpose_of_meeting?: string | null;
  result?: any;
  attendees?: any[];
};

type DealMeeting = Meeting & {
  analysis_job?: MeetingAnalysisJobLite | null;
  analysis_summary?: MeetingAnalysisSummaryLite | null;
  has_transcript?: boolean;
  has_analysis?: boolean;
  sentiment?: string | null;
  opportunity_score?: number | null;
  key_points?: string[];
  action_items?: string[];
  calendar_event_id?: string | null;
  event_id?: string | null;
  online_meeting_id?: string | null;
  ical_uid?: string | null;
  pre_call_done?: boolean;
};

const MEETING_WORKFLOW_STAGE_KEYS = ['pre_call', 'post_call', 'proposal', 'ppt'] as const;
type MeetingWorkflowStage = (typeof MEETING_WORKFLOW_STAGE_KEYS)[number];
type MeetingWorkflowStageStatus = 'completed' | 'running' | 'queued' | 'not started';

const MEETING_ANALYSIS_STAGES: Array<{
  key: MeetingWorkflowStage;
  label: string;
  description: string;
}> = [
  {
    key: 'pre_call',
    label: 'Pre-call Analysis',
    description: 'Use AI research to prep for the customer meeting.',
  },
  {
    key: 'post_call',
    label: 'Post-call Analysis',
    description: 'Summarize transcript insights and buyer sentiment.',
  },
  {
    key: 'proposal',
    label: 'Generate Solution Proposal',
    description: 'Auto-build proposals or SOWs using meeting intelligence.',
  },
  {
    key: 'ppt',
    label: 'Generate Presentation Deck',
    description: 'Generate an executive-ready deck from the solution proposal.',
  },
];

const normalizeStageStatus = (status?: string | null): MeetingWorkflowStageStatus => {
  switch ((status || '').toLowerCase()) {
    case 'completed':
    case 'complete':
    case 'done':
      return 'completed';
    case 'running':
    case 'processing':
    case 'in_progress':
      return 'running';
    case 'queued':
    case 'pending':
      return 'queued';
    default:
      return 'not started';
  }
};

const getMeetingStageStatuses = (
  meeting: DealMeeting | null
): Record<MeetingWorkflowStage, MeetingWorkflowStageStatus> => {
  const job = meeting?.analysis_job;
  const summary = meeting?.analysis_summary;

  const summaryPreCallStatus = normalizeStageStatus(summary?.pre_call?.[0]?.status);
  const preCallStatus =
    summaryPreCallStatus !== 'not started'
      ? summaryPreCallStatus
      : meeting?.pre_call_done
      ? 'completed'
      : 'not started';

  const summaryPostCallStatus = normalizeStageStatus(summary?.post_call?.[0]?.status);
  const jobPostCallStatus = normalizeStageStatus(job?.transcript_status);
  const postCallStatus =
    summaryPostCallStatus !== 'not started' ? summaryPostCallStatus : jobPostCallStatus;

  const summaryProposalStatus = normalizeStageStatus(summary?.proposals?.[0]?.status);
  const jobProposalStatus = normalizeStageStatus(job?.proposal_status);
  const proposalStatus =
    summaryProposalStatus !== 'not started' ? summaryProposalStatus : jobProposalStatus;
  const pptStatus = normalizeStageStatus(job?.ppt_status);

  return {
    pre_call: preCallStatus,
    post_call: postCallStatus,
    proposal: proposalStatus,
    ppt: pptStatus,
  };
};

const STAGE_STATUS_MESSAGES: Record<
  MeetingWorkflowStage,
  { completed: string; running: string; queued: string; default: string }
> = {
  pre_call: {
    completed: 'Pre-call research is ready to review.',
    running: 'Research prep is running right now.',
    queued: 'Research queued while we gather meeting context.',
    default: 'Kick off research from the meeting sidebar.',
  },
  post_call: {
    completed: 'Transcript insights are available.',
    running: 'Transcript analysis is processing.',
    queued: 'Waiting on transcript upload to start analysis.',
    default: 'Upload a transcript to unlock post-call analysis.',
  },
  proposal: {
    completed: 'Solution proposal draft is ready.',
    running: 'Solution proposal generation is in progress.',
    queued: 'Will start once transcript analysis finishes.',
    default: 'Select solution proposal generation in the workflow.',
  },
  ppt: {
    completed: 'Executive presentation deck is ready.',
    running: 'Generating the presentation deck.',
    queued: 'Queued after solution proposal generation.',
    default: 'Select presentation deck generation in the workflow.',
  },
};

const describeStageStatus = (
  stage: MeetingWorkflowStage,
  status: MeetingWorkflowStageStatus
) => {
  const messages = STAGE_STATUS_MESSAGES[stage];
  switch (status) {
    case 'completed':
      return messages.completed;
    case 'running':
      return messages.running;
    case 'queued':
      return messages.queued;
    default:
      return messages.default;
  }
};

const getMeetingStageChip = (status: MeetingWorkflowStageStatus) => {
  switch (status) {
    case 'completed':
      return { color: 'success' as const, label: 'Completed' };
    case 'running':
      return { color: 'info' as const, label: 'In progress' };
    case 'queued':
      return { color: 'warning' as const, label: 'Queued' };
    default:
      return { color: 'default' as const, label: 'Not started' };
  }
};

const resolveStageStatusLabel = (status?: string | null) => {
  if (!status) return 'Not started';
  return status.charAt(0).toUpperCase() + status.slice(1);
};

const resolveStageStatusColor = (status?: string | null) => {
  switch ((status || '').toLowerCase()) {
    case 'completed':
      return 'success';
    case 'running':
      return 'info';
    case 'queued':
      return 'warning';
    case 'error':
      return 'error';
    default:
      return 'default';
  }
};

const lightCardStyles = {
  bgcolor: '#FFFFFF',
  border: '1px solid rgba(0, 35, 72, 0.08)',
  borderRadius: 3,
  boxShadow: '0 18px 35px rgba(0, 35, 72, 0.08)',
};

const insetPaperStyles = {
  bgcolor: '#F8FBFF',
  border: '1px solid rgba(0, 35, 72, 0.08)',
  borderRadius: 2,
};

const dividerColor = 'rgba(0, 35, 72, 0.12)';

const normalizeOpportunityConfidence = (score?: number | null) => {
  if (typeof score !== 'number' || Number.isNaN(score)) {
    return null;
  }
  return Math.max(0, Math.min(100, Math.round(score)));
};

const getOpportunityConfidenceChipStyles = (score: number | null) => {
  if (score === null) {
    return {
      bgcolor: 'rgba(148, 163, 184, 0.15)',
      color: 'text.secondary',
      border: '1px solid rgba(148, 163, 184, 0.35)',
    };
  }
  if (score >= 70) {
    return {
      bgcolor: 'rgba(0, 164, 140, 0.12)',
      color: '#006b56',
      border: '1px solid rgba(0, 164, 140, 0.35)',
    };
  }
  if (score >= 40) {
    return {
      bgcolor: 'rgba(255, 184, 0, 0.15)',
      color: '#92400e',
      border: '1px solid rgba(255, 184, 0, 0.35)',
    };
  }
  return {
    bgcolor: 'rgba(201, 12, 97, 0.12)',
    color: '#9D1C56',
    border: '1px solid rgba(201, 12, 97, 0.3)',
  };
};

const getOpportunityStatusChip = (status?: string | null) => {
  const normalized = (status || 'open').toLowerCase();
  switch (normalized) {
    case 'won':
    case 'closed_won':
      return { color: 'success' as const, label: 'Won' };
    case 'lost':
    case 'closed_lost':
      return { color: 'error' as const, label: 'Lost' };
    case 'in_progress':
    case 'processing':
    case 'active':
      return { color: 'info' as const, label: 'In progress' };
    case 'queued':
    case 'pending':
      return { color: 'warning' as const, label: 'Queued' };
    default:
      return {
        color: 'default' as const,
        label: normalized.charAt(0).toUpperCase() + normalized.slice(1),
      };
  }
};

const pursuitBriefQuestions: Record<string, string> = {
  '1': 'Who is the buyer and who are the key stakeholders?',
  '2': 'What problem is the client trying to solve?',
  '3': 'What goals and outcomes do they expect?',
  '4': 'Why now? What is driving urgency?',
  '5': 'What challenges could block success?',
  '6': 'What do they seek in a partner?',
  '7': 'What is the procurement process?',
  '8': 'Who are the likely competitors?',
  '9': 'Why would the client choose us?',
  '10': 'What could make them walk away?',
  '11': 'What is our vision for their future state?',
  '12': 'What are the core elements of our solution?',
  '13': 'What assumptions are we making?',
  '14': 'What are our win themes?',
  '15': 'What is our storyline?',
  '16': 'What demos or artifacts reinforce the story?',
};

const DealDetailPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { showMessage } = useAppShell();
  const { emitMeetingUpdated } = useSyncEmitters();

  // Extract dealId from pathname (e.g., /app/deals/deal-123 -> deal-123)
  const dealId = location.pathname.split('/').pop() || '';

  const [deal, setDeal] = useState<DealWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Deal>>({});

  // Research state
  const [researchLoading, setResearchLoading] = useState(false);
  const [researchData, setResearchData] = useState<any>(null);
  const [meetingResearchBriefs, setMeetingResearchBriefs] = useState<DealResearchEntry[]>([]);
  const [researchDialogOpen, setResearchDialogOpen] = useState(false);
  const [researchProgress, setResearchProgress] = useState(0);
  const [researchCurrentStep, setResearchCurrentStep] = useState('Starting research...');
  const [researchEntries, setResearchEntries] = useState<DealResearchEntry[]>([]);
  const [selectedResearchSessionId, setSelectedResearchSessionId] = useState<string | null>(null);
  const [intelligenceTab, setIntelligenceTab] = useState(0);

  // History state
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Meetings state
  const [meetings, setMeetings] = useState<DealMeeting[]>([]);
  const [meetingsLoading, setMeetingsLoading] = useState(false);

  // Artifacts state (questionnaire and action plan)
  const [questionnaire, setQuestionnaire] = useState<any>(null);
  const [actionPlan, setActionPlan] = useState<any>(null);
  const [artifactsLoading, setArtifactsLoading] = useState(false);
  const [stageUpdating, setStageUpdating] = useState(false);
  const [stageUpdateError, setStageUpdateError] = useState<string | null>(null);
  const [stageConfirmOpen, setStageConfirmOpen] = useState(false);
  const [pendingStage, setPendingStage] = useState<DealStage | null>(null);
  const [pursuitBriefData, setPursuitBriefData] = useState<any>(null);
  const [pursuitBriefLoading, setPursuitBriefLoading] = useState(false);
  const [pursuitBriefError, setPursuitBriefError] = useState<string | null>(null);
  const [pursuitBriefEditMode, setPursuitBriefEditMode] = useState(false);
  const [pursuitBriefSaving, setPursuitBriefSaving] = useState(false);
  const [pursuitBriefDraft, setPursuitBriefDraft] = useState<Record<string, string>>({});
  const [pursuitBriefSnapshots, setPursuitBriefSnapshots] = useState<any[]>([]);
  const [artifactDownloadId, setArtifactDownloadId] = useState<string | null>(null);

  // Documents state (proposals and presentations)
  const [documents, setDocuments] = useState<{
    proposals: any[];
    presentations: any[];
    total: number;
  }>({ proposals: [], presentations: [], total: 0 });
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [unlinkingDocId, setUnlinkingDocId] = useState<string | null>(null);

  // Salesforce push state
  const [sfPushingId, setSfPushingId] = useState<string | null>(null);
  const [sfPushSuccess, setSfPushSuccess] = useState<string | null>(null);

  // Link Meeting dialog state
  const [linkMeetingDialogOpen, setLinkMeetingDialogOpen] = useState(false);
  const [linkMeetingLoading, setLinkMeetingLoading] = useState(false);

  // Bulk analysis dialog state
  const [bulkAnalysisDialogOpen, setBulkAnalysisDialogOpen] = useState(false);

  // Post-call pipeline dialog state
  const [pipelineDialogOpen, setPipelineDialogOpen] = useState(false);
  const [pipelineMeetingId, setPipelineMeetingId] = useState<string | null>(null);
  const [pipelineTranscript, setPipelineTranscript] = useState('');
  const [pipelineLoading, setPipelineLoading] = useState(false);
  const [pipelineSendEmail, setPipelineSendEmail] = useState(true);
  const [pipelineJobId, setPipelineJobId] = useState<string | null>(null);
  const [pipelineStatus, setPipelineStatus] = useState<{
    overall: string;
    transcript: string;
    proposal: string;
    ppt: string;
    error?: string;
  } | null>(null);

  const selectedResearchEntry = useMemo(() => {
    if (!selectedResearchSessionId) return null;
    return researchEntries.find((entry) => entry.session_id === selectedResearchSessionId) || null;
  }, [researchEntries, selectedResearchSessionId]);
  const recentArtifacts = useMemo<RecentArtifact[]>(() => {
    const artifacts: RecentArtifact[] = [];
    meetings.forEach((meeting) => {
      const job = meeting.analysis_job;
      if (!job) return;
      const summaryPreCall = meeting.analysis_summary?.post_call?.[0] || null;
      const summaryProposal = meeting.analysis_summary?.proposals?.[0] || null;
      const transcriptAnalysisId = job.transcript_analysis_id || summaryPreCall?.analysis_id || null;
      const proposalJobId = job.proposal_job_id || summaryProposal?.job_id || null;
      const pptDownloadUrl = job.ppt_download_url || job.pptDownloadUrl || null;
      const meetingTitle = meeting.title || 'Untitled Meeting';
      const meetingId = meeting.meeting_id;
      const meetingDate = meeting.meeting_date;
      const updatedAt = job.updated_at || job.completed_at || meeting.meeting_date;

      const pushArtifact = (type: RecentArtifact['type'], status?: string | null) => {
        if (!status) return;
        const normalized = status.toLowerCase?.() || status;
        if (!normalized || normalized === 'not started') return;
        artifacts.push({
          id: `${meetingId || meeting.calendar_event_id || meeting.title}-${type}`,
          type,
          status,
          statusLabel: resolveStageStatusLabel(status),
          statusColor: resolveStageStatusColor(status),
          meetingTitle,
          meetingId,
          meetingDate,
          updatedAt,
          transcriptAnalysisId: type === 'Transcript' ? transcriptAnalysisId : undefined,
          proposalJobId: type === 'Proposal' ? proposalJobId : undefined,
          pptDownloadUrl: type === 'PPT' ? pptDownloadUrl : undefined,
        });
      };
      pushArtifact('Transcript', job.transcript_status);
      pushArtifact('Proposal', job.proposal_status);
      pushArtifact('PPT', job.ppt_status);
    });
    return artifacts
      .sort(
        (a, b) =>
          new Date(b.updatedAt || b.meetingDate || 0).getTime() -
          new Date(a.updatedAt || a.meetingDate || 0).getTime()
      )
      .slice(0, 6);
  }, [meetings]);

  const opportunities = deal?.opportunities ?? [];

  const sortedOpportunities = useMemo(() => {
    return [...opportunities].sort((a, b) => {
      const aTime = new Date(a.updated_at || a.created_at || 0).getTime();
      const bTime = new Date(b.updated_at || b.created_at || 0).getTime();
      return bTime - aTime;
    });
  }, [opportunities]);

  const opportunityStats = useMemo(() => {
    const totals = {
      total: opportunities.length,
      high: 0,
      medium: 0,
      low: 0,
      statusCounts: {} as Record<string, number>,
    };

    opportunities.forEach((opportunity) => {
      const score = normalizeOpportunityConfidence(opportunity.confidence_score);
      if (score !== null) {
        if (score >= 70) {
          totals.high += 1;
        } else if (score >= 40) {
          totals.medium += 1;
        } else {
          totals.low += 1;
        }
      }

      const statusKey = (opportunity.status || 'open').toLowerCase();
      totals.statusCounts[statusKey] = (totals.statusCounts[statusKey] || 0) + 1;
    });

    return totals;
  }, [opportunities]);

  useEffect(() => {
    fetchDealDetail();
    fetchDealResearch();
    fetchDealHistory();
    fetchDealMeetings();
    fetchDealArtifacts();
    fetchDealDocuments();
    fetchPursuitBrief();
  }, [dealId]);

  // Listen for sync events and refresh meetings when they change
  useSyncEvent(
    ['DEAL_LINKED', 'DEAL_UNLINKED', 'MEETING_UPDATED', 'PRECALL_COMPLETED', 'POSTCALL_COMPLETED', 'ANALYSIS_WORKFLOW_UPDATED'],
    (payload) => {
      // If this deal was affected, refresh meetings
      if (payload.dealId === dealId || !payload.dealId) {
        fetchDealMeetings();
      }
    },
    [dealId]
  );

  const fetchDealDetail = async () => {
    try {
      const data = await apiGet(`/api/deals/${dealId}`);

      if (data.success) {
        setDeal(data.data);
        setEditForm(data.data);
      }
    } catch (error) {
      console.error('Error fetching deal:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStageChange = async (nextStage: DealStage) => {
    if (!deal || nextStage === deal.stage || stageUpdating) {
      return;
    }

    const stageMeta = STAGE_SELECT_OPTIONS.find((stage) => stage.value === nextStage);
    setStageUpdating(true);
    setStageUpdateError(null);

    try {
      await apiPut(`/api/deals/${dealId}`, {
        stage: nextStage,
        progress_percentage: stageMeta?.progress ?? deal.progress_percentage,
      });

      setDeal((prev) =>
        prev
          ? {
              ...prev,
              stage: nextStage,
              progress_percentage: stageMeta?.progress ?? prev.progress_percentage,
            }
          : prev
      );
    } catch (error: any) {
      setStageUpdateError(error?.message || 'Failed to update stage');
    } finally {
      setStageUpdating(false);
      setPendingStage(null);
      setStageConfirmOpen(false);
    }
  };

  const fetchDealResearch = async () => {
    try {
      const data = await apiGet(`/api/deals/${dealId}/research`);
      console.log('📊 Research data fetched:', data);

      if (data.success && Array.isArray(data.data)) {
        setResearchEntries(data.data);

        const completedResearch = data.data.filter(
          (entry: DealResearchEntry) => entry.status === 'completed' && entry.result
        );
        const meetingBriefs = completedResearch.filter((entry: DealResearchEntry) => entry.meeting_id);
        setMeetingResearchBriefs(meetingBriefs);

        const preferred =
          (selectedResearchSessionId &&
            completedResearch.find((entry: DealResearchEntry) => entry.session_id === selectedResearchSessionId)) ||
          completedResearch[0] ||
          null;

        if (preferred?.result) {
          setSelectedResearchSessionId(preferred.session_id);
          setResearchData(preferred.result);
          console.log('📝 Research data set:', preferred.result);
        } else {
          setResearchData(null);
        }
      } else {
        setMeetingResearchBriefs([]);
        setResearchEntries([]);
        setResearchData(null);
      }
    } catch (error) {
      console.error('❌ Error fetching deal research:', error);
      setMeetingResearchBriefs([]);
      setResearchEntries([]);
    }
  };

  const fetchDealHistory = async () => {
    try {
      setHistoryLoading(true);
      const data = await apiGet(`/api/deals/${dealId}/history`);

      if (data.success) {
        setHistoryData(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching deal history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchDealMeetings = async () => {
    try {
      setMeetingsLoading(true);
      const data = await apiGet(`/api/meetings?deal_id=${dealId}`);
      console.log('📅 Meetings data fetched:', data);

      if (data.success) {
        const payload = Array.isArray(data.data)
          ? data.data
          : Array.isArray(data.meetings)
          ? data.meetings
          : [];

        const normalized = payload.map((meeting: any): DealMeeting => {
          const analysisJob: MeetingAnalysisJobLite | null =
            meeting.analysis_job || meeting.analysisJob || null;
          const transcriptStatus = analysisJob?.transcript_status?.toLowerCase?.() || 'pending';
          const proposalStatus = analysisJob?.proposal_status?.toLowerCase?.() || 'pending';
          const pptStatus = analysisJob?.ppt_status?.toLowerCase?.() || 'pending';

          return {
            ...(meeting as Meeting),
            analysis_job: analysisJob,
            analysis_summary: meeting.analysis_summary || meeting.analysisSummary || null,
            pre_call_done:
              typeof meeting.pre_call_done === 'boolean'
                ? meeting.pre_call_done
                : Boolean(meeting.preCallDone || meeting.pre_call_status === 'completed'),
            calendar_event_id: meeting.calendar_event_id || meeting.calendarEventId || meeting.event_id || meeting.eventId || null,
            event_id: meeting.event_id || meeting.eventId || meeting.calendar_event_id || meeting.calendarEventId || null,
            online_meeting_id: meeting.online_meeting_id || meeting.onlineMeetingId || null,
            ical_uid: meeting.ical_uid || meeting.icalUid || null,
            has_transcript: transcriptStatus === 'completed' || Boolean(meeting.transcript),
            has_analysis:
              proposalStatus === 'completed' ||
              pptStatus === 'completed' ||
              transcriptStatus === 'completed',
            sentiment: meeting.sentiment || null,
            opportunity_score:
              typeof meeting.opportunity_score === 'number' ? meeting.opportunity_score : null,
            key_points: Array.isArray(meeting.key_points) ? meeting.key_points : [],
            action_items: Array.isArray(meeting.action_items) ? meeting.action_items : [],
          };
        });

        setMeetings(normalized);
      }
    } catch (error) {
      console.error('❌ Error fetching deal meetings:', error);
    } finally {
      setMeetingsLoading(false);
    }
  };

  // Handle linking a calendar meeting to this deal
  const handleLinkMeeting = async (calendarMeeting: CalendarMeeting) => {
    if (!dealId) return;

    setLinkMeetingLoading(true);
    try {
      // Use the meeting's primary ID (prefer meetingId, then eventId, then id)
      const meetingId = calendarMeeting.id || calendarMeeting.eventId;
      if (!meetingId) {
        throw new Error('Meeting ID not found');
      }

      const response = await apiPost(`/api/meetings/${meetingId}/link`, {
        dealId,
        accountId: deal?.account_id || null,
      });

      if (response.success) {
        showMessage({ type: 'success', message: 'Meeting linked successfully' });
        setLinkMeetingDialogOpen(false);
        // Refresh meetings list
        await fetchDealMeetings();
        // Emit sync event so other components (calendar, etc.) refresh
        emitMeetingUpdated(meetingId, 'DealDetailPage');
      } else {
        throw new Error(response.error || 'Failed to link meeting');
      }
    } catch (err: any) {
      console.error('Error linking meeting:', err);
      showMessage({ type: 'error', message: err.message || 'Failed to link meeting' });
    } finally {
      setLinkMeetingLoading(false);
    }
  };

  const fetchDealArtifacts = async () => {
    try {
      setArtifactsLoading(true);
      const data = await apiGet(`/api/deals/${dealId}/artifacts`);
      console.log('Artifacts data fetched:', data);

      if (data.success && data.data) {
        setQuestionnaire(data.data.questionnaire);
        setActionPlan(data.data.action_plan);
      }
    } catch (error) {
      console.error('Error fetching deal artifacts:', error);
    } finally {
      setArtifactsLoading(false);
    }
  };

  const fetchDealDocuments = async () => {
    try {
      setDocumentsLoading(true);
      const data = await apiGet(`/api/deals/${dealId}/documents`);
      console.log('Documents data fetched:', data);

      if (data.success && data.data) {
        setDocuments({
          proposals: data.data.proposals || [],
          presentations: data.data.presentations || [],
          total: data.data.total || 0,
        });
      }
    } catch (error) {
      console.error('Error fetching deal documents:', error);
    } finally {
      setDocumentsLoading(false);
    }
  };

  const handleUnlinkDocument = async (type: 'proposal' | 'presentation', jobId: string) => {
    try {
      setUnlinkingDocId(jobId);
      const endpoint = type === 'proposal'
        ? `/api/deals/${dealId}/documents/proposal/${jobId}`
        : `/api/deals/${dealId}/documents/presentation/${jobId}`;

      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3001'}${endpoint}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (response.ok) {
        // Refresh documents list
        fetchDealDocuments();
      }
    } catch (error) {
      console.error('Error unlinking document:', error);
    } finally {
      setUnlinkingDocId(null);
    }
  };

  const handleSalesforcePush = async (action: 'log-activity' | 'attach-note', title: string, body: string) => {
    if (!deal?.salesforce_id) return;
    const pushId = `${action}-${Date.now()}`;
    try {
      setSfPushingId(pushId);
      const endpoint = action === 'log-activity'
        ? `/api/salesforce/opportunities/${deal.salesforce_id}/log-activity`
        : `/api/salesforce/opportunities/${deal.salesforce_id}/attach-note`;
      await apiPost(endpoint, { subject: title, title, body, type: 'Other' });
      setSfPushSuccess(action === 'log-activity' ? 'Activity logged to Salesforce' : 'Note attached in Salesforce');
      setTimeout(() => setSfPushSuccess(null), 3000);
    } catch (error) {
      console.error('Error pushing to Salesforce:', error);
    } finally {
      setSfPushingId(null);
    }
  };

  const fetchPursuitBrief = async () => {
    try {
      setPursuitBriefLoading(true);
      setPursuitBriefError(null);
      const data = await apiGet(`/api/pursuit-brief/deal/${dealId}`);
      if (data.success) {
        setPursuitBriefData(data.data);
        setPursuitBriefDraft(data.data.question_answers || {});
        setPursuitBriefSnapshots(Array.isArray(data.data.snapshots) ? data.data.snapshots : []);
      } else {
        setPursuitBriefError('Failed to load pursuit brief');
        setPursuitBriefSnapshots([]);
      }
    } catch (error) {
      console.error('❌ Error fetching pursuit brief:', error);
      setPursuitBriefError('Failed to load pursuit brief');
      setPursuitBriefSnapshots([]);
    } finally {
      setPursuitBriefLoading(false);
    }
  };

  const handleSavePursuitBrief = async () => {
    if (!pursuitBriefData) return;
    try {
      setPursuitBriefSaving(true);
      const payload: Record<string, string> = {};
      Object.keys(pursuitBriefQuestions).forEach((key) => {
        const value = pursuitBriefDraft[key];
        payload[key] = value ?? '';
      });
      const response = await apiPut(`/api/pursuit-brief/${pursuitBriefData.id}/answers`, {
        question_answers: payload,
      });
      if (response.success) {
        setPursuitBriefData((prev: any) =>
          prev ? { ...prev, question_answers: payload } : prev
        );
        setPursuitBriefDraft(payload);
        setPursuitBriefEditMode(false);
        setPursuitBriefError(null);
      } else {
        setPursuitBriefError(response.error || 'Failed to save pursuit brief answers');
      }
    } catch (error) {
      const message =
        (error instanceof Error && error.message) || 'Failed to save pursuit brief answers';
      console.error('❌ Error saving pursuit brief answers:', error);
      setPursuitBriefError(message);
    } finally {
      setPursuitBriefSaving(false);
    }
  };

  const handleUpdateDeal = async () => {
    try {
      const data = await apiPut(`/api/deals/${dealId}`, editForm);

      if (data.success) {
        setDeal(data.deal);
        setEditDialogOpen(false);
        fetchDealDetail();
      }
    } catch (error) {
      console.error('Error updating deal:', error);
    }
  };

  const enterPursuitBriefEditMode = () => {
    if (!pursuitBriefData) return;
    setPursuitBriefDraft((prev) => {
      const next = { ...prev };
      Object.keys(pursuitBriefQuestions).forEach((key) => {
        if (next[key] === undefined || next[key] === null) {
          next[key] =
            pursuitBriefData.question_answers?.[key] ??
            pursuitBriefData.transcript_answers?.[key] ??
            '';
        }
      });
      return next;
    });
    setPursuitBriefEditMode(true);
  };

  const cancelPursuitBriefEdit = () => {
    setPursuitBriefEditMode(false);
    setPursuitBriefDraft(pursuitBriefData?.question_answers || {});
    setPursuitBriefSnapshots(Array.isArray(pursuitBriefData?.snapshots) ? pursuitBriefData.snapshots : []);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'primary';
      case 'won': return 'success';
      case 'lost': return 'error';
      case 'on_hold': return 'warning';
      default: return 'default';
    }
  };

  const visibleStages = useMemo(() => {
    const closingStageKey: 'closed_won' | 'closed_lost' =
      deal?.stage === 'closed_lost' ? 'closed_lost' : 'closed_won';
    return [...BASE_STAGE_DEFS, CLOSING_STAGE_DEFS[closingStageKey]];
  }, [deal?.stage]);

  const getStageLabel = (value: DealStage | string | undefined) =>
    STAGE_SELECT_OPTIONS.find((stage) => stage.value === value)?.label || value || 'Unknown Stage';

  const getLinkedMeetingNavigationId = (meeting: DealMeeting | null) => {
    if (!meeting) return null;
    const candidates = [
      meeting.online_meeting_id,
      meeting.ical_uid,
      meeting.calendar_event_id,
      meeting.event_id,
      meeting.meeting_id,
    ];
    return candidates.find((id) => typeof id === 'string' && id.trim().length > 0) || null;
  };

  const handleNavigateToBriefMeeting = (meetingIdentifier?: string | null) => {
    if (!meetingIdentifier) return;
    const linkedMeeting =
      meetings.find((meeting) =>
        [
          meeting.meeting_id,
          meeting.calendar_event_id,
          meeting.event_id,
          meeting.online_meeting_id,
          meeting.ical_uid,
        ].includes(meetingIdentifier)
      ) || null;
    const navigationId = linkedMeeting
      ? getLinkedMeetingNavigationId(linkedMeeting)
      : meetingIdentifier;
    if (navigationId) {
      navigate(`/app/calendar/meetings/${encodeURIComponent(navigationId)}`);
    }
  };

  const findMeetingForArtifact = (artifact: RecentArtifact) =>
    meetings.find((meeting) => meeting.meeting_id === artifact.meetingId) || null;

  const handleArtifactClick = (artifact: RecentArtifact) => {
    const meeting = findMeetingForArtifact(artifact);
    const identifier = getLinkedMeetingNavigationId(meeting);
    if (identifier) {
      navigate(`/app/calendar/meetings/${encodeURIComponent(identifier)}`);
      return;
    }
    showMessage({
      type: 'warning',
      message: 'Unable to open meeting details for this artifact.',
    });
  };

  const handleArtifactDownload = async (artifact: RecentArtifact) => {
    const meeting = findMeetingForArtifact(artifact);
    const transcriptAnalysisId =
      artifact.transcriptAnalysisId ||
      meeting?.analysis_job?.transcript_analysis_id ||
      meeting?.analysis_summary?.post_call?.[0]?.analysis_id ||
      null;
    const proposalJobId =
      artifact.proposalJobId ||
      meeting?.analysis_job?.proposal_job_id ||
      meeting?.analysis_summary?.proposals?.[0]?.job_id ||
      null;
    const pptDownloadUrl =
      artifact.pptDownloadUrl || meeting?.analysis_job?.ppt_download_url || null;

    try {
      setArtifactDownloadId(artifact.id);
      const message = await downloadArtifactFile({
        artifactType: artifact.type,
        fileBaseName: artifact.meetingTitle,
        transcriptAnalysisId,
        proposalJobId,
        pptDownloadUrl,
      });
      showMessage({ type: 'success', message });
    } catch (error) {
      showMessage({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to download artifact.',
      });
    } finally {
      setArtifactDownloadId(null);
    }
  };

  const getCurrentStageIndex = () => {
    const index = visibleStages.findIndex((s) => s.value === deal?.stage);
    return index === -1 ? 0 : index;
  };

  const openStageConfirm = (nextStage: DealStage) => {
    if (!deal || nextStage === deal.stage) return;
    setPendingStage(nextStage);
    setStageConfirmOpen(true);
    setStageUpdateError(null);
  };

  const closeStageConfirm = () => {
    if (stageUpdating) return;
    setStageConfirmOpen(false);
    setPendingStage(null);
  };


  const handleStartResearch = async () => {
    if (!deal) return;

    setResearchLoading(true);
    setResearchDialogOpen(true);

    try {
      // Start research with company name from deal and dealId to link artifacts
      const result = await apiPost('/api/research/start', {
        company_name: deal.company_name,
        deal_id: dealId,
        purpose_of_meeting: `Research for ${deal.opportunity_name}`,
        meeting_context: deal.notes || '',
        attendees: [],
      });

      const sessionId = result.data?.sessionId || result.session_id;

      // Poll for results
      if (sessionId) {
        pollResearchStatus(sessionId);
      } else {
        console.error('No session ID received from research start');
        setResearchLoading(false);
      }
    } catch (error) {
      console.error('Error starting research:', error);
      setResearchLoading(false);
    }
  };

  const pollResearchStatus = async (sessionId: string) => {
    const poll = async () => {
      try {
        const statusData = await apiGet(`/api/research/status/${sessionId}`);

        // Update progress and current step
        if (statusData.data?.progress) {
          const progressObj = statusData.data.progress;
          if (progressObj.percentage !== undefined) {
            setResearchProgress(progressObj.percentage);
          }
          if (progressObj.step) {
            setResearchCurrentStep(progressObj.step);
          }
        }
        if (statusData.data?.currentStep) {
          setResearchCurrentStep(statusData.data.currentStep);
        }

        if (statusData.data?.status === 'completed' || statusData.status === 'completed') {
          // Set progress to 100%
          setResearchProgress(100);
          setResearchCurrentStep('Completed - Loading results...');

          // Fetch results
          const resultData = await apiGet(`/api/research/${sessionId}/result`);
          setResearchData(resultData);
          setSelectedResearchSessionId(sessionId);
          setResearchLoading(false);

          // Auto-navigate to Intelligence tab to show results
          setActiveTab(1);

          // Close dialog after a short delay
          setTimeout(() => {
            setResearchDialogOpen(false);
          }, 1500);

          // Refresh deal details, history, and artifacts (which includes questionnaire and action plan)
          fetchDealDetail();
          fetchDealHistory();
          fetchDealArtifacts();
          fetchDealResearch();
        } else if (statusData.data?.status === 'error' || statusData.status === 'error') {
          console.error('Research failed:', statusData.error);
          setResearchLoading(false);
          setResearchCurrentStep('Error: ' + (statusData.error || 'Unknown error'));
        } else {
          // Continue polling
          setTimeout(poll, 2000);
        }
      } catch (error) {
        console.error('Error polling research:', error);
        setResearchLoading(false);
        setResearchCurrentStep('Error: Failed to poll research status');
      }
    };

    poll();
  };

  // Post-call pipeline handlers
  const handleOpenPipelineDialog = (meetingId: string) => {
    setPipelineMeetingId(meetingId);
    setPipelineTranscript('');
    setPipelineJobId(null);
    setPipelineStatus(null);
    setPipelineDialogOpen(true);
  };

  const handleClosePipelineDialog = () => {
    setPipelineDialogOpen(false);
    setPipelineMeetingId(null);
    setPipelineTranscript('');
    setPipelineJobId(null);
    setPipelineStatus(null);
    setPipelineLoading(false);
  };

  const handleRunPipeline = async () => {
    if (!pipelineMeetingId || !pipelineTranscript.trim()) return;

    setPipelineLoading(true);
    setPipelineStatus({
      overall: 'starting',
      transcript: 'pending',
      proposal: 'pending',
      ppt: 'pending',
    });

    try {
      // Start the full workflow
      const response = await apiPost('/api/analysis-workflow/run', {
        meetingId: pipelineMeetingId,
        runTranscript: true,
        runProposal: true,
        runPpt: true,
        transcriptText: pipelineTranscript.trim(),
        dealId: deal?.deal_id,
        accountId: deal?.account_id,
        sendEmailNotification: pipelineSendEmail,
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to start workflow');
      }

      const jobId = response.data?.jobId;
      setPipelineJobId(jobId);

      // Poll for status
      const pollStatus = async () => {
        try {
          const statusResponse = await apiGet(`/api/analysis-workflow/jobs/${jobId}/status`);
          if (statusResponse.success && statusResponse.data?.job) {
            const job = statusResponse.data.job;
            setPipelineStatus({
              overall: job.status,
              transcript: job.transcriptStatus || 'pending',
              proposal: job.proposalStatus || 'pending',
              ppt: job.pptStatus || 'pending',
              error: job.errorMessage,
            });

            if (job.status === 'completed') {
              setPipelineLoading(false);
              // Refresh meetings to show new artifacts
              fetchDealMeetings();
              fetchDealArtifacts();
            } else if (job.status === 'error') {
              setPipelineLoading(false);
            } else {
              // Continue polling
              setTimeout(pollStatus, 3000);
            }
          } else {
            setTimeout(pollStatus, 3000);
          }
        } catch (err) {
          console.error('Error polling pipeline status:', err);
          setTimeout(pollStatus, 3000);
        }
      };

      pollStatus();
    } catch (err: any) {
      console.error('Error starting pipeline:', err);
      setPipelineStatus({
        overall: 'error',
        transcript: 'error',
        proposal: 'error',
        ppt: 'error',
        error: err.message || 'Failed to start pipeline',
      });
      setPipelineLoading(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Typography>Loading deal...</Typography>
      </Container>
    );
  }

  if (!deal) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Alert severity="error">Deal not found</Alert>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/app/deals')} sx={{ mt: 2 }}>
          Back to Deals
        </Button>
      </Container>
    );
  }

  return (
    <Box
      sx={{
        background: 'linear-gradient(180deg, #F8FBFF 0%, #FFFFFF 65%)',
        minHeight: '100vh',
        py: 4,
      }}
    >
    <Container maxWidth="xl" sx={{ py: 0 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <PageBreadcrumbs
          items={[
            { label: 'Deals', path: '/app/deals' },
            ...(deal.account_id ? [{ label: deal.company_name || 'Account', path: `/app/accounts/${deal.account_id}` }] : []),
          ]}
          currentPage={deal.opportunity_name}
        />

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 3 }}>
          <Box>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
              {deal.opportunity_name}
            </Typography>
            <Stack direction="row" spacing={2} alignItems="center">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Business fontSize="small" color="action" />
                <Typography variant="h6" color="text.secondary">
                  {deal.company_name}
                </Typography>
              </Box>
              <Chip
                label={deal.status.toUpperCase()}
                color={getStatusColor(deal.status)}
                size="medium"
              />
              {deal.priority && (
                <Chip
                  label={`${deal.priority} priority`.toUpperCase()}
                  size="medium"
                  variant="outlined"
                />
              )}
              {deal.salesforce_id && (
                <Chip
                  icon={<CloudIcon />}
                  label="Synced with Salesforce"
                  size="medium"
                  color="primary"
                  variant="outlined"
                />
              )}
            </Stack>
          </Box>

          <Button
            variant="contained"
            startIcon={<Edit />}
            onClick={() => setEditDialogOpen(true)}
          >
            Edit Deal
          </Button>
        </Box>

        {/* Progress Tracker */}
        <Card elevation={0} sx={{ ...lightCardStyles, mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ color: 'text.primary' }}>
              Deal Progress: {deal.progress_percentage}%
            </Typography>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              alignItems={{ xs: 'stretch', sm: 'center' }}
              sx={{ mb: 2 }}
            >
              <FormControl size="small" sx={{ minWidth: 220 }}>
                <InputLabel id="deal-stage-select-label">Stage</InputLabel>
                <Select
                  labelId="deal-stage-select-label"
                  label="Stage"
                  value={deal.stage}
                  onChange={(event) => openStageConfirm(event.target.value as DealStage)}
                  disabled={stageUpdating}
                >
                  {STAGE_SELECT_OPTIONS.map((stage) => (
                    <MenuItem key={stage.value} value={stage.value}>
                      {stage.label} ({stage.progress}%)
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {stageUpdating && <CircularProgress size={24} />}
            </Stack>
            {stageUpdateError && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setStageUpdateError(null)}>
                {stageUpdateError}
              </Alert>
            )}
            {sfPushSuccess && (
              <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSfPushSuccess(null)}>
                {sfPushSuccess}
              </Alert>
            )}
            <LinearProgress
              variant="determinate"
              value={deal.progress_percentage}
              sx={{
                height: 12,
                borderRadius: 6,
                mb: 3,
                bgcolor: 'rgba(0, 35, 72, 0.08)',
                '& .MuiLinearProgress-bar': {
                  bgcolor: deal.progress_percentage === 100 ? '#00A48C' : '#C90C61',
                },
              }}
            />

            <Stepper activeStep={getCurrentStageIndex()} orientation="horizontal">
              {visibleStages.map((stage, index) => (
                <Step key={stage.value} completed={getCurrentStageIndex() > index}>
                  <StepLabel>
                    <Typography variant="body2" fontWeight={getCurrentStageIndex() === index ? 'bold' : 'normal'}>
                      {stage.label}
                    </Typography>
                  </StepLabel>
                </Step>
              ))}
            </Stepper>
          </CardContent>
        </Card>

        {/* Key Metrics */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          {deal.owner && (
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card
                elevation={0}
                sx={{
                  ...lightCardStyles,
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  '&:hover': {
                    transform: 'translateY(-3px)',
                    boxShadow: '0 24px 45px rgba(0, 35, 72, 0.15)',
                  },
                }}
              >
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={2}>
                    <Person color="primary" />
                    <Box>
                      <Typography color="text.secondary" variant="body2">
                        Owner
                      </Typography>
                      <Typography variant="h6">{deal.owner}</Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          )}

          {deal.estimated_value && (
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card
                elevation={0}
                sx={{
                  ...lightCardStyles,
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  '&:hover': {
                    transform: 'translateY(-3px)',
                    boxShadow: '0 24px 45px rgba(0, 35, 72, 0.15)',
                  },
                }}
              >
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={2}>
                    <AttachMoney color="success" />
                    <Box>
                      <Typography color="text.secondary" variant="body2">
                        Estimated Value
                      </Typography>
                      <Typography variant="h6">
                        ${(deal.estimated_value / 1000).toFixed(0)}K
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          )}

          {deal.close_date && (
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card
                elevation={0}
                sx={{
                  ...lightCardStyles,
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  '&:hover': {
                    transform: 'translateY(-3px)',
                    boxShadow: '0 24px 45px rgba(0, 35, 72, 0.15)',
                  },
                }}
              >
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={2}>
                    <CalendarToday color="info" />
                    <Box>
                      <Typography color="text.secondary" variant="body2">
                        Expected Close
                      </Typography>
                      <Typography variant="h6">
                        {new Date(deal.close_date).toLocaleDateString()}
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          )}

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card
              elevation={0}
              sx={{
                ...lightCardStyles,
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                '&:hover': {
                  transform: 'translateY(-3px)',
                  boxShadow: '0 24px 45px rgba(0, 35, 72, 0.15)',
                },
              }}
            >
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Schedule color="action" />
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Created
                    </Typography>
                    <Typography variant="h6">
                      {new Date(deal.created_at).toLocaleDateString()}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>

      {/* AI Sales Playbook Suggestion */}
      <Box sx={{ mb: 3 }}>
        <DealPlaybookAutomation
          dealId={deal.deal_id}
          companyName={deal.company_name}
          dealStage={deal.stage}
          dealValue={deal.estimated_value}
          products={(deal as any).products || []}
          deploymentType={(deal as any).deployment_type || 'unknown'}
          renewalDate={(deal as any).renewal_date ? new Date((deal as any).renewal_date) : undefined}
        />
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
          <Tab icon={<Assignment />} iconPosition="start" label="Linked Meetings" />
          <Tab icon={<Psychology />} iconPosition="start" label="Intelligence" />
          <Tab icon={<TrendingUp />} iconPosition="start" label="Opportunities" />
          <Tab icon={<Lightbulb />} iconPosition="start" label="Pursuit Brief" />
          <Tab icon={<CloudUpload />} iconPosition="start" label="Artifacts" />
          <Tab icon={<Description />} iconPosition="start" label="Documents" />
          {/*
          <Tab icon={<Hub />} iconPosition="start" label="Context & Resources" />
          */}
          <Tab icon={<Timeline />} iconPosition="start" label="Activity" />
        </Tabs>
      </Box>

      {/* Tab Content */}
      {activeTab === 0 && (
        <Grid container spacing={3}>
          {/* Meeting Workflow Overview */}
          <Grid size={{ xs: 12 }}>
            <Card elevation={0} sx={{ ...lightCardStyles }}>
              <CardContent>
                {meetings.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Event sx={{ fontSize: 60, color: 'text.disabled', mb: 2 }} />
                    <Typography color="text.secondary" gutterBottom>
                      No meetings linked to this deal yet
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Link meetings from the calendar to track discussions and action items
                    </Typography>
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={() => setLinkMeetingDialogOpen(true)}
                    >
                      Link Meeting
                    </Button>
                  </Box>
                ) : (
                  <Stack spacing={3}>
                    {/* Bulk analysis toolbar */}
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<BatchPrediction />}
                        onClick={() => setBulkAnalysisDialogOpen(true)}
                      >
                        Analyze All Meetings
                      </Button>
                    </Box>
                    {meetings.map((meeting) => {
                      const meetingStageStatuses = getMeetingStageStatuses(meeting);
                      const meetingAnalysisCards = MEETING_ANALYSIS_STAGES.map((stage) => ({
                        ...stage,
                        status: meetingStageStatuses[stage.key],
                        helper: describeStageStatus(stage.key, meetingStageStatuses[stage.key]),
                      }));

                      return (
                        <Paper
                          key={meeting.meeting_id}
                          variant="outlined"
                          sx={{
                            p: 2,
                            borderRadius: 2,
                            borderColor: 'rgba(0, 35, 72, 0.12)',
                            backgroundColor: 'rgb(250, 250, 244)',
                          }}
                        >
                          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
                            <Box>
                              <Typography variant="h6" sx={{ color: 'text.primary', fontWeight: 600 }}>
                                {meeting.title}
                              </Typography>
                              {meeting.meeting_date && (
                                <Typography variant="body2" color="text.secondary">
                                  {new Date(meeting.meeting_date).toLocaleString()}
                                </Typography>
                              )}
                            </Box>
                            <Stack direction="row" spacing={1}>
                              <Button
                                variant="outlined"
                                size="small"
                                onClick={() => {
                                  const identifier = getLinkedMeetingNavigationId(meeting);
                                  if (identifier) {
                                    navigate(`/app/calendar/meetings/${encodeURIComponent(identifier)}`);
                                  }
                                }}
                              >
                                View Meeting
                              </Button>
                              {meeting.analysis_job?.job_id &&
                              (meeting.analysis_job.status === 'queued' || meeting.analysis_job.status === 'running') ? (
                                <CancelAnalysisFlowButton
                                  workflowJobId={meeting.analysis_job.job_id}
                                  size="small"
                                  onCancelled={() => fetchDealMeetings()}
                                />
                              ) : null}
                              <Button
                                variant="contained"
                                size="small"
                                color="primary"
                                startIcon={<PlayArrow />}
                                onClick={() => handleOpenPipelineDialog(meeting.meeting_id)}
                              >
                                Run Post-Call Pipeline
                              </Button>
                            </Stack>
                          </Stack>

                          <Grid container spacing={2} sx={{ mt: 2 }}>
                            {meetingAnalysisCards.map((stage) => {
                              const chip = getMeetingStageChip(stage.status);
                              const preCallSessionId =
                                stage.key === 'pre_call'
                                  ? (meeting.analysis_summary?.pre_call?.[0]?.session_id ||
                                      meeting.analysis_summary?.pre_call?.[0]?.sessionId ||
                                      null)
                                  : null;
                              return (
                                <Grid size={{ xs: 12, md: 3 }} key={`${meeting.meeting_id}-${stage.key}`}>
                                  <Paper
                                    variant="outlined"
                                    sx={{
                                      p: 2,
                                      height: '100%',
                                      borderRadius: 2,
                                      borderColor: 'rgba(0, 35, 72, 0.12)',
                                    }}
                                  >
                                    <Stack spacing={1}>
                                      <Stack direction="row" alignItems="center" justifyContent="space-between">
                                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                          {stage.label}
                                        </Typography>
                                        <Stack direction="row" spacing={0.5} alignItems="center">
                                          <Chip size="small" color={chip.color} label={chip.label} />
                                          {stage.key === 'pre_call' &&
                                          (stage.status === 'running' || stage.status === 'queued') &&
                                          typeof preCallSessionId === 'string' &&
                                          preCallSessionId ? (
                                            <CancelAnalysisFlowButton
                                              iconOnly
                                              preCallSessionId={preCallSessionId}
                                              workflowJobId={meeting.analysis_job?.job_id || null}
                                              size="small"
                                              onCancelled={() => fetchDealMeetings()}
                                            />
                                          ) : null}
                                        </Stack>
                                      </Stack>
                                      <Typography variant="body2" color="text.secondary">
                                        {stage.description}
                                      </Typography>
                                      <Typography variant="caption" color="text.secondary">
                                        {stage.helper}
                                      </Typography>
                                    </Stack>
                                  </Paper>
                                </Grid>
                              );
                            })}
                          </Grid>
                        </Paper>
                      );
                    })}
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Intelligence Tab */}
      {activeTab === 1 && (
        <Grid container spacing={3}>
          {/* AI Research Section */}
          <Grid size={{ xs: 12 }}>
            <Card
              elevation={0}
              sx={{ ...lightCardStyles }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.primary' }}>
                    <Insights /> Company Intelligence
                  </Typography>
                  {!researchData && (
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<Search />}
                      onClick={handleStartResearch}
                      disabled={researchLoading}
                    >
                      {researchLoading ? 'Running...' : 'Run Research'}
                    </Button>
                  )}
                </Box>
                <Divider sx={{ mb: 2, borderColor: dividerColor }} />

                {researchLoading ? (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <CircularProgress />
                    <Typography sx={{ mt: 2 }} color="text.secondary">
                      Running AI research on {deal?.company_name}...
                    </Typography>
                  </Box>
                ) : researchData ? (
                  (() => {
                    const completed = researchEntries.filter(
                      (entry) => entry.status === 'completed' && Boolean(entry.result)
                    );

                    const companyName =
                      researchData.companyName ||
                      researchData.company_name ||
                      deal?.company_name ||
                      'Company';

                    const attendeeInfo = (Array.isArray(selectedResearchEntry?.attendees)
                      ? selectedResearchEntry?.attendees
                      : []) as Array<{ name: string; email: string; role: string }>;

                    return (
                      <Box>
                        {completed.length > 1 && (
                          <FormControl size="small" sx={{ minWidth: 320, mb: 2 }}>
                            <InputLabel id="deal-intel-session-select-label">Research session</InputLabel>
                            <Select
                              labelId="deal-intel-session-select-label"
                              label="Research session"
                              value={selectedResearchSessionId || ''}
                              onChange={(event) => {
                                const nextSessionId = event.target.value;
                                setSelectedResearchSessionId(nextSessionId);
                                const nextEntry =
                                  researchEntries.find((entry) => entry.session_id === nextSessionId) || null;
                                setResearchData(nextEntry?.result || null);
                                setIntelligenceTab(0);
                              }}
                            >
                              {completed.map((entry) => (
                                <MenuItem key={entry.session_id} value={entry.session_id}>
                                  {entry.meeting_title
                                    ? `${entry.meeting_title}${entry.completed_at ? ` — ${new Date(entry.completed_at).toLocaleDateString()}` : ''}`
                                    : `${entry.company_name}${entry.completed_at ? ` — ${new Date(entry.completed_at).toLocaleDateString()}` : ''}`}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        )}

                        <Tabs
                          value={intelligenceTab}
                          onChange={(_, newValue) => setIntelligenceTab(newValue)}
                          variant="scrollable"
                          scrollButtons="auto"
                          sx={{
                            mb: 2,
                            borderBottom: '1px solid rgba(0, 35, 72, 0.08)',
                            '& .MuiTab-root': {
                              minWidth: 120,
                              fontWeight: 600,
                              fontSize: '0.875rem',
                              color: '#5B6C8F',
                              '&.Mui-selected': {
                                color: 'text.primary',
                              },
                            },
                            '& .MuiTabs-indicator': {
                              backgroundColor: '#00A48C',
                              height: 3,
                            },
                          }}
                        >
                          <Tab icon={<Assessment sx={{ fontSize: 20 }} />} iconPosition="start" label="Overview" />
                          <Tab icon={<Group sx={{ fontSize: 20 }} />} iconPosition="start" label="Attendees" />
                          <Tab icon={<Description sx={{ fontSize: 20 }} />} iconPosition="start" label="InternalKnowledge" />
                          <Tab icon={<Quiz sx={{ fontSize: 20 }} />} iconPosition="start" label="Questionnaire" />
                        </Tabs>

                        <Fade in={true} key={intelligenceTab} timeout={300}>
                          <Box sx={{ overflow: 'visible' }}>
                            {intelligenceTab === 0 && (
                              <Card elevation={0} sx={{ minHeight: 260 }}>
                                <CardHeader
                                  avatar={
                                    <Avatar sx={{ bgcolor: 'secondary.main' }}>
                                      <Assessment />
                                    </Avatar>
                                  }
                                  title="Executive Summary"
                                  subheader="Company-level overview for the deal"
                                />
                                <CardContent>
                                  {(() => {
                                    const extractString = (val: any): string => {
                                      if (typeof val === 'string') return val;
                                      if (val && typeof val === 'object' && typeof val.summary === 'string') {
                                        return val.summary;
                                      }
                                      return '';
                                    };

                                    const executiveSummary =
                                      extractString(researchData.executiveSummary) ||
                                      extractString(researchData.executive_summary) ||
                                      extractString(researchData.companyDeepDive) ||
                                      extractString(researchData.company_deep_dive) ||
                                      extractString(researchData.companyDeepDive?.summary) ||
                                      extractString(researchData.company_deep_dive?.summary) ||
                                      extractString(researchData.companyOverview) ||
                                      extractString(researchData.company_overview) ||
                                      extractString(researchData.overview) ||
                                      extractString(researchData.summary) ||
                                      '';

                                    const fallback =
                                      executiveSummary ||
                                      (researchData.companyAnalysis
                                        ? JSON.stringify(researchData.companyAnalysis, null, 2)
                                        : '');

                                    return (
                                      <Box sx={{ '& p': { mb: 2 }, lineHeight: 1.8 }}>
                                        <ReactMarkdown>{fallback}</ReactMarkdown>
                                      </Box>
                                    );
                                  })()}
                                </CardContent>
                              </Card>
                            )}

                            {intelligenceTab === 1 && (
                              <Card elevation={0} sx={{ minHeight: 260 }}>
                                <CardHeader
                                  avatar={
                                    <Avatar sx={{ bgcolor: '#0ea5e9' }}>
                                      <Group />
                                    </Avatar>
                                  }
                                  title="External Attendee Research"
                                  subheader="Key facts about customer attendees"
                                />
                                <CardContent>
                                  {(() => {
                                    const data =
                                      researchData.externalAttendeeResearch ||
                                      selectedResearchEntry?.attendees ||
                                      [];

                                    if (typeof data === 'string') {
                                      return (
                                        <Box sx={{ fontSize: '0.98rem', '& p': { mb: 1.5 }, whiteSpace: 'pre-line' }}>
                                          <ReactMarkdown>{data}</ReactMarkdown>
                                        </Box>
                                      );
                                    }

                                    const list = Array.isArray(data) ? data : [];
                                    if (list.length === 0) {
                                      return (
                                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                          No external attendee research available.
                                        </Typography>
                                      );
                                    }

                                    return (
                                      <Stack spacing={1.5}>
                                        {list.map((att, idx) => {
                                          if (typeof att === 'string') {
                                            return (
                                              <Box key={`attendee-${idx}`}>
                                                <ReactMarkdown>{att}</ReactMarkdown>
                                              </Box>
                                            );
                                          }

                                          const researchText = att?.research || att?.summary || '';

                                          return (
                                            <Box key={`${att?.name || 'attendee'}-${idx}`}>
                                              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'text.primary' }}>
                                                {att?.name || 'Attendee'}
                                              </Typography>
                                              {att?.role && (
                                                <Typography variant="body2" sx={{ color: '#5B6C8F' }}>
                                                  {att.role}
                                                </Typography>
                                              )}
                                              {att?.company && (
                                                <Typography variant="body2" sx={{ color: '#5B6C8F' }}>
                                                  {att.company}
                                                </Typography>
                                              )}
                                              {researchText && (
                                                <Box sx={{ '& p': { mb: 1.5 }, lineHeight: 1.8, whiteSpace: 'pre-line', mt: 1 }}>
                                                  <ReactMarkdown>{researchText}</ReactMarkdown>
                                                </Box>
                                              )}
                                            </Box>
                                          );
                                        })}
                                      </Stack>
                                    );
                                  })()}
                                </CardContent>
                              </Card>
                            )}

                            {intelligenceTab === 2 && (
                              <Card elevation={0} sx={{ minHeight: 260 }}>
                                <CardHeader
                                  avatar={
                                    <Avatar sx={{ bgcolor: 'success.main' }}>
                                      <Description />
                                    </Avatar>
                                  }
                                  title="Relevant Client Information from InternalKnowledge"
                                  subheader="Internal documents and AI insights"
                                />
                                <CardContent>
                                  {researchData.internalKbAiInsights && researchData.internalKbAiInsights.length > 0 && (
                                    <Card
                                      elevation={1}
                                      sx={{
                                        mb: 3,
                                        p: 2,
                                        border: '1px solid #10b981',
                                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                      }}
                                    >
                                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                        <Avatar sx={{ bgcolor: 'success.main', width: 32, height: 32, mr: 1.5 }}>
                                          <AutoFixHigh sx={{ fontSize: 18 }} />
                                        </Avatar>
                                        <Typography variant="h6" sx={{ fontWeight: 600, color: 'success.main' }}>
                                          InternalKnowledge AI Insights
                                        </Typography>
                                        <Chip
                                          label="AI Generated"
                                          size="small"
                                          sx={{
                                            ml: 2,
                                            backgroundColor: 'rgba(16, 185, 129, 0.2)',
                                            color: 'success.main',
                                            fontWeight: 600,
                                          }}
                                        />
                                      </Box>
                                      <Box sx={{ lineHeight: 1.8 }}>
                                        <ReactMarkdown>{researchData.internalKbAiInsights}</ReactMarkdown>
                                      </Box>
                                    </Card>
                                  )}

                                  {researchData.sharepointDocuments && researchData.sharepointDocuments.length > 0 ? (
                                    <Box>
                                      <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, color: '#1A385E' }}>
                                        Related Documents ({researchData.sharepointDocuments.length})
                                      </Typography>
                                      {researchData.sharepointDocuments.map((doc: any, index: number) => (
                                        <Card
                                          key={doc.id || index}
                                          elevation={1}
                                          sx={{
                                            mb: 2,
                                            p: 2,
                                            border: '1px solid rgba(0, 35, 72, 0.08)',
                                            backgroundColor: '#FFFFFF',
                                            '&:hover': {
                                              backgroundColor: '#F5F9FF',
                                              borderColor: '#2563eb',
                                            },
                                            transition: 'all 0.3s ease',
                                          }}
                                        >
                                          <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }}>
                                            <InsertDriveFile sx={{ color: 'secondary.main', mr: 1.5, fontSize: 24, mt: 0.5 }} />
                                            <Box sx={{ flex: 1 }}>
                                              <Link
                                                href={doc.webUrl || doc.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                sx={{
                                                  fontWeight: 600,
                                                  fontSize: '1.05rem',
                                                  color: 'text.primary',
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  textDecoration: 'none',
                                                  '&:hover': {
                                                    textDecoration: 'underline',
                                                    color: 'secondary.main',
                                                  },
                                                }}
                                              >
                                                {doc.name || doc.title || 'Untitled Document'}
                                                <Launch sx={{ ml: 1, fontSize: 18 }} />
                                              </Link>
                                              {doc.relevanceScore && (
                                                <Chip
                                                  label={`${Math.round(doc.relevanceScore * 100 / 3)}% relevance`}
                                                  size="small"
                                                  sx={{
                                                    mt: 1,
                                                    backgroundColor: 'rgba(37, 99, 235, 0.12)',
                                                    color: 'secondary.main',
                                                    fontWeight: 600,
                                                  }}
                                                />
                                              )}
                                              {doc.path && (
                                                <Typography variant="caption" sx={{ color: '#5B6C8F', display: 'block', mt: 1 }}>
                                                  {doc.path}
                                                </Typography>
                                              )}
                                              {doc.lastModifiedDateTime && (
                                                <Typography variant="caption" sx={{ color: '#5B6C8F', display: 'block', mt: 0.5 }}>
                                                  Modified: {new Date(doc.lastModifiedDateTime).toLocaleDateString()}
                                                </Typography>
                                              )}
                                              {doc.content && (
                                                <Typography variant="body2" sx={{ color: '#1A385E', mt: 1.5, lineHeight: 1.6 }}>
                                                  {doc.content.substring(0, 200)}
                                                  {doc.content.length > 200 ? '...' : ''}
                                                </Typography>
                                              )}
                                            </Box>
                                          </Box>
                                        </Card>
                                      ))}
                                    </Box>
                                  ) : !researchData.internalKbAiInsights && (
                                    <Alert
                                      severity="info"
                                      sx={{
                                        borderRadius: 2,
                                        backgroundColor: 'rgba(0, 35, 72, 0.04)',
                                        border: '1px solid rgba(0, 35, 72, 0.12)',
                                        color: '#1A385E',
                                      }}
                                    >
                                      <Typography variant="body1" sx={{ mb: 1, fontWeight: 600 }}>
                                        No InternalKnowledge data found
                                      </Typography>
                                      <Typography variant="body2">This could mean:</Typography>
                                      <Box component="ul" sx={{ mt: 1, pl: 2 }}>
                                        <li>No internal information exists for this company in InternalKnowledge</li>
                                        <li>You are not authenticated with Microsoft (access token missing)</li>
                                        <li>InternalKnowledge API did not return any matching data</li>
                                      </Box>
                                    </Alert>
                                  )}
                                </CardContent>
                              </Card>
                            )}

                            {intelligenceTab === 3 && (
                              <Box>
                                <AIQuestionnaire
                                  companyName={companyName}
                                  researchSummary={researchData.executiveSummary || ''}
                                  keyInsights={researchData.keyInsights || []}
                                  attendeeInfo={attendeeInfo}
                                  enterpriseRecommendations={researchData.enterpriseRecommendations || []}
                                  recommendedProducts={researchData.recommendedProducts || []}
                                  preGeneratedQuestions={researchData.aiQuestionnaire}
                                />
                              </Box>
                            )}
                          </Box>
                        </Fade>
                      </Box>
                    );
                  })()
                ) : (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Psychology sx={{ fontSize: 60, color: 'text.disabled', mb: 2 }} />
                    <Typography color="text.secondary" gutterBottom>
                      No research data available yet
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Click "Run Research" to generate AI-powered company intelligence
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          {meetingResearchBriefs.length > 0 && (
            <Grid size={{ xs: 12 }}>
              <Card elevation={0} sx={{ ...lightCardStyles }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.primary' }}>
                      <Insights /> Linked Meeting Pre-call Briefs
                    </Typography>
                    <Chip
                      label={`${meetingResearchBriefs.length} brief${meetingResearchBriefs.length === 1 ? '' : 's'}`}
                      size="small"
                      color="info"
                      variant="outlined"
                    />
                  </Box>
                  <Divider sx={{ mb: 2, borderColor: dividerColor }} />

                  <Stack spacing={2}>
                    {meetingResearchBriefs.map((brief) => {
                      const completedAt = brief.completed_at || brief.meeting_date || null;
                      // Handle case where fields might be objects with {summary} key
                      const getSummaryString = (val: unknown): string | null => {
                        if (typeof val === 'string') return val;
                        if (val && typeof val === 'object' && 'summary' in val) return (val as {summary: string}).summary;
                        return null;
                      };
                      const summaryText =
                        getSummaryString(brief.result?.executiveSummary) ||
                        getSummaryString(brief.result?.companyOverview) ||
                        getSummaryString(brief.result?.financialPerformance) ||
                        'Pre-call research is ready to review.';
                      const insights = Array.isArray(brief.result?.keyInsights)
                        ? brief.result.keyInsights.slice(0, 3)
                        : [];
                      const normalizedStatus = (brief.status || '').toLowerCase();
                      const statusColor =
                        normalizedStatus === 'completed'
                          ? 'success'
                          : normalizedStatus === 'in_progress'
                          ? 'info'
                          : normalizedStatus === 'error'
                          ? 'error'
                          : 'default';

                      return (
                        <Paper key={brief.session_id} sx={{ ...insetPaperStyles, p: 2 }}>
                          <Stack spacing={1.5}>
                            <Stack
                              direction={{ xs: 'column', md: 'row' }}
                              alignItems={{ xs: 'flex-start', md: 'center' }}
                              justifyContent="space-between"
                              spacing={1}
                            >
                              <Box>
                                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                  {brief.meeting_title || brief.company_name || 'Linked Meeting'}
                                </Typography>
                                <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 0.5 }}>
                                  {completedAt && (
                                    <Chip
                                      size="small"
                                      icon={<CalendarToday fontSize="small" />}
                                      label={new Date(completedAt).toLocaleString()}
                                      variant="outlined"
                                    />
                                  )}
                                  {brief.purpose_of_meeting && (
                                    <Chip size="small" variant="outlined" label={brief.purpose_of_meeting} />
                                  )}
                                </Stack>
                              </Box>
                              <Stack direction="row" spacing={1}>
                                <Chip
                                  size="small"
                                  color={statusColor as any}
                                  variant={statusColor === 'default' ? 'outlined' : 'filled'}
                                  label={brief.status ? brief.status.replace('_', ' ') : 'Unknown'}
                                />
                                <Button
                                  variant="outlined"
                                  size="small"
                                  onClick={() => handleNavigateToBriefMeeting(brief.meeting_id)}
                                  disabled={!brief.meeting_id}
                                >
                                  View Meeting
                                </Button>
                              </Stack>
                            </Stack>

                            <Typography variant="body2" color="text.primary" sx={{ whiteSpace: 'pre-line' }}>
                              {summaryText}
                            </Typography>

                            {insights.length > 0 && (
                              <Stack direction="row" spacing={1} flexWrap="wrap">
                                {insights.map((insight: string, idx: number) => (
                                  <Chip key={`${brief.session_id}-insight-${idx}`} label={insight} size="small" variant="outlined" />
                                ))}
                              </Stack>
                            )}
                          </Stack>
                        </Paper>
                      );
                    })}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* Discovery Questionnaire Section */}
          <Grid size={{ xs: 12 }}>
            <Card
              elevation={0}
              sx={{ ...lightCardStyles }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.primary' }}>
                    <Assignment /> Discovery Questionnaire
                  </Typography>
                  {questionnaire && (
                    <Chip
                      label={questionnaire.completion_status || 'active'}
                      size="small"
                      color="success"
                      variant="outlined"
                    />
                  )}
                </Box>
                <Divider sx={{ mb: 2, borderColor: dividerColor }} />

                {artifactsLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                  </Box>
                ) : questionnaire ? (
                  (() => {
                    // Helper to extract string from object
                    const getString = (val: unknown): string => {
                      if (typeof val === 'string') return val;
                      if (val && typeof val === 'object' && 'summary' in val) return (val as {summary: string}).summary;
                      if (val && typeof val === 'object' && 'text' in val) return (val as {text: string}).text;
                      return '';
                    };

                    // Check if questions is an array of question objects
                    const questionsArray = Array.isArray(questionnaire.questions) ? questionnaire.questions : null;
                    // Or if it's a string (markdown format)
                    const questionsString = typeof questionnaire.questions === 'string' ? questionnaire.questions : null;

                    // Type color mapping
                    const typeColors: Record<string, string> = {
                      discovery: '#00A48C',
                      'pain point': '#C90C61',
                      'business value': '#FFC622',
                      technical: '#2563eb',
                      transformation: '#9333ea',
                      'solution fit': '#ea580c',
                    };

                    return (
                      <Box>
                        {questionnaire.title && (
                          <Typography variant="subtitle1" color="primary" gutterBottom fontWeight="bold" sx={{ mb: 2 }}>
                            {getString(questionnaire.title)}
                          </Typography>
                        )}

                        {/* Array of question objects format */}
                        {questionsArray && questionsArray.length > 0 && (
                          <Stack spacing={2}>
                            {questionsArray.map((q: any, idx: number) => {
                              const questionText = getString(q.text || q.question || q);
                              const questionType = (q.type || 'discovery').toLowerCase();
                              const typeColor = typeColors[questionType] || '#1A385E';

                              return (
                                <Paper key={idx} sx={{ ...insetPaperStyles, p: 2 }}>
                                  <Stack spacing={1}>
                                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                                      <Chip
                                        label={q.type || 'discovery'}
                                        size="small"
                                        sx={{
                                          bgcolor: typeColor,
                                          color: '#fff',
                                          fontWeight: 600,
                                          fontSize: '0.7rem',
                                          textTransform: 'lowercase',
                                        }}
                                      />
                                      {q.product_focus && (
                                        <Chip label={q.product_focus} size="small" variant="outlined" />
                                      )}
                                      {q.target_persona && (
                                        <Chip label={q.target_persona} size="small" variant="outlined" />
                                      )}
                                    </Stack>
                                    <Typography variant="body1" sx={{ fontWeight: 500, color: 'text.primary' }}>
                                      {questionText}
                                    </Typography>
                                    {q.research_context && (
                                      <Typography variant="caption" color="text.secondary">
                                        <strong>Research Context:</strong> {getString(q.research_context)}
                                      </Typography>
                                    )}
                                    {q.value_proposition && (
                                      <Typography variant="caption" color="text.secondary">
                                        <strong>Value Proposition:</strong> {getString(q.value_proposition)}
                                      </Typography>
                                    )}
                                  </Stack>
                                </Paper>
                              );
                            })}
                          </Stack>
                        )}

                        {/* String/markdown format */}
                        {questionsString && (
                          <Paper sx={{ ...insetPaperStyles, p: 3 }}>
                            <Box sx={{
                              '& h1, & h2, & h3, & h4': { color: 'text.primary', fontWeight: 600, mt: 2, mb: 1 },
                              '& h2': { fontSize: '1.1rem' },
                              '& p': { mb: 1.5, lineHeight: 1.7 },
                              '& ul, & ol': { pl: 2, mb: 1.5 },
                              '& li': { mb: 0.5 },
                              '& a': { color: '#00A48C' },
                            }}>
                              <ReactMarkdown>{questionsString}</ReactMarkdown>
                            </Box>
                          </Paper>
                        )}

                        {/* No questions content */}
                        {!questionsArray?.length && !questionsString && (
                          <Typography color="text.secondary">No questions available</Typography>
                        )}
                      </Box>
                    );
                  })()
                ) : (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Assignment sx={{ fontSize: 60, color: 'text.disabled', mb: 2 }} />
                    <Typography color="text.secondary" gutterBottom>
                      No discovery questionnaire available yet
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Run AI research to generate a customized questionnaire for this deal
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Meeting Analysis Section */}
          <Grid size={{ xs: 12 }}>
            <Card
              elevation={0}
              sx={{ ...lightCardStyles }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.primary' }}>
                    <Event /> Meeting Insights ({meetings.length})
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={() => setLinkMeetingDialogOpen(true)}
                    >
                      Link Meeting
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => navigate('/app/calendar')}
                    >
                      View Calendar
                    </Button>
                  </Stack>
                </Box>
                <Divider sx={{ mb: 2, borderColor: dividerColor }} />

                {meetingsLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                  </Box>
                ) : meetings.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Event sx={{ fontSize: 60, color: 'text.disabled', mb: 2 }} />
                    <Typography color="text.secondary" gutterBottom>
                      No meetings linked to this deal yet
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Link meetings from the calendar to track discussions and action items
                    </Typography>
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={() => setLinkMeetingDialogOpen(true)}
                    >
                      Link Meeting
                    </Button>
                  </Box>
                ) : (
                  <Stack spacing={2}>
                    {meetings.map((meeting) => (
                      <Card key={meeting.meeting_id} variant="outlined" sx={{ bgcolor: 'background.default' }}>
                        <CardContent>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                            <Box sx={{ flexGrow: 1 }}>
                              <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
                                {meeting.title}
                              </Typography>
                              <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 1 }}>
                                {meeting.meeting_date && (
                                  <Chip
                                    icon={<CalendarToday />}
                                    label={new Date(meeting.meeting_date).toLocaleString()}
                                    size="small"
                                    variant="outlined"
                                  />
                                )}
                                {meeting.duration_minutes && (
                                  <Chip
                                    icon={<Schedule />}
                                    label={`${meeting.duration_minutes} min`}
                                    size="small"
                                    variant="outlined"
                                  />
                                )}
                                {meeting.has_transcript && (
                                  <Chip label="Transcript ready" size="small" color="info" />
                                )}
                                {meeting.has_analysis && (
                                  <Chip label="Analysis ready" size="small" color="success" />
                                )}
                                {meeting.sentiment && (
                                  <Chip
                                    label={`Sentiment: ${meeting.sentiment}`}
                                    size="small"
                                    color={
                                      meeting.sentiment === 'positive'
                                        ? 'success'
                                        : meeting.sentiment === 'negative'
                                        ? 'error'
                                        : 'default'
                                    }
                                  />
                                )}
                                {meeting.opportunity_score !== null &&
                                  meeting.opportunity_score !== undefined && (
                                    <Chip
                                      label={`Score: ${meeting.opportunity_score}/10`}
                                      size="small"
                                      color={
                                        meeting.opportunity_score >= 7
                                          ? 'success'
                                          : meeting.opportunity_score >= 4
                                          ? 'warning'
                                          : 'error'
                                      }
                                    />
                                  )}
                              </Stack>

                              {meeting.analysis_job ? (
                                <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center" sx={{ mb: 1 }}>
                                  <Chip
                                    label={`Transcript: ${resolveStageStatusLabel(
                                      meeting.analysis_job.transcript_status
                                    )}`}
                                    size="small"
                                    color={resolveStageStatusColor(meeting.analysis_job.transcript_status)}
                                  />
                                  <Chip
                                    label={`Proposal: ${resolveStageStatusLabel(
                                      meeting.analysis_job.proposal_status
                                    )}`}
                                    size="small"
                                    color={resolveStageStatusColor(meeting.analysis_job.proposal_status)}
                                  />
                                  <Chip
                                    label={`PPT: ${resolveStageStatusLabel(meeting.analysis_job.ppt_status)}`}
                                    size="small"
                                    color={resolveStageStatusColor(meeting.analysis_job.ppt_status)}
                                  />
                                  <Button
                                    variant="outlined"
                                    size="small"
                                    startIcon={<PlayArrow />}
                                    onClick={() => handleOpenPipelineDialog(meeting.meeting_id)}
                                    sx={{ ml: 1 }}
                                  >
                                    Re-run Pipeline
                                  </Button>
                                </Stack>
                              ) : (
                                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                                  <Typography variant="caption" color="text.secondary">
                                    No AI analysis runs yet for this meeting.
                                  </Typography>
                                  <Button
                                    variant="contained"
                                    size="small"
                                    color="primary"
                                    startIcon={<PlayArrow />}
                                    onClick={() => handleOpenPipelineDialog(meeting.meeting_id)}
                                  >
                                    Run Post-Call Pipeline
                                  </Button>
                                </Stack>
                              )}

                              {/* Attendees */}
                              {(meeting.internal_attendees?.length > 0 || meeting.external_attendees?.length > 0) && (
                                <Box sx={{ mb: 1 }}>
                                  <Typography variant="caption" color="text.secondary">
                                    Attendees: {[...(meeting.internal_attendees || []), ...(meeting.external_attendees || [])]
                                      .map((a: unknown) => {
                                        if (typeof a === 'string') return a;
                                        if (a && typeof a === 'object') {
                                          if ('name' in a && (a as {name: string}).name) return (a as {name: string}).name;
                                          if ('email' in a && (a as {email: string}).email) return (a as {email: string}).email;
                                        }
                                        return String(a);
                                      })
                                      .join(', ')}
                                  </Typography>
                                </Box>
                              )}
                            </Box>
                          </Box>

                          {/* Key Points and Action Items */}
                          {(meeting.key_points || meeting.action_items) && (
                            <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderWidth: 1, borderStyle: 'solid', borderColor: 'divider' }}>
                              <Grid container spacing={2}>
                                {meeting.key_points && meeting.key_points.length > 0 && (
                                  <Grid size={{ xs: 12, md: 6 }}>
                                    <Typography variant="caption" fontWeight="medium" color="primary" gutterBottom display="block">
                                      Key Points:
                                    </Typography>
                                    <List dense>
                                      {meeting.key_points.slice(0, 3).map((point: string, idx: number) => (
                                        <ListItem key={idx} sx={{ py: 0.5, px: 0 }}>
                                          <ListItemIcon sx={{ minWidth: 32 }}>
                                            <CheckCircle fontSize="small" color="success" />
                                          </ListItemIcon>
                                          <ListItemText
                                            primary={point}
                                            slotProps={{ primary: { variant: 'body2' } }}
                                          />
                                        </ListItem>
                                      ))}
                                    </List>
                                  </Grid>
                                )}

                                {meeting.action_items && meeting.action_items.length > 0 && (
                                  <Grid size={{ xs: 12, md: 6 }}>
                                    <Typography variant="caption" fontWeight="medium" color="warning.main" gutterBottom display="block">
                                      Action Items:
                                    </Typography>
                                    <List dense>
                                      {meeting.action_items.slice(0, 3).map((action: string, idx: number) => (
                                        <ListItem key={idx} sx={{ py: 0.5, px: 0 }}>
                                          <ListItemIcon sx={{ minWidth: 32 }}>
                                            <Assignment fontSize="small" color="primary" />
                                          </ListItemIcon>
                                          <ListItemText
                                            primary={action}
                                            slotProps={{ primary: { variant: 'body2' } }}
                                          />
                                        </ListItem>
                                      ))}
                                    </List>
                                  </Grid>
                                )}
                              </Grid>
                            </Box>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Grid>

        </Grid>
      )}

      {activeTab === 2 && (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 7 }}>
            <Card elevation={0} sx={{ ...lightCardStyles }}>
              <CardContent>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                  justifyContent="space-between"
                  spacing={2}
                  sx={{ mb: 2 }}
                >
                  <Box>
                    <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.primary' }}>
                      <TrendingUp /> Detected Opportunities
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Insights captured automatically from post-call analyses and AI research.
                    </Typography>
                  </Box>
                  {opportunities.length > 0 && (
                    <Chip label={`${opportunities.length} total`} color="primary" variant="outlined" />
                  )}
                </Stack>
                <Divider sx={{ mb: 2, borderColor: dividerColor }} />

                {sortedOpportunities.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <TrendingUp sx={{ fontSize: 52, color: 'text.disabled', mb: 2 }} />
                    <Typography color="text.secondary" gutterBottom>
                      No opportunities detected yet
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Run transcript analysis or post-call workflows to surface live buying signals.
                    </Typography>
                  </Box>
                ) : (
                  <Stack spacing={2}>
                    {sortedOpportunities.map((opportunity, index) => {
                      const confidence = normalizeOpportunityConfidence(opportunity.confidence_score);
                      const statusChip = getOpportunityStatusChip(opportunity.status);
                      const meetingId = opportunity.meeting_id;
                      const meetingName = opportunity.meeting_title;
                      const meetingSnippet = meetingId ? meetingId.slice(0, 6) : null;
                      const updatedLabel = opportunity.updated_at || opportunity.created_at;

                      return (
                        <Paper key={opportunity.opportunity_id || index} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between">
                            <Box>
                              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                                {opportunity.title || `Opportunity ${index + 1}`}
                              </Typography>
                              {opportunity.description && (
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1, whiteSpace: 'pre-line' }}>
                                  {opportunity.description}
                                </Typography>
                              )}
                            </Box>
                            <Chip
                              label={statusChip.label}
                              color={statusChip.color}
                              size="small"
                              sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}
                            />
                          </Stack>

                          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1.5 }}>
                            <Chip
                              label={confidence === null ? 'Confidence N/A' : `Confidence ${confidence}%`}
                              size="small"
                              sx={{ fontWeight: 600, ...getOpportunityConfidenceChipStyles(confidence) }}
                            />
                            {(meetingName || meetingId) && (
                              <Chip
                                label={
                                  meetingName
                                    ? `Meeting: ${meetingName}`
                                    : meetingSnippet
                                    ? `Meeting ${meetingSnippet}`
                                    : 'Meeting'
                                }
                                size="small"
                                onClick={() =>
                                  meetingId &&
                                  navigate(`/app/calendar/meetings/${encodeURIComponent(meetingId)}`)
                                }
                                clickable={Boolean(meetingId)}
                                variant="outlined"
                              />
                            )}
                            {opportunity.details?.similarCaseStudy && (
                              <Chip
                                label={`Case study: ${opportunity.details.similarCaseStudy}`}
                                size="small"
                                variant="outlined"
                              />
                            )}
                          </Stack>

                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                            {updatedLabel
                              ? `Updated ${new Date(updatedLabel).toLocaleString()}`
                              : 'Detected recently'}
                          </Typography>
                        </Paper>
                      );
                    })}
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 5 }}>
            <Card elevation={0} sx={{ ...lightCardStyles }}>
              <CardContent>
                <Typography variant="h6" sx={{ color: 'text.primary', mb: 2, fontWeight: 600 }}>
                  Opportunity Snapshot
                </Typography>
                <Divider sx={{ mb: 2, borderColor: dividerColor }} />

                <Grid container spacing={2} sx={{ mb: 2 }}>
                  {[{
                    label: 'Total',
                    value: opportunityStats.total,
                  }, {
                    label: 'High Confidence',
                    value: opportunityStats.high,
                  }, {
                    label: 'Medium Confidence',
                    value: opportunityStats.medium,
                  }, {
                    label: 'Low Confidence',
                    value: opportunityStats.low,
                  }].map((stat) => (
                    <Grid size={{ xs: 6 }} key={stat.label}>
                      <Paper sx={{ ...insetPaperStyles, p: 2 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: '0.08em' }}>
                          {stat.label.toUpperCase()}
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 700 }}>
                          {stat.value}
                        </Typography>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>

                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Status distribution
                </Typography>
                {Object.keys(opportunityStats.statusCounts).length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No status data yet.
                  </Typography>
                ) : (
                  <Stack spacing={1}>
                    {Object.entries(opportunityStats.statusCounts).map(([status, count]) => (
                      <Stack key={status} direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                          {status.replace('_', ' ')}
                        </Typography>
                        <Chip label={count} size="small" color="primary" variant="outlined" />
                      </Stack>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Pursuit Brief Tab */}
      {activeTab === 3 && (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12 }}>
            <Card elevation={0} sx={{ ...lightCardStyles }}>
              <CardContent>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                  justifyContent="space-between"
                  spacing={2}
                  sx={{ mb: 2 }}
                >
                  <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.primary' }}>
                    <Lightbulb /> Pursuit Brief
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    {pursuitBriefData?.transcript_answers && Object.keys(pursuitBriefData.transcript_answers).length > 0 && (
                      <Chip
                        size="small"
                        color="info"
                        label="AI draft available"
                      />
                    )}
                    {pursuitBriefEditMode ? (
                      <>
                        <Button
                          variant="outlined"
                          startIcon={<Cancel />}
                          onClick={cancelPursuitBriefEdit}
                          disabled={pursuitBriefSaving}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="contained"
                          startIcon={<Save />}
                          onClick={handleSavePursuitBrief}
                          disabled={pursuitBriefSaving}
                        >
                          {pursuitBriefSaving ? 'Saving...' : 'Save'}
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outlined"
                        startIcon={<Edit />}
                        onClick={enterPursuitBriefEditMode}
                        disabled={pursuitBriefLoading || !pursuitBriefData}
                      >
                        Edit
                      </Button>
                    )}
                  </Stack>
                </Stack>
                <Divider sx={{ mb: 2, borderColor: dividerColor }} />
                {pursuitBriefLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                  </Box>
                ) : pursuitBriefError ? (
                  <Alert severity="error">{pursuitBriefError}</Alert>
                ) : !pursuitBriefData ? (
                  <Typography color="text.secondary">
                    Pursuit brief will be created automatically once you run AI research or transcript analysis for this deal.
                  </Typography>
                ) : (
                  <Stack spacing={2}>
                    {Object.entries(pursuitBriefQuestions).map(([key, question]) => {
                      const manualAnswer = pursuitBriefData.question_answers?.[key];
                      const transcriptAnswer = pursuitBriefData.transcript_answers?.[key];
                      const displayAnswer = manualAnswer || transcriptAnswer || 'No response captured yet.';
                      const editingValue =
                        pursuitBriefDraft[key] ??
                        manualAnswer ??
                        transcriptAnswer ??
                        '';
                      return (
                        <Paper key={key} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                            {question}
                          </Typography>
                          {pursuitBriefEditMode ? (
                            <TextField
                              multiline
                              minRows={2}
                              fullWidth
                              value={editingValue}
                              onChange={(event) =>
                                setPursuitBriefDraft((prev) => ({
                                  ...prev,
                                  [key]: event.target.value,
                                }))
                              }
                            />
                          ) : (
                            <>
                              <Typography variant="body2" color="text.primary" sx={{ whiteSpace: 'pre-line' }}>
                                {displayAnswer}
                              </Typography>
                              {!manualAnswer && transcriptAnswer && (
                                <Typography variant="caption" color="text.secondary">
                                  AI suggestion from transcript analysis
                                </Typography>
                              )}
                            </>
                          )}
                        </Paper>
                      );
                    })}
                    {pursuitBriefSnapshots.length > 0 && (
                      <Box sx={{ mt: 3 }}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                          Recent Post-call Pursuit Brief Captures
                        </Typography>
                        <Stack spacing={2}>
                          {pursuitBriefSnapshots.slice(0, 3).map((snapshot) => {
                            const answers = snapshot.question_answers || {};
                            const answeredCount = Object.values(answers).filter(
                              (value: any) => typeof value === 'string' && value.trim().length > 0
                            ).length;
                            return (
                              <Paper key={snapshot.snapshot_id} variant="outlined" sx={{ p: 2 }}>
                                <Stack
                                  direction={{ xs: 'column', sm: 'row' }}
                                  justifyContent="space-between"
                                  spacing={1}
                                >
                                  <Box>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                      {snapshot.meeting_id ? `Meeting ${snapshot.meeting_id}` : 'Unlinked Meeting'}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {new Date(snapshot.created_at).toLocaleString()}
                                    </Typography>
                                  </Box>
                                  <Chip
                                    label={`${answeredCount}/16 answers`}
                                    size="small"
                                    color={answeredCount === 16 ? 'success' : answeredCount > 0 ? 'info' : 'default'}
                                  />
                                </Stack>
                              </Paper>
                            );
                          })}
                        </Stack>
                      </Box>
                    )}
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Artifacts Tab */}
      {activeTab === 4 && (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12 }}>
            <RecentArtifacts
              artifacts={recentArtifacts}
              loading={artifactsLoading}
              title="Recent Artifacts"
              emptyMessage="No AI artifacts generated yet for this deal. Run meeting analyses to create transcripts, proposals, or decks."
              cardSx={lightCardStyles}
              onArtifactClick={handleArtifactClick}
              onArtifactDownload={handleArtifactDownload}
              downloadingArtifactId={artifactDownloadId}
            />
          </Grid>
        </Grid>
      )}

      {/* Documents Tab */}
      {activeTab === 5 && (
        <Grid container spacing={3}>
          {/* Presentations Section */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card elevation={0} sx={{ ...lightCardStyles, height: '100%' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.primary' }}>
                  <Slideshow /> Presentations
                </Typography>
                <Divider sx={{ mb: 2, borderColor: dividerColor }} />

                {documentsLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress size={32} />
                  </Box>
                ) : documents.presentations.length === 0 ? (
                  <Typography color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                    No presentations generated yet. Run the post-call analysis pipeline to create presentations.
                  </Typography>
                ) : (
                  <Stack spacing={2}>
                    {documents.presentations.map((doc) => (
                      <Card key={doc.job_id} variant="outlined" sx={{ p: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                          <Avatar sx={{ bgcolor: '#e8f4f2', color: '#00A48C' }}>
                            <Slideshow />
                          </Avatar>
                          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.primary' }} noWrap>
                              {doc.file_name}
                            </Typography>
                            {doc.meeting_title && (
                              <Typography variant="caption" color="text.secondary" display="block">
                                From: {doc.meeting_title}
                              </Typography>
                            )}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                              {doc.slide_count && (
                                <Chip label={`${doc.slide_count} slides`} size="small" sx={{ fontSize: '0.7rem' }} />
                              )}
                              <Typography variant="caption" color="text.secondary">
                                {doc.completed_at ? new Date(doc.completed_at).toLocaleDateString() : ''}
                              </Typography>
                            </Box>
                          </Box>
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            {doc.download_url && (
                              <Tooltip title="Download">
                                <IconButton
                                  size="small"
                                  href={doc.download_url}
                                  target="_blank"
                                  sx={{ color: '#00A48C' }}
                                >
                                  <Download fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            <Tooltip title="Unlink from deal">
                              <IconButton
                                size="small"
                                onClick={() => handleUnlinkDocument('presentation', doc.job_id)}
                                disabled={unlinkingDocId === doc.job_id}
                                sx={{ color: '#666' }}
                              >
                                {unlinkingDocId === doc.job_id ? (
                                  <CircularProgress size={16} />
                                ) : (
                                  <LinkOff fontSize="small" />
                                )}
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </Box>
                      </Card>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Proposals Section */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card elevation={0} sx={{ ...lightCardStyles, height: '100%' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.primary' }}>
                  <Article /> Proposals
                </Typography>
                <Divider sx={{ mb: 2, borderColor: dividerColor }} />

                {documentsLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress size={32} />
                  </Box>
                ) : documents.proposals.length === 0 ? (
                  <Typography color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                    No proposals generated yet. Run the post-call analysis pipeline to create proposals.
                  </Typography>
                ) : (
                  <Stack spacing={2}>
                    {documents.proposals.map((doc) => (
                      <Card key={doc.job_id} variant="outlined" sx={{ p: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                          <Avatar sx={{ bgcolor: '#e8eef4', color: '#1A385E' }}>
                            <Article />
                          </Avatar>
                          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.primary' }} noWrap>
                              {doc.file_name}
                            </Typography>
                            {doc.meeting_title && (
                              <Typography variant="caption" color="text.secondary" display="block">
                                From: {doc.meeting_title}
                              </Typography>
                            )}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                              <Chip
                                label={doc.has_content ? 'Generated' : 'Pending'}
                                size="small"
                                color={doc.has_content ? 'success' : 'default'}
                                sx={{ fontSize: '0.7rem' }}
                              />
                              <Typography variant="caption" color="text.secondary">
                                {doc.completed_at ? new Date(doc.completed_at).toLocaleDateString() : ''}
                              </Typography>
                            </Box>
                          </Box>
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            {deal.salesforce_id && doc.has_content && (
                              <Tooltip title="Attach as note in Salesforce">
                                <IconButton
                                  size="small"
                                  onClick={() => handleSalesforcePush('attach-note', doc.file_name || 'Proposal', `Proposal generated from meeting: ${doc.meeting_title || 'N/A'}`)}
                                  disabled={sfPushingId !== null}
                                  sx={{ color: '#00A48C' }}
                                >
                                  {sfPushingId?.startsWith('attach-note') ? (
                                    <CircularProgress size={16} />
                                  ) : (
                                    <CloudUpload fontSize="small" />
                                  )}
                                </IconButton>
                              </Tooltip>
                            )}
                            <Tooltip title="Unlink from deal">
                              <IconButton
                                size="small"
                                onClick={() => handleUnlinkDocument('proposal', doc.job_id)}
                                disabled={unlinkingDocId === doc.job_id}
                                sx={{ color: '#666' }}
                              >
                                {unlinkingDocId === doc.job_id ? (
                                  <CircularProgress size={16} />
                                ) : (
                                  <LinkOff fontSize="small" />
                                )}
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </Box>
                      </Card>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Summary Card */}
          <Grid size={{ xs: 12 }}>
            <Card elevation={0} sx={{ ...lightCardStyles, bgcolor: '#f8f9fa' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Description sx={{ color: 'text.primary' }} />
                    <Typography variant="body2" color="text.secondary">
                      {documents.total} document{documents.total !== 1 ? 's' : ''} linked to this deal
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    onClick={fetchDealDocuments}
                    startIcon={<Schedule />}
                    sx={{ color: '#00A48C' }}
                  >
                    Refresh
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

{/*
      {activeTab === 6 && (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12 }}>
            <Card
              elevation={0}
              sx={{ ...lightCardStyles }}
            >
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.primary' }}>
                  <Hub /> Context & Resources
                </Typography>
                <Divider sx={{ mb: 2, borderColor: dividerColor }} />
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Northstar Integrators's services, sales team, and knowledge base to help you craft the perfect solution
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12 }}>
            <Card
              elevation={0}
              sx={{ ...lightCardStyles }}
            >
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ color: 'text.primary' }}>
                  Sales Team & Expertise
                </Typography>
                <IntegratorSalesTeamsGraph />
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12 }}>
            <Card
              elevation={0}
              sx={{ ...lightCardStyles }}
            >
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ color: 'text.primary' }}>
                  Service Offerings & Case Studies
                </Typography>
                <IntegratorKnowledgeGraphAdvanced />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
      */}

      {/* Activity Tab */}
      {activeTab === 6 && (
        <Card
          elevation={0}
          sx={{ ...lightCardStyles }}
        >
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.primary' }}>
              <Timeline /> Activity Timeline
            </Typography>
            <Divider sx={{ mb: 2, borderColor: dividerColor }} />

            {historyLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : historyData.length === 0 ? (
              <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                No activity yet. Start AI research or upload meeting transcripts to see them here.
              </Typography>
            ) : (
              <Stack spacing={2}>
                {historyData.map((item) => (
                  <Card key={item.id} variant="outlined">
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                        {/* Icon */}
                        <Box sx={{ mt: 0.5 }}>
                          {item.type === 'research' ? (
                            <Search color="primary" />
                          ) : item.type === 'post_call_analysis' ? (
                            <CloudUpload color="success" />
                          ) : (
                            <Event color="secondary" />
                          )}
                        </Box>

                        {/* Content */}
                        <Box sx={{ flexGrow: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <Typography variant="subtitle1" fontWeight="medium">
                              {item.title}
                            </Typography>
                            {item.type === 'research' && (
                              <Chip
                                label={item.status}
                                size="small"
                                color={item.status === 'completed' ? 'success' : 'warning'}
                              />
                            )}
                          </Box>

                          {item.type === 'research' && (
                            <>
                              {item.purpose && (
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                  Purpose: {item.purpose}
                                </Typography>
                              )}
                              <Typography variant="caption" color="text.secondary">
                                Started: {new Date(item.date).toLocaleString()}
                                {item.completed_date && ` • Completed: ${new Date(item.completed_date).toLocaleString()}`}
                              </Typography>
                            </>
                          )}

                          {item.type === 'meeting' && (
                            <>
                              <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                                {item.has_transcript && (
                                  <Chip label="Has Transcript" size="small" color="info" />
                                )}
                                {item.has_analysis && (
                                  <Chip label="Analyzed" size="small" color="success" />
                                )}
                                {item.sentiment && (
                                  <Chip
                                    label={`Sentiment: ${item.sentiment}`}
                                    size="small"
                                    color={item.sentiment === 'positive' ? 'success' : item.sentiment === 'negative' ? 'error' : 'default'}
                                  />
                                )}
                                {item.opportunity_score !== null && item.opportunity_score !== undefined && (
                                  <Chip
                                    label={`Score: ${item.opportunity_score}/10`}
                                    size="small"
                                    color={item.opportunity_score >= 7 ? 'success' : item.opportunity_score >= 4 ? 'warning' : 'error'}
                                  />
                                )}
                              </Stack>

                              {item.duration_minutes && (
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                  Duration: {item.duration_minutes} minutes
                                </Typography>
                              )}

                              {(item.internal_attendees || item.external_attendees) && (
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                  Attendees: {[...(item.internal_attendees || []), ...(item.external_attendees || [])]
                                    .map((a: unknown) => {
                                      if (typeof a === 'string') return a;
                                      if (a && typeof a === 'object') {
                                        if ('name' in a && (a as {name: string}).name) return (a as {name: string}).name;
                                        if ('email' in a && (a as {email: string}).email) return (a as {email: string}).email;
                                      }
                                      return String(a);
                                    })
                                    .join(', ')}
                                </Typography>
                              )}

                              <Typography variant="caption" color="text.secondary">
                                Date: {new Date(item.date).toLocaleString()}
                              </Typography>
                            </>
                          )}

                          {item.type === 'post_call_analysis' && (
                            <>
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                {item.description}
                              </Typography>

                              <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                                {item.sentiment && (
                                  <Chip
                                    label={`Sentiment: ${item.sentiment}`}
                                    size="small"
                                    color={item.sentiment === 'positive' ? 'success' : item.sentiment === 'negative' ? 'error' : 'default'}
                                  />
                                )}
                                {item.opportunity_score && (
                                  <Chip
                                    label={`Score: ${item.opportunity_score}`}
                                    size="small"
                                    color={item.opportunity_score >= 70 ? 'success' : item.opportunity_score >= 40 ? 'warning' : 'error'}
                                  />
                                )}
                                {item.success_probability && (
                                  <Chip
                                    label={`Win Probability: ${(item.success_probability * 100).toFixed(0)}%`}
                                    size="small"
                                    color={item.success_probability >= 0.7 ? 'success' : item.success_probability >= 0.4 ? 'warning' : 'error'}
                                  />
                                )}
                              </Stack>

                              <Typography variant="caption" color="text.secondary">
                                Analyzed: {new Date(item.date).toLocaleString()}
                              </Typography>
                            </>
                          )}
                        </Box>

                        {/* Actions */}
                        <Box>
                          {item.type === 'research' && item.has_result && (
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => {
                                // Navigate to intelligence tab which should show the research
                                setActiveTab(1);
                              }}
                            >
                              View Research
                            </Button>
                          )}
                          {item.type === 'meeting' && (item.has_transcript || item.has_analysis) && (
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => {
                                // TODO: Open meeting detail dialog
                                alert('Meeting details dialog coming soon');
                              }}
                            >
                              View Details
                            </Button>
                          )}
                        </Box>
                      </Box>

                      {/* Key Points and Action Items for Meetings */}
                      {item.type === 'meeting' && (item.key_points || item.action_items) && (
                        <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderWidth: 1, borderStyle: 'solid', borderColor: 'divider' }}>
                          {item.key_points && item.key_points.length > 0 && (
                            <Box sx={{ mb: 2 }}>
                              <Typography variant="caption" fontWeight="medium" color="text.secondary">
                                Key Points:
                              </Typography>
                              <List dense>
                                {item.key_points.slice(0, 3).map((point: string, idx: number) => (
                                  <ListItem key={idx} sx={{ py: 0.5 }}>
                                    <ListItemIcon sx={{ minWidth: 32 }}>
                                      <CheckCircle fontSize="small" color="success" />
                                    </ListItemIcon>
                                    <ListItemText
                                      primary={point}
                                      slotProps={{ primary: { variant: 'body2' } }}
                                    />
                                  </ListItem>
                                ))}
                              </List>
                            </Box>
                          )}

                          {item.action_items && item.action_items.length > 0 && (
                            <Box>
                              <Typography variant="caption" fontWeight="medium" color="text.secondary">
                                Action Items:
                              </Typography>
                              <List dense>
                                {item.action_items.slice(0, 3).map((action: string, idx: number) => (
                                  <ListItem key={idx} sx={{ py: 0.5 }}>
                                    <ListItemIcon sx={{ minWidth: 32 }}>
                                      <Assignment fontSize="small" color="primary" />
                                    </ListItemIcon>
                                    <ListItemText
                                      primary={action}
                                      slotProps={{ primary: { variant: 'body2' } }}
                                    />
                                  </ListItem>
                                ))}
                              </List>
                            </Box>
                          )}
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>
      )}

      {/* Research Progress Dialog */}
      <Dialog open={researchDialogOpen} onClose={() => !researchLoading && setResearchDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>AI Research in Progress</DialogTitle>
        <DialogContent>
          <Box sx={{ py: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ textAlign: 'center', mb: 3 }}>
              Researching {deal?.company_name}
            </Typography>

            {/* Progress Bar */}
            <Box sx={{ mb: 4 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Progress
                </Typography>
                <Typography variant="body2" fontWeight="bold" color="primary">
                  {researchProgress}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={researchProgress}
                sx={{
                  height: 10,
                  borderRadius: 5,
                  bgcolor: 'rgba(0, 35, 72, 0.12)',
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 5,
                  },
                }}
              />
            </Box>

            {/* Current Step */}
            <Box sx={{ mb: 3, p: 2, bgcolor: 'rgba(59, 130, 246, 0.1)', borderRadius: 2, border: '1px solid rgba(59, 130, 246, 0.3)' }}>
              <Typography variant="body2" color="primary" fontWeight="medium">
                Current Step:
              </Typography>
              <Typography variant="body1" sx={{ mt: 0.5 }}>
                {researchCurrentStep}
              </Typography>
            </Box>

            {/* What's Being Analyzed */}
            <Box sx={{ textAlign: 'left' }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Pipeline Steps:
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemIcon>
                    {researchProgress >= 10 ? <CheckCircle fontSize="small" color="success" /> : <Schedule fontSize="small" color="action" />}
                  </ListItemIcon>
                  <ListItemText
                    primary="[1/7] Company Research"
                    secondary="Financials, market position, leadership"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    {researchProgress >= 20 ? <CheckCircle fontSize="small" color="success" /> : <Schedule fontSize="small" color="action" />}
                  </ListItemIcon>
                  <ListItemText
                    primary="[2/7] News Intelligence"
                    secondary="Recent articles and market intelligence"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    {researchProgress >= 35 ? <CheckCircle fontSize="small" color="success" /> : <Schedule fontSize="small" color="action" />}
                  </ListItemIcon>
                  <ListItemText
                    primary="[3/7] AI Company Analysis"
                    secondary="OpenAI GPT-4 analysis of company data"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    {researchProgress >= 50 ? <CheckCircle fontSize="small" color="success" /> : <Schedule fontSize="small" color="action" />}
                  </ListItemIcon>
                  <ListItemText
                    primary="[4/7] Attendee Research"
                    secondary="Meeting participant profiles"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    {researchProgress >= 60 ? <CheckCircle fontSize="small" color="success" /> : <Schedule fontSize="small" color="action" />}
                  </ListItemIcon>
                  <ListItemText
                    primary="[5/7] RAG Content Search"
                    secondary="Relevant case studies and services"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    {researchProgress >= 75 ? <CheckCircle fontSize="small" color="success" /> : <Schedule fontSize="small" color="action" />}
                  </ListItemIcon>
                  <ListItemText
                    primary="[6/7] AI Recommendations"
                    secondary="Sales strategies and opportunities"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    {researchProgress >= 90 ? <CheckCircle fontSize="small" color="success" /> : <Schedule fontSize="small" color="action" />}
                  </ListItemIcon>
                  <ListItemText
                    primary="[7/7] Compiling Results"
                    secondary="Final intelligence report"
                  />
                </ListItem>
              </List>
            </Box>

            {researchProgress === 100 && (
              <Box sx={{ mt: 3, textAlign: 'center' }}>
                <CheckCircle sx={{ fontSize: 60, color: 'success.main', mb: 2 }} />
                <Typography variant="h6" color="success.main">
                  Research Complete!
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Navigating to Intelligence tab...
                </Typography>
              </Box>
            )}
          </Box>
        </DialogContent>
        {!researchLoading && (
          <DialogActions>
            <Button onClick={() => setResearchDialogOpen(false)}>Close</Button>
            <Button variant="contained" onClick={() => { setActiveTab(1); setResearchDialogOpen(false); }}>
              View Intelligence
            </Button>
          </DialogActions>
        )}
      </Dialog>

      {/* Stage Change Confirmation */}
      <Dialog open={stageConfirmOpen && Boolean(pendingStage)} onClose={closeStageConfirm}>
        <DialogTitle>Change Deal Stage?</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            Are you sure you want to move this deal from{' '}
            <strong>{getStageLabel(deal?.stage)}</strong> to{' '}
            <strong>{getStageLabel(pendingStage || undefined)}</strong>? This updates reporting,
            pipeline metrics, and progress tracking.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeStageConfirm} disabled={stageUpdating}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            disabled={!pendingStage || stageUpdating}
            onClick={() => pendingStage && handleStageChange(pendingStage)}
          >
            {stageUpdating ? 'Updating…' : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Edit Deal</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            <TextField
              label="Opportunity Name"
              fullWidth
              value={editForm.opportunity_name || ''}
              onChange={(e) => setEditForm({ ...editForm, opportunity_name: e.target.value })}
            />

            <TextField
              label="Company Name"
              fullWidth
              value={editForm.company_name || ''}
              onChange={(e) => setEditForm({ ...editForm, company_name: e.target.value })}
            />

            <TextField
              label="Stage"
              select
              fullWidth
              value={editForm.stage || ''}
              onChange={(e) => {
                const newStage = e.target.value as DealStage;
                const stageObj = STAGE_SELECT_OPTIONS.find((s) => s.value === newStage);
                setEditForm({
                  ...editForm,
                  stage: newStage,
                  progress_percentage: stageObj?.progress || 0,
                });
              }}
            >
              {STAGE_SELECT_OPTIONS.map((stage) => (
                <MenuItem key={stage.value} value={stage.value}>
                  {stage.label} ({stage.progress}%)
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Status"
              select
              fullWidth
              value={editForm.status || ''}
              onChange={(e) => setEditForm({ ...editForm, status: e.target.value as DealStatus })}
            >
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="won">Won</MenuItem>
              <MenuItem value="lost">Lost</MenuItem>
              <MenuItem value="on_hold">On Hold</MenuItem>
            </TextField>

            <TextField
              label="Priority"
              select
              fullWidth
              value={editForm.priority || ''}
              onChange={(e) => setEditForm({ ...editForm, priority: e.target.value as DealPriority })}
            >
              <MenuItem value="high">High</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="low">Low</MenuItem>
            </TextField>

            <TextField
              label="Owner"
              fullWidth
              value={editForm.owner || ''}
              onChange={(e) => setEditForm({ ...editForm, owner: e.target.value })}
            />

            <TextField
              label="Estimated Value"
              fullWidth
              type="number"
              value={editForm.estimated_value || ''}
              onChange={(e) => setEditForm({ ...editForm, estimated_value: parseFloat(e.target.value) })}
              slotProps={{
                input: {
                  startAdornment: <Typography sx={{ mr: 1 }}>$</Typography>,
                },
              }}
            />

            <TextField
              label="Story"
              fullWidth
              multiline
              rows={4}
              value={editForm.story || ''}
              onChange={(e) => setEditForm({ ...editForm, story: e.target.value })}
              placeholder="Describe the compelling narrative for this opportunity..."
            />

            <TextField
              label="Notes"
              fullWidth
              multiline
              rows={4}
              value={editForm.notes || ''}
              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
              placeholder="Add any additional notes or context..."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)} startIcon={<Cancel />}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleUpdateDeal} startIcon={<Save />}>
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Link Meeting Dialog */}
      <LinkMeetingDialog
        open={linkMeetingDialogOpen}
        onClose={() => setLinkMeetingDialogOpen(false)}
        onConfirm={handleLinkMeeting}
        dealId={dealId || ''}
        dealName={deal?.opportunity_name || 'Deal'}
        existingMeetingIds={meetings.map((m) => m.meeting_id).filter(Boolean)}
      />

      {/* Bulk Analysis Dialog */}
      <BulkAnalysisDialog
        open={bulkAnalysisDialogOpen}
        onClose={() => setBulkAnalysisDialogOpen(false)}
        dealId={dealId || undefined}
        dealName={deal?.opportunity_name || deal?.company_name || 'Deal'}
      />

      {/* Post-Call Pipeline Dialog */}
      <Dialog
        open={pipelineDialogOpen}
        onClose={pipelineLoading ? undefined : handleClosePipelineDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PlayArrow color="primary" />
          Run Post-Call Pipeline
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <Alert severity="info">
              This will run the complete post-call workflow: <strong>Transcript Analysis → Generate Solution Proposal → Generate Presentation Deck</strong>.
              Simply paste the meeting transcript below to get started.
            </Alert>

            {!pipelineLoading && !pipelineStatus && (
              <>
                <TextField
                  label="Meeting Transcript"
                  multiline
                  rows={12}
                  fullWidth
                  value={pipelineTranscript}
                  onChange={(e) => setPipelineTranscript(e.target.value)}
                  placeholder="Paste your meeting transcript here...

Example:
John (Sales Rep): Thanks for joining today's call. Can you tell me about your current challenges?

Sarah (Customer): We've been struggling with our Agile transformation. The teams are not aligned...

John: I understand. We've helped several companies in similar situations..."
                  helperText={`${pipelineTranscript.length} characters • Minimum 100 characters recommended`}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={pipelineSendEmail}
                      onChange={(e) => setPipelineSendEmail(e.target.checked)}
                      color="primary"
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Email fontSize="small" color="action" />
                      <Typography variant="body2">
                        Email me the analysis results when complete
                      </Typography>
                    </Box>
                  }
                />
              </>
            )}

            {pipelineLoading && pipelineStatus && (
              <Box>
                <Box sx={{ mb: 3, textAlign: 'center' }}>
                  <CircularProgress size={48} sx={{ mb: 2 }} />
                  <Typography variant="h6" color="primary">
                    Pipeline Running...
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Status: {pipelineStatus.overall}
                  </Typography>
                </Box>

                <Stack spacing={2}>
                  <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                    {pipelineStatus.transcript === 'completed' ? (
                      <CheckCircle color="success" />
                    ) : pipelineStatus.transcript === 'running' ? (
                      <CircularProgress size={24} />
                    ) : pipelineStatus.transcript === 'error' ? (
                      <Cancel color="error" />
                    ) : (
                      <Schedule color="action" />
                    )}
                    <Box>
                      <Typography variant="subtitle2">1. Transcript Analysis</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Extracting pain points, opportunities, and action items
                      </Typography>
                    </Box>
                    <Chip
                      label={pipelineStatus.transcript}
                      size="small"
                      color={
                        pipelineStatus.transcript === 'completed' ? 'success' :
                        pipelineStatus.transcript === 'running' ? 'info' :
                        pipelineStatus.transcript === 'error' ? 'error' : 'default'
                      }
                      sx={{ ml: 'auto' }}
                    />
                  </Paper>

                  <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                    {pipelineStatus.proposal === 'completed' ? (
                      <CheckCircle color="success" />
                    ) : pipelineStatus.proposal === 'running' ? (
                      <CircularProgress size={24} />
                    ) : pipelineStatus.proposal === 'error' ? (
                      <Cancel color="error" />
                    ) : (
                      <Schedule color="action" />
                    )}
                    <Box>
                      <Typography variant="subtitle2">2. Generate Solution Proposal</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Creating tailored proposal based on analysis
                      </Typography>
                    </Box>
                    <Chip
                      label={pipelineStatus.proposal}
                      size="small"
                      color={
                        pipelineStatus.proposal === 'completed' ? 'success' :
                        pipelineStatus.proposal === 'running' ? 'info' :
                        pipelineStatus.proposal === 'error' ? 'error' : 'default'
                      }
                      sx={{ ml: 'auto' }}
                    />
                  </Paper>

                  <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                    {pipelineStatus.ppt === 'completed' ? (
                      <CheckCircle color="success" />
                    ) : pipelineStatus.ppt === 'running' ? (
                      <CircularProgress size={24} />
                    ) : pipelineStatus.ppt === 'error' ? (
                      <Cancel color="error" />
                    ) : (
                      <Schedule color="action" />
                    )}
                    <Box>
                      <Typography variant="subtitle2">3. Generate Presentation Deck</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Generating presentation slides
                      </Typography>
                    </Box>
                    <Chip
                      label={pipelineStatus.ppt}
                      size="small"
                      color={
                        pipelineStatus.ppt === 'completed' ? 'success' :
                        pipelineStatus.ppt === 'running' ? 'info' :
                        pipelineStatus.ppt === 'error' ? 'error' : 'default'
                      }
                      sx={{ ml: 'auto' }}
                    />
                  </Paper>
                </Stack>
              </Box>
            )}

            {pipelineStatus?.overall === 'completed' && (
              <Alert severity="success" sx={{ mt: 2 }}>
                Pipeline completed successfully! Check the Artifacts tab to view and download your generated documents.
              </Alert>
            )}

            {pipelineStatus?.error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {pipelineStatus.error}
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          {!pipelineLoading && !pipelineStatus?.overall?.includes('completed') && (
            <>
              <Button onClick={handleClosePipelineDialog}>Cancel</Button>
              <Button
                variant="contained"
                onClick={handleRunPipeline}
                disabled={!pipelineTranscript.trim() || pipelineTranscript.length < 50}
                startIcon={<PlayArrow />}
              >
                Run Pipeline
              </Button>
            </>
          )}
          {pipelineStatus?.overall === 'completed' && (
            <>
              <Button onClick={handleClosePipelineDialog}>Close</Button>
              <Button
                variant="contained"
                onClick={() => {
                  handleClosePipelineDialog();
                  setActiveTab(4); // Artifacts tab
                }}
              >
                View Artifacts
              </Button>
            </>
          )}
          {pipelineStatus?.overall === 'error' && (
            <Button onClick={handleClosePipelineDialog}>Close</Button>
          )}
        </DialogActions>
      </Dialog>
    </Container>
    </Box>
  );
};

export default DealDetailPage;
