import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import AssessmentIcon from '@mui/icons-material/Assessment';
import GroupWorkIcon from '@mui/icons-material/GroupWork';
import DescriptionIcon from '@mui/icons-material/Description';
import NotificationsIcon from '@mui/icons-material/Notifications';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet } from '../utils/api';
import ResponsiveGrid from '../components/layout/ResponsiveGrid';

interface WorkspaceSummary {
  workspaceId: string;
  name: string;
  clientName?: string;
  status: string;
  engagementStage?: string;
  createdAt: string;
  workspaceType?: string;
}

interface AnalysisSummary {
  session_id: string;
  company_name: string;
  purpose_of_meeting?: string;
  status: string;
  completed_at?: string;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

const STATUS_CHIP: Record<string, 'default' | 'warning' | 'success' | 'error' | 'info'> = {
  pending: 'warning',
  running: 'info',
  analyzing: 'info',
  completed: 'success',
  failed: 'error',
  done: 'success',
};

const StatCard = ({
  icon,
  label,
  value,
  loading,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  loading?: boolean;
  onClick?: () => void;
}) => (
  <Paper
    elevation={0}
    onClick={onClick}
    sx={{
      p: 3,
      borderRadius: 3,
      border: '1px solid',
      borderColor: 'divider',
      cursor: onClick ? 'pointer' : 'default',
      transition: 'border-color 0.15s',
      '&:hover': onClick ? { borderColor: 'primary.main' } : {},
    }}
  >
    <Stack direction="row" alignItems="center" spacing={2}>
      <Box sx={{ color: 'primary.main', display: 'flex' }}>{icon}</Box>
      <Box>
        <Typography variant="h4" fontWeight={700} lineHeight={1}>
          {loading ? <CircularProgress size={24} /> : value}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {label}
        </Typography>
      </Box>
    </Stack>
  </Paper>
);

const DashboardPage = () => {
  const navigate = useNavigate();

  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [analyses, setAnalyses] = useState<AnalysisSummary[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loadingW, setLoadingW] = useState(true);
  const [loadingA, setLoadingA] = useState(true);
  const [loadingN, setLoadingN] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet('/api/workspaces')
      .then((res: any) => setWorkspaces((res?.data ?? res ?? []).slice(0, 5)))
      .catch(() => setError('Failed to load recent engagements'))
      .finally(() => setLoadingW(false));

    apiGet('/api/research/list')
      .then((res: any) => setAnalyses((res?.data ?? []).slice(0, 5)))
      .catch(() => {})
      .finally(() => setLoadingA(false));

    apiGet('/api/notifications')
      .then((res: any) => setNotifications((res?.data ?? []).slice(0, 8)))
      .catch(() => {})
      .finally(() => setLoadingN(false));
  }, []);

  const activeWorkspaces = workspaces.filter((w) => !['completed', 'failed'].includes(w.status));

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Paper elevation={0} sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider', p: { xs: 3, md: 4 }, mb: 4 }}>
        <Typography variant="h4" fontWeight={700} gutterBottom={false}>Dashboard</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Activity overview — recent engagements, research briefs, and notifications.
        </Typography>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}

      {/* Stats row */}
      <ResponsiveGrid container spacing={2} sx={{ mb: 4 }}>
        <ResponsiveGrid xs={6} md={3}>
          <StatCard
            icon={<GroupWorkIcon />}
            label="Active Engagements"
            value={loadingW ? '—' : activeWorkspaces.length}
            loading={false}
            onClick={() => navigate('/app/workspaces')}
          />
        </ResponsiveGrid>
        <ResponsiveGrid xs={6} md={3}>
          <StatCard
            icon={<AssessmentIcon />}
            label="Research Runs (recent)"
            value={loadingA ? '—' : analyses.length}
            loading={false}
            onClick={() => navigate('/app/analysis')}
          />
        </ResponsiveGrid>
        <ResponsiveGrid xs={6} md={3}>
          <StatCard
            icon={<DescriptionIcon />}
            label="Total Engagements"
            value={loadingW ? '—' : workspaces.length}
            loading={false}
            onClick={() => navigate('/app/workspaces')}
          />
        </ResponsiveGrid>
        <ResponsiveGrid xs={6} md={3}>
          <StatCard
            icon={<NotificationsIcon />}
            label="Unread Notifications"
            value={loadingN ? '—' : notifications.filter((n) => !n.read).length}
            loading={false}
          />
        </ResponsiveGrid>
      </ResponsiveGrid>

      <ResponsiveGrid container spacing={3}>
        {/* Recent Engagements */}
        <ResponsiveGrid xs={12} md={6}>
          <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 3, pt: 3, pb: 2 }}>
              <Typography variant="h6" fontWeight={600}>Recent Engagements</Typography>
              <Button size="small" endIcon={<ArrowForwardIcon />} onClick={() => navigate('/app/workspaces')}>
                View all
              </Button>
            </Stack>
            <Divider />
            {loadingW ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={28} /></Box>
            ) : workspaces.length === 0 ? (
              <Box sx={{ px: 3, py: 4, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">No engagements yet.</Typography>
                <Button size="small" sx={{ mt: 1 }} onClick={() => navigate('/app/workspaces')}>Create one</Button>
              </Box>
            ) : (
              <Box>
                {workspaces.map((ws, i) => (
                  <Box
                    key={ws.workspaceId}
                    onClick={() => navigate(`/app/workspaces/${ws.workspaceId}`)}
                    sx={{
                      px: 3,
                      py: 1.75,
                      cursor: 'pointer',
                      borderBottom: i < workspaces.length - 1 ? '1px solid' : 'none',
                      borderColor: 'divider',
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={600} noWrap>
                          {ws.clientName || ws.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {ws.engagementStage?.replace(/_/g, ' ') || ws.workspaceType || 'Engagement'} · {new Date(ws.createdAt).toLocaleDateString()}
                        </Typography>
                      </Box>
                      <Chip
                        label={ws.status}
                        size="small"
                        color={STATUS_CHIP[ws.status] ?? 'default'}
                        variant="outlined"
                        sx={{ flexShrink: 0 }}
                      />
                    </Stack>
                  </Box>
                ))}
              </Box>
            )}
          </Paper>
        </ResponsiveGrid>

        {/* Recent Research */}
        <ResponsiveGrid xs={12} md={6}>
          <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 3, pt: 3, pb: 2 }}>
              <Typography variant="h6" fontWeight={600}>Recent Research</Typography>
              <Button size="small" endIcon={<ArrowForwardIcon />} onClick={() => navigate('/app/analysis')}>
                View all
              </Button>
            </Stack>
            <Divider />
            {loadingA ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={28} /></Box>
            ) : analyses.length === 0 ? (
              <Box sx={{ px: 3, py: 4, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">No research runs yet.</Typography>
                <Button size="small" sx={{ mt: 1 }} onClick={() => navigate('/app/analysis')}>Start one</Button>
              </Box>
            ) : (
              <Box>
                {analyses.map((a, i) => (
                  <Box
                    key={a.session_id}
                    onClick={() => navigate(`/app/analysis/${a.session_id}`)}
                    sx={{
                      px: 3,
                      py: 1.75,
                      cursor: 'pointer',
                      borderBottom: i < analyses.length - 1 ? '1px solid' : 'none',
                      borderColor: 'divider',
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={600} noWrap>{a.company_name}</Typography>
                        <Typography variant="caption" color="text.secondary" noWrap display="block">
                          {a.purpose_of_meeting || 'Pre-call brief'}
                          {a.completed_at ? ` · ${new Date(a.completed_at).toLocaleDateString()}` : ''}
                        </Typography>
                      </Box>
                      <Chip
                        label={a.status}
                        size="small"
                        color={STATUS_CHIP[a.status] ?? 'default'}
                        variant="outlined"
                        sx={{ flexShrink: 0 }}
                      />
                    </Stack>
                  </Box>
                ))}
              </Box>
            )}
          </Paper>
        </ResponsiveGrid>

        {/* Notifications */}
        <ResponsiveGrid xs={12}>
          <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 3, pt: 3, pb: 2 }}>
              <Typography variant="h6" fontWeight={600}>Recent Activity</Typography>
            </Stack>
            <Divider />
            {loadingN ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={28} /></Box>
            ) : notifications.length === 0 ? (
              <Box sx={{ px: 3, py: 4, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">No notifications yet.</Typography>
              </Box>
            ) : (
              <ResponsiveGrid container>
                {notifications.map((n, i) => (
                  <ResponsiveGrid xs={12} md={6} key={n.id}>
                    <Card
                      elevation={0}
                      sx={{
                        borderRadius: 0,
                        borderBottom: '1px solid',
                        borderRight: { md: i % 2 === 0 ? '1px solid' : 'none' },
                        borderColor: 'divider',
                        bgcolor: n.read ? 'transparent' : 'action.selected',
                      }}
                    >
                      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" fontWeight={n.read ? 400 : 600}>{n.title}</Typography>
                            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>
                              {n.message}
                            </Typography>
                          </Box>
                          <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                            {new Date(n.createdAt).toLocaleDateString()}
                          </Typography>
                        </Stack>
                      </CardContent>
                    </Card>
                  </ResponsiveGrid>
                ))}
              </ResponsiveGrid>
            )}
          </Paper>
        </ResponsiveGrid>
      </ResponsiveGrid>
    </Container>
  );
};

export default DashboardPage;
