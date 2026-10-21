import React, { useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Card,
  CardContent,
  Chip,
  Collapse,
  Grid,
  IconButton,
  LinearProgress,
  Stack,
  Tab,
  Tabs,
  Typography,
  alpha,
} from '@mui/material';
import {
  TrendingUp,
  CheckCircle,
  Warning,
  Lightbulb,
  ArrowForward,
  Business,
  Person,
  Schedule,
  AttachMoney,
  Flag,
  EmojiObjects,
  Psychology,
  Groups,
  Timeline,
  ExpandMore,
  ExpandLess,
  Speed,
  ErrorOutline,
  ThumbUp,
  ThumbDown,
  Remove,
  Gavel,
  Rocket,
  Description,
  PlayArrow,
  RecordVoiceOver,
  Topic,
  Event,
  FormatQuote,
  PieChart,
} from '@mui/icons-material';
import type { TranscriptAnalysisResult } from '../../../shared/types/transcript';
import InternalKbInsightsPanel from './insights/InternalKbInsightsPanel';

interface TranscriptAnalysisInsightProps {
  analysisData: any;
}

// Color palette
const COLORS = {
  primary: '#171717',
  success: '#059669',
  warning: '#d97706',
  error: '#dc2626',
  info: '#2563eb',
  purple: '#7c3aed',
  slate50: '#f8fafc',
  slate100: '#f1f5f9',
  slate200: '#e2e8f0',
  slate300: '#cbd5e1',
  slate400: '#94a3b8',
  slate500: '#64748b',
  slate600: '#475569',
};

const pursuitBriefQuestions: Record<string, { question: string; icon: React.ReactNode; category: string }> = {
  '1': { question: 'Who is the buyer and key stakeholders?', icon: <Groups fontSize="small" />, category: 'discovery' },
  '2': { question: 'What business problem are they solving?', icon: <ErrorOutline fontSize="small" />, category: 'discovery' },
  '3': { question: 'What are their goals and outcomes?', icon: <Flag fontSize="small" />, category: 'discovery' },
  '4': { question: 'Why now? What is driving urgency?', icon: <Schedule fontSize="small" />, category: 'discovery' },
  '5': { question: 'What challenges could block success?', icon: <Warning fontSize="small" />, category: 'risks' },
  '6': { question: 'What do they seek in a partner?', icon: <Person fontSize="small" />, category: 'discovery' },
  '7': { question: 'What is the procurement process?', icon: <Gavel fontSize="small" />, category: 'process' },
  '8': { question: 'Who are the likely competitors?', icon: <Business fontSize="small" />, category: 'competitive' },
  '9': { question: 'Why would they choose us?', icon: <ThumbUp fontSize="small" />, category: 'positioning' },
  '10': { question: 'What could make them walk away?', icon: <ThumbDown fontSize="small" />, category: 'risks' },
  '11': { question: 'What is our vision for their future state?', icon: <Rocket fontSize="small" />, category: 'solution' },
  '12': { question: 'What are the core solution elements?', icon: <EmojiObjects fontSize="small" />, category: 'solution' },
  '13': { question: 'What assumptions are we making?', icon: <Psychology fontSize="small" />, category: 'risks' },
  '14': { question: 'What are our win themes?', icon: <Flag fontSize="small" />, category: 'positioning' },
  '15': { question: 'What is our pitch storyline?', icon: <Description fontSize="small" />, category: 'positioning' },
  '16': { question: 'What demos or artifacts can we showcase?', icon: <PlayArrow fontSize="small" />, category: 'solution' },
};

const categoryLabels: Record<string, { label: string; color: string }> = {
  discovery: { label: 'Discovery', color: COLORS.info },
  risks: { label: 'Risks', color: COLORS.error },
  process: { label: 'Process', color: '#64748b' },
  competitive: { label: 'Competitive', color: COLORS.warning },
  positioning: { label: 'Positioning', color: COLORS.purple },
  solution: { label: 'Solution', color: COLORS.success },
};

const getScoreColor = (score: number | null | undefined) => {
  if (score === null || score === undefined) return COLORS.slate400;
  if (score >= 70) return COLORS.success;
  if (score >= 40) return COLORS.warning;
  return COLORS.error;
};

const getSentimentConfig = (sentiment: any) => {
  if (!sentiment) return { color: COLORS.info, icon: <Remove />, label: 'Unknown' };
  const normalized = String(sentiment).toLowerCase();
  if (normalized.includes('positive')) return { color: COLORS.success, icon: <ThumbUp />, label: 'Positive' };
  if (normalized.includes('negative')) return { color: COLORS.error, icon: <ThumbDown />, label: 'Negative' };
  if (normalized.includes('mixed')) return { color: COLORS.warning, icon: <Psychology />, label: 'Mixed' };
  return { color: COLORS.info, icon: <Remove />, label: normalized.charAt(0).toUpperCase() + normalized.slice(1) };
};

const normalizeList = (value: any): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (!entry) return null;
        if (typeof entry === 'string') return entry;
        if (typeof entry === 'object') {
          const text = Object.values(entry)
            .filter((val) => typeof val === 'string' && val.trim())
            .join(' - ');
          return text || null;
        }
        return String(entry);
      })
      .filter((entry): entry is string => Boolean(entry?.trim()))
      .map((entry) => entry.trim());
  }
  if (typeof value === 'string') {
    return value
      .split(/\n|•|-/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
};

// Section Card Component
const SectionCard: React.FC<{
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  badge?: string | number;
  color?: string;
}> = ({ title, icon, children, defaultExpanded = true, badge, color = COLORS.primary }) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <Card
      elevation={0}
      sx={{
        borderRadius: 2,
        border: 1,
        borderColor: 'divider',
        overflow: 'hidden',
      }}
    >
      <Box
        onClick={() => setExpanded(!expanded)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2.5,
          py: 1.5,
          cursor: 'pointer',
          bgcolor: expanded ? 'white' : COLORS.slate50,
          borderBottom: expanded ? '1px solid' : 'none',
          borderColor: 'divider',
          transition: 'background-color 0.2s',
          '&:hover': { bgcolor: 'background.default' },
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          {icon && (
            <Box sx={{ color, display: 'flex', alignItems: 'center' }}>
              {icon}
            </Box>
          )}
          <Typography variant="subtitle1" sx={{ fontWeight: 600, color: COLORS.primary }}>
            {title}
          </Typography>
          {badge !== undefined && (
            <Chip
              label={badge}
              size="small"
              sx={{
                height: 20,
                fontSize: '0.7rem',
                fontWeight: 600,
                bgcolor: alpha(color, 0.1),
                color: color,
              }}
            />
          )}
        </Stack>
        <IconButton size="small" sx={{ color: '#94a3b8' }}>
          {expanded ? <ExpandLess /> : <ExpandMore />}
        </IconButton>
      </Box>
      <Collapse in={expanded}>
        <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
          {children}
        </CardContent>
      </Collapse>
    </Card>
  );
};

// Metric Card Component
const MetricCard: React.FC<{
  label: string;
  value: string | number | null;
  suffix?: string;
  color: string;
  icon?: React.ReactNode;
  showProgress?: boolean;
  subtext?: string;
}> = ({ label, value, suffix, color, icon, showProgress, subtext }) => (
  <Box
    sx={{
      p: 2.5,
      borderRadius: 2,
      border: 1,
      borderColor: 'divider',
      bgcolor: 'background.paper',
      flex: 1,
      minWidth: 140,
    }}
  >
    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
      {icon && <Box sx={{ color: '#94a3b8', display: 'flex' }}>{icon}</Box>}
      <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.3 }}>
        {label}
      </Typography>
    </Stack>
    <Typography variant="h4" sx={{ color, fontWeight: 700, lineHeight: 1.2 }}>
      {value ?? '--'}
      {suffix && (
        <Typography component="span" variant="body2" sx={{ color: '#94a3b8', ml: 0.5 }}>
          {suffix}
        </Typography>
      )}
    </Typography>
    {showProgress && typeof value === 'number' && (
      <LinearProgress
        variant="determinate"
        value={Math.min(value, 100)}
        sx={{
          mt: 1.5,
          height: 4,
          borderRadius: 2,
          bgcolor: alpha(color, 0.15),
          '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 2 },
        }}
      />
    )}
    {subtext && (
      <Typography variant="caption" sx={{ color: '#94a3b8', mt: 0.5, display: 'block' }}>
        {subtext}
      </Typography>
    )}
  </Box>
);

// Pursuit Brief Item Component
const PursuitBriefItem: React.FC<{
  questionNumber: string;
  config: { question: string; icon: React.ReactNode; category: string };
  answer: string | null;
}> = ({ questionNumber, config, answer }) => {
  const hasAnswer = answer && !answer.includes('[Not enough information]') && answer.trim().length > 0;
  const categoryConfig = categoryLabels[config.category] || { label: 'Other', color: '#64748b' };

  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 1.5,
        border: 1,
        borderColor: hasAnswer ? COLORS.slate200 : alpha(COLORS.warning, 0.3),
        bgcolor: hasAnswer ? 'white' : alpha(COLORS.warning, 0.03),
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        <Box
          sx={{
            width: 28,
            height: 28,
            borderRadius: 1,
            bgcolor: hasAnswer ? alpha(categoryConfig.color, 0.1) : COLORS.slate100,
            color: hasAnswer ? categoryConfig.color : COLORS.slate400,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {config.icon}
        </Box>
        <Box sx={{ flex: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
              Q{questionNumber}
            </Typography>
            <Chip
              label={categoryConfig.label}
              size="small"
              sx={{
                height: 16,
                fontSize: '0.6rem',
                fontWeight: 600,
                bgcolor: alpha(categoryConfig.color, 0.1),
                color: categoryConfig.color,
              }}
            />
          </Stack>
          <Typography variant="body2" sx={{ color: COLORS.primary, fontWeight: 500, mb: 0.75 }}>
            {config.question}
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: hasAnswer ? COLORS.slate600 : COLORS.slate400,
              lineHeight: 1.6,
              fontStyle: hasAnswer ? 'normal' : 'italic',
            }}
          >
            {answer || 'Not enough information from transcript'}
          </Typography>
        </Box>
      </Stack>
    </Box>
  );
};

const TranscriptAnalysisInsight: React.FC<TranscriptAnalysisInsightProps> = ({ analysisData }) => {
  const [activeTab, setActiveTab] = useState(0);

  if (!analysisData) {
    return <Alert severity="info">Transcript analysis is not available for this meeting.</Alert>;
  }

  const parseScoreValue = (value: any): number | null => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const parsed = parseFloat(String(value).replace('%', '').trim());
    if (Number.isNaN(parsed)) return null;
    return parsed <= 1 ? parsed * 100 : parsed;
  };

  const rawAnalysis: TranscriptAnalysisResult | null = analysisData?.analysisResult
    ? typeof analysisData.analysisResult === 'string'
      ? JSON.parse(analysisData.analysisResult)
      : analysisData.analysisResult
    : null;

  // Extract all the data
  // Normalised accessor — data lives at rawAnalysis.data.* (snake_case) from the backend
  const d = (rawAnalysis as any)?.data || rawAnalysis || {};

  const opportunityScore =
    parseScoreValue(d?.opportunity_score ?? d?.OpportunityScore ?? d?.opportunityScore) ??
    (typeof analysisData?.opportunityScore === 'number' ? analysisData.opportunityScore : null);

  const successProbability =
    parseScoreValue(
      d?.success_probability != null
        ? d.success_probability > 1 ? d.success_probability : d.success_probability * 100
        : d?.SuccessProbability ?? d?.successProbability
    ) ?? (typeof analysisData?.successProbability === 'number' ? analysisData.successProbability : null);

  const rawSentiment = d?.sentiment || d?.overallSentiment || analysisData?.sentimentOverall;
  const sentimentForDisplay = typeof rawSentiment === 'object' ? rawSentiment?.overall : rawSentiment;
  const sentimentConfig = getSentimentConfig(sentimentForDisplay);

  const transcriptSummary =
    d?.executive_summary ||
    d?.transcriptSummary ||
    d?.summary ||
    d?.executiveSummary ||
    null;

  const callDetails = d?.callDetails || d?.call_details || null;

  const keyMoments: any[] = d?.key_moments || d?.keyMoments || [];

  const buyingSignals = normalizeList(d?.buying_signals || d?.buyingSignals);
  const painPoints = normalizeList(d?.pain_points || d?.painPoints);
  const nextSteps = normalizeList(d?.next_steps || d?.nextSteps);
  const riskFactors = normalizeList(d?.risk_factors || d?.riskFactors);

  const competitorMentions: any[] = d?.competitor_mentions || d?.competitorMentions || [];
  const opportunitiesDetected: any[] = d?.opportunities_detected || d?.opportunitiesDetected || [];
  const aiServicesOpportunities: any[] = d?.aiServicesOpportunities || [];
  const stakeholders: any[] = d?.stakeholders || [];
  const timelineBudget: any = d?.timeline_budget || d?.timelineBudget || null;
  const recommendedTeam: any[] = d?.recommended_team || d?.recommendedTeam || [];

  // Call Recap fields — new snake_case from expanded prompt
  const rawSpeakerBreakdown = d?.speaker_breakdown || d?.speakerBreakdown || null;
  const speakerBreakdown = rawSpeakerBreakdown
    ? {
        dominantSpeaker: rawSpeakerBreakdown.dominant_speaker || rawSpeakerBreakdown.dominantSpeaker,
        engagementLevel: rawSpeakerBreakdown.engagement_level || rawSpeakerBreakdown.engagementLevel,
        speakers: (rawSpeakerBreakdown.speakers || []).map((s: any) => ({
          name: s.name,
          role: s.role,
          title: s.title,
          talkTimePercent: s.talk_time_percent || s.talkTimePercent,
          sentiment: s.sentiment,
          summary: s.summary || '',
          keyContributions: s.key_contributions || s.keyContributions || [],
          notable_quotes: s.notable_quotes || s.notableQuotes || [],
        })),
      }
    : null;

  const conversationHighlights: any[] = d?.conversation_highlights || d?.conversationHighlights || [];

  const rawMainThemes: any[] = d?.main_themes || d?.mainThemes || [];
  const mainThemes = rawMainThemes.map((t: any) => ({
    theme: t.theme,
    description: t.description,
    time_spent: t.time_spent || t.timeSpent,
    key_takeaway: t.key_takeaway || t.keyTakeaway,
  }));

  const deadlinesAndDates: any[] = d?.deadlines_and_dates || d?.deadlinesAndDates || [];
  const callTimeline: any[] = d?.call_timeline || d?.callTimeline || [];
  const questionsAsked: any[] = d?.questions_asked || d?.questionsAsked || [];
  const commitmentsMade: any[] = d?.commitments_made || d?.commitmentsMade || [];

  // Sales Intelligence data from InternalKnowledge 3-query search
  const rawSalesIntel = d?.salesIntelligence || d?.sales_intelligence || null;
  const salesIntelData = rawSalesIntel
    ? {
        pastEngagements: rawSalesIntel.summary || '',
        similarEngagements: rawSalesIntel.similarEngagements || rawSalesIntel.similar_engagements || [],
        relevantArtifacts: rawSalesIntel.relevantArtifacts || rawSalesIntel.relevant_artifacts || [],
        unknowns: rawSalesIntel.unknowns || [],
        rawSummary: rawSalesIntel.summary || '',
      }
    : null;
  const hasSalesIntel = salesIntelData && (
    (salesIntelData.similarEngagements?.length ?? 0) > 0 ||
    (salesIntelData.relevantArtifacts?.length ?? 0) > 0 ||
    !!salesIntelData.pastEngagements?.trim()
  );

  // Derive company name for InternalKnowledge panel
  const companyName =
    analysisData?.companyName ||
    analysisData?.company_name ||
    d?.companyName ||
    d?.company_name ||
    'this company';

  const parsePursuitBrief = (value: any) => {
    if (!value) return null;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    }
    return typeof value === 'object' ? value : null;
  };

  const pursuitBrief =
    parsePursuitBrief(rawAnalysis?.pursuitBrief) ||
    parsePursuitBrief(rawAnalysis?.data?.pursuitBrief) ||
    null;

  // Count answered pursuit brief questions
  const answeredQuestions = pursuitBrief
    ? Object.values(pursuitBrief).filter(
        (answer: any) => answer && !String(answer).includes('[Not enough information]')
      ).length
    : 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* Hero Metrics */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <MetricCard
          label="Opportunity Score"
          value={opportunityScore}
          suffix="/100"
          color={getScoreColor(opportunityScore)}
          icon={<TrendingUp fontSize="small" />}
          showProgress
        />
        <MetricCard
          label="Success Probability"
          value={successProbability}
          suffix="%"
          color={getScoreColor(successProbability)}
          icon={<Speed fontSize="small" />}
          showProgress
        />
        <Box
          sx={{
            p: 2.5,
            borderRadius: 2,
            border: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
            flex: 1,
            minWidth: 140,
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <Box sx={{ color: '#94a3b8', display: 'flex' }}>{sentimentConfig.icon}</Box>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.3 }}>
              Sentiment
            </Typography>
          </Stack>
          <Chip
            label={sentimentConfig.label}
            sx={{
              bgcolor: alpha(sentimentConfig.color, 0.1),
              color: sentimentConfig.color,
              fontWeight: 600,
              fontSize: '0.875rem',
            }}
          />
          {analysisData?.analyzedAt && (
            <Typography variant="caption" sx={{ color: '#94a3b8', mt: 1, display: 'block' }}>
              Analyzed {new Date(analysisData.analyzedAt).toLocaleDateString()}
            </Typography>
          )}
        </Box>
      </Stack>

      {/* Navigation Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.875rem',
              color: '#64748b',
              '&.Mui-selected': { color: COLORS.primary },
            },
            '& .MuiTabs-indicator': { bgcolor: 'primary.main' },
          }}
        >
          <Tab label="Call Recap" />
          <Tab label="Call Insights" />
          <Tab label={`Pursuit Brief (${answeredQuestions}/16)`} />
          <Tab label="Opportunities" />
          <Tab label="Next Steps" />
          <Tab label={hasSalesIntel ? `Sales Intelligence (${(salesIntelData?.similarEngagements?.length ?? 0) + (salesIntelData?.relevantArtifacts?.length ?? 0)})` : 'Sales Intelligence'} />
        </Tabs>
      </Box>

      {/* Tab 0: Call Recap */}
      {activeTab === 0 && (
        <Stack spacing={2}>
          {/* Executive Summary */}
          {transcriptSummary && (
            <SectionCard title="Executive Summary" icon={<Description fontSize="small" />} color={COLORS.info}>
              <Typography variant="body2" sx={{ color: COLORS.slate600, lineHeight: 1.8 }}>
                {transcriptSummary}
              </Typography>
            </SectionCard>
          )}

          {/* Call Timeline */}
          {callTimeline.length > 0 && (
            <SectionCard title="Call Timeline" icon={<Timeline fontSize="small" />} badge={callTimeline.length} color={COLORS.info}>
              <Stack spacing={0}>
                {callTimeline.map((section: any, i: number) => (
                  <Box key={i} sx={{ display: 'flex', gap: 2 }}>
                    {/* Timeline spine */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 32, flexShrink: 0 }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: COLORS.info, mt: 1.5, flexShrink: 0, border: '2px solid white', boxShadow: `0 0 0 2px ${alpha(COLORS.info, 0.3)}` }} />
                      {i < callTimeline.length - 1 && <Box sx={{ width: 2, flex: 1, bgcolor: COLORS.slate200, my: 0.5 }} />}
                    </Box>
                    <Box sx={{ flex: 1, pb: i < callTimeline.length - 1 ? 2 : 0 }}>
                      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 0.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: COLORS.primary }}>
                          {section.section}
                        </Typography>
                        {section.timestamp_range && (
                          <Typography variant="caption" sx={{ color: '#94a3b8', fontFamily: 'monospace' }}>
                            {section.timestamp_range}
                          </Typography>
                        )}
                        {section.speakers_active?.length > 0 && (
                          <Stack direction="row" spacing={0.5}>
                            {section.speakers_active.slice(0, 3).map((name: string, j: number) => (
                              <Chip key={j} label={name.split(' ')[0]} size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: COLORS.slate100, color: COLORS.slate600 }} />
                            ))}
                          </Stack>
                        )}
                      </Stack>
                      <Typography variant="body2" sx={{ color: COLORS.slate600, lineHeight: 1.7, mb: section.key_moment ? 1 : 0 }}>
                        {section.summary}
                      </Typography>
                      {section.key_moment && (
                        <Box sx={{ mt: 1, p: 1.5, borderRadius: 1, bgcolor: alpha(COLORS.info, 0.05), borderLeft: '3px solid', borderColor: COLORS.info }}>
                          <Typography variant="caption" sx={{ color: COLORS.info, fontWeight: 600, display: 'block', mb: 0.25 }}>Key moment</Typography>
                          <Typography variant="body2" sx={{ color: COLORS.slate600 }}>{section.key_moment}</Typography>
                        </Box>
                      )}
                    </Box>
                  </Box>
                ))}
              </Stack>
            </SectionCard>
          )}

          {/* Speaker Breakdown */}
          {speakerBreakdown && speakerBreakdown.speakers?.length > 0 && (
            <SectionCard title="Participant Breakdown" icon={<PieChart fontSize="small" />} badge={speakerBreakdown.speakers.length} color={COLORS.purple}>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                {speakerBreakdown.dominantSpeaker && (
                  <Typography variant="body2" sx={{ color: '#64748b' }}>
                    Most active: <strong style={{ color: COLORS.primary }}>{speakerBreakdown.dominantSpeaker}</strong>
                  </Typography>
                )}
                {speakerBreakdown.engagementLevel && (
                  <Chip label={`${speakerBreakdown.engagementLevel} engagement`} size="small" sx={{
                    bgcolor: speakerBreakdown.engagementLevel === 'high' ? alpha(COLORS.success, 0.1) : speakerBreakdown.engagementLevel === 'medium' ? alpha(COLORS.warning, 0.1) : alpha(COLORS.slate400, 0.1),
                    color: speakerBreakdown.engagementLevel === 'high' ? COLORS.success : speakerBreakdown.engagementLevel === 'medium' ? COLORS.warning : COLORS.slate500,
                    fontWeight: 600, textTransform: 'capitalize',
                  }} />
                )}
              </Stack>
              <Stack spacing={2}>
                {speakerBreakdown.speakers.map((speaker: any, i: number) => (
                  <Box key={i} sx={{ p: 2, borderRadius: 1.5, border: 1, borderColor: speaker.role === 'client' ? alpha(COLORS.info, 0.25) : alpha(COLORS.success, 0.25), bgcolor: speaker.role === 'client' ? alpha(COLORS.info, 0.02) : alpha(COLORS.success, 0.02) }}>
                    <Stack direction="row" spacing={1.5} alignItems="flex-start">
                      <Avatar sx={{ width: 40, height: 40, bgcolor: speaker.role === 'client' ? alpha(COLORS.info, 0.15) : alpha(COLORS.success, 0.15), color: speaker.role === 'client' ? COLORS.info : COLORS.success, fontSize: '1rem', flexShrink: 0 }}>
                        {(speaker.name || 'S').charAt(0)}
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5, flexWrap: 'wrap' }}>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: COLORS.primary }}>{speaker.name}</Typography>
                          {speaker.title && <Typography variant="caption" sx={{ color: '#64748b' }}>{speaker.title}</Typography>}
                          <Chip label={speaker.role || 'unknown'} size="small" sx={{ height: 18, fontSize: '0.6rem', textTransform: 'capitalize', bgcolor: speaker.role === 'client' ? alpha(COLORS.info, 0.1) : alpha(COLORS.success, 0.1), color: speaker.role === 'client' ? COLORS.info : COLORS.success }} />
                          {speaker.talkTimePercent && <Chip label={`~${speaker.talkTimePercent}`} size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: COLORS.slate100, color: COLORS.slate600 }} />}
                          {speaker.sentiment && (
                            <Chip icon={speaker.sentiment === 'positive' ? <ThumbUp sx={{ fontSize: 10 }} /> : speaker.sentiment === 'negative' ? <ThumbDown sx={{ fontSize: 10 }} /> : <Remove sx={{ fontSize: 10 }} />}
                              label={speaker.sentiment} size="small" sx={{ height: 18, fontSize: '0.6rem', textTransform: 'capitalize', bgcolor: speaker.sentiment === 'positive' ? alpha(COLORS.success, 0.1) : speaker.sentiment === 'negative' ? alpha(COLORS.error, 0.1) : alpha(COLORS.slate400, 0.1), color: speaker.sentiment === 'positive' ? COLORS.success : speaker.sentiment === 'negative' ? COLORS.error : COLORS.slate500 }} />
                          )}
                        </Stack>
                        {speaker.summary && (
                          <Typography variant="body2" sx={{ color: COLORS.slate600, lineHeight: 1.7, mb: 1.5 }}>{speaker.summary}</Typography>
                        )}
                        {speaker.keyContributions?.length > 0 && (
                          <Box sx={{ mb: speaker.notable_quotes?.length > 0 ? 1.5 : 0 }}>
                            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, mb: 0.5, display: 'block', textTransform: 'uppercase', letterSpacing: 0.3 }}>Key Points</Typography>
                            <Stack spacing={0.5}>
                              {speaker.keyContributions.map((c: string, j: number) => (
                                <Typography key={j} variant="caption" sx={{ color: COLORS.slate600, display: 'flex', alignItems: 'flex-start', gap: 0.75, lineHeight: 1.6 }}>
                                  <Box component="span" sx={{ color: speaker.role === 'client' ? COLORS.info : COLORS.success, fontWeight: 700, flexShrink: 0, mt: 0.1 }}>›</Box>
                                  {c}
                                </Typography>
                              ))}
                            </Stack>
                          </Box>
                        )}
                        {speaker.notable_quotes?.length > 0 && (
                          <Box>
                            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, mb: 0.5, display: 'block', textTransform: 'uppercase', letterSpacing: 0.3 }}>Notable Quote</Typography>
                            {speaker.notable_quotes.slice(0, 1).map((q: string, j: number) => (
                              <Typography key={j} variant="body2" sx={{ color: COLORS.slate500, fontStyle: 'italic', pl: 1.5, borderLeft: '2px solid', borderColor: speaker.role === 'client' ? alpha(COLORS.info, 0.4) : alpha(COLORS.success, 0.4) }}>
                                "{q}"
                              </Typography>
                            ))}
                          </Box>
                        )}
                      </Box>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </SectionCard>
          )}

          {/* Key Quotes & Highlights */}
          {conversationHighlights.length > 0 && (
            <SectionCard title="Key Quotes & Highlights" icon={<FormatQuote fontSize="small" />} badge={conversationHighlights.length} color={COLORS.info}>
              <Stack spacing={1.5}>
                {conversationHighlights.map((highlight: any, i: number) => (
                  <Box key={i} sx={{ p: 2, borderRadius: 1.5, bgcolor: highlight.role === 'client' ? alpha(COLORS.info, 0.03) : alpha(COLORS.success, 0.03), borderLeft: '4px solid', borderColor: highlight.role === 'client' ? COLORS.info : COLORS.success }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1, flexWrap: 'wrap' }}>
                      <RecordVoiceOver sx={{ fontSize: 15, color: highlight.role === 'client' ? COLORS.info : COLORS.success }} />
                      <Typography variant="body2" sx={{ fontWeight: 700, color: COLORS.primary }}>{highlight.speaker}</Typography>
                      <Chip label={highlight.role || 'unknown'} size="small" sx={{ height: 18, fontSize: '0.6rem', textTransform: 'capitalize', bgcolor: highlight.role === 'client' ? alpha(COLORS.info, 0.1) : alpha(COLORS.success, 0.1), color: highlight.role === 'client' ? COLORS.info : COLORS.success }} />
                      {highlight.timestamp && <Typography variant="caption" sx={{ color: '#94a3b8', fontFamily: 'monospace' }}>{highlight.timestamp}</Typography>}
                    </Stack>
                    <Typography variant="body2" sx={{ color: COLORS.slate600, fontStyle: 'italic', pl: 2, borderLeft: '2px solid', borderColor: 'divider', mb: 1, lineHeight: 1.7 }}>
                      "{highlight.quote}"
                    </Typography>
                    {highlight.context && (
                      <Box sx={{ mt: 1, p: 1, borderRadius: 0.75, bgcolor: alpha(COLORS.warning, 0.04) }}>
                        <Typography variant="caption" sx={{ color: '#64748b' }}>
                          <strong style={{ color: COLORS.warning }}>Why it matters: </strong>{highlight.context}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                ))}
              </Stack>
            </SectionCard>
          )}

          {/* Questions Asked */}
          {questionsAsked.length > 0 && (
            <SectionCard title="Questions Asked" icon={<EmojiObjects fontSize="small" />} badge={questionsAsked.length} color={COLORS.purple} defaultExpanded={false}>
              <Stack spacing={1}>
                {questionsAsked.map((q: any, i: number) => (
                  <Box key={i} sx={{ p: 1.5, borderRadius: 1.5, border: 1, borderColor: 'divider', bgcolor: q.answered ? 'white' : alpha(COLORS.warning, 0.03) }}>
                    <Stack direction="row" spacing={1} alignItems="flex-start">
                      <Box sx={{ width: 22, height: 22, borderRadius: '50%', bgcolor: q.asked_by_role === 'client' ? alpha(COLORS.info, 0.15) : alpha(COLORS.success, 0.15), color: q.asked_by_role === 'client' ? COLORS.info : COLORS.success, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, flexShrink: 0 }}>
                        Q
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                          <Typography variant="caption" sx={{ fontWeight: 600, color: COLORS.primary }}>{q.asked_by}</Typography>
                          <Chip label={q.asked_by_role || 'unknown'} size="small" sx={{ height: 16, fontSize: '0.6rem', textTransform: 'capitalize', bgcolor: q.asked_by_role === 'client' ? alpha(COLORS.info, 0.1) : alpha(COLORS.success, 0.1), color: q.asked_by_role === 'client' ? COLORS.info : COLORS.success }} />
                          <Chip label={q.answered ? 'Answered' : 'Unanswered'} size="small" sx={{ height: 16, fontSize: '0.6rem', bgcolor: q.answered ? alpha(COLORS.success, 0.1) : alpha(COLORS.warning, 0.15), color: q.answered ? COLORS.success : COLORS.warning }} />
                        </Stack>
                        <Typography variant="body2" sx={{ color: COLORS.slate600, fontStyle: 'italic', mb: q.answer_summary ? 0.75 : 0 }}>"{q.question}"</Typography>
                        {q.answer_summary && (
                          <Typography variant="caption" sx={{ color: '#64748b' }}>
                            <strong>Answer: </strong>{q.answer_summary}
                          </Typography>
                        )}
                      </Box>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </SectionCard>
          )}

          {/* Commitments Made */}
          {commitmentsMade.length > 0 && (
            <SectionCard title="Commitments Made" icon={<CheckCircle fontSize="small" />} badge={commitmentsMade.length} color={COLORS.success}>
              <Stack spacing={1}>
                {commitmentsMade.map((c: any, i: number) => (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, p: 1.5, borderRadius: 1, bgcolor: alpha(COLORS.success, 0.04), borderLeft: '3px solid', borderColor: COLORS.success }}>
                    <CheckCircle sx={{ fontSize: 16, color: COLORS.success, mt: 0.25, flexShrink: 0 }} />
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" sx={{ color: COLORS.primary, fontWeight: 500 }}>{c.commitment}</Typography>
                      <Stack direction="row" spacing={2} sx={{ mt: 0.5 }}>
                        {c.committed_by && <Typography variant="caption" sx={{ color: '#94a3b8' }}>By: <span style={{ fontWeight: 500, color: COLORS.slate600 }}>{c.committed_by}</span></Typography>}
                        {c.timeline && <Typography variant="caption" sx={{ color: '#94a3b8' }}>When: <span style={{ fontWeight: 500, color: COLORS.slate600 }}>{c.timeline}</span></Typography>}
                        {c.type && <Chip label={c.type.replace('_', ' ')} size="small" sx={{ height: 16, fontSize: '0.6rem', textTransform: 'capitalize', bgcolor: alpha(COLORS.success, 0.1), color: COLORS.success }} />}
                      </Stack>
                    </Box>
                  </Box>
                ))}
              </Stack>
            </SectionCard>
          )}

          {/* Main Themes */}
          {mainThemes.length > 0 && (
            <SectionCard title="Main Themes Discussed" icon={<Topic fontSize="small" />} badge={mainThemes.length} color={COLORS.purple} defaultExpanded={false}>
              <Stack spacing={1.5}>
                {mainThemes.map((theme: any, i: number) => (
                  <Box key={i} sx={{ p: 2, borderRadius: 1.5, border: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box sx={{ width: 26, height: 26, borderRadius: 1, bgcolor: alpha(COLORS.purple, 0.1), color: COLORS.purple, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.75rem' }}>{i + 1}</Box>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: COLORS.primary }}>{theme.theme}</Typography>
                      </Stack>
                      {theme.time_spent && (
                        <Chip label={`${theme.time_spent} focus`} size="small" sx={{ height: 18, fontSize: '0.6rem', textTransform: 'capitalize', bgcolor: theme.time_spent === 'high' ? alpha(COLORS.purple, 0.15) : theme.time_spent === 'medium' ? alpha(COLORS.purple, 0.1) : alpha(COLORS.slate400, 0.1), color: theme.time_spent === 'high' || theme.time_spent === 'medium' ? COLORS.purple : COLORS.slate500 }} />
                      )}
                    </Stack>
                    {theme.description && <Typography variant="body2" sx={{ color: COLORS.slate600, mb: 1, lineHeight: 1.7 }}>{theme.description}</Typography>}
                    {theme.key_takeaway && (
                      <Box sx={{ p: 1.25, borderRadius: 1, bgcolor: alpha(COLORS.success, 0.05) }}>
                        <Typography variant="caption" sx={{ color: COLORS.success, fontWeight: 600 }}>Takeaway: </Typography>
                        <Typography variant="caption" sx={{ color: COLORS.slate600 }}>{theme.key_takeaway}</Typography>
                      </Box>
                    )}
                  </Box>
                ))}
              </Stack>
            </SectionCard>
          )}

          {/* Deadlines */}
          {deadlinesAndDates.length > 0 && (
            <SectionCard title="Deadlines & Important Dates" icon={<Event fontSize="small" />} badge={deadlinesAndDates.length} color={COLORS.error}>
              <Stack spacing={1}>
                {deadlinesAndDates.map((deadline: any, i: number) => (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, p: 1.5, borderRadius: 1, bgcolor: deadline.importance === 'critical' ? alpha(COLORS.error, 0.05) : deadline.importance === 'high' ? alpha(COLORS.warning, 0.05) : COLORS.slate50, borderLeft: '3px solid', borderColor: deadline.importance === 'critical' ? COLORS.error : deadline.importance === 'high' ? COLORS.warning : COLORS.info }}>
                    <Box sx={{ p: 1, borderRadius: 1, bgcolor: 'background.paper', border: 1, borderColor: 'divider', minWidth: 80, textAlign: 'center', flexShrink: 0 }}>
                      <Schedule sx={{ fontSize: 15, color: COLORS.info, display: 'block', mx: 'auto', mb: 0.25 }} />
                      <Typography variant="caption" sx={{ fontWeight: 700, color: COLORS.primary, display: 'block', fontSize: '0.7rem' }}>{deadline.date}</Typography>
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 500, color: COLORS.primary }}>{deadline.description}</Typography>
                        {deadline.importance && <Chip label={deadline.importance} size="small" sx={{ height: 16, fontSize: '0.6rem', textTransform: 'capitalize', bgcolor: deadline.importance === 'critical' ? alpha(COLORS.error, 0.1) : deadline.importance === 'high' ? alpha(COLORS.warning, 0.1) : alpha(COLORS.info, 0.1), color: deadline.importance === 'critical' ? COLORS.error : deadline.importance === 'high' ? COLORS.warning : COLORS.info }} />}
                      </Stack>
                      <Stack direction="row" spacing={2}>
                        {deadline.type && <Typography variant="caption" sx={{ color: '#94a3b8' }}>Type: <span style={{ fontWeight: 500, textTransform: 'capitalize' }}>{deadline.type.replace('_', ' ')}</span></Typography>}
                        {deadline.owner && <Typography variant="caption" sx={{ color: '#94a3b8' }}>Owner: <span style={{ fontWeight: 500 }}>{deadline.owner}</span></Typography>}
                      </Stack>
                    </Box>
                  </Box>
                ))}
              </Stack>
            </SectionCard>
          )}

          {!transcriptSummary && callTimeline.length === 0 && conversationHighlights.length === 0 && !speakerBreakdown && (
            <Alert severity="info">Call recap data is not available. Re-run the analysis to generate detailed call summaries, timelines, and highlights.</Alert>
          )}
        </Stack>
      )}

      {/* Tab 1: Call Insights */}
      {activeTab === 1 && (
        <Stack spacing={2}>
          {/* Call Details */}
          {callDetails && (
            <SectionCard title="Call Details" icon={<Schedule fontSize="small" />} color={COLORS.slate500}>
              <Grid container spacing={2}>
                {callDetails.callID && (
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Typography variant="caption" sx={{ color: '#94a3b8' }}>Call ID</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>{callDetails.callID}</Typography>
                  </Grid>
                )}
                {callDetails.date && (
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Typography variant="caption" sx={{ color: '#94a3b8' }}>Date</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>{callDetails.date}</Typography>
                  </Grid>
                )}
                {callDetails.duration && (
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Typography variant="caption" sx={{ color: '#94a3b8' }}>Duration</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>{callDetails.duration}</Typography>
                  </Grid>
                )}
                {callDetails.participants?.length > 0 && (
                  <Grid size={12}>
                    <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mb: 0.5 }}>Participants</Typography>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                      {callDetails.participants.map((p: string, i: number) => (
                        <Chip key={i} label={p} size="small" variant="outlined" sx={{ fontSize: '0.75rem' }} />
                      ))}
                    </Stack>
                  </Grid>
                )}
              </Grid>
            </SectionCard>
          )}

          {/* Key Signals Grid */}
          <Grid container spacing={2}>
            {/* Buying Signals */}
            {buyingSignals.length > 0 && (
              <Grid size={{ xs: 12, md: 6 }}>
                <SectionCard
                  title="Buying Signals"
                  icon={<ThumbUp fontSize="small" />}
                  badge={buyingSignals.length}
                  color={COLORS.success}
                >
                  <Stack spacing={1}>
                    {buyingSignals.map((signal, i) => (
                      <Box
                        key={i}
                        sx={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 1.5,
                          p: 1.5,
                          borderRadius: 1,
                          bgcolor: alpha(COLORS.success, 0.05),
                          borderLeft: '3px solid',
                          borderColor: COLORS.success,
                        }}
                      >
                        <CheckCircle sx={{ fontSize: 16, color: COLORS.success, mt: 0.25 }} />
                        <Typography variant="body2" sx={{ color: COLORS.slate600 }}>{signal}</Typography>
                      </Box>
                    ))}
                  </Stack>
                </SectionCard>
              </Grid>
            )}

            {/* Pain Points */}
            {painPoints.length > 0 && (
              <Grid size={{ xs: 12, md: 6 }}>
                <SectionCard
                  title="Pain Points"
                  icon={<Warning fontSize="small" />}
                  badge={painPoints.length}
                  color={COLORS.warning}
                >
                  <Stack spacing={1}>
                    {painPoints.map((point, i) => (
                      <Box
                        key={i}
                        sx={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 1.5,
                          p: 1.5,
                          borderRadius: 1,
                          bgcolor: alpha(COLORS.warning, 0.05),
                          borderLeft: '3px solid',
                          borderColor: COLORS.warning,
                        }}
                      >
                        <Warning sx={{ fontSize: 16, color: COLORS.warning, mt: 0.25 }} />
                        <Typography variant="body2" sx={{ color: COLORS.slate600 }}>{point}</Typography>
                      </Box>
                    ))}
                  </Stack>
                </SectionCard>
              </Grid>
            )}
          </Grid>

          {/* Risk Factors */}
          {riskFactors.length > 0 && (
            <SectionCard
              title="Risk Factors"
              icon={<ErrorOutline fontSize="small" />}
              badge={riskFactors.length}
              color={COLORS.error}
            >
              <Stack spacing={1}>
                {riskFactors.map((risk, i) => (
                  <Box
                    key={i}
                    sx={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 1.5,
                      p: 1.5,
                      borderRadius: 1,
                      bgcolor: alpha(COLORS.error, 0.03),
                    }}
                  >
                    <ErrorOutline sx={{ fontSize: 16, color: COLORS.error, mt: 0.25 }} />
                    <Typography variant="body2" sx={{ color: COLORS.slate600 }}>{risk}</Typography>
                  </Box>
                ))}
              </Stack>
            </SectionCard>
          )}

          {/* Stakeholders */}
          {stakeholders.length > 0 && (
            <SectionCard
              title="Stakeholders Identified"
              icon={<Groups fontSize="small" />}
              badge={stakeholders.length}
              color={COLORS.purple}
            >
              <Grid container spacing={1.5}>
                {stakeholders.map((s: any, i: number) => (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }} key={i}>
                    <Box
                      sx={{
                        p: 1.5,
                        borderRadius: 1.5,
                        border: 1,
                        borderColor: 'divider',
                        bgcolor: 'background.paper',
                      }}
                    >
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Avatar sx={{ width: 32, height: 32, bgcolor: alpha(COLORS.purple, 0.1), color: COLORS.purple, fontSize: '0.875rem' }}>
                          {(s.name || 'U').charAt(0)}
                        </Avatar>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: COLORS.primary }} noWrap>
                            {s.name || 'Unknown'}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#64748b' }} noWrap>
                            {s.role || s.title || 'Role unknown'}
                          </Typography>
                        </Box>
                      </Stack>
                      {s.influence && (
                        <Chip
                          label={`${s.influence} influence`}
                          size="small"
                          sx={{ mt: 1, fontSize: '0.65rem', height: 18 }}
                        />
                      )}
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </SectionCard>
          )}

          {/* Timeline & Budget */}
          {timelineBudget && (timelineBudget.timeline || timelineBudget.budget || timelineBudget.urgency) && (
            <SectionCard title="Timeline & Budget" icon={<AttachMoney fontSize="small" />} color={COLORS.info}>
              <Grid container spacing={3}>
                {timelineBudget.timeline && (
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <Typography variant="caption" sx={{ color: '#94a3b8' }}>Timeline</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500, color: COLORS.primary }}>{timelineBudget.timeline}</Typography>
                  </Grid>
                )}
                {timelineBudget.budget && (
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <Typography variant="caption" sx={{ color: '#94a3b8' }}>Budget</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500, color: COLORS.primary }}>{timelineBudget.budget}</Typography>
                  </Grid>
                )}
                {timelineBudget.urgency && (
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <Typography variant="caption" sx={{ color: '#94a3b8' }}>Urgency</Typography>
                    <Chip
                      label={timelineBudget.urgency}
                      size="small"
                      sx={{
                        bgcolor: timelineBudget.urgency.toLowerCase().includes('high')
                          ? alpha(COLORS.error, 0.1)
                          : alpha(COLORS.info, 0.1),
                        color: timelineBudget.urgency.toLowerCase().includes('high')
                          ? COLORS.error
                          : COLORS.info,
                        fontWeight: 600,
                      }}
                    />
                  </Grid>
                )}
              </Grid>
            </SectionCard>
          )}

          {/* Competitor Mentions */}
          {competitorMentions.length > 0 && (
            <SectionCard
              title="Competitor Mentions"
              icon={<Business fontSize="small" />}
              badge={competitorMentions.length}
              color={COLORS.warning}
            >
              <Stack spacing={1}>
                {competitorMentions.map((m: any, i: number) => (
                  <Box
                    key={i}
                    sx={{
                      p: 1.5,
                      borderRadius: 1,
                      bgcolor: alpha(COLORS.warning, 0.05),
                      borderLeft: '3px solid',
                      borderColor: COLORS.warning,
                    }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                      <Chip label={m.competitor} size="small" sx={{ fontWeight: 600, bgcolor: alpha(COLORS.warning, 0.15) }} />
                      {m.timestamp && <Typography variant="caption" sx={{ color: '#94a3b8' }}>{m.timestamp}</Typography>}
                    </Stack>
                    {m.context && <Typography variant="body2" sx={{ color: COLORS.slate600 }}>{m.context}</Typography>}
                  </Box>
                ))}
              </Stack>
            </SectionCard>
          )}

          {/* Key Moments */}
          {keyMoments.length > 0 && (
            <SectionCard
              title="Key Moments"
              icon={<Timeline fontSize="small" />}
              badge={keyMoments.length}
              color={COLORS.info}
              defaultExpanded={false}
            >
              <Stack spacing={1.5}>
                {keyMoments.map((m: any, i: number) => (
                  <Box
                    key={i}
                    sx={{
                      p: 2,
                      borderRadius: 1.5,
                      border: 1,
                      borderColor: 'divider',
                      bgcolor: 'background.default',
                    }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                      {m.timestamp && (
                        <Chip label={m.timestamp} size="small" sx={{ fontWeight: 600, bgcolor: alpha(COLORS.info, 0.1), color: COLORS.info }} />
                      )}
                      {m.speaker && <Typography variant="body2" sx={{ fontWeight: 600 }}>{m.speaker}</Typography>}
                      {m.type && (
                        <Chip
                          label={m.type}
                          size="small"
                          variant="outlined"
                          sx={{
                            fontSize: '0.65rem',
                            height: 18,
                            borderColor: m.type.toLowerCase() === 'objection' ? COLORS.error : COLORS.slate300,
                            color: m.type.toLowerCase() === 'objection' ? COLORS.error : COLORS.slate500,
                          }}
                        />
                      )}
                    </Stack>
                    <Typography variant="body2" sx={{ color: COLORS.slate600 }}>{m.description}</Typography>
                    {m.responseStrategy && (
                      <Typography variant="caption" sx={{ color: COLORS.success, mt: 0.5, display: 'block' }}>
                        Response: {m.responseStrategy}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Stack>
            </SectionCard>
          )}
        </Stack>
      )}

      {/* Tab 2: Pursuit Brief */}
      {activeTab === 2 && (
        <Stack spacing={2}>
          {pursuitBrief ? (
            <>
              <Box sx={{ p: 2, borderRadius: 1.5, bgcolor: alpha(COLORS.info, 0.05), borderColor: alpha(COLORS.info, 0.2) }}>
                <Typography variant="body2" sx={{ color: COLORS.slate600 }}>
                  {answeredQuestions} of 16 questions answered from transcript analysis. Questions without enough context are marked for follow-up.
                </Typography>
              </Box>

              <Grid container spacing={2}>
                {Object.entries(pursuitBriefQuestions).map(([num, config]) => (
                  <Grid size={{ xs: 12, md: 6 }} key={num}>
                    <PursuitBriefItem
                      questionNumber={num}
                      config={config}
                      answer={pursuitBrief[num]}
                    />
                  </Grid>
                ))}
              </Grid>
            </>
          ) : (
            <Alert severity="info">
              Pursuit brief data is not available. Re-run the analysis to generate pursuit brief answers.
            </Alert>
          )}
        </Stack>
      )}

      {/* Tab 3: Opportunities */}
      {activeTab === 3 && (
        <Stack spacing={2}>
          {/* AI Services Opportunities */}
          {aiServicesOpportunities.length > 0 && (
            <SectionCard
              title="AI Services Opportunities"
              icon={<Psychology fontSize="small" />}
              badge={aiServicesOpportunities.filter((o: any) => o.detected).length}
              color={COLORS.purple}
            >
              <Stack spacing={2}>
                {aiServicesOpportunities.filter((o: any) => o.detected).map((opp: any, i: number) => (
                  <Box
                    key={i}
                    sx={{
                      p: 2,
                      borderRadius: 1.5,
                      border: 1,
                      borderColor: alpha(COLORS.purple, 0.3),
                      bgcolor: alpha(COLORS.purple, 0.03),
                    }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                      <Chip
                        label={opp.service}
                        sx={{ fontWeight: 600, bgcolor: alpha(COLORS.purple, 0.1), color: COLORS.purple }}
                      />
                      {opp.confidence && (
                        <Chip label={`${opp.confidence} confidence`} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                      )}
                    </Stack>
                    {opp.signals?.length > 0 && (
                      <Box sx={{ mb: 1.5 }}>
                        <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>Signals Detected</Typography>
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                          {opp.signals.map((s: string, j: number) => (
                            <Chip key={j} label={s} size="small" sx={{ fontSize: '0.7rem', height: 22 }} />
                          ))}
                        </Stack>
                      </Box>
                    )}
                    {opp.recommendedActions?.length > 0 && (
                      <Box>
                        <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>Recommended Actions</Typography>
                        <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                          {opp.recommendedActions.map((a: string, j: number) => (
                            <Typography key={j} variant="body2" sx={{ color: COLORS.slate600, display: 'flex', alignItems: 'flex-start', gap: 0.75 }}>
                              <ArrowForward sx={{ fontSize: 14, mt: 0.25, color: COLORS.success }} />
                              {a}
                            </Typography>
                          ))}
                        </Stack>
                      </Box>
                    )}
                  </Box>
                ))}
              </Stack>
            </SectionCard>
          )}

          {/* General Opportunities */}
          {opportunitiesDetected.length > 0 && (
            <SectionCard
              title="Opportunities Detected"
              icon={<Lightbulb fontSize="small" />}
              badge={opportunitiesDetected.length}
              color={COLORS.success}
            >
              <Stack spacing={1.5}>
                {opportunitiesDetected.map((opp: any, i: number) => (
                  <Box
                    key={i}
                    sx={{
                      p: 2,
                      borderRadius: 1.5,
                      border: 1,
                      borderColor: 'divider',
                      bgcolor: 'background.paper',
                    }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: COLORS.primary }}>
                        {opp.title || opp.description?.substring(0, 50) || `Opportunity ${i + 1}`}
                      </Typography>
                      {opp.confidence && (
                        <Chip
                          label={`${opp.confidence} confidence`}
                          size="small"
                          sx={{ bgcolor: alpha(COLORS.success, 0.1), color: COLORS.success, fontWeight: 600, fontSize: '0.7rem' }}
                        />
                      )}
                    </Stack>
                    {opp.description && (
                      <Typography variant="body2" sx={{ color: COLORS.slate600, mb: 1 }}>{opp.description}</Typography>
                    )}
                    <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                      {opp.relatedSegment && (
                        <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                          Segment: <span style={{ fontWeight: 500 }}>{opp.relatedSegment}</span>
                        </Typography>
                      )}
                      {opp.similarCaseStudy && (
                        <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                          Case Study: <span style={{ fontWeight: 500 }}>{opp.similarCaseStudy}</span>
                        </Typography>
                      )}
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </SectionCard>
          )}

          {opportunitiesDetected.length === 0 && aiServicesOpportunities.length === 0 && (
            <Alert severity="info">No specific opportunities were detected in this call.</Alert>
          )}
        </Stack>
      )}

      {/* Tab 4: Next Steps */}
      {activeTab === 4 && (
        <Stack spacing={2}>
          {/* Next Steps */}
          {nextSteps.length > 0 && (
            <SectionCard title="Recommended Next Steps" icon={<ArrowForward fontSize="small" />} color={COLORS.success}>
              <Stack spacing={1}>
                {nextSteps.map((step, i) => (
                  <Box
                    key={i}
                    sx={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 1.5,
                      p: 1.5,
                      borderRadius: 1,
                      bgcolor: alpha(COLORS.success, 0.05),
                      borderLeft: '3px solid',
                      borderColor: COLORS.success,
                    }}
                  >
                    <Box
                      sx={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        bgcolor: COLORS.success,
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        flexShrink: 0,
                      }}
                    >
                      {i + 1}
                    </Box>
                    <Typography variant="body2" sx={{ color: COLORS.slate600 }}>{step}</Typography>
                  </Box>
                ))}
              </Stack>
            </SectionCard>
          )}

          {/* Recommended Team */}
          {recommendedTeam.length > 0 && (
            <SectionCard
              title="Recommended Team"
              icon={<Groups fontSize="small" />}
              badge={recommendedTeam.length}
              color={COLORS.purple}
            >
              <Grid container spacing={1.5}>
                {recommendedTeam.map((member: any, i: number) => (
                  <Grid size={{ xs: 12, sm: 6 }} key={i}>
                    <Box
                      sx={{
                        p: 2,
                        borderRadius: 1.5,
                        border: 1,
                        borderColor: 'divider',
                        bgcolor: 'background.paper',
                      }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                        <Avatar sx={{ width: 28, height: 28, bgcolor: alpha(COLORS.purple, 0.1), color: COLORS.purple, fontSize: '0.75rem' }}>
                          {(member.role || 'T').charAt(0)}
                        </Avatar>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: COLORS.primary }}>{member.role}</Typography>
                        {member.priority && (
                          <Chip
                            label={member.priority}
                            size="small"
                            sx={{
                              height: 18,
                              fontSize: '0.6rem',
                              bgcolor: member.priority.toLowerCase() === 'high'
                                ? alpha(COLORS.error, 0.1)
                                : alpha(COLORS.info, 0.1),
                              color: member.priority.toLowerCase() === 'high'
                                ? COLORS.error
                                : COLORS.info,
                            }}
                          />
                        )}
                      </Stack>
                      {member.reason && (
                        <Typography variant="caption" sx={{ color: '#64748b' }}>{member.reason}</Typography>
                      )}
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </SectionCard>
          )}

          {nextSteps.length === 0 && recommendedTeam.length === 0 && (
            <Alert severity="info">No specific next steps were identified from this call.</Alert>
          )}
        </Stack>
      )}

      {/* Tab 5: Sales Intelligence */}
      {activeTab === 5 && (
        <Box sx={{ pt: 2 }}>
          {hasSalesIntel && salesIntelData ? (
            <InternalKbInsightsPanel
              companyName={companyName}
              data={salesIntelData}
              showRawSummary={true}
            />
          ) : (
            <Alert severity="info">
              Sales Intelligence data was not available for this analysis. Run a new analysis to include Northstar Integrators knowledge base search results.
            </Alert>
          )}
        </Box>
      )}
    </Box>
  );
};

export default TranscriptAnalysisInsight;
