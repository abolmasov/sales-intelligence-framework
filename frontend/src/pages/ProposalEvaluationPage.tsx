import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Stack,
  CircularProgress,
  Alert,
  Chip,
  Divider,
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Fade,
  Grow,
  Tooltip,
  IconButton,
  Tab,
  Tabs,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import {
  CheckCircle,
  Warning,
  Error as ErrorIcon,
  ExpandMore,
  Download,
  Refresh,
  Analytics,
  Assignment,
  TrendingUp,
  TrendingDown,
  Description,
  InsertDriveFile,
  Delete,
  ArrowForward,
  Psychology,
  FormatQuote,
  Shield,
  Lightbulb,
  EmojiEvents,
  PriorityHigh,
  ContentCopy,
  Star,
  Campaign,
  QuestionAnswer,
  HelpOutline,
  History,
  FolderOpen,
} from '@mui/icons-material';
import { apiGet, apiPostForm } from '../utils/api';
import SaveBookmarkButton from '../components/SaveBookmarkButton';
import ExpiryBadge from '../components/ExpiryBadge';
import FeedbackWidget from '../components/FeedbackWidget';

// Types matching the new backend structure
type RequirementPriority = 'mandatory' | 'important' | 'nice_to_have';

interface RequirementAnalysis {
  requirementId: string;
  requirementText: string;
  section: string;
  category: string;
  priority: RequirementPriority;
  isAddressed: boolean;
  coverageLevel: 'full' | 'partial' | 'none';
  confidence: 'high' | 'medium' | 'low';
  proposalExcerpts: {
    text: string;
    pageOrSection: string;
    relevance: string;
  }[];
  pursuitBriefExcerpts: {
    text: string;
    questionOrSection: string;
    howItHelps: string;
  }[];
  gaps: string[];
  verdict: string;
  suggestedContent?: string;
  suggestedApproach?: string;
  complianceRisk: 'high' | 'medium' | 'low' | 'none';
  complianceNotes?: string;
}

interface SectionAnalysis {
  section: string;
  requirements: RequirementAnalysis[];
  totalCount: number;
  addressedCount: number;
  partialCount: number;
  notAddressedCount: number;
  mandatoryMet: number;
  mandatoryTotal: number;
  complianceScore: number;
  sectionStrengths: string[];
  sectionWeaknesses: string[];
}

interface WinLossInsight {
  category: 'strength' | 'weakness' | 'differentiator' | 'risk';
  title: string;
  description: string;
  impactLevel: 'high' | 'medium' | 'low';
  affectedRequirements: string[];
  recommendation?: string;
}

interface PursuitBriefQuestionAnalysis {
  questionId: string;
  questionText: string;
  isAddressed: boolean;
  coverageLevel: 'full' | 'partial' | 'none';
  proposalEvidence: {
    text: string;
    location: string;
  }[];
  pursuitBriefAnswer?: string;
  assessment: string;
  gaps?: string[];
  suggestedImprovement?: string;
}

interface PursuitBriefAnalysisSummary {
  totalQuestions: number;
  fullyAddressed: number;
  partiallyAddressed: number;
  notAddressed: number;
  coverageScore: number;
  questionAnalysis: PursuitBriefQuestionAnalysis[];
}

interface SavedEvaluationSummary {
  id: string;
  status: string;
  createdAt: string;
  completedAt?: string;
  rfpFileName: string;
  proposalFileName: string;
  pursuitBriefFileName?: string;
  totalRequirements: number;
  complianceScore: number;
  progress?: number;
  isSaved?: boolean;
}

interface EvaluationResult {
  id: string;
  status: 'processing' | 'extracting_requirements' | 'analyzing_coverage' | 'generating_insights' | 'completed' | 'failed';
  progress: number;
  currentStep: string;
  createdAt: string;
  completedAt?: string;
  rfpFileName: string;
  proposalFileName: string;
  pursuitBriefFileName?: string;
  totalRequirements: number;
  analysis: RequirementAnalysis[];
  bySection: SectionAnalysis[];
  summary: {
    totalRequirements: number;
    addressed: number;
    partiallyAddressed: number;
    notAddressed: number;
    mandatoryRequirements: number;
    mandatoryMet: number;
    complianceScore: number;
    byPriority: {
      mandatory: { total: number; met: number };
      important: { total: number; met: number };
      nice_to_have: { total: number; met: number };
    };
  };
  criticalGaps: {
    requirement: string;
    section: string;
    priority: RequirementPriority;
    complianceRisk: string;
    suggestedFix: string;
  }[];
  winLossInsights: WinLossInsight[];
  pursuitBriefAnalysis?: PursuitBriefAnalysisSummary;
  executiveSummary: {
    overallAssessment: string;
    keyStrengths: string[];
    criticalWeaknesses: string[];
    winProbabilityFactors: string[];
    immediateActions: string[];
  };
  error?: string;
}

const COLORS = {
  success: '#059669',
  warning: '#d97706',
  error: '#dc2626',
  primary: '#171717',
  muted: '#737373',
};

// Compliance Score Gauge
const ComplianceGauge: React.FC<{ score: number; label: string }> = ({ score, label }) => {
  const color = score >= 90 ? COLORS.success : score >= 70 ? COLORS.warning : COLORS.error;

  return (
    <Box sx={{ textAlign: 'center' }}>
      <Box sx={{ position: 'relative', display: 'inline-flex' }}>
        <CircularProgress
          variant="determinate"
          value={100}
          size={100}
          thickness={4}
          sx={{ color: '#e5e5e5' }}
        />
        <CircularProgress
          variant="determinate"
          value={score}
          size={100}
          thickness={4}
          sx={{ color, position: 'absolute', left: 0 }}
        />
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
            right: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
          }}
        >
          <Typography variant="h4" sx={{ fontWeight: 700, color }}>{score}%</Typography>
        </Box>
      </Box>
      <Typography variant="body2" sx={{ color: COLORS.muted, mt: 1, fontWeight: 500 }}>{label}</Typography>
    </Box>
  );
};

// File Upload Card
const FileUploadCard: React.FC<{
  title: string;
  description: string;
  hint: string;
  required?: boolean;
  step: number;
  file: File | null;
  onFileSelect: (file: File) => void;
  onFileRemove: () => void;
  accentColor: string;
  icon: React.ReactNode;
}> = ({ title, description, hint, required, step, file, onFileSelect, onFileRemove, accentColor, icon }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  return (
    <Paper
      onClick={() => !file && inputRef.current?.click()}
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      elevation={0}
      sx={{
        position: 'relative',
        cursor: file ? 'default' : 'pointer',
        height: '100%',
        minHeight: 220,
        borderRadius: 2,
        border: '1px solid',
        borderColor: file ? COLORS.success : isDragOver ? accentColor : '#e2e8f0',
        bgcolor: file ? 'rgba(5,150,105,0.03)' : isDragOver ? `${accentColor}08` : '#fff',
        transition: 'all 0.15s ease',
        overflow: 'hidden',
        '&:hover': !file ? { borderColor: accentColor, boxShadow: `0 0 0 3px ${accentColor}14` } : {},
      }}
    >
      {/* Top accent bar */}
      <Box sx={{ height: 3, bgcolor: file ? COLORS.success : accentColor, opacity: file ? 1 : 0.35, transition: 'opacity 0.2s' }} />

      <input
        ref={inputRef}
        type="file"
        hidden
        accept=".pdf,.docx,.doc,.xlsx,.xls,.txt,.md"
        onChange={(e) => e.target.files?.[0] && onFileSelect(e.target.files[0])}
      />

      {file ? (
        <Stack spacing={2} alignItems="center" justifyContent="center" sx={{ p: 3, height: 'calc(100% - 3px)' }}>
          <Box sx={{ width: 56, height: 56, borderRadius: 2, bgcolor: 'rgba(5,150,105,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle sx={{ fontSize: 28, color: COLORS.success }} />
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary', mb: 0.25 }} noWrap>
              {file.name.length > 28 ? file.name.substring(0, 25) + '...' : file.name}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.disabled' }}>
              {(file.size / 1024 / 1024).toFixed(2)} MB · ready to analyze
            </Typography>
          </Box>
          <Button size="small" color="error" startIcon={<Delete sx={{ fontSize: 14 }} />}
            onClick={(e) => { e.stopPropagation(); onFileRemove(); }}
            sx={{ fontSize: '0.75rem' }}>
            Replace
          </Button>
        </Stack>
      ) : (
        <Stack spacing={2} sx={{ p: 3, height: 'calc(100% - 3px)' }}>
          {/* Step number + title row */}
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: accentColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, color: '#fff' }}>{step}</Typography>
            </Box>
            <Box sx={{ flex: 1 }}>
              <Stack direction="row" spacing={0.75} alignItems="center">
                <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary', lineHeight: 1.2 }}>{title}</Typography>
                {required
                  ? <Chip label="Required" size="small" sx={{ height: 16, fontSize: '0.6rem', bgcolor: 'rgba(220,38,38,0.08)', color: COLORS.error, fontWeight: 700 }} />
                  : <Chip label="Optional" size="small" sx={{ height: 16, fontSize: '0.6rem', bgcolor: '#f1f5f9', color: '#64748b', fontWeight: 600 }} />
                }
              </Stack>
              <Typography variant="caption" sx={{ color: 'text.disabled', lineHeight: 1.3 }}>{description}</Typography>
            </Box>
          </Stack>

          {/* Drop zone */}
          <Box sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            border: '1.5px dashed',
            borderColor: isDragOver ? accentColor : '#cbd5e1',
            borderRadius: 1.5,
            p: 2,
            bgcolor: isDragOver ? `${accentColor}06` : 'transparent',
            transition: 'all 0.15s',
          }}>
            <Box sx={{ '& svg': { fontSize: 28, color: isDragOver ? accentColor : '#94a3b8' } }}>{icon}</Box>
            <Typography variant="caption" sx={{ color: '#64748b', textAlign: 'center', fontWeight: 500 }}>
              Drop file here or click to browse
            </Typography>
            <Typography variant="caption" sx={{ color: '#94a3b8', textAlign: 'center', fontSize: '0.68rem' }}>
              {hint}
            </Typography>
          </Box>
        </Stack>
      )}
    </Paper>
  );
};

// Processing Animation with Progress
const ProcessingAnimation: React.FC<{ progress: number; step: string }> = ({ progress, step }) => (
  <Paper sx={{ p: 4, borderRadius: 1.5, bgcolor: '#FFFFFF', borderWidth: 1, borderStyle: 'solid', borderColor: 'divider', boxShadow: 'none' }}>
    <Stack spacing={3} alignItems="center">
      <Box sx={{ position: 'relative', display: 'inline-flex' }}>
        <CircularProgress variant="determinate" value={100} size={100} thickness={3} sx={{ color: '#e5e5e5' }} />
        <CircularProgress variant="determinate" value={progress} size={100} thickness={3} sx={{ color: 'text.primary', position: 'absolute', left: 0 }} />
        <Box sx={{ position: 'absolute', top: 0, left: 0, bottom: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary' }}>{progress}%</Typography>
        </Box>
      </Box>
      <Box sx={{ textAlign: 'center' }}>
        <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary', mb: 0.5 }}>Analyzing Proposal</Typography>
        <Typography variant="body2" sx={{ color: 'text.disabled' }}>{step}</Typography>
      </Box>
      <Box sx={{ width: '100%', maxWidth: 400 }}>
        <LinearProgress variant="determinate" value={progress} sx={{ height: 6, borderRadius: 3, bgcolor: 'action.hover', '& .MuiLinearProgress-bar': { borderRadius: 3, bgcolor: 'text.primary' } }} />
      </Box>
    </Stack>
  </Paper>
);

// Executive Summary Card
const ExecutiveSummaryCard: React.FC<{ summary: EvaluationResult['executiveSummary'] }> = ({ summary }) => (
  <Paper sx={{ p: 3, borderRadius: 1.5, borderWidth: 1, borderStyle: 'solid', borderColor: 'divider', boxShadow: 'none', mb: 3 }}>
    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
      <Psychology sx={{ color: 'text.primary' }} />
      <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>Executive Summary</Typography>
    </Stack>

    <Typography variant="body1" sx={{ color: 'text.primary', mb: 3, p: 2, bgcolor: 'background.default', borderRadius: 1, borderLeft: '3px solid #171717' }}>
      {summary.overallAssessment}
    </Typography>

    <Grid container spacing={3}>
      <Grid size={{ xs: 12, md: 6 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: COLORS.success, mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <TrendingUp fontSize="small" /> Key Strengths
        </Typography>
        <Stack spacing={0.5}>
          {summary.keyStrengths.map((s, i) => (
            <Typography key={i} variant="body2" sx={{ color: 'text.secondary', pl: 2, position: 'relative', '&:before': { content: '"•"', position: 'absolute', left: 0 } }}>
              {s}
            </Typography>
          ))}
        </Stack>
      </Grid>
      <Grid size={{ xs: 12, md: 6 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: COLORS.error, mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <TrendingDown fontSize="small" /> Critical Weaknesses
        </Typography>
        <Stack spacing={0.5}>
          {summary.criticalWeaknesses.map((w, i) => (
            <Typography key={i} variant="body2" sx={{ color: 'text.secondary', pl: 2, position: 'relative', '&:before': { content: '"•"', position: 'absolute', left: 0 } }}>
              {w}
            </Typography>
          ))}
        </Stack>
      </Grid>
    </Grid>

    <Divider sx={{ my: 2 }} />

    <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.primary', mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Lightbulb fontSize="small" /> Immediate Actions
    </Typography>
    <Stack spacing={1}>
      {summary.immediateActions.map((action, i) => (
        <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
          <Chip label={i + 1} size="small" sx={{ bgcolor: 'text.primary', color: 'white', fontWeight: 700, minWidth: 24, height: 24 }} />
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>{action}</Typography>
        </Box>
      ))}
    </Stack>
  </Paper>
);

// Win/Loss Insight Card
const InsightCard: React.FC<{ insight: WinLossInsight }> = ({ insight }) => {
  const config = {
    strength: { icon: <EmojiEvents />, color: COLORS.success, bg: 'rgba(5, 150, 105, 0.05)' },
    differentiator: { icon: <Star />, color: 'secondary.main', bg: 'rgba(37, 99, 235, 0.05)' },
    weakness: { icon: <TrendingDown />, color: COLORS.warning, bg: 'rgba(217, 119, 6, 0.05)' },
    risk: { icon: <PriorityHigh />, color: COLORS.error, bg: 'rgba(220, 38, 38, 0.05)' },
  }[insight.category];

  return (
    <Paper sx={{ p: 2.5, borderRadius: 1.5, borderWidth: 1, borderStyle: 'solid', borderColor: 'divider', boxShadow: 'none', bgcolor: config.bg }}>
      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        <Box sx={{ color: config.color, mt: 0.25 }}>{config.icon}</Box>
        <Box sx={{ flex: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.primary' }}>{insight.title}</Typography>
            <Chip label={insight.impactLevel} size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: config.color, color: 'white', textTransform: 'uppercase' }} />
          </Stack>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>{insight.description}</Typography>
          {insight.recommendation && (
            <Typography variant="body2" sx={{ color: config.color, fontWeight: 500 }}>→ {insight.recommendation}</Typography>
          )}
        </Box>
      </Stack>
    </Paper>
  );
};

// Pursuit Brief Question Card
const PursuitBriefQuestionCard: React.FC<{ question: PursuitBriefQuestionAnalysis; index: number }> = ({ question, index: _index }) => {
  const statusConfig = {
    full: { icon: <CheckCircle />, color: COLORS.success, bg: 'rgba(5, 150, 105, 0.05)', label: 'Addressed' },
    partial: { icon: <Warning />, color: COLORS.warning, bg: 'rgba(217, 119, 6, 0.05)', label: 'Partial' },
    none: { icon: <ErrorIcon />, color: COLORS.error, bg: 'rgba(220, 38, 38, 0.05)', label: 'Not Addressed' },
  };
  const config = statusConfig[question.coverageLevel];

  return (
    <Accordion sx={{ borderRadius: '8px !important', '&:before': { display: 'none' }, boxShadow: 'none', borderWidth: 1, borderStyle: 'solid', borderColor: 'divider', mb: 1.5, '&.Mui-expanded': { margin: '0 0 12px 0 !important' } }}>
      <AccordionSummary expandIcon={<ExpandMore />} sx={{ '&:hover': { bgcolor: 'background.default' } }}>
        <Stack direction="row" alignItems="center" spacing={2} sx={{ width: '100%', pr: 2 }}>
          <Box sx={{
            width: 32, height: 32, borderRadius: '50%',
            bgcolor: 'rgba(124, 58, 237, 0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0
          }}>
            <HelpOutline sx={{ fontSize: 18, color: '#7c3aed' }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary' }}>
              Q{question.questionId}: {question.questionText}
            </Typography>
          </Box>
          <Chip icon={config.icon} label={config.label} size="small" sx={{ bgcolor: config.bg, color: config.color, fontWeight: 600, '& .MuiChip-icon': { color: config.color } }} />
        </Stack>
      </AccordionSummary>

      <AccordionDetails sx={{ bgcolor: 'background.default', borderTop: 1, borderWidth: 1, borderStyle: 'solid', borderColor: 'divider', p: 3 }}>
        <Stack spacing={3}>
          {/* Assessment */}
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary', mb: 1 }}>Assessment</Typography>
            <Paper sx={{ p: 2, bgcolor: config.bg, borderLeft: `3px solid ${config.color}`, borderRadius: 1, boxShadow: 'none' }}>
              <Typography variant="body2" sx={{ color: 'text.primary' }}>{question.assessment}</Typography>
            </Paper>
          </Box>

          {/* Evidence from Proposal */}
          {question.proposalEvidence.length > 0 && (
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary', mb: 1 }}>Evidence from Proposal</Typography>
              <Stack spacing={1.5}>
                {question.proposalEvidence.map((evidence, i) => (
                  <Paper key={i} sx={{ p: 2, bgcolor: 'background.paper', borderLeft: '3px solid #525252', borderRadius: 1, boxShadow: 'none' }}>
                    <Stack direction="row" spacing={1} alignItems="flex-start">
                      <FormatQuote sx={{ color: 'text.disabled', fontSize: 20, mt: -0.5 }} />
                      <Box>
                        <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'text.secondary', mb: 0.5 }}>"{evidence.text}"</Typography>
                        {evidence.location && <Typography variant="caption" sx={{ color: 'text.disabled' }}>Found in: {evidence.location}</Typography>}
                      </Box>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            </Box>
          )}

          {/* Gaps */}
          {question.gaps && question.gaps.length > 0 && (
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: COLORS.error, mb: 1 }}>Gaps</Typography>
              <Stack spacing={0.5}>
                {question.gaps.map((gap, i) => (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, p: 1, bgcolor: 'rgba(220, 38, 38, 0.05)', borderRadius: 1 }}>
                    <ErrorIcon sx={{ color: COLORS.error, fontSize: 16, mt: 0.25 }} />
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>{gap}</Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          )}

          {/* Suggested Improvement */}
          {question.suggestedImprovement && (
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'secondary.main', mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Lightbulb fontSize="small" /> Suggested Improvement
              </Typography>
              <Paper sx={{ p: 2, bgcolor: 'rgba(37, 99, 235, 0.05)', border: '1px solid rgba(37, 99, 235, 0.2)', borderRadius: 1, boxShadow: 'none' }}>
                <Typography variant="body2" sx={{ color: 'text.primary' }}>{question.suggestedImprovement}</Typography>
              </Paper>
            </Box>
          )}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};

// Requirement Card with Remediation
const RequirementCard: React.FC<{ analysis: RequirementAnalysis; index: number }> = ({ analysis, index }) => {
  const [copied, setCopied] = useState(false);

  const statusConfig = {
    full: { icon: <CheckCircle />, color: COLORS.success, bg: 'rgba(5, 150, 105, 0.05)', label: 'Addressed' },
    partial: { icon: <Warning />, color: COLORS.warning, bg: 'rgba(217, 119, 6, 0.05)', label: 'Partial' },
    none: { icon: <ErrorIcon />, color: COLORS.error, bg: 'rgba(220, 38, 38, 0.05)', label: 'Missing' },
  };
  const config = statusConfig[analysis.coverageLevel];

  const priorityConfig = {
    mandatory: { color: COLORS.error, label: 'MANDATORY' },
    important: { color: COLORS.warning, label: 'IMPORTANT' },
    nice_to_have: { color: COLORS.muted, label: 'NICE TO HAVE' },
  };
  const priority = priorityConfig[analysis.priority];

  const handleCopySuggestion = () => {
    if (analysis.suggestedContent) {
      navigator.clipboard.writeText(analysis.suggestedContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Accordion sx={{ borderRadius: '8px !important', '&:before': { display: 'none' }, boxShadow: 'none', borderWidth: 1, borderStyle: 'solid', borderColor: 'divider', mb: 1.5, '&.Mui-expanded': { margin: '0 0 12px 0 !important' } }}>
      <AccordionSummary expandIcon={<ExpandMore />} sx={{ '&:hover': { bgcolor: 'background.default' } }}>
        <Stack direction="row" alignItems="center" spacing={2} sx={{ width: '100%', pr: 2 }}>
          <Chip label={`#${index + 1}`} size="small" sx={{ bgcolor: 'text.secondary', color: 'white', fontWeight: 600, minWidth: 36, fontSize: '0.7rem' }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'text.primary' }}>
              {analysis.requirementText.substring(0, 70)}{analysis.requirementText.length > 70 ? '...' : ''}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="caption" sx={{ color: 'text.disabled' }}>{analysis.section}</Typography>
              <Chip label={priority.label} size="small" sx={{ height: 16, fontSize: '0.55rem', bgcolor: `${priority.color}20`, color: priority.color, fontWeight: 700 }} />
            </Stack>
          </Box>
          <Chip icon={config.icon} label={config.label} size="small" sx={{ bgcolor: config.bg, color: config.color, fontWeight: 600, '& .MuiChip-icon': { color: config.color } }} />
        </Stack>
      </AccordionSummary>

      <AccordionDetails sx={{ bgcolor: 'background.default', borderTop: 1, borderWidth: 1, borderStyle: 'solid', borderColor: 'divider', p: 3 }}>
        <Stack spacing={3}>
          {/* Requirement */}
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary', mb: 1 }}>RFP Requirement</Typography>
            <Paper sx={{ p: 2, bgcolor: 'background.paper', borderWidth: 1, borderStyle: 'solid', borderColor: 'divider', borderRadius: 1, boxShadow: 'none' }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>"{analysis.requirementText}"</Typography>
            </Paper>
          </Box>

          {/* Verdict */}
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary', mb: 1 }}>Verdict</Typography>
            <Paper sx={{ p: 2, bgcolor: config.bg, borderLeft: `3px solid ${config.color}`, borderRadius: 1, boxShadow: 'none' }}>
              <Typography variant="body2" sx={{ color: 'text.primary' }}>{analysis.verdict}</Typography>
              {analysis.complianceRisk === 'high' && (
                <Chip icon={<Shield />} label="High Compliance Risk" size="small" sx={{ mt: 1, bgcolor: 'rgba(220, 38, 38, 0.1)', color: COLORS.error, fontWeight: 600 }} />
              )}
            </Paper>
          </Box>

          {/* Evidence from Proposal */}
          {analysis.proposalExcerpts.length > 0 && (
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary', mb: 1 }}>Evidence from Proposal</Typography>
              <Stack spacing={1.5}>
                {analysis.proposalExcerpts.map((excerpt, i) => (
                  <Paper key={i} sx={{ p: 2, bgcolor: 'background.paper', borderLeft: '3px solid #525252', borderRadius: 1, boxShadow: 'none' }}>
                    <Stack direction="row" spacing={1} alignItems="flex-start">
                      <FormatQuote sx={{ color: 'text.disabled', fontSize: 20, mt: -0.5 }} />
                      <Box>
                        <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'text.secondary', mb: 0.5 }}>"{excerpt.text}"</Typography>
                        {excerpt.pageOrSection && <Typography variant="caption" sx={{ color: 'text.disabled' }}>Found in: {excerpt.pageOrSection}</Typography>}
                        <Typography variant="caption" sx={{ color: COLORS.success, fontWeight: 500, display: 'block' }}>→ {excerpt.relevance}</Typography>
                      </Box>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            </Box>
          )}

          {/* Evidence from Pursuit Brief */}
          {analysis.pursuitBriefExcerpts && analysis.pursuitBriefExcerpts.length > 0 && (
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#7c3aed', mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Campaign fontSize="small" /> Strategic Context from Pursuit Brief
              </Typography>
              <Stack spacing={1.5}>
                {analysis.pursuitBriefExcerpts.map((excerpt, i) => (
                  <Paper key={i} sx={{ p: 2, bgcolor: 'rgba(124, 58, 237, 0.03)', borderLeft: '3px solid #7c3aed', borderRadius: 1, boxShadow: 'none' }}>
                    <Stack direction="row" spacing={1} alignItems="flex-start">
                      <FormatQuote sx={{ color: '#7c3aed', fontSize: 20, mt: -0.5, opacity: 0.6 }} />
                      <Box>
                        <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'text.secondary', mb: 0.5 }}>"{excerpt.text}"</Typography>
                        {excerpt.questionOrSection && (
                          <Typography variant="caption" sx={{ color: '#7c3aed', fontWeight: 500 }}>
                            From: {excerpt.questionOrSection}
                          </Typography>
                        )}
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
                          <strong>How it helps:</strong> {excerpt.howItHelps}
                        </Typography>
                      </Box>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            </Box>
          )}

          {/* Gaps */}
          {analysis.gaps.length > 0 && (
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: COLORS.error, mb: 1 }}>Gaps Identified</Typography>
              <Stack spacing={0.5}>
                {analysis.gaps.map((gap, i) => (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, p: 1, bgcolor: 'rgba(220, 38, 38, 0.05)', borderRadius: 1 }}>
                    <ErrorIcon sx={{ color: COLORS.error, fontSize: 16, mt: 0.25 }} />
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>{gap}</Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          )}

          {/* Suggested Content - Ready to use */}
          {analysis.suggestedContent && (
            <Box>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'secondary.main', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Lightbulb fontSize="small" /> Suggested Content to Add
                </Typography>
                <Tooltip title={copied ? 'Copied!' : 'Copy to clipboard'}>
                  <IconButton size="small" onClick={handleCopySuggestion} sx={{ color: copied ? COLORS.success : '#525252' }}>
                    <ContentCopy fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
              <Paper sx={{ p: 2, bgcolor: 'rgba(37, 99, 235, 0.05)', border: '1px solid rgba(37, 99, 235, 0.2)', borderRadius: 1, boxShadow: 'none' }}>
                <Typography variant="body2" sx={{ color: 'text.primary', whiteSpace: 'pre-wrap' }}>{analysis.suggestedContent}</Typography>
              </Paper>
              {analysis.suggestedApproach && (
                <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1, display: 'block' }}>
                  <strong>Approach:</strong> {analysis.suggestedApproach}
                </Typography>
              )}
            </Box>
          )}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};

// Main Component
const ProposalEvaluationPage: React.FC = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [activeTab, setActiveTab] = useState(0);
  const [rfpFile, setRfpFile] = useState<File | null>(null);
  const [proposalFile, setProposalFile] = useState<File | null>(null);
  const [pursuitBriefFile, setPursuitBriefFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [evaluationId, setEvaluationId] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<RequirementPriority | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'full' | 'partial' | 'none'>('all');
  const [savedEvaluations, setSavedEvaluations] = useState<SavedEvaluationSummary[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [showSavedEvaluations, setShowSavedEvaluations] = useState(false);

  // Fetch saved evaluations on mount
  useEffect(() => {
    const fetchSavedEvaluations = async () => {
      try {
        setLoadingSaved(true);
        const response = await apiGet('/api/proposal-evaluation/list');
        if (response?.success && response.data) {
          setSavedEvaluations(response.data);
        }
      } catch (err) {
        console.error('Failed to fetch saved evaluations:', err);
      } finally {
        setLoadingSaved(false);
      }
    };

    fetchSavedEvaluations();
  }, []);

  // Poll for evaluation status
  useEffect(() => {
    if (!evaluationId || evaluation?.status === 'completed' || evaluation?.status === 'failed') {
      return;
    }

    const pollStatus = async () => {
      try {
        const response = await apiGet(`/api/proposal-evaluation/status/${evaluationId}`);
        if (response?.success && response.data) {
          setEvaluation(response.data);
          if (response.data.status === 'completed' || response.data.status === 'failed') {
            setActiveStep(2);
          }
        }
      } catch (err) {
        console.error('Failed to poll status:', err);
      }
    };

    const interval = setInterval(pollStatus, 2000);
    pollStatus();

    return () => clearInterval(interval);
  }, [evaluationId, evaluation?.status]);

  const handleStartEvaluation = async () => {
    if (!rfpFile || !proposalFile) {
      setError('Please upload both RFP and Proposal files');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('rfp', rfpFile);
      formData.append('proposal', proposalFile);
      if (pursuitBriefFile) {
        formData.append('pursuitBrief', pursuitBriefFile);
      }

      const response = await apiPostForm('/api/proposal-evaluation/start', formData);

      if (response?.success && response.data?.sessionId) {
        setEvaluationId(response.data.sessionId);
        setActiveStep(1);
      } else {
        setError(response?.error || 'Failed to start evaluation');
      }
    } catch (err: any) {
      setError(`Error: ${err.message || 'Failed to start evaluation'}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleExport = async (format: 'markdown' | 'html' | 'json') => {
    if (!evaluationId) return;
    try {
      const response = await fetch(`/api/proposal-evaluation/export/${evaluationId}?format=${format}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `proposal-evaluation-${evaluationId}.${format === 'markdown' ? 'md' : format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const handleReset = () => {
    setActiveStep(0);
    setActiveTab(0);
    setRfpFile(null);
    setProposalFile(null);
    setPursuitBriefFile(null);
    setEvaluationId(null);
    setEvaluation(null);
    setError(null);
    setPriorityFilter('all');
    setStatusFilter('all');
    setShowSavedEvaluations(false);
  };

  const handleLoadSavedEvaluation = async (savedId: string) => {
    try {
      setError(null);
      setIsUploading(true);
      const response = await apiGet(`/api/proposal-evaluation/saved/${savedId}`);
      if (response?.success && response.data) {
        setEvaluation(response.data);
        setEvaluationId(savedId);
        setActiveStep(2);
        setShowSavedEvaluations(false);
      } else {
        setError(response?.error || 'Failed to load evaluation');
      }
    } catch (err: any) {
      setError(`Error loading evaluation: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Filter analysis
  const filteredAnalysis = evaluation?.analysis.filter(a => {
    if (priorityFilter !== 'all' && a.priority !== priorityFilter) return false;
    if (statusFilter !== 'all' && a.coverageLevel !== statusFilter) return false;
    return true;
  }) || [];

  return (
    <Box sx={{ pb: 4 }}>
      {/* Dark header banner */}
      <Paper
        elevation={0}
        sx={{
          p: 4,
          mb: 3,
          borderRadius: 3,
          bgcolor: '#171717',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ position: 'absolute', top: 0, right: 0, width: '50%', height: '100%', opacity: 0.08, background: 'radial-gradient(circle at 60% 50%, white 0%, transparent 70%)' }} />
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={3} alignItems="center">
            <Box sx={{ width: 56, height: 56, borderRadius: 2.5, bgcolor: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Analytics sx={{ fontSize: 28, color: 'white' }} />
            </Box>
            <Box>
              <Typography variant="h5" sx={{ color: 'white', fontWeight: 700, mb: 0.5 }}>
                Proposal Evaluator
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.75)' }}>
                Score your proposal against RFP requirements — compliance gaps, win/loss insights, and remediation guidance
              </Typography>
            </Box>
          </Stack>
          {activeStep === 2 && (
            <Stack direction="row" spacing={1} flexShrink={0}>
              <Tooltip title="Export Markdown">
                <IconButton onClick={() => handleExport('markdown')} size="small" sx={{ color: 'rgba(255,255,255,0.7)', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}>
                  <Download />
                </IconButton>
              </Tooltip>
              <Tooltip title="Export HTML">
                <IconButton onClick={() => handleExport('html')} size="small" sx={{ color: 'rgba(255,255,255,0.7)', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}>
                  <InsertDriveFile />
                </IconButton>
              </Tooltip>
              <Button variant="outlined" size="small" startIcon={<Refresh />} onClick={handleReset}
                sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.3)', '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.08)' }, textTransform: 'none' }}>
                New Evaluation
              </Button>
            </Stack>
          )}
        </Stack>
      </Paper>

      {error && <Grow in><Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert></Grow>}

      {/* Step 0: Upload */}
      {activeStep === 0 && (
        <Fade in timeout={300}>
          <Box>
            {!showSavedEvaluations ? (
              <>
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <FileUploadCard title="RFP Document" description="The RFP to evaluate against" hint="PDF, DOCX, or TXT" required step={1} accentColor="#2563eb" file={rfpFile} onFileSelect={setRfpFile} onFileRemove={() => setRfpFile(null)} icon={<Assignment />} />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <FileUploadCard title="Your Proposal" description="Your proposal response" hint="PDF or DOCX" required step={2} accentColor="#7c3aed" file={proposalFile} onFileSelect={setProposalFile} onFileRemove={() => setProposalFile(null)} icon={<Description />} />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <FileUploadCard title="Pursuit Brief" description="Optional strategic context" hint="PDF, DOCX, or TXT" step={3} accentColor="#0891b2" file={pursuitBriefFile} onFileSelect={setPursuitBriefFile} onFileRemove={() => setPursuitBriefFile(null)} icon={<TrendingUp />} />
                  </Grid>
                </Grid>

                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mb: 3 }}>
                  <Button
                    variant="contained"
                    size="large"
                    startIcon={isUploading ? <CircularProgress size={18} color="inherit" /> : <Analytics />}
                    endIcon={!isUploading && <ArrowForward />}
                    onClick={handleStartEvaluation}
                    disabled={!rfpFile || !proposalFile || isUploading}
                    sx={{ bgcolor: 'text.primary', px: 4, py: 1.5, fontWeight: 600, '&:hover': { bgcolor: '#262626' }, '&:disabled': { bgcolor: 'action.selected' } }}
                  >
                    {isUploading ? 'Starting...' : 'Analyze Proposal'}
                  </Button>
                  {savedEvaluations.length > 0 && (
                    <Button
                      variant="outlined"
                      size="large"
                      startIcon={<History />}
                      onClick={() => setShowSavedEvaluations(true)}
                      sx={{ px: 3, py: 1.5 }}
                    >
                      View Past Evaluations ({savedEvaluations.length})
                    </Button>
                  )}
                </Box>

                <Stack direction="row" spacing={1.5} justifyContent="center" flexWrap="wrap" useFlexGap>
                  {[
                    { label: 'Compliance Scorecard', color: '#2563eb' },
                    { label: 'Gap Remediation', color: '#dc2626' },
                    { label: 'Win/Loss Insights', color: '#7c3aed' },
                    { label: 'Suggested Content', color: '#059669' },
                  ].map(({ label, color }) => (
                    <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 0.75, borderRadius: 5, border: '1px solid', borderColor: `${color}30`, bgcolor: `${color}08` }}>
                      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: color }} />
                      <Typography variant="caption" sx={{ color, fontWeight: 600, fontSize: '0.72rem' }}>{label}</Typography>
                    </Box>
                  ))}
                </Stack>
              </>
            ) : (
              /* Saved Evaluations View */
              <Box>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <FolderOpen sx={{ color: 'text.primary' }} />
                    <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>Past Evaluations</Typography>
                  </Stack>
                  <Button variant="outlined" size="small" onClick={() => setShowSavedEvaluations(false)}>
                    New Evaluation
                  </Button>
                </Stack>

                {loadingSaved ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                  </Box>
                ) : savedEvaluations.length === 0 ? (
                  <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'background.default', borderWidth: 1, borderStyle: 'solid', borderColor: 'divider', borderRadius: 1.5 }}>
                    <Typography variant="body2" sx={{ color: COLORS.muted }}>No saved evaluations yet</Typography>
                  </Paper>
                ) : (
                  <Stack spacing={2}>
                    {savedEvaluations.map((saved) => (
                      <Paper
                        key={saved.id}
                        sx={{
                          p: 2.5,
                          borderRadius: 1.5,
                          borderColor: 'divider',
                          boxShadow: 'none',
                          cursor: 'pointer',
                          transition: 'border-color 0.15s, background-color 0.15s',
                          '&:hover': { borderColor: '#a3a3a3', bgcolor: 'background.default' }
                        }}
                        onClick={() => handleLoadSavedEvaluation(saved.id)}
                      >
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Box>
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                                {saved.proposalFileName}
                              </Typography>
                              <ExpiryBadge isSaved={saved.isSaved ?? false} createdAt={saved.createdAt} />
                            </Stack>
                            <Typography variant="caption" sx={{ color: COLORS.muted }}>
                              vs {saved.rfpFileName}
                              {saved.pursuitBriefFileName && ` • with ${saved.pursuitBriefFileName}`}
                            </Typography>
                            <Typography variant="caption" sx={{ color: COLORS.muted, display: 'block' }}>
                              {new Date(saved.createdAt).toLocaleDateString()} at {new Date(saved.createdAt).toLocaleTimeString()}
                            </Typography>
                          </Box>
                          <Stack direction="row" spacing={2} alignItems="center">
                            <SaveBookmarkButton modelType="proposalEvaluation" id={saved.id} isSaved={saved.isSaved ?? false} />
                            <Box sx={{ textAlign: 'center' }}>
                              <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>{saved.totalRequirements}</Typography>
                              <Typography variant="caption" sx={{ color: COLORS.muted }}>Requirements</Typography>
                            </Box>
                            <Chip
                              label={`${saved.complianceScore}%`}
                              size="small"
                              sx={{
                                bgcolor: saved.complianceScore >= 80 ? COLORS.success :
                                         saved.complianceScore >= 50 ? COLORS.warning : COLORS.error,
                                color: 'white',
                                fontWeight: 700,
                                minWidth: 60
                              }}
                            />
                            <ArrowForward sx={{ color: COLORS.muted }} />
                          </Stack>
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                )}
              </Box>
            )}
          </Box>
        </Fade>
      )}

      {/* Step 1: Processing */}
      {activeStep === 1 && evaluation && (
        <Fade in timeout={300}>
          <Box>
            <ProcessingAnimation progress={evaluation.progress || 0} step={evaluation.currentStep || 'Processing...'} />
          </Box>
        </Fade>
      )}

      {/* Step 2: Results */}
      {activeStep === 2 && evaluation && evaluation.status === 'completed' && (
        <Fade in timeout={300}>
          <Box>
            {/* Compliance Scorecard */}
            <Paper sx={{ p: 3, mb: 3, borderRadius: 1.5, borderWidth: 1, borderStyle: 'solid', borderColor: 'divider', boxShadow: 'none' }}>
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 3 }}>
                <Shield sx={{ color: 'text.primary' }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>Compliance Scorecard</Typography>
              </Stack>

              <Grid container spacing={4} alignItems="center">
                <Grid size={{ xs: 12, md: 3 }}>
                  <ComplianceGauge score={evaluation.summary.complianceScore} label="Compliance Score" />
                </Grid>
                <Grid size={{ xs: 12, md: 9 }}>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 6, sm: 3 }}>
                      <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                        <Typography variant="h4" sx={{ fontWeight: 700, color: 'text.primary' }}>{evaluation.summary.totalRequirements}</Typography>
                        <Typography variant="caption" sx={{ color: COLORS.muted }}>Total Requirements</Typography>
                      </Box>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 3 }}>
                      <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'rgba(5, 150, 105, 0.05)', borderRadius: 1 }}>
                        <Typography variant="h4" sx={{ fontWeight: 700, color: COLORS.success }}>{evaluation.summary.addressed}</Typography>
                        <Typography variant="caption" sx={{ color: COLORS.success }}>Fully Addressed</Typography>
                      </Box>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 3 }}>
                      <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'rgba(217, 119, 6, 0.05)', borderRadius: 1 }}>
                        <Typography variant="h4" sx={{ fontWeight: 700, color: COLORS.warning }}>{evaluation.summary.partiallyAddressed}</Typography>
                        <Typography variant="caption" sx={{ color: COLORS.warning }}>Partial</Typography>
                      </Box>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 3 }}>
                      <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'rgba(220, 38, 38, 0.05)', borderRadius: 1 }}>
                        <Typography variant="h4" sx={{ fontWeight: 700, color: COLORS.error }}>{evaluation.summary.notAddressed}</Typography>
                        <Typography variant="caption" sx={{ color: COLORS.error }}>Missing</Typography>
                      </Box>
                    </Grid>
                  </Grid>

                  <Divider sx={{ my: 2 }} />

                  <Stack direction="row" spacing={3} justifyContent="center">
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: COLORS.error }}>{evaluation.summary.byPriority.mandatory.met}/{evaluation.summary.byPriority.mandatory.total}</Typography>
                      <Typography variant="caption" sx={{ color: COLORS.muted }}>Mandatory</Typography>
                    </Box>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: COLORS.warning }}>{evaluation.summary.byPriority.important.met}/{evaluation.summary.byPriority.important.total}</Typography>
                      <Typography variant="caption" sx={{ color: COLORS.muted }}>Important</Typography>
                    </Box>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: COLORS.muted }}>{evaluation.summary.byPriority.nice_to_have.met}/{evaluation.summary.byPriority.nice_to_have.total}</Typography>
                      <Typography variant="caption" sx={{ color: COLORS.muted }}>Nice to Have</Typography>
                    </Box>
                  </Stack>
                </Grid>
              </Grid>
            </Paper>

            {/* Pursuit Brief Strategic Coverage Summary */}
            {evaluation.pursuitBriefAnalysis && (
              <Paper sx={{ p: 3, mb: 3, borderRadius: 1.5, border: '1px solid rgba(124, 58, 237, 0.3)', boxShadow: 'none', bgcolor: 'rgba(124, 58, 237, 0.02)' }}>
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                  <QuestionAnswer sx={{ color: '#7c3aed' }} />
                  <Typography variant="h6" sx={{ fontWeight: 600, color: '#7c3aed' }}>Strategic Questions Coverage</Typography>
                  <Chip
                    label={`${evaluation.pursuitBriefAnalysis.coverageScore}%`}
                    size="small"
                    sx={{
                      bgcolor: evaluation.pursuitBriefAnalysis.coverageScore >= 80 ? COLORS.success :
                               evaluation.pursuitBriefAnalysis.coverageScore >= 50 ? COLORS.warning : COLORS.error,
                      color: 'white',
                      fontWeight: 700
                    }}
                  />
                </Stack>

                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                  How well does your proposal address the 16 strategic pursuit brief questions?
                </Typography>

                <Stack direction="row" spacing={3}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CheckCircle sx={{ fontSize: 18, color: COLORS.success }} />
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      <strong>{evaluation.pursuitBriefAnalysis.fullyAddressed}</strong> fully addressed
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Warning sx={{ fontSize: 18, color: COLORS.warning }} />
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      <strong>{evaluation.pursuitBriefAnalysis.partiallyAddressed}</strong> partial
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ErrorIcon sx={{ fontSize: 18, color: COLORS.error }} />
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      <strong>{evaluation.pursuitBriefAnalysis.notAddressed}</strong> not addressed
                    </Typography>
                  </Box>
                </Stack>

                {evaluation.pursuitBriefAnalysis.notAddressed > 0 && (
                  <Alert severity="warning" sx={{ mt: 2 }}>
                    {evaluation.pursuitBriefAnalysis.notAddressed} strategic question{evaluation.pursuitBriefAnalysis.notAddressed > 1 ? 's are' : ' is'} not addressed in your proposal.
                    See the "Strategic Questions" tab for details and suggestions.
                  </Alert>
                )}
              </Paper>
            )}

            {/* Executive Summary */}
            <ExecutiveSummaryCard summary={evaluation.executiveSummary} />

            {/* Critical Gaps Alert */}
            {evaluation.criticalGaps.length > 0 && (
              <Paper sx={{ p: 3, mb: 3, borderRadius: 1.5, bgcolor: 'rgba(220, 38, 38, 0.03)', border: '1px solid rgba(220, 38, 38, 0.2)', boxShadow: 'none' }}>
                <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
                  <PriorityHigh sx={{ color: COLORS.error }} />
                  <Typography variant="h6" sx={{ fontWeight: 600, color: COLORS.error }}>Critical Gaps ({evaluation.criticalGaps.length})</Typography>
                </Stack>
                <Stack spacing={2}>
                  {evaluation.criticalGaps.slice(0, 5).map((gap, i) => (
                    <Box key={i} sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1, borderLeft: `3px solid ${COLORS.error}` }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary', mb: 0.5 }}>{gap.section}</Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>"{gap.requirement.substring(0, 120)}..."</Typography>
                      <Box sx={{ p: 1.5, bgcolor: 'rgba(37, 99, 235, 0.05)', borderRadius: 1 }}>
                        <Typography variant="caption" sx={{ fontWeight: 600, color: 'secondary.main' }}>Suggested Fix:</Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>{gap.suggestedFix}</Typography>
                      </Box>
                    </Box>
                  ))}
                </Stack>
              </Paper>
            )}

            {/* Tabs */}
            <Paper sx={{ mb: 3, borderRadius: 1.5, borderWidth: 1, borderStyle: 'solid', borderColor: 'divider', boxShadow: 'none', overflow: 'hidden' }}>
              <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ borderBottom: 1, borderWidth: 1, borderStyle: 'solid', borderColor: 'divider', bgcolor: 'background.default' }}>
                <Tab label={`Requirements (${evaluation.analysis.length})`} />
                <Tab label={`Win/Loss Insights (${evaluation.winLossInsights.length})`} />
                <Tab label={`By Section (${evaluation.bySection.length})`} />
                {evaluation.pursuitBriefAnalysis && (
                  <Tab
                    label={`Strategic Questions (${evaluation.pursuitBriefAnalysis.totalQuestions})`}
                    icon={<QuestionAnswer sx={{ fontSize: 18 }} />}
                    iconPosition="start"
                    sx={{ color: '#7c3aed' }}
                  />
                )}
              </Tabs>

              <Box sx={{ p: 3 }}>
                {/* Tab 0: Requirements */}
                {activeTab === 0 && (
                  <>
                    <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
                      <Chip label="All" onClick={() => setStatusFilter('all')} variant={statusFilter === 'all' ? 'filled' : 'outlined'} sx={statusFilter === 'all' ? { bgcolor: 'text.primary', color: 'white' } : {}} />
                      <Chip label={`Addressed (${evaluation.summary.addressed})`} onClick={() => setStatusFilter('full')} sx={statusFilter === 'full' ? { bgcolor: COLORS.success, color: 'white' } : {}} />
                      <Chip label={`Partial (${evaluation.summary.partiallyAddressed})`} onClick={() => setStatusFilter('partial')} sx={statusFilter === 'partial' ? { bgcolor: COLORS.warning, color: 'white' } : {}} />
                      <Chip label={`Missing (${evaluation.summary.notAddressed})`} onClick={() => setStatusFilter('none')} sx={statusFilter === 'none' ? { bgcolor: COLORS.error, color: 'white' } : {}} />
                      <Divider orientation="vertical" flexItem />
                      <Chip label="Mandatory" size="small" onClick={() => setPriorityFilter(priorityFilter === 'mandatory' ? 'all' : 'mandatory')} variant={priorityFilter === 'mandatory' ? 'filled' : 'outlined'} />
                      <Chip label="Important" size="small" onClick={() => setPriorityFilter(priorityFilter === 'important' ? 'all' : 'important')} variant={priorityFilter === 'important' ? 'filled' : 'outlined'} />
                    </Stack>
                    {filteredAnalysis.map((a, i) => <RequirementCard key={a.requirementId} analysis={a} index={i} />)}
                    {filteredAnalysis.length === 0 && <Typography variant="body2" sx={{ color: COLORS.muted, textAlign: 'center', py: 4 }}>No requirements match filters</Typography>}
                  </>
                )}

                {/* Tab 1: Win/Loss */}
                {activeTab === 1 && (
                  <Grid container spacing={2}>
                    {evaluation.winLossInsights.map((insight, i) => (
                      <Grid key={i} size={{ xs: 12, md: 6 }}>
                        <InsightCard insight={insight} />
                      </Grid>
                    ))}
                  </Grid>
                )}

                {/* Tab 2: By Section */}
                {activeTab === 2 && (
                  <Stack spacing={2}>
                    {evaluation.bySection.map((section) => (
                      <Paper key={section.section} sx={{ p: 2.5, borderRadius: 1.5, borderWidth: 1, borderStyle: 'solid', borderColor: 'divider', boxShadow: 'none' }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{section.section}</Typography>
                          <Stack direction="row" spacing={1}>
                            <Chip label={`${section.complianceScore}%`} size="small" sx={{ bgcolor: section.complianceScore >= 90 ? COLORS.success : section.complianceScore >= 70 ? COLORS.warning : COLORS.error, color: 'white', fontWeight: 700 }} />
                            <Typography variant="body2" sx={{ color: COLORS.muted }}>{section.addressedCount}/{section.totalCount} addressed</Typography>
                          </Stack>
                        </Stack>
                        <LinearProgress variant="determinate" value={(section.addressedCount / section.totalCount) * 100} sx={{ height: 6, borderRadius: 3, bgcolor: 'action.hover', '& .MuiLinearProgress-bar': { bgcolor: section.complianceScore >= 90 ? COLORS.success : section.complianceScore >= 70 ? COLORS.warning : COLORS.error } }} />
                        {section.mandatoryTotal > 0 && (
                          <Typography variant="caption" sx={{ color: COLORS.error, mt: 1, display: 'block' }}>
                            Mandatory: {section.mandatoryMet}/{section.mandatoryTotal}
                          </Typography>
                        )}
                      </Paper>
                    ))}
                  </Stack>
                )}

                {/* Tab 3: Pursuit Brief Strategic Questions */}
                {activeTab === 3 && evaluation.pursuitBriefAnalysis && (
                  <Box>
                    {/* Summary Card */}
                    <Paper sx={{ p: 3, mb: 3, borderRadius: 1.5, bgcolor: 'rgba(124, 58, 237, 0.03)', border: '1px solid rgba(124, 58, 237, 0.2)', boxShadow: 'none' }}>
                      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                        <QuestionAnswer sx={{ color: '#7c3aed' }} />
                        <Typography variant="h6" sx={{ fontWeight: 600, color: '#7c3aed' }}>Strategic Questions Coverage</Typography>
                      </Stack>

                      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                        These 16 strategic questions capture the key context about your opportunity. A strong proposal should address all of these areas to demonstrate deep understanding of the client's needs.
                      </Typography>

                      <Grid container spacing={3} alignItems="center">
                        <Grid size={{ xs: 12, md: 3 }}>
                          <ComplianceGauge score={evaluation.pursuitBriefAnalysis.coverageScore} label="Strategic Coverage" />
                        </Grid>
                        <Grid size={{ xs: 12, md: 9 }}>
                          <Grid container spacing={2}>
                            <Grid size={{ xs: 4 }}>
                              <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'rgba(5, 150, 105, 0.05)', borderRadius: 1 }}>
                                <Typography variant="h4" sx={{ fontWeight: 700, color: COLORS.success }}>{evaluation.pursuitBriefAnalysis.fullyAddressed}</Typography>
                                <Typography variant="caption" sx={{ color: COLORS.success }}>Fully Addressed</Typography>
                              </Box>
                            </Grid>
                            <Grid size={{ xs: 4 }}>
                              <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'rgba(217, 119, 6, 0.05)', borderRadius: 1 }}>
                                <Typography variant="h4" sx={{ fontWeight: 700, color: COLORS.warning }}>{evaluation.pursuitBriefAnalysis.partiallyAddressed}</Typography>
                                <Typography variant="caption" sx={{ color: COLORS.warning }}>Partial</Typography>
                              </Box>
                            </Grid>
                            <Grid size={{ xs: 4 }}>
                              <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'rgba(220, 38, 38, 0.05)', borderRadius: 1 }}>
                                <Typography variant="h4" sx={{ fontWeight: 700, color: COLORS.error }}>{evaluation.pursuitBriefAnalysis.notAddressed}</Typography>
                                <Typography variant="caption" sx={{ color: COLORS.error }}>Not Addressed</Typography>
                              </Box>
                            </Grid>
                          </Grid>
                        </Grid>
                      </Grid>
                    </Paper>

                    {/* Individual Questions */}
                    {evaluation.pursuitBriefAnalysis.questionAnalysis.map((q, i) => (
                      <PursuitBriefQuestionCard key={q.questionId} question={q} index={i} />
                    ))}
                  </Box>
                )}
              </Box>
            </Paper>

            {/* Feedback Widget */}
            <Box sx={{ mt: 3, px: 2, pb: 2 }}>
              <FeedbackWidget 
                category="proposal_evaluation" 
                referenceId={evaluationId || undefined} 
                metadata={{ 
                  rfpFileName: evaluation.rfpFileName, 
                  proposalFileName: evaluation.proposalFileName 
                }} 
              />
            </Box>
          </Box>
        </Fade>
      )}

      {/* Failed State */}
      {activeStep === 2 && evaluation?.status === 'failed' && (
        <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'rgba(220, 38, 38, 0.03)', border: '1px solid rgba(220, 38, 38, 0.2)', borderRadius: 1.5 }}>
          <ErrorIcon sx={{ fontSize: 48, color: COLORS.error, mb: 2 }} />
          <Typography variant="h6" sx={{ fontWeight: 600, color: COLORS.error, mb: 1 }}>Evaluation Failed</Typography>
          <Typography variant="body2" sx={{ color: COLORS.muted, mb: 3 }}>{evaluation.error}</Typography>
          <Button variant="contained" startIcon={<Refresh />} onClick={handleReset} sx={{ bgcolor: 'text.primary' }}>Try Again</Button>
        </Paper>
      )}
    </Box>
  );
};

export default ProposalEvaluationPage;
