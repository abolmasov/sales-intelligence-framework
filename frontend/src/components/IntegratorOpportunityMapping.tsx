import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  LinearProgress,
  Grid,
  Card,
  CardContent,
  Tooltip,
  Divider,
  Stack,
} from '@mui/material';
import BusinessIcon from '@mui/icons-material/Business';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import CategoryIcon from '@mui/icons-material/Category';
import StarIcon from '@mui/icons-material/Star';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

export interface IntegratorServiceLine {
  name: string;
  relevanceScore: number;
  evidence: string[];
  recommendedServices: string[];
  color: string;
}

export interface OpportunityCategory {
  category: string;
  name: string;
  confidence: number;
  indicators: string[];
  color: string;
}

export interface IntegratorOpportunityMappingData {
  serviceLines: IntegratorServiceLine[];
  opportunityCategory: OpportunityCategory;
  strategicFitScore: number;
  strategicFitAnalysis: string;
}

interface IntegratorOpportunityMappingProps {
  data: IntegratorOpportunityMappingData | null;
  loading?: boolean;
  compact?: boolean;
}

const IntegratorOpportunityMapping: React.FC<IntegratorOpportunityMappingProps> = ({
  data,
  loading = false,
  compact = false,
}) => {
  if (loading) {
    return (
      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Analyzing Northstar Integrators opportunity areas...
        </Typography>
        <LinearProgress />
      </Paper>
    );
  }

  if (!data) {
    return null;
  }

  const { serviceLines, opportunityCategory, strategicFitScore, strategicFitAnalysis } = data;

  // Get score color based on value
  const getScoreColor = (score: number) => {
    if (score >= 70) return 'success';
    if (score >= 50) return 'warning';
    return 'error';
  };

  if (compact) {
    return (
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Chip
            icon={<CategoryIcon sx={{ fontSize: 16 }} />}
            label={opportunityCategory.name}
            size="small"
            sx={{ bgcolor: opportunityCategory.color, color: 'white' }}
          />
          {serviceLines.slice(0, 2).map((sl, idx) => (
            <Chip
              key={idx}
              label={sl.name}
              size="small"
              variant="outlined"
              sx={{ borderColor: sl.color, color: sl.color }}
            />
          ))}
          <Chip
            icon={<StarIcon sx={{ fontSize: 14 }} />}
            label={`Fit: ${strategicFitScore}%`}
            size="small"
            color={getScoreColor(strategicFitScore)}
            variant="outlined"
          />
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 2.5, mb: 2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <BusinessIcon sx={{ color: 'primary.main' }} />
        <Typography variant="h6" fontWeight={600}>
          Northstar Integrators Opportunity Areas
        </Typography>
      </Box>

      <Grid container spacing={2}>
        {/* Opportunity Category */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <CategoryIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                <Typography variant="subtitle2" color="text.secondary">
                  Opportunity Type
                </Typography>
              </Box>
              <Chip
                label={opportunityCategory.name}
                sx={{
                  bgcolor: opportunityCategory.color,
                  color: 'white',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  height: 32,
                }}
              />
              <Box sx={{ mt: 1.5 }}>
                <Typography variant="caption" color="text.secondary">
                  Confidence: {opportunityCategory.confidence}%
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={opportunityCategory.confidence}
                  sx={{ mt: 0.5, height: 4, borderRadius: 2 }}
                />
              </Box>
              {opportunityCategory.indicators.length > 0 && (
                <Box sx={{ mt: 1.5 }}>
                  {opportunityCategory.indicators.map((indicator, idx) => (
                    <Typography key={idx} variant="caption" color="text.secondary" display="block">
                      {indicator}
                    </Typography>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Strategic Fit Score */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <TrendingUpIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                <Typography variant="subtitle2" color="text.secondary">
                  Strategic Fit
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                <Typography
                  variant="h3"
                  fontWeight={700}
                  color={`${getScoreColor(strategicFitScore)}.main`}
                >
                  {strategicFitScore}
                </Typography>
                <Typography variant="h6" color="text.secondary">
                  / 100
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={strategicFitScore}
                color={getScoreColor(strategicFitScore)}
                sx={{ mt: 1, height: 8, borderRadius: 4 }}
              />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, lineHeight: 1.5 }}>
                {strategicFitAnalysis}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Service Lines */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <CheckCircleIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                <Typography variant="subtitle2" color="text.secondary">
                  Relevant Service Lines
                </Typography>
              </Box>
              <Stack spacing={1}>
                {serviceLines.slice(0, 4).map((sl, idx) => (
                  <Tooltip
                    key={idx}
                    title={
                      <Box>
                        <Typography variant="caption" fontWeight={600}>Evidence:</Typography>
                        <ul style={{ margin: '4px 0', paddingLeft: 16 }}>
                          {sl.evidence.slice(0, 3).map((e, i) => (
                            <li key={i}><Typography variant="caption">{e}</Typography></li>
                          ))}
                        </ul>
                        <Typography variant="caption" fontWeight={600}>Recommended:</Typography>
                        <ul style={{ margin: '4px 0', paddingLeft: 16 }}>
                          {sl.recommendedServices.slice(0, 2).map((s, i) => (
                            <li key={i}><Typography variant="caption">{s}</Typography></li>
                          ))}
                        </ul>
                      </Box>
                    }
                    arrow
                    placement="left"
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        p: 1,
                        borderRadius: 1,
                        bgcolor: 'grey.50',
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'grey.100' },
                      }}
                    >
                      <Box
                        sx={{
                          width: 4,
                          height: 32,
                          borderRadius: 2,
                          bgcolor: sl.color,
                        }}
                      />
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" fontWeight={500}>
                          {sl.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {sl.relevanceScore}% match
                        </Typography>
                      </Box>
                    </Box>
                  </Tooltip>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Recommended Services Section */}
      {serviceLines.length > 0 && (
        <>
          <Divider sx={{ my: 2 }} />
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Recommended Services
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {[...new Set(serviceLines.flatMap(sl => sl.recommendedServices))].slice(0, 8).map((service, idx) => (
                <Chip
                  key={idx}
                  label={service}
                  size="small"
                  variant="outlined"
                  sx={{ mb: 0.5 }}
                />
              ))}
            </Stack>
          </Box>
        </>
      )}
    </Paper>
  );
};

export default IntegratorOpportunityMapping;
