import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Typography,
  Avatar,
} from '@mui/material';
import {
  Psychology,
  Warning,
  History,
  ArrowForward,
  PlayArrow,
} from '@mui/icons-material';
import { apiGet } from '../utils/api';
import type { CalendarAttendee } from '../types/calendarMeeting';

interface QuickPrepCardProps {
  meetingId: string;
  companyName: string;
  dealStage?: string | null;
  attendees: CalendarAttendee[];
  preCallComplete: boolean;
  preCallRunning: boolean;
  onViewFullAnalysis: () => void;
  onStartPreCall: () => void;
}

interface PreCallData {
  company_overview?: any;
  external_attendees_research?: Array<{
    name?: string;
    email?: string;
    company?: string;
    research?: any;
  }>;
  internal_kb_pre_call?: {
    pastEngagements?: string;
    similarEngagements?: Array<{ title?: string; url?: string; why_relevant?: string }>;
    unknowns?: string[];
  };
  questionnaire?: any;
}

const stageColorMap: Record<string, 'success' | 'info' | 'warning' | 'error' | 'default'> = {
  'closed-won': 'success',
  'closed won': 'success',
  negotiation: 'info',
  proposal: 'info',
  discovery: 'warning',
  prospecting: 'warning',
  qualification: 'warning',
  'closed-lost': 'error',
  'closed lost': 'error',
};

const getStageChipColor = (stage: string): 'success' | 'info' | 'warning' | 'error' | 'default' => {
  const lower = stage.toLowerCase();
  for (const [key, color] of Object.entries(stageColorMap)) {
    if (lower.includes(key)) return color;
  }
  return 'default';
};

const extractTalkingPoints = (overview: any): string[] => {
  let text = '';
  if (typeof overview === 'string') {
    text = overview;
  } else if (overview && typeof overview === 'object') {
    text =
      overview.summary ||
      overview.executive_summary ||
      overview.executiveSummary ||
      overview.overview ||
      JSON.stringify(overview);
  }
  if (!text) return [];

  // Try to extract bullet points first
  const bulletLines = text
    .split(/\n/)
    .map((l: string) => l.replace(/^[\s•\-*]+/, '').trim())
    .filter((l: string) => l.length > 15 && l.length < 200);

  if (bulletLines.length >= 3) return bulletLines.slice(0, 3);

  // Fall back to sentence extraction
  const sentences = text
    .split(/[.!?]+/)
    .map((s: string) => s.trim())
    .filter((s: string) => s.length > 20 && s.length < 200);

  return sentences.slice(0, 3);
};

const extractAttendeeInfo = (
  research: PreCallData['external_attendees_research'],
  fallbackAttendees: CalendarAttendee[]
): Array<{ name: string; title: string }> => {
  if (research && research.length > 0) {
    return research.slice(0, 3).map((a) => {
      let title = '';
      if (a.research) {
        if (typeof a.research === 'string') {
          // Try to extract a title from the research text
          const titleMatch = a.research.match(
            /(?:title|role|position)[:\s]+([^.\n]+)/i
          );
          if (titleMatch) title = titleMatch[1].trim();
        } else if (typeof a.research === 'object') {
          title =
            a.research.title ||
            a.research.role ||
            a.research.jobTitle ||
            a.research.current_role ||
            '';
        }
      }
      return {
        name: a.name || a.email?.split('@')[0] || 'Unknown',
        title: title || a.company || '',
      };
    });
  }

  // Fallback to basic attendee data
  return fallbackAttendees.slice(0, 3).map((a) => ({
    name: a.name || a.email?.split('@')[0] || 'Attendee',
    title: a.role || '',
  }));
};

const QuickPrepCard: React.FC<QuickPrepCardProps> = ({
  meetingId,
  companyName,
  dealStage,
  attendees,
  preCallComplete,
  preCallRunning,
  onViewFullAnalysis,
  onStartPreCall,
}) => {
  const [data, setData] = useState<PreCallData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!preCallComplete || !meetingId) return;
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiGet(`/api/meetings/${meetingId}/pre-call-research`);
        if (!cancelled) {
          const payload = response?.data?.data ?? response?.data ?? response;
          setData(payload || null);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Failed to load prep data');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => {
      cancelled = true;
    };
  }, [preCallComplete, meetingId]);

  // State A: Pre-call not run
  if (!preCallComplete && !preCallRunning) {
    return (
      <Paper
        variant="outlined"
        sx={{
          p: 2.5,
          borderRadius: 3,
          border: '2px dashed rgba(255,255,255,0.15)',
          bgcolor: 'rgba(255,255,255,0.03)',
          mb: 2,
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Psychology sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 20 }} />
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>
              Run Pre-Call Research to get a quick prep summary for{' '}
              <strong style={{ color: 'rgba(255,255,255,0.7)' }}>{companyName}</strong>
            </Typography>
          </Stack>
          <Button
            size="small"
            variant="outlined"
            startIcon={<PlayArrow />}
            onClick={onStartPreCall}
            sx={{ textTransform: 'none', borderRadius: 2 }}
          >
            Start Pre-Call
          </Button>
        </Stack>
      </Paper>
    );
  }

  // State B: Pre-call running
  if (preCallRunning) {
    return (
      <Paper
        variant="outlined"
        sx={{
          p: 2.5,
          borderRadius: 3,
          bgcolor: 'rgba(56, 189, 248, 0.06)',
          border: '1px solid rgba(56, 189, 248, 0.2)',
          mb: 2,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <CircularProgress size={18} sx={{ color: '#38bdf8' }} />
          <Typography variant="body2" sx={{ color: '#7dd3fc' }}>
            Preparing your quick prep summary for <strong>{companyName}</strong>...
          </Typography>
        </Stack>
      </Paper>
    );
  }

  // State C: Loading data
  if (loading) {
    return (
      <Paper
        variant="outlined"
        sx={{
          p: 2.5,
          borderRadius: 3,
          bgcolor: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          mb: 2,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <CircularProgress size={18} />
          <Typography variant="body2" color="text.secondary">
            Loading prep summary...
          </Typography>
        </Stack>
      </Paper>
    );
  }

  // State D: Error
  if (error || !data) {
    return null; // Silently hide if data can't be loaded
  }

  // Extract data for display
  const talkingPoints = extractTalkingPoints(data.company_overview);
  const attendeeInfo = extractAttendeeInfo(data.external_attendees_research, attendees);

  // Risk/watch item
  let riskItem = '';
  if (data.internal_kb_pre_call?.unknowns && data.internal_kb_pre_call.unknowns.length > 0) {
    riskItem = data.internal_kb_pre_call.unknowns[0];
  }

  // Past engagement
  let pastEngagement = '';
  if (data.internal_kb_pre_call?.similarEngagements && data.internal_kb_pre_call.similarEngagements.length > 0) {
    const eng = data.internal_kb_pre_call.similarEngagements[0];
    pastEngagement = eng.title || '';
  } else if (data.internal_kb_pre_call?.pastEngagements) {
    const engText = data.internal_kb_pre_call.pastEngagements;
    if (typeof engText === 'string') {
      const firstLine = engText.split('\n').find((l) => l.trim().length > 10);
      pastEngagement = firstLine?.replace(/^[\s•\-*]+/, '').trim() || '';
    }
  }

  // State E: Populated card
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2.5,
        borderRadius: 3,
        bgcolor: 'rgba(16, 185, 129, 0.04)',
        border: '1px solid rgba(16, 185, 129, 0.2)',
        mb: 2,
      }}
    >
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Psychology sx={{ color: 'success.main', fontSize: 20 }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#e2e8f0' }}>
            Quick Prep: {companyName}
          </Typography>
          {dealStage && (
            <Chip
              label={dealStage}
              size="small"
              color={getStageChipColor(dealStage)}
              variant="outlined"
              sx={{ fontSize: '0.7rem', height: 22 }}
            />
          )}
        </Stack>
        <Button
          size="small"
          endIcon={<ArrowForward />}
          onClick={onViewFullAnalysis}
          sx={{ textTransform: 'none', fontSize: '0.78rem', color: 'success.main' }}
        >
          Full Analysis
        </Button>
      </Stack>

      {/* 3-column content */}
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2.5}
        divider={
          <Box
            sx={{
              borderRight: { md: '1px solid rgba(255,255,255,0.08)' },
              borderBottom: { xs: '1px solid rgba(255,255,255,0.08)', md: 'none' },
            }}
          />
        }
      >
        {/* Column 1: Talking Points */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="caption"
            sx={{ color: 'success.main', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, mb: 1, display: 'block' }}
          >
            Talking Points
          </Typography>
          {talkingPoints.length > 0 ? (
            <Stack spacing={0.5}>
              {talkingPoints.map((point, i) => (
                <Typography
                  key={i}
                  variant="body2"
                  sx={{
                    color: '#cbd5e1',
                    fontSize: '0.8rem',
                    lineHeight: 1.4,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 0.75,
                  }}
                >
                  <Box
                    component="span"
                    sx={{
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      bgcolor: 'success.main',
                      mt: 0.8,
                      flexShrink: 0,
                    }}
                  />
                  {point.length > 120 ? point.slice(0, 120) + '...' : point}
                </Typography>
              ))}
            </Stack>
          ) : (
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem', fontStyle: 'italic' }}>
              No key points extracted
            </Typography>
          )}
        </Box>

        {/* Column 2: Key Attendees */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="caption"
            sx={{ color: 'success.main', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, mb: 1, display: 'block' }}
          >
            Key Attendees
          </Typography>
          <Stack spacing={0.75}>
            {attendeeInfo.map((a, i) => (
              <Stack key={i} direction="row" alignItems="center" spacing={1}>
                <Avatar
                  sx={{
                    width: 24,
                    height: 24,
                    fontSize: '0.65rem',
                    bgcolor: 'rgba(16, 185, 129, 0.2)',
                    color: 'success.main',
                  }}
                >
                  {a.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()}
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ color: '#e2e8f0', fontSize: '0.8rem', fontWeight: 500 }}>
                    {a.name}
                  </Typography>
                  {a.title && (
                    <Typography
                      variant="caption"
                      sx={{
                        color: 'rgba(255,255,255,0.45)',
                        fontSize: '0.7rem',
                        display: 'block',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {a.title}
                    </Typography>
                  )}
                </Box>
              </Stack>
            ))}
            {attendeeInfo.length === 0 && (
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem', fontStyle: 'italic' }}>
                No attendees identified
              </Typography>
            )}
          </Stack>
        </Box>

        {/* Column 3: Watch Items & Past History */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {riskItem && (
            <>
              <Typography
                variant="caption"
                sx={{ color: 'warning.main', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.5, display: 'block' }}
              >
                Watch Item
              </Typography>
              <Stack direction="row" alignItems="flex-start" spacing={0.75} sx={{ mb: 1.5 }}>
                <Warning sx={{ color: 'warning.main', fontSize: 16, mt: 0.2 }} />
                <Typography variant="body2" sx={{ color: '#fbbf24', fontSize: '0.8rem', lineHeight: 1.4 }}>
                  {riskItem.length > 100 ? riskItem.slice(0, 100) + '...' : riskItem}
                </Typography>
              </Stack>
            </>
          )}

          {pastEngagement && (
            <>
              <Typography
                variant="caption"
                sx={{ color: '#8b5cf6', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.5, display: 'block' }}
              >
                Past Engagement
              </Typography>
              <Stack direction="row" alignItems="flex-start" spacing={0.75}>
                <History sx={{ color: '#8b5cf6', fontSize: 16, mt: 0.2 }} />
                <Typography variant="body2" sx={{ color: '#a78bfa', fontSize: '0.8rem', lineHeight: 1.4 }}>
                  {pastEngagement.length > 100 ? pastEngagement.slice(0, 100) + '...' : pastEngagement}
                </Typography>
              </Stack>
            </>
          )}

          {!riskItem && !pastEngagement && (
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem', fontStyle: 'italic' }}>
              No additional context available
            </Typography>
          )}
        </Box>
      </Stack>
    </Paper>
  );
};

export default QuickPrepCard;
