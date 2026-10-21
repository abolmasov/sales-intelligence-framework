import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Stack,
  Typography,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Link,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  ArrowBack,
  CheckCircle,
  Pending,
  Event,
  Schedule,
  Business,
  CloudDownload,
  AutoAwesome as PreCallIcon,
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { useCalendarMeetingsStore } from '../store/calendarMeetingsStore';
import type { CalendarMeeting } from '../types/calendarMeeting';
import {
  runPreCallAnalysis,
  fetchTranscriptFromTeams,
  buildMeetingStartDateTime,
  getSharedMeetingIdentifier,
  getCalendarEventIdentifier,
  getTranscriptLookupIdentifier,
} from '../utils/meetingActions';
import AnalysisChecklist, { AnalysisStageSelection } from '../components/AnalysisChecklist';
import { apiGet, apiPatch, apiPost } from '../utils/api';
import { startWorkflowJobPolling, WorkflowJobStatus } from '../utils/workflowPolling';
import TranscriptAnalysisInsight from '../components/TranscriptAnalysisInsight';
import ReactMarkdown from 'react-markdown';
import {
  getStageStatus,
  getStageChipProps,
  getStageHelperText,
  getWorkflowChipProps,
  ChipColor,
} from '../utils/analysisStatus';
import MeetingAssociationDialog from '../components/MeetingAssociationDialog';
import { formatMeetingForTimeZone } from '../utils/dateTime';
import { useUserTimeZone } from '../context/UserTimeZoneContext';
import PreCallStartDialog, { type PreCallStartValues } from '../components/PreCallStartDialog';
import NextStepRecommendation from '../components/NextStepRecommendation';
import PageBreadcrumbs from '../components/PageBreadcrumbs';
import InlinePreCallAnalysis from '../components/InlinePreCallAnalysis';
import CancelAnalysisFlowButton from '../components/CancelAnalysisFlowButton';
import AIQuestionnaire from '../components/AIQuestionnaire';
import PreCallResearchPanel from '../components/PreCallResearchPanel';
import MeetingFlowProgressBar from '../components/MeetingFlowProgressBar';
import QuickPrepCard from '../components/QuickPrepCard';
import FollowUpEmailDialog from '../components/FollowUpEmailDialog';
import AtlassianQuickAssessment from '../components/AtlassianQuickAssessment';
import MeetingPlaybookPanel from '../components/MeetingPlaybookPanel';
import EmailIcon from '@mui/icons-material/Email';
import { useSyncEmitters, useAutoRefreshMeetings } from '../hooks/useStoreSync';
import { Fade } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { COLORS } from '../styles/pageStyles';
import FeedbackWidget from '../components/FeedbackWidget';

const isPastMeeting = (meeting: CalendarMeeting) => {
  if (meeting.startDateTime) {
    return new Date(meeting.startDateTime) < new Date();
  }
  if (meeting.date && meeting.time) {
    return new Date(`${meeting.date}T${meeting.time}`) < new Date();
  }
  return meeting.status === 'completed';
};

const MeetingDetailPage = () => {
  const { meetingId } = useParams<{ meetingId: string }>();
  const navigate = useNavigate();
  const meetings = useCalendarMeetingsStore((state) => state.meetings);
  const fetchMeetings = useCalendarMeetingsStore((state) => state.fetchMeetings);
  const fetchMeetingByIdentifier = useCalendarMeetingsStore((state) => state.fetchMeetingByIdentifier);
  const updateMeeting = useCalendarMeetingsStore((state) => state.updateMeeting);
  const { timeZone: userTimeZone, locationPermission, refreshFromLocation } = useUserTimeZone();
  const { emitWorkflowUpdated, emitDealLinked, emitMeetingUpdated } = useSyncEmitters();

  // Auto-refresh this meeting when sync events occur
  useAutoRefreshMeetings({ meetingId, enabled: true, debounceMs: 500 });
  const [preCallDialogOpen, setPreCallDialogOpen] = useState(false);
  const [followUpEmailDialogOpen, setFollowUpEmailDialogOpen] = useState(false);
  const [meetingLookupLoading, setMeetingLookupLoading] = useState(false);
  const [meetingLookupFailed, setMeetingLookupFailed] = useState(false);
  const meeting =
    meetings.find(
      (m) => m.id === meetingId || m.eventId === meetingId || m.onlineMeetingId === meetingId || m.icalUid === meetingId
    ) || null;

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const id = (meetingId || '').trim();
      if (!id) return;

      // If we already have it in the store, no need to fetch.
      if (meeting) {
        setMeetingLookupFailed(false);
        return;
      }

      setMeetingLookupLoading(true);
      setMeetingLookupFailed(false);
      const fetched = await fetchMeetingByIdentifier(id);
      if (cancelled) return;

      setMeetingLookupLoading(false);
      if (!fetched) {
        setMeetingLookupFailed(true);
      }
    };
    run().catch(() => {
      if (!cancelled) {
        setMeetingLookupLoading(false);
        setMeetingLookupFailed(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [meetingId, meeting, fetchMeetingByIdentifier]);
  const meetingLocalTime = useMemo(() => {
    if (!meeting) {
      return {
        isoDate: '',
        isoTime: '',
        dateLabel: '',
        timeLabel: '',
        timeZoneShort: userTimeZone,
      };
    }
    return formatMeetingForTimeZone(meeting, userTimeZone);
  }, [meeting, userTimeZone]);
  const organizerDateLabel = meeting?.displayDate || meeting?.date || '';
  const organizerTimeLabel = meeting?.displayTime || meeting?.time || '';
  const organizerTimeZoneLabel = meeting?.timeZoneLabel || 'Not specified';
  const localDateLabel = meetingLocalTime.dateLabel || organizerDateLabel;
  const localTimeLabel = meetingLocalTime.timeLabel || organizerTimeLabel;
  const localTimeZoneLabel = meetingLocalTime.timeZoneShort || userTimeZone;
  const linkedDeal = meeting?.deal || null;
  const linkedDealId = linkedDeal?.deal_id || meeting?.deal_id || null;
  const linkedDealName = linkedDeal?.opportunity_name || 'Linked Deal';
  const linkedDealStage = linkedDeal?.stage || null;
  const linkedDealCompany = linkedDeal?.company_name || meeting?.company || null;
  const linkedDealProgress =
    typeof linkedDeal?.progress_percentage === 'number' ? linkedDeal.progress_percentage : null;
  const latestTranscriptSummary = meeting?.analysisSummary?.postCall?.[0] || null;
  const transcriptAnalysisId = latestTranscriptSummary?.analysisId || null;
  const latestProposalSummary = meeting?.analysisSummary?.proposals?.[0] || null;
  const proposalJobId = latestProposalSummary?.jobId || null;
  const currentMeetingKey = meeting?.id || null;
  const currentWorkflowJobId = meeting?.analysisJob?.jobId || null;
  const currentWorkflowStatus = meeting?.analysisJob?.status || null;

  const [analysisWorkflowLoading, setAnalysisWorkflowLoading] = useState(false);
  const [analysisWorkflowError, setAnalysisWorkflowError] = useState<string | null>(null);
  const [analysisWorkflowSuccess, setAnalysisWorkflowSuccess] = useState<string | null>(null);
  const [associationDialogOpen, setAssociationDialogOpen] = useState(false);
  const [pendingRunRequest, setPendingRunRequest] = useState<{
    stages: AnalysisStageSelection;
    transcriptText?: string;
  } | null>(null);
  const [associationError, setAssociationError] = useState<string | null>(null);
  const checklistRef = useRef<HTMLDivElement | null>(null);
  const workflowPollerRef = useRef<{ stop: () => void } | null>(null);
  const workflowMeetingRef = useRef<string | null>(null);
  const workflowJobRef = useRef<string | null>(null);
  const initialFetchAttemptedRef = useRef(false);
  const [expandedStage, setExpandedStage] = useState<StagePanel | null>(null);
  const [transcriptDetails, setTranscriptDetails] = useState<any | null>(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [preCallDetails, setPreCallDetails] = useState<any | null>(null);
  const [preCallLoading, setPreCallLoading] = useState(false);
  const [preCallError, setPreCallError] = useState<string | null>(null);
  const [proposalDetails, setProposalDetails] = useState<any | null>(null);
  const [proposalLoading, setProposalLoading] = useState(false);
  const [proposalError, setProposalError] = useState<string | null>(null);
  const [preCallTab, setPreCallTab] = useState('overview');

  const meetingIdentifier = useMemo(
    () => (meeting ? getSharedMeetingIdentifier(meeting) || meeting.id : null),
    [meeting]
  );

  // Inline pre-call state (starts analysis without navigation)
  const [inlinePreCallSessionId, setInlinePreCallSessionId] = useState<string | null>(null);
  const [inlinePreCallStatus, setInlinePreCallStatus] = useState<'idle' | 'running' | 'completed' | 'error'>('idle');
  const [, setInlinePreCallProgress] = useState<{ step?: string; percentage?: number }>({ step: '', percentage: 0 });
  const [, setInlinePreCallError] = useState<string | null>(null);

  const stopWorkflowPolling = useCallback(() => {
    if (workflowPollerRef.current) {
      workflowPollerRef.current.stop();
      workflowPollerRef.current = null;
    }
    workflowMeetingRef.current = null;
    workflowJobRef.current = null;
  }, []);

  const applyWorkflowJobUpdate = useCallback(
    (calendarMeetingId: string, job: WorkflowJobStatus) => {
      const normalized = (job.status || '').toLowerCase();
      const updates: Partial<CalendarMeeting> = {
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

      if (normalized === 'running' || normalized === 'queued') {
        updates.status = 'analyzing';
      } else if (normalized === 'completed') {
        updates.status = 'analyzed';
      } else if (normalized === 'error' || normalized === 'cancelled') {
        updates.status = 'completed';
      }

      updateMeeting(calendarMeetingId, updates);
    },
    [updateMeeting]
  );

  const startWorkflowPolling = useCallback(
    (calendarMeetingId: string, jobId: string) => {
      if (!calendarMeetingId || !jobId) {
        return;
      }

      stopWorkflowPolling();
      workflowMeetingRef.current = calendarMeetingId;
      workflowJobRef.current = jobId;
      workflowPollerRef.current = startWorkflowJobPolling({
        jobId,
        onUpdate: (job) => applyWorkflowJobUpdate(calendarMeetingId, job),
        onComplete: async (job) => {
          applyWorkflowJobUpdate(calendarMeetingId, job);
          stopWorkflowPolling();
          const normalized = (job.status || '').toLowerCase();
          if (normalized === 'completed') {
            await fetchMeetings().catch(() => undefined);
            // Emit sync event so other components refresh
            emitWorkflowUpdated(calendarMeetingId, jobId, 'completed', 'MeetingDetailPage');
          } else if (normalized === 'error') {
            setAnalysisWorkflowError(job.errorMessage || 'Analysis workflow failed.');
            emitWorkflowUpdated(calendarMeetingId, jobId, 'error', 'MeetingDetailPage');
          } else if (normalized === 'cancelled') {
            setAnalysisWorkflowError('Analysis workflow cancelled.');
            emitWorkflowUpdated(calendarMeetingId, jobId, 'cancelled', 'MeetingDetailPage');
          }
        },
      });
    },
    [applyWorkflowJobUpdate, fetchMeetings, setAnalysisWorkflowError, stopWorkflowPolling]
  );

  useEffect(() => {
    if (!meeting && !initialFetchAttemptedRef.current) {
      initialFetchAttemptedRef.current = true;
      fetchMeetings({ force: true }).catch(() => undefined);
    }
  }, [meeting, fetchMeetings]);

  useEffect(() => {
    if (!meeting) {
      return;
    }
    setExpandedStage(null);
    setTranscriptDetails(null);
    setTranscriptError(null);
    setPreCallDetails(null);
    setPreCallError(null);
    setProposalDetails(null);
    setProposalError(null);
  }, [meeting?.id]);

  // Sync inline pre-call state with meeting's analysisSummary on mount/meeting change
  // This picks up pre-call analysis started from other pages (e.g., AnalysisPage)
  useEffect(() => {
    if (!meeting) return;

    const latestPreCall = meeting.analysisSummary?.preCall?.[0];
    if (!latestPreCall) {
      // No pre-call data, reset to idle if we're not already running something locally
      if (inlinePreCallStatus !== 'running' && inlinePreCallStatus !== 'idle') {
        setInlinePreCallStatus('idle');
      }
      return;
    }

    const statusLower = (latestPreCall.status || '').toLowerCase();
    const sessionId = latestPreCall.sessionId;

    // If pre-call is running and we're not tracking it yet, resume polling
    if ((statusLower === 'running' || statusLower === 'pending') && sessionId) {
      if (inlinePreCallSessionId !== sessionId) {
        setInlinePreCallSessionId(sessionId);
        setInlinePreCallStatus('running');
        setInlinePreCallProgress({ step: latestPreCall.currentStep || 'Running...', percentage: 0 });
      }
    }
    // If pre-call is completed and we were tracking it, update state
    else if (statusLower === 'completed') {
      if (inlinePreCallStatus === 'running' && inlinePreCallSessionId === sessionId) {
        setInlinePreCallStatus('completed');
      }
    }
  }, [meeting?.id, meeting?.analysisSummary?.preCall, inlinePreCallSessionId, inlinePreCallStatus]);

  // Check backend API for existing pre-call research on mount
  // This handles cases where the store data might be stale
  useEffect(() => {
    if (!meeting) return;

    const meetingIdentifier = getSharedMeetingIdentifier(meeting) || meeting.id;
    if (!meetingIdentifier) return;

    let cancelled = false;

    const checkExistingPreCallResearch = async () => {
      try {
        const response = await apiGet(`/api/meetings/${meetingIdentifier}/pre-call-research`);

        if (cancelled) return;

        if (response?.success && response?.data) {
          const data = response.data;
          const statusLower = (data.status || '').toLowerCase();

          if (statusLower === 'completed' && data.questionnaire) {
            // Update meeting store with completed status if not already set
            const existingPreCall = meeting.analysisSummary?.preCall || [];
            const alreadyCompleted = existingPreCall.some(
              pc => pc.sessionId === data.session_id && pc.status === 'completed'
            );

            if (!alreadyCompleted) {
              updateMeeting(meeting.id, {
                analysisSummary: {
                  ...meeting.analysisSummary,
                  preCall: [
                    {
                      sessionId: data.session_id,
                      status: 'completed',
                      completedAt: data.completed_at || new Date().toISOString(),
                      startedAt: null,
                      currentStep: null,
                    },
                    ...existingPreCall.filter(pc => pc.sessionId !== data.session_id),
                  ],
                  postCall: meeting.analysisSummary?.postCall || [],
                  proposals: meeting.analysisSummary?.proposals || [],
                },
              });
            }
          } else if (statusLower === 'running' || statusLower === 'pending') {
            // Resume polling for running analysis
            if (data.session_id && inlinePreCallSessionId !== data.session_id) {
              setInlinePreCallSessionId(data.session_id);
              setInlinePreCallStatus('running');
            }
          }
        }
      } catch {
        // No existing research or error - that's fine, just continue
      }
    };

    checkExistingPreCallResearch();

    return () => {
      cancelled = true;
    };
  }, [meeting?.id]); // Only run on mount and meeting change

  useEffect(() => {
    if (!currentMeetingKey || !currentWorkflowJobId) {
      stopWorkflowPolling();
      return;
    }

    const normalized = (currentWorkflowStatus || '').toLowerCase();
    const trackingSameJob =
      workflowMeetingRef.current === currentMeetingKey && workflowJobRef.current === currentWorkflowJobId;

    if ((normalized === 'running' || normalized === 'queued') && !trackingSameJob) {
      startWorkflowPolling(currentMeetingKey, currentWorkflowJobId);
    } else if (normalized === 'completed' || normalized === 'error' || normalized === 'cancelled') {
      stopWorkflowPolling();
    }
  }, [
    currentMeetingKey,
    currentWorkflowJobId,
    currentWorkflowStatus,
    startWorkflowPolling,
    stopWorkflowPolling,
  ]);

  useEffect(() => {
    return () => {
      stopWorkflowPolling();
    };
  }, [stopWorkflowPolling]);

  useEffect(() => {
    if (
      expandedStage !== 'transcript' ||
      !transcriptAnalysisId ||
      transcriptDetails
    ) {
      return;
    }
    let cancelled = false;
    const fetchTranscriptAnalysis = async () => {
      setTranscriptLoading(true);
      setTranscriptError(null);
      try {
        const response = await apiGet(`/api/transcripts/${transcriptAnalysisId}`);
        if (!cancelled) {
          setTranscriptDetails(response?.data || null);
        }
      } catch (error: any) {
        if (!cancelled) {
          setTranscriptError(error?.message || 'Failed to load transcript analysis.');
        }
      } finally {
        if (!cancelled) {
          setTranscriptLoading(false);
        }
      }
    };
    fetchTranscriptAnalysis();
    return () => {
      cancelled = true;
    };
  }, [expandedStage, transcriptAnalysisId, transcriptDetails]);

  useEffect(() => {
    if (!meeting || !meetingIdentifier) return;
    const preCallStatusLower = (meeting.analysisSummary?.preCall?.[0]?.status || '').toLowerCase();
    const preCallCompleteLocal = preCallStatusLower === 'completed';
    if (expandedStage !== 'precall' || !preCallCompleteLocal || preCallDetails) {
      return;
    }
    let cancelled = false;
    const fetchPreCall = async () => {
      setPreCallLoading(true);
      setPreCallError(null);
      try {
        const response = await apiGet(`/api/meetings/${meetingIdentifier}/pre-call-research`);
        if (!cancelled) {
          const payload = response?.data?.data ?? response?.data ?? response;
          setPreCallDetails(payload || null);
        }
      } catch (error: any) {
        if (!cancelled) {
          setPreCallError(error?.message || 'Failed to load pre-call research.');
        }
      } finally {
        if (!cancelled) {
          setPreCallLoading(false);
        }
      }
    };
    fetchPreCall();
    return () => {
      cancelled = true;
    };
  }, [expandedStage, meeting, meetingIdentifier, preCallDetails]);

  useEffect(() => {
    if (
      expandedStage !== 'proposal' ||
      !proposalJobId ||
      proposalDetails
    ) {
      return;
    }
    let cancelled = false;
    const fetchProposalDetails = async () => {
      setProposalLoading(true);
      setProposalError(null);
      try {
        const response = await apiGet(`/api/proposal/jobs/${proposalJobId}`);
        if (!cancelled) {
          setProposalDetails(response?.data || null);
        }
      } catch (error: any) {
        if (!cancelled) {
          setProposalError(error?.message || 'Failed to load proposal output.');
        }
      } finally {
        if (!cancelled) {
          setProposalLoading(false);
        }
      }
    };
    fetchProposalDetails();
    return () => {
      cancelled = true;
    };
  }, [expandedStage, proposalJobId, proposalDetails]);

  // Inline pre-call start function (no navigation)
  const startPreCallInline = useCallback(async (values: PreCallStartValues) => {
    if (!meeting) return;

    // Check if pre-call already completed (prevent duplicates) - first check store
    const latestPreCall = meeting.analysisSummary?.preCall?.[0];
    if (latestPreCall?.status === 'completed') {
      setInlinePreCallError('Pre-call research has already been completed for this meeting. View the results in the Pre-Call Research section below.');
      setInlinePreCallStatus('error');
      return;
    }

    setInlinePreCallStatus('running');
    setInlinePreCallError(null);
    setInlinePreCallProgress({ step: 'Checking for existing research...', percentage: 0 });

    // Also check backend API in case store is stale
    const meetingIdentifier = getSharedMeetingIdentifier(meeting) || meeting.id;
    try {
      const existingResponse = await apiGet(`/api/meetings/${meetingIdentifier}/pre-call-research`);
      if (existingResponse?.success && existingResponse?.data?.status === 'completed' && existingResponse?.data?.questionnaire) {
        // Research already exists - update store and show message
        const data = existingResponse.data;
        const existingPreCallList = meeting.analysisSummary?.preCall || [];
        updateMeeting(meeting.id, {
          analysisSummary: {
            ...meeting.analysisSummary,
            preCall: [
              {
                sessionId: data.session_id,
                status: 'completed',
                completedAt: data.completed_at || new Date().toISOString(),
                startedAt: null,
                currentStep: null,
              },
              ...existingPreCallList.filter(pc => pc.sessionId !== data.session_id),
            ],
            postCall: meeting.analysisSummary?.postCall || [],
            proposals: meeting.analysisSummary?.proposals || [],
          },
        });
        setInlinePreCallStatus('completed');
        return;
      }
    } catch {
      // No existing research, continue with starting new one
    }

    setInlinePreCallProgress({ step: 'Starting research...', percentage: 0 });

    try {
      const response = await axios.post(`${API_BASE_URL}/api/research/start`, {
        companyName: values.companyName,
        purposeOfMeeting: meeting.purpose || '',
        meetingContext: values.meetingContext || '',
        meetingTitle: meeting.title,
        meetingDate: meeting.date,
        meetingTime: meeting.time,
        meetingId: getSharedMeetingIdentifier(meeting) || meeting.id,
        attendees: values.externalAttendees || [],
      });

      const newSessionId =
        response.data?.data?.sessionId ||
        response.data?.data?.session_id ||
        response.data?.sessionId ||
        response.data?.session_id ||
        null;
      setInlinePreCallSessionId(newSessionId);

      // Update the meeting in the store with the new pre-call analysis status
      if (newSessionId) {
        const existingPreCall = meeting.analysisSummary?.preCall || [];
        updateMeeting(meeting.id, {
          analysisSummary: {
            ...meeting.analysisSummary,
            preCall: [
              {
                sessionId: newSessionId,
                status: 'running',
                completedAt: null,
                startedAt: new Date().toISOString(),
                currentStep: 'Initializing...',
              },
              ...existingPreCall.filter(pc => pc.sessionId !== newSessionId),
            ],
            postCall: meeting.analysisSummary?.postCall || [],
            proposals: meeting.analysisSummary?.proposals || [],
          },
        });
      }
    } catch (err: any) {
      if (err?.response?.status === 409) {
        // Resume existing session
        const existingSessionId =
          err.response.data?.data?.sessionId ||
          err.response.data?.data?.session_id ||
          null;
        if (existingSessionId) {
          setInlinePreCallSessionId(existingSessionId);
          setInlinePreCallStatus('running');
          return;
        }
      }
      setInlinePreCallStatus('error');
      const message = err.response?.data?.message || err.response?.data?.detail || err.message || 'Failed to start analysis';
      setInlinePreCallError(message);
    }
  }, [meeting, updateMeeting]);

  // Poll for inline pre-call status
  useEffect(() => {
    if (inlinePreCallStatus !== 'running' || !inlinePreCallSessionId) return;

    let pollInterval: NodeJS.Timeout;
    let retryCount = 0;
    let isCancelled = false;
    const MAX_RETRIES = 5;

    const pollStatus = async () => {
      if (isCancelled) return;

      try {
        const response = await axios.get(`${API_BASE_URL}/api/research/status/${inlinePreCallSessionId}`);
        const statusData = response.data?.data || response.data;

        if (statusData) {
          retryCount = 0;

          if (statusData.progress && typeof statusData.progress === 'object') {
            setInlinePreCallProgress(statusData.progress);
          }

          if (statusData.status === 'completed') {
            setInlinePreCallStatus('completed');
            if (pollInterval) clearInterval(pollInterval);

            // Update the meeting in the store with completed status
            if (meeting) {
              const existingPreCall = meeting.analysisSummary?.preCall || [];
              updateMeeting(meeting.id, {
                analysisSummary: {
                  ...meeting.analysisSummary,
                  preCall: [
                    {
                      sessionId: inlinePreCallSessionId,
                      status: 'completed',
                      completedAt: new Date().toISOString(),
                      startedAt: existingPreCall.find(pc => pc.sessionId === inlinePreCallSessionId)?.startedAt || null,
                      currentStep: null,
                    },
                    ...existingPreCall.filter(pc => pc.sessionId !== inlinePreCallSessionId),
                  ],
                  postCall: meeting.analysisSummary?.postCall || [],
                  proposals: meeting.analysisSummary?.proposals || [],
                },
              });
              // Force refresh meetings to ensure calendar shows updated pre-call status
              fetchMeetings({ force: true }).catch(() => undefined);
            }
          } else if (statusData.status === 'error') {
            setInlinePreCallStatus('error');
            setInlinePreCallError(statusData.error || 'Analysis failed');
            if (pollInterval) clearInterval(pollInterval);
          }
        }
      } catch (err: any) {
        const isNotFoundError = err?.response?.status === 500 ||
                                err?.response?.data?.detail?.includes('not found');

        if (isNotFoundError && retryCount < MAX_RETRIES) {
          retryCount++;
        } else if (retryCount >= MAX_RETRIES) {
          setInlinePreCallStatus('error');
          setInlinePreCallError('Analysis initialization timed out. Please try again.');
          if (pollInterval) clearInterval(pollInterval);
        }
      }
    };

    // Initial delay before first poll
    const initialDelayTimeout = setTimeout(() => {
      if (isCancelled) return;
      pollStatus();
      pollInterval = setInterval(pollStatus, 2000);
    }, 1500);

    return () => {
      isCancelled = true;
      clearTimeout(initialDelayTimeout);
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [inlinePreCallStatus, inlinePreCallSessionId, meeting, updateMeeting, fetchMeetings]);

  // Build contextual breadcrumb items (must be before early return)
  const breadcrumbItems = useMemo(() => {
    if (!meeting) return [{ label: 'Calendar', path: '/app/calendar' }];

    const items: Array<{ label: string; path: string }> = [
      { label: 'Calendar', path: '/app/calendar' },
    ];

    // If meeting has an account, add account breadcrumb
    if (meeting.accountId && meeting.accountName) {
      items.push({
        label: meeting.accountName,
        path: `/app/accounts/${meeting.accountId}`,
      });
    }

    // If meeting has a linked deal, add deal breadcrumb
    const dealId = meeting.deal?.deal_id || meeting.deal_id;
    const dealName = meeting.deal?.opportunity_name || 'Linked Deal';
    if (dealId) {
      items.push({
        label: dealName,
        path: `/app/deals/${dealId}`,
      });
    }

    return items;
  }, [meeting]);

  if (!meeting) {
    const shouldShowLoader = meetingLookupLoading || (Boolean(meetingId) && !meetingLookupFailed);
    return (
      <Box sx={{ p: 4 }}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate(-1)} sx={{ mb: 2 }}>
          Back to Calendar
        </Button>
        {shouldShowLoader ? (
          <Stack direction="row" spacing={1} alignItems="center">
            <CircularProgress size={18} />
            <Typography variant="body2">Loading meeting details…</Typography>
          </Stack>
        ) : (
          <Alert severity="warning">
            {meetingLookupFailed
              ? 'Meeting not found in the database.'
              : 'Meeting not found.'}
          </Alert>
        )}
      </Box>
    );
  }

  const pastMeeting = isPastMeeting(meeting);
  const latestPreCallSummary = meeting.analysisSummary?.preCall?.[0] || null;
  const preCallStatusLower = (latestPreCallSummary?.status || '').toLowerCase();
  const preCallRunning = preCallStatusLower === 'running' || preCallStatusLower === 'pending';
  const preCallComplete = preCallStatusLower === 'completed';
  const workflowChip = getWorkflowChipProps(meeting);
  const workflowStatus = workflowChip.status;
  const isWorkflowJobActive = (value?: string | null) =>
    ['queued', 'running', 'pending', 'in_progress', 'processing', 'analyzing'].includes((value || '').toLowerCase());
  const workflowJobActive = Boolean(
    meeting.analysisJob &&
      (isWorkflowJobActive(meeting.analysisJob.status) ||
        isWorkflowJobActive(meeting.analysisJob.transcriptStatus) ||
        isWorkflowJobActive(meeting.analysisJob.proposalStatus) ||
        isWorkflowJobActive(meeting.analysisJob.pptStatus))
  );
  const analysisInProgress =
    preCallRunning ||
    workflowJobActive ||
    workflowStatus === 'queued' ||
    workflowStatus === 'running' ||
    meeting.status === 'analyzing';
  const stageStatuses = {
    transcript: getStageStatus(meeting, 'transcript'),
    proposal: getStageStatus(meeting, 'proposal'),
    ppt: getStageStatus(meeting, 'ppt'),
  };
  const transcriptStageComplete = stageStatuses.transcript === 'completed';
  const proposalStageComplete = stageStatuses.proposal === 'completed';
  const pptStageComplete = stageStatuses.ppt === 'completed';
  const allWorkflowStagesComplete =
    transcriptStageComplete && proposalStageComplete && pptStageComplete;
  const onlyTranscriptDone =
    transcriptStageComplete && !proposalStageComplete && !pptStageComplete;
  const stageAvailability = {
    transcript: !transcriptStageComplete,
    proposal: !proposalStageComplete,
    ppt: !pptStageComplete,
  };
  const stageInitialSelection = !transcriptStageComplete
    ? { transcript: true }
    : !proposalStageComplete
    ? { proposal: true }
    : !pptStageComplete
    ? { ppt: true }
    : {};
  const preCallMissing = pastMeeting && !preCallComplete && !preCallRunning;
  const hasAssociation = Boolean(meeting.accountId || meeting.accountName || meeting.deal_id || meeting.deal);
  const handleStagePanelToggle = (stage: StagePanel) => {
    setExpandedStage((prev) => (prev === stage ? null : stage));
  };
  const downloadTextFile = (filename: string, content: string) => {
    const blob = new Blob([content || ''], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const renderPreCallPanel = () => {
    const preCallSummary = meeting.analysisSummary?.preCall?.[0] || null;
    if (!preCallSummary) {
      return <Alert severity="info">No pre-call research has been run for this meeting yet.</Alert>;
    }
    if ((preCallSummary.status || '').toLowerCase() !== 'completed') {
      return (
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={1} alignItems="center">
            <CircularProgress size={18} />
            <Typography variant="body2">Pre-call analysis is still running…</Typography>
          </Stack>
          {preCallSummary.sessionId ? (
            <CancelAnalysisFlowButton
              preCallSessionId={preCallSummary.sessionId}
              workflowJobId={meeting.analysisJob?.jobId || null}
              meetingId={meeting.id}
              size="small"
              onCancelled={() => fetchMeetings()}
            />
          ) : null}
        </Stack>
      );
    }

    if (preCallLoading) {
      return (
        <Stack direction="row" spacing={1} alignItems="center">
          <CircularProgress size={18} />
          <Typography variant="body2">Loading pre-call research…</Typography>
        </Stack>
      );
    }
    if (preCallError) {
      return <Alert severity="error">{preCallError}</Alert>;
    }

    const resolvedCompany = derivePreCallCompany();
    const questionnaire = preCallDetails?.questionnaire;
    const questions = questionnaire?.questions || [];
    const companyOverview = preCallDetails?.company_overview;
    const attendeeResearch = preCallDetails?.external_attendees_research || [];
    const internalKbPreCall = preCallDetails?.internal_kb_pre_call;
    const tabs: Array<{ key: string; label: string }> = [
      { key: 'overview', label: 'Overview' },
      { key: 'attendees', label: 'Attendees' },
      { key: 'internal-kb', label: 'Sales Intelligence' },
      { key: 'questionnaire', label: 'Questionnaire' },
    ];

    const renderMarkdown = (value: any) => {
      if (!value) return null;
      if (typeof value === 'string') return <ReactMarkdown>{value}</ReactMarkdown>;
      try {
        return <ReactMarkdown>{JSON.stringify(value, null, 2)}</ReactMarkdown>;
      } catch {
        return <ReactMarkdown>{String(value)}</ReactMarkdown>;
      }
    };

    const extractResearchText = (value: any): string => {
      if (!value) return '';
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return '';
        // If backend accidentally returns JSON as string, try to extract the nested `research` field.
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
          try {
            const parsed = JSON.parse(trimmed);
            if (parsed && typeof parsed === 'object' && typeof parsed.research === 'string') {
              return parsed.research;
            }
          } catch {
            // fall back to raw string
          }
        }
        return trimmed;
      }
      if (typeof value === 'object' && typeof value.research === 'string') {
        return value.research;
      }
      return '';
    };

    const overviewText =
      typeof companyOverview === 'object'
        ? companyOverview?.summary ||
          companyOverview?.executive_summary ||
          companyOverview?.executiveSummary ||
          JSON.stringify(companyOverview, null, 2)
        : companyOverview;

    const internalKbPastEngagements =
      typeof internalKbPreCall === 'object' && internalKbPreCall
        ? internalKbPreCall?.pastEngagements || internalKbPreCall?.past_engagements || ''
        : typeof internalKbPreCall === 'string'
          ? internalKbPreCall
          : '';

    const internalKbSimilarEngagementsSource =
      typeof internalKbPreCall === 'object' && internalKbPreCall
        ? internalKbPreCall?.similarEngagements || internalKbPreCall?.similar_engagements || []
        : [];

    const internalKbSimilarEngagements = Array.isArray(internalKbSimilarEngagementsSource)
      ? internalKbSimilarEngagementsSource
      : typeof internalKbSimilarEngagementsSource === 'object' && internalKbSimilarEngagementsSource !== null
        ? Object.values(internalKbSimilarEngagementsSource)
        : [];

    const internalKbRelevantArtifacts: Array<{ title: string; url?: string; why_relevant?: string; excerpt?: string }> =
      typeof internalKbPreCall === 'object' && internalKbPreCall && Array.isArray(internalKbPreCall?.relevantArtifacts)
        ? internalKbPreCall.relevantArtifacts
        : [];


    return (
      <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Pre-call Brief for {resolvedCompany}
        </Typography>
        <Tabs
          value={preCallTab}
          onChange={(_, val) => setPreCallTab(val)}
          textColor="primary"
          indicatorColor="primary"
          sx={{ mb: 2 }}
        >
          {tabs.map((tab) => (
            <Tab key={tab.key} value={tab.key} label={tab.label} />
          ))}
        </Tabs>

        {preCallTab === 'overview' && (
          <Stack spacing={2.5}>
            {renderMarkdown(overviewText) && (
              <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                  Executive Summary
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ '& p': { m: 0 } }}>
                  {renderMarkdown(overviewText)}
                </Typography>
              </Paper>
            )}
          </Stack>
        )}

        {preCallTab === 'attendees' && (
          <>
            {Array.isArray(attendeeResearch) && attendeeResearch.length > 0 ? (
              <Paper variant="outlined" sx={{ borderRadius: 2, overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Company</TableCell>
                      <TableCell>Research</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {attendeeResearch.map((item: any, idx: number) => (
                      <TableRow key={item.id || item.email || idx}>
                        <TableCell>{item.name || item.email || 'Attendee'}</TableCell>
                        <TableCell>{item.email || '—'}</TableCell>
                        <TableCell>{item.company || '—'}</TableCell>
                        <TableCell
                          sx={{
                            '& p': { m: 0, lineHeight: 1.35 },
                            '& ul, & ol': { mt: 0.5, mb: 0.5, pl: 2.25 },
                            '& li': { mb: 0.25, lineHeight: 1.35 },
                            '& li > p': { display: 'inline' },
                            '& h1, & h2, & h3, & h4, & h5, & h6': { my: 0.75, lineHeight: 1.25 },
                          }}
                        >
                          {renderMarkdown(extractResearchText(item.research)) || '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Paper>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No attendee research available.
              </Typography>
            )}
          </>
        )}

        {preCallTab === 'internal-kb' && (
          <>
            {internalKbPastEngagements || internalKbSimilarEngagements.length > 0 || internalKbRelevantArtifacts.length > 0 ? (
              <Stack spacing={2.5}>
                {internalKbPastEngagements && (
                  <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                      Past Engagements
                    </Typography>
                    <Box sx={{ color: 'text.secondary', '& p': { m: 0 } }}>
                      {renderMarkdown(internalKbPastEngagements)}
                    </Box>
                  </Paper>
                )}

                {internalKbSimilarEngagements.length > 0 && (
                  <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                      Similar Engagements
                    </Typography>
                    <Stack spacing={1}>
                      {internalKbSimilarEngagements.map((item: any, idx: number) => {
                        const title = item?.title || item?.name || 'Engagement';
                        const url = item?.url || item?.webUrl || item?.link;
                        const whyRelevant = item?.why_relevant || item?.whyRelevant || '';

                        return (
                          <Box key={`${title}-${idx}`}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {url ? (
                                <Link href={url} target="_blank" rel="noreferrer">
                                  {title}
                                </Link>
                              ) : (
                                title
                              )}
                            </Typography>
                            {whyRelevant && (
                              <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
                                {whyRelevant}
                              </Typography>
                            )}
                          </Box>
                        );
                      })}
                    </Stack>
                  </Paper>
                )}

                {internalKbRelevantArtifacts.length > 0 && (
                  <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                      Relevant Internal Documents
                    </Typography>
                    <Stack spacing={1.5}>
                      {internalKbRelevantArtifacts.map((artifact, idx) => (
                        <Box key={`${artifact.title}-${idx}`}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {artifact.url ? (
                              <Link href={artifact.url} target="_blank" rel="noreferrer">
                                {artifact.title}
                              </Link>
                            ) : (
                              artifact.title
                            )}
                          </Typography>
                          {artifact.why_relevant && (
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                              {artifact.why_relevant}
                            </Typography>
                          )}
                          {artifact.excerpt && (
                            <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>
                              "{artifact.excerpt}"
                            </Typography>
                          )}
                        </Box>
                      ))}
                    </Stack>
                  </Paper>
                )}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No Sales Intelligence insights available.
              </Typography>
            )}
          </>
        )}

        {preCallTab === 'questionnaire' && (
          <>
            {questions.length > 0 ? (
              <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                <AIQuestionnaire
                  companyName={resolvedCompany}
                  researchSummary=""
                  keyInsights={[]}
                  attendeeInfo={[]}
                  enterpriseRecommendations={[]}
                  recommendedProducts={[]}
                  preGeneratedQuestions={questionnaire}
                />
              </Paper>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Pre-call analysis completed. Questions will appear here when available.
              </Typography>
            )}
          </>
        )}
      </Paper>
    );
  };
  const renderTranscriptPanel = () => {
    if (!transcriptAnalysisId) {
      return <Alert severity="info">No transcript analysis is available for this meeting yet.</Alert>;
    }
    if (transcriptLoading) {
      return (
        <Stack direction="row" spacing={1} alignItems="center">
          <CircularProgress size={18} />
          <Typography variant="body2">Loading transcript analysis…</Typography>
        </Stack>
      );
    }
    if (transcriptError) {
      return (
        <Alert severity="error">
          {transcriptError}
        </Alert>
      );
    }
    if (!transcriptDetails) {
      return null;
    }
    return (
      <>
        <TranscriptAnalysisInsight analysisData={transcriptDetails} />
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            startIcon={<EmailIcon />}
            onClick={() => setFollowUpEmailDialogOpen(true)}
            sx={{
              textTransform: 'none',
              bgcolor: 'success.main',
              '&:hover': { bgcolor: 'success.main' },
              borderRadius: 2,
            }}
          >
            Generate Follow-Up Email
          </Button>
        </Box>
        <Box sx={{ mt: 4 }}>
          <FeedbackWidget 
            category="transcript_analysis" 
            referenceId={transcriptAnalysisId} 
          />
        </Box>
      </>
    );
  };
  const renderProposalPanel = () => {
    if (!proposalJobId) {
      return <Alert severity="info">No proposal has been generated for this meeting yet.</Alert>;
    }
    if (proposalLoading) {
      return (
        <Stack direction="row" spacing={1} alignItems="center">
          <CircularProgress size={18} />
          <Typography variant="body2">Loading proposal output…</Typography>
        </Stack>
      );
    }
    if (proposalError) {
      return <Alert severity="error">{proposalError}</Alert>;
    }
    if (!proposalDetails?.proposalData) {
      return <Alert severity="info">Proposal data is not available.</Alert>;
    }
    const proposalData = proposalDetails.proposalData;
    const proposalText = proposalData.proposal || '';
    const outline = proposalData.outline || '';
    const review = proposalData.review || '';
    const clientContext = proposalData.clientContext || null;
    const handleDownload = () => {
      downloadTextFile(`${meeting.title || 'proposal'}.txt`, proposalText || 'Proposal content not available.');
    };

    return (
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', md: 'center' }} sx={{ mb: 2 }}>
          <Box>
            <Typography variant="h6">Proposal Output</Typography>
            <Typography variant="body2" color="text.secondary">
              Generated {proposalDetails.completedAt ? new Date(proposalDetails.completedAt).toLocaleString() : 'recently'}
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<CloudDownload />}
            onClick={handleDownload}
            disabled={!proposalText}
          >
            Download Proposal
          </Button>
        </Stack>
        {proposalText && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              Executive Summary
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
              {proposalText}
            </Typography>
          </Box>
        )}
        {outline && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              Outline
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
              {outline}
            </Typography>
          </Box>
        )}
        {review && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              Reviewer Notes
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
              {review}
            </Typography>
          </Box>
        )}
        {clientContext && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              Client Context
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
              {JSON.stringify(clientContext, null, 2)}
            </Typography>
          </Box>
        )}
        <Box sx={{ mt: 4 }}>
          <FeedbackWidget 
            category="proposal_generation" 
            referenceId={proposalJobId} 
          />
        </Box>
      </Paper>
    );
  };
  const renderPptPanel = () => {
    const pptInfo = meeting.analysisJob;
    if (!pptInfo || pptInfo.pptStatus !== 'completed') {
      return <Alert severity="info">Presentation deck has not been generated for this meeting.</Alert>;
    }
    return (
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between">
          <Box>
            <Typography variant="h6">Executive Deck</Typography>
            <Typography variant="body2" color="text.secondary">
              {pptInfo.pptFileName || 'Presentation.pptx'} · {pptInfo.pptSlideCount || 0} slides
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<CloudDownload />}
            onClick={() => {
              if (pptInfo.pptDownloadUrl) {
                window.open(pptInfo.pptDownloadUrl, '_blank', 'noopener,noreferrer');
              }
            }}
            disabled={!pptInfo.pptDownloadUrl}
          >
            Download Deck
          </Button>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Deck generated via the workflow can be shared directly with the client team. Slide counts and metadata are
          logged with this meeting for future reference.
        </Typography>
        <Box sx={{ mt: 4 }}>
          <FeedbackWidget 
            category="ppt_generation" 
            referenceId={pptInfo.pptJobId || pptInfo.pptFileName || 'ppt_generation'} 
          />
        </Box>
      </Paper>
    );
  };

  type TimelineStage = {
    id: string;
    title: string;
    description: string;
    chip: { label: string; color: ChipColor };
    helper: string;
    actionLabel?: string;
    onAction?: () => void;
    actionDisabled?: boolean;
  };

  type StagePanel = 'precall' | 'transcript' | 'proposal' | 'ppt';
  const sanitizeName = (value?: string | null) => {
    if (!value) return '';
    const trimmed = value.toString().trim();
    if (!trimmed) return '';
    if (trimmed.toLowerCase() === 'unknown') return '';
    return trimmed;
  };
  const derivePreCallCompany = () => {
    // Priority: accountName > deal company > pre-call details > meeting.company (which may default to Northstar Integrators)
    const candidateOrder = [
      sanitizeName(meeting.accountName),
      sanitizeName(meeting.deal?.company_name),
      sanitizeName(preCallDetails?.company_name),
      // Only use meeting.company if it's not a fallback value like "Northstar Integrators" or "Unknown"
      sanitizeName(meeting.company)?.toLowerCase() !== 'enterprise' ? sanitizeName(meeting.company) : '',
    ].filter(Boolean);
    if (candidateOrder.length > 0) return candidateOrder[0];

    // Try to extract from meeting title
    const title = meeting.title || '';
    const titlePatterns = [
      /^([^/]+)\/(?:Northstar Integrators|Northstar library)/i,
      /^([^-]+)\s*-\s*(?:Northstar Integrators|Northstar library)/i,
      /^(?:Meeting with\s+)?([A-Z][a-zA-Z0-9\s&.]+?)(?:\s*[-/]|\s+meeting)/i,
    ];
    for (const pattern of titlePatterns) {
      const match = title.match(pattern);
      if (match?.[1]) {
        const extracted = sanitizeName(match[1]);
        if (extracted) return extracted;
      }
    }

    // Fallback: derive from external attendee email domain
    const externalAttendees = meeting.externalAttendees || [];
    if (externalAttendees.length > 0) {
      const firstExternal = externalAttendees[0];
      if (firstExternal.email) {
        const domain = firstExternal.email.split('@')[1];
        if (domain && !domain.includes('gmail') && !domain.includes('outlook') && !domain.includes('yahoo')) {
          const domainName = domain.split('.')[0];
          const derived = domainName.charAt(0).toUpperCase() + domainName.slice(1);
          return derived;
        }
      }
    }

    return 'Pre-call analysis';
  };

  const timelineStages: TimelineStage[] = [
    {
      id: 'precall',
      title: 'Pre-call Analysis',
      description: 'Research & preparation',
      chip: preCallRunning
        ? {
            label: 'Running',
            color: 'info',
          }
        : preCallComplete
        ? {
            label: 'Completed',
            color: 'success',
          }
        : preCallMissing
        ? {
            label: 'Missed',
            color: 'warning',
          }
        : {
            label: 'Pending',
            color: 'default',
          },
      helper: preCallRunning
        ? 'Pre-call analysis is running'
        : preCallMissing
        ? 'Meeting was completed without a pre-call brief.'
        : preCallComplete
        ? 'Discovery questionnaire shown below'
        : 'Run before the meeting',
      actionLabel: preCallMissing
        ? 'Unavailable'
        : preCallRunning
        ? 'Running...'
        : preCallComplete
        ? undefined // No button needed - questionnaire shown inline below
        : 'Start Pre-call',
      onAction: preCallRunning || preCallMissing || preCallComplete
        ? undefined
        : () => setPreCallDialogOpen(true),
      actionDisabled: preCallMissing || preCallRunning || analysisInProgress || preCallComplete,
    },
    {
      id: 'transcript',
      title: 'Transcript Analysis',
      description: 'Post-call transcript insights',
      chip: getStageChipProps(stageStatuses.transcript),
      helper: getStageHelperText(stageStatuses.transcript),
    },
    {
      id: 'proposal',
      title: 'Generate Solution Proposal',
      description: 'Generate a tailored, client-ready proposal draft',
      chip: getStageChipProps(stageStatuses.proposal),
      helper: getStageHelperText(stageStatuses.proposal),
    },
    {
      id: 'ppt',
      title: 'Generate Presentation Deck',
      description: 'Create an executive-ready deck from the solution proposal',
      chip: getStageChipProps(stageStatuses.ppt),
      helper: getStageHelperText(stageStatuses.ppt),
    },
  ];

  const runAnalysisWorkflow = async ({
    stages,
    transcriptText,
    associationOverride,
  }: {
    stages: AnalysisStageSelection;
    transcriptText?: string;
    associationOverride?: { accountId: string | null; dealId: string | null };
  }) => {
    if (analysisInProgress) {
      setAnalysisWorkflowError('Analysis is already running. Please wait for it to finish.');
      setAnalysisWorkflowSuccess(null);
      return;
    }
    setAnalysisWorkflowLoading(true);
    setAnalysisWorkflowError(null);
    setAnalysisWorkflowSuccess(null);

    try {
      let transcriptPayload = transcriptText?.trim();
      if (stages.transcript && !transcriptPayload) {
        const transcriptIdentifier = getTranscriptLookupIdentifier(meeting);
        if (meeting.transcriptAvailable && transcriptIdentifier) {
          transcriptPayload = await fetchTranscriptFromTeams(meeting);
        }
      }

      if (stages.transcript && !transcriptPayload) {
        throw new Error('Transcript text is required to run transcript analysis.');
      }

      const sharedMeetingIdentifier = getSharedMeetingIdentifier(meeting);
      if (!sharedMeetingIdentifier) {
        throw new Error('Unable to determine meeting identifier.');
      }
      const calendarEventIdentifier = getCalendarEventIdentifier(meeting);

      const payload: Record<string, any> = {
        meetingId: sharedMeetingIdentifier,
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
      const resolvedDealId =
        associationOverride?.dealId || meeting.deal_id || (meeting.deal as any)?.deal_id || null;
      const resolvedAccountId =
        associationOverride?.accountId ?? meeting.accountId ?? null;
      if (resolvedDealId) {
        payload.dealId = resolvedDealId;
      }
      if (resolvedAccountId) {
        payload.accountId = resolvedAccountId;
      }

      const response = await apiPost('/api/analysis-workflow/run', payload);
      if (!response?.success) {
        throw new Error(response?.error || 'Failed to start analysis workflow.');
      }

      const jobId = response?.data?.jobId;
      if (jobId) {
        const nowIso = new Date().toISOString();
        localStorage.setItem(
          'ongoingWorkflowAnalysis',
          JSON.stringify({
            jobId,
            meetingId: meeting.id,
            meetingTitle: meeting.title || meeting.company || 'Meeting',
            status: response?.data?.status || 'queued',
            stages: {
              transcript: stages.transcript,
              proposal: stages.proposal,
              ppt: stages.ppt,
            },
            updatedAt: Date.now(),
          })
        );
        updateMeeting(meeting.id, {
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
        startWorkflowPolling(meeting.id, jobId);
      }

      await fetchMeetings();
      setAnalysisWorkflowSuccess('Analysis workflow queued. Refresh to see updates.');
    } catch (pipelineError: any) {
      const message =
        pipelineError?.response?.data?.error ||
        pipelineError?.message ||
        'Failed to start analysis workflow.';
      setAnalysisWorkflowError(message);
    } finally {
      setAnalysisWorkflowLoading(false);
    }
  };

  const handleRunAnalysisRequest = ({
    stages,
    transcriptText,
  }: {
    stages: AnalysisStageSelection;
    transcriptText?: string;
  }) => {
    if (!hasAssociation) {
      setPendingRunRequest({ stages, transcriptText });
      setAssociationDialogOpen(true);
      return;
    }
    runAnalysisWorkflow({ stages, transcriptText });
  };

  const handleAssociationConfirmed = async ({
    accountId: selectedAccountId,
    accountName: selectedAccountName,
    dealId: selectedDealId,
    dealName: selectedDealName,
  }: {
    accountId: string | null;
    accountName?: string | null;
    dealId: string | null;
    dealName?: string | null;
  }) => {
    if (!meeting) return;

    if (!meeting.id) {
      setAssociationError('Unable to determine meeting identifier for linking.');
      return;
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

    try {
      setAssociationError(null);
      const response = await apiPatch(`/api/meetings/${meeting.id}`, {
        accountId: selectedAccountId,
        dealId: selectedDealId,
        meetingSnapshot,
      });

      if (!response?.success) {
        throw new Error(response?.error || 'Failed to update meeting link.');
      }

      setAssociationDialogOpen(false);

      updateMeeting(meeting.id, {
        accountId: selectedAccountId || null,
        accountName: selectedAccountName || null,
        deal_id: selectedDealId || undefined,
        deal: selectedDealId
          ? {
              deal_id: selectedDealId,
              opportunity_name: selectedDealName || 'Linked Deal',
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

      // Emit sync events so other components refresh
      if (selectedDealId) {
        emitDealLinked(meeting.id, selectedDealId, 'MeetingDetailPage');
      }
      emitMeetingUpdated(meeting.id, 'MeetingDetailPage');

      if (pendingRunRequest) {
        runAnalysisWorkflow({
          stages: pendingRunRequest.stages,
          transcriptText: pendingRunRequest.transcriptText,
          associationOverride: {
            accountId: selectedAccountId,
            dealId: selectedDealId,
          },
        });
        setPendingRunRequest(null);
      }
    } catch (error: any) {
      const message = error?.message || 'Failed to link meeting.';
      setAssociationError(message);
    }
  };

  const attendeeSections = [
    { title: 'Internal Attendees', attendees: meeting.internalAttendees || [] },
    { title: 'External Attendees', attendees: meeting.externalAttendees || [] },
  ];
  const handleNavigateToDeal = () => {
    if (!meeting || !linkedDealId) return;
    navigate(`/app/deals/${linkedDealId}`, { state: { meetingId: meeting.id } });
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Fade in timeout={400}>
        <Box>
          <PageBreadcrumbs
            items={breadcrumbItems}
            currentPage={meeting.title || 'Meeting Details'}
          />

          {/* Hero Header */}
          <Paper
            elevation={0}
            sx={{
              p: 4,
              mb: 3,
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
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
              <Stack direction="row" spacing={3} alignItems="flex-start">
                <Box
                  sx={{
                    width: 64,
                    height: 64,
                    borderRadius: 3,
                    bgcolor: alpha('#fff', 0.15),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Event sx={{ fontSize: 32, color: 'white' }} />
                </Box>
                <Box>
                  <Typography variant="h4" sx={{ color: 'white', fontWeight: 700, mb: 0.5 }}>
                    {meeting.title}
                  </Typography>
                  <Typography variant="body1" sx={{ color: alpha('#fff', 0.85), mb: 1.5 }}>
                    {meeting.accountName || meeting.deal?.company_name || meeting.company}
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Chip
                      label={pastMeeting ? 'Past meeting' : 'Upcoming meeting'}
                      size="small"
                      sx={{
                        bgcolor: alpha('#fff', 0.15),
                        color: 'white',
                        fontWeight: 600,
                      }}
                    />
                    <Chip
                      label={meeting.transcriptAvailable ? 'Transcript available' : 'Transcript missing'}
                      size="small"
                      sx={{
                        bgcolor: meeting.transcriptAvailable ? alpha(COLORS.success, 0.2) : alpha('#fff', 0.1),
                        color: 'white',
                        fontWeight: 600,
                      }}
                    />
                    {workflowChip.status !== 'idle' && (
                      <Chip
                        label={`Analysis: ${workflowChip.label}`}
                        size="small"
                        sx={{
                          bgcolor: workflowChip.status === 'completed' || workflowChip.status === 'partial'
                            ? '#CDDE33'
                            : alpha('#fff', 0.15),
                          color: workflowChip.status === 'completed' || workflowChip.status === 'partial'
                            ? '#002348'
                            : 'white',
                          fontWeight: 600,
                        }}
                      />
                    )}
                    {preCallComplete && (
                      <Chip
                        icon={<PreCallIcon sx={{ fontSize: 14, color: 'white' }} />}
                        label="Pre-call Ready"
                        size="small"
                        sx={{
                          bgcolor: alpha('#fff', 0.15),
                          color: 'white',
                          fontWeight: 600,
                          '& .MuiChip-icon': { color: 'white' },
                        }}
                      />
                    )}
                  </Stack>
                </Box>
              </Stack>
              <Box textAlign={{ xs: 'left', md: 'right' }} sx={{ color: 'white' }}>
                <Typography variant="body2" sx={{ color: alpha('#fff', 0.7) }}>
                  When
                </Typography>
                <Typography variant="h6" sx={{ color: 'white', fontWeight: 600 }}>
                  {localDateLabel} at {localTimeLabel} {localTimeZoneLabel}
                </Typography>
                <Typography variant="body2" sx={{ color: alpha('#fff', 0.7), mt: 1 }}>
                  Meeting timezone: {organizerDateLabel} · {organizerTimeLabel} {organizerTimeZoneLabel}
                </Typography>
                <Typography variant="body2" sx={{ color: alpha('#fff', 0.7) }}>
                  Duration: {meeting.duration} min
                </Typography>
              </Box>
            </Stack>
          </Paper>

      <Stack spacing={3}>

        <Paper sx={{ p: 3 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} alignItems={{ xs: 'flex-start', md: 'center' }}>
            <Box>
              <Typography variant="h6">Deal Association</Typography>
              {linkedDealId ? (
                <>
                  <Typography variant="subtitle1" sx={{ mt: 1 }}>
                    {linkedDealName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {(linkedDealCompany ? `${linkedDealCompany} · ` : '') + (linkedDealStage ? `Stage: ${linkedDealStage}` : 'Stage unavailable')}
                  </Typography>
                  {typeof linkedDealProgress === 'number' && (
                    <Typography variant="body2" color="text.secondary">
                      Progress: {linkedDealProgress}%
                    </Typography>
                  )}
                </>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  This meeting is not currently linked to any deal.
                </Typography>
              )}
            </Box>
            {linkedDealId && (
              <Button variant="contained" onClick={handleNavigateToDeal}>
                Open Deal
              </Button>
            )}
          </Stack>
        </Paper>
        {associationError && (
          <Alert severity="error">
            {associationError}
          </Alert>
        )}

        {locationPermission === 'prompt' && (
          <Alert severity="info">
            Detecting your location so we can show a reference in your local timezone…
          </Alert>
        )}
        {locationPermission === 'denied' && (
          <Alert
            severity="warning"
            action={
              <Button color="inherit" size="small" onClick={refreshFromLocation}>
                Retry
              </Button>
            }
          >
            We could not access your location. Meeting times below use the meeting&apos;s timezone—allow location if you
            want to see the local equivalent.
          </Alert>
        )}



        {/* Quick Prep Card - always visible summary */}
        <QuickPrepCard
          meetingId={meetingIdentifier || meeting.id}
          companyName={derivePreCallCompany()}
          dealStage={linkedDealStage}
          attendees={meeting.externalAttendees || []}
          preCallComplete={preCallComplete}
          preCallRunning={preCallRunning}
          onStartPreCall={() => setPreCallDialogOpen(true)}
          onViewFullAnalysis={() => setExpandedStage('precall')}
        />

        {/* Atlassian Migration Assessment Quick Card */}
        {derivePreCallCompany() && (
          <AtlassianQuickAssessment
            companyName={derivePreCallCompany()}
            meetingId={meetingIdentifier || meeting.id}
          />
        )}

        {/* Atlassian Sales Playbook - Decision Flow Wizard */}
        {derivePreCallCompany() && (
          <MeetingPlaybookPanel
            meetingId={meetingIdentifier || meeting.id}
            companyName={derivePreCallCompany()}
            dealId={linkedDealId || undefined}
          />
        )}

        {/* Smart Next Step Recommendation */}
        <NextStepRecommendation
          meeting={meeting}
          isPastMeeting={pastMeeting}
          hasAssociation={hasAssociation}
          preCallComplete={preCallComplete}
          preCallRunning={preCallRunning}
          transcriptComplete={transcriptStageComplete}
          proposalComplete={proposalStageComplete}
          pptComplete={pptStageComplete}
          analysisInProgress={analysisInProgress || preCallRunning}
          transcriptAvailable={meeting.transcriptAvailable || false}
          cancelAction={
            analysisInProgress || preCallRunning ? (
              <CancelAnalysisFlowButton
                preCallSessionId={latestPreCallSummary?.sessionId || null}
                workflowJobId={meeting.analysisJob?.jobId || null}
                meetingId={meeting.id}
                size="small"
                onCancelled={() => fetchMeetings()}
              />
            ) : null
          }
          onStartPreCall={() => {
            setPreCallDialogOpen(true);
          }}
          onLinkDeal={() => setAssociationDialogOpen(true)}
          onRunTranscript={() => {
            if (checklistRef.current) {
              checklistRef.current.scrollIntoView({ behavior: 'smooth' });
            }
          }}
          onRunProposal={() => {
            if (checklistRef.current) {
              checklistRef.current.scrollIntoView({ behavior: 'smooth' });
            }
          }}
          onRunPpt={() => {
            if (checklistRef.current) {
              checklistRef.current.scrollIntoView({ behavior: 'smooth' });
            }
          }}
          onViewPreCall={() => runPreCallAnalysis(meeting, navigate)}
        />

        {analysisInProgress && !preCallRunning && (
          <MeetingFlowProgressBar
            meeting={meeting}
            onCancelled={() => fetchMeetings({ force: true }).catch(() => undefined)}
          />
        )}

        {/* Pre-Call - Only show while running (hide idle start button on this page) */}
        {preCallRunning && (
          <Box data-precall-section>
            <InlinePreCallAnalysis
              meeting={meeting}
              onAnalysisComplete={() => {
                // Refresh meeting data if needed
                fetchMeetings({ force: true }).catch(() => undefined);
              }}
            />
          </Box>
        )}

        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Analysis Status
          </Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            {timelineStages.map((stage) => {
              const isPanelStage =
                stage.id === 'precall' || stage.id === 'transcript' || stage.id === 'proposal' || stage.id === 'ppt';
              const stageCompleted =
                stage.id === 'precall'
                  ? preCallComplete
                  : stage.id === 'transcript'
                  ? transcriptStageComplete
                  : stage.id === 'proposal'
                  ? proposalStageComplete
                  : stage.id === 'ppt'
                  ? pptStageComplete
                  : false;
              const canViewPanel = isPanelStage && stageCompleted;
              const isExpanded = expandedStage === stage.id;

              return (
                <Box
                  key={stage.id}
                  onClick={canViewPanel ? () => handleStagePanelToggle(stage.id as StagePanel) : undefined}
                  sx={{
                    flex: 1,
                    border: 1,
                    borderColor: isExpanded
                      ? 'primary.main'
                      : stage.chip.color === 'success'
                      ? 'success.light'
                      : 'divider',
                    borderRadius: 2,
                    p: 2,
                    cursor: canViewPanel ? 'pointer' : 'default',
                    boxShadow: isExpanded ? '0 0 0 2px rgba(37, 99, 235, 0.15)' : 'none',
                    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                    {stage.chip.color === 'success' ? (
                      <CheckCircle color="success" fontSize="small" />
                    ) : (
                      <Pending color="disabled" fontSize="small" />
                    )}
                    <Typography variant="subtitle1">{stage.title}</Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {stage.description}
                  </Typography>
                  <Chip
                    label={stage.chip.label}
                    color={stage.chip.color}
                    variant={stage.chip.color === 'default' ? 'outlined' : 'filled'}
                    size="small"
                    sx={{ mt: 1 }}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    {stage.helper}
                    {canViewPanel ? ' · Click to view analysis' : ''}
                  </Typography>
                  {stage.actionLabel && stage.onAction && (
                    <Button
                      size="small"
                      variant="contained"
                      sx={{ mt: 1.5 }}
                      onClick={(event) => {
                        event.stopPropagation();
                        stage.onAction?.();
                      }}
                      disabled={stage.actionDisabled}
                    >
                      {stage.actionLabel}
                    </Button>
                  )}
                </Box>
              );
            })}
          </Stack>
          {expandedStage && (
            <Box sx={{ mt: 3 }}>
              {expandedStage === 'precall' && renderPreCallPanel()}
              {expandedStage === 'transcript' && renderTranscriptPanel()}
              {expandedStage === 'proposal' && renderProposalPanel()}
              {expandedStage === 'ppt' && renderPptPanel()}
            </Box>
          )}
          {(() => {
            const errorMessage = (meeting.analysisJob?.errorMessage || '').trim();
            const statusLower = (meeting.analysisJob?.status || '').toLowerCase();
            const shouldHide =
              !errorMessage ||
              statusLower === 'cancelled' ||
              errorMessage.toLowerCase() === 'cancelled by user';
            if (shouldHide) return null;
            return (
            <Alert severity="error" sx={{ mt: 2 }}>
              Analysis error: {errorMessage}
            </Alert>
            );
          })()}
          <Divider sx={{ my: 3 }} />
          <Box ref={checklistRef}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Run AI Analysis
            </Typography>
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, bgcolor: 'background.paper' }}>
              {analysisInProgress ? (
                <Alert severity="info">
                  Analysis is processing. Please wait for it to finish before running additional stages.
                </Alert>
              ) : allWorkflowStagesComplete ? (
                <Alert severity="success">
                  All analyses are complete for this meeting.
                </Alert>
              ) : (
                <Stack spacing={2}>
                  {onlyTranscriptDone && (
                    <Alert severity="info">
                      Transcript analysis is complete. Continue with solution proposal or generate PPT.
                    </Alert>
                  )}
                  <AnalysisChecklist
                    meeting={meeting}
                    onRun={({ stages, transcriptText }) =>
                      handleRunAnalysisRequest({ stages, transcriptText })
                    }
                    loading={analysisWorkflowLoading}
                    error={analysisWorkflowError}
                    availableStages={stageAvailability}
                    initialSelection={stageInitialSelection}
                    completedStages={{
                      transcript: transcriptStageComplete,
                      proposal: proposalStageComplete,
                      ppt: pptStageComplete,
                    }}
                    compact
                  />
                  {analysisWorkflowSuccess && (
                    <Alert
                      severity="success"
                      onClose={() => setAnalysisWorkflowSuccess(null)}
                    >
                      {analysisWorkflowSuccess}
                    </Alert>
                  )}
                </Stack>
              )}
            </Paper>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 2 }}>
              {meeting.analysisJob?.pptDownloadUrl && (
                <Button
                  variant="contained"
                  size="small"
                  color="secondary"
                  startIcon={<CloudDownload />}
                  onClick={() => {
                    const url = meeting.analysisJob?.pptDownloadUrl;
                    if (url) {
                      window.open(url, '_blank', 'noopener,noreferrer');
                    }
                  }}
                >
                  Download Deck
                </Button>
              )}
            </Stack>
          </Box>
        </Paper>

        {/* Pre-Call Research Panel - shown when pre-call is complete */}
        {preCallComplete && meeting.id && (
          <PreCallResearchPanel
            meetingId={meeting.id}
            companyName={meeting.company || linkedDealCompany || undefined}
          />
        )}

        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Meeting Information
          </Typography>
          <Stack spacing={2}>
            <Stack direction="row" spacing={2}>
              <Event color="primary" />
              <Box>
                <Typography variant="subtitle2">Scheduled</Typography>
                <Typography variant="body2">
                  {localDateLabel} at {localTimeLabel} {localTimeZoneLabel}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Meeting timezone: {organizerDateLabel} · {organizerTimeLabel} {organizerTimeZoneLabel}
                </Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={2}>
              <Schedule color="primary" />
              <Box>
                <Typography variant="subtitle2">Duration</Typography>
                <Typography variant="body2">{meeting.duration} minutes</Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={2}>
              <Business color="primary" />
              <Box>
                <Typography variant="subtitle2">Purpose</Typography>
                <Typography variant="body2">{meeting.purpose || 'Not provided'}</Typography>
              </Box>
            </Stack>
          </Stack>
          <Divider sx={{ my: 3 }} />
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={4}>
            {attendeeSections.map((section) => (
              <Box key={section.title} sx={{ flex: 1 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  {section.title}
                </Typography>
                {section.attendees.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No attendees listed.
                  </Typography>
                ) : (
                  <List dense>
                    {section.attendees.map((attendee, index) => (
                      <ListItem key={`${section.title}-${index}`}>
                        <ListItemAvatar>
                          <Avatar>
                            {attendee.name?.charAt(0) || '?'}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={attendee.name}
                          secondary={attendee.role || attendee.email || 'Attendee'}
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </Box>
            ))}
          </Stack>
        </Paper>

      </Stack>

      <PreCallStartDialog
        open={preCallDialogOpen}
        meeting={meeting}
        onClose={() => setPreCallDialogOpen(false)}
        onStart={(values: PreCallStartValues) => {
          setPreCallDialogOpen(false);
          // Start pre-call inline without navigation
          startPreCallInline(values);
        }}
      />

      <MeetingAssociationDialog
        open={associationDialogOpen}
        onClose={() => {
          setAssociationDialogOpen(false);
          setPendingRunRequest(null);
        }}
        onConfirm={handleAssociationConfirmed}
        defaultAccountId={meeting.accountId || null}
        defaultDealId={meeting.deal_id || (meeting.deal as any)?.deal_id || null}
      />
      <FollowUpEmailDialog
        open={followUpEmailDialogOpen}
        onClose={() => setFollowUpEmailDialogOpen(false)}
        meetingId={meetingIdentifier || meeting.id}
        meetingTitle={meeting.title}
        companyName={derivePreCallCompany()}
        attendees={(meeting.externalAttendees || []).map(a => ({
          name: a.name,
          email: a.email || '',
        }))}
        onSend={() => setFollowUpEmailDialogOpen(false)}
      />
        </Box>
      </Fade>
    </Box>
  );
};

export default MeetingDetailPage;
