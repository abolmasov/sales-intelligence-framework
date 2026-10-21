import { randomUUID } from 'crypto';
import { getPrismaClient } from '../config/database';
import { getEnhancedTranscriptAnalysisService } from './enhanced-transcript-analysis.service';
import { updatePursuitBriefFromTranscript } from './pursuitBrief.service';
import { syncOpportunitiesFromAnalysis } from './opportunity-sync.service';
import { createProposalJobFromTranscript } from './proposalJob.service';
import { getLoggerService } from './logger.service';
import { enqueueTranscriptJob, isProposalQueueEnabled } from './jobQueue.service';
import { decryptTranscript } from '../utils/transcriptCrypto';

const prisma = getPrismaClient();
const enhancedAnalysisService = getEnhancedTranscriptAnalysisService();
const logger = getLoggerService();

type TranscriptStatus = 'processing' | 'completed' | 'error' | 'queued';

const deriveMetricsFromResult = (result: any) => {
  const data = result?.data;
  const opportunities = Array.isArray(data?.opportunitiesDetected) ? data?.opportunitiesDetected.length : 0;

  const opportunityScore = opportunities > 0 ? Math.min(100, 50 + opportunities * 5) : null;

  const sentimentOverall = data?.overallSentiment || result?.overallSentiment || data?.sentiment?.overall || null;
  const rawSentiment = result?.sentiment || data?.sentiment || null;
  const sentimentShort = rawSentiment && typeof rawSentiment === 'object'
    ? JSON.stringify(rawSentiment)
    : rawSentiment ?? null;

  let successProbability: number | null = null;
  const confidenceStr = data?.sentimentAnalysis?.[0]?.confidence;
  if (confidenceStr) {
    const parsed = parseFloat(String(confidenceStr).replace('%', ''));
    if (!Number.isNaN(parsed)) {
      successProbability = parsed;
    }
  }

  return {
    opportunityScore,
    sentimentOverall,
    sentimentShort,
    successProbability,
  };
};

export async function processTranscriptJob(analysisId: string, accessToken?: string | null) {
  const record = await prisma.transcriptAnalysis.findUnique({ where: { analysisId } });
  if (!record || !record.transcriptText) {
    throw new Error('Transcript analysis record not found or missing transcript text');
  }

  const normalizedStatus = (record.status || '').toLowerCase();
  if (normalizedStatus === 'cancelled') {
    logger.info('Transcript analysis cancelled; skipping processing', { analysisId });
    return;
  }

  try {
    let meetingContext: string | undefined;
    try {
      const parsed = record.analysisResult ? JSON.parse(record.analysisResult) : null;
      const raw = parsed?.metadata?.meetingContext;
      if (typeof raw === 'string' && raw.trim()) {
        meetingContext = raw.trim();
      }
    } catch {
      // ignore invalid JSON
    }

    const enhancedResults = await enhancedAnalysisService.analyzeTranscript({
      transcriptText: decryptTranscript(record.transcriptText),
      companyName: record.companyName || undefined,
      meetingTitle: record.meetingTitle || undefined,
      meetingContext,
      dealId: record.dealId ?? undefined,
      accountId: record.accountId ?? undefined,
      accessToken: accessToken ?? undefined,
    });

    const latest = await prisma.transcriptAnalysis.findUnique({
      where: { analysisId },
      select: { status: true },
    });
    if ((latest?.status || '').toLowerCase() === 'cancelled') {
      logger.info('Transcript analysis cancelled mid-run; skipping save', { analysisId });
      return;
    }

    if (enhancedResults?.error) {
      throw new Error(enhancedResults.error);
    }

    const metrics = deriveMetricsFromResult(enhancedResults);

    await prisma.transcriptAnalysis.update({
      where: { analysisId },
      data: {
        analysisResult: JSON.stringify(enhancedResults),
        opportunityScore: metrics.opportunityScore ?? null,
        sentimentOverall: metrics.sentimentOverall ?? null,
        sentimentShort: metrics.sentimentShort ?? null,
        successProbability: metrics.successProbability ?? null,
        analyzedAt: new Date(),
        status: 'completed',
        errorMessage: null,
      },
    });

    await syncOpportunitiesFromAnalysis({
      analysisId,
      rawAnalysis: enhancedResults,
      dealId: record.dealId ?? undefined,
      meetingId: record.meetingId ?? undefined,
    });

    if (record.dealId) {
      await updatePursuitBriefFromTranscript(record.dealId, analysisId);
    }

    await triggerFollowupArtifacts(record.analysisId, accessToken ?? null);
    logger.info('Transcript analysis job completed', { analysisId, storedAt: 'transcript_analyses' });
  } catch (error: any) {
    logger.error('Transcript analysis job failed', error, { analysisId });
    await prisma.transcriptAnalysis.update({
      where: { analysisId },
      data: {
        status: 'error',
        errorMessage: error?.message || 'Analysis failed',
        analysisResult: JSON.stringify({
          error: error?.message || 'Analysis failed',
        }),
      },
    });
    throw error;
  }
}

async function triggerFollowupArtifacts(analysisId: string, accessToken: string | null) {
  const record = await prisma.transcriptAnalysis.findUnique({
    where: { analysisId },
  });

  if (!record) return;

  const queueEnabled = isProposalQueueEnabled();

  if (record.autoProposalRequested && !record.proposalJobId) {
    try {
      const proposalJob = await createProposalJobFromTranscript({
        transcriptAnalysisId: record.analysisId,
        meetingId: record.meetingId,
        requestedBy: record.requestedBy || null,
        analysisType: 'enhanced',
        accessToken,
        awaitProcessing: record.autoPptRequested && !queueEnabled,
        metadata: {
          initiatedFrom: 'transcript-analysis',
          transcriptAnalysisId: record.analysisId,
          dealId: record.dealId,
          autoPptRequested: record.autoPptRequested,
          pptRequest: record.autoPptRequested
            ? {
                meetingId: record.meetingId,
                meetingTitle: record.meetingTitle,
                dealId: record.dealId,
                transcriptAnalysisId: record.analysisId,
                requestedBy: record.requestedBy || undefined,
              }
            : undefined,
        },
      });

      await prisma.transcriptAnalysis.update({
        where: { analysisId },
        data: { proposalJobId: proposalJob.jobId },
      });

      // PPT is intentionally left out per request; existing flow handles PPT when enabled elsewhere.
    } catch (error) {
      logger.error('Failed to trigger follow-up artifacts for transcript', error, { analysisId });
    }
  }
}

export async function scheduleTranscriptJobProcessing(
  analysisId: string,
  accessToken: string | null,
  options?: { awaitCompletion?: boolean }
): Promise<void> {
  const awaitCompletion = options?.awaitCompletion ?? false;
  if (isProposalQueueEnabled()) {
    await enqueueTranscriptJob({ type: 'transcript', analysisId, accessToken: accessToken || null });
    if (awaitCompletion) {
      logger.warn('Transcript job requested synchronous completion but queue is enabled; running asynchronously.', {
        analysisId,
      });
    }
    return;
  }

  const run = async () => {
    await processTranscriptJob(analysisId, accessToken);
  };

  if (awaitCompletion) {
    await run();
    return;
  }

  setImmediate(() => {
    run().catch((error) => {
      logger.error(`Background transcript job ${analysisId} crashed`, error, { analysisId });
    });
  });
}
