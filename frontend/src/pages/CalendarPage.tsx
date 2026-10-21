import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Drawer,
  IconButton,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
  Fade,
  alpha,
} from '@mui/material';
import ResponsiveGrid from '../components/layout/ResponsiveGrid';
import { useMemo, useState } from 'react';
import TodayIcon from '@mui/icons-material/Today';
import SyncIcon from '@mui/icons-material/Sync';
import CloseIcon from '@mui/icons-material/Close';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import Timeline from '@mui/icons-material/Timeline';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import { format, startOfWeek, addDays } from '../utils/dateHelpers';
import { useNavigate } from 'react-router-dom';
import { calendarMeetings, Meeting } from '../data/pipelineData';
import { useAppShell } from '../context/AppShellContext';
import { COLORS } from '../styles/pageStyles';

const CalendarPage = () => {
  const navigate = useNavigate();
  const { openPostCallFlow, showMessage } = useAppShell();
  const [view, setView] = useState<'week' | 'day'>('week');
  const [selectedDate, setSelectedDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [syncState, setSyncState] = useState<'synced' | 'syncing' | 'error'>('synced');
  const isMobile = useMediaQuery('(max-width:900px)');

  const weekStart = useMemo(
    () => startOfWeek(new Date(selectedDate), { weekStartsOn: 1 }),
    [selectedDate]
  );

  const days = useMemo(
    () => Array.from({ length: view === 'week' ? 5 : 1 }).map((_, index) => addDays(weekStart, index)),
    [view, weekStart]
  );

  const meetingsByDay = useMemo(() => {
    return days.map((day) => {
      const dateKey = format(day, 'yyyy-MM-dd');
      return {
        dateKey,
        label: format(day, 'EEE, MMM d'),
        meetings: calendarMeetings.filter((meeting) => meeting.date === dateKey),
      };
    });
  }, [days]);

  const metrics = useMemo(() => {
    const total = calendarMeetings.length;
    const denominator = total === 0 ? 1 : total;
    const preCall = calendarMeetings.filter((meeting) => meeting.preCallDone).length;
    const postCall = calendarMeetings.filter((meeting) => meeting.postCallDone).length;
    const proposals = calendarMeetings.filter((meeting) => meeting.proposalGenerated).length;
    return [
      { label: 'Meetings this week', value: total, trend: '+2 vs last week' },
      { label: 'With Pre-Call done', value: preCall, trend: `${Math.round((preCall / denominator) * 100)}% ready` },
      { label: 'With Post-Call done', value: postCall, trend: `${postCall} opportunities scored` },
      { label: 'With Proposal generated', value: proposals, trend: 'Optional step' },
    ];
  }, []);

  const handleMeetingClick = (meeting: Meeting) => {
    setSelectedMeeting(meeting);
  };

  const handleMeetingClose = () => setSelectedMeeting(null);

  const handleRetrySync = () => {
    setSyncState('syncing');
    setTimeout(() => {
      setSyncState('synced');
      showMessage({ type: 'success', message: 'Calendar synced successfully.' });
    }, 1000);
  };

  return (
    <Box sx={{ px: { xs: 2, md: 4 }, py: 4 }}>
      <Fade in timeout={400}>
      <Box>
      {/* Page Header */}
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', md: 'center' }}
        spacing={2}
        sx={{ mb: 4 }}
      >
        <Stack direction="row" spacing={2} alignItems="center">
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 1.5,
              bgcolor: 'action.hover',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CalendarMonthIcon sx={{ fontSize: 24, color: 'text.secondary' }} />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ color: 'text.primary', fontWeight: 600 }}>
              Calendar
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Track pre-call and post-call readiness before every customer moment
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1.5}>
          <Button
            variant="outlined"
            startIcon={<SyncIcon />}
            onClick={handleRetrySync}
            sx={{
              borderColor: 'divider',
              color: 'text.secondary',
              fontWeight: 500,
              borderRadius: 1.5,
              '&:hover': {
                borderColor: 'divider',
                bgcolor: 'background.default',
              },
            }}
          >
            Refresh Outlook
          </Button>
          <Button
            variant="contained"
            startIcon={<TodayIcon />}
            onClick={() => setSelectedDate(format(new Date(), 'yyyy-MM-dd'))}
            sx={{
              bgcolor: 'text.primary',
              color: 'white',
              fontWeight: 500,
              borderRadius: 1.5,
              boxShadow: 'none',
              '&:hover': {
                bgcolor: 'text.primary',
                boxShadow: 'none',
              },
            }}
          >
            Today
          </Button>
        </Stack>
      </Stack>

      {/* Metrics Cards */}
      <ResponsiveGrid container spacing={2} sx={{ mb: 3 }}>
        {metrics.map((metric) => (
          <ResponsiveGrid xs={12} sm={6} md={3} key={metric.label}>
            <Card
              elevation={0}
              sx={{
                borderRadius: 3,
                border: 1,
                borderColor: alpha(COLORS.secondary, 0.08),
                transition: 'all 0.2s',
                '&:hover': {
                  boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                  transform: 'translateY(-2px)',
                },
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                  {metric.label}
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700, color: COLORS.secondary, my: 1 }}>
                  {metric.value}
                </Typography>
                <Typography variant="caption" sx={{ color: COLORS.primary, fontWeight: 600 }}>
                  {metric.trend}
                </Typography>
              </CardContent>
            </Card>
          </ResponsiveGrid>
        ))}
      </ResponsiveGrid>

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        alignItems={{ xs: 'flex-start', md: 'center' }}
        sx={{ mt: 3, mb: 2 }}
      >
        <ToggleButtonGroup
          exclusive
          value={view}
          onChange={(_event, value) => value && setView(value)}
          size="small"
        >
          <ToggleButton value="week">Week</ToggleButton>
          <ToggleButton value="day">Day</ToggleButton>
        </ToggleButtonGroup>
        <TextField
          type="date"
          size="small"
          value={selectedDate}
          onChange={(event) => setSelectedDate(event.target.value)}
          sx={{ minWidth: 180 }}
        />
        {syncState !== 'synced' && (
          <Alert severity={syncState === 'error' ? 'error' : 'info'} sx={{ flexGrow: 1 }}>
            {syncState === 'error' ? 'Outlook permissions expired. Reconnect to sync meetings.' : 'Initial sync in progress...'}
          </Alert>
        )}
      </Stack>

      {meetingsByDay.every((day) => day.meetings.length === 0) ? (
        <Box
          sx={{
            border: '1px dashed',
            borderColor: 'divider',
            borderRadius: 2,
            textAlign: 'center',
            py: 6,
            mt: 2,
          }}
        >
          <Typography variant="h6">No meetings this week</Typography>
          <Typography variant="body2" color="text.secondary">
            Meetings appear after your Outlook sync completes.
          </Typography>
        </Box>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: `repeat(${meetingsByDay.length}, minmax(200px, 1fr))`,
          }}
        >
          {meetingsByDay.map((day) => (
            <Box
              key={day.dateKey}
              sx={{
                borderRadius: 2,
                border: 1,
                borderColor: 'divider',
                minHeight: 320,
                p: 2,
              }}
            >
              <Typography variant="subtitle2">{day.label}</Typography>
              <Divider sx={{ my: 1 }} />
              <Stack spacing={1.5}>
                {day.meetings.length === 0 && (
                  <Typography variant="caption" color="text.secondary">
                    No meetings.
                  </Typography>
                )}
                {day.meetings.map((meeting) => (
                  <Card
                    key={meeting.id}
                    variant="outlined"
                    sx={{
                      cursor: 'pointer',
                      borderColor:
                        selectedMeeting?.id === meeting.id ? 'primary.main' : 'divider',
                    }}
                    onClick={() => handleMeetingClick(meeting)}
                  >
                    <CardContent>
                      <Typography variant="subtitle2" fontWeight={600}>
                        {meeting.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {meeting.accountName}
                      </Typography>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1, flexWrap: 'wrap' }}>
                        <Chip
                          size="small"
                          color={meeting.preCallDone ? 'success' : 'default'}
                          label="Pre-Call"
                        />
                        <Chip
                          size="small"
                          color={meeting.postCallDone ? 'info' : 'default'}
                          label="Post-Call"
                        />
                        <Chip
                          size="small"
                          color={meeting.proposalGenerated ? 'primary' : 'default'}
                          label="Proposal"
                        />
                      </Stack>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                        <AccessTimeIcon fontSize="small" color="action" />
                        <Typography variant="caption">
                          {meeting.start} – {meeting.end}
                        </Typography>
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </Box>
          ))}
        </Box>
      )}

      <Drawer
        anchor={isMobile ? 'bottom' : 'right'}
        open={Boolean(selectedMeeting)}
        onClose={handleMeetingClose}
        PaperProps={{
          sx: {
            width: { xs: '100%', md: 420 },
            borderTopLeftRadius: isMobile ? 16 : 0,
            borderTopRightRadius: isMobile ? 16 : 0,
            p: 3,
          },
        }}
      >
        {selectedMeeting && (
          <>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="h6">{selectedMeeting.title}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedMeeting.accountName} · {selectedMeeting.date}
                </Typography>
              </Box>
              <IconButton onClick={handleMeetingClose}>
                <CloseIcon />
              </IconButton>
            </Stack>

            <Stack direction="row" spacing={1} sx={{ mt: 2 }} flexWrap="wrap">
              <Chip
                icon={<CheckCircleIcon />}
                color={selectedMeeting.preCallDone ? 'success' : 'default'}
                label={selectedMeeting.preCallDone ? 'Pre-Call complete' : 'Pre-Call not run'}
              />
              <Chip
                icon={<Timeline />}
                color={selectedMeeting.postCallDone ? 'info' : 'default'}
                label={selectedMeeting.postCallDone ? 'Post-Call complete' : 'Post-Call pending'}
              />
              <Chip
                icon={<ArrowForwardIcon />}
                color={selectedMeeting.proposalGenerated ? 'primary' : 'default'}
                label={selectedMeeting.proposalGenerated ? 'Proposal generated' : 'Proposal pending'}
              />
            </Stack>

            <Typography variant="subtitle2" sx={{ mt: 3 }}>
              Attendees
            </Typography>
            <Stack spacing={0.5} sx={{ mt: 1 }}>
              {selectedMeeting.attendees.map((attendee) => (
                <Typography key={attendee.name} variant="body2">
                  {attendee.name} · {attendee.title}
                </Typography>
              ))}
            </Stack>

            <Stack spacing={1.5} sx={{ mt: 3 }}>
              <Button
                variant="outlined"
                onClick={() => navigate(`/app/accounts/${selectedMeeting.accountId}`)}
              >
                Open Account Hub
              </Button>
              <Button
                variant="outlined"
                onClick={() =>
                  navigate('/app/research', {
                    state: { meetingId: selectedMeeting.id },
                  })
                }
              >
                Run / View Pre-Call Research
              </Button>
              <Button
                variant="contained"
                onClick={() => {
                  openPostCallFlow({
                    meetingId: selectedMeeting.id,
                    accountId: selectedMeeting.accountId,
                  });
                  setSelectedMeeting(null);
                }}
              >
                Run / View Post-Call Analysis
              </Button>
            </Stack>
          </>
        )}
      </Drawer>
      </Box>
      </Fade>
    </Box>
  );
};

export default CalendarPage;
