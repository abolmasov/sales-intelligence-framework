import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import SlideshowIcon from '@mui/icons-material/Slideshow';
import AddIcon from '@mui/icons-material/Add';
import { useEffect, useMemo, useState } from 'react';
import { useAppShell } from '../context/AppShellContext';
import { apiGet } from '../utils/api';
import ResponsiveGrid from '../components/layout/ResponsiveGrid';

interface ProposalJob {
  jobId: string;
  analysisType: string;
  status: string;
  currentStep?: string;
  requestedBy?: string;
  meetingId?: string;
  fileName?: string;
  createdAt: string;
  completedAt?: string;
  rfpSummary?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

const STATUS_COLORS: Record<string, 'default' | 'warning' | 'success' | 'error' | 'info'> = {
  pending: 'warning',
  processing: 'info',
  completed: 'success',
  failed: 'error',
};

const ProposalsPage = () => {
  const { openProposalFlow } = useAppShell();
  const [jobs, setJobs] = useState<ProposalJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    setLoading(true);
    apiGet('/api/proposal/jobs')
      .then((res: any) => {
        const data: ProposalJob[] = res?.data ?? [];
        setJobs(data);
      })
      .catch((err: any) => {
        setError(err?.message || 'Failed to load proposals');
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return jobs.filter((job) => {
      const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
      const matchesType = typeFilter === 'all' || job.analysisType === typeFilter;
      return matchesStatus && matchesType;
    });
  }, [jobs, statusFilter, typeFilter]);

  const analysisTypes = useMemo(() => Array.from(new Set(jobs.map((j) => j.analysisType).filter(Boolean))), [jobs]);

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Breadcrumbs sx={{ mb: 1 }}>
        <Typography color="text.secondary" variant="body2">Home</Typography>
        <Typography color="text.primary" variant="body2">Solution Proposals</Typography>
      </Breadcrumbs>

      <Paper elevation={0} sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider', p: { xs: 3, md: 4 }, mb: 4 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={2}>
          <Box>
            <Typography variant="h4" fontWeight={700} gutterBottom={false}>Solution Proposals</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              RFP/SOW outputs and presentation decks generated from meeting insights.
            </Typography>
          </Box>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => openProposalFlow()} sx={{ flexShrink: 0 }}>
            New Proposal
          </Button>
        </Stack>
      </Paper>

      <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', p: 3, mb: 3 }}>
        <ResponsiveGrid container spacing={2}>
          <ResponsiveGrid xs={12} md={6}>
            <TextField
              select
              label="Status"
              fullWidth
              size="small"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="all">All statuses</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="processing">Processing</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="failed">Failed</MenuItem>
            </TextField>
          </ResponsiveGrid>
          <ResponsiveGrid xs={12} md={6}>
            <TextField
              select
              label="Type"
              fullWidth
              size="small"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <MenuItem value="all">All types</MenuItem>
              {analysisTypes.map((t) => (
                <MenuItem key={t} value={t}>{t}</MenuItem>
              ))}
            </TextField>
          </ResponsiveGrid>
        </ResponsiveGrid>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : filtered.length === 0 ? (
        <Paper elevation={0} sx={{ p: 6, borderRadius: 3, border: '1px solid', borderColor: 'divider', textAlign: 'center' }}>
          <Typography variant="h6" gutterBottom>
            {jobs.length === 0 ? 'No proposals yet' : 'Nothing matches these filters'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {jobs.length === 0
              ? 'Generate your first solution proposal from the post-call workflow.'
              : 'Adjust the filters above to see saved proposals.'}
          </Typography>
          {jobs.length === 0 && (
            <Button variant="outlined" sx={{ mt: 2 }} onClick={() => openProposalFlow()}>
              Create First Proposal
            </Button>
          )}
        </Paper>
      ) : (
        <ResponsiveGrid container spacing={2}>
          {filtered.map((job) => {
            const title = job.metadata?.companyName
              ? `${job.metadata.companyName} — ${job.analysisType || 'Proposal'}`
              : job.fileName || job.jobId;
            const subtitle = [
              job.analysisType,
              job.createdAt ? new Date(job.createdAt).toLocaleDateString() : null,
            ].filter(Boolean).join(' · ');

            return (
              <ResponsiveGrid xs={12} md={6} key={job.jobId}>
                <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1} sx={{ mb: 1 }}>
                      <Typography variant="subtitle1" fontWeight={600}>{title}</Typography>
                      <Chip
                        label={job.status}
                        size="small"
                        color={STATUS_COLORS[job.status] ?? 'default'}
                        variant="outlined"
                        sx={{ flexShrink: 0 }}
                      />
                    </Stack>
                    <Typography variant="body2" color="text.secondary">{subtitle}</Typography>
                    {job.rfpSummary && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {job.rfpSummary}
                      </Typography>
                    )}
                    {job.currentStep && job.status === 'processing' && (
                      <Typography variant="caption" color="primary" display="block" sx={{ mt: 1 }}>
                        {job.currentStep}
                      </Typography>
                    )}
                    {job.errorMessage && (
                      <Typography variant="caption" color="error" display="block" sx={{ mt: 1 }}>
                        {job.errorMessage}
                      </Typography>
                    )}
                  </CardContent>
                  {job.status === 'completed' && (
                    <CardActions sx={{ px: 2, pb: 2 }}>
                      <Stack direction="row" spacing={1}>
                        <Button size="small" variant="outlined" startIcon={<PictureAsPdfIcon />}>
                          Download proposal
                        </Button>
                        <Button size="small" variant="outlined" startIcon={<SlideshowIcon />}>
                          Download deck
                        </Button>
                      </Stack>
                    </CardActions>
                  )}
                </Card>
              </ResponsiveGrid>
            );
          })}
        </ResponsiveGrid>
      )}
    </Container>
  );
};

export default ProposalsPage;
