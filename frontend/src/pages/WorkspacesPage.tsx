import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { COLORS } from '../styles/pageStyles';
import {
  Box, Container, Typography, Button, Chip, Stack, Alert, TextField,
  Paper, CircularProgress, Grid, IconButton, Tooltip, Fade, alpha,
  Dialog, DialogTitle, DialogContent, DialogActions,
  LinearProgress, Accordion, AccordionSummary, AccordionDetails,
  Tab, Tabs, Stepper, Step, StepLabel, StepConnector,
} from '@mui/material';
import {
  Add as AddIcon, ArrowBack, OpenInNew, Download, Refresh,
  Psychology, QuestionAnswer, Dashboard, Assessment, ExpandMore,
  CheckCircle, Business, Schedule, Delete,
  AccountTree, TrendingUp, Slideshow,
  Article, Close, GridView, Person,
} from '@mui/icons-material';
import { apiGet, apiPost, apiDelete, apiCall } from '../utils/api';
import { useAppShell } from '../context/AppShellContext';
import SaveBookmarkButton from '../components/SaveBookmarkButton';
import type { EngagementDetail } from '../../../shared/types/workspace';

// ── Theme ────────────────────────────────────────────────────────────────────
const THEME = {
  primary: '#171717',
  accent: '#2563eb',
  purple: '#7c3aed',
  success: '#059669',
  warning: '#f59e0b',
  danger: '#ef4444',
  cyan: '#0891b2',
  pink: '#ec4899',
  slate50: '#f8fafc',
  slate100: '#f1f5f9',
  slate200: '#e2e8f0',
  slate300: '#cbd5e1',
  slate400: '#94a3b8',
  slate500: '#64748b',
  slate600: '#475569',
  slate700: '#334155',
  slate800: '#1e293b',
  slate900: '#0f172a',
};

const card = {
  bgcolor: 'background.paper',
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: 2,
};

// ── Stage config ─────────────────────────────────────────────────────────────
const STAGES = [
  { key: 'pre_workshop', label: 'Pre-Workshop', icon: <Psychology />, color: THEME.accent },
  { key: 'workshop_prep', label: 'Workshop Prep', icon: <Dashboard />, color: THEME.purple },
  { key: 'workshop', label: 'Workshop', icon: <AccountTree />, color: THEME.slate700 },
  { key: 'post_workshop', label: 'Readout', icon: <Assessment />, color: THEME.success },
];

function stageIndex(stage?: string) {
  return STAGES.findIndex((s) => s.key === stage);
}

function StageChip({ stage }: { stage?: string }) {
  const s = STAGES.find((x) => x.key === stage);
  if (!s) return <Chip label="New" size="small" variant="outlined" sx={{ fontSize: 11 }} />;
  return (
    <Chip
      label={s.label}
      size="small"
      sx={{ bgcolor: alpha(s.color, 0.1), color: s.color, fontWeight: 600, fontSize: 11, border: `1px solid ${alpha(s.color, 0.25)}` }}
    />
  );
}

function StatusDot({ status }: { status?: string }) {
  const color = status === 'completed' ? THEME.success : status === 'running' ? THEME.accent : status === 'error' ? THEME.danger : THEME.slate400;
  return (
    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color, flexShrink: 0,
      ...(status === 'running' ? { animation: 'pulse 1.5s infinite' } : {}) }} />
  );
}

// ── Polling hook ─────────────────────────────────────────────────────────────
function useEngagementPoll(id: string | undefined, onUpdate: (data: EngagementDetail) => void) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startPoll = useCallback(() => {
    if (!id || timerRef.current) return;
    timerRef.current = setInterval(async () => {
      try {
        const res = await apiGet(`/api/workspaces/${id}/engagement`);
        onUpdate(res.data);
        const d = res.data;
        const running =
          d.workshop_prep_miro_status === 'running' ||
          d.agent_mapping_status === 'running' ||
          ['analyzing', 'miro_generating', 'pptx_generating'].includes(d.status || '');
        if (!running) {
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = null;
        }
      } catch { /* silent */ }
    }, 3000);
  }, [id, onUpdate]);

  const stopPoll = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  useEffect(() => () => stopPoll(), [stopPoll]);
  return { startPoll, stopPoll };
}

// ═════════════════════════════════════════════════════════════════════════════
// LIST VIEW
// ═════════════════════════════════════════════════════════════════════════════

interface EngagementListItem {
  workspace_id: string;
  name: string;
  client_name?: string;
  engagement_stage?: string;
  status?: string;
  updated_at?: string;
  is_saved?: boolean;
  workspace_type?: string;
}

function EngagementCard({ item, onClick }: { item: EngagementListItem; onClick: () => void }) {
  const ago = item.updated_at
    ? (() => {
        const diff = Date.now() - new Date(item.updated_at).getTime();
        const h = Math.floor(diff / 3600000);
        if (h < 1) return 'just now';
        if (h < 24) return `${h}h ago`;
        return `${Math.floor(h / 24)}d ago`;
      })()
    : null;

  const isLegacy = item.workspace_type && item.workspace_type !== 'client_engagement';

  return (
    <Paper
      onClick={onClick}
      sx={{
        ...card, p: 2.5, cursor: 'pointer',
        transition: 'all 0.15s',
        '&:hover': { borderColor: THEME.accent, boxShadow: `0 0 0 1px ${THEME.accent}` },
      }}
    >
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
        <Stack spacing={0.5} flex={1} minWidth={0}>
          <Typography fontWeight={600} fontSize={14} noWrap>{item.name}</Typography>
          {item.client_name && (
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Business sx={{ fontSize: 12, color: THEME.slate400 }} />
              <Typography fontSize={12} color="text.secondary" noWrap>{item.client_name}</Typography>
            </Stack>
          )}
        </Stack>
        <Stack direction="row" alignItems="center" spacing={1} flexShrink={0}>
          {isLegacy
            ? <Chip label={item.workspace_type?.replace(/_/g, ' ')} size="small" sx={{ fontSize: 10, height: 20 }} />
            : <StageChip stage={item.engagement_stage} />}
          <SaveBookmarkButton modelType="workspace" id={item.workspace_id} isSaved={item.is_saved || false} />
        </Stack>
      </Stack>
      {ago && (
        <Stack direction="row" alignItems="center" spacing={0.5} mt={1.5}>
          <Schedule sx={{ fontSize: 11, color: THEME.slate400 }} />
          <Typography fontSize={11} color="text.secondary">{ago}</Typography>
        </Stack>
      )}
    </Paper>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// STAGE PANELS
// ═════════════════════════════════════════════════════════════════════════════

function SectionCard({ title, subtitle, icon, action, children }: {
  title: string; subtitle?: string; icon?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <Paper sx={{ ...card, p: 0, overflow: 'hidden' }}>
      <Stack
        direction="row" alignItems="center" justifyContent="space-between"
        sx={{ px: 2.5, py: 1.75, borderBottom: '1px solid', borderColor: 'divider', bgcolor: THEME.slate50 }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5}>
          {icon && <Box sx={{ color: THEME.accent, display: 'flex' }}>{icon}</Box>}
          <Box>
            <Typography fontWeight={600} fontSize={13}>{title}</Typography>
            {subtitle && <Typography fontSize={11} color="text.secondary">{subtitle}</Typography>}
          </Box>
        </Stack>
        {action}
      </Stack>
      <Box sx={{ p: 2.5 }}>{children}</Box>
    </Paper>
  );
}

// ── Stage 1: Pre-Workshop ─────────────────────────────────────────────────────
function PreWorkshopTab({ engagement, engagementId, onRefresh }: {
  engagement: EngagementDetail | null; engagementId: string; onRefresh: () => void;
}) {
  const { showMessage } = useAppShell();
  const [intelRunning, setIntelRunning] = useState(false);
  const [surveyRunning, setSurveyRunning] = useState(false);
  const savedFocus = (engagement as any)?.workshop_focus as 'ITSM' | 'HRSD' | 'HRSD_ITSM' | undefined;
  const [surveyFocus, setSurveyFocus] = useState<'ITSM' | 'HRSD' | 'HRSD_ITSM'>(savedFocus || 'ITSM');
  useEffect(() => { if (savedFocus) setSurveyFocus(savedFocus); }, [savedFocus]);
  const [dlLoading, setDlLoading] = useState(false);
  const intelPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const surveyPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Tracks what generatedAt was when a run was kicked off.
  // null  → first run (no prior data): stop as soon as any intel arrives
  // string → re-run: stop only when intel.generatedAt changes to something different
  // '__rerun__' → re-run on old data with no generatedAt: stop when new data has any generatedAt
  const intelVersionRef = useRef<string | null>(null);
  const surveyVersionRef = useRef<string | null>(null);

  const d = engagement as any;
  const intel = d?.client_intelligence ?? d?.clientIntelligence ?? null;
  const survey = d?.preworkshop_survey ?? d?.preworkshopSurvey ?? null;

  // Stop polling when NEW intel arrives
  useEffect(() => {
    if (intel && intelRunning) {
      const v = intelVersionRef.current;
      // v===null means first run → any intel is "new"
      // v==='__rerun__' means re-run on data with no generatedAt → stop when generatedAt appears
      // v===<iso> means re-run on data with generatedAt → stop when it changes
      const isDone = v === null
        || (v === '__rerun__' && !!intel.generatedAt)
        || (v !== '__rerun__' && !!intel.generatedAt && intel.generatedAt !== v);
      if (isDone) {
        setIntelRunning(false);
        intelVersionRef.current = null;
        if (intelPollRef.current) { clearInterval(intelPollRef.current); intelPollRef.current = null; }
      }
    }
  }, [intel, intelRunning]);

  // Stop polling when NEW survey arrives
  useEffect(() => {
    if (survey && surveyRunning) {
      const v = surveyVersionRef.current;
      const isDone = v === null
        || (v === '__rerun__' && !!survey.generatedAt)
        || (v !== '__rerun__' && !!survey.generatedAt && survey.generatedAt !== v);
      if (isDone) {
        setSurveyRunning(false);
        surveyVersionRef.current = null;
        if (surveyPollRef.current) { clearInterval(surveyPollRef.current); surveyPollRef.current = null; }
      }
    }
  }, [survey, surveyRunning]);

  // Cleanup on unmount
  useEffect(() => () => {
    if (intelPollRef.current) clearInterval(intelPollRef.current);
    if (surveyPollRef.current) clearInterval(surveyPollRef.current);
  }, []);

  const runIntelligence = async () => {
    if (!engagement?.client_name) { showMessage({ type: 'warning', message: 'Set a client name first' }); return; }
    // Capture version: null (first run), existing generatedAt (re-run), or sentinel (re-run on old data with no timestamp)
    intelVersionRef.current = intel ? (intel.generatedAt ?? '__rerun__') : null;
    setIntelRunning(true);
    try {
      await apiPost(`/api/workspaces/${engagementId}/intelligence`, {});
      intelPollRef.current = setInterval(onRefresh, 4000);
    } catch {
      showMessage({ type: 'error', message: 'Failed to start intelligence research' });
      intelVersionRef.current = null;
      setIntelRunning(false);
    }
  };

  const runSurvey = async () => {
    surveyVersionRef.current = survey ? (survey.generatedAt ?? '__rerun__') : null;
    setSurveyRunning(true);
    try {
      await apiPost(`/api/workspaces/${engagementId}/survey`, { focusArea: surveyFocus });
      surveyPollRef.current = setInterval(onRefresh, 4000);
    } catch {
      showMessage({ type: 'error', message: 'Failed to generate survey' });
      surveyVersionRef.current = null;
      setSurveyRunning(false);
    }
  };

  const downloadSurvey = async () => {
    setDlLoading(true);
    try {
      const res = await apiCall(`/api/workspaces/${engagementId}/survey/download`, { method: 'GET' });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(engagement as any)?.client_name || 'Workshop'}_PreWorkshop_Survey.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { showMessage({ type: 'error', message: 'Failed to download survey' }); }
    finally { setDlLoading(false); }
  };

  return (
    <Stack spacing={2.5}>
      {/* Client Intelligence */}
      <SectionCard
        title="Client Intelligence"
        subtitle="Deep research on the client — used to contextualise the survey and Miro board"
        action={
          <Button
            size="small" variant={intel ? 'outlined' : 'contained'} startIcon={intelRunning ? <CircularProgress size={14} /> : <Refresh />}
            onClick={runIntelligence} disabled={intelRunning}
            sx={{ fontSize: 12, ...(intel ? {} : { bgcolor: THEME.accent }) }}
          >
            {intelRunning ? 'Researching…' : intel ? 'Re-run' : 'Run Research'}
          </Button>
        }
      >
        {intelRunning ? (
          <Stack spacing={1.5}>
            <LinearProgress sx={{ borderRadius: 1 }} />
            <Typography fontSize={12} color="text.secondary">
              Running web research on {engagement?.client_name} — synthesising intelligence brief… This takes ~20–40 seconds.
            </Typography>
          </Stack>
        ) : !intel ? (
          <Typography fontSize={13} color="text.secondary">
            Click <strong>Run Research</strong> to build a client intelligence brief from public sources and internal knowledge.
          </Typography>
        ) : (
          <Stack spacing={2}>
            {/* Overview */}
            {intel.companyOverview && (
              <Box sx={{ p: 2, bgcolor: alpha(THEME.accent, 0.04), borderRadius: 1.5, border: `1px solid ${alpha(THEME.accent, 0.12)}` }}>
                <Typography fontSize={13} color="text.primary" sx={{ lineHeight: 1.7 }}>{intel.companyOverview}</Typography>
              </Box>
            )}

            {/* Company basics */}
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Stack spacing={1}>
                  <InfoRow label="Industry" value={intel.industry} />
                  <InfoRow label="Size" value={intel.size} />
                  <InfoRow label="Business Model" value={intel.businessModel} />
                  {intel.hqLocation && <InfoRow label="HQ" value={intel.hqLocation} />}
                </Stack>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                {intel.techStack?.length > 0 && (
                  <Box>
                    <Typography fontSize={11} color="text.secondary" fontWeight={500} mb={0.5}>Tech Stack</Typography>
                    <Stack direction="row" flexWrap="wrap" gap={0.5}>
                      {intel.techStack.map((t: string) => (
                        <Chip key={t} label={t} size="small" sx={{ fontSize: 10, height: 20 }} />
                      ))}
                    </Stack>
                  </Box>
                )}
              </Grid>
            </Grid>

            {/* Key leadership */}
            {intel.keyLeadership?.length > 0 && (
              <Box>
                <Typography fontSize={11} color="text.secondary" fontWeight={500} mb={0.75}>Key Leadership</Typography>
                <Stack direction="row" flexWrap="wrap" gap={1}>
                  {intel.keyLeadership.map((l: any, i: number) => (
                    <Box key={i} sx={{ px: 1.5, py: 0.75, borderRadius: 1.5, bgcolor: alpha(THEME.slate700, 0.06), border: `1px solid ${alpha(THEME.slate400, 0.2)}` }}>
                      <Typography fontSize={12} fontWeight={600}>{l.name}</Typography>
                      <Typography fontSize={10} color="text.secondary">{l.title}</Typography>
                      {l.relevance && <Typography fontSize={10} color={THEME.purple} sx={{ fontStyle: 'italic' }}>{l.relevance}</Typography>}
                    </Box>
                  ))}
                </Stack>
              </Box>
            )}

            {/* Recent developments */}
            {intel.recentDevelopments?.length > 0 && (
              <BulletList label="Recent Developments" items={intel.recentDevelopments.slice(0, 4)} color={THEME.cyan} />
            )}

            {/* Strategic initiatives */}
            {intel.strategicInitiatives?.length > 0 && (
              <BulletList label="Strategic Initiatives" items={intel.strategicInitiatives.slice(0, 5)} color={THEME.purple} />
            )}

            {/* ServiceNow maturity */}
            {intel.servicenowMaturitySignals?.length > 0 && (
              <BulletList label="ServiceNow Maturity Signals" items={intel.servicenowMaturitySignals} color={THEME.accent} />
            )}

            {/* AI adoption signals */}
            {intel.aiAdoptionSignals?.length > 0 && (
              <BulletList label="Technology & Automation Signals" items={intel.aiAdoptionSignals} color={THEME.slate600} />
            )}

            {/* Pain points + operational friction */}
            {intel.painPointHypotheses?.length > 0 && (
              <BulletList label="Pain Point Hypotheses" items={intel.painPointHypotheses.slice(0, 6)} color={THEME.danger} />
            )}
            {intel.operationalFriction?.length > 0 && (
              <BulletList label="Operational Friction" items={intel.operationalFriction.slice(0, 4)} color={THEME.warning} />
            )}

            {/* Workshop objective hypotheses */}
            {intel.workshopObjectiveHypotheses?.length > 0 && (
              <Box sx={{ p: 1.5, bgcolor: alpha(THEME.success, 0.04), borderRadius: 1.5, border: `1px solid ${alpha(THEME.success, 0.15)}` }}>
                <Typography fontSize={11} fontWeight={600} color={THEME.success} mb={0.5}>Workshop Objective Hypotheses</Typography>
                <Stack spacing={0.5}>
                  {intel.workshopObjectiveHypotheses.map((h: string, i: number) => (
                    <Stack key={i} direction="row" spacing={1} alignItems="flex-start">
                      <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: THEME.success, mt: 0.75, flexShrink: 0 }} />
                      <Typography fontSize={12} color="text.primary" sx={{ lineHeight: 1.5 }}>{h}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            )}

            {/* Regulatory context */}
            {intel.regulatoryContext && intel.regulatoryContext !== 'null' && (
              <Box sx={{ p: 1.5, bgcolor: alpha(THEME.warning, 0.05), borderRadius: 1.5, border: `1px solid ${alpha(THEME.warning, 0.2)}` }}>
                <Typography fontSize={11} fontWeight={600} color={THEME.warning} mb={0.25}>Regulatory & Compliance Context</Typography>
                <Typography fontSize={12} color="text.secondary">{intel.regulatoryContext}</Typography>
              </Box>
            )}

            {/* Competitive pressures */}
            {intel.competitivePressures?.length > 0 && (
              <BulletList label="Competitive Pressures" items={intel.competitivePressures} color={THEME.slate600} />
            )}
          </Stack>
        )}
      </SectionCard>

      {/* Pre-Workshop Survey */}
      <SectionCard
        title="Pre-Workshop Survey"
        subtitle="Generated contextually from client intelligence — sent to stakeholders before the workshop"

        action={
          <Stack direction="row" spacing={1} alignItems="center">
            {/* Focus selector */}
            <Stack direction="row" spacing={0.5}>
              {(['ITSM', 'HRSD', 'HRSD_ITSM'] as const).map((f) => (
                <Chip
                  key={f}
                  label={f === 'HRSD_ITSM' ? 'HRSD + ITSM' : f}
                  size="small"
                  onClick={() => setSurveyFocus(f)}
                  variant={surveyFocus === f ? 'filled' : 'outlined'}
                  sx={{
                    fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    bgcolor: surveyFocus === f ? THEME.accent : 'transparent',
                    color: surveyFocus === f ? '#fff' : 'text.secondary',
                    borderColor: surveyFocus === f ? THEME.accent : 'divider',
                    '&:hover': { borderColor: THEME.accent, color: THEME.accent },
                  }}
                />
              ))}
            </Stack>
            {survey && (
              <Button size="small" variant="outlined" startIcon={dlLoading ? <CircularProgress size={14} /> : <Download />}
                onClick={downloadSurvey} disabled={dlLoading} sx={{ fontSize: 12 }}>
                Download DOCX
              </Button>
            )}
            <Button
              size="small" variant={survey ? 'outlined' : 'contained'} startIcon={surveyRunning ? <CircularProgress size={14} /> : <QuestionAnswer />}
              onClick={runSurvey} disabled={surveyRunning || !intel}
              sx={{ fontSize: 12, ...(!survey && intel ? { bgcolor: THEME.accent } : {}) }}
            >
              {surveyRunning ? 'Generating…' : survey ? 'Regenerate' : 'Generate Survey'}
            </Button>
          </Stack>
        }
      >
        {surveyRunning ? (
          <Stack spacing={1.5}>
            <LinearProgress sx={{ borderRadius: 1 }} />
            <Typography fontSize={12} color="text.secondary">
              Generating contextual 7-section survey tailored to {engagement?.client_name}… This takes ~15–30 seconds.
            </Typography>
          </Stack>
        ) : !intel && !survey ? (
          <Typography fontSize={13} color="text.secondary">Run client intelligence first, then generate the survey.</Typography>
        ) : intel && !survey ? (
          <Typography fontSize={13} color="text.secondary">
            Intelligence is ready. Click <strong>Generate Survey</strong> to create a contextual questionnaire for {engagement?.client_name}.
          </Typography>
        ) : null}
        {survey && (
          <Stack spacing={1.5}>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <CheckCircle sx={{ fontSize: 16, color: THEME.success }} />
              <Typography fontSize={13} fontWeight={600}>{survey.sections?.length} sections · {survey.sections?.reduce((n: number, s: any) => n + (s.questions?.length || 0), 0)} questions generated</Typography>
            </Stack>
            {survey.sections?.map((sec: any) => (
              <Accordion key={sec.title} disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px !important', '&:before': { display: 'none' } }}>
                <AccordionSummary expandIcon={<ExpandMore />} sx={{ minHeight: 44, px: 2, '& .MuiAccordionSummary-content': { my: 0.5 } }}>
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <Typography fontSize={13} fontWeight={600}>{sec.title}</Typography>
                    <Chip label={`${sec.questions?.length} Q`} size="small" sx={{ fontSize: 10, height: 18 }} />
                  </Stack>
                </AccordionSummary>
                <AccordionDetails sx={{ pt: 0, pb: 2, px: 2 }}>
                  {sec.description && <Typography fontSize={12} color="text.secondary" mb={1}>{sec.description}</Typography>}
                  <Stack spacing={1}>
                    {sec.questions?.map((q: any, qi: number) => (
                      <Box key={q.id} sx={{ pl: 1.5, borderLeft: '2px solid', borderColor: alpha(THEME.accent, 0.3) }}>
                        <Typography fontSize={12} fontWeight={500}>{qi + 1}. {q.question}</Typography>
                        {q.contextHint && <Typography fontSize={11} color="text.secondary" sx={{ fontStyle: 'italic', mt: 0.25 }}>{q.contextHint}</Typography>}
                        {q.type === 'multiple_choice' || q.type === 'checkbox' ? (
                          <Stack direction="row" flexWrap="wrap" gap={0.5} mt={0.5}>
                            {q.options?.map((o: string) => <Chip key={o} label={o} size="small" sx={{ fontSize: 10, height: 18 }} />)}
                          </Stack>
                        ) : q.type === 'rating' ? (
                          <Stack direction="row" spacing={0.5} mt={0.5}>
                            {['1','2','3','4','5'].map((n) => <Chip key={n} label={n} size="small" sx={{ fontSize: 10, height: 18 }} />)}
                          </Stack>
                        ) : null}
                      </Box>
                    ))}
                  </Stack>
                </AccordionDetails>
              </Accordion>
            ))}
          </Stack>
        )}
      </SectionCard>
    </Stack>
  );
}

// Ordered generation steps — keys must match PPTX_STEP in workshopPrepPptx.service.ts
const DECK_STEPS = [
  { key: 'batch_cover_z1', label: 'Cover + Zone 1: Current State Assessment', slides: 9 },
  { key: 'batch_z2_z3',    label: 'Zone 2–3: AI Opportunities + Constraints',  slides: 7 },
  { key: 'batch_z4_z5',    label: 'Zone 4–5: Personas + Journey Blueprint',    slides: 8 },
  { key: 'batch_z6_z7',    label: 'Zone 6–7: TISDA + Ideation',                slides: 7 },
  { key: 'batch_z8_close', label: 'Zone 8–9 + Closing Slides',                 slides: 9 },
  { key: 'rendering',      label: 'Rendering PowerPoint file',                 slides: null },
  { key: 'uploading',      label: 'Saving to cloud storage',                   slides: null },
] as const;

// ── Stage 2: Workshop Prep ────────────────────────────────────────────────────
function WorkshopPrepTab({ engagement, engagementId, onRefresh }: {
  engagement: EngagementDetail | null; engagementId: string; onRefresh: () => void;
}) {
  const { showMessage } = useAppShell();
  const [responsesText, setResponsesText] = useState('');
  const [savingResp, setSavingResp] = useState(false);
  const [miroBusy, setMiroBusy] = useState(false);
  const [deckBusy, setDeckBusy] = useState(false);

  const miroStatus = (engagement as any)?.workshop_prep_miro_status;
  const miroUrl = (engagement as any)?.workshop_prep_miro_url;
  const savedResponses = (engagement as any)?.survey_responses;
  const deckStatus = (engagement as any)?.workshop_prep_pptx_status;
  const deckJobId = (engagement as any)?.workshop_prep_pptx_job_id;
  const deckStep = (engagement as any)?.workshop_prep_pptx_step as string | null;

  // Poll every 3s while deck is generating
  useEffect(() => {
    if (deckStatus !== 'running') return;
    const iv = setInterval(onRefresh, 3000);
    return () => clearInterval(iv);
  }, [deckStatus, onRefresh]);

  const saveResponses = async () => {
    if (!responsesText.trim()) return;
    setSavingResp(true);
    try {
      await apiPost(`/api/workspaces/${engagementId}/survey/responses`, {
        responses: { respondentName: 'Multiple respondents', submittedAt: new Date().toISOString(), rawText: responsesText.trim(), responses: [] },
      });
      showMessage({ type: 'success', message: 'Survey responses saved' });
      onRefresh();
    } catch { showMessage({ type: 'error', message: 'Failed to save responses' }); }
    finally { setSavingResp(false); }
  };

  const generateMiro = async () => {
    setMiroBusy(true);
    try {
      await apiPost(`/api/workspaces/${engagementId}/prep-miro`, {});
      showMessage({ type: 'info', message: 'Miro board generation started' });
      onRefresh();
      setTimeout(onRefresh, 8000);
      setTimeout(onRefresh, 20000);
      setTimeout(onRefresh, 40000);
    } catch { showMessage({ type: 'error', message: 'Failed to start Miro generation' }); }
    finally { setMiroBusy(false); }
  };

  const generateDeck = async () => {
    setDeckBusy(true);
    try {
      await apiPost(`/api/workspaces/${engagementId}/prep-pptx`, {});
      showMessage({ type: 'info', message: 'Slide deck generation started — this takes ~2 minutes' });
      onRefresh();
      setTimeout(onRefresh, 15000);
      setTimeout(onRefresh, 45000);
      setTimeout(onRefresh, 90000);
    } catch { showMessage({ type: 'error', message: 'Failed to start deck generation' }); }
    finally { setDeckBusy(false); }
  };

  const downloadDeck = () => {
    window.open(`/api/workspaces/${engagementId}/prep-pptx-download`, '_blank');
  };

  return (
    <Stack spacing={2.5}>
      {/* Survey Responses */}
      <SectionCard
        title="Pre-Workshop Survey Responses"
        subtitle="Paste or upload client survey responses — these are used to enrich the Miro board and agent mapping"

        action={
          <Button size="small" variant="contained" onClick={saveResponses} disabled={savingResp || !responsesText.trim()} sx={{ fontSize: 12, bgcolor: THEME.accent }}>
            {savingResp ? <CircularProgress size={14} /> : 'Save'}
          </Button>
        }
      >
        {savedResponses && (
          <Alert severity="success" sx={{ mb: 1.5, fontSize: 12 }} icon={<CheckCircle sx={{ fontSize: 16 }} />}>
            Survey responses saved. Re-paste below to update.
          </Alert>
        )}
        <TextField
          multiline minRows={5} fullWidth size="small"
          placeholder={`Paste survey responses here — free text, bullet points, or structured answers.\n\nExample:\n• CMDB accuracy: about 70%, lots of stale records\n• Virtual Agent: deployed but low adoption, users prefer email\n• Biggest pain: manual triage taking 40% of L1 time\n• Goal: reduce MTTR by 30% in next 6 months`}
          value={responsesText}
          onChange={(e) => setResponsesText(e.target.value)}
          sx={{ fontSize: 13 }}
        />
      </SectionCard>

      {/* Workshop Prep Slide Deck */}
      <SectionCard
        title="Workshop Preparation Deck"
        subtitle="AI-generated facilitator deck mirroring the 9-zone Miro structure — present before transitioning to the board. Includes current state, personas, TISDA examples, hypothesis use cases, and a pre-seeded value–feasibility matrix."
        action={
          <Stack direction="row" spacing={1}>
            {deckStatus === 'completed' && deckJobId && (
              <Button size="small" variant="outlined" endIcon={<Download />} onClick={downloadDeck} sx={{ fontSize: 12 }}>
                Download Deck
              </Button>
            )}
            <Button
              size="small" variant="contained"
              startIcon={deckBusy || deckStatus === 'running' ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : <Slideshow />}
              onClick={generateDeck} disabled={deckBusy || deckStatus === 'running'}
              sx={{ fontSize: 12, bgcolor: THEME.accent }}
            >
              {deckStatus === 'running' ? 'Generating…' : deckStatus === 'completed' ? 'Regenerate' : 'Generate Deck'}
            </Button>
          </Stack>
        }
      >
        {deckStatus === 'running' && (() => {
          // -1 when step hasn't been written yet (pre-first-batch window); treat as idx 0 active
          const currentIdx = Math.max(0, DECK_STEPS.findIndex((s) => s.key === deckStep));
          const completedSlides = DECK_STEPS.slice(0, currentIdx).reduce((sum, s) => sum + (s.slides ?? 0), 0);
          return (
            <Stack spacing={1.5}>
              <Box>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.75 }}>
                  <Typography fontSize={11} fontWeight={600} color="text.secondary">
                    Step {currentIdx + 1} of {DECK_STEPS.length}
                  </Typography>
                  {completedSlides > 0 && (
                    <Typography fontSize={11} color={THEME.success} fontWeight={600}>
                      {completedSlides} slides generated
                    </Typography>
                  )}
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={Math.round((currentIdx / DECK_STEPS.length) * 100)}
                  sx={{ borderRadius: 1, height: 6 }}
                />
              </Box>
              <Stack spacing={0.5}>
                {DECK_STEPS.map((step, idx) => {
                  const isDone = idx < currentIdx;
                  const isActive = idx === currentIdx;
                  return (
                    <Stack
                      key={step.key}
                      direction="row"
                      alignItems="center"
                      spacing={1.25}
                      sx={{
                        px: 1.25, py: 0.75, borderRadius: 1.5,
                        bgcolor: isActive ? alpha(THEME.accent, 0.06) : 'transparent',
                        border: isActive ? `1px solid ${alpha(THEME.accent, 0.2)}` : '1px solid transparent',
                        transition: 'all 0.2s',
                      }}
                    >
                      <Box sx={{ width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {isDone ? (
                          <CheckCircle sx={{ fontSize: 15, color: THEME.success }} />
                        ) : isActive ? (
                          <CircularProgress size={13} thickness={5} sx={{ color: THEME.accent }} />
                        ) : (
                          <Box sx={{ width: 7, height: 7, borderRadius: '50%', border: '1.5px solid', borderColor: 'divider' }} />
                        )}
                      </Box>
                      <Typography
                        fontSize={12}
                        color={isDone ? 'text.secondary' : isActive ? 'text.primary' : 'text.disabled'}
                        fontWeight={isActive ? 600 : 400}
                        sx={{ flex: 1 }}
                      >
                        {step.label}
                      </Typography>
                      <Typography fontSize={11} sx={{ flexShrink: 0 }}>
                        {isDone && step.slides ? (
                          <Box component="span" sx={{ color: THEME.success }}>{step.slides} slides ✓</Box>
                        ) : isActive && step.slides ? (
                          <Box component="span" sx={{ color: 'text.disabled' }}>{step.slides} slides</Box>
                        ) : null}
                      </Typography>
                    </Stack>
                  );
                })}
              </Stack>
              <Typography fontSize={11} color="text.disabled">
                Using GPT-4o · ~40 slides total · typically 3–5 minutes
              </Typography>
            </Stack>
          );
        })()}
        {deckStatus === 'completed' && (
          <Stack spacing={2}>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <CheckCircle sx={{ fontSize: 16, color: THEME.success }} />
              <Typography fontSize={13} fontWeight={600}>Facilitation deck ready</Typography>
            </Stack>
            <Grid container spacing={1}>
              {[
                { zone: 'Zone 1', desc: 'Current State Assessment' },
                { zone: 'Zone 2', desc: 'AI Opportunity Scoping' },
                { zone: 'Zone 3', desc: 'Constraints & Risk Landscape' },
                { zone: 'Zone 4', desc: 'Persona Development' },
                { zone: 'Zone 5', desc: 'Service Journey Blueprint' },
                { zone: 'Zone 6', desc: 'TISDA Flow Mapping' },
                { zone: 'Zone 7', desc: 'Ideation — Diverge → Shape → Commit' },
                { zone: 'Zone 8', desc: 'Use Case Consolidation' },
                { zone: 'Zone 9', desc: 'Value–Feasibility Matrix' },
              ].map((z) => (
                <Grid size={{ xs: 6, sm: 4 }} key={z.zone}>
                  <Stack direction="row" alignItems="center" spacing={1}
                    sx={{ p: 1, bgcolor: alpha(THEME.accent, 0.05), borderRadius: 1.5, border: `1px solid ${alpha(THEME.accent, 0.15)}` }}>
                    <Chip label={z.zone} size="small" sx={{ fontSize: 9, height: 18, bgcolor: alpha(THEME.accent, 0.12), color: THEME.accent }} />
                    <Typography fontSize={11} color="text.primary">{z.desc}</Typography>
                  </Stack>
                </Grid>
              ))}
            </Grid>
          </Stack>
        )}
        {(!deckStatus || deckStatus === 'pending') && (
          <Typography fontSize={13} color="text.secondary">
            Click <strong>Generate Deck</strong> to create the facilitator slide deck. The deck will use client intelligence and survey responses to pre-populate all 9 zones.
          </Typography>
        )}
        {deckStatus === 'error' && (
          <Alert severity="error" sx={{ mt: 1 }}>Deck generation failed. Check the pipeline log and try again.</Alert>
        )}
      </SectionCard>

      {/* Miro Board */}
      <SectionCard
        title="Workshop Facilitation Miro Board"
        subtitle="9-zone facilitation board pre-populated with client context: Current State → Opportunities → Constraints → Personas → Journey → TISDA → Ideation → Use Cases → Prioritization"

        action={
          <Stack direction="row" spacing={1}>
            {miroUrl && (
              <Button size="small" variant="outlined" endIcon={<OpenInNew />} href={miroUrl} target="_blank" sx={{ fontSize: 12 }}>
                Open Board
              </Button>
            )}
            <Button
              size="small" variant="contained" startIcon={miroBusy || miroStatus === 'running' ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : <Dashboard />}
              onClick={generateMiro} disabled={miroBusy || miroStatus === 'running'}
              sx={{ fontSize: 12, bgcolor: THEME.purple }}
            >
              {miroStatus === 'running' ? 'Generating…' : miroUrl ? 'Regenerate' : 'Generate Miro Board'}
            </Button>
          </Stack>
        }
      >
        {!miroUrl && miroStatus !== 'running' && (
          <Typography fontSize={13} color="text.secondary">
            Click <strong>Generate Miro Board</strong> to create the facilitation board. If survey responses have been saved, they will be pre-populated in the board.
          </Typography>
        )}
        {miroStatus === 'running' && (
          <Stack spacing={1.5}>
            <LinearProgress sx={{ borderRadius: 1 }} />
            <Typography fontSize={12} color="text.secondary">Building 9-zone facilitation board — this takes ~1–2 minutes…</Typography>
          </Stack>
        )}
        {miroUrl && miroStatus === 'completed' && (
          <Stack spacing={2}>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <CheckCircle sx={{ fontSize: 16, color: THEME.success }} />
              <Typography fontSize={13} fontWeight={600}>Miro board ready</Typography>
            </Stack>
            <Grid container spacing={1}>
              {[
                { label: 'Zone 1', desc: 'Current State Assessment' },
                { label: 'Zone 2', desc: 'AI Opportunity Scoping' },
                { label: 'Zone 3', desc: 'Constraints & Risks' },
                { label: 'Zone 4', desc: 'Persona Development' },
                { label: 'Zone 5', desc: 'Service Journey Blueprint' },
                { label: 'Zone 6', desc: 'TISDA Flow Mapping' },
                { label: 'Zone 7', desc: 'Ideation Sessions' },
                { label: 'Zone 8', desc: 'Use Case Consolidation' },
                { label: 'Zone 9', desc: 'Value–Feasibility Matrix' },
              ].map((z) => (
                <Grid size={{ xs: 6, sm: 4 }} key={z.label}>
                  <Stack direction="row" alignItems="center" spacing={1}
                    sx={{ p: 1, bgcolor: alpha(THEME.purple, 0.05), borderRadius: 1.5, border: `1px solid ${alpha(THEME.purple, 0.15)}` }}>
                    <Chip label={z.label} size="small" sx={{ fontSize: 9, height: 18, bgcolor: alpha(THEME.purple, 0.12), color: THEME.purple }} />
                    <Typography fontSize={11} color="text.primary">{z.desc}</Typography>
                  </Stack>
                </Grid>
              ))}
            </Grid>
          </Stack>
        )}
      </SectionCard>
    </Stack>
  );
}

// ── Stage 3: Workshop ─────────────────────────────────────────────────────────

interface WorkshopPersona { id: string; name: string; title: string; }
interface WorkshopPainPoint { id: string; text: string; personaId?: string; }

function WorkshopTab({ engagement, engagementId, onRefresh }: {
  engagement: EngagementDetail | null; engagementId: string; onRefresh: () => void;
}) {
  const { showMessage } = useAppShell();

  // ── Personas state ─────────────────────────────────────────────────────────
  const savedPersonas: WorkshopPersona[] = (engagement as any)?.workshop_personas || [];
  const [personas, setPersonas] = useState<WorkshopPersona[]>(savedPersonas);
  const [personaName, setPersonaName] = useState('');
  const [personaTitle, setPersonaTitle] = useState('');
  const [savingPersonas, setSavingPersonas] = useState(false);

  // ── Pain points state ──────────────────────────────────────────────────────
  const savedPainPoints: WorkshopPainPoint[] = (engagement as any)?.workshop_pain_points || [];
  const [painPoints, setPainPoints] = useState<WorkshopPainPoint[]>(savedPainPoints);
  const [ppText, setPpText] = useState('');
  const [ppPersonaId, setPpPersonaId] = useState('');
  const [savingPainPoints, setSavingPainPoints] = useState(false);

  // ── Mapping state ──────────────────────────────────────────────────────────
  const personaMappings: any[] = (engagement as any)?.persona_mappings || [];
  const mappingStatus = (engagement as any)?.persona_mapping_status;

  // ── Service recommendations ────────────────────────────────────────────────
  const serviceMappings: any[] = (engagement as any)?.service_mappings || [];
  const serviceMappingStatus = (engagement as any)?.service_mapping_status;
  const [serviceMappingBusy, setServiceMappingBusy] = useState(false);

  // Sync from engagement on load
  useEffect(() => { setPersonas((engagement as any)?.workshop_personas || []); }, [engagement?.workspace_id]);
  useEffect(() => { setPainPoints((engagement as any)?.workshop_pain_points || []); }, [engagement?.workspace_id]);

  const savePersonas = async (updated: WorkshopPersona[]) => {
    setSavingPersonas(true);
    try {
      await apiPost(`/api/workspaces/${engagementId}/workshop/personas`, { personas: updated });
    } catch { showMessage({ type: 'error', message: 'Failed to save personas' }); }
    finally { setSavingPersonas(false); }
  };

  const savePainPointsToServer = async (updated: WorkshopPainPoint[]) => {
    setSavingPainPoints(true);
    try {
      await apiPost(`/api/workspaces/${engagementId}/workshop/pain-points`, { painPoints: updated });
    } catch { showMessage({ type: 'error', message: 'Failed to save pain points' }); }
    finally { setSavingPainPoints(false); }
  };

  const addPersona = () => {
    if (!personaName.trim() || !personaTitle.trim()) return;
    const updated = [...personas, { id: `p_${Date.now()}`, name: personaName.trim(), title: personaTitle.trim() }];
    setPersonas(updated);
    setPersonaName(''); setPersonaTitle('');
    savePersonas(updated);
  };

  const removePersona = (id: string) => {
    const updated = personas.filter((p) => p.id !== id);
    setPersonas(updated);
    savePersonas(updated);
    // Unassign pain points that referenced this persona
    const updatedPP = painPoints.map((pp) => pp.personaId === id ? { ...pp, personaId: undefined } : pp);
    setPainPoints(updatedPP);
    savePainPointsToServer(updatedPP);
  };

  const addPainPoint = () => {
    if (!ppText.trim()) return;
    const updated = [...painPoints, { id: `pp_${Date.now()}`, text: ppText.trim(), personaId: ppPersonaId || undefined }];
    setPainPoints(updated);
    setPpText('');
    savePainPointsToServer(updated);
  };

  const removePainPoint = (id: string) => {
    const updated = painPoints.filter((p) => p.id !== id);
    setPainPoints(updated);
    savePainPointsToServer(updated);
  };

  const runPersonaMapping = async () => {
    try {
      await apiPost(`/api/workspaces/${engagementId}/workshop/generate-persona-mapping`, {});
      showMessage({ type: 'info', message: 'Mapping started — results in ~30 seconds' });
      onRefresh();
      setTimeout(onRefresh, 10000);
      setTimeout(onRefresh, 25000);
      setTimeout(onRefresh, 45000);
    } catch { showMessage({ type: 'error', message: 'Failed to start mapping' }); }
  };

  const runServiceMap = async () => {
    setServiceMappingBusy(true);
    try {
      await apiPost(`/api/workspaces/${engagementId}/map-services`, {});
      onRefresh();
      setTimeout(onRefresh, 10000);
      setTimeout(onRefresh, 30000);
    } catch { showMessage({ type: 'error', message: 'Failed to start service mapping' }); }
    finally { setServiceMappingBusy(false); }
  };

  const aiMomentColors: Record<string, string> = {
    assist: THEME.accent, automate: THEME.purple, advise: THEME.warning, answer: THEME.success,
  };

  const phaseColors: Record<string, string> = {
    'Phase 0': THEME.slate700, 'Phase 1': THEME.accent, 'Phase 2': THEME.purple,
    'Phase 3': THEME.warning, 'Phase 4': THEME.success, 'Phase 5': THEME.slate600,
    'Phase 6': THEME.danger, 'Phase 7': THEME.slate500,
  };
  const getPhaseColor = (phase: string) => {
    const key = Object.keys(phaseColors).find((k) => phase?.startsWith(k));
    return key ? phaseColors[key] : THEME.accent;
  };

  const canGenerate = personas.length > 0 && painPoints.length > 0;

  return (
    <Stack spacing={2.5}>

      {/* ── Quick Capture: Personas + Pain Points ─────────────────────────── */}
      <Paper elevation={0} sx={{ ...card, p: 0, overflow: 'hidden' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between"
          sx={{ px: 2.5, py: 1.75, borderBottom: '1px solid', borderColor: 'divider', bgcolor: THEME.slate50 }}>
          <Box>
            <Typography fontWeight={600} fontSize={13}>Workshop Capture</Typography>
            <Typography fontSize={11} color="text.secondary">Add personas and pain points discovered during the session</Typography>
          </Box>
          <Button
            size="small" variant="contained"
            startIcon={mappingStatus === 'running' ? <CircularProgress size={13} sx={{ color: '#fff' }} /> : <AccountTree />}
            onClick={runPersonaMapping}
            disabled={!canGenerate || mappingStatus === 'running'}
            sx={{ fontSize: 12, bgcolor: THEME.accent, flexShrink: 0 }}
          >
            {mappingStatus === 'running' ? 'Generating…' : personaMappings.length > 0 ? 'Re-generate Mapping' : 'Generate User Stories & Agent Mapping'}
          </Button>
        </Stack>

        <Grid container sx={{ p: 2.5 }} spacing={2.5}>
          {/* Personas column */}
          <Grid size={{ xs: 12, md: 5 }}>
            <Typography fontSize={12} fontWeight={600} color="text.secondary" textTransform="uppercase" letterSpacing={0.6} mb={1.5}>
              Personas {personas.length > 0 && `(${personas.length})`}
            </Typography>

            {/* Inline add form */}
            <Stack spacing={1} mb={1.5}>
              <TextField
                size="small" fullWidth placeholder="Name — e.g. Sarah Chen"
                value={personaName} onChange={(e) => setPersonaName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && personaTitle && addPersona()}
                inputProps={{ style: { fontSize: 13 } }}
              />
              <Stack direction="row" spacing={1}>
                <TextField
                  size="small" fullWidth placeholder="Title — e.g. IT Service Manager"
                  value={personaTitle} onChange={(e) => setPersonaTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && personaName && addPersona()}
                  inputProps={{ style: { fontSize: 13 } }}
                />
                <Button
                  variant="contained" size="small" onClick={addPersona}
                  disabled={!personaName.trim() || !personaTitle.trim() || savingPersonas}
                  sx={{ minWidth: 40, px: 1.5, bgcolor: THEME.accent, flexShrink: 0 }}
                >
                  {savingPersonas ? <CircularProgress size={13} sx={{ color: '#fff' }} /> : <AddIcon sx={{ fontSize: 16 }} />}
                </Button>
              </Stack>
            </Stack>

            {/* Persona list */}
            <Stack spacing={1}>
              {personas.length === 0 && (
                <Typography fontSize={12} color="text.disabled">No personas added yet.</Typography>
              )}
              {personas.map((p) => (
                <Stack key={p.id} direction="row" alignItems="center" justifyContent="space-between"
                  sx={{ px: 1.5, py: 1, borderRadius: 1.5, border: `1px solid ${THEME.slate200}`, bgcolor: 'background.paper' }}>
                  <Stack direction="row" alignItems="center" spacing={1.25}>
                    <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: alpha(THEME.accent, 0.1),
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Person sx={{ fontSize: 14, color: THEME.accent }} />
                    </Box>
                    <Box>
                      <Typography fontSize={12} fontWeight={600} lineHeight={1.3}>{p.name}</Typography>
                      <Typography fontSize={11} color="text.secondary">{p.title}</Typography>
                    </Box>
                  </Stack>
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <Chip
                      label={`${painPoints.filter((pp) => pp.personaId === p.id).length} pts`}
                      size="small" sx={{ fontSize: 10, height: 18 }}
                    />
                    <IconButton size="small" onClick={() => removePersona(p.id)} sx={{ color: THEME.slate400, '&:hover': { color: THEME.danger } }}>
                      <Delete sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Stack>
                </Stack>
              ))}
            </Stack>
          </Grid>

          {/* Pain points column */}
          <Grid size={{ xs: 12, md: 7 }}>
            <Typography fontSize={12} fontWeight={600} color="text.secondary" textTransform="uppercase" letterSpacing={0.6} mb={1.5}>
              Pain Points {painPoints.length > 0 && `(${painPoints.length})`}
            </Typography>

            {/* Inline add form */}
            <Stack spacing={1} mb={1.5}>
              <Stack direction="row" spacing={1}>
                <TextField
                  size="small" fullWidth
                  placeholder="Describe a pain point — e.g. Manual ticket triage takes 40% of L1 time"
                  value={ppText} onChange={(e) => setPpText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addPainPoint()}
                  inputProps={{ style: { fontSize: 13 } }}
                />
                <Button
                  variant="contained" size="small" onClick={addPainPoint}
                  disabled={!ppText.trim() || savingPainPoints}
                  sx={{ minWidth: 40, px: 1.5, bgcolor: THEME.accent, flexShrink: 0 }}
                >
                  {savingPainPoints ? <CircularProgress size={13} sx={{ color: '#fff' }} /> : <AddIcon sx={{ fontSize: 16 }} />}
                </Button>
              </Stack>
              {personas.length > 0 && (
                <Stack direction="row" spacing={0.75} flexWrap="wrap">
                  <Chip
                    label="Unassigned" size="small" onClick={() => setPpPersonaId('')}
                    variant={ppPersonaId === '' ? 'filled' : 'outlined'}
                    sx={{ fontSize: 11, height: 24, cursor: 'pointer',
                      bgcolor: ppPersonaId === '' ? THEME.slate700 : 'transparent',
                      color: ppPersonaId === '' ? 'white' : 'text.secondary' }}
                  />
                  {personas.map((p) => (
                    <Chip key={p.id} label={p.name} size="small" onClick={() => setPpPersonaId(p.id)}
                      variant={ppPersonaId === p.id ? 'filled' : 'outlined'}
                      sx={{ fontSize: 11, height: 24, cursor: 'pointer',
                        bgcolor: ppPersonaId === p.id ? THEME.accent : 'transparent',
                        color: ppPersonaId === p.id ? 'white' : 'text.secondary',
                        borderColor: ppPersonaId === p.id ? THEME.accent : 'divider' }}
                    />
                  ))}
                </Stack>
              )}
            </Stack>

            {/* Pain point list */}
            <Stack spacing={0.75}>
              {painPoints.length === 0 && (
                <Typography fontSize={12} color="text.disabled">No pain points added yet.</Typography>
              )}
              {painPoints.map((pp) => {
                const persona = pp.personaId ? personas.find((p) => p.id === pp.personaId) : null;
                return (
                  <Stack key={pp.id} direction="row" alignItems="center" justifyContent="space-between" spacing={1}
                    sx={{ px: 1.5, py: 0.875, borderRadius: 1.5, border: `1px solid ${THEME.slate200}`, bgcolor: 'background.paper' }}>
                    <Typography fontSize={12} flex={1}>{pp.text}</Typography>
                    <Stack direction="row" alignItems="center" spacing={0.5} flexShrink={0}>
                      {persona && (
                        <Chip label={persona.name} size="small"
                          sx={{ fontSize: 10, height: 18, bgcolor: alpha(THEME.accent, 0.08), color: THEME.accent }} />
                      )}
                      <IconButton size="small" onClick={() => removePainPoint(pp.id)} sx={{ color: THEME.slate400, '&:hover': { color: THEME.danger } }}>
                        <Delete sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Stack>
                  </Stack>
                );
              })}
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {/* ── Mapping Results ────────────────────────────────────────────────── */}
      {(mappingStatus === 'running' || personaMappings.length > 0) && (
        <SectionCard
          title="User Stories & Agent Mapping"
          subtitle="Generated from workshop personas and pain points"
        >
          {mappingStatus === 'running' && (
            <Stack spacing={1.5}>
              <LinearProgress sx={{ borderRadius: 1 }} />
              <Typography fontSize={12} color="text.secondary">
                Generating user stories and matching ServiceNow agents for each persona…
              </Typography>
            </Stack>
          )}
          {personaMappings.length > 0 && mappingStatus !== 'running' && (
            <Stack spacing={2}>
              {personaMappings.map((pm: any, i: number) => (
                <Box key={i} sx={{ borderRadius: 2, border: `1px solid ${THEME.slate200}`, overflow: 'hidden' }}>
                  {/* Persona header */}
                  <Stack direction="row" alignItems="center" spacing={1.5}
                    sx={{ px: 2, py: 1.25, bgcolor: THEME.slate50, borderBottom: `1px solid ${THEME.slate200}` }}>
                    <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: alpha(THEME.accent, 0.1),
                      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Person sx={{ fontSize: 14, color: THEME.accent }} />
                    </Box>
                    <Box>
                      <Typography fontSize={13} fontWeight={700}>{pm.persona?.name}</Typography>
                      <Typography fontSize={11} color="text.secondary">{pm.persona?.title}</Typography>
                    </Box>
                    <Chip label={`${pm.userStories?.length || 0} user stories`} size="small" sx={{ ml: 'auto', fontSize: 10, height: 20 }} />
                  </Stack>

                  <Box sx={{ p: 2 }}>
                    {/* User stories */}
                    {pm.userStories?.length > 0 && (
                      <Box mb={2}>
                        <Typography fontSize={11} fontWeight={600} color="text.secondary" textTransform="uppercase" letterSpacing={0.6} mb={1}>
                          User Stories
                        </Typography>
                        <Stack spacing={0.75}>
                          {pm.userStories.map((story: string, si: number) => (
                            <Box key={si} sx={{ px: 1.5, py: 1, borderRadius: 1.5, bgcolor: alpha(THEME.accent, 0.04), border: `1px solid ${alpha(THEME.accent, 0.12)}` }}>
                              <Typography fontSize={12} sx={{ lineHeight: 1.5 }}>{story}</Typography>
                            </Box>
                          ))}
                        </Stack>
                      </Box>
                    )}

                    {/* Pain points → agents */}
                    {pm.painPoints?.length > 0 && (
                      <Box>
                        <Typography fontSize={11} fontWeight={600} color="text.secondary" textTransform="uppercase" letterSpacing={0.6} mb={1}>
                          Pain Points & Agent Recommendations
                        </Typography>
                        <Stack spacing={1.5}>
                          {pm.painPoints.map((pp: any, pi: number) => (
                            <Box key={pi}>
                              <Typography fontSize={12} fontWeight={500} color="text.primary" mb={0.75}>
                                {pp.text}
                              </Typography>
                              <Stack spacing={0.75} pl={1.5} sx={{ borderLeft: `2px solid ${THEME.slate200}` }}>
                                {pp.agents?.map((agent: any, ai: number) => (
                                  <Stack key={ai} direction="row" spacing={1.5} alignItems="flex-start">
                                    <Chip
                                      label={(agent.aiMomentType || 'assist').toUpperCase()} size="small"
                                      sx={{ fontSize: 9, height: 18, mt: 0.25, flexShrink: 0,
                                        bgcolor: alpha(aiMomentColors[agent.aiMomentType] || THEME.accent, 0.1),
                                        color: aiMomentColors[agent.aiMomentType] || THEME.accent, fontWeight: 700 }}
                                    />
                                    <Box>
                                      <Typography fontSize={12} fontWeight={600}>{agent.name}</Typography>
                                      <Typography fontSize={11} color="text.secondary">{agent.category}</Typography>
                                      {agent.rationale && (
                                        <Typography fontSize={11} color="text.secondary" sx={{ fontStyle: 'italic', mt: 0.25 }}>{agent.rationale}</Typography>
                                      )}
                                    </Box>
                                  </Stack>
                                ))}
                              </Stack>
                            </Box>
                          ))}
                        </Stack>
                      </Box>
                    )}
                  </Box>
                </Box>
              ))}
            </Stack>
          )}
        </SectionCard>
      )}

      {/* ── Northstar Integrators Service Recommendations ────────────────────────────────── */}
      <SectionCard
        title="Northstar Integrators Service Recommendations"
        subtitle="Matches client context and pain points to relevant Northstar Integrators AI-First Operating Model services"
        action={
          <Button
            size="small" variant={serviceMappings.length > 0 ? 'outlined' : 'contained'}
            startIcon={serviceMappingBusy || serviceMappingStatus === 'running' ? <CircularProgress size={14} sx={{ color: 'inherit' }} /> : <TrendingUp />}
            onClick={runServiceMap} disabled={serviceMappingBusy || serviceMappingStatus === 'running'}
            sx={{ fontSize: 12, ...(serviceMappings.length === 0 && { bgcolor: THEME.accent }) }}
          >
            {serviceMappingStatus === 'running' ? 'Analysing…' : serviceMappings.length > 0 ? 'Re-analyse' : 'Recommend Services'}
          </Button>
        }
      >
        {serviceMappingStatus === 'running' && (
          <Stack spacing={1}>
            <LinearProgress sx={{ borderRadius: 1 }} />
            <Typography fontSize={12} color="text.secondary">Matching to Northstar Integrators AI-First Operating Model service catalog…</Typography>
          </Stack>
        )}
        {serviceMappings.length === 0 && serviceMappingStatus !== 'running' && (
          <Typography fontSize={13} color="text.secondary">
            Click <strong>Recommend Services</strong> to surface the most relevant Northstar Integrators services for this engagement.
          </Typography>
        )}
        {serviceMappings.length > 0 && (() => {
          const seenServices = new Map<string, { service: any; bestScore: number; rationale: string; matchedSignals: string[]; recommendedAs: string; contextItem: string }>();
          for (const m of serviceMappings) {
            for (const match of m.matchedServices || []) {
              const svc = match.service;
              const existing = seenServices.get(svc.id);
              if (!existing || match.relevanceScore > existing.bestScore) {
                seenServices.set(svc.id, { service: svc, bestScore: match.relevanceScore, rationale: match.rationale,
                  matchedSignals: match.matchedSignals || [], recommendedAs: match.recommendedAs || 'primary', contextItem: m.contextItem });
              }
            }
          }
          const uniqueServices = Array.from(seenServices.values()).sort((a, b) => b.bestScore - a.bestScore);
          return (
            <Stack spacing={1.5}>
              <Typography fontSize={12} color="text.secondary">
                {uniqueServices.length} services recommended
              </Typography>
              {uniqueServices.map((item, i) => (
                <Accordion key={i} disableGutters elevation={0}
                  sx={{ border: `1px solid ${THEME.slate200}`, borderRadius: '8px !important', '&:before': { display: 'none' } }}>
                  <AccordionSummary expandIcon={<ExpandMore />} sx={{ minHeight: 48, px: 2, '& .MuiAccordionSummary-content': { my: 0.75 } }}>
                    <Stack direction="row" alignItems="center" spacing={1.5} flex={1} pr={1}>
                      <Chip label={item.service.phase?.split('–')[0]?.trim() || 'Phase ?'} size="small"
                        sx={{ fontSize: 9, height: 18, bgcolor: alpha(getPhaseColor(item.service.phase || ''), 0.1),
                          color: getPhaseColor(item.service.phase || ''), fontWeight: 700, flexShrink: 0 }} />
                      <Box flex={1} minWidth={0}>
                        <Typography fontSize={12} fontWeight={600} noWrap>{item.service.name}</Typography>
                        <Typography fontSize={11} color="text.secondary" noWrap>{item.service.primary_sku}</Typography>
                      </Box>
                      <Chip label={`${Math.round(item.bestScore * 100)}%`} size="small"
                        sx={{ fontSize: 10, height: 18, bgcolor: alpha(THEME.success, 0.1), color: THEME.success, fontWeight: 700 }} />
                    </Stack>
                  </AccordionSummary>
                  <AccordionDetails sx={{ pt: 0, pb: 2, px: 2 }}>
                    <Stack spacing={1.5}>
                      <Typography fontSize={12} color="text.secondary">{item.service.description}</Typography>
                      {item.service.outcome && (
                        <Box sx={{ p: 1.5, bgcolor: alpha(THEME.success, 0.04), borderRadius: 1.5, border: `1px solid ${alpha(THEME.success, 0.12)}` }}>
                          <Typography fontSize={11} fontWeight={600} color={THEME.success} mb={0.25}>Expected Outcome</Typography>
                          <Typography fontSize={11} color="text.secondary">{item.service.outcome}</Typography>
                        </Box>
                      )}
                      {item.rationale && (
                        <Typography fontSize={11} color="text.secondary" sx={{ fontStyle: 'italic' }}>{item.rationale}</Typography>
                      )}
                    </Stack>
                  </AccordionDetails>
                </Accordion>
              ))}
            </Stack>
          );
        })()}
      </SectionCard>
    </Stack>
  );
}

// ── Stage 4: Post-Workshop Readout ────────────────────────────────────────────
function PostWorkshopTab({ engagement, engagementId, onRefresh }: {
  engagement: EngagementDetail | null; engagementId: string; onRefresh: () => void;
}) {
  const { showMessage } = useAppShell();
  const [transcript, setTranscript] = useState((engagement as any)?.transcript_text || '');
  const [running, setRunning] = useState(false);

  const status = engagement?.status;
  const pipelineRunning = ['analyzing', 'miro_generating', 'pptx_generating'].includes(status || '');
  const analysis = engagement?.analysis_result as any;

  const runPipeline = async () => {
    if (!transcript.trim()) { showMessage({ type: 'warning', message: 'Paste the workshop transcript first' }); return; }
    setRunning(true);
    try {
      // Update transcript then trigger pipeline
      await apiPost(`/api/workspaces/${engagementId}`, { transcriptText: transcript });
      await apiPost(`/api/workspaces/${engagementId}/run`, { runAnalysis: true, runMiro: true, runPptx: true });
      showMessage({ type: 'info', message: 'Readout generation started' });
      onRefresh();
      setTimeout(onRefresh, 10000);
    } catch { showMessage({ type: 'error', message: 'Failed to start readout generation' }); }
    finally { setRunning(false); }
  };

  const pipelineSteps = ['Analysis', 'Miro Board', 'PowerPoint'];
  const stepIndex = status === 'analyzing' ? 0 : status === 'miro_generating' ? 1 : status === 'pptx_generating' ? 2 : status === 'completed' ? 3 : -1;

  return (
    <Stack spacing={2.5}>
      {/* Transcript input */}
      <SectionCard
        title="Workshop Transcript"
        subtitle="Paste the workshop transcript or meeting notes for full analysis"

        action={
          <Button
            size="small" variant="contained"
            startIcon={running || pipelineRunning ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : <Assessment />}
            onClick={runPipeline} disabled={running || pipelineRunning || !transcript.trim()}
            sx={{ fontSize: 12, bgcolor: THEME.success }}
          >
            {pipelineRunning ? 'Generating…' : analysis ? 'Re-generate Readout' : 'Generate Readout'}
          </Button>
        }
      >
        <TextField
          multiline minRows={7} fullWidth size="small"
          placeholder="Paste full workshop transcript here…"
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          sx={{ fontSize: 13 }}
        />
      </SectionCard>

      {/* Pipeline status */}
      {pipelineRunning && (
        <Paper sx={{ ...card, p: 2.5 }}>
          <Stack direction="row" alignItems="center" spacing={1.5} mb={2}>
            <CircularProgress size={16} />
            <Typography fontWeight={600} fontSize={13}>Generating readout deck…</Typography>
          </Stack>
          <Stepper activeStep={stepIndex} alternativeLabel connector={<StepConnector />}>
            {pipelineSteps.map((label) => (
              <Step key={label}><StepLabel><Typography fontSize={11}>{label}</Typography></StepLabel></Step>
            ))}
          </Stepper>
        </Paper>
      )}

      {/* Links */}
      {(engagement?.miro_board_url || engagement?.pptx_download_url) && (
        <Paper sx={{ ...card, p: 2.5 }}>
          <Typography fontWeight={600} fontSize={13} mb={1.5}>Readout Deliverables</Typography>
          <Stack direction="row" spacing={1.5} flexWrap="wrap">
            {engagement.miro_board_url && (
              <Button variant="outlined" endIcon={<OpenInNew />} href={engagement.miro_board_url} target="_blank" size="small" sx={{ fontSize: 12 }}>
                Post-Workshop Miro Board
              </Button>
            )}
            {engagement.pptx_download_url && (
              <Button variant="outlined" endIcon={<Download />} href={engagement.pptx_download_url} target="_blank" size="small" sx={{ fontSize: 12 }}>
                Download Readout Deck
              </Button>
            )}
          </Stack>
        </Paper>
      )}

      {/* Analysis summary */}
      {analysis && (
        <SectionCard title="Analysis Summary">
          <Stack spacing={2}>
            <Typography fontSize={13} sx={{ lineHeight: 1.7 }}>{analysis.summary}</Typography>
            {analysis.keyTakeaways?.length > 0 && (
              <BulletList label="Key Takeaways" items={analysis.keyTakeaways.slice(0, 5)} color={THEME.success} />
            )}
          </Stack>
        </SectionCard>
      )}
    </Stack>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <Stack direction="row" spacing={1} alignItems="baseline">
      <Typography fontSize={11} color="text.secondary" fontWeight={500} sx={{ minWidth: 120, flexShrink: 0 }}>{label}</Typography>
      <Typography fontSize={12} color="text.primary">{value}</Typography>
    </Stack>
  );
}

function BulletList({ label, items, color }: { label: string; items: string[]; color: string }) {
  if (!items?.length) return null;
  return (
    <Box>
      <Typography fontSize={11} color="text.secondary" fontWeight={500} mb={0.5}>{label}</Typography>
      <Stack spacing={0.5}>
        {items.map((item, i) => (
          <Stack key={i} direction="row" spacing={1} alignItems="flex-start">
            <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: color, mt: 0.75, flexShrink: 0 }} />
            <Typography fontSize={12} color="text.primary" sx={{ lineHeight: 1.5 }}>{item}</Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═════════════════════════════════════════════════════════════════════════════

export default function WorkspacesPage() {
  const { workspaceId } = useParams<{ workspaceId?: string }>();
  const navigate = useNavigate();
  const { showMessage } = useAppShell();

  const [list, setList] = useState<EngagementListItem[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [engagement, setEngagement] = useState<EngagementDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [stageTab, setStageTab] = useState(0);

  // List tabs
  const [listTab, setListTab] = useState(0);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formClientName, setFormClientName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formFocus, setFormFocus] = useState<'ITSM' | 'HRSD' | 'HRSD_ITSM'>('ITSM');
  const [creating, setCreating] = useState(false);

  // Load list
  const fetchList = useCallback(async () => {
    try {
      setListLoading(true);
      const res = await apiGet('/api/workspaces');
      setList(res.data || []);
    } catch { /* silent */ } finally { setListLoading(false); }
  }, []);

  // Load engagement detail
  const fetchDetail = useCallback(async (id: string) => {
    try {
      setDetailLoading(true);
      const res = await apiGet(`/api/workspaces/${id}/engagement`);
      setEngagement(res.data);
    } catch { /* silent */ } finally { setDetailLoading(false); }
  }, []);

  useEffect(() => { fetchList(); }, [fetchList]);

  useEffect(() => {
    if (workspaceId) {
      fetchDetail(workspaceId);
      // Set initial tab to current stage
    } else {
      setEngagement(null);
    }
  }, [workspaceId, fetchDetail]);

  // Sync tab to engagement stage on load
  useEffect(() => {
    if (!engagement) return;
    const idx = stageIndex((engagement as any).engagement_stage);
    if (idx >= 0) setStageTab(idx);
  }, [engagement?.workspace_id]); // Only on first load

  const { startPoll, stopPoll } = useEngagementPoll(workspaceId, (data) => {
    setEngagement(data);
  });

  useEffect(() => {
    if (!engagement) return;
    const d = engagement as any;
    const running =
      d.workshop_prep_miro_status === 'running' ||
      d.agent_mapping_status === 'running' ||
      ['analyzing', 'miro_generating', 'pptx_generating'].includes(d.status || '');
    if (running) startPoll();
    else stopPoll();
  }, [engagement, startPoll, stopPoll]);

  const handleCreate = async () => {
    if (!formName.trim() || !formClientName.trim()) return;
    setCreating(true);
    try {
      const res = await apiPost('/api/workspaces', {
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        clientName: formClientName.trim(),
        workspaceType: 'client_engagement',
        workshopFocus: formFocus,
        transcriptText: ' ', // placeholder to pass server validation
      });
      const newId = res.data.workspace_id;
      setCreateOpen(false);
      setFormName(''); setFormClientName(''); setFormDescription(''); setFormFocus('ITSM');
      await fetchList();
      navigate(`/app/workspaces/${newId}`);
    } catch { showMessage({ type: 'error', message: 'Failed to create engagement' }); }
    finally { setCreating(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiDelete(`/api/workspaces/${id}`);
      showMessage({ type: 'success', message: 'Engagement deleted' });
      if (workspaceId === id) navigate('/app/workspaces');
      fetchList();
    } catch { showMessage({ type: 'error', message: 'Failed to delete' }); }
  };

  const handleRefresh = useCallback(() => {
    if (workspaceId) fetchDetail(workspaceId);
    fetchList();
  }, [workspaceId, fetchDetail, fetchList]);

  // ── Render: Detail view ───────────────────────────────────────────────────
  if (workspaceId) {
    return (
      <Box sx={{ bgcolor: THEME.slate50, minHeight: '100vh' }}>
        <Container maxWidth="xl" sx={{ py: 4 }}>
          {/* Hero — rounded, inside container */}
          <Paper elevation={0} sx={{ p: 3, mb: 4, borderRadius: 4, background: COLORS.gradient, position: 'relative', overflow: 'hidden' }}>
            <Box sx={{ position: 'absolute', top: 0, right: 0, width: '40%', height: '100%',
              opacity: 0.06, background: 'radial-gradient(circle at 60% 50%, white 0%, transparent 70%)' }} />
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Stack direction="row" alignItems="center" spacing={2}>
                <IconButton size="small" onClick={() => navigate('/app/workspaces')} sx={{ color: alpha('#fff', 0.7), '&:hover': { color: 'white', bgcolor: alpha('#fff', 0.1) } }}>
                  <ArrowBack sx={{ fontSize: 18 }} />
                </IconButton>
                <Box>
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <Typography fontWeight={700} fontSize={17} sx={{ color: 'white' }}>{engagement?.name || '…'}</Typography>
                    <StageChip stage={(engagement as any)?.engagement_stage} />
                  </Stack>
                  {engagement?.client_name && (
                    <Typography fontSize={12} sx={{ color: alpha('#fff', 0.6), mt: 0.25 }}>{engagement.client_name}</Typography>
                  )}
                </Box>
              </Stack>
              <Stack direction="row" spacing={1}>
                <Tooltip title="Refresh">
                  <IconButton size="small" onClick={handleRefresh} disabled={detailLoading} sx={{ color: alpha('#fff', 0.7), '&:hover': { color: 'white', bgcolor: alpha('#fff', 0.1) } }}>
                    <Refresh sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
                <SaveBookmarkButton modelType="workspace" id={workspaceId} isSaved={engagement?.is_saved || false} />
              </Stack>
            </Stack>
          </Paper>

          {detailLoading && !engagement && <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />}

          {/* Legacy workspace view */}
          {engagement && (engagement as any).workspace_type && (engagement as any).workspace_type !== 'client_engagement' ? (
            <Stack spacing={2.5}>
              <Alert severity="info" sx={{ fontSize: 13 }}>
                This is a legacy <strong>{(engagement as any).workspace_type?.replace(/_/g, ' ')}</strong> workspace. Use the Post-Workshop Readout tab above to view analysis results, or create a new engagement for the full lifecycle.
              </Alert>
              <PostWorkshopTab engagement={engagement} engagementId={workspaceId} onRefresh={handleRefresh} />
            </Stack>
          ) : (
            <>
              {/* Stage tabs */}
              <Paper elevation={0} sx={{ borderRadius: 3, border: `1px solid ${THEME.slate200}`, mb: 3 }}>
                <Tabs
                  value={stageTab} onChange={(_, v) => setStageTab(v)}
                  sx={{ px: 2, borderBottom: `1px solid ${THEME.slate200}`,
                    '& .MuiTab-root': { fontSize: 13, fontWeight: 500, minHeight: 48, textTransform: 'none' },
                    '& .Mui-selected': { fontWeight: 700 } }}
                >
                  {STAGES.map((s) => (
                    <Tab key={s.key} label={s.label} />
                  ))}
                </Tabs>
              </Paper>

              <Fade in key={stageTab} timeout={200}>
                <Box>
                  {stageTab === 0 && <PreWorkshopTab engagement={engagement} engagementId={workspaceId} onRefresh={handleRefresh} />}
                  {stageTab === 1 && <WorkshopPrepTab engagement={engagement} engagementId={workspaceId} onRefresh={handleRefresh} />}
                  {stageTab === 2 && <WorkshopTab engagement={engagement} engagementId={workspaceId} onRefresh={handleRefresh} />}
                  {stageTab === 3 && <PostWorkshopTab engagement={engagement} engagementId={workspaceId} onRefresh={handleRefresh} />}
                </Box>
              </Fade>
            </>
          )}
        </Container>
      </Box>
    );
  }

  // ── Render: List view ─────────────────────────────────────────────────────
  const engagements = list.filter((w) => !w.workspace_type || w.workspace_type === 'client_engagement');
  const legacyWorkspaces = list.filter((w) => w.workspace_type && w.workspace_type !== 'client_engagement');

  return (
    <Box sx={{ bgcolor: THEME.slate50, minHeight: '100vh' }}>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        {/* Hero header — rounded, inside container (matches Pre-Call Research style) */}
        <Paper
          elevation={0}
          sx={{
            p: 4, mb: 4, borderRadius: 4,
            background: COLORS.gradient,
            position: 'relative', overflow: 'hidden',
          }}
        >
          <Box sx={{ position: 'absolute', top: 0, right: 0, width: '50%', height: '100%',
            opacity: 0.08, background: 'radial-gradient(circle at 60% 50%, white 0%, transparent 70%)' }} />
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between"
            alignItems={{ xs: 'flex-start', md: 'center' }} spacing={2}>
            <Stack direction="row" spacing={3} alignItems="center">
              <Box sx={{ width: 48, height: 48, borderRadius: 2, bgcolor: alpha('#fff', 0.12),
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <GridView sx={{ fontSize: 24, color: 'white' }} />
              </Box>
              <Box>
                <Typography variant="h5" sx={{ color: 'white', fontWeight: 700, mb: 0.5 }}>
                  Workshop Engagements
                </Typography>
                <Typography variant="body2" sx={{ color: alpha('#fff', 0.75) }}>
                  End-to-end client workshop lifecycle: intelligence → preparation → facilitation → readout
                </Typography>
              </Box>
            </Stack>
            <Button
              variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}
              sx={{ bgcolor: alpha('#fff', 0.15), color: 'white', fontWeight: 600, borderRadius: 2,
                fontSize: 13, flexShrink: 0, '&:hover': { bgcolor: alpha('#fff', 0.25) } }}
            >
              New Engagement
            </Button>
          </Stack>
        </Paper>

        {listLoading && <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />}

        {/* Tab navigation + content panel */}
        <Paper elevation={0} sx={{ borderRadius: 3, border: `1px solid ${THEME.slate200}` }}>
          <Box sx={{ borderBottom: `1px solid ${THEME.slate200}` }}>
            <Tabs
              value={listTab}
              onChange={(_, v) => setListTab(v)}
              sx={{
                px: 2,
                '& .MuiTab-root': { fontSize: 13, fontWeight: 600, textTransform: 'none', minHeight: 48 },
              }}
            >
              <Tab label={`Active Engagements${engagements.length ? ` (${engagements.length})` : ''}`} />
              <Tab label={`Previous Analyses${legacyWorkspaces.length ? ` (${legacyWorkspaces.length})` : ''}`} />
            </Tabs>
          </Box>

          <Box sx={{ p: 3 }}>
            {/* Active Engagements tab */}
            {listTab === 0 && (
              <>
                {engagements.length > 0 && (
                  <>
                    <Stack direction="row" alignItems="center" justifyContent="flex-end" mb={2} flexWrap="wrap" gap={1}>
                      {STAGES.map((s) => (
                        <Stack key={s.key} direction="row" alignItems="center" spacing={0.5}
                          sx={{ px: 1, py: 0.5, borderRadius: 6, bgcolor: alpha(s.color, 0.08), border: `1px solid ${alpha(s.color, 0.2)}` }}>
                          {React.cloneElement(s.icon, { sx: { fontSize: 12, color: s.color } })}
                          <Typography fontSize={10} fontWeight={600} color={s.color}>{s.label}</Typography>
                        </Stack>
                      ))}
                    </Stack>
                    <Grid container spacing={2}>
                      {engagements.map((item) => (
                        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={item.workspace_id}>
                          <EngagementCard item={item} onClick={() => navigate(`/app/workspaces/${item.workspace_id}`)} />
                        </Grid>
                      ))}
                    </Grid>
                  </>
                )}
                {engagements.length === 0 && !listLoading && (
                  <Box sx={{ py: 6, textAlign: 'center' }}>
                    <GridView sx={{ fontSize: 40, color: THEME.slate300, mb: 2 }} />
                    <Typography fontWeight={600} fontSize={15} mb={1}>No engagements yet</Typography>
                    <Typography fontSize={13} color="text.secondary" mb={3}>
                      Create your first engagement to start the AI workshop lifecycle for a client.
                    </Typography>
                    <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}
                      sx={{ bgcolor: THEME.accent, borderRadius: 2, fontSize: 13 }}>
                      New Engagement
                    </Button>
                  </Box>
                )}
              </>
            )}

            {/* Previous Analyses tab */}
            {listTab === 1 && (
              <>
                {legacyWorkspaces.length > 0 && (
                  <Grid container spacing={2}>
                    {legacyWorkspaces.map((item) => (
                      <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={item.workspace_id}>
                        <EngagementCard item={item} onClick={() => navigate(`/app/workspaces/${item.workspace_id}`)} />
                      </Grid>
                    ))}
                  </Grid>
                )}
                {legacyWorkspaces.length === 0 && !listLoading && (
                  <Box sx={{ py: 6, textAlign: 'center' }}>
                    <Typography fontSize={13} color="text.secondary">No previous analyses found.</Typography>
                  </Box>
                )}
              </>
            )}
          </Box>
        </Paper>
      </Container>

      {/* Create dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ pb: 0.5 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography fontWeight={700} fontSize={16}>New Workshop Engagement</Typography>
            <IconButton size="small" onClick={() => setCreateOpen(false)}><Close sx={{ fontSize: 18 }} /></IconButton>
          </Stack>
          <Typography fontSize={12} color="text.secondary" mt={0.25}>
            Create an engagement to manage the full pre → workshop → readout lifecycle for a client.
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2.5}>
            <TextField
              label="Engagement Name" fullWidth size="small" required
              placeholder="e.g. Acme Corp — IT Service Transformation"
              value={formName} onChange={(e) => setFormName(e.target.value)}
            />
            <TextField
              label="Client Name" fullWidth size="small" required
              placeholder="e.g. Acme Corporation"
              value={formClientName} onChange={(e) => setFormClientName(e.target.value)}
            />
            <TextField
              label="Context (optional)" fullWidth size="small" multiline rows={3}
              placeholder="Deal context, ServiceNow scope, focus areas, or any additional background…"
              value={formDescription} onChange={(e) => setFormDescription(e.target.value)}
            />
            <Box>
              <Typography fontSize={12} color="text.secondary" mb={0.75} fontWeight={500}>
                Workshop Focus
              </Typography>
              <Stack direction="row" spacing={1}>
                {([['ITSM', 'ITSM'], ['HRSD', 'HRSD'], ['HRSD_ITSM', 'HRSD + ITSM']] as [typeof formFocus, string][]).map(([val, label]) => (
                  <Chip
                    key={val}
                    label={label}
                    size="small"
                    onClick={() => setFormFocus(val)}
                    variant={formFocus === val ? 'filled' : 'outlined'}
                    sx={{
                      fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      bgcolor: formFocus === val ? THEME.accent : 'transparent',
                      color: formFocus === val ? '#fff' : 'text.secondary',
                      borderColor: formFocus === val ? THEME.accent : 'divider',
                      '&:hover': { borderColor: THEME.accent, color: THEME.accent },
                    }}
                  />
                ))}
              </Stack>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setCreateOpen(false)} sx={{ fontSize: 13 }}>Cancel</Button>
          <Button
            variant="contained" onClick={handleCreate}
            disabled={creating || !formName.trim() || !formClientName.trim()}
            startIcon={creating ? <CircularProgress size={14} /> : <AddIcon />}
            sx={{ bgcolor: THEME.accent, fontSize: 13, fontWeight: 600 }}
          >
            {creating ? 'Creating…' : 'Create Engagement'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
