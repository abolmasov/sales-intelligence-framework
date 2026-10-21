/**
 * Date/time utilities shared across calendar features
 */

import type { CalendarMeeting } from '../types/calendarMeeting';

export interface FormattedDateTime {
  isoDate: string;
  isoTime: string;
  dateLabel: string;
  timeLabel: string;
  timeZoneShort: string;
  hour24: number;
  minute: number;
}

export type TimeZoneSource = 'system' | 'location';

const USER_TZ_KEY = 'sales-assistant:userTimeZone';
const USER_TZ_SOURCE_KEY = 'sales-assistant:userTimeZoneSource';

const detectSystemTimeZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

export const getSystemTimeZone = (): string => detectSystemTimeZone();

const readStorage = (key: string): string | null => {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeStorage = (key: string, value: string) => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore storage failures (e.g., Safari private mode)
  }
};

export const getStoredUserTimeZone = (): string | null => readStorage(USER_TZ_KEY);

export const setStoredUserTimeZone = (timeZone: string, source: TimeZoneSource = 'system') => {
  writeStorage(USER_TZ_KEY, timeZone);
  writeStorage(USER_TZ_SOURCE_KEY, source);
};

export const clearStoredUserTimeZone = () => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(USER_TZ_KEY);
    window.localStorage.removeItem(USER_TZ_SOURCE_KEY);
  } catch {
    // ignore
  }
};

export const getUserTimeZoneSource = (): TimeZoneSource => {
  const stored = readStorage(USER_TZ_SOURCE_KEY);
  return stored === 'location' ? 'location' : 'system';
};

export const getUserTimeZone = (): string => getStoredUserTimeZone() || detectSystemTimeZone();

export const formatDateTimeForZone = (date: Date | null, timeZone: string): FormattedDateTime => {
  if (!date || Number.isNaN(date.getTime())) {
    return {
      isoDate: '2025-01-01',
      isoTime: '00:00',
      dateLabel: 'Jan 01, 2025',
      timeLabel: '00:00',
      timeZoneShort: timeZone,
      hour24: 0,
      minute: 0,
    };
  }

  const displayDateFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const displayTimeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  });

  const tzFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  const tzParts = tzFormatter.formatToParts(date);
  const timeZoneShort = tzParts.find((part) => part.type === 'timeZoneName')?.value || timeZone;

  const isoFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const isoParts = isoFormatter.formatToParts(date);
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    isoParts.find((part) => part.type === type)?.value || '';

  const year = getPart('year') || '2025';
  const month = getPart('month') || '01';
  const day = getPart('day') || '01';
  const hours = getPart('hour') || '00';
  const minutes = getPart('minute') || '00';
  const hourValue = Number.parseInt(hours, 10) || 0;
  const minuteValue = Number.parseInt(minutes, 10) || 0;

  return {
    isoDate: `${year}-${month}-${day}`,
    isoTime: `${hours}:${minutes}`,
    dateLabel: displayDateFormatter.format(date),
    timeLabel: displayTimeFormatter.format(date),
    timeZoneShort,
    hour24: hourValue,
    minute: minuteValue,
  };
};

export const formatDateTimeForUser = (date: Date | null): FormattedDateTime =>
  formatDateTimeForZone(date, getUserTimeZone());

/**
 * Legacy helper kept for backwards compatibility when PST is explicitly needed.
 */
export const formatDateTimePST = (date: Date | null): FormattedDateTime =>
  formatDateTimeForZone(date, 'America/Los_Angeles');

const getMeetingDateObject = (meeting: Pick<CalendarMeeting, 'startDateTime' | 'date' | 'time'>): Date | null => {
  if (meeting.startDateTime) {
    const fromStart = new Date(meeting.startDateTime);
    if (!Number.isNaN(fromStart.getTime())) {
      return fromStart;
    }
  }

  if (meeting.date) {
    const isoCandidate = meeting.time ? `${meeting.date}T${meeting.time}` : meeting.date;
    const fromDate = new Date(isoCandidate);
    if (!Number.isNaN(fromDate.getTime())) {
      return fromDate;
    }
  }

  return null;
};

/**
 * Format meeting datetime for a specific timezone.
 * If the meeting has pre-calculated date/time fields (from server), use those directly
 * to avoid timezone conversion issues.
 */
export const formatMeetingForTimeZone = (
  meeting: Pick<CalendarMeeting, 'startDateTime' | 'date' | 'time'>,
  timeZone: string
): FormattedDateTime => {
  // If meeting has pre-calculated date/time (from server), parse and use those directly
  // These are already in the user's timezone, so we can extract hour/minute without conversion
  if (meeting.date && meeting.time) {
    const [hourStr, minStr] = meeting.time.split(':');
    const hour24 = Number.parseInt(hourStr, 10) || 0;
    const minute = Number.parseInt(minStr, 10) || 0;

    // Parse date parts
    const [year, month, day] = meeting.date.split('-');

    // Create a display-friendly date label
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthIndex = Number.parseInt(month, 10) - 1;
    const dateLabel = `${monthNames[monthIndex] || 'Jan'} ${Number.parseInt(day, 10)}, ${year}`;

    // Create time label (12-hour format)
    const hour12 = hour24 % 12 || 12;
    const ampm = hour24 >= 12 ? 'PM' : 'AM';
    const timeLabel = `${hour12}:${minStr} ${ampm}`;

    // Get timezone abbreviation
    let timeZoneShort = timeZone;
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        timeZoneName: 'short',
      });
      const parts = formatter.formatToParts(new Date());
      const tzPart = parts.find((p) => p.type === 'timeZoneName');
      if (tzPart) timeZoneShort = tzPart.value;
    } catch {
      // ignore
    }

    return {
      isoDate: meeting.date,
      isoTime: meeting.time,
      dateLabel,
      timeLabel,
      timeZoneShort,
      hour24,
      minute,
    };
  }

  // Fallback to standard conversion for meetings without pre-calculated values
  return formatDateTimeForZone(getMeetingDateObject(meeting), timeZone);
};

