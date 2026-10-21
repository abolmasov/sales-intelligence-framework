import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Stack,
  Collapse,
  IconButton,
  Tooltip,
  LinearProgress,
  Chip,
  Alert,
} from '@mui/material';
import {
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  CheckCircle as CompleteIcon,
  Warning as GapIcon,
  Psychology as KnowledgeIcon,
} from '@mui/icons-material';
import { apiGet } from '../utils/api';

interface Section {
  id: string;
  name: string;
  completeness: number;
  answered: number;
  total: number;
}

interface Gap {
  question_id: string;
  section: string;
  question: string;
}

interface CompletenessData {
  overall: number;
  answered_count: number;
  total_count: number;
  status: string;
  sections: Section[];
  gaps: Gap[];
}

interface KnowledgeBaseIndicatorProps {
  dealId: string;
  compact?: boolean;
  onViewGaps?: () => void;
}

const getSectionColor = (completeness: number): string => {
  if (completeness >= 100) return '#22c55e';
  if (completeness >= 50) return '#f59e0b';
  return '#ef4444';
};

const getOverallColor = (overall: number): string => {
  if (overall >= 80) return '#22c55e';
  if (overall >= 50) return '#f59e0b';
  if (overall >= 25) return '#fb923c';
  return '#ef4444';
};

const KnowledgeBaseIndicator: React.FC<KnowledgeBaseIndicatorProps> = ({
  dealId,
  compact = false,
  onViewGaps,
}) => {
  const [data, setData] = useState<CompletenessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const fetchCompleteness = async () => {
      if (!dealId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await apiGet(`/api/deals/${dealId}/pursuit-brief-completeness`);
        if (response?.success) {
          setData(response.data);
        } else {
          setError(response?.error || 'Failed to load knowledge base data');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load knowledge base data');
      } finally {
        setLoading(false);
      }
    };

    fetchCompleteness();
  }, [dealId]);

  if (loading) {
    return (
      <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 1 }}>
        <CircularProgress size={16} />
        <Typography variant="caption" color="text.secondary">
          Loading knowledge base...
        </Typography>
      </Stack>
    );
  }

  if (error) {
    return (
      <Alert severity="warning" sx={{ py: 0.5 }}>
        <Typography variant="caption">{error}</Typography>
      </Alert>
    );
  }

  if (!data) {
    return null;
  }

  const overallColor = getOverallColor(data.overall);
  const gapCount = data.gaps.length;
  const incompleteSections = data.sections.filter((s) => s.completeness < 100);

  if (compact) {
    // Compact circular indicator
    return (
      <Tooltip
        title={`Knowledge Base: ${data.overall}% complete (${data.answered_count}/${data.total_count} questions answered)`}
        arrow
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <Box sx={{ position: 'relative', display: 'inline-flex' }}>
            <CircularProgress
              variant="determinate"
              value={data.overall}
              size={32}
              thickness={4}
              sx={{
                color: overallColor,
                '& .MuiCircularProgress-circle': {
                  strokeLinecap: 'round',
                },
              }}
            />
            <Box
              sx={{
                top: 0,
                left: 0,
                bottom: 0,
                right: 0,
                position: 'absolute',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Typography
                variant="caption"
                sx={{ fontSize: '0.6rem', fontWeight: 700, color: overallColor }}
              >
                {data.overall}%
              </Typography>
            </Box>
          </Box>
          {gapCount > 0 && (
            <Chip
              size="small"
              icon={<GapIcon sx={{ fontSize: 12 }} />}
              label={`${gapCount} gaps`}
              sx={{
                height: 20,
                fontSize: '0.65rem',
                bgcolor: 'rgba(239, 68, 68, 0.1)',
                color: 'error.main',
                '& .MuiChip-icon': { color: 'error.main' },
              }}
            />
          )}
        </Stack>
      </Tooltip>
    );
  }

  // Full view with expandable sections
  return (
    <Box
      sx={{
        p: 2,
        border: '1px solid rgba(0, 35, 72, 0.12)',
        borderRadius: 2,
        bgcolor: '#FFFDF6',
      }}
    >
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <KnowledgeIcon sx={{ color: 'text.primary', fontSize: 18 }} />
          <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
            Knowledge Base
          </Typography>
        </Stack>
        <IconButton size="small" onClick={() => setExpanded(!expanded)}>
          {expanded ? <CollapseIcon fontSize="small" /> : <ExpandIcon fontSize="small" />}
        </IconButton>
      </Stack>

      {/* Overall progress */}
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 1 }}>
        <Box sx={{ position: 'relative', display: 'inline-flex' }}>
          <CircularProgress
            variant="determinate"
            value={data.overall}
            size={48}
            thickness={4}
            sx={{
              color: overallColor,
              '& .MuiCircularProgress-circle': {
                strokeLinecap: 'round',
              },
            }}
          />
          <Box
            sx={{
              top: 0,
              left: 0,
              bottom: 0,
              right: 0,
              position: 'absolute',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 700, color: overallColor }}>
              {data.overall}%
            </Typography>
          </Box>
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="caption" sx={{ color: '#1A385E' }}>
            {data.answered_count} of {data.total_count} questions answered
          </Typography>
          {gapCount > 0 && (
            <Typography variant="caption" sx={{ display: 'block', color: 'error.main', fontWeight: 600 }}>
              {gapCount} knowledge gap{gapCount !== 1 ? 's' : ''} remaining
            </Typography>
          )}
        </Box>
      </Stack>

      {/* Expandable section details */}
      <Collapse in={expanded}>
        <Stack spacing={1} sx={{ mt: 2 }}>
          <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.primary', textTransform: 'uppercase' }}>
            Section Breakdown
          </Typography>
          {data.sections.map((section) => (
            <Box key={section.id}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  {section.completeness >= 100 ? (
                    <CompleteIcon sx={{ fontSize: 14, color: 'success.main' }} />
                  ) : (
                    <GapIcon sx={{ fontSize: 14, color: getSectionColor(section.completeness) }} />
                  )}
                  <Typography variant="caption" sx={{ color: 'text.primary', fontWeight: 500 }}>
                    {section.name}
                  </Typography>
                </Stack>
                <Typography
                  variant="caption"
                  sx={{ color: getSectionColor(section.completeness), fontWeight: 600 }}
                >
                  {section.answered}/{section.total}
                </Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={section.completeness}
                sx={{
                  height: 4,
                  borderRadius: 2,
                  bgcolor: 'rgba(0, 35, 72, 0.1)',
                  '& .MuiLinearProgress-bar': {
                    bgcolor: getSectionColor(section.completeness),
                    borderRadius: 2,
                  },
                }}
              />
            </Box>
          ))}

          {/* Gaps summary */}
          {gapCount > 0 && (
            <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid rgba(0, 35, 72, 0.08)' }}>
              <Typography
                variant="caption"
                sx={{ fontWeight: 600, color: 'error.main', display: 'block', mb: 0.5 }}
              >
                Missing Information:
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={0.5}>
                {incompleteSections.slice(0, 4).map((section) => (
                  <Chip
                    key={section.id}
                    size="small"
                    label={section.name}
                    sx={{
                      height: 20,
                      fontSize: '0.6rem',
                      bgcolor: 'rgba(239, 68, 68, 0.1)',
                      color: 'error.main',
                    }}
                  />
                ))}
                {incompleteSections.length > 4 && (
                  <Chip
                    size="small"
                    label={`+${incompleteSections.length - 4} more`}
                    sx={{
                      height: 20,
                      fontSize: '0.6rem',
                      bgcolor: 'rgba(0, 35, 72, 0.1)',
                      color: '#1A385E',
                    }}
                  />
                )}
              </Stack>
            </Box>
          )}
        </Stack>
      </Collapse>
    </Box>
  );
};

export default KnowledgeBaseIndicator;
