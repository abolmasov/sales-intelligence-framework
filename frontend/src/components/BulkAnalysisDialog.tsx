import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  LinearProgress,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Chip,
  Stack,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  CircularProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CancelIcon from '@mui/icons-material/Cancel';
import { apiPost } from '../utils/api';
import { type BulkJobStatusResponse, type BulkMeetingJobStatus } from '../utils/bulkWorkflowPolling';
import { useBackgroundJobsStore } from '../store/backgroundJobsStore';

interface BulkAnalysisDialogProps {
  open: boolean;
  onClose: () => void;
  dealId?: string;
  accountId?: string;
  dealName?: string;
  accountName?: string;
}

const statusIcon = (status: string) => {
  switch (status) {
    case 'completed':
      return <CheckCircleIcon fontSize="small" sx={{ color: 'success.main' }} />;
    case 'error':
      return <ErrorIcon fontSize="small" sx={{ color: 'error.main' }} />;
    case 'running':
    case 'processing':
      return <CircularProgress size={16} />;
    case 'queued':
    case 'pending':
      return <HourglassEmptyIcon fontSize="small" sx={{ color: 'text.secondary' }} />;
    case 'cancelled':
      return <CancelIcon fontSize="small" sx={{ color: 'text.disabled' }} />;
    case 'skipped':
      return <Chip label="skip" size="small" variant="outlined" sx={{ height: 20, fontSize: 11 }} />;
    default:
      return null;
  }
};

const stageChip = (status: string) => {
  const colorMap: Record<string, 'success' | 'error' | 'warning' | 'info' | 'default'> = {
    completed: 'success',
    error: 'error',
    running: 'warning',
    pending: 'default',
    skipped: 'default',
    queued: 'info',
  };
  return (
    <Chip
      label={status}
      size="small"
      color={colorMap[status] || 'default'}
      variant="outlined"
      sx={{ fontSize: 11, height: 22 }}
    />
  );
};

export const BulkAnalysisDialog: React.FC<BulkAnalysisDialogProps> = ({
  open,
  onClose,
  dealId,
  accountId,
  dealName,
  accountName,
}) => {
  const [runTranscript, setRunTranscript] = useState(true);
  const [runProposal, setRunProposal] = useState(false);
  const [runPpt, setRunPpt] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bulkJobId, setBulkJobId] = useState<string | null>(null);
  const [statusData, setStatusData] = useState<BulkJobStatusResponse | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  const { registerJob, connectToJob, disconnectCallbacks } = useBackgroundJobsStore.getState();

  // When dialog closes/unmounts, disconnect callbacks — the poller keeps running in background
  useEffect(() => {
    return () => {
      if (bulkJobId) disconnectCallbacks(bulkJobId);
    };
  }, [bulkJobId, disconnectCallbacks]);

  // Reconnect callbacks when dialog reopens with an in-progress job
  useEffect(() => {
    if (!open || !bulkJobId || isComplete) return;
    connectToJob(bulkJobId, {
      onUpdate: (update) => setStatusData(update),
      onComplete: (update) => { setStatusData(update); setIsComplete(true); },
    });
  }, [open, bulkJobId, isComplete, connectToJob]);

  const handleClose = useCallback(() => {
    // Don't stop the poller — let it finish in the background
    setBulkJobId(null);
    setStatusData(null);
    setIsComplete(false);
    setError(null);
    setLoading(false);
    onClose();
  }, [onClose]);

  const handleStart = async () => {
    if (!runTranscript && !runProposal && !runPpt) {
      setError('Select at least one analysis stage');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiPost('/api/analysis-workflow/bulk-run', {
        dealId: dealId || undefined,
        accountId: accountId || undefined,
        runTranscript,
        runProposal,
        runPpt,
        sendEmailNotification: true,
      });

      const data = response?.data;
      if (!data?.bulkJobId) {
        throw new Error('No bulk job ID returned');
      }

      setBulkJobId(data.bulkJobId);
      setStatusData({
        bulkJob: {
          bulkJobId: data.bulkJobId,
          status: 'queued',
          totalMeetings: data.totalMeetings || 0,
          completedMeetings: 0,
          failedMeetings: 0,
          skippedMeetings: data.skippedMeetings || 0,
          progressPercentage: 0,
          createdAt: new Date().toISOString(),
          completedAt: null,
          errorMessage: null,
        },
        meetingJobs: [],
      });

      // Register with the background store so polling survives navigation
      const scopeName = dealName || accountName || 'meetings';
      registerJob(
        data.bulkJobId,
        'bulk-workflow',
        `Bulk analysis – ${scopeName}`,
        {
          onUpdate: (update) => setStatusData(update),
          onComplete: (update) => { setStatusData(update); setIsComplete(true); },
        }
      );
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to start bulk analysis');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!bulkJobId) return;
    try {
      await apiPost(`/api/analysis-workflow/bulk-jobs/${bulkJobId}/cancel`, {});
    } catch {
      // Polling will pick up the cancelled status
    }
  };

  const scopeLabel = dealName || accountName || 'Selected meetings';
  const isRunning = bulkJobId && !isComplete;
  const bulkJob = statusData?.bulkJob;
  const meetingJobs = statusData?.meetingJobs || [];

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" component="span">
          Bulk Analysis
        </Typography>
        <IconButton size="small" onClick={handleClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {/* Scope */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Scope: <strong>{scopeLabel}</strong>
            {dealId && <Chip label="Deal" size="small" sx={{ ml: 1 }} />}
            {accountId && <Chip label="Account" size="small" sx={{ ml: 1 }} />}
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Configuration (only before start) */}
        {!bulkJobId && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Analysis stages to run:
            </Typography>
            <FormGroup row>
              <FormControlLabel
                control={
                  <Checkbox checked={runTranscript} onChange={(e) => setRunTranscript(e.target.checked)} />
                }
                label="Transcript Analysis"
              />
              <FormControlLabel
                control={
                  <Checkbox checked={runProposal} onChange={(e) => setRunProposal(e.target.checked)} />
                }
                label="Proposal Generation"
              />
              <FormControlLabel
                control={<Checkbox checked={runPpt} onChange={(e) => setRunPpt(e.target.checked)} />}
                label="PPT Generation"
              />
            </FormGroup>
          </Box>
        )}

        {/* Progress */}
        {bulkJob && (
          <Box sx={{ mb: 2 }}>
            <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Progress: {bulkJob.completedMeetings + bulkJob.failedMeetings}/{bulkJob.totalMeetings}
              </Typography>
              <Chip
                label={bulkJob.status}
                size="small"
                color={
                  bulkJob.status === 'completed'
                    ? 'success'
                    : bulkJob.status === 'error'
                    ? 'error'
                    : bulkJob.status === 'cancelled'
                    ? 'default'
                    : 'info'
                }
              />
              {bulkJob.skippedMeetings > 0 && (
                <Typography variant="caption" color="text.secondary">
                  ({bulkJob.skippedMeetings} skipped — already analyzed)
                </Typography>
              )}
            </Stack>
            <LinearProgress
              variant="determinate"
              value={bulkJob.progressPercentage}
              sx={{
                height: 8,
                borderRadius: 4,
                '& .MuiLinearProgress-bar': {
                  borderRadius: 4,
                  backgroundColor: bulkJob.failedMeetings > 0 ? 'warning.main' : 'primary.main',
                },
              }}
            />
            {bulkJob.failedMeetings > 0 && (
              <Typography variant="caption" color="error.main" sx={{ mt: 0.5 }}>
                {bulkJob.failedMeetings} meeting(s) failed
              </Typography>
            )}
          </Box>
        )}

        {/* Meeting Jobs Table */}
        {meetingJobs.length > 0 && (
          <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 300 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Meeting</TableCell>
                  <TableCell align="center">Status</TableCell>
                  <TableCell align="center">Transcript</TableCell>
                  <TableCell align="center">Proposal</TableCell>
                  <TableCell align="center">PPT</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {meetingJobs.map((job: BulkMeetingJobStatus) => (
                  <TableRow key={job.jobId}>
                    <TableCell>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                        {job.meetingTitle}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">{statusIcon(job.status)}</TableCell>
                    <TableCell align="center">{stageChip(job.transcriptStatus)}</TableCell>
                    <TableCell align="center">{stageChip(job.proposalStatus)}</TableCell>
                    <TableCell align="center">{stageChip(job.pptStatus)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Success summary */}
        {isComplete && bulkJob && (
          <Alert severity={bulkJob.failedMeetings > 0 ? 'warning' : 'success'} sx={{ mt: 2 }}>
            Bulk analysis complete: {bulkJob.completedMeetings}/{bulkJob.totalMeetings} meetings
            succeeded
            {bulkJob.failedMeetings > 0 && `, ${bulkJob.failedMeetings} failed`}.
          </Alert>
        )}
      </DialogContent>

      <DialogActions>
        {!bulkJobId ? (
          <>
            <Button onClick={handleClose}>Cancel</Button>
            <Button
              variant="contained"
              startIcon={loading ? <CircularProgress size={16} /> : <PlayArrowIcon />}
              onClick={handleStart}
              disabled={loading || (!runTranscript && !runProposal && !runPpt)}
            >
              {loading ? 'Starting...' : 'Start Bulk Analysis'}
            </Button>
          </>
        ) : isRunning ? (
          <>
            <Button onClick={handleCancel} color="error" variant="outlined" startIcon={<CancelIcon />}>
              Cancel
            </Button>
            <Button onClick={handleClose}>Close</Button>
          </>
        ) : (
          <Button onClick={handleClose} variant="contained">
            Done
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default BulkAnalysisDialog;
