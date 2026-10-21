import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Stack,
  Button,
  CircularProgress,
  Alert,
  Divider,
  IconButton,
  Tooltip,
  Link,
  LinearProgress,
} from '@mui/material';
import * as XLSX from 'xlsx';
import {
  ExpandMore,
  CheckCircle,
  Warning,
  Error as ErrorIcon,
  ContentCopy,
  Download,
  Science,
  QuestionAnswer,
  Source as SourceIcon,
  OpenInNew,
  Upload,
  FindInPage,
  Search,
  AutoFixHigh,
  Terminal,
  Info,
} from '@mui/icons-material';
import type { RFPResearchResult, RFPQuestion, RFPAnswer, AnswerSource, RFPLogEntry } from '../store/proposalStore';

interface RFPResearchPanelProps {
  result: RFPResearchResult | null;
  loading: boolean;
  error: string | null;
  logs?: RFPLogEntry[];
}

const categoryColors: Record<string, { bg: string; color: string }> = {
  technical: { bg: 'rgba(59, 130, 246, 0.15)', color: 'secondary.main' },
  business: { bg: 'rgba(16, 185, 129, 0.15)', color: 'success.main' },
  compliance: { bg: 'rgba(239, 68, 68, 0.15)', color: 'error.main' },
  timeline: { bg: 'rgba(249, 115, 22, 0.15)', color: '#f97316' },
  pricing: { bg: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' },
  general: { bg: 'rgba(107, 114, 128, 0.15)', color: 'text.disabled' },
};

const confidenceConfig = {
  high: { icon: <CheckCircle fontSize="small" />, color: 'success.main', bg: 'rgba(16, 185, 129, 0.15)', label: 'High Confidence' },
  medium: { icon: <Warning fontSize="small" />, color: '#f97316', bg: 'rgba(249, 115, 22, 0.15)', label: 'Medium Confidence' },
  low: { icon: <ErrorIcon fontSize="small" />, color: 'error.main', bg: 'rgba(239, 68, 68, 0.15)', label: 'Low Confidence' },
};

// Stage icons mapping
const stageIcons: Record<RFPLogEntry['stage'], React.ReactNode> = {
  upload: <Upload fontSize="small" />,
  extraction: <FindInPage fontSize="small" />,
  knowledge_search: <Search fontSize="small" />,
  answer_generation: <AutoFixHigh fontSize="small" />,
  complete: <CheckCircle fontSize="small" />,
};

// Level colors mapping
const levelColors: Record<RFPLogEntry['level'], string> = {
  info: '#3b82f6',
  success: '#10b981',
  warning: '#f97316',
  error: '#ef4444',
  progress: '#8b5cf6',
};

const RFPResearchPanel: React.FC<RFPResearchPanelProps> = ({ result, loading, error, logs = [] }) => {
  const [expandedQuestion, setExpandedQuestion] = useState<string | false>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs to bottom when new logs arrive
  useEffect(() => {
    if (logContainerRef.current && logs.length > 0) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const handleCopyAnswer = async (questionId: string, answer: string) => {
    try {
      await navigator.clipboard.writeText(answer);
      setCopiedId(questionId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleExportAll = () => {
    if (!result) return;

    const content = result.questions.map((q, idx) => {
      const answer = result.answers.find((a) => a.questionId === q.id);
      return `## Question ${idx + 1}: ${q.questionText}\n\n**Category:** ${q.category}${q.section ? ` | **Section:** ${q.section}` : ''}\n\n**Answer:**\n${answer?.answer || 'No answer available'}\n\n**Confidence:** ${answer?.confidence || 'N/A'}\n\n---\n`;
    }).join('\n');

    const header = `# RFP Research Results\n\n**Summary:** ${result.rfpSummary}\n${result.companyName ? `**Company:** ${result.companyName}\n` : ''}\n**Total Questions:** ${result.metadata.totalQuestions}\n**Average Confidence:** ${(result.metadata.averageConfidence * 100).toFixed(1)}%\n\n---\n\n`;

    const blob = new Blob([header + content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rfp-research-${result.companyName || 'results'}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleExportExcel = () => {
    if (!result) return;

    // Create worksheet data
    const wsData = [
      // Header row
      ['#', 'Question', 'Keywords', 'Question Summary', 'Category', 'Section', 'Answer', 'Confidence', 'Confidence Score', 'Sources'],
    ];

    // Add question/answer rows
    result.questions.forEach((q, idx) => {
      const answer = result.answers.find((a) => a.questionId === q.id);
      const sources = answer?.sources?.map(s => s.title).join('; ') || '';
      const keywords = q.keywords?.join(', ') || '';

      wsData.push([
        String(idx + 1),
        q.questionText,
        keywords,
        q.summary || '',
        q.category,
        q.section || '',
        answer?.answer || 'No answer available',
        answer?.confidence || 'N/A',
        answer?.confidenceScore ? `${(answer.confidenceScore * 100).toFixed(0)}%` : 'N/A',
        sources,
      ]);
    });

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Set column widths
    ws['!cols'] = [
      { wch: 5 },   // #
      { wch: 60 },  // Question
      { wch: 30 },  // Keywords
      { wch: 50 },  // Question Summary
      { wch: 12 },  // Category
      { wch: 15 },  // Section
      { wch: 80 },  // Answer
      { wch: 12 },  // Confidence
      { wch: 15 },  // Confidence Score
      { wch: 40 },  // Sources
    ];

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'RFP Answers');

    // Add summary sheet
    const summaryData = [
      ['RFP Research Results Summary'],
      [''],
      ['Summary', result.rfpSummary],
      ['Company', result.companyName || 'N/A'],
      ['Total Questions', result.metadata.totalQuestions],
      ['Answers Generated', result.metadata.answeredQuestions],
      ['Average Confidence', `${(result.metadata.averageConfidence * 100).toFixed(1)}%`],
      ['Processing Time', `${(result.metadata.processingTimeMs / 1000).toFixed(1)}s`],
      [''],
      ['Confidence Breakdown'],
      ['High Confidence', result.answers.filter(a => a.confidence === 'high').length],
      ['Medium Confidence', result.answers.filter(a => a.confidence === 'medium').length],
      ['Low Confidence', result.answers.filter(a => a.confidence === 'low').length],
    ];

    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
    summaryWs['!cols'] = [{ wch: 20 }, { wch: 80 }];
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

    // Generate Excel file and trigger download
    const fileName = `rfp-answers-${result.companyName || 'response'}-${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const handleDownloadExcel = () => {
    if (!result?.answeredExcel) return;

    // Decode base64 and create blob
    const binaryString = atob(result.answeredExcel);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rfp-answered-${result.metadata?.fileName || 'response'}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const getAnswerForQuestion = (questionId: string): RFPAnswer | undefined => {
    return result?.answers.find((a) => a.questionId === questionId);
  };

  const renderSource = (source: AnswerSource, idx: number) => (
    <Paper
      key={idx}
      variant="outlined"
      sx={{
        p: 1.5,
        bgcolor: source.type === 'internal-kb' ? 'rgba(59, 130, 246, 0.05)' : 'rgba(16, 185, 129, 0.05)',
        borderColor: source.type === 'internal-kb' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(16, 185, 129, 0.2)',
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
        <Chip
          size="small"
          label={source.type === 'internal-kb' ? 'InternalKnowledge' : 'Case Study'}
          sx={{
            bgcolor: source.type === 'internal-kb' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)',
            color: source.type === 'internal-kb' ? '#3b82f6' : '#10b981',
            fontWeight: 600,
            fontSize: '0.7rem',
          }}
        />
        <Typography variant="subtitle2" sx={{ fontWeight: 600, flex: 1 }}>
          {source.title}
        </Typography>
        {source.url && (
          <Tooltip title="Open source">
            <IconButton size="small" component={Link} href={source.url} target="_blank">
              <OpenInNew fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
        {source.excerpt}
      </Typography>
    </Paper>
  );

  const renderQuestionAccordion = (question: RFPQuestion, idx: number) => {
    const answer = getAnswerForQuestion(question.id);
    const catStyle = categoryColors[question.category] || categoryColors.general;
    const confConfig = answer ? confidenceConfig[answer.confidence] : null;

    return (
      <Accordion
        key={question.id}
        expanded={expandedQuestion === question.id}
        onChange={(_, isExpanded) => setExpandedQuestion(isExpanded ? question.id : false)}
        sx={{
          mb: 1,
          border: '1px solid rgba(0, 35, 72, 0.08)',
          borderRadius: '12px !important',
          '&:before': { display: 'none' },
          boxShadow: 'none',
          '&.Mui-expanded': {
            boxShadow: '0 4px 12px rgba(0, 35, 72, 0.08)',
          },
        }}
      >
        <AccordionSummary
          expandIcon={<ExpandMore />}
          sx={{
            '& .MuiAccordionSummary-content': { alignItems: 'center', gap: 1.5 },
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600, color: '#1A385E', minWidth: 28 }}>
            Q{idx + 1}
          </Typography>
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2" sx={{ color: 'text.primary' }}>
              {question.questionText.length > 100
                ? question.questionText.substring(0, 100) + '...'
                : question.questionText}
            </Typography>
            {/* Show first 3 keywords as preview */}
            {question.keywords?.length > 0 && (
              <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }} flexWrap="wrap" useFlexGap>
                {question.keywords.slice(0, 3).map((kw, i) => (
                  <Chip
                    key={i}
                    label={kw}
                    size="small"
                    sx={{
                      height: 18,
                      fontSize: '0.65rem',
                      bgcolor: 'rgba(139, 92, 246, 0.1)',
                      color: '#7c3aed',
                      '& .MuiChip-label': { px: 1 },
                    }}
                  />
                ))}
                {question.keywords.length > 3 && (
                  <Typography variant="caption" sx={{ color: 'text.disabled', alignSelf: 'center' }}>
                    +{question.keywords.length - 3} more
                  </Typography>
                )}
              </Stack>
            )}
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip
              size="small"
              label={question.category}
              sx={{ bgcolor: catStyle.bg, color: catStyle.color, fontWeight: 600, fontSize: '0.7rem' }}
            />
            {confConfig && (
              <Chip
                size="small"
                icon={confConfig.icon}
                label={answer?.confidence}
                sx={{ bgcolor: confConfig.bg, color: confConfig.color, fontWeight: 600, fontSize: '0.7rem' }}
              />
            )}
          </Stack>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0 }}>
          <Divider sx={{ mb: 2 }} />

          {/* Question Analysis - Keywords and Summary */}
          {(question.keywords?.length > 0 || question.summary) && (
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                mb: 2,
                bgcolor: 'rgba(139, 92, 246, 0.05)',
                borderColor: 'rgba(139, 92, 246, 0.2)',
                borderRadius: 2,
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                <AutoFixHigh sx={{ fontSize: 16, color: '#8b5cf6' }} />
                <Typography variant="caption" sx={{ fontWeight: 600, color: '#8b5cf6' }}>
                  QUESTION ANALYSIS
                </Typography>
              </Stack>

              {/* Keywords */}
              {question.keywords?.length > 0 && (
                <Box sx={{ mb: question.summary ? 1.5 : 0 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                    Key Topics
                  </Typography>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                    {question.keywords.map((keyword, kIdx) => (
                      <Chip
                        key={kIdx}
                        label={keyword}
                        size="small"
                        sx={{
                          bgcolor: 'rgba(139, 92, 246, 0.12)',
                          color: '#7c3aed',
                          fontWeight: 500,
                          fontSize: '0.7rem',
                          height: 22,
                        }}
                      />
                    ))}
                  </Stack>
                </Box>
              )}

              {/* Summary */}
              {question.summary && (
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                    What This Question Is About
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                    {question.summary}
                  </Typography>
                </Box>
              )}
            </Paper>
          )}

          {/* Full Question */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              QUESTION / REQUIREMENT
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5, color: 'text.primary' }}>
              {question.questionText}
            </Typography>
            {question.section && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                Section: {question.section}
              </Typography>
            )}
          </Box>

          {/* Answer */}
          {answer && (
            <Box sx={{ mb: 2 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  SUGGESTED ANSWER
                </Typography>
                <Tooltip title={copiedId === question.id ? 'Copied!' : 'Copy answer'}>
                  <IconButton
                    size="small"
                    onClick={() => handleCopyAnswer(question.id, answer.answer)}
                    sx={{ color: copiedId === question.id ? '#10b981' : '#6b7280' }}
                  >
                    <ContentCopy fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  bgcolor: '#FAFAFA',
                  borderRadius: 2,
                  whiteSpace: 'pre-wrap',
                }}
              >
                <Typography variant="body2">{answer.answer}</Typography>
              </Paper>

              {/* Confidence */}
              {confConfig && (
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1.5 }}>
                  {confConfig.icon}
                  <Typography variant="caption" sx={{ color: confConfig.color, fontWeight: 600 }}>
                    {confConfig.label} ({(answer.confidenceScore * 100).toFixed(0)}%)
                  </Typography>
                </Stack>
              )}

              {/* Sources */}
              {answer.sources.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 1 }}>
                    <SourceIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                      SOURCES ({answer.sources.length})
                    </Typography>
                  </Stack>
                  <Stack spacing={1}>
                    {answer.sources.map((source, i) => renderSource(source, i))}
                  </Stack>
                </Box>
              )}
            </Box>
          )}
        </AccordionDetails>
      </Accordion>
    );
  };

  // Get current stage for progress indicator
  const getCurrentStage = (): RFPLogEntry['stage'] => {
    if (logs.length === 0) return 'upload';
    const lastLog = logs[logs.length - 1];
    return lastLog.stage;
  };

  const getStageProgress = (stage: RFPLogEntry['stage']): number => {
    const stages: RFPLogEntry['stage'][] = ['upload', 'extraction', 'knowledge_search', 'answer_generation', 'complete'];
    const currentIndex = stages.indexOf(stage);
    return ((currentIndex + 1) / stages.length) * 100;
  };

  // Loading state with live logs
  if (loading) {
    const currentStage = getCurrentStage();
    const progress = getStageProgress(currentStage);

    return (
      <Paper sx={{ p: 3, border: '1px solid rgba(0, 35, 72, 0.08)', borderRadius: 3 }}>
        {/* Header */}
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
          <CircularProgress size={32} sx={{ color: '#00A48C' }} />
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ color: 'text.primary', fontWeight: 600 }}>
              Analyzing RFP Document...
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {currentStage === 'upload' && 'Uploading and preparing document...'}
              {currentStage === 'extraction' && 'Extracting questions from document...'}
              {currentStage === 'knowledge_search' && 'Searching internal knowledge base...'}
              {currentStage === 'answer_generation' && 'Generating answers with AI...'}
              {currentStage === 'complete' && 'Finalizing results...'}
            </Typography>
          </Box>
        </Stack>

        {/* Progress Bar */}
        <Box sx={{ mb: 3 }}>
          <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography variant="caption" color="text.secondary">Progress</Typography>
            <Typography variant="caption" color="text.secondary">{Math.round(progress)}%</Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              height: 8,
              borderRadius: 4,
              bgcolor: 'rgba(0, 164, 140, 0.1)',
              '& .MuiLinearProgress-bar': {
                bgcolor: '#00A48C',
                borderRadius: 4,
              },
            }}
          />
        </Box>

        {/* Stage Indicators */}
        <Stack direction="row" spacing={1} sx={{ mb: 3 }}>
          {(['upload', 'extraction', 'knowledge_search', 'answer_generation', 'complete'] as const).map((stage) => {
            const isActive = stage === currentStage;
            const isPast = getStageProgress(stage) < getStageProgress(currentStage);
            const stageLabels: Record<string, string> = {
              upload: 'Upload',
              extraction: 'Extract',
              knowledge_search: 'Search',
              answer_generation: 'Generate',
              complete: 'Complete',
            };

            return (
              <Chip
                key={stage}
                icon={stageIcons[stage] as React.ReactElement}
                label={stageLabels[stage]}
                size="small"
                sx={{
                  bgcolor: isPast ? 'rgba(16, 185, 129, 0.15)' : isActive ? 'rgba(0, 164, 140, 0.15)' : 'rgba(0, 35, 72, 0.05)',
                  color: isPast ? '#10b981' : isActive ? '#00A48C' : '#6b7280',
                  fontWeight: isActive ? 600 : 400,
                  border: isActive ? '1px solid #00A48C' : 'none',
                  '& .MuiChip-icon': {
                    color: isPast ? '#10b981' : isActive ? '#00A48C' : '#6b7280',
                  },
                }}
              />
            );
          })}
        </Stack>

        {/* Live Log Terminal */}
        <Paper
          variant="outlined"
          sx={{
            bgcolor: 'text.primary',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          {/* Terminal Header */}
          <Box
            sx={{
              px: 2,
              py: 1,
              bgcolor: 'rgba(255, 255, 255, 0.05)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <Terminal sx={{ fontSize: 16, color: '#00A48C' }} />
            <Typography variant="caption" sx={{ color: '#a0a0a0', fontFamily: 'monospace' }}>
              Live Processing Log
            </Typography>
            <Box sx={{ flex: 1 }} />
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: 'success.main',
                animation: 'pulse 1.5s infinite',
                '@keyframes pulse': {
                  '0%, 100%': { opacity: 1 },
                  '50%': { opacity: 0.4 },
                },
              }}
            />
          </Box>

          {/* Log Content */}
          <Box
            ref={logContainerRef}
            sx={{
              p: 2,
              maxHeight: 280,
              minHeight: 120,
              overflowY: 'auto',
              fontFamily: 'monospace',
              fontSize: '0.8rem',
              '&::-webkit-scrollbar': {
                width: 6,
              },
              '&::-webkit-scrollbar-track': {
                bgcolor: 'rgba(255, 255, 255, 0.05)',
              },
              '&::-webkit-scrollbar-thumb': {
                bgcolor: 'rgba(255, 255, 255, 0.2)',
                borderRadius: 3,
              },
            }}
          >
            {logs.length === 0 ? (
              <Typography sx={{ color: 'text.disabled', fontStyle: 'italic' }}>
                Waiting for processing to begin...
              </Typography>
            ) : (
              <Stack spacing={0.5}>
                {logs.map((log, idx) => {
                  const timestamp = typeof log.timestamp === 'string'
                    ? new Date(log.timestamp).toLocaleTimeString()
                    : log.timestamp.toLocaleTimeString();

                  return (
                    <Box key={idx} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                      {/* Timestamp */}
                      <Typography
                        component="span"
                        sx={{ color: 'text.disabled', minWidth: 70, flexShrink: 0 }}
                      >
                        {timestamp}
                      </Typography>

                      {/* Level indicator */}
                      <Box
                        sx={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          bgcolor: levelColors[log.level],
                          mt: 0.75,
                          flexShrink: 0,
                        }}
                      />

                      {/* Stage badge */}
                      <Typography
                        component="span"
                        sx={{
                          color: '#8b5cf6',
                          minWidth: 80,
                          flexShrink: 0,
                          textTransform: 'uppercase',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                        }}
                      >
                        [{log.stage.replace('_', ' ')}]
                      </Typography>

                      {/* Message */}
                      <Typography
                        component="span"
                        sx={{
                          color: log.level === 'error' ? '#ef4444' :
                                 log.level === 'success' ? '#10b981' :
                                 log.level === 'warning' ? '#f97316' : '#e0e0e0',
                          flex: 1,
                          wordBreak: 'break-word',
                        }}
                      >
                        {log.message}
                        {log.details && (
                          <Typography
                            component="span"
                            sx={{ color: 'text.disabled', ml: 1, fontSize: '0.75rem' }}
                          >
                            {typeof log.details === 'object'
                              ? Object.entries(log.details).map(([k, v]) => `${k}: ${v}`).join(', ')
                              : log.details}
                          </Typography>
                        )}
                      </Typography>
                    </Box>
                  );
                })}
              </Stack>
            )}
          </Box>
        </Paper>

        {/* Helper text */}
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 2 }}>
          <Info sx={{ fontSize: 16, color: 'text.disabled' }} />
          <Typography variant="caption" color="text.secondary">
            Processing typically takes 15-45 seconds using optimized batch generation.
          </Typography>
        </Stack>
      </Paper>
    );
  }

  // Error state
  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  // No result state
  if (!result) {
    return (
      <Paper
        sx={{
          p: 6,
          textAlign: 'center',
          border: '1px dashed rgba(0, 35, 72, 0.15)',
          bgcolor: '#FFFFFF',
        }}
      >
        <Science sx={{ fontSize: 48, color: '#00A48C', mb: 1 }} />
        <Typography variant="h6" sx={{ color: 'text.primary', mb: 1 }}>
          RFP Research
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Upload an RFP document to extract questions and generate answers using internal knowledge (InternalKnowledge + Case Studies).
        </Typography>
      </Paper>
    );
  }

  // Results
  return (
    <Box>
      {/* Summary Header */}
      <Paper
        sx={{
          p: 3,
          mb: 3,
          bgcolor: '#FFFFFF',
          borderRadius: 3,
          border: '1px solid rgba(0, 35, 72, 0.08)',
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="h5" sx={{ color: 'text.primary', fontWeight: 700, mb: 1 }}>
              <QuestionAnswer sx={{ mr: 1, verticalAlign: 'middle', color: '#00A48C' }} />
              RFP Research Results
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {result.rfpSummary}
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {result.companyName && (
                <Chip label={result.companyName} sx={{ bgcolor: 'rgba(0, 164, 140, 0.15)', color: '#00806B', fontWeight: 600 }} />
              )}
              {result.isExcel && (
                <Chip label="Excel RFP" sx={{ bgcolor: 'rgba(16, 185, 129, 0.15)', color: 'success.main', fontWeight: 600 }} />
              )}
              {result.metadata?.fileName && (
                <Chip label={result.metadata.fileName} variant="outlined" size="small" sx={{ color: 'text.disabled' }} />
              )}
            </Stack>
          </Box>
          <Stack direction="row" spacing={1}>
            {result.answeredExcel ? (
              <Button
                variant="contained"
                startIcon={<Download />}
                onClick={handleDownloadExcel}
                sx={{ bgcolor: 'success.main', '&:hover': { bgcolor: 'success.main' } }}
              >
                Download Excel
              </Button>
            ) : (
              <Button
                variant="contained"
                startIcon={<Download />}
                onClick={handleExportExcel}
                sx={{ bgcolor: 'success.main', '&:hover': { bgcolor: 'success.main' } }}
              >
                Export to Excel
              </Button>
            )}
            <Button
              variant="outlined"
              startIcon={<Download />}
              onClick={handleExportAll}
              sx={{ borderColor: '#00A48C', color: '#00A48C' }}
            >
              Export Markdown
            </Button>
          </Stack>
        </Stack>

        <Divider sx={{ my: 2 }} />

        {/* Stats */}
        <Stack direction="row" spacing={4}>
          <Box>
            <Typography variant="h4" sx={{ color: 'text.primary', fontWeight: 700 }}>
              {result.metadata.totalQuestions}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Questions Extracted
            </Typography>
          </Box>
          <Box>
            <Typography variant="h4" sx={{ color: 'success.main', fontWeight: 700 }}>
              {result.metadata.answeredQuestions}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Answers Generated
            </Typography>
          </Box>
          <Box>
            <Typography variant="h4" sx={{ color: '#f97316', fontWeight: 700 }}>
              {(result.metadata.averageConfidence * 100).toFixed(0)}%
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Avg. Confidence
            </Typography>
          </Box>
          <Box>
            <Typography variant="h4" sx={{ color: 'secondary.main', fontWeight: 700 }}>
              {(result.metadata.processingTimeMs / 1000).toFixed(1)}s
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Processing Time
            </Typography>
          </Box>
        </Stack>
      </Paper>

      {/* Questions List */}
      <Box>
        {result.questions.map((question, idx) => renderQuestionAccordion(question, idx))}
      </Box>
    </Box>
  );
};

export default RFPResearchPanel;
