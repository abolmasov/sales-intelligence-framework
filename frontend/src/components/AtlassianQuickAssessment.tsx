import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import {
  ArrowForward,
  Cloud,
  PlayArrow,
  Speed,
} from '@mui/icons-material';
import { apiGet } from '../utils/api';

interface AtlassianQuickAssessmentProps {
  companyName: string;
  meetingId?: string;
}

interface AssessmentPreview {
  id: string;
  companyName: string;
  status: string;
  migrationScore: number | null;
  urgencyLevel: string | null;
  updatedAt: string;
}

const getScoreColor = (score: number | null) => {
  if (score === null) return '#9e9e9e';
  if (score >= 70) return '#10b981';
  if (score >= 50) return '#f59e0b';
  if (score >= 30) return '#f97316';
  return '#ef4444';
};

const getUrgencyColor = (urgency: string | null) => {
  switch (urgency) {
    case 'critical':
      return 'error';
    case 'high':
      return 'warning';
    case 'medium':
      return 'info';
    case 'low':
      return 'success';
    default:
      return 'default';
  }
};

const AtlassianQuickAssessment: React.FC<AtlassianQuickAssessmentProps> = ({
  companyName,
  meetingId,
}) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [assessment, setAssessment] = useState<AssessmentPreview | null>(null);

  useEffect(() => {
    const fetchAssessment = async () => {
      try {
        setLoading(true);
        // Search for existing assessments for this company
        const response = await apiGet(`/api/atlassian/assessments?companyName=${encodeURIComponent(companyName)}&limit=1`);
        const data = response?.data ?? response;

        if (data?.success && data.data.assessments?.length > 0) {
          setAssessment(data.data.assessments[0]);
        } else {
          setAssessment(null);
        }
      } catch (err) {
        console.error('Failed to fetch assessment:', err);
        setAssessment(null);
      } finally {
        setLoading(false);
      }
    };

    if (companyName) {
      fetchAssessment();
    }
  }, [companyName]);

  const handleStartAssessment = () => {
    const params = new URLSearchParams({
      company: companyName,
      ...(meetingId && { meetingId }),
    });
    navigate(`/atlassian-assessment?${params.toString()}`);
  };

  const handleViewAssessment = () => {
    if (assessment) {
      navigate(`/atlassian-assessment/${assessment.id}`);
    }
  };

  // Loading state
  if (loading) {
    return (
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          borderRadius: 2,
          bgcolor: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <CircularProgress size={18} sx={{ color: '#0052CC' }} />
          <Typography variant="body2" color="text.secondary">
            Checking for Atlassian assessment...
          </Typography>
        </Stack>
      </Paper>
    );
  }

  // No assessment - show CTA
  if (!assessment) {
    return (
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          borderRadius: 2,
          border: '2px dashed rgba(0, 82, 204, 0.3)',
          bgcolor: 'rgba(0, 82, 204, 0.03)',
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Cloud sx={{ color: '#0052CC', fontSize: 20 }} />
            <Box>
              <Typography variant="body2" fontWeight={500}>
                Atlassian Migration Assessment
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Evaluate {companyName}'s DC/Server environment for Cloud migration
              </Typography>
            </Box>
          </Stack>
          <Button
            size="small"
            variant="outlined"
            startIcon={<PlayArrow />}
            onClick={handleStartAssessment}
            sx={{
              borderColor: '#0052CC',
              color: '#0052CC',
              textTransform: 'none',
              '&:hover': { bgcolor: 'rgba(0, 82, 204, 0.1)' },
            }}
          >
            Start Assessment
          </Button>
        </Stack>
      </Paper>
    );
  }

  // Has assessment - show preview
  const isComplete = assessment.status === 'completed';
  const statusLabel =
    assessment.status === 'pending'
      ? 'Not Started'
      : assessment.status === 'questionnaire'
      ? 'In Progress'
      : assessment.status === 'analyzing'
      ? 'Analyzing...'
      : assessment.status === 'completed'
      ? 'Complete'
      : assessment.status;

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderRadius: 2,
        bgcolor: isComplete ? 'rgba(16, 185, 129, 0.04)' : 'rgba(0, 82, 204, 0.03)',
        border: `1px solid ${isComplete ? 'rgba(16, 185, 129, 0.2)' : 'rgba(0, 82, 204, 0.2)'}`,
        cursor: 'pointer',
        transition: 'all 0.2s',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: 2,
        },
      }}
      onClick={handleViewAssessment}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Cloud sx={{ color: isComplete ? '#10b981' : '#0052CC', fontSize: 20 }} />
          <Box>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="body2" fontWeight={500}>
                Atlassian Migration Assessment
              </Typography>
              <Chip
                label={statusLabel}
                size="small"
                color={isComplete ? 'success' : 'default'}
                sx={{ height: 20, fontSize: '0.7rem' }}
              />
            </Stack>

            {isComplete && assessment.migrationScore !== null ? (
              <Stack direction="row" alignItems="center" spacing={2} sx={{ mt: 0.5 }}>
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <Speed sx={{ fontSize: 14, color: getScoreColor(assessment.migrationScore) }} />
                  <Typography
                    variant="caption"
                    fontWeight={600}
                    sx={{ color: getScoreColor(assessment.migrationScore) }}
                  >
                    Score: {assessment.migrationScore}/100
                  </Typography>
                </Stack>
                {assessment.urgencyLevel && (
                  <Chip
                    label={`${assessment.urgencyLevel} urgency`}
                    size="small"
                    color={getUrgencyColor(assessment.urgencyLevel) as any}
                    sx={{ height: 18, fontSize: '0.65rem' }}
                  />
                )}
              </Stack>
            ) : (
              <Typography variant="caption" color="text.secondary">
                Click to continue or view assessment
              </Typography>
            )}
          </Box>
        </Stack>

        <ArrowForward sx={{ color: 'text.secondary', fontSize: 18 }} />
      </Stack>

      {/* Progress bar for in-progress assessments */}
      {assessment.status === 'questionnaire' && (
        <LinearProgress
          variant="indeterminate"
          sx={{
            mt: 1.5,
            height: 3,
            borderRadius: 2,
            bgcolor: 'rgba(0, 82, 204, 0.1)',
            '& .MuiLinearProgress-bar': { bgcolor: '#0052CC' },
          }}
        />
      )}
    </Paper>
  );
};

export default AtlassianQuickAssessment;
