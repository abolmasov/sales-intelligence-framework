import { trackFeature } from '../hooks/useAnalytics';
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ResponsiveGrid from '../components/layout/ResponsiveGrid';
import AddIcon from '@mui/icons-material/Add';
import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppShell } from '../context/AppShellContext';
import { apiGet, apiPost } from '../utils/api';

interface Attendee {
  name: string;
  email: string;
  role: string;
}

interface AnalysisSummary {
  session_id: string;
  company_name: string;
  meeting_id?: string;
  meeting_title?: string;
  meeting_date?: string;
  purpose_of_meeting?: string;
  completed_at?: string;
  status: string;
  attendees?: Attendee[];
  dealId?: string;
}

const ResearchPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const prefill = (location.state as { companyName?: string; meetingId?: string; purposeOfMeeting?: string } | undefined) ?? {};

  const [companyName, setCompanyName] = useState(prefill.companyName ?? '');
  const [purpose, setPurpose] = useState(prefill.purposeOfMeeting ?? '');
  const [context, setContext] = useState('');
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [newAttendee, setNewAttendee] = useState<Attendee>({ name: '', email: '', role: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [recentAnalyses, setRecentAnalyses] = useState<AnalysisSummary[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const { showMessage } = useAppShell();
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadList = () => {
    apiGet('/api/research/list')
      .then((res: any) => setRecentAnalyses(res?.data ?? []))
      .catch((err: any) => setListError(err?.message || 'Failed to load recent research'))
      .finally(() => setLoadingList(false));
  };

  useEffect(() => {
    loadList();
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, []);

  const handleAddAttendee = () => {
    if (!newAttendee.name || !newAttendee.email) return;
    setAttendees((prev) => [...prev, newAttendee]);
    setNewAttendee({ name: '', email: '', role: '' });
  };

  const handleRunResearch = async () => {
    if (!companyName.trim()) {
      setFormError('Company name is required.');
      return;
    }
    if (!purpose.trim()) {
      setFormError('Purpose of meeting is required.');
      return;
    }

    trackFeature('account_research', 'research_started', { companyName });
    setFormError(null);
    setSubmitting(true);

    try {
      const res: any = await apiPost('/api/research/start', {
        companyName: companyName.trim(),
        purposeOfMeeting: purpose.trim(),
        meetingContext: context.trim(),
        attendees,
        meetingId: prefill.meetingId,
      });

      const sessionId: string = res?.data?.sessionId;

      showMessage({ type: 'success', message: 'Research started — results will appear below.' });
      loadList();

      // Poll until complete or failed, then navigate
      if (sessionId) {
        pollingRef.current = setInterval(async () => {
          try {
            const status: any = await apiGet(`/api/research/status/${sessionId}`);
            const s = status?.data?.status;
            if (s === 'completed' || s === 'done') {
              if (pollingRef.current) clearInterval(pollingRef.current);
              showMessage({ type: 'success', message: 'Research complete.' });
              loadList();
            } else if (s === 'failed' || s === 'error') {
              if (pollingRef.current) clearInterval(pollingRef.current);
              showMessage({ type: 'error', message: 'Research failed. Check the analysis list for details.' });
              loadList();
            }
          } catch {
            if (pollingRef.current) clearInterval(pollingRef.current);
          }
        }, 4000);
      }
    } catch (err: any) {
      setFormError(err?.message || 'Failed to start research. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const groupedByCompany = useMemo(() => {
    const groups: Record<string, AnalysisSummary[]> = {};
    recentAnalyses.forEach((a) => {
      const key = a.company_name || 'Unknown';
      if (!groups[key]) groups[key] = [];
      groups[key].push(a);
    });
    return groups;
  }, [recentAnalyses]);

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Breadcrumbs sx={{ mb: 1 }}>
        <Typography color="text.secondary" variant="body2">Home</Typography>
        <Typography color="text.primary" variant="body2">Research</Typography>
      </Breadcrumbs>

      <Paper elevation={0} sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider', p: { xs: 3, md: 4 }, mb: 4 }}>
        <Typography variant="h4" fontWeight={700} gutterBottom={false}>Pre-Call Research</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Generate pre-call briefs with account-level context, competitive intelligence, and talk tracks.
        </Typography>
      </Paper>

      <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', p: 3, mb: 4 }}>
        <Typography variant="h6" fontWeight={600} gutterBottom>New Research Brief</Typography>

        <ResponsiveGrid container spacing={2} sx={{ mt: 1 }}>
          <ResponsiveGrid xs={12} md={6}>
            <TextField
              label="Company name"
              fullWidth
              size="small"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g., Acme Corporation"
            />
          </ResponsiveGrid>
          <ResponsiveGrid xs={12} md={6}>
            <TextField
              label="Purpose of meeting"
              fullWidth
              size="small"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g., Discovery call for ServiceNow implementation"
            />
          </ResponsiveGrid>
          <ResponsiveGrid xs={12}>
            <TextField
              label="Additional context"
              multiline
              minRows={2}
              fullWidth
              size="small"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Deal background, known challenges, prior conversations..."
            />
          </ResponsiveGrid>
        </ResponsiveGrid>

        <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }} color="text.secondary">
          Attendees (optional)
        </Typography>
        <ResponsiveGrid container spacing={2}>
          <ResponsiveGrid xs={12} md={4}>
            <TextField
              label="Name"
              fullWidth
              size="small"
              value={newAttendee.name}
              onChange={(e) => setNewAttendee((prev) => ({ ...prev, name: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && handleAddAttendee()}
            />
          </ResponsiveGrid>
          <ResponsiveGrid xs={12} md={4}>
            <TextField
              label="Email"
              fullWidth
              size="small"
              value={newAttendee.email}
              onChange={(e) => setNewAttendee((prev) => ({ ...prev, email: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && handleAddAttendee()}
            />
          </ResponsiveGrid>
          <ResponsiveGrid xs={12} md={3}>
            <TextField
              label="Role"
              fullWidth
              size="small"
              value={newAttendee.role}
              onChange={(e) => setNewAttendee((prev) => ({ ...prev, role: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && handleAddAttendee()}
            />
          </ResponsiveGrid>
          <ResponsiveGrid xs={12} md={1}>
            <Button variant="outlined" sx={{ height: '100%', width: '100%' }} onClick={handleAddAttendee} startIcon={<AddIcon />}>
              Add
            </Button>
          </ResponsiveGrid>
        </ResponsiveGrid>

        {attendees.length > 0 && (
          <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap', gap: 1 }}>
            {attendees.map((a) => (
              <Chip
                key={a.email}
                label={`${a.name}${a.role ? ` · ${a.role}` : ''}`}
                onDelete={() => setAttendees((prev) => prev.filter((item) => item.email !== a.email))}
                size="small"
                variant="outlined"
              />
            ))}
          </Stack>
        )}

        {formError && (
          <Alert severity="error" sx={{ mt: 2 }} onClose={() => setFormError(null)}>
            {formError}
          </Alert>
        )}

        <Stack direction="row" spacing={2} sx={{ mt: 3 }} justifyContent="flex-end">
          <Button variant="contained" onClick={handleRunResearch} disabled={submitting}>
            {submitting ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
            Run Pre-Call Research
          </Button>
        </Stack>
      </Paper>

      <Box>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h6" fontWeight={600}>Recent Research</Typography>
          <Button size="small" onClick={() => navigate('/app/accounts')}>View Account Hub</Button>
        </Stack>

        {listError && (
          <Alert severity="error" sx={{ mb: 2 }}>{listError}</Alert>
        )}

        {loadingList ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : Object.keys(groupedByCompany).length === 0 ? (
          <Paper elevation={0} sx={{ p: 4, borderRadius: 3, border: '1px solid', borderColor: 'divider', textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">No research runs yet. Start one above.</Typography>
          </Paper>
        ) : (
          <ResponsiveGrid container spacing={2}>
            {Object.entries(groupedByCompany).map(([company, records]) => (
              <ResponsiveGrid xs={12} md={4} key={company}>
                <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={600}>{company}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {records.length} {records.length === 1 ? 'run' : 'runs'}
                    </Typography>
                    <Stack spacing={1.5} sx={{ mt: 2 }}>
                      {records.map((record) => (
                        <Box
                          key={record.session_id}
                          sx={{ borderBottom: '1px solid', borderColor: 'divider', pb: 1.5, cursor: 'pointer', '&:last-child': { borderBottom: 'none', pb: 0 } }}
                          onClick={() => navigate(`/app/analysis/${record.session_id}`)}
                        >
                          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                            <Typography variant="body2" fontWeight={600} sx={{ flexGrow: 1, mr: 1 }}>
                              {record.purpose_of_meeting || record.meeting_title || 'Research brief'}
                            </Typography>
                            <Chip
                              label={record.status}
                              size="small"
                              color={record.status === 'completed' ? 'success' : record.status === 'failed' ? 'error' : 'warning'}
                              variant="outlined"
                              sx={{ flexShrink: 0 }}
                            />
                          </Stack>
                          <Typography variant="caption" color="text.secondary">
                            {record.completed_at ? new Date(record.completed_at).toLocaleDateString() : record.meeting_date || ''}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              </ResponsiveGrid>
            ))}
          </ResponsiveGrid>
        )}
      </Box>
    </Container>
  );
};

export default ResearchPage;
