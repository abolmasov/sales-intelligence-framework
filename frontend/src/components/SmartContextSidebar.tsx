import React, { useState, useEffect } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Stack,
  Chip,
  Paper,
  Avatar,
  Divider,
  Button,
  CircularProgress,
  Collapse,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Badge,
} from '@mui/material';
import {
  ChevronRight,
  ChevronLeft,
  Business,
  Person,
  Event,
  TrendingUp,
  Lightbulb,
  History,
  Article,
  CheckCircle,
  Warning,
  Schedule,
  ExpandMore,
  ExpandLess,
  OpenInNew,
  Refresh,
} from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiGet } from '../utils/api';

interface ContextData {
  company?: {
    name: string;
    industry?: string;
    hasHistory: boolean;
    pastEngagements: number;
    activeDeals: number;
    recentNews?: string[];
  };
  meeting?: {
    id: string;
    subject: string;
    date: string;
    attendees: number;
    hasPreCall: boolean;
  };
  relatedCaseStudies?: Array<{
    title: string;
    relevance: string;
    url?: string;
  }>;
  suggestedActions?: Array<{
    action: string;
    priority: 'high' | 'medium' | 'low';
    reason: string;
  }>;
  upcomingMeetings?: Array<{
    id: string;
    subject: string;
    date: string;
    company?: string;
    hasPreCall: boolean;
  }>;
}

interface SmartContextSidebarProps {
  companyName?: string;
  meetingId?: string;
  dealId?: string;
}

const SmartContextSidebar: React.FC<SmartContextSidebarProps> = ({
  companyName,
  meetingId,
  dealId,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [contextData, setContextData] = useState<ContextData | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    company: true,
    caseStudies: true,
    actions: true,
    meetings: false,
  });

  // Auto-detect context from URL
  useEffect(() => {
    const pathParts = location.pathname.split('/');
    let detectedCompany = companyName;
    let detectedMeetingId = meetingId;

    // Extract from URL params
    const params = new URLSearchParams(location.search);
    if (params.get('company')) detectedCompany = params.get('company') || undefined;
    if (pathParts[1] === 'meeting' && pathParts[2]) detectedMeetingId = pathParts[2];

    if (detectedCompany || detectedMeetingId) {
      loadContextData(detectedCompany, detectedMeetingId);
    }
  }, [location, companyName, meetingId]);

  const loadContextData = async (company?: string, meeting?: string) => {
    setLoading(true);
    try {
      const data: ContextData = {};

      // Load company context
      if (company) {
        const [dealsRes, meetingsRes] = await Promise.allSettled([
          apiGet(`/api/deals`),
          apiGet(`/api/meetings`),
        ]);

        const deals = dealsRes.status === 'fulfilled' ? dealsRes.value?.data || [] : [];
        const meetings = meetingsRes.status === 'fulfilled' ? meetingsRes.value?.data || [] : [];

        const companyDeals = Array.isArray(deals)
          ? deals.filter((d: any) => d.company_name?.toLowerCase().includes(company.toLowerCase()))
          : [];
        const companyMeetings = Array.isArray(meetings)
          ? meetings.filter((m: any) => m.company_name?.toLowerCase().includes(company.toLowerCase()))
          : [];

        data.company = {
          name: company,
          hasHistory: companyDeals.length > 0 || companyMeetings.length > 0,
          pastEngagements: companyMeetings.length,
          activeDeals: companyDeals.length,
        };

        // Get upcoming meetings
        const upcoming = Array.isArray(meetings)
          ? meetings
              .filter((m: any) => new Date(m.start_time) > new Date())
              .slice(0, 5)
              .map((m: any) => ({
                id: m.meeting_id,
                subject: m.subject || 'Untitled',
                date: new Date(m.start_time).toLocaleDateString(),
                company: m.company_name,
                hasPreCall: !!m.pre_call_session_id,
              }))
          : [];

        data.upcomingMeetings = upcoming;

        // Generate suggested actions based on context
        data.suggestedActions = generateSuggestedActions(data);
      }

      // Load meeting context
      if (meeting) {
        try {
          const meetingRes = await apiGet(`/api/meetings/${meeting}`);
          if (meetingRes?.data) {
            const m = meetingRes.data;
            data.meeting = {
              id: m.meeting_id,
              subject: m.subject || 'Untitled Meeting',
              date: new Date(m.start_time).toLocaleDateString(),
              attendees: m.attendees?.length || 0,
              hasPreCall: !!m.pre_call_session_id,
            };

            if (m.company_name && !data.company) {
              data.company = {
                name: m.company_name,
                hasHistory: false,
                pastEngagements: 0,
                activeDeals: 0,
              };
            }
          }
        } catch {
          // Meeting not found
        }
      }

      setContextData(data);
    } catch (error) {
      console.error('Failed to load context:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateSuggestedActions = (data: ContextData): ContextData['suggestedActions'] => {
    const actions: ContextData['suggestedActions'] = [];

    if (data.company) {
      if (!data.company.hasHistory) {
        actions.push({
          action: 'Run company research',
          priority: 'high',
          reason: 'New prospect - gather intelligence before engagement',
        });
      }

      if (data.company.activeDeals === 0 && data.company.hasHistory) {
        actions.push({
          action: 'Create new deal',
          priority: 'medium',
          reason: 'Existing relationship with no active opportunities',
        });
      }
    }

    if (data.meeting && !data.meeting.hasPreCall) {
      actions.push({
        action: 'Run pre-call analysis',
        priority: 'high',
        reason: 'Meeting scheduled without preparation',
      });
    }

    return actions;
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const priorityColors = {
    high: { bg: 'rgba(239, 68, 68, 0.1)', color: 'error.main' },
    medium: { bg: 'rgba(249, 115, 22, 0.1)', color: '#f97316' },
    low: { bg: 'rgba(107, 114, 128, 0.1)', color: 'text.disabled' },
  };

  // Don't render if no context
  if (!contextData && !loading) {
    return null;
  }

  return (
    <>
      {/* Toggle Button */}
      <Tooltip title={open ? 'Hide context' : 'Show context'} placement="left">
        <IconButton
          onClick={() => setOpen(!open)}
          sx={{
            position: 'fixed',
            right: open ? 340 : 0,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 1200,
            bgcolor: 'text.primary',
            color: 'white',
            borderRadius: open ? '8px 0 0 8px' : '8px 0 0 8px',
            '&:hover': { bgcolor: 'text.primary' },
            transition: 'right 0.3s ease',
          }}
        >
          {open ? <ChevronRight /> : <ChevronLeft />}
        </IconButton>
      </Tooltip>

      {/* Sidebar Drawer */}
      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        variant="persistent"
        PaperProps={{
          sx: {
            width: 340,
            bgcolor: 'background.default',
            borderLeft: '1px solid #e5e7eb',
          },
        }}
      >
        {/* Header */}
        <Box sx={{ p: 2, bgcolor: 'text.primary', color: 'white' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={1} alignItems="center">
              <Lightbulb sx={{ color: '#00A48C' }} />
              <Typography variant="subtitle1" fontWeight={700}>
                Context Panel
              </Typography>
            </Stack>
            <IconButton size="small" onClick={() => loadContextData(companyName, meetingId)} sx={{ color: 'white' }}>
              <Refresh fontSize="small" />
            </IconButton>
          </Stack>
        </Box>

        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          {loading ? (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <CircularProgress size={32} sx={{ color: '#00A48C' }} />
            </Box>
          ) : (
            <Stack spacing={2}>
              {/* Company Section */}
              {contextData?.company && (
                <Paper elevation={0} sx={{ borderWidth: 1, borderStyle: 'solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
                  <Box
                    sx={{
                      p: 1.5,
                      bgcolor: 'background.paper',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                    onClick={() => toggleSection('company')}
                  >
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Avatar sx={{ width: 28, height: 28, bgcolor: 'secondary.main' }}>
                        <Business sx={{ fontSize: 16 }} />
                      </Avatar>
                      <Typography variant="subtitle2" fontWeight={600}>
                        {contextData.company.name}
                      </Typography>
                    </Stack>
                    {expandedSections.company ? <ExpandLess /> : <ExpandMore />}
                  </Box>

                  <Collapse in={expandedSections.company}>
                    <Box sx={{ p: 2, pt: 0 }}>
                      {/* Relationship Status */}
                      <Box
                        sx={{
                          p: 1.5,
                          borderRadius: 1.5,
                          bgcolor: contextData.company.hasHistory
                            ? 'rgba(16, 185, 129, 0.1)'
                            : 'rgba(249, 115, 22, 0.1)',
                          mb: 2,
                        }}
                      >
                        <Stack direction="row" spacing={1} alignItems="center">
                          {contextData.company.hasHistory ? (
                            <CheckCircle sx={{ color: 'success.main', fontSize: 18 }} />
                          ) : (
                            <Warning sx={{ color: '#f97316', fontSize: 18 }} />
                          )}
                          <Typography variant="body2" fontWeight={600}>
                            {contextData.company.hasHistory ? 'Existing Relationship' : 'New Prospect'}
                          </Typography>
                        </Stack>
                      </Box>

                      {/* Stats */}
                      <Stack direction="row" spacing={3}>
                        <Box>
                          <Typography variant="h5" fontWeight={700} color="#002348">
                            {contextData.company.activeDeals}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Active Deals
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="h5" fontWeight={700} color="#002348">
                            {contextData.company.pastEngagements}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Meetings
                          </Typography>
                        </Box>
                      </Stack>

                      {/* Quick Actions */}
                      <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => navigate(`/analysis?company=${encodeURIComponent(contextData.company!.name)}`)}
                          sx={{ textTransform: 'none', borderColor: '#00A48C', color: '#00A48C' }}
                        >
                          Research
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => navigate(`/deals?search=${encodeURIComponent(contextData.company!.name)}`)}
                          sx={{ textTransform: 'none' }}
                        >
                          View Deals
                        </Button>
                      </Stack>
                    </Box>
                  </Collapse>
                </Paper>
              )}

              {/* Suggested Actions */}
              {contextData?.suggestedActions && contextData.suggestedActions.length > 0 && (
                <Paper elevation={0} sx={{ borderWidth: 1, borderStyle: 'solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
                  <Box
                    sx={{
                      p: 1.5,
                      bgcolor: 'background.paper',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                    onClick={() => toggleSection('actions')}
                  >
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Badge badgeContent={contextData.suggestedActions.length} color="error">
                        <Lightbulb sx={{ color: '#f97316' }} />
                      </Badge>
                      <Typography variant="subtitle2" fontWeight={600}>
                        Suggested Actions
                      </Typography>
                    </Stack>
                    {expandedSections.actions ? <ExpandLess /> : <ExpandMore />}
                  </Box>

                  <Collapse in={expandedSections.actions}>
                    <Stack spacing={1} sx={{ p: 2, pt: 0 }}>
                      {contextData.suggestedActions.map((action, idx) => (
                        <Box
                          key={idx}
                          sx={{
                            p: 1.5,
                            borderRadius: 1.5,
                            bgcolor: priorityColors[action.priority].bg,
                            borderLeft: `3px solid ${priorityColors[action.priority].color}`,
                          }}
                        >
                          <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
                            {action.action}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {action.reason}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  </Collapse>
                </Paper>
              )}

              {/* Upcoming Meetings */}
              {contextData?.upcomingMeetings && contextData.upcomingMeetings.length > 0 && (
                <Paper elevation={0} sx={{ borderWidth: 1, borderStyle: 'solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
                  <Box
                    sx={{
                      p: 1.5,
                      bgcolor: 'background.paper',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                    onClick={() => toggleSection('meetings')}
                  >
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Schedule sx={{ color: 'secondary.main' }} />
                      <Typography variant="subtitle2" fontWeight={600}>
                        Upcoming Meetings
                      </Typography>
                      <Chip label={contextData.upcomingMeetings.length} size="small" sx={{ height: 20 }} />
                    </Stack>
                    {expandedSections.meetings ? <ExpandLess /> : <ExpandMore />}
                  </Box>

                  <Collapse in={expandedSections.meetings}>
                    <List dense sx={{ p: 0 }}>
                      {contextData.upcomingMeetings.map((meeting, idx) => (
                        <ListItem
                          key={idx}
                          sx={{
                            borderTop: idx > 0 ? '1px solid #f3f4f6' : 'none',
                            cursor: 'pointer',
                            '&:hover': { bgcolor: 'rgba(0, 164, 140, 0.05)' },
                          }}
                          onClick={() => navigate(`/meeting/${meeting.id}`)}
                        >
                          <ListItemIcon sx={{ minWidth: 36 }}>
                            <Event sx={{ fontSize: 18, color: 'text.disabled' }} />
                          </ListItemIcon>
                          <ListItemText
                            primary={meeting.subject}
                            secondary={`${meeting.date}${meeting.company ? ` • ${meeting.company}` : ''}`}
                            primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: 500 }}
                            secondaryTypographyProps={{ fontSize: '0.75rem' }}
                          />
                          {!meeting.hasPreCall && (
                            <Chip
                              label="No prep"
                              size="small"
                              sx={{
                                height: 20,
                                fontSize: '0.65rem',
                                bgcolor: 'rgba(249, 115, 22, 0.1)',
                                color: '#f97316',
                              }}
                            />
                          )}
                        </ListItem>
                      ))}
                    </List>
                  </Collapse>
                </Paper>
              )}
            </Stack>
          )}
        </Box>
      </Drawer>
    </>
  );
};

export default SmartContextSidebar;
