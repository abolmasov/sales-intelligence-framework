import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Chip,
  LinearProgress,
  Card,
  CardContent,
  Stack,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Close as CloseIcon,
  TrendingUp,
  CheckCircle,
  Warning,
  Lightbulb,
  ArrowForward,
  Business,
  Assignment,
} from '@mui/icons-material';
import { apiGet, apiPost } from '../utils/api';
import type { TranscriptAnalysisResult } from '../../../shared/types';

const pursuitBriefQuestions: Record<string, string> = {
  '1': 'Who is the buyer and who are the key stakeholders? Include sponsor, decision-maker, influencers, and end users.',
  '2': 'What business problem is the client trying to solve? Summarize the pain point in business—not just technical terms.',
  '3': 'What are the client’s goals and desired outcomes? How will the client measure success?',
  '4': 'Why now? What is driving urgency or budget availability?',
  '5': 'What challenges will make this problem hard to solve?',
  '6': 'What does the client seek in a partner?',
  '7': 'What is the procurement process and evaluation criteria?',
  '8': 'Who are our likely competitors and what will they emphasize?',
  '9': 'Why would the client choose us?',
  '10': 'Why might the client not choose us?',
  '11': 'What is our vision for the client’s future state, and what will success look like?',
  '12': 'What are the core elements of our solution and how does it make the vision real?',
  '13': 'What assumptions are we making in our solution design?',
  '14': 'What are our win themes?',
  '15': 'What is our pitch storyline?',
  '16': 'What compelling demos, stories, or artifacts can we showcase?',
};

interface TranscriptAnalysisDialogProps {
  open: boolean;
  analysisId: string | null;
  onClose: () => void;
}

const TranscriptAnalysisDialog: React.FC<TranscriptAnalysisDialogProps> = ({
  open,
  analysisId,
  onClose,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [creatingDeal, setCreatingDeal] = useState(false);
  const [createDealError, setCreateDealError] = useState<string | null>(null);
  const [createDealSuccess, setCreateDealSuccess] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open && analysisId) {
      fetchAnalysis();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, analysisId]);

  const fetchAnalysis = async () => {
    if (!analysisId) return;

    setLoading(true);
    setError(null);
    try {
      const data = await apiGet(`/api/transcripts/${analysisId}`);
      console.log('📊 Transcript analysis response:', data);
      setAnalysisData(data.data);
    } catch (err: any) {
      console.error('❌ Error fetching analysis:', err);
      setError(err.message || 'Failed to load analysis');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDeal = async () => {
    if (!analysisData) return;
    setCreatingDeal(true);
    setCreateDealError(null);
    setCreateDealSuccess(null);

    try {
      const response = await apiPost('/api/deals', {
        opportunityName:
          analysisData.meetingTitle || `Deal from analysis ${analysisData.analysisId}`,
        companyName: analysisData.companyName || 'Prospect',
        stage: 'prospecting',
        notes: `Created from transcript analysis ${analysisData.analysisId}`,
      });

      const createdDeal = response?.data;
      setCreateDealSuccess(
        createdDeal?.opportunity_name
          ? `Deal "${createdDeal.opportunity_name}" created successfully.`
          : 'Deal created successfully.'
      );
      setAnalysisData((prev: any) =>
        prev
          ? {
              ...prev,
              dealId: createdDeal?.deal_id || prev.dealId,
            }
          : prev
      );
    } catch (err: any) {
      setCreateDealError(err.message || 'Failed to create deal');
    } finally {
      setCreatingDeal(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return '#10b981';
    if (score >= 40) return '#f59e0b';
    return '#ef4444';
  };

  const getSentimentColor = (sentiment: any) => {
    if (!sentiment) return '#f59e0b';
    const s = String(sentiment).toLowerCase();
    if (s.includes('positive')) return '#10b981';
    if (s.includes('negative')) return '#ef4444';
    return '#f59e0b';
  };

  const parseScoreValue = (value: any): number | null => {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }
    const parsed = parseFloat(String(value).replace('%', '').trim());
    if (Number.isNaN(parsed)) {
      return null;
    }
    return parsed <= 1 ? parsed * 100 : parsed;
  };

  const isAnalysisCompleted = analysisData?.status === 'completed';

  const rawAnalysis = isAnalysisCompleted && analysisData?.analysisResult
    ? (typeof analysisData.analysisResult === 'string'
        ? JSON.parse(analysisData.analysisResult)
        : analysisData.analysisResult)
    : null;

  // Helper function to convert ActionItems object to array format
  const normalizeActionItems = (actionItems: any) => {
    if (!actionItems) return null;
    if (Array.isArray(actionItems)) return actionItems;

    // If it's an object with owner keys (e.g., {SarahMitchell: "...", JohnDavis: "..."})
    if (typeof actionItems === 'object') {
      return Object.entries(actionItems).map(([owner, action]) => ({
        action: String(action),
        owner: owner
      }));
    }
    return null;
  };

  // Normalize the analysis data structure to handle PascalCase, snake_case, and camelCase
  const normalizedOpportunityScore =
    parseScoreValue(
      rawAnalysis?.OpportunityScore ??
        rawAnalysis?.opportunity_score ??
        rawAnalysis?.opportunityScore
    ) ?? (typeof analysisData?.opportunityScore === 'number' ? analysisData.opportunityScore : null);

  const normalizedSuccessProbability =
    parseScoreValue(
      rawAnalysis?.SuccessProbability ??
        rawAnalysis?.success_probability ??
        rawAnalysis?.successProbability
    ) ??
    (typeof analysisData?.successProbability === 'number'
      ? analysisData.successProbability
      : null);

  type EnhancedTranscriptAnalysis = TranscriptAnalysisResult & {
    opportunityScore: number;
    sentiment: any;
    successProbability: number | null;
    aiServicesOpportunities?: Array<{
      service: string;
      detected: boolean;
      confidence: string;
      signals: string[];
      relatedQuotes: string[];
      recommendedActions: string[];
    }>;
  };

  const analysis: EnhancedTranscriptAnalysis | null = rawAnalysis
    ? ({
        opportunityScore: normalizedOpportunityScore ?? 0,
        sentiment:
          rawAnalysis.SentimentAnalysis ||
          rawAnalysis.sentiment?.overall ||
          rawAnalysis.sentiment ||
          analysisData?.sentimentOverall,
        successProbability: normalizedSuccessProbability,
        executiveSummary:
          rawAnalysis.Summary ||
          rawAnalysis.executive_summary ||
          rawAnalysis.executiveSummary ||
          rawAnalysis.summary,
        buyingSignals: rawAnalysis.BuyingSignals || rawAnalysis.buying_signals || rawAnalysis.buyingSignals,
        painPoints: rawAnalysis.PainPoints || rawAnalysis.pain_points || rawAnalysis.painPoints,
        nextSteps: rawAnalysis.NextSteps || rawAnalysis.next_steps || rawAnalysis.nextSteps,
        recommendedProducts:
          rawAnalysis.RecommendedProducts || rawAnalysis.recommended_products || rawAnalysis.recommendedProducts,
        recommendedTeam: rawAnalysis.RecommendedTeam || rawAnalysis.recommended_team || rawAnalysis.recommendedTeam,
        riskFactors:
          rawAnalysis.RiskFactors || rawAnalysis.risk_factors || rawAnalysis.riskFactors || rawAnalysis.concerns,
        stakeholders: rawAnalysis.Stakeholders || rawAnalysis.stakeholders,
        timelineBudget: rawAnalysis.BudgetTimelineIndicators || rawAnalysis.timeline_budget || rawAnalysis.timelineBudget,
        keyPoints: rawAnalysis.KeyPoints || rawAnalysis.keyPoints || rawAnalysis.key_points,
        keyDiscussionPoints:
          rawAnalysis.KeyDiscussionPoints || rawAnalysis.keyDiscussionPoints || rawAnalysis.key_discussion_points,
        actionItems: normalizeActionItems(rawAnalysis.ActionItems || rawAnalysis.actionItems || rawAnalysis.action_items),
        concerns: rawAnalysis.Concerns || rawAnalysis.concerns,
        relevantCaseStudies: rawAnalysis.relevantCaseStudies || rawAnalysis.relevant_case_studies,
        aiServicesOpportunities: rawAnalysis.aiServicesOpportunities || rawAnalysis.ai_services_opportunities,
      } as EnhancedTranscriptAnalysis)
    : null;

  if (analysis && rawAnalysis?.data) {
    const kmData = rawAnalysis.data;
    analysis.transcriptSummary = kmData.transcriptSummary || analysis.executiveSummary;
    analysis.callDetails = kmData.callDetails;
    analysis.speakers = kmData.speakers;
    analysis.keyMoments = kmData.keyMoments;
    analysis.opportunitiesDetected = kmData.opportunitiesDetected;
    analysis.nextSteps = kmData.nextSteps || analysis.nextSteps;
    analysis.references = kmData.references;
    analysis.opportunitySummary = kmData.opportunitySummary;
    analysis.pastSimilarOpportunities = kmData.pastSimilarOpportunities;
    analysis.sentimentAnalysis = kmData.sentimentAnalysis;
    analysis.overallSentiment = kmData.overallSentiment || analysis.sentiment;
    analysis.pursuitBrief = kmData.pursuitBrief;
    analysis.competitorsmention = kmData.competitorMentions || analysis.competitorsmention;
  }

  const shortSentiment = analysisData?.sentiment || null;

  const speakerSentiments =
    analysis?.speakers?.map((speaker) => {
      const inferredSentiment =
        analysis?.sentimentAnalysis?.find((item) =>
          item?.notes?.toLowerCase().includes((speaker?.name || '').toLowerCase())
        )?.sentiment || 'Not captured';

      return {
        name: speaker?.name || speaker?.id || 'Speaker',
        talkRatio: speaker?.talkRatio,
        speakingTime: speaker?.speakingTime,
        sentiment: inferredSentiment,
      };
    }) || [];

  const competitorMentions = analysis?.competitorsmention || [];

  const getReferenceLabel = (link: string) => {
    try {
      const url = new URL(link);
      return url.hostname.replace(/^www\./i, '') || link;
    } catch {
      return link;
    }
  };

  const normalizeConfidenceValue = (value: any): string | null => {
    if (value === null || value === undefined) return null;
    const text = String(value).trim();
    if (!text || /not\s+enough/i.test(text) || /insufficient/i.test(text)) {
      return null;
    }
    if (!Number.isNaN(Number(text)) && !text.includes('%')) {
      const numeric = Number(text);
      if (Number.isFinite(numeric)) {
        const percentage = numeric <= 1 ? Math.round(numeric * 100) : Math.round(numeric);
        return `${percentage}%`;
      }
    }
    return text;
  };

  const getOpportunityConfidence = (opportunity: any, index: number) => {
    if (!analysis) return null;
    const ownConfidence = normalizeConfidenceValue(opportunity?.confidence);
    if (ownConfidence) return ownConfidence;

    const sentimentAnalysis = Array.isArray(analysis.sentimentAnalysis)
      ? analysis.sentimentAnalysis
      : [];
    if (!sentimentAnalysis.length) return null;

    const normalize = (value: any) => {
      if (value === undefined || value === null) return null;
      return String(value).trim().toLowerCase();
    };

    const opportunityKeys = [
      opportunity?.opportunityID,
      opportunity?.opportunityId,
      opportunity?.id,
      opportunity?.title,
      opportunity?.name,
      opportunity?.description,
      `opportunity ${index + 1}`,
    ]
      .map(normalize)
      .filter(Boolean);

    const matched = sentimentAnalysis.find((item: any, sentimentIndex: number) => {
      const sentimentKeys = [
        item?.opportunityID,
        item?.opportunityId,
        item?.id,
        item?.title,
        item?.name,
        item?.description,
        `opportunity ${sentimentIndex + 1}`,
      ]
        .map(normalize)
        .filter(Boolean);

      return sentimentKeys.some((key) => opportunityKeys.includes(key));
    });

    const matchedConfidence = normalizeConfidenceValue(matched?.confidence);
    if (matchedConfidence) return matchedConfidence;

    const fallbackEntry = sentimentAnalysis[index];
    return normalizeConfidenceValue(fallbackEntry?.confidence);
  };

  const handleDownloadPdf = () => {
    if (!contentRef.current) return;
    const printWindow = window.open('', '_blank', 'width=1024,height=768');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>${analysisData?.meetingTitle || 'Transcript Analysis'}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 24px;
              color: #0f172a;
            }
            h6 {
              margin-top: 24px;
            }
            .section {
              margin-bottom: 24px;
              padding-bottom: 16px;
              border-bottom: 1px solid #e2e8f0;
            }
            .chip {
              display: inline-flex;
              padding: 4px 10px;
              border-radius: 999px;
              background: #2563eb;
              color: #fff;
              font-size: 12px;
            }
            ul {
              padding-left: 16px;
            }
            .meta {
              font-size: 13px;
              color: #475569;
            }
          </style>
        </head>
        <body>
          ${contentRef.current.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: 'rgba(15, 23, 42, 0.98)',
          backgroundImage: 'linear-gradient(145deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)',
          border: '1px solid #334155',
        },
      }}
    >
      <DialogTitle
        sx={{
          bgcolor: 'rgba(30, 41, 59, 0.6)',
          borderBottom: '1px solid #334155',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Assignment sx={{ color: 'secondary.main', fontSize: 28 }} />
          <Box>
            <Typography variant="h5" sx={{ color: '#fff', fontWeight: 600 }}>
              {analysisData?.companyName || 'Transcript Analysis'}
            </Typography>
            {analysisData?.meetingTitle && (
              <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                {analysisData.meetingTitle}
              </Typography>
            )}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {analysisData?.status && (
            <Chip
              label={analysisData.status.toUpperCase()}
              size="small"
              color={
                analysisData.status === 'completed'
                  ? 'success'
                  : analysisData.status === 'processing'
                  ? 'info'
                  : 'error'
              }
              sx={{ fontWeight: 600 }}
            />
          )}
          <IconButton onClick={onClose} sx={{ color: 'text.disabled' }}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 3 }}>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {analysisData?.status === 'processing' && (
          <Alert severity="info" sx={{ mb: 3 }}>
            This analysis is still running. You can close this window and return later from History → Transcript analyses.
          </Alert>
        )}

        {analysisData?.status === 'error' && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {analysisData?.errorMessage || 'Analysis failed. Please retry or contact support.'}
          </Alert>
        )}

        {createDealSuccess && (
          <Alert severity="success" sx={{ mb: 3 }} onClose={() => setCreateDealSuccess(null)}>
            {createDealSuccess}
          </Alert>
        )}

        {createDealError && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setCreateDealError(null)}>
            {createDealError}
          </Alert>
        )}

        {analysisData?.status === 'completed' && !analysisData?.dealId && (
          <Alert
          severity="info"
          sx={{ mb: 3 }}
          action={
            <Button
              variant="contained"
              color="info"
              size="small"
              onClick={handleCreateDeal}
              disabled={creatingDeal}
            >
              {creatingDeal ? 'Creating...' : 'Create deal'}
            </Button>
          }
        >
          Promote this analysis into a tracked deal to keep the pursuit moving.
        </Alert>
        )}

        {!loading && !error && analysisData?.status === 'completed' && analysis && (
          <Stack spacing={3} ref={contentRef}>
            {/* Key Metrics */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2 }}>
              {/* Opportunity Score */}
              <Card sx={{ bgcolor: 'rgba(30, 41, 59, 0.6)', border: '1px solid #334155' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <TrendingUp sx={{ color: 'secondary.main', mr: 1 }} />
                    <Typography variant="subtitle2" sx={{ color: 'text.disabled' }}>
                      Opportunity Score
                    </Typography>
                  </Box>
                  <Typography variant="h3" sx={{ color: getScoreColor(analysis.opportunityScore), fontWeight: 700 }}>
                    {analysis.opportunityScore}
                    <Typography component="span" variant="h6" sx={{ color: 'text.secondary' }}>
                      /100
                    </Typography>
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={analysis.opportunityScore}
                    sx={{
                      mt: 1,
                      height: 6,
                      borderRadius: 3,
                      bgcolor: 'rgba(71, 85, 105, 0.3)',
                      '& .MuiLinearProgress-bar': {
                        bgcolor: getScoreColor(analysis.opportunityScore),
                      },
                    }}
                  />
                </CardContent>
              </Card>

              {/* Success Probability */}

              {/* Success Probability */}
              {analysis.successProbability !== null && (
                <Card sx={{ bgcolor: 'rgba(30, 41, 59, 0.6)', border: '1px solid #334155' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <CheckCircle sx={{ color: 'secondary.main', mr: 1 }} />
                      <Typography variant="subtitle2" sx={{ color: 'text.disabled' }}>
                        Success Probability
                      </Typography>
                    </Box>
                    <Typography variant="h3" sx={{ color: getScoreColor(analysis.successProbability), fontWeight: 700 }}>
                      {analysis.successProbability}%
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={analysis.successProbability}
                      sx={{
                        mt: 1,
                        height: 6,
                        borderRadius: 3,
                        bgcolor: 'rgba(71, 85, 105, 0.3)',
                        '& .MuiLinearProgress-bar': {
                          bgcolor: getScoreColor(analysis.successProbability),
                        },
                      }}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Sentiment Snapshot */}
              <Card sx={{ bgcolor: 'rgba(30, 41, 59, 0.6)', border: '1px solid #334155' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle2" sx={{ color: 'text.disabled' }}>
                      Sentiment
                    </Typography>
                  </Box>
                  <Chip
                    label={shortSentiment || 'None provided.'}
                    sx={{
                      bgcolor: getSentimentColor(shortSentiment),
                      color: '#fff',
                      fontWeight: 600,
                    }}
                  />
                </CardContent>
              </Card>
            </Box>

            {analysis.transcriptSummary && (
              <Card sx={{ bgcolor: 'rgba(30, 41, 59, 0.6)', border: '1px solid #334155' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600, mb: 1.5 }}>
                    Call Summary
                  </Typography>
                  <Typography variant="body1" sx={{ color: '#cbd5e1', lineHeight: 1.7 }}>
                    {analysis.transcriptSummary}
                  </Typography>
                </CardContent>
              </Card>
            )}

            {analysis.callDetails && typeof analysis.callDetails === 'object' && (
              <Card sx={{ bgcolor: 'rgba(30, 41, 59, 0.6)', border: '1px solid #334155', mb: 2 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600, mb: 2 }}>
                    Call Details
                  </Typography>
                  <Stack spacing={1.5}>
                    {analysis.callDetails.callID && (
                      <Box>
                        <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                          Call ID
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#cbd5e1' }}>
                          {analysis.callDetails.callID}
                        </Typography>
                      </Box>
                    )}
                    {analysis.callDetails.date && (
                      <Box>
                        <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                          Date
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#cbd5e1' }}>
                          {analysis.callDetails.date}
                        </Typography>
                      </Box>
                    )}
                    {analysis.callDetails.duration && (
                      <Box>
                        <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                          Duration
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#cbd5e1' }}>
                          {analysis.callDetails.duration}
                        </Typography>
                      </Box>
                    )}
                    {(analysis.callDetails.salesRepresentative || analysis.callDetails.client) && (
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        {analysis.callDetails.salesRepresentative && (
                          <Chip
                            label={`Rep: ${analysis.callDetails.salesRepresentative}`}
                            size="small"
                            sx={{ bgcolor: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa' }}
                          />
                        )}
                        {analysis.callDetails.client && (
                          <Chip
                            label={`Client: ${analysis.callDetails.client}`}
                            size="small"
                            sx={{ bgcolor: 'rgba(16, 185, 129, 0.2)', color: '#34d399' }}
                          />
                        )}
                      </Stack>
                    )}
                    {Array.isArray(analysis.callDetails.participants) &&
                      analysis.callDetails.participants.length > 0 && (
                        <Box>
                          <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                            Participants
                          </Typography>
                          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                            {analysis.callDetails.participants.map((participant: string, idx: number) => (
                              <Chip
                                key={`${participant}-${idx}`}
                                label={participant}
                                size="small"
                                sx={{ bgcolor: 'rgba(148, 163, 184, 0.2)', color: '#cbd5e1' }}
                              />
                            ))}
                          </Stack>
                        </Box>
                      )}
                  </Stack>
                </CardContent>
              </Card>
            )}

            <Card sx={{ bgcolor: 'rgba(30, 41, 59, 0.6)', border: '1px solid #334155', mb: 2 }}>
              <CardContent>
                <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600, mb: 1 }}>
                  Sentiment
                </Typography>
                <Chip
                  label={shortSentiment || 'None provided.'}
                  sx={{
                    bgcolor: getSentimentColor(shortSentiment),
                    color: '#fff',
                    fontWeight: 600,
                    mb: 1.5,
                  }}
                />
                {speakerSentiments.length > 0 ? (
                  <Stack spacing={1}>
                    {speakerSentiments.map((speaker, index) => (
                      <Typography key={index} variant="body2" sx={{ color: 'text.disabled' }}>
                        {speaker.name}: {speaker.sentiment}.{' '}
                        {speaker.talkRatio && `Talk ratio ${speaker.talkRatio}.`}{' '}
                        {speaker.speakingTime && `Speaking time ${speaker.speakingTime}.`}
                      </Typography>
                    ))}
                  </Stack>
                ) : (
                  <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                    No speaker sentiment captured.
                  </Typography>
                )}
              </CardContent>
            </Card>

            {analysis.keyMoments && analysis.keyMoments.length > 0 && (
              <Card sx={{ bgcolor: 'rgba(30, 41, 59, 0.6)', border: '1px solid #334155' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600, mb: 2 }}>
                    Key Moments
                  </Typography>
                  <List>
                    {analysis.keyMoments.map((moment: any, index: number) => (
                      <ListItem key={index} sx={{ alignItems: 'flex-start', py: 1.5 }}>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Chip
                                label={moment.timestamp || '—'}
                                size="small"
                                sx={{ bgcolor: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa' }}
                              />
                              <Typography variant="subtitle2" sx={{ color: '#cbd5e1' }}>
                                {moment.speaker || 'Speaker'}
                              </Typography>
                              {moment.type && (
                                <Chip
                                  label={moment.type}
                                  size="small"
                                  sx={{ bgcolor: 'rgba(148, 163, 184, 0.2)', color: '#cbd5e1' }}
                                />
                              )}
                            </Box>
                          }
                          secondary={
                            <Typography variant="body2" sx={{ color: 'text.disabled', mt: 1 }}>
                              {moment.description}
                              {moment.responseStrategy && (
                                <Box component="span" sx={{ display: 'block', mt: 0.5 }}>
                                  Response strategy: {moment.responseStrategy}
                                </Box>
                              )}
                            </Typography>
                          }
                          primaryTypographyProps={{ sx: { color: '#fff', fontWeight: 600 } }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            )}

            {competitorMentions && competitorMentions.length > 0 ? (
              <Card sx={{ bgcolor: 'rgba(30, 41, 59, 0.6)', border: '1px solid #334155' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600, mb: 2 }}>
                    Competitor Mentions
                  </Typography>
                  <List>
                    {competitorMentions.map((mention: any, index: number) => (
                      <ListItem key={index} sx={{ alignItems: 'flex-start', py: 1.5 }}>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Chip
                                label={mention.timestamp || '—'}
                                size="small"
                                sx={{ bgcolor: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa' }}
                              />
                              <Typography variant="subtitle2" sx={{ color: '#cbd5e1' }}>
                                {mention.speaker || 'Speaker'}
                              </Typography>
                              {mention.competitor && (
                                <Chip
                                  label={mention.competitor}
                                  size="small"
                                  sx={{ bgcolor: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5' }}
                                />
                              )}
                            </Box>
                          }
                          secondary={
                            <Typography variant="body2" sx={{ color: 'text.disabled', mt: 1 }}>
                              {mention.context || 'No additional context provided.'}
                            </Typography>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            ) : (
              <Card sx={{ bgcolor: 'rgba(30, 41, 59, 0.6)', border: '1px solid #334155' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600 }}>
                    Competitor Mentions
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                    None recorded.
                  </Typography>
                </CardContent>
              </Card>
            )}

            {analysis.opportunitiesDetected && analysis.opportunitiesDetected.length > 0 && (
              <Card sx={{ bgcolor: 'rgba(30, 41, 59, 0.6)', border: '1px solid #334155' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600, mb: 2 }}>
                    Opportunities Detected ({analysis.opportunitiesDetected.length})
                  </Typography>
                  <Stack spacing={2}>
                    {analysis.opportunitiesDetected.map((opportunity: any, index: number) => {
                      const opportunityConfidence = getOpportunityConfidence(opportunity, index);
                      const opportunityLabel =
                        opportunity.title ||
                        opportunity.name ||
                        opportunity.opportunityID ||
                        opportunity.opportunityId ||
                        `Opportunity ${index + 1}`;
                      return (
                      <Card
                        key={index}
                        sx={{
                          bgcolor: 'rgba(15, 23, 42, 0.6)',
                          border: '1px solid #475569',
                        }}
                      >
                        <CardContent>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                            <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 600 }}>
                              {opportunityLabel}
                            </Typography>
                            {opportunityConfidence && (
                              <Chip
                                label={`Confidence ${opportunityConfidence}`}
                                size="small"
                                sx={{ bgcolor: 'rgba(16, 185, 129, 0.2)', color: '#34d399', fontWeight: 600 }}
                              />
                            )}
                          </Box>
                          {opportunity.description && (
                            <Typography variant="body2" sx={{ color: '#cbd5e1', mt: 1 }}>
                              {opportunity.description}
                            </Typography>
                          )}
                          <Stack spacing={0.5} sx={{ mt: 1.5 }}>
                            {opportunity.timestamp && (
                              <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                                Timestamp: {opportunity.timestamp}
                              </Typography>
                            )}
                            {opportunity.relatedSegment && (
                              <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                                Segment: {opportunity.relatedSegment}
                              </Typography>
                            )}
                            {opportunity.similarCaseStudy && (
                              <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                                Case study: {opportunity.similarCaseStudy}
                              </Typography>
                            )}
                          </Stack>
                        </CardContent>
                      </Card>
                    );
                    })}
                  </Stack>
                </CardContent>
              </Card>
            )}

            {/* AI Services Opportunities - Northstar Integrators's three new AI service offerings */}
            {analysis.aiServicesOpportunities && analysis.aiServicesOpportunities.length > 0 && (
              <Card sx={{ bgcolor: 'rgba(124, 58, 237, 0.15)', border: '1px solid #7c3aed' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ color: '#a78bfa', fontWeight: 600, mb: 2 }}>
                    AI Services Opportunities ({analysis.aiServicesOpportunities.length})
                  </Typography>
                  <Stack spacing={2}>
                    {analysis.aiServicesOpportunities.map((aiOpp: any, index: number) => {
                      const serviceColors: Record<string, { bg: string; border: string; text: string }> = {
                        'AI Behavioral Transformation': { bg: 'rgba(156, 39, 176, 0.2)', border: '#9c27b0', text: '#e1bee7' },
                        'Rovo Augmented Product Development': { bg: 'rgba(0, 82, 204, 0.2)', border: '#0052cc', text: '#90caf9' },
                        'AI-First Operating Model Design': { bg: 'rgba(0, 131, 143, 0.2)', border: '#00838f', text: '#80deea' },
                      };
                      const colors = serviceColors[aiOpp.service] || { bg: 'rgba(124, 58, 237, 0.2)', border: '#7c3aed', text: '#c4b5fd' };

                      return (
                        <Card
                          key={index}
                          sx={{
                            bgcolor: colors.bg,
                            border: `1px solid ${colors.border}`,
                          }}
                        >
                          <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, mb: 1.5 }}>
                              <Typography variant="subtitle1" sx={{ color: colors.text, fontWeight: 600 }}>
                                {aiOpp.service}
                              </Typography>
                              {aiOpp.confidence && (
                                <Chip
                                  label={`${aiOpp.confidence} confidence`}
                                  size="small"
                                  sx={{ bgcolor: 'rgba(16, 185, 129, 0.2)', color: '#34d399', fontWeight: 600 }}
                                />
                              )}
                            </Box>

                            {aiOpp.signals && aiOpp.signals.length > 0 && (
                              <Box sx={{ mb: 1.5 }}>
                                <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 600, textTransform: 'uppercase' }}>
                                  Detected Signals
                                </Typography>
                                <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 0.5 }}>
                                  {aiOpp.signals.map((signal: string, i: number) => (
                                    <Chip
                                      key={i}
                                      label={signal}
                                      size="small"
                                      sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: '#cbd5e1', fontSize: '0.75rem', mb: 0.5 }}
                                    />
                                  ))}
                                </Stack>
                              </Box>
                            )}

                            {aiOpp.relatedQuotes && aiOpp.relatedQuotes.length > 0 && (
                              <Box sx={{ mb: 1.5 }}>
                                <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 600, textTransform: 'uppercase' }}>
                                  Key Quotes
                                </Typography>
                                {aiOpp.relatedQuotes.map((quote: string, i: number) => (
                                  <Typography key={i} variant="body2" sx={{ color: '#e2e8f0', fontStyle: 'italic', mt: 0.5, pl: 1, borderLeft: '2px solid #475569' }}>
                                    "{quote}"
                                  </Typography>
                                ))}
                              </Box>
                            )}

                            {aiOpp.recommendedActions && aiOpp.recommendedActions.length > 0 && (
                              <Box>
                                <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 600, textTransform: 'uppercase' }}>
                                  Recommended Actions
                                </Typography>
                                <List dense sx={{ py: 0 }}>
                                  {aiOpp.recommendedActions.map((action: string, i: number) => (
                                    <ListItem key={i} sx={{ py: 0.25, px: 0 }}>
                                      <ListItemIcon sx={{ minWidth: 24 }}>
                                        <ArrowForward sx={{ color: '#34d399', fontSize: 16 }} />
                                      </ListItemIcon>
                                      <ListItemText
                                        primary={action}
                                        primaryTypographyProps={{ variant: 'body2', sx: { color: '#cbd5e1' } }}
                                      />
                                    </ListItem>
                                  ))}
                                </List>
                              </Box>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </Stack>
                </CardContent>
              </Card>
            )}

            <Card sx={{ bgcolor: 'rgba(30, 41, 59, 0.6)', border: '1px solid #334155' }}>
              <CardContent>
                <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600, mb: 1.5 }}>
                  Opportunity Summary
                </Typography>
                <Typography variant="body1" sx={{ color: '#cbd5e1', lineHeight: 1.7 }}>
                  {analysis.opportunitySummary || 'None provided.'}
                </Typography>
              </CardContent>
            </Card>

            <Card sx={{ bgcolor: 'rgba(30, 41, 59, 0.6)', border: '1px solid #334155' }}>
              <CardContent>
                <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600, mb: 2 }}>
                  Sentiment By Opportunity
                </Typography>
                {analysis.sentimentAnalysis && analysis.sentimentAnalysis.length > 0 ? (
                  <List>
                    {analysis.sentimentAnalysis.map((sentimentItem: any, index: number) => (
                      <ListItem key={index} sx={{ alignItems: 'flex-start', py: 1.5 }}>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="subtitle2" sx={{ color: '#cbd5e1', fontWeight: 600 }}>
                                {sentimentItem.opportunityID || `Opportunity ${index + 1}`}
                              </Typography>
                              {sentimentItem.sentiment && (
                                <Chip
                                  label={sentimentItem.sentiment}
                                  size="small"
                                  sx={{ bgcolor: getSentimentColor(sentimentItem.sentiment), color: '#fff' }}
                                />
                              )}
                              {sentimentItem.confidence && (
                                <Chip
                                  label={`Confidence ${sentimentItem.confidence}`}
                                  size="small"
                                  sx={{ bgcolor: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa' }}
                                />
                              )}
                            </Box>
                          }
                          secondary={
                            sentimentItem.notes ? (
                              <Typography variant="body2" sx={{ color: 'text.disabled', mt: 0.5 }}>
                                {sentimentItem.notes}
                              </Typography>
                            ) : null
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                ) : (
                  <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                    None recorded.
                  </Typography>
                )}
              </CardContent>
            </Card>

            <Card sx={{ bgcolor: 'rgba(30, 41, 59, 0.6)', border: '1px solid #334155' }}>
              <CardContent>
                <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600, mb: 2 }}>
                  Past Similar Opportunities
                </Typography>
                {analysis.pastSimilarOpportunities && analysis.pastSimilarOpportunities.length > 0 ? (
                  <Stack spacing={1.5}>
                    {analysis.pastSimilarOpportunities.map((item: any, index: number) => (
                      <Box key={index} sx={{ borderLeft: '3px solid #2563eb', pl: 2 }}>
                        <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 600 }}>
                          {item.caseStudy}
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                          {item.keyChallenge}
                        </Typography>
                        {item.enterpriseSolutionOutcomes && (
                          <Typography variant="body2" sx={{ color: '#cbd5e1', mt: 0.5 }}>
                            Outcomes: {item.enterpriseSolutionOutcomes}
                          </Typography>
                        )}
                      </Box>
                    ))}
                  </Stack>
                ) : (
                  <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                    None provided.
                  </Typography>
                )}
              </CardContent>
            </Card>

            {analysis.references && typeof analysis.references === 'object' && (
              <Card sx={{ bgcolor: 'rgba(30, 41, 59, 0.6)', border: '1px solid #334155' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600, mb: 1.5 }}>
                    References
                  </Typography>
                  {analysis.references.summary && (
                    <Typography variant="body2" sx={{ color: '#cbd5e1', mb: 2 }}>
                      {analysis.references.summary}
                    </Typography>
                  )}
                  {Array.isArray(analysis.references.links) && analysis.references.links.length > 0 && (
                    <Stack spacing={1.5}>
                      {analysis.references.links.map((link: string, index: number) => (
                        <Box
                          key={`${link}-${index}`}
                          sx={{
                            p: 1.5,
                            borderRadius: 1,
                            border: '1px solid rgba(148, 163, 184, 0.3)',
                            bgcolor: 'rgba(15, 23, 42, 0.6)',
                            color: '#cbd5e1',
                            fontSize: '0.9rem',
                            wordBreak: 'break-all',
                          }}
                        >
                          {getReferenceLabel(link)} — {link}
                        </Box>
                      ))}
                    </Stack>
                  )}
                </CardContent>
              </Card>
            )}

            {analysis.pursuitBrief && typeof analysis.pursuitBrief === 'object' && (
              <Card sx={{ bgcolor: 'rgba(30, 41, 59, 0.6)', border: '1px solid #334155' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600, mb: 2 }}>
                    Pursuit Brief
                  </Typography>
                  <Stack spacing={1.5}>
                    {Object.entries(pursuitBriefQuestions).map(([questionNumber, questionText]) => (
                      <Box
                        key={questionNumber}
                        sx={{
                          p: 1.5,
                          borderRadius: 2,
                          bgcolor: 'rgba(15, 23, 42, 0.6)',
                          border: '1px solid rgba(148, 163, 184, 0.2)',
                        }}
                      >
                        <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 600 }}>
                          {questionText}
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#cbd5e1', mt: 0.5 }}>
                          {analysis.pursuitBrief?.[questionNumber] || 'None provided.'}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            )}

            {/* Executive Summary */}
            {analysis?.executiveSummary && (
              <Card sx={{ bgcolor: 'rgba(30, 41, 59, 0.6)', border: '1px solid #334155' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600, mb: 2 }}>
                    Executive Summary
                  </Typography>
                  <Typography variant="body1" sx={{ color: '#cbd5e1', lineHeight: 1.7 }}>
                    {analysis.executiveSummary}
                  </Typography>
                </CardContent>
              </Card>
            )}

            {/* Key Discussion Points */}
            {analysis.keyDiscussionPoints && Array.isArray(analysis.keyDiscussionPoints) && analysis.keyDiscussionPoints.length > 0 && (
              <Card sx={{ bgcolor: 'rgba(30, 41, 59, 0.6)', border: '1px solid #334155' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Lightbulb sx={{ color: 'secondary.main', mr: 1 }} />
                    <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600 }}>
                      Key Discussion Points
                    </Typography>
                  </Box>
                  <List>
                    {analysis.keyDiscussionPoints.map((point: string, index: number) => (
                      <ListItem key={index} sx={{ py: 0.5 }}>
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <CheckCircle sx={{ color: 'success.main', fontSize: 20 }} />
                        </ListItemIcon>
                        <ListItemText
                          primary={point}
                          primaryTypographyProps={{
                            sx: { color: '#cbd5e1', fontSize: '0.95rem' },
                          }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            )}

            {/* Key Points */}
            {analysis.keyPoints && analysis.keyPoints.length > 0 && (
              <Card sx={{ bgcolor: 'rgba(30, 41, 59, 0.6)', border: '1px solid #334155' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Lightbulb sx={{ color: 'secondary.main', mr: 1 }} />
                    <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600 }}>
                      Key Points
                    </Typography>
                  </Box>
                  <List>
                    {analysis.keyPoints.map((point: string, index: number) => (
                      <ListItem key={index} sx={{ py: 0.5 }}>
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <CheckCircle sx={{ color: 'success.main', fontSize: 20 }} />
                        </ListItemIcon>
                        <ListItemText
                          primary={point}
                          primaryTypographyProps={{
                            sx: { color: '#cbd5e1', fontSize: '0.95rem' },
                          }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            )}

            {/* Action Items */}
            {analysis.actionItems && Array.isArray(analysis.actionItems) && analysis.actionItems.length > 0 && (
              <Card sx={{ bgcolor: 'rgba(30, 41, 59, 0.6)', border: '1px solid #334155' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <CheckCircle sx={{ color: 'success.main', mr: 1 }} />
                    <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600 }}>
                      Action Items
                    </Typography>
                  </Box>
                  <List>
                    {analysis.actionItems.map((item: any, index: number) => (
                      <ListItem key={index} sx={{ py: 0.5 }}>
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <Box
                            sx={{
                              width: 24,
                              height: 24,
                              borderRadius: '50%',
                              bgcolor: 'success.main',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              color: 'white',
                            }}
                          >
                            {index + 1}
                          </Box>
                        </ListItemIcon>
                        <ListItemText
                          primary={typeof item === 'string' ? item : item.action || item.description}
                          secondary={typeof item === 'object' && item.owner ? `Owner: ${item.owner}` : undefined}
                          primaryTypographyProps={{
                            sx: { color: '#cbd5e1', fontSize: '0.95rem' },
                          }}
                          secondaryTypographyProps={{
                            sx: { color: 'text.disabled', fontSize: '0.85rem' },
                          }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            )}

            {/* Buying Signals */}
            {analysis.buyingSignals && Array.isArray(analysis.buyingSignals) && analysis.buyingSignals.length > 0 && (
              <Card sx={{ bgcolor: 'rgba(30, 41, 59, 0.6)', border: '1px solid #334155' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <TrendingUp sx={{ color: 'success.main', mr: 1 }} />
                    <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600 }}>
                      Buying Signals
                    </Typography>
                  </Box>
                  <List>
                    {analysis.buyingSignals.map((signal: any, index: number) => (
                      <ListItem key={index} sx={{ py: 0.5 }}>
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <CheckCircle sx={{ color: 'success.main', fontSize: 20 }} />
                        </ListItemIcon>
                        <ListItemText
                          primary={typeof signal === 'string' ? signal : signal.signal || signal.description}
                          secondary={typeof signal === 'object' && signal.context ? signal.context : undefined}
                          primaryTypographyProps={{
                            sx: { color: '#cbd5e1', fontSize: '0.95rem' },
                          }}
                          secondaryTypographyProps={{
                            sx: { color: 'text.disabled', fontSize: '0.85rem' },
                          }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            )}

            {/* Pain Points */}
            {analysis.painPoints && Array.isArray(analysis.painPoints) && analysis.painPoints.length > 0 && (
              <Card sx={{ bgcolor: 'rgba(30, 41, 59, 0.6)', border: '1px solid #334155' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Warning sx={{ color: 'warning.main', mr: 1 }} />
                    <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600 }}>
                      Pain Points
                    </Typography>
                  </Box>
                  <List>
                    {analysis.painPoints.map((pain: any, index: number) => (
                      <ListItem key={index} sx={{ py: 0.5 }}>
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <Warning sx={{ color: 'warning.main', fontSize: 20 }} />
                        </ListItemIcon>
                        <ListItemText
                          primary={typeof pain === 'string' ? pain : pain.pain_point || pain.description}
                          secondary={typeof pain === 'object' && pain.impact ? pain.impact : undefined}
                          primaryTypographyProps={{
                            sx: { color: '#cbd5e1', fontSize: '0.95rem' },
                          }}
                          secondaryTypographyProps={{
                            sx: { color: 'text.disabled', fontSize: '0.85rem' },
                          }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            )}

            {/* Risk Factors */}
            {analysis.riskFactors && Array.isArray(analysis.riskFactors) && analysis.riskFactors.length > 0 && (
              <Card sx={{ bgcolor: 'rgba(30, 41, 59, 0.6)', border: '1px solid #334155' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Warning sx={{ color: 'error.main', mr: 1 }} />
                    <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600 }}>
                      Risk Factors
                    </Typography>
                  </Box>
                  <List>
                    {analysis.riskFactors.map((risk: string, index: number) => (
                      <ListItem key={index} sx={{ py: 0.5 }}>
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <Warning sx={{ color: 'error.main', fontSize: 20 }} />
                        </ListItemIcon>
                        <ListItemText
                          primary={risk}
                          primaryTypographyProps={{
                            sx: { color: '#cbd5e1', fontSize: '0.95rem' },
                          }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            )}

            {/* Concerns (legacy) */}
            {analysis.concerns && analysis.concerns.length > 0 && (
              <Card sx={{ bgcolor: 'rgba(30, 41, 59, 0.6)', border: '1px solid #334155' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Warning sx={{ color: 'warning.main', mr: 1 }} />
                    <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600 }}>
                      Concerns & Risks
                    </Typography>
                  </Box>
                  <List>
                    {analysis.concerns.map((concern: string, index: number) => (
                      <ListItem key={index} sx={{ py: 0.5 }}>
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <Warning sx={{ color: 'warning.main', fontSize: 20 }} />
                        </ListItemIcon>
                        <ListItemText
                          primary={concern}
                          primaryTypographyProps={{
                            sx: { color: '#cbd5e1', fontSize: '0.95rem' },
                          }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            )}

            {/* Next Steps */}
            {analysis?.nextSteps && Array.isArray(analysis.nextSteps) && analysis.nextSteps.length > 0 && (
              <Card sx={{ bgcolor: 'rgba(30, 41, 59, 0.6)', border: '1px solid #334155' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <ArrowForward sx={{ color: 'secondary.main', mr: 1 }} />
                    <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600 }}>
                      Recommended Next Steps
                    </Typography>
                  </Box>
                  <List>
                    {analysis.nextSteps.map((step: any, index: number) => (
                      <ListItem key={index} sx={{ py: 1 }}>
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <Box
                            sx={{
                              width: 24,
                              height: 24,
                              borderRadius: '50%',
                              bgcolor: 'secondary.main',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              color: 'white',
                            }}
                          >
                            {index + 1}
                          </Box>
                        </ListItemIcon>
                        <ListItemText
                          primary={typeof step === 'string' ? step : step.action || step.description}
                          secondary={
                            typeof step === 'object' ? (
                              <>
                                {step.priority && <Box component="span" sx={{ display: 'block' }}>Priority: {step.priority}</Box>}
                                {step.timeline && <Box component="span" sx={{ display: 'block' }}>Timeline: {step.timeline}</Box>}
                                {step.owner && <Box component="span" sx={{ display: 'block' }}>Owner: {step.owner}</Box>}
                              </>
                            ) : undefined
                          }
                          primaryTypographyProps={{
                            sx: { color: '#cbd5e1', fontSize: '0.95rem' },
                          }}
                          secondaryTypographyProps={{
                            sx: { color: 'text.disabled', fontSize: '0.85rem' },
                          }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            )}

            {/* Stakeholders */}
            {analysis.stakeholders && Array.isArray(analysis.stakeholders) && analysis.stakeholders.length > 0 && (
              <Card sx={{ bgcolor: 'rgba(30, 41, 59, 0.6)', border: '1px solid #334155' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Business sx={{ color: 'secondary.main', mr: 1 }} />
                    <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600 }}>
                      Stakeholders
                    </Typography>
                  </Box>
                  <List>
                    {analysis.stakeholders.map((stakeholder: any, index: number) => (
                      <ListItem key={index} sx={{ py: 1 }}>
                        <ListItemText
                          primary={stakeholder.name || 'Unknown'}
                          secondary={
                            <>
                              {stakeholder.role && <Box component="span" sx={{ display: 'block' }}>Role: {stakeholder.role}</Box>}
                              {stakeholder.influence && <Box component="span" sx={{ display: 'block' }}>Influence: {stakeholder.influence}</Box>}
                              {stakeholder.notes && <Box component="span" sx={{ display: 'block', mt: 0.5 }}>{stakeholder.notes}</Box>}
                            </>
                          }
                          primaryTypographyProps={{
                            sx: { color: '#fff', fontSize: '1rem', fontWeight: 600 },
                          }}
                          secondaryTypographyProps={{
                            sx: { color: 'text.disabled', fontSize: '0.85rem' },
                          }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            )}

            {/* Timeline & Budget */}
            {analysis.timelineBudget && (
              <Card sx={{ bgcolor: 'rgba(30, 41, 59, 0.6)', border: '1px solid #334155' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600, mb: 2 }}>
                    Timeline & Budget
                  </Typography>
                  <Stack spacing={1.5}>
                    {analysis.timelineBudget.timeline && (
                      <Box>
                        <Typography variant="caption" sx={{ color: 'text.disabled' }}>Timeline:</Typography>
                        <Typography variant="body1" sx={{ color: '#cbd5e1' }}>{analysis.timelineBudget.timeline}</Typography>
                      </Box>
                    )}
                    {analysis.timelineBudget.budget && (
                      <Box>
                        <Typography variant="caption" sx={{ color: 'text.disabled' }}>Budget:</Typography>
                        <Typography variant="body1" sx={{ color: '#cbd5e1' }}>{analysis.timelineBudget.budget}</Typography>
                      </Box>
                    )}
                    {analysis.timelineBudget.urgency && (
                      <Box>
                        <Typography variant="caption" sx={{ color: 'text.disabled' }}>Urgency:</Typography>
                        <Chip
                          label={analysis.timelineBudget.urgency}
                          size="small"
                          sx={{
                            bgcolor: analysis.timelineBudget.urgency === 'high' ? '#ef4444' : '#f59e0b',
                            color: 'white',
                            fontWeight: 600,
                            mt: 0.5,
                          }}
                        />
                      </Box>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            )}

            {/* Recommended Products */}
            {analysis?.recommendedProducts && (
              <Card sx={{ bgcolor: 'rgba(30, 41, 59, 0.6)', border: '1px solid #334155' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600, mb: 2 }}>
                    Recommended Products & Services
                  </Typography>
                  <Stack spacing={2}>
                    {analysis.recommendedProducts.atlassian && analysis.recommendedProducts.atlassian.length > 0 && (
                      <Box>
                        <Typography variant="subtitle2" sx={{ color: 'secondary.main', fontWeight: 600, mb: 1 }}>
                          Atlassian
                        </Typography>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                          {analysis.recommendedProducts.atlassian.map((product: any, idx: number) => (
                            <Chip
                              key={idx}
                              label={typeof product === 'string' ? product : product.product || product.name}
                              size="small"
                              sx={{ bgcolor: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa' }}
                            />
                          ))}
                        </Stack>
                      </Box>
                    )}
                    {analysis.recommendedProducts.enterprise_services && analysis.recommendedProducts.enterprise_services.length > 0 && (
                      <Box>
                        <Typography variant="subtitle2" sx={{ color: 'success.main', fontWeight: 600, mb: 1 }}>
                          Northstar Integrators Services
                        </Typography>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                          {analysis.recommendedProducts.enterprise_services.map((service: any, idx: number) => (
                            <Chip
                              key={idx}
                              label={typeof service === 'string' ? service : service.service || service.name}
                              size="small"
                              sx={{ bgcolor: 'rgba(16, 185, 129, 0.2)', color: '#6ee7b7' }}
                            />
                          ))}
                        </Stack>
                      </Box>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            )}

            {/* Recommended Team */}
            {analysis.recommendedTeam && Array.isArray(analysis.recommendedTeam) && analysis.recommendedTeam.length > 0 && (
              <Card sx={{ bgcolor: 'rgba(30, 41, 59, 0.6)', border: '1px solid #334155' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600, mb: 2 }}>
                    Recommended Team
                  </Typography>
                  <List>
                    {analysis.recommendedTeam.map((member: any, index: number) => (
                      <ListItem key={index} sx={{ py: 1 }}>
                        <ListItemText
                          primary={member.role || member.name || 'Team Member'}
                          secondary={member.rationale || member.reason || member.description}
                          primaryTypographyProps={{
                            sx: { color: '#fff', fontSize: '0.95rem', fontWeight: 600 },
                          }}
                          secondaryTypographyProps={{
                            sx: { color: 'text.disabled', fontSize: '0.85rem' },
                          }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            )}

            {/* Relevant Case Studies */}
            {analysis.relevantCaseStudies && analysis.relevantCaseStudies.length > 0 && (
              <Card sx={{ bgcolor: 'rgba(30, 41, 59, 0.6)', border: '1px solid #334155' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Business sx={{ color: 'secondary.main', mr: 1 }} />
                    <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600 }}>
                      Relevant Case Studies ({analysis.relevantCaseStudies.length})
                    </Typography>
                  </Box>
                  <Stack spacing={2}>
                    {analysis.relevantCaseStudies.map((caseStudy: any, index: number) => (
                      <Card
                        key={index}
                        sx={{
                          bgcolor: 'rgba(15, 23, 42, 0.6)',
                          border: '1px solid #475569',
                        }}
                      >
                        <CardContent>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 1 }}>
                            <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 600 }}>
                              {caseStudy.title || caseStudy.company}
                            </Typography>
                            <Chip
                              label={`${caseStudy.relevanceScore}% match`}
                              size="small"
                              sx={{
                                bgcolor: 'secondary.main',
                                color: 'white',
                                fontWeight: 600,
                              }}
                            />
                          </Box>
                          {caseStudy.description && (
                            <Typography variant="body2" sx={{ color: 'text.disabled', mb: 1 }}>
                              {caseStudy.description}
                            </Typography>
                          )}
                          {caseStudy.industry && (
                            <Chip
                              label={caseStudy.industry}
                              size="small"
                              sx={{ bgcolor: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', mr: 1 }}
                            />
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            )}

            {/* Metadata */}
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', pt: 1 }}>
              <Chip
                label={`Analyzed: ${new Date(analysisData?.analyzedAt).toLocaleString()}`}
                size="small"
                sx={{ bgcolor: 'rgba(59, 130, 246, 0.2)', color: 'text.disabled' }}
              />
              {analysisData?.dealId && (
                <Chip
                  label={`Deal ID: ${analysisData.dealId}`}
                  size="small"
                  sx={{ bgcolor: 'rgba(59, 130, 246, 0.2)', color: 'text.disabled' }}
                />
              )}
            </Box>
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ borderTop: '1px solid #334155', p: 2 }}>
        <Button onClick={handleDownloadPdf} variant="outlined" color="info">
          Download PDF
        </Button>
        <Button onClick={onClose} variant="contained" sx={{ bgcolor: 'secondary.main' }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TranscriptAnalysisDialog;
