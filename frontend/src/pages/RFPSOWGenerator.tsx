import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { trackFeature, trackExport } from '../hooks/useAnalytics';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActionArea,
  Button,
  IconButton,
  Stack,
  Tab,
  Tabs,
  Paper,
  CircularProgress,
  Alert,
  TextField,
  MenuItem,
  Divider,
  Chip,
  InputAdornment,
  Tooltip,
  Fade,
  alpha,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import {
  CloudUpload,
  Description,
  Article as ProposalIcon,
  Analytics,
  AutoFixHigh,
  ContentCopy,
  Download,
  Refresh,
  CheckCircle,
  HourglassTop,
  ErrorOutline,
  Search,
  Link as LinkIcon,
  CalendarToday as CalendarIcon,
  Check,
  Science,
  AssignmentOutlined,
  History as HistoryIcon,
  Cancel as CancelIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { COLORS } from '../styles/pageStyles';
import { apiGet, apiPatch, apiPost } from '../utils/api';
import { getAuthToken } from '../utils/authToken';
import { useProposalStore } from '../store';
import type { ProposalJobSummary, RFPResearchHistoryItem } from '../store/proposalStore';
import RFPResearchPanel from '../components/RFPResearchPanel';
import SaveBookmarkButton from '../components/SaveBookmarkButton';
import ExpiryBadge from '../components/ExpiryBadge';
import FeedbackWidget from '../components/FeedbackWidget';

interface Deal {
  deal_id: string;
  company_name: string;
  opportunity_name: string;
}

const RFPSOWGenerator: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  // Single tab state: 0 = Enhanced RFP Analysis, 1 = RFP Research, 2 = Proposal History
  const [activeTab, setActiveTab] = useState(0);
  const {
    selectedFile,
    setSelectedFile,
    loading,
    analysisType,
    error,
    setError,
    jobs,
    jobsLoading,
    jobDetailLoading,
    selectedJob,
    selectedJobId,
    fetchJobs,
    fetchJobDetail,
    createJob,
    clearSelectedJob,
    cancelJob,
    deleteJob,
    // RFP Research
    rfpResearchResult,
    rfpResearchLoading,
    rfpResearchError,
    rfpResearchLogs,
    startRFPResearchWithLogs,
    clearRFPResearch,
    // RFP Research History
    rfpResearchHistory,
    rfpResearchHistoryLoading,
    selectedResearch,
    selectedResearchLoading,
    saveRFPResearch,
    fetchRFPResearchHistory,
    fetchRFPResearchDetail,
    deleteRFPResearch,
    clearSelectedResearch,
  } = useProposalStore();

  const [cancellingJobId, setCancellingJobId] = useState<string | null>(null);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);
  const [deleteProposalDialogOpen, setDeleteProposalDialogOpen] = useState(false);
  const [deleteProposalTargetId, setDeleteProposalTargetId] = useState<string | null>(null);

  const [researchFile, setResearchFile] = useState<File | null>(null);
  const [analysisPrompt, setAnalysisPrompt] = useState<string>('');
  const [researchSaved, setResearchSaved] = useState(false);
  const [savedResearchId, setSavedResearchId] = useState<string | null>(null);
  const [generatingSow, setGeneratingSow] = useState(false);
  const [sowJobId, setSowJobId] = useState<string | null>(null);
  const [deletingResearchId, setDeletingResearchId] = useState<string | null>(null);

  const [jobMessage, setJobMessage] = useState<string | null>(null);
  const [linkedMeetingId, setLinkedMeetingId] = useState('');
  const [jobSearchQuery, setJobSearchQuery] = useState('');
  const [jobDateFilter, setJobDateFilter] = useState<'all' | '7' | '30' | '90'>('30');
  const [jobAccountFilter, setJobAccountFilter] = useState<'all' | 'unlinked' | string>('all');
  const [deals, setDeals] = useState<Deal[]>([]);
  const [dealsLoading, setDealsLoading] = useState(false);
  const [dealSelections, setDealSelections] = useState<Record<string, string>>({});
  const [linkingJobId, setLinkingJobId] = useState<string | null>(null);
  const [linkSuccess, setLinkSuccess] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);


  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const meetingIdParam = params.get('meetingId');
    if (meetingIdParam) {
      setLinkedMeetingId(meetingIdParam);
    }
    const jobIdParam = params.get('jobId');
    if (jobIdParam) {
      fetchJobDetail(jobIdParam);
    }
  }, [location.search, fetchJobDetail]);

  useEffect(() => {
    let isMounted = true;
    const loadJobs = async () => {
      await fetchJobs();
    };
    loadJobs();

    const interval = setInterval(() => {
      if (isMounted) {
        fetchJobs();
      }
    }, 15000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [fetchJobs]);

  useEffect(() => {
    if (!selectedJobId && jobs.length > 0) {
      fetchJobDetail(jobs[0].jobId);
    }
  }, [jobs, selectedJobId, fetchJobDetail]);

  useEffect(() => {
    let mounted = true;
    const loadDeals = async () => {
      setDealsLoading(true);
      try {
        const response = await apiGet('/api/deals');
        if (!mounted) return;
        setDeals(response.data || []);
      } catch (err) {
        console.error('Failed to load deals list for proposal linking', err);
      } finally {
        if (mounted) {
          setDealsLoading(false);
        }
      }
    };
    loadDeals();
    return () => {
      mounted = false;
    };
  }, []);

  // Fetch RFP research history on mount
  useEffect(() => {
    fetchRFPResearchHistory();
  }, [fetchRFPResearchHistory]);

  // Auto-save research results when they complete
  useEffect(() => {
    if (rfpResearchResult && !researchSaved && !rfpResearchLoading) {
      const save = async () => {
        const researchId = await saveRFPResearch(
          rfpResearchResult,
          researchFile?.name,
          analysisPrompt || undefined
        );
        if (researchId) {
          setResearchSaved(true);
          setSavedResearchId(researchId);
        }
      };
      save();
    }
  }, [rfpResearchResult, researchSaved, rfpResearchLoading, saveRFPResearch, researchFile, analysisPrompt]);

  // Reset saved flag when starting new research
  useEffect(() => {
    if (rfpResearchLoading) {
      setResearchSaved(false);
      setSavedResearchId(null);
      setSowJobId(null);
    }
  }, [rfpResearchLoading]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
      setJobMessage(null);
      setError(null);
      clearSelectedJob();
    }
  };

  const handleJobSubmission = async (type: 'quick' | 'enhanced') => {
    if (!selectedFile) {
      setError('Please select a file first.');
      return;
    }

    setJobMessage(null);
    const result = await createJob(type, { meetingId: linkedMeetingId || undefined });
    if (result?.jobId) {
      trackFeature('proposal_generation', `proposal_${type}_submitted`, { jobId: result.jobId });
      setJobMessage(`Proposal job ${result.jobId} queued. Track progress in the history section below.`);
      await fetchJobDetail(result.jobId);
    }
  };

  // Utility to download text content as file
  // Utility to download text content as file
  const downloadText = (filename: string, content: string) => {
    const ext = filename.split('.').pop() || 'txt';
    trackExport(ext, 1, 'proposal_download');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // quick inline feedback
      setError(null);
      console.log('Copied to clipboard');
    } catch (e) {
      setError('Failed to copy to clipboard');
      console.error(e);
    }
  };

  const formatDate = (value?: string | Date | null) => {
    if (!value) return 'N/A';
    const date = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) return 'N/A';
    return date.toLocaleString();
  };

  const formatStep = (step?: string | null) => {
    if (!step) return 'Processing';
    return step
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  };

  const getStatusConfig = (status: 'processing' | 'completed' | 'error' | 'cancelled') => {
    switch (status) {
      case 'completed':
        return { label: 'Completed', bgcolor: 'rgba(16, 185, 129, 0.15)', color: 'success.main', icon: <CheckCircle fontSize="small" /> };
      case 'error':
        return { label: 'Failed', bgcolor: 'rgba(239, 68, 68, 0.15)', color: 'error.main', icon: <ErrorOutline fontSize="small" /> };
      case 'cancelled':
        return { label: 'Cancelled', bgcolor: 'rgba(245, 158, 11, 0.15)', color: 'warning.main', icon: <CancelIcon fontSize="small" /> };
      default:
        return { label: 'Processing', bgcolor: 'rgba(59, 130, 246, 0.15)', color: 'secondary.main', icon: <HourglassTop fontSize="small" /> };
    }
  };

  const dealAccountNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    deals.forEach((deal) => {
      if (deal.deal_id) {
        map[deal.deal_id] = deal.company_name;
      }
    });
    return map;
  }, [deals]);

  const accountOptions = useMemo(() => {
    const names = new Set<string>();
    deals.forEach((deal) => {
      if (deal.company_name) {
        names.add(deal.company_name);
      }
    });
    return Array.from(names).sort();
  }, [deals]);

  const filteredJobsByDate = useMemo(() => {
    if (jobDateFilter === 'all') {
      return jobs;
    }
    const days = Number(jobDateFilter);
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return jobs.filter((job) => {
      const timestamp = new Date(job.createdAt).getTime();
      return Number.isFinite(timestamp) && timestamp >= cutoff;
    });
  }, [jobs, jobDateFilter]);

  const searchFilteredJobs = useMemo(() => {
    if (!jobSearchQuery.trim()) {
      return filteredJobsByDate;
    }
    const query = jobSearchQuery.toLowerCase();
    return filteredJobsByDate.filter((job) => {
      const values = [
        job.fileName,
        job.analysisType,
        job.status,
        job.linkedDealName,
        job.linkedAccountName,
        job.metadata?.clientContext?.companyName,
        job.metadata?.projectName,
      ];
      return values.some(
        (value) => typeof value === 'string' && value.toLowerCase().includes(query)
      );
    });
  }, [filteredJobsByDate, jobSearchQuery]);

  const accountFilteredJobs = useMemo(() => {
    if (jobAccountFilter === 'all') {
      return searchFilteredJobs;
    }
    if (jobAccountFilter === 'unlinked') {
      return searchFilteredJobs.filter((job) => !job.linkedDealId);
    }
    return searchFilteredJobs.filter((job) => {
      const accountName =
        job.linkedAccountName ||
        (job.linkedDealId ? dealAccountNameMap[job.linkedDealId] : undefined);
      return accountName === jobAccountFilter;
    });
  }, [searchFilteredJobs, jobAccountFilter, dealAccountNameMap]);

  const linkedJobs = useMemo(
    () => accountFilteredJobs.filter((job) => Boolean(job.linkedDealId)),
    [accountFilteredJobs]
  );

  const renderJobDetailSection = () => (
    <Box sx={{ mt: 6 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary', mb: 2 }}>
        Proposal Output
      </Typography>

      {jobDetailLoading && (
        <Paper sx={{ p: 4, textAlign: 'center', border: '1px dashed rgba(0, 35, 72, 0.15)' }}>
          <CircularProgress size={28} />
        </Paper>
      )}

      {!jobDetailLoading && !selectedJob && (
        <Alert severity="info">
          Select a proposal job from the history above to view its output.
        </Alert>
      )}

      {selectedJob && (
        <Paper id="proposal-section" sx={{ p: 3, borderRadius: 3, border: '1px solid rgba(0, 35, 72, 0.08)', bgcolor: '#FFFFFF' }}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={1}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {selectedJob.fileName || 'Uploaded RFP'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Created {formatDate(selectedJob.createdAt)}
              </Typography>
              {selectedJob.completedAt && (
                <Typography variant="body2" color="text.secondary">
                  Completed {formatDate(selectedJob.completedAt)}
                </Typography>
              )}
            </Box>
            <Chip
              icon={getStatusConfig(selectedJob.status).icon}
              label={getStatusConfig(selectedJob.status).label}
              sx={{
                bgcolor: getStatusConfig(selectedJob.status).bgcolor,
                color: getStatusConfig(selectedJob.status).color,
                fontWeight: 600,
              }}
            />
          </Stack>

          <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
            {selectedJob.status === 'processing' && (
              <Button
                variant="outlined"
                color="error"
                startIcon={cancellingJobId === selectedJob.jobId ? <CircularProgress size={16} /> : <CancelIcon />}
                onClick={() => handleCancelJob(selectedJob.jobId)}
                disabled={cancellingJobId === selectedJob.jobId}
              >
                {cancellingJobId === selectedJob.jobId ? 'Cancelling...' : 'Cancel'}
              </Button>
            )}
            {selectedJob.status !== 'processing' && (
              <Button
                variant="outlined"
                color="error"
                startIcon={deletingJobId === selectedJob.jobId ? <CircularProgress size={16} /> : <DeleteIcon />}
                onClick={() => openDeleteJobDialog(selectedJob.jobId)}
                disabled={deletingJobId === selectedJob.jobId}
              >
                {deletingJobId === selectedJob.jobId ? 'Deleting...' : 'Delete'}
              </Button>
            )}
          </Stack>

          <Divider sx={{ my: 2 }} />

          <Stack spacing={1.5} sx={{ mb: 3 }}>
            <Typography variant="body2" color="text.secondary">
              Analysis Type: {selectedJob.analysisType}
            </Typography>
            {selectedJob.requestedBy && (
              <Typography variant="body2" color="text.secondary">
                Requested By: {selectedJob.requestedBy}
              </Typography>
            )}
            {selectedJob.metadata?.textLength && (
              <Typography variant="body2" color="text.secondary">
                Extracted Characters: {selectedJob.metadata.textLength.toLocaleString()}
              </Typography>
            )}
          </Stack>

          {selectedJob.status === 'processing' && (
            <Alert severity="info" icon={<HourglassTop fontSize="small" />} sx={{ mb: 3 }}>
              Solution proposal generation in progress
              {selectedJob.currentStep ? ` — ${formatStep(selectedJob.currentStep)}` : ''}. This page updates automatically once it completes.
            </Alert>
          )}

          {selectedJob.status === 'error' && selectedJob.errorMessage && (
            <Alert severity="error" icon={<ErrorOutline fontSize="small" />} sx={{ mb: 3 }}>
              {selectedJob.errorMessage}
            </Alert>
          )}

          {selectedJob.status === 'completed' && selectedJob.proposalData && (
            <>
              {selectedJob.proposalData.analysis && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle1" gutterBottom>Analysis Summary</Typography>
                  <Paper sx={{ p: 2 }}>{renderAnalysis(selectedJob.proposalData.analysis)}</Paper>
                </Box>
              )}

              <Typography variant="subtitle1" gutterBottom>Proposal</Typography>
              <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                <Button
                  variant="outlined"
                  startIcon={<ContentCopy />}
                  disabled={!selectedJob.proposalData.proposal}
                  onClick={() => selectedJob.proposalData.proposal && copyToClipboard(selectedJob.proposalData.proposal)}
                >
                  Copy
                </Button>
                <Button
                  variant="contained"
                  startIcon={<Download />}
                  disabled={!selectedJob.proposalData.proposal}
                  onClick={() => selectedJob.proposalData.proposal && downloadText('proposal.txt', selectedJob.proposalData.proposal)}
                >
                  Download
                </Button>
              </Stack>
              <Paper variant="outlined" sx={{ p: 2, mb: 3, whiteSpace: 'pre-wrap' }}>
                <Typography variant="body1">
                  {selectedJob.proposalData.proposal || 'Proposal will appear here once available.'}
                </Typography>
              </Paper>

              {selectedJob.proposalData.outline && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle1" gutterBottom>Outline</Typography>
                  <Paper variant="outlined" sx={{ p: 2, whiteSpace: 'pre-wrap' }}>
                    <Typography variant="body2">{selectedJob.proposalData.outline}</Typography>
                  </Paper>
                </Box>
              )}

              {selectedJob.proposalData.review && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle1" gutterBottom>Review Notes</Typography>
                  <Paper variant="outlined" sx={{ p: 2, whiteSpace: 'pre-wrap' }}>
                    <Typography variant="body2">{selectedJob.proposalData.review}</Typography>
                  </Paper>
                </Box>
              )}

              {selectedJob.proposalData.metadata && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle1" gutterBottom>Metadata</Typography>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                      {JSON.stringify(selectedJob.proposalData.metadata, null, 2)}
                    </pre>
                  </Paper>
                </Box>
              )}

              {selectedJob.proposalData.clientContext && (
                <Box>
                  <Typography variant="subtitle1" gutterBottom>Client Context</Typography>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                      {JSON.stringify(selectedJob.proposalData.clientContext, null, 2)}
                    </pre>
                  </Paper>
                </Box>
              )}
              
              <Box sx={{ mt: 4 }}>
                <FeedbackWidget 
                  category="proposal_generation" 
                  referenceId={selectedJob.jobId} 
                  metadata={{ analysisType: selectedJob.analysisType }} 
                />
              </Box>
            </>
          )}
        </Paper>
      )}
    </Box>
  );

  const unlinkedJobs = useMemo(
    () => accountFilteredJobs.filter((job) => !job.linkedDealId),
    [accountFilteredJobs]
  );

  const formatCountLabel = (count: number) => `${count} ${count === 1 ? 'job' : 'jobs'}`;

  const getJobCompanyName = (job: ProposalJobSummary) =>
    job.linkedAccountName ||
    (job.linkedDealId ? dealAccountNameMap[job.linkedDealId] : undefined) ||
    job.metadata?.clientContext?.companyName ||
    job.metadata?.clientContext?.clientName ||
    job.metadata?.projectName ||
    job.fileName ||
    'Proposal';

  const handleDealSelection = (jobId: string, dealId: string) => {
    setDealSelections((prev) => ({ ...prev, [jobId]: dealId }));
  };

  const getDealDisplayLabel = (dealId?: string | null) => {
    if (!dealId) return '';
    const match = deals.find((deal) => deal.deal_id === dealId);
    if (!match) return '';
    return `${match.opportunity_name} — ${match.company_name}`;
  };

  const handleCancelJob = async (jobId: string) => {
    setCancellingJobId(jobId);
    try {
      await cancelJob(jobId);
    } finally {
      setCancellingJobId(null);
    }
  };

  const openDeleteJobDialog = (jobId: string) => {
    setDeleteProposalTargetId(jobId);
    setDeleteProposalDialogOpen(true);
  };

  const closeDeleteJobDialog = () => {
    if (deletingJobId) return;
    setDeleteProposalDialogOpen(false);
    setDeleteProposalTargetId(null);
  };

  const handleDeleteJob = async () => {
    if (!deleteProposalTargetId) return;
    setDeletingJobId(deleteProposalTargetId);
    try {
      await deleteJob(deleteProposalTargetId);
    } finally {
      setDeletingJobId(null);
      setDeleteProposalDialogOpen(false);
      setDeleteProposalTargetId(null);
    }
  };

  const handleDownloadDocx = async () => {
    if (!savedResearchId) return;
    const token = getAuthToken();
    const res = await fetch(
      `${(window as any).__API_BASE__ || ''}/api/proposal/rfp-research/${savedResearchId}/download-docx`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] ?? 'rfp-response.docx';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleGenerateSow = async () => {
    if (!savedResearchId) return;
    setGeneratingSow(true);
    try {
      const result = await apiPost('/api/proposal/generate-sow-from-research', { researchId: savedResearchId });
      if (result?.jobId) {
        setSowJobId(result.jobId);
      }
    } finally {
      setGeneratingSow(false);
    }
  };

  const handleDeleteResearch = async (researchId: string) => {
    setDeletingResearchId(researchId);
    try {
      await deleteRFPResearch(researchId);
    } finally {
      setDeletingResearchId(null);
    }
  };

  const handleViewResearch = async (research: RFPResearchHistoryItem) => {
    await fetchRFPResearchDetail(research.researchId);
  };

  const handleLinkJobToDeal = async (jobId: string) => {
    const dealId = dealSelections[jobId];
    if (!dealId) {
      setLinkError('Please select a deal before linking.');
      setTimeout(() => setLinkError(null), 4000);
      return;
    }

    setLinkingJobId(jobId);
    setLinkError(null);
    setLinkSuccess(null);

    try {
      await apiPatch(`/api/proposal/jobs/${jobId}/link-deal`, { dealId });
      setLinkSuccess('Proposal job linked to deal successfully.');
      setTimeout(() => setLinkSuccess(null), 4000);
      await fetchJobs();
      await fetchJobDetail(jobId);
    } catch (err: any) {
      setLinkError(err?.message || 'Failed to link proposal job to deal.');
      setTimeout(() => setLinkError(null), 5000);
    } finally {
      setLinkingJobId(null);
    }
  };

  const renderJobCard = (job: ProposalJobSummary) => {
    const status = getStatusConfig(job.status);
    const companyName = getJobCompanyName(job);
    const selectionValue = dealSelections[job.jobId] || '';
    const isSelected = selectedJobId === job.jobId;

    return (
      <Card
        key={job.jobId}
        elevation={0}
        sx={{
          bgcolor: '#FFFFFF',
          border: `1px solid ${isSelected ? '#00A48C' : 'rgba(0, 35, 72, 0.08)'}`,
          borderRadius: 3,
          transition: 'all 0.2s',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: '0 18px 35px rgba(0, 35, 72, 0.12)',
            borderColor: '#00A48C',
          },
        }}
      >
        <CardActionArea onClick={() => fetchJobDetail(job.jobId)} sx={{ p: 3 }}>
          <CardContent sx={{ p: 0 }}>
            <Stack spacing={2}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: 2,
                    bgcolor: 'rgba(124, 58, 237, 0.14)',
                    color: '#7c3aed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ProposalIcon sx={{ fontSize: 20 }} />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="subtitle1" sx={{ color: 'text.primary', fontWeight: 600 }} noWrap>
                    {job.fileName || 'Uploaded RFP'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {companyName}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip
                    icon={status.icon}
                    label={status.label}
                    sx={{ bgcolor: status.bgcolor, color: status.color, fontWeight: 600 }}
                  />
                  {job.status === 'processing' && (
                    <Tooltip title="Cancel this job">
                      <span>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancelJob(job.jobId);
                          }}
                          disabled={cancellingJobId === job.jobId}
                          sx={{
                            color: 'error.main',
                            '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.1)' },
                          }}
                        >
                          {cancellingJobId === job.jobId ? (
                            <CircularProgress size={18} sx={{ color: 'error.main' }} />
                          ) : (
                            <CancelIcon fontSize="small" />
                          )}
                        </IconButton>
                      </span>
                    </Tooltip>
                  )}
                  {job.status !== 'processing' && (
                    <Tooltip title="Delete this job">
                      <span>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDeleteJobDialog(job.jobId);
                          }}
                          disabled={deletingJobId === job.jobId}
                          sx={{
                            color: 'error.main',
                            '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.1)' },
                          }}
                        >
                          {deletingJobId === job.jobId ? (
                            <CircularProgress size={18} sx={{ color: 'error.main' }} />
                          ) : (
                            <DeleteIcon fontSize="small" />
                          )}
                        </IconButton>
                      </span>
                    </Tooltip>
                  )}
                  <Button size="small" onClick={(e) => { e.stopPropagation(); fetchJobDetail(job.jobId); }}>
                    View
                  </Button>
                </Stack>
              </Stack>

              <Stack spacing={1} sx={{ color: '#1A385E' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CalendarIcon sx={{ fontSize: 16, color: '#C90C61' }} />
                  <Typography variant="caption">
                    Created {formatDate(job.createdAt)}
                  </Typography>
                </Box>
                {job.completedAt && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CalendarIcon sx={{ fontSize: 16, color: '#00806B' }} />
                    <Typography variant="caption">
                      Completed {formatDate(job.completedAt)}
                    </Typography>
                  </Box>
                )}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Description sx={{ fontSize: 16, color: '#005849' }} />
                  <Typography variant="caption">
                    {job.analysisType === 'quick' ? 'Quick analysis' : 'Enhanced analysis'}
                  </Typography>
                </Box>
              </Stack>

              <Divider />

              {job.linkedDealId ? (
                <Chip
                  icon={<LinkIcon />}
                  label={`Linked to ${job.linkedDealName || 'deal'}`}
                  sx={{
                    bgcolor: 'rgba(0, 164, 140, 0.15)',
                    color: '#00A48C',
                    fontWeight: 600,
                  }}
                />
              ) : (
                <Box
                  sx={{ display: 'flex', gap: 1, alignItems: 'center' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <TextField
                    select
                    size="small"
                    value={selectionValue}
                    onChange={(e) => handleDealSelection(job.jobId, e.target.value)}
                    placeholder="Select deal"
                    sx={{
                      flex: 1,
                      '& .MuiOutlinedInput-root': {
                        bgcolor: '#FFFDF6',
                        '& fieldset': { borderColor: 'rgba(0, 35, 72, 0.12)' },
                        '&:hover fieldset': { borderColor: '#00A48C' },
                        '&.Mui-focused fieldset': { borderColor: '#C90C61' },
                      },
                    }}
                    SelectProps={{
                      displayEmpty: true,
                      renderValue: (value) =>
                        value
                          ? getDealDisplayLabel(value as string) || 'Linked deal'
                          : (
                              <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                                Link to a deal
                              </Typography>
                            ),
                    }}
                  >
                    <MenuItem value="" disabled>
                      <em>{dealsLoading ? 'Loading deals…' : 'Link to deal…'}</em>
                    </MenuItem>
                    {deals.map((deal) => (
                      <MenuItem key={deal.deal_id} value={deal.deal_id}>
                        {deal.opportunity_name} — {deal.company_name}
                      </MenuItem>
                    ))}
                  </TextField>
                  <Tooltip title="Link to Deal">
                    <span>
                      <IconButton
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLinkJobToDeal(job.jobId);
                        }}
                        disabled={!selectionValue || linkingJobId === job.jobId}
                        sx={{ color: '#005849', '&.Mui-disabled': { color: 'text.disabled' } }}
                      >
                        {linkingJobId === job.jobId ? (
                          <CircularProgress size={18} sx={{ color: '#00A48C' }} />
                        ) : (
                          <Check />
                        )}
                      </IconButton>
                    </span>
                  </Tooltip>
                </Box>
              )}
            </Stack>
          </CardContent>
        </CardActionArea>
      </Card>
    );
  };

  const renderHistorySection = () => (
    <Box sx={{ mt: 6 }}>
      <Paper
        sx={{
          p: 3,
          mb: 3,
          bgcolor: '#FFFFFF',
          borderRadius: 3,
          border: '1px solid rgba(0, 35, 72, 0.08)',
          boxShadow: '0 18px 35px rgba(0, 35, 72, 0.06)',
        }}
      >
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="h5" sx={{ color: 'text.primary', fontWeight: 700 }}>
                Proposal Job History
              </Typography>
              <Typography variant="body2" sx={{ color: '#1A385E' }}>
                Review {jobs.length} generated proposals and link them to deals.
              </Typography>
            </Box>
            <Tooltip title="Refresh history">
              <span>
                <IconButton
                  onClick={() => fetchJobs()}
                  disabled={jobsLoading}
                  sx={{
                    color: '#00806B',
                    border: '1px solid rgba(0, 164, 140, 0.3)',
                    boxShadow: '0 6px 12px rgba(0, 164, 140, 0.15)',
                  }}
                >
                  <Refresh />
                </IconButton>
              </span>
            </Tooltip>
          </Box>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              fullWidth
              placeholder="Search by filename, company, or status..."
              value={jobSearchQuery}
              onChange={(e) => setJobSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search sx={{ color: '#00806B' }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: '#FFFDF6',
                  '& fieldset': { borderColor: 'rgba(0, 35, 72, 0.12)' },
                  '&:hover fieldset': { borderColor: '#00A48C' },
                  '&.Mui-focused fieldset': { borderColor: '#C90C61' },
                },
              }}
            />
            <TextField
              select
              label="Date range"
              value={jobDateFilter}
              onChange={(e) => setJobDateFilter(e.target.value as 'all' | '7' | '30' | '90')}
              sx={{ minWidth: { xs: '100%', md: 200 } }}
            >
              <MenuItem value="7">Last 7 days</MenuItem>
              <MenuItem value="30">Last 30 days</MenuItem>
              <MenuItem value="90">Last 90 days</MenuItem>
              <MenuItem value="all">All time</MenuItem>
            </TextField>
            <TextField
              select
              label="Account"
              value={jobAccountFilter}
              onChange={(e) => setJobAccountFilter(e.target.value as typeof jobAccountFilter)}
              sx={{ minWidth: { xs: '100%', md: 220 } }}
            >
              <MenuItem value="all">All accounts</MenuItem>
              <MenuItem value="unlinked">Unlinked only</MenuItem>
              {accountOptions.map((name) => (
                <MenuItem key={name} value={name}>
                  {name}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </Stack>
      </Paper>

      {linkError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setLinkError(null)}>
          {linkError}
        </Alert>
      )}
      {linkSuccess && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setLinkSuccess(null)}>
          {linkSuccess}
        </Alert>
      )}

      {jobsLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={32} />
        </Box>
      ) : accountFilteredJobs.length === 0 ? (
        <Paper
          sx={{
            p: 6,
            textAlign: 'center',
            border: '1px dashed rgba(0, 35, 72, 0.15)',
            bgcolor: '#FFFFFF',
          }}
        >
          <Description sx={{ fontSize: 48, color: '#C90C61', mb: 1 }} />
          <Typography variant="h6" sx={{ color: 'text.primary', mb: 1 }}>
            {jobs.length === 0 ? 'No proposal jobs yet' : 'No jobs match your filters'}
          </Typography>
          <Typography variant="body2" sx={{ color: '#1A385E' }}>
            {jobs.length === 0
              ? 'Upload an RFP to generate your first proposal.'
              : 'Adjust the search, date, or account filters to see more jobs.'}
          </Typography>
        </Paper>
      ) : (
        <Stack spacing={4}>
          {unlinkedJobs.length > 0 && (
            <Box>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: { xs: 'flex-start', md: 'center' },
                  mb: 2,
                  flexDirection: { xs: 'column', md: 'row' },
                  gap: 1,
                }}
              >
                <Box>
                  <Typography variant="h6" sx={{ color: 'text.primary', fontWeight: 600 }}>
                    Unlinked Proposals
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#1A385E' }}>
                    Assign these drafts to a deal to keep your pipeline organized.
                  </Typography>
                </Box>
                <Chip
                  label={formatCountLabel(unlinkedJobs.length)}
                  sx={{
                    bgcolor: 'rgba(0, 164, 140, 0.12)',
                    color: '#00806B',
                    fontWeight: 600,
                  }}
                />
              </Box>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
                  gap: 3,
                }}
              >
                {unlinkedJobs.map(renderJobCard)}
              </Box>
            </Box>
          )}

          {linkedJobs.length > 0 && (
            <Box>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: { xs: 'flex-start', md: 'center' },
                  mb: 2,
                  flexDirection: { xs: 'column', md: 'row' },
                  gap: 1,
                }}
              >
                <Box>
                  <Typography variant="h6" sx={{ color: 'text.primary', fontWeight: 600 }}>
                    Linked Proposals
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#1A385E' }}>
                    Completed jobs already attached to deals.
                  </Typography>
                </Box>
                <Chip
                  label={formatCountLabel(linkedJobs.length)}
                  sx={{
                    bgcolor: 'rgba(0, 35, 72, 0.08)',
                    color: 'text.primary',
                    fontWeight: 600,
                  }}
                />
              </Box>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
                  gap: 3,
                }}
              >
                {linkedJobs.map(renderJobCard)}
              </Box>
            </Box>
          )}
        </Stack>
      )}
    </Box>
  );

  // Helper function to render analysis object
  const renderAnalysis = (analysis: any) => {
    if (!analysis) return 'No analysis available';
    
    if (typeof analysis === 'string') {
      return <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>{analysis}</Typography>;
    }
    
    // If it's an object, format it nicely
    return (
      <Stack spacing={2}>
        {analysis.project_overview && (
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: 'primary.main' }}>
              Project Overview
            </Typography>
            <Typography variant="body2">{analysis.project_overview}</Typography>
          </Box>
        )}
        
        {analysis.key_objectives && (
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: 'primary.main' }}>
              Key Objectives
            </Typography>
            <Typography variant="body2" component="div">
              {Array.isArray(analysis.key_objectives) ? (
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {analysis.key_objectives.map((obj: string, idx: number) => (
                    <li key={idx}>{obj}</li>
                  ))}
                </ul>
              ) : (
                analysis.key_objectives
              )}
            </Typography>
          </Box>
        )}

        {analysis.technical_requirements && (
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: 'primary.main' }}>
              Technical Requirements
            </Typography>
            <Typography variant="body2" component="div">
              {Array.isArray(analysis.technical_requirements) ? (
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {analysis.technical_requirements.map((req: string, idx: number) => (
                    <li key={idx}>{req}</li>
                  ))}
                </ul>
              ) : (
                analysis.technical_requirements
              )}
            </Typography>
          </Box>
        )}

        {analysis.deliverables && (
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: 'primary.main' }}>
              Deliverables
            </Typography>
            <Typography variant="body2" component="div">
              {Array.isArray(analysis.deliverables) ? (
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {analysis.deliverables.map((del: string, idx: number) => (
                    <li key={idx}>{del}</li>
                  ))}
                </ul>
              ) : (
                analysis.deliverables
              )}
            </Typography>
          </Box>
        )}

        {analysis.timeline_indicators && (
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: 'primary.main' }}>
              Timeline
            </Typography>
            <Typography variant="body2">{analysis.timeline_indicators}</Typography>
          </Box>
        )}

        {analysis.budget_indicators && (
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: 'primary.main' }}>
              Budget
            </Typography>
            <Typography variant="body2">{analysis.budget_indicators}</Typography>
          </Box>
        )}

        {analysis.complexity_level && (
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: 'primary.main' }}>
              Complexity Level
            </Typography>
            <Typography variant="body2">{analysis.complexity_level}</Typography>
          </Box>
        )}

        {analysis.industry_sector && (
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: 'primary.main' }}>
              Industry Sector
            </Typography>
            <Typography variant="body2">{analysis.industry_sector}</Typography>
          </Box>
        )}

        {analysis.stakeholders && (
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: 'primary.main' }}>
              Stakeholders
            </Typography>
            <Typography variant="body2" component="div">
              {Array.isArray(analysis.stakeholders) ? (
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {analysis.stakeholders.map((stakeholder: string, idx: number) => (
                    <li key={idx}>{stakeholder}</li>
                  ))}
                </ul>
              ) : (
                analysis.stakeholders
              )}
            </Typography>
          </Box>
        )}

        {analysis.success_criteria && (
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: 'primary.main' }}>
              Success Criteria
            </Typography>
            <Typography variant="body2" component="div">
              {Array.isArray(analysis.success_criteria) ? (
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {analysis.success_criteria.map((criteria: string, idx: number) => (
                    <li key={idx}>{criteria}</li>
                  ))}
                </ul>
              ) : (
                analysis.success_criteria
              )}
            </Typography>
          </Box>
        )}

        {analysis.risks_identified && (
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: 'primary.main' }}>
              Risks Identified
            </Typography>
            <Typography variant="body2" component="div">
              {Array.isArray(analysis.risks_identified) ? (
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {analysis.risks_identified.map((risk: string, idx: number) => (
                    <li key={idx}>{risk}</li>
                  ))}
                </ul>
              ) : (
                analysis.risks_identified
              )}
            </Typography>
          </Box>
        )}

        {analysis.compliance_requirements && (
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: 'primary.main' }}>
              Compliance Requirements
            </Typography>
            <Typography variant="body2" component="div">
              {Array.isArray(analysis.compliance_requirements) ? (
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {analysis.compliance_requirements.map((req: string, idx: number) => (
                    <li key={idx}>{req}</li>
                  ))}
                </ul>
              ) : (
                analysis.compliance_requirements
              )}
            </Typography>
          </Box>
        )}
      </Stack>
    );
  };

  return (
    <Fade in timeout={400}>
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
    <Box sx={{ maxWidth: 1400, mx: 'auto', px: { xs: 2, md: 4 }, py: 4 }}>
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
            <AssignmentOutlined sx={{ fontSize: 32, color: 'white' }} />
          </Box>
          <Box>
            <Typography variant="h4" sx={{ color: 'white', fontWeight: 700, mb: 0.5 }}>
              Proposal Generator
            </Typography>
            <Typography variant="body1" sx={{ color: alpha('#fff', 0.85) }}>
              Upload an RFP to generate a tailored solution proposal, or run AI-powered Q&A research on requirements
            </Typography>
          </Box>
        </Stack>
      </Paper>

      {/* Single Tab Navigation */}
      <Paper
        elevation={0}
        sx={{
          mb: 3,
          borderRadius: 2,
          border: '1px solid rgba(0, 35, 72, 0.08)',
          bgcolor: 'background.paper',
          overflow: 'hidden',
        }}
      >
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          sx={{
            px: 2,
            borderBottom: '1px solid rgba(0, 35, 72, 0.08)',
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.875rem',
              color: 'text.secondary',
              minHeight: 52,
              '&.Mui-selected': {
                color: COLORS.secondary,
              },
            },
            '& .MuiTabs-indicator': {
              bgcolor: 'primary.main',
              height: 3,
              borderRadius: '3px 3px 0 0',
            },
          }}
        >
          <Tab
            icon={<Analytics sx={{ fontSize: 18 }} />}
            iconPosition="start"
            label="Generate Proposal"
            sx={{ gap: 1 }}
          />
          <Tab
            icon={<Science sx={{ fontSize: 18 }} />}
            iconPosition="start"
            label="Research & Q&A"
            sx={{ gap: 1 }}
          />
          <Tab
            icon={<HistoryIcon sx={{ fontSize: 18 }} />}
            iconPosition="start"
            label="History"
            sx={{ gap: 1 }}
          />
        </Tabs>

        {/* Tab Content */}
        <Box sx={{ p: 3 }}>
          {/* RFP Analysis Tab (Tab 0) */}
          {activeTab === 0 && (
            <>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  flexWrap: 'wrap',
                  gap: 2,
                  mb: 3,
                }}
              >
                <TextField
                  label="Linked Meeting ID (optional)"
                  size="small"
                  value={linkedMeetingId}
                  onChange={(event) => setLinkedMeetingId(event.target.value)}
                  helperText="Auto-filled when opened from a calendar meeting"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      bgcolor: 'background.default',
                      '& fieldset': { borderColor: 'transparent' },
                      '&:hover fieldset': { borderColor: 'divider' },
                      '&.Mui-focused fieldset': { borderColor: COLORS.primary },
                    },
                  }}
                />
              </Box>

              {/* Enhanced RFP Analysis Card */}
              {(
                <Card
                  elevation={0}
                  sx={{
                    mb: 4,
                    borderRadius: 3,
                    border: 1,
                    borderColor: alpha(COLORS.secondary, 0.08),
                    boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
                  }}
                >
                  <CardContent sx={{ p: 4 }}>
                    <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
                      <Box
                        sx={{
                          width: 48,
                          height: 48,
                          borderRadius: 2,
                          bgcolor: alpha(COLORS.primary, 0.1),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <CloudUpload sx={{ fontSize: 24, color: COLORS.primary }} />
                      </Box>
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: COLORS.secondary }}>
                          Upload RFP Document
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Upload your RFP PDF for AI-powered solution proposal generation
                        </Typography>
                      </Box>
                    </Stack>

                    <Paper
                      elevation={0}
                      sx={{
                        p: 6,
                        textAlign: 'center',
                        border: '2px dashed',
                        borderRadius: 3,
                        bgcolor: selectedFile ? alpha(COLORS.success, 0.03) : COLORS.slate50,
                        borderColor: selectedFile ? COLORS.success : COLORS.slate300,
                        transition: 'all 0.3s',
                        cursor: 'pointer',
                        '&:hover': {
                          borderColor: COLORS.primary,
                          bgcolor: alpha(COLORS.primary, 0.05),
                        },
                      }}
                      onClick={() => document.getElementById('rfp-file-input')?.click()}
                    >
                      <input
                        id="rfp-file-input"
                        type="file"
                        accept=".pdf,.doc,.docx,.txt"
                        hidden
                        onChange={handleFileChange}
                      />
                      <Stack spacing={2} alignItems="center">
                        <Box
                          sx={{
                            width: 72,
                            height: 72,
                            borderRadius: '50%',
                            bgcolor: selectedFile ? alpha(COLORS.success, 0.1) : alpha(COLORS.primary, 0.1),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {selectedFile ? (
                            <CheckCircle sx={{ fontSize: 36, color: COLORS.success }} />
                          ) : (
                            <CloudUpload sx={{ fontSize: 36, color: COLORS.primary }} />
                          )}
                        </Box>
                        <Typography variant="h6" sx={{ fontWeight: 600, color: COLORS.secondary }}>
                          {selectedFile ? selectedFile.name : 'Select RFP PDF File'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {selectedFile
                            ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB • Click to change`
                            : 'Click to browse or drag and drop your PDF file'}
                        </Typography>
                      </Stack>
                    </Paper>

                    {selectedFile && (
                      <Box sx={{ mt: 4 }}>
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                          <Button
                            variant="outlined"
                            fullWidth
                            size="large"
                            onClick={() => handleJobSubmission('quick')}
                            disabled={loading}
                            startIcon={loading && analysisType === 'quick' ? <CircularProgress size={20} /> : <AutoFixHigh />}
                            sx={{
                              py: 1.5,
                              borderRadius: 2,
                              fontWeight: 600,
                              borderColor: COLORS.info,
                              color: COLORS.info,
                              '&:hover': {
                                borderColor: COLORS.info,
                                bgcolor: alpha(COLORS.info, 0.08),
                              },
                            }}
                          >
                            {loading && analysisType === 'quick' ? 'Submitting...' : 'Quick Analysis'}
                          </Button>
                          <Button
                            variant="contained"
                            fullWidth
                            size="large"
                            onClick={() => handleJobSubmission('enhanced')}
                            disabled={loading}
                            startIcon={loading && analysisType === 'enhanced' ? <CircularProgress size={20} /> : <Analytics />}
                            sx={{
                              py: 1.5,
                              borderRadius: 2,
                              fontWeight: 600,
                              background: COLORS.gradient,
                              boxShadow: `0 4px 16px ${alpha(COLORS.primary, 0.3)}`,
                              '&:hover': {
                                background: COLORS.gradient,
                                transform: 'translateY(-2px)',
                                boxShadow: `0 8px 24px ${alpha(COLORS.primary, 0.4)}`,
                              },
                              transition: 'all 0.3s',
                            }}
                          >
                            {loading && analysisType === 'enhanced' ? 'Submitting...' : 'Enhanced Analysis'}
                          </Button>
                        </Stack>

                        {jobMessage && (
                          <Alert
                            severity="success"
                            sx={{
                              mt: 3,
                              borderRadius: 2,
                              bgcolor: alpha(COLORS.success, 0.05),
                              border: 1,
                              borderColor: alpha(COLORS.success, 0.2),
                            }}
                          >
                            {jobMessage}
                          </Alert>
                        )}
                      </Box>
                    )}

                    {error && (
                      <Alert
                        severity="error"
                        sx={{ mt: 3 }}
                        action={
                          error.includes('login') && (
                            <Button color="inherit" size="small" onClick={() => navigate('/')}>
                              Go to Login
                            </Button>
                          )
                        }
                      >
                        {error}
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Show Job Detail section when viewing a specific job */}
              {selectedJob && renderJobDetailSection()}
            </>
          )}

          {/* RFP Research Tab (Tab 1) */}
          {activeTab === 1 && (
            <Box>
              {/* RFP Research Upload Section */}
              <Card
                elevation={0}
                sx={{
                  mb: 4,
                  borderRadius: 3,
                  border: 1,
                  borderColor: alpha(COLORS.secondary, 0.08),
                  boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
                }}
              >
                <CardContent sx={{ p: 4 }}>
                  <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
                    <Box
                      sx={{
                        width: 48,
                        height: 48,
                        borderRadius: 2,
                        bgcolor: alpha(COLORS.primary, 0.1),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Science sx={{ fontSize: 24, color: COLORS.primary }} />
                    </Box>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: COLORS.secondary }}>
                        RFP Research & Q&A
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Extract questions and generate answers using InternalKnowledge + Case Studies
                      </Typography>
                    </Box>
                  </Stack>

                  <Paper
                    elevation={0}
                    sx={{
                      p: 6,
                      textAlign: 'center',
                      border: '2px dashed',
                      borderRadius: 3,
                      bgcolor: researchFile ? alpha(COLORS.success, 0.03) : COLORS.slate50,
                      borderColor: researchFile ? COLORS.success : alpha(COLORS.primary, 0.3),
                      transition: 'all 0.3s',
                      cursor: 'pointer',
                      '&:hover': {
                        borderColor: COLORS.primary,
                        bgcolor: alpha(COLORS.primary, 0.05),
                      },
                    }}
                    onClick={() => document.getElementById('research-file-input')?.click()}
                  >
                    <input
                      id="research-file-input"
                      type="file"
                      accept=".pdf,.doc,.docx,.txt,.xlsx,.xls"
                      hidden
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setResearchFile(e.target.files[0]);
                          clearRFPResearch();
                        }
                      }}
                    />
                    <Stack spacing={2} alignItems="center">
                      <Box
                        sx={{
                          width: 72,
                          height: 72,
                          borderRadius: '50%',
                          bgcolor: researchFile ? alpha(COLORS.success, 0.1) : alpha(COLORS.primary, 0.1),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {researchFile ? (
                          <CheckCircle sx={{ fontSize: 36, color: COLORS.success }} />
                        ) : (
                          <Science sx={{ fontSize: 36, color: COLORS.primary }} />
                        )}
                      </Box>
                      <Typography variant="h6" sx={{ fontWeight: 600, color: COLORS.secondary }}>
                        {researchFile ? researchFile.name : 'Select RFP Document for Research'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {researchFile
                          ? `${(researchFile.size / 1024 / 1024).toFixed(2)} MB • Click to change`
                          : 'Upload PDF, DOCX, TXT, or Excel (.xlsx) to extract questions'}
                      </Typography>
                    </Stack>
                  </Paper>

                  {researchFile && (
                    <Box sx={{ mt: 4 }}>
                      {/* Custom Prompt Input */}
                      <TextField
                        fullWidth
                        multiline
                        rows={3}
                        label="Analysis Guidance (Optional)"
                        placeholder="Enter specific instructions to guide the analysis. For example:
• Focus on ServiceNow implementation capabilities
• Emphasize Northstar Integrators's SAFe expertise and certifications
• Highlight case studies in healthcare/financial services"
                        value={analysisPrompt}
                        onChange={(e) => setAnalysisPrompt(e.target.value)}
                        sx={{
                          mb: 3,
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                            bgcolor: 'background.default',
                            '& fieldset': { borderColor: 'transparent' },
                            '&:hover fieldset': { borderColor: 'divider' },
                            '&.Mui-focused fieldset': { borderColor: COLORS.primary },
                          },
                        }}
                        slotProps={{
                          input: {
                            startAdornment: (
                              <InputAdornment position="start" sx={{ alignSelf: 'flex-start', mt: 1.5 }}>
                                <AutoFixHigh sx={{ color: COLORS.primary }} />
                              </InputAdornment>
                            ),
                          },
                        }}
                      />

                      <Button
                        variant="contained"
                        fullWidth
                        size="large"
                        onClick={() => startRFPResearchWithLogs(researchFile, analysisPrompt)}
                        disabled={rfpResearchLoading}
                        startIcon={rfpResearchLoading ? <CircularProgress size={20} /> : <Science />}
                        sx={{
                          py: 1.5,
                          borderRadius: 2,
                          fontWeight: 600,
                          background: COLORS.gradient,
                          boxShadow: `0 4px 16px ${alpha(COLORS.primary, 0.3)}`,
                          '&:hover': {
                            background: COLORS.gradient,
                            transform: 'translateY(-2px)',
                            boxShadow: `0 8px 24px ${alpha(COLORS.primary, 0.4)}`,
                          },
                          transition: 'all 0.3s',
                        }}
                      >
                        {rfpResearchLoading ? 'Analyzing RFP...' : 'Start RFP Research'}
                      </Button>
                    </Box>
                  )}
                </CardContent>
              </Card>

              {/* Research Results */}
              <RFPResearchPanel
                result={rfpResearchResult}
                loading={rfpResearchLoading}
                error={rfpResearchError}
                logs={rfpResearchLogs}
              />

              {/* Action bar — shown once research is auto-saved */}
              {savedResearchId && rfpResearchResult && !rfpResearchLoading && (
                <Paper
                  elevation={0}
                  sx={{
                    mt: 2,
                    p: 2,
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                  }}
                >
                  <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                    <Typography variant="body2" sx={{ color: 'text.secondary', flexGrow: 1 }}>
                      Research saved · {rfpResearchResult.metadata.totalQuestions} questions answered
                    </Typography>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<Download />}
                      onClick={handleDownloadDocx}
                    >
                      Download Word
                    </Button>
                    <Tooltip title={sowJobId ? `SOW job queued: ${sowJobId}` : 'Generate a full SOW document using the Q&A answers as grounding context'}>
                      <span>
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={generatingSow ? <CircularProgress size={14} color="inherit" /> : <AutoFixHigh />}
                          onClick={handleGenerateSow}
                          disabled={generatingSow || !!sowJobId}
                          sx={{ bgcolor: COLORS.primary, '&:hover': { bgcolor: '#333' } }}
                        >
                          {sowJobId ? 'SOW Queued' : generatingSow ? 'Starting…' : 'Generate SOW'}
                        </Button>
                      </span>
                    </Tooltip>
                    {sowJobId && (
                      <Alert severity="success" sx={{ py: 0, px: 1.5 }}>
                        SOW generation started — view progress in the Proposals tab
                      </Alert>
                    )}
                  </Stack>
                </Paper>
              )}

              {/* Past Research Results when viewing a saved one */}
              {selectedResearch && !rfpResearchResult && (
                <Box sx={{ mt: 4 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600, color: COLORS.secondary }}>
                      Viewing: {selectedResearch.fileName || 'Past Research'}
                    </Typography>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => clearSelectedResearch()}
                    >
                      Close
                    </Button>
                  </Stack>
                  <RFPResearchPanel
                    result={{
                      rfpSummary: selectedResearch.rfpSummary || '',
                      companyName: selectedResearch.companyName || undefined,
                      questions: selectedResearch.questions || [],
                      answers: selectedResearch.answers || [],
                      metadata: {
                        totalQuestions: selectedResearch.totalQuestions,
                        answeredQuestions: selectedResearch.answeredQuestions,
                        averageConfidence: selectedResearch.averageConfidence,
                        processingTimeMs: selectedResearch.processingTimeMs,
                        fileName: selectedResearch.fileName || undefined,
                      },
                    }}
                    loading={selectedResearchLoading}
                    error={null}
                    logs={[]}
                  />
                </Box>
              )}

              {/* Research History Section */}
              <Box sx={{ mt: 6 }}>
                <Paper
                  sx={{
                    p: 3,
                    mb: 3,
                    bgcolor: '#FFFFFF',
                    borderRadius: 3,
                    border: '1px solid rgba(0, 35, 72, 0.08)',
                    boxShadow: '0 18px 35px rgba(0, 35, 72, 0.06)',
                  }}
                >
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                    <Box>
                      <Typography variant="h6" sx={{ color: 'text.primary', fontWeight: 700 }}>
                        Research History
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#1A385E' }}>
                        View and manage your past RFP research analyses
                      </Typography>
                    </Box>
                    <Tooltip title="Refresh history">
                      <span>
                        <IconButton
                          onClick={() => fetchRFPResearchHistory()}
                          disabled={rfpResearchHistoryLoading}
                          sx={{
                            color: '#00806B',
                            border: '1px solid rgba(0, 164, 140, 0.3)',
                          }}
                        >
                          <Refresh />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Stack>

                  {rfpResearchHistoryLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                      <CircularProgress size={28} />
                    </Box>
                  ) : rfpResearchHistory.length === 0 ? (
                    <Paper
                      sx={{
                        p: 4,
                        textAlign: 'center',
                        border: '1px dashed rgba(0, 35, 72, 0.15)',
                        bgcolor: '#FFFFFF',
                      }}
                    >
                      <Science sx={{ fontSize: 48, color: COLORS.primary, mb: 1, opacity: 0.5 }} />
                      <Typography variant="body1" sx={{ color: 'text.primary' }}>
                        No research history yet
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#1A385E' }}>
                        Complete an RFP research analysis to see it here
                      </Typography>
                    </Paper>
                  ) : (
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
                        gap: 2,
                      }}
                    >
                      {rfpResearchHistory.map((item) => (
                        <Card
                          key={item.researchId}
                          elevation={0}
                          sx={{
                            bgcolor: '#FFFFFF',
                            border: '1px solid rgba(0, 35, 72, 0.08)',
                            borderRadius: 2,
                            transition: 'all 0.2s',
                            '&:hover': {
                              transform: 'translateY(-2px)',
                              boxShadow: '0 8px 20px rgba(0, 35, 72, 0.1)',
                              borderColor: COLORS.primary,
                            },
                          }}
                        >
                          <CardActionArea onClick={() => handleViewResearch(item)} sx={{ p: 2 }}>
                            <Stack spacing={1.5}>
                              <Stack direction="row" alignItems="center" spacing={1.5}>
                                <Box
                                  sx={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 1.5,
                                    bgcolor: alpha(COLORS.primary, 0.1),
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <Science sx={{ fontSize: 18, color: COLORS.primary }} />
                                </Box>
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                  <Typography
                                    variant="subtitle2"
                                    sx={{ fontWeight: 600, color: 'text.primary' }}
                                    noWrap
                                  >
                                    {item.fileName || 'RFP Research'}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {new Date(item.createdAt).toLocaleDateString()}
                                  </Typography>
                                </Box>
                              </Stack>

                              <Stack direction="row" spacing={1} flexWrap="wrap">
                                <Chip
                                  size="small"
                                  label={`${item.totalQuestions} questions`}
                                  sx={{
                                    bgcolor: alpha(COLORS.info, 0.1),
                                    color: COLORS.info,
                                    fontWeight: 500,
                                    fontSize: '0.7rem',
                                  }}
                                />
                                <Chip
                                  size="small"
                                  label={`${Math.round(item.averageConfidence * 100)}% confidence`}
                                  sx={{
                                    bgcolor: item.averageConfidence >= 0.7
                                      ? alpha(COLORS.success, 0.1)
                                      : item.averageConfidence >= 0.4
                                      ? alpha('#f59e0b', 0.1)
                                      : alpha(COLORS.error, 0.1),
                                    color: item.averageConfidence >= 0.7
                                      ? COLORS.success
                                      : item.averageConfidence >= 0.4
                                      ? '#f59e0b'
                                      : COLORS.error,
                                    fontWeight: 500,
                                    fontSize: '0.7rem',
                                  }}
                                />
                              </Stack>

                              {item.companyName && (
                                <Typography variant="caption" color="text.secondary" noWrap>
                                  Company: {item.companyName}
                                </Typography>
                              )}
                            </Stack>
                          </CardActionArea>
                          <Divider />
                          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 1 }}>
                            <Stack direction="row" spacing={0.5} alignItems="center">
                              <SaveBookmarkButton modelType="rfpResearch" id={item.researchId} isSaved={item.isSaved ?? false} />
                              <ExpiryBadge isSaved={item.isSaved ?? false} createdAt={item.createdAt} />
                            </Stack>
                            <Tooltip title="Delete research">
                              <span>
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteResearch(item.researchId);
                                  }}
                                  disabled={deletingResearchId === item.researchId}
                                  sx={{ color: 'error.main' }}
                                >
                                  {deletingResearchId === item.researchId ? (
                                    <CircularProgress size={16} sx={{ color: 'error.main' }} />
                                  ) : (
                                    <DeleteIcon fontSize="small" />
                                  )}
                                </IconButton>
                              </span>
                            </Tooltip>
                          </Stack>
                        </Card>
                      ))}
                    </Box>
                  )}
                </Paper>
              </Box>
            </Box>
          )}

          {/* Proposal History Tab (Tab 2) */}
          {activeTab === 2 && (
            <>
              {renderHistorySection()}
              {selectedJob && renderJobDetailSection()}
            </>
          )}
        </Box>
        <Dialog
          open={deleteProposalDialogOpen}
          onClose={closeDeleteJobDialog}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle>Delete Proposal Job?</DialogTitle>
          <DialogContent>
            <DialogContentText>
              This will remove the selected proposal job from history. This action cannot be undone.
            </DialogContentText>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={closeDeleteJobDialog} disabled={Boolean(deletingJobId)}>
              Keep
            </Button>
            <Button
              color="error"
              variant="contained"
              onClick={handleDeleteJob}
              disabled={Boolean(deletingJobId)}
              startIcon={deletingJobId ? <CircularProgress size={14} color="inherit" /> : <DeleteIcon fontSize="small" />}
            >
              {deletingJobId ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogActions>
        </Dialog>
      </Paper>
    </Box>
    </Box>
    </Fade>
  );
};

export default RFPSOWGenerator;
