import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Add, Close, Delete } from '@mui/icons-material';
import type { CalendarMeeting } from '../types/calendarMeeting';
import { deriveCompanyFromAttendeeEmails, isInternalAttendee } from '../utils/meetingActions';

type ExternalAttendeeDraft = {
  name: string;
  email: string;
};

export type PreCallStartValues = {
  companyName: string;
  meetingContext: string;
  externalAttendees: Array<{ name: string; email?: string; role?: string; company?: string }>;
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const defaultAttendeeFromEmail = (email: string) => {
  const local = email.split('@')[0] || '';
  if (!local) return '';
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
};

export default function PreCallStartDialog(props: {
  open: boolean;
  meeting: CalendarMeeting | null;
  onClose: () => void;
  onStart: (values: PreCallStartValues) => void;
}) {
  const { open, meeting, onClose, onStart } = props;

  const existingExternalAttendees = useMemo(() => {
    if (!meeting) return [];
    const list =
      meeting.externalAttendees && meeting.externalAttendees.length > 0
        ? meeting.externalAttendees
        : (meeting.attendees || []).filter((attendee) => !isInternalAttendee(attendee.email));
    return list
      .map((attendee) => ({
        name: (attendee.name || '').trim(),
        email: attendee.email ? normalizeEmail(attendee.email) : undefined,
        role: attendee.role,
      }))
      .filter((attendee) => attendee.name || attendee.email);
  }, [meeting]);

  const detectedCompany = useMemo(() => {
    if (!meeting) return null;
    const fromMeeting = meeting.company?.trim();
    if (fromMeeting) return fromMeeting;
    return deriveCompanyFromAttendeeEmails(existingExternalAttendees as Array<{ email?: string | null }>);
  }, [meeting, existingExternalAttendees]);

  const [companyName, setCompanyName] = useState('');
  const [meetingContext, setMeetingContext] = useState('');
  const [meetingContextTouched, setMeetingContextTouched] = useState(false);
  const [extraAttendees, setExtraAttendees] = useState<ExternalAttendeeDraft[]>([]);

  useEffect(() => {
    if (!open) return;
    setCompanyName(detectedCompany || '');
    setMeetingContext('');
    setMeetingContextTouched(false);
    setExtraAttendees([]);
  }, [open, detectedCompany]);

  const handleAddAttendee = () => {
    setExtraAttendees((prev) => [...prev, { name: '', email: '' }]);
  };

  const handleRemoveAttendee = (index: number) => {
    setExtraAttendees((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdateAttendee = (index: number, next: Partial<ExternalAttendeeDraft>) => {
    setExtraAttendees((prev) =>
      prev.map((attendee, idx) => (idx === index ? { ...attendee, ...next } : attendee))
    );
  };

  const handleStart = () => {
    if (!meeting) return;

    const normalizedCompany = companyName.trim();
    const normalizedContext = meetingContext.trim();
    if (!normalizedContext) {
      setMeetingContextTouched(true);
      return;
    }

    const added = extraAttendees
      .map((attendee) => ({
        name: attendee.name.trim() || defaultAttendeeFromEmail(attendee.email.trim()),
        email: attendee.email.trim(),
      }))
      .filter((attendee) => attendee.name || attendee.email)
      .map((attendee) => ({
        name: attendee.name,
        email: attendee.email ? normalizeEmail(attendee.email) : undefined,
        company: normalizedCompany || undefined,
      }));

    const combined = [
      ...existingExternalAttendees.map((attendee) => ({
        ...attendee,
        company: normalizedCompany || undefined,
      })),
      ...added,
    ];

    onStart({
      companyName: normalizedCompany,
      meetingContext: normalizedContext,
      externalAttendees: combined,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pr: 6 }}>
        Start Pre-call Analysis
        <IconButton
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8 }}
          aria-label="Close"
        >
          <Close />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Box>
            <TextField
              fullWidth
              label="Company"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g., Acme Corp"
              helperText={detectedCompany ? `Detected from meeting/attendees: ${detectedCompany}` : ' '}
            />
          </Box>

          <TextField
            fullWidth
            label="Meeting Context"
            value={meetingContext}
            onChange={(e) => setMeetingContext(e.target.value)}
            onBlur={() => setMeetingContextTouched(true)}
            placeholder="Add background, goals, or what you want to accomplish in this meeting"
            multiline
            minRows={3}
            required
            error={meetingContextTouched && !meetingContext.trim()}
            helperText={
              meetingContextTouched && !meetingContext.trim()
                ? 'Meeting context is required to start pre-call analysis.'
                : ' '
            }
          />

          <Divider />

          <Box>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                External Attendees (Optional)
              </Typography>
              <Button size="small" startIcon={<Add />} onClick={handleAddAttendee}>
                Add
              </Button>
            </Stack>

            {existingExternalAttendees.length > 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Included from meeting: {existingExternalAttendees.map((a) => a.name || a.email).filter(Boolean).join(', ')}
              </Typography>
            )}

            <Stack spacing={1}>
              {extraAttendees.map((attendee, idx) => (
                <Stack key={idx} direction="row" spacing={1} alignItems="center">
                  <TextField
                    size="small"
                    label="Name"
                    value={attendee.name}
                    onChange={(e) => handleUpdateAttendee(idx, { name: e.target.value })}
                    sx={{ flex: 1 }}
                  />
                  <TextField
                    size="small"
                    label="Email"
                    value={attendee.email}
                    onChange={(e) => handleUpdateAttendee(idx, { email: e.target.value })}
                    sx={{ flex: 1.2 }}
                  />
                  <IconButton aria-label="Remove attendee" onClick={() => handleRemoveAttendee(idx)}>
                    <Delete fontSize="small" />
                  </IconButton>
                </Stack>
              ))}
            </Stack>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleStart}
          disabled={!meeting || !companyName.trim() || !meetingContext.trim()}
        >
          Start
        </Button>
      </DialogActions>
    </Dialog>
  );
}
