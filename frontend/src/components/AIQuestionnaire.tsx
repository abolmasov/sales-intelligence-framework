import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Chip,
  CircularProgress,
  Alert,
  Stack,
  Divider,
  Collapse,
  LinearProgress,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  Button,
} from '@mui/material';
import {
  ExpandMore,
  ExpandLess,
  ContentCopy,
  CheckCircle,
  RadioButtonUnchecked,
  FileDownload,
  TableChart,
  Assignment,
} from '@mui/icons-material';
import * as XLSX from 'xlsx';
import { API_BASE_URL } from '../config';

interface Question {
  id: number;
  question: string;
  category: string;
  context: string;
  northstar_connection: string;
  product_focus: string;
  target_persona: string;
  internal_kb_sourced?: boolean;
}

interface AIQuestionnaireProps {
  companyName: string;
  researchSummary: string;
  keyInsights: string[];
  attendeeInfo: Array<{ name: string; email: string; role: string }>;
  enterpriseRecommendations: string[];
  recommendedProducts: string[];
  preGeneratedQuestions?: any;
}

const CATEGORY_CONFIG: Record<string, { label: string; dot: string }> = {
  discovery:           { label: 'Discovery',          dot: '#3b82f6' },
  technical:           { label: 'Technical',           dot: '#8b5cf6' },
  'business-value':    { label: 'Business Value',      dot: '#10b981' },
  'pain-point':        { label: 'Pain Points',         dot: '#ef4444' },
  'solution-fit':      { label: 'Solution Fit',        dot: '#f59e0b' },
  transformation:      { label: 'Transformation',      dot: '#0ea5e9' },
  'ai-readiness':      { label: 'AI Readiness',        dot: '#7c3aed' },
  'internal-knowledge':{ label: 'Internal Knowledge',  dot: '#0d47a1' },
};

const AIQuestionnaire: React.FC<AIQuestionnaireProps> = ({
  companyName,
  researchSummary,
  keyInsights,
  attendeeInfo,
  enterpriseRecommendations,
  recommendedProducts,
  preGeneratedQuestions,
}) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [askedIds, setAskedIds] = useState<Set<number>>(new Set());
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  useEffect(() => {
    if (preGeneratedQuestions?.questions && preGeneratedQuestions.questions.length > 0) {
      setQuestions(preGeneratedQuestions.questions);
      setLoading(false);
    } else {
      generateQuestions();
    }
  }, [companyName, preGeneratedQuestions]);

  const generateQuestions = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/ai-questionnaire/generate-questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName, researchSummary, keyInsights,
          attendeeInfo, enterpriseRecommendations, recommendedProducts,
        }),
      });
      if (!response.ok) throw new Error('Failed to generate questions');
      const result = await response.json();
      const data = result.data || result;
      setQuestions(data.questions || []);
    } catch (err: any) {
      setError(err.message || 'Failed to generate questions');
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  };

  const categories = useMemo(() => {
    const cats = new Set(questions.map(q => q.category));
    return ['all', ...Array.from(cats)];
  }, [questions]);

  const filteredQuestions = useMemo(() => {
    if (categoryFilter === 'all') return questions;
    return questions.filter(q => q.category === categoryFilter);
  }, [questions, categoryFilter]);

  const progress = useMemo(() => {
    if (questions.length === 0) return 0;
    return Math.round((askedIds.size / questions.length) * 100);
  }, [askedIds, questions]);

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAsked = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setAskedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const copyQuestion = (question: string, id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(question);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getCategoryConfig = (category: string) =>
    CATEGORY_CONFIG[category] || { label: category, dot: '#94a3b8' };

  // ── Export ─────────────────────────────────────────────────
  const [exportAnchor, setExportAnchor] = useState<null | HTMLElement>(null);
  const [allCopied, setAllCopied] = useState(false);

  const exportList = categoryFilter === 'all' ? questions : filteredQuestions;

  const handleCopyAll = () => {
    const text = exportList
      .map((q, i) => `${i + 1}. [${getCategoryConfig(q.category).label}] ${q.question}`)
      .join('\n\n');
    navigator.clipboard.writeText(text);
    setAllCopied(true);
    setExportAnchor(null);
    setTimeout(() => setAllCopied(false), 2000);
  };

  const handleExportCSV = () => {
    const rows = [
      ['#', 'Category', 'Question', 'Context', 'Northstar Integrators Connection', 'Product Focus', 'Persona', 'Internal Research'],
      ...exportList.map((q, i) => [
        String(i + 1),
        getCategoryConfig(q.category).label,
        q.question,
        q.context,
        q.northstar_connection,
        q.product_focus,
        q.target_persona,
        q.internal_kb_sourced ? 'Yes' : 'No',
      ]),
    ];
    const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${companyName.replace(/\s+/g, '_')}_Discovery_Questions.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExportAnchor(null);
  };

  const handleExportExcel = () => {
    const rows = exportList.map((q, i) => ({
      '#': i + 1,
      'Category': getCategoryConfig(q.category).label,
      'Internal Research': q.internal_kb_sourced ? 'Yes' : '',
      'Question': q.question,
      'Persona': q.target_persona,
      'Research Context': q.context,
      'Northstar Integrators Connection': q.northstar_connection,
      'Product / Service Focus': q.product_focus,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);

    // Column widths
    ws['!cols'] = [
      { wch: 4 }, { wch: 20 }, { wch: 16 }, { wch: 70 },
      { wch: 20 }, { wch: 50 }, { wch: 50 }, { wch: 30 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Discovery Questions');
    XLSX.writeFile(wb, `${companyName.replace(/\s+/g, '_')}_Discovery_Questions.xlsx`);
    setExportAnchor(null);
  };

  // ── Loading ────────────────────────────────────────────────
  if (loading) {
    return (
      <Box sx={{ py: 6, textAlign: 'center' }}>
        <CircularProgress size={32} sx={{ color: '#002348', mb: 2 }} />
        <Typography variant="body1" sx={{ fontWeight: 500, color: '#1e293b' }}>
          Generating discovery questions
        </Typography>
        <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5 }}>
          Analyzing research data for {companyName}
        </Typography>
      </Box>
    );
  }

  if (error) return <Alert severity="error">{error}</Alert>;
  if (questions.length === 0) return null;

  // ── Render ─────────────────────────────────────────────────
  return (
    <Box>

      {/* ── Header ── */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.05rem', color: '#0f172a' }}>
              Discovery Questions
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b' }}>
              {questions.length} strategic questions for {companyName}
            </Typography>
          </Box>

          {/* Export button */}
          <Box>
            <Button
              size="small"
              variant="outlined"
              startIcon={allCopied ? <CheckCircle sx={{ fontSize: 15 }} /> : <FileDownload sx={{ fontSize: 15 }} />}
              onClick={(e) => setExportAnchor(e.currentTarget)}
              sx={{
                fontSize: '0.78rem',
                fontWeight: 600,
                textTransform: 'none',
                borderColor: '#e2e8f0',
                color: allCopied ? '#059669' : '#475569',
                borderRadius: 1.5,
                px: 1.5,
                py: 0.5,
                '&:hover': { borderColor: '#cbd5e1', bgcolor: '#f8fafc' },
              }}
            >
              {allCopied ? 'Copied!' : 'Export'}
            </Button>
            <Menu
              anchorEl={exportAnchor}
              open={Boolean(exportAnchor)}
              onClose={() => setExportAnchor(null)}
              slotProps={{ paper: { elevation: 2, sx: { borderRadius: 1.5, minWidth: 180, border: '1px solid #f1f5f9' } } }}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            >
              <MenuItem onClick={handleCopyAll} sx={{ py: 1, gap: 1 }}>
                <ListItemIcon sx={{ minWidth: 28 }}><Assignment sx={{ fontSize: 17, color: '#475569' }} /></ListItemIcon>
                <Typography variant="body2" sx={{ fontSize: '0.82rem' }}>Copy all as text</Typography>
              </MenuItem>
              <MenuItem onClick={handleExportCSV} sx={{ py: 1, gap: 1 }}>
                <ListItemIcon sx={{ minWidth: 28 }}><TableChart sx={{ fontSize: 17, color: '#475569' }} /></ListItemIcon>
                <Typography variant="body2" sx={{ fontSize: '0.82rem' }}>Download CSV</Typography>
              </MenuItem>
              <MenuItem onClick={handleExportExcel} sx={{ py: 1, gap: 1 }}>
                <ListItemIcon sx={{ minWidth: 28 }}><FileDownload sx={{ fontSize: 17, color: '#16a34a' }} /></ListItemIcon>
                <Typography variant="body2" sx={{ fontSize: '0.82rem' }}>Download Excel (.xlsx)</Typography>
              </MenuItem>
            </Menu>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Typography variant="caption" sx={{ color: '#94a3b8' }}>
            {askedIds.size} of {questions.length} completed
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{
            height: 3,
            borderRadius: 2,
            bgcolor: '#f1f5f9',
            '& .MuiLinearProgress-bar': {
              bgcolor: progress === 100 ? '#059669' : '#002348',
              borderRadius: 2,
            },
          }}
        />
      </Box>

      {/* ── Category Filter Chips ── */}
      {categories.length > 2 && (
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mb: 2.5 }}>
          {categories.map(cat => {
            const config = getCategoryConfig(cat);
            const isActive = categoryFilter === cat;
            const count = cat === 'all' ? questions.length : questions.filter(q => q.category === cat).length;
            return (
              <Chip
                key={cat}
                label={cat === 'all' ? `All (${count})` : `${config.label} (${count})`}
                onClick={() => setCategoryFilter(cat)}
                size="small"
                sx={{
                  height: 26,
                  fontSize: '0.75rem',
                  fontWeight: isActive ? 600 : 400,
                  bgcolor: isActive ? '#0f172a' : '#f8fafc',
                  color: isActive ? '#fff' : '#475569',
                  border: isActive ? '1px solid #0f172a' : '1px solid #e2e8f0',
                  cursor: 'pointer',
                  '&:hover': { bgcolor: isActive ? '#1e293b' : '#f1f5f9' },
                }}
              />
            );
          })}
        </Stack>
      )}

      {/* ── Questions ── */}
      <Stack spacing={0} sx={{ border: '1px solid #e8ecf0', borderRadius: 2, overflow: 'hidden' }}>
        {filteredQuestions.map((q, idx) => {
          const config = getCategoryConfig(q.category);
          const isExpanded = expandedIds.has(q.id);
          const isAsked = askedIds.has(q.id);
          const isLast = idx === filteredQuestions.length - 1;

          return (
            <Box key={q.id}>
              {/* Question row */}
              <Box
                onClick={() => toggleExpand(q.id)}
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 1.5,
                  px: 2.5,
                  py: 2,
                  cursor: 'pointer',
                  bgcolor: isAsked ? '#fafbfc' : '#fff',
                  transition: 'background 0.1s',
                  '&:hover': { bgcolor: '#f8fafc' },
                }}
              >
                {/* Check button */}
                <Tooltip title={isAsked ? 'Mark as pending' : 'Mark as asked'}>
                  <IconButton
                    size="small"
                    onClick={(e) => toggleAsked(q.id, e)}
                    sx={{
                      p: 0,
                      mt: 0.15,
                      color: isAsked ? '#059669' : '#cbd5e1',
                      flexShrink: 0,
                      '&:hover': { color: isAsked ? '#047857' : '#94a3b8', bgcolor: 'transparent' },
                    }}
                  >
                    {isAsked
                      ? <CheckCircle sx={{ fontSize: 20 }} />
                      : <RadioButtonUnchecked sx={{ fontSize: 20 }} />}
                  </IconButton>
                </Tooltip>

                {/* Content */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  {/* Labels row */}
                  <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 0.6 }}>
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: config.dot, flexShrink: 0 }} />
                      <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                        {config.label}
                      </Typography>
                    </Stack>
                    {q.internal_kb_sourced && (
                      <Typography variant="caption" sx={{ color: '#b45309', fontWeight: 600, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                        ⚡ Internal Research
                      </Typography>
                    )}
                    <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.68rem' }}>
                      {q.target_persona}
                    </Typography>
                  </Stack>

                  {/* Question text */}
                  <Typography
                    variant="body2"
                    sx={{
                      color: isAsked ? '#94a3b8' : '#0f172a',
                      fontWeight: isAsked ? 400 : 500,
                      lineHeight: 1.55,
                      textDecoration: isAsked ? 'line-through' : 'none',
                      fontSize: '0.875rem',
                    }}
                  >
                    {q.question}
                  </Typography>
                </Box>

                {/* Actions */}
                <Stack direction="row" alignItems="center" spacing={0} sx={{ flexShrink: 0 }}>
                  <Tooltip title={copiedId === q.id ? 'Copied!' : 'Copy question'}>
                    <IconButton
                      size="small"
                      onClick={(e) => copyQuestion(q.question, q.id, e)}
                      sx={{
                        p: 0.5,
                        color: copiedId === q.id ? '#059669' : '#cbd5e1',
                        '&:hover': { color: '#64748b', bgcolor: 'transparent' },
                      }}
                    >
                      <ContentCopy sx={{ fontSize: 15 }} />
                    </IconButton>
                  </Tooltip>
                  <IconButton
                    size="small"
                    sx={{ p: 0.5, color: '#cbd5e1', '&:hover': { color: '#64748b', bgcolor: 'transparent' } }}
                  >
                    {isExpanded ? <ExpandLess sx={{ fontSize: 18 }} /> : <ExpandMore sx={{ fontSize: 18 }} />}
                  </IconButton>
                </Stack>
              </Box>

              {/* Expanded details */}
              <Collapse in={isExpanded}>
                <Box sx={{ px: 2.5, pb: 2.5, bgcolor: '#f8fafc', borderTop: '1px solid #f1f5f9' }}>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, pt: 2 }}>
                    {/* Research Context */}
                    <Box>
                      <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', mb: 0.75 }}>
                        Research Context
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#475569', fontSize: '0.8rem', lineHeight: 1.6 }}>
                        {q.context}
                      </Typography>
                    </Box>

                    {/* Northstar Integrators Value Connection */}
                    <Box>
                      <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', mb: 0.75 }}>
                        Northstar Integrators Connection
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#475569', fontSize: '0.8rem', lineHeight: 1.6 }}>
                        {q.northstar_connection}
                      </Typography>
                    </Box>
                  </Box>

                  {q.product_focus && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', mb: 0.75 }}>
                        Product / Service Focus
                      </Typography>
                      <Chip
                        label={q.product_focus}
                        size="small"
                        sx={{ height: 22, fontSize: '0.75rem', fontWeight: 500, bgcolor: '#fff', border: '1px solid #e2e8f0', color: '#475569' }}
                      />
                    </Box>
                  )}
                </Box>
              </Collapse>

              {!isLast && <Divider sx={{ borderColor: '#f1f5f9' }} />}
            </Box>
          );
        })}
      </Stack>

      {/* ── Footer summary ── */}
      {askedIds.size > 0 && (
        <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="caption" sx={{ color: '#64748b' }}>
            {askedIds.size} of {questions.length} questions covered
          </Typography>
          {progress === 100 && (
            <Chip
              label="All questions completed ✓"
              size="small"
              sx={{ bgcolor: '#ecfdf5', color: '#047857', fontWeight: 600, fontSize: '0.72rem', border: '1px solid #a7f3d0' }}
            />
          )}
        </Box>
      )}
    </Box>
  );
};

export default AIQuestionnaire;
