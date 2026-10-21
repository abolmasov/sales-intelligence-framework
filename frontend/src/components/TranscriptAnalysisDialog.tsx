import React, { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Chip,
  IconButton,
  CircularProgress,
  Alert,
  Stack,
  alpha,
} from '@mui/material';
import { Assessment as Assignment, Close as CloseIcon, Download, Business } from '@mui/icons-material';
import { apiGet, apiPost } from '../utils/api';
import TranscriptAnalysisInsight from './TranscriptAnalysisInsight';

const COLORS = {
  primary: '#171717',
  success: '#059669',
  info: '#2563eb',
  slate50: '#f8fafc',
  slate200: '#e2e8f0',
  slate500: '#64748b',
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

  const handleDownloadExcel = () => {
    if (!analysisId) return;
    const url = `/api/transcripts/${analysisId}/export-excel`;
    const a = document.createElement('a');
    a.href = url;
    a.download = `${analysisData?.meetingTitle || analysisData?.companyName || 'analysis'}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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
          bgcolor: 'background.paper',
          borderRadius: 3,
          border: '1px solid rgba(15,23,42,0.08)',
          maxHeight: '90vh',
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid rgba(15,23,42,0.08)',
          bgcolor: 'background.default',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Assignment sx={{ color: 'secondary.main', fontSize: 28 }} />
          <Box>
            <Typography variant="h5" sx={{ color: 'text.primary', fontWeight: 600 }}>
              {analysisData?.companyName || 'Transcript Analysis'}
            </Typography>
            {analysisData?.meetingTitle && (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
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
          <IconButton onClick={onClose} sx={{ color: 'text.secondary' }}>
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

        {!loading && !error && analysisData?.status === 'completed' && (
          <Box ref={contentRef}>
            <TranscriptAnalysisInsight analysisData={analysisData} />
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', pt: 3 }}>
              {analysisData?.analyzedAt && (
                <Chip
                  label={`Analyzed: ${new Date(analysisData.analyzedAt).toLocaleString()}`}
                  size="small"
                  sx={{ bgcolor: 'rgba(37, 99, 235, 0.08)', color: '#1e3a8a' }}
                />
              )}
              {analysisData?.dealId && (
                <Chip
                  label={`Deal ID: ${analysisData.dealId}`}
                  size="small"
                  sx={{ bgcolor: 'rgba(16, 185, 129, 0.12)', color: '#065f46' }}
                />
              )}
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ borderTop: '1px solid rgba(15,23,42,0.08)', p: 2, bgcolor: 'background.default' }}>
        {analysisData?.status === 'completed' && (
          <Button onClick={handleDownloadExcel} variant="outlined" color="success">
            Export Excel
          </Button>
        )}
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
