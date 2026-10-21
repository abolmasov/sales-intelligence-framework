import React, { useState, useEffect, useRef } from 'react';
import { trackFeature } from '../hooks/useAnalytics';
import {
  Box,
  Typography,
  Button,
  TextField,
  LinearProgress,
  Alert,
  Card,
  CardContent,
  CardHeader,
  IconButton,
  Chip,
  Stack,
  Divider,
  Avatar,
  Fade,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Collapse,
  MenuItem,
  FormControlLabel,
  Checkbox,
  alpha,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  CloudUpload,
  TextFields,
  Assessment,
  TrendingUp,
  Warning,
  Person,
  ShoppingCart,
  Business,
  Flag,
  AutoAwesome,
  Group,
  CheckCircle,
  Schedule,
  ExpandMore,
  ExpandLess,
  MonetizationOn,
  Event,
  Description,
  FileUpload,
  ArticleOutlined,
  Slideshow,
  Add,
} from '@mui/icons-material';
import { apiPost, apiPostForm, apiGet } from '../utils/api';
import { useDealStore } from '../store/dealStore';
import { useAppShell } from '../context/AppShellContext';
import { useAccountsStore } from '../store/accountsStore';
import CancelAnalysisFlowButton from './CancelAnalysisFlowButton';

interface AdvancedTranscriptAnalysisProps {
  initialTranscript?: string;
  initialCompany?: string;
  initialContext?: string;
  initialTitle?: string;
  infoMessage?: string;
  linkedMeetingId?: string;
}

interface ProgressStep {
  step: number;
  message: string;
  details?: string;
  status: 'pending' | 'active' | 'complete' | 'error';
}

type AnalysisProgressState = 'idle' | 'queued' | 'processing' | 'completed' | 'error';

const STATUS_POLL_INTERVAL = 10000;

const AdvancedTranscriptAnalysis: React.FC<AdvancedTranscriptAnalysisProps> = ({
  initialTranscript,
  initialCompany,
  initialContext,
  initialTitle,
  infoMessage,
  linkedMeetingId,
}) => {
  const deals = useDealStore((state) => state.deals);
  const fetchDeals = useDealStore((state) => state.fetchDeals);
  const { showMessage } = useAppShell();
  const accounts = useAccountsStore((state) => state.accounts);
  const accountsLoading = useAccountsStore((state) => state.loading);
  const fetchAccounts = useAccountsStore((state) => state.fetchAccounts);
  const [inputMethod, setInputMethod] = useState<'text' | 'file'>('text');
  const [transcriptText, setTranscriptText] = useState('');
  const [meetingContext, setMeetingContext] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analysisName, setAnalysisName] = useState('');
  const [selectedDealId, setSelectedDealId] = useState('');
  const [runProposal, setRunProposal] = useState(false);
  const [runPpt, setRunPpt] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<any | null>(null);
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(true);
  const [lastAppliedTranscript, setLastAppliedTranscript] = useState<string | null>(null);
  const [prefillMessage, setPrefillMessage] = useState<string | null>(null);
  const [analysisQueuedId, setAnalysisQueuedId] = useState<string | null>(null);
  const [analysisQueuedMessage, setAnalysisQueuedMessage] = useState<string | null>(null);
  const [analysisProgressState, setAnalysisProgressState] = useState<AnalysisProgressState>('idle');
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastStatusRef = useRef<string | null>(null);

  // Create new account/deal dialog states
  const [showCreateAccountDialog, setShowCreateAccountDialog] = useState(false);
  const [showCreateDealDialog, setShowCreateDealDialog] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [newDealName, setNewDealName] = useState('');
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [creatingDeal, setCreatingDeal] = useState(false);
  const createAccount = useAccountsStore((state) => state.createAccount);
  const createDeal = useDealStore((state) => state.createDeal);

  useEffect(() => {
    if (initialTranscript && initialTranscript !== lastAppliedTranscript) {
      setTranscriptText(initialTranscript);
      if (initialContext) setMeetingContext((prev) => prev || initialContext);
      setPrefillMessage('Transcript loaded from meeting. Review or edit before running analysis.');
      setLastAppliedTranscript(initialTranscript);
      setInputMethod('text');
    } else if (!initialTranscript && lastAppliedTranscript) {
      setLastAppliedTranscript(null);
      setPrefillMessage(null);
    }
  }, [initialTranscript, initialCompany, initialContext, lastAppliedTranscript]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
      setAnalysis(null);

      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setTranscriptText(content);
      };
      reader.readAsText(file);
    }
  };

  useEffect(() => {
    if (initialTitle && !analysisName) {
      setAnalysisName(initialTitle);
    }
  }, [initialTitle, analysisName]);

  useEffect(() => {
    if (!deals.length) {
      fetchDeals().catch(() => undefined);
    }
  }, [deals.length, fetchDeals]);

  useEffect(() => {
    if (!accounts.length && !accountsLoading) {
      fetchAccounts().catch(() => undefined);
    }
  }, [accounts.length, accountsLoading, fetchAccounts]);

  useEffect(() => {
    if (!selectedDealId && deals.length === 1) {
      setSelectedDealId(deals[0].deal_id);
    }
  }, [deals, selectedDealId]);

  useEffect(() => {
    if (!selectedDealId) return;
    const deal = deals.find((d) => d.deal_id === selectedDealId);
    if (deal?.account_id && deal.account_id !== selectedAccountId) {
      setSelectedAccountId(deal.account_id);
    }
  }, [selectedDealId, deals, selectedAccountId]);

  useEffect(() => {
    if (!initialCompany || selectedAccountId || !accounts.length) return;
    const match = accounts.find((account) => account.name === initialCompany);
    if (match) setSelectedAccountId(match.account_id);
  }, [initialCompany, selectedAccountId, accounts]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, `[${timestamp}] ${message}`]);
  };

  const selectedAccountName =
    accounts.find((account) => account.account_id === selectedAccountId)?.name || '';

  const handleCreateAccount = async () => {
    if (!newAccountName.trim()) return;
    setCreatingAccount(true);
    try {
      const newAccount = await createAccount({ name: newAccountName.trim() });
      if (newAccount?.account_id) {
        // Refresh accounts list to ensure the new account is available
        await fetchAccounts();
        setSelectedAccountId(newAccount.account_id);
        trackFeature('account_research', 'account_created', { accountName: newAccountName.trim() });
        showMessage({ type: 'success', message: `Account "${newAccountName}" created successfully` });
      } else {
        showMessage({ type: 'error', message: 'Failed to create account - no account returned' });
      }
      setNewAccountName('');
      setShowCreateAccountDialog(false);
    } catch (err) {
      showMessage({ type: 'error', message: 'Failed to create account' });
    } finally {
      setCreatingAccount(false);
    }
  };

  const handleCreateDeal = async () => {
    if (!newDealName.trim() || !selectedAccountId) return;
    setCreatingDeal(true);
    try {
      const newDeal = await createDeal({
        opportunity_name: newDealName.trim(),
        account_id: selectedAccountId,
        stage: 'Discovery',
        status: 'Open',
      });
      if (newDeal?.deal_id) {
        // Refresh deals list to ensure the new deal is available
        await fetchDeals();
        setSelectedDealId(newDeal.deal_id);
        trackFeature('deal_management', 'deal_created', { dealName: newDealName.trim() });
        showMessage({ type: 'success', message: `Deal "${newDealName}" created successfully` });
      } else {
        showMessage({ type: 'error', message: 'Failed to create deal - no deal returned' });
      }
      setNewDealName('');
      setShowCreateDealDialog(false);
    } catch (err) {
      showMessage({ type: 'error', message: 'Failed to create deal' });
    } finally {
      setCreatingDeal(false);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile && !transcriptText.trim()) {
      setError('Please enter or upload a transcript');
      return;
    }
    if (!analysisName.trim()) {
      setError('Please provide an analysis name');
      return;
    }
    if (!selectedAccountId) {
      setError('Please select an account');
      return;
    }
    if (!meetingContext.trim()) {
      setError('Please provide meeting context');
      return;
    }
    if (!selectedDealId) {
      setError('Please select a deal to store this analysis under.');
      return;
    }
    if (runPpt && !runProposal) {
      setRunProposal(true);
    }

    setAnalyzing(true);
    setError(null);
    setLogs([]);
    setAnalysisProgressState('idle');
    setAnalysis(null);
    setAnalysisQueuedId(null);
    setAnalysisQueuedMessage(null);

    try {
      let response;

      if (selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('meetingTitle', analysisName.trim());
        formData.append('accountId', selectedAccountId);
        formData.append('companyName', selectedAccountName);
        formData.append('meetingContext', meetingContext.trim());
        if (linkedMeetingId) {
          formData.append('meetingId', linkedMeetingId);
        }
        formData.append('dealId', selectedDealId);
        formData.append('runProposal', String(runProposal || runPpt));
        formData.append('runPpt', String(runPpt));
        response = await apiPostForm('/api/transcripts/analyze-enhanced', formData);
      } else {
        const payload = {
          transcriptText,
          meetingTitle: analysisName.trim(),
          accountId: selectedAccountId,
          companyName: selectedAccountName,
          meetingContext: meetingContext.trim(),
          meetingId: linkedMeetingId || undefined,
          dealId: selectedDealId,
          runProposal: runProposal || runPpt,
          runPpt,
        };
        response = await apiPost('/api/transcripts/analyze-enhanced', payload);
      }
      const queuedId = response?.data?.analysisId;

      setAnalysisQueuedId(queuedId || null);
      setAnalysisQueuedMessage(
        response?.message ||
          'Analysis started. You can check the Transcript Analyses tab in History to view progress.'
      );

      if (queuedId) {
        localStorage.setItem(
          'ongoingTranscriptAnalysis',
          JSON.stringify({
            analysisId: queuedId,
            analysisName: analysisName.trim(),
            startedAt: Date.now(),
            status: 'processing',
          })
        );
      }

      addLog(
        queuedId
          ? `INFO: Analysis ${queuedId} queued. Check History > Transcript Analyses for status.`
          : 'INFO: Analysis queued. Check History > Transcript Analyses for status.'
      );

      setAnalysisProgressState(queuedId ? 'queued' : 'idle');
    } catch (err: any) {
      setError(err.message || 'Failed to analyze transcript');
      addLog(`ERROR: ${err.message || 'Analysis failed'}`);
      setAnalysisProgressState('error');
    } finally {
      setAnalyzing(false);
    }
  };

  const deriveProgressSteps = (state: AnalysisProgressState): ProgressStep[] => {
    if (state === 'idle') return [];
    return [
      {
        step: 1,
        message: 'Analysis queued',
        details: 'Your transcript has been enqueued for processing.',
        status: state === 'queued' ? 'active' : 'complete',
      },
      {
        step: 2,
        message: 'Processing transcript with AI',
        details: state === 'error' ? 'Analysis encountered an error.' : 'Extracting insights, opportunities, and actions.',
        status:
          state === 'queued'
            ? 'pending'
            : state === 'processing'
            ? 'active'
            : state === 'completed'
            ? 'complete'
            : 'error',
      },
      {
        step: 3,
        message: 'Results ready',
        details:
          state === 'error'
            ? 'Check the error details below and try again.'
            : 'Insights will appear automatically once processing completes.',
        status: state === 'completed' ? 'complete' : state === 'error' ? 'error' : 'pending',
      },
    ];
  };

  useEffect(() => {
    setProgressSteps(deriveProgressSteps(analysisProgressState));
  }, [analysisProgressState]);

  useEffect(() => {
    if (!analysisQueuedId) {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      lastStatusRef.current = null;
      return;
    }

    let isCancelled = false;

    const stopPolling = () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };

    const pollStatus = async () => {
      try {
        const statusResponse = await apiGet(`/api/transcripts/${analysisQueuedId}`);
        if (isCancelled) return;
        const analysisRecord = statusResponse?.data;
        if (!analysisRecord) return;
        const status: string = analysisRecord.status || 'processing';

        if (lastStatusRef.current !== status) {
          addLog(`INFO: Analysis status updated to ${status}`);
          lastStatusRef.current = status;
        }

        if (status === 'completed') {
          setAnalysisProgressState('completed');
          setAnalysis(analysisRecord.analysisResult || analysisRecord.analysis_result || null);
          setAnalysisQueuedMessage('Analysis completed. Results are displayed below.');
          setAnalyzing(false);
          localStorage.removeItem('ongoingTranscriptAnalysis');
          showMessage({
            type: 'success',
            message: `${analysisName || 'Transcript analysis'} completed.`,
          });
          stopPolling();
          return;
        }

        if (status === 'error') {
          setAnalysisProgressState('error');
          setError(analysisRecord.errorMessage || 'Transcript analysis failed.');
          setAnalyzing(false);
          localStorage.removeItem('ongoingTranscriptAnalysis');
          showMessage({
            type: 'error',
            message: analysisRecord.errorMessage || 'Transcript analysis failed.',
          });
          stopPolling();
          return;
        }

        setAnalysisProgressState('processing');
        setAnalysisQueuedMessage('Analysis is running. This page will update automatically.');
        localStorage.setItem(
          'ongoingTranscriptAnalysis',
          JSON.stringify({
            analysisId: analysisQueuedId,
            analysisName: analysisName.trim(),
            startedAt: Date.now(),
            status,
          })
        );
      } catch (pollError: any) {
        if (!isCancelled) {
          addLog(`WARN: Unable to fetch analysis status: ${pollError.message || pollError}`);
        }
      }
    };

    addLog('INFO: Monitoring analysis progress...');
    pollStatus();
    pollTimerRef.current = setInterval(pollStatus, STATUS_POLL_INTERVAL);

    return () => {
      isCancelled = true;
      stopPolling();
    };
  }, [analysisQueuedId, analysisName, showMessage]);

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return '#10b981';
      case 'negative': return '#ef4444';
      default: return '#f59e0b';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return '#10b981';
    if (score >= 40) return '#f59e0b';
    return '#ef4444';
  };

  const getProgressColor = (status: string) => {
    switch (status) {
      case 'complete': return '#10b981';
      case 'active': return '#2563eb';
      case 'error': return '#ef4444';
      default: return '#94a3b8';
    }
  };

  const normalizeConfidenceValue = (value: any): string | null => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number' && Number.isFinite(value)) {
      const normalized = value <= 1 ? value * 100 : value;
      return `${Math.round(normalized)}%`;
    }
    const trimmed = String(value).trim();
    if (!trimmed) return null;
    const numericValue = Number(trimmed.replace('%', ''));
    if (!Number.isNaN(numericValue)) {
      const normalized = numericValue <= 1 ? numericValue * 100 : numericValue;
      return `${Math.round(normalized)}%`;
    }
    return trimmed;
  };

  const getOpportunityConfidenceLabel = (opportunity: any): string | null => {
    if (!opportunity || typeof opportunity !== 'object') return null;
    const candidate =
      opportunity.confidence ??
      opportunity.confidence_score ??
      opportunity.confidenceScore ??
      opportunity.score ??
      null;
    return normalizeConfidenceValue(candidate);
  };

  const getOpportunityLabel = (opportunity: any, index: number) =>
    opportunity?.title ||
    opportunity?.name ||
    opportunity?.opportunityID ||
    opportunity?.opportunityId ||
    opportunity?.id ||
    `Opportunity ${index + 1}`;

  const getOpportunitySummaryText = (opportunity: any) =>
    opportunity?.description ||
    opportunity?.summary ||
    opportunity?.opportunitySummary ||
    opportunity?.details?.summary ||
    opportunity?.context ||
    opportunity?.valueProp ||
    null;

  const extractDetectedOpportunities = (analysisData: any): any[] => {
    if (!analysisData || typeof analysisData !== 'object') return [];
    const potentialLists = [
      analysisData.opportunitiesDetected,
      analysisData.opportunities_detected,
      analysisData.opportunities,
      analysisData.data?.opportunitiesDetected,
    ];

    for (const list of potentialLists) {
      if (Array.isArray(list)) return list;
      if (typeof list === 'string') {
        try {
          const parsed = JSON.parse(list);
          if (Array.isArray(parsed)) return parsed;
        } catch (error) {
          // Ignore parse errors and continue
        }
      }
    }
    return [];
  };

  const detectedOpportunities = extractDetectedOpportunities(analysis);

  // Theme colors
  const THEME = {
    primary: '#171717',
    accent: '#2563eb',
    accentLight: '#3b82f6',
    success: '#059669',
    warning: '#d97706',
    error: '#dc2626',
    purple: '#7c3aed',
    slate50: '#f8fafc',
    slate100: '#f1f5f9',
    slate200: '#e2e8f0',
    slate300: '#cbd5e1',
    slate400: '#94a3b8',
    slate500: '#64748b',
    slate600: '#475569',
  };

  return (
    <Box>
      {/* Alerts Section */}
      {(infoMessage || prefillMessage) && (
        <Alert
          severity="info"
          sx={{
            mb: 3,
            borderRadius: 2,
            border: `1px solid ${alpha(THEME.accent, 0.2)}`,
            bgcolor: alpha(THEME.accent, 0.03),
            '& .MuiAlert-icon': { color: THEME.accent },
          }}
        >
          {infoMessage || prefillMessage}
        </Alert>
      )}

      {analysisQueuedId && (
        <Alert
          severity="success"
          sx={{
            mb: 3,
            borderRadius: 2,
            border: `1px solid ${alpha(THEME.success, 0.2)}`,
            bgcolor: alpha(THEME.success, 0.03),
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: THEME.success }}>
                Analysis Started Successfully
              </Typography>
              <Typography variant="body2" sx={{ color: THEME.slate600 }}>
                {analysisQueuedMessage || 'Processing continues in the background. Results will appear below when ready.'}
              </Typography>
              <Typography variant="caption" sx={{ color: THEME.slate400 }}>
                ID: {analysisQueuedId}
              </Typography>
            </Box>
          </Box>
        </Alert>
      )}

      {/* Main Input Form */}
      <Grid container spacing={3}>
        {/* Left Column - Transcript Input */}
        <Grid size={{ xs: 12, lg: 7 }}>
          <Box
            sx={{
              p: 3,
              borderRadius: 2,
              border: `1px solid ${THEME.slate200}`,
              bgcolor: 'background.paper',
              height: '100%',
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
              <Description sx={{ color: THEME.accent, fontSize: 20 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: THEME.primary }}>
                Transcript Source
              </Typography>
            </Stack>

            {/* Input Method Toggle */}
            <Box
              sx={{
                display: 'flex',
                gap: 1,
                p: 0.5,
                mb: 3,
                borderRadius: 2,
                bgcolor: THEME.slate100,
                width: 'fit-content',
              }}
            >
              <Button
                size="small"
                startIcon={<TextFields sx={{ fontSize: 16 }} />}
                onClick={() => setInputMethod('text')}
                sx={{
                  px: 2,
                  py: 0.75,
                  borderRadius: 1.5,
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  bgcolor: inputMethod === 'text' ? 'white' : 'transparent',
                  color: inputMethod === 'text' ? THEME.primary : THEME.slate500,
                  boxShadow: inputMethod === 'text' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  '&:hover': {
                    bgcolor: inputMethod === 'text' ? 'white' : alpha(THEME.slate200, 0.5),
                  },
                }}
              >
                Paste Text
              </Button>
              <Button
                size="small"
                startIcon={<FileUpload sx={{ fontSize: 16 }} />}
                onClick={() => setInputMethod('file')}
                sx={{
                  px: 2,
                  py: 0.75,
                  borderRadius: 1.5,
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  bgcolor: inputMethod === 'file' ? 'white' : 'transparent',
                  color: inputMethod === 'file' ? THEME.primary : THEME.slate500,
                  boxShadow: inputMethod === 'file' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  '&:hover': {
                    bgcolor: inputMethod === 'file' ? 'white' : alpha(THEME.slate200, 0.5),
                  },
                }}
              >
                Upload File
              </Button>
            </Box>

            {inputMethod === 'text' ? (
              <Box>
                <TextField
                  fullWidth
                  multiline
                  rows={14}
                  placeholder="Paste your sales call transcript, meeting notes, or conversation here...

Supports transcripts from:
• Microsoft Teams
• Zoom
• Google Meet
• Any other meeting platform"
                  value={transcriptText}
                  onChange={(e) => setTranscriptText(e.target.value)}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      bgcolor: THEME.slate50,
                      borderRadius: 2,
                      fontSize: '0.875rem',
                      '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: THEME.slate300,
                      },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: THEME.accent,
                      },
                    },
                  }}
                />
                {transcriptText && (
                  <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                    <Chip
                      label={`${transcriptText.length.toLocaleString()} chars`}
                      size="small"
                      sx={{
                        height: 24,
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        bgcolor: THEME.slate100,
                        color: THEME.slate600,
                      }}
                    />
                    <Chip
                      label={`${transcriptText.split(/\s+/).filter(Boolean).length.toLocaleString()} words`}
                      size="small"
                      sx={{
                        height: 24,
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        bgcolor: alpha(THEME.accent, 0.1),
                        color: THEME.accent,
                      }}
                    />
                    <Chip
                      label={`~${Math.ceil(transcriptText.split(/\s+/).filter(Boolean).length / 150)} min read`}
                      size="small"
                      sx={{
                        height: 24,
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        bgcolor: alpha(THEME.success, 0.1),
                        color: THEME.success,
                      }}
                    />
                  </Stack>
                )}
              </Box>
            ) : (
              <Box>
                <input
                  accept=".txt,.md,.doc,.docx,.vtt,.srt"
                  style={{ display: 'none' }}
                  id="transcript-file-upload"
                  type="file"
                  onChange={handleFileSelect}
                />
                <label htmlFor="transcript-file-upload">
                  <Box
                    sx={{
                      p: 4,
                      borderRadius: 2,
                      border: `2px dashed ${selectedFile ? THEME.success : THEME.slate300}`,
                      bgcolor: selectedFile ? alpha(THEME.success, 0.03) : THEME.slate50,
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all 0.2s',
                      '&:hover': {
                        borderColor: THEME.accent,
                        bgcolor: alpha(THEME.accent, 0.02),
                      },
                    }}
                  >
                    <CloudUpload
                      sx={{
                        fontSize: 40,
                        color: selectedFile ? THEME.success : THEME.slate400,
                        mb: 1,
                      }}
                    />
                    {selectedFile ? (
                      <>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: THEME.success }}>
                          {selectedFile.name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: THEME.slate500 }}>
                          Click to change file
                        </Typography>
                      </>
                    ) : (
                      <>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: THEME.slate600 }}>
                          Click to upload or drag and drop
                        </Typography>
                        <Typography variant="caption" sx={{ color: THEME.slate400 }}>
                          Supports .txt, .md, .doc, .docx, .vtt, .srt
                        </Typography>
                      </>
                    )}
                  </Box>
                </label>
              </Box>
            )}
          </Box>
        </Grid>

        {/* Right Column - Analysis Settings */}
        <Grid size={{ xs: 12, lg: 5 }}>
          <Stack spacing={3}>
            {/* Analysis Details */}
            <Box
              sx={{
                p: 3,
                borderRadius: 2,
                border: `1px solid ${THEME.slate200}`,
                bgcolor: 'background.paper',
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2.5 }}>
                <ArticleOutlined sx={{ color: THEME.purple, fontSize: 20 }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 600, color: THEME.primary }}>
                  Analysis Details
                </Typography>
              </Stack>

              <Stack spacing={2.5}>
                <TextField
                  fullWidth
                  required
                  size="small"
                  label="Analysis Name"
                  placeholder="e.g., BrightEdge Discovery Call"
                  value={analysisName}
                  onChange={(e) => setAnalysisName(e.target.value)}
                  error={!analysisName.trim() && !analyzing}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 1.5,
                    },
                  }}
                />

                <TextField
                  select
                  fullWidth
                  required
                  size="small"
                  label="Account"
                  value={selectedAccountId}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '__create_new__') {
                      setShowCreateAccountDialog(true);
                      // Don't update the selected value - keep the current selection
                      return;
                    }
                    setSelectedAccountId(value);
                  }}
                  disabled={accountsLoading}
                  error={!selectedAccountId && !analyzing}
                  SelectProps={{
                    // Prevent the value from being set to __create_new__
                    renderValue: (value) => {
                      const account = accounts.find((a) => a.account_id === value);
                      return account?.name || '';
                    },
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 1.5,
                    },
                  }}
                >
                  <MenuItem
                    value="__create_new__"
                    sx={{
                      color: THEME.accent,
                      fontWeight: 600,
                      borderBottom: `1px solid ${THEME.slate200}`,
                      mb: 0.5,
                    }}
                  >
                    <Add sx={{ fontSize: 18, mr: 1 }} />
                    Create New Account
                  </MenuItem>
                  {accounts.map((account) => (
                    <MenuItem key={account.account_id} value={account.account_id}>
                      {account.name}
                    </MenuItem>
                  ))}
                </TextField>

                <TextField
                  fullWidth
                  required
                  size="small"
                  label="Meeting Context"
                  placeholder="e.g., First discovery call, Follow-up demo"
                  value={meetingContext}
                  onChange={(e) => setMeetingContext(e.target.value)}
                  error={!meetingContext.trim() && !analyzing}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 1.5,
                    },
                  }}
                />

                <TextField
                  select
                  required
                  fullWidth
                  size="small"
                  label="Link to Deal"
                  value={selectedDealId}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '__create_new__') {
                      if (!selectedAccountId) {
                        showMessage({ type: 'warning', message: 'Please select an account first' });
                        return;
                      }
                      setShowCreateDealDialog(true);
                      // Don't update the selected value - keep the current selection
                      return;
                    }
                    setSelectedDealId(value);
                  }}
                  helperText={!selectedAccountId ? 'Select an account first to create a deal' : ''}
                  SelectProps={{
                    // Prevent the value from being set to __create_new__
                    renderValue: (value) => {
                      const deal = deals.find((d) => d.deal_id === value);
                      return deal?.opportunity_name || '';
                    },
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 1.5,
                    },
                  }}
                >
                  <MenuItem
                    value="__create_new__"
                    disabled={!selectedAccountId}
                    sx={{
                      color: selectedAccountId ? THEME.accent : THEME.slate400,
                      fontWeight: 600,
                      borderBottom: `1px solid ${THEME.slate200}`,
                      mb: 0.5,
                    }}
                  >
                    <Add sx={{ fontSize: 18, mr: 1 }} />
                    Create New Deal
                  </MenuItem>
                  {deals.map((deal) => (
                    <MenuItem key={deal.deal_id} value={deal.deal_id}>
                      {deal.opportunity_name}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>
            </Box>

            {/* Follow-up Actions */}
            <Box
              sx={{
                p: 3,
                borderRadius: 2,
                border: `1px solid ${THEME.slate200}`,
                bgcolor: 'background.paper',
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                <AutoAwesome sx={{ color: THEME.warning, fontSize: 20 }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 600, color: THEME.primary }}>
                  Follow-up Actions
                </Typography>
                <Chip
                  label="Optional"
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    bgcolor: THEME.slate100,
                    color: THEME.slate500,
                  }}
                />
              </Stack>

              <Stack spacing={1}>
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 1.5,
                    border: `1px solid ${runProposal ? alpha(THEME.accent, 0.3) : THEME.slate200}`,
                    bgcolor: runProposal ? alpha(THEME.accent, 0.02) : 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    '&:hover': {
                      borderColor: THEME.accent,
                      bgcolor: alpha(THEME.accent, 0.02),
                    },
                  }}
                  onClick={() => setRunProposal(!runProposal || runPpt)}
                >
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={runProposal}
                        onChange={(event) => setRunProposal(event.target.checked || runPpt)}
                        size="small"
                        sx={{
                          color: THEME.slate400,
                          '&.Mui-checked': { color: THEME.accent },
                        }}
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: THEME.primary }}>
                          Generate Solution Proposal
                        </Typography>
                        <Typography variant="caption" sx={{ color: THEME.slate500 }}>
                          Create a tailored proposal based on insights
                        </Typography>
                      </Box>
                    }
                    sx={{ m: 0, width: '100%' }}
                  />
                </Box>

                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 1.5,
                    border: `1px solid ${runPpt ? alpha(THEME.purple, 0.3) : THEME.slate200}`,
                    bgcolor: runPpt ? alpha(THEME.purple, 0.02) : 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    '&:hover': {
                      borderColor: THEME.purple,
                      bgcolor: alpha(THEME.purple, 0.02),
                    },
                  }}
                  onClick={() => {
                    const nextValue = !runPpt;
                    setRunPpt(nextValue);
                    if (nextValue) setRunProposal(true);
                  }}
                >
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={runPpt}
                        onChange={(event) => {
                          const nextValue = event.target.checked;
                          setRunPpt(nextValue);
                          if (nextValue) setRunProposal(true);
                        }}
                        size="small"
                        sx={{
                          color: THEME.slate400,
                          '&.Mui-checked': { color: THEME.purple },
                        }}
                      />
                    }
                    label={
                      <Box>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <Typography variant="body2" sx={{ fontWeight: 600, color: THEME.primary }}>
                            Generate Executive PPT
                          </Typography>
                          <Slideshow sx={{ fontSize: 14, color: THEME.purple }} />
                        </Stack>
                        <Typography variant="caption" sx={{ color: THEME.slate500 }}>
                          Requires proposal to be generated first
                        </Typography>
                      </Box>
                    }
                    sx={{ m: 0, width: '100%' }}
                  />
                </Box>
              </Stack>
            </Box>

            {/* Submit Button */}
            <Button
              variant="contained"
              size="large"
              fullWidth
              disabled={analyzing || !transcriptText.trim() || !analysisName.trim() || !selectedAccountId || !selectedDealId}
              startIcon={analyzing ? <AutoAwesome className="spin" /> : <Assessment />}
              onClick={handleAnalyze}
              sx={{
                py: 1.75,
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '1rem',
                background: `linear-gradient(135deg, ${THEME.accent} 0%, ${THEME.accentLight} 100%)`,
                boxShadow: `0 4px 14px ${alpha(THEME.accent, 0.35)}`,
                '&:hover': {
                  background: `linear-gradient(135deg, #1e40af 0%, ${THEME.accent} 100%)`,
                  boxShadow: `0 6px 20px ${alpha(THEME.accent, 0.45)}`,
                },
                '&:disabled': {
                  background: THEME.slate300,
                  boxShadow: 'none',
                },
              }}
            >
              {analyzing ? 'Analyzing with AI...' : 'Start Analysis'}
            </Button>

          </Stack>
        </Grid>
      </Grid>

      {/* Progress Tracker */}
      {(analysisProgressState !== 'idle' || analyzing) && progressSteps.length > 0 && (
        <Card elevation={0} sx={{ mb: 4, borderRadius: 3, borderWidth: 1, borderStyle: 'solid', borderColor: 'divider' }}>
          <CardHeader
            title={<Typography variant="h6" sx={{ fontWeight: 700 }}>Analysis Progress</Typography>}
            action={
              <Stack direction="row" spacing={1} alignItems="center">
                {(analysisProgressState === 'queued' || analysisProgressState === 'processing') && analysisQueuedId ? (
                  <CancelAnalysisFlowButton
                    transcriptAnalysisId={analysisQueuedId}
                    size="small"
                    onCancelled={() => {
                      setAnalysisProgressState('idle');
                      setAnalysisQueuedId(null);
                      setAnalysisQueuedMessage(null);
                      localStorage.removeItem('ongoingTranscriptAnalysis');
                    }}
                  />
                ) : null}
                <IconButton onClick={() => setShowLogs(!showLogs)}>
                  {showLogs ? <ExpandLess /> : <ExpandMore />}
                </IconButton>
              </Stack>
            }
          />
          <CardContent>
            <Stack spacing={2}>
              {progressSteps.map((step, idx) => (
                <Box key={idx}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                    <Avatar sx={{ width: 32, height: 32, bgcolor: getProgressColor(step.status), fontSize: '0.875rem', fontWeight: 600 }}>
                      {step.status === 'complete' ? '✓' : step.step}
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: step.status === 'active' ? '#2563eb' : '#1e293b' }}>
                        {step.message}
                      </Typography>
                      {step.details && <Typography variant="caption" sx={{ color: 'text.secondary' }}>{step.details}</Typography>}
                    </Box>
                    {step.status === 'active' && <LinearProgress sx={{ width: 60 }} />}
                  </Box>
                  {idx < progressSteps.length - 1 && <Divider sx={{ ml: 5 }} />}
                </Box>
              ))}
            </Stack>

            <Collapse in={showLogs}>
              <Box sx={{ mt: 3, p: 2, bgcolor: 'text.primary', borderRadius: 2, maxHeight: 200, overflow: 'auto' }}>
                {logs.map((log, idx) => (
                  <Typography key={idx} variant="caption" sx={{ display: 'block', color: 'text.disabled', fontFamily: 'monospace', lineHeight: 1.6 }}>
                    {log}
                  </Typography>
                ))}
              </Box>
            </Collapse>
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Alert
          severity="error"
          sx={{
            mt: 3,
            borderRadius: 2,
            border: `1px solid ${alpha(THEME.error, 0.2)}`,
          }}
        >
          {error}
        </Alert>
      )}

      {/* Analysis Results */}
      {analysis && !analyzing && (
        <Fade in={true} timeout={500}>
          <Box sx={{ mt: 4 }}>
            {/* Results Header */}
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 2,
                  background: `linear-gradient(135deg, ${THEME.success} 0%, #10b981 100%)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CheckCircle sx={{ color: 'white', fontSize: 22 }} />
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, color: THEME.primary }}>
                  Analysis Complete
                </Typography>
                <Typography variant="body2" sx={{ color: THEME.slate500 }}>
                  AI-powered insights extracted from your transcript
                </Typography>
              </Box>
            </Stack>

            {/* Key Metrics - Horizontal Cards */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Box
                  sx={{
                    p: 2.5,
                    borderRadius: 2,
                    bgcolor: 'background.paper',
                    border: `1px solid ${THEME.slate200}`,
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      width: 80,
                      height: 80,
                      borderRadius: '50%',
                      background: `linear-gradient(135deg, ${alpha(getScoreColor(analysis.opportunity_score || 0), 0.1)} 0%, transparent 70%)`,
                      transform: 'translate(30%, -30%)',
                    }}
                  />
                  <Typography variant="caption" sx={{ color: THEME.slate500, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Opportunity Score
                  </Typography>
                  <Stack direction="row" alignItems="baseline" spacing={0.5} sx={{ mt: 0.5 }}>
                    <Typography variant="h3" sx={{ fontWeight: 800, color: getScoreColor(analysis.opportunity_score || 0), lineHeight: 1 }}>
                      {analysis.opportunity_score || 0}
                    </Typography>
                    <Typography variant="body2" sx={{ color: THEME.slate400, fontWeight: 600 }}>/100</Typography>
                  </Stack>
                </Box>
              </Grid>

              <Grid size={{ xs: 12, sm: 4 }}>
                <Box
                  sx={{
                    p: 2.5,
                    borderRadius: 2,
                    bgcolor: 'background.paper',
                    border: `1px solid ${THEME.slate200}`,
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      width: 80,
                      height: 80,
                      borderRadius: '50%',
                      background: `linear-gradient(135deg, ${alpha(getSentimentColor(analysis.sentiment?.overall), 0.1)} 0%, transparent 70%)`,
                      transform: 'translate(30%, -30%)',
                    }}
                  />
                  <Typography variant="caption" sx={{ color: THEME.slate500, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Call Sentiment
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: getSentimentColor(analysis.sentiment?.overall), textTransform: 'capitalize', mt: 0.5 }}>
                    {analysis.sentiment?.overall || 'Unknown'}
                  </Typography>
                </Box>
              </Grid>

              <Grid size={{ xs: 12, sm: 4 }}>
                <Box
                  sx={{
                    p: 2.5,
                    borderRadius: 2,
                    bgcolor: 'background.paper',
                    border: `1px solid ${THEME.slate200}`,
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      width: 80,
                      height: 80,
                      borderRadius: '50%',
                      background: `linear-gradient(135deg, ${alpha(THEME.accent, 0.1)} 0%, transparent 70%)`,
                      transform: 'translate(30%, -30%)',
                    }}
                  />
                  <Typography variant="caption" sx={{ color: THEME.slate500, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Win Probability
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: THEME.accent, mt: 0.5 }}>
                    {analysis.success_probability ? `${Math.round(analysis.success_probability * 100)}%` : 'N/A'}
                  </Typography>
                </Box>
              </Grid>
            </Grid>

            {/* Executive Summary */}
            <Box
              sx={{
                p: 3,
                mb: 3,
                borderRadius: 2,
                bgcolor: 'background.paper',
                border: `1px solid ${THEME.slate200}`,
              }}
            >
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                <AutoAwesome sx={{ color: THEME.accent, fontSize: 20 }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: THEME.primary }}>
                  Executive Summary
                </Typography>
              </Stack>
              <Typography variant="body2" sx={{ lineHeight: 1.8, color: THEME.slate600 }}>
                {analysis.executive_summary || 'No executive summary available.'}
              </Typography>
            </Box>

            {/* Two Column Layout for Signals */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
              {/* Buying Signals */}
              {analysis.buying_signals && analysis.buying_signals.length > 0 && (
                <Grid size={{ xs: 12, md: 6 }}>
                  <Box
                    sx={{
                      p: 3,
                      borderRadius: 2,
                      bgcolor: 'background.paper',
                      border: `1px solid ${alpha(THEME.success, 0.2)}`,
                      height: '100%',
                    }}
                  >
                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                      <TrendingUp sx={{ color: THEME.success, fontSize: 20 }} />
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, color: THEME.primary }}>
                        Buying Signals
                      </Typography>
                      <Chip
                        label={analysis.buying_signals.length}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          bgcolor: alpha(THEME.success, 0.1),
                          color: THEME.success,
                        }}
                      />
                    </Stack>
                    <Stack spacing={1.5}>
                      {analysis.buying_signals.map((signal: any, idx: number) => (
                        <Box
                          key={idx}
                          sx={{
                            p: 2,
                            bgcolor: alpha(THEME.success, 0.03),
                            borderRadius: 1.5,
                            borderLeft: `3px solid ${signal.strength === 'strong' ? THEME.success : THEME.warning}`,
                          }}
                        >
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                            <Chip
                              label={signal.strength}
                              size="small"
                              sx={{
                                height: 18,
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                bgcolor: signal.strength === 'strong' ? THEME.success : THEME.warning,
                                color: 'white',
                                textTransform: 'capitalize',
                              }}
                            />
                            <Typography variant="body2" sx={{ fontWeight: 600, color: THEME.primary }}>
                              {signal.signal}
                            </Typography>
                          </Stack>
                          <Typography variant="caption" sx={{ color: THEME.slate500, fontStyle: 'italic' }}>
                            "{signal.evidence}"
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  </Box>
                </Grid>
              )}

              {/* Pain Points */}
              {analysis.pain_points && analysis.pain_points.length > 0 && (
                <Grid size={{ xs: 12, md: 6 }}>
                  <Box
                    sx={{
                      p: 3,
                      borderRadius: 2,
                      bgcolor: 'background.paper',
                      border: `1px solid ${alpha(THEME.error, 0.2)}`,
                      height: '100%',
                    }}
                  >
                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                      <Warning sx={{ color: THEME.error, fontSize: 20 }} />
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, color: THEME.primary }}>
                        Pain Points
                      </Typography>
                      <Chip
                        label={analysis.pain_points.length}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          bgcolor: alpha(THEME.error, 0.1),
                          color: THEME.error,
                        }}
                      />
                    </Stack>
                    <Stack spacing={1.5}>
                      {analysis.pain_points.map((pain: any, idx: number) => (
                        <Box
                          key={idx}
                          sx={{
                            p: 2,
                            bgcolor: alpha(THEME.error, 0.02),
                            borderRadius: 1.5,
                            borderLeft: `3px solid ${THEME.error}`,
                          }}
                        >
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                            <Chip
                              label={pain.severity}
                              size="small"
                              sx={{
                                height: 18,
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                bgcolor: THEME.error,
                                color: 'white',
                                textTransform: 'capitalize',
                              }}
                            />
                            <Typography variant="body2" sx={{ fontWeight: 600, color: THEME.primary }}>
                              {pain.pain_point}
                            </Typography>
                          </Stack>
                          <Typography variant="caption" sx={{ color: THEME.slate500, fontStyle: 'italic' }}>
                            "{pain.evidence}"
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  </Box>
                </Grid>
              )}
            </Grid>

            {/* Recommended Products & Services */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 3, mb: 4 }}>
              {analysis.recommended_products?.atlassian && analysis.recommended_products.atlassian.length > 0 && (
                <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid #dbeafe' }}>
                  <CardHeader avatar={<ShoppingCart sx={{ color: 'secondary.main' }} />} title={<Typography variant="h6" sx={{ fontWeight: 700 }}>Atlassian Products</Typography>} />
                  <CardContent>
                    <List dense>
                      {analysis.recommended_products.atlassian.map((product: any, idx: number) => (
                        <ListItem key={idx} sx={{ px: 0 }}>
                          <ListItemIcon><CheckCircle sx={{ color: 'secondary.main', fontSize: 20 }} /></ListItemIcon>
                          <ListItemText primary={product.product} secondary={product.relevance} />
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              )}

              {analysis.recommended_products?.servicenow && analysis.recommended_products.servicenow.length > 0 && (
                <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid #dcfce7' }}>
                  <CardHeader avatar={<ShoppingCart sx={{ color: 'success.main' }} />} title={<Typography variant="h6" sx={{ fontWeight: 700 }}>ServiceNow Modules</Typography>} />
                  <CardContent>
                    <List dense>
                      {analysis.recommended_products.servicenow.map((module: any, idx: number) => (
                        <ListItem key={idx} sx={{ px: 0 }}>
                          <ListItemIcon><CheckCircle sx={{ color: 'success.main', fontSize: 20 }} /></ListItemIcon>
                          <ListItemText primary={module.module} secondary={module.relevance} />
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              )}

              {analysis.recommended_products?.enterprise_services && analysis.recommended_products.enterprise_services.length > 0 && (
                <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid #fef3c7' }}>
                  <CardHeader avatar={<Business sx={{ color: 'warning.main' }} />} title={<Typography variant="h6" sx={{ fontWeight: 700 }}>Northstar Integrators Services</Typography>} />
                  <CardContent>
                    <List dense>
                      {analysis.recommended_products.enterprise_services.map((service: any, idx: number) => (
                        <ListItem key={idx} sx={{ px: 0 }}>
                          <ListItemIcon><CheckCircle sx={{ color: 'warning.main', fontSize: 20 }} /></ListItemIcon>
                          <ListItemText primary={service.service} secondary={service.relevance} />
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              )}
            </Box>

            {/* Stakeholders & Timeline */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 3, mb: 4 }}>
              {analysis.stakeholders && analysis.stakeholders.length > 0 && (
                <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid #e0e7ff' }}>
                  <CardHeader avatar={<Person sx={{ color: '#8b5cf6' }} />} title={<Typography variant="h6" sx={{ fontWeight: 700 }}>Stakeholders</Typography>} />
                  <CardContent>
                    <Stack spacing={1.5}>
                      {analysis.stakeholders.map((stakeholder: any, idx: number) => (
                        <Box key={idx} sx={{ p: 2, backgroundColor: '#f5f3ff', borderRadius: 2 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#5b21b6' }}>{stakeholder.name}</Typography>
                          <Typography variant="body2" sx={{ color: '#6d28d9' }}>{stakeholder.role}</Typography>
                          <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                            <Chip label={stakeholder.influence_level} size="small" sx={{ fontSize: '0.7rem' }} />
                            <Chip label={stakeholder.sentiment} size="small" color={stakeholder.sentiment === 'positive' ? 'success' : 'default'} sx={{ fontSize: '0.7rem' }} />
                          </Box>
                        </Box>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              )}

              {analysis.timeline_budget && (
                <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid #e0f2fe' }}>
                  <CardHeader avatar={<Schedule sx={{ color: '#0ea5e9' }} />} title={<Typography variant="h6" sx={{ fontWeight: 700 }}>Timeline & Budget</Typography>} />
                  <CardContent>
                    <Stack spacing={2}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Event sx={{ color: '#0ea5e9' }} />
                        <Box>
                          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>Timeline</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{analysis.timeline_budget.timeline || 'Not mentioned'}</Typography>
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <MonetizationOn sx={{ color: 'success.main' }} />
                        <Box>
                          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>Budget</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{analysis.timeline_budget.budget || 'Not mentioned'}</Typography>
                        </Box>
                      </Box>
                      <Chip
                        label={`Urgency: ${analysis.timeline_budget.urgency || 'Unknown'}`}
                        color={analysis.timeline_budget.urgency === 'high' ? 'error' : 'default'}
                        sx={{ fontWeight: 600, textTransform: 'capitalize' }}
                      />
                    </Stack>
                  </CardContent>
                </Card>
              )}
            </Box>

            {/* Opportunities Detected */}
            {detectedOpportunities.length > 0 && (
              <Card elevation={0} sx={{ mb: 4, borderRadius: 3, border: '1px solid #dbeafe' }}>
                <CardHeader
                  avatar={<TrendingUp sx={{ color: 'secondary.main' }} />}
                  title={
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      Opportunities Detected ({detectedOpportunities.length})
                    </Typography>
                  }
                />
                <CardContent>
                  <Stack spacing={2}>
                    {detectedOpportunities.map((opportunity, index) => {
                      const opportunityLabel = getOpportunityLabel(opportunity, index);
                      const confidence = getOpportunityConfidenceLabel(opportunity);
                      const summary = getOpportunitySummaryText(opportunity);
                      const details = [
                        opportunity?.timestamp && `Timestamp: ${opportunity.timestamp}`,
                        opportunity?.relatedSegment && `Segment: ${opportunity.relatedSegment}`,
                        opportunity?.similarCaseStudy && `Case study: ${opportunity.similarCaseStudy}`,
                        opportunity?.value && `Value: ${opportunity.value}`,
                      ].filter(Boolean);

                      return (
                        <Card key={opportunity?.id || index} variant="outlined" sx={{ borderRadius: 2 }}>
                          <CardContent>
                            <Stack spacing={1}>
                              <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                  {opportunityLabel}
                                </Typography>
                                {confidence && <Chip label={`Confidence ${confidence}`} size="small" color="success" />}
                              </Stack>
                              {summary && (
                                <Typography variant="body2" color="text.secondary">
                                  {summary}
                                </Typography>
                              )}
                              {details.length > 0 && (
                                <Stack spacing={0.5}>
                                  {details.map((detail, detailIndex) => (
                                    <Typography key={detailIndex} variant="caption" color="text.secondary">
                                      {detail}
                                    </Typography>
                                  ))}
                                </Stack>
                              )}
                            </Stack>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </Stack>
                </CardContent>
              </Card>
            )}

            {/* Recommended Team & Next Steps */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 3 }}>
              {analysis.recommended_team && analysis.recommended_team.length > 0 && (
                <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid #e0e7ff' }}>
                  <CardHeader avatar={<Group sx={{ color: '#8b5cf6' }} />} title={<Typography variant="h6" sx={{ fontWeight: 700 }}>Recommended Team</Typography>} />
                  <CardContent>
                    <Stack spacing={1.5}>
                      {analysis.recommended_team.map((member: any, idx: number) => (
                        <Box key={idx} sx={{ p: 2, backgroundColor: '#f5f3ff', borderRadius: 2 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#5b21b6' }}>{member.role}</Typography>
                          <Typography variant="body2" sx={{ color: '#6d28d9', mt: 0.5 }}>{member.reason}</Typography>
                          <Chip label={member.priority} size="small" sx={{ mt: 1, fontSize: '0.7rem' }} />
                        </Box>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              )}

              {analysis.next_steps && analysis.next_steps.length > 0 && (
                <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid #dbeafe' }}>
                  <CardHeader avatar={<Flag sx={{ color: 'secondary.main' }} />} title={<Typography variant="h6" sx={{ fontWeight: 700 }}>Recommended Next Steps</Typography>} />
                  <CardContent>
                    <Stack spacing={1.5}>
                      {analysis.next_steps.map((step: any, idx: number) => (
                        <Box key={idx} sx={{ p: 2, backgroundColor: 'info.light', borderRadius: 2 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1e3a8a' }}>{idx + 1}. {step.action}</Typography>
                          </Box>
                          <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                            <Chip label={step.priority} size="small" color={step.priority === 'critical' ? 'error' : 'default'} sx={{ fontSize: '0.7rem' }} />
                            <Chip label={step.timeline} size="small" sx={{ fontSize: '0.7rem' }} />
                            <Chip label={`Owner: ${step.owner}`} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                          </Box>
                        </Box>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              )}
            </Box>

            {/* Risk Factors */}
            {analysis.risk_factors && analysis.risk_factors.length > 0 && (
              <Card elevation={0} sx={{ mt: 4, borderRadius: 3, border: '1px solid #fee2e2' }}>
                <CardHeader avatar={<Warning sx={{ color: 'error.main' }} />} title={<Typography variant="h6" sx={{ fontWeight: 700 }}>Risk Factors</Typography>} />
                <CardContent>
                  <List dense>
                    {analysis.risk_factors.map((risk: string, idx: number) => (
                      <ListItem key={idx}>
                        <ListItemIcon><Warning sx={{ color: 'error.main', fontSize: 20 }} /></ListItemIcon>
                        <ListItemText primary={risk} />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            )}
          </Box>
        </Fade>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin { animation: spin 2s linear infinite; }
      `}</style>

      {/* Create Account Dialog */}
      <Dialog
        open={showCreateAccountDialog}
        onClose={() => setShowCreateAccountDialog(false)}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: 2 } } }}
      >
        <DialogTitle sx={{ fontWeight: 600 }}>Create New Account</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Account Name"
            placeholder="e.g., Acme Corporation"
            value={newAccountName}
            onChange={(e) => setNewAccountName(e.target.value)}
            sx={{ mt: 1 }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newAccountName.trim()) {
                handleCreateAccount();
              }
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setShowCreateAccountDialog(false)} disabled={creatingAccount}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateAccount}
            disabled={!newAccountName.trim() || creatingAccount}
            sx={{ bgcolor: THEME.accent }}
          >
            {creatingAccount ? 'Creating...' : 'Create Account'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Deal Dialog */}
      <Dialog
        open={showCreateDealDialog}
        onClose={() => setShowCreateDealDialog(false)}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: 2 } } }}
      >
        <DialogTitle sx={{ fontWeight: 600 }}>Create New Deal</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: THEME.slate500, mb: 2 }}>
            Creating deal for account: <strong>{selectedAccountName}</strong>
          </Typography>
          <TextField
            autoFocus
            fullWidth
            label="Deal / Opportunity Name"
            placeholder="e.g., Enterprise License Deal"
            value={newDealName}
            onChange={(e) => setNewDealName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newDealName.trim()) {
                handleCreateDeal();
              }
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setShowCreateDealDialog(false)} disabled={creatingDeal}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateDeal}
            disabled={!newDealName.trim() || creatingDeal}
            sx={{ bgcolor: THEME.accent }}
          >
            {creatingDeal ? 'Creating...' : 'Create Deal'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdvancedTranscriptAnalysis;
