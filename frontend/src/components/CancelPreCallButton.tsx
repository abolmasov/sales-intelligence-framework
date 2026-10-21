import React, { useState } from 'react';
import { Button, IconButton, Tooltip } from '@mui/material';
import { Cancel } from '@mui/icons-material';
import { API_BASE_URL } from '../config';
import { useCalendarMeetingsStore } from '../store/calendarMeetingsStore';

type CancelPreCallButtonProps = {
  sessionId: string;
  meetingId?: string;
  iconOnly?: boolean;
  size?: 'small' | 'medium' | 'large';
  onCancelled?: () => void;
};

const CancelPreCallButton: React.FC<CancelPreCallButtonProps> = ({
  sessionId,
  meetingId,
  iconOnly,
  size = 'small',
  onCancelled,
}) => {
  const updateMeeting = useCalendarMeetingsStore((state) => state.updateMeeting);
  const meetings = useCalendarMeetingsStore((state) => state.meetings);
  const [cancelling, setCancelling] = useState(false);

  const clearOngoingResearchStorage = () => {
    try {
      const stored = localStorage.getItem('ongoingResearch');
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (parsed?.sessionId === sessionId) {
        localStorage.removeItem('ongoingResearch');
      }
    } catch {
      // ignore storage failures
    }
  };

  const removeSessionFromMeetingStore = () => {
    if (!meetingId) return;
    const meeting = meetings.find((m) => m.id === meetingId);
    if (!meeting) return;

    const existingPreCall = meeting.analysisSummary?.preCall || [];
    if (existingPreCall.length === 0) return;

    updateMeeting(meetingId, {
      analysisSummary: {
        ...meeting.analysisSummary,
        preCall: existingPreCall.filter((pc) => pc.sessionId !== sessionId),
        postCall: meeting.analysisSummary?.postCall || [],
        proposals: meeting.analysisSummary?.proposals || [],
      },
    });
  };

  const cancel = async () => {
    if (!sessionId || cancelling) return;
    setCancelling(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/research/${encodeURIComponent(sessionId)}/cancel`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Cancel failed');
      }

      clearOngoingResearchStorage();
      removeSessionFromMeetingStore();
      onCancelled?.();
    } finally {
      setCancelling(false);
    }
  };

  if (iconOnly) {
    return (
      <Tooltip title={cancelling ? 'Cancelling…' : 'Cancel pre-call analysis'}>
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
      {cancelling ? 'Cancelling…' : 'Cancel'}
    </Button>
  );
};

export default CancelPreCallButton;

