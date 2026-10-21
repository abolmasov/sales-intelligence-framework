import { randomUUID } from 'crypto';
import { getPrismaClient } from '../config/database';
import { getEnhancedTranscriptAnalysisService } from './enhanced-transcript-analysis.service';
import { createProposalJobFromTranscript } from './proposalJob.service';
import { createPptJobFromProposal } from './analysisArtifacts.service';
import { updatePursuitBriefFromTranscript } from './pursuitBrief.service';
import { syncOpportunitiesFromAnalysis } from './opportunity-sync.service';
import { getLoggerService } from './logger.service';
import { isProposalQueueEnabled } from './jobQueue.service';
import { sendNotification, NotificationType } from './notification.service';
import { downloadPptxFromS3, isPptxStorageConfigured } from './pptxStorage.service';

const prisma = getPrismaClient();
const enhancedAnalysisService = getEnhancedTranscriptAnalysisService();
const logger = getLoggerService();

class CancellationError extends Error {
  constructor(message: string = 'Cancelled') {
    super(message);
    this.name = 'CancellationError';
  }
}

async function assertJobNotCancelled(jobId: string): Promise<void> {
  const record = await prisma.meetingAnalysisJob.findUnique({
    where: { jobId },
    select: { status: true },
  });
  if (!record) {
    throw new CancellationError('Job not found');
  }
  if ((record.status || '').toLowerCase() === 'cancelled') {
    throw new CancellationError();
  }
}

const deriveMetricsFromResult = (result: any) => {
  const data = result?.data;
  const opportunities = Array.isArray(data?.opportunitiesDetected)
    ? data?.opportunitiesDetected.length
    : 0;

  const opportunityScore = opportunities > 0 ? Math.min(100, 50 + opportunities * 5) : null;

  const sentimentOverall = data?.overallSentiment || result?.overallSentiment || null;
  const sentimentShort = result?.sentiment || data?.sentiment || null;

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

export async function processAnalysisWorkflowJob(jobId: string, accessToken?: string | null) {
  const job = await prisma.meetingAnalysisJob.findUnique({
    where: { jobId },
    include: { meeting: true },
  });

  if (!job) return;
  if (['completed', 'error', 'cancelled'].includes(job.status)) return;

  await assertJobNotCancelled(jobId);
  await prisma.meetingAnalysisJob.update({
    where: { jobId },
    data: { status: 'running' },
  });

  try {
    await assertJobNotCancelled(jobId);
    let transcriptAnalysisId = job.transcriptAnalysisId;
    let proposalJobId = job.proposalJobId || null;

    if (job.runTranscript) {
      transcriptAnalysisId = await runTranscriptStage(job, accessToken || undefined);
    } else if (!transcriptAnalysisId) {
      const existing = await prisma.transcriptAnalysis.findFirst({
        where: { meetingId: job.meetingId },
        orderBy: { analyzedAt: 'desc' },
      });
      transcriptAnalysisId = existing?.analysisId || null;
    }

    if (job.runProposal) {
      await assertJobNotCancelled(jobId);
      proposalJobId = await runProposalStage(job, transcriptAnalysisId, accessToken || null);
    }

    if (job.runPpt) {
      await assertJobNotCancelled(jobId);
      if (isProposalQueueEnabled()) {
        await prisma.meetingAnalysisJob.update({
          where: { jobId },
          data: { pptStatus: 'queued' },
        });
      } else {
        if (!proposalJobId) {
          const latestProposal = await prisma.proposalJob.findFirst({
            where: {
              meetingId: job.meetingId,
              status: 'completed',
            },
            orderBy: { completedAt: 'desc' },
          });
          proposalJobId = latestProposal?.jobId || null;
        }
        await runPptStage(job, proposalJobId);
      }
    }

    await assertJobNotCancelled(jobId);
    await prisma.meetingAnalysisJob.update({
      where: { jobId },
      data: {
        status: 'completed',
        completedAt: new Date(),
      },
    });

    // Send completion notification
    await sendPipelineNotification(job, 'pipeline_complete', accessToken || undefined);
  } catch (error: any) {
    if (error instanceof CancellationError) {
      logger.info('Analysis workflow cancelled', { jobId });
      return;
    }
    await prisma.meetingAnalysisJob.update({
      where: { jobId },
      data: {
        status: 'error',
        errorMessage: error?.message || 'Analysis workflow failed',
      },
    });
    logger.error('Analysis workflow encountered an error', error, { jobId });

    // Send error notification
    await sendPipelineNotification(job, 'pipeline_error', accessToken || undefined, error?.message);
    throw error;
  }
}

/**
 * Send notification when pipeline stage completes
 */
async function sendPipelineNotification(
  job: any,
  type: NotificationType,
  accessToken?: string,
  errorMessage?: string
): Promise<void> {
  try {
    if (!job.requestedBy) {
      logger.info('Skipping notification - no requestedBy on job', { jobId: job.jobId });
      return;
    }

    const meeting = job.meeting || (await prisma.meeting.findUnique({
      where: { meetingId: job.meetingId },
      include: { deal: true },
    }));

    const companyName = meeting?.deal?.companyName || meeting?.title || 'Northstar Integrators';
    const meetingTitle = meeting?.title || 'Meeting';

    let title = '';
    let message = '';

    switch (type) {
      case 'transcript_complete':
        title = `Transcript Analysis Complete: ${companyName}`;
        message = `The transcript analysis for "${meetingTitle}" is ready for review.`;
        break;
      case 'proposal_complete':
        title = `Proposal Generated: ${companyName}`;
        message = `A new proposal has been generated for "${meetingTitle}".`;
        break;
      case 'ppt_complete':
        title = `PowerPoint Ready: ${companyName}`;
        message = `The presentation for "${meetingTitle}" is ready to download.`;
        break;
      case 'pipeline_complete':
        title = `Analysis Pipeline Complete: ${companyName}`;
        message = `All analysis artifacts for "${meetingTitle}" are ready.`;
        break;
      case 'pipeline_error':
        title = `Pipeline Error: ${companyName}`;
        message = `There was an issue processing "${meetingTitle}": ${errorMessage || 'Unknown error'}`;
        break;
      default:
        title = `Update: ${companyName}`;
        message = `Analysis update for "${meetingTitle}".`;
    }

    // For pipeline_complete and ppt_complete, try to attach the PPTX file
    let attachments: Array<{ name: string; contentType: string; contentBytes: string }> | undefined;

    if ((type === 'pipeline_complete' || type === 'ppt_complete') && job.sendEmailNotification && isPptxStorageConfigured()) {
      try {
        // Get the latest PPTX job for this meeting
        const pptxJob = await prisma.pptxJob.findFirst({
          where: {
            meetingId: job.meetingId,
            status: 'completed',
            outputFile: { not: null },
          },
          orderBy: { completedAt: 'desc' },
        });

        if (pptxJob?.outputFile) {
          const pptxData = await downloadPptxFromS3(pptxJob.outputFile);
          if (pptxData) {
            attachments = [{
              name: pptxData.filename || `${companyName.replace(/[^a-zA-Z0-9]/g, '_')}_Presentation.pptx`,
              contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
              contentBytes: pptxData.buffer.toString('base64'),
            }];
            logger.info('PPTX attachment prepared for email', {
              jobId: job.jobId,
              filename: pptxData.filename,
              size: pptxData.buffer.length,
            });
          }
        }
      } catch (attachError) {
        logger.error('Failed to prepare PPTX attachment', attachError, { jobId: job.jobId });
        // Continue without attachment
      }
    }

    await sendNotification({
      type,
      userId: job.requestedBy,
      userEmail: job.requestedByEmail || undefined,
      accessToken,
      title,
      message,
      dealId: meeting?.dealId || undefined,
      meetingId: job.meetingId,
      meetingTitle,
      companyName,
      sendEmail: job.sendEmailNotification === true,
      analysisData: errorMessage ? { error: errorMessage } : undefined,
      attachments,
    });

    logger.info('Pipeline notification sent', {
      jobId: job.jobId,
      type,
      userId: job.requestedBy,
      sendEmail: job.sendEmailNotification,
      hasAttachments: !!attachments?.length,
    });
  } catch (error) {
    logger.error('Failed to send pipeline notification', error, { jobId: job.jobId, type });
  }
}

async function runTranscriptStage(job: any, accessToken?: string) {
  await assertJobNotCancelled(job.jobId);
  await prisma.meetingAnalysisJob.update({
    where: { jobId: job.jobId },
    data: { transcriptStatus: 'running' },
  });

  logger.info('Transcript stage started', { jobId: job.jobId, meetingId: job.meetingId });

  try {
    await assertJobNotCancelled(job.jobId);
    let transcriptContent = job.transcriptText || null;

    if (!transcriptContent) {
      const meeting = await prisma.meeting.findUnique({
        where: { meetingId: job.meetingId },
        include: { deal: true, account: true },
      });
      if (meeting?.transcript && meeting.transcript.trim().length > 0) {
        transcriptContent = meeting.transcript;
      }
    }

    if (!transcriptContent) {
      throw new Error('Transcript text is required for transcript analysis.');
    }

    const meetingRecord =
      job.meeting || (await prisma.meeting.findUnique({
        where: { meetingId: job.meetingId },
        include: { deal: true, account: true },
      }));

    const resolvedCompanyName =
      meetingRecord?.deal?.companyName ||
      meetingRecord?.account?.name ||
      meetingRecord?.title ||
      'Transcript Analysis';

    const normalizedTranscriptText = String(transcriptContent || '').replace(/\u0000/g, '');

    const enhancedResults = await enhancedAnalysisService.analyzeTranscript({
      transcriptText: normalizedTranscriptText,
      companyName: resolvedCompanyName,
      meetingTitle: meetingRecord?.title || undefined,
      dealId: meetingRecord?.dealId || undefined,
      accountId: meetingRecord?.accountId || undefined,
      accessToken,
    });

    await assertJobNotCancelled(job.jobId);
    if (enhancedResults?.error) {
      throw new Error(enhancedResults.error);
    }

    const metrics = deriveMetricsFromResult(enhancedResults);

    const meetingTitle = meetingRecord?.title || job.meeting?.title || 'Transcript Analysis';
    const companyName =
      resolvedCompanyName ||
      job.meeting?.deal?.companyName ||
      job.meeting?.account?.name ||
      meetingRecord?.title ||
      job.meeting?.title ||
      'Transcript Analysis';
    const resolvedAccountId =
      meetingRecord?.accountId ?? job.meeting?.accountId ?? null;
    const resolvedDealId =
      meetingRecord?.dealId ?? job.meeting?.dealId ?? null;

    let analysisResultText = '{}';
    try {
      const serialized = JSON.stringify(enhancedResults);
      if (serialized && serialized.trim().length > 0) {
        analysisResultText = serialized;
      }
    } catch (serializationError) {
      logger.error('Failed to serialize enhanced transcript analysis result', serializationError, {
        jobId: job.jobId,
        meetingId: job.meetingId,
      });
    }
    analysisResultText = analysisResultText.replace(/\u0000/g, '');

    const analysisPayload = {
      meetingTitle,
      companyName,
      accountId: resolvedAccountId,
      dealId: resolvedDealId,
      transcriptText: normalizedTranscriptText,
      transcriptExcerpt: normalizedTranscriptText.substring(0, 500),
      analysisResult: analysisResultText,
      opportunityScore: metrics.opportunityScore ?? null,
      sentimentOverall: metrics.sentimentOverall ?? null,
      sentimentShort: metrics.sentimentShort ?? null,
      successProbability: metrics.successProbability ?? null,
      analyzedAt: new Date(),
      status: 'completed',
      errorMessage: null,
    };

    const existingTranscript = await prisma.transcriptAnalysis.findFirst({
      where: { meetingId: job.meetingId },
      orderBy: { analyzedAt: 'desc' },
    });

    const transcriptRecord = existingTranscript
      ? await prisma.transcriptAnalysis.update({
          where: { analysisId: existingTranscript.analysisId },
          data: analysisPayload,
        })
      : await prisma.transcriptAnalysis.create({
          data: {
            analysisId: randomUUID(),
            meetingId: job.meetingId,
            ...analysisPayload,
          },
        });

    await assertJobNotCancelled(job.jobId);
    await syncOpportunitiesFromAnalysis({
      analysisId: transcriptRecord.analysisId,
      rawAnalysis: enhancedResults,
      dealId: meetingRecord?.dealId || job.meeting?.dealId || null,
      meetingId: job.meetingId,
    });

    await assertJobNotCancelled(job.jobId);
    await prisma.meetingAnalysisJob.update({
      where: { jobId: job.jobId },
      data: {
        transcriptStatus: 'completed',
        transcriptAnalysisId: transcriptRecord.analysisId,
      },
    });

    if (meetingRecord?.dealId) {
      await updatePursuitBriefFromTranscript(meetingRecord.dealId, transcriptRecord.analysisId);
    }

    logger.info('Transcript stage completed', {
      jobId: job.jobId,
      meetingId: job.meetingId,
      transcriptAnalysisId: transcriptRecord.analysisId,
      storedAt: 'transcript_analyses',
    });

    return transcriptRecord.analysisId;
  } catch (error) {
    if (error instanceof CancellationError) {
      throw error;
    }
    await prisma.meetingAnalysisJob.update({
      where: { jobId: job.jobId },
      data: {
        transcriptStatus: 'error',
        errorMessage: error instanceof Error ? error.message : 'Transcript analysis failed',
      },
    });
    logger.error('Transcript stage failed', error, { jobId: job.jobId, meetingId: job.meetingId });
    throw error;
  }
}

async function runProposalStage(
  job: any,
  transcriptAnalysisId: string | null,
  accessToken?: string | null
): Promise<string> {
  if (!transcriptAnalysisId) {
    throw new Error('Transcript analysis is required before generating a proposal.');
  }

  await assertJobNotCancelled(job.jobId);
  await prisma.meetingAnalysisJob.update({
    where: { jobId: job.jobId },
    data: { proposalStatus: 'running' },
  });

  logger.info('Proposal stage started', {
    jobId: job.jobId,
    meetingId: job.meetingId,
    transcriptAnalysisId,
  });

  try {
    await assertJobNotCancelled(job.jobId);
    const queueEnabled = isProposalQueueEnabled();
    const proposalJob = await createProposalJobFromTranscript({
      transcriptAnalysisId,
      meetingId: job.meetingId,
      analysisType: 'enhanced',
      accessToken: accessToken || null,
      awaitProcessing: true,
      metadata: {
        initiatedFrom: 'analysis-workflow',
        workflowJobId: job.jobId,
        autoPptRequested: !!job.runPpt,
        pptRequest: job.runPpt
          ? {
              meetingId: job.meetingId,
              meetingTitle: job.meeting?.title,
              dealId: job.meeting?.dealId,
              workflowJobId: job.jobId,
            }
          : undefined,
      },
    });

    await assertJobNotCancelled(job.jobId);
    await prisma.meetingAnalysisJob.update({
      where: { jobId: job.jobId },
      data: {
        proposalStatus: queueEnabled ? 'queued' : 'completed',
        proposalJobId: proposalJob.jobId,
      },
    });

    logger.info(queueEnabled ? 'Proposal job queued for async processing' : 'Proposal stage completed', {
      jobId: job.jobId,
      meetingId: job.meetingId,
      proposalJobId: proposalJob.jobId,
    });

    return proposalJob.jobId;
  } catch (error) {
    if (error instanceof CancellationError) {
      throw error;
    }
    await prisma.meetingAnalysisJob.update({
      where: { jobId: job.jobId },
      data: {
        proposalStatus: 'error',
        errorMessage: error instanceof Error ? error.message : 'Proposal generation failed',
      },
    });
    logger.error('Proposal stage failed', error, {
      jobId: job.jobId,
      meetingId: job.meetingId,
      transcriptAnalysisId,
    });
    throw error;
  }
}

async function runPptStage(job: any, proposalJobId: string | null): Promise<void> {
  if (!proposalJobId) {
    throw new Error('Proposal must be completed before generating a PPT.');
  }

  await assertJobNotCancelled(job.jobId);
  await prisma.meetingAnalysisJob.update({
    where: { jobId: job.jobId },
    data: { pptStatus: 'running' },
  });

  logger.info('PPT stage started', { jobId: job.jobId, proposalJobId });

  try {
    await assertJobNotCancelled(job.jobId);
    const pptJobId = await createPptJobFromProposal({
      proposalJobId,
      meetingId: job.meetingId,
      meetingTitle: job.meeting?.title,
      dealId: job.meeting?.dealId || null,
      workflowJobId: job.jobId,
    });

    await assertJobNotCancelled(job.jobId);
    await prisma.meetingAnalysisJob.update({
      where: { jobId: job.jobId },
      data: {
        pptStatus: 'completed',
        pptJobId,
      },
    });
    logger.info('PPT stage completed', {
      jobId: job.jobId,
      proposalJobId,
      pptJobId,
      storedAt: 'pptx_jobs',
    });
  } catch (error) {
    if (error instanceof CancellationError) {
      throw error;
    }
    await prisma.meetingAnalysisJob.update({
      where: { jobId: job.jobId },
      data: {
        pptStatus: 'error',
        errorMessage: error instanceof Error ? error.message : 'PPT generation failed',
      },
    });
    logger.error('PPT stage failed', error, { jobId: job.jobId, proposalJobId });
    throw error;
  }
}
