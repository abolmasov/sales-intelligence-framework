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
  Avatar,
  AvatarGroup,
  Stack,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  MenuItem,
} from '@mui/material';
import {
  Search as SearchIcon,
  CalendarToday as CalendarIcon,
  People as PeopleIcon,
  TrendingUp as AnalyticsIcon,
  Refresh as RefreshIcon,
  Email as EmailIcon,
  Delete as DeleteIcon,
  Link as LinkIcon,
  Assignment as PreCallIcon,
} from '@mui/icons-material';
import { apiGet, apiPost, apiDelete, apiCall } from '../utils/api';
import { useCalendarMeetingsStore } from '../store/calendarMeetingsStore';
import StageBadgeLegend from './StageBadgeLegend';

interface Attendee {
  name: string;
  email: string;
  role: string;
}

interface Analysis {
  session_id: string;
  company_name: string;
  meeting_title: string;
  meeting_date: string;
  purpose_of_meeting: string;
  completed_at: string;
  attendees: Attendee[];
  dealId?: string;
}

interface Deal {
  deal_id: string;
  company_name: string;
  opportunity_name: string;
}

interface PastAnalysesProps {
  onViewAnalysis?: (sessionId: string, companyName: string, purpose: string) => void;
}

const PastAnalyses: React.FC<PastAnalysesProps> = ({ onViewAnalysis }) => {
  const navigate = useNavigate();
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emailingId, setEmailingId] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<'all' | '7' | '30' | '90'>('30');
  const [accountFilter, setAccountFilter] = useState<'all' | 'unlinked' | string>('all');

  // Link to deal state
  const [deals, setDeals] = useState<Deal[]>([]);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [linkSuccess, setLinkSuccess] = useState<string | null>(null);
  const [selectedDealForLink, setSelectedDealForLink] = useState<string>('');
  const refreshMeetings = useCalendarMeetingsStore((state) => state.fetchMeetings);

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
    analyses.forEach((analysis) => {
      if (analysis.company_name) {
        names.add(analysis.company_name);
      }
    });
    deals.forEach((deal) => {
      if (deal.company_name) {
        names.add(deal.company_name);
      }
    });
    return Array.from(names).sort();
  }, [analyses, deals]);

  const filteredByDate = useMemo(() => {
    if (dateFilter === 'all') {
      return analyses;
    }
    const days = Number(dateFilter);
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return analyses.filter((analysis) => {
      const sourceDate = analysis.completed_at || analysis.meeting_date;
      const timestamp = sourceDate ? new Date(sourceDate).getTime() : NaN;
      return Number.isFinite(timestamp) && timestamp >= cutoff;
    });
  }, [analyses, dateFilter]);

  const searchFilteredAnalyses = useMemo(() => {
    if (!searchQuery.trim()) {
      return filteredByDate;
    }

    const query = searchQuery.toLowerCase();
    return filteredByDate.filter(
      (analysis) =>
        analysis.company_name.toLowerCase().includes(query) ||
        analysis.meeting_title.toLowerCase().includes(query) ||
        analysis.purpose_of_meeting.toLowerCase().includes(query) ||
        analysis.attendees.some(
          (a) => a.name.toLowerCase().includes(query) || a.role.toLowerCase().includes(query)
        )
    );
  }, [filteredByDate, searchQuery]);

  const accountFilteredAnalyses = useMemo(() => {
    if (accountFilter === 'all') {
      return searchFilteredAnalyses;
    }
    if (accountFilter === 'unlinked') {
      return searchFilteredAnalyses.filter((analysis) => !analysis.dealId);
    }
    return searchFilteredAnalyses.filter((analysis) => {
      if (analysis.dealId) {
        const mappedName = dealAccountNameMap[analysis.dealId];
        if (mappedName) {
          return mappedName === accountFilter;
        }
      }
      return analysis.company_name === accountFilter;
    });
  }, [accountFilter, searchFilteredAnalyses, dealAccountNameMap]);

  const linkedAnalyses = useMemo(
    () => accountFilteredAnalyses.filter((analysis) => Boolean(analysis.dealId)),
    [accountFilteredAnalyses]
  );

  const unlinkedAnalyses = useMemo(
    () => accountFilteredAnalyses.filter((analysis) => !analysis.dealId),
    [accountFilteredAnalyses]
  );

  const fetchAnalyses = async () => {
    setLoading(true);
    setError(null);
    try {
      // Updated to use TypeScript backend endpoint
      const data = await apiGet('/api/research/list');
      // TypeScript backend returns data directly in data array
      const analysesData = data.data || [];
      setAnalyses(analysesData);
    } catch (err: any) {
      setError(err.message || 'Failed to load analyses');
    } finally {
      setLoading(false);
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

  const formatCountLabel = (count: number) => `${count} ${count === 1 ? 'analysis' : 'analyses'}`;

  const handleEmailReport = async (sessionId: string, companyName: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    setEmailingId(sessionId);
    setEmailSuccess(null);
    setError(null);

    try {
      const data = await apiPost(`/api/research/${sessionId}/email`, {
        session_id: sessionId,
        recipient_email: 'demo.user@example.com'
      });

      if (data.success) {
        setEmailSuccess(`Report for ${companyName} sent successfully!`);
        setTimeout(() => setEmailSuccess(null), 5000);
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to send email';

      // Check if it's a permission or authentication error
      if (errorMessage.includes('Mail.Send') || errorMessage.includes('re-authenticate')) {
        setError('Missing email permission. Please logout and login again in the Calendar tab to grant Mail.Send permission.');
        setTimeout(() => setError(null), 10000);
      } else if (errorMessage.includes('Authentication required') || errorMessage.includes('401')) {
        setError('Session expired. Please login again in the Calendar tab.');
        setTimeout(() => setError(null), 8000);
      } else {
        setError(errorMessage);
        setTimeout(() => setError(null), 5000);
      }
    } finally {
      setEmailingId(null);
    }
  };

  const handleDeleteAnalysis = async (sessionId: string, companyName: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click

    if (!window.confirm(`Are you sure you want to delete the analysis for ${companyName}? This action cannot be undone.`)) {
      return;
    }

    setDeletingId(sessionId);
    setDeleteSuccess(null);
    setError(null);

    try {
      await apiDelete(`/api/research/${sessionId}`);
      setDeleteSuccess(`Analysis for ${companyName} deleted successfully!`);
      setTimeout(() => setDeleteSuccess(null), 3000);

      // Refresh the analyses list
      await fetchAnalyses();
      try {
        await refreshMeetings();
      } catch (refreshError) {
        console.warn('Failed to refresh meetings after deleting analysis', refreshError);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete analysis');
      setTimeout(() => setError(null), 5000);
    } finally {
      setDeletingId(null);
    }
  };

  const fetchDeals = async () => {
    try {
      const data = await apiGet('/api/deals');
      const dealsData = data.data || [];
      setDeals(dealsData);
    } catch (err: any) {
      console.error('Failed to fetch deals:', err);
    }
  };

  const handleLinkToDeal = async (sessionId: string, dealId: string, companyName: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click

    if (!dealId) {
      setError('Please select a deal');
      setTimeout(() => setError(null), 3000);
      return;
    }

    setLinkingId(sessionId);
    setLinkSuccess(null);
    setError(null);

    try {
      const response = await apiCall(`/api/research/${sessionId}/link-deal`, {
        method: 'PATCH',
        body: JSON.stringify({ dealId }),
      });

      if (response.ok) {
        const deal = deals.find(d => d.deal_id === dealId);
        setLinkSuccess(`Analysis for ${companyName} linked to deal "${deal?.opportunity_name}" successfully! Action plan and questionnaire have been extracted and linked to the deal.`);
        setTimeout(() => setLinkSuccess(null), 7000);

        // Update local state
        setAnalyses(prev => prev.map(a =>
          a.session_id === sessionId ? { ...a, dealId } : a
        ));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to link analysis to deal');
      setTimeout(() => setError(null), 5000);
    } finally {
      setLinkingId(null);
      setSelectedDealForLink('');
    }
  };

  const renderAnalysisCard = (analysis: Analysis) => (
    <Card
      key={analysis.session_id}
      elevation={0}
      sx={{
        bgcolor: '#FFFFFF',
        border: '1px solid rgba(0, 35, 72, 0.08)',
        borderRadius: 3,
        transition: 'all 0.2s',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: '0 18px 35px rgba(0, 35, 72, 0.15)',
          borderColor: '#00A48C',
        },
      }}
    >
      <CardActionArea
        onClick={() => {
          if (onViewAnalysis) {
            onViewAnalysis(
              analysis.session_id,
              analysis.company_name,
              analysis.purpose_of_meeting
            );
          } else {
            navigate(`/app/analysis?sessionId=${analysis.session_id}`);
          }
        }}
        sx={{ p: 3 }}
      >
          <CardContent sx={{ p: 0 }}>
          {/* Company Name */}
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 2,
                mr: 2,
                bgcolor: 'rgba(8, 145, 178, 0.14)',
                color: '#0891b2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <PreCallIcon sx={{ fontSize: 20 }} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" sx={{ color: 'text.primary', fontWeight: 600, mb: 0.5 }}>
                {analysis.company_name}
              </Typography>
              {analysis.meeting_title && (
                <Typography variant="caption" sx={{ color: '#1A385E' }}>
                  {analysis.meeting_title}
                </Typography>
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Tooltip title="Email report to demo.user@example.com">
                <IconButton
                  onClick={(e) => handleEmailReport(analysis.session_id, analysis.company_name, e)}
                  disabled={emailingId === analysis.session_id}
                  sx={{
                    color: '#005849',
                    '&:hover': {
                      color: '#00A48C',
                      backgroundColor: 'rgba(0, 164, 140, 0.1)',
                    },
                  }}
                >
                  {emailingId === analysis.session_id ? (
                    <CircularProgress size={20} sx={{ color: '#00A48C' }} />
                  ) : (
                    <EmailIcon />
                  )}
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete Analysis">
                <IconButton
                  onClick={(e) => handleDeleteAnalysis(analysis.session_id, analysis.company_name, e)}
                  disabled={deletingId === analysis.session_id}
                  sx={{
                    color: '#9D1C56',
                    '&:hover': {
                      color: 'error.main',
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    },
                  }}
                >
                  {deletingId === analysis.session_id ? (
                    <CircularProgress size={20} sx={{ color: 'error.main' }} />
                  ) : (
                    <DeleteIcon />
                  )}
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {/* Purpose */}
          <Typography
            variant="body2"
            sx={{
              color: 'text.primary',
              mb: 2,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {analysis.purpose_of_meeting}
          </Typography>

          {/* Metadata */}
          <Stack spacing={1.5}>
            {/* Date */}
            {analysis.meeting_date && (
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <CalendarIcon sx={{ fontSize: 16, color: '#00806B', mr: 1 }} />
                <Typography variant="caption" sx={{ color: '#005849' }}>
                  {analysis.meeting_date}
                </Typography>
              </Box>
            )}

            {/* Attendees */}
            {analysis.attendees && analysis.attendees.length > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <PeopleIcon sx={{ fontSize: 16, color: '#C90C61', mr: 1 }} />
                <AvatarGroup
                  max={3}
                  sx={{
                    '& .MuiAvatar-root': {
                      width: 24,
                      height: 24,
                      fontSize: '0.75rem',
                      bgcolor: '#FFE133',
                      color: 'text.primary',
                    },
                  }}
                >
                  {analysis.attendees.map((attendee, idx) => (
                    <Tooltip key={idx} title={`${attendee.name} (${attendee.role})`}>
                      <Avatar>{attendee.name.charAt(0)}</Avatar>
                    </Tooltip>
                  ))}
                </AvatarGroup>
                <Typography variant="caption" sx={{ color: '#005849', ml: 1 }}>
                  {analysis.attendees.length} attendee
                  {analysis.attendees.length !== 1 ? 's' : ''}
                </Typography>
              </Box>
            )}

            {/* Deal Link Section */}
            <Box sx={{ pt: 2, borderTop: '1px solid rgba(0, 35, 72, 0.08)', mt: 2 }}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                <TextField
                  select
                  size="small"
                  value={selectedDealForLink || analysis.dealId || ''}
                  onChange={(e) => setSelectedDealForLink(e.target.value)}
                  onFocus={() => {
                    if (analysis.dealId && !selectedDealForLink) {
                      setSelectedDealForLink(analysis.dealId);
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  disabled={linkingId !== null && linkingId !== analysis.session_id}
                  sx={{
                    flex: 1,
                    '& .MuiOutlinedInput-root': {
                      bgcolor: analysis.dealId ? 'rgba(0, 164, 140, 0.08)' : '#FFFDF6',
                      color: 'text.primary',
                      fontSize: '0.75rem',
                      '& fieldset': {
                        borderColor: analysis.dealId ? 'rgba(0, 164, 140, 0.4)' : 'rgba(0, 35, 72, 0.12)',
                      },
                      '&:hover fieldset': {
                        borderColor: analysis.dealId ? 'rgba(0, 164, 140, 0.6)' : '#00A48C',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: '#C90C61',
                      },
                    },
                    '& .MuiSelect-select': {
                      py: 0.5,
                    },
                  }}
                  placeholder="Select Deal"
                >
                  <MenuItem value="" disabled>
                    <em>Link to deal...</em>
                  </MenuItem>
                  {deals.map((deal) => (
                    <MenuItem key={deal.deal_id} value={deal.deal_id}>
                      {deal.deal_id} - {deal.opportunity_name} - {deal.company_name}
                    </MenuItem>
                  ))}
                </TextField>
                <Tooltip
                  title={
                    analysis.dealId && selectedDealForLink === analysis.dealId
                      ? 'Select a different deal to re-link'
                      : 'Link to Deal'
                  }
                >
                  <span>
                    <IconButton
                      onClick={(e) =>
                        handleLinkToDeal(analysis.session_id, selectedDealForLink, analysis.company_name, e)
                      }
                      disabled={
                        !selectedDealForLink ||
                        Boolean(analysis.dealId && selectedDealForLink === analysis.dealId)
                      }
                      sx={{
                        color: '#005849',
                        '&:hover': {
                          color: '#00A48C',
                          backgroundColor: 'rgba(0, 164, 140, 0.1)',
                        },
                        '&.Mui-disabled': {
                          color: 'text.disabled',
                        },
                      }}
                    >
                      {linkingId === analysis.session_id ? (
                        <CircularProgress size={20} sx={{ color: '#00A48C' }} />
                      ) : (
                        <LinkIcon />
                      )}
                    </IconButton>
                  </span>
                </Tooltip>
              </Box>
            </Box>

            {/* Completed Date */}
            <Box sx={{ pt: 1, borderTop: '1px solid rgba(0, 35, 72, 0.08)', mt: 1 }}>
              <Chip
                label={
                  analysis.completed_at ? `Completed ${formatDate(analysis.completed_at)}` : 'Processing'
                }
                size="small"
                sx={{
                  bgcolor: analysis.completed_at ? 'rgba(0, 164, 140, 0.15)' : 'rgba(255, 184, 0, 0.15)',
                  color: analysis.completed_at ? '#00806B' : '#9D1C56',
                  fontSize: '0.7rem',
                }}
              />
            </Box>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );

  const renderAnalysisGrid = (list: Analysis[]) => (
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
              sx={{ color: 'text.primary', fontWeight: 700, mb: 1, fontFamily: `'Playfair Display', serif` }}
            >
              Past Analyses
            </Typography>
            <Typography variant="body2" sx={{ color: '#1A385E', fontFamily: `'Barlow', sans-serif` }}>
              Browse and review {analyses.length} completed sales intelligence reports
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
            placeholder="Search by company, meeting title, purpose, or attendee..."
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
            <MenuItem value="unlinked">Unlinked only</MenuItem>
            {accountOptions.map((name) => (
              <MenuItem key={name} value={name}>
                {name}
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

      {/* Success Display */}
      {emailSuccess && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setEmailSuccess(null)}>
          {emailSuccess}
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
          <Typography sx={{ color: '#1A385E' }}>Loading analyses...</Typography>
        </Paper>
      )}

      {/* Empty State */}
      {!loading && accountFilteredAnalyses.length === 0 && (
        <Paper
          sx={{
            p: 8,
            textAlign: 'center',
            bgcolor: '#FFFFFF',
            border: '1px dashed rgba(0, 35, 72, 0.15)',
          }}
        >
          <AnalyticsIcon sx={{ fontSize: 64, color: '#C90C61', mb: 2 }} />
          <Typography variant="h6" sx={{ color: 'text.primary', mb: 1, fontFamily: `'Playfair Display', serif` }}>
            {searchQuery || accountFilter !== 'all' || dateFilter !== 'all'
              ? 'No analyses match your filters'
              : 'No analyses yet'}
          </Typography>
          <Typography variant="body2" sx={{ color: '#1A385E' }}>
            {searchQuery || accountFilter !== 'all' || dateFilter !== 'all'
              ? 'Try adjusting your search, account, or date filters'
              : 'Analyze a meeting to see it appear here'}
          </Typography>
        </Paper>
      )}

      {/* Analyses Grid */}
      {!loading && accountFilteredAnalyses.length > 0 && (
        <Stack spacing={4}>
          {unlinkedAnalyses.length > 0 && (
            <Box>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: { xs: 'flex-start', md: 'center' },
                  mb: 2,
                  flexDirection: { xs: 'column', md: 'row' },
                  gap: 1,
                }}
              >
                <Box>
                  <Typography variant="h6" sx={{ color: 'text.primary', fontWeight: 600 }}>
                    Unlinked Proposals
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#1A385E' }}>
                    These generated proposals are not yet tied to a deal.
                  </Typography>
                </Box>
                <Chip
                  label={formatCountLabel(unlinkedAnalyses.length)}
                  sx={{ bgcolor: 'rgba(0, 164, 140, 0.1)', color: '#00806B', fontWeight: 600 }}
                />
              </Box>
              {renderAnalysisGrid(unlinkedAnalyses)}
            </Box>
          )}

          {linkedAnalyses.length > 0 && (
            <Box>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: { xs: 'flex-start', md: 'center' },
                  mb: 2,
                  flexDirection: { xs: 'column', md: 'row' },
                  gap: 1,
                }}
              >
                <Box>
                  <Typography variant="h6" sx={{ color: 'text.primary', fontWeight: 600 }}>
                    Linked Proposals
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#1A385E' }}>
                    Proposals already associated with active deals.
                  </Typography>
                </Box>
                <Chip
                  label={formatCountLabel(linkedAnalyses.length)}
                  sx={{ bgcolor: 'rgba(0, 35, 72, 0.08)', color: 'text.primary', fontWeight: 600 }}
                />
              </Box>
              {renderAnalysisGrid(linkedAnalyses)}
            </Box>
          )}
        </Stack>
      )}
    </Box>
  );
};

export default PastAnalyses;
