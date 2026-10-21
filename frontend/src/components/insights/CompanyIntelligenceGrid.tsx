import React from 'react';
import { Box, Typography, Paper, Stack, Chip } from '@mui/material';
import {
  People,
  AttachMoney,
  Code,
  Newspaper,
  EmojiObjects,
  Category,
} from '@mui/icons-material';
import InsightCard from './InsightCard';
import ResponsiveGrid from '../layout/ResponsiveGrid';

export interface CompanyIntelligence {
  employeeCount?: string;
  revenue?: string;
  industry: string;
  sector?: string;
  techStack?: string[];
  recentNewsSentiment: 'positive' | 'neutral' | 'negative';
  keyHighlights: string[];
  fundingInfo?: string;
  headquarters?: string;
}

interface CompanyIntelligenceGridProps {
  companyName: string;
  intelligence: CompanyIntelligence;
}

const sentimentConfig = {
  positive: { color: 'success.main', bg: 'rgba(5, 150, 105, 0.1)', label: 'Positive', trend: 'up' as const },
  neutral: { color: 'text.disabled', bg: 'rgba(115, 115, 115, 0.1)', label: 'Neutral', trend: 'neutral' as const },
  negative: { color: 'error.main', bg: 'rgba(220, 38, 38, 0.1)', label: 'Negative', trend: 'down' as const },
};

const CompanyIntelligenceGrid: React.FC<CompanyIntelligenceGridProps> = ({
  companyName,
  intelligence,
}) => {
  const sentiment = sentimentConfig[intelligence.recentNewsSentiment];

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
        {/* Header */}
        <Box>
          <Typography
            variant="h6"
            sx={{
              color: 'text.primary',
              fontWeight: 600,
              mb: 0.5,
            }}
          >
            Company Intelligence
          </Typography>
          <Typography variant="body2" color="#737373">
            Key insights about {companyName}
          </Typography>
        </Box>

        {/* Quick Stats Grid */}
        <ResponsiveGrid container spacing={2}>
          <ResponsiveGrid xs={6} md={3}>
            <InsightCard
              icon={<Category />}
              title="Industry"
              value={intelligence.industry}
              subtitle={intelligence.sector}
              color="info"
            />
          </ResponsiveGrid>
          <ResponsiveGrid xs={6} md={3}>
            <InsightCard
              icon={<People />}
              title="Company Size"
              value={intelligence.employeeCount || 'Unknown'}
              color="primary"
            />
          </ResponsiveGrid>
          <ResponsiveGrid xs={6} md={3}>
            <InsightCard
              icon={<AttachMoney />}
              title="Revenue"
              value={intelligence.revenue || 'Unknown'}
              color="success"
            />
          </ResponsiveGrid>
          <ResponsiveGrid xs={6} md={3}>
            <InsightCard
              icon={<Newspaper />}
              title="News Sentiment"
              value={sentiment.label}
              trend={sentiment.trend}
              color={intelligence.recentNewsSentiment === 'positive' ? 'success' : intelligence.recentNewsSentiment === 'negative' ? 'error' : 'info'}
            />
          </ResponsiveGrid>
        </ResponsiveGrid>

        {/* Tech Stack */}
        {intelligence.techStack && intelligence.techStack.length > 0 && (
          <Box>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
              <Code sx={{ color: 'text.secondary', fontSize: 20 }} />
              <Typography variant="subtitle2" sx={{ color: 'text.primary', fontWeight: 600 }}>
                Tech Stack
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {intelligence.techStack.map((tech, idx) => (
                <Chip
                  key={idx}
                  label={tech}
                  size="small"
                  sx={{
                    bgcolor: 'action.hover',
                    color: 'text.secondary',
                    fontWeight: 500,
                    fontSize: '0.75rem',
                  }}
                />
              ))}
            </Stack>
          </Box>
        )}

        {/* Key Highlights */}
        {intelligence.keyHighlights && intelligence.keyHighlights.length > 0 && (
          <Box>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
              <EmojiObjects sx={{ color: 'text.secondary', fontSize: 20 }} />
              <Typography variant="subtitle2" sx={{ color: 'text.primary', fontWeight: 600 }}>
                Key Highlights
              </Typography>
            </Stack>
            <Stack spacing={1}>
              {intelligence.keyHighlights.map((highlight, idx) => (
                <Stack key={idx} direction="row" alignItems="flex-start" spacing={1.5}>
                  <Box
                    sx={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      bgcolor: 'text.secondary',
                      mt: 0.8,
                      flexShrink: 0,
                    }}
                  />
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {highlight}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Box>
        )}

        {/* Additional Info */}
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          {intelligence.fundingInfo && (
            <Box
              sx={{
                px: 2,
                py: 1,
                bgcolor: 'action.hover',
                borderRadius: 1,
              }}
            >
              <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block' }}>
                Funding
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 600 }}>
                {intelligence.fundingInfo}
              </Typography>
            </Box>
          )}
          {intelligence.headquarters && (
            <Box
              sx={{
                px: 2,
                py: 1,
                bgcolor: 'action.hover',
                borderRadius: 1,
              }}
            >
              <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block' }}>
                Headquarters
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 600 }}>
                {intelligence.headquarters}
              </Typography>
            </Box>
          )}
        </Stack>
      </Stack>
    </Paper>
  );
};

export default CompanyIntelligenceGrid;
