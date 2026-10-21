import { Router } from 'express';
import { randomUUID } from 'crypto';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { getPrismaClient } from '../config/database';
import { getLoggerService } from '../services/logger.service';
import {
  isProposalQueueEnabled,
  enqueueAnalysisWorkflowJob,
} from '../services/jobQueue.service';
import { processAnalysisWorkflowJob } from '../services/analysisWorkflowJob.service';
import {
  createBulkAnalysisJob,
  processBulkAnalysisJob,
  getBulkJobStatus,
  cancelBulkAnalysisJob,
} from '../services/bulkAnalysisJob.service';
import { MeetingService } from '../services/meeting.service';
import { userHasCalendarMeetingAccess } from '../utils/meetingAccess';

const router = Router();
const prisma = getPrismaClient();
const logger = getLoggerService();

type StageStatus = 'pending' | 'running' | 'completed' | 'skipped' | 'error';

const safeJsonParse = <T>(value?: string | null): T | null => {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

const coerceBoolean = (value: any): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return ['true', '1', 'yes'].includes(value.toLowerCase());
  }
  return false;
};

const extractBearerToken = (authorization?: string) => {
  if (!authorization) return null;
  if (!authorization.toLowerCase().startsWith('bearer ')) return null;
  return authorization.slice(7).trim() || null;
};

router.post(
  '/run',
  asyncHandler(async (req, res) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Missing authenticated user id', 401);
    }

    const meetingIdentifier = (req.body.meetingId || req.body.meeting_id || '').trim();
    if (!meetingIdentifier) {
      throw new AppError('Meeting ID is required', 400);
    }

    const calendarEventIdentifier = (req.body.calendarEventId || req.body.calendar_event_id || '').trim();
    const onlineMeetingIdentifier = (req.body.onlineMeetingId || req.body.online_meeting_id || '').trim();
    const icalUidIdentifier = (req.body.icalUid || req.body.ical_uid || '').trim();

    const identifierCandidates = Array.from(
      new Set(
        [meetingIdentifier, calendarEventIdentifier, onlineMeetingIdentifier, icalUidIdentifier].filter(
          (value): value is string => Boolean(value)
        )
      )
    );

    const runTranscript = coerceBoolean(req.body.runTranscript ?? req.body.run_transcript);
    const runProposal = coerceBoolean(req.body.runProposal ?? req.body.run_proposal);
    const runPpt = coerceBoolean(req.body.runPpt ?? req.body.run_ppt);
    const sendEmailNotification = coerceBoolean(req.body.sendEmailNotification ?? req.body.send_email_notification);

    if (!runTranscript && !runProposal && !runPpt) {
      throw new AppError('Select at least one analysis stage', 400);
    }

    // Get user email for notifications
    const userEmail = (req.user as any)?.email ||
      (req.user as any)?.userPrincipalName ||
      (req.user as any)?.preferred_username ||
      null;

    const transcriptText =
      typeof req.body.transcriptText === 'string' ? req.body.transcriptText.trim() : null;

    const requestedDealId =
      (typeof req.body.dealId === 'string' && req.body.dealId.trim()) ||
      (typeof req.body.deal_id === 'string' && req.body.deal_id.trim()) ||
      null;
    const requestedAccountId =
      (typeof req.body.accountId === 'string' && req.body.accountId.trim()) ||
      (typeof req.body.account_id === 'string' && req.body.account_id.trim()) ||
      null;

    let resolvedDealId: string | null = requestedDealId;
    let resolvedAccountId: string | null = requestedAccountId;

    if (resolvedDealId) {
      const dealRecord = await prisma.deal.findUnique({
        where: { dealId: resolvedDealId },
      });
      if (!dealRecord) {
        throw new AppError('Deal not found', 404);
      }
      if (dealRecord.accountId) {
        if (resolvedAccountId && resolvedAccountId !== dealRecord.accountId) {
          throw new AppError('Deal does not belong to the specified account', 400);
        }
        resolvedAccountId = dealRecord.accountId;
      }
    }

    if (resolvedAccountId && !requestedDealId) {
      const accountRecord = await prisma.account.findUnique({
        where: { accountId: resolvedAccountId },
      });
      if (!accountRecord) {
        throw new AppError('Account not found', 404);
      }
    }

    const existingMeeting = await MeetingService.findByIdentifiers({
      meetingId: meetingIdentifier,
      calendarEventId: calendarEventIdentifier || meetingIdentifier,
      onlineMeetingId: onlineMeetingIdentifier || undefined,
      icalUid: icalUidIdentifier || undefined,
    });

    const hasAccess = await userHasCalendarMeetingAccess(userId, {
      meetingId: meetingIdentifier,
      calendarEventId: calendarEventIdentifier || meetingIdentifier,
      onlineMeetingId: onlineMeetingIdentifier || undefined,
      icalUid: icalUidIdentifier || undefined,
    });

    const hasAccessViaExisting = existingMeeting
      ? await userHasCalendarMeetingAccess(userId, {
          meetingId: existingMeeting.meetingId,
          calendarEventId: existingMeeting.calendarEventId,
          onlineMeetingId: existingMeeting.onlineMeetingId,
          icalUid: existingMeeting.icalUid,
        })
      : false;

    if (!hasAccess && !hasAccessViaExisting) {
      throw new AppError('You do not have access to this meeting. Sync your Outlook/Teams calendar and try again.', 403);
    }

    // Use MeetingService for centralized deduplication (handles all 4 ID formats + hex/base64 conversion)
    const metadata = req.body.meeting || {};
    const meetingResult = await MeetingService.findOrCreate(
      {
        meetingId: meetingIdentifier,
        calendarEventId: calendarEventIdentifier || meetingIdentifier,
        onlineMeetingId: onlineMeetingIdentifier || undefined,
        icalUid: icalUidIdentifier || undefined,
      },
      {
        title: metadata.title || 'Meeting',
        meetingDate: metadata.meetingDate ? new Date(metadata.meetingDate) : undefined,
        durationMinutes: metadata.durationMinutes ?? undefined,
        notes: metadata.notes || undefined,
        dealId: resolvedDealId || undefined,
        accountId: resolvedAccountId || undefined,
      },
      true // updateIfExists - link to deal/account and fill missing identifiers
    );

    let meeting = meetingResult.meeting;

    // If meeting was found but needs updated deal/account links, update them
    if (!meetingResult.created) {
      const updateData: Record<string, any> = {};
      if (resolvedDealId && meeting.dealId !== resolvedDealId) {
        updateData.dealId = resolvedDealId;
      }
      if (resolvedAccountId && meeting.accountId !== resolvedAccountId) {
        updateData.accountId = resolvedAccountId;
      }
      if (calendarEventIdentifier && meeting.calendarEventId !== calendarEventIdentifier) {
        updateData.calendarEventId = calendarEventIdentifier;
      }
      if (onlineMeetingIdentifier && meeting.onlineMeetingId !== onlineMeetingIdentifier) {
        updateData.onlineMeetingId = onlineMeetingIdentifier;
      }
      if (icalUidIdentifier && meeting.icalUid !== icalUidIdentifier) {
        updateData.icalUid = icalUidIdentifier;
      }
      if (Object.keys(updateData).length > 0) {
        meeting = await prisma.meeting.update({
          where: { meetingId: meeting.meetingId },
          data: updateData,
        });
      }
    }

    if (!resolvedDealId && meeting.dealId) {
      resolvedDealId = meeting.dealId;
    }
    if (!resolvedAccountId && meeting.accountId) {
      resolvedAccountId = meeting.accountId;
    }

    const activeJob = await prisma.meetingAnalysisJob.findFirst({
      where: {
        meetingId: meeting.meetingId,
        status: {
          in: ['queued', 'running'],
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (activeJob) {
      throw new AppError(
        'An analysis is already running for this meeting. Please wait for the current workflow to finish before starting a new one.',
        409
      );
    }

    const job = await prisma.meetingAnalysisJob.create({
      data: {
        jobId: randomUUID(),
        meetingId: meeting.meetingId,
        runTranscript,
        runProposal,
        runPpt,
        transcriptText,
        status: 'queued',
        transcriptStatus: runTranscript ? 'pending' : 'skipped',
        proposalStatus: runProposal ? 'pending' : 'skipped',
        pptStatus: runPpt ? 'pending' : 'skipped',
        requestedBy: userId,
        requestedByEmail: userEmail,
        sendEmailNotification,
      },
    });

    const requestAccessToken =
      req.user?.accessToken || extractBearerToken(req.headers.authorization);

    if (isProposalQueueEnabled()) {
      await enqueueAnalysisWorkflowJob({
        type: 'analysis-workflow',
        workflowJobId: job.jobId,
        accessToken: requestAccessToken || null,
      });
      res.json({
        success: true,
        data: {
          jobId: job.jobId,
          status: job.status,
        },
      });
      return;
    }

    // Fallback: process inline (non-queue environments)
    processAnalysisWorkflowJob(job.jobId, requestAccessToken || null).catch((error) => {
      logger.error('Analysis workflow job failed', error, { jobId: job.jobId });
    });

    res.json({
      success: true,
      data: {
        jobId: job.jobId,
        status: 'running',
      },
    });
  })
);
router.get(
  '/jobs/:jobId/status',
  asyncHandler(async (req, res) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Missing authenticated user id', 401);
    }

    const jobId = (req.params.jobId || '').trim();
    if (!jobId) {
      throw new AppError('Job ID is required', 400);
    }

    const job = await prisma.meetingAnalysisJob.findUnique({
      where: { jobId },
      include: {
        meeting: {
          select: {
            meetingId: true,
            title: true,
            dealId: true,
            accountId: true,
          },
        },
      },
    });

    if (!job) {
      throw new AppError('Job not found', 404);
    }

    if (job.meeting?.meetingId) {
      const meetingRecord = await prisma.meeting.findUnique({
        where: { meetingId: job.meeting.meetingId },
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
        : false;
      if (!canView) {
        throw new AppError('You do not have access to this meeting.', 403);
      }
    }

    res.json({
      success: true,
      data: {
        job: {
          jobId: job.jobId,
          meetingId: job.meetingId,
          runTranscript: job.runTranscript,
          runProposal: job.runProposal,
          runPpt: job.runPpt,
          status: job.status,
          transcriptStatus: job.transcriptStatus,
          transcriptAnalysisId: job.transcriptAnalysisId,
          proposalStatus: job.proposalStatus,
          proposalJobId: job.proposalJobId,
          pptStatus: job.pptStatus,
          pptJobId: job.pptJobId,
          errorMessage: job.errorMessage,
          createdAt: job.createdAt,
          updatedAt: job.updatedAt,
          completedAt: job.completedAt,
        },
        meeting: job.meeting
          ? {
              meetingId: job.meeting.meetingId,
              title: job.meeting.title,
              dealId: job.meeting.dealId,
              accountId: job.meeting.accountId,
            }
          : null,
      },
    });
  })
);

router.post(
  '/jobs/:jobId/cancel',
  asyncHandler(async (req, res) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Missing authenticated user id', 401);
    }

    const jobId = (req.params.jobId || '').trim();
    if (!jobId) {
      throw new AppError('Job ID is required', 400);
    }

    const job = await prisma.meetingAnalysisJob.findUnique({
      where: { jobId },
      include: {
        meeting: {
          select: {
            meetingId: true,
            calendarEventId: true,
            onlineMeetingId: true,
            icalUid: true,
          },
        },
      },
    });

    if (!job) {
      throw new AppError('Job not found', 404);
    }

    const canCancel = job.meeting?.meetingId
      ? await userHasCalendarMeetingAccess(userId, {
          meetingId: job.meeting.meetingId,
          calendarEventId: job.meeting.calendarEventId,
          onlineMeetingId: job.meeting.onlineMeetingId,
          icalUid: job.meeting.icalUid,
        })
      : false;
    if (!canCancel) {
      throw new AppError('You do not have access to this meeting.', 403);
    }

    const cancellable = ['queued', 'running', 'pending', 'in_progress', 'processing'].includes(
      (job.status || '').toLowerCase()
    );

    if (!cancellable) {
      res.json({
        success: false,
        message: 'Job is not running or already completed',
        data: { jobId, cancelled: false },
      });
      return;
    }

    await prisma.$transaction(async (tx: any) => {
      const latest = await tx.meetingAnalysisJob.findUnique({ where: { jobId } });
      if (!latest) return;

      await tx.meetingAnalysisJob.update({
        where: { jobId },
        data: {
          status: 'cancelled',
          errorMessage: 'Cancelled by user',
          completedAt: new Date(),
          transcriptStatus:
            latest.transcriptStatus && !['completed', 'skipped', 'error'].includes(latest.transcriptStatus)
              ? 'cancelled'
              : latest.transcriptStatus,
          proposalStatus:
            latest.proposalStatus && !['completed', 'skipped', 'error'].includes(latest.proposalStatus)
              ? 'cancelled'
              : latest.proposalStatus,
          pptStatus:
            latest.pptStatus && !['completed', 'skipped', 'error'].includes(latest.pptStatus)
              ? 'cancelled'
              : latest.pptStatus,
        },
      });

      if (latest.transcriptAnalysisId) {
        await tx.transcriptAnalysis.updateMany({
          where: { analysisId: latest.transcriptAnalysisId, status: { in: ['queued', 'processing'] } },
          data: {
            status: 'cancelled',
            errorMessage: 'Cancelled by user',
            analysisResult: JSON.stringify({ status: 'cancelled', error: 'Cancelled by user' }),
          },
        });
      }

      if (latest.proposalJobId) {
        await tx.proposalJob.updateMany({
          where: { jobId: latest.proposalJobId, status: { in: ['queued', 'processing'] } },
          data: {
            status: 'cancelled',
            errorMessage: 'Cancelled by user',
            completedAt: new Date(),
          },
        });
      }

      if (latest.pptJobId) {
        await tx.pptxJob.updateMany({
          where: { jobId: latest.pptJobId, status: { in: ['queued', 'processing'] } },
          data: {
            status: 'cancelled',
            errorMessage: 'Cancelled by user',
            completedAt: new Date(),
          },
        });
      }
    });

    res.json({
      success: true,
      message: 'Analysis workflow cancelled',
      data: { jobId, cancelled: true },
    });
  })
);

async function resumePendingJobs() {
  const pendingJobs = await prisma.meetingAnalysisJob.findMany({
    where: {
      status: {
        in: ['queued', 'running'],
      },
    },
  });

  pendingJobs.forEach((job: any) => {
    if (isProposalQueueEnabled()) {
      enqueueAnalysisWorkflowJob({
        type: 'analysis-workflow',
        workflowJobId: job.jobId,
        accessToken: null,
      }).catch((error) => logger.error('Failed to enqueue pending analysis job', error, { jobId: job.jobId }));
    } else {
      processAnalysisWorkflowJob(job.jobId, null).catch((error) =>
        logger.error('Failed to resume pending analysis job', error, { jobId: job.jobId })
      );
    }
  });
}

resumePendingJobs().catch((error) => {
  console.error('Failed to resume analysis jobs:', error);
});

// ---------------------------------------------------------------------------
// Bulk Analysis Endpoints
// ---------------------------------------------------------------------------

/**
 * POST /bulk-run
 * Trigger analysis for multiple meetings at once (by deal, account, or explicit IDs)
 */
router.post(
  '/bulk-run',
  asyncHandler(async (req, res) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Missing authenticated user id', 401);
    }

    const {
      dealId,
      accountId,
      meetingIds,
      runTranscript,
      runProposal,
      runPpt,
      sendEmailNotification,
    } = req.body;

    // Validate at least one scope provided
    if (!dealId && !accountId && (!meetingIds || !Array.isArray(meetingIds) || meetingIds.length === 0)) {
      throw new AppError('At least one of dealId, accountId, or meetingIds is required', 400);
    }

    // Validate at least one stage selected
    const wantTranscript = coerceBoolean(runTranscript);
    const wantProposal = coerceBoolean(runProposal);
    const wantPpt = coerceBoolean(runPpt);
    if (!wantTranscript && !wantProposal && !wantPpt) {
      throw new AppError('At least one analysis stage must be selected', 400);
    }

    const accessToken = extractBearerToken(req.headers.authorization);

    const result = await createBulkAnalysisJob({
      dealId: dealId || undefined,
      accountId: accountId || undefined,
      meetingIds: meetingIds || undefined,
      runTranscript: wantTranscript,
      runProposal: wantProposal,
      runPpt: wantPpt,
      sendEmailNotification: coerceBoolean(sendEmailNotification),
      requestedBy: userId,
      requestedByEmail: req.user?.email || undefined,
      accessToken,
    });

    // Fire-and-forget processing (runs in background)
    processBulkAnalysisJob(result.bulkJobId, accessToken).catch((error) => {
      logger.error('Bulk analysis processing failed', error, { bulkJobId: result.bulkJobId });
    });

    res.json({
      success: true,
      data: {
        bulkJobId: result.bulkJobId,
        totalMeetings: result.totalMeetings,
        skippedMeetings: result.skippedMeetings,
        status: 'queued',
      },
    });
  })
);

/**
 * GET /bulk-jobs/:bulkJobId/status
 * Poll progress of a bulk analysis job
 */
router.get(
  '/bulk-jobs/:bulkJobId/status',
  asyncHandler(async (req, res) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Missing authenticated user id', 401);
    }

    const { bulkJobId } = req.params;
    const status = await getBulkJobStatus(bulkJobId);

    if (!status) {
      throw new AppError('Bulk analysis job not found', 404);
    }

    res.json({ success: true, data: status });
  })
);

/**
 * POST /bulk-jobs/:bulkJobId/cancel
 * Cancel a running bulk analysis job and all its child jobs
 */
router.post(
  '/bulk-jobs/:bulkJobId/cancel',
  asyncHandler(async (req, res) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Missing authenticated user id', 401);
    }

    const { bulkJobId } = req.params;
    const cancelled = await cancelBulkAnalysisJob(bulkJobId);

    if (!cancelled) {
      throw new AppError('Bulk job not found or already completed', 404);
    }

    res.json({ success: true, data: { bulkJobId, status: 'cancelled' } });
  })
);

export default router;
