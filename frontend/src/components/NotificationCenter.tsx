import React, { useState, useEffect } from 'react';
import {
  IconButton,
  Badge,
  Popover,
  Box,
  Typography,
  Stack,
  Divider,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Button,
  Chip,
  Tabs,
  Tab,
  Tooltip,
  Fade,
} from '@mui/material';
import {
  Notifications,
  TrendingUp,
  Warning,
  Lightbulb,
  Event,
  Business,
  CheckCircle,
  Schedule,
  Person,
  Close,
  MarkEmailRead,
  OpenInNew,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { apiGet } from '../utils/api';

interface Notification {
  id: string;
  type: 'insight' | 'alert' | 'reminder' | 'update';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  priority: 'high' | 'medium' | 'low';
  actionUrl?: string;
  actionLabel?: string;
  metadata?: {
    company?: string;
    meetingId?: string;
    dealId?: string;
  };
}

const NotificationCenter: React.FC = () => {
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  const open = Boolean(anchorEl);

  useEffect(() => {
    loadNotifications();
    // Poll for new notifications every 2 minutes
    const interval = setInterval(loadNotifications, 120000);
    return () => clearInterval(interval);
  }, []);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      // Generate proactive insights from various sources
      const insights = await generateProactiveInsights();
      setNotifications(insights);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateProactiveInsights = async (): Promise<Notification[]> => {
    const insights: Notification[] = [];
    const now = new Date();

    try {
      // Fetch meetings and deals data
      const [meetingsRes, dealsRes] = await Promise.allSettled([
        apiGet('/api/meetings'),
        apiGet('/api/deals'),
      ]);

      const meetings = meetingsRes.status === 'fulfilled' ? meetingsRes.value?.data || [] : [];
      const deals = dealsRes.status === 'fulfilled' ? dealsRes.value?.data || [] : [];

      // Check for upcoming meetings without prep
      if (Array.isArray(meetings)) {
        const upcomingWithoutPrep = meetings.filter((m: any) => {
          const meetingDate = new Date(m.start_time);
          const hoursUntil = (meetingDate.getTime() - now.getTime()) / (1000 * 60 * 60);
          return hoursUntil > 0 && hoursUntil < 48 && !m.pre_call_session_id;
        });

        upcomingWithoutPrep.slice(0, 3).forEach((m: any) => {
          const meetingDate = new Date(m.start_time);
          const hoursUntil = Math.round((meetingDate.getTime() - now.getTime()) / (1000 * 60 * 60));

          insights.push({
            id: `meeting-prep-${m.meeting_id}`,
            type: 'reminder',
            title: 'Meeting Prep Needed',
            message: `"${m.subject || 'Untitled Meeting'}" is in ${hoursUntil} hours without pre-call analysis`,
            timestamp: now,
            read: false,
            priority: hoursUntil < 24 ? 'high' : 'medium',
            actionUrl: `/meeting/${m.meeting_id}`,
            actionLabel: 'Run Pre-Call',
            metadata: {
              meetingId: m.meeting_id,
              company: m.company_name,
            },
          });
        });

        // Check for meetings with new companies
        const newProspectMeetings = meetings.filter((m: any) => {
          const meetingDate = new Date(m.start_time);
          const hoursUntil = (meetingDate.getTime() - now.getTime()) / (1000 * 60 * 60);
          // Check if this company has only 1 meeting (this one)
          const companyMeetingCount = meetings.filter(
            (other: any) => other.company_name?.toLowerCase() === m.company_name?.toLowerCase()
          ).length;
          return hoursUntil > 0 && hoursUntil < 72 && companyMeetingCount === 1 && m.company_name;
        });

        newProspectMeetings.slice(0, 2).forEach((m: any) => {
          insights.push({
            id: `new-prospect-${m.meeting_id}`,
            type: 'insight',
            title: 'New Prospect Meeting',
            message: `First meeting with ${m.company_name} - consider running company research`,
            timestamp: now,
            read: false,
            priority: 'medium',
            actionUrl: `/analysis?company=${encodeURIComponent(m.company_name)}`,
            actionLabel: 'Research',
            metadata: {
              company: m.company_name,
              meetingId: m.meeting_id,
            },
          });
        });
      }

      // Check for stale deals
      if (Array.isArray(deals)) {
        const staleDeals = deals.filter((d: any) => {
          const lastActivity = d.last_activity_date ? new Date(d.last_activity_date) : new Date(d.created_at);
          const daysSinceActivity = (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24);
          return daysSinceActivity > 14 && d.stage !== 'Closed Won' && d.stage !== 'Closed Lost';
        });

        staleDeals.slice(0, 2).forEach((d: any) => {
          const lastActivity = d.last_activity_date ? new Date(d.last_activity_date) : new Date(d.created_at);
          const daysSince = Math.round((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));

          insights.push({
            id: `stale-deal-${d.deal_id}`,
            type: 'alert',
            title: 'Deal Needs Attention',
            message: `${d.company_name} deal has had no activity for ${daysSince} days`,
            timestamp: now,
            read: false,
            priority: daysSince > 30 ? 'high' : 'medium',
            actionUrl: `/deals/${d.deal_id}`,
            actionLabel: 'View Deal',
            metadata: {
              dealId: d.deal_id,
              company: d.company_name,
            },
          });
        });

        // High-value deals insight
        const highValueDeals = deals.filter((d: any) => {
          return d.value && d.value >= 100000 && d.stage !== 'Closed Won' && d.stage !== 'Closed Lost';
        });

        if (highValueDeals.length > 0) {
          const totalValue = highValueDeals.reduce((sum: number, d: any) => sum + (d.value || 0), 0);
          insights.push({
            id: 'high-value-pipeline',
            type: 'update',
            title: 'Pipeline Update',
            message: `You have ${highValueDeals.length} high-value deals worth $${(totalValue / 1000000).toFixed(1)}M in pipeline`,
            timestamp: now,
            read: false,
            priority: 'low',
            actionUrl: '/deals',
            actionLabel: 'View Pipeline',
          });
        }
      }

      // Add a proactive research suggestion
      if (insights.length === 0) {
        insights.push({
          id: 'explore-features',
          type: 'insight',
          title: 'Tip: Company Research',
          message: 'Use the Analysis page to run AI-powered research on any prospect',
          timestamp: now,
          read: true,
          priority: 'low',
          actionUrl: '/analysis',
          actionLabel: 'Try Now',
        });
      }
    } catch (error) {
      console.error('Error generating insights:', error);
    }

    // Sort by priority and timestamp
    return insights.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return b.timestamp.getTime() - a.timestamp.getTime();
    });
  };

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read
    setNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
    );

    // Navigate if action URL
    if (notification.actionUrl) {
      navigate(notification.actionUrl);
      handleClose();
    }
  };

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleDismiss = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const filteredNotifications =
    activeTab === 0
      ? notifications
      : notifications.filter((n) => {
          if (activeTab === 1) return n.type === 'insight' || n.type === 'update';
          if (activeTab === 2) return n.type === 'alert';
          if (activeTab === 3) return n.type === 'reminder';
          return true;
        });

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'insight':
        return <Lightbulb sx={{ color: '#00A48C' }} />;
      case 'alert':
        return <Warning sx={{ color: 'error.main' }} />;
      case 'reminder':
        return <Schedule sx={{ color: 'secondary.main' }} />;
      case 'update':
        return <TrendingUp sx={{ color: '#8b5cf6' }} />;
    }
  };

  const priorityColors = {
    high: '#ef4444',
    medium: '#f97316',
    low: '#6b7280',
  };

  return (
    <>
      <Tooltip title="Notifications">
        <IconButton onClick={handleClick} sx={{ color: 'inherit' }}>
          <Badge
            badgeContent={unreadCount}
            color="error"
            sx={{
              '& .MuiBadge-badge': {
                fontSize: '0.65rem',
                height: 18,
                minWidth: 18,
              },
            }}
          >
            <Notifications />
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          sx: {
            width: 400,
            maxHeight: 520,
            borderRadius: 2,
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
          },
        }}
      >
        {/* Header */}
        <Box
          sx={{
            p: 2,
            bgcolor: 'text.primary',
            color: 'white',
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={1} alignItems="center">
              <Notifications />
              <Typography variant="subtitle1" fontWeight={700}>
                Notifications
              </Typography>
              {unreadCount > 0 && (
                <Chip
                  label={unreadCount}
                  size="small"
                  sx={{
                    bgcolor: 'error.main',
                    color: 'white',
                    height: 20,
                    fontSize: '0.7rem',
                  }}
                />
              )}
            </Stack>
            {unreadCount > 0 && (
              <Button
                size="small"
                startIcon={<MarkEmailRead sx={{ fontSize: 16 }} />}
                onClick={handleMarkAllRead}
                sx={{ color: 'rgba(255,255,255,0.8)', textTransform: 'none', fontSize: '0.75rem' }}
              >
                Mark all read
              </Button>
            )}
          </Stack>
        </Box>

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          variant="fullWidth"
          sx={{
            borderBottom: 1, borderColor: 'divider',
            '& .MuiTab-root': {
              textTransform: 'none',
              fontSize: '0.8rem',
              minHeight: 40,
            },
          }}
        >
          <Tab label="All" />
          <Tab label="Insights" />
          <Tab label="Alerts" />
          <Tab label="Reminders" />
        </Tabs>

        {/* Notification List */}
        <List sx={{ p: 0, maxHeight: 360, overflow: 'auto' }}>
          {filteredNotifications.length === 0 ? (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <CheckCircle sx={{ fontSize: 48, color: '#d1d5db', mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                All caught up!
              </Typography>
            </Box>
          ) : (
            filteredNotifications.map((notification, idx) => (
              <React.Fragment key={notification.id}>
                <ListItem
                  onClick={() => handleNotificationClick(notification)}
                  sx={{
                    cursor: 'pointer',
                    bgcolor: notification.read ? 'transparent' : 'rgba(0, 164, 140, 0.05)',
                    '&:hover': { bgcolor: 'rgba(0, 164, 140, 0.08)' },
                    alignItems: 'flex-start',
                    py: 1.5,
                  }}
                  secondaryAction={
                    <IconButton
                      size="small"
                      onClick={(e) => handleDismiss(notification.id, e)}
                      sx={{ opacity: 0.5, '&:hover': { opacity: 1 } }}
                    >
                      <Close fontSize="small" />
                    </IconButton>
                  }
                >
                  <ListItemAvatar>
                    <Avatar
                      sx={{
                        bgcolor:
                          notification.type === 'insight'
                            ? 'rgba(0, 164, 140, 0.15)'
                            : notification.type === 'alert'
                            ? 'rgba(239, 68, 68, 0.15)'
                            : notification.type === 'reminder'
                            ? 'rgba(59, 130, 246, 0.15)'
                            : 'rgba(139, 92, 246, 0.15)',
                        width: 36,
                        height: 36,
                      }}
                    >
                      {getIcon(notification.type)}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography
                          variant="body2"
                          fontWeight={notification.read ? 500 : 700}
                          sx={{ flex: 1 }}
                        >
                          {notification.title}
                        </Typography>
                        {notification.priority === 'high' && (
                          <Box
                            sx={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              bgcolor: priorityColors[notification.priority],
                            }}
                          />
                        )}
                      </Stack>
                    }
                    secondary={
                      <Box>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: 'block', mt: 0.5 }}
                        >
                          {notification.message}
                        </Typography>
                        {notification.actionLabel && (
                          <Button
                            size="small"
                            endIcon={<OpenInNew sx={{ fontSize: 12 }} />}
                            sx={{
                              mt: 1,
                              textTransform: 'none',
                              fontSize: '0.75rem',
                              color: '#00A48C',
                              p: 0,
                              minWidth: 'auto',
                            }}
                          >
                            {notification.actionLabel}
                          </Button>
                        )}
                      </Box>
                    }
                  />
                </ListItem>
                {idx < filteredNotifications.length - 1 && <Divider />}
              </React.Fragment>
            ))
          )}
        </List>

        {/* Footer */}
        {notifications.length > 0 && (
          <Box sx={{ p: 1.5, borderTop: '1px solid #e5e7eb', bgcolor: 'background.default' }}>
            <Button
              fullWidth
              size="small"
              onClick={() => {
                loadNotifications();
              }}
              sx={{ textTransform: 'none', color: 'text.disabled' }}
            >
              Refresh Insights
            </Button>
          </Box>
        )}
      </Popover>
    </>
  );
};

export default NotificationCenter;
