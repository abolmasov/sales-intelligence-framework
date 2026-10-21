import { create } from 'zustand';
import { apiGet, apiPost } from '../utils/api';
import { formatDateTimeForUser, formatDateTimeForZone, FormattedDateTime, getUserTimeZone } from '../utils/dateTime';
import { deriveCompanyFromAttendees } from '../utils/companyDetection';
import {
  CalendarMeeting,
  MeetingSource,
  MeetingAnalysisSummary,
  MeetingAnalysisJob,
  MeetingStatus,
  CalendarDeal,
} from '../types/calendarMeeting';

// How long before cached meetings are considered stale (5 minutes)
const STALE_THRESHOLD_MS = 5 * 60 * 1000;

interface CalendarMeetingsState {
  meetings: CalendarMeeting[];
  isLoading: boolean;
  error: string | null;
  lastFetchedRange: { start: string; end: string } | null;
  lastFetchedAt: number | null; // timestamp in ms
  fetchMeetings: (options?: { pastDays?: number; futureDays?: number; force?: boolean }) => Promise<CalendarMeeting[]>;
  fetchMeetingByIdentifier: (identifier: string) => Promise<CalendarMeeting | null>;
  addMeeting: (meeting: CalendarMeeting, source?: MeetingSource) => void;
  updateMeeting: (meetingId: string, updates: Partial<CalendarMeeting>) => void;
  clearError: () => void;
  isStale: () => boolean;
  hasCachedData: () => boolean;
}

const buildRange = (options?: { pastDays?: number; futureDays?: number }) => {
  const now = new Date();
  const pastDays = typeof options?.pastDays === 'number' ? options.pastDays : 14;
  const futureDays = typeof options?.futureDays === 'number' ? options.futureDays : 14;

  const start = new Date(now);
  start.setDate(now.getDate() - pastDays);
  start.setHours(0, 0, 0, 0);

  const end = new Date(now);
  end.setDate(now.getDate() + futureDays);
  end.setHours(23, 59, 59, 999);

  return { start: start.toISOString(), end: end.toISOString() };
};

// Company name derivation is now handled by utils/companyDetection.ts
// Using deriveCompanyFromAttendees for backward compatibility

const getMeetingTimestamp = (meeting: CalendarMeeting) => {
  if (meeting.startDateTime) {
    const value = new Date(meeting.startDateTime);
    if (!Number.isNaN(value.getTime())) {
      return value.getTime();
    }
  }

  if (meeting.date && meeting.time) {
    const timestamp = new Date(`${meeting.date}T${meeting.time}`);
    if (!Number.isNaN(timestamp.getTime())) {
      return timestamp.getTime();
    }
  }

  return 0;
};

const sortMeetingsByStart = (meetings: CalendarMeeting[]) =>
  [...meetings].sort((a, b) => getMeetingTimestamp(a) - getMeetingTimestamp(b));

const normalizeAnalysisSummary = (summary: any): MeetingAnalysisSummary => {
  const preCall = Array.isArray(summary?.pre_call)
    ? summary.pre_call
        .map((entry: any) => ({
          sessionId: entry.session_id,
          status: entry.status || 'completed',
          completedAt: entry.completed_at || null,
          startedAt: entry.started_at || null,
          currentStep: entry.current_step || null,
        }))
        .filter((entry: any) => Boolean(entry.sessionId))
    : [];

  const postCall = Array.isArray(summary?.post_call)
    ? summary.post_call
        .map((entry: any) => ({
          analysisId: entry.analysis_id,
          status: entry.status || 'completed',
          analyzedAt: entry.analyzed_at || null,
          companyName: entry.company_name || null,
          meetingTitle: entry.meeting_title || null,
        }))
        .filter((entry: any) => Boolean(entry.analysisId))
    : [];

  const proposals = Array.isArray(summary?.proposals)
    ? summary.proposals
        .map((entry: any) => ({
          jobId: entry.job_id,
          status: entry.status || 'processing',
          analysisType: entry.analysis_type || 'enhanced',
          currentStep: entry.current_step || null,
          completedAt: entry.completed_at || null,
        }))
        .filter((entry: any) => Boolean(entry.jobId))
    : [];

  return {
    preCall,
    postCall,
    proposals,
  };
};

const normalizeAnalysisJob = (job: any): MeetingAnalysisJob | null => {
  if (!job) return null;
  const jobId = job.job_id || job.jobId;
  if (!jobId) return null;
  return {
    jobId,
    status: job.status || 'queued',
    transcriptStatus: job.transcript_status || job.transcriptStatus || 'pending',
    transcriptAnalysisId:
      job.transcript_analysis_id || job.transcriptAnalysisId || null,
    proposalStatus: job.proposal_status || job.proposalStatus || 'pending',
    proposalJobId: job.proposal_job_id || job.proposalJobId || null,
    pptStatus: job.ppt_status || job.pptStatus || 'pending',
    pptJobId: job.ppt_job_id || job.pptJobId || null,
    pptDownloadUrl: job.ppt_download_url || job.pptDownloadUrl || null,
    pptFileName: job.ppt_file_name || job.pptFileName || null,
    pptSlideCount:
      typeof job.ppt_slide_count === 'number'
        ? job.ppt_slide_count
        : job.pptSlideCount ?? null,
    errorMessage: job.error_message || job.errorMessage || null,
    updatedAt: job.updated_at || job.updatedAt || null,
    completedAt: job.completed_at || job.completedAt || null,
  };
};

const normalizeDeal = (deal: any): CalendarDeal | undefined => {
  if (!deal) return undefined;
  const dealId = deal.deal_id || deal.dealId;
  if (!dealId) return undefined;
  return {
    deal_id: dealId,
    opportunity_name: deal.opportunity_name || deal.opportunityName || 'Untitled Deal',
    company_name: deal.company_name || deal.companyName || '',
    stage: deal.stage || 'prospecting',
    progress_percentage:
      typeof deal.progress_percentage === 'number'
        ? deal.progress_percentage
        : Number.parseInt(deal.progressPercentage ?? '0', 10),
    estimated_value:
      typeof deal.estimated_value === 'number'
        ? deal.estimated_value
        : deal.estimatedValue ?? undefined,
    close_date: deal.close_date || deal.closeDate || undefined,
    status: deal.status || 'active',
    priority: deal.priority || undefined,
    win_themes: Array.isArray(deal.win_themes)
      ? deal.win_themes
      : deal.winThemes
      ? JSON.parse(deal.winThemes)
      : [],
    story: deal.story || undefined,
  };
};

export const normalizeGraphMeeting = (meeting: any): CalendarMeeting => {
  const meetingDate = meeting.meeting_date ? new Date(meeting.meeting_date) : null;
  const meetingTimeZone =
    meeting.time_zone ||
    meeting.time_zone_label ||
    meeting.timeZone ||
    meeting.timeZoneLabel ||
    getUserTimeZone();

  // Use server-provided display values (already formatted in user's timezone)
  const serverDisplayDate = meeting.display_date || meeting.displayDate;
  const serverDisplayTime = meeting.display_time || meeting.displayTime;

  // Use server-provided pre-calculated values for calendar positioning
  // These are already computed in the user's timezone by the backend
  const serverHour24 = meeting.user_hour24;
  const serverMinute = meeting.user_minute;
  const serverIsoDate = meeting.user_iso_date;

  // Build isoDate and isoTime from server values if available, otherwise fallback
  let isoDate: string;
  let isoTime: string;
  let timeZoneShort: string;

  if (serverHour24 != null && serverMinute != null && serverIsoDate) {
    // Use server-provided values (already in user's timezone)
    isoDate = serverIsoDate;
    isoTime = `${String(serverHour24).padStart(2, '0')}:${String(serverMinute).padStart(2, '0')}`;
    timeZoneShort = meeting.time_zone_label || meetingTimeZone;
  } else {
    // Fallback to client-side calculation
    const formatted = formatDateTimeForZone(meetingDate, meetingTimeZone);
    isoDate = formatted.isoDate;
    isoTime = formatted.isoTime;
    timeZoneShort = formatted.timeZoneShort;
  }

  // Prefer server-formatted display values for consistent timezone handling
  const finalDisplayDate = serverDisplayDate || isoDate;
  const finalDisplayTime = serverDisplayTime || isoTime;
  const internal = Array.isArray(meeting.internal_attendees) ? meeting.internal_attendees : [];
  const external = Array.isArray(meeting.external_attendees) ? meeting.external_attendees : [];
  const combined = [...internal, ...external];

  const now = new Date();
  let status: MeetingStatus =
    meetingDate && meetingDate < now ? 'completed' : 'scheduled';
  const durationRaw = typeof meeting.duration_minutes === 'number'
    ? meeting.duration_minutes
    : Number.parseInt(meeting.duration_minutes ?? '0', 10);
  const eventId = meeting.event_id || meeting.meeting_id || null;
  const onlineMeetingId = meeting.online_meeting_id || meeting.onlineMeetingId || null;
  const icalUid = meeting.ical_uid || meeting.icalUid || null;
  const primaryId = onlineMeetingId || eventId || meeting.meeting_id || crypto.randomUUID();
  const analysisSummary = normalizeAnalysisSummary(meeting.analysis_summary);
  const jobStatus = (meeting.analysis_job?.status || '').toString().toLowerCase();
  const transcriptStatus = (meeting.analysis_job?.transcript_status || '').toString().toLowerCase();

  if (jobStatus === 'running' || jobStatus === 'queued') {
    status = 'analyzing';
  } else if (transcriptStatus === 'running' || transcriptStatus === 'queued') {
    status = 'analyzing';
  } else if (
    (analysisSummary.postCall.length > 0 || analysisSummary.proposals.length > 0) &&
    status === 'completed'
  ) {
    status = 'analyzed';
  }
  const latestPreCallSessionId =
    analysisSummary.preCall.length > 0 ? analysisSummary.preCall[0].sessionId : undefined;
  const normalizedDeal = normalizeDeal(meeting.deal);
  const accountId =
    meeting.account_id ||
    meeting.accountId ||
    meeting.account?.account_id ||
    meeting.account?.accountId ||
    null;
  const accountName = meeting.account?.name || meeting.account_name || null;

  return {
    id: primaryId,
    eventId,
    onlineMeetingId,
    icalUid,
    title: meeting.title || 'Untitled Meeting',
    company: meeting.company || deriveCompanyFromAttendees(external),
    date: isoDate,
    time: isoTime,
    displayDate: finalDisplayDate,
    displayTime: finalDisplayTime,
    duration: Number.isFinite(durationRaw) && durationRaw > 0 ? durationRaw : 60,
    attendees: combined,
    internalAttendees: internal,
    externalAttendees: external,
    purpose: meeting.notes || 'Teams meeting',
    status,
    isFromTeams: true,
    analysisSummary,
    analysisJob: normalizeAnalysisJob(meeting.analysis_job),
    analysisSessionId: latestPreCallSessionId,
    transcriptAvailable: Boolean(meeting.transcript_available),
    location: meeting.location || null,
    joinUrl: meeting.online_meeting_url || null,
    startDateTime: meeting.meeting_date || null,
    source: 'graph',
    deal_id: meeting.deal_id || meeting.dealId || normalizedDeal?.deal_id,
    deal: normalizedDeal,
    accountId: accountId || null,
    accountName: accountName || (accountId ? meeting.company : null),
    timeZoneLabel: meeting.time_zone_label || meeting.time_zone || timeZoneShort,
    notes: meeting.notes || null,
  };
};

export const useCalendarMeetingsStore = create<CalendarMeetingsState>((set, get) => ({
  meetings: [],
  isLoading: false,
  error: null,
  lastFetchedRange: null,
  lastFetchedAt: null,

  // Check if cached data is stale (older than STALE_THRESHOLD_MS)
  isStale: () => {
    const { lastFetchedAt } = get();
    if (!lastFetchedAt) return true;
    return Date.now() - lastFetchedAt > STALE_THRESHOLD_MS;
  },

  // Check if we have valid cached data
  hasCachedData: () => {
    const { meetings, lastFetchedAt } = get();
    return meetings.length > 0 && lastFetchedAt !== null;
  },

  fetchMeetings: async (options) => {
    const { isLoading, hasCachedData, isStale } = get();

    // Skip fetch if already loading
    if (isLoading) {
      return get().meetings;
    }

    // Skip fetch if we have fresh cached data (unless force is true)
    if (!options?.force && hasCachedData() && !isStale()) {
      return get().meetings;
    }

    set({ isLoading: true, error: null });

    const range = buildRange(options);

    try {
      // Include user's timezone for proper date/time display formatting
      const userTimeZone = getUserTimeZone();
      const params = new URLSearchParams({
        start_date: range.start,
        end_date: range.end,
        user_timezone: userTimeZone,
      });
      if (options?.force) {
        params.set('refresh', 'true');
      }

      const data = await apiPost(`/api/calendar/meetings/sync?${params.toString()}`, {
        user_timezone: userTimeZone,
        refresh: Boolean(options?.force),
      });

      if (data.error) {
        throw new Error(data.error);
      }

      const mapped = Array.isArray(data.meetings) ? data.meetings.map(normalizeGraphMeeting) : [];

      const manualMeetings = get().meetings.filter((m) => m.source === 'manual');

      set({
        meetings: sortMeetingsByStart([...mapped, ...manualMeetings]),
        isLoading: false,
        lastFetchedRange: range,
        lastFetchedAt: Date.now(),
      });

      return mapped;
    } catch (error: any) {
      const message = error?.message || 'Failed to fetch meetings';
      set({ error: message, isLoading: false });
      throw new Error(message);
    }
  },

  fetchMeetingByIdentifier: async (identifier: string) => {
    const normalized = (identifier || '').trim();
    if (!normalized) {
      return null;
    }

    set({ isLoading: true, error: null });
    try {
      const payload = await apiGet(`/api/meetings/lookup/${encodeURIComponent(normalized)}`);
      const meetingRaw = payload?.meeting;
      if (!meetingRaw) {
        throw new Error(payload?.error || 'Meeting not found');
      }
      const mapped = normalizeGraphMeeting(meetingRaw);

      set((state) => {
        const existingIndex = state.meetings.findIndex(
          (m) =>
            m.id === mapped.id ||
            (mapped.eventId && m.eventId === mapped.eventId) ||
            (mapped.onlineMeetingId && m.onlineMeetingId === mapped.onlineMeetingId) ||
            (mapped.icalUid && m.icalUid === mapped.icalUid)
        );
        if (existingIndex === -1) {
          return {
            meetings: sortMeetingsByStart([...state.meetings, mapped]),
            isLoading: false,
          };
        }
        const next = [...state.meetings];
        next[existingIndex] = { ...next[existingIndex], ...mapped };
        return { meetings: sortMeetingsByStart(next), isLoading: false };
      });

      return mapped;
    } catch (error: any) {
      const message = error?.message || 'Failed to load meeting';
      set({ error: message, isLoading: false });
      return null;
    }
  },

  addMeeting: (meeting, source = 'manual') => {
    const internal = meeting.internalAttendees || [];
    const external = meeting.externalAttendees || [];
    const attendees = meeting.attendees || [...internal, ...external];
    let formatted: FormattedDateTime | null = null;
    if ((!meeting.displayDate || !meeting.displayTime || !meeting.timeZoneLabel) && meeting.startDateTime) {
      formatted = formatDateTimeForUser(new Date(meeting.startDateTime));
    }

    set((state) => ({
      meetings: [
        ...state.meetings,
        {
          ...meeting,
          eventId: meeting.eventId || null,
          onlineMeetingId: meeting.onlineMeetingId ?? null,
          icalUid: meeting.icalUid ?? null,
          attendees,
          internalAttendees: internal,
          externalAttendees: external,
          analysisJob: meeting.analysisJob || null,
          accountId: meeting.accountId ?? null,
          accountName: meeting.accountName ?? null,
          deal_id: meeting.deal_id ?? (meeting as any).dealId ?? null,
          deal: meeting.deal || undefined,
          displayDate: meeting.displayDate || formatted?.dateLabel || null,
          displayTime: meeting.displayTime || formatted?.timeLabel || null,
          timeZoneLabel: meeting.timeZoneLabel || formatted?.timeZoneShort || null,
          source,
        },
      ],
    }));
  },

  updateMeeting: (meetingId, updates) => {
    set((state) => {
      const target = state.meetings.find((meeting) => meeting.id === meetingId) || null;
      const linkedOnlineId = target?.onlineMeetingId || null;
      const linkedIcalUid = target?.icalUid || null;
      const linkedEventId = target?.eventId || null;

      return {
        meetings: state.meetings.map((meeting) => {
          const matchesTarget =
            meeting.id === meetingId ||
            (linkedOnlineId && meeting.onlineMeetingId === linkedOnlineId) ||
            (linkedIcalUid && meeting.icalUid === linkedIcalUid) ||
            (linkedEventId && meeting.eventId === linkedEventId);
          return matchesTarget ? { ...meeting, ...updates } : meeting;
        }),
      };
    });
  },

  clearError: () => set({ error: null }),
}));
