import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Card,
  Grid,
  Stack,
  Tooltip,
  Divider,
  Chip,
  Drawer,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Popover,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  TextField,
} from '@mui/material';
import {
  ChevronLeft,
  ChevronRight,
  Today,
  PlayArrow as AnalyzeIcon,
  Visibility as ViewIcon,
  Event as EventIcon,
  AccessTime as AccessTimeIcon,
  Groups as GroupsIcon,
  LocationOn as LocationIcon,
  DateRange as DateRangeIcon,
  Add as AddIcon,
} from '@mui/icons-material';

import type { CalendarMeeting, CalendarDeal } from '../types/calendarMeeting';
import type { DealStage } from '../../../shared/types/deal';
import AnalysisChecklist, { AnalysisStageSelection } from './AnalysisChecklist';
import InlinePreCallAnalysis from './InlinePreCallAnalysis';
import MeetingFlowProgressBar from './MeetingFlowProgressBar';
import QuickSetupWizard from './QuickSetupWizard';
import DealProgressBar from './DealProgressBar';
import { getWorkflowChipProps, getStageStatus, isStageComplete, getWorkflowStatus } from '../utils/analysisStatus';
import { useAccountsStore } from '../store/accountsStore';
import type { AccountDeal } from '../../../shared/types/account';
import { formatMeetingForTimeZone, type FormattedDateTime } from '../utils/dateTime';
import { useUserTimeZone } from '../context/UserTimeZoneContext';
import { useCalendarMeetingsStore } from '../store/calendarMeetingsStore';
import { apiPost } from '../utils/api';
import LinkIcon from '@mui/icons-material/Link';
import DescriptionIcon from '@mui/icons-material/Description';
import ArticleIcon from '@mui/icons-material/Article';
import SlideshowIcon from '@mui/icons-material/Slideshow';
import AssignmentIcon from '@mui/icons-material/Assignment';

type Meeting = CalendarMeeting;

interface MeetingAssociationPayload {
  accountId: string | null;
  dealId: string | null;
  accountName?: string | null;
  dealName?: string | null;
}

interface CalendarViewProps {
  meetings: Meeting[];
  onViewDetails: (meeting: Meeting) => void;
  onPostCallAnalysis?: (meeting: Meeting) => void;
  onGenerateProposal?: (meeting: Meeting) => void;
  onGeneratePpt?: (meeting: Meeting) => void;
  onAnalysisError?: (message: string) => void;
  onRunWorkflow?: (
    meeting: Meeting,
    payload: { stages: AnalysisStageSelection; transcriptText?: string }
  ) => Promise<void> | void;
  workflowLoadingId?: string | null;
  workflowError?: { id: string | null; message: string | null } | null;
  onUpdateAssociation?: (
    meeting: Meeting,
    association: MeetingAssociationPayload
  ) => Promise<void> | void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const ROW_HEIGHT = 80;
// Default view: 7am to 7pm (12 hours visible)
const DEFAULT_START_HOUR = 7;
const VISIBLE_HOURS = 12;
const DEFAULT_VIEW_HEIGHT = VISIBLE_HOURS * ROW_HEIGHT; // 960px

// Current time indicator color
const CURRENT_TIME_COLOR = '#dc2626';
// Ongoing meeting color - use a distinctive dark color with good contrast
const ONGOING_MEETING_COLOR = '#1e293b';

// Meeting card color scheme with proper contrast
const MEETING_COLORS = {
  ongoing: { bg: '#1e293b', text: '#ffffff', border: '#dc2626' },      // Dark slate with white text, red border
  running: { bg: '#fef3c7', text: '#92400e', border: '#d97706' },      // Amber light bg, dark amber text
  analyzed: { bg: '#d1fae5', text: '#065f46', border: '#059669' },     // Green light bg, dark green text
  analyzing: { bg: '#fef3c7', text: '#92400e', border: '#d97706' },    // Amber light bg
  completed: { bg: '#f3f4f6', text: '#374151', border: '#9ca3af' },    // Gray light bg
  default: { bg: '#ffffff', text: '#171717', border: '#e5e5e5' },      // White bg, dark text
};

const formatTimeLabel = (hoursDecimal: number) => {
  const hours = Math.floor(hoursDecimal);
  const minutes = Math.round((hoursDecimal - hours) * 60);
  const safeMinutes = (minutes + 60) % 60;
  const carryHour = minutes >= 60 ? 1 : 0;
  const adjustedHours = (hours + carryHour + 24) % 24;

  return `${adjustedHours.toString().padStart(2, '0')}:${safeMinutes.toString().padStart(2, '0')}`;
};

const getTimeSlotPosition = (startHour: number, duration: number) => {
  const top = startHour * ROW_HEIGHT;
  const height = (duration / 60) * ROW_HEIGHT;
  return { top, height };
};

interface MeetingLayout {
  meeting: Meeting;
  start: number;
  end: number;
  column: number;
  totalColumns: number;
}

const meetingsOverlap = (a: MeetingLayout, b: MeetingLayout) => !(a.end <= b.start || b.end <= a.start);

const getHourValue = (info?: FormattedDateTime | null) =>
  info ? info.hour24 + info.minute / 60 : 0;

const buildMeetingLayout = (
  dayMeetings: Meeting[],
  infoMap: Map<string, FormattedDateTime>
): MeetingLayout[] => {
  const enriched = dayMeetings
    .map((meeting) => {
      const info = infoMap.get(meeting.id);
      const start = getHourValue(info);
      const duration = meeting.duration || 60;
      const end = start + duration / 60;
      return { meeting, start, end, column: 0, totalColumns: 1 };
    })
    .sort((a, b) => a.start - b.start || a.end - b.end);

  enriched.forEach((current, idx) => {
    let column = 0;
    const overlapsColumn = (col: number) =>
      enriched
        .slice(0, idx)
        .some((other) => other.column === col && meetingsOverlap(other, current));

    while (overlapsColumn(column)) {
      column += 1;
    }
    current.column = column;
  });

  enriched.forEach((current) => {
    const overlapping = enriched.filter((other) => meetingsOverlap(other, current));
    const maxColumns = overlapping.length
      ? Math.max(...overlapping.map((m) => m.column + 1))
      : current.column + 1;
    current.totalColumns = Math.max(1, maxColumns);
  });

  return enriched;
};

const getMeetingTimeRange = (meeting: Meeting, info?: FormattedDateTime | null) => {
  if (!info) {
    return meeting.time || 'Time TBD';
  }
  const start = getHourValue(info);
  const duration = meeting.duration || 60;
  const end = start + duration / 60;
  const label = `${formatTimeLabel(start)} – ${formatTimeLabel(end)}`;
  return info.timeZoneShort ? `${label} ${info.timeZoneShort}` : label;
};

const getMeetingTimeLabel = (meeting: Meeting, info?: FormattedDateTime | null) => {
  if (!info) {
    return meeting.time || 'Time TBD';
  }
  if (!meeting.duration) {
    return `${formatTimeLabel(getHourValue(info))} ${info.timeZoneShort}`;
  }
  return getMeetingTimeRange(meeting, info);
};

const meetingHasAssociation = (meeting: Meeting) =>
  Boolean(meeting.accountId || meeting.deal_id || meeting.deal?.deal_id);

const hasCompletedPreCallAnalysis = (meeting: Meeting) => {
  const preCallSummary = meeting.analysisSummary?.preCall?.[0];
  return preCallSummary?.status === 'completed';
};

const hasRunningPreCallAnalysis = (meeting: Meeting) => {
  const preCallSummary = meeting.analysisSummary?.preCall?.[0];
  return preCallSummary?.status === 'running' || preCallSummary?.status === 'pending';
};

const hasCompletedPostCallAnalysis = (meeting: Meeting) => {
  const postCallSummary = meeting.analysisSummary?.postCall?.[0];
  return postCallSummary?.status === 'completed';
};

const hasCompletedProposal = (meeting: Meeting) => {
  const proposalStatus = getStageStatus(meeting, 'proposal');
  return isStageComplete(proposalStatus);
};

const hasCompletedPptx = (meeting: Meeting) => {
  const pptStatus = getStageStatus(meeting, 'ppt');
  return isStageComplete(pptStatus);
};

const getWorkflowStageState = (meeting: Meeting) => {
  const transcriptStatus = getStageStatus(meeting, 'transcript');
  const proposalStatus = getStageStatus(meeting, 'proposal');
  const pptStatus = getStageStatus(meeting, 'ppt');

  const transcriptComplete = isStageComplete(transcriptStatus);
  const proposalComplete = isStageComplete(proposalStatus);
  const pptComplete = isStageComplete(pptStatus);

  return {
    transcriptStatus,
    proposalStatus,
    pptStatus,
    transcriptComplete,
    proposalComplete,
    pptComplete,
    allComplete: transcriptComplete && proposalComplete && pptComplete,
    onlyTranscriptComplete: transcriptComplete && !proposalComplete && !pptComplete,
    stageAvailability: {
      transcript: !transcriptComplete,
      proposal: !proposalComplete,
      ppt: !pptComplete,
    },
    stageInitialSelection: !transcriptComplete
      ? { transcript: true }
      : !proposalComplete
      ? { proposal: true }
      : !pptComplete
      ? { ppt: true }
      : {},
    completedStages: {
      transcript: transcriptComplete,
      proposal: proposalComplete,
      ppt: pptComplete,
    },
  };
};

const CalendarView: React.FC<CalendarViewProps> = ({
  meetings: externalMeetings,
  onViewDetails,
  onPostCallAnalysis,
  onGenerateProposal,
  onGeneratePpt,
  onAnalysisError,
  onRunWorkflow,
  workflowLoadingId,
  workflowError,
  onUpdateAssociation,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const autoScrolledRef = useRef(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [weekPickerAnchor, setWeekPickerAnchor] = useState<HTMLButtonElement | null>(null);

  // Scroll to 7am on mount (initial scroll before meetings sync)
  useEffect(() => {
    if (scrollContainerRef.current && !autoScrolledRef.current) {
      const scrollTo = DEFAULT_START_HOUR * ROW_HEIGHT;
      scrollContainerRef.current.scrollTop = scrollTo;
    }
  }, []);

  // Update current time every minute for the time indicator line
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  const [associationAccountId, setAssociationAccountId] = useState<string>('');
  const [associationDealId, setAssociationDealId] = useState<string>('');
  const [accountTouched, setAccountTouched] = useState(false);
  const [dealTouched, setDealTouched] = useState(false);
  const [associationSaving, setAssociationSaving] = useState(false);
  const [associationStatus, setAssociationStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [accountDetailLoading, setAccountDetailLoading] = useState(false);
  const [associationEditing, setAssociationEditing] = useState(false);
  const [quickSetupMode, setQuickSetupMode] = useState(false);
  // Create new deal state
  const [isCreatingNewDeal, setIsCreatingNewDeal] = useState(false);
  const [newDealName, setNewDealName] = useState('');
  const [createDealLoading, setCreateDealLoading] = useState(false);
  const [createDealError, setCreateDealError] = useState<string | null>(null);

  const CREATE_NEW_DEAL_VALUE = '__create_new__';

  const updateMeeting = useCalendarMeetingsStore((state) => state.updateMeeting);
  const fetchMeetings = useCalendarMeetingsStore((state) => state.fetchMeetings);

  const { timeZone: userTimeZone } = useUserTimeZone();
  const meetings = useMemo(() => externalMeetings ?? [], [externalMeetings]);

  // Keep selectedMeeting in sync when meetings array is updated (e.g., after a sync)
  // This prevents the drawer from showing stale data
  useEffect(() => {
    if (selectedMeeting && meetings.length > 0) {
      const updatedMeeting = meetings.find((m) => m.id === selectedMeeting.id);
      if (updatedMeeting && updatedMeeting !== selectedMeeting) {
        setSelectedMeeting(updatedMeeting);
      }
    }
  }, [meetings, selectedMeeting]);

  const localizedMeetingInfo = useMemo(() => {
    const map = new Map<string, FormattedDateTime>();
    meetings.forEach((meeting) => {
      const formatted = formatMeetingForTimeZone(meeting, userTimeZone);
      map.set(meeting.id, formatted);
    });
    return map;
  }, [meetings, userTimeZone]);
  const accounts = useAccountsStore((state) => state.accounts);
  const accountDetails = useAccountsStore((state) => state.accountDetails);
  const fetchAccounts = useAccountsStore((state) => state.fetchAccounts);
  const fetchAccountDetail = useAccountsStore((state) => state.fetchAccountDetail);
  const accountsLoading = useAccountsStore((state) => state.loading);
  const selectedMeetingLocalInfo = selectedMeeting ? localizedMeetingInfo.get(selectedMeeting.id) || null : null;

  const meetingRange = useMemo(() => {
    if (!meetings.length) {
      return null;
    }
    const timestamps = meetings
      .map((meeting) => {
        if (meeting.startDateTime) {
          const fromStart = new Date(meeting.startDateTime);
          if (!Number.isNaN(fromStart.getTime())) {
            return fromStart.getTime();
          }
        }
        if (meeting.date) {
          const isoCandidate = meeting.time ? `${meeting.date}T${meeting.time}` : meeting.date;
          const fromDate = new Date(isoCandidate);
          if (!Number.isNaN(fromDate.getTime())) {
            return fromDate.getTime();
          }
        }
        return null;
      })
      .filter((value): value is number => typeof value === 'number');

    if (!timestamps.length) {
      return null;
    }

    const minDate = new Date(Math.min(...timestamps));
    const maxDate = new Date(Math.max(...timestamps));
    const format = (date: Date) =>
      date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    return {
      from: format(minDate),
      to: format(maxDate),
    };
  }, [meetings]);

  const workflowStatus = selectedMeeting ? getWorkflowStatus(selectedMeeting) : 'idle';
  const meetingStatusLower = selectedMeeting?.status?.toLowerCase() || null;
  const preCallRunning = selectedMeeting ? hasRunningPreCallAnalysis(selectedMeeting) : false;
  const isWorkflowJobActive = (value?: string | null) =>
    ['queued', 'running', 'pending', 'in_progress', 'processing', 'analyzing'].includes((value || '').toLowerCase());
  const workflowJobActive = Boolean(
    selectedMeeting?.analysisJob &&
      (isWorkflowJobActive(selectedMeeting.analysisJob.status) ||
        isWorkflowJobActive(selectedMeeting.analysisJob.transcriptStatus) ||
        isWorkflowJobActive(selectedMeeting.analysisJob.proposalStatus) ||
        isWorkflowJobActive(selectedMeeting.analysisJob.pptStatus))
  );
  const analysisInProgress =
    workflowStatus === 'running' ||
    workflowStatus === 'queued' ||
    meetingStatusLower === 'analyzing' ||
    preCallRunning ||
    workflowJobActive;
  const pipelineLockReason = analysisInProgress
    ? 'AI analysis is currently running for this meeting.'
    : null;

  useEffect(() => {
    if (!drawerOpen) return;
    if (accounts.length === 0) {
      fetchAccounts().catch(() => undefined);
    }
  }, [drawerOpen, accounts.length, fetchAccounts]);

  useEffect(() => {
    if (!selectedMeeting) {
      setAssociationAccountId('');
      setAssociationDealId('');
      setAssociationStatus(null);
      setAccountTouched(false);
      setDealTouched(false);
      setAssociationEditing(false);
      return;
    }
    const resolvedAccountId = selectedMeeting.accountId || '';
    const resolvedDealId =
      selectedMeeting.deal_id || selectedMeeting.deal?.deal_id || '';
    setAssociationAccountId(resolvedAccountId || '');
    setAssociationDealId(resolvedDealId || '');
    setAssociationStatus(null);
    setAccountTouched(Boolean(resolvedAccountId));
    setDealTouched(Boolean(resolvedDealId));
    setAssociationEditing(!meetingHasAssociation(selectedMeeting));
  }, [selectedMeeting]);

  useEffect(() => {
    if (!drawerOpen || !associationAccountId) {
      setAccountDetailLoading(false);
      return;
    }

    if (accountDetails[associationAccountId]) {
      setAccountDetailLoading(false);
      return;
    }

    setAccountDetailLoading(true);
    fetchAccountDetail(associationAccountId)
      .catch(() => undefined)
      .finally(() => setAccountDetailLoading(false));
  }, [drawerOpen, associationAccountId, accountDetails, fetchAccountDetail]);

  const dealsForSelectedAccount: AccountDeal[] = useMemo(() => {
    if (!associationAccountId) {
      return [];
    }
    return accountDetails[associationAccountId]?.deals || [];
  }, [associationAccountId, accountDetails]);

  const selectedAccountName = useMemo(() => {
    if (!associationAccountId) return null;
    return (
      accounts.find((account) => account.account_id === associationAccountId)
        ?.name || null
    );
  }, [associationAccountId, accounts]);

  const selectedDealName = useMemo(() => {
    if (!associationDealId) return null;
    return (
      dealsForSelectedAccount.find((deal) => deal.deal_id === associationDealId)
        ?.opportunity_name || null
    );
  }, [associationDealId, dealsForSelectedAccount]);

  const getWeekDays = (date: Date) => {
    const start = new Date(date);
    start.setDate(date.getDate() - date.getDay());
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const weekDays = getWeekDays(currentDate);
  const hours = HOURS;
  const totalDayHeight = hours.length * ROW_HEIGHT;

  // Use local date components to avoid UTC conversion issues
  // This ensures the calendar grid matches the user's local timezone
  const formatDateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const isToday = (date: Date) => formatDateKey(date) === formatDateKey(new Date());

  const getMeetingsForDay = useCallback(
    (date: Date) => {
      const dateStr = formatDateKey(date);
      return meetings.filter((meeting) => localizedMeetingInfo.get(meeting.id)?.isoDate === dateStr);
    },
    [meetings, localizedMeetingInfo]
  );

  const handlePrevWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() - 7);
    setCurrentDate(newDate);
  };

  const handleNextWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + 7);
    setCurrentDate(newDate);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Week picker popover handlers
  const handleOpenWeekPicker = (event: React.MouseEvent<HTMLButtonElement>) => {
    setWeekPickerAnchor(event.currentTarget);
  };

  const handleCloseWeekPicker = () => {
    setWeekPickerAnchor(null);
  };

  const handleGoToLastWeek = () => {
    const newDate = new Date();
    newDate.setDate(newDate.getDate() - 7);
    setCurrentDate(newDate);
    handleCloseWeekPicker();
  };

  const handleGoToThisWeek = () => {
    setCurrentDate(new Date());
    handleCloseWeekPicker();
  };

  const handleGoToNextWeek = () => {
    const newDate = new Date();
    newDate.setDate(newDate.getDate() + 7);
    setCurrentDate(newDate);
    handleCloseWeekPicker();
  };

  // Helper to get week date range label
  const getWeekRangeLabel = (offsetWeeks: number) => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + (offsetWeeks * 7));
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    const formatDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${formatDate(startOfWeek)} - ${formatDate(endOfWeek)}`;
  };

  // Get all weeks for the displayed month
  const getWeeksOfMonth = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // First day of the month
    const firstOfMonth = new Date(year, month, 1);
    // Last day of the month
    const lastOfMonth = new Date(year, month + 1, 0);

    const weeks: Array<{ weekNum: number; start: Date; end: Date; isCurrentWeek: boolean }> = [];

    // Start from the Sunday of the week containing the 1st
    const weekStart = new Date(firstOfMonth);
    weekStart.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());

    let weekNum = 1;
    const today = new Date();

    while (weekStart <= lastOfMonth || weekStart.getMonth() === month) {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      // Check if this week contains today
      const isCurrentWeek = today >= weekStart && today <= weekEnd;

      weeks.push({
        weekNum,
        start: new Date(weekStart),
        end: new Date(weekEnd),
        isCurrentWeek,
      });

      weekStart.setDate(weekStart.getDate() + 7);
      weekNum++;

      // Stop if we've gone past the month
      if (weekStart.getMonth() !== month && weekStart > lastOfMonth) break;
      if (weekNum > 6) break; // Safety limit
    }

    return weeks;
  }, [currentDate]);

  // Navigate to a specific week
  const handleGoToWeek = (weekStart: Date) => {
    setCurrentDate(new Date(weekStart));
    handleCloseWeekPicker();
  };

  // Check if a week is currently selected/displayed
  const isWeekSelected = (weekStart: Date) => {
    const displayedWeekStart = new Date(currentDate);
    displayedWeekStart.setDate(currentDate.getDate() - currentDate.getDay());
    return formatDateKey(weekStart) === formatDateKey(displayedWeekStart);
  };

  // Format week range nicely
  const formatWeekRange = (start: Date, end: Date) => {
    const formatDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${formatDate(start)} - ${formatDate(end)}`;
  };

  const handleMeetingClick = (meeting: Meeting) => {
    setSelectedMeeting(meeting);
    setDrawerOpen(true);
  };

  const handleCloseSidebar = () => {
    setDrawerOpen(false);
    setSelectedMeeting(null);
  };

  const persistAssociation = async (
    nextAccountId: string | null,
    nextDealId: string | null,
    nextAccountName: string | null,
    nextDealName: string | null,
    successMessage: string
  ) => {
    if (!selectedMeeting || !onUpdateAssociation) {
      return;
    }
    setAssociationSaving(true);
    setAssociationStatus(null);
    try {
      await onUpdateAssociation(selectedMeeting, {
        accountId: nextAccountId,
        dealId: nextDealId,
        accountName: nextAccountName,
        dealName: nextDealName,
      });
      setAssociationStatus({ type: 'success', message: successMessage });
      setAssociationEditing(!(nextAccountId || nextDealId));
    } catch (error: any) {
      setAssociationStatus({
        type: 'error',
        message: error?.message || 'Failed to update meeting link.',
      });
    } finally {
      setAssociationSaving(false);
    }
  };

  const handleAssociationSave = async () => {
    if (!selectedMeeting || !onUpdateAssociation) {
      return;
    }
    const nextAccountId = associationAccountId || null;
    const nextDealId = associationDealId || null;
    if (nextAccountId && !nextDealId) {
      setAccountTouched(true);
      setDealTouched(true);
      setAssociationStatus({
        type: 'error',
        message: 'Please select a deal for this meeting. Account alone is not allowed.',
      });
      return;
    }
    const message =
      nextAccountId || nextDealId
        ? 'Meeting link updated.'
        : 'Meeting link cleared.';
    await persistAssociation(
      nextAccountId,
      nextDealId,
      selectedAccountName,
      selectedDealName,
      message
    );
  };

  const handleAssociationClear = async () => {
    if (!selectedMeeting || !onUpdateAssociation) {
      setAssociationAccountId('');
      setAssociationDealId('');
      return;
    }
    setAssociationAccountId('');
    setAssociationDealId('');
    await persistAssociation(null, null, null, null, 'Meeting link cleared.');
    setAssociationEditing(true);
  };

  const handleDealSelectChange = (value: string) => {
    if (value === CREATE_NEW_DEAL_VALUE) {
      setIsCreatingNewDeal(true);
      setAssociationDealId('');
      // Default name based on account
      setNewDealName(selectedAccountName ? `${selectedAccountName} Opportunity` : 'New Opportunity');
    } else {
      setIsCreatingNewDeal(false);
      setAssociationDealId(value || '');
      setNewDealName('');
    }
    setCreateDealError(null);
    setDealTouched(true);
  };

  const handleCreateDeal = async () => {
    if (!associationAccountId || !newDealName.trim()) {
      setCreateDealError('Deal name is required');
      return;
    }

    setCreateDealLoading(true);
    setCreateDealError(null);

    try {
      const response = await apiPost('/api/deals', {
        opportunity_name: newDealName.trim(),
        account_id: associationAccountId,
        stage: 'prospecting',
        status: 'active',
      });

      if (response?.success && response?.data?.deal_id) {
        // Refresh account details to get the new deal
        await fetchAccountDetail(associationAccountId);

        // Set the newly created deal as selected
        setAssociationDealId(response.data.deal_id);
        setIsCreatingNewDeal(false);
        setNewDealName('');
        setAssociationStatus({
          type: 'success',
          message: `Deal "${response.data.opportunity_name || newDealName.trim()}" created successfully`,
        });
      } else {
        setCreateDealError(response?.error || 'Failed to create deal');
      }
    } catch (err: any) {
      setCreateDealError(err.message || 'Failed to create deal');
    } finally {
      setCreateDealLoading(false);
    }
  };

  const isPastMeeting = (meeting: Meeting | null) => {
    if (!meeting) return false;
    if (meeting.startDateTime) {
      return new Date(meeting.startDateTime) < new Date();
    }
    if (meeting.date && meeting.time) {
      return new Date(`${meeting.date}T${meeting.time}`) < new Date();
    }
    return meeting.status === 'completed';
  };

  // Check if a meeting is currently ongoing
  const isOngoingMeeting = useCallback((meeting: Meeting, info: FormattedDateTime | undefined) => {
    if (!info) return false;
    const now = currentTime;
    const nowHours = now.getHours();
    const nowMinutes = now.getMinutes();
    const nowDecimal = nowHours + nowMinutes / 60;

    const meetingStart = info.hour24 + info.minute / 60;
    const meetingEnd = meetingStart + (meeting.duration || 60) / 60;

    // Check if today matches the meeting date
    const todayStr = formatDateKey(now);
    if (info.isoDate !== todayStr) return false;

    return nowDecimal >= meetingStart && nowDecimal < meetingEnd;
  }, [currentTime]);

  // Calculate current time position (in pixels from top)
  const getCurrentTimePosition = useCallback(() => {
    const now = currentTime;
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const decimalHours = hours + minutes / 60;
    return decimalHours * ROW_HEIGHT;
  }, [currentTime]);

  const getMeetingCardColors = (meeting: Meeting, info?: FormattedDateTime) => {
    // Check if meeting is currently ongoing - highest priority
    if (info && isOngoingMeeting(meeting, info)) {
      return MEETING_COLORS.ongoing;
    }

    const workflowChip = getWorkflowChipProps(meeting);
    switch (workflowChip.status) {
      case 'running':
      case 'queued':
      case 'partial':
        return MEETING_COLORS.running;
      case 'completed':
      case 'error':
        break;
    }

    switch (meeting.status) {
      case 'analyzed':
        return MEETING_COLORS.analyzed;
      case 'analyzing':
        return MEETING_COLORS.analyzing;
      case 'completed':
        return MEETING_COLORS.completed;
      default:
        return MEETING_COLORS.default;
    }
  };

  const resolvedAccountName = useMemo(() => {
    if (!selectedMeeting) return null;
    if (selectedMeeting.accountName) return selectedMeeting.accountName;
    if (selectedMeeting.accountId) {
      return accounts.find((account) => account.account_id === selectedMeeting.accountId)?.name || null;
    }
    return null;
  }, [selectedMeeting, accounts]);

  const resolvedDealName = useMemo(() => {
    if (!selectedMeeting) return null;
    return (
      selectedMeeting.deal?.opportunity_name || null
    );
  }, [selectedMeeting]);

  const associationHint =
    selectedMeeting && !meetingHasAssociation(selectedMeeting)
      ? 'Link this meeting to a deal (accounts only filter the list). Leave both empty if the pursuit is not defined yet.'
      : null;

  // On the first successful sync, scroll to the earliest visible meeting so users land where activity exists
  useEffect(() => {
    if (autoScrolledRef.current) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    const visibleMeetings = weekDays.flatMap((day) => getMeetingsForDay(day));
    if (!visibleMeetings.length) return;

    const earliestStart = visibleMeetings.reduce((min, meeting) => {
      const info = localizedMeetingInfo.get(meeting.id);
      if (!info) return min;
      const start = info.hour24 + info.minute / 60;
      return Math.min(min, start);
    }, Number.POSITIVE_INFINITY);

    if (!Number.isFinite(earliestStart)) return;

    const target = Math.max(earliestStart * ROW_HEIGHT - ROW_HEIGHT, 0);
    container.scrollTo({ top: target, behavior: 'smooth' });
    autoScrolledRef.current = true;
  }, [getMeetingsForDay, localizedMeetingInfo, weekDays]);

  return (
    <Box>
      <Paper
        sx={{
          p: 2.5,
          mb: 3,
          background: '#FFFFFF',
          borderColor: 'divider',
          boxShadow: 'none',
          borderRadius: 1.5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          {/* Legend */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, flexWrap: 'wrap' }}>
            {[
              { color: 'secondary.main', label: 'Linked', icon: <LinkIcon sx={{ fontSize: 14 }} /> },
              { color: '#0891b2', label: 'Pre-call', icon: <AssignmentIcon sx={{ fontSize: 14 }} /> },
              { color: 'success.main', label: 'Transcript', icon: <DescriptionIcon sx={{ fontSize: 14 }} /> },
              { color: '#7c3aed', label: 'Proposal', icon: <ArticleIcon sx={{ fontSize: 14 }} /> },
              { color: '#ea580c', label: 'PPT', icon: <SlideshowIcon sx={{ fontSize: 14 }} /> },
            ].map((item) => (
              <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box
                  sx={{
                    width: 20,
                    height: 20,
                    borderRadius: 1,
                    bgcolor: `${item.color}15`,
                    color: item.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {item.icon}
                </Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500, fontSize: '0.75rem' }}>
                  {item.label}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Paper>

      {/* Calendar Header */}
      <Paper
        sx={{
          p: 2.5,
          mb: 3,
          background: '#FFFFFF',
          borderColor: 'divider',
          boxShadow: 'none',
          borderRadius: 1.5,
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Tooltip title="Previous Week" arrow>
              <IconButton
                onClick={handlePrevWeek}
                sx={{
                  color: 'text.secondary',
                  background: '#FFFFFF',
                  borderColor: 'divider',
                  '&:hover': {
                    bgcolor: 'action.hover',
                    borderColor: 'divider',
                  },
                }}
              >
                <ChevronLeft />
              </IconButton>
            </Tooltip>

            <Tooltip title="Quick Week Navigation" arrow>
              <IconButton
                onClick={handleOpenWeekPicker}
                sx={{
                  color: 'text.secondary',
                  bgcolor: 'background.default',
                  borderColor: 'divider',
                  '&:hover': {
                    bgcolor: 'action.hover',
                    borderColor: 'divider',
                  },
                }}
              >
                <Today />
              </IconButton>
            </Tooltip>

            <Tooltip title="Next Week" arrow>
              <IconButton
                onClick={handleNextWeek}
                sx={{
                  color: 'text.secondary',
                  background: '#FFFFFF',
                  borderColor: 'divider',
                  '&:hover': {
                    bgcolor: 'action.hover',
                    borderColor: 'divider',
                  },
                }}
              >
                <ChevronRight />
              </IconButton>
            </Tooltip>

            <Divider orientation="vertical" flexItem sx={{ mx: 1, borderColor: 'divider' }} />

            <Typography
              variant="h5"
              sx={{
                color: 'text.primary',
                fontWeight: 600,
              }}
            >
              {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* Calendar Grid */}
      <Paper
        sx={{
          background: '#FFFFFF',
          overflow: 'hidden',
          borderColor: 'divider',
          boxShadow: 'none',
          borderRadius: 1.5,
          position: 'relative',
        }}
      >
        {/* Day Headers */}
        <Box
          sx={{
            display: 'flex',
            borderBottom: 1, borderColor: 'divider',
            bgcolor: 'background.default',
          }}
        >
          <Box
            sx={{
              width: 80,
              flexShrink: 0,
              borderRight: 1, borderColor: 'divider',
              bgcolor: 'background.default',
            }}
          />
          {weekDays.map((day, idx) => {
            const dayMeetings = getMeetingsForDay(day);
            return (
              <Tooltip
                key={idx}
                title={`${dayMeetings.length} meeting${dayMeetings.length !== 1 ? 's' : ''}`}
                arrow
              >
                <Box
                  sx={{
                    flex: 1,
                    p: 2,
                    textAlign: 'center',
                    borderRight: idx < 6 ? '1px solid #f5f5f5' : 'none',
                    bgcolor: isToday(day) ? 'rgba(23, 23, 23, 0.03)' : 'transparent',
                    position: 'relative',
                    transition: 'background-color 0.15s',
                    cursor: 'pointer',
                    '&:hover': {
                      bgcolor: 'action.hover',
                    },
                  }}
                >
                  <Typography variant="caption" sx={{
                    color: 'text.disabled',
                    display: 'block',
                    textTransform: 'uppercase',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    letterSpacing: '0.05em',
                    mb: 0.5,
                  }}>
                    {day.toLocaleDateString('en-US', { weekday: 'short' })}
                  </Typography>
                  <Typography
                    variant="h6"
                    sx={{
                      color: isToday(day) ? '#171717' : '#525252',
                      fontWeight: isToday(day) ? 700 : 500,
                      fontSize: '1.25rem',
                    }}
                  >
                    {day.getDate()}
                  </Typography>
                </Box>
              </Tooltip>
            );
          })}
        </Box>

        {/* Time Grid */}
        <Box
          ref={scrollContainerRef}
          sx={{ display: 'flex', maxHeight: `${DEFAULT_VIEW_HEIGHT}px`, overflow: 'auto' }}
        >
          {/* Time Labels */}
          <Box
            sx={{
              width: 80,
              flexShrink: 0,
              borderRight: 1, borderColor: 'divider',
              bgcolor: 'background.default',
            }}
          >
            {hours.map((hour) => (
              <Box
                key={hour}
                sx={{
                  height: ROW_HEIGHT,
                  p: 1,
                  borderBottom: '1px solid #f5f5f5',
                  textAlign: 'right',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                }}
              >
                <Typography variant="caption" sx={{
                  color: 'text.disabled',
                  fontSize: '0.7rem',
                  fontWeight: 500,
                  letterSpacing: '0.02em',
                }}>
                  {hour.toString().padStart(2, '0')}:00
                </Typography>
              </Box>
            ))}
          </Box>

          {/* Day Columns */}
          {weekDays.map((day, dayIdx) => (
            <Box
              key={dayIdx}
              sx={{
                flex: 1,
                position: 'relative',
                borderRight: dayIdx < 6 ? '1px solid #f5f5f5' : 'none',
                bgcolor: isToday(day) ? 'rgba(23, 23, 23, 0.02)' : '#ffffff',
                minHeight: `${totalDayHeight}px`,
              }}
            >
              {/* Hour Lines */}
            {hours.map((hour) => (
              <Box
                key={hour}
                sx={{
                  height: ROW_HEIGHT,
                  borderBottom: '1px solid #f5f5f5',
                  position: 'relative',
                  zIndex: 1,
                  '&:hover': {
                    bgcolor: 'background.default',
                  },
                }}
              />
            ))}

              {/* Current Time Indicator Line - only show on today's column */}
              {isToday(day) && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: `${getCurrentTimePosition()}px`,
                    left: 0,
                    right: 0,
                    height: '2px',
                    bgcolor: CURRENT_TIME_COLOR,
                    zIndex: 10,
                    pointerEvents: 'none',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      left: 0,
                      top: '-4px',
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      bgcolor: CURRENT_TIME_COLOR,
                    },
                  }}
                />
              )}

              {/* Meeting Cards */}
              {buildMeetingLayout(getMeetingsForDay(day), localizedMeetingInfo).map((layout, layoutIdx) => {
                const meeting = layout.meeting;
                const info = localizedMeetingInfo.get(meeting.id);
                const hourValue = getHourValue(info);
                const { top, height } = getTimeSlotPosition(hourValue, meeting.duration || 60);
                const cardHeight = Math.max(height - 6, 48);
                const widthPercent = 100 / layout.totalColumns;
                const leftPercent = layout.column * widthPercent;
                const workflowChip = getWorkflowChipProps(meeting);
                const hasPreCall = hasCompletedPreCallAnalysis(meeting);
                const hasRunningPreCall = hasRunningPreCallAnalysis(meeting);
                const hasPostCall = hasCompletedPostCallAnalysis(meeting);
                const hasProposal = hasCompletedProposal(meeting);
                const hasPptx = hasCompletedPptx(meeting);

                // Check if meeting is linked to a deal
	                const isLinkedToDeal = Boolean(meeting.deal_id || meeting.deal);

                // Count completed stages for badge positioning
                const completedBadges: Array<{ icon: React.ReactNode; color: string; label: string }> = [];
                if (isLinkedToDeal) {
                  completedBadges.push({ icon: <LinkIcon sx={{ fontSize: 10 }} />, color: 'secondary.main', label: 'Linked' });
                }
                if (hasPreCall) {
                  completedBadges.push({ icon: <AssignmentIcon sx={{ fontSize: 10 }} />, color: '#0891b2', label: 'Pre-call' });
                }
                if (hasPostCall) {
                  completedBadges.push({ icon: <DescriptionIcon sx={{ fontSize: 10 }} />, color: 'success.main', label: 'Transcript' });
                }
                if (hasProposal) {
                  completedBadges.push({ icon: <ArticleIcon sx={{ fontSize: 10 }} />, color: '#7c3aed', label: 'Proposal' });
                }
                if (hasPptx) {
                  completedBadges.push({ icon: <SlideshowIcon sx={{ fontSize: 10 }} />, color: '#ea580c', label: 'PPT' });
                }

                // Build tooltip text
                const tooltipParts = [meeting.title, getMeetingTimeRange(meeting, info)];
                if (isLinkedToDeal) tooltipParts.push(`Linked to ${meeting.deal?.opportunity_name || 'deal'}`);
                if (hasPreCall) tooltipParts.push('Pre-call ready');
                if (hasRunningPreCall && !hasPreCall) tooltipParts.push('Pre-call in progress');
                if (hasPostCall) tooltipParts.push('Transcript analysis ready');
                if (hasProposal) tooltipParts.push('Proposal ready');
                if (hasPptx) tooltipParts.push('PPT ready');

                // Get colors for this meeting's status
                const meetingColors = getMeetingCardColors(meeting, info);
                const hasBadges = completedBadges.length > 0;
                const cardBg = hasBadges ? '#fff' : meetingColors.bg;
                const cardText = hasBadges ? '#171717' : meetingColors.text;
                const cardBorderColor = hasBadges
                  ? completedBadges[completedBadges.length - 1].color
                  : hasRunningPreCall
                  ? '#d97706'
                  : meetingColors.border;

                return (
                  <Tooltip
                    key={meeting.id}
                    title={tooltipParts.join(' • ')}
                    arrow
                    placement="top"
                  >
                    <Card
                      onClick={() => handleMeetingClick(meeting)}
                      sx={{
                        position: 'absolute',
                        top: `${top}px`,
                        left: `calc(${leftPercent}% + 4px)`,
                        width: `calc(${widthPercent}% - 8px)`,
                        height: `${cardHeight}px`,
                        background: cardBg,
                        color: cardText,
                        borderRadius: 1,
                        borderColor: 'divider',
                        borderLeft: `3px solid ${cardBorderColor}`,
                        boxShadow: 'none',
                        cursor: 'pointer',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                        px: 1.5,
                        py: 1,
                        zIndex: 1,
                        transition: 'all 0.15s ease',
                        '&:hover': {
                          borderColor: 'divider',
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                          zIndex: 5,
                        },
                      }}
                    >
                      {/* Completion Badges Row - positioned at top right */}
                      {completedBadges.length > 0 && (
                        <Box
                          sx={{
                            position: 'absolute',
                            top: 3,
                            right: 3,
                            display: 'flex',
                            gap: 0.25,
                          }}
                        >
                          {completedBadges.map((badge, badgeIdx) => (
                            <Box
                              key={badgeIdx}
                              sx={{
                                width: 14,
                                height: 14,
                                borderRadius: 0.5,
                                bgcolor: `${badge.color}25`,
                                color: badge.color,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {badge.icon}
                            </Box>
                          ))}
                        </Box>
                      )}
                      {/* Pre-call Analysis Badge - Running */}
                      {hasRunningPreCall && !hasPreCall && completedBadges.length === 0 && (
                        <Box
                          sx={{
                            position: 'absolute',
                            top: 4,
                            right: 4,
                            width: 20,
                            height: 20,
                            borderRadius: '50%',
                            bgcolor: 'warning.main',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 6px rgba(245, 158, 11, 0.4)',
                          }}
                        >
                          <CircularProgress size={10} sx={{ color: '#fff' }} />
                        </Box>
                      )}
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 700,
                          fontSize: '0.95rem',
                          lineHeight: 1.3,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                        }}
                      >
                        {meeting.title}
                      </Typography>
                    </Card>
                  </Tooltip>
                );
              })}
            </Box>
          ))}
        </Box>
      </Paper>

      {/* Week Picker Popover */}
      <Popover
        open={Boolean(weekPickerAnchor)}
        anchorEl={weekPickerAnchor}
        onClose={handleCloseWeekPicker}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        slotProps={{
          paper: {
            sx: {
              mt: 1,
              borderRadius: 1.5,
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
              borderColor: 'divider',
              minWidth: 280,
              overflow: 'hidden',
            },
          },
        }}
      >
        {/* Month Header */}
        <Box
          sx={{
            px: 2,
            py: 1.5,
            background: '#171717',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <IconButton
            size="small"
            onClick={() => {
              const newDate = new Date(currentDate);
              newDate.setMonth(newDate.getMonth() - 1);
              setCurrentDate(newDate);
            }}
            sx={{ color: '#fff', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}
          >
            <ChevronLeft fontSize="small" />
          </IconButton>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </Typography>
          <IconButton
            size="small"
            onClick={() => {
              const newDate = new Date(currentDate);
              newDate.setMonth(newDate.getMonth() + 1);
              setCurrentDate(newDate);
            }}
            sx={{ color: '#fff', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}
          >
            <ChevronRight fontSize="small" />
          </IconButton>
        </Box>

        {/* Weeks List */}
        <List sx={{ py: 0.5 }}>
          {getWeeksOfMonth.map((week) => {
            const selected = isWeekSelected(week.start);
            return (
              <ListItemButton
                key={week.weekNum}
                onClick={() => handleGoToWeek(week.start)}
                sx={{
                  py: 1.25,
                  px: 2,
                  bgcolor: selected
                    ? 'rgba(23, 23, 23, 0.08)'
                    : week.isCurrentWeek
                    ? '#fafafa'
                    : 'transparent',
                  borderLeft: selected ? '3px solid #171717' : '3px solid transparent',
                  '&:hover': {
                    bgcolor: selected ? 'rgba(23, 23, 23, 0.12)' : '#f5f5f5',
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <Box
                    sx={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      bgcolor: selected ? '#171717' : week.isCurrentWeek ? '#525252' : '#e5e5e5',
                      color: selected || week.isCurrentWeek ? '#fff' : '#525252',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                    }}
                  >
                    {week.weekNum}
                  </Box>
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography
                        component="span"
                        sx={{
                          fontWeight: selected ? 600 : 500,
                          color: selected ? '#171717' : '#525252',
                          fontSize: '0.875rem',
                        }}
                      >
                        Week {week.weekNum}
                      </Typography>
                      {week.isCurrentWeek && (
                        <Box
                          component="span"
                          sx={{
                            px: 0.75,
                            py: 0.15,
                            borderRadius: 0.5,
                            bgcolor: 'text.primary',
                            color: '#fff',
                            fontSize: '0.65rem',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                          }}
                        >
                          Today
                        </Box>
                      )}
                    </Box>
                  }
                  secondary={
                    <Typography
                      component="span"
                      sx={{ fontSize: '0.75rem', color: 'text.disabled' }}
                    >
                      {formatWeekRange(week.start, week.end)}
                    </Typography>
                  }
                />
              </ListItemButton>
            );
          })}
        </List>

        {/* Quick Navigation Footer */}
        <Divider />
        <Box sx={{ p: 1.5, display: 'flex', gap: 1, justifyContent: 'center' }}>
          <Button
            size="small"
            variant="outlined"
            onClick={handleGoToThisWeek}
            startIcon={<Today sx={{ fontSize: 16 }} />}
            sx={{
              textTransform: 'none',
              fontWeight: 500,
              fontSize: '0.75rem',
              borderColor: 'divider',
              color: 'text.secondary',
              '&:hover': {
                borderColor: 'divider',
                bgcolor: 'background.default',
              },
            }}
          >
            Go to Today
          </Button>
        </Box>
      </Popover>

      {/* Meeting Context Menu */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={handleCloseSidebar}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 420 },
            bgcolor: '#FFFFFF',
            color: 'text.primary',
            borderLeft: 1, borderColor: 'divider',
            boxShadow: 'none',
            px: 3,
            pt: 5,
            pb: 3,
            top: 56,
            height: 'calc(100% - 56px)',
          },
        }}
      >
        {selectedMeeting && (
          <Stack spacing={2} sx={{ height: '100%', overflowY: 'auto' }}>
            <Box>
              <Typography variant="h6" sx={{ color: 'text.primary', fontWeight: 600 }}>
                {selectedMeeting.title}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                {selectedMeeting.company}
              </Typography>
            </Box>

            <Stack spacing={1.5} sx={{ p: 2, borderWidth: 1, borderStyle: 'solid', borderColor: 'divider', borderRadius: 1.5, bgcolor: 'background.default' }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <AccessTimeIcon sx={{ color: 'text.secondary', fontSize: 18 }} />
                <Box>
                  <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 600 }}>
                    {selectedMeetingLocalInfo?.dateLabel || selectedMeeting.displayDate || selectedMeeting.date}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block' }}>
                    {selectedMeetingLocalInfo
                      ? `${getMeetingTimeLabel(selectedMeeting, selectedMeetingLocalInfo)}`
                      : getMeetingTimeLabel(selectedMeeting)}
                  </Typography>
                </Box>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <GroupsIcon sx={{ color: 'text.secondary', fontSize: 18 }} />
                <Box>
                  <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 600 }}>
                    External Attendees
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                    {selectedMeeting.externalAttendees && selectedMeeting.externalAttendees.length > 0
                      ? selectedMeeting.externalAttendees.map((attendee) => attendee.name).join(', ')
                      : 'None listed'}
                  </Typography>
                </Box>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <LocationIcon sx={{ color: 'text.secondary', fontSize: 18 }} />
                <Box>
                  <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 600 }}>
                    Location
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                    {selectedMeeting.location || 'Not specified'}
                  </Typography>
                </Box>
              </Stack>
            </Stack>


            {meetingHasAssociation(selectedMeeting) && !associationEditing && (
              <Box
                sx={{
                  p: 2,
                  borderColor: 'divider',
                  borderRadius: 1.5,
                  bgcolor: 'background.default',
                }}
              >
                <Stack spacing={1.5}>
                  {/* Account & Deal info with Change button */}
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 600 }}>
                        {resolvedAccountName || 'Linked Account'}
                      </Typography>
                      {resolvedDealName && (
                        <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                          {resolvedDealName}
                        </Typography>
                      )}
                    </Box>
                    <Button
                      variant="text"
                      size="small"
                      onClick={() => setAssociationEditing(true)}
                      sx={{
                        textTransform: 'none',
                        fontWeight: 500,
                        fontSize: '0.75rem',
                        color: 'text.secondary',
                        minWidth: 'auto',
                        p: 0.5,
                        '&:hover': {
                          background: 'transparent',
                          color: 'text.primary',
                        },
                      }}
                    >
                      Change
                    </Button>
                  </Box>

                  {/* Compact Deal Progress */}
                  {selectedMeeting.deal_id && (
                    <DealProgressBar
                      stage={(selectedMeeting.deal?.stage || 'prospecting') as DealStage}
                      compact
                    />
                  )}
                </Stack>
              </Box>
            )}

            {(!meetingHasAssociation(selectedMeeting) || associationEditing) && (
              <Box
                sx={{
                  p: 2,
                  borderColor: 'divider',
                  borderRadius: 1.5,
                  bgcolor: 'background.default',
                }}
              >
                <Stack spacing={1.5}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 600 }}>
                      Account & deal
                    </Typography>
                    {associationEditing && (
                      <Button
                        variant="text"
                        size="small"
                        onClick={() => setAssociationEditing(false)}
                        sx={{ textTransform: 'none', fontSize: '0.75rem', color: 'text.disabled', p: 0.5, minWidth: 'auto' }}
                      >
                        Cancel
                      </Button>
                    )}
                  </Box>

                  {/* Mode Toggle */}
                  <Stack direction="row" spacing={1}>
                    <Button
                      variant={quickSetupMode ? 'contained' : 'outlined'}
                      size="small"
                      onClick={() => setQuickSetupMode(true)}
                      sx={{
                        flex: 1,
                        textTransform: 'none',
                        fontWeight: 500,
                        fontSize: '0.75rem',
                        background: quickSetupMode ? '#171717' : 'transparent',
                        borderColor: quickSetupMode ? 'transparent' : '#e5e5e5',
                        color: quickSetupMode ? '#fff' : '#525252',
                        boxShadow: 'none',
                        '&:hover': {
                          background: quickSetupMode ? '#262626' : '#f5f5f5',
                          boxShadow: 'none',
                        },
                      }}
                    >
                      Quick Setup
                    </Button>
                    <Button
                      variant={!quickSetupMode ? 'contained' : 'outlined'}
                      size="small"
                      onClick={() => setQuickSetupMode(false)}
                      sx={{
                        flex: 1,
                        textTransform: 'none',
                        fontWeight: 500,
                        fontSize: '0.75rem',
                        background: !quickSetupMode ? '#171717' : 'transparent',
                        borderColor: !quickSetupMode ? 'transparent' : '#e5e5e5',
                        color: !quickSetupMode ? '#fff' : '#525252',
                        boxShadow: 'none',
                        '&:hover': {
                          background: !quickSetupMode ? '#262626' : '#f5f5f5',
                          boxShadow: 'none',
                        },
                      }}
                    >
                      Manual Select
                    </Button>
                  </Stack>

                  {/* Quick Setup Wizard */}
                  {quickSetupMode && (
                    <QuickSetupWizard
                      meeting={selectedMeeting}
                      accounts={accounts}
                      onComplete={async (result) => {
                        // Build a complete CalendarDeal object from the result
                        const dealForMeeting: CalendarDeal = {
                          deal_id: result.deal.deal_id,
                          opportunity_name: result.deal.opportunity_name,
                          company_name: result.account.name,
                          stage: 'prospecting',
                          progress_percentage: 10,
                          status: 'active',
                        };
                        // Update the meeting in the store with new association
                        updateMeeting(selectedMeeting.id, {
                          accountId: result.account.account_id,
                          accountName: result.account.name,
                          deal_id: result.deal.deal_id,
                          deal: dealForMeeting,
                        });
                        // Refresh accounts + account detail so the new account/deal appears immediately in the UI
                        await fetchAccounts();
                        await fetchAccountDetail(result.account.account_id, true).catch(() => undefined);
                        // Refresh meetings to get latest data
                        await fetchMeetings({ force: true });
                        // Reset states
                        setQuickSetupMode(false);
                        setAssociationEditing(false);
                        setAssociationStatus({
                          type: 'success',
                          message: `Created and linked to ${result.account.name} / ${result.deal.opportunity_name}`,
                        });
                      }}
                      onCancel={() => {
                        setQuickSetupMode(false);
                      }}
                    />
                  )}

                  {/* Manual Selection */}
                  {!quickSetupMode && (
                    <>
                      {accountsLoading && accounts.length === 0 ? (
                        <Stack direction="row" spacing={1} alignItems="center">
                          <CircularProgress size={16} />
                          <Typography variant="caption" color="text.secondary">
                            Loading accounts…
                          </Typography>
                        </Stack>
                      ) : accounts.length === 0 ? (
                        <Alert severity="info" sx={{ mb: 0 }}>
                          No accounts yet. Use Quick Setup to create one, or visit the Accounts workspace.
                        </Alert>
                      ) : (
                        <>
                          <FormControl fullWidth size="small">
                            <InputLabel id="calendar-account-select-label">Account</InputLabel>
                            <Select
                              labelId="calendar-account-select-label"
                              label="Account"
                              value={associationAccountId}
                              onChange={(event) => {
                                const value = event.target.value as string;
                                setAssociationAccountId(value);
                                setAssociationDealId('');
                                setAccountTouched(true);
                                // Reset create deal state when account changes
                                setIsCreatingNewDeal(false);
                                setNewDealName('');
                                setCreateDealError(null);
                              }}
                            >
                              <MenuItem value="">
                                <em>Unassigned</em>
                              </MenuItem>
                              {accounts.map((account) => (
                                <MenuItem key={account.account_id} value={account.account_id}>
                                  {account.name}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                          <FormControl
                            fullWidth
                            size="small"
                            disabled={!associationAccountId || accountDetailLoading}
                          >
                            <InputLabel id="calendar-deal-select-label">Deal</InputLabel>
                            <Select
                              labelId="calendar-deal-select-label"
                              label="Deal"
                              value={isCreatingNewDeal ? CREATE_NEW_DEAL_VALUE : associationDealId}
                              onChange={(event) => handleDealSelectChange(event.target.value as string)}
                            >
                              <MenuItem value="">
                                <em>Not linked to a deal</em>
                              </MenuItem>
                              <Divider />
                              <MenuItem value={CREATE_NEW_DEAL_VALUE}>
                                <Stack direction="row" spacing={1} alignItems="center">
                                  <AddIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                                  <Typography variant="body2" color="primary">
                                    Create new deal
                                  </Typography>
                                </Stack>
                              </MenuItem>
                              {dealsForSelectedAccount.length > 0 && <Divider />}
                              {dealsForSelectedAccount.map((deal) => (
                                <MenuItem key={deal.deal_id} value={deal.deal_id}>
                                  {deal.opportunity_name}
                                </MenuItem>
                              ))}
                            </Select>
                            {accountDetailLoading && (
                              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                                <CircularProgress size={14} />
                                <Typography variant="caption" color="text.secondary">
                                  Loading deals…
                                </Typography>
                              </Stack>
                            )}
                            {associationAccountId && !associationDealId && !isCreatingNewDeal && dealTouched && (
                              <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                                Select a deal for this meeting.
                              </Typography>
                            )}
                          </FormControl>

                          {/* New deal creation form */}
                          {isCreatingNewDeal && (
                            <Box
                              sx={{
                                p: 2,
                                bgcolor: 'rgba(37, 99, 235, 0.04)',
                                borderRadius: 1,
                                border: '1px solid rgba(37, 99, 235, 0.2)',
                              }}
                            >
                              <Typography variant="subtitle2" sx={{ mb: 1.5, color: 'primary.main' }}>
                                Create New Deal
                              </Typography>
                              <Stack spacing={2}>
                                <TextField
                                  label="Deal Name"
                                  value={newDealName}
                                  onChange={(e) => setNewDealName(e.target.value)}
                                  fullWidth
                                  size="small"
                                  placeholder="e.g., Acme Corp Q1 Engagement"
                                  autoFocus
                                />
                                {createDealError && (
                                  <Alert severity="error" sx={{ py: 0 }}>
                                    {createDealError}
                                  </Alert>
                                )}
                                <Stack direction="row" spacing={1} justifyContent="flex-end">
                                  <Button
                                    size="small"
                                    onClick={() => {
                                      setIsCreatingNewDeal(false);
                                      setNewDealName('');
                                      setCreateDealError(null);
                                    }}
                                    disabled={createDealLoading}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    variant="contained"
                                    size="small"
                                    onClick={handleCreateDeal}
                                    disabled={createDealLoading || !newDealName.trim()}
                                    startIcon={createDealLoading ? <CircularProgress size={16} /> : <AddIcon />}
                                  >
                                    {createDealLoading ? 'Creating...' : 'Create Deal'}
                                  </Button>
                                </Stack>
                              </Stack>
                            </Box>
                          )}
                        </>
                      )}
                      {associationStatus && (
                        <Alert severity={associationStatus.type} sx={{ mb: 0 }}>
                          {associationStatus.message}
                        </Alert>
                      )}
                      <Stack direction="row" spacing={1}>
                        <Button
                          variant="contained"
                          size="small"
                          onClick={handleAssociationSave}
                          disabled={associationSaving || !onUpdateAssociation || isCreatingNewDeal || createDealLoading}
                          sx={{ bgcolor: 'text.primary', '&:hover': { bgcolor: '#262626' } }}
                        >
                          {associationSaving ? 'Saving…' : 'Save'}
                        </Button>
                        <Button
                          variant="text"
                          size="small"
                          onClick={handleAssociationClear}
                          disabled={associationSaving || !onUpdateAssociation || createDealLoading}
                          sx={{ color: 'text.disabled' }}
                        >
                          Clear
                        </Button>
                      </Stack>
                    </>
                  )}
                </Stack>
              </Box>
            )}

            {analysisInProgress && (
              <MeetingFlowProgressBar
                meeting={selectedMeeting}
                compact
                onCancelled={() => fetchMeetings({ force: true }).catch(() => undefined)}
              />
            )}

            {/* Show InlinePreCallAnalysis for upcoming meetings OR past meetings with running pre-call (hide when completed) */}
            {((!isPastMeeting(selectedMeeting) &&
               !selectedMeeting.analysisSummary?.preCall?.some(pc => pc.status === 'completed')) ||
              selectedMeeting.analysisSummary?.preCall?.some(pc => pc.status === 'running')) && (
              <InlinePreCallAnalysis
                meeting={selectedMeeting}
                onAnalysisComplete={() => {
                  // Optionally refresh meeting data
                }}
                onError={(errorMsg) => {
                  if (onAnalysisError) {
                    onAnalysisError(errorMsg);
                  }
                }}
              />
            )}

            {/* For past meetings, also show post-call workflow options */}
            {isPastMeeting(selectedMeeting) && onRunWorkflow && (
              (() => {
                const workflowState = getWorkflowStageState(selectedMeeting);
                if (workflowState.allComplete) {
                  return (
                    <Alert severity="success">All analyses are complete for this meeting.</Alert>
                  );
                }
                if (analysisInProgress) {
                  return null;
                }
                return (
                  <>
                    {workflowState.onlyTranscriptComplete && (
                      <Alert severity="info">
                        Transcript analysis complete. Continue with solution proposal or generate PPT.
                      </Alert>
                    )}
                    <AnalysisChecklist
                      meeting={selectedMeeting}
                      onRun={async ({ stages, transcriptText }) => {
                        await onRunWorkflow(selectedMeeting, { stages, transcriptText });
                        handleCloseSidebar();
                      }}
                      loading={workflowLoadingId === selectedMeeting.id}
                      error={
                        workflowError?.id === selectedMeeting.id ? workflowError?.message || null : null
                      }
                      availableStages={workflowState.stageAvailability}
                      initialSelection={workflowState.stageInitialSelection}
                      completedStages={workflowState.completedStages}
                      disabledReason={pipelineLockReason}
                      disableRun={Boolean(pipelineLockReason)}
                    />
                  </>
                );
              })()
            )}

            <Stack
              direction={hasCompletedPreCallAnalysis(selectedMeeting) ? 'column' : 'row'}
              spacing={1.5}
              justifyContent="center"
              sx={{ mt: 'auto', pt: 3, flexWrap: 'wrap' }}
            >
              {(hasCompletedPreCallAnalysis(selectedMeeting) || selectedMeeting.status === 'analyzed') && (
                <Button
                  variant="outlined"
                  startIcon={<ViewIcon />}
                  onClick={() => {
                    onViewDetails(selectedMeeting);
                    handleCloseSidebar();
                  }}
                  fullWidth={hasCompletedPreCallAnalysis(selectedMeeting)}
                >
                  View Analysis
                </Button>
              )}
              <Button
                variant="text"
                startIcon={<EventIcon />}
                onClick={() => {
                  onViewDetails(selectedMeeting);
                  handleCloseSidebar();
                }}
                fullWidth={hasCompletedPreCallAnalysis(selectedMeeting)}
              >
                View Meeting Details
              </Button>
            </Stack>
          </Stack>
        )}
      </Drawer>
    </Box>
  );
};

export default CalendarView;
