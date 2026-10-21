import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Assessment as AssessmentIcon,
  Cloud,
  CloudQueue,
  Delete,
  Dns,
  Refresh,
  Speed,
  Storage,
  SwapHoriz,
} from '@mui/icons-material';
import { apiGet, apiPost, apiDelete } from '../utils/api';
import SaveBookmarkButton from '../components/SaveBookmarkButton';
import ExpiryBadge from '../components/ExpiryBadge';
import {
  AssessmentSummary,
  UrgencyLevel,
  getUrgencyColor,
  getScoreColor,
  getStatusLabel,
  getMigrationType,
  getMigrationTypeLabel,
  MigrationType,
} from '../types/atlassianAssessment';

const getMigrationTypeIcon = (type: MigrationType) => {
  switch (type) {
    case 'dc-to-cloud':
      return <Dns sx={{ fontSize: 14 }} />;
    case 'server-to-cloud':
      return <Storage sx={{ fontSize: 14 }} />;
    case 'cloud-to-cloud':
      return <CloudQueue sx={{ fontSize: 14 }} />;
    default:
      return <SwapHoriz sx={{ fontSize: 14 }} />;
  }
};

const getMigrationTypeColor = (type: MigrationType) => {
  switch (type) {
    case 'dc-to-cloud':
      return '#0052CC';
    case 'server-to-cloud':
      return '#6554C0';
    case 'cloud-to-cloud':
      return '#00875A';
    default:
      return '#6B778C';
  }
};

const AtlassianAssessmentListPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Data state
  const [assessments, setAssessments] = useState<AssessmentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [assessmentToDelete, setAssessmentToDelete] = useState<AssessmentSummary | null>(null);

  // Pre-fill company name from query param
  useEffect(() => {
    const company = searchParams.get('company');
    if (company) {
      setCompanyName(company);
    }
  }, [searchParams]);

  // Fetch assessments on mount
  useEffect(() => {
    fetchAssessments();
  }, []);

  const fetchAssessments = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet('/api/atlassian/assessments');
      if (data.success) {
        setAssessments(data.data?.assessments || []);
      } else {
        throw new Error(data.error || 'Failed to fetch assessments');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load assessments');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!companyName.trim()) return;
    setActionLoading(true);
    setError(null);
    try {
      const meetingId = searchParams.get('meetingId') || undefined;
      const data = await apiPost('/api/atlassian/assessments', {
        companyName: companyName.trim(),
        meetingId,
      });
      if (data.success) {
        setCreateDialogOpen(false);
        setCompanyName('');
        navigate(`/app/atlassian-assessment/${data.data.id}`);
      } else {
        throw new Error(data.error || 'Failed to create assessment');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create assessment');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!assessmentToDelete) return;
    setActionLoading(true);
    setError(null);
    try {
      const data = await apiDelete(`/api/atlassian/assessments/${assessmentToDelete.id}`);
      if (data.success) {
        setDeleteDialogOpen(false);
        setAssessmentToDelete(null);
        fetchAssessments();
      } else {
        throw new Error(data.error || 'Failed to delete assessment');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete assessment');
    } finally {
      setActionLoading(false);
    }
  };

  const openDeleteDialog = (assessment: AssessmentSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    setAssessmentToDelete(assessment);
    setDeleteDialogOpen(true);
  };

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
        <Box>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Cloud sx={{ color: '#0052CC', fontSize: 32 }} />
            <Typography variant="h4" fontWeight={600}>
              Atlassian Migration Assessment
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, ml: 5.5 }}>
            Evaluate DC/Server environments and identify Cloud migration opportunities
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={fetchAssessments}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
            sx={{ bgcolor: '#0052CC', '&:hover': { bgcolor: '#0747A6' } }}
          >
            New Assessment
          </Button>
        </Stack>
      </Stack>

      {/* Error Alert */}
      {error && (
        <Paper sx={{ p: 2, mb: 3, bgcolor: 'error.dark' }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography color="error.contrastText">{error}</Typography>
            <Button size="small" onClick={() => setError(null)} sx={{ color: 'error.contrastText' }}>
              Dismiss
            </Button>
          </Stack>
        </Paper>
      )}

      {/* Loading */}
      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {/* Empty State */}
      {!loading && assessments.length === 0 && (
        <Paper
          sx={{
            p: 6,
            textAlign: 'center',
            bgcolor: 'rgba(255,255,255,0.03)',
            border: '2px dashed rgba(255,255,255,0.1)',
          }}
        >
          <Storage sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            No assessments yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Create your first Atlassian migration assessment to get started
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
            sx={{ bgcolor: '#0052CC', '&:hover': { bgcolor: '#0747A6' } }}
          >
            Create Assessment
          </Button>
        </Paper>
      )}

      {/* Assessments Grid */}
      {assessments.length > 0 && (
        <Grid container spacing={3}>
          {assessments.map((assessment) => {
            // Determine migration type from the assessment (could be stored or inferred)
            const migrationType = assessment.migrationType || 'unknown';
            const migrationColor = getMigrationTypeColor(migrationType);

            return (
              <Grid size={{ xs: 12, md: 6, lg: 4 }} key={assessment.id}>
                <Card
                  sx={{
                    height: '100%',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    borderRadius: 2,
                    overflow: 'hidden',
                    border: '1px solid rgba(255,255,255,0.08)',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
                      borderColor: 'rgba(0, 82, 204, 0.3)',
                    },
                  }}
                  onClick={() => navigate(`/app/atlassian-assessment/${assessment.id}`)}
                >
                  {/* Migration Type Header */}
                  {assessment.status === 'completed' && migrationType !== 'unknown' && (
                    <Box
                      sx={{
                        px: 2,
                        py: 0.75,
                        bgcolor: `${migrationColor}15`,
                        borderBottom: `2px solid ${migrationColor}`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                      }}
                    >
                      {getMigrationTypeIcon(migrationType)}
                      <Typography variant="caption" fontWeight={600} sx={{ color: migrationColor, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        {getMigrationTypeLabel(migrationType)}
                      </Typography>
                    </Box>
                  )}

                  <CardContent sx={{ p: 2.5 }}>
                    <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="h6" noWrap fontWeight={700} sx={{ mb: 1 }}>
                          {assessment.companyName}
                        </Typography>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                          <Chip
                            label={getStatusLabel(assessment.status)}
                            size="small"
                            sx={{
                              fontWeight: 600,
                              fontSize: '0.7rem',
                              bgcolor: assessment.status === 'completed' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.08)',
                              color: assessment.status === 'completed' ? '#10b981' : 'text.secondary',
                            }}
                          />
                          {assessment.urgencyLevel && (
                            <Chip
                              label={assessment.urgencyLevel.toUpperCase()}
                              size="small"
                              color={getUrgencyColor(assessment.urgencyLevel)}
                              sx={{ fontWeight: 600, fontSize: '0.65rem' }}
                            />
                          )}
                          <ExpiryBadge isSaved={assessment.isSaved ?? false} createdAt={assessment.createdAt} />
                        </Stack>
                      </Box>
                      <Stack direction="row" alignItems="center" spacing={0.5}>
                        <SaveBookmarkButton
                          modelType="atlassianAssessment"
                          id={assessment.id}
                          isSaved={assessment.isSaved ?? false}
                          onToggle={(val) => {
                            setAssessments((prev) =>
                              prev.map((a) => (a.id === assessment.id ? { ...a, isSaved: val } : a))
                            );
                          }}
                        />
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            onClick={(e) => openDeleteDialog(assessment, e)}
                            sx={{
                              opacity: 0.6,
                              '&:hover': { opacity: 1, color: 'error.main' },
                            }}
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </Stack>

                    <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.06)' }} />

                    {/* Score indicator */}
                    {assessment.migrationScore !== null ? (
                      <Box>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                          <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.65rem' }}>
                            Migration Readiness
                          </Typography>
                          <Typography
                            variant="h4"
                            fontWeight={800}
                            sx={{ color: getScoreColor(assessment.migrationScore) }}
                          >
                            {assessment.migrationScore}
                          </Typography>
                        </Stack>
                        <LinearProgress
                          variant="determinate"
                          value={assessment.migrationScore}
                          sx={{
                            height: 6,
                            borderRadius: 3,
                            bgcolor: 'rgba(255,255,255,0.08)',
                            '& .MuiLinearProgress-bar': {
                              bgcolor: getScoreColor(assessment.migrationScore),
                              borderRadius: 3,
                            },
                          }}
                        />
                      </Box>
                    ) : (
                      <Box sx={{ py: 2, textAlign: 'center', bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 1.5 }}>
                        <AssessmentIcon sx={{ fontSize: 32, color: 'text.secondary', mb: 0.5 }} />
                        <Typography variant="body2" color="text.secondary">
                          Assessment not yet complete
                        </Typography>
                      </Box>
                    )}

                    <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block', fontSize: '0.7rem' }}>
                      Created {new Date(assessment.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* New Assessment Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Cloud sx={{ color: '#0052CC' }} />
            <span>New Migration Assessment</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Start an Atlassian Cloud migration assessment for a company. You'll answer a series of
            questions about their current environment, and receive a detailed analysis with
            recommendations.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            label="Company Name"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="e.g., Acme Corporation"
            sx={{ mt: 1 }}
            disabled={actionLoading}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)} disabled={actionLoading}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={!companyName.trim() || actionLoading}
            sx={{ bgcolor: '#0052CC', '&:hover': { bgcolor: '#0747A6' } }}
          >
            {actionLoading ? <CircularProgress size={20} /> : 'Start Assessment'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Delete Assessment?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the assessment for <strong>{assessmentToDelete?.companyName}</strong>? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={actionLoading}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleDelete}
            disabled={actionLoading}
          >
            {actionLoading ? <CircularProgress size={20} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default AtlassianAssessmentListPage;
