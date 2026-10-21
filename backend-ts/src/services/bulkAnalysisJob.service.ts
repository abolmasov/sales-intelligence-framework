/**
 * Bulk Analysis Job Service
 *
 * Orchestrates batch analysis of multiple meetings (by deal, account, or explicit IDs).
 * Creates a parent BulkAnalysisJob and child MeetingAnalysisJobs, then processes them
 * with concurrency control.
 */

import { randomUUID } from 'crypto';
import { getPrismaClient } from '../config/database';
import { processAnalysisWorkflowJob } from './analysisWorkflowJob.service';
import { sendNotification, NotificationType } from './notification.service';
import { getLoggerService } from './logger.service';
import { Semaphore } from '../agents/concurrency';

const prisma = getPrismaClient();
const logger = getLoggerService();

const DEFAULT_CONCURRENCY = 2;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BulkAnalysisRequest {
  dealId?: string;
  accountId?: string;
  meetingIds?: string[];
  runTranscript: boolean;
  runProposal: boolean;
  runPpt: boolean;
  sendEmailNotification: boolean;
  requestedBy: string;
  requestedByEmail?: string;
  accessToken?: string | null;
}

export interface BulkJobStatusResult {
  bulkJob: {
    bulkJobId: string;
    status: string;
    totalMeetings: number;
    completedMeetings: number;
    failedMeetings: number;
    skippedMeetings: number;
    progressPercentage: number;
    createdAt: Date;
    completedAt: Date | null;
    errorMessage: string | null;
  };
  meetingJobs: Array<{
    jobId: string;
    meetingId: string;
    meetingTitle: string;
    status: string;
    transcriptStatus: string;
    proposalStatus: string;
    pptStatus: string;
    errorMessage: string | null;
  }>;
}

// ---------------------------------------------------------------------------
// Resolve meetings to analyze
// ---------------------------------------------------------------------------

async function resolveMeetings(request: BulkAnalysisRequest) {
  let meetingFilter: any = {};

  if (request.meetingIds && request.meetingIds.length > 0) {
    meetingFilter = { meetingId: { in: request.meetingIds } };
  } else if (request.dealId) {
    meetingFilter = { dealId: request.dealId };
  } else if (request.accountId) {
    meetingFilter = { accountId: request.accountId };
  } else {
    throw new Error('At least one of dealId, accountId, or meetingIds is required');
  }

  // Find all meetings matching the filter that have a transcript
  const meetings = await prisma.meeting.findMany({
    where: {
      ...meetingFilter,
      transcript: { not: null },
    },
    select: {
      meetingId: true,
      title: true,
      transcript: true,
      dealId: true,
      accountId: true,
    },
    orderBy: { meetingDate: 'desc' },
  });

  if (meetings.length === 0) {
    return { eligible: [], skipped: [] };
  }

  // Exclude meetings that already have a completed analysis (if running transcript stage)
  let analyzedMeetingIds = new Set<string>();
  if (request.runTranscript) {
    const completedAnalyses = await prisma.transcriptAnalysis.findMany({
      where: {
        meetingId: { in: meetings.map((m) => m.meetingId) },
        status: 'completed',
      },
      select: { meetingId: true },
    });
    analyzedMeetingIds = new Set(
      completedAnalyses.map((a) => a.meetingId).filter(Boolean) as string[]
    );
  }

  // Exclude meetings with active analysis jobs (queued or running)
  const activeJobs = await prisma.meetingAnalysisJob.findMany({
    where: {
      meetingId: { in: meetings.map((m) => m.meetingId) },
      status: { in: ['queued', 'running'] },
    },
    select: { meetingId: true },
  });
  const activeJobMeetingIds = new Set(activeJobs.map((j) => j.meetingId));

  const eligible: typeof meetings = [];
  const skipped: typeof meetings = [];

  for (const meeting of meetings) {
    if (activeJobMeetingIds.has(meeting.meetingId)) {
      skipped.push(meeting);
    } else if (request.runTranscript && analyzedMeetingIds.has(meeting.meetingId)) {
      skipped.push(meeting);
    } else {
      eligible.push(meeting);
    }
  }

  return { eligible, skipped };
}

// ---------------------------------------------------------------------------
// Create bulk job + child jobs
// ---------------------------------------------------------------------------

export async function createBulkAnalysisJob(
  request: BulkAnalysisRequest
): Promise<{ bulkJobId: string; totalMeetings: number; skippedMeetings: number }> {
  const { eligible, skipped } = await resolveMeetings(request);

  if (eligible.length === 0) {
    throw new Error(
      skipped.length > 0
        ? `All ${skipped.length} meeting(s) already analyzed or currently being analyzed`
        : 'No meetings with transcripts found'
    );
  }

  const bulkJobId = randomUUID();

  // Create parent bulk job
  await prisma.bulkAnalysisJob.create({
    data: {
      bulkJobId,
      dealId: request.dealId || null,
      accountId: request.accountId || null,
      requestedMeetingIds: request.meetingIds ? JSON.stringify(request.meetingIds) : null,
      resolvedMeetingIds: JSON.stringify(eligible.map((m) => m.meetingId)),
      totalMeetings: eligible.length,
      skippedMeetings: skipped.length,
      runTranscript: request.runTranscript,
      runProposal: request.runProposal,
      runPpt: request.runPpt,
      status: 'queued',
      requestedBy: request.requestedBy,
      requestedByEmail: request.requestedByEmail || null,
      sendEmailNotification: request.sendEmailNotification,
    },
  });

  // Create child MeetingAnalysisJob records — all queued, per-meeting email suppressed
  for (const meeting of eligible) {
    await prisma.meetingAnalysisJob.create({
      data: {
        jobId: randomUUID(),
        meetingId: meeting.meetingId,
        bulkJobId,
        runTranscript: request.runTranscript,
        runProposal: request.runProposal,
        runPpt: request.runPpt,
        status: 'queued',
        transcriptStatus: request.runTranscript ? 'pending' : 'skipped',
        proposalStatus: request.runProposal ? 'pending' : 'skipped',
        pptStatus: request.runPpt ? 'pending' : 'skipped',
        requestedBy: request.requestedBy,
        requestedByEmail: request.requestedByEmail || null,
        sendEmailNotification: false, // suppress per-meeting — parent sends summary
      },
    });
  }

  logger.info('Bulk analysis job created', {
    bulkJobId,
    totalMeetings: eligible.length,
    skippedMeetings: skipped.length,
  });

  return { bulkJobId, totalMeetings: eligible.length, skippedMeetings: skipped.length };
}

// ---------------------------------------------------------------------------
// Process bulk job
// ---------------------------------------------------------------------------

export async function processBulkAnalysisJob(
  bulkJobId: string,
  accessToken?: string | null
): Promise<void> {
  const bulkJob = await prisma.bulkAnalysisJob.findUnique({ where: { bulkJobId } });
  if (!bulkJob) {
    logger.error('Bulk analysis job not found', undefined, { bulkJobId });
    return;
  }
  if (['completed', 'error', 'cancelled'].includes(bulkJob.status)) {
    return;
  }

  await prisma.bulkAnalysisJob.update({
    where: { bulkJobId },
    data: { status: 'running' },
  });

  const childJobs = await prisma.meetingAnalysisJob.findMany({
    where: { bulkJobId, status: 'queued' },
    orderBy: { createdAt: 'asc' },
  });

  const concurrency = parseInt(process.env.BULK_ANALYSIS_CONCURRENCY || '', 10) || DEFAULT_CONCURRENCY;
  const semaphore = new Semaphore(concurrency);

  const processJob = async (childJob: (typeof childJobs)[0]) => {
    await semaphore.acquire();
    try {
      // Check if bulk job was cancelled
      const currentBulk = await prisma.bulkAnalysisJob.findUnique({
        where: { bulkJobId },
        select: { status: true },
      });
      if (currentBulk?.status === 'cancelled') {
        return;
      }

      await processAnalysisWorkflowJob(childJob.jobId, accessToken);

      // Increment completed count
      await prisma.bulkAnalysisJob.update({
        where: { bulkJobId },
        data: { completedMeetings: { increment: 1 } },
      });
    } catch (error: any) {
      logger.error('Bulk child job failed', error, {
        bulkJobId,
        childJobId: childJob.jobId,
        meetingId: childJob.meetingId,
      });

      // Increment failed count
      await prisma.bulkAnalysisJob.update({
        where: { bulkJobId },
        data: { failedMeetings: { increment: 1 } },
      });
    } finally {
      semaphore.release();
    }
  };

  // Process all child jobs with concurrency control
  await Promise.all(childJobs.map(processJob));

  // Check final status
  const finalBulk = await prisma.bulkAnalysisJob.findUnique({ where: { bulkJobId } });
  if (finalBulk?.status === 'cancelled') {
    return;
  }

  const finalStatus = (finalBulk?.failedMeetings || 0) > 0 && (finalBulk?.completedMeetings || 0) === 0
    ? 'error'
    : 'completed';

  await prisma.bulkAnalysisJob.update({
    where: { bulkJobId },
    data: {
      status: finalStatus,
      completedAt: new Date(),
    },
  });

  logger.info('Bulk analysis job finished', {
    bulkJobId,
    status: finalStatus,
    completed: finalBulk?.completedMeetings,
    failed: finalBulk?.failedMeetings,
  });

  // Send summary notification
  if (bulkJob.sendEmailNotification && bulkJob.requestedBy) {
    const succeeded = finalBulk?.completedMeetings || 0;
    const failed = finalBulk?.failedMeetings || 0;
    const total = finalBulk?.totalMeetings || 0;

    await sendNotification({
      type: 'pipeline_complete' as NotificationType,
      userId: bulkJob.requestedBy,
      userEmail: bulkJob.requestedByEmail || undefined,
      accessToken: accessToken || undefined,
      title: 'Bulk Analysis Complete',
      message: `Bulk analysis finished: ${succeeded}/${total} meetings succeeded${failed > 0 ? `, ${failed} failed` : ''}.`,
      dealId: bulkJob.dealId || undefined,
      sendEmail: true,
      analysisData: {
        bulkJobId,
        totalMeetings: total,
        completedMeetings: succeeded,
        failedMeetings: failed,
        skippedMeetings: finalBulk?.skippedMeetings || 0,
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Get bulk job status
// ---------------------------------------------------------------------------

export async function getBulkJobStatus(bulkJobId: string): Promise<BulkJobStatusResult | null> {
  const bulkJob = await prisma.bulkAnalysisJob.findUnique({ where: { bulkJobId } });
  if (!bulkJob) return null;

  const childJobs = await prisma.meetingAnalysisJob.findMany({
    where: { bulkJobId },
    include: { meeting: { select: { title: true } } },
    orderBy: { createdAt: 'asc' },
  });

  const processed = bulkJob.completedMeetings + bulkJob.failedMeetings + bulkJob.skippedMeetings;
  const progressPercentage = bulkJob.totalMeetings > 0
    ? Math.round((processed / bulkJob.totalMeetings) * 100)
    : 0;

  return {
    bulkJob: {
      bulkJobId: bulkJob.bulkJobId,
      status: bulkJob.status,
      totalMeetings: bulkJob.totalMeetings,
      completedMeetings: bulkJob.completedMeetings,
      failedMeetings: bulkJob.failedMeetings,
      skippedMeetings: bulkJob.skippedMeetings,
      progressPercentage,
      createdAt: bulkJob.createdAt,
      completedAt: bulkJob.completedAt,
      errorMessage: bulkJob.errorMessage,
    },
    meetingJobs: childJobs.map((j) => ({
      jobId: j.jobId,
      meetingId: j.meetingId,
      meetingTitle: j.meeting?.title || 'Untitled Meeting',
      status: j.status,
      transcriptStatus: j.transcriptStatus,
      proposalStatus: j.proposalStatus,
      pptStatus: j.pptStatus,
      errorMessage: j.errorMessage,
    })),
  };
}

// ---------------------------------------------------------------------------
// Cancel bulk job
// ---------------------------------------------------------------------------

export async function cancelBulkAnalysisJob(bulkJobId: string): Promise<boolean> {
  const bulkJob = await prisma.bulkAnalysisJob.findUnique({ where: { bulkJobId } });
  if (!bulkJob) return false;
  if (['completed', 'error', 'cancelled'].includes(bulkJob.status)) return false;

  // Cancel all queued/running child jobs
  await prisma.meetingAnalysisJob.updateMany({
    where: {
      bulkJobId,
      status: { in: ['queued', 'running'] },
    },
    data: { status: 'cancelled' },
  });

  await prisma.bulkAnalysisJob.update({
    where: { bulkJobId },
    data: {
      status: 'cancelled',
      completedAt: new Date(),
    },
  });

  logger.info('Bulk analysis job cancelled', { bulkJobId });
  return true;
}
