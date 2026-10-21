import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Paper,
  Chip,
  Stack,
  Collapse,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Link,
} from '@mui/material';
import {
  ExpandMore,
  ExpandLess,
  CheckCircle,
  AutoAwesome,
} from '@mui/icons-material';
import { apiGet } from '../utils/api';
import AIQuestionnaire from './AIQuestionnaire';
import ReactMarkdown from 'react-markdown';

interface PreCallResearchPanelProps {
  meetingId: string;
  companyName?: string;
}

interface PreCallResearchData {
  session_id: string;
  company_name: string | null;
  completed_at: string | null;
  questionnaire: {
    questions: Array<{
      id: number;
      question: string;
      category: string;
      context: string;
      northstar_connection: string;
      product_focus: string;
      target_persona: string;
    }>;
    metadata?: {
      services_count?: number;
      products_count?: number;
      insights_count?: number;
    };
  } | null;
  company_overview: any;
  company_latest_news?: {
    company?: string;
    highlights?: string[];
    unknowns?: string[];
    sources?: Array<{ title: string; url: string; snippet: string }>;
  } | null;
  internal_kb_pre_call?: {
    pastEngagements?: string;
    relevantArtifacts?: Array<{ title: string; url?: string; why_relevant: string }>;
    unknowns?: string[];
  } | null;
  external_attendees_research?: Array<{
    id?: number;
    name: string;
    email: string | null;
    company: string | null;
    status?: string;
    error_message?: string | null;
    last_researched_at?: string | null;
    research?: any;
    sources?: any;
  }>;
}

const PreCallResearchPanel: React.FC<PreCallResearchPanelProps> = ({
  meetingId,
  companyName,
}) => {
  const [data, setData] = useState<PreCallResearchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const fetchPreCallResearch = async () => {
      if (!meetingId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await apiGet(`/api/meetings/${meetingId}/pre-call-research`);
        if (response?.success && response?.data) {
          setData(response.data);
        } else {
          setData(null);
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to load pre-call research');
      } finally {
        setLoading(false);
      }
    };

    fetchPreCallResearch();
  }, [meetingId]);

  if (loading) {
    return (
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <CircularProgress size={20} />
          <Typography variant="body2">Loading pre-call research...</Typography>
        </Stack>
      </Paper>
    );
  }

  if (error) {
    return (
      <Alert severity="error">{error}</Alert>
    );
  }

  if (!data || !data.questionnaire) {
    return (
      <Alert severity="info">
        No pre-call research has been completed for this meeting yet.
      </Alert>
    );
  }

  const questionCount = data.questionnaire?.questions?.length || 0;
  const resolvedCompanyName = data.company_name || companyName || 'Company';
  const externalResearch = Array.isArray(data.external_attendees_research)
    ? data.external_attendees_research
    : [];
  const companyLatestNews = data.company_latest_news || null;
  const internalKbPreCall = data.internal_kb_pre_call || null;

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
      {/* Header */}
      <Box
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          bgcolor: 'success.light',
          borderBottom: expanded ? '1px solid' : 'none',
          borderColor: 'divider',
          cursor: 'pointer',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <Stack direction="row" spacing={2} alignItems="center">
          <CheckCircle color="success" />
          <Box>
            <Typography variant="subtitle1" fontWeight={600}>
              Pre-Call Research Complete
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {resolvedCompanyName} · {questionCount} discovery questions ready
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip
            icon={<AutoAwesome sx={{ fontSize: 16 }} />}
            label="AI Questionnaire"
            size="small"
            color="primary"
            variant="outlined"
          />
          {expanded ? <ExpandLess /> : <ExpandMore />}
        </Stack>
      </Box>

      {/* Expandable Content */}
      <Collapse in={expanded}>
        <Box sx={{ p: 3 }}>
          {data.completed_at && (
            <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
              Research completed: {new Date(data.completed_at).toLocaleString()}
            </Typography>
          )}

          <AIQuestionnaire
            companyName={resolvedCompanyName}
            researchSummary=""
            keyInsights={[]}
            attendeeInfo={[]}
            enterpriseRecommendations={[]}
            recommendedProducts={[]}
            preGeneratedQuestions={data.questionnaire}
          />

          {companyLatestNews && (Array.isArray(companyLatestNews.highlights) || Array.isArray(companyLatestNews.sources)) && (
            <Box sx={{ mt: 4 }}>
              <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
                Company Updates
              </Typography>
              {Array.isArray(companyLatestNews.highlights) && companyLatestNews.highlights.length > 0 ? (
                <Box sx={{ mb: 2 }}>
                  {companyLatestNews.highlights.slice(0, 6).map((item, idx) => (
                    <Typography key={idx} variant="body2" sx={{ mb: 0.5 }}>
                      - {item}
                    </Typography>
                  ))}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  No verified public updates found.
                </Typography>
              )}

              {Array.isArray(companyLatestNews.sources) && companyLatestNews.sources.length > 0 && (
                <Stack direction="row" spacing={1.5} flexWrap="wrap">
                  {companyLatestNews.sources.slice(0, 4).map((source) => (
                    <Link key={source.url || source.title} href={source.url} target="_blank" rel="noreferrer">
                      {source.title || source.url}
                    </Link>
                  ))}
                </Stack>
              )}
            </Box>
          )}

          {internalKbPreCall && (internalKbPreCall.pastEngagements || Array.isArray(internalKbPreCall.relevantArtifacts)) && (
            <Box sx={{ mt: 4 }}>
              <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
                Sales Intelligence History
              </Typography>
              {internalKbPreCall.pastEngagements ? (
                <Box sx={{
                  mb: 2,
                  '& h1': { fontSize: '1.05rem', fontWeight: 700, mt: 2.5, mb: 0.75, color: 'primary.main' },
                  '& h2': { fontSize: '0.95rem', fontWeight: 700, mt: 2, mb: 0.5, color: 'primary.dark' },
                  '& h3': { fontSize: '0.875rem', fontWeight: 600, mt: 1.5, mb: 0.5, color: 'secondary.main' },
                  '& p':  { fontSize: '0.875rem', lineHeight: 1.75, color: 'text.primary', mt: 0, mb: 1 },
                  '& ul, & ol': { pl: 2.5, mb: 1, mt: 0 },
                  '& li': { fontSize: '0.875rem', lineHeight: 1.75, color: 'text.primary' },
                  '& strong': { color: 'primary.dark', fontWeight: 700 },
                  '& em': { fontStyle: 'italic', color: 'text.secondary' },
                  '& hr': { borderColor: 'divider', my: 1.5 },
                  '& blockquote': { borderLeft: '3px solid', borderColor: 'primary.main', pl: 1.5, ml: 0, color: 'text.secondary', fontStyle: 'italic' },
                  '& code': { fontSize: '0.8rem', backgroundColor: 'primary.50', color: 'primary.dark', px: 0.5, borderRadius: 0.5 },
                }}>
                  <ReactMarkdown>{internalKbPreCall.pastEngagements}</ReactMarkdown>
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  No verified internal history found.
                </Typography>
              )}

              {Array.isArray(internalKbPreCall.relevantArtifacts) && internalKbPreCall.relevantArtifacts.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                    Relevant Internal Artifacts
                  </Typography>
                  <Stack spacing={0.75}>
                    {internalKbPreCall.relevantArtifacts.slice(0, 6).map((artifact) => (
                      <Box key={artifact.url || artifact.title}>
                        <Typography variant="body2" fontWeight={600}>
                          {artifact.url ? (
                            <Link href={artifact.url} target="_blank" rel="noreferrer">
                              {artifact.title}
                            </Link>
                          ) : (
                            artifact.title
                          )}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {artifact.why_relevant}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </Box>
              )}

              {Array.isArray(internalKbPreCall.unknowns) && internalKbPreCall.unknowns.length > 0 && (
                <Typography variant="caption" color="text.secondary">
                  Unknowns: {internalKbPreCall.unknowns.join(', ')}
                </Typography>
              )}
            </Box>
          )}

          {externalResearch.length > 0 && (
            <Box sx={{ mt: 4 }}>
              <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
                External Client Person Research
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Public web research for external attendees (verified facts only).
              </Typography>

              <Paper variant="outlined" sx={{ borderRadius: 2, overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Company</TableCell>
                      <TableCell>Role</TableCell>
                      <TableCell>Location</TableCell>
                      <TableCell>Links</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {externalResearch.map((row) => {
                      const research = row.research || {};
                      const role = research.role || null;
                      const location = research.location || null;
                      const linkedinUrl = research.linkedin_url || null;
                      const sources = Array.isArray(research.sources) ? research.sources : [];
                      const primarySource = sources.find((s: any) => s?.url) || null;

                      return (
                        <TableRow key={row.id ?? `${row.name}-${row.email ?? ''}`}>
                          <TableCell>{row.name}</TableCell>
                          <TableCell>{row.email || '—'}</TableCell>
                          <TableCell>{row.company || '—'}</TableCell>
                          <TableCell>{role || '—'}</TableCell>
                          <TableCell>{location || '—'}</TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={1} alignItems="center">
                              {linkedinUrl ? (
                                <Link href={linkedinUrl} target="_blank" rel="noreferrer">
                                  LinkedIn
                                </Link>
                              ) : null}
                              {!linkedinUrl && primarySource?.url ? (
                                <Link href={primarySource.url} target="_blank" rel="noreferrer">
                                  Source
                                </Link>
                              ) : null}
                              {!linkedinUrl && !primarySource?.url ? '—' : null}
                            </Stack>
                          </TableCell>
                          <TableCell>
                            {row.status === 'error' ? (
                              <Chip size="small" color="error" label="error" />
                            ) : (
                              <Chip size="small" color="success" label="completed" />
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Paper>
            </Box>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
};

export default PreCallResearchPanel;
