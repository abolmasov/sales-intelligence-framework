import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Stack,
  Fade,
  LinearProgress,
  alpha,
  Chip,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import {
  CloudUpload,
  CloudDownload,
  Slideshow,
  CheckCircle,
  Refresh,
  Cancel as CancelIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { apiDelete, apiGet, apiPost } from '../utils/api';
import { COLORS } from '../styles/pageStyles';
import FeedbackWidget from '../components/FeedbackWidget';

const API_URL = API_BASE_URL;

interface PptxHistoryJob {
  jobId: string;
  status: 'processing' | 'completed' | 'error' | 'cancelled';
  templateName?: string | null;
  templateVersion?: string | null;
  slideCount?: number | null;
  outputFileSize?: number | null;
  createdAt: string;
  completedAt?: string | null;
  requestedBy?: string | null;
  fileName?: string | null;
  stats?: {
    title?: string;
    client?: string;
    fileSize?: string;
  } | null;
  downloadUrl?: string | null;
  errorMessage?: string | null;
  rfpFiles?: Array<{
    filename?: string;
    bytes?: number;
  }> | null;
}

interface PPTGeneratorProps {}

const PPTGenerator: React.FC<PPTGeneratorProps> = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [generatedPPT, setGeneratedPPT] = useState<Blob | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [savingToSharePoint, setSavingToSharePoint] = useState(false);
  const [pptFilename, setPptFilename] = useState<string>('');
  const [history, setHistory] = useState<PptxHistoryJob[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [activeGenerationJobId, setActiveGenerationJobId] = useState<string | null>(null);
  const [activeGenerationStartedAt, setActiveGenerationStartedAt] = useState<number | null>(null);
  const [activeGenerationSourceFileName, setActiveGenerationSourceFileName] = useState<string | null>(null);
  const [generationAbortController, setGenerationAbortController] = useState<AbortController | null>(null);
  const [cancellingHistoryJobId, setCancellingHistoryJobId] = useState<string | null>(null);
  const [deletingHistoryJobId, setDeletingHistoryJobId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetJob, setDeleteTargetJob] = useState<PptxHistoryJob | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
      ];
      const allowedExtensions = ['.pdf', '.doc', '.docx', '.txt'];
      const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();

      if (allowedTypes.includes(file.type) || allowedExtensions.includes(fileExt)) {
        setSelectedFile(file);
        setError(null);
        setGeneratedPPT(null);
        setSuccess(null);
        setPptFilename('');
      } else {
        setError('Please select a PDF, Word document, or TXT file (.pdf, .doc, .docx, .txt)');
        setSelectedFile(null);
      }
    }
  };

  const handleGeneratePPT = async () => {
    if (!selectedFile) {
      setError('Please select a file first');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    setUploadProgress('Uploading source document...');
    setActiveGenerationJobId(null);
    setActiveGenerationStartedAt(Date.now());
    setActiveGenerationSourceFileName(selectedFile.name);
    const abortController = new AbortController();
    setGenerationAbortController(abortController);

    try {
      const formData = new FormData();
      formData.append('rfpFiles', selectedFile);

      setUploadProgress('Analyzing content and generating your presentation deck...');

      const response = await axios.post(`${API_URL}/api/pptx/generate`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        signal: abortController.signal,
        responseType: 'blob',
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(`Generating deck... ${percentCompleted}%`);
          }
        },
      });

      // Extract filename from response headers or use original name
      const contentDisposition = response.headers['content-disposition'];
      let filename = 'presentation.pptx';
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '');
        }
      } else {
        // Generate filename from original file
        const originalName = selectedFile.name.replace(/\.(pdf|doc|docx|txt)$/i, '');
        filename = `${originalName}_presentation.pptx`;
      }

      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      });

      setGeneratedPPT(blob);
      setPptFilename(filename);
      setSuccess('Presentation deck generated successfully.');
      setUploadProgress('');
      setLoading(false);
      setGenerationAbortController(null);
      setActiveGenerationStartedAt(null);
      setActiveGenerationSourceFileName(null);
      fetchHistory();

    } catch (err: any) {
      console.error('PPT generation error:', err);
      if (err?.code === 'ERR_CANCELED') {
        setSuccess('Presentation generation cancelled.');
        setLoading(false);
        setUploadProgress('');
        setGenerationAbortController(null);
        setActiveGenerationStartedAt(null);
        setActiveGenerationSourceFileName(null);
        fetchHistory();
        return;
      }
      
      let errorMessage = 'Failed to generate the presentation deck.';
      
      if (err.response?.data) {
        // Try to extract error message from blob
        if (err.response.data instanceof Blob) {
          try {
            const text = await err.response.data.text();
            const errorData = JSON.parse(text);
            errorMessage = errorData.error || errorData.message || errorMessage;
          } catch {
            errorMessage = 'Failed to generate the presentation deck.';
          }
        } else {
          errorMessage = err.response.data.error || err.response.data.message || errorMessage;
        }
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      setLoading(false);
      setUploadProgress('');
      setGenerationAbortController(null);
      setActiveGenerationStartedAt(null);
      setActiveGenerationSourceFileName(null);
    }
  };

  const resolveActiveProcessingJobId = useCallback(async (): Promise<string | null> => {
    try {
      const response = await apiGet('/api/pptx/jobs?limit=50');
      if (!response?.success) return null;

      const jobs: PptxHistoryJob[] = response.data || [];
      const processingJobs = jobs.filter((job) => job.status === 'processing');
      if (processingJobs.length === 0) return null;

      const lowerFile = (activeGenerationSourceFileName || '').toLowerCase();
      const startedAt = activeGenerationStartedAt || 0;

      const candidates = processingJobs
        .filter((job) => {
          const createdAtMs = new Date(job.createdAt).getTime();
          const timeMatch = !startedAt || Number.isNaN(createdAtMs) || createdAtMs >= startedAt - 15000;
          const fileMatch =
            !lowerFile ||
            !!job.rfpFiles?.some((f) => (f?.filename || '').toLowerCase() === lowerFile);
          return timeMatch && fileMatch;
        })
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

      return (candidates[0] || processingJobs[0])?.jobId || null;
    } catch {
      return null;
    }
  }, [activeGenerationSourceFileName, activeGenerationStartedAt]);

  const handleCancelActiveGeneration = async () => {
    generationAbortController?.abort();
    setLoading(false);
    setUploadProgress('');

    let jobIdToCancel = activeGenerationJobId;
    if (!jobIdToCancel) {
      jobIdToCancel = await resolveActiveProcessingJobId();
    }

    if (jobIdToCancel) {
      try {
        await apiPost(`/api/pptx/jobs/${jobIdToCancel}/cancel`, {});
        setSuccess('Presentation generation cancelled.');
      } catch {
        setSuccess('Client request cancelled. Server job cancellation may still be in progress.');
      }
    } else {
      setSuccess('Client request cancelled.');
    }
    setActiveGenerationJobId(null);
    setGenerationAbortController(null);
    setActiveGenerationStartedAt(null);
    setActiveGenerationSourceFileName(null);
    fetchHistory();
  };

  const handleDownload = () => {
    if (generatedPPT && pptFilename) {
      const url = URL.createObjectURL(generatedPPT);
      const a = document.createElement('a');
      a.href = url;
      a.download = pptFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const handleSaveToSharePoint = async () => {
    if (!generatedPPT || !pptFilename) return;

    setSavingToSharePoint(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append('file', generatedPPT, pptFilename);

      const result = await axios.post(`${API_URL}/api/pptx/save-to-sharepoint`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (result.data.success) {
        setSuccess(`Successfully saved to SharePoint: ${result.data.sharepoint_url || 'Document Library'}`);
      } else {
        setError(result.data.message || 'Failed to save to SharePoint');
      }
      
      setSavingToSharePoint(false);
    } catch (err: any) {
      console.error('SharePoint save error:', err);
      setError(
        err.response?.data?.error ||
        err.response?.data?.message ||
        'Failed to save to SharePoint. Please check your SharePoint configuration.'
      );
      setSavingToSharePoint(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setGeneratedPPT(null);
    setError(null);
    setSuccess(null);
    setUploadProgress('');
    setPptFilename('');
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const statusStyles: Record<
    PptxHistoryJob['status'],
    { label: string; color: string; bg: string }
  > = {
    completed: { label: 'Completed', color: COLORS.success, bg: alpha(COLORS.success, 0.1) },
    processing: { label: 'Processing', color: COLORS.info, bg: alpha(COLORS.info, 0.1) },
    cancelled: { label: 'Cancelled', color: 'warning.main', bg: 'rgba(245, 158, 11, 0.12)' },
    error: { label: 'Failed', color: COLORS.error, bg: alpha(COLORS.error, 0.1) },
  };

  const formatTimestamp = (value?: string | null) => {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'N/A';
    return date.toLocaleString();
  };

  const formatHistoryFileSize = (bytes?: number | null) => {
    if (!bytes || bytes <= 0) return '—';
    return formatFileSize(bytes);
  };

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const response = await apiGet('/api/pptx/jobs?limit=50');
      if (!response?.success) {
        throw new Error(response?.error || 'Failed to load presentation history');
      }
      setHistory(response.data || []);
    } catch (err: any) {
      console.error('Failed to load presentation history', err);
      setHistoryError(err?.message || 'Failed to load presentation history');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    if (!loading) {
      setActiveGenerationJobId(null);
      return;
    }

    const poll = async () => {
      try {
        const response = await apiGet('/api/pptx/jobs?limit=20');
        if (!response?.success) return;
        const jobs: PptxHistoryJob[] = response.data || [];
        const lowerFile = (activeGenerationSourceFileName || '').toLowerCase();
        const startedAt = activeGenerationStartedAt || 0;
        const processing = jobs
          .filter((job) => job.status === 'processing')
          .filter((job) => {
            const createdAtMs = new Date(job.createdAt).getTime();
            const timeMatch = !startedAt || Number.isNaN(createdAtMs) || createdAtMs >= startedAt - 15000;
            const fileMatch =
              !lowerFile ||
              !!job.rfpFiles?.some((f) => (f?.filename || '').toLowerCase() === lowerFile);
            return timeMatch && fileMatch;
          })
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )[0];
        setActiveGenerationJobId(processing?.jobId || null);
      } catch {
        // ignore polling errors
      }
    };

    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [activeGenerationSourceFileName, activeGenerationStartedAt, loading]);

  const handleHistoryRefresh = () => {
    fetchHistory();
  };

  const handleHistoryDownload = (job: PptxHistoryJob) => {
    if (job.downloadUrl) {
      window.open(job.downloadUrl, '_blank', 'noopener');
    }
  };

  const handleCancelHistoryJob = async (job: PptxHistoryJob) => {
    if (job.status !== 'processing') return;
    setCancellingHistoryJobId(job.jobId);
    try {
      const response = await apiPost(`/api/pptx/jobs/${job.jobId}/cancel`, {});
      if (!response?.success) {
        throw new Error(response?.error || response?.message || 'Failed to cancel presentation job');
      }
      setSuccess('Presentation generation cancelled.');
      await fetchHistory();
    } catch (err: any) {
      setError(err?.message || 'Failed to cancel presentation job');
    } finally {
      setCancellingHistoryJobId(null);
    }
  };

  const openDeleteHistoryDialog = (job: PptxHistoryJob) => {
    if (job.status === 'processing') return;
    setDeleteTargetJob(job);
    setDeleteDialogOpen(true);
  };

  const closeDeleteHistoryDialog = () => {
    if (deletingHistoryJobId) return;
    setDeleteDialogOpen(false);
    setDeleteTargetJob(null);
  };

  const handleDeleteHistoryJob = async () => {
    if (!deleteTargetJob) return;
    setDeletingHistoryJobId(deleteTargetJob.jobId);
    try {
      const response = await apiDelete(`/api/pptx/jobs/${deleteTargetJob.jobId}`);
      if (!response?.success) {
        throw new Error(response?.error || response?.message || 'Failed to delete presentation job');
      }
      setSuccess('Presentation job deleted.');
      await fetchHistory();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete presentation job');
    } finally {
      setDeletingHistoryJobId(null);
      setDeleteDialogOpen(false);
      setDeleteTargetJob(null);
    }
  };

  return (
    <Box sx={{ py: 4, minHeight: '100vh', bgcolor: 'background.default' }}>
      <Fade in timeout={400}>
      <Box sx={{ maxWidth: 1400, mx: 'auto', px: { xs: 2, md: 4 } }}>
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
              <Slideshow sx={{ fontSize: 32, color: 'white' }} />
            </Box>
            <Box>
              <Typography variant="h4" sx={{ color: 'white', fontWeight: 700, mb: 0.5 }}>
                Presentation Generator
              </Typography>
              <Typography variant="body1" sx={{ color: alpha('#fff', 0.85) }}>
                Turn proposals, RFPs, and meeting notes into a polished executive PowerPoint deck
              </Typography>
            </Box>
          </Stack>
        </Paper>

        {/* Error/Success Messages */}
        {error && (
          <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        {/* Main Card */}
        {!generatedPPT ? (
          <Card
            elevation={0}
            sx={{
              border: 1,
              borderColor: alpha(COLORS.secondary, 0.08),
              borderRadius: 3,
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
                    bgcolor: alpha(COLORS.purple, 0.1),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <CloudUpload sx={{ fontSize: 24, color: COLORS.purple }} />
                </Box>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: COLORS.secondary }}>
                    Upload Source Document
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Upload a PDF, Word document, or TXT file to generate a presentation deck
                  </Typography>
                </Box>
              </Stack>

              {/* File Upload Area */}
              <Paper
                elevation={0}
                onClick={triggerFileSelect}
                sx={{
                  p: { xs: 4, md: 6 },
                  border: '2px dashed',
                  borderColor: selectedFile ? COLORS.success : COLORS.slate300,
                  borderRadius: 3,
                  textAlign: 'center',
                  backgroundColor: selectedFile ? alpha(COLORS.success, 0.03) : COLORS.slate50,
                  mb: 3,
                  transition: 'all 0.3s ease',
                  cursor: 'pointer',
                  '&:hover': {
                    borderColor: COLORS.primary,
                    bgcolor: alpha(COLORS.primary, 0.05),
                  },
                }}
              >
                <Stack spacing={2} alignItems="center">
                  <Box
                    sx={{
                      width: 72,
                      height: 72,
                      borderRadius: '50%',
                      bgcolor: selectedFile ? alpha(COLORS.success, 0.1) : alpha(COLORS.purple, 0.1),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {selectedFile ? (
                      <CheckCircle sx={{ fontSize: 36, color: COLORS.success }} />
                    ) : (
                      <CloudUpload sx={{ fontSize: 36, color: COLORS.purple }} />
                    )}
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 600, color: COLORS.secondary }}>
                    {selectedFile ? selectedFile.name : 'Select a document to start'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedFile
                      ? `${formatFileSize(selectedFile.size)} • Click to change`
                      : 'Supported formats: PDF, DOC, DOCX, TXT'}
                  </Typography>
                </Stack>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  hidden
                  onChange={handleFileSelect}
                />
              </Paper>

              <Button
                variant="contained"
                fullWidth
                onClick={handleGeneratePPT}
                disabled={!selectedFile || loading}
                startIcon={loading ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : <Slideshow />}
                sx={{
                  py: 1.5,
                  fontWeight: 600,
                  borderRadius: 2,
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
                {loading ? 'Generating…' : 'Generate Presentation Deck'}
              </Button>

              {loading && uploadProgress && (
                <Box sx={{ mt: 3 }}>
                  <LinearProgress
                    sx={{
                      borderRadius: 4,
                      height: 8,
                      bgcolor: alpha(COLORS.primary, 0.1),
                      '& .MuiLinearProgress-bar': { bgcolor: 'primary.main', borderRadius: 4 },
                    }}
                  />
                  <Typography
                    variant="caption"
                    sx={{ color: 'text.secondary', mt: 1.5, display: 'block', textAlign: 'center' }}
                  >
                    {uploadProgress}
                  </Typography>
                  <Box sx={{ mt: 1.5, textAlign: 'center' }}>
                    <Button
                      variant="outlined"
                      color="error"
                      size="small"
                      startIcon={<CancelIcon fontSize="small" />}
                      onClick={handleCancelActiveGeneration}
                    >
                      Cancel Generation
                    </Button>
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>
        ) : (
          /* Generated PPT Display */
          <Card
            elevation={0}
            sx={{
              border: 1,
              borderColor: alpha(COLORS.success, 0.3),
              borderRadius: 3,
              boxShadow: `0 4px 20px ${alpha(COLORS.success, 0.1)}`,
            }}
          >
            <Box
              sx={{
                bgcolor: alpha(COLORS.success, 0.05),
                px: 4,
                py: 3,
                borderBottom: '1px solid',
                borderColor: alpha(COLORS.success, 0.1),
              }}
            >
              <Stack direction="row" spacing={2} alignItems="center">
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 2,
                    bgcolor: alpha(COLORS.success, 0.1),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <CheckCircle sx={{ color: COLORS.success, fontSize: 28 }} />
                </Box>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: COLORS.secondary }}>
                    Presentation Generated Successfully
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Your deck is ready to download
                  </Typography>
                </Box>
              </Stack>
            </Box>

            <CardContent sx={{ p: 4 }}>
              {/* File Info */}
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  bgcolor: 'background.default',
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 2,
                  mb: 3,
                }}
              >
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 2,
                      bgcolor: alpha(COLORS.purple, 0.1),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Slideshow sx={{ color: COLORS.purple, fontSize: 24 }} />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, color: COLORS.secondary }}>
                      {pptFilename}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Presentation deck • Ready for download
                    </Typography>
                  </Box>
                </Stack>
              </Paper>

              {/* Action Buttons */}
              <Stack spacing={2}>
                <Button
                  variant="contained"
                  fullWidth
                  onClick={handleDownload}
                  startIcon={<CloudDownload />}
                  sx={{
                    py: 1.5,
                    fontWeight: 600,
                    borderRadius: 2,
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
                  Download to Computer
                </Button>

                <Button
                  variant="outlined"
                  fullWidth
                  onClick={handleReset}
                  startIcon={<Refresh />}
                  sx={{
                    py: 1.5,
                    fontWeight: 600,
                    borderRadius: 2,
                    borderColor: 'divider',
                    color: 'text.secondary',
                    '&:hover': {
                      borderColor: COLORS.primary,
                      color: COLORS.primary,
                      bgcolor: alpha(COLORS.primary, 0.05),
                    },
                  }}
                >
                  Generate Another Presentation
                </Button>
              </Stack>
              
              <Box sx={{ mt: 4 }}>
                <FeedbackWidget 
                  category="ppt_generation" 
                  referenceId={pptFilename} 
                />
              </Box>
            </CardContent>
          </Card>
        )}
        <Box sx={{ mt: 6 }}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: 3,
              border: 1,
              borderColor: alpha(COLORS.secondary, 0.08),
              boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
            }}
          >
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              justifyContent="space-between"
              alignItems={{ xs: 'flex-start', sm: 'center' }}
              spacing={2}
            >
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 700, color: COLORS.secondary }}>
                  Presentation History
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Recently generated presentations stored in your S3 bucket
                </Typography>
              </Box>
              <Tooltip title="Refresh history">
                <span>
                  <IconButton
                    onClick={handleHistoryRefresh}
                    disabled={historyLoading}
                    sx={{
                      color: COLORS.primary,
                      border: 1,
                      borderColor: alpha(COLORS.primary, 0.3),
                      '&:hover': {
                        bgcolor: alpha(COLORS.primary, 0.08),
                      },
                    }}
                  >
                    {historyLoading ? <CircularProgress size={18} sx={{ color: COLORS.primary }} /> : <Refresh />}
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          </Paper>

          {historyError && (
            <Alert severity="error" sx={{ mt: 2 }} onClose={() => setHistoryError(null)}>
              {historyError}
            </Alert>
          )}

          {historyLoading && history.length === 0 ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress size={32} sx={{ color: COLORS.primary }} />
            </Box>
          ) : history.length === 0 ? (
            <Paper
              elevation={0}
              sx={{
                mt: 3,
                p: 6,
                textAlign: 'center',
                borderRadius: 3,
                border: '2px dashed',
                borderColor: 'divider',
                bgcolor: 'background.default',
              }}
            >
              <Slideshow sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" sx={{ mb: 1, color: COLORS.secondary, fontWeight: 600 }}>
                No presentation history yet
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Generate a presentation to see it logged here automatically.
              </Typography>
            </Paper>
          ) : (
            <Stack spacing={2.5} sx={{ mt: 3 }}>
              {history.map((job) => {
                const statusStyle = statusStyles[job.status] || statusStyles.processing;
                const canDownload = Boolean(job.downloadUrl && job.status === 'completed');
                const adjustedSlideCount =
                  typeof job.slideCount === 'number' ? job.slideCount + 3 : null;
                return (
                  <Paper
                    key={job.jobId}
                    elevation={0}
                    sx={{
                      p: 3,
                      borderRadius: 3,
                      border: 1,
                      borderColor: alpha(COLORS.secondary, 0.08),
                      transition: 'all 0.2s',
                      '&:hover': {
                        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                        borderColor: alpha(COLORS.primary, 0.2),
                      },
                    }}
                  >
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      justifyContent="space-between"
                      spacing={1.5}
                    >
                      <Stack direction="row" spacing={2} alignItems="flex-start">
                        <Box
                          sx={{
                            width: 40,
                            height: 40,
                            borderRadius: 2,
                            bgcolor: alpha(COLORS.purple, 0.1),
                            color: COLORS.purple,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <Slideshow sx={{ fontSize: 20 }} />
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600, color: COLORS.secondary }}>
                            {job.fileName || job.stats?.title || 'Presentation.pptx'}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {job.stats?.client || job.templateName || 'Custom template'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Created {formatTimestamp(job.createdAt)}
                          </Typography>
                        </Box>
                      </Stack>
                      <Chip
                        label={statusStyle.label}
                        size="small"
                        sx={{
                          alignSelf: { xs: 'flex-start', sm: 'center' },
                          bgcolor: statusStyle.bg,
                          color: statusStyle.color,
                          fontWeight: 600,
                        }}
                      />
                    </Stack>

                    <Stack
                      direction={{ xs: 'column', md: 'row' }}
                      spacing={3}
                      sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderWidth: 1, borderStyle: 'solid', borderColor: 'divider' }}
                    >
                      <Box>
                        <Typography variant="caption" sx={{ textTransform: 'uppercase', color: 'text.disabled', fontWeight: 600 }}>
                          Template
                        </Typography>
                        <Typography variant="body2" sx={{ color: COLORS.secondary }}>
                          {job.templateName || 'Default'} {job.templateVersion ? '· v' + job.templateVersion : ''}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ textTransform: 'uppercase', color: 'text.disabled', fontWeight: 600 }}>
                          Slides
                        </Typography>
                        <Typography variant="body2" sx={{ color: COLORS.secondary }}>{adjustedSlideCount ?? '—'}</Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ textTransform: 'uppercase', color: 'text.disabled', fontWeight: 600 }}>
                          File Size
                        </Typography>
                        <Typography variant="body2" sx={{ color: COLORS.secondary }}>
                          {job.outputFileSize ? formatHistoryFileSize(job.outputFileSize) : job.stats?.fileSize || '—'}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ textTransform: 'uppercase', color: 'text.disabled', fontWeight: 600 }}>
                          Created By
                        </Typography>
                        <Typography variant="body2" sx={{ color: COLORS.secondary }}>{job.requestedBy || '—'}</Typography>
                      </Box>
                    </Stack>

                    {job.status === 'error' && job.errorMessage && (
                      <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>
                        {job.errorMessage}
                      </Alert>
                    )}

                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={2}
                      sx={{ mt: 2 }}
                      alignItems={{ xs: 'stretch', sm: 'center' }}
                    >
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<CloudDownload />}
                        disabled={!canDownload}
                        onClick={() => handleHistoryDownload(job)}
                        sx={{
                          borderColor: canDownload ? COLORS.primary : COLORS.slate300,
                          color: canDownload ? COLORS.primary : COLORS.slate400,
                          fontWeight: 600,
                          borderRadius: 2,
                          '&:hover': {
                            borderColor: COLORS.primary,
                            bgcolor: alpha(COLORS.primary, 0.08),
                          },
                        }}
                      >
                        {canDownload ? 'Download' : 'Not available'}
                      </Button>
                      {job.status === 'processing' ? (
                        <Button
                          variant="outlined"
                          color="error"
                          size="small"
                          startIcon={
                            cancellingHistoryJobId === job.jobId ? (
                              <CircularProgress size={14} />
                            ) : (
                              <CancelIcon fontSize="small" />
                            )
                          }
                          disabled={cancellingHistoryJobId === job.jobId}
                          onClick={() => handleCancelHistoryJob(job)}
                        >
                          {cancellingHistoryJobId === job.jobId ? 'Cancelling...' : 'Cancel'}
                        </Button>
                      ) : (
                        <Button
                          variant="outlined"
                          color="error"
                          size="small"
                          startIcon={
                            deletingHistoryJobId === job.jobId ? (
                              <CircularProgress size={14} />
                            ) : (
                              <DeleteIcon fontSize="small" />
                            )
                          }
                          disabled={deletingHistoryJobId === job.jobId}
                          onClick={() => openDeleteHistoryDialog(job)}
                        >
                          {deletingHistoryJobId === job.jobId ? 'Deleting...' : 'Delete'}
                        </Button>
                      )}
                      <Typography variant="caption" color="text.secondary">
                        Job ID: {job.jobId}
                      </Typography>
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
          )}
        </Box>
        <Dialog open={deleteDialogOpen} onClose={closeDeleteHistoryDialog} maxWidth="xs" fullWidth>
          <DialogTitle>Delete Presentation Job?</DialogTitle>
          <DialogContent>
            <DialogContentText>
              This will remove the selected presentation job from history. This action cannot be undone.
            </DialogContentText>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={closeDeleteHistoryDialog} disabled={Boolean(deletingHistoryJobId)}>
              Keep
            </Button>
            <Button
              color="error"
              variant="contained"
              onClick={handleDeleteHistoryJob}
              disabled={Boolean(deletingHistoryJobId)}
              startIcon={deletingHistoryJobId ? <CircularProgress size={14} color="inherit" /> : <DeleteIcon fontSize="small" />}
            >
              {deletingHistoryJobId ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
      </Fade>
    </Box>
  );
};

export default PPTGenerator;
