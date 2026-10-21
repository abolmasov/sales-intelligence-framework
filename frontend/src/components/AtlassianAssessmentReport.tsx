import React, { useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  alpha,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  ArrowForward,
  Cancel,
  CheckCircle,
  Cloud,
  CloudDone,
  CloudQueue,
  Code,
  ContentCopy,
  DataObject,
  Dns,
  Error as ErrorIcon,
  ExpandMore,
  Flag,
  HelpOutline,
  Info,
  Lightbulb,
  Refresh,
  Schedule,
  Storage,
  SwapHoriz,
  TrendingUp,
  Warning,
} from '@mui/icons-material';
import {
  AtlassianAssessment,
  AssessmentAnalysis,
  AssessmentGap,
  AssessmentRecommendation,
  MigrationPath,
  UrgencyLevel,
  QuestionnaireResponses,
  QUESTIONNAIRE_METADATA,
  CATEGORY_LABELS,
  getScoreExplanations,
  getMigrationType,
  getMigrationTypeLabel,
  getMigrationTypeDescription,
  getMigrationCompatibility,
  MigrationType,
  EnvironmentData,
  EnvironmentAnalysis,
  InstanceScanResult,
} from '../types/atlassianAssessment';

interface AtlassianAssessmentReportProps {
  assessment: AtlassianAssessment;
  analysis: AssessmentAnalysis;
  onRerunAnalysis?: () => Promise<void>;
  isRerunning?: boolean;
}

// Check if environment data is available
const hasEnvironmentData = (assessment: AtlassianAssessment) => {
  return assessment.environmentData?.scanResult && assessment.environmentData?.analysis;
};

const getUrgencyColor = (urgency: UrgencyLevel) => {
  switch (urgency) {
    case 'critical':
      return '#ef4444';
    case 'high':
      return '#f59e0b';
    case 'medium':
      return '#3b82f6';
    case 'low':
      return '#10b981';
    default:
      return '#9e9e9e';
  }
};

const getSeverityColor = (severity: AssessmentGap['severity']) => {
  switch (severity) {
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

const getPriorityColor = (priority: AssessmentRecommendation['priority']) => {
  switch (priority) {
    case 'high':
      return 'error';
    case 'medium':
      return 'warning';
    case 'low':
      return 'info';
    default:
      return 'default';
  }
};

const getComplexityColor = (complexity: MigrationPath['complexity']) => {
  switch (complexity) {
    case 'high':
      return '#ef4444';
    case 'medium':
      return '#f59e0b';
    case 'low':
      return '#10b981';
    default:
      return '#9e9e9e';
  }
};

const getMigrationTypeIcon = (type: MigrationType) => {
  switch (type) {
    case 'dc-to-cloud':
      return <Dns sx={{ fontSize: 24 }} />;
    case 'server-to-cloud':
      return <Storage sx={{ fontSize: 24 }} />;
    case 'cloud-to-cloud':
      return <CloudQueue sx={{ fontSize: 24 }} />;
    default:
      return <HelpOutline sx={{ fontSize: 24 }} />;
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

const ScoreGauge: React.FC<{ score: number; size?: number }> = ({ score, size = 180 }) => {
  const getScoreColor = (s: number) => {
    if (s >= 70) return '#10b981';
    if (s >= 50) return '#f59e0b';
    if (s >= 30) return '#f97316';
    return '#ef4444';
  };

  const getScoreLabel = (s: number) => {
    if (s >= 80) return 'Excellent';
    if (s >= 70) return 'Good';
    if (s >= 50) return 'Moderate';
    if (s >= 30) return 'Challenging';
    return 'Complex';
  };

  const color = getScoreColor(score);
  const circumference = 2 * Math.PI * 70;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <Box sx={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 160 160">
        {/* Background circle */}
        <circle
          cx="80"
          cy="80"
          r="70"
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="14"
        />
        {/* Progress circle */}
        <circle
          cx="80"
          cy="80"
          r="70"
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform="rotate(-90 80 80)"
          style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
        />
        {/* Inner glow */}
        <circle
          cx="80"
          cy="80"
          r="56"
          fill={alpha(color, 0.05)}
        />
      </svg>
      <Box
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
        }}
      >
        <Typography variant="h2" fontWeight={800} sx={{ color, lineHeight: 1 }}>
          {score}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
          out of 100
        </Typography>
        <Typography
          variant="body2"
          fontWeight={600}
          sx={{ color, mt: 0.5 }}
        >
          {getScoreLabel(score)}
        </Typography>
      </Box>
    </Box>
  );
};

// Format response value for display
const formatResponseValue = (value: any): string => {
  if (value === null || value === undefined) return '-';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
};

// Group responses by category
const groupResponsesByCategory = (responses: QuestionnaireResponses) => {
  const grouped: Record<string, { id: string; question: string; value: any }[]> = {};

  for (const [id, value] of Object.entries(responses)) {
    const meta = QUESTIONNAIRE_METADATA[id];
    if (meta && value !== undefined && value !== null && value !== '') {
      const category = meta.category;
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push({
        id,
        question: meta.question,
        value,
      });
    }
  }

  return grouped;
};

const AtlassianAssessmentReport: React.FC<AtlassianAssessmentReportProps> = ({
  assessment,
  analysis,
  onRerunAnalysis,
  isRerunning = false,
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [copySnackbar, setCopySnackbar] = useState(false);

  const responses = assessment.questionnaireResponses || {};
  const groupedResponses = groupResponsesByCategory(responses);
  const scoreExplanations = getScoreExplanations(analysis.migrationScoreBreakdown, responses);
  const migrationType = getMigrationType(responses.deployment_type);
  const migrationTypeColor = getMigrationTypeColor(migrationType);
  const compatibility = getMigrationCompatibility(responses, analysis.matchedCapabilities, analysis.relevantMigrationPaths);

  // Check for environment data
  const envData = assessment.environmentData;
  const hasEnvData = hasEnvironmentData(assessment);

  // Dynamic tab indices based on whether environment data exists
  const getTabIndex = (tabName: string): number => {
    const baseTabs = ['compatibility'];
    if (hasEnvData) baseTabs.push('infrastructure');
    baseTabs.push('questionnaire', 'rawData', 'scoreAnalysis', 'gaps', 'recommendations', 'nextSteps');
    return baseTabs.indexOf(tabName);
  };

  // Raw data for export/display
  const rawData = {
    assessmentMetadata: {
      id: assessment.id,
      companyName: assessment.companyName,
      status: assessment.status,
      migrationType: migrationType,
      migrationScore: assessment.migrationScore,
      urgencyLevel: assessment.urgencyLevel,
      createdAt: assessment.createdAt,
      updatedAt: assessment.updatedAt,
      meetingId: assessment.meetingId,
    },
    questionnaireResponses: responses,
    analysisResult: {
      summary: analysis.summary,
      migrationScore: analysis.migrationScore,
      migrationScoreBreakdown: analysis.migrationScoreBreakdown,
      urgencyLevel: analysis.urgencyLevel,
      urgencyReason: analysis.urgencyReason,
      estimatedTimeline: analysis.estimatedTimeline,
      gapsCount: analysis.gaps.length,
      gaps: analysis.gaps,
      recommendationsCount: analysis.recommendations.length,
      recommendations: analysis.recommendations,
      riskFactorsCount: analysis.riskFactors.length,
      riskFactors: analysis.riskFactors,
      nextSteps: analysis.nextSteps,
      matchedCapabilities: analysis.matchedCapabilities,
      relevantMigrationPaths: analysis.relevantMigrationPaths,
    },
  };

  const handleCopyRawData = () => {
    navigator.clipboard.writeText(JSON.stringify(rawData, null, 2));
    setCopySnackbar(true);
  };

  return (
    <Box>
      {/* Migration Type Banner */}
      <Paper
        sx={{
          p: 2.5,
          mb: 3,
          background: `linear-gradient(135deg, ${alpha(migrationTypeColor, 0.15)} 0%, ${alpha(migrationTypeColor, 0.05)} 100%)`,
          border: `1px solid ${alpha(migrationTypeColor, 0.3)}`,
          borderRadius: 2,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={2}>
          <Box
            sx={{
              p: 1.5,
              borderRadius: 2,
              bgcolor: alpha(migrationTypeColor, 0.15),
              color: migrationTypeColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {getMigrationTypeIcon(migrationType)}
          </Box>
          <Box sx={{ flex: 1 }}>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Typography variant="h6" fontWeight={700} sx={{ color: migrationTypeColor }}>
                {getMigrationTypeLabel(migrationType)}
              </Typography>
              <SwapHoriz sx={{ color: 'text.secondary' }} />
              <Cloud sx={{ color: '#0052CC' }} />
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {getMigrationTypeDescription(migrationType)}
            </Typography>
          </Box>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Chip
              label={migrationType === 'unknown' ? 'Pending' : 'Identified'}
              size="small"
              sx={{
                bgcolor: alpha(migrationTypeColor, 0.2),
                color: migrationTypeColor,
                fontWeight: 600,
              }}
            />
            {onRerunAnalysis && (
              <Button
                variant="outlined"
                size="small"
                startIcon={isRerunning ? <CircularProgress size={14} /> : <Refresh />}
                onClick={onRerunAnalysis}
                disabled={isRerunning}
                sx={{
                  borderColor: alpha(migrationTypeColor, 0.5),
                  color: migrationTypeColor,
                  '&:hover': {
                    borderColor: migrationTypeColor,
                    bgcolor: alpha(migrationTypeColor, 0.1),
                  },
                }}
              >
                {isRerunning ? 'Analyzing...' : 'Re-run Analysis'}
              </Button>
            )}
          </Stack>
        </Stack>
      </Paper>

      {/* Executive Summary Header */}
      <Paper
        sx={{
          p: 3,
          mb: 3,
          background: 'linear-gradient(135deg, rgba(0, 82, 204, 0.08) 0%, rgba(16, 185, 129, 0.04) 100%)',
          border: '1px solid rgba(0, 82, 204, 0.15)',
          borderRadius: 2,
        }}
      >
        <Grid container spacing={3} alignItems="center">
          {/* Score */}
          <Grid size={{ xs: 12, md: 3 }}>
            <Stack alignItems="center">
              <ScoreGauge score={analysis.migrationScore} />
              <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1 }}>
                Migration Readiness Score
              </Typography>
            </Stack>
          </Grid>

          {/* Key Metrics */}
          <Grid size={{ xs: 12, md: 5 }}>
            <Stack spacing={2.5}>
              <Box>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                  <Flag sx={{ color: getUrgencyColor(analysis.urgencyLevel), fontSize: 20 }} />
                  <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Migration Urgency
                  </Typography>
                </Stack>
                <Stack direction="row" alignItems="center" spacing={1.5}>
                  <Chip
                    label={analysis.urgencyLevel.toUpperCase()}
                    size="small"
                    sx={{
                      bgcolor: alpha(getUrgencyColor(analysis.urgencyLevel), 0.15),
                      color: getUrgencyColor(analysis.urgencyLevel),
                      fontWeight: 700,
                      px: 1,
                    }}
                  />
                  <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                    {analysis.urgencyReason}
                  </Typography>
                </Stack>
              </Box>

              <Box>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                  <Schedule sx={{ color: 'secondary.main', fontSize: 20 }} />
                  <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Estimated Timeline
                  </Typography>
                </Stack>
                <Typography variant="body1" fontWeight={600}>
                  {analysis.estimatedTimeline}
                </Typography>
              </Box>

              <Stack direction="row" spacing={3}>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Gaps Found
                  </Typography>
                  <Typography variant="h5" fontWeight={700} color="warning.main">
                    {analysis.gaps.length}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Recommendations
                  </Typography>
                  <Typography variant="h5" fontWeight={700} color="info.main">
                    {analysis.recommendations.length}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Risk Factors
                  </Typography>
                  <Typography variant="h5" fontWeight={700} color="error.main">
                    {analysis.riskFactors.length}
                  </Typography>
                </Box>
              </Stack>
            </Stack>
          </Grid>

          {/* Score Breakdown Preview */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper variant="outlined" sx={{ p: 2, bgcolor: 'rgba(0,0,0,0.2)', borderColor: 'rgba(255,255,255,0.1)' }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.7rem' }}>
                Score Breakdown
              </Typography>
              <Stack spacing={1.5}>
                {scoreExplanations.map(({ factor, score }) => (
                  <Box key={factor}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                        {factor}
                      </Typography>
                      <Typography variant="caption" fontWeight={700} sx={{ color: score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444' }}>
                        {score}%
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={score}
                      sx={{
                        height: 6,
                        borderRadius: 3,
                        bgcolor: 'rgba(255,255,255,0.08)',
                        '& .MuiLinearProgress-bar': {
                          bgcolor: score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444',
                          borderRadius: 3,
                        },
                      }}
                    />
                  </Box>
                ))}
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      </Paper>

      {/* Executive Summary */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
          <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: alpha('#f59e0b', 0.1) }}>
            <Lightbulb sx={{ color: 'warning.main', fontSize: 20 }} />
          </Box>
          <Typography variant="h6" fontWeight={700}>Executive Summary</Typography>
        </Stack>
        <Typography variant="body1" sx={{ whiteSpace: 'pre-line', lineHeight: 1.8, color: 'text.secondary' }}>
          {analysis.summary}
        </Typography>
      </Paper>

      {/* Tabs */}
      <Paper sx={{ mb: 3, borderRadius: 2, overflow: 'hidden' }}>
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 600,
              minHeight: 56,
            },
          }}
        >
          <Tab icon={<SwapHoriz sx={{ fontSize: 18 }} />} iconPosition="start" label="Migration Compatibility" />
          {hasEnvironmentData(assessment) && (
            <Tab icon={<Storage sx={{ fontSize: 18 }} />} iconPosition="start" label="Infrastructure Data" />
          )}
          <Tab icon={<DataObject sx={{ fontSize: 18 }} />} iconPosition="start" label="Questionnaire Data" />
          <Tab icon={<Code sx={{ fontSize: 18 }} />} iconPosition="start" label="Raw Data" />
          <Tab icon={<Info sx={{ fontSize: 18 }} />} iconPosition="start" label="Score Analysis" />
          <Tab label={`Gaps (${analysis.gaps.length})`} />
          <Tab label={`Recommendations (${analysis.recommendations.length})`} />
          <Tab label="Next Steps" />
        </Tabs>
      </Paper>

      {/* Tab Content */}
      <Box sx={{ minHeight: 400 }}>
        {/* Migration Compatibility Tab */}
        {activeTab === getTabIndex('compatibility') && (
          <Grid container spacing={3}>
            {/* Can Migrate */}
            <Grid size={{ xs: 12, md: 4 }}>
              <Paper sx={{ p: 0, height: '100%', borderRadius: 2, overflow: 'hidden' }}>
                <Box sx={{ p: 2, bgcolor: alpha('#10b981', 0.1), borderBottom: `3px solid #10b981` }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <CheckCircle sx={{ color: 'success.main' }} />
                    <Typography variant="subtitle1" fontWeight={700}>
                      Ready to Migrate
                    </Typography>
                    <Chip label={compatibility.canMigrate.length} size="small" sx={{ bgcolor: 'success.main', color: 'white', fontWeight: 700, ml: 'auto' }} />
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    Items that can migrate with standard approach
                  </Typography>
                </Box>
                <List dense sx={{ p: 1 }}>
                  {compatibility.canMigrate.map((item, idx) => (
                    <ListItem key={idx} sx={{ py: 1, px: 1.5, borderRadius: 1, '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' } }}>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <CheckCircle sx={{ color: 'success.main', fontSize: 18 }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={<Typography variant="body2" fontWeight={600}>{item.item}</Typography>}
                        secondary={
                          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.5 }}>
                            {item.complexity && (
                              <Chip label={item.complexity} size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: alpha(getComplexityColor(item.complexity), 0.15), color: getComplexityColor(item.complexity) }} />
                            )}
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                              {item.notes}
                            </Typography>
                          </Stack>
                        }
                      />
                    </ListItem>
                  ))}
                  {compatibility.canMigrate.length === 0 && (
                    <Box sx={{ p: 3, textAlign: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        No items identified yet
                      </Typography>
                    </Box>
                  )}
                </List>
              </Paper>
            </Grid>

            {/* Needs Review */}
            <Grid size={{ xs: 12, md: 4 }}>
              <Paper sx={{ p: 0, height: '100%', borderRadius: 2, overflow: 'hidden' }}>
                <Box sx={{ p: 2, bgcolor: alpha('#f59e0b', 0.1), borderBottom: `3px solid #f59e0b` }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Warning sx={{ color: 'warning.main' }} />
                    <Typography variant="subtitle1" fontWeight={700}>
                      Needs Review
                    </Typography>
                    <Chip label={compatibility.needsReview.length} size="small" sx={{ bgcolor: 'warning.main', color: 'white', fontWeight: 700, ml: 'auto' }} />
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    Items requiring additional assessment or workarounds
                  </Typography>
                </Box>
                <List dense sx={{ p: 1 }}>
                  {compatibility.needsReview.map((item, idx) => (
                    <ListItem key={idx} sx={{ py: 1, px: 1.5, borderRadius: 1, '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' } }}>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <Warning sx={{ color: 'warning.main', fontSize: 18 }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={<Typography variant="body2" fontWeight={600}>{item.item}</Typography>}
                        secondary={
                          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.5 }}>
                            {item.complexity && (
                              <Chip label={item.complexity} size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: alpha(getComplexityColor(item.complexity), 0.15), color: getComplexityColor(item.complexity) }} />
                            )}
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                              {item.notes}
                            </Typography>
                          </Stack>
                        }
                      />
                    </ListItem>
                  ))}
                  {compatibility.needsReview.length === 0 && (
                    <Box sx={{ p: 3, textAlign: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        No items requiring review
                      </Typography>
                    </Box>
                  )}
                </List>
              </Paper>
            </Grid>

            {/* Cannot Migrate */}
            <Grid size={{ xs: 12, md: 4 }}>
              <Paper sx={{ p: 0, height: '100%', borderRadius: 2, overflow: 'hidden' }}>
                <Box sx={{ p: 2, bgcolor: alpha('#ef4444', 0.1), borderBottom: `3px solid #ef4444` }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Cancel sx={{ color: 'error.main' }} />
                    <Typography variant="subtitle1" fontWeight={700}>
                      Cannot Migrate Directly
                    </Typography>
                    <Chip label={compatibility.cannotMigrate.length} size="small" sx={{ bgcolor: 'error.main', color: 'white', fontWeight: 700, ml: 'auto' }} />
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    Items requiring alternative solutions or retirement
                  </Typography>
                </Box>
                <List dense sx={{ p: 1 }}>
                  {compatibility.cannotMigrate.map((item, idx) => (
                    <ListItem key={idx} sx={{ py: 1, px: 1.5, borderRadius: 1, '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' } }}>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <Cancel sx={{ color: 'error.main', fontSize: 18 }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={<Typography variant="body2" fontWeight={600}>{item.item}</Typography>}
                        secondary={
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                            {item.notes}
                          </Typography>
                        }
                      />
                    </ListItem>
                  ))}
                  {compatibility.cannotMigrate.length === 0 && (
                    <Box sx={{ p: 3, textAlign: 'center' }}>
                      <CheckCircle sx={{ color: 'success.main', fontSize: 32, mb: 1 }} />
                      <Typography variant="body2" color="text.secondary">
                        No blocking items identified
                      </Typography>
                    </Box>
                  )}
                </List>
              </Paper>
            </Grid>
          </Grid>
        )}

        {/* Infrastructure Data Tab (only shows when scan data exists) */}
        {hasEnvData && activeTab === getTabIndex('infrastructure') && envData?.analysis && envData?.scanResult && (
          <Grid container spacing={3}>
            {/* Overview Stats */}
            <Grid size={{ xs: 12 }}>
              <Paper sx={{ p: 3, borderRadius: 2, bgcolor: alpha('#0052CC', 0.05) }}>
                <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
                  <Dns sx={{ color: '#0052CC', fontSize: 28 }} />
                  <Box>
                    <Typography variant="h6" fontWeight={700}>
                      {envData.scanResult.serverInfo.serverTitle || 'Atlassian Instance'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {envData.scanResult.serverInfo.deploymentType} v{envData.scanResult.serverInfo.version} • Scanned {new Date(envData.scanResult.scanTimestamp).toLocaleDateString()}
                    </Typography>
                  </Box>
                </Stack>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 1 }}>
                      <Typography variant="h4" fontWeight={700} color="primary">{envData.analysis.users.activeUsers}</Typography>
                      <Typography variant="caption" color="text.secondary">Active Users</Typography>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 1 }}>
                      <Typography variant="h4" fontWeight={700} color="success.main">{envData.analysis.overview.projectCount}</Typography>
                      <Typography variant="caption" color="text.secondary">Projects</Typography>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 1 }}>
                      <Typography variant="h4" fontWeight={700} color="warning.main">{envData.analysis.customFields.totalCustomFields}</Typography>
                      <Typography variant="caption" color="text.secondary">Custom Fields</Typography>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 1 }}>
                      <Typography variant="h4" fontWeight={700} color="error.main">{envData.analysis.plugins.totalUserPlugins}</Typography>
                      <Typography variant="caption" color="text.secondary">User Apps</Typography>
                    </Box>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>

            {/* Customization Level & Migration Readiness */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Paper sx={{ p: 3, height: '100%', borderRadius: 2 }}>
                <Typography variant="subtitle1" fontWeight={700} gutterBottom>Customization Analysis</Typography>
                <Stack spacing={2}>
                  <Box>
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                      <Typography variant="body2">Custom Fields</Typography>
                      <Chip label={envData.analysis.customFields.migrationComplexity} size="small" sx={{ bgcolor: alpha(envData.analysis.customFields.migrationComplexity === 'low' ? '#10b981' : envData.analysis.customFields.migrationComplexity === 'medium' ? '#f59e0b' : '#ef4444', 0.2), color: envData.analysis.customFields.migrationComplexity === 'low' ? '#10b981' : envData.analysis.customFields.migrationComplexity === 'medium' ? '#f59e0b' : '#ef4444' }} />
                    </Stack>
                    <Typography variant="caption" color="text.secondary">{envData.analysis.customFields.totalCustomFields} custom fields identified</Typography>
                  </Box>
                  <Box>
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                      <Typography variant="body2">Workflows</Typography>
                      <Chip label={envData.analysis.workflows.migrationComplexity} size="small" sx={{ bgcolor: alpha(envData.analysis.workflows.migrationComplexity === 'low' ? '#10b981' : envData.analysis.workflows.migrationComplexity === 'medium' ? '#f59e0b' : '#ef4444', 0.2), color: envData.analysis.workflows.migrationComplexity === 'low' ? '#10b981' : envData.analysis.workflows.migrationComplexity === 'medium' ? '#f59e0b' : '#ef4444' }} />
                    </Stack>
                    <Typography variant="caption" color="text.secondary">{envData.analysis.workflows.totalCustomWorkflows} custom workflows, {envData.analysis.workflows.workflowsWithGroovy} with scripts</Typography>
                  </Box>
                  <Box>
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                      <Typography variant="body2">Apps/Plugins</Typography>
                      <Typography variant="body2" fontWeight={600}>{envData.analysis.plugins.overallMigrationReadiness}% Cloud Ready</Typography>
                    </Stack>
                    <LinearProgress variant="determinate" value={envData.analysis.plugins.overallMigrationReadiness} sx={{ height: 6, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.1)', '& .MuiLinearProgress-bar': { bgcolor: envData.analysis.plugins.overallMigrationReadiness >= 70 ? '#10b981' : envData.analysis.plugins.overallMigrationReadiness >= 50 ? '#f59e0b' : '#ef4444' } }} />
                  </Box>
                </Stack>
              </Paper>
            </Grid>

            {/* App Migration Summary */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Paper sx={{ p: 3, height: '100%', borderRadius: 2 }}>
                <Typography variant="subtitle1" fontWeight={700} gutterBottom>App Migration Status</Typography>
                <Grid container spacing={1}>
                  <Grid size={{ xs: 4 }}>
                    <Box sx={{ textAlign: 'center', p: 1.5, bgcolor: alpha('#10b981', 0.1), borderRadius: 1 }}>
                      <CheckCircle sx={{ color: 'success.main', fontSize: 24 }} />
                      <Typography variant="h6" fontWeight={700} sx={{ color: 'success.main' }}>{envData.scanResult.plugins.cloudMigrationSummary.readyToMigrate}</Typography>
                      <Typography variant="caption" color="text.secondary">Ready</Typography>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 4 }}>
                    <Box sx={{ textAlign: 'center', p: 1.5, bgcolor: alpha('#f59e0b', 0.1), borderRadius: 1 }}>
                      <Warning sx={{ color: 'warning.main', fontSize: 24 }} />
                      <Typography variant="h6" fontWeight={700} sx={{ color: 'warning.main' }}>{envData.scanResult.plugins.cloudMigrationSummary.needsAlternative}</Typography>
                      <Typography variant="caption" color="text.secondary">Needs Alt</Typography>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 4 }}>
                    <Box sx={{ textAlign: 'center', p: 1.5, bgcolor: alpha('#ef4444', 0.1), borderRadius: 1 }}>
                      <Cancel sx={{ color: 'error.main', fontSize: 24 }} />
                      <Typography variant="h6" fontWeight={700} sx={{ color: 'error.main' }}>{envData.scanResult.plugins.cloudMigrationSummary.noCloudVersion}</Typography>
                      <Typography variant="caption" color="text.secondary">No Cloud</Typography>
                    </Box>
                  </Grid>
                </Grid>
                <Divider sx={{ my: 2 }} />
                <Typography variant="caption" color="text.secondary">
                  <strong>Recommendation:</strong> {envData.analysis.overallAssessment.recommendedApproach}
                </Typography>
              </Paper>
            </Grid>

            {/* Plugins List */}
            {envData.analysis.plugins.cloudReadyPlugins.length > 0 && (
              <Grid size={{ xs: 12 }}>
                <Accordion defaultExpanded sx={{ borderRadius: '8px !important', '&:before': { display: 'none' } }}>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <CheckCircle sx={{ color: 'success.main' }} />
                      <Typography fontWeight={600}>Cloud-Ready Apps ({envData.analysis.plugins.cloudReadyPlugins.length})</Typography>
                    </Stack>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Grid container spacing={1}>
                      {envData.analysis.plugins.cloudReadyPlugins.map((plugin, idx) => (
                        <Grid size={{ xs: 12, sm: 6, md: 4 }} key={idx}>
                          <Paper variant="outlined" sx={{ p: 1.5 }}>
                            <Typography variant="body2" fontWeight={600}>{plugin.name}</Typography>
                            {plugin.cloudEquivalent && <Typography variant="caption" color="success.main">Cloud: {plugin.cloudEquivalent}</Typography>}
                            {plugin.migrationNotes && <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{plugin.migrationNotes}</Typography>}
                          </Paper>
                        </Grid>
                      ))}
                    </Grid>
                  </AccordionDetails>
                </Accordion>
              </Grid>
            )}

            {/* Plugins Needing Alternatives */}
            {envData.analysis.plugins.pluginsNeedingAlternative.length > 0 && (
              <Grid size={{ xs: 12 }}>
                <Accordion sx={{ borderRadius: '8px !important', '&:before': { display: 'none' } }}>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Warning sx={{ color: 'warning.main' }} />
                      <Typography fontWeight={600}>Apps Needing Alternatives ({envData.analysis.plugins.pluginsNeedingAlternative.length})</Typography>
                    </Stack>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Grid container spacing={1}>
                      {envData.analysis.plugins.pluginsNeedingAlternative.map((plugin, idx) => (
                        <Grid size={{ xs: 12, sm: 6, md: 4 }} key={idx}>
                          <Paper variant="outlined" sx={{ p: 1.5, borderColor: alpha('#f59e0b', 0.3) }}>
                            <Typography variant="body2" fontWeight={600}>{plugin.name}</Typography>
                            <Typography variant="caption" color="text.secondary">{plugin.migrationNotes || 'Review for Cloud alternatives'}</Typography>
                          </Paper>
                        </Grid>
                      ))}
                    </Grid>
                  </AccordionDetails>
                </Accordion>
              </Grid>
            )}
          </Grid>
        )}

        {/* Questionnaire Data Tab */}
        {activeTab === getTabIndex('questionnaire') && (
          <Grid container spacing={2}>
            {['environment', 'usage', 'painPoints', 'requirements', 'timeline'].map((category) => {
              const items = groupedResponses[category];
              if (!items || items.length === 0) return null;
              return (
                <Grid size={{ xs: 12, md: 6 }} key={category}>
                  <Card sx={{ height: '100%', borderRadius: 2 }}>
                    <CardContent>
                      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2.5 }}>
                        <Box sx={{
                          p: 1,
                          borderRadius: 1.5,
                          bgcolor: category === 'environment' ? alpha('#0052CC', 0.1) :
                                   category === 'usage' ? alpha('#10b981', 0.1) :
                                   category === 'painPoints' ? alpha('#f59e0b', 0.1) :
                                   category === 'requirements' ? alpha('#3b82f6', 0.1) :
                                   alpha('#7c3aed', 0.1),
                        }}>
                          {category === 'environment' && <Storage sx={{ color: '#0052CC', fontSize: 20 }} />}
                          {category === 'usage' && <TrendingUp sx={{ color: 'success.main', fontSize: 20 }} />}
                          {category === 'painPoints' && <Warning sx={{ color: 'warning.main', fontSize: 20 }} />}
                          {category === 'requirements' && <CheckCircle sx={{ color: 'secondary.main', fontSize: 20 }} />}
                          {category === 'timeline' && <Schedule sx={{ color: '#7c3aed', fontSize: 20 }} />}
                        </Box>
                        <Typography variant="subtitle1" fontWeight={700}>
                          {CATEGORY_LABELS[category]?.title || category}
                        </Typography>
                      </Stack>
                      <Stack spacing={2}>
                        {items.map(({ id, question, value }) => (
                          <Box key={id} sx={{ pb: 1.5, borderBottom: '1px solid rgba(255,255,255,0.05)', '&:last-child': { borderBottom: 'none', pb: 0 } }}>
                            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.65rem', fontWeight: 600 }}>
                              {question}
                            </Typography>
                            <Typography variant="body2" fontWeight={500} sx={{ mt: 0.25 }}>
                              {formatResponseValue(value)}
                            </Typography>
                          </Box>
                        ))}
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
            {Object.keys(groupedResponses).length === 0 && (
              <Grid size={{ xs: 12 }}>
                <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
                  <DataObject sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                  <Typography color="text.secondary">
                    No questionnaire data available
                  </Typography>
                </Paper>
              </Grid>
            )}
          </Grid>
        )}

        {/* Raw Data Tab */}
        {activeTab === getTabIndex('rawData') && (
          <Stack spacing={3}>
            {/* Header with Copy Button */}
            <Paper sx={{ p: 2.5, borderRadius: 2 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Stack direction="row" alignItems="center" spacing={1.5}>
                  <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: alpha('#7c3aed', 0.1) }}>
                    <Code sx={{ color: '#7c3aed', fontSize: 20 }} />
                  </Box>
                  <Box>
                    <Typography variant="subtitle1" fontWeight={700}>Complete Assessment Data</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Raw questionnaire responses, analysis results, and metadata
                    </Typography>
                  </Box>
                </Stack>
                <Button
                  variant="outlined"
                  startIcon={<ContentCopy />}
                  onClick={handleCopyRawData}
                  sx={{ borderRadius: 2 }}
                >
                  Copy JSON
                </Button>
              </Stack>
            </Paper>

            {/* Assessment Metadata */}
            <Paper sx={{ p: 0, borderRadius: 2, overflow: 'hidden' }}>
              <Box sx={{ p: 2, bgcolor: alpha('#0052CC', 0.1), borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <Typography variant="subtitle2" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.7rem' }}>
                  Assessment Metadata
                </Typography>
              </Box>
              <Box sx={{ p: 2 }}>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 6, md: 3 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: '0.6rem', fontWeight: 600 }}>ID</Typography>
                    <Typography variant="body2" fontFamily="monospace" sx={{ wordBreak: 'break-all' }}>{assessment.id}</Typography>
                  </Grid>
                  <Grid size={{ xs: 6, md: 3 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: '0.6rem', fontWeight: 600 }}>Company</Typography>
                    <Typography variant="body2" fontWeight={500}>{assessment.companyName}</Typography>
                  </Grid>
                  <Grid size={{ xs: 6, md: 3 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: '0.6rem', fontWeight: 600 }}>Status</Typography>
                    <Typography variant="body2" fontWeight={500}>{assessment.status}</Typography>
                  </Grid>
                  <Grid size={{ xs: 6, md: 3 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: '0.6rem', fontWeight: 600 }}>Migration Type</Typography>
                    <Typography variant="body2" fontWeight={500}>{getMigrationTypeLabel(migrationType)}</Typography>
                  </Grid>
                  <Grid size={{ xs: 6, md: 3 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: '0.6rem', fontWeight: 600 }}>Score</Typography>
                    <Typography variant="body2" fontWeight={500}>{assessment.migrationScore ?? 'N/A'}</Typography>
                  </Grid>
                  <Grid size={{ xs: 6, md: 3 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: '0.6rem', fontWeight: 600 }}>Urgency</Typography>
                    <Typography variant="body2" fontWeight={500}>{assessment.urgencyLevel ?? 'N/A'}</Typography>
                  </Grid>
                  <Grid size={{ xs: 6, md: 3 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: '0.6rem', fontWeight: 600 }}>Created</Typography>
                    <Typography variant="body2" fontFamily="monospace" sx={{ fontSize: '0.75rem' }}>{new Date(assessment.createdAt).toISOString()}</Typography>
                  </Grid>
                  <Grid size={{ xs: 6, md: 3 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: '0.6rem', fontWeight: 600 }}>Updated</Typography>
                    <Typography variant="body2" fontFamily="monospace" sx={{ fontSize: '0.75rem' }}>{new Date(assessment.updatedAt).toISOString()}</Typography>
                  </Grid>
                </Grid>
              </Box>
            </Paper>

            {/* Raw Questionnaire Responses */}
            <Paper sx={{ p: 0, borderRadius: 2, overflow: 'hidden' }}>
              <Box sx={{ p: 2, bgcolor: alpha('#10b981', 0.1), borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Typography variant="subtitle2" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.7rem' }}>
                    Raw Questionnaire Responses
                  </Typography>
                  <Chip label={`${Object.keys(responses).length} fields`} size="small" sx={{ fontWeight: 600, fontSize: '0.65rem' }} />
                </Stack>
              </Box>
              <Box sx={{ p: 2, maxHeight: 400, overflow: 'auto' }}>
                <Box
                  component="pre"
                  sx={{
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    lineHeight: 1.6,
                    m: 0,
                    p: 2,
                    bgcolor: 'rgba(0,0,0,0.3)',
                    borderRadius: 1,
                    overflow: 'auto',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {JSON.stringify(responses, null, 2)}
                </Box>
              </Box>
            </Paper>

            {/* Score Breakdown */}
            <Paper sx={{ p: 0, borderRadius: 2, overflow: 'hidden' }}>
              <Box sx={{ p: 2, bgcolor: alpha('#f59e0b', 0.1), borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <Typography variant="subtitle2" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.7rem' }}>
                  Score Breakdown (Raw Values)
                </Typography>
              </Box>
              <Box sx={{ p: 2 }}>
                <Grid container spacing={2}>
                  {Object.entries(analysis.migrationScoreBreakdown).map(([key, value]) => (
                    <Grid size={{ xs: 6, sm: 4, md: 2.4 }} key={key}>
                      <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: '0.6rem', fontWeight: 600, display: 'block' }}>
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </Typography>
                        <Typography variant="h5" fontWeight={700} sx={{ color: (value as number) >= 70 ? '#10b981' : (value as number) >= 40 ? '#f59e0b' : '#ef4444' }}>
                          {value as number}
                        </Typography>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            </Paper>

            {/* Matched Capabilities */}
            {analysis.matchedCapabilities.length > 0 && (
              <Paper sx={{ p: 0, borderRadius: 2, overflow: 'hidden' }}>
                <Box sx={{ p: 2, bgcolor: alpha('#3b82f6', 0.1), borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Typography variant="subtitle2" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.7rem' }}>
                      Matched Cloud Capabilities
                    </Typography>
                    <Chip label={`${analysis.matchedCapabilities.length} capabilities`} size="small" sx={{ fontWeight: 600, fontSize: '0.65rem' }} />
                  </Stack>
                </Box>
                <Box sx={{ p: 2, maxHeight: 300, overflow: 'auto' }}>
                  <Box
                    component="pre"
                    sx={{
                      fontFamily: 'monospace',
                      fontSize: '0.75rem',
                      lineHeight: 1.6,
                      m: 0,
                      p: 2,
                      bgcolor: 'rgba(0,0,0,0.3)',
                      borderRadius: 1,
                      overflow: 'auto',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {JSON.stringify(analysis.matchedCapabilities, null, 2)}
                  </Box>
                </Box>
              </Paper>
            )}

            {/* Migration Paths */}
            {analysis.relevantMigrationPaths.length > 0 && (
              <Paper sx={{ p: 0, borderRadius: 2, overflow: 'hidden' }}>
                <Box sx={{ p: 2, bgcolor: alpha('#6554C0', 0.1), borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Typography variant="subtitle2" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.7rem' }}>
                      Migration Paths Data
                    </Typography>
                    <Chip label={`${analysis.relevantMigrationPaths.length} paths`} size="small" sx={{ fontWeight: 600, fontSize: '0.65rem' }} />
                  </Stack>
                </Box>
                <Box sx={{ p: 2, maxHeight: 300, overflow: 'auto' }}>
                  <Box
                    component="pre"
                    sx={{
                      fontFamily: 'monospace',
                      fontSize: '0.75rem',
                      lineHeight: 1.6,
                      m: 0,
                      p: 2,
                      bgcolor: 'rgba(0,0,0,0.3)',
                      borderRadius: 1,
                      overflow: 'auto',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {JSON.stringify(analysis.relevantMigrationPaths, null, 2)}
                  </Box>
                </Box>
              </Paper>
            )}

            {/* Full Analysis JSON */}
            <Accordion sx={{ borderRadius: '8px !important', '&:before': { display: 'none' }, overflow: 'hidden' }}>
              <AccordionSummary expandIcon={<ExpandMore />} sx={{ bgcolor: 'rgba(255,255,255,0.02)' }}>
                <Stack direction="row" alignItems="center" spacing={1.5}>
                  <Code sx={{ color: 'text.secondary', fontSize: 18 }} />
                  <Typography variant="subtitle2" fontWeight={700}>
                    Complete Analysis JSON (Expandable)
                  </Typography>
                </Stack>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 0 }}>
                <Box sx={{ p: 2, maxHeight: 500, overflow: 'auto' }}>
                  <Box
                    component="pre"
                    sx={{
                      fontFamily: 'monospace',
                      fontSize: '0.7rem',
                      lineHeight: 1.5,
                      m: 0,
                      p: 2,
                      bgcolor: 'rgba(0,0,0,0.3)',
                      borderRadius: 1,
                      overflow: 'auto',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {JSON.stringify(rawData, null, 2)}
                  </Box>
                </Box>
              </AccordionDetails>
            </Accordion>
          </Stack>
        )}

        {/* Score Analysis Tab */}
        {activeTab === getTabIndex('scoreAnalysis') && (
          <Stack spacing={2}>
            {scoreExplanations.map(({ factor, score, explanation, dataPoints }) => (
              <Paper key={factor} sx={{ p: 0, borderRadius: 2, overflow: 'hidden' }}>
                <Box sx={{
                  p: 2.5,
                  borderLeft: `4px solid ${score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444'}`,
                }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                    <Typography variant="subtitle1" fontWeight={700}>
                      {factor}
                    </Typography>
                    <Stack direction="row" alignItems="center" spacing={2}>
                      <Box sx={{ width: 120 }}>
                        <LinearProgress
                          variant="determinate"
                          value={score}
                          sx={{
                            height: 8,
                            borderRadius: 4,
                            bgcolor: 'rgba(255,255,255,0.08)',
                            '& .MuiLinearProgress-bar': {
                              bgcolor: score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444',
                              borderRadius: 4,
                            },
                          }}
                        />
                      </Box>
                      <Typography variant="h5" fontWeight={800} sx={{ color: score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444', minWidth: 60, textAlign: 'right' }}>
                        {score}%
                      </Typography>
                    </Stack>
                  </Stack>

                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {explanation}
                  </Typography>

                  <Box sx={{ bgcolor: 'rgba(0, 82, 204, 0.05)', p: 2, borderRadius: 1.5 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.65rem' }}>
                      Based on your responses
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {dataPoints.map((point, idx) => (
                        <Chip
                          key={idx}
                          label={point}
                          size="small"
                          sx={{ fontSize: '0.75rem', bgcolor: 'rgba(255,255,255,0.08)', borderRadius: 1 }}
                        />
                      ))}
                      {dataPoints.length === 0 && (
                        <Typography variant="caption" color="text.secondary">
                          No specific data points captured
                        </Typography>
                      )}
                    </Stack>
                  </Box>
                </Box>
              </Paper>
            ))}
          </Stack>
        )}

        {/* Gaps Tab */}
        {activeTab === getTabIndex('gaps') && (
          <Grid container spacing={2}>
            {analysis.gaps.map((gap, idx) => (
              <Grid size={{ xs: 12, md: 6 }} key={idx}>
                <Card
                  sx={{
                    height: '100%',
                    borderRadius: 2,
                    borderLeft: `4px solid`,
                    borderLeftColor: getSeverityColor(gap.severity) + '.main',
                  }}
                >
                  <CardContent>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
                      <Typography variant="subtitle1" fontWeight={700}>
                        {gap.area}
                      </Typography>
                      <Chip
                        label={gap.severity.toUpperCase()}
                        size="small"
                        color={getSeverityColor(gap.severity)}
                        sx={{ fontWeight: 700, fontSize: '0.7rem' }}
                      />
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                      {gap.description}
                    </Typography>
                    <Box sx={{ p: 2, bgcolor: alpha('#10b981', 0.05), borderRadius: 1.5, border: `1px solid ${alpha('#10b981', 0.2)}` }}>
                      <Stack direction="row" spacing={1.5} alignItems="flex-start">
                        <CloudDone sx={{ color: 'success.main', fontSize: 20, mt: 0.25 }} />
                        <Box>
                          <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.65rem' }}>
                            Cloud Solution
                          </Typography>
                          <Typography variant="body2" fontWeight={500}>{gap.cloudSolution}</Typography>
                        </Box>
                      </Stack>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
            {analysis.gaps.length === 0 && (
              <Grid size={{ xs: 12 }}>
                <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
                  <CheckCircle sx={{ fontSize: 48, color: 'success.main', mb: 2 }} />
                  <Typography variant="h6" gutterBottom>No Gaps Identified</Typography>
                  <Typography color="text.secondary">
                    Your current setup aligns well with Cloud capabilities
                  </Typography>
                </Paper>
              </Grid>
            )}
          </Grid>
        )}

        {/* Recommendations Tab */}
        {activeTab === getTabIndex('recommendations') && (
          <Stack spacing={2}>
            {analysis.recommendations.map((rec, idx) => (
              <Accordion key={idx} defaultExpanded={idx === 0} sx={{ borderRadius: '8px !important', '&:before': { display: 'none' }, overflow: 'hidden' }}>
                <AccordionSummary expandIcon={<ExpandMore />} sx={{ bgcolor: 'rgba(255,255,255,0.02)' }}>
                  <Stack direction="row" alignItems="center" spacing={2} sx={{ flex: 1, mr: 2 }}>
                    <Chip
                      label={rec.priority.toUpperCase()}
                      size="small"
                      color={getPriorityColor(rec.priority)}
                      sx={{ fontWeight: 700, fontSize: '0.65rem', minWidth: 60 }}
                    />
                    <Typography variant="subtitle1" fontWeight={600}>
                      {rec.title}
                    </Typography>
                    <Chip label={rec.category} size="small" variant="outlined" sx={{ ml: 'auto', borderRadius: 1, fontSize: '0.7rem' }} />
                  </Stack>
                </AccordionSummary>
                <AccordionDetails sx={{ pt: 2 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                    {rec.description}
                  </Typography>
                  <Grid container spacing={3}>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <Box sx={{ p: 2, bgcolor: 'rgba(59, 130, 246, 0.05)', borderRadius: 1.5 }}>
                        <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.65rem' }}>
                          Expected Impact
                        </Typography>
                        <Typography variant="body2" fontWeight={500} sx={{ mt: 0.5 }}>{rec.estimatedImpact}</Typography>
                      </Box>
                    </Grid>
                    {rec.relatedCapabilities.length > 0 && (
                      <Grid size={{ xs: 12, md: 6 }}>
                        <Box sx={{ p: 2, bgcolor: 'rgba(124, 58, 237, 0.05)', borderRadius: 1.5 }}>
                          <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.65rem' }}>
                            Related Capabilities
                          </Typography>
                          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                            {rec.relatedCapabilities.map((cap) => (
                              <Chip key={cap} label={cap} size="small" sx={{ fontSize: '0.7rem', borderRadius: 1 }} />
                            ))}
                          </Stack>
                        </Box>
                      </Grid>
                    )}
                  </Grid>
                </AccordionDetails>
              </Accordion>
            ))}
            {analysis.recommendations.length === 0 && (
              <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
                <Lightbulb sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                <Typography color="text.secondary">
                  No specific recommendations at this time
                </Typography>
              </Paper>
            )}
          </Stack>
        )}

        {/* Next Steps Tab */}
        {activeTab === getTabIndex('nextSteps') && (
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Paper sx={{ p: 3, height: '100%', borderRadius: 2 }}>
                <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 3 }}>
                  <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: alpha('#10b981', 0.1) }}>
                    <TrendingUp sx={{ color: 'success.main', fontSize: 20 }} />
                  </Box>
                  <Typography variant="h6" fontWeight={700}>Recommended Next Steps</Typography>
                </Stack>
                <List disablePadding>
                  {analysis.nextSteps.map((step, idx) => (
                    <ListItem key={idx} disableGutters sx={{ py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.05)', '&:last-child': { borderBottom: 'none' } }}>
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        <Box
                          sx={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            bgcolor: alpha('#10b981', 0.1),
                            color: 'success.main',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                          }}
                        >
                          {idx + 1}
                        </Box>
                      </ListItemIcon>
                      <ListItemText
                        primary={step}
                        primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Paper>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Paper sx={{ p: 3, height: '100%', borderRadius: 2 }}>
                <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 3 }}>
                  <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: alpha('#ef4444', 0.1) }}>
                    <ErrorIcon sx={{ color: 'error.main', fontSize: 20 }} />
                  </Box>
                  <Typography variant="h6" fontWeight={700}>Risk Factors</Typography>
                </Stack>
                {analysis.riskFactors.length > 0 ? (
                  <List disablePadding>
                    {analysis.riskFactors.map((risk, idx) => (
                      <ListItem key={idx} disableGutters sx={{ py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.05)', '&:last-child': { borderBottom: 'none' } }}>
                        <ListItemIcon sx={{ minWidth: 40 }}>
                          <Warning sx={{ color: 'warning.main', fontSize: 20 }} />
                        </ListItemIcon>
                        <ListItemText
                          primary={risk}
                          primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                        />
                      </ListItem>
                    ))}
                  </List>
                ) : (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <CheckCircle sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
                    <Typography color="text.secondary">
                      No significant risk factors identified
                    </Typography>
                  </Box>
                )}
              </Paper>
            </Grid>
          </Grid>
        )}
      </Box>

      {/* Copy Snackbar */}
      <Snackbar
        open={copySnackbar}
        autoHideDuration={2000}
        onClose={() => setCopySnackbar(false)}
        message="Raw data copied to clipboard"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
};

export default AtlassianAssessmentReport;
