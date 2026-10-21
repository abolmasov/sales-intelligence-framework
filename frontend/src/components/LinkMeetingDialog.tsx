import React, { useEffect, useState, useMemo } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  Event as EventIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  Link as LinkIcon,
} from '@mui/icons-material';
import { useCalendarMeetingsStore } from '../store/calendarMeetingsStore';
import type { CalendarMeeting } from '../types/calendarMeeting';

interface LinkMeetingDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (meeting: CalendarMeeting) => void;
  dealId: string;
  dealName: string;
  existingMeetingIds?: string[];
}

const LinkMeetingDialog: React.FC<LinkMeetingDialogProps> = ({
  open,
  onClose,
  onConfirm,
  dealId,
  dealName,
  existingMeetingIds = [],
}) => {
  const meetings = useCalendarMeetingsStore((state) => state.meetings);
  const isLoading = useCalendarMeetingsStore((state) => state.isLoading);
  const fetchMeetings = useCalendarMeetingsStore((state) => state.fetchMeetings);
  const error = useCalendarMeetingsStore((state) => state.error);

  const [selectedMeeting, setSelectedMeeting] = useState<CalendarMeeting | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (open) {
      fetchMeetings({ pastDays: 30, futureDays: 30, force: false });
      setSelectedMeeting(null);
      setSearchQuery('');
    }
  }, [open, fetchMeetings]);

  // Filter meetings: exclude already linked ones and apply search
  const availableMeetings = useMemo(() => {
    if (!meetings) return [];

    return meetings.filter((meeting) => {
      // Exclude meetings already linked to this deal
      const meetingIds = [
        meeting.id,
        meeting.eventId,
        meeting.onlineMeetingId,
        meeting.icalUid,
      ].filter(Boolean);

      const alreadyLinked = meetingIds.some((id) =>
        existingMeetingIds.includes(id as string)
      );

      if (alreadyLinked) return false;

      // Skip meetings already linked to another deal
      if (meeting.deal_id && meeting.deal_id !== dealId) return false;

      // Apply search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const titleMatch = meeting.title?.toLowerCase().includes(query);
        const companyMatch = meeting.company?.toLowerCase().includes(query);
        return titleMatch || companyMatch;
      }

      return true;
    });
  }, [meetings, existingMeetingIds, dealId, searchQuery]);

  const handleConfirm = () => {
    if (selectedMeeting) {
      onConfirm(selectedMeeting);
    }
  };

  const formatMeetingDate = (meeting: CalendarMeeting) => {
    const dateStr = meeting.startDateTime || meeting.date;
    if (!dateStr) return 'No date';

    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <LinkIcon color="primary" />
        Link Meeting to Deal
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Select a calendar meeting to link to <strong>{dealName}</strong>. This will associate
          the meeting's analysis and insights with this deal.
        </Typography>

        <TextField
          fullWidth
          size="small"
          placeholder="Search meetings by title or company..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          sx={{ mb: 2 }}
        />

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : availableMeetings.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <EventIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
            <Typography color="text.secondary">
              {searchQuery
                ? 'No meetings match your search'
                : 'No available meetings to link'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Meetings from the past 30 days and next 30 days are shown
            </Typography>
          </Box>
        ) : (
          <List sx={{ maxHeight: 350, overflow: 'auto' }}>
            {availableMeetings.map((meeting) => {
              const isSelected = selectedMeeting?.id === meeting.id;
              const isPast = new Date(meeting.startDateTime || meeting.date || '') < new Date();

              return (
                <ListItem key={meeting.id} disablePadding>
                  <ListItemButton
                    selected={isSelected}
                    onClick={() => setSelectedMeeting(meeting)}
                    sx={{
                      borderRadius: 1,
                      mb: 0.5,
                      border: isSelected ? '2px solid' : '1px solid',
                      borderColor: isSelected ? 'primary.main' : 'divider',
                    }}
                  >
                    <ListItemIcon>
                      {isSelected ? (
                        <CheckCircleIcon color="primary" />
                      ) : (
                        <EventIcon color={isPast ? 'disabled' : 'action'} />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography
                            variant="body1"
                            sx={{
                              fontWeight: isSelected ? 600 : 400,
                              color: isPast ? 'text.secondary' : 'text.primary',
                            }}
                          >
                            {meeting.title}
                          </Typography>
                          {isPast && (
                            <Chip label="Past" size="small" variant="outlined" />
                          )}
                          {meeting.transcriptAvailable && (
                            <Chip
                              label="Transcript"
                              size="small"
                              color="info"
                              variant="outlined"
                            />
                          )}
                        </Stack>
                      }
                      secondary={
                        <Stack direction="row" spacing={2} sx={{ mt: 0.5 }}>
                          <Typography variant="caption" color="text.secondary">
                            <ScheduleIcon
                              sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'text-bottom' }}
                            />
                            {formatMeetingDate(meeting)}
                          </Typography>
                          {meeting.company && meeting.company !== 'Unknown' && meeting.company !== 'Northstar Integrators' && (
                            <Typography variant="caption" color="text.secondary">
                              {meeting.company}
                            </Typography>
                          )}
                          {meeting.duration && (
                            <Typography variant="caption" color="text.secondary">
                              {meeting.duration} min
                            </Typography>
                          )}
                        </Stack>
                      }
                    />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={!selectedMeeting || isLoading}
          startIcon={<LinkIcon />}
        >
          Link Meeting
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default LinkMeetingDialog;
