import React, { useEffect, useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  IconButton,
  Badge,
  Popover,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Button,
  Divider,
  Chip,
} from '@mui/material';
import {
  Business,
  Analytics,
  Notifications,
  CheckCircle,
  Error as ErrorIcon,
  PlayArrow,
  Description,
  Slideshow,
} from '@mui/icons-material';
import { useNotificationStore, ServerNotification } from '../store/notificationStore';
import { useNavigate } from 'react-router-dom';

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'pre_call_complete':
      return <CheckCircle sx={{ color: 'success.main' }} />;
    case 'transcript_complete':
      return <Description sx={{ color: 'secondary.main' }} />;
    case 'proposal_complete':
      return <Description sx={{ color: '#8b5cf6' }} />;
    case 'ppt_complete':
      return <Slideshow sx={{ color: 'warning.main' }} />;
    case 'pipeline_complete':
      return <CheckCircle sx={{ color: 'success.main' }} />;
    case 'pipeline_error':
      return <ErrorIcon sx={{ color: 'error.main' }} />;
    default:
      return <PlayArrow sx={{ color: 'text.secondary' }} />;
  }
};

const formatTimeAgo = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
};

const Header: React.FC = () => {
  const navigate = useNavigate();
  const { notifications, unreadCount, fetchNotifications, markAllAsRead, startPolling, stopPolling } =
    useNotificationStore();
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);

  useEffect(() => {
    // Start polling for notifications when component mounts
    startPolling(30000); // Poll every 30 seconds
    return () => stopPolling();
  }, [startPolling, stopPolling]);

  const handleOpenNotifications = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
    fetchNotifications(); // Refresh when opening
  };

  const handleCloseNotifications = () => {
    setAnchorEl(null);
  };

  const handleNotificationClick = (notification: ServerNotification) => {
    if (notification.deal_id) {
      navigate(`/deals/${notification.deal_id}`);
      handleCloseNotifications();
    }
  };

  const open = Boolean(anchorEl);
  return (
    <AppBar
      position="static"
      elevation={0}
      sx={{
        bgcolor: 'text.primary',
        borderBottom: '1px solid rgba(59, 130, 246, 0.3)'
      }}
    >
      <Toolbar sx={{ py: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              bgcolor: '#1e40af',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mr: 2,
              border: '2px solid #3b82f6',
            }}
          >
            <Business sx={{ fontSize: 28, color: 'white' }} />
          </Box>
          <Box>
            <Typography variant="h5" component="h1" sx={{ color: '#f8fafc', fontWeight: 700, mb: 0.5 }}>
              Sales Intelligence Platform
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.disabled' }}>
              AI-Powered Company Research & Case Study Matching
            </Typography>
          </Box>
        </Box>
        {/* Notification Bell */}
        <IconButton
          onClick={handleOpenNotifications}
          sx={{ mr: 2, color: '#f8fafc' }}
          aria-label="notifications"
        >
          <Badge
            badgeContent={unreadCount}
            color="error"
            max={99}
            sx={{
              '& .MuiBadge-badge': {
                bgcolor: 'error.main',
                color: 'white',
              },
            }}
          >
            <Notifications />
          </Badge>
        </IconButton>

        <Popover
          open={open}
          anchorEl={anchorEl}
          onClose={handleCloseNotifications}
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
              width: 380,
              maxHeight: 480,
              bgcolor: 'text.primary',
              border: '1px solid rgba(59, 130, 246, 0.3)',
            },
          }}
        >
          <Box sx={{ p: 2, borderBottom: '1px solid rgba(59, 130, 246, 0.2)' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6" sx={{ color: '#f8fafc', fontWeight: 600 }}>
                Notifications
              </Typography>
              {unreadCount > 0 && (
                <Button
                  size="small"
                  onClick={() => {
                    markAllAsRead();
                  }}
                  sx={{ color: 'secondary.main', textTransform: 'none' }}
                >
                  Mark all as read
                </Button>
              )}
            </Box>
            {unreadCount > 0 && (
              <Chip
                label={`${unreadCount} unread`}
                size="small"
                sx={{
                  mt: 1,
                  bgcolor: 'rgba(59, 130, 246, 0.2)',
                  color: 'secondary.main',
                }}
              />
            )}
          </Box>

          <List sx={{ maxHeight: 360, overflow: 'auto', p: 0 }}>
            {notifications.length === 0 ? (
              <ListItem>
                <ListItemText
                  primary="No notifications"
                  secondary="You're all caught up!"
                  primaryTypographyProps={{ sx: { color: 'text.disabled' } }}
                  secondaryTypographyProps={{ sx: { color: 'text.secondary' } }}
                />
              </ListItem>
            ) : (
              notifications.map((notification) => (
                <React.Fragment key={notification.notification_id}>
                  <ListItem
                    component="div"
                    onClick={() => handleNotificationClick(notification)}
                    sx={{
                      cursor: notification.deal_id ? 'pointer' : 'default',
                      bgcolor: notification.read ? 'transparent' : 'rgba(59, 130, 246, 0.1)',
                      '&:hover': {
                        bgcolor: 'rgba(59, 130, 246, 0.15)',
                      },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      {getNotificationIcon(notification.type)}
                    </ListItemIcon>
                    <ListItemText
                      primary={notification.title}
                      secondary={
                        <Box>
                          <Typography variant="body2" sx={{ color: 'text.disabled', mb: 0.5 }}>
                            {notification.message}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {formatTimeAgo(notification.created_at)}
                          </Typography>
                        </Box>
                      }
                      primaryTypographyProps={{
                        sx: { color: '#f8fafc', fontWeight: notification.read ? 400 : 600 },
                      }}
                    />
                  </ListItem>
                  <Divider sx={{ borderColor: 'rgba(59, 130, 246, 0.1)' }} />
                </React.Fragment>
              ))
            )}
          </List>
        </Popover>

        <Box sx={{ display: 'flex', alignItems: 'center', flexDirection: 'column' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
            <Analytics sx={{ mr: 1, color: 'secondary.main' }} />
            <Typography variant="subtitle1" sx={{ color: '#f8fafc', fontWeight: 600 }}>
              LangGraph AI
            </Typography>
          </Box>
          <Typography variant="caption" sx={{ color: 'text.disabled' }}>
            Real-time Multi-Node Processing
          </Typography>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Header;