import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Paper,
  Typography,
  Chip,
  Button,
  CircularProgress,
  Alert,
  Stack,
  alpha,
  Fade,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Assessment as AssignmentIcon,
  ArrowBack,
  Download,
  Business,
  CalendarToday,
  RecordVoiceOver,
} from '@mui/icons-material';
import { apiGet, apiPost } from '../utils/api';
import TranscriptAnalysisInsight from '../components/TranscriptAnalysisInsight';

const THEME = {
  primary: '#171717',
  accent: '#2563eb',
  success: '#059669',
  warning: '#d97706',
  error: '#dc2626',
  slate50: '#f8fafc',
  slate200: '#e2e8f0',
  slate500: '#64748b',
};

const TranscriptAnalysisPage: React.FC = () => {
  const { analysisId } = useParams<{ analysisId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [creatingDeal, setCreatingDeal] = useState(false);
  const [createDealError, setCreateDealError] = useState<string | null>(null);
  const [createDealSuccess, setCreateDealSuccess] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (analysisId) {
      fetchAnalysis();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisId]);

  const fetchAnalysis = async () => {
    if (!analysisId) return;

    setLoading(true);
    setError(null);
    try {
      const data = await apiGet(`/api/transcripts/${analysisId}`);
      setAnalysisData(data.data);
    } catch (err: any) {
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

  const handleGoBack = () => {
    navigate('/app/analysis/postcall');
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <Fade in timeout={400}>
      <Box sx={{ minHeight: '100vh', bgcolor: THEME.slate50 }}>
        <Container maxWidth="xl" sx={{ py: 3 }}>
          {/* Header */}
          <Paper
            elevation={0}
            sx={{
              p: 4,
              mb: 3,
              borderRadius: 3,
              bgcolor: THEME.primary,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Background effect */}
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: '50%',
                height: '100%',
                opacity: 0.1,
                background: 'radial-gradient(circle at 50% 50%, white 0%, transparent 70%)',
              }}
            />
            <Stack direction="row" spacing={3} alignItems="center">
              <Tooltip title="Back to Post-Call Analysis">
                <IconButton
                  onClick={handleGoBack}
                  sx={{
                    bgcolor: alpha('#fff', 0.1),
                    color: 'white',
                    '&:hover': { bgcolor: alpha('#fff', 0.2) },
                  }}
                >
                  <ArrowBack />
                </IconButton>
              </Tooltip>
              <Box
                sx={{
                  width: 64,
                  height: 64,
                  borderRadius: 3,
                  bgcolor: alpha('#fff', 0.15),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <RecordVoiceOver sx={{ fontSize: 32, color: 'white' }} />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h4" sx={{ color: 'white', fontWeight: 700, mb: 0.5 }}>
                  {loading
                    ? 'Loading Analysis...'
                    : analysisData?.meetingTitle || 'Transcript Analysis'}
                </Typography>
                <Stack direction="row" spacing={2} alignItems="center">
                  {analysisData?.companyName && (
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Business sx={{ fontSize: 16, color: alpha('#fff', 0.7) }} />
                      <Typography variant="body2" sx={{ color: alpha('#fff', 0.85) }}>
                        {analysisData.companyName}
                      </Typography>
                    </Stack>
                  )}
                  {analysisData?.analyzedAt && (
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <CalendarToday sx={{ fontSize: 16, color: alpha('#fff', 0.7) }} />
                      <Typography variant="body2" sx={{ color: alpha('#fff', 0.85) }}>
                        {formatDate(analysisData.analyzedAt)}
                      </Typography>
                    </Stack>
                  )}
                </Stack>
              </Box>
              <Stack direction="row" spacing={1.5} alignItems="center">
                {analysisData?.status && (
                  <Chip
                    label={analysisData.status.toUpperCase()}
                    size="medium"
                    sx={{
                      fontWeight: 700,
                      bgcolor:
                        analysisData.status === 'completed'
                          ? THEME.success
                          : analysisData.status === 'processing'
                          ? THEME.accent
                          : THEME.error,
                      color: 'white',
                    }}
                  />
                )}
                <Button
                  variant="contained"
                  startIcon={<Download />}
                  onClick={handleDownloadPdf}
                  disabled={loading || !analysisData}
                  sx={{
                    bgcolor: alpha('#fff', 0.15),
                    color: 'white',
                    '&:hover': { bgcolor: alpha('#fff', 0.25) },
                  }}
                >
                  Download PDF
                </Button>
              </Stack>
            </Stack>
          </Paper>

          {/* Main Content */}
          <Paper
            elevation={0}
            sx={{
              borderRadius: 2,
              border: `1px solid ${THEME.slate200}`,
              bgcolor: 'background.paper',
              overflow: 'hidden',
            }}
          >
            <Box sx={{ p: 3 }}>
              {/* Loading State */}
              {loading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                  <CircularProgress />
                </Box>
              )}

              {/* Error State */}
              {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                  {error}
                </Alert>
              )}

              {/* Processing State */}
              {analysisData?.status === 'processing' && (
                <Alert severity="info" sx={{ mb: 3 }}>
                  This analysis is still running. You can return later to view the completed results.
                </Alert>
              )}

              {/* Error State for Analysis */}
              {analysisData?.status === 'error' && (
                <Alert severity="error" sx={{ mb: 3 }}>
                  {analysisData?.errorMessage || 'Analysis failed. Please retry or contact support.'}
                </Alert>
              )}

              {/* Deal Creation Success/Error */}
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

              {/* Prompt to Create Deal */}
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

              {/* Analysis Content */}
              {!loading && !error && analysisData?.status === 'completed' && (
                <Box ref={contentRef}>
                  <TranscriptAnalysisInsight analysisData={analysisData} />
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', pt: 3, mt: 3, borderTop: `1px solid ${THEME.slate200}` }}>
                    {analysisData?.analyzedAt && (
                      <Chip
                        label={`Analyzed: ${new Date(analysisData.analyzedAt).toLocaleString()}`}
                        size="small"
                        sx={{ bgcolor: alpha(THEME.accent, 0.1), color: THEME.accent }}
                      />
                    )}
                    {analysisData?.dealId && (
                      <Chip
                        label={`Deal ID: ${analysisData.dealId}`}
                        size="small"
                        sx={{ bgcolor: alpha(THEME.success, 0.1), color: THEME.success }}
                      />
                    )}
                    {analysisData?.analysisId && (
                      <Chip
                        label={`Analysis ID: ${analysisData.analysisId}`}
                        size="small"
                        sx={{ bgcolor: alpha(THEME.slate500, 0.1), color: THEME.slate500 }}
                      />
                    )}
                  </Box>
                </Box>
              )}
            </Box>
          </Paper>
        </Container>
      </Box>
    </Fade>
  );
};

export default TranscriptAnalysisPage;
