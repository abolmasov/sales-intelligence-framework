import React, { useState } from 'react';
import { Button, IconButton, Tooltip } from '@mui/material';
import { Cancel } from '@mui/icons-material';
import { API_BASE_URL } from '../config';
import { useCalendarMeetingsStore } from '../store/calendarMeetingsStore';
import type { CalendarMeeting } from '../types/calendarMeeting';

type CancelAnalysisFlowButtonProps = {
  preCallSessionId?: string | null;
  workflowJobId?: string | null;
  transcriptAnalysisId?: string | null;
  proposalJobId?: string | null;
  meetingId?: string;
  iconOnly?: boolean;
  size?: 'small' | 'medium' | 'large';
  onCancelled?: () => void;
};

const CancelAnalysisFlowButton: React.FC<CancelAnalysisFlowButtonProps> = ({
  preCallSessionId,
  workflowJobId,
  transcriptAnalysisId,
  proposalJobId,
  meetingId,
  iconOnly,
  size = 'small',
  onCancelled,
}) => {
  const updateMeeting = useCalendarMeetingsStore((state) => state.updateMeeting);
  const meetings = useCalendarMeetingsStore((state) => state.meetings);
  const [cancelling, setCancelling] = useState(false);

  const clearLocalStorageIfMatches = (key: string, idKey: string, idValue?: string | null) => {
    if (!idValue) return;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.[idKey] === idValue) {
        localStorage.removeItem(key);
      }
    } catch {
      // ignore
    }
  };

  const removePreCallFromStore = () => {
    if (!meetingId || !preCallSessionId) return;
    const meeting = meetings.find((m) => m.id === meetingId);
    if (!meeting) return;
    const existingPreCall = meeting.analysisSummary?.preCall || [];
    if (existingPreCall.length === 0) return;
    updateMeeting(meetingId, {
      analysisSummary: {
        ...meeting.analysisSummary,
        preCall: existingPreCall.filter((pc) => pc.sessionId !== preCallSessionId),
        postCall: meeting.analysisSummary?.postCall || [],
        proposals: meeting.analysisSummary?.proposals || [],
      },
      analysisSessionId: undefined,
      status: meeting.status === 'analyzing' ? 'scheduled' : meeting.status,
    });
  };

  const markWorkflowCancelledInStore = () => {
    if (!meetingId || !workflowJobId) return;
    const meeting = meetings.find((m) => m.id === meetingId);
    if (!meeting?.analysisJob) return;
    if (meeting.analysisJob.jobId !== workflowJobId) return;
    updateMeeting(meetingId, {
      analysisJob: {
        ...meeting.analysisJob,
        status: 'cancelled',
        transcriptStatus: meeting.analysisJob.transcriptStatus === 'completed' ? 'completed' : 'cancelled',
        proposalStatus: meeting.analysisJob.proposalStatus === 'completed' ? 'completed' : 'cancelled',
        pptStatus: meeting.analysisJob.pptStatus === 'completed' ? 'completed' : 'cancelled',
        errorMessage: null,
      },
      status: meeting.status === 'analyzing' ? 'scheduled' : meeting.status,
    } as Partial<CalendarMeeting>);
  };

  const cancel = async () => {
    if (cancelling) return;
    if (!preCallSessionId && !workflowJobId && !transcriptAnalysisId && !proposalJobId) return;
    setCancelling(true);
    try {
      const calls: Promise<any>[] = [];
      if (preCallSessionId) {
        calls.push(
          fetch(`${API_BASE_URL}/api/research/${encodeURIComponent(preCallSessionId)}/cancel`, {
            method: 'POST',
            credentials: 'include',
          }).catch(() => null)
        );
      }
      if (workflowJobId) {
        calls.push(
          fetch(`${API_BASE_URL}/api/analysis-workflow/jobs/${encodeURIComponent(workflowJobId)}/cancel`, {
            method: 'POST',
            credentials: 'include',
          }).catch(() => null)
        );
      }
      if (transcriptAnalysisId) {
        calls.push(
          fetch(`${API_BASE_URL}/api/transcripts/${encodeURIComponent(transcriptAnalysisId)}/cancel`, {
            method: 'POST',
            credentials: 'include',
          }).catch(() => null)
        );
      }
      if (proposalJobId) {
        calls.push(
          fetch(`${API_BASE_URL}/api/proposal/jobs/${encodeURIComponent(proposalJobId)}/cancel`, {
            method: 'POST',
            credentials: 'include',
          }).catch(() => null)
        );
      }

      await Promise.all(calls);

      clearLocalStorageIfMatches('ongoingResearch', 'sessionId', preCallSessionId);
      clearLocalStorageIfMatches('ongoingWorkflowAnalysis', 'jobId', workflowJobId);
      clearLocalStorageIfMatches('ongoingTranscriptAnalysis', 'analysisId', transcriptAnalysisId);

      removePreCallFromStore();
      markWorkflowCancelledInStore();
      onCancelled?.();
    } finally {
      setCancelling(false);
    }
  };

  const label = cancelling ? 'Cancelling…' : 'Cancel';

  if (iconOnly) {
    return (
      <Tooltip title={label}>
        <span>
          <IconButton
            size={size === 'large' ? 'medium' : size}
            color="error"
            onClick={cancel}
            disabled={cancelling}
          >
            <Cancel fontSize={size === 'large' ? 'medium' : 'small'} />
          </IconButton>
        </span>
      </Tooltip>
    );
  }

  return (
    <Button
      size={size}
      variant="outlined"
      color="error"
      startIcon={<Cancel />}
      onClick={cancel}
      disabled={cancelling}
      sx={{ textTransform: 'none' }}
    >
      {label}
    </Button>
  );
};

export default CancelAnalysisFlowButton;
