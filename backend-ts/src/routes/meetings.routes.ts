import { Router, Request, Response } from 'express';
import { getPrismaClient } from '../config/database';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { ApiResponse } from '../types';
import { randomUUID } from 'crypto';
import { createPptxSignedUrl } from '../services/pptxStorage.service';
import { userHasCalendarMeetingAccess } from '../utils/meetingAccess';
import { expandMeetingIdentifiers } from '../utils/idConversion';
import { getProactiveEmailService } from '../services/proactive-email.service';
import { MeetingService } from '../services/meeting.service';

const router = Router();
const prisma = getPrismaClient();
const proactiveEmailService = getProactiveEmailService();

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
      console.warn(`[meetings] Failed to create PPT download URL for job ${job.jobId}: ${message}`);
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

const buildAnalysisSummaryForMeetings = async (
  meetingIds: string[]
): Promise<Record<string, MeetingAnalysisSummary>> => {
  if (!Array.isArray(meetingIds) || meetingIds.length === 0) {
    return {};
  }

  const uniqueIds = Array.from(new Set(meetingIds.filter((id): id is string => Boolean(id))));
  if (!uniqueIds.length) {
    return {};
  }

  const [preCallAnalyses, postCallAnalyses, proposalJobs] = await Promise.all([
    prisma.analysis.findMany({
      where: { meetingId: { in: uniqueIds } },
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
      where: { meetingId: { in: uniqueIds } },
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
      where: { meetingId: { in: uniqueIds } },
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

  preCallAnalyses.forEach((analysis) => {
    if (!analysis.meetingId) return;
    const bucket = ensureSummary(analysis.meetingId);
    const normalizedStatus = analysis.status === 'in_progress' ? 'running' : analysis.status || 'completed';
    bucket.pre_call.push({
      session_id: analysis.sessionId,
      status: normalizedStatus,
      completed_at: analysis.completedAt ? analysis.completedAt.toISOString() : null,
      started_at: analysis.startedAt ? analysis.startedAt.toISOString() : null,
      current_step: analysis.currentStep || null,
    });
  });

  postCallAnalyses.forEach((analysis) => {
    if (!analysis.meetingId) return;
    const bucket = ensureSummary(analysis.meetingId);
    bucket.post_call.push({
      analysis_id: analysis.analysisId,
      status: analysis.status || 'completed',
      analyzed_at: analysis.analyzedAt ? analysis.analyzedAt.toISOString() : null,
      company_name: analysis.companyName || null,
      meeting_title: analysis.meetingTitle || null,
    });
  });

  proposalJobs.forEach((job) => {
    if (!job.meetingId) return;
    const bucket = ensureSummary(job.meetingId);
    bucket.proposals.push({
      job_id: job.jobId,
      status: job.status || 'completed',
      analysis_type: job.analysisType || 'enhanced',
      current_step: job.currentStep || null,
      completed_at: job.completedAt ? job.completedAt.toISOString() : null,
    });
  });

  return summaryMap;
};

/**
 * GET /api/meetings
 * List all meetings with optional filters
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const {
      dealId: dealIdCamel,
      deal_id: dealIdSnake,
      accountId: accountIdCamel,
      account_id: accountIdSnake,
    } = req.query;

    const filters: any = {};
    const requestedDealId = (dealIdCamel || dealIdSnake) as string | undefined;
    if (requestedDealId) {
      filters.dealId = requestedDealId;
    }
    const requestedAccountId = (accountIdCamel || accountIdSnake) as string | undefined;
    if (requestedAccountId) {
      filters.accountId = requestedAccountId;
    }

    const rawMeetings = await prisma.meeting.findMany({
      where: filters,
      include: {
        deal: {
          select: {
            dealId: true,
            opportunityName: true,
            companyName: true,
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
      orderBy: { meetingDate: 'desc' },
      take: 50,
    });

    const meetingIds = rawMeetings
      .map((meeting: any) => meeting.meetingId)
      .filter((id: string | null | undefined): id is string => Boolean(id));
    const analysisSummaries = await buildAnalysisSummaryForMeetings(meetingIds);

    // Parse JSON fields and map to snake_case for frontend compatibility
    const meetings = await Promise.all(
      rawMeetings.map(async (m: any) => ({
        meeting_id: m.meetingId,
        deal_id: m.dealId,
        account_id: m.accountId,
        title: m.title,
        meeting_date: m.meetingDate,
        duration_minutes: m.durationMinutes,
        internal_attendees: m.internalAttendees ? JSON.parse(m.internalAttendees) : [],
        external_attendees: m.externalAttendees ? JSON.parse(m.externalAttendees) : [],
        transcript: m.transcript,
        recording_url: m.recordingUrl,
        notes: m.notes,
        analysis_id: m.analysisId,
        key_points: m.keyPoints ? JSON.parse(m.keyPoints) : [],
        action_items: m.actionItems ? JSON.parse(m.actionItems) : [],
        calendar_event_id: m.calendarEventId,
        online_meeting_id: m.onlineMeetingId,
        ical_uid: m.icalUid,
        analysis_job: m.analysisJobs[0] ? await serializeAnalysisJob(m.analysisJobs[0]) : null,
        created_at: m.createdAt,
        updated_at: m.updatedAt,
        deal: m.deal,
        account: m.account
          ? {
              account_id: m.account.accountId,
              name: m.account.name,
            }
          : null,
        analysis_summary:
          (m.meetingId && analysisSummaries[m.meetingId]) || {
            ...EMPTY_ANALYSIS_SUMMARY,
            pre_call: [],
            post_call: [],
            proposals: [],
          },
      }))
    );

    // Return in format expected by frontend
    res.json({
      success: true,
      meetings,
    });
  })
);

/**
 * GET /api/meetings/lookup/:identifier
 * Lookup a meeting from the DB by any known identifier (meetingId/eventId/onlineMeetingId/icalUid)
 * This avoids Outlook fetches and supports page refresh deep-links.
 */
router.get(
  '/lookup/:identifier',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Missing authenticated user id', 401);
    }

    const identifier = (req.params.identifier || '').trim();
    if (!identifier) {
      throw new AppError('Meeting identifier is required', 400);
    }

    const candidates = expandMeetingIdentifiers({
      meetingId: identifier,
      calendarEventId: identifier,
      onlineMeetingId: identifier,
      icalUid: identifier,
    });
    const idList = Array.from(new Set([identifier, ...candidates].filter(Boolean)));

    const meeting = await prisma.meeting.findFirst({
      where: {
        OR: [
          { meetingId: { in: idList } },
          { calendarEventId: { in: idList } },
          { onlineMeetingId: { in: idList } },
          { icalUid: { in: idList } },
        ],
      },
      include: {
        deal: {
          select: {
            dealId: true,
            opportunityName: true,
            companyName: true,
            stage: true,
            progressPercentage: true,
            status: true,
          },
        },
        account: {
          select: {
            accountId: true,
            name: true,
            domain: true,
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
    });

    if (!meeting) {
      throw new AppError('Meeting not found', 404);
    }

    const canView = await userHasCalendarMeetingAccess(userId, {
      meetingId: meeting.meetingId,
      calendarEventId: meeting.calendarEventId,
      onlineMeetingId: meeting.onlineMeetingId,
      icalUid: meeting.icalUid,
    });
    if (!canView) {
      throw new AppError('You do not have access to this meeting.', 403);
    }

    const summaries = await buildAnalysisSummaryForMeetings([meeting.meetingId]);
    const summary = summaries[meeting.meetingId] || EMPTY_ANALYSIS_SUMMARY;

    res.json({
      success: true,
      meeting: {
        meeting_id: meeting.meetingId,
        event_id: meeting.calendarEventId || meeting.meetingId,
        online_meeting_id: meeting.onlineMeetingId,
        ical_uid: meeting.icalUid,
        title: meeting.title,
        meeting_date: meeting.meetingDate ? meeting.meetingDate.toISOString() : null,
        duration_minutes: meeting.durationMinutes ?? null,
        internal_attendees: meeting.internalAttendees ? JSON.parse(meeting.internalAttendees) : [],
        external_attendees: meeting.externalAttendees ? JSON.parse(meeting.externalAttendees) : [],
        notes: meeting.notes || null,
        transcript_available: Boolean(meeting.transcript && meeting.transcript.trim()),
        analysis_job: meeting.analysisJobs?.[0] ? await serializeAnalysisJob(meeting.analysisJobs[0]) : null,
        analysis_summary: summary,
        deal_id: meeting.dealId || null,
        account_id: meeting.accountId || null,
        account: meeting.account
          ? { account_id: meeting.account.accountId, name: meeting.account.name, domain: meeting.account.domain || null }
          : null,
        deal: meeting.deal
          ? {
              deal_id: meeting.deal.dealId,
              opportunity_name: meeting.deal.opportunityName,
              company_name: meeting.deal.companyName,
              stage: meeting.deal.stage,
              progress_percentage: meeting.deal.progressPercentage,
              status: meeting.deal.status,
            }
          : null,
        company: meeting.deal?.companyName || meeting.account?.name || '',
      },
    });
  })
);

/**
 * GET /api/meetings/:meetingId
 * Get a specific meeting by ID
 */
router.get(
  '/:meetingId',
  asyncHandler(async (req: Request, res: Response) => {
    const { meetingId } = req.params;

    const meeting = await prisma.meeting.findUnique({
      where: { meetingId },
      include: {
        deal: true,
        account: true,
        analysisJobs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            pptJob: true,
          },
        },
      },
    });

    if (!meeting) {
      throw new AppError('Meeting not found', 404);
    }

    const response: ApiResponse = {
      success: true,
      data: {
        ...meeting,
        accountId: meeting.accountId,
        internalAttendees: meeting.internalAttendees ? JSON.parse(meeting.internalAttendees) : null,
        externalAttendees: meeting.externalAttendees ? JSON.parse(meeting.externalAttendees) : null,
        keyPoints: meeting.keyPoints ? JSON.parse(meeting.keyPoints) : null,
        actionItems: meeting.actionItems ? JSON.parse(meeting.actionItems) : null,
        analysisJob: meeting.analysisJobs?.[0]
          ? await serializeAnalysisJob(meeting.analysisJobs[0])
          : null,
        account: meeting.account
          ? {
              account_id: meeting.account.accountId,
              name: meeting.account.name,
            }
          : null,
      },
    };

    res.json(response);
  })
);

/**
 * GET /api/meetings/:meetingId/pre-call-research
 * Fetch pre-call research questionnaire linked to a meeting
 * Returns completed research, or in-progress session ID for polling
 */
router.get(
  '/:meetingId/pre-call-research',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Missing authenticated user id', 401);
    }
    const { meetingId } = req.params;

    const meetingRecord = await prisma.meeting.findUnique({
      where: { meetingId },
      select: {
        meetingId: true,
        calendarEventId: true,
        onlineMeetingId: true,
        icalUid: true,
      },
    });

    const canView = meetingRecord
      ? await userHasCalendarMeetingAccess(userId, {
          meetingId: meetingRecord.meetingId,
          calendarEventId: meetingRecord.calendarEventId,
          onlineMeetingId: meetingRecord.onlineMeetingId,
          icalUid: meetingRecord.icalUid,
        })
      : await userHasCalendarMeetingAccess(userId, {
          meetingId,
          calendarEventId: meetingId,
          onlineMeetingId: meetingId,
          icalUid: meetingId,
        });

    if (!canView) {
      throw new AppError('You do not have access to this meeting.', 403);
    }

    const canonicalMeetingId = meetingRecord?.meetingId || meetingId;

    // First, check for completed analysis with results
    const completedAnalysis = await prisma.analysis.findFirst({
      where: {
        meetingId: canonicalMeetingId,
        status: 'completed',
        result: { not: null },
      },
      orderBy: { completedAt: 'desc' },
    });

    if (completedAnalysis) {
      // Parse the result JSON to extract questionnaire
      let questionnaire = null;
      let companyDeepDive = null;
      let externalAttendeeResearchFromResult: any[] | null = null;
      let companyLatestNews: any | null = null;
      let internalKbPreCall: any | null = null;
      if (completedAnalysis.result) {
        try {
          const parsed = JSON.parse(completedAnalysis.result);
          questionnaire = parsed?.aiQuestionnaire || null;
          companyDeepDive = parsed?.companyDeepDive || null;
          externalAttendeeResearchFromResult = Array.isArray(parsed?.externalAttendeeResearch)
            ? parsed.externalAttendeeResearch
            : null;
          companyLatestNews = parsed?.companyLatestNews || null;
          internalKbPreCall = parsed?.internalKbPreCall || null;
        } catch {
          console.warn(`[meetings] Failed to parse analysis result for ${completedAnalysis.sessionId}`);
        }
      }

      const attendeeResearchRecords = await prisma.meetingAttendeeResearch.findMany({
        where: {
          meetingId: canonicalMeetingId,
          attendeeType: 'external',
        },
        orderBy: [{ name: 'asc' }, { updatedAt: 'desc' }],
      });

      const externalAttendeeResearch =
        attendeeResearchRecords.length > 0
          ? attendeeResearchRecords.map((record) => ({
              id: record.id,
              name: record.name,
              email: record.email,
              company: record.company,
              status: record.status,
              error_message: record.errorMessage,
              last_researched_at: record.lastResearchedAt?.toISOString?.() || null,
              research: record.research,
              sources: record.sources,
            }))
          : externalAttendeeResearchFromResult || [];

      res.json({
        success: true,
        data: {
          session_id: completedAnalysis.sessionId,
          company_name: completedAnalysis.companyName,
          completed_at: completedAnalysis.completedAt?.toISOString() || null,
          status: 'completed',
          questionnaire,
          company_overview: companyDeepDive,
          company_latest_news: companyLatestNews,
          internal_kb_pre_call: internalKbPreCall,
          external_attendees_research: externalAttendeeResearch,
        },
      });
      return;
    }

    // Check for in-progress analysis (running or pending)
    const runningAnalysis = await prisma.analysis.findFirst({
      where: {
        meetingId: canonicalMeetingId,
        status: { in: ['running', 'pending', 'in_progress'] },
      },
      orderBy: { startedAt: 'desc' },
    });

    if (runningAnalysis) {
      const normalizedStatus = runningAnalysis.status === 'in_progress' ? 'running' : runningAnalysis.status;
      res.json({
        success: true,
        data: {
          session_id: runningAnalysis.sessionId,
          company_name: runningAnalysis.companyName,
          status: normalizedStatus,
          current_step: runningAnalysis.currentStep,
          started_at: runningAnalysis.startedAt?.toISOString() || null,
          questionnaire: null,
          company_overview: null,
        },
      });
      return;
    }

    // No research found
    res.json({
      success: true,
      data: null,
      message: 'No pre-call research found for this meeting',
    });
  })
);

/**
 * POST /api/meetings
 * Create a new meeting
 */
router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const {
      dealId,
      accountId: accountIdCamel,
      account_id: accountIdSnake,
      title,
      meetingDate,
      durationMinutes,
      internalAttendees,
      externalAttendees,
      transcript,
      recordingUrl,
      notes,
    } = req.body;

    if (!title) {
      throw new AppError('Meeting title is required', 400);
    }

    let resolvedAccountId: string | null = null;
    const requestedAccountId = (accountIdCamel || accountIdSnake || '').trim();

    if (requestedAccountId) {
      const account = await prisma.account.findUnique({
        where: { accountId: requestedAccountId },
      });
      if (!account) {
        throw new AppError('Account not found', 404);
      }
      resolvedAccountId = account.accountId;
    } else if (dealId) {
      const deal = await prisma.deal.findUnique({
        where: { dealId },
        select: { accountId: true },
      });
      resolvedAccountId = deal?.accountId || null;
    }

    const meeting = await prisma.meeting.create({
      data: {
        meetingId: randomUUID(),
        dealId,
        accountId: resolvedAccountId,
        title,
        meetingDate: meetingDate ? new Date(meetingDate) : null,
        durationMinutes,
        internalAttendees: internalAttendees ? JSON.stringify(internalAttendees) : null,
        externalAttendees: externalAttendees ? JSON.stringify(externalAttendees) : null,
        transcript,
        recordingUrl,
        notes,
      },
    });

    const response: ApiResponse = {
      success: true,
      data: meeting,
      message: 'Meeting created successfully',
    };

    res.status(201).json(response);
  })
);

/**
 * PATCH /api/meetings/:meetingId
 * Update a meeting
 */
router.patch(
  '/:meetingId',
  asyncHandler(async (req: Request, res: Response) => {
    const { meetingId } = req.params;
    const updates = { ...req.body };

    // Handle JSON fields
    if (updates.internalAttendees) {
      updates.internalAttendees = JSON.stringify(updates.internalAttendees);
    }
    if (updates.externalAttendees) {
      updates.externalAttendees = JSON.stringify(updates.externalAttendees);
    }
    if (updates.keyPoints) {
      updates.keyPoints = JSON.stringify(updates.keyPoints);
    }
    if (updates.actionItems) {
      updates.actionItems = JSON.stringify(updates.actionItems);
    }
    const meetingSnapshot =
      typeof updates.meetingSnapshot === 'object' && updates.meetingSnapshot !== null
        ? updates.meetingSnapshot
        : undefined;
    if ('meetingSnapshot' in updates) {
      delete updates.meetingSnapshot;
    }

    // Remove fields that shouldn't be updated directly
    delete updates.meetingId;
    delete updates.createdAt;
    let accountFieldProvided = false;
    if (updates.account_id && !updates.accountId) {
      updates.accountId = updates.account_id;
    }
    delete updates.account_id;

    if (typeof updates.accountId === 'string') {
      const trimmed = updates.accountId.trim();
      if (!trimmed) {
        updates.accountId = null;
      } else {
        const account = await prisma.account.findUnique({
          where: { accountId: trimmed },
        });
        if (!account) {
          throw new AppError('Account not found', 404);
        }
        updates.accountId = trimmed;
        accountFieldProvided = true;
      }
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'accountId')) {
      accountFieldProvided = true;
    }

    if (!updates.accountId && updates.dealId) {
      const deal = await prisma.deal.findUnique({
        where: { dealId: updates.dealId },
        select: { accountId: true },
      });
      if (deal?.accountId) {
        updates.accountId = deal.accountId;
        accountFieldProvided = true;
      }
    }

    let resolvedAccountId: string | null | undefined = undefined;
    if (accountFieldProvided) {
      resolvedAccountId =
        typeof updates.accountId === 'string' && updates.accountId.trim().length > 0
          ? updates.accountId.trim()
          : null;
      delete updates.accountId;
    }

    let resolvedDealId: string | null | undefined = undefined;
    if (Object.prototype.hasOwnProperty.call(updates, 'dealId')) {
      const trimmedDealId =
        typeof updates.dealId === 'string' && updates.dealId.trim().length > 0
          ? updates.dealId.trim()
          : null;
      if (trimmedDealId) {
        const dealExists = await prisma.deal.findUnique({
          where: { dealId: trimmedDealId },
          select: { dealId: true },
        });
        if (!dealExists) {
          throw new AppError('Deal not found', 404);
        }
      }
      resolvedDealId = trimmedDealId;
      delete updates.dealId;
    }

    let existingMeeting = await prisma.meeting.findUnique({
      where: { meetingId },
    });
    if (!existingMeeting) {
      existingMeeting = await prisma.meeting.findFirst({
        where: {
          OR: [
            { calendarEventId: meetingId },
            { onlineMeetingId: meetingId },
            { icalUid: meetingId },
          ],
        },
      });
    }
    if (!existingMeeting) {
      if (!meetingSnapshot) {
        throw new AppError('Meeting not found', 404);
      }

      const { meeting: createdMeeting } = await MeetingService.findOrCreate(
        {
          meetingId,
          calendarEventId: meetingId,
        },
        {
          title: meetingSnapshot.title || 'Untitled Meeting',
          meetingDate: meetingSnapshot.meetingDate ? new Date(meetingSnapshot.meetingDate) : undefined,
          durationMinutes:
            typeof meetingSnapshot.durationMinutes === 'number'
              ? meetingSnapshot.durationMinutes
              : undefined,
          dealId: resolvedDealId || undefined,
          accountId: resolvedAccountId || undefined,
        }
      );

      // Set attendees and other snapshot fields not handled by MeetingService
      existingMeeting = await prisma.meeting.update({
        where: { meetingId: createdMeeting.meetingId },
        data: {
          internalAttendees: meetingSnapshot.internalAttendees
            ? JSON.stringify(meetingSnapshot.internalAttendees)
            : undefined,
          externalAttendees: meetingSnapshot.externalAttendees
            ? JSON.stringify(meetingSnapshot.externalAttendees)
            : undefined,
          notes: meetingSnapshot.notes || undefined,
          recordingUrl: meetingSnapshot.recordingUrl || undefined,
        },
      });
    }

    const meeting = await prisma.meeting.update({
      where: { meetingId: existingMeeting.meetingId },
      data: {
        ...updates,
        ...(typeof resolvedAccountId !== 'undefined'
          ? resolvedAccountId
            ? { account: { connect: { accountId: resolvedAccountId } } }
            : { account: { disconnect: true } }
          : {}),
        ...(typeof resolvedDealId !== 'undefined'
          ? resolvedDealId
            ? { deal: { connect: { dealId: resolvedDealId } } }
            : { deal: { disconnect: true } }
          : {}),
      },
    });

    const response: ApiResponse = {
      success: true,
      data: meeting,
      message: 'Meeting updated successfully',
    };

    res.json(response);
  })
);

/**
 * POST /api/meetings/:meetingId/link
 * Link a meeting to a deal (and optionally an account)
 * This is used for bi-directional sync from the Deal detail page
 */
router.post(
  '/:meetingId/link',
  asyncHandler(async (req: Request, res: Response) => {
    const { meetingId } = req.params;
    const { dealId, accountId } = req.body;

    if (!dealId) {
      throw new AppError('dealId is required', 400);
    }

    // Find the meeting first
    const meeting = await prisma.meeting.findUnique({
      where: { meetingId },
    });

    if (!meeting) {
      throw new AppError('Meeting not found', 404);
    }

    // Verify the deal exists
    const deal = await prisma.deal.findUnique({
      where: { dealId },
      include: { account: true },
    });

    if (!deal) {
      throw new AppError('Deal not found', 404);
    }

    // Use the deal's accountId if not provided
    const finalAccountId = accountId || deal.accountId;

    // Update the meeting to link it to the deal
    const updatedMeeting = await prisma.meeting.update({
      where: { meetingId },
      data: {
        dealId,
        accountId: finalAccountId,
      },
      include: {
        deal: {
          select: {
            dealId: true,
            opportunityName: true,
            companyName: true,
          },
        },
        account: {
          select: {
            accountId: true,
            name: true,
          },
        },
      },
    });

    console.log(`✅ Linked meeting ${meetingId} to deal ${dealId} (account: ${finalAccountId})`);

    const response: ApiResponse = {
      success: true,
      data: {
        meeting_id: updatedMeeting.meetingId,
        deal_id: updatedMeeting.dealId,
        account_id: updatedMeeting.accountId,
        title: updatedMeeting.title,
        meeting_date: updatedMeeting.meetingDate,
        deal: updatedMeeting.deal,
        account: updatedMeeting.account
          ? {
              account_id: updatedMeeting.account.accountId,
              name: updatedMeeting.account.name,
            }
          : null,
      },
      message: 'Meeting linked successfully',
    };

    res.json(response);
  })
);

/**
 * GET /api/meetings/:meetingId/is-proactive
 * Check if a meeting is a proactive/outbound call
 */
router.get(
  '/:meetingId/is-proactive',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Missing authenticated user id', 401);
    }

    const { meetingId } = req.params;

    // Get meeting
    const meeting = await prisma.meeting.findFirst({
      where: {
        OR: [
          { meetingId },
          { calendarEventId: meetingId },
          { onlineMeetingId: meetingId },
          { icalUid: meetingId },
        ],
      },
      select: {
        meetingId: true,
        title: true,
        notes: true,
        isProactiveCall: true,
        proactiveCallType: true,
        outreachEmailDraft: true,
        outreachEmailSentAt: true,
      },
    });

    if (!meeting) {
      throw new AppError('Meeting not found', 404);
    }

    // If already set manually, return stored value
    if (meeting.isProactiveCall !== null && meeting.isProactiveCall !== undefined) {
      const response: ApiResponse = {
        success: true,
        data: {
          isProactive: meeting.isProactiveCall,
          type: meeting.proactiveCallType,
          source: 'manual',
          hasEmailDraft: !!meeting.outreachEmailDraft,
          emailSentAt: meeting.outreachEmailSentAt?.toISOString() || null,
        },
      };
      res.json(response);
      return;
    }

    // Auto-detect based on title
    const detection = proactiveEmailService.detectProactiveCall(meeting.title, meeting.notes || undefined);

    const response: ApiResponse = {
      success: true,
      data: {
        ...detection,
        source: 'auto-detect',
        hasEmailDraft: !!meeting.outreachEmailDraft,
        emailSentAt: meeting.outreachEmailSentAt?.toISOString() || null,
      },
    };

    res.json(response);
  })
);

/**
 * PATCH /api/meetings/:meetingId/proactive
 * Set/toggle proactive status manually
 */
router.patch(
  '/:meetingId/proactive',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Missing authenticated user id', 401);
    }

    const { meetingId } = req.params;
    const { isProactive, proactiveCallType } = req.body;

    if (typeof isProactive !== 'boolean') {
      throw new AppError('isProactive must be a boolean', 400);
    }

    // Find the actual meeting ID
    const meeting = await prisma.meeting.findFirst({
      where: {
        OR: [
          { meetingId },
          { calendarEventId: meetingId },
          { onlineMeetingId: meetingId },
          { icalUid: meetingId },
        ],
      },
      select: { meetingId: true },
    });

    if (!meeting) {
      throw new AppError('Meeting not found', 404);
    }

    await proactiveEmailService.setProactiveStatus(meeting.meetingId, isProactive, proactiveCallType);

    const response: ApiResponse = {
      success: true,
      message: 'Proactive status updated',
      data: { meetingId: meeting.meetingId, isProactive, proactiveCallType },
    };

    res.json(response);
  })
);

/**
 * POST /api/meetings/:meetingId/generate-outreach-email
 * Generate an outreach email draft
 */
router.post(
  '/:meetingId/generate-outreach-email',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Missing authenticated user id', 401);
    }

    const { meetingId } = req.params;
    const { companyResearch, senderName } = req.body;

    // Find meeting with details
    const meeting = await prisma.meeting.findFirst({
      where: {
        OR: [
          { meetingId },
          { calendarEventId: meetingId },
          { onlineMeetingId: meetingId },
          { icalUid: meetingId },
        ],
      },
      select: {
        meetingId: true,
        title: true,
        notes: true,
        externalAttendees: true,
      },
    });

    if (!meeting) {
      throw new AppError('Meeting not found', 404);
    }

    // Parse external attendees
    let attendees: any[] = [];
    if (meeting.externalAttendees) {
      try {
        attendees = JSON.parse(meeting.externalAttendees);
      } catch {
        attendees = [];
      }
    }

    // Extract company name from attendees or request
    const companyName = attendees[0]?.company || req.body.companyName || 'the company';

    // Generate the email
    const draft = await proactiveEmailService.generateOutreachEmail({
      meetingTitle: meeting.title,
      companyName,
      attendees: attendees.map((a: any) => ({
        name: a.name || a.displayName || 'Unknown',
        email: a.email || a.emailAddress || '',
        company: a.company,
        title: a.title || a.jobTitle,
      })),
      companyResearch,
      meetingPurpose: meeting.notes || undefined,
      senderName,
    });

    // Save the draft
    await proactiveEmailService.saveEmailDraft(meeting.meetingId, draft);

    // Also mark as proactive if not already
    await proactiveEmailService.setProactiveStatus(meeting.meetingId, true, 'outreach');

    const response: ApiResponse = {
      success: true,
      data: draft,
    };

    res.json(response);
  })
);

/**
 * GET /api/meetings/:meetingId/outreach-email
 * Get the saved outreach email draft
 */
router.get(
  '/:meetingId/outreach-email',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Missing authenticated user id', 401);
    }

    const { meetingId } = req.params;

    // Find meeting
    const meeting = await prisma.meeting.findFirst({
      where: {
        OR: [
          { meetingId },
          { calendarEventId: meetingId },
          { onlineMeetingId: meetingId },
          { icalUid: meetingId },
        ],
      },
      select: { meetingId: true },
    });

    if (!meeting) {
      throw new AppError('Meeting not found', 404);
    }

    const draft = await proactiveEmailService.getEmailDraft(meeting.meetingId);

    const response: ApiResponse = {
      success: true,
      data: draft,
    };

    res.json(response);
  })
);

/**
 * POST /api/meetings/:meetingId/send-outreach-email
 * Send the outreach email via MS Graph
 */
router.post(
  '/:meetingId/send-outreach-email',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const accessToken = req.user?.accessToken;

    if (!userId || !accessToken) {
      throw new AppError('Missing authenticated user id or access token', 401);
    }

    const { meetingId } = req.params;
    const { customSubject, customBody } = req.body;

    // Find meeting
    const meeting = await prisma.meeting.findFirst({
      where: {
        OR: [
          { meetingId },
          { calendarEventId: meetingId },
          { onlineMeetingId: meetingId },
          { icalUid: meetingId },
        ],
      },
      select: { meetingId: true },
    });

    if (!meeting) {
      throw new AppError('Meeting not found', 404);
    }

    const success = await proactiveEmailService.sendOutreachEmail(
      accessToken,
      meeting.meetingId,
      customSubject,
      customBody
    );

    const response: ApiResponse = {
      success,
      message: success ? 'Email sent successfully' : 'Failed to send email',
    };

    res.json(response);
  })
);

/**
 * POST /api/meetings/:meetingId/generate-followup-email
 * Generate a post-call follow-up email from transcript analysis
 */
router.post(
  '/:meetingId/generate-followup-email',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw new AppError('Missing authenticated user id', 401);

    const { meetingId } = req.params;
    const { senderName } = req.body;

    const meeting = await prisma.meeting.findFirst({
      where: {
        OR: [
          { meetingId },
          { calendarEventId: meetingId },
          { onlineMeetingId: meetingId },
          { icalUid: meetingId },
        ],
      },
      select: {
        meetingId: true,
        title: true,
        meetingDate: true,
        externalAttendees: true,
      },
    });

    if (!meeting) throw new AppError('Meeting not found', 404);

    // Fetch latest completed transcript analysis
    const transcriptAnalysis = await prisma.transcriptAnalysis.findFirst({
      where: { meetingId: meeting.meetingId, status: 'completed' },
      orderBy: { analyzedAt: 'desc' },
      select: { analysisResult: true, companyName: true },
    });

    if (!transcriptAnalysis?.analysisResult) {
      throw new AppError('No completed transcript analysis found. Run transcript analysis first.', 400);
    }

    let analysisResult: any;
    try {
      analysisResult = typeof transcriptAnalysis.analysisResult === 'string'
        ? JSON.parse(transcriptAnalysis.analysisResult)
        : transcriptAnalysis.analysisResult;
    } catch {
      throw new AppError('Failed to parse transcript analysis data', 500);
    }

    let attendees: any[] = [];
    if (meeting.externalAttendees) {
      try { attendees = JSON.parse(meeting.externalAttendees as string); } catch { attendees = []; }
    }

    const companyName = transcriptAnalysis.companyName || attendees[0]?.company || req.body.companyName || 'the company';

    const draft = await proactiveEmailService.generateFollowUpEmail({
      meetingTitle: meeting.title,
      companyName,
      attendees: attendees.map((a: any) => ({
        name: a.name || a.displayName || 'Unknown',
        email: a.email || a.emailAddress || '',
        company: a.company,
        title: a.title || a.jobTitle,
      })),
      analysisResult,
      meetingDate: meeting.meetingDate?.toISOString(),
      senderName,
    });

    await proactiveEmailService.saveFollowUpEmailDraft(meeting.meetingId, draft);

    res.json({ success: true, data: draft });
  })
);

/**
 * GET /api/meetings/:meetingId/followup-email
 * Retrieve saved follow-up email draft
 */
router.get(
  '/:meetingId/followup-email',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw new AppError('Missing authenticated user id', 401);

    const { meetingId } = req.params;
    const meeting = await prisma.meeting.findFirst({
      where: {
        OR: [
          { meetingId },
          { calendarEventId: meetingId },
          { onlineMeetingId: meetingId },
          { icalUid: meetingId },
        ],
      },
      select: { meetingId: true },
    });

    if (!meeting) throw new AppError('Meeting not found', 404);

    const draft = await proactiveEmailService.getFollowUpEmailDraft(meeting.meetingId);
    res.json({ success: true, data: draft });
  })
);

/**
 * POST /api/meetings/:meetingId/send-followup-email
 * Send the follow-up email via MS Graph
 */
router.post(
  '/:meetingId/send-followup-email',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const accessToken = req.user?.accessToken;

    if (!userId || !accessToken) {
      throw new AppError('Missing authenticated user id or access token', 401);
    }

    const { meetingId } = req.params;
    const { customSubject, customBody } = req.body;

    const meeting = await prisma.meeting.findFirst({
      where: {
        OR: [
          { meetingId },
          { calendarEventId: meetingId },
          { onlineMeetingId: meetingId },
          { icalUid: meetingId },
        ],
      },
      select: { meetingId: true },
    });

    if (!meeting) throw new AppError('Meeting not found', 404);

    const success = await proactiveEmailService.sendFollowUpEmail(
      accessToken,
      meeting.meetingId,
      customSubject,
      customBody
    );

    res.json({
      success,
      message: success ? 'Follow-up email sent successfully' : 'Failed to send email',
    });
  })
);

/**
 * DELETE /api/meetings/:meetingId
 * Delete a meeting
 */
router.delete(
  '/:meetingId',
  asyncHandler(async (req: Request, res: Response) => {
    const { meetingId } = req.params;

    await prisma.meeting.delete({
      where: { meetingId },
    });

    const response: ApiResponse = {
      success: true,
      message: 'Meeting deleted successfully',
    };

    res.json(response);
  })
);

export default router;
