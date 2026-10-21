import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Card,
  CardContent,
  CardActionArea,
  Chip,
  TextField,
  InputAdornment,
  Stack,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  Button,
  MenuItem,
} from '@mui/material';
import {
  Search as SearchIcon,
  CalendarToday as CalendarIcon,
  TrendingUp as TrendingUpIcon,
  Refresh as RefreshIcon,
  Assignment as AssignmentIcon,
  Delete as DeleteIcon,
  Link as LinkIcon,
  Edit as EditIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Handshake as HandshakeIcon,
  Description as TranscriptIcon,
} from '@mui/icons-material';
import { apiGet, apiDelete, apiPatch, apiPost } from '../utils/api';
import { FormControl, Select } from '@mui/material';
import { useCalendarMeetingsStore } from '../store/calendarMeetingsStore';
import StageBadgeLegend from './StageBadgeLegend';
import SaveBookmarkButton from './SaveBookmarkButton';
import ExpiryBadge from './ExpiryBadge';

interface TranscriptAnalysis {
  analysisId: string;
  dealId?: string;
  companyName: string;
  meetingTitle: string;
  opportunityScore: number;
  sentimentOverall: string;
  sentiment?: string | null;
  successProbability: number | null;
  analyzedAt: string;
  status?: 'processing' | 'completed' | 'error';
  errorMessage?: string | null;
  isSaved?: boolean;
  createdAt?: string;
}

interface Deal {
  deal_id: string;
  company_name: string;
  opportunity_name: string;
}

interface PastTranscriptAnalysesProps {
  onViewAnalysis?: (analysisId: string) => void;
}

const PastTranscriptAnalyses: React.FC<PastTranscriptAnalysesProps> = ({ onViewAnalysis }) => {
  const navigate = useNavigate();
  const [analyses, setAnalyses] = useState<TranscriptAnalysis[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);

  // Title editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedTitle, setEditedTitle] = useState('');

  // Deal linking state
  const [deals, setDeals] = useState<Deal[]>([]);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [selectedDealForLink, setSelectedDealForLink] = useState<string>('');
  const [linkSuccess, setLinkSuccess] = useState<string | null>(null);
  const [creatingDealId, setCreatingDealId] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<'all' | '7' | '30' | '90'>('30');
  const [accountFilter, setAccountFilter] = useState<'all' | string>('all');
  const [dealFilter, setDealFilter] = useState<'all' | 'unlinked' | string>('all');
  const refreshMeetings = useCalendarMeetingsStore((state) => state.fetchMeetings);
  const processingAnalyses: TranscriptAnalysis[] = useMemo(() => [], []);

  const dealAccountNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    deals.forEach((deal) => {
      if (deal.deal_id) {
        map[deal.deal_id] = deal.company_name || deal.opportunity_name || 'Linked Deal';
      }
    });
    return map;
  }, [deals]);

  const accountOptions = useMemo(() => {
    const names = new Set<string>();
    deals.forEach((deal) => {
      if (deal.company_name) {
        names.add(deal.company_name);
      }
    });
    return Array.from(names).sort();
  }, [deals]);

  const dealOptions = useMemo(
    () =>
      deals.map((deal) => ({
        value: deal.deal_id,
        label: deal.opportunity_name || deal.company_name || 'Deal',
      })),
    [deals]
  );

  const filteredByDate = useMemo(() => {
    if (dateFilter === 'all') {
      return analyses;
    }
    const days = Number(dateFilter);
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return analyses.filter((analysis) => {
      const timestamp = new Date(analysis.analyzedAt).getTime();
      return Number.isFinite(timestamp) && timestamp >= cutoff;
    });
  }, [analyses, dateFilter]);

  const displayAnalyses = useMemo(() => {
    const combined = [...processingAnalyses, ...filteredByDate];
    if (!searchQuery.trim()) {
      return combined;
    }
    const query = searchQuery.toLowerCase();
    return combined.filter(
      (analysis) =>
        analysis.companyName.toLowerCase().includes(query) ||
        analysis.meetingTitle.toLowerCase().includes(query)
    );
  }, [processingAnalyses, filteredByDate, searchQuery]);

  const accountFilteredAnalyses = useMemo(() => {
    if (accountFilter === 'all') {
      return displayAnalyses;
    }

    return displayAnalyses.filter((analysis) => {
      if (!analysis.dealId) return false;
      const accountName = dealAccountNameMap[analysis.dealId];
      return accountName === accountFilter;
    });
  }, [accountFilter, displayAnalyses, dealAccountNameMap]);

  const dealFilteredAnalyses = useMemo(() => {
    if (dealFilter === 'all') {
      return accountFilteredAnalyses;
    }
    if (dealFilter === 'unlinked') {
      return accountFilteredAnalyses.filter((analysis) => !analysis.dealId);
    }
    return accountFilteredAnalyses.filter((analysis) => analysis.dealId === dealFilter);
  }, [dealFilter, accountFilteredAnalyses]);

  const applyDealIdUpdate = (list: TranscriptAnalysis[], analysisId: string, dealId: string) =>
    list.map((analysis) =>
      analysis.analysisId === analysisId ? { ...analysis, dealId } : analysis
    );

  const fetchAnalyses = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet('/api/transcripts');
      const analysesData = (data.data || []).map((analysis: TranscriptAnalysis) => {
        const normalizeNumber = (value: any) => {
          if (typeof value === 'number' && Number.isFinite(value)) return value;
          if (typeof value === 'string' && value.trim() !== '') {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : null;
          }
          return null;
        };

        return {
          ...analysis,
          opportunityScore: normalizeNumber(analysis.opportunityScore),
          successProbability: normalizeNumber(analysis.successProbability),
          status: analysis.status || 'completed',
        };
      });
      setAnalyses(analysesData);
    } catch (err: any) {
      setError(err.message || 'Failed to load transcript analyses');
    } finally {
      setLoading(false);
    }
  };

  const fetchDeals = async () => {
    try {
      const data = await apiGet('/api/deals');
      const dealsData = data.data || [];
      setDeals(dealsData);
    } catch (err: any) {
      console.error('Failed to load deals:', err.message);
    }
  };

  useEffect(() => {
    fetchAnalyses();
    fetchDeals();
  }, []);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const getSentimentColor = (sentiment: string | null) => {
    if (!sentiment) return '#6b7280'; // neutral/unknown
    const s = sentiment.toLowerCase();
    if (s.includes('positive')) return '#10b981';
    if (s.includes('negative')) return '#ef4444';
    return '#f59e0b'; // neutral
  };

  const detectSentimentCategory = (value?: string | null) => {
    if (!value) return null;
    const normalized = value.toLowerCase();
    if (normalized.includes('positive')) return 'Positive';
    if (normalized.includes('negative')) return 'Negative';
    if (normalized.includes('neutral')) return 'Neutral';
    return null;
  };

  const getSentimentLabel = (overall: string | null, narrative?: string | null) => {
    return detectSentimentCategory(overall) ?? detectSentimentCategory(narrative) ?? 'Neutral';
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return '#10b981';
    if (score >= 40) return '#f59e0b';
    return '#ef4444';
  };

  const renderStatusChip = (analysis: TranscriptAnalysis) => {
    const rawStatus = (analysis.status || 'completed').toLowerCase();
    const status = rawStatus === 'queued' ? 'processing' : rawStatus;
    if (status === 'completed') {
      return (
        <Chip
          label="Completed"
          size="small"
          sx={{ bgcolor: 'rgba(16, 185, 129, 0.15)', color: 'success.main', fontWeight: 600 }}
        />
      );
    }
    if (status === 'processing' || status === 'running') {
      return (
        <Chip
          label="Processing"
          size="small"
          sx={{ bgcolor: 'rgba(59, 130, 246, 0.15)', color: '#60A5FA', fontWeight: 600 }}
        />
      );
    }
    return (
      <Chip
        label="Failed"
        size="small"
        sx={{ bgcolor: 'rgba(239, 68, 68, 0.15)', color: 'error.main', fontWeight: 600 }}
      />
    );
  };

  const renderAnalysisCard = (analysis: TranscriptAnalysis) => {
    const isProcessing = analysis.status === 'processing';
    const canInteract = analysis.status === 'completed';
    const sentimentLabel = getSentimentLabel(analysis.sentimentOverall, analysis.sentiment);

    return (
      <Card
        key={analysis.analysisId}
        elevation={0}
        sx={{
          bgcolor: '#FFFFFF',
          border: '1px solid rgba(0, 35, 72, 0.08)',
          borderRadius: 3,
          transition: 'all 0.2s',
          '&:hover': {
            transform: canInteract ? 'translateY(-4px)' : 'none',
            boxShadow: canInteract ? '0 18px 35px rgba(0, 35, 72, 0.15)' : 'none',
            borderColor: canInteract ? '#00A48C' : 'rgba(0, 35, 72, 0.08)',
          },
        }}
      >
        <CardActionArea
          onClick={canInteract ? () => handleViewAnalysis(analysis.analysisId) : undefined}
          sx={{
            p: 3,
            cursor: canInteract ? 'pointer' : 'default',
            opacity: canInteract ? 1 : 0.85,
          }}
        >
          <CardContent sx={{ p: 0 }}>
            {/* Company Name and Actions */}
            <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: 2,
                  mr: 2,
                  mt: 4,
                  bgcolor: 'rgba(5, 150, 105, 0.14)',
                  color: 'success.main',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <TranscriptIcon sx={{ fontSize: 20 }} />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  {renderStatusChip(analysis)}
                  {analysis.status === 'completed' && sentimentLabel && (
                    <Chip
                      label={sentimentLabel}
                      size="small"
                      sx={{
                        bgcolor: getSentimentColor(sentimentLabel),
                        color: '#fff',
                        fontWeight: 600,
                      }}
                    />
                  )}
                  <ExpiryBadge
                    isSaved={analysis.isSaved ?? false}
                    createdAt={analysis.createdAt || analysis.analyzedAt}
                  />
                </Box>

                {/* Title Editing */}
                {editingId === analysis.analysisId ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                    <TextField
                      size="small"
                      value={editedTitle}
                      onChange={(e) => setEditedTitle(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      sx={{
                        flex: 1,
                        '& .MuiOutlinedInput-root': {
                          bgcolor: '#FFFDF6',
                          color: 'text.primary',
                          fontSize: '1rem',
                          fontWeight: 600,
                          '& fieldset': { borderColor: 'rgba(0, 35, 72, 0.12)' },
                          '&:hover fieldset': { borderColor: '#00A48C' },
                          '&.Mui-focused fieldset': { borderColor: '#00A48C' },
                        },
                        '& .MuiInputBase-input': {
                          padding: '6px 10px',
                        },
                      }}
                    />
                    <Tooltip title="Save">
                      <IconButton
                        size="small"
                        onClick={(e) => handleSaveTitle(analysis.analysisId, e)}
                        sx={{ color: 'success.main' }}
                      >
                        <CheckIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Cancel">
                      <IconButton
                        size="small"
                        onClick={handleCancelEdit}
                        sx={{ color: '#1A385E' }}
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                    <Typography
                      variant="h6"
                      sx={{ color: 'text.primary', fontWeight: 600, flex: 1, fontSize: '1rem' }}
                    >
                      {analysis.meetingTitle?.trim() || `${analysis.companyName || 'Analysis'} Analysis`}
                    </Typography>
                    {!isProcessing && (
                      <>
                        <SaveBookmarkButton
                          modelType="transcriptAnalysis"
                          id={analysis.analysisId}
                          isSaved={analysis.isSaved ?? false}
                          onToggle={(val) => {
                            setAnalyses((prev) =>
                              prev.map((a) =>
                                a.analysisId === analysis.analysisId ? { ...a, isSaved: val } : a
                              )
                            );
                          }}
                        />
                        <Tooltip title="Edit Title">
                          <IconButton
                            size="small"
                            onClick={(e) => handleEditTitle(analysis.analysisId, analysis.meetingTitle, e)}
                            sx={{
                              color: '#005849',
                              padding: '2px',
                              '&:hover': { color: '#C90C61' },
                            }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                  </Box>
                )}

                {/* Deal Linking */}
                <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {analysis.dealId ? (
                    <Chip
                      icon={<LinkIcon />}
                      label={
                        deals.find((d) => d.deal_id === analysis.dealId)?.opportunity_name || 'Linked to deal'
                      }
                      size="small"
                      sx={{
                        bgcolor: 'rgba(0, 164, 140, 0.15)',
                        color: '#00A48C',
                        fontSize: '0.65rem',
                        height: '20px',
                        '& .MuiChip-icon': { fontSize: '0.75rem', color: '#00A48C' },
                      }}
                    />
                  ) : !isProcessing ? (
                    <>
                      <FormControl size="small" sx={{ minWidth: 120 }}>
                        <Select
                          value={selectedDealForLink}
                          onChange={(e) => {
                            e.stopPropagation();
                            setSelectedDealForLink(e.target.value);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          displayEmpty
                          sx={{
                            fontSize: '0.7rem',
                            height: '24px',
                            bgcolor: '#FFFDF6',
                            color: 'text.primary',
                            '& .MuiOutlinedInput-notchedOutline': {
                              borderColor: 'rgba(0, 35, 72, 0.12)',
                            },
                            '&:hover .MuiOutlinedInput-notchedOutline': {
                              borderColor: '#00A48C',
                            },
                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                              borderColor: '#C90C61',
                            },
                          }}
                        >
                          <MenuItem value="" sx={{ fontSize: '0.75rem' }}>
                            <em>Link to deal...</em>
                          </MenuItem>
                          {deals.map((deal) => (
                            <MenuItem key={deal.deal_id} value={deal.deal_id} sx={{ fontSize: '0.75rem' }}>
                              {deal.opportunity_name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      {selectedDealForLink && (
                        <Tooltip title="Link to Deal">
                          <IconButton
                            size="small"
                            onClick={(e) => handleLinkToDeal(analysis.analysisId, e)}
                            disabled={linkingId === analysis.analysisId}
                            sx={{
                              color: 'success.main',
                              padding: '2px',
                              '&:hover': { bgcolor: 'rgba(16, 185, 129, 0.1)' },
                            }}
                          >
                            {linkingId === analysis.analysisId ? (
                              <CircularProgress size={16} sx={{ color: 'success.main' }} />
                            ) : (
                              <CheckIcon fontSize="small" />
                            )}
                          </IconButton>
                        </Tooltip>
                      )}
                    </>
                  ) : null}
                </Box>
              </Box>
            </Box>

            {/* Analysis Details */}
            <Stack spacing={1.5} sx={{ color: '#1A385E' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CalendarIcon sx={{ fontSize: 16, color: '#C90C61' }} />
                <Typography variant="caption" color="text.secondary">
                  {formatDate(analysis.analyzedAt)}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TrendingUpIcon sx={{ fontSize: 16, color: '#F97316' }} />
                <Typography variant="caption" color="text.secondary">
                  Opportunity score:
                  <Box
                    component="span"
                    sx={{ fontWeight: 600, color: getScoreColor(analysis.opportunityScore || 0), ml: 0.5 }}
                  >
                    {typeof analysis.opportunityScore === 'number' ? `${analysis.opportunityScore}/100` : 'N/A'}
                  </Box>
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TrendingUpIcon sx={{ fontSize: 16, color: '#0EA5E9' }} />
                <Typography variant="caption" color="text.secondary">
                  Success probability:
                  <Box
                    component="span"
                    sx={{ fontWeight: 600, color: getScoreColor(analysis.successProbability || 0), ml: 0.5 }}
                  >
                    {typeof analysis.successProbability === 'number' ? `${analysis.successProbability}%` : 'N/A'}
                  </Box>
                </Typography>
              </Box>
            </Stack>

            {/* Actions */}
            <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
              <Button
                variant="contained"
                size="small"
                onClick={(e) => handleDeleteAnalysis(analysis.analysisId, analysis.companyName, e)}
                disabled={deletingId === analysis.analysisId}
                sx={{
                  bgcolor: '#C90C61',
                  '&:hover': { bgcolor: '#A20A4F' },
                }}
              >
                {deletingId === analysis.analysisId ? 'Deleting…' : 'Delete'}
              </Button>
            </Stack>
          </CardContent>
        </CardActionArea>
      </Card>
    );
  };

  const renderAnalysisGrid = (list: TranscriptAnalysis[]) => (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
        gap: 3,
      }}
    >
      {list.map(renderAnalysisCard)}
    </Box>
  );

  const handleViewAnalysis = (analysisId: string) => {
    // Navigate to the transcript analysis page instead of opening a dialog
    navigate(`/app/analysis/transcript/${analysisId}`);
    if (onViewAnalysis) {
      onViewAnalysis(analysisId);
    }
  };

  const handleDeleteAnalysis = async (analysisId: string, companyName: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click

    if (!window.confirm(`Are you sure you want to delete the transcript analysis for ${companyName}? This action cannot be undone.`)) {
      return;
    }

    setDeletingId(analysisId);
    setDeleteSuccess(null);
    setError(null);

    try {
      await apiDelete(`/api/transcripts/${analysisId}`);
      setDeleteSuccess(`Transcript analysis for ${companyName} deleted successfully!`);
      setTimeout(() => setDeleteSuccess(null), 3000);

      // Refresh the analyses list
      await fetchAnalyses();
      try {
        await refreshMeetings();
      } catch (refreshError) {
        console.warn('Failed to refresh meetings after deleting transcript analysis', refreshError);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete transcript analysis');
      setTimeout(() => setError(null), 5000);
    } finally {
      setDeletingId(null);
    }
  };

  const handleEditTitle = (analysisId: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    setEditingId(analysisId);
    setEditedTitle(currentTitle || '');
  };

  const handleSaveTitle = async (analysisId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click

    if (!editedTitle.trim()) {
      setError('Title cannot be empty');
      setTimeout(() => setError(null), 3000);
      return;
    }

    try {
      await apiPatch(`/api/transcripts/${analysisId}/title`, {
        meetingTitle: editedTitle.trim(),
      });

      // Update local state
      setAnalyses((prev) =>
        prev.map((a) =>
          a.analysisId === analysisId ? { ...a, meetingTitle: editedTitle.trim() } : a
        )
      );

      setEditingId(null);
      setEditedTitle('');
    } catch (err: any) {
      setError(err.message || 'Failed to update title');
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    setEditingId(null);
    setEditedTitle('');
  };

  const handleLinkToDeal = async (analysisId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click

    if (!selectedDealForLink) {
      setError('Please select a deal');
      setTimeout(() => setError(null), 3000);
      return;
    }

    setLinkingId(analysisId);
    setLinkSuccess(null);
    setError(null);

    try {
      await apiPatch(`/api/transcripts/${analysisId}/link-deal`, {
        dealId: selectedDealForLink,
      });

      // Update local state
      setAnalyses((prev) =>
        prev.map((a) =>
          a.analysisId === analysisId ? { ...a, dealId: selectedDealForLink } : a
        )
      );

      const deal = deals.find((d) => d.deal_id === selectedDealForLink);
      setLinkSuccess(`Linked to deal: ${deal?.opportunity_name || 'Unknown'}`);
      setTimeout(() => setLinkSuccess(null), 3000);

      setSelectedDealForLink('');
    } catch (err: any) {
      setError(err.message || 'Failed to link to deal');
      setTimeout(() => setError(null), 5000);
    } finally {
      setLinkingId(null);
    }
  };

  const handleCreateDealFromAnalysis = async (
    analysis: TranscriptAnalysis,
    event: React.MouseEvent
  ) => {
    event.stopPropagation();
    if (creatingDealId) {
      return;
    }

    setCreatingDealId(analysis.analysisId);
    setError(null);
    setLinkSuccess(null);

    try {
      const response = await apiPost('/api/deals', {
        opportunityName: analysis.meetingTitle || `Deal from ${analysis.analysisId}`,
        companyName: analysis.companyName || 'Prospect',
        stage: 'prospecting',
        notes: `Created from transcript analysis ${analysis.analysisId}`,
      });

      const createdDeal = response?.data;
      const newDealId: string | undefined = createdDeal?.deal_id;

      if (newDealId) {
        setAnalyses((prev) => applyDealIdUpdate(prev, analysis.analysisId, newDealId));
      }

      setLinkSuccess(
        `Deal created${createdDeal?.opportunity_name ? `: ${createdDeal.opportunity_name}` : ''}`
      );
      setTimeout(() => setLinkSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to create deal');
      setTimeout(() => setError(null), 5000);
    } finally {
      setCreatingDealId(null);
    }
  };

  return (
    <Box>
      {/* Header */}
      <Paper
        sx={{
          p: 3,
          mb: 3,
          bgcolor: '#FFFFFF',
          borderRadius: 3,
          border: '1px solid rgba(0, 35, 72, 0.08)',
          boxShadow: '0 18px 35px rgba(0, 35, 72, 0.06)',
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography
              variant="h4"
              sx={{
                color: 'text.primary',
                fontWeight: 700,
                mb: 1,
                fontFamily: `'Playfair Display', serif`,
              }}
            >
              Transcript Analyses
            </Typography>
            <Typography variant="body2" sx={{ color: '#1A385E', fontFamily: `'Barlow', sans-serif` }}>
              Browse and monitor {analyses.length} post-call analyses (completed and in-progress)
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <StageBadgeLegend />
            <Tooltip title="Refresh">
              <IconButton
                onClick={fetchAnalyses}
                sx={{
                  color: '#00806B',
                  border: '1px solid rgba(0, 164, 140, 0.3)',
                  boxShadow: '0 6px 18px rgba(0, 164, 140, 0.2)',
                }}
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mt: 3 }}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Search by company or meeting title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: '#FFFDF6',
                color: 'text.primary',
                '& fieldset': {
                  borderColor: 'rgba(0, 35, 72, 0.12)',
                },
                '&:hover fieldset': {
                  borderColor: '#00A48C',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#C90C61',
                },
              },
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: '#00806B' }} />
                </InputAdornment>
              ),
            }}
          />
          <TextField
            select
            label="Date range"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as 'all' | '7' | '30' | '90')}
            sx={{
              minWidth: { xs: '100%', md: 200 },
              '& .MuiOutlinedInput-root': {
                bgcolor: '#FFFDF6',
                color: 'text.primary',
                '& fieldset': {
                  borderColor: 'rgba(0, 35, 72, 0.12)',
                },
                '&:hover fieldset': {
                  borderColor: '#00A48C',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#C90C61',
                },
              },
            }}
          >
            <MenuItem value="7">Last 7 days</MenuItem>
            <MenuItem value="30">Last 30 days</MenuItem>
            <MenuItem value="90">Last 90 days</MenuItem>
            <MenuItem value="all">All time</MenuItem>
          </TextField>
          <TextField
            select
            label="Account"
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value as typeof accountFilter)}
            sx={{
              minWidth: { xs: '100%', md: 220 },
              '& .MuiOutlinedInput-root': {
                bgcolor: '#FFFDF6',
                color: 'text.primary',
                '& fieldset': {
                  borderColor: 'rgba(0, 35, 72, 0.12)',
                },
                '&:hover fieldset': {
                  borderColor: '#00A48C',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#C90C61',
                },
              },
            }}
          >
            <MenuItem value="all">All accounts</MenuItem>
            {accountOptions.map((name) => (
              <MenuItem key={name} value={name}>
                {name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Deal"
            value={dealFilter}
            onChange={(e) => setDealFilter(e.target.value as typeof dealFilter)}
            sx={{
              minWidth: { xs: '100%', md: 220 },
              '& .MuiOutlinedInput-root': {
                bgcolor: '#FFFDF6',
                color: 'text.primary',
                '& fieldset': {
                  borderColor: 'rgba(0, 35, 72, 0.12)',
                },
                '&:hover fieldset': {
                  borderColor: '#00A48C',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#C90C61',
                },
              },
            }}
          >
            <MenuItem value="all">All deals</MenuItem>
            <MenuItem value="unlinked">Unlinked only</MenuItem>
            {dealOptions.map((deal) => (
              <MenuItem key={deal.value} value={deal.value}>
                {deal.label}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </Paper>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Delete Success Display */}
      {deleteSuccess && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setDeleteSuccess(null)}>
          {deleteSuccess}
        </Alert>
      )}

      {/* Link Success Display */}
      {linkSuccess && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setLinkSuccess(null)}>
          {linkSuccess}
        </Alert>
      )}

      {/* Loading State */}
      {loading && (
        <Paper
          sx={{
            p: 8,
            textAlign: 'center',
            bgcolor: '#FFFFFF',
            border: '1px dashed rgba(0, 35, 72, 0.15)',
          }}
        >
          <Typography sx={{ color: '#1A385E' }}>Loading transcript analyses...</Typography>
        </Paper>
      )}

      {/* Empty State */}
      {!loading && dealFilteredAnalyses.length === 0 && (
        <Paper
          sx={{
            p: 8,
            textAlign: 'center',
            bgcolor: '#FFFFFF',
            border: '1px dashed rgba(0, 35, 72, 0.15)',
          }}
        >
          <AssignmentIcon sx={{ fontSize: 64, color: '#C90C61', mb: 2 }} />
          <Typography
            variant="h6"
            sx={{ color: 'text.primary', mb: 1, fontFamily: `'Playfair Display', serif` }}
          >
            {searchQuery || accountFilter !== 'all' || dealFilter !== 'all' || dateFilter !== 'all'
              ? 'No analyses match your filters'
              : 'No transcript analyses yet'}
          </Typography>
          <Typography variant="body2" sx={{ color: '#1A385E' }}>
            {searchQuery || accountFilter !== 'all' || dealFilter !== 'all' || dateFilter !== 'all'
              ? 'Try adjusting your search, account, or date filters'
              : 'Analyze a transcript to see it appear here'}
          </Typography>
        </Paper>
      )}

      {/* Analyses Grid */}
      {!loading && dealFilteredAnalyses.length > 0 && (
        <Box>
          <Typography
            variant="h6"
            sx={{ color: 'text.primary', fontWeight: 600, mb: 1, fontFamily: `'Playfair Display', serif` }}
          >
            Transcript Analyses
          </Typography>
          <Typography variant="body2" sx={{ color: '#1A385E', mb: 3 }}>
            Filter by account, deal, search, or date range to focus on the analyses you need.
          </Typography>
          {renderAnalysisGrid(dealFilteredAnalyses)}
        </Box>
      )}

    </Box>
  );
};

export default PastTranscriptAnalyses;
