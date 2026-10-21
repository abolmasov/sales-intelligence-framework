import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  LinearProgress,
  Stack,
  Chip,
  Alert,
  Collapse,
  CircularProgress,
  Paper,
} from '@mui/material';
import {
  PlayArrow,
  CheckCircle,
  ExpandMore,
  ExpandLess,
  Psychology,
  Cancel,
} from '@mui/icons-material';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { apiGet } from '../utils/api';
import AIQuestionnaire from './AIQuestionnaire';
import IntegratorOpportunityMapping, { IntegratorOpportunityMappingData } from './IntegratorOpportunityMapping';
import type { CalendarMeeting } from '../types/calendarMeeting';
import { getSharedMeetingIdentifier } from '../utils/meetingActions';
import { useCalendarMeetingsStore } from '../store/calendarMeetingsStore';
import { deriveCompanyFromMeeting } from '../utils/companyDetection';
import PreCallStartDialog, { type PreCallStartValues } from './PreCallStartDialog';
import { playPreCallCompleteSound, playErrorSound } from '../utils/soundNotification';
import { useSyncEmitters } from '../hooks/useStoreSync';

interface InlinePreCallAnalysisProps {
  meeting: CalendarMeeting;
  onAnalysisComplete?: () => void;
  onError?: (error: string) => void;
}

interface ProgressState {
  step?: string;
  percentage?: number;
}

interface PreCallResearchData {
  session_id: string;
  company_name: string | null;
  completed_at: string | null;
  questionnaire: {
    questions: Array<{
      id: number;
      question: string;
      category: string;
      context: string;
      northstar_connection: string;
      product_focus: string;
      target_persona: string;
    }>;
    metadata?: {
      services_count?: number;
      products_count?: number;
      insights_count?: number;
    };
  } | null;
  company_overview: any;
}

const MAX_INITIAL_RETRIES = 5; // Allow up to 5 retries for "Analysis not found" during startup
const INITIAL_POLL_DELAY_MS = 1500; // Wait 1.5 seconds before first poll
const sanitizeName = (value?: string | null): string => {
  if (!value) return '';
  const trimmed = value.toString().trim();
  if (!trimmed) return '';
  if (trimmed.toLowerCase() === 'unknown') return '';
  return trimmed;
};

const InlinePreCallAnalysis: React.FC<InlinePreCallAnalysisProps> = ({
  meeting,
  onAnalysisComplete,
  onError,
}) => {
  const updateMeeting = useCalendarMeetingsStore((state) => state.updateMeeting);
  const { emitPreCallStarted, emitPreCallCompleted } = useSyncEmitters();

  const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'error'>('idle');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressState>({ step: '', percentage: 0 });
  const [currentStep, setCurrentStep] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [researchData, setResearchData] = useState<PreCallResearchData | null>(null);
  const [questionnaireExpanded, setQuestionnaireExpanded] = useState(true);
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [startDialogOpen, setStartDialogOpen] = useState(false);
  const [enterpriseMapping, setIntegratorMapping] = useState<IntegratorOpportunityMappingData | null>(null);
  const [enterpriseMappingLoading, setIntegratorMappingLoading] = useState(false);
  const [overrideCompanyName, setOverrideCompanyName] = useState<string>('');
  const [cancelling, setCancelling] = useState(false);

  // Use consistent meeting identifier for both storing and fetching research
  const meetingIdentifier = useMemo(() => {
    return getSharedMeetingIdentifier(meeting) || meeting.id;
  }, [meeting]);

  // Get the latest pre-call status from the meeting's analysisSummary
  const latestPreCallFromStore = meeting.analysisSummary?.preCall?.[0];
  const storeStatus = latestPreCallFromStore?.status;
  const storeSessionId = latestPreCallFromStore?.sessionId;

  // Sync local state with meeting's analysisSummary when it changes
  // This handles cases where pre-call is started from another component or already exists
  useEffect(() => {
    // If the store says it's running, sync up
    if (storeStatus === 'running' || storeStatus === 'pending') {
      setStatus('running');
      if (storeSessionId) {
        setSessionId(storeSessionId);
      }
      if (latestPreCallFromStore?.currentStep) {
        setCurrentStep(latestPreCallFromStore.currentStep);
      }
    }

    // If the store says it's completed, sync up
    if (storeStatus === 'completed') {
      setStatus('completed');
    }
  }, [storeStatus, storeSessionId, latestPreCallFromStore?.currentStep]);

  // Check for existing pre-call research on mount (completed or in-progress)
  useEffect(() => {
    const checkExistingResearch = async () => {
      if (!meetingIdentifier) {
        setLoadingExisting(false);
        return;
      }

      try {
        const response = await apiGet(`/api/meetings/${meetingIdentifier}/pre-call-research`);

        if (response?.success && response?.data) {
          const data = response.data;

          if (data.status === 'completed' && data.questionnaire) {
            // Completed research - show results
            setResearchData(data);
            setStatus('completed');
          } else if (data.status === 'running' || data.status === 'pending') {
            // In-progress research - resume polling
            setSessionId(data.session_id);
            setStatus('running');
          }
        }
      } catch {
        // No existing research, that's fine
      } finally {
        setLoadingExisting(false);
      }
    };

    checkExistingResearch();
  }, [meetingIdentifier]);

  // Fetch Northstar Integrators opportunity mapping when research is completed
  useEffect(() => {
    const fetchIntegratorMapping = async () => {
      if (status !== 'completed' || !researchData?.session_id) return;

      setIntegratorMappingLoading(true);
      try {
        const response = await apiGet(`/api/research/${researchData.session_id}/enterprise-mapping`);
        if (response?.success && response?.data) {
          setIntegratorMapping(response.data);
        }
      } catch (err) {
        console.error('Failed to fetch Northstar Integrators mapping:', err);
      } finally {
        setIntegratorMappingLoading(false);
      }
    };

    fetchIntegratorMapping();
  }, [status, researchData?.session_id]);

  // Pull a user-entered company name from localStorage if available (helps avoid "Unknown")
  useEffect(() => {
    const stored = localStorage.getItem('ongoingResearch');
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      if (
        parsed &&
        (parsed.meetingId === meetingIdentifier || parsed.sessionId === sessionId)
      ) {
        const normalized = sanitizeName(parsed.companyName);
        if (normalized) {
          setOverrideCompanyName(normalized);
        }
      }
    } catch {
      // ignore malformed storage
    }
  }, [meetingIdentifier, sessionId]);

  const calculateProgress = useCallback(() => {
    const pct = progress?.percentage;
    return typeof pct === 'number' ? pct : 0;
  }, [progress]);

  // Poll for status when running
  useEffect(() => {
    if (status !== 'running' || !sessionId) return;

    let pollInterval: NodeJS.Timeout;
    let retryCount = 0;
    let isCancelled = false;

    const pollStatus = async () => {
      if (isCancelled) return;

      try {
        const response = await axios.get(`${API_BASE_URL}/api/research/status/${sessionId}`);
        // Backend wraps in ApiResponse: { success: true, data: {...status...} }
        const statusData = response.data?.data || response.data;

        if (statusData) {
          // Reset retry count on successful response
          retryCount = 0;

          if (statusData.progress && typeof statusData.progress === 'object') {
            setProgress(statusData.progress);
          }
          setCurrentStep(statusData.current_step || statusData.currentStep || '');

          if (statusData.status === 'completed') {
            setStatus('completed');
            if (pollInterval) clearInterval(pollInterval);

            // Play sound notification for completion
            playPreCallCompleteSound();

            // Fetch the result
            try {
              const resultResponse = await axios.get(`${API_BASE_URL}/api/research/${sessionId}/result`);
              if (resultResponse.data) {
                // Also fetch from our endpoint to get formatted data
                const formattedResponse = await apiGet(`/api/meetings/${meeting.id}/pre-call-research`);
                if (formattedResponse?.success && formattedResponse?.data) {
                  setResearchData(formattedResponse.data);
                }
              }

              // Update the meeting in the store with completed status
              const existingPreCall = meeting.analysisSummary?.preCall || [];
              updateMeeting(meeting.id, {
                analysisSummary: {
                  ...meeting.analysisSummary,
                  preCall: [
                    {
                      sessionId: sessionId,
                      status: 'completed',
                      completedAt: new Date().toISOString(),
                      startedAt: existingPreCall.find(pc => pc.sessionId === sessionId)?.startedAt || null,
                      currentStep: null,
                    },
                    ...existingPreCall.filter(pc => pc.sessionId !== sessionId),
                  ],
                  postCall: meeting.analysisSummary?.postCall || [],
                  proposals: meeting.analysisSummary?.proposals || [],
                },
              });

              onAnalysisComplete?.();

              // Emit sync event so other components refresh
              emitPreCallCompleted(meeting.id, sessionId, 'InlinePreCallAnalysis');
            } catch {
              // Still mark as complete even if fetch fails
              emitPreCallCompleted(meeting.id, sessionId, 'InlinePreCallAnalysis');
            }
          } else if (statusData.status === 'error') {
            setStatus('error');
            setError(statusData.error || 'Analysis failed');
            playErrorSound();
            onError?.(statusData.error || 'Analysis failed');
            if (pollInterval) clearInterval(pollInterval);
          }
        }
      } catch (err: any) {
        // Check if it's an "Analysis not found" error during startup
        const isNotFoundError = err?.response?.status === 500 ||
                                err?.response?.data?.detail?.includes('not found');

        if (isNotFoundError && retryCount < MAX_INITIAL_RETRIES) {
          // During startup, the analysis record might not be created yet
          retryCount++;
          console.log(`Waiting for analysis to initialize... (attempt ${retryCount}/${MAX_INITIAL_RETRIES})`);
        } else if (retryCount >= MAX_INITIAL_RETRIES) {
          // Too many retries, something is wrong
          setStatus('error');
          setError('Analysis initialization timed out. Please try again.');
          onError?.('Analysis initialization timed out');
          if (pollInterval) clearInterval(pollInterval);
        }
        // Otherwise, just continue polling
      }
    };

    // Add initial delay before first poll to give backend time to create the analysis record
    const initialDelayTimeout = setTimeout(() => {
      if (isCancelled) return;

      // Start polling after initial delay
      pollStatus(); // First poll
      pollInterval = setInterval(pollStatus, 2000);
    }, INITIAL_POLL_DELAY_MS);

    return () => {
      isCancelled = true;
      clearTimeout(initialDelayTimeout);
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [status, sessionId, meeting.id, onAnalysisComplete, onError]);

  // Extract company name using consolidated utility (with override support)
  const derivedCompanyName = useMemo(() => {
    const override = sanitizeName(overrideCompanyName);
    if (override) return override;
    return deriveCompanyFromMeeting(meeting, { skipFallbackCheck: true });
  }, [meeting, overrideCompanyName]);

  const startAnalysis = async (values: PreCallStartValues) => {
    setStatus('running');
    setError(null);
    setProgress({ step: 'Starting research...', percentage: 0 });
    const normalizedCompany = sanitizeName(values.companyName);
    if (normalizedCompany) {
      setOverrideCompanyName(normalizedCompany);
    }

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

      // Backend returns sessionId (camelCase) in data object; 409 returns existing sessionId to resume
      const newSessionId =
        response.data?.data?.sessionId ||
        response.data?.data?.session_id ||
        response.data?.sessionId ||
        response.data?.session_id ||
        null;
      setSessionId(newSessionId);
      try {
        localStorage.setItem(
          'ongoingResearch',
          JSON.stringify({
            sessionId: newSessionId,
            meetingId: meetingIdentifier,
            companyName: normalizedCompany || meeting.company || meeting.title || '',
            startTime: Date.now(),
          })
        );
      } catch {
        // ignore storage failures
      }

      // Update the meeting in the store with the new pre-call analysis status
      // This ensures the calendar view shows the running indicator even after navigation
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

        // Emit sync event so other components know pre-call started
        emitPreCallStarted(meeting.id, newSessionId, 'InlinePreCallAnalysis');
      }
    } catch (err: any) {
      if (err?.response?.status === 409) {
        const existingSessionId =
          err.response.data?.data?.sessionId ||
          err.response.data?.data?.session_id ||
          null;
        if (existingSessionId) {
          setSessionId(existingSessionId);
          setStatus('running');
          return;
        }
      }
      setStatus('error');
      const message = err.response?.data?.message || err.response?.data?.detail || err.message || 'Failed to start analysis';
      setError(message);
      onError?.(message);
    }
  };

  const handleStartAnalysis = async () => {
    setStartDialogOpen(true);
  };

  const handleCancelAnalysis = async () => {
    if (!sessionId || cancelling) return;
    setCancelling(true);
    try {
      await axios.post(`${API_BASE_URL}/api/research/${sessionId}/cancel`);
      try {
        const stored = localStorage.getItem('ongoingResearch');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed?.sessionId === sessionId) {
            localStorage.removeItem('ongoingResearch');
          }
        }
      } catch {
        // ignore storage failures
      }

      setStatus('idle');
      setSessionId(null);
      setProgress({ step: '', percentage: 0 });
      setCurrentStep('');
      setError(null);
      setResearchData(null);

      const existingPreCall = meeting.analysisSummary?.preCall || [];
      updateMeeting(meeting.id, {
        analysisSummary: {
          ...meeting.analysisSummary,
          preCall: existingPreCall.filter((pc) => pc.sessionId !== sessionId),
          postCall: meeting.analysisSummary?.postCall || [],
          proposals: meeting.analysisSummary?.proposals || [],
        },
        analysisSessionId: undefined,
        status: meeting.status === 'analyzing' ? 'scheduled' : meeting.status,
      });
    } catch (err: any) {
      const message = err.response?.data?.message || err.response?.data?.detail || err.message || 'Failed to cancel analysis';
      setError(message);
      onError?.(message);
    } finally {
      setCancelling(false);
    }
  };

  if (loadingExisting) {
    return (
      <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 2 }}>
        <CircularProgress size={16} />
        <Typography variant="body2" color="text.secondary">
          Checking for existing research...
        </Typography>
      </Stack>
    );
  }

  // Show completed state with questionnaire
  if (status === 'completed' && researchData?.questionnaire) {
    const questionCount = researchData.questionnaire?.questions?.length || 0;
    const companyName = researchData.company_name || meeting.company || 'Company';

    return (
      <Box>
        {/* Completed Header */}
        <Paper
          variant="outlined"
          sx={{
            borderRadius: 2,
            overflow: 'hidden',
            borderColor: 'success.main',
          }}
        >
          <Box
            sx={{
              p: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              bgcolor: 'success.light',
              cursor: 'pointer',
            }}
            onClick={() => setQuestionnaireExpanded(!questionnaireExpanded)}
          >
            <Stack direction="row" spacing={1.5} alignItems="center">
              <CheckCircle color="success" fontSize="small" />
              <Box>
                <Typography variant="body2" fontWeight={600}>
                  Pre-Call Research Complete
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {questionCount} discovery questions ready
                </Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                icon={<Psychology sx={{ fontSize: 14 }} />}
                label="AI"
                size="small"
                color="primary"
                variant="outlined"
                sx={{ height: 22, '& .MuiChip-label': { px: 0.75, fontSize: '0.7rem' } }}
              />
              {questionnaireExpanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
            </Stack>
          </Box>

          <Collapse in={questionnaireExpanded}>
            <Box sx={{ p: 2 }}>
              {/* Northstar Integrators Opportunity Mapping */}
              <IntegratorOpportunityMapping
                data={enterpriseMapping}
                loading={enterpriseMappingLoading}
              />

              {/* Discovery Questions */}
              <AIQuestionnaire
                companyName={companyName}
                researchSummary=""
                keyInsights={[]}
                attendeeInfo={[]}
                enterpriseRecommendations={[]}
                recommendedProducts={[]}
                preGeneratedQuestions={researchData.questionnaire}
              />
            </Box>
          </Collapse>
        </Paper>
      </Box>
    );
  }

  // Show running state with progress
  if (status === 'running') {
    return (
      <Box>
        <Paper
          variant="outlined"
          sx={{
            p: 2,
            borderRadius: 2,
            background: 'linear-gradient(135deg, rgba(0, 188, 212, 0.08) 0%, rgba(38, 198, 218, 0.08) 100%)',
            borderColor: 'info.main',
          }}
        >
          <Stack spacing={2}>
            <Box>
              <Typography variant="body2" fontWeight={600} color="info.main">
                Researching: {derivedCompanyName || 'Company'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {currentStep || 'Initializing...'}
              </Typography>
            </Box>

            <LinearProgress
              variant="determinate"
              value={calculateProgress()}
              sx={{
                height: 6,
                borderRadius: 3,
                bgcolor: 'rgba(0, 188, 212, 0.2)',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 3,
                  bgcolor: 'info.main',
                },
              }}
            />
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                size="small"
                color="info"
                variant="outlined"
                label={`${Math.round(calculateProgress())}%`}
              />
              {progress?.step ? (
                <Typography variant="caption" color="text.secondary">
                  {progress.step}
                </Typography>
              ) : null}
              <Box sx={{ flexGrow: 1 }} />
              <Button
                size="small"
                variant="outlined"
                color="error"
                startIcon={<Cancel />}
                onClick={handleCancelAnalysis}
                disabled={cancelling}
              >
                {cancelling ? 'Cancelling…' : 'Cancel'}
              </Button>
            </Stack>
          </Stack>
        </Paper>
      </Box>
    );
  }

  // Show error state
  if (status === 'error') {
    return (
      <Box>
        <Alert
          severity="error"
          sx={{ mb: 1 }}
          action={
            <Button color="inherit" size="small" onClick={handleStartAnalysis}>
              Retry
            </Button>
          }
        >
          {error || 'Analysis failed'}
        </Alert>
      </Box>
    );
  }

  // Show idle state - button to start
  return (
    <>
      <Button
        variant="outlined"
        fullWidth
        startIcon={<PlayArrow />}
        onClick={handleStartAnalysis}
        sx={{
          py: 1.5,
          borderRadius: 2,
          borderColor: 'primary.main',
          color: 'primary.main',
          background: 'linear-gradient(135deg, rgba(201, 12, 97, 0.05) 0%, rgba(157, 28, 86, 0.05) 100%)',
          '&:hover': {
            background: 'linear-gradient(135deg, rgba(201, 12, 97, 0.12) 0%, rgba(157, 28, 86, 0.12) 100%)',
            borderColor: 'primary.dark',
          },
        }}
      >
        Pre-call Analysis
      </Button>

      <PreCallStartDialog
        open={startDialogOpen}
        meeting={meeting}
        onClose={() => setStartDialogOpen(false)}
        onStart={(values: PreCallStartValues) => {
          setStartDialogOpen(false);
          startAnalysis(values);
        }}
      />
    </>
  );
};

export default InlinePreCallAnalysis;
