/**
 * BackgroundJobsBadge
 *
 * Floating indicator that shows when analysis / workspace / generation jobs are
 * running in the background. Lives in App.tsx above the router so it survives
 * page navigation.
 *
 * • 1 active job  → "Analysing Acme Corp…"
 * • N active jobs → "3 jobs running"
 * • Completed     → brief green flash then fades out
 */

import React, { useState } from 'react';
import {
  Box,
  CircularProgress as Spinner,
  Collapse,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  Typography,
  Tooltip,
} from '@mui/material';
import {
  CheckCircle,
  Error as ErrorIcon,
  Close,
  ExpandLess,
  ExpandMore,
  Work as WorkIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useBackgroundJobsStore, BackgroundJob, BackgroundJobStatus } from '../store/backgroundJobsStore';

// ── Helpers ────────────────────────────────────────────────────────────────────

function statusIcon(status: BackgroundJobStatus) {
  switch (status) {
    case 'completed':
      return <CheckCircle sx={{ fontSize: 14, color: 'success.main' }} />;
    case 'error':
      return <ErrorIcon sx={{ fontSize: 14, color: 'error.main' }} />;
    default:
      return <Spinner size={12} sx={{ color: 'primary.main' }} />;
  }
}

function jobRoute(job: BackgroundJob): string | null {
  switch (job.type) {
    case 'workspace':
      return `/workspaces/${job.id}`;
    case 'pptx':
      return '/ppt-generator';
    case 'bulk-workflow':
      return '/calendar';
    case 'workflow':
      return job.meta?.calendarMeetingId ? `/calendar/meetings/${job.meta.calendarMeetingId}` : '/calendar';
    default:
      return null;
  }
}

// ── Single job row ─────────────────────────────────────────────────────────────

function JobRow({ job, onNavigate }: { job: BackgroundJob; onNavigate: () => void }) {
  const stopJob = useBackgroundJobsStore((s) => s.stopJob);
  const route = jobRoute(job);

  return (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 0.5 }}>
      {statusIcon(job.status)}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="caption"
          noWrap
          sx={{
            cursor: route ? 'pointer' : 'default',
            '&:hover': route ? { textDecoration: 'underline' } : {},
          }}
          onClick={() => {
            if (route) onNavigate();
          }}
        >
          {job.label}
        </Typography>
        {job.type === 'bulk-workflow' && typeof job.progress === 'number' && (
          <LinearProgress
            variant="determinate"
            value={job.progress}
            sx={{ height: 2, mt: 0.25, borderRadius: 1 }}
          />
        )}
      </Box>
      {(job.status === 'queued' || job.status === 'running') && (
        <Tooltip title="Stop job">
          <IconButton size="small" onClick={() => stopJob(job.id)} sx={{ p: 0.25 }}>
            <Close sx={{ fontSize: 12 }} />
          </IconButton>
        </Tooltip>
      )}
    </Stack>
  );
}

// ── Main badge ─────────────────────────────────────────────────────────────────

const BackgroundJobsBadge: React.FC = () => {
  const jobs = useBackgroundJobsStore((s) => s.jobs);
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  const jobList = Object.values(jobs);
  if (jobList.length === 0) return null;

  const activeCount = jobList.filter((j) => j.status === 'queued' || j.status === 'running').length;
  const hasCompleted = jobList.some((j) => j.status === 'completed');
  const hasError = jobList.some((j) => j.status === 'error');

  const chipColor = hasError ? 'error' : hasCompleted ? 'success' : 'primary';
  const chipLabel =
    jobList.length === 1
      ? jobList[0].label
      : activeCount > 0
      ? `${activeCount} job${activeCount > 1 ? 's' : ''} running`
      : `${jobList.length} jobs`;

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 1400,
        maxWidth: 320,
      }}
    >
      <Paper elevation={4} sx={{ borderRadius: 2, overflow: 'hidden' }}>
        {/* Header chip */}
        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{ px: 1.5, py: 1, cursor: 'pointer' }}
          onClick={() => setExpanded((e) => !e)}
        >
          <WorkIcon sx={{ fontSize: 16, color: `${chipColor}.main` }} />
          <Typography variant="caption" sx={{ flex: 1, fontWeight: 600 }} noWrap>
            {chipLabel}
          </Typography>
          {activeCount > 0 && <Spinner size={12} sx={{ color: 'primary.main' }} />}
          {expanded ? <ExpandMore sx={{ fontSize: 16 }} /> : <ExpandLess sx={{ fontSize: 16 }} />}
        </Stack>

        {/* Expanded detail */}
        <Collapse in={expanded}>
          <Box sx={{ px: 1.5, pb: 1.5, pt: 0, borderTop: '1px solid', borderWidth: 1, borderStyle: 'solid', borderColor: 'divider' }}>
            {jobList.map((job) => (
              <JobRow
                key={job.id}
                job={job}
                onNavigate={() => {
                  const route = jobRoute(job);
                  if (route) navigate(route);
                  setExpanded(false);
                }}
              />
            ))}
          </Box>
        </Collapse>
      </Paper>
    </Box>
  );
};

export default BackgroundJobsBadge;
