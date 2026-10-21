import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Chip,
  Stack,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  TextField,
  MenuItem,
  Divider,
  LinearProgress,
  Button,
} from '@mui/material';
import {
  Refresh,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  Error as ErrorIcon,
  Schedule,
  QuestionAnswer,
  Search,
  Analytics,
  Timeline,
  PieChart as PieChartIcon,
  Description,
  Business,
  AutoAwesome,
  CloudDownload,
  Speed,
  Warning,
  ThumbUp,
  ThumbDown,
  Feedback as FeedbackIcon,
  Send,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from '../utils/rechartsShim';
import { apiGet, apiPost } from '../utils/api';
import { Fade } from '@mui/material';

// Types
interface TimeSeriesData {
  timestamp: string;
  eventCount: number;
  rfpCount: number;
  questionsExtracted: number;
  answersGenerated: number;
  avgDuration: number;
  errorCount: number;
  aiTokens: number;
  meetingsAnalyzed: number;
  avgConfidence: number;
}

interface SalesKPIs {
  rfpMetrics: {
    totalProcessed: number;
    successRate: number;
    avgProcessingTimeMs: number;
    avgQuestionsPerRFP: number;
    avgConfidenceScore: number;
    totalQuestionsAnswered: number;
    highConfidenceAnswers: number;
    mediumConfidenceAnswers: number;
    lowConfidenceAnswers: number;
  };
  meetingMetrics: {
    totalMeetingsAnalyzed: number;
    avgTranscriptLength: number;
    meetingsWithActionItems: number;
    meetingsWithFollowUps: number;
  };
  accountMetrics: {
    accountsResearched: number;
    avgResearchDepth: number;
    dealsCreated: number;
    dealsUpdated: number;
    dealStageChanges: number;
  };
  aiMetrics: {
    totalPromptsSent: number;
    totalTokensConsumed: number;
    avgResponseTimeMs: number;
    proposalsGenerated: number;
    pptsGenerated: number;
    pursuitBriefsCreated: number;
  };
  knowledgeMetrics: {
    totalSearches: number;
    caseStudiesMatched: number;
    internalKbSourcesUsed: number;
    webSearchesPerformed: number;
    avgSourcesPerAnswer: number;
  };
  featureUsage: Record<string, number>;
  exportMetrics: {
    excelExports: number;
    markdownExports: number;
    pptExports: number;
    pdfExports: number;
  };
}

interface DashboardMetrics {
  current: {
    activeResearches: number;
    activeMeetingAnalyses: number;
    todayRFPCount: number;
    todayQuestionCount: number;
    todayAnswerCount: number;
    todayMeetingsAnalyzed: number;
    todayAITokens: number;
    avgResponseTime: number;
    successRate: number;
    avgConfidenceScore: number;
  };
  trends: {
    rfpTrend: number;
    answersTrend: number;
    confidenceTrend: number;
    tokensTrend: number;
  };
  last24Hours: {
    summary: {
      totalEvents: number;
      totalRFPResearch: number;
      successfulRFPResearch: number;
      failedRFPResearch: number;
      totalQuestionsExtracted: number;
      totalAnswersGenerated: number;
      avgProcessingTimeMs: number;
      avgConfidenceScore: number;
      totalKnowledgeSearches: number;
      totalWebSearches: number;
      totalExports: number;
      totalAITokens: number;
      totalMeetingsAnalyzed: number;
      totalAccountsResearched: number;
      totalDealsUpdated: number;
    };
    timeSeries: TimeSeriesData[];
    confidenceDistribution: {
      high: number;
      medium: number;
      low: number;
    };
    categoryBreakdown: Record<string, number>;
    topActions: Array<{ action: string; count: number }>;
    kpis: SalesKPIs;
  };
  last7Days: {
    summary: {
      totalEvents: number;
      totalRFPResearch: number;
      successfulRFPResearch: number;
      failedRFPResearch: number;
      totalQuestionsExtracted: number;
      totalAnswersGenerated: number;
      avgProcessingTimeMs: number;
      avgConfidenceScore: number;
      totalAITokens: number;
      totalMeetingsAnalyzed: number;
      totalAccountsResearched: number;
      totalDealsUpdated: number;
    };
    timeSeries: TimeSeriesData[];
    confidenceDistribution: {
      high: number;
      medium: number;
      low: number;
    };
    kpis: SalesKPIs;
  };
  last30Days: {
    summary: {
      totalEvents: number;
      totalRFPResearch: number;
      successfulRFPResearch: number;
      failedRFPResearch: number;
      totalQuestionsExtracted: number;
      totalAnswersGenerated: number;
      avgProcessingTimeMs: number;
      avgConfidenceScore: number;
      totalAITokens: number;
      totalMeetingsAnalyzed: number;
      totalAccountsResearched: number;
      totalDealsUpdated: number;
    };
    timeSeries: TimeSeriesData[];
    confidenceDistribution: {
      high: number;
      medium: number;
      low: number;
    };
    kpis: SalesKPIs;
  };
  recentEvents: Array<{
    id: string;
    timestamp: string;
    eventType: string;
    category: string;
    action: string;
    label?: string;
    success: boolean;
    duration?: number;
    metadata?: Record<string, any>;
    context?: Record<string, any>;
  }>;
  topFeatures: Array<{ feature: string; count: number; trend: number }>;
  recentErrors: Array<{ message: string; count: number; lastOccurred: string }>;
}

// Colors - neutral design system
const COLORS = {
  primary: '#525252',
  secondary: '#171717',
  success: '#059669',
  warning: '#d97706',
  error: '#dc2626',
  info: '#525252',
  purple: '#525252',
  high: '#059669',
  medium: '#d97706',
  low: '#dc2626',
  gradient: '#171717',
};

const PIE_COLORS = ['#059669', '#d97706', '#dc2626'];
const FEATURE_COLORS = ['#525252', '#737373', '#404040', '#a3a3a3', '#262626', '#171717', '#059669', '#525252'];

// Stat Card Component with trend - clean style
const StatCard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
  trend?: number;
  loading?: boolean;
}> = ({ title, value, subtitle, icon, color, trend, loading }) => (
  <Paper
    sx={{
      p: 2.5,
      bgcolor: '#FFFFFF',
      borderColor: 'divider',
      borderRadius: 1.5,
      height: '100%',
      boxShadow: 'none',
    }}
  >
    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
      <Box>
        <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {title}
        </Typography>
        {loading ? (
          <CircularProgress size={20} sx={{ mt: 1, color: 'text.secondary' }} />
        ) : (
          <Typography variant="h5" sx={{ color: 'text.primary', fontWeight: 700, mt: 0.5 }}>
            {value}
          </Typography>
        )}
        {subtitle && (
          <Typography variant="caption" sx={{ color: 'text.disabled' }}>
            {subtitle}
          </Typography>
        )}
        {trend !== undefined && trend !== 0 && (
          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.5 }}>
            {trend >= 0 ? (
              <TrendingUp sx={{ fontSize: 14, color: COLORS.success }} />
            ) : (
              <TrendingDown sx={{ fontSize: 14, color: COLORS.error }} />
            )}
            <Typography
              variant="caption"
              sx={{ color: trend >= 0 ? COLORS.success : COLORS.error, fontWeight: 600, fontSize: '0.7rem' }}
            >
              {trend >= 0 ? '+' : ''}{trend}% vs yesterday
            </Typography>
          </Stack>
        )}
      </Box>
      <Box
        sx={{
          p: 1,
          borderRadius: 1,
          bgcolor: 'action.hover',
          color: 'text.secondary',
          '& svg': { fontSize: 20 },
        }}
      >
        {icon}
      </Box>
    </Stack>
  </Paper>
);

// KPI Progress Card - clean style
const KPIProgressCard: React.FC<{
  title: string;
  value: number;
  max: number;
  unit?: string;
  color: string;
  icon: React.ReactNode;
}> = ({ title, value, max, unit = '', color, icon }) => {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;

  return (
    <Paper sx={{ p: 2, borderRadius: 1, bgcolor: 'background.default', borderWidth: 1, borderStyle: 'solid', borderColor: 'divider', boxShadow: 'none' }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <Box sx={{ color: 'text.secondary', '& svg': { fontSize: 18 } }}>{icon}</Box>
        <Typography variant="body2" sx={{ color: 'text.disabled', fontWeight: 500 }}>
          {title}
        </Typography>
      </Stack>
      <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary' }}>
        {value.toLocaleString()}{unit}
      </Typography>
      <LinearProgress
        variant="determinate"
        value={percentage}
        sx={{
          mt: 1,
          height: 4,
          borderRadius: 2,
          bgcolor: 'action.hover',
          '& .MuiLinearProgress-bar': { bgcolor: 'text.secondary', borderRadius: 2 },
        }}
      />
      <Typography variant="caption" sx={{ color: 'text.disabled', mt: 0.5, display: 'block' }}>
        {percentage.toFixed(0)}% of target ({max.toLocaleString()})
      </Typography>
    </Paper>
  );
};

// Main Dashboard Component
const MetricsDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('24h');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Feedback state
  const [feedbackList, setFeedbackList] = useState<any[]>([]);
  const [feedbackStats, setFeedbackStats] = useState({ total: 0, likeCount: 0, dislikeCount: 0 });
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState<'like' | 'dislike' | null>(null);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackCategory, setFeedbackCategory] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      const response = await apiGet('/api/metrics/dashboard');
      if (response?.success) {
        setMetrics(response.data);
        setError(null);
      } else {
        setError(response?.error || 'Failed to load metrics');
      }
    } catch (err) {
      setError('Failed to connect to metrics service');
      console.error('Metrics fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchFeedback = useCallback(async () => {
    setFeedbackLoading(true);
    try {
      const response = await apiGet('/api/feedback?limit=50');
      if (response?.success) {
        setFeedbackList(response.data.feedbacks || []);
        setFeedbackStats({
          total: response.data.total || 0,
          likeCount: response.data.likeCount || 0,
          dislikeCount: response.data.dislikeCount || 0,
        });
      }
    } catch (err) {
      console.error('Failed to fetch feedback:', err);
    } finally {
      setFeedbackLoading(false);
    }
  }, []);

  const handleSubmitFeedback = useCallback(async () => {
    if (!feedbackRating) return;
    setFeedbackSubmitting(true);
    setFeedbackSuccess(null);
    try {
      const response = await apiPost('/api/feedback', {
        rating: feedbackRating,
        comment: feedbackComment || null,
        category: feedbackCategory || null,
      });
      if (response?.success) {
        setFeedbackSuccess('Feedback submitted successfully!');
        setFeedbackRating(null);
        setFeedbackComment('');
        setFeedbackCategory('');
        fetchFeedback();
      }
    } catch (err) {
      console.error('Failed to submit feedback:', err);
    } finally {
      setFeedbackSubmitting(false);
    }
  }, [feedbackRating, feedbackComment, feedbackCategory, fetchFeedback]);

  useEffect(() => {
    fetchMetrics();

    let interval: NodeJS.Timeout | null = null;
    if (autoRefresh) {
      interval = setInterval(fetchMetrics, 30000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [fetchMetrics, autoRefresh]);

  // Fetch feedback when switching to feedback tab
  useEffect(() => {
    if (activeTab === 4) {
      fetchFeedback();
    }
  }, [activeTab, fetchFeedback]);

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <Stack alignItems="center" spacing={2}>
          <CircularProgress size={48} sx={{ color: COLORS.primary }} />
          <Typography color="text.secondary">Loading metrics...</Typography>
        </Stack>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  if (!metrics) {
    return (
      <Alert severity="info">No metrics data available yet. Start using the platform to see analytics!</Alert>
    );
  }

  const selectedData = timeRange === '24h' ? metrics.last24Hours : timeRange === '30d' ? metrics.last30Days : metrics.last7Days;
  const kpis = selectedData.kpis;

  // Prepare chart data
  const timeSeriesData = selectedData.timeSeries.map((d) => ({
    ...d,
    time: formatTimestamp(d.timestamp),
  }));

  const confidenceData = [
    { name: 'High', value: selectedData.confidenceDistribution.high, color: COLORS.high },
    { name: 'Medium', value: selectedData.confidenceDistribution.medium, color: COLORS.medium },
    { name: 'Low', value: selectedData.confidenceDistribution.low, color: COLORS.low },
  ];

  // Feature usage data for radial chart
  const featureData = metrics.topFeatures?.map((f, idx) => ({
    name: f.feature.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    value: f.count,
    trend: f.trend,
    fill: FEATURE_COLORS[idx % FEATURE_COLORS.length],
  })) || [];

  return (
    <Box>
      <Fade in timeout={400}>
      <Box>
      {/* Page Header */}
      <Box sx={{ mb: 4 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', md: 'center' }}
          spacing={2}
        >
          <Box>
            <Typography variant="h5" sx={{ color: 'text.primary', fontWeight: 600, mb: 0.5 }}>
              Sales Intelligence Analytics
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.disabled' }}>
              Real-time KPIs and performance metrics for your sales operations
            </Typography>
          </Box>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <TextField
              select
              size="small"
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as '24h' | '7d' | '30d')}
              sx={{
                minWidth: 130,
                '& .MuiOutlinedInput-root': {
                  bgcolor: '#FFFFFF',
                  '& fieldset': { borderColor: 'divider' },
                  '&:hover fieldset': { borderColor: 'divider' },
                },
              }}
            >
              <MenuItem value="24h">Last 24 Hours</MenuItem>
              <MenuItem value="7d">Last 7 Days</MenuItem>
              <MenuItem value="30d">Last 30 Days</MenuItem>
            </TextField>
            <Chip
              label={autoRefresh ? 'Live' : 'Paused'}
              onClick={() => setAutoRefresh(!autoRefresh)}
              size="small"
              icon={autoRefresh ? <Speed sx={{ fontSize: 16 }} /> : undefined}
              sx={{
                bgcolor: autoRefresh ? 'rgba(5, 150, 105, 0.1)' : '#f5f5f5',
                color: autoRefresh ? COLORS.success : '#525252',
                fontWeight: 600,
                '&:hover': { bgcolor: autoRefresh ? 'rgba(5, 150, 105, 0.15)' : '#e5e5e5' },
              }}
            />
            <Tooltip title="Refresh Now">
              <IconButton
                onClick={fetchMetrics}
                size="small"
                sx={{
                  bgcolor: 'action.hover',
                  color: 'text.secondary',
                  '&:hover': { bgcolor: 'action.selected' },
                }}
              >
                <Refresh fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Box>

      {/* Real-time Stats Row */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <StatCard
            title="Active Sessions"
            value={metrics.current.activeResearches + (metrics.current.activeMeetingAnalyses || 0)}
            subtitle="Currently processing"
            icon={<Schedule />}
            color={COLORS.info}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <StatCard
            title="RFPs Processed"
            value={metrics.current.todayRFPCount}
            subtitle={`${metrics.current.todayAnswerCount} answers generated`}
            icon={<Description />}
            color={COLORS.primary}
            trend={metrics.trends?.rfpTrend}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <StatCard
            title="Success Rate"
            value={`${metrics.current.successRate.toFixed(1)}%`}
            subtitle="Completed successfully"
            icon={<CheckCircle />}
            color={COLORS.success}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <StatCard
            title="Avg Confidence"
            value={`${((metrics.current.avgConfidenceScore || 0) * 100).toFixed(0)}%`}
            subtitle="Answer quality"
            icon={<AutoAwesome />}
            color={metrics.current.avgConfidenceScore >= 0.7 ? COLORS.success : COLORS.warning}
            trend={metrics.trends?.confidenceTrend}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <StatCard
            title="AI Tokens Used"
            value={formatNumber(metrics.current.todayAITokens || 0)}
            subtitle="OpenAI consumption"
            icon={<AutoAwesome />}
            color={COLORS.purple}
            trend={metrics.trends?.tokensTrend}
          />
        </Grid>
      </Grid>

      {/* Tabs */}
      <Paper sx={{ mb: 3, borderRadius: 1.5, borderWidth: 1, borderStyle: 'solid', borderColor: 'divider', boxShadow: 'none' }}>
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          sx={{
            borderBottom: 1, borderColor: 'divider',
            px: 2,
            '& .MuiTab-root': {
              fontWeight: 500,
              textTransform: 'none',
              color: 'text.disabled',
              '&.Mui-selected': { color: 'text.primary' },
            },
            '& .MuiTabs-indicator': { bgcolor: 'text.primary' },
          }}
        >
          <Tab label="Sales KPIs" icon={<Analytics sx={{ fontSize: 18 }} />} iconPosition="start" />
          <Tab label="Activity" icon={<Timeline sx={{ fontSize: 18 }} />} iconPosition="start" />
          <Tab label="Features" icon={<PieChartIcon sx={{ fontSize: 18 }} />} iconPosition="start" />
          <Tab label="Event Log" icon={<Search sx={{ fontSize: 18 }} />} iconPosition="start" />
          <Tab label="Feedback" icon={<FeedbackIcon sx={{ fontSize: 18 }} />} iconPosition="start" />
        </Tabs>

        <Box sx={{ p: 3 }}>
          {/* Sales KPIs Tab */}
          {activeTab === 0 && kpis && (
            <Grid container spacing={2}>
              {/* RFP Performance */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Paper sx={{ p: 2.5, bgcolor: 'background.default', borderRadius: 1.5, borderWidth: 1, borderStyle: 'solid', borderColor: 'divider', boxShadow: 'none' }}>
                  <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Description sx={{ color: 'text.secondary', fontSize: 20 }} />
                    RFP Performance
                  </Typography>
                  <Grid container spacing={1.5}>
                    <Grid size={{ xs: 6 }}>
                      <KPIProgressCard
                        title="RFPs Processed"
                        value={kpis.rfpMetrics.totalProcessed}
                        max={50}
                        color={COLORS.primary}
                        icon={<Description fontSize="small" />}
                      />
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <KPIProgressCard
                        title="Questions Answered"
                        value={kpis.rfpMetrics.totalQuestionsAnswered}
                        max={500}
                        color={COLORS.info}
                        icon={<QuestionAnswer fontSize="small" />}
                      />
                    </Grid>
                    <Grid size={{ xs: 4 }}>
                      <Paper sx={{ p: 1.5, textAlign: 'center', bgcolor: 'rgba(5, 150, 105, 0.05)', borderRadius: 1, borderWidth: 1, borderStyle: 'solid', borderColor: 'divider', boxShadow: 'none' }}>
                        <Typography variant="h5" sx={{ color: COLORS.success, fontWeight: 700 }}>
                          {kpis.rfpMetrics.highConfidenceAnswers}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.disabled' }}>High Confidence</Typography>
                      </Paper>
                    </Grid>
                    <Grid size={{ xs: 4 }}>
                      <Paper sx={{ p: 1.5, textAlign: 'center', bgcolor: 'rgba(217, 119, 6, 0.05)', borderRadius: 1, borderWidth: 1, borderStyle: 'solid', borderColor: 'divider', boxShadow: 'none' }}>
                        <Typography variant="h5" sx={{ color: COLORS.warning, fontWeight: 700 }}>
                          {kpis.rfpMetrics.mediumConfidenceAnswers}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.disabled' }}>Medium Confidence</Typography>
                      </Paper>
                    </Grid>
                    <Grid size={{ xs: 4 }}>
                      <Paper sx={{ p: 1.5, textAlign: 'center', bgcolor: 'rgba(220, 38, 38, 0.05)', borderRadius: 1, borderWidth: 1, borderStyle: 'solid', borderColor: 'divider', boxShadow: 'none' }}>
                        <Typography variant="h5" sx={{ color: COLORS.error, fontWeight: 700 }}>
                          {kpis.rfpMetrics.lowConfidenceAnswers}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.disabled' }}>Low Confidence</Typography>
                      </Paper>
                    </Grid>
                  </Grid>
                  <Divider sx={{ my: 2 }} />
                  <Stack direction="row" spacing={3} justifyContent="center">
                    <Box textAlign="center">
                      <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary' }}>
                        {kpis.rfpMetrics.successRate.toFixed(0)}%
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.disabled' }}>Success Rate</Typography>
                    </Box>
                    <Box textAlign="center">
                      <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary' }}>
                        {formatDuration(kpis.rfpMetrics.avgProcessingTimeMs)}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.disabled' }}>Avg Time</Typography>
                    </Box>
                    <Box textAlign="center">
                      <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary' }}>
                        {kpis.rfpMetrics.avgQuestionsPerRFP.toFixed(1)}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.disabled' }}>Avg Questions/RFP</Typography>
                    </Box>
                  </Stack>
                </Paper>
              </Grid>

              {/* AI & Generation Metrics */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Paper sx={{ p: 2.5, bgcolor: 'background.default', borderRadius: 1.5, borderWidth: 1, borderStyle: 'solid', borderColor: 'divider', boxShadow: 'none' }}>
                  <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AutoAwesome sx={{ color: 'text.secondary', fontSize: 20 }} />
                    AI & Generation
                  </Typography>
                  <Grid container spacing={1.5}>
                    <Grid size={{ xs: 6 }}>
                      <KPIProgressCard
                        title="AI Tokens"
                        value={kpis.aiMetrics.totalTokensConsumed}
                        max={1000000}
                        color={COLORS.purple}
                        icon={<AutoAwesome fontSize="small" />}
                      />
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <KPIProgressCard
                        title="Proposals Generated"
                        value={kpis.aiMetrics.proposalsGenerated}
                        max={20}
                        color={COLORS.info}
                        icon={<Description fontSize="small" />}
                      />
                    </Grid>
                    <Grid size={{ xs: 4 }}>
                      <Paper sx={{ p: 1.5, textAlign: 'center', bgcolor: 'action.hover', borderRadius: 1, borderWidth: 1, borderStyle: 'solid', borderColor: 'divider', boxShadow: 'none' }}>
                        <Typography variant="h5" sx={{ color: 'text.primary', fontWeight: 700 }}>
                          {kpis.aiMetrics.pptsGenerated}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.disabled' }}>PPTs Created</Typography>
                      </Paper>
                    </Grid>
                    <Grid size={{ xs: 4 }}>
                      <Paper sx={{ p: 1.5, textAlign: 'center', bgcolor: 'action.hover', borderRadius: 1, borderWidth: 1, borderStyle: 'solid', borderColor: 'divider', boxShadow: 'none' }}>
                        <Typography variant="h5" sx={{ color: 'text.primary', fontWeight: 700 }}>
                          {kpis.aiMetrics.pursuitBriefsCreated}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.disabled' }}>Pursuit Briefs</Typography>
                      </Paper>
                    </Grid>
                    <Grid size={{ xs: 4 }}>
                      <Paper sx={{ p: 1.5, textAlign: 'center', bgcolor: 'action.hover', borderRadius: 1, borderWidth: 1, borderStyle: 'solid', borderColor: 'divider', boxShadow: 'none' }}>
                        <Typography variant="h5" sx={{ color: 'text.primary', fontWeight: 700 }}>
                          {formatDuration(kpis.aiMetrics.avgResponseTimeMs)}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.disabled' }}>Avg Response</Typography>
                      </Paper>
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>

              {/* Knowledge & Account Metrics */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Paper sx={{ p: 2.5, bgcolor: 'background.default', borderRadius: 1.5, borderWidth: 1, borderStyle: 'solid', borderColor: 'divider', boxShadow: 'none' }}>
                  <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Search sx={{ color: 'text.secondary', fontSize: 20 }} />
                    Knowledge Base Usage
                  </Typography>
                  <Stack spacing={1.5}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" sx={{ color: 'text.disabled' }}>Total Searches</Typography>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'text.primary' }}>{kpis.knowledgeMetrics.totalSearches}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" sx={{ color: 'text.disabled' }}>Case Studies Matched</Typography>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, color: COLORS.success }}>{kpis.knowledgeMetrics.caseStudiesMatched}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" sx={{ color: 'text.disabled' }}>KM Hub Sources</Typography>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'text.primary' }}>{kpis.knowledgeMetrics.internalKbSourcesUsed}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" sx={{ color: 'text.disabled' }}>Web Searches</Typography>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'text.primary' }}>{kpis.knowledgeMetrics.webSearchesPerformed}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" sx={{ color: 'text.disabled' }}>Avg Sources/Answer</Typography>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'text.primary' }}>{kpis.knowledgeMetrics.avgSourcesPerAnswer}</Typography>
                    </Stack>
                  </Stack>
                </Paper>
              </Grid>

              {/* Account & Deal Metrics */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Paper sx={{ p: 2.5, bgcolor: 'background.default', borderRadius: 1.5, borderWidth: 1, borderStyle: 'solid', borderColor: 'divider', boxShadow: 'none' }}>
                  <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Business sx={{ color: 'text.secondary', fontSize: 20 }} />
                    Accounts & Deals
                  </Typography>
                  <Grid container spacing={1.5}>
                    <Grid size={{ xs: 6 }}>
                      <Paper sx={{ p: 1.5, textAlign: 'center', bgcolor: 'action.hover', borderRadius: 1, borderWidth: 1, borderStyle: 'solid', borderColor: 'divider', boxShadow: 'none' }}>
                        <Typography variant="h4" sx={{ color: 'text.primary', fontWeight: 700 }}>
                          {kpis.accountMetrics.accountsResearched}
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.disabled' }}>Accounts Researched</Typography>
                      </Paper>
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <Paper sx={{ p: 1.5, textAlign: 'center', bgcolor: 'rgba(5, 150, 105, 0.05)', borderRadius: 1, borderWidth: 1, borderStyle: 'solid', borderColor: 'divider', boxShadow: 'none' }}>
                        <Typography variant="h4" sx={{ color: COLORS.success, fontWeight: 700 }}>
                          {kpis.accountMetrics.dealsCreated}
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.disabled' }}>Deals Created</Typography>
                      </Paper>
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <Paper sx={{ p: 1.5, textAlign: 'center', bgcolor: 'action.hover', borderRadius: 1, borderWidth: 1, borderStyle: 'solid', borderColor: 'divider', boxShadow: 'none' }}>
                        <Typography variant="h5" sx={{ color: 'text.primary', fontWeight: 700 }}>
                          {kpis.accountMetrics.dealsUpdated}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.disabled' }}>Deals Updated</Typography>
                      </Paper>
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <Paper sx={{ p: 1.5, textAlign: 'center', bgcolor: 'rgba(217, 119, 6, 0.05)', borderRadius: 1, borderWidth: 1, borderStyle: 'solid', borderColor: 'divider', boxShadow: 'none' }}>
                        <Typography variant="h5" sx={{ color: COLORS.warning, fontWeight: 700 }}>
                          {kpis.accountMetrics.dealStageChanges}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.disabled' }}>Stage Changes</Typography>
                      </Paper>
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>

              {/* Exports Summary */}
              <Grid size={{ xs: 12 }}>
                <Paper sx={{ p: 2.5, bgcolor: 'background.default', borderRadius: 1.5, borderWidth: 1, borderStyle: 'solid', borderColor: 'divider', boxShadow: 'none' }}>
                  <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CloudDownload sx={{ color: 'text.secondary', fontSize: 20 }} />
                    Export Activity
                  </Typography>
                  <Stack direction="row" spacing={4} justifyContent="center">
                    <Box textAlign="center">
                      <Typography variant="h5" sx={{ fontWeight: 700, color: COLORS.success }}>
                        {kpis.exportMetrics.excelExports}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'text.disabled' }}>Excel Exports</Typography>
                    </Box>
                    <Box textAlign="center">
                      <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary' }}>
                        {kpis.exportMetrics.pptExports}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'text.disabled' }}>PowerPoint</Typography>
                    </Box>
                    <Box textAlign="center">
                      <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary' }}>
                        {kpis.exportMetrics.markdownExports}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'text.disabled' }}>Markdown</Typography>
                    </Box>
                    <Box textAlign="center">
                      <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary' }}>
                        {kpis.exportMetrics.pdfExports}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'text.disabled' }}>PDF</Typography>
                    </Box>
                  </Stack>
                </Paper>
              </Grid>
            </Grid>
          )}

          {/* Activity Tab */}
          {activeTab === 1 && (
            <Box>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12 }}>
                  <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, color: 'text.primary' }}>
                    Activity Over Time
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={timeSeriesData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="time" tick={{ fontSize: 11 }} stroke="#64748b" />
                      <YAxis stroke="#64748b" />
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: 'background.paper', borderWidth: 1, borderStyle: 'solid', borderColor: 'divider', borderRadius: 8 }}
                      />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="eventCount"
                        name="Total Events"
                        stroke={COLORS.secondary}
                        fill={`${COLORS.secondary}20`}
                        strokeWidth={2}
                      />
                      <Area
                        type="monotone"
                        dataKey="answersGenerated"
                        name="Answers Generated"
                        stroke={COLORS.success}
                        fill={`${COLORS.success}20`}
                        strokeWidth={2}
                      />
                      <Area
                        type="monotone"
                        dataKey="errorCount"
                        name="Errors"
                        stroke={COLORS.error}
                        fill={`${COLORS.error}20`}
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, color: 'text.primary' }}>
                    AI Token Consumption
                  </Typography>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={timeSeriesData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                      <XAxis dataKey="time" tick={{ fontSize: 11 }} stroke="#737373" />
                      <YAxis stroke="#737373" />
                      <RechartsTooltip />
                      <Line
                        type="monotone"
                        dataKey="aiTokens"
                        name="Tokens"
                        stroke="#525252"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, color: 'text.primary' }}>
                    Confidence Score Trend
                  </Typography>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={timeSeriesData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                      <XAxis dataKey="time" tick={{ fontSize: 11 }} stroke="#737373" />
                      <YAxis domain={[0, 1]} stroke="#737373" tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} />
                      <RechartsTooltip formatter={(value: number) => `${(value * 100).toFixed(1)}%`} />
                      <Line
                        type="monotone"
                        dataKey="avgConfidence"
                        name="Avg Confidence"
                        stroke={COLORS.success}
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Grid>
              </Grid>
            </Box>
          )}

          {/* Features Tab */}
          {activeTab === 2 && (
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, color: 'text.primary' }}>
                  Feature Usage (Last 7 Days)
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={featureData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                    <XAxis type="number" stroke="#737373" />
                    <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 11 }} stroke="#737373" />
                    <RechartsTooltip />
                    <Bar dataKey="value" radius={[0, 2, 2, 0]}>
                      {featureData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, color: 'text.primary' }}>
                  Confidence Distribution
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={confidenceData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }: { name: string; percent: number }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {confidenceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
                <Stack direction="row" justifyContent="center" spacing={1} sx={{ mt: 2 }}>
                  {confidenceData.map((item) => (
                    <Chip
                      key={item.name}
                      label={`${item.name}: ${item.value}`}
                      size="small"
                      sx={{ bgcolor: 'action.hover', color: 'text.secondary', fontWeight: 600, fontSize: '0.7rem' }}
                    />
                  ))}
                </Stack>
              </Grid>

              {/* Recent Errors */}
              {metrics.recentErrors && metrics.recentErrors.length > 0 && (
                <Grid size={{ xs: 12 }}>
                  <Paper sx={{ p: 2.5, bgcolor: 'rgba(220, 38, 38, 0.03)', borderRadius: 1.5, border: '1px solid rgba(220, 38, 38, 0.2)', boxShadow: 'none' }}>
                    <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, color: COLORS.error, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Warning sx={{ fontSize: 20 }} />
                      Recent Errors
                    </Typography>
                    <Stack spacing={1}>
                      {metrics.recentErrors.map((err, idx) => (
                        <Stack key={idx} direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 1, borderBottom: 1, borderWidth: 1, borderStyle: 'solid', borderColor: 'divider' }}>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: COLORS.error }}>
                            {err.message}
                          </Typography>
                          <Stack direction="row" spacing={2} alignItems="center">
                            <Chip label={`${err.count}x`} size="small" sx={{ bgcolor: 'rgba(220, 38, 38, 0.1)', color: COLORS.error, fontSize: '0.7rem' }} />
                            <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                              {new Date(err.lastOccurred).toLocaleString()}
                            </Typography>
                          </Stack>
                        </Stack>
                      ))}
                    </Stack>
                  </Paper>
                </Grid>
              )}
            </Grid>
          )}

          {/* Event Log Tab */}
          {activeTab === 3 && (
            <Box>
              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, color: 'text.primary' }}>
                Recent Events (Live Feed)
              </Typography>
              <TableContainer sx={{ maxHeight: 500 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'background.default' }}>
                      <TableCell sx={{ fontWeight: 600, color: 'text.secondary', bgcolor: 'background.default' }}>Timestamp</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: 'text.secondary', bgcolor: 'background.default' }}>Event</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: 'text.secondary', bgcolor: 'background.default' }}>Category</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: 'text.secondary', bgcolor: 'background.default' }}>Details</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: 'text.secondary', bgcolor: 'background.default' }}>Duration</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: 'text.secondary', bgcolor: 'background.default' }}>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {metrics.recentEvents.slice(0, 50).map((event) => (
                      <TableRow key={event.id} hover sx={{ '&:hover': { bgcolor: 'background.default' } }}>
                        <TableCell sx={{ fontFamily: 'monospace', fontSize: 11, whiteSpace: 'nowrap', color: 'text.secondary' }}>
                          {new Date(event.timestamp).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={event.eventType.replace(/_/g, ' ')}
                            size="small"
                            sx={{
                              bgcolor: event.eventType.includes('error') || event.eventType.includes('failed')
                                ? 'rgba(220, 38, 38, 0.1)'
                                : event.eventType.includes('completed')
                                ? 'rgba(5, 150, 105, 0.1)'
                                : event.eventType.includes('started')
                                ? 'rgba(82, 82, 82, 0.1)'
                                : '#f5f5f5',
                              color: event.eventType.includes('error') || event.eventType.includes('failed')
                                ? COLORS.error
                                : event.eventType.includes('completed')
                                ? COLORS.success
                                : '#525252',
                              fontSize: '0.65rem',
                              fontWeight: 600,
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ textTransform: 'capitalize', color: 'text.secondary' }}>
                            {event.category.replace(/_/g, ' ')}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 11, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', color: 'text.secondary' }}>
                            {event.label || event.action}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {event.duration ? (
                            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 11, color: 'text.secondary' }}>
                              {formatDuration(event.duration)}
                            </Typography>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          {event.success ? (
                            <CheckCircle sx={{ color: COLORS.success, fontSize: 16 }} />
                          ) : (
                            <ErrorIcon sx={{ color: COLORS.error, fontSize: 16 }} />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              {metrics.recentEvents.length === 0 && (
                <Alert severity="info" sx={{ mt: 2, borderRadius: 1 }}>
                  No events recorded yet. Start using the platform to see activity here.
                </Alert>
              )}
            </Box>
          )}

          {/* Feedback Tab */}
          {activeTab === 4 && (
            <Box>
              {/* Summary Stats */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'background.default', borderRadius: 1.5, border: 1, borderColor: 'divider', boxShadow: 'none' }}>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: 'text.primary' }}>{feedbackStats.total}</Typography>
                    <Typography variant="body2" sx={{ color: 'text.disabled' }}>Total Feedback</Typography>
                  </Paper>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'rgba(5, 150, 105, 0.05)', borderRadius: 1.5, border: 1, borderColor: 'divider', boxShadow: 'none' }}>
                    <Stack direction="row" justifyContent="center" alignItems="center" spacing={1}>
                      <ThumbUp sx={{ color: COLORS.success, fontSize: 22 }} />
                      <Typography variant="h4" sx={{ fontWeight: 700, color: COLORS.success }}>{feedbackStats.likeCount}</Typography>
                    </Stack>
                    <Typography variant="body2" sx={{ color: 'text.disabled' }}>Likes</Typography>
                  </Paper>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'rgba(220, 38, 38, 0.05)', borderRadius: 1.5, border: 1, borderColor: 'divider', boxShadow: 'none' }}>
                    <Stack direction="row" justifyContent="center" alignItems="center" spacing={1}>
                      <ThumbDown sx={{ color: COLORS.error, fontSize: 22 }} />
                      <Typography variant="h4" sx={{ fontWeight: 700, color: COLORS.error }}>{feedbackStats.dislikeCount}</Typography>
                    </Stack>
                    <Typography variant="body2" sx={{ color: 'text.disabled' }}>Dislikes</Typography>
                  </Paper>
                </Grid>
              </Grid>

              {/* Submit Feedback Form */}
              <Paper sx={{ p: 3, mb: 3, borderRadius: 1.5, border: 1, borderColor: 'divider', boxShadow: 'none' }}>
                <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <FeedbackIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                  Submit Feedback
                </Typography>

                {feedbackSuccess && (
                  <Alert severity="success" sx={{ mb: 2, borderRadius: 1 }} onClose={() => setFeedbackSuccess(null)}>
                    {feedbackSuccess}
                  </Alert>
                )}

                <Stack spacing={2}>
                  {/* Rating Buttons */}
                  <Box>
                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1, fontWeight: 500 }}>Rating *</Typography>
                    <Stack direction="row" spacing={1}>
                      <Button
                        variant={feedbackRating === 'like' ? 'contained' : 'outlined'}
                        startIcon={<ThumbUp />}
                        onClick={() => setFeedbackRating('like')}
                        sx={{
                          borderColor: feedbackRating === 'like' ? COLORS.success : 'divider',
                          bgcolor: feedbackRating === 'like' ? COLORS.success : 'transparent',
                          color: feedbackRating === 'like' ? '#fff' : 'text.secondary',
                          textTransform: 'none',
                          fontWeight: 600,
                          '&:hover': {
                            bgcolor: feedbackRating === 'like' ? COLORS.success : 'rgba(5, 150, 105, 0.08)',
                            borderColor: COLORS.success,
                          },
                        }}
                      >
                        Like
                      </Button>
                      <Button
                        variant={feedbackRating === 'dislike' ? 'contained' : 'outlined'}
                        startIcon={<ThumbDown />}
                        onClick={() => setFeedbackRating('dislike')}
                        sx={{
                          borderColor: feedbackRating === 'dislike' ? COLORS.error : 'divider',
                          bgcolor: feedbackRating === 'dislike' ? COLORS.error : 'transparent',
                          color: feedbackRating === 'dislike' ? '#fff' : 'text.secondary',
                          textTransform: 'none',
                          fontWeight: 600,
                          '&:hover': {
                            bgcolor: feedbackRating === 'dislike' ? COLORS.error : 'rgba(220, 38, 38, 0.08)',
                            borderColor: COLORS.error,
                          },
                        }}
                      >
                        Dislike
                      </Button>
                    </Stack>
                  </Box>

                  {/* Category Selector */}
                  <TextField
                    select
                    label="Category (optional)"
                    value={feedbackCategory}
                    onChange={(e) => setFeedbackCategory(e.target.value)}
                    size="small"
                    sx={{
                      maxWidth: 300,
                      '& .MuiOutlinedInput-root': {
                        bgcolor: '#FFFFFF',
                        '& fieldset': { borderColor: 'divider' },
                      },
                    }}
                  >
                    <MenuItem value="">None</MenuItem>
                    <MenuItem value="rfp_research">RFP Research</MenuItem>
                    <MenuItem value="transcript_analysis">Transcript Analysis</MenuItem>
                    <MenuItem value="proposal_generation">Proposal Generation</MenuItem>
                    <MenuItem value="ppt_generation">PPT Generation</MenuItem>
                    <MenuItem value="meeting_analysis">Meeting Analysis</MenuItem>
                    <MenuItem value="account_research">Account Research</MenuItem>
                    <MenuItem value="ai_assistant">AI Assistant</MenuItem>
                    <MenuItem value="other">Other</MenuItem>
                  </TextField>

                  {/* Comment Field */}
                  <TextField
                    label="Comment (optional)"
                    value={feedbackComment}
                    onChange={(e) => setFeedbackComment(e.target.value)}
                    multiline
                    rows={3}
                    placeholder="Share your thoughts about the output quality..."
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        bgcolor: '#FFFFFF',
                        '& fieldset': { borderColor: 'divider' },
                      },
                    }}
                  />

                  {/* Submit Button */}
                  <Box>
                    <Button
                      variant="contained"
                      onClick={handleSubmitFeedback}
                      disabled={!feedbackRating || feedbackSubmitting}
                      startIcon={feedbackSubmitting ? <CircularProgress size={16} color="inherit" /> : <Send />}
                      sx={{
                        bgcolor: 'text.primary',
                        color: 'background.paper',
                        textTransform: 'none',
                        fontWeight: 600,
                        px: 3,
                        '&:hover': { bgcolor: '#333' },
                        '&.Mui-disabled': { bgcolor: 'action.disabledBackground' },
                      }}
                    >
                      {feedbackSubmitting ? 'Submitting...' : 'Submit Feedback'}
                    </Button>
                  </Box>
                </Stack>
              </Paper>

              {/* Feedback History */}
              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, color: 'text.primary' }}>
                Feedback History
              </Typography>
              {feedbackLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress size={32} sx={{ color: 'text.secondary' }} />
                </Box>
              ) : feedbackList.length === 0 ? (
                <Alert severity="info" sx={{ borderRadius: 1 }}>
                  No feedback submitted yet. Use the form above to share your feedback.
                </Alert>
              ) : (
                <TableContainer sx={{ maxHeight: 400 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600, color: 'text.secondary', bgcolor: 'background.default' }}>Rating</TableCell>
                        <TableCell sx={{ fontWeight: 600, color: 'text.secondary', bgcolor: 'background.default' }}>Category</TableCell>
                        <TableCell sx={{ fontWeight: 600, color: 'text.secondary', bgcolor: 'background.default' }}>User</TableCell>
                        <TableCell sx={{ fontWeight: 600, color: 'text.secondary', bgcolor: 'background.default' }}>Comment</TableCell>
                        <TableCell sx={{ fontWeight: 600, color: 'text.secondary', bgcolor: 'background.default' }}>Date</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {feedbackList.map((fb: any) => (
                        <TableRow key={fb.id} hover sx={{ '&:hover': { bgcolor: 'background.default' } }}>
                          <TableCell>
                            {fb.rating === 'like' ? (
                              <Chip
                                icon={<ThumbUp sx={{ fontSize: 14 }} />}
                                label="Like"
                                size="small"
                                sx={{ bgcolor: 'rgba(5, 150, 105, 0.1)', color: COLORS.success, fontWeight: 600, fontSize: '0.7rem' }}
                              />
                            ) : (
                              <Chip
                                icon={<ThumbDown sx={{ fontSize: 14 }} />}
                                label="Dislike"
                                size="small"
                                sx={{ bgcolor: 'rgba(220, 38, 38, 0.1)', color: COLORS.error, fontWeight: 600, fontSize: '0.7rem' }}
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ textTransform: 'capitalize', color: 'text.secondary' }}>
                              {fb.category ? fb.category.replace(/_/g, ' ') : '-'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                              {fb.userId || 'Anonymous'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {fb.comment || '-'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 11, color: 'text.secondary', whiteSpace: 'nowrap' }}>
                              {new Date(fb.createdAt).toLocaleString()}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          )}
        </Box>
      </Paper>
      </Box>
      </Fade>
    </Box>
  );
};

export default MetricsDashboard;
