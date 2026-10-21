import cron from 'node-cron';
import { getPrismaClient } from '../config/database';
import { getLoggerService } from './logger.service';
import { deletePptxFromS3 } from './pptxStorage.service';

const prisma = getPrismaClient();
const logger = getLoggerService();

const EXPIRY_HOURS = 48;

function getCutoffDate(): Date {
  return new Date(Date.now() - EXPIRY_HOURS * 60 * 60 * 1000);
}

// ---- Per-model cleanup handlers ----

async function cleanupTranscriptAnalyses(): Promise<number> {
  const cutoff = getCutoffDate();

  const expired = await prisma.transcriptAnalysis.findMany({
    where: { isSaved: false, createdAt: { lt: cutoff } },
    select: { analysisId: true, pptJobId: true },
  });

  if (expired.length === 0) return 0;

  const analysisIds = expired.map((a) => a.analysisId);

  // Collect PptxJob S3 keys for cleanup
  const pptxJobs = await prisma.pptxJob.findMany({
    where: { transcriptAnalysisId: { in: analysisIds } },
    select: { jobId: true, outputFile: true },
  });

  const directPptJobIds = expired
    .map((a) => a.pptJobId)
    .filter((id): id is string => Boolean(id));

  if (directPptJobIds.length > 0) {
    const directJobs = await prisma.pptxJob.findMany({
      where: { jobId: { in: directPptJobIds } },
      select: { jobId: true, outputFile: true },
    });
    pptxJobs.push(...directJobs);
  }

  const allPptxJobIds = [...new Set(pptxJobs.map((j) => j.jobId))];
  const s3Keys = pptxJobs
    .map((j) => j.outputFile)
    .filter((f): f is string => Boolean(f));

  await prisma.$transaction(async (tx) => {
    await tx.opportunity.deleteMany({
      where: { transcriptAnalysisId: { in: analysisIds } },
    });
    await tx.pursuitBriefSnapshot.deleteMany({
      where: { transcriptAnalysisId: { in: analysisIds } },
    });
    await tx.integratorOpportunityMapping.deleteMany({
      where: { transcriptAnalysisId: { in: analysisIds } },
    });
    await tx.proposalJob.deleteMany({
      where: { transcriptAnalysisId: { in: analysisIds } },
    });
    if (allPptxJobIds.length > 0) {
      await tx.pptxJob.deleteMany({
        where: { jobId: { in: allPptxJobIds } },
      });
    }
    await tx.meetingAnalysisJob.updateMany({
      where: { transcriptAnalysisId: { in: analysisIds } },
      data: { transcriptAnalysisId: null },
    });
    await tx.transcriptAnalysis.deleteMany({
      where: { analysisId: { in: analysisIds } },
    });
  });

  for (const key of s3Keys) {
    await deletePptxFromS3(key).catch((err) =>
      logger.error('[AutoDelete] Failed to delete S3 file', err, { key })
    );
  }

  return expired.length;
}

async function cleanupWorkspaces(): Promise<number> {
  const cutoff = getCutoffDate();

  const expired = await prisma.workspace.findMany({
    where: { isSaved: false, createdAt: { lt: cutoff } },
    select: { workspaceId: true, pptxJobId: true },
  });

  if (expired.length === 0) return 0;

  const workspaceIds = expired.map((w) => w.workspaceId);
  const pptxJobIds = expired
    .map((w) => w.pptxJobId)
    .filter((id): id is string => Boolean(id));

  let s3Keys: string[] = [];
  if (pptxJobIds.length > 0) {
    const jobs = await prisma.pptxJob.findMany({
      where: { jobId: { in: pptxJobIds } },
      select: { outputFile: true },
    });
    s3Keys = jobs.map((j) => j.outputFile).filter((f): f is string => Boolean(f));
  }

  await prisma.$transaction(async (tx) => {
    await tx.workspace.updateMany({
      where: { workspaceId: { in: workspaceIds } },
      data: { pptxJobId: null },
    });
    if (pptxJobIds.length > 0) {
      await tx.pptxJob.deleteMany({
        where: { jobId: { in: pptxJobIds } },
      });
    }
    await tx.workspace.deleteMany({
      where: { workspaceId: { in: workspaceIds } },
    });
  });

  for (const key of s3Keys) {
    await deletePptxFromS3(key).catch((err) =>
      logger.error('[AutoDelete] Failed to delete S3 file', err, { key })
    );
  }

  return expired.length;
}

async function cleanupAtlassianAssessments(): Promise<number> {
  const cutoff = getCutoffDate();

  const expired = await prisma.atlassianAssessment.findMany({
    where: { isSaved: false, createdAt: { lt: cutoff } },
    select: { id: true },
  });

  if (expired.length === 0) return 0;

  const ids = expired.map((a) => a.id);

  await prisma.$transaction(async (tx) => {
    await tx.atlassianCredential.deleteMany({
      where: { assessmentId: { in: ids } },
    });
    await tx.atlassianAssessment.deleteMany({
      where: { id: { in: ids } },
    });
  });

  return expired.length;
}

async function cleanupRfpResearch(): Promise<number> {
  const cutoff = getCutoffDate();
  const result = await prisma.rfpResearch.deleteMany({
    where: { isSaved: false, createdAt: { lt: cutoff } },
  });
  return result.count;
}

async function cleanupProposalEvaluations(): Promise<number> {
  const cutoff = getCutoffDate();
  const result = await prisma.proposalEvaluation.deleteMany({
    where: { isSaved: false, createdAt: { lt: cutoff } },
  });
  return result.count;
}

async function cleanupDiscoverySessions(): Promise<number> {
  const cutoff = getCutoffDate();
  const result = await prisma.discoverySession.deleteMany({
    where: { isSaved: false, createdAt: { lt: cutoff } },
  });
  return result.count;
}

// ---- Main cleanup orchestrator ----

export async function runAutoDeleteCleanup(): Promise<void> {
  logger.info('[AutoDelete] Starting cleanup cycle');

  const results: Record<string, number> = {};

  const handlers: [string, () => Promise<number>][] = [
    ['transcriptAnalyses', cleanupTranscriptAnalyses],
    ['workspaces', cleanupWorkspaces],
    ['atlassianAssessments', cleanupAtlassianAssessments],
    ['rfpResearch', cleanupRfpResearch],
    ['proposalEvaluations', cleanupProposalEvaluations],
    ['discoverySessions', cleanupDiscoverySessions],
  ];

  for (const [name, handler] of handlers) {
    try {
      results[name] = await handler();
    } catch (err) {
      logger.error(`[AutoDelete] ${name} cleanup failed`, err);
      results[name] = 0;
    }
  }

  const totalDeleted = Object.values(results).reduce((a, b) => a + b, 0);
  if (totalDeleted > 0) {
    logger.info('[AutoDelete] Cleanup complete', { ...results, totalDeleted });
  } else {
    logger.info('[AutoDelete] Cleanup complete — nothing to delete');
  }
}

// ---- Scheduler ----

export function startAutoDeleteScheduler(): void {
  // Run every hour on the hour
  cron.schedule('0 * * * *', async () => {
    try {
      await runAutoDeleteCleanup();
    } catch (err) {
      logger.error('[AutoDelete] Scheduled cleanup error', err);
    }
  });

  // Run once at startup with 30s delay
  setTimeout(async () => {
    try {
      await runAutoDeleteCleanup();
    } catch (err) {
      logger.error('[AutoDelete] Startup cleanup error', err);
    }
  }, 30_000);

  logger.info('[AutoDelete] Scheduler started (runs every hour + once at startup)');
}
