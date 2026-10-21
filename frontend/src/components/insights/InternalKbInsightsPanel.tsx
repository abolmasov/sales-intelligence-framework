import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Chip,
  IconButton,
  Tooltip,
  Collapse,
  Link,
  Divider,
  Alert,
} from '@mui/material';
import {
  Description,
  Business,
  OpenInNew,
  ExpandMore,
  ExpandLess,
  Lightbulb,
  CheckCircle,
  Warning,
  Info,
  ArticleOutlined,
  FolderSpecial,
  CompareArrows,
  QuestionMark,
} from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import ResponsiveGrid from '../layout/ResponsiveGrid';

/** Styled markdown renderer — clean body-text colours */
const EngagementMarkdown: React.FC<{ children: string }> = ({ children }) => (
  <Box
    sx={{
      '& h1': { fontSize: '1rem',    fontWeight: 700, mt: 2, mb: 0.5, color: '#0f172a' },
      '& h2': { fontSize: '0.9rem',  fontWeight: 700, mt: 1.5, mb: 0.5, color: '#1e293b' },
      '& h3': { fontSize: '0.85rem', fontWeight: 600, mt: 1.25, mb: 0.4, color: '#334155' },
      '& p':  { fontSize: '0.85rem', lineHeight: 1.7,  color: '#475569', mt: 0, mb: 0.75 },
      '& ul, & ol': { pl: 2.5, mb: 0.75, mt: 0 },
      '& li': { fontSize: '0.85rem', lineHeight: 1.7, color: '#475569', mb: 0.15 },
      '& strong': { color: '#1e293b', fontWeight: 600 },
      '& em':  { color: '#64748b', fontStyle: 'italic' },
      '& hr':  { border: 'none', borderTop: '1px solid #f1f5f9', my: 1.25 },
      '& blockquote': {
        borderLeft: '3px solid #cbd5e1',
        pl: 1.25, ml: 0, my: 0.75,
        '& p': { color: '#64748b', fontStyle: 'italic' },
      },
      '& code': { bgcolor: '#f1f5f9', color: '#334155', px: 0.5, borderRadius: 0.5, fontSize: '0.78rem', fontFamily: 'monospace' },
      '& > *:first-child': { mt: 0 },
      '& > *:last-child':  { mb: 0 },
    }}
  >
    <ReactMarkdown>{children}</ReactMarkdown>
  </Box>
);

/** Metric card — matches the 4-column stats row in Company Intelligence */
const StatCard: React.FC<{
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  sub?: string;
}> = ({ icon, iconBg, iconColor, label, value, sub }) => (
  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
    <Box
      sx={{
        width: 40, height: 40, borderRadius: 1.5,
        bgcolor: iconBg, color: iconColor,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {icon}
    </Box>
    <Box>
      <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.7px', display: 'block' }}>
        {label}
      </Typography>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>
        {value}
      </Typography>
      {sub && (
        <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.72rem' }}>
          {sub}
        </Typography>
      )}
    </Box>
  </Box>
);

const ARTIFACT_TYPE_CONFIG: Record<string, { bg: string; border: string; text: string; icon: React.ReactNode; label: string }> = {
  case_study: { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534', icon: <CheckCircle sx={{ fontSize: 14 }} />, label: 'Case Study' },
  proposal:   { bg: '#eef2ff', border: '#c7d2fe', text: '#3730a3', icon: <Description sx={{ fontSize: 14 }} />, label: 'Proposal' },
  sow:        { bg: '#f0fdfa', border: '#99f6e4', text: '#115e59', icon: <ArticleOutlined sx={{ fontSize: 14 }} />, label: 'SOW' },
  playbook:   { bg: '#faf5ff', border: '#e9d5ff', text: '#6b21a8', icon: <FolderSpecial sx={{ fontSize: 14 }} />, label: 'Playbook' },
  document:   { bg: '#f8fafc', border: '#e2e8f0', text: '#334155', icon: <Description sx={{ fontSize: 14 }} />, label: 'Document' },
};

export interface SimilarEngagement {
  title: string;
  url?: string;
  why_relevant: string;
  client?: string;
  industry?: string;
  services?: string[];
  outcome?: string;
}

export interface RelevantArtifact {
  title: string;
  url?: string;
  why_relevant?: string;
  type?: 'case_study' | 'proposal' | 'sow' | 'document' | 'playbook';
  excerpt?: string;
}

export interface InternalKnowledgeData {
  pastEngagements?: string;
  similarEngagements?: SimilarEngagement[];
  relevantArtifacts?: RelevantArtifact[];
  unknowns?: string[];
  rawSummary?: string;
}

interface InternalKbInsightsPanelProps {
  companyName: string;
  data: InternalKnowledgeData;
  showRawSummary?: boolean;
}

const InternalKbInsightsPanel: React.FC<InternalKbInsightsPanelProps> = ({ companyName, data, showRawSummary = false }) => {
  const [expandedEngagement, setExpandedEngagement] = useState<number | null>(null);
  const [showAllSimilar, setShowAllSimilar]           = useState(false);
  const [showRawDetails, setShowRawDetails]           = useState(false);

  const { pastEngagements, similarEngagements, relevantArtifacts, unknowns, rawSummary } = data;

  const hasPastEngagements  = !!pastEngagements?.trim();
  const hasSimilarEngagements = similarEngagements && similarEngagements.length > 0;
  const hasRelevantArtifacts  = relevantArtifacts  && relevantArtifacts.length  > 0;
  const hasUnknowns           = unknowns            && unknowns.length           > 0;
  const hasAnyData = hasPastEngagements || hasSimilarEngagements || hasRelevantArtifacts;

  const hasDirectHistory = hasPastEngagements && (() => {
    const t = pastEngagements!.toLowerCase();
    return t.includes('previously worked') || t.includes('past engagement') ||
           t.includes('prior work')        || t.includes('existing relationship') ||
           t.includes('have worked with')  || t.includes('engaged with');
  })();

  const displayedSimilar = showAllSimilar
    ? (similarEngagements || [])
    : (similarEngagements || []).slice(0, 4);

  // ── Empty state ────────────────────────────────────────────
  if (!hasAnyData) {
    return (
      <Box sx={{ py: 4 }}>
        <Alert severity="info" icon={<Info />}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.25 }}>No Internal Knowledge Found</Typography>
          <Typography variant="body2">Sales Intelligence did not find any prior engagements or similar case studies for {companyName}.</Typography>
        </Alert>
      </Box>
    );
  }

  // ── Main render ────────────────────────────────────────────
  return (
    <Box>

      {/* ── Title ─────────────────────────────────────────── */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: '#0f172a', fontSize: '1.05rem' }}>
          Internal Knowledge Hub
        </Typography>
        <Typography variant="body2" sx={{ color: '#64748b', mt: 0.25 }}>
          Northstar Integrators's prior engagements and relevant internal resources for {companyName}
        </Typography>
      </Box>

      {/* ── Stats row ─────────────────────────────────────── */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
          gap: 3,
          mb: 3,
          pb: 3,
          borderBottom: '1px solid #f1f5f9',
        }}
      >
        <StatCard
          icon={<FolderSpecial sx={{ fontSize: 20 }} />}
          iconBg="#eff6ff" iconColor="#2563eb"
          label="Engagement Status"
          value={hasDirectHistory ? 'Prior Client' : 'New Prospect'}
          sub={hasDirectHistory ? 'Existing relationship' : 'No direct history'}
        />
        <StatCard
          icon={<CompareArrows sx={{ fontSize: 20 }} />}
          iconBg="#f0fdf4" iconColor="#16a34a"
          label="Similar Cases"
          value={hasSimilarEngagements ? String(similarEngagements!.length) : '0'}
          sub={hasSimilarEngagements ? 'Relevant engagements' : 'None found'}
        />
        <StatCard
          icon={<Description sx={{ fontSize: 20 }} />}
          iconBg="#faf5ff" iconColor="#9333ea"
          label="Internal Documents"
          value={hasRelevantArtifacts ? String(relevantArtifacts!.length) : '0'}
          sub={hasRelevantArtifacts ? 'Proposals / case studies' : 'None found'}
        />
        <StatCard
          icon={<QuestionMark sx={{ fontSize: 20 }} />}
          iconBg="#fffbeb" iconColor="#d97706"
          label="Info Gaps"
          value={hasUnknowns ? String(unknowns!.length) : '0'}
          sub={hasUnknowns ? 'Topics not found' : 'No gaps identified'}
        />
      </Box>

      <Stack spacing={3.5}>

        {/* ── Prior Engagement Analysis ──────────────────── */}
        {hasPastEngagements && (
          <Box>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
              {hasDirectHistory
                ? <CheckCircle sx={{ fontSize: 18, color: '#16a34a' }} />
                : <Info        sx={{ fontSize: 18, color: '#2563eb' }} />}
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                Engagement Analysis
              </Typography>
              <Chip
                size="small"
                label={hasDirectHistory ? 'Prior Engagement' : 'New Prospect'}
                sx={{
                  height: 20, fontSize: '0.68rem', fontWeight: 600,
                  bgcolor: hasDirectHistory ? '#f0fdf4' : '#eff6ff',
                  color:   hasDirectHistory ? '#166534' : '#1d4ed8',
                  border: `1px solid ${hasDirectHistory ? '#bbf7d0' : '#bfdbfe'}`,
                }}
              />
            </Stack>
            <EngagementMarkdown>{pastEngagements!}</EngagementMarkdown>
          </Box>
        )}

        {/* ── Similar Engagements ────────────────────────── */}
        {hasSimilarEngagements && (
          <Box>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
              <CompareArrows sx={{ fontSize: 18, color: '#16a34a' }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                Similar Engagements & Case Studies
              </Typography>
              <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                {similarEngagements!.length} found
              </Typography>
            </Stack>
            <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mb: 1.5 }}>
              Based on similar industry, challenges, or solution requirements
            </Typography>

            <Stack spacing={0} sx={{ border: '1px solid #f1f5f9', borderRadius: 2, overflow: 'hidden' }}>
              {displayedSimilar.map((eng, idx) => {
                const isExpanded = expandedEngagement === idx;
                const isLast = idx === displayedSimilar.length - 1;
                return (
                  <Box key={idx}>
                    <Box
                      onClick={() => setExpandedEngagement(isExpanded ? null : idx)}
                      sx={{
                        px: 2.5, py: 2,
                        cursor: 'pointer',
                        bgcolor: isExpanded ? '#f8fafc' : '#fff',
                        display: 'flex', alignItems: 'flex-start', gap: 1.5,
                        '&:hover': { bgcolor: '#f8fafc' },
                        transition: 'background 0.1s',
                      }}
                    >
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: '#0f172a' }}>
                            {eng.title}
                          </Typography>
                          {eng.url && (
                            <Tooltip title="View document">
                              <IconButton
                                size="small"
                                component={Link}
                                href={eng.url}
                                target="_blank"
                                onClick={(e) => e.stopPropagation()}
                                sx={{ p: 0.25, color: '#94a3b8', '&:hover': { color: '#334155' } }}
                              >
                                <OpenInNew sx={{ fontSize: 13 }} />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Stack>
                        <Stack direction="row" alignItems="flex-start" spacing={0.75}>
                          <Lightbulb sx={{ fontSize: 14, color: '#f59e0b', mt: 0.1, flexShrink: 0 }} />
                          <Typography variant="caption" sx={{ color: '#64748b', lineHeight: 1.55 }}>
                            {eng.why_relevant || 'Similar industry or solution area'}
                          </Typography>
                        </Stack>

                        <Collapse in={isExpanded}>
                          <Stack spacing={1} sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid #f1f5f9' }}>
                            {eng.client && (
                              <Stack direction="row" spacing={0.75} alignItems="center">
                                <Business sx={{ fontSize: 14, color: '#94a3b8' }} />
                                <Typography variant="caption" sx={{ color: '#475569' }}>
                                  <strong>Client:</strong> {eng.client}
                                </Typography>
                              </Stack>
                            )}
                            {eng.industry && (
                              <Typography variant="caption" sx={{ color: '#475569' }}>
                                <strong>Industry:</strong> {eng.industry}
                              </Typography>
                            )}
                            {eng.services && eng.services.length > 0 && (
                              <Box>
                                <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', mb: 0.5 }}>
                                  Services Delivered
                                </Typography>
                                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                                  {eng.services.map((s, si) => (
                                    <Chip key={si} size="small" label={s} sx={{ height: 20, fontSize: '0.7rem', bgcolor: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' }} />
                                  ))}
                                </Stack>
                              </Box>
                            )}
                            {eng.outcome && (
                              <Box sx={{ p: 1.5, bgcolor: '#f0fdf4', borderRadius: 1, border: '1px solid #bbf7d0' }}>
                                <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', mb: 0.25 }}>
                                  Outcome
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#166534', lineHeight: 1.55 }}>
                                  {eng.outcome}
                                </Typography>
                              </Box>
                            )}
                          </Stack>
                        </Collapse>
                      </Box>
                      <IconButton size="small" sx={{ p: 0.5, color: '#94a3b8', '&:hover': { color: '#334155', bgcolor: 'transparent' } }}>
                        {isExpanded ? <ExpandLess sx={{ fontSize: 18 }} /> : <ExpandMore sx={{ fontSize: 18 }} />}
                      </IconButton>
                    </Box>
                    {!isLast && <Divider sx={{ borderColor: '#f8fafc' }} />}
                  </Box>
                );
              })}
            </Stack>

            {(similarEngagements?.length || 0) > 4 && (
              <Box sx={{ textAlign: 'center', mt: 1.5 }}>
                <Typography
                  variant="caption"
                  onClick={() => setShowAllSimilar(v => !v)}
                  sx={{ color: '#3b82f6', fontWeight: 600, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                >
                  {showAllSimilar ? 'Show less' : `Show ${(similarEngagements?.length || 0) - 4} more`}
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {/* ── Relevant Documents ────────────────────────── */}
        {hasRelevantArtifacts && (
          <Box>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
              <Description sx={{ fontSize: 18, color: '#9333ea' }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                Relevant Internal Documents
              </Typography>
              <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                {relevantArtifacts!.length} found
              </Typography>
            </Stack>
            <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mb: 1.5 }}>
              Proposals, case studies, SOWs, and playbooks from Northstar Integrators's knowledge base
            </Typography>

            <ResponsiveGrid container spacing={1.5}>
              {relevantArtifacts!.slice(0, 6).map((art, idx) => {
                const tc = ARTIFACT_TYPE_CONFIG[art.type || 'document'] || ARTIFACT_TYPE_CONFIG.document;
                return (
                  <ResponsiveGrid xs={12} sm={6} key={idx}>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2, borderRadius: 1.5, height: '100%',
                        bgcolor: tc.bg,
                        border: `1px solid ${tc.border}`,
                      }}
                    >
                      <Stack spacing={0.75}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                          <Stack direction="row" alignItems="center" spacing={0.5}>
                            <Box sx={{ color: tc.text, display: 'flex' }}>{tc.icon}</Box>
                            <Typography variant="caption" sx={{ color: tc.text, fontWeight: 600, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                              {tc.label}
                            </Typography>
                          </Stack>
                          {art.url && (
                            <Tooltip title="Open document">
                              <IconButton size="small" component={Link} href={art.url} target="_blank" sx={{ p: 0.25, color: '#94a3b8' }}>
                                <OpenInNew sx={{ fontSize: 14 }} />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Stack>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#0f172a', lineHeight: 1.35 }}>
                          {art.title}
                        </Typography>
                        {art.why_relevant && (
                          <Typography variant="caption" sx={{ color: '#475569', lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {art.why_relevant}
                          </Typography>
                        )}
                        {art.excerpt && (
                          <Typography variant="caption" sx={{ color: '#64748b', fontStyle: 'italic', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            "{art.excerpt}"
                          </Typography>
                        )}
                      </Stack>
                    </Paper>
                  </ResponsiveGrid>
                );
              })}
            </ResponsiveGrid>
          </Box>
        )}

        {/* ── Information Gaps ──────────────────────────── */}
        {hasUnknowns && (
          <Box>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
              <QuestionMark sx={{ fontSize: 18, color: '#d97706' }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                Information Gaps
              </Typography>
            </Stack>
            <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mb: 1 }}>
              Sales Intelligence could not find information on the following topics:
            </Typography>
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
              {unknowns!.map((u, idx) => (
                <Chip
                  key={idx}
                  size="small"
                  icon={<Warning sx={{ fontSize: 13 }} />}
                  label={u}
                  sx={{ height: 24, bgcolor: '#fffbeb', color: '#92400e', border: '1px solid #fde68a', fontSize: '0.75rem' }}
                />
              ))}
            </Stack>
          </Box>
        )}

        {/* ── Raw summary (debug) ───────────────────────── */}
        {showRawSummary && rawSummary?.trim() && (
          <Box>
            <Divider sx={{ mb: 1.5 }} />
            <Stack direction="row" alignItems="center" spacing={1} sx={{ cursor: 'pointer' }} onClick={() => setShowRawDetails(v => !v)}>
              <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600 }}>Raw Sales Intelligence Response</Typography>
              <IconButton size="small">{showRawDetails ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}</IconButton>
            </Stack>
            <Collapse in={showRawDetails}>
              <Box sx={{ mt: 1, p: 2, bgcolor: '#f8fafc', borderRadius: 1, fontFamily: 'monospace', fontSize: '0.75rem', whiteSpace: 'pre-wrap', maxHeight: 300, overflow: 'auto', color: '#475569' }}>
                {rawSummary}
              </Box>
            </Collapse>
          </Box>
        )}

      </Stack>
    </Box>
  );
};

export default InternalKbInsightsPanel;
