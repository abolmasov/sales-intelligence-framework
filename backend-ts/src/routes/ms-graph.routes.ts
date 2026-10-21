import { Router, Request, Response } from 'express';
import { getMSGraphService } from '../services/ms-graph.service';
import { getPrismaClient } from '../config/database';
import { DateTime } from 'luxon';
import { createPptxSignedUrl } from '../services/pptxStorage.service';
import { hexToBase64, base64ToHex } from '../utils/idConversion';
import { userTokens as authUserTokens } from './auth.routes';
import { authMiddleware } from '../middleware/auth';
import { AccountService } from '../services/account.service';

const router = Router();
const msGraphService = getMSGraphService();
const prisma = getPrismaClient();

const userTokens: Record<string, any> = authUserTokens;

const WINDOWS_TO_IANA: Record<string, string> = {
  'UTC': 'UTC',
  'GMT Standard Time': 'Europe/London',
  'Greenwich Standard Time': 'Atlantic/Reykjavik',
  'Pacific Standard Time': 'America/Los_Angeles',
  'Pacific Daylight Time': 'America/Los_Angeles',
  'Mountain Standard Time': 'America/Denver',
  'Mountain Daylight Time': 'America/Denver',
  'Central Standard Time': 'America/Chicago',
  'Central Daylight Time': 'America/Chicago',
  'Eastern Standard Time': 'America/New_York',
  'Eastern Daylight Time': 'America/New_York',
  'India Standard Time': 'Asia/Kolkata',
  'China Standard Time': 'Asia/Shanghai',
  'Tokyo Standard Time': 'Asia/Tokyo',
  'Singapore Standard Time': 'Asia/Singapore',
  'Central Europe Standard Time': 'Europe/Berlin',
  'W. Europe Standard Time': 'Europe/Paris',
  'Romance Standard Time': 'Europe/Madrid',
  'AUS Eastern Standard Time': 'Australia/Sydney',
  'New Zealand Standard Time': 'Pacific/Auckland',
};

const resolveIanaFromWindows = (windowsZone?: string | null) => {
  if (!windowsZone) return null;
  return WINDOWS_TO_IANA[windowsZone] || null;
};

router.get('/me/photo', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const tokenBundle = userTokens[userId];
    if (!tokenBundle?.access_token) {
      return res.status(401).json({ error: 'Not authenticated with Microsoft' });
    }

    try {
      const photoBuffer = await msGraphService.getUserPhoto(tokenBundle.access_token);
      const base64 = photoBuffer.toString('base64');
      return res.json({ success: true, photo: `data:image/jpeg;base64,${base64}` });
    } catch (error: any) {
      const status = error instanceof Error && error.message.includes('not found') ? 404 : 500;
      return res.status(status).json({ error: error instanceof Error ? error.message : 'Failed to fetch photo' });
    }
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch user photo' });
  }
});

const ensureValidIanaZone = (zone?: string | null) => {
  if (!zone) return 'UTC';
  try {
    const probe = DateTime.now().setZone(zone);
    return probe.isValid ? zone : 'UTC';
  } catch {
    return 'UTC';
  }
};

const coerceBooleanParam = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'y';
};

const formatMeetingInUserTimezone = (meetingUtcIso: string, userTimezone: string) => {
  const utcDt = DateTime.fromISO(meetingUtcIso, { zone: 'utc' });
  const userDt = utcDt.setZone(userTimezone);

  return {
    displayDate: userDt.toFormat('MMM dd, yyyy'),
    displayTime: userDt.toFormat('h:mm a'),
    userTimeZoneLabel: userDt.toFormat('ZZZZ'),
    userHour24: userDt.hour,
    userMinute: userDt.minute,
    userIsoDate: userDt.toFormat('yyyy-MM-dd'),
  };
};

type MeetingAnalysisSummary = {
  pre_call: Array<{
    session_id: string;
    status: string;
    completed_at: string | null;
    started_at: string | null;
    current_step: string | null;
  }>;
  post_call: Array<{
    analysis_id: string;
    status: string;
    analyzed_at: string | null;
    company_name: string | null;
    meeting_title: string | null;
  }>;
  proposals: Array<{
    job_id: string;
    status: string;
    analysis_type: string;
    current_step: string | null;
    completed_at: string | null;
  }>;
};

const EMPTY_ANALYSIS_SUMMARY: MeetingAnalysisSummary = {
  pre_call: [],
  post_call: [],
  proposals: [],
};

const safeJsonParse = <T>(value?: string | null): T | null => {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

const serializeAnalysisJob = async (job: any) => {
  const pptMetadata = safeJsonParse<Record<string, any>>(job.pptJob?.metadata);
  const pptStats = safeJsonParse<Record<string, any>>(job.pptJob?.stats);
  let pptDownloadUrl: string | null = null;
  if (job.pptJob?.outputFile) {
    try {
      pptDownloadUrl = await createPptxSignedUrl(job.pptJob.outputFile);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[ms-graph] Failed to create PPT download URL for job ${job.jobId}: ${message}`);
    }
  }
  return {
    job_id: job.jobId,
    status: job.status,
    transcript_status: job.transcriptStatus,
    transcript_analysis_id: job.transcriptAnalysisId || null,
    proposal_status: job.proposalStatus,
    proposal_job_id: job.proposalJobId || null,
    ppt_status: job.pptStatus,
    ppt_job_id: job.pptJobId,
    ppt_download_url: pptDownloadUrl,
    ppt_file_name: pptMetadata?.filename || pptStats?.title || null,
    ppt_slide_count: job.pptJob?.slideCount ?? null,
    error_message: job.errorMessage,
    updated_at: job.updatedAt?.toISOString?.() || null,
    completed_at: job.completedAt?.toISOString?.() || null,
  };
};

// ID conversion functions now imported from ../utils/idConversion

async function buildMeetingAnalysisSummaries(meetingIds: string[]): Promise<Record<string, MeetingAnalysisSummary>> {
  if (!meetingIds.length) {
    return {};
  }

  const uniqueMeetingIds = Array.from(new Set(meetingIds.filter((id) => Boolean(id))));
  if (!uniqueMeetingIds.length) {
    return {};
  }

  // Look up Meeting records to find canonical IDs and create mappings
  const meetingRecords = await prisma.meeting.findMany({
    where: {
      OR: [
        { meetingId: { in: uniqueMeetingIds } },
        { calendarEventId: { in: uniqueMeetingIds } },
        { onlineMeetingId: { in: uniqueMeetingIds } },
        { icalUid: { in: uniqueMeetingIds } },
      ],
    },
    select: {
      meetingId: true,
      calendarEventId: true,
      onlineMeetingId: true,
      icalUid: true,
    },
  });

  // Collect all possible IDs to search for analyses:
  // 1. The original meetingIds passed in (calendar event IDs, online meeting IDs, iCal UIDs)
  // 2. The canonical meetingIds from the Meeting table
  // 3. Converted versions (hex <-> base64) to handle format mismatches
  const allPossibleIds = new Set(uniqueMeetingIds);

  // Add converted formats for each ID (hex to base64 and vice versa)
  const addWithConversions = (id: string | null | undefined) => {
    if (!id) return;
    allPossibleIds.add(id);
    // Try hex to base64 conversion
    const asBase64 = hexToBase64(id);
    if (asBase64) allPossibleIds.add(asBase64);
    // Try base64 to hex conversion
    const asHex = base64ToHex(id);
    if (asHex) allPossibleIds.add(asHex);
  };

  // Add all original IDs with conversions
  uniqueMeetingIds.forEach(addWithConversions);

  // Add IDs from Meeting records with conversions
  meetingRecords.forEach((record: any) => {
    addWithConversions(record.meetingId);
    addWithConversions(record.calendarEventId);
    addWithConversions(record.onlineMeetingId);
    addWithConversions(record.icalUid);
  });

  const allIdsArray = Array.from(allPossibleIds);

  // Query analyses using ALL possible identifiers
  // Analysis records may store meetingId as iCal UID, calendar event ID, or other formats
  const [preCallAnalyses, postCallAnalyses, proposalJobs] = await Promise.all([
    prisma.analysis.findMany({
      where: {
        meetingId: { in: allIdsArray },
      },
      select: {
        sessionId: true,
        meetingId: true,
        status: true,
        completedAt: true,
        startedAt: true,
        currentStep: true,
      },
      orderBy: [
        { completedAt: 'desc' },
        { startedAt: 'desc' },
      ],
    }),
    prisma.transcriptAnalysis.findMany({
      where: {
        meetingId: { in: allIdsArray },
      },
      select: {
        analysisId: true,
        meetingId: true,
        status: true,
        analyzedAt: true,
        companyName: true,
        meetingTitle: true,
      },
      orderBy: { analyzedAt: 'desc' },
    }),
    prisma.proposalJob.findMany({
      where: {
        meetingId: { in: allIdsArray },
      },
      select: {
        jobId: true,
        meetingId: true,
        status: true,
        analysisType: true,
        currentStep: true,
        completedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const summaryMap: Record<string, MeetingAnalysisSummary> = {};
  const ensureSummary = (meetingId: string): MeetingAnalysisSummary => {
    if (!summaryMap[meetingId]) {
      summaryMap[meetingId] = {
        pre_call: [],
        post_call: [],
        proposals: [],
      };
    }
    return summaryMap[meetingId];
  };

  for (const analysis of preCallAnalyses) {
    if (!analysis.meetingId) continue;
    const bucket = ensureSummary(analysis.meetingId);
    const normalizedStatus = analysis.status === 'in_progress' ? 'running' : analysis.status;
    bucket.pre_call.push({
      session_id: analysis.sessionId,
      status: normalizedStatus,
      completed_at: analysis.completedAt ? analysis.completedAt.toISOString() : null,
      started_at: analysis.startedAt ? analysis.startedAt.toISOString() : null,
      current_step: analysis.currentStep || null,
    });
  }

  for (const analysis of postCallAnalyses) {
    if (!analysis.meetingId) continue;
    const bucket = ensureSummary(analysis.meetingId);
    bucket.post_call.push({
      analysis_id: analysis.analysisId,
      status: analysis.status || 'completed',
      analyzed_at: analysis.analyzedAt ? analysis.analyzedAt.toISOString() : null,
      company_name: analysis.companyName || null,
      meeting_title: analysis.meetingTitle || null,
    });
  }

  for (const job of proposalJobs) {
    if (!job.meetingId) continue;
    const bucket = ensureSummary(job.meetingId);
    bucket.proposals.push({
      job_id: job.jobId,
      status: job.status,
      analysis_type: job.analysisType,
      current_step: job.currentStep || null,
      completed_at: job.completedAt ? job.completedAt.toISOString() : null,
    });
  }

  // Build the final mapping from all identifiers to summaries
  const identifierSummaryMap: Record<string, MeetingAnalysisSummary> = {};

  // Helper to map an identifier and its conversions to a summary
  const mapWithConversions = (id: string | null | undefined, summary: MeetingAnalysisSummary) => {
    if (!id) return;
    identifierSummaryMap[id] = summary;
    const asBase64 = hexToBase64(id);
    if (asBase64) identifierSummaryMap[asBase64] = summary;
    const asHex = base64ToHex(id);
    if (asHex) identifierSummaryMap[asHex] = summary;
  };

  // First, map all analysis meetingIds directly to their summaries (with conversions)
  Object.keys(summaryMap).forEach((meetingId) => {
    mapWithConversions(meetingId, summaryMap[meetingId]);
  });

  // Then, create mappings from Meeting table records
  // This allows looking up by calendarEventId, onlineMeetingId, etc.
  meetingRecords.forEach((record: any) => {
    // Find which summary matches this meeting record (check all formats)
    const allRecordIds = [record.meetingId, record.calendarEventId, record.onlineMeetingId, record.icalUid]
      .filter((id): id is string => Boolean(id));

    // Also check converted versions
    const allRecordIdsWithConversions = new Set(allRecordIds);
    allRecordIds.forEach((id) => {
      const asBase64 = hexToBase64(id);
      if (asBase64) allRecordIdsWithConversions.add(asBase64);
      const asHex = base64ToHex(id);
      if (asHex) allRecordIdsWithConversions.add(asHex);
    });

    const matchingMeetingId = Array.from(allRecordIdsWithConversions).find((id) => summaryMap[id]);

    if (matchingMeetingId) {
      const summary = summaryMap[matchingMeetingId];
      // Map all identifiers for this meeting to the same summary (with conversions)
      allRecordIds.forEach((identifier) => mapWithConversions(identifier, summary));
    }
  });

  return identifierSummaryMap;
}

const resolveAccessToken = (req: Request): string => {
  if (req.user?.accessToken) {
    return req.user.accessToken;
  }

  const authorization = req.headers.authorization;
  if (authorization && authorization.toLowerCase().startsWith('bearer ')) {
    return authorization.substring(7).trim();
  }

  throw new Error('Missing or invalid authorization token');
};

/**
 * GET /api/calendar/events
 * Get Teams calendar events for the authenticated user
 * Requires: Authorization: Bearer {access_token}
 */
router.get('/calendar/events', async (req: Request, res: Response) => {
  try {
    const accessToken = resolveAccessToken(req);

    const startDate =
      (req.query.start_date as string | undefined) ||
      new Date().toISOString();
    const endDate =
      (req.query.end_date as string | undefined) ||
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const top = req.query.top ? parseInt(req.query.top as string, 10) : 50;

    console.log('📅 Fetching calendar events...');

    const events = await msGraphService.getCalendarEvents(
      accessToken,
      startDate,
      endDate,
      top
    );

    res.json({
      value: events,
      count: events.length,
    });
  } catch (error) {
    console.error('❌ Error fetching calendar events:', error);
    res.status(error instanceof Error && error.message.includes('authorization') ? 401 : 500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch calendar events',
    });
  }
});

/**
 * GET /api/calendar/events/:eventId
 * Get details for a specific calendar event
 * Requires: Authorization: Bearer {access_token}
 */
router.get('/calendar/events/:eventId', async (req: Request, res: Response) => {
  try {
    const accessToken = resolveAccessToken(req);
    const { eventId } = req.params;

    console.log(`📅 Fetching event details for ${eventId}...`);

    const event = await msGraphService.getEventDetails(accessToken, eventId);

    res.json(event);
  } catch (error) {
    console.error('❌ Error fetching event details:', error);
    res.status(error instanceof Error && error.message.includes('authorization') ? 401 : 500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch event details',
    });
  }
});

/**
 * GET /api/calendar/meetings/parsed
 * Get Teams meetings parsed for sales intelligence analysis
 * Returns meetings in the format ready for the research form
 * Requires: Authorization: Bearer {access_token}
 */
router.get('/calendar/meetings/parsed', async (req: Request, res: Response) => {
  try {
    const accessToken = resolveAccessToken(req);

    const startDate =
      (req.query.start_date as string | undefined) ||
      new Date().toISOString();
    const endDate =
      (req.query.end_date as string | undefined) ||
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    console.log('📊 Fetching and parsing meetings for sales intelligence...');

    // Get raw calendar events
    const events = await msGraphService.getCalendarEvents(
      accessToken,
      startDate,
      endDate
    );

    // Parse each event for analysis
    const parsedMeetings = [];
    for (const event of events) {
      // Only include events with attendees (likely customer meetings)
      if (event.attendees && event.attendees.length > 0) {
        const parsed = msGraphService.parseMeetingForAnalysis(event);
        parsedMeetings.push(parsed);
      }
    }

    res.json({
      meetings: parsedMeetings,
      count: parsedMeetings.length,
    });
  } catch (error) {
    console.error('❌ Error parsing meetings:', error);
    res.status(error instanceof Error && error.message.includes('authorization') ? 401 : 500).json({
      error: error instanceof Error ? error.message : 'Failed to parse meetings',
    });
  }
});

/**
 * POST /api/email/send
 * Send email via Outlook
 * Requires: Authorization: Bearer {access_token}
 * Body: { to: string[], subject: string, body: string, isHtml?: boolean }
 */
router.post('/email/send', async (req: Request, res: Response) => {
  try {
    const accessToken = resolveAccessToken(req);

    const { to, subject, body, isHtml = true } = req.body;

    if (!to || !Array.isArray(to) || to.length === 0) {
      return res.status(400).json({
        error: 'Recipients (to) must be a non-empty array of email addresses',
      });
    }

    if (!subject || typeof subject !== 'string') {
      return res.status(400).json({
        error: 'Subject is required and must be a string',
      });
    }

    if (!body || typeof body !== 'string') {
      return res.status(400).json({
        error: 'Body is required and must be a string',
      });
    }

    console.log(`📧 Sending email to ${to.join(', ')}...`);

    await msGraphService.sendEmail(accessToken, to, subject, body, isHtml);

    return res.json({
      success: true,
      message: 'Email sent successfully',
      to,
      subject,
    });
  } catch (error) {
    console.error('❌ Error sending email:', error);
    return res.status(error instanceof Error && error.message.includes('authorization') ? 401 : 500).json({
      error: error instanceof Error ? error.message : 'Failed to send email',
    });
  }
});

/**
 * POST /api/email/test
 * Test sending email with current user's access token
 * Simple test to verify email permissions are working
 * Requires: Authorization: Bearer {access_token}
 */
router.post('/email/test', async (req: Request, res: Response) => {
  try {
    const accessToken = resolveAccessToken(req);

    console.log('🧪 Testing email sending...');

    // Get user info first to see who we're sending from
    const userInfo = await msGraphService.getUserInfo(accessToken);
    const userEmail = userInfo.mail || userInfo.userPrincipalName;

    // Simple test email
    const testRecipient = process.env.DEMO_MAIL_RECIPIENT || 'demo.user@example.com';
    const subject = 'Test Email from Sales Intelligence Platform';
    const body = 'This is a test email to verify the Microsoft Graph email API is working correctly.\n\nIf you received this, the integration is successful!';

    await msGraphService.sendEmail(accessToken, [testRecipient], subject, body, false);

    res.json({
      success: true,
      message: 'Test email sent successfully',
      from: userEmail,
      to: testRecipient,
    });
  } catch (error) {
    console.error('❌ Error sending test email:', error);
    res.status(error instanceof Error && error.message.includes('authorization') ? 401 : 500).json({
      error: error instanceof Error ? error.message : 'Failed to send test email',
    });
  }
});

/**
 * POST /api/calendar/events
 * Create a calendar event (Teams meeting)
 * Requires: Authorization: Bearer {access_token}
 * Body: {
 *   subject: string,
 *   startTime: string (ISO),
 *   endTime: string (ISO),
 *   attendees: string[],
 *   body?: string,
 *   location?: string,
 *   isTeamsMeeting?: boolean
 * }
 */
router.post('/calendar/events', async (req: Request, res: Response) => {
  try {
    const accessToken = resolveAccessToken(req);

    const {
      subject,
      startTime,
      endTime,
      attendees,
      body = '',
      location,
      isTeamsMeeting = true,
    } = req.body;

    // Validation
    if (!subject || typeof subject !== 'string') {
      return res.status(400).json({ error: 'Subject is required and must be a string' });
    }

    if (!startTime || !endTime) {
      return res.status(400).json({ error: 'Start time and end time are required' });
    }

    if (!attendees || !Array.isArray(attendees) || attendees.length === 0) {
      return res.status(400).json({ error: 'Attendees must be a non-empty array of email addresses' });
    }

    console.log(`📅 Creating calendar event: ${subject}...`);

    const event = await msGraphService.createCalendarEvent(
      accessToken,
      subject,
      new Date(startTime),
      new Date(endTime),
      attendees,
      body,
      location,
      isTeamsMeeting
    );

    return res.json({
      success: true,
      event,
    });
  } catch (error) {
    console.error('❌ Error creating calendar event:', error);
    return res.status(error instanceof Error && error.message.includes('authorization') ? 401 : 500).json({
      error: error instanceof Error ? error.message : 'Failed to create calendar event',
    });
  }
});

/**
 * POST /api/calendar/meetings/sync
 * Sync Teams calendar meetings to database
 * Fetches meetings from Microsoft Graph and saves/updates them in the database
 * Requires: Authorization: Bearer {access_token}
 * Query params: start_date, end_date, top (limit), refresh (force Graph fetch)
 */
router.post('/calendar/meetings/sync', async (req: Request, res: Response) => {
  try {
    const accessToken = resolveAccessToken(req);
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Missing authenticated user id' });
    }

    // Ensure the user exists in the database before sinking calendar events
    // This prevents foreign key constraint errors if the database is reset while
    // the user still holds a valid JWT session cookie.
    await prisma.user.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        username: req.user?.email || userId,
        email: req.user?.email || null,
      },
    });

    const startDate = req.query.start_date as string | undefined;
    const endDate = req.query.end_date as string | undefined;
    const requestedPast = req.query.past_days ? parseInt(req.query.past_days as string, 10) : NaN;
    const requestedFuture = req.query.future_days ? parseInt(req.query.future_days as string, 10) : NaN;
    const pastDays = Number.isFinite(requestedPast) && requestedPast > 0 ? requestedPast : 15;
    const futureDays = Number.isFinite(requestedFuture) && requestedFuture > 0 ? requestedFuture : 15;
    const requestedTop = req.query.top ? parseInt(req.query.top as string, 10) : NaN;
    const top = Number.isFinite(requestedTop) && requestedTop > 0 ? requestedTop : 200;
    const refresh = coerceBooleanParam(req.query.refresh) || coerceBooleanParam(req.query.force) || Boolean(req.body?.refresh);

    // Accept user's timezone from query param or request body for proper display formatting
    const userTimezoneParam = (req.query.user_timezone as string) || req.body?.user_timezone;
    const userTimezone = ensureValidIanaZone(userTimezoneParam) || 'UTC';

    const now = DateTime.now().setZone(userTimezone);
    const rangeStart = startDate || now.minus({ days: pastDays }).startOf('day').toISO() || new Date().toISOString();
    const rangeEnd = endDate || now.plus({ days: futureDays }).endOf('day').toISO() || new Date().toISOString();

    console.log('🔄 Fetching Teams calendar meetings...');
    console.log(`   • User timezone param: "${userTimezoneParam}" → resolved: "${userTimezone}"`);
    console.log(`   • Range: ${rangeStart} → ${rangeEnd}`);
    console.log(`   • Refresh requested: ${refresh ? 'yes' : 'no'}`);

    const rangeStartUtc = DateTime.fromISO(rangeStart).toUTC().toJSDate();
    const rangeEndUtc = DateTime.fromISO(rangeEnd).toUTC().toJSDate();

    const cachedMeetings = await prisma.userCalendarMeeting.findMany({
      where: {
        userId,
        startUtc: {
          gte: rangeStartUtc,
          lte: rangeEndUtc,
        },
      },
      orderBy: { startUtc: 'asc' },
    });

    if (!refresh && cachedMeetings.length > 0) {
      console.log(`   • Using cached meetings: ${cachedMeetings.length}`);
    }

    let events: any[] = [];
    if (refresh || cachedMeetings.length === 0) {
      console.log('   • Fetching from Microsoft Graph...');
      try {
        events = await msGraphService.getCalendarEvents(accessToken, rangeStart, rangeEnd, top);
      } catch (error) {
        if (cachedMeetings.length > 0) {
          console.warn('   ⚠️ Graph fetch failed; falling back to cached meetings.', error);
          events = [];
        } else {
          throw error;
        }
      }
    }

    const mappedMeetings: any[] = [];

    if (!refresh && cachedMeetings.length > 0) {
      for (const record of cachedMeetings) {
        const meetingUtcIso = DateTime.fromJSDate(record.startUtc).toUTC().toISO() || record.startUtc.toISOString();
        const formatted = formatMeetingInUserTimezone(meetingUtcIso, userTimezone);

        let durationMinutes: number | null = null;
        if (record.endUtc) {
          const endUtcIso = DateTime.fromJSDate(record.endUtc).toUTC().toISO() || record.endUtc.toISOString();
          durationMinutes = Math.floor(DateTime.fromISO(endUtcIso).diff(DateTime.fromISO(meetingUtcIso), 'minutes').minutes);
        }

        mappedMeetings.push({
          event_id: record.eventId,
          online_meeting_id: record.onlineMeetingId || null,
          ical_uid: record.icalUid || null,
          time_zone: userTimezone,
          time_zone_label: formatted.userTimeZoneLabel || userTimezone,
          original_time_zone: record.originalTimeZone || 'UTC',
          title: record.subject || 'Untitled Meeting',
          meeting_date: meetingUtcIso,
          display_date: formatted.displayDate,
          display_time: formatted.displayTime,
          user_hour24: formatted.userHour24,
          user_minute: formatted.userMinute,
          user_iso_date: formatted.userIsoDate,
          duration_minutes: durationMinutes,
          internal_attendees: record.internalAttendees || [],
          external_attendees: record.externalAttendees || [],
          notes: record.bodyPreview || null,
          transcript_available: Boolean(record.transcriptAvailable),
          location: record.location || null,
          online_meeting_url: record.joinUrl || null,
          is_cancelled: Boolean(record.isCancelled),
        });
      }
    } else {
      for (const event of events) {
      const eventId = event.id;
      const onlineMeetingId = event.onlineMeeting?.id || null;
      const icalUid = event.iCalUId || null;

      const internalAttendees: any[] = [];
      const externalAttendees: any[] = [];

      if (event.attendees?.length > 0) {
        for (const attendee of event.attendees) {
          const emailAddress = attendee.emailAddress;
          const email = (emailAddress.address || '').trim();
          if (!email) {
            continue;
          }
          const attendeeInfo = {
            name: emailAddress.name,
            email,
          };

          const emailLower = email.toLowerCase();
          const isInternal =
            emailLower.includes('@example.com') || emailLower.endsWith('.internal');
          if (isInternal) {
            internalAttendees.push(attendeeInfo);
            continue;
          }

          // Ignore consumer Gmail attendees so they are not surfaced in pre-call analysis attendee lists.
          if (emailLower.endsWith('@gmail.com')) {
            continue;
          }

          externalAttendees.push(attendeeInfo);
        }
      }

      // Microsoft Graph API: event.start.timeZone is the timezone the dateTime is expressed in
      // event.originalStartTimeZone is the timezone the meeting was originally created in
      // We should parse the dateTime using event.start.timeZone (the format it's expressed in)
      const eventStartTimezone = event.start?.timeZone || 'UTC';
      const eventStartIanaCandidate = resolveIanaFromWindows(eventStartTimezone) || eventStartTimezone;
      const ianaTimezone = ensureValidIanaZone(eventStartIanaCandidate);

      let meetingDate: Date | null = null;

      if (event.start?.dateTime) {
        try {
          const dt = DateTime.fromISO(event.start.dateTime, { zone: ianaTimezone });
          meetingDate = dt.toJSDate();
        } catch {
          meetingDate = new Date(event.start.dateTime);
        }
      }

      let durationMinutes: number | null = null;
      if (event.start?.dateTime && event.end?.dateTime) {
        try {
          const start = DateTime.fromISO(event.start.dateTime, { zone: ianaTimezone });
          const end = DateTime.fromISO(event.end.dateTime, { zone: ianaTimezone });
          durationMinutes = Math.floor(end.diff(start, 'minutes').minutes);
        } catch {
          durationMinutes = null;
        }
      }

      const title = event.subject || 'Untitled Meeting';
      const notes = event.bodyPreview || null;

      let transcript_available = false;
      const transcriptLookupId = onlineMeetingId || eventId;
      if (transcriptLookupId && meetingDate && meetingDate < new Date()) {
        transcript_available = await msGraphService.checkTranscript(accessToken, transcriptLookupId);
      }

      // Format display date/time in user's timezone
      let displayDate: string | null = null;
      let displayTime: string | null = null;
      let userTimeZoneLabel: string | null = null;
      let meetingDateISO: string | null = null;
      // Also provide hour/minute in user's timezone for calendar positioning
      let userHour24: number | null = null;
      let userMinute: number | null = null;
      let userIsoDate: string | null = null;

      if (event.start?.dateTime) {
        // Parse the event datetime in its original timezone, then convert to user's timezone
        const originalDt = DateTime.fromISO(event.start.dateTime, { zone: ianaTimezone });
        const userDt = originalDt.setZone(userTimezone);

        displayDate = userDt.toFormat('MMM dd, yyyy'); // e.g., "Dec 15, 2025"
        displayTime = userDt.toFormat('h:mm a'); // e.g., "2:30 PM"
        userTimeZoneLabel = userDt.toFormat('ZZZZ'); // e.g., "IST" or "PST"

        // Return UTC ISO string so frontend Date parsing works correctly
        meetingDateISO = originalDt.toUTC().toISO(); // UTC ISO string

        // Provide pre-calculated hour/minute in user's timezone for calendar grid positioning
        userHour24 = userDt.hour;
        userMinute = userDt.minute;
        userIsoDate = userDt.toFormat('yyyy-MM-dd'); // Date in user's timezone for day matching
      } else if (meetingDate) {
        // Fallback for any edge cases
        const userDt = DateTime.fromJSDate(meetingDate).setZone(userTimezone);
        displayDate = userDt.toFormat('MMM dd, yyyy');
        displayTime = userDt.toFormat('h:mm a');
        userTimeZoneLabel = userDt.toFormat('ZZZZ');
        meetingDateISO = DateTime.fromJSDate(meetingDate).toUTC().toISO();
        userHour24 = userDt.hour;
        userMinute = userDt.minute;
        userIsoDate = userDt.toFormat('yyyy-MM-dd');
      }

      // Debug log for first meeting
      if (mappedMeetings.length === 0) {
        console.log(`   📅 First meeting debug:`);
        console.log(`      Title: ${title}`);
        console.log(`      event.start.dateTime: ${event.start?.dateTime}`);
        console.log(`      event.start.timeZone: ${event.start?.timeZone}`);
        console.log(`      event.originalStartTimeZone: ${event.originalStartTimeZone}`);
        console.log(`      Parsed with TZ: ${ianaTimezone}`);
        console.log(`      User TZ: ${userTimezone}`);
        console.log(`      user_hour24: ${userHour24}, user_minute: ${userMinute}`);
        console.log(`      user_iso_date: ${userIsoDate}`);
        console.log(`      display_time: ${displayTime}`);
      }

      mappedMeetings.push({
        event_id: eventId,
        online_meeting_id: onlineMeetingId,
        ical_uid: icalUid,
        time_zone: userTimezone, // Use user's timezone as the primary timezone
        time_zone_label: userTimeZoneLabel || userTimezone,
        original_time_zone: ianaTimezone, // Keep original event timezone for reference
        title,
        meeting_date: meetingDateISO,
        display_date: displayDate,
        display_time: displayTime,
        // Pre-calculated values in user's timezone for calendar grid positioning
        user_hour24: userHour24,
        user_minute: userMinute,
        user_iso_date: userIsoDate, // Date string in user's timezone (YYYY-MM-DD)
        duration_minutes: durationMinutes,
        internal_attendees: internalAttendees,
        external_attendees: externalAttendees,
        notes,
        transcript_available,
        location: event.location?.displayName || null,
        online_meeting_url: event.onlineMeeting?.joinUrl || null,
        is_cancelled: Boolean(event.isCancelled),
      });

      // Persist/refresh cached copy keyed by userId + eventId
      if (meetingDateISO) {
        const startUtc = DateTime.fromISO(meetingDateISO, { zone: 'utc' }).toJSDate();
        let endUtc: Date | null = null;
        if (event.end?.dateTime) {
          try {
            const endDt = DateTime.fromISO(event.end.dateTime, { zone: ianaTimezone }).toUTC();
            endUtc = endDt.toJSDate();
          } catch {
            endUtc = null;
          }
        }

        await prisma.userCalendarMeeting.upsert({
          where: {
            userId_eventId: {
              userId,
              eventId,
            },
          },
          update: {
            onlineMeetingId,
            icalUid,
            subject: title,
            bodyPreview: notes,
            startUtc,
            endUtc,
            originalTimeZone: ianaTimezone,
            location: event.location?.displayName || null,
            joinUrl: event.onlineMeeting?.joinUrl || null,
            isCancelled: Boolean(event.isCancelled),
            transcriptAvailable: transcript_available,
            internalAttendees,
            externalAttendees,
            rawEvent: event,
            lastSyncedAt: new Date(),
          },
          create: {
            userId,
            eventId,
            onlineMeetingId,
            icalUid,
            subject: title,
            bodyPreview: notes,
            startUtc,
            endUtc,
            originalTimeZone: ianaTimezone,
            location: event.location?.displayName || null,
            joinUrl: event.onlineMeeting?.joinUrl || null,
            isCancelled: Boolean(event.isCancelled),
            transcriptAvailable: transcript_available,
            internalAttendees,
            externalAttendees,
            rawEvent: event,
            lastSyncedAt: new Date(),
          },
        });
      }
    }
    }

    const meetingIdsForLookup = Array.from(
      new Set(
        mappedMeetings
          .flatMap((meeting) => [meeting.event_id, meeting.online_meeting_id, meeting.ical_uid])
          .filter((id): id is string => Boolean(id))
      )
    );

    const [analysisSummaries, meetingRecords] = await Promise.all([
      buildMeetingAnalysisSummaries(meetingIdsForLookup),
      meetingIdsForLookup.length
        ? prisma.meeting.findMany({
            where: {
              OR: [
                { calendarEventId: { in: meetingIdsForLookup } },
                { onlineMeetingId: { in: meetingIdsForLookup } },
                { icalUid: { in: meetingIdsForLookup } },
              ],
            },
            select: {
              meetingId: true,
              calendarEventId: true,
              onlineMeetingId: true,
              icalUid: true,
              deal: {
                select: {
                  dealId: true,
                  opportunityName: true,
                  companyName: true,
                  stage: true,
                  progressPercentage: true,
                  estimatedValue: true,
                  closeDate: true,
                  status: true,
                  priority: true,
                  winThemes: true,
                  story: true,
                },
              },
              account: {
                select: {
                  accountId: true,
                  name: true,
                },
              },
              analysisJobs: {
                orderBy: { createdAt: 'desc' },
                take: 1,
                include: {
                  pptJob: true,
                },
              },
            },
          })
        : Promise.resolve([]),
    ]);

    const jobMap: Record<string, any> = {};
    const associationMap: Record<
      string,
      {
        account_id: string | null;
        account_name: string | null;
        account?: { account_id: string; name: string };
        deal_id: string | null;
        deal?: {
          deal_id: string;
          opportunity_name: string;
          company_name: string;
          stage: string;
          progress_percentage: number;
          estimated_value: number | null;
          close_date: Date | null;
          status: string;
          priority: string | null;
          win_themes: string | null;
          story: string | null;
        };
      }
    > = {};
    for (const record of meetingRecords) {
      const identifiers = [record.meetingId, record.calendarEventId, record.onlineMeetingId, record.icalUid].filter(
        (id): id is string => Boolean(id)
      );

      // Always populate association data (deal/account) regardless of analysis job
      const associationPayload = {
        account_id: record.account?.accountId || null,
        account_name: record.account?.name || null,
        account: record.account
          ? {
              account_id: record.account.accountId,
              name: record.account.name,
            }
          : undefined,
        deal_id: record.deal?.dealId || null,
        deal: record.deal
          ? {
              deal_id: record.deal.dealId,
              opportunity_name: record.deal.opportunityName,
              company_name: record.deal.companyName,
              stage: record.deal.stage,
              progress_percentage: record.deal.progressPercentage,
              estimated_value: record.deal.estimatedValue ?? null,
              close_date: record.deal.closeDate ?? null,
              status: record.deal.status,
              priority: record.deal.priority || null,
              win_themes: record.deal.winThemes || null,
              story: record.deal.story || null,
            }
          : undefined,
      };
      identifiers.forEach((identifier) => {
        associationMap[identifier] = associationPayload;
      });

      // Only process analysis job if it exists
      const job = record.analysisJobs[0];
      if (job) {
        const serialized = await serializeAnalysisJob(job);
        identifiers.forEach((identifier) => {
          jobMap[identifier] = serialized;
        });
      }
    }

    // Auto-link meetings to accounts based on external attendee domains
    // Only links to EXISTING accounts (does not create new ones)
    const allAccounts = await prisma.account.findMany({
      select: { accountId: true, name: true, domain: true },
    });
    const domainToAccount = new Map<string, { accountId: string; name: string }>();
    for (const acct of allAccounts) {
      if (acct.domain) {
        domainToAccount.set(acct.domain.toLowerCase(), { accountId: acct.accountId, name: acct.name });
      }
    }

    for (const meeting of mappedMeetings) {
      const meetingIds = [meeting.event_id, meeting.online_meeting_id, meeting.ical_uid].filter(Boolean);
      const existingAssociation = meetingIds.find((id) => id && associationMap[id]);
      if (existingAssociation && associationMap[existingAssociation]?.account_id) {
        continue; // Already linked to an account
      }

      // Try to match external attendee domains to existing accounts
      const externals = (meeting as any).external_attendees as Array<{ email?: string }> | undefined;
      if (!externals?.length) continue;

      let matchedAccount: { accountId: string; name: string } | null = null;
      for (const attendee of externals) {
        const email = (attendee.email || '').toLowerCase();
        const domain = email.split('@')[1];
        if (domain && domainToAccount.has(domain)) {
          matchedAccount = domainToAccount.get(domain)!;
          break;
        }
      }

      if (matchedAccount) {
        // Update the Meeting record in DB if it exists
        const meetingRecord = meetingRecords.find((r: any) =>
          meetingIds.includes(r.calendarEventId) ||
          meetingIds.includes(r.onlineMeetingId) ||
          meetingIds.includes(r.icalUid)
        );
        if (meetingRecord && !meetingRecord.account) {
          try {
            await prisma.meeting.update({
              where: { meetingId: meetingRecord.meetingId },
              data: { accountId: matchedAccount.accountId },
            });
          } catch {
            // Ignore update errors (e.g., concurrent modification)
          }
        }

        // Inject into associationMap so the response includes the link
        const payload = {
          account_id: matchedAccount.accountId,
          account_name: matchedAccount.name,
          account: {
            accountId: matchedAccount.accountId,
            account_id: matchedAccount.accountId,
            name: matchedAccount.name,
          },
          deal_id: null,
          deal: undefined,
        };
        meetingIds.forEach((id) => {
          if (id) associationMap[id] = payload as any;
        });
      }
    }

    const enrichedMeetings = mappedMeetings.map((meeting) => {
      const summary =
        (meeting.online_meeting_id && analysisSummaries[meeting.online_meeting_id]) ||
        (meeting.ical_uid && analysisSummaries[meeting.ical_uid]) ||
        (meeting.event_id && analysisSummaries[meeting.event_id]) || {
          pre_call: [],
          post_call: [],
          proposals: [],
        };
      const analysisJob =
        (meeting.online_meeting_id && jobMap[meeting.online_meeting_id]) ||
        (meeting.ical_uid && jobMap[meeting.ical_uid]) ||
        (meeting.event_id && jobMap[meeting.event_id]) ||
        null;
      const association =
        (meeting.online_meeting_id && associationMap[meeting.online_meeting_id]) ||
        (meeting.ical_uid && associationMap[meeting.ical_uid]) ||
        (meeting.event_id && associationMap[meeting.event_id]) ||
        null;
      return {
        ...meeting,
        ...(association
          ? {
              account_id: association.account_id,
              accountId: association.account_id,
              account_name: association.account_name,
              account: association.account
                ? {
                    accountId: association.account.account_id,
                    account_id: association.account.account_id,
                    name: association.account.name,
                  }
                : undefined,
              deal_id: association.deal_id,
              deal: association.deal,
            }
          : {}),
        analysis_summary: summary,
        analysis_job: analysisJob,
      };
    });

    return res.json({
      success: true,
      count: enrichedMeetings.length,
      meetings: enrichedMeetings,
    });
  } catch (error) {
    console.error('❌ Error fetching meetings:', error);
    return res.status(
      error instanceof Error && error.message.includes('authorization') ? 401 : 500
    ).json({
      error: error instanceof Error ? error.message : 'Failed to fetch meetings',
    });
  }
});

/**
 * GET /api/calendar/meetings/:meetingId/transcript
 * Fetch transcript content for a specific Teams meeting
 * Requires Authorization header with Graph token
 */
router.get('/calendar/meetings/:meetingId/transcript', async (req: Request, res: Response) => {
  try {
    const accessToken = resolveAccessToken(req);
    const { meetingId } = req.params;

    if (!meetingId) {
      return res.status(400).json({ error: 'Meeting ID is required' });
    }

    const transcripts = await msGraphService.getMeetingTranscripts(accessToken, meetingId);

    if (!transcripts || transcripts.length === 0) {
      return res.status(404).json({ error: 'No transcript available for this meeting' });
    }

    const transcript = transcripts[0];
    const content = await msGraphService.getTranscriptContent(accessToken, meetingId, transcript.id);

    return res.json({
      success: true,
      transcript: content,
      metadata: transcript,
    });
  } catch (error: any) {
    console.error('❌ Error fetching transcript:', error);
    const status = error instanceof Error && error.message.includes('authorization') ? 401 : 500;
    return res.status(status).json({
      error: error instanceof Error ? error.message : 'Failed to fetch transcript',
    });
  }
});

export default router;
