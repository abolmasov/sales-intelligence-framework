import { getPrismaClient } from '../config/database';
import { expandMeetingIdentifiers, MeetingIdentifiers } from './idConversion';

const prisma = getPrismaClient();

type AuthUser = {
  userId?: string;
  email?: string;
};

export const userMatchesRequestedBy = (user: AuthUser | undefined, requestedBy: string | null | undefined): boolean => {
  if (!requestedBy) return false;
  const userId = user?.userId || null;
  const email = (user?.email || '').trim().toLowerCase() || null;
  const normalizedRequestedBy = requestedBy.trim();
  if (!normalizedRequestedBy) return false;

  if (userId && normalizedRequestedBy === userId) return true;
  if (email && normalizedRequestedBy.toLowerCase() === email) return true;
  return false;
};

export async function userHasCalendarMeetingAccess(
  userId: string,
  identifiers: MeetingIdentifiers
): Promise<boolean> {
  const expanded = expandMeetingIdentifiers(identifiers);
  if (expanded.length === 0) return false;

  const match = await prisma.userCalendarMeeting.findFirst({
    where: {
      userId,
      OR: [
        { eventId: { in: expanded } },
        { onlineMeetingId: { in: expanded } },
        { icalUid: { in: expanded } },
      ],
    },
    select: { id: true },
  });

  return Boolean(match);
}

export async function getAccessibleMeetingIdsForUser(
  userId: string,
  meetingIds: string[]
): Promise<Set<string>> {
  const uniqueMeetingIds = Array.from(new Set(meetingIds.filter(Boolean)));
  if (uniqueMeetingIds.length === 0) return new Set();

  const meetings = await prisma.meeting.findMany({
    where: { meetingId: { in: uniqueMeetingIds } },
    select: {
      meetingId: true,
      calendarEventId: true,
      onlineMeetingId: true,
      icalUid: true,
    },
  });

  const meetingIdToExpandedIds = new Map<string, string[]>();
  const allIds = new Set<string>();
  for (const meeting of meetings) {
    const expanded = expandMeetingIdentifiers({
      meetingId: meeting.meetingId,
      calendarEventId: meeting.calendarEventId,
      onlineMeetingId: meeting.onlineMeetingId,
      icalUid: meeting.icalUid,
    });
    meetingIdToExpandedIds.set(meeting.meetingId, expanded);
    expanded.forEach((id) => allIds.add(id));
  }

  const allIdsList = Array.from(allIds);
  if (allIdsList.length === 0) return new Set();

  const matches = await prisma.userCalendarMeeting.findMany({
    where: {
      userId,
      OR: [
        { eventId: { in: allIdsList } },
        { onlineMeetingId: { in: allIdsList } },
        { icalUid: { in: allIdsList } },
      ],
    },
    select: {
      eventId: true,
      onlineMeetingId: true,
      icalUid: true,
    },
  });

  const accessibleIds = new Set<string>();
  for (const match of matches) {
    if (match.eventId) accessibleIds.add(match.eventId);
    if (match.onlineMeetingId) accessibleIds.add(match.onlineMeetingId);
    if (match.icalUid) accessibleIds.add(match.icalUid);
  }

  const accessibleMeetingIds = new Set<string>();
  for (const [meetingId, expanded] of meetingIdToExpandedIds.entries()) {
    if (expanded.some((id) => accessibleIds.has(id))) {
      accessibleMeetingIds.add(meetingId);
    }
  }

  return accessibleMeetingIds;
}

/**
 * Resolve access for a list of meeting identifiers that may be either:
 * - canonical Meeting.meetingId values, or
 * - raw calendar identifiers (eventId / onlineMeetingId / iCalUId).
 *
 * Returns the subset of the provided `meetingIds` that the user can access.
 */
export async function getAccessibleMeetingIdsForUserFlexible(
  userId: string,
  meetingIds: string[]
): Promise<Set<string>> {
  const uniqueMeetingIds = Array.from(new Set(meetingIds.filter(Boolean)));
  if (uniqueMeetingIds.length === 0) return new Set();

  const meetingRecords = await prisma.meeting.findMany({
    where: { meetingId: { in: uniqueMeetingIds } },
    select: {
      meetingId: true,
      calendarEventId: true,
      onlineMeetingId: true,
      icalUid: true,
    },
  });

  const meetingIdToExpandedIds = new Map<string, string[]>();
  const allIds = new Set<string>();

  const recordByMeetingId = new Map<string, { meetingId: string; calendarEventId: string | null; onlineMeetingId: string | null; icalUid: string | null }>();
  for (const record of meetingRecords) {
    recordByMeetingId.set(record.meetingId, {
      meetingId: record.meetingId,
      calendarEventId: record.calendarEventId,
      onlineMeetingId: record.onlineMeetingId,
      icalUid: record.icalUid,
    });
  }

  for (const inputMeetingId of uniqueMeetingIds) {
    const record = recordByMeetingId.get(inputMeetingId);
    const expanded = record
      ? expandMeetingIdentifiers({
          meetingId: record.meetingId,
          calendarEventId: record.calendarEventId,
          onlineMeetingId: record.onlineMeetingId,
          icalUid: record.icalUid,
        })
      : expandMeetingIdentifiers({
          meetingId: inputMeetingId,
          calendarEventId: inputMeetingId,
          onlineMeetingId: inputMeetingId,
          icalUid: inputMeetingId,
        });

    meetingIdToExpandedIds.set(inputMeetingId, expanded);
    expanded.forEach((id) => allIds.add(id));
  }

  const allIdsList = Array.from(allIds);
  if (allIdsList.length === 0) return new Set();

  const matches = await prisma.userCalendarMeeting.findMany({
    where: {
      userId,
      OR: [
        { eventId: { in: allIdsList } },
        { onlineMeetingId: { in: allIdsList } },
        { icalUid: { in: allIdsList } },
      ],
    },
    select: {
      eventId: true,
      onlineMeetingId: true,
      icalUid: true,
    },
  });

  const accessibleIds = new Set<string>();
  for (const match of matches) {
    if (match.eventId) accessibleIds.add(match.eventId);
    if (match.onlineMeetingId) accessibleIds.add(match.onlineMeetingId);
    if (match.icalUid) accessibleIds.add(match.icalUid);
  }

  const accessibleMeetingIds = new Set<string>();
  for (const [meetingId, expanded] of meetingIdToExpandedIds.entries()) {
    if (expanded.some((id) => accessibleIds.has(id))) {
      accessibleMeetingIds.add(meetingId);
    }
  }

  return accessibleMeetingIds;
}

/**
 * Checks access for a single meeting identifier which may be canonical or a raw calendar identifier.
 */
export async function userHasMeetingAccess(
  userId: string,
  meetingId: string
): Promise<boolean> {
  const trimmed = (meetingId || '').trim();
  if (!trimmed) return false;

  const meetingRecord = await prisma.meeting.findUnique({
    where: { meetingId: trimmed },
    select: {
      meetingId: true,
      calendarEventId: true,
      onlineMeetingId: true,
      icalUid: true,
    },
  });

  if (meetingRecord) {
    return userHasCalendarMeetingAccess(userId, {
      meetingId: meetingRecord.meetingId,
      calendarEventId: meetingRecord.calendarEventId,
      onlineMeetingId: meetingRecord.onlineMeetingId,
      icalUid: meetingRecord.icalUid,
    });
  }

  return userHasCalendarMeetingAccess(userId, {
    meetingId: trimmed,
    calendarEventId: trimmed,
    onlineMeetingId: trimmed,
    icalUid: trimmed,
  });
}
