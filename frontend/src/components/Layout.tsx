import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  Stack,
  Badge,
  Chip,
  Drawer,
  IconButton,
  Menu,
  MenuItem,
  ListItemText,
  ListItemSecondaryAction,
  Avatar,
  ListItemIcon,
  Divider,
  alpha,
  useMediaQuery,
} from '@mui/material';
import {
  Settings,
  PlayArrow,
  Menu as MenuIcon,
  Logout,
  Notifications as NotificationsIcon,
  ArrowDropDown,
  DarkMode,
  LightMode,
  ChevronLeft,
  ChevronRight,
  // Nav icons
  Dashboard as DashboardIcon,
  CalendarToday,
  Business,
  ManageSearch,
  Assessment,
  Explore,
  SpaceDashboard,
  Assignment,
  FactCheck,
  Slideshow,
  SmartToy,
  BarChart,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { useAppStore } from '../store';
import { useCalendarMeetingsStore } from '../store/calendarMeetingsStore';
import LogoMark from '../assets/Image.png';
import { API_BASE_URL } from '../config';
import { clearAuthToken } from '../utils/authToken';
import { useAppShell } from '../context/AppShellContext';
import CancelAnalysisFlowButton from './CancelAnalysisFlowButton';
import { useAnalytics } from '../hooks/useAnalytics';

interface LayoutProps {
  children: React.ReactNode;
  isResearching?: boolean;
}

const drawerWidth = 260;
const collapsedWidth = 60;

type ActivePreCallInfo = { sessionId: string; company?: string; meetingId?: string };

const Layout: React.FC<LayoutProps> = ({ children }) => {
  useAnalytics(); // Track page views on route changes
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { setMainView, theme: themeMode, setTheme } = useAppStore();
  const { notifications, markNotificationsRead, showMessage } = useAppShell();
  const meetings = useCalendarMeetingsStore((state) => state.meetings);
  const [isResearching, setIsResearching] = useState(false);
  const [researchCompany, setResearchCompany] = useState<string>('');
  const [transcriptAnalysis, setTranscriptAnalysis] = useState<{ analysisId: string; analysisName?: string } | null>(
    null
  );
  const [workflowAnalysis, setWorkflowAnalysis] = useState<{ jobId: string; meetingTitle?: string; meetingId?: string } | null>(null);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notificationAnchor, setNotificationAnchor] = useState<null | HTMLElement>(null);
  const [accountMenuAnchor, setAccountMenuAnchor] = useState<null | HTMLElement>(null);
  const calendarAutoSyncRef = useRef(false);
  const researchSessionRef = useRef<string | null>(null);
  const transcriptSessionRef = useRef<string | null>(null);
  const workflowJobRef = useRef<string | null>(null);
  const normalizeCompanyDisplay = (...values: Array<string | undefined | null>): string => {
    for (const value of values) {
      if (!value) continue;
      const trimmed = value.toString().trim();
      if (!trimmed) continue;
      if (trimmed.toLowerCase() === 'unknown') continue;
      return trimmed;
    }
    return 'Pre-call analysis';
  };

  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const hasFetchedCalendar = useCalendarMeetingsStore((state) => Boolean(state.lastFetchedRange));
  const fetchCalendarMeetings = useCalendarMeetingsStore((state) => state.fetchMeetings);
  const calendarLoading = useCalendarMeetingsStore((state) => state.isLoading);

  const activePreCall: ActivePreCallInfo | null = useMemo(() => {
    const stored = (() => {
      try {
        return JSON.parse(localStorage.getItem('ongoingResearch') || '{}');
      } catch {
        return {};
      }
    })();
    const storedCompany = stored?.companyName;
    const storedPurpose = stored?.purposeOfMeeting;

    for (const meeting of meetings) {
      const preCall = meeting.analysisSummary?.preCall?.[0];
      const status = (preCall?.status || meeting.status || '').toLowerCase();
      const sessionId = preCall?.sessionId || meeting.analysisSessionId || null;
      if (
        sessionId &&
        ['running', 'pending', 'in_progress', 'queued', 'processing', 'analyzing'].includes(status)
      ) {
        const isUnknownCompany = (value: string | undefined) =>
          !value || value.toLowerCase() === 'unknown';
        const fallbackName =
          meeting.title ||
          meeting.accountName ||
          (!isUnknownCompany(meeting.company) ? meeting.company : '') ||
          (!isUnknownCompany(storedCompany) ? storedCompany : '') ||
          meeting.purpose ||
          storedPurpose ||
          'Pre-call analysis';
        return {
          sessionId,
          company: fallbackName,
          meetingId: meeting.id,
        };
      }
    }
    return null;
  }, [meetings]);

  useEffect(() => {
    const checkOngoingResearch = async () => {
      const ongoingResearch = localStorage.getItem('ongoingResearch');
      let sessionId: string | null = activePreCall?.sessionId || null;
      let companyName = activePreCall?.company || researchCompany;
      const activeCompany = activePreCall?.company;

      if (!sessionId && ongoingResearch) {
        try {
          const parsed = JSON.parse(ongoingResearch);
          sessionId = parsed?.sessionId || null;
          companyName = parsed?.companyName || companyName;
        } catch {
          sessionId = null;
        }
      } else if (!sessionId && researchSessionRef.current) {
        sessionId = researchSessionRef.current;
      }

      if (!sessionId || sessionId === 'undefined' || sessionId === 'null') {
        researchSessionRef.current = null;
        setIsResearching(false);
        setResearchCompany('');
        return;
      }

      const label =
        normalizeCompanyDisplay(companyName, activePreCall?.company);

      // If we already have a running pre-call from meetings data, trust it
      if (activePreCall) {
        setIsResearching(true);
        setResearchCompany(normalizeCompanyDisplay(companyName, activePreCall.company));
        researchSessionRef.current = sessionId;
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/api/research/status/${sessionId}`);
        if (response.ok) {
          const data = await response.json();
          const statusData = data.data || data;
          const status = (statusData.status || '').toLowerCase();
          const isActive = ['in_progress', 'running', 'processing', 'queued', 'pending'].includes(status);

          if (isActive) {
            setIsResearching(true);
            setResearchCompany(normalizeCompanyDisplay(companyName, activeCompany));
            researchSessionRef.current = sessionId;
            return;
          }

          localStorage.removeItem('ongoingResearch');
          if (researchSessionRef.current === sessionId) {
            showMessage({
              type: status === 'completed' ? 'success' : 'error',
              message:
                status === 'completed'
                  ? `${label} analysis completed.`
                  : `${label} analysis stopped.`,
            });
          }
        } else {
          // Keep indicator if we have local data even when status endpoint fails
          setIsResearching(true);
          setResearchCompany(companyName || '');
          researchSessionRef.current = sessionId;
          return;
        }
      } catch (err) {
        // Keep showing as running if we can't reach the API; will clear on next successful check
        setIsResearching(true);
        setResearchCompany(companyName || activeCompany || '');
        researchSessionRef.current = sessionId;
        return;
      }

      researchSessionRef.current = null;
      setIsResearching(false);
      setResearchCompany('');
    };

    const checkTranscriptAnalysis = async () => {
      const raw = localStorage.getItem('ongoingTranscriptAnalysis');
      if (!raw) {
        setTranscriptAnalysis(null);
        transcriptSessionRef.current = null;
        return;
      }

      try {
        const { analysisId, analysisName } = JSON.parse(raw);
        if (!analysisId) {
          localStorage.removeItem('ongoingTranscriptAnalysis');
          setTranscriptAnalysis(null);
          transcriptSessionRef.current = null;
          return;
        }

        const response = await fetch(`${API_BASE_URL}/api/transcripts/${analysisId}`);
        if (!response.ok) {
          setTranscriptAnalysis({ analysisId, analysisName });
          transcriptSessionRef.current = analysisId;
          return;
        }

        const payload = await response.json();
        const status = (payload?.data?.status || payload?.status || 'processing').toLowerCase();

        if (status === 'processing' || status === 'queued') {
          setTranscriptAnalysis({ analysisId, analysisName });
          transcriptSessionRef.current = analysisId;
          return;
        }

        localStorage.removeItem('ongoingTranscriptAnalysis');
        setTranscriptAnalysis(null);
        if (transcriptSessionRef.current === analysisId) {
          const isCancelled = status === 'cancelled';
          showMessage({
            type: status === 'completed' ? 'success' : isCancelled ? 'info' : 'error',
            message:
              status === 'completed'
                ? `${analysisName || 'Transcript analysis'} completed.`
                : isCancelled
                ? `${analysisName || 'Transcript analysis'} cancelled.`
                : `${analysisName || 'Transcript analysis'} failed.`,
          });
        }
        transcriptSessionRef.current = null;
      } catch (error) {
        localStorage.removeItem('ongoingTranscriptAnalysis');
        setTranscriptAnalysis(null);
        transcriptSessionRef.current = null;
      }
    };

    const checkWorkflowAnalysis = async () => {
      const raw = localStorage.getItem('ongoingWorkflowAnalysis');
      if (!raw) {
        setWorkflowAnalysis(null);
        workflowJobRef.current = null;
        return;
      }

      try {
        const { jobId, meetingTitle, meetingId, stages } = JSON.parse(raw);
        if (!jobId) {
          localStorage.removeItem('ongoingWorkflowAnalysis');
          setWorkflowAnalysis(null);
          workflowJobRef.current = null;
          return;
        }

        const response = await fetch(`${API_BASE_URL}/api/analysis-workflow/jobs/${encodeURIComponent(jobId)}/status`);
        if (!response.ok) {
          setWorkflowAnalysis({ jobId, meetingTitle, meetingId });
          workflowJobRef.current = jobId;
          return;
        }

        const payload = await response.json();
        const job =
          payload?.data?.job ||
          payload?.data ||
          payload?.job ||
          {};
        const status = (job?.status || '').toLowerCase();

        const isActive = ['running', 'queued', 'pending', 'in_progress', 'processing'].includes(status);
        if (isActive) {
          setWorkflowAnalysis({ jobId, meetingTitle, meetingId });
          workflowJobRef.current = jobId;
          return;
        }

        localStorage.removeItem('ongoingWorkflowAnalysis');
        setWorkflowAnalysis(null);
        if (workflowJobRef.current === jobId) {
          const isCancelled = status === 'cancelled';
          const ranTranscriptOnly =
            Boolean(stages?.transcript) && !stages?.proposal && !stages?.ppt;
          showMessage({
            type: status === 'completed' ? 'success' : isCancelled ? 'info' : 'error',
            message:
              status === 'completed'
                ? ranTranscriptOnly
                  ? `Transcript analysis completed${meetingTitle ? `: ${meetingTitle}` : ''}.`
                  : `${meetingTitle || 'Analysis'} completed.`
                : isCancelled
                ? `${meetingTitle || 'Analysis'} cancelled.`
                : `${meetingTitle || 'Analysis'} failed.`,
          });
        }
        workflowJobRef.current = null;
      } catch (error) {
        localStorage.removeItem('ongoingWorkflowAnalysis');
        setWorkflowAnalysis(null);
        workflowJobRef.current = null;
      }
    };

    const checkAll = () => {
      checkOngoingResearch();
      checkTranscriptAnalysis();
      checkWorkflowAnalysis();
    };

    checkAll();
    const interval = setInterval(checkAll, 5000);
    return () => clearInterval(interval);
  }, [showMessage, researchCompany, activePreCall]);

  useEffect(() => {
    if (calendarAutoSyncRef.current || hasFetchedCalendar || calendarLoading) {
      return;
    }

    calendarAutoSyncRef.current = true;
    fetchCalendarMeetings().catch(() => {
      calendarAutoSyncRef.current = false;
    });
  }, [hasFetchedCalendar, calendarLoading, fetchCalendarMeetings]);

  const getActiveView = () => {
    const path = location.pathname;
    if (path === '/app' || path === '/app/') return 'calendar';
    if (path.startsWith('/app/accounts')) return 'accounts';
    if (path.startsWith('/app/deals')) return 'deals';
    if (path.startsWith('/app/calendar')) return 'calendar';
    if (path.startsWith('/app/analysis/postcall')) return 'post-call';
    if (path.startsWith('/app/analysis')) return 'analysis';
    // if (path.startsWith('/app/knowledge-graphs')) return 'knowledge-graphs';
    // if (path.startsWith('/app/rag')) return 'rag-docs';
    // if (path.startsWith('/app/case-studies')) return 'case-studies';
    if (path.startsWith('/app/workspaces')) return 'workspaces';
    if (path.startsWith('/app/discovery')) return 'discovery';
    if (path.startsWith('/app/agents')) return 'agents';
    if (path.startsWith('/app/rfp-sow-generator')) return 'rfp-sow';
    if (path.startsWith('/app/proposal-evaluation')) return 'proposal-eval';
    if (path.startsWith('/app/ppt-generator')) return 'ppt-gen';
    if (path.startsWith('/app/metrics')) return 'metrics';
    if (path.startsWith('/app/settings')) return 'settings';
    if (path.startsWith('/app/help')) return 'help';
    // if (path.startsWith('/app/logs')) return 'logs';
    return 'accounts';
  };

  const activeView = getActiveView();

  const handleNavigation = (view: string, path: string) => {
    setMainView(view as any);
    navigate(path);
    setSidebarOpen(false);
  };

  interface NavButtonProps {
    view: string;
    label: string;
    path: string;
    icon?: React.ReactNode;
    showBadge?: boolean;
    fullWidth?: boolean;
  }

  const NavButton: React.FC<NavButtonProps> = ({ view, label, path, icon, showBadge }) => {
    const isActive = activeView === view;
    const accentColor = '#2563eb';

    const button = sidebarCollapsed ? (
      <IconButton
        onClick={() => handleNavigation(view, path)}
        title={label}
        sx={{
          position: 'relative',
          color: isActive ? accentColor : 'text.secondary',
          bgcolor: isActive ? alpha(accentColor, 0.08) : 'transparent',
          borderRadius: 1.5,
          width: 40,
          height: 40,
          mx: 'auto',
          display: 'flex',
          '&:hover': {
            bgcolor: isActive ? alpha(accentColor, 0.1) : 'action.hover',
            color: isActive ? accentColor : 'text.primary',
          },
          '&::before': isActive ? {
            content: '""',
            position: 'absolute',
            left: 0,
            top: '18%',
            height: '64%',
            width: '3px',
            borderRadius: '0 2px 2px 0',
            bgcolor: accentColor,
          } : {},
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', opacity: isActive ? 1 : 0.6, color: isActive ? accentColor : 'inherit' }}>
          {icon}
        </Box>
      </IconButton>
    ) : (
      <Button
        variant="text"
        onClick={() => handleNavigation(view, path)}
        sx={{
          position: 'relative',
          color: isActive ? accentColor : 'text.secondary',
          bgcolor: isActive ? alpha(accentColor, 0.08) : 'transparent',
          fontWeight: isActive ? 700 : 500,
          fontSize: '0.8rem',
          pl: 2,
          pr: 1.5,
          py: 0.875,
          borderRadius: 1.5,
          textTransform: 'none',
          justifyContent: 'flex-start',
          width: '100%',
          gap: 1.25,
          '&:hover': {
            bgcolor: isActive ? alpha(accentColor, 0.1) : 'action.hover',
            color: isActive ? accentColor : 'text.primary',
          },
          // Active left bar
          '&::before': isActive ? {
            content: '""',
            position: 'absolute',
            left: 0,
            top: '18%',
            height: '64%',
            width: '3px',
            borderRadius: '0 2px 2px 0',
            bgcolor: accentColor,
          } : {},
        }}
      >
        {icon && (
          <Box sx={{ display: 'flex', alignItems: 'center', opacity: isActive ? 1 : 0.6, color: isActive ? accentColor : 'inherit' }}>
            {icon}
          </Box>
        )}
        {label}
      </Button>
    );

    if (showBadge && (isResearching || Boolean(transcriptAnalysis) || Boolean(workflowAnalysis))) {
      return (
        <Badge badgeContent="" color="success" variant="dot" sx={{ width: '100%', '& .MuiBadge-badge': { top: 8, right: 8 } }}>
          {button}
        </Badge>
      );
    }

    return button;
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // ignore
    } finally {
      clearAuthToken();
      localStorage.removeItem('ongoingResearch');
      localStorage.removeItem('ongoingTranscriptAnalysis');
      localStorage.removeItem('ongoingWorkflowAnalysis');
      navigate('/login');
    }
  };

  useEffect(() => {
    let cancelled = false;
    const loadProfilePhoto = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/me/photo`, { credentials: 'include' });
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled && data?.photo) {
          setProfilePhoto(data.photo);
        }
      } catch {
        // ignore failures
      }
    };
    loadProfilePhoto();
    return () => {
      cancelled = true;
    };
  }, []);

  // Navigation organized into categories
  const navCategories = [
    {
      category: 'Overview',
      items: [
        { view: 'dashboard', label: 'Dashboard', path: '/app/dashboard', icon: <DashboardIcon sx={{ fontSize: 16 }} /> },
      ],
    },
    {
      category: 'Pipeline',
      items: [
        { view: 'calendar', label: 'Calendar', path: '/app/calendar', icon: <CalendarToday sx={{ fontSize: 16 }} /> },
        { view: 'accounts', label: 'Accounts', path: '/app/accounts', icon: <Business sx={{ fontSize: 16 }} /> },
      ],
    },
    {
      category: 'Research',
      items: [
        { view: 'analysis', label: 'Pre-Call Research', path: '/app/analysis', showBadge: true, icon: <ManageSearch sx={{ fontSize: 16 }} /> },
        { view: 'post-call', label: 'Post-Call Analysis', path: '/app/analysis/postcall', icon: <Assessment sx={{ fontSize: 16 }} /> },
        { view: 'discovery', label: 'Discovery', path: '/app/discovery', icon: <Explore sx={{ fontSize: 16 }} /> },
      ],
    },
    {
      category: 'Workshops & Content',
      items: [
        { view: 'workspaces', label: 'Workspaces', path: '/app/workspaces', icon: <SpaceDashboard sx={{ fontSize: 16 }} /> },
        { view: 'rfp-sow', label: 'Proposal Generator', path: '/app/rfp-sow-generator', icon: <Assignment sx={{ fontSize: 16 }} /> },
        { view: 'proposal-eval', label: 'Proposal Evaluator', path: '/app/proposal-evaluation', icon: <FactCheck sx={{ fontSize: 16 }} /> },
        { view: 'ppt-gen', label: 'Presentation Generator', path: '/app/ppt-generator', icon: <Slideshow sx={{ fontSize: 16 }} /> },
      ],
    },
    {
      category: 'Platform',
      items: [
        { view: 'agents', label: 'Agent Hub', path: '/app/agents', icon: <SmartToy sx={{ fontSize: 16 }} /> },
        { view: 'metrics', label: 'Usage Metrics', path: '/app/metrics', icon: <BarChart sx={{ fontSize: 16 }} /> },
      ],
    },
  ];

  const settingsNav = { view: 'help', icon: <Settings />, label: 'Help & Settings', path: '/app/help' };
  const unreadCount = notifications.filter((n) => !n.read).length;
  const sortedNotifications = [...notifications].sort((a, b) => b.timestamp - a.timestamp).slice(0, 10);
  const activeAnalysis = isResearching
    ? {
        label: researchCompany ? `Analysis in progress: ${researchCompany}` : 'Analysis in progress',
        onClick: () =>
          activePreCall?.meetingId
            ? navigate(`/app/calendar/meetings/${encodeURIComponent(activePreCall.meetingId)}`)
            : navigate('/app/analysis'),
      }
    : workflowAnalysis
    ? {
        label: workflowAnalysis.meetingTitle
          ? `Analysis in progress: ${workflowAnalysis.meetingTitle}`
          : `Analysis in progress: ${normalizeCompanyDisplay(researchCompany)}`,
        onClick: () =>
          workflowAnalysis.meetingId
            ? navigate(`/app/calendar/meetings/${encodeURIComponent(workflowAnalysis.meetingId)}`)
            : navigate('/app/calendar'),
      }
    : transcriptAnalysis
    ? {
        label: transcriptAnalysis.analysisName
          ? `Analysis in progress: ${transcriptAnalysis.analysisName}`
          : 'Transcript analysis in progress',
        onClick: () => navigate('/app/analysis/postcall'),
      }
    : null;

  const handleOpenNotifications = (event: React.MouseEvent<HTMLElement>) => {
    setNotificationAnchor(event.currentTarget);
    markNotificationsRead();
  };

  const handleCloseNotifications = () => setNotificationAnchor(null);

  const drawerContent = (collapsed = false) => (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar sx={{ minHeight: 56 }} />
      <Box sx={{ flexGrow: 1, px: collapsed ? 0.75 : 1.5, py: 2, overflowY: 'auto' }}>
        {navCategories.map((category, categoryIndex) => (
          <Box key={category.category} sx={{ mb: 1.5 }}>
            {!collapsed && (
              <Typography
                variant="overline"
                sx={{
                  color: 'text.disabled',
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  px: 1.5,
                  display: 'block',
                  mb: 0.5,
                }}
              >
                {category.category}
              </Typography>
            )}
            <Stack spacing={0.25} alignItems={collapsed ? 'center' : 'stretch'}>
              {category.items.map((item) => (
                <NavButton key={item.view} {...item} />
              ))}
            </Stack>
            {categoryIndex < navCategories.length - 1 && (
              <Divider sx={{ mt: 1.5, borderColor: 'divider' }} />
            )}
          </Box>
        ))}
      </Box>
      <Divider />
      <Box sx={{ px: collapsed ? 0.75 : 2, py: 1.5, display: 'flex', flexDirection: 'column', alignItems: collapsed ? 'center' : 'stretch', gap: 1 }}>
        {collapsed ? (
          <IconButton
            onClick={() => handleNavigation('help', '/app/help')}
            title="Help & Settings"
            size="small"
            sx={{ color: 'text.secondary', '&:hover': { bgcolor: 'action.hover', color: 'text.primary' } }}
          >
            <Settings sx={{ fontSize: 18 }} />
          </IconButton>
        ) : (
          <>
            <Button
              fullWidth
              onClick={() => handleNavigation('help', '/app/help')}
              startIcon={<Settings sx={{ fontSize: 16 }} />}
              sx={{
                justifyContent: 'flex-start',
                textTransform: 'none',
                fontWeight: 500,
                fontSize: '0.8rem',
                color: 'text.secondary',
                borderRadius: 1.5,
                gap: 0.5,
                '&:hover': { bgcolor: 'action.hover', color: 'text.primary' },
              }}
            >
              Help & Settings
            </Button>
            <Chip
              label={hasFetchedCalendar ? 'Calendar synced' : 'Calendar not synced'}
              size="small"
              sx={{
                bgcolor: hasFetchedCalendar ? 'success.light' : 'error.light',
                color: hasFetchedCalendar ? 'success.main' : 'error.main',
                fontWeight: 500,
                fontSize: '0.7rem',
                height: 20,
              }}
            />
          </>
        )}
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          bgcolor: 'background.paper',
          borderBottom: 1,
          borderColor: 'divider',
          color: 'text.primary',
          boxShadow: 'none',
          zIndex: (t) => t.zIndex.drawer + 1,
        }}
      >
        <Toolbar
          sx={{
            py: 0,
            px: { xs: 2, md: 3 },
            minHeight: 40,
            alignItems: 'center',
            gap: 1.5,
          }}
        >
          {/* Hamburger — mobile only */}
          <IconButton
            edge="start"
            color="inherit"
            onClick={() => setSidebarOpen((prev) => !prev)}
            sx={{ mr: 1, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          {/* Collapse toggle — desktop only */}
          <IconButton
            color="inherit"
            onClick={() => setSidebarCollapsed((prev) => !prev)}
            sx={{ mr: 1, display: { xs: 'none', md: 'flex' } }}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <ChevronRight /> : <ChevronLeft />}
          </IconButton>

          <Box mr={{ xs: 1.5, md: 2.5 }} display="flex" alignItems="center">
            <Box
              component="img"
              src={LogoMark}
              alt="Sales Assistant Logo"
              sx={{ width: 72, height: 72, objectFit: 'contain', display: 'block', m: 0 }}
            />
          </Box>

          <Box sx={{ flexGrow: 1 }} />

          {activeAnalysis && (
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mr: 2 }}>
              <Chip
                icon={<PlayArrow sx={{ fontSize: 14 }} />}
                label={activeAnalysis.label}
                size="small"
                onClick={activeAnalysis.onClick}
                sx={{
                  bgcolor: 'success.light',
                  color: 'success.main',
                  border: 1,
                  borderColor: 'success.main',
                  fontWeight: 500,
                  cursor: 'pointer',
                  '&:hover': {
                    opacity: 0.85,
                  },
                }}
              />
              {(activePreCall?.sessionId || workflowAnalysis?.jobId || transcriptAnalysis?.analysisId) ? (
                <CancelAnalysisFlowButton
                  iconOnly
                  preCallSessionId={activePreCall?.sessionId || null}
                  workflowJobId={workflowAnalysis?.jobId || null}
                  transcriptAnalysisId={transcriptAnalysis?.analysisId || null}
                  meetingId={activePreCall?.meetingId || workflowAnalysis?.meetingId || undefined}
                  size="small"
                />
              ) : null}
            </Stack>
          )}

          <IconButton
            onClick={() => setTheme(themeMode === 'dark' ? 'light' : 'dark')}
            color="inherit"
            sx={{ mr: 0.5, '&:hover': { bgcolor: 'action.hover' } }}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? <LightMode fontSize="small" /> : <DarkMode fontSize="small" />}
          </IconButton>

          <IconButton
            color="inherit"
            onClick={handleOpenNotifications}
            sx={{
              bgcolor: 'action.hover',
              mr: 1,
              '&:hover': { bgcolor: 'action.selected' },
            }}
          >
            <Badge color="error" badgeContent={unreadCount > 0 ? unreadCount : undefined} overlap="circular">
              <NotificationsIcon />
            </Badge>
          </IconButton>

          <Stack direction="row" spacing={1}>
            <IconButton
              onClick={(e) => setAccountMenuAnchor(e.currentTarget)}
              sx={{
                p: 0.25,
                border: '1px solid transparent',
                bgcolor: 'transparent',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <Avatar
                sx={{ width: 32, height: 32, bgcolor: '#C90C61', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                src={profilePhoto || undefined}
              >
                {!profilePhoto ? 'U' : null}
              </Avatar>
              <ArrowDropDown />
            </IconButton>
          </Stack>
        </Toolbar>
      </AppBar>

      <Menu
        anchorEl={accountMenuAnchor}
        open={Boolean(accountMenuAnchor)}
        onClose={() => setAccountMenuAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem
          onClick={() => {
            handleNavigation(settingsNav.view, settingsNav.path);
            setAccountMenuAnchor(null);
          }}
        >
          <ListItemIcon>
            <Settings fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Help & Settings" />
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAccountMenuAnchor(null);
            handleLogout();
          }}
        >
          <ListItemIcon>
            <Logout fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Logout" />
        </MenuItem>
      </Menu>

      <Menu
        anchorEl={notificationAnchor}
        open={Boolean(notificationAnchor)}
        onClose={handleCloseNotifications}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { minWidth: 320, maxWidth: 360 } }}
      >
        {sortedNotifications.length === 0 ? (
          <MenuItem disabled>
            <ListItemText primary="No notifications yet" />
          </MenuItem>
        ) : (
          sortedNotifications.map((notif) => (
            <MenuItem key={notif.id} dense>
              <ListItemText
                primary={notif.title}
                secondary={
                  <Box component="span" sx={{ color: 'text.secondary', display: 'block' }}>
                    {notif.message}
                  </Box>
                }
              />
              <ListItemSecondaryAction>
                <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                  {new Date(notif.timestamp).toLocaleTimeString()}
                </Typography>
              </ListItemSecondaryAction>
            </MenuItem>
          ))
        )}
      </Menu>

      {/* Mobile: temporary drawer */}
      <Drawer
        anchor="left"
        variant="temporary"
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            bgcolor: 'background.paper',
            borderRight: 1,
            borderColor: 'divider',
          },
        }}
      >
        {drawerContent(false)}
      </Drawer>

      {/* Desktop: permanent sidebar */}
      <Drawer
        anchor="left"
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': {
            width: sidebarCollapsed ? collapsedWidth : drawerWidth,
            boxSizing: 'border-box',
            bgcolor: 'background.paper',
            borderRight: 1,
            borderColor: 'divider',
            overflowX: 'hidden',
            transition: 'width 0.2s ease',
          },
        }}
      >
        {drawerContent(sidebarCollapsed)}
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minHeight: '100vh',
          width: '100%',
          ml: { md: sidebarCollapsed ? `${collapsedWidth}px` : `${drawerWidth}px` },
          transition: 'margin-left 0.2s ease',
          bgcolor: 'background.default',
        }}
      >
        <Toolbar sx={{ minHeight: 56 }} />
        <Box sx={{ px: { xs: 2, md: 3 }, py: 3 }}>{children}</Box>
      </Box>
    </Box>
  );
};

export default Layout;
