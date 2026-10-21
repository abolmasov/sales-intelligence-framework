import React from 'react';
import { Box, Typography, Paper, Stack, Chip, LinearProgress } from '@mui/material';
import {
  CheckCircle,
  Warning,
  Error as ErrorIcon,
  TrendingUp,
  Person,
  AttachMoney,
  Schedule,
  Group,
  BusinessCenter,
} from '@mui/icons-material';

export interface DealHealthSignals {
  overallScore: number;
  budgetMentioned: boolean;
  timelineUrgency: 'high' | 'medium' | 'low' | 'unknown';
  decisionMakerPresent: boolean;
  painPointsIdentified: string[];
  competitorMentions: string[];
  riskFactors: string[];
  opportunitySignals: string[];
}

interface DealHealthScoreCardProps {
  companyName: string;
  signals: DealHealthSignals;
  compact?: boolean;
}

const getScoreColor = (score: number) => {
  if (score >= 70) return { main: '#059669', bg: 'rgba(5, 150, 105, 0.15)' };
  if (score >= 40) return { main: '#d97706', bg: 'rgba(217, 119, 6, 0.15)' };
  return { main: '#dc2626', bg: 'rgba(220, 38, 38, 0.15)' };
};

const getScoreLabel = (score: number) => {
  if (score >= 70) return 'Strong';
  if (score >= 40) return 'Moderate';
  return 'At Risk';
};

const DealHealthScoreCard: React.FC<DealHealthScoreCardProps> = ({
  companyName,
  signals,
  compact = false,
}) => {
  const scoreColor = getScoreColor(signals.overallScore);
  const scoreLabel = getScoreLabel(signals.overallScore);

  const riskItems = [
    ...signals.riskFactors.map(r => ({ text: r, type: 'risk' as const })),
    ...(signals.competitorMentions.length > 0 ? [{ text: `Competitor mentioned: ${signals.competitorMentions.join(', ')}`, type: 'risk' as const }] : []),
    ...(!signals.decisionMakerPresent ? [{ text: 'No executive sponsor identified', type: 'risk' as const }] : []),
  ];

  const opportunityItems = [
    ...signals.opportunitySignals.map(o => ({ text: o, type: 'opportunity' as const })),
    ...(signals.budgetMentioned ? [{ text: 'Budget confirmed', type: 'opportunity' as const }] : []),
    ...(signals.decisionMakerPresent ? [{ text: 'Decision maker present', type: 'opportunity' as const }] : []),
    ...(signals.painPointsIdentified.length > 0 ? [{ text: `${signals.painPointsIdentified.length} pain points identified`, type: 'opportunity' as const }] : []),
  ];

  if (compact) {
    return (
      <Paper
        sx={{
          p: 2,
          borderRadius: 1.5,
          borderColor: 'divider',
          background: '#FFFFFF',
          boxShadow: 'none',
        }}
      >
        <Stack direction="row" alignItems="center" spacing={2}>
          {/* Circular Score */}
          <Box
            sx={{
              width: 60,
              height: 60,
              borderRadius: '50%',
              background: `conic-gradient(${scoreColor.main} ${signals.overallScore * 3.6}deg, #E5E7EB ${signals.overallScore * 3.6}deg)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                bgcolor: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 700, color: scoreColor.main, lineHeight: 1 }}>
                {signals.overallScore}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" sx={{ color: 'text.primary', fontWeight: 600 }}>
              Deal Health
            </Typography>
            <Typography variant="caption" sx={{ color: scoreColor.main, fontWeight: 600 }}>
              {scoreLabel}
            </Typography>
          </Box>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper
      sx={{
        p: 3,
        borderRadius: 1.5,
        borderColor: 'divider',
        background: '#FFFFFF',
        boxShadow: 'none',
      }}
    >
      <Stack spacing={3}>
        {/* Header with Score */}
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography variant="h6" sx={{ color: 'text.primary', fontWeight: 600 }}>
              Deal Health Score
            </Typography>
            <Typography variant="body2" color="#737373">
              {companyName}
            </Typography>
          </Box>

          {/* Large Circular Score */}
          <Box
            sx={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: `conic-gradient(${scoreColor.main} ${signals.overallScore * 3.6}deg, #E5E7EB ${signals.overallScore * 3.6}deg)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                bgcolor: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
              }}
            >
              <Typography variant="h4" sx={{ fontWeight: 700, color: scoreColor.main, lineHeight: 1 }}>
                {signals.overallScore}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem' }}>
                {scoreLabel}
              </Typography>
            </Box>
          </Box>
        </Stack>

        {/* Quick Indicators */}
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip
            size="small"
            icon={<AttachMoney fontSize="small" />}
            label={signals.budgetMentioned ? 'Budget Confirmed' : 'No Budget Info'}
            sx={{
              bgcolor: signals.budgetMentioned ? 'rgba(5, 150, 105, 0.1)' : 'rgba(115, 115, 115, 0.1)',
              color: signals.budgetMentioned ? '#059669' : '#737373',
              fontWeight: 500,
              fontSize: '0.75rem',
            }}
          />
          <Chip
            size="small"
            icon={<Person fontSize="small" />}
            label={signals.decisionMakerPresent ? 'Decision Maker' : 'No Exec Sponsor'}
            sx={{
              bgcolor: signals.decisionMakerPresent ? 'rgba(5, 150, 105, 0.1)' : 'rgba(220, 38, 38, 0.1)',
              color: signals.decisionMakerPresent ? '#059669' : '#dc2626',
              fontWeight: 500,
              fontSize: '0.75rem',
            }}
          />
          <Chip
            size="small"
            icon={<Schedule fontSize="small" />}
            label={`${signals.timelineUrgency.charAt(0).toUpperCase() + signals.timelineUrgency.slice(1)} Urgency`}
            sx={{
              bgcolor: signals.timelineUrgency === 'high'
                ? 'rgba(5, 150, 105, 0.1)'
                : signals.timelineUrgency === 'medium'
                  ? 'rgba(217, 119, 6, 0.1)'
                  : 'rgba(115, 115, 115, 0.1)',
              color: signals.timelineUrgency === 'high'
                ? '#059669'
                : signals.timelineUrgency === 'medium'
                  ? '#d97706'
                  : '#737373',
              fontWeight: 500,
              fontSize: '0.75rem',
            }}
          />
        </Stack>

        {/* Risk & Opportunity Signals */}
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          {/* Risks */}
          <Box sx={{ flex: 1 }}>
            <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 1 }}>
              <ErrorIcon fontSize="small" sx={{ color: 'error.main' }} />
              <Typography variant="caption" sx={{ fontWeight: 600, color: 'error.main' }}>
                RISK SIGNALS ({riskItems.length})
              </Typography>
            </Stack>
            <Stack spacing={0.5}>
              {riskItems.slice(0, 4).map((item, idx) => (
                <Stack key={idx} direction="row" alignItems="flex-start" spacing={1}>
                  <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'error.main', mt: 0.8, flexShrink: 0 }} />
                  <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                    {item.text}
                  </Typography>
                </Stack>
              ))}
              {riskItems.length === 0 && (
                <Typography variant="body2" sx={{ color: 'text.disabled', fontSize: '0.8rem', fontStyle: 'italic' }}>
                  No major risks identified
                </Typography>
              )}
            </Stack>
          </Box>

          {/* Opportunities */}
          <Box sx={{ flex: 1 }}>
            <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 1 }}>
              <CheckCircle fontSize="small" sx={{ color: 'success.main' }} />
              <Typography variant="caption" sx={{ fontWeight: 600, color: 'success.main' }}>
                OPPORTUNITY SIGNALS ({opportunityItems.length})
              </Typography>
            </Stack>
            <Stack spacing={0.5}>
              {opportunityItems.slice(0, 4).map((item, idx) => (
                <Stack key={idx} direction="row" alignItems="flex-start" spacing={1}>
                  <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'success.main', mt: 0.8, flexShrink: 0 }} />
                  <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                    {item.text}
                  </Typography>
                </Stack>
              ))}
              {opportunityItems.length === 0 && (
                <Typography variant="body2" sx={{ color: 'text.disabled', fontSize: '0.8rem', fontStyle: 'italic' }}>
                  No clear opportunities identified
                </Typography>
              )}
            </Stack>
          </Box>
        </Stack>
      </Stack>
    </Paper>
  );
};

export default DealHealthScoreCard;
