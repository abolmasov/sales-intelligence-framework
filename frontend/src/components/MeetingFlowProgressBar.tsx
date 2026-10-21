import React, { useMemo } from 'react';
import { Box, CircularProgress, LinearProgress, Paper, Stack, Typography } from '@mui/material';
import type { CalendarMeeting } from '../types/calendarMeeting';
import CancelAnalysisFlowButton from './CancelAnalysisFlowButton';

const normalizeStatus = (value?: string | null) => (value || '').toLowerCase();

const isPastMeeting = (meeting: CalendarMeeting) => {
  if (meeting.startDateTime) {
    return new Date(meeting.startDateTime) < new Date();
  }
  if (meeting.date && meeting.time) {
    return new Date(`${meeting.date}T${meeting.time}`) < new Date();
  }
  return meeting.status === 'completed';
};

const isActiveStatus = (value?: string | null) => {
  const normalized = normalizeStatus(value);
  return ['queued', 'running', 'pending', 'in_progress', 'processing', 'analyzing'].includes(normalized);
};

const computeProgress = (meeting: CalendarMeeting) => {
  const job = meeting.analysisJob || null;
  const transcriptActive = isActiveStatus(job?.transcriptStatus);
  const proposalActive = isActiveStatus(job?.proposalStatus);
  const pptActive = isActiveStatus(job?.pptStatus);
  const workflowRunning = isActiveStatus(job?.status) || transcriptActive || proposalActive || pptActive;
  if (!workflowRunning) {
    return null;
  }

  if (pptActive) {
    return { label: 'Generating presentation deck…', percent: 85, kind: 'ppt' as const };
  }
  if (proposalActive) {
    return { label: 'Generating solution proposal…', percent: 60, kind: 'proposal' as const };
  }
  if (transcriptActive) {
    return { label: 'Analyzing transcript…', percent: 30, kind: 'transcript' as const };
  }
  if (normalizeStatus(job?.status) === 'queued') {
    return { label: 'Queued…', percent: 10, kind: 'workflow' as const };
  }

  return { label: 'Analysis running…', percent: 10, kind: 'workflow' as const };
};

type MeetingFlowProgressBarProps = {
  meeting: CalendarMeeting;
  compact?: boolean;
  onCancelled?: () => void;
};

const MeetingFlowProgressBar: React.FC<MeetingFlowProgressBarProps> = ({ meeting, compact, onCancelled }) => {
  const progress = useMemo(() => computeProgress(meeting), [meeting]);
  const useSpinner = useMemo(() => isPastMeeting(meeting), [meeting]);
  const preCallSessionId = meeting.analysisSummary?.preCall?.[0]?.sessionId || null;
  const workflowJobId = meeting.analysisJob?.jobId || null;
  const transcriptAnalysisId = meeting.analysisJob?.transcriptAnalysisId || null;
  const proposalJobId = meeting.analysisJob?.proposalJobId || null;

  if (!progress) return null;

  return (
    <Paper
      variant="outlined"
      sx={{
        p: compact ? 1.5 : 2,
        borderRadius: 2,
        backgroundColor: 'rgba(0, 164, 140, 0.06)',
        borderColor: 'rgba(0, 164, 140, 0.28)',
      }}
    >
      <Stack direction="row" spacing={1.25} alignItems="center" justifyContent="space-between">
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 700, color: '#005849' }} noWrap>
            {progress.label}
          </Typography>
          {useSpinner ? (
            <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={18} thickness={5} sx={{ color: '#00A48C' }} />
              <Typography variant="caption" sx={{ color: 'rgba(0, 88, 73, 0.78)' }}>
                Working…
              </Typography>
            </Box>
          ) : (
            <LinearProgress
              variant="determinate"
              value={progress.percent}
              sx={{
                mt: 1,
                height: 8,
                borderRadius: 6,
                backgroundColor: 'rgba(0, 35, 72, 0.08)',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 6,
                  backgroundColor: '#00A48C',
                },
              }}
            />
          )}
        </Box>

        <CancelAnalysisFlowButton
          iconOnly={compact}
          preCallSessionId={preCallSessionId}
          workflowJobId={workflowJobId}
          transcriptAnalysisId={transcriptAnalysisId}
          proposalJobId={proposalJobId}
          meetingId={meeting.id}
          size="small"
          onCancelled={onCancelled}
        />
      </Stack>
    </Paper>
  );
};

export default MeetingFlowProgressBar;
