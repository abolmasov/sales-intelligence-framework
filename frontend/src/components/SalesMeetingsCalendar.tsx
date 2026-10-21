import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Button,
  Chip,
  Avatar,
  AvatarGroup,
  List,
  ListItem,
  ListItemText,
  Divider,
  Alert,
  CircularProgress,
  Checkbox,
  FormControlLabel,
  Stack,
  Tooltip,
  ToggleButtonGroup,
  ToggleButton,
  TextField,
  Fade,
  alpha,
} from '@mui/material';
import {
  Event as EventIcon,
  Business as BusinessIcon,
  Schedule as ScheduleIcon,
  TrendingUp as AnalyzeIcon,
  CheckCircle as CheckIcon,
  CalendarMonth as CalendarIcon,
  ViewList as ListIcon,
  Sync as SyncIcon,
  AutoAwesome as PreCallIcon,
  RecordVoiceOver as PostCallIcon,
  Slideshow as PptxIcon,
  Link as LinkedIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import CalendarView from './CalendarView';
import PreCallStartDialog, { type PreCallStartValues } from './PreCallStartDialog';
import { useCalendarMeetingsStore } from '../store/calendarMeetingsStore';
import type { CalendarMeeting } from '../types/calendarMeeting';
import {
  isInternalAttendee,
  runPreCallAnalysis,
  runPostCallAnalysis,
  openProposalGenerator,
  openProposalJob,
  openPptGenerator,
  fetchTranscriptFromTeams,
  buildMeetingStartDateTime,
  getSharedMeetingIdentifier,
  getCalendarEventIdentifier,
  getTranscriptLookupIdentifier,
} from '../utils/meetingActions';
import {
  getWorkflowChipProps,
  getStageStatus,
  getStageChipProps,
  WorkflowStage,
  isStageComplete,
  getWorkflowStatus,
} from '../utils/analysisStatus';
import AnalysisChecklist, { AnalysisStageSelection } from './AnalysisChecklist';
import { apiPost, apiPatch } from '../utils/api';
import { WorkflowJobStatus } from '../utils/workflowPolling';
import { useBackgroundJobsStore } from '../store/backgroundJobsStore';
import { useAccountsStore } from '../store/accountsStore';
import { useUserTimeZone } from '../context/UserTimeZoneContext';
import { formatMeetingForTimeZone } from '../utils/dateTime';
import { useAppShell } from '../context/AppShellContext';
import proposalIcon from '../assets/proposal.png';
import CancelAnalysisFlowButton from './CancelAnalysisFlowButton';
import { useAutoRefreshMeetings, useSyncEmitters } from '../hooks/useStoreSync';
import { COLORS } from '../styles/pageStyles';
import NextBestActionBanner from './NextBestActionBanner';

type Meeting = CalendarMeeting;

const WORKFLOW_STAGES: Array<{ stage: WorkflowStage; label: string }> = [
  { stage: 'transcript', label: 'Transcript' },
  { stage: 'proposal', label: 'Proposal' },
  { stage: 'ppt', label: 'PPT' },
];

// Use TypeScript backend (port 3001) instead of old Python backend (port 8000)
const API_URL = API_BASE_URL;

interface SalesMeetingsCalendarProps {
  onViewAnalysis?: (sessionId: string, company: string, purpose: string) => void;
  onStartAnalysis?: (meeting: Meeting) => void;
}

const SalesMeetingsCalendar: React.FC<SalesMeetingsCalendarProps> = ({ onViewAnalysis, onStartAnalysis }) => {
  const navigate = useNavigate();
  const meetings = useCalendarMeetingsStore(state => state.meetings);
  const fetchMeetings = useCalendarMeetingsStore(state => state.fetchMeetings);
  const updateMeetingInStore = useCalendarMeetingsStore(state => state.updateMeeting);
  const fetchAccountDetail = useAccountsStore((state) => state.fetchAccountDetail);
  const meetingsLoading = useCalendarMeetingsStore(state => state.isLoading);
  const meetingsError = useCalendarMeetingsStore(state => state.error);
  const clearMeetingsError = useCalendarMeetingsStore(state => state.clearError);
  const lastFetchedRange = useCalendarMeetingsStore(state => state.lastFetchedRange);
  const [selectedMeetings, setSelectedMeetings] = useState<Set<string>>(new Set());
  const [bulkAnalyzing, setBulkAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [syncingTeams, setSyncingTeams] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState<string | null>(null);
  const [postCallLoadingId, setPostCallLoadingId] = useState<string | null>(null);
  const autoSyncAttemptedRef = useRef(false);
  const [analysisPipelineLoadingId, setAnalysisPipelineLoadingId] = useState<string | null>(null);
  const [analysisPipelineError, setAnalysisPipelineError] = useState<{ id: string | null; message: string | null }>({
    id: null,
    message: null,
  });
  const [preCallDialogOpen, setPreCallDialogOpen] = useState(false);
  const [preCallDialogMeeting, setPreCallDialogMeeting] = useState<Meeting | null>(null);
  const [listFilterMode, setListFilterMode] = useState<'all' | 'week' | 'day'>('all');
  const [listFilterDate, setListFilterDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  // Maps calendarMeetingId → jobId for stopJob lookups (pollers live in backgroundJobsStore)
  const meetingJobIdRef = useRef<Map<string, string>>(new Map());
  const { registerJob, connectToJob, disconnectCallbacks, stopJob: stopBackgroundJob } = useBackgroundJobsStore.getState();
  const { timeZone: userTimeZone, locationPermission, refreshFromLocation } = useUserTimeZone();
  const { addNotification } = useAppShell();
  const lastFetchedAt = useCalendarMeetingsStore((state) => state.lastFetchedAt);
  const isStaleFn = useCalendarMeetingsStore((state) => state.isStale);

  // Auto-refresh meetings when sync events occur (pre-call started/completed, etc.)
  useAutoRefreshMeetings({ enabled: true, debounceMs: 1000 });

  // Sync event emitters for notifying other components
  const { emitPreCallStarted, emitWorkflowUpdated, emitDealLinked, emitMeetingUpdated } = useSyncEmitters();

  const combinedError = error || meetingsError;
  const shouldPromptSync = !lastFetchedRange && meetings.length === 0 && !syncingTeams && !meetingsLoading;

  const formatRangeDate = (iso: string | null | undefined) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return iso;
    }
  };

  const formatIsoDateLabel = (iso: string | null | undefined) => {
    if (!iso) return '';
    try {
      return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return iso;
    }
  };

  const formatDateOnly = (date: Date) => date.toISOString().slice(0, 10);

  const parseIsoDateOnly = (value: string | null | undefined): Date | null => {
    if (!value) return null;
    const [yearStr, monthStr, dayStr] = value.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);
    if (!year || !month || !day) {
      return null;
    }
    return new Date(Date.UTC(year, month - 1, day));
  };

  const getMeetingDateIso = (meeting: Meeting): string | null => {
    if (meeting.date) return meeting.date;
    if (meeting.startDateTime) return meeting.startDateTime.substring(0, 10);
    return null;
  };

  const getWeekBoundsFromDate = (isoDate: string | null | undefined) => {
    const base = parseIsoDateOnly(isoDate || '');
    if (!base) return null;
    const start = new Date(base);
    const weekday = start.getUTCDay(); // 0 (Sun) - 6 (Sat)
    const diffToMonday = (weekday + 6) % 7;
    start.setUTCDate(start.getUTCDate() - diffToMonday);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);
    return {
      start: formatDateOnly(start),
      end: formatDateOnly(end),
    };
  };

  const isPastMeeting = (meeting: Meeting) => {
    if (meeting.startDateTime) {
      return new Date(meeting.startDateTime) < new Date();
    }
    if (meeting.date && meeting.time) {
      return new Date(`${meeting.date}T${meeting.time}`) < new Date();
    }
    return meeting.status === 'completed';
  };

  const getLatestPreCallSummary = (meeting: Meeting) => meeting.analysisSummary?.preCall?.[0];
  const getLatestPostCallSummary = (meeting: Meeting) => meeting.analysisSummary?.postCall?.[0];
  const getLatestProposalSummary = (meeting: Meeting) => meeting.analysisSummary?.proposals?.[0];
  const getUserLocalMeetingTime = useCallback(
    (meeting: Meeting) => formatMeetingForTimeZone(meeting, userTimeZone),
    [userTimeZone]
  );

  const filteredMeetings = useMemo(() => {
    if (listFilterMode === 'all') {
      return meetings;
    }
    const selectedDate = listFilterDate || new Date().toISOString().slice(0, 10);
    if (!selectedDate) {
      return meetings;
    }
    if (listFilterMode === 'day') {
      return meetings.filter((meeting) => getMeetingDateIso(meeting) === selectedDate);
    }
    const bounds = getWeekBoundsFromDate(selectedDate);
    if (!bounds) {
      return meetings;
    }
    return meetings.filter((meeting) => {
      const meetingDate = getMeetingDateIso(meeting);
      if (!meetingDate) return false;
      return meetingDate >= bounds.start && meetingDate <= bounds.end;
    });
  }, [meetings, listFilterMode, listFilterDate]);

  const selectedWeekRange = useMemo(
    () => (listFilterMode === 'week' ? getWeekBoundsFromDate(listFilterDate) : null),
    [listFilterMode, listFilterDate]
  );

  const handlePreCallAnalysis = async (meeting: Meeting) => {
    const statusLower = (meeting.status || '').toLowerCase();
    const jobStatusLower = meeting.analysisJob?.status?.toLowerCase();
    if (statusLower === 'analyzing' || jobStatusLower === 'running' || jobStatusLower === 'queued') {
      setError('Analysis is already running for this meeting. Please wait for it to finish.');
      return Promise.resolve();
    }
    const preCallStatusLower = (meeting.analysisSummary?.preCall?.[0]?.status || '').toLowerCase();
    if (preCallStatusLower === 'running' || preCallStatusLower === 'pending') {
      setError('Pre-call analysis is already running for this meeting. Please wait for it to finish.');
      return Promise.resolve();
    }
    setPreCallDialogMeeting(meeting);
    setPreCallDialogOpen(true);
    return Promise.resolve();
  };

  const handleStartPreCallFromDialog = (values: PreCallStartValues) => {
    if (!preCallDialogMeeting) return;
    runPreCallAnalysis(preCallDialogMeeting, navigate, {
      companyName: values.companyName,
      meetingContext: values.meetingContext,
      externalAttendees: values.externalAttendees,
    });
    setPreCallDialogOpen(false);
    setPreCallDialogMeeting(null);
  };

  const handlePostCallAnalysis = async (meeting: Meeting) => {
    const statusLower = (meeting.status || '').toLowerCase();
    const jobStatusLower = meeting.analysisJob?.status?.toLowerCase();
    const transcriptStatusLower = meeting.analysisJob?.transcriptStatus?.toLowerCase();
    if (
      statusLower === 'analyzing' ||
      jobStatusLower === 'running' ||
      jobStatusLower === 'queued' ||
      transcriptStatusLower === 'running' ||
      transcriptStatusLower === 'queued'
    ) {
      setError('Analysis is already running for this meeting. Please wait for it to finish.');
      return;
    }
    if (!isPastMeeting(meeting)) {
      await handlePreCallAnalysis(meeting);
      return;
    }

    await runPostCallAnalysis(meeting, {
      navigate,
      setError,
      setLoadingId: setPostCallLoadingId,
    });
  };

  const handleRunAnalysisPipeline = async (
    meeting: Meeting,
    stages: AnalysisStageSelection,
    transcriptInput?: string
  ) => {
    const workflowStatus = getWorkflowStatus(meeting);
    if (workflowStatus === 'running' || workflowStatus === 'queued') {
      setAnalysisPipelineError({
        id: meeting.id,
        message: 'Analysis is already running for this meeting. Please wait for it to finish.',
      });
      return;
    }
    const pipelineMeetingId = getSharedMeetingIdentifier(meeting);
    if (!pipelineMeetingId) {
      setAnalysisPipelineError({
        id: meeting.id,
        message: 'Unable to determine meeting identifier.',
      });
      return;
    }
    setAnalysisPipelineLoadingId(meeting.id);
    setAnalysisPipelineError({ id: meeting.id, message: null });

    try {
      let transcriptPayload = transcriptInput?.trim();
      if (stages.transcript && !transcriptPayload) {
        const transcriptIdentifier = getTranscriptLookupIdentifier(meeting);
        if (meeting.transcriptAvailable && transcriptIdentifier) {
          transcriptPayload = await fetchTranscriptFromTeams(meeting);
        }
      }

      if (stages.transcript && !transcriptPayload) {
        throw new Error('Transcript text is required to run transcript analysis.');
      }

      const calendarEventIdentifier = getCalendarEventIdentifier(meeting);
      const payload: Record<string, any> = {
        meetingId: pipelineMeetingId,
        runTranscript: stages.transcript,
        runProposal: stages.proposal,
        runPpt: stages.ppt,
        meeting: {
          title: meeting.title,
          meetingDate: buildMeetingStartDateTime(meeting),
          durationMinutes: meeting.duration,
          notes: meeting.purpose,
        },
      };

      if (transcriptPayload) {
        payload.transcriptText = transcriptPayload;
      }
      if (calendarEventIdentifier) {
        payload.calendarEventId = calendarEventIdentifier;
      }
      if (meeting.onlineMeetingId) {
        payload.onlineMeetingId = meeting.onlineMeetingId;
      }
      if (meeting.icalUid) {
        payload.icalUid = meeting.icalUid;
      }
      const resolvedDealId = meeting.deal_id || (meeting.deal as any)?.deal_id || null;
      if (resolvedDealId) {
        payload.dealId = resolvedDealId;
      }
      if (meeting.accountId) {
        payload.accountId = meeting.accountId;
      }

      const response = await apiPost('/api/analysis-workflow/run', payload);
      if (!response?.success) {
        throw new Error(response?.error || 'Failed to start analysis workflow.');
      }

      const jobId = response?.data?.jobId;
      if (jobId) {
        updateWorkflowTracking(
          {
            jobId,
            status: response?.data?.status || 'queued',
            runTranscript: stages.transcript,
            runProposal: stages.proposal,
            runPpt: stages.ppt,
            transcriptStatus: stages.transcript ? 'queued' : 'skipped',
            proposalStatus: stages.proposal ? 'queued' : 'skipped',
            pptStatus: stages.ppt ? 'queued' : 'skipped',
          } as WorkflowJobStatus,
          meeting.id
        );
        const nowIso = new Date().toISOString();
        updateMeetingInStore(meeting.id, {
          status: 'analyzing',
          analysisJob: {
            jobId,
            status: response?.data?.status || 'queued',
            transcriptStatus: stages.transcript ? 'pending' : 'skipped',
            proposalStatus: stages.proposal ? 'pending' : 'skipped',
            pptStatus: stages.ppt ? 'pending' : 'skipped',
            errorMessage: null,
            updatedAt: nowIso,
            completedAt: null,
          },
        });
        startWorkflowPollingForMeeting(meeting.id, jobId);
      }

      await fetchMeetings();
      setSyncSuccess('Analysis workflow queued. Refreshing meetings…');
      setTimeout(() => setSyncSuccess(null), 4000);
      setAnalysisPipelineError({ id: null, message: null });
    } catch (pipelineError: any) {
      const message =
        pipelineError?.response?.data?.error ||
        pipelineError?.message ||
        'Failed to start analysis workflow.';
      setAnalysisPipelineError({ id: meeting.id, message });
      setError(message);
      throw pipelineError;
    } finally {
      setAnalysisPipelineLoadingId(null);
    }
  };

  const handleUpdateMeetingAssociation = async (
    meeting: Meeting,
    association: {
      accountId: string | null;
      dealId: string | null;
      accountName?: string | null;
      dealName?: string | null;
    }
  ) => {
    if (!meeting.id) {
      throw new Error('Unable to determine meeting identifier.');
    }

    const meetingSnapshot = {
      title: meeting.title,
      meetingDate: buildMeetingStartDateTime(meeting),
      durationMinutes: meeting.duration,
      internalAttendees: meeting.internalAttendees,
      externalAttendees: meeting.externalAttendees,
      notes: meeting.notes || meeting.purpose || null,
      recordingUrl: meeting.joinUrl || null,
    };

    const response = await apiPatch(`/api/meetings/${meeting.id}`, {
      accountId: association.accountId,
      dealId: association.dealId,
      meetingSnapshot,
    });

    if (!response?.success) {
      throw new Error(response?.error || 'Failed to update meeting link.');
    }

    updateMeetingInStore(meeting.id, {
      accountId: association.accountId || null,
      accountName: association.accountName || null,
      deal_id: association.dealId || undefined,
      deal: association.dealId
        ? {
            deal_id: association.dealId,
            opportunity_name:
              association.dealName ||
              meeting.deal?.opportunity_name ||
              'Linked Deal',
            company_name: meeting.company,
            stage: meeting.deal?.stage || 'prospecting',
            progress_percentage: meeting.deal?.progress_percentage ?? 0,
            estimated_value: meeting.deal?.estimated_value,
            close_date: meeting.deal?.close_date,
            status: meeting.deal?.status || 'active',
            priority: meeting.deal?.priority,
            win_themes: meeting.deal?.win_themes || [],
            story: meeting.deal?.story,
          }
        : undefined,
    });

    if (association.accountId) {
      fetchAccountDetail(association.accountId, true).catch(() => undefined);
    }

    // Emit sync events so other components refresh
    if (association.dealId) {
      emitDealLinked(meeting.id, association.dealId, 'SalesMeetingsCalendar');
    }
    emitMeetingUpdated(meeting.id, 'SalesMeetingsCalendar');
  };

  const stopWorkflowPollingForMeeting = useCallback((calendarMeetingId: string) => {
    const jobId = meetingJobIdRef.current.get(calendarMeetingId);
    if (jobId) {
      stopBackgroundJob(jobId);
      meetingJobIdRef.current.delete(calendarMeetingId);
    }
  }, [stopBackgroundJob]);

  const updateWorkflowTracking = useCallback(
    (job: WorkflowJobStatus, meetingId: string) => {
      const normalized = (job.status || '').toLowerCase();
      const activeStates = ['running', 'queued', 'pending', 'in_progress', 'processing'];
      const requestedAnyStage = Boolean(job.runTranscript || job.runProposal || job.runPpt);
      const shouldTrack = requestedAnyStage && activeStates.includes(normalized);
      const existingTitle = (() => {
        try {
          const parsed = JSON.parse(localStorage.getItem('ongoingWorkflowAnalysis') || '{}');
          return parsed?.meetingTitle || null;
        } catch {
          return null;
        }
      })();
      const meetingTitle =
        meetings.find((m) => m.id === meetingId)?.title ||
        existingTitle ||
        'Analysis';

      if (shouldTrack) {
        localStorage.setItem(
          'ongoingWorkflowAnalysis',
          JSON.stringify({
            jobId: job.jobId,
            meetingId,
            meetingTitle,
            status: job.status || 'running',
            stages: {
              transcript: job.runTranscript,
              proposal: job.runProposal,
              ppt: job.runPpt,
            },
            updatedAt: Date.now(),
          })
        );
        return;
      }

      if (normalized === 'completed' || normalized === 'error' || normalized === 'cancelled') {
        try {
          const parsed = JSON.parse(localStorage.getItem('ongoingWorkflowAnalysis') || '{}');
          if (parsed?.jobId === job.jobId) {
            localStorage.removeItem('ongoingWorkflowAnalysis');
          }
        } catch {
          localStorage.removeItem('ongoingWorkflowAnalysis');
        }
      }
    },
    [meetings]
  );

  const applyWorkflowJobUpdate = useCallback(
    (calendarMeetingId: string, job: WorkflowJobStatus) => {
      const normalized = (job.status || '').toLowerCase();
      updateWorkflowTracking(job, calendarMeetingId);
      const updates: Partial<Meeting> = {
        analysisJob: {
          jobId: job.jobId,
          status: job.status,
          transcriptStatus: job.transcriptStatus,
          transcriptAnalysisId: job.transcriptAnalysisId || null,
          proposalStatus: job.proposalStatus,
          proposalJobId: job.proposalJobId || null,
          pptStatus: job.pptStatus,
          pptJobId: job.pptJobId || null,
          errorMessage: job.errorMessage || null,
          updatedAt: job.updatedAt || new Date().toISOString(),
          completedAt: job.completedAt || null,
        },
      };

      if (
        normalized === 'running' ||
        normalized === 'queued' ||
        normalized === 'pending' ||
        normalized === 'in_progress'
      ) {
        updates.status = 'analyzing';
      } else if (normalized === 'completed') {
        updates.status = 'analyzed';
      } else if (normalized === 'error' || normalized === 'cancelled') {
        updates.status = 'completed';
      }

      updateMeetingInStore(calendarMeetingId, updates);
    },
    [updateMeetingInStore, updateWorkflowTracking]
  );

  const startWorkflowPollingForMeeting = useCallback(
    (calendarMeetingId: string, jobId: string) => {
      if (!jobId) return;

      // Stop any existing poller for this meeting slot first
      const existingJobId = meetingJobIdRef.current.get(calendarMeetingId);
      if (existingJobId && existingJobId !== jobId) {
        stopBackgroundJob(existingJobId);
      }
      meetingJobIdRef.current.set(calendarMeetingId, jobId);

      const meetingLabel =
        meetings.find((m) => m.id === calendarMeetingId)?.title || 'Meeting analysis';

      const callbacks = {
        onUpdate: (job: WorkflowJobStatus) => applyWorkflowJobUpdate(calendarMeetingId, job),
        onComplete: async (job: WorkflowJobStatus) => {
          applyWorkflowJobUpdate(calendarMeetingId, job);
          meetingJobIdRef.current.delete(calendarMeetingId);
          const normalized = (job.status || '').toLowerCase();
          if (normalized === 'completed') {
            await fetchMeetings().catch(() => undefined);
            emitWorkflowUpdated(calendarMeetingId, jobId, 'completed', 'SalesMeetingsCalendar');
          } else if (normalized === 'error') {
            setAnalysisPipelineError({
              id: calendarMeetingId,
              message: job.errorMessage || 'Analysis workflow failed.',
            });
            emitWorkflowUpdated(calendarMeetingId, jobId, 'error', 'SalesMeetingsCalendar');
          } else if (normalized === 'cancelled') {
            setSyncSuccess('Analysis workflow cancelled.');
            setTimeout(() => setSyncSuccess(null), 3000);
            emitWorkflowUpdated(calendarMeetingId, jobId, 'cancelled', 'SalesMeetingsCalendar');
          }
        },
      };

      // registerJob is idempotent — if poller already running (e.g. after navigation),
      // it just updates the callbacks so this component instance gets the updates.
      const reconnected = connectToJob(jobId, callbacks);
      if (!reconnected) {
        registerJob(jobId, 'workflow', meetingLabel, callbacks, { calendarMeetingId });
      }
    },
    [applyWorkflowJobUpdate, fetchMeetings, stopBackgroundJob, registerJob, connectToJob, meetings]
  );

  // New meeting form

  const handleAnalyzeMeeting = async (meeting: Meeting) => {
    // If onStartAnalysis callback is provided, use it to switch to research page
    if (onStartAnalysis) {
      onStartAnalysis(meeting);
      return;
    }

    // Otherwise, use the original logic (for backward compatibility)
    setError(null);

    updateMeetingInStore(meeting.id, { status: 'analyzing' });

    try {
      // Start research analysis with full meeting data
      const response = await axios.post(`${API_URL}/api/research`, {
        company_name: meeting.company,
        purpose_of_meeting: meeting.purpose,
        meeting_context: '',  // Keep separate from attendees
        meeting_title: meeting.title,
        meeting_date: meeting.date,
        meeting_time: meeting.time,
        meeting_id: getSharedMeetingIdentifier(meeting) || meeting.id,
        attendees: meeting.attendees.map(a => ({
          name: a.name,
          email: a.email,
          role: a.role || ''
        }))
      });

      const sessionId = response.data.session_id;

      updateMeetingInStore(meeting.id, { analysisSessionId: sessionId });
      addNotification({
        title: 'Pre-call analysis started',
        message: `${meeting.company} research is running.`,
        type: 'info',
      });

      // Emit sync event so other components know pre-call started
      emitPreCallStarted(meeting.id, sessionId, 'SalesMeetingsCalendar');
      localStorage.setItem(
        'ongoingResearch',
        JSON.stringify({
          sessionId,
          companyName: meeting.company,
          purposeOfMeeting: meeting.purpose,
          meetingContext: '',
          attendees: meeting.attendees,
          meetingId: getSharedMeetingIdentifier(meeting) || meeting.id,
          startTime: Date.now(),
          progressPercentage: 0,
          currentStep: 'Starting research...',
          progress: {
            external_research: 'pending',
            integrator_cases: 'pending',
            library_cases: 'pending',
            report_generation: 'pending',
          },
          logs: [`Research session started: ${sessionId}`],
        })
      );

      // Poll for completion
      pollAnalysisStatus(meeting.id, sessionId);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to start analysis');
      updateMeetingInStore(meeting.id, { status: 'scheduled' });
      addNotification({
        title: 'Pre-call analysis failed',
        message: err.response?.data?.detail || 'Failed to start analysis.',
        type: 'error',
      });
    } finally {
      // Analysis finished or failed; nothing additional needed.
    }
  };

  const pollAnalysisStatus = async (meetingId: string, sessionId: string) => {
    const maxAttempts = 60; // 5 minutes max
    let attempts = 0;

    const poll = async () => {
      try {
        const statusResponse = await axios.get(`${API_URL}/api/research/${sessionId}/status`);

        if (statusResponse.data.status === 'completed') {
          const meeting = meetings.find((m) => m.id === meetingId);
          const existingPreCall = meeting?.analysisSummary?.preCall || [];
          const preCallEntry = {
            sessionId,
            status: 'completed' as const,
            completedAt: statusResponse.data.completed_at || new Date().toISOString(),
            startedAt: existingPreCall.find((pc) => pc.sessionId === sessionId)?.startedAt || null,
            currentStep: null,
          };
          updateMeetingInStore(meetingId, {
            status: 'analyzed',
            analysisSummary: {
              preCall: [preCallEntry, ...existingPreCall.filter((pc) => pc.sessionId !== sessionId)],
              postCall: meeting?.analysisSummary?.postCall || [],
              proposals: meeting?.analysisSummary?.proposals || [],
            },
          });
          addNotification({
            title: 'Pre-call analysis completed',
            message: `${meeting?.title || meeting?.company || 'Sales meeting'} analysis completed.`,
            type: 'success',
          });
          localStorage.removeItem('ongoingResearch');
          return;
        } else if (statusResponse.data.status === 'error') {
          setError('Analysis failed: ' + statusResponse.data.error);
          const meeting = meetings.find((m) => m.id === meetingId);
          const existingPreCall = meeting?.analysisSummary?.preCall || [];
          const preCallEntry = {
            sessionId,
            status: 'error' as const,
            completedAt: null,
            startedAt: existingPreCall.find((pc) => pc.sessionId === sessionId)?.startedAt || null,
            currentStep: null,
          };
          updateMeetingInStore(meetingId, {
            status: 'completed',
            analysisSummary: {
              preCall: [preCallEntry, ...existingPreCall.filter((pc) => pc.sessionId !== sessionId)],
              postCall: meeting?.analysisSummary?.postCall || [],
              proposals: meeting?.analysisSummary?.proposals || [],
            },
          });
          addNotification({
            title: 'Pre-call analysis failed',
            message: statusResponse.data.error || 'Analysis failed.',
            type: 'error',
          });
          localStorage.removeItem('ongoingResearch');
          return;
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000); // Poll every 5 seconds
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    };

    poll();
  };

  const handleBulkAnalyze = async () => {
    if (selectedMeetings.size === 0) {
      setError('Please select at least one meeting to analyze');
      return;
    }

    setBulkAnalyzing(true);
    setError(null);

    // Analyze selected meetings sequentially
    for (const meetingId of Array.from(selectedMeetings)) {
      const meeting = meetings.find(m => m.id === meetingId);
      if (meeting && meeting.status !== 'analyzed' && meeting.status !== 'analyzing') {
        await handleAnalyzeMeeting(meeting);
        // Wait a bit between analyses to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    setBulkAnalyzing(false);
    setSelectedMeetings(new Set());
  };

  const handleToggleSelect = (meetingId: string) => {
    const newSelected = new Set(selectedMeetings);
    if (newSelected.has(meetingId)) {
      newSelected.delete(meetingId);
    } else {
      newSelected.add(meetingId);
    }
    setSelectedMeetings(newSelected);
  };

  const handleViewAnalysis = (meeting: Meeting, sessionIdOverride?: string) => {
    const sessionId = sessionIdOverride || meeting.analysisSessionId;
    if (sessionId && onViewAnalysis) {
      onViewAnalysis(sessionId, meeting.company, meeting.purpose);
    }
  };

  const handleViewExistingPostCall = (meeting: Meeting) => {
    const latestPostCall = getLatestPostCallSummary(meeting);
    if (!latestPostCall) return;
    // Navigate to the transcript analysis page
    navigate(`/app/analysis/transcript/${latestPostCall.analysisId}`);
  };

  const handleViewProposalJob = (meeting: Meeting) => {
    openProposalJob(meeting, navigate);
  };

  const handleGenerateProposal = async (meeting: Meeting) => {
    openProposalGenerator(meeting, navigate, setError);
    return Promise.resolve();
  };

  const handleGeneratePpt = async (meeting: Meeting) => {
    openPptGenerator(meeting, navigate);
    return Promise.resolve();
  };


  const handleSyncTeamsCalendar = useCallback(async () => {
    setSyncingTeams(true);
    setError(null);
    clearMeetingsError();
    setSyncSuccess(null);

    try {
      // Force sync when user explicitly clicks the button
      await fetchMeetings({ force: true });

      setSyncSuccess('Meetings refreshed for last week, this week, and next week');
      setTimeout(() => setSyncSuccess(null), 5000);
    } catch (err: any) {
      console.error('Teams sync error:', err);
      setError(err?.message || 'Failed to fetch meetings from Teams. Please try again.');
    } finally {
      setSyncingTeams(false);
    }
  }, [fetchMeetings, clearMeetingsError]);

  const formatLastSynced = () => {
    if (!lastFetchedAt) return 'Not synced yet';
    const stale = isStaleFn?.();
    const label = new Date(lastFetchedAt).toLocaleString();
    return stale ? `Last synced: ${label} (stale)` : `Last synced: ${label}`;
  };

  const badgeLegend = [
    { icon: <LinkedIcon sx={{ fontSize: 14, color: '#fff' }} />, label: 'Linked deal', color: '#00A48C' },
    { icon: <PreCallIcon sx={{ fontSize: 14, color: '#fff' }} />, label: 'Pre-call ready', color: 'secondary.main' },
    { icon: <PostCallIcon sx={{ fontSize: 14, color: '#fff' }} />, label: 'Post-call ready', color: 'success.main' },
    { icon: <Box component="img" src={proposalIcon} alt="Proposal" sx={{ width: 14, height: 14 }} />, label: 'Proposal ready', color: '#9333ea' },
    { icon: <PptxIcon sx={{ fontSize: 14, color: '#fff' }} />, label: 'PPT ready', color: '#ea580c' },
  ];

  useEffect(() => {
    meetings.forEach((meeting) => {
      const jobId = meeting.analysisJob?.jobId;
      const jobStatus = (meeting.analysisJob?.status || '').toLowerCase();
      const hasPoller = meetingJobIdRef.current.has(meeting.id);

      if (jobId && (jobStatus === 'running' || jobStatus === 'queued')) {
        if (!hasPoller) {
          startWorkflowPollingForMeeting(meeting.id, jobId);
        }
      } else if (hasPoller && (!jobId || jobStatus === 'completed' || jobStatus === 'error' || jobStatus === 'cancelled')) {
        stopWorkflowPollingForMeeting(meeting.id);
      }
    });

    // Stop pollers for meetings that are no longer in the list
    meetingJobIdRef.current.forEach((_jobId, calendarMeetingId) => {
      const stillTracked = meetings.some((meeting) => meeting.id === calendarMeetingId);
      if (!stillTracked) {
        stopWorkflowPollingForMeeting(calendarMeetingId);
      }
    });
  }, [meetings, startWorkflowPollingForMeeting, stopWorkflowPollingForMeeting]);

  useEffect(() => {
    return () => {
      // Pollers keep running in the background store — just clear callbacks so
      // updates don't flow into the unmounted component.
      meetingJobIdRef.current.forEach((jobId) => {
        disconnectCallbacks(jobId);
      });
    };
  }, [disconnectCallbacks]);

  // Auto-fetch meetings on mount - the store's caching logic will skip if data is fresh
  useEffect(() => {
    if (autoSyncAttemptedRef.current) {
      return;
    }
    autoSyncAttemptedRef.current = true;

    // Call fetchMeetings without force - it will skip if cached data is fresh
    fetchMeetings().catch(() => {
      autoSyncAttemptedRef.current = false;
    });
  }, [fetchMeetings]);

  // Refresh meetings when page becomes visible (user returns from another page)
  // This ensures pre-call status is synced when returning from MeetingDetailPage or Analysis page
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Check if data might be stale (force refresh to get latest pre-call status)
        fetchMeetings({ force: true }).catch(() => undefined);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchMeetings]);

  // Lightweight polling for running pre-call analyses
  // Instead of doing a full meeting sync, we poll the research status API directly
  // and update only the affected meetings in the store
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Find meetings with running pre-call analyses
    const runningAnalyses = meetings
      .filter(meeting => {
        const preCallSummary = meeting.analysisSummary?.preCall?.[0];
        return preCallSummary?.status === 'running' || preCallSummary?.status === 'pending';
      })
      .map(meeting => ({
        meetingId: meeting.id,
        sessionId: meeting.analysisSummary?.preCall?.[0]?.sessionId,
      }))
      .filter(item => item.sessionId);

    // Clean up any existing interval
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    if (runningAnalyses.length === 0) return;

    // Lightweight status check - only polls research status, doesn't sync meetings
    const checkAnalysisStatus = async () => {
      for (const { meetingId, sessionId } of runningAnalyses) {
        try {
          const response = await axios.get(`${API_BASE_URL}/api/research/status/${sessionId}`);
          const statusData = response.data?.data || response.data;

          if (statusData?.status === 'completed' || statusData?.status === 'error') {
            // Update only this meeting's analysis summary in the store
            const meeting = meetings.find(m => m.id === meetingId);
            if (meeting) {
              const existingPreCall = meeting.analysisSummary?.preCall || [];
              updateMeetingInStore(meetingId, {
                analysisSummary: {
                  ...meeting.analysisSummary,
                  preCall: [
                    {
                      sessionId: sessionId!,
                      status: statusData.status,
                      completedAt: statusData.status === 'completed' ? new Date().toISOString() : null,
                      startedAt: existingPreCall.find(pc => pc.sessionId === sessionId)?.startedAt || null,
                      currentStep: null,
                    },
                    ...existingPreCall.filter(pc => pc.sessionId !== sessionId),
                  ],
                  postCall: meeting.analysisSummary?.postCall || [],
                  proposals: meeting.analysisSummary?.proposals || [],
                },
              });
            }
          }
        } catch {
          // Silently ignore errors - analysis may still be initializing
        }
      }
    };

    // Add initial delay of 45 seconds before starting to poll
    // This allows the analysis to get well underway
    const initialDelay = setTimeout(() => {
      // Poll every 15 seconds - lightweight check, doesn't trigger full sync
      checkAnalysisStatus(); // First check after initial delay
      pollIntervalRef.current = setInterval(checkAnalysisStatus, 15000);
    }, 45000);

    return () => {
      clearTimeout(initialDelay);
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [meetings, updateMeetingInStore]);

  const handleViewDetails = (meeting: Meeting) => {
    navigate(`/app/calendar/meetings/${encodeURIComponent(meeting.id)}`);
  };

  const getStatusColor = (status: Meeting['status']) => {
    switch (status) {
      case 'scheduled': return 'primary';
      case 'completed': return 'default';
      case 'analyzing': return 'warning';
      case 'analyzed': return 'success';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: Meeting['status']) => {
    switch (status) {
      case 'scheduled': return <ScheduleIcon />;
      case 'completed': return <CheckIcon />;
      case 'analyzing': return <CircularProgress size={20} />;
      case 'analyzed': return <AnalyzeIcon />;
      default: return <ScheduleIcon />;
    }
  };

  return (
    <>
    <Fade in timeout={400}>
    <Box
      sx={{
        p: { xs: 2, md: 4 },
        background: '#FFFFFF',
        minHeight: '100%',
      }}
    >
      {/* Hero Header */}
      <Paper
        elevation={0}
        sx={{
          p: 4,
          mb: 4,
          borderRadius: 4,
          background: COLORS.gradient,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '50%',
            height: '100%',
            opacity: 0.1,
            background: 'radial-gradient(circle at 50% 50%, white 0%, transparent 70%)',
          }}
        />
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', md: 'center' }}
          spacing={2}
        >
          <Stack direction="row" spacing={3} alignItems="center">
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: 3,
                bgcolor: alpha('#fff', 0.15),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CalendarIcon sx={{ fontSize: 32, color: 'white' }} />
            </Box>
            <Box>
              <Typography variant="h4" sx={{ color: 'white', fontWeight: 700, mb: 0.5 }}>
                Sales Meetings Calendar
              </Typography>
              <Typography variant="body1" sx={{ color: alpha('#fff', 0.85) }}>
                {formatLastSynced() || 'Sync your Outlook calendar to track meetings and run analysis workflows'}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1.5} alignItems="center">
            {meetingsLoading && !syncingTeams && (
              <CircularProgress size={20} sx={{ color: 'white' }} />
            )}
            <Button
              variant="contained"
              startIcon={syncingTeams ? <CircularProgress size={16} color="inherit" /> : <SyncIcon />}
              onClick={handleSyncTeamsCalendar}
              disabled={syncingTeams || meetingsLoading}
              sx={{
                bgcolor: alpha('#fff', 0.15),
                color: 'white',
                fontWeight: 600,
                borderRadius: 2,
                '&:hover': {
                  bgcolor: alpha('#fff', 0.25),
                },
                '&:disabled': {
                  bgcolor: alpha('#fff', 0.1),
                  color: alpha('#fff', 0.6),
                },
              }}
            >
              {syncingTeams ? 'Syncing...' : 'Sync from Outlook'}
            </Button>
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(_, newMode) => newMode && setViewMode(newMode)}
              size="small"
              sx={{
                bgcolor: alpha('#fff', 0.1),
                '& .MuiToggleButton-root': {
                  color: alpha('#fff', 0.8),
                  borderColor: 'transparent',
                  '&.Mui-selected': {
                    bgcolor: 'background.paper',
                    color: COLORS.secondary,
                    '&:hover': {
                      bgcolor: 'background.paper',
                    },
                  },
                  '&:hover': {
                    bgcolor: alpha('#fff', 0.15),
                  },
                },
              }}
            >
              <ToggleButton value="calendar">
                <CalendarIcon sx={{ mr: 0.5, fontSize: 18 }} />
                Calendar
              </ToggleButton>
              <ToggleButton value="list">
                <ListIcon sx={{ mr: 0.5, fontSize: 18 }} />
                List
              </ToggleButton>
            </ToggleButtonGroup>
            {viewMode === 'list' && (
              <Button
                variant="contained"
                sx={{
                  bgcolor: 'background.paper',
                  color: COLORS.secondary,
                  fontWeight: 600,
                  borderRadius: 2,
                  '&:hover': {
                    bgcolor: alpha('#fff', 0.9),
                  },
                  '&:disabled': {
                    bgcolor: alpha('#fff', 0.3),
                    color: alpha(COLORS.secondary, 0.5),
                  },
                }}
                onClick={handleBulkAnalyze}
                disabled={selectedMeetings.size === 0 || bulkAnalyzing}
              >
                Analyze Selected ({selectedMeetings.size})
              </Button>
            )}
          </Stack>
        </Stack>
      </Paper>

      {/* Location permission alerts */}
      {locationPermission === 'prompt' && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Detecting your location so meeting times reflect your local timezone…
        </Alert>
      )}
      {locationPermission === 'denied' && (
        <Alert
          severity="warning"
          sx={{ mb: 3 }}
          action={
            <Button size="small" onClick={refreshFromLocation}>
              Retry
            </Button>
          }
        >
          Meeting times below fall back to the calendar timezone. Enable location access if you want them converted
          to your local time automatically.
        </Alert>
      )}

      {combinedError && (
        <Alert
          severity="error"
          sx={{ mb: 3 }}
          onClose={() => {
            setError(null);
            clearMeetingsError();
          }}
        >
          {combinedError}
        </Alert>
      )}

      {syncSuccess && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSyncSuccess(null)}>
          {syncSuccess}
        </Alert>
      )}

      {shouldPromptSync && (
        <Paper
          sx={{
            mb: 3,
            p: 3,
            bgcolor: '#FFFDF6',
            border: '1px dashed rgba(0, 35, 72, 0.15)',
          }}
        >
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center" justifyContent="space-between">
            <Box>
              <Typography variant="h6" sx={{ color: 'text.primary', mb: 0.5 }}>
                Sync your Teams calendar
              </Typography>
              <Typography variant="body2" sx={{ color: '#1A385E' }}>
                Fetch meetings for the previous, current, and next week to populate your calendar view.
              </Typography>
            </Box>
            <Button
              variant="contained"
              onClick={handleSyncTeamsCalendar}
              startIcon={syncingTeams ? <CircularProgress size={16} color="inherit" /> : <SyncIcon />}
              disabled={syncingTeams}
              sx={{
                fontWeight: 700,
                textTransform: 'none',
                borderRadius: '999px',
                background: 'linear-gradient(135deg, #C90C61 0%, #731A42 100%)',
                boxShadow: 'none',
                '&:hover': {
                  boxShadow: 'none',
                },
                '&:active': { boxShadow: 'none' },
                '&.Mui-focusVisible': { boxShadow: 'none' },
                '&:disabled': {
                  background: 'rgba(201, 12, 97, 0.35)',
                  color: 'rgba(255, 255, 255, 0.9)',
                },
              }}
            >
              {syncingTeams ? 'Syncing…' : 'Sync from Outlook'}
            </Button>
          </Stack>
        </Paper>
      )}

      {/* Next Best Action suggestions */}
      <NextBestActionBanner />

      {/* Calendar vs List View */}
      {viewMode === 'calendar' ? (
        <CalendarView
          meetings={meetings}
          onViewDetails={handleViewDetails}
          onPostCallAnalysis={handlePostCallAnalysis}
          onGenerateProposal={handleGenerateProposal}
          onGeneratePpt={handleGeneratePpt}
          onAnalysisError={setError}
          onRunWorkflow={(meeting, payload) =>
            handleRunAnalysisPipeline(meeting, payload.stages, payload.transcriptText)
          }
          workflowLoadingId={analysisPipelineLoadingId}
          workflowError={analysisPipelineError}
          onUpdateAssociation={handleUpdateMeetingAssociation}
        />
      ) : (
        <>
          {meetings.length === 0 ? (
            <Paper
              sx={{
                p: 4,
                textAlign: 'center',
                background: 'linear-gradient(135deg, #FFFDF6 0%, #FDFFD4 100%)',
                border: '1px solid rgba(0, 35, 72, 0.15)',
                boxShadow: '0 20px 45px rgba(0, 35, 72, 0.08)',
              }}
            >
              <Typography
                variant="h6"
                sx={{
                  color: '#1A385E',
                  mb: 1,
                  fontFamily: `'Playfair Display', 'Times New Roman', serif`,
                }}
              >
                No meetings yet
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: 'text.primary',
                  mb: 2,
                  fontFamily: `'Barlow', 'Helvetica Neue', sans-serif`,
                }}
              >
                Use “Sync from Teams” or schedule a new meeting to see it in your list.
              </Typography>
              <Button variant="contained" color="info" onClick={handleSyncTeamsCalendar} startIcon={<SyncIcon />}>
                Sync Meetings
              </Button>
              <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary' }}>
                {formatLastSynced()}
              </Typography>
            </Paper>
          ) : (
          <>
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              gap: 2,
              alignItems: { xs: 'flex-start', md: 'center' },
              justifyContent: 'space-between',
              mb: 2,
            }}
          >
            <ToggleButtonGroup
              value={listFilterMode}
              exclusive
              size="small"
              onChange={(_, mode) => mode && setListFilterMode(mode)}
            >
              <ToggleButton value="all">All</ToggleButton>
              <ToggleButton value="week">Week</ToggleButton>
              <ToggleButton value="day">Day</ToggleButton>
            </ToggleButtonGroup>
            {listFilterMode !== 'all' && (
              <TextField
                type="date"
                size="small"
                label={listFilterMode === 'day' ? 'Select day' : 'Pick week'}
                value={listFilterDate}
                onChange={(event) => setListFilterDate(event.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: 220 }}
              />
            )}
            {listFilterMode === 'day' && (
              <Typography variant="body2" sx={{ color: '#005849', fontWeight: 600 }}>
                Showing meetings on {formatIsoDateLabel(listFilterDate)}
              </Typography>
            )}
            {listFilterMode === 'week' && selectedWeekRange && (
              <Typography variant="body2" sx={{ color: '#005849', fontWeight: 600 }}>
                Showing week of {formatIsoDateLabel(selectedWeekRange.start)} – {formatIsoDateLabel(selectedWeekRange.end)}
              </Typography>
            )}
          </Box>
          {/* Meetings List */}
      <Paper sx={{ bgcolor: '#FFFFFF', border: '1px solid rgba(0, 35, 72, 0.08)', boxShadow: '0 12px 30px rgba(0, 35, 72, 0.08)' }}>
        <Box sx={{ p: 2, borderBottom: '1px solid rgba(0, 35, 72, 0.08)' }}>
          <Typography variant="h6" sx={{ color: 'text.primary' }}>
            Upcoming & Recent Meetings
          </Typography>
        </Box>
        <List>
          {filteredMeetings.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center', color: '#1A385E' }}>
              No meetings match the selected {listFilterMode === 'day' ? 'day' : 'week'} filter.
            </Box>
          ) : (
            filteredMeetings.map((meeting, index) => {
            const pastMeeting = isPastMeeting(meeting);
            const preCallSummary = getLatestPreCallSummary(meeting);
            const postCallSummary = getLatestPostCallSummary(meeting);
            const proposalSummary = getLatestProposalSummary(meeting);
            const workflowChip = getWorkflowChipProps(meeting);
            const analysisInProgress =
              workflowChip.status === 'running' ||
              workflowChip.status === 'queued' ||
              meeting.status === 'analyzing';
            const preCallMissing = pastMeeting && !preCallSummary;
            const showWorkflowChip =
              Boolean(meeting.analysisJob) ||
              workflowChip.status === 'completed' ||
              workflowChip.status === 'partial';
            const transcriptStageStatus = getStageStatus(meeting, 'transcript');
            const proposalStageStatus = getStageStatus(meeting, 'proposal');
            const pptStageStatus = getStageStatus(meeting, 'ppt');
            const transcriptStageComplete = isStageComplete(transcriptStageStatus);
            const proposalStageComplete = isStageComplete(proposalStageStatus);
            const pptStageComplete = isStageComplete(pptStageStatus);
            const allWorkflowStagesComplete =
              transcriptStageComplete && proposalStageComplete && pptStageComplete;
            const onlyTranscriptStageComplete =
              transcriptStageComplete && !proposalStageComplete && !pptStageComplete;
            const stageAvailability = {
              transcript: !transcriptStageComplete,
              proposal: !proposalStageComplete,
              ppt: !pptStageComplete,
            };
            const stageInitialSelection =
              !transcriptStageComplete
                ? { transcript: true }
                : !proposalStageComplete
                ? { proposal: true }
                : !pptStageComplete
                ? { ppt: true }
                : {};
            const localTime = getUserLocalMeetingTime(meeting);
            const primaryDate = (meeting.displayDate || meeting.date) ?? '';
            const primaryTime = (meeting.displayTime || meeting.time) ?? '';
            const primaryZone = meeting.timeZoneLabel || 'Meeting time zone';

            return (
              <React.Fragment key={meeting.id}>
                {index > 0 && <Divider />}
                <ListItem
                sx={{
                  '&:hover': { bgcolor: 'rgba(8, 75, 114, 0.05)' },
                  py: 2,
                }}
              >
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={selectedMeetings.has(meeting.id)}
                      onChange={() => handleToggleSelect(meeting.id)}
                      disabled={meeting.status === 'analyzing'}
                    />
                  }
                  label=""
                  sx={{ mr: 2 }}
                />

                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                      <Typography
                        variant="h6"
                        component="button"
                        onClick={() => handleViewDetails(meeting)}
                        sx={{
                          border: 'none',
                          background: 'transparent',
                          padding: 0,
                          margin: 0,
                          cursor: 'pointer',
                          color: 'text.primary',
                          fontFamily: `'Playfair Display', 'Times New Roman', serif`,
                          fontWeight: 600,
                          textDecoration: 'underline',
                          fontSize: '1.1rem',
                          textAlign: 'left',
                          '&:hover': {
                            color: '#C90C61',
                          },
                          '&:focus-visible': {
                            outline: '2px solid #C90C61',
                            outlineOffset: 2,
                          },
                        }}
                      >
                        {meeting.title}
                      </Typography>
                      <Chip
                        icon={getStatusIcon(meeting.status)}
                        label={meeting.status.toUpperCase()}
                        size="small"
                        color={getStatusColor(meeting.status)}
                      />
                      {showWorkflowChip && (
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <Chip
                            label={`Analysis: ${workflowChip.label}`}
                            size="small"
                            color={workflowChip.color}
                            variant={workflowChip.color === 'default' ? 'outlined' : 'filled'}
                            sx={
                              !analysisInProgress &&
                              (workflowChip.status === 'completed' || workflowChip.status === 'partial')
                                ? {
                                    backgroundColor: '#CDDE33',
                                    color: 'text.primary',
                                    fontWeight: 700,
                                    border: '1px solid rgba(0, 35, 72, 0.18)',
                                  }
                                : undefined
                            }
                          />
                          {(workflowChip.status === 'queued' || workflowChip.status === 'running') &&
                          meeting.analysisJob?.jobId ? (
                            <CancelAnalysisFlowButton
                              iconOnly
                              preCallSessionId={preCallSummary?.sessionId || null}
                              workflowJobId={meeting.analysisJob.jobId}
                              meetingId={meeting.id}
                              size="small"
                            />
                          ) : null}
                        </Stack>
                      )}
                      {preCallSummary?.status === 'completed' && (
                        <Tooltip title="Pre-call research completed">
                          <Chip
                            icon={<PreCallIcon sx={{ fontSize: 14 }} />}
                            label="Pre-call Ready"
                            size="small"
                            sx={{
                              bgcolor: 'info.light',
                              color: 'secondary.main',
                              border: '1px solid #dbeafe',
                              fontWeight: 600,
                              '& .MuiChip-icon': { color: 'secondary.main' },
                            }}
                          />
                        </Tooltip>
                      )}
                      {(preCallSummary?.status === 'running' || preCallSummary?.status === 'pending') && (
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <Tooltip title="Pre-call research in progress">
                            <Chip
                              icon={<CircularProgress size={12} sx={{ color: 'warning.main' }} />}
                              label="Pre-call Running"
                              size="small"
                              sx={{
                                bgcolor: 'warning.light',
                                color: 'warning.main',
                                border: '1px solid #fef3c7',
                                fontWeight: 600,
                                '& .MuiChip-icon': { color: 'warning.main' },
                              }}
                            />
                          </Tooltip>
                          {preCallSummary?.sessionId ? (
                            <CancelAnalysisFlowButton
                              iconOnly
                              preCallSessionId={preCallSummary.sessionId}
                              workflowJobId={meeting.analysisJob?.jobId || null}
                              meetingId={meeting.id}
                              size="small"
                            />
                          ) : null}
                        </Stack>
                      )}
                      {/* Post-call analysis completed tag */}
                      {postCallSummary?.status === 'completed' && (
                        <Tooltip title="Post-call analysis completed">
                          <Chip
                            icon={<PostCallIcon sx={{ fontSize: 14 }} />}
                            label="Post-call"
                            size="small"
                            sx={{
                              bgcolor: '#f0fdf4',
                              color: 'success.main',
                              border: '1px solid #dcfce7',
                              fontWeight: 600,
                              '& .MuiChip-icon': { color: 'success.main' },
                            }}
                          />
                        </Tooltip>
                      )}
                      {/* Proposal completed tag */}
                      {proposalStageComplete && (
                        <Tooltip title="Proposal generated">
                          <Chip
                            icon={<Box component="img" src={proposalIcon} alt="Proposal" sx={{ width: 14, height: 14 }} />}
                            label="Proposal"
                            size="small"
                            sx={{
                              bgcolor: '#faf5ff',
                              color: '#9333ea',
                              border: '1px solid #f3e8ff',
                              fontWeight: 600,
                              '& .MuiChip-icon': { color: '#9333ea' },
                            }}
                          />
                        </Tooltip>
                      )}
                      {/* PPTX completed tag */}
                      {pptStageComplete && (
                        <Tooltip title="Presentation generated">
                          <Chip
                            icon={<PptxIcon sx={{ fontSize: 14 }} />}
                            label="PPTX"
                            size="small"
                            sx={{
                              bgcolor: '#fff7ed',
                              color: '#ea580c',
                              border: '1px solid #ffedd5',
                              fontWeight: 600,
                              '& .MuiChip-icon': { color: '#ea580c' },
                            }}
                          />
                        </Tooltip>
                      )}
                    </Box>
                  }
                  secondary={
                    <Box sx={{ mt: 1 }}>
                      <Stack spacing={1}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <Tooltip title="Company">
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <BusinessIcon sx={{ fontSize: 16, color: '#1A385E' }} />
                              <Typography variant="body2" sx={{ color: '#1A385E' }}>
                                {meeting.company}
                              </Typography>
                            </Box>
                          </Tooltip>
                          <Tooltip title="Your local time">
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <EventIcon sx={{ fontSize: 16, color: '#1A385E' }} />
                              <Box>
                                <Typography variant="body2" sx={{ color: '#1A385E' }}>
                                  {localTime.dateLabel} at {localTime.timeLabel} {localTime.timeZoneShort}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Meeting timezone: {primaryDate} · {primaryTime} {primaryZone}
                                </Typography>
                              </Box>
                            </Box>
                          </Tooltip>
                          <Tooltip title="Duration">
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <ScheduleIcon sx={{ fontSize: 16, color: '#1A385E' }} />
                              <Typography variant="body2" sx={{ color: '#1A385E' }}>
                                {meeting.duration} min
                              </Typography>
                            </Box>
                          </Tooltip>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="caption" sx={{ color: '#005849', fontWeight: 600 }}>
                            Attendees:
                          </Typography>
                          <AvatarGroup max={4} sx={{ '& .MuiAvatar-root': { width: 24, height: 24, fontSize: 12 } }}>
                            {meeting.attendees.map((attendee, idx) => (
                              <Tooltip key={idx} title={`${attendee.name} - ${attendee.role || 'Attendee'}`}>
                                <Avatar sx={{ bgcolor: 'success.main' }}>
                                  {attendee.name.charAt(0)}
                                </Avatar>
                              </Tooltip>
                            ))}
                          </AvatarGroup>
                        </Box>

                        {meeting.analysisJob?.errorMessage && (
                          <Typography variant="caption" sx={{ color: '#f87171', fontWeight: 600 }}>
                            Analysis error: {meeting.analysisJob.errorMessage}
                          </Typography>
                        )}

                        {pastMeeting && (
                          <Chip
                            label={meeting.transcriptAvailable ? 'Transcript Available' : 'Transcript Not Available'}
                            size="small"
                            sx={{
                              width: 'fit-content',
                              bgcolor: meeting.transcriptAvailable ? 'rgba(0, 164, 140, 0.15)' : 'rgba(201, 12, 97, 0.12)',
                              color: meeting.transcriptAvailable ? '#00A48C' : '#9D1C56',
                              fontWeight: 600,
                            }}
                          />
                        )}

                      </Stack>
                    </Box>
                  }
                />

                <Box
                  sx={{
                    display: 'flex',
                    gap: 1,
                    ml: 2,
                    flexWrap: 'wrap',
                    justifyContent: 'flex-end',
                  }}
                >
                  {pastMeeting ? (
                    allWorkflowStagesComplete ? (
                      <>
                        <Button variant="contained" size="small" disabled>
                          Analysis Complete
                        </Button>
                        <Button variant="outlined" size="small" disabled>
                          View Analysis
                        </Button>
                      </>
                    ) : analysisInProgress ? (
                      <Alert severity="info" sx={{ minWidth: 220 }}>
                        Analysis is processing. Please wait for it to finish.
                      </Alert>
                    ) : (
                      <Box sx={{ minWidth: 220 }}>
                        <AnalysisChecklist
                          meeting={meeting}
                          onRun={({ stages, transcriptText }) =>
                            handleRunAnalysisPipeline(meeting, stages, transcriptText)
                          }
                          loading={analysisInProgress || analysisPipelineLoadingId === meeting.id}
                          error={
                            analysisPipelineError.id === meeting.id
                              ? analysisPipelineError.message
                              : null
                          }
                          compact
                          availableStages={stageAvailability}
                          initialSelection={stageInitialSelection}
                          completedStages={{
                            transcript: transcriptStageComplete,
                            proposal: proposalStageComplete,
                            ppt: pptStageComplete,
                          }}
                        />
                        </Box>
                    )
                  ) : !preCallSummary ? (
                    <Button
                      variant="outlined"
                      size="small"
                      disabled={analysisInProgress}
                      onClick={() => handlePreCallAnalysis(meeting)}
                    >
                      Pre-call Analysis
                    </Button>
                  ) : null}

                  {pastMeeting && postCallSummary && (
                    <Button
                      variant="text"
                      size="small"
                      onClick={() => handleViewExistingPostCall(meeting)}
                    >
                      View Post-call Analysis
                    </Button>
                  )}

                  {preCallSummary && (
                    <Button
                      variant="contained"
                      sx={{
                        backgroundColor: '#CDDE33',
                        color: 'text.primary',
                        fontWeight: 700,
                        boxShadow: '0 10px 24px rgba(205, 222, 51, 0.35)',
                        '&:hover': {
                          backgroundColor: '#c1d028',
                          boxShadow: '0 12px 28px rgba(205, 222, 51, 0.45)',
                        },
                      }}
                      size="small"
                      startIcon={<AnalyzeIcon />}
                      onClick={() => handleViewAnalysis(meeting, preCallSummary?.sessionId)}
                    >
                      View Pre-call Brief
                    </Button>
                  )}

                  {proposalSummary && (
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => handleViewProposalJob(meeting)}
                    >
                      View Proposal
                    </Button>
                  )}

                  {meeting.status === 'analyzing' && (
                    <Button
                      variant="outlined"
                      size="small"
                      disabled
                      startIcon={<CircularProgress size={16} />}
                    >
                      Analyzing...
                    </Button>
                  )}
                </Box>
              </ListItem>
            </React.Fragment>
            );
            })
          )}
        </List>
      </Paper>
          </>
          )}
        </>
      )}

    </Box>
    </Fade>

      <PreCallStartDialog
        open={preCallDialogOpen}
        meeting={preCallDialogMeeting}
        onClose={() => {
          setPreCallDialogOpen(false);
          setPreCallDialogMeeting(null);
        }}
        onStart={handleStartPreCallFromDialog}
      />

    </>
  );
};

export default SalesMeetingsCalendar;
