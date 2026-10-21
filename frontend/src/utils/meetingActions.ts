import { NavigateFunction } from 'react-router-dom';
import { apiCall } from './api';
import type { CalendarMeeting } from '../types/calendarMeeting';

export const isInternalAttendee = (email?: string) => {
  if (!email) return false;
  return /@(northstar\.example|example\.com)$/i.test(email.trim());
};

const GENERIC_EMAIL_DOMAINS = new Set([
  'gmail',
  'yahoo',
  'outlook',
  'hotmail',
  'icloud',
  'me',
  'msn',
  'live',
  'aol',
  'protonmail',
  'hey',
]);

export const deriveCompanyFromAttendeeEmails = (attendeeList: Array<{ email?: string | null }>) => {
  const domainCounts = new Map<string, number>();

  attendeeList.forEach((attendee) => {
    const email = attendee.email?.toLowerCase().trim();
    if (!email || isInternalAttendee(email)) {
      return;
    }

    const domainPart = email.split('@')[1];
    if (!domainPart) return;

    const domainRoot = domainPart.split('.')[0];
    if (!domainRoot || GENERIC_EMAIL_DOMAINS.has(domainRoot)) {
      return;
    }

    domainCounts.set(domainRoot, (domainCounts.get(domainRoot) || 0) + 1);
  });

  if (!domainCounts.size) {
    return null;
  }

  const [bestDomain] = Array.from(domainCounts.entries()).sort((a, b) => b[1] - a[1]);
  if (!bestDomain) return null;

  return bestDomain[0]
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
};

export const buildMeetingStartDateTime = (meeting: CalendarMeeting) =>
  meeting.startDateTime || (meeting.date && meeting.time ? `${meeting.date}T${meeting.time}` : undefined);

export const getSharedMeetingIdentifier = (meeting: CalendarMeeting) =>
  meeting.onlineMeetingId || meeting.icalUid || meeting.eventId || meeting.id || null;

export const getCalendarEventIdentifier = (meeting: CalendarMeeting) =>
  meeting.eventId || meeting.id || null;

export const getTranscriptLookupIdentifier = (meeting: CalendarMeeting) =>
  meeting.onlineMeetingId || meeting.eventId || meeting.id || null;

const navigateToPostCall = (
  navigate: NavigateFunction,
  payload: {
    transcript?: string;
    company?: string;
    meetingTitle?: string;
    meetingDate?: string;
    message?: string;
    meetingId?: string;
  }
) => {
  navigate('/app/analysis/postcall', {
    state: {
      postCallData: payload,
    },
  });
};

export const runPreCallAnalysis = (
  meeting: CalendarMeeting,
  navigate: NavigateFunction,
  options?: {
    companyName?: string;
    meetingContext?: string;
    externalAttendees?: Array<{ name: string; email?: string; role?: string; company?: string }>;
  }
) => {
  const params = new URLSearchParams();

  const externalAttendees =
    options?.externalAttendees && options.externalAttendees.length > 0
      ? options.externalAttendees
      : meeting.externalAttendees && meeting.externalAttendees.length > 0
        ? meeting.externalAttendees
        : (meeting.attendees || []).filter((attendee) => !isInternalAttendee(attendee.email));

  if (externalAttendees.length > 0) {
    params.set('attendees', JSON.stringify(externalAttendees));
  }

  const companyToUse = options?.companyName || meeting.company || deriveCompanyFromAttendeeEmails(externalAttendees) || '';
  if (companyToUse) {
    params.set('company', companyToUse);
  }

  if (meeting.purpose) {
    params.set('purpose', meeting.purpose);
  }

  if (options?.meetingContext) {
    params.set('meetingContext', options.meetingContext);
  }

  const linkedMeetingId = getSharedMeetingIdentifier(meeting);
  if (linkedMeetingId) {
    params.set('meetingId', linkedMeetingId);
  }

  const queryString = params.toString();
  navigate(queryString ? `/app/analysis?${queryString}` : '/app/analysis');
};

interface PostCallOptions {
  navigate: NavigateFunction;
  setError?: (value: string | null) => void;
  setLoadingId?: (value: string | null) => void;
}

export const runPostCallAnalysis = async (
  meeting: CalendarMeeting,
  options: PostCallOptions
) => {
  const { navigate, setError, setLoadingId } = options;

  const linkedMeetingId = getSharedMeetingIdentifier(meeting) || undefined;
  const transcriptLookupId = getTranscriptLookupIdentifier(meeting);

  if (meeting.transcriptAvailable && transcriptLookupId) {
    setLoadingId?.(meeting.id);
    try {
      const response = await apiCall(`/api/calendar/meetings/${transcriptLookupId}/transcript`);

      if (response.status === 404) {
        navigateToPostCall(navigate, {
          company: meeting.company,
          meetingTitle: meeting.title,
          meetingDate: buildMeetingStartDateTime(meeting),
          message: 'Transcript not available from Teams. Upload one to continue the analysis.',
          meetingId: linkedMeetingId,
        });
        setLoadingId?.(null);
        return;
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch transcript (status ${response.status})`);
      }

      const data = await response.json();

      navigateToPostCall(navigate, {
        transcript: data.transcript,
        company: meeting.company,
        meetingTitle: meeting.title,
        meetingDate: buildMeetingStartDateTime(meeting),
        meetingId: linkedMeetingId,
      });
    } catch (err: any) {
      console.error('Post-call analysis error:', err);
      setError?.(
        err instanceof Error ? err.message : 'Failed to fetch meeting transcript.'
      );
      throw err;
    } finally {
      setLoadingId?.(null);
    }
    return;
  }

  navigateToPostCall(navigate, {
    company: meeting.company,
    meetingTitle: meeting.title,
    meetingDate: buildMeetingStartDateTime(meeting),
    message: 'Upload a transcript to run post-call analysis.',
    meetingId: linkedMeetingId,
  });
};

export const fetchTranscriptFromTeams = async (meeting: CalendarMeeting): Promise<string> => {
  const transcriptId = getTranscriptLookupIdentifier(meeting);
  if (!transcriptId) {
    throw new Error('Meeting does not have a Teams online meeting identifier.');
  }

  try {
    const response = await apiCall(`/api/calendar/meetings/${transcriptId}/transcript`);
    if (response.status === 404) {
      throw new Error('Teams transcript not available. Upload a transcript to continue.');
    }
    if (!response.ok) {
      throw new Error(`Failed to fetch Teams transcript (status ${response.status})`);
    }
    const data = await response.json();
    return data.transcript as string;
  } catch (error: any) {
    throw new Error(error instanceof Error ? error.message : 'Failed to fetch Teams transcript.');
  }
};

export const openProposalGenerator = (
  meeting: CalendarMeeting,
  navigate: NavigateFunction,
  setError?: (value: string | null) => void
) => {
  const meetingId = getSharedMeetingIdentifier(meeting);
  if (!meetingId) {
    setError?.('Unable to determine meeting ID for solution proposal generation.');
    return;
  }
  navigate(`/app/rfp-sow-generator?meetingId=${encodeURIComponent(meetingId)}`);
};

export const openProposalJob = (meeting: CalendarMeeting, navigate: NavigateFunction) => {
  const latestProposal = meeting.analysisSummary?.proposals?.[0];
  if (!latestProposal) return;
  const jobId = (latestProposal as any).jobId || (latestProposal as any).job_id;
  if (!jobId) return;
  navigate(`/app/rfp-sow-generator?jobId=${jobId}`);
};

export const openPptGenerator = (meeting: CalendarMeeting, navigate: NavigateFunction) => {
  const meetingId = getSharedMeetingIdentifier(meeting);
  const query = meetingId ? `?meetingId=${encodeURIComponent(meetingId)}` : '';
  navigate(`/app/ppt-generator${query}`);
};
