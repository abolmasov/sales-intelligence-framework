import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { getPrismaClient } from '../config/database';
import { getPDFService } from './pdf.service';
import { getProposalWorkflow } from './langgraph-workflow.service';
import { getProjectAnalysisService } from './project-analysis.service';
import { getLoggerService } from './logger.service';
import { enqueueProposalJob, isProposalQueueEnabled } from './jobQueue.service';
import { createPptJobFromProposal } from './analysisArtifacts.service';
import { getInternalKnowledgeService } from './internal-knowledge.service';
import { getProposalEvaluationService } from './proposal-evaluation.service';
import { getRFPResearchService } from './rfp-research.service';

const prisma = getPrismaClient();
const pdfService = getPDFService();
const proposalWorkflow = getProposalWorkflow();
const projectAnalysisService = getProjectAnalysisService();
const internalKbService = getInternalKnowledgeService();
const proposalEvaluationService = getProposalEvaluationService();
const rfpResearchService = getRFPResearchService();
const logger = getLoggerService();

class CancellationError extends Error {
  constructor(message: string = 'Cancelled') {
    super(message);
    this.name = 'CancellationError';
  }
}

const assertProposalJobNotCancelled = async (jobId: string) => {
  const job = await prisma.proposalJob.findUnique({
    where: { jobId },
    select: { status: true },
  });
  if (!job) throw new CancellationError('Job not found');
  if ((job.status || '').toLowerCase() === 'cancelled') {
    throw new CancellationError();
  }
};

const isProposalJobCancelled = async (jobId: string) => {
  const job = await prisma.proposalJob.findUnique({
    where: { jobId },
    select: { status: true },
  });
  return (job?.status || '').toLowerCase() === 'cancelled';
};

const sanitizeText = (text: string | null | undefined) =>
  typeof text === 'string' ? text.replace(/\u0000/g, '') : '';

const safeJsonParse = (value?: string | null) => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch (error) {
    console.warn('Failed to parse JSON payload from proposal job', error);
    return null;
  }
};

const sleep = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

const compactText = (value: unknown, maxChars: number): string => {
  const raw = typeof value === 'string' ? value : JSON.stringify(value || {});
  return sanitizeText(raw).replace(/\s+/g, ' ').trim().slice(0, maxChars);
};

const mapInternalKnowledgeResultsToDocuments = (
  internalKbSummary: string,
  internalKbDocuments: any[] = []
): { id: string; name: string; text: string }[] => {
  const results: { id: string; name: string; text: string }[] = [];

  const summaryText = sanitizeText(internalKbSummary);
  if (summaryText.trim().length > 0) {
    results.push({
      id: 'internal-kb-summary',
      name: 'InternalKnowledge Research Summary',
      text: summaryText,
    });
  }

  internalKbDocuments.slice(0, 10).forEach((doc, idx) => {
    const text = sanitizeText(doc.content || doc.metadata?.excerpt || '');
    if (!text.trim()) return;
    results.push({
      id: doc.id || `internal-kb-doc-${idx}`,
      name: doc.title || 'InternalKnowledge Document',
      text,
    });
  });

  return results;
};

type ProposalEvaluationQueuedFile = {
  fileName: string;
  mimeType?: string;
  contentBase64: string;
};

type ProposalEvaluationQueuedPayload = {
  mode: 'proposal_evaluation';
  rfp: ProposalEvaluationQueuedFile;
  proposal: ProposalEvaluationQueuedFile;
  pursuitBrief?: ProposalEvaluationQueuedFile;
  pursuitBriefText?: string;
};

const parseProposalEvaluationPayload = (value: string): ProposalEvaluationQueuedPayload => {
  const parsed = JSON.parse(value) as ProposalEvaluationQueuedPayload;
  if (!parsed || parsed.mode !== 'proposal_evaluation' || !parsed.rfp || !parsed.proposal) {
    throw new Error('Invalid proposal evaluation payload');
  }
  if (!parsed.rfp.contentBase64 || !parsed.proposal.contentBase64) {
    throw new Error('Missing file payload for proposal evaluation');
  }
  return parsed;
};

const inferExtension = (fileName: string, mimeType?: string) => {
  const fromName = path.extname(fileName || '').toLowerCase();
  if (fromName) return fromName;
  if (!mimeType) return '.txt';
  if (mimeType.includes('pdf')) return '.pdf';
  if (mimeType.includes('wordprocessingml')) return '.docx';
  if (mimeType.includes('msword')) return '.doc';
  if (mimeType.includes('spreadsheetml')) return '.xlsx';
  if (mimeType.includes('ms-excel')) return '.xls';
  if (mimeType.includes('markdown')) return '.md';
  return '.txt';
};

const writeQueuedFileToTemp = (
  jobId: string,
  queuedFile: ProposalEvaluationQueuedFile,
  label: 'rfp' | 'proposal' | 'pursuit'
) => {
  const tempDir = path.join(os.tmpdir(), 'proposal-evaluation-jobs');
  fs.mkdirSync(tempDir, { recursive: true });
  const ext = inferExtension(queuedFile.fileName, queuedFile.mimeType);
  const tempPath = path.join(tempDir, `${jobId}-${label}-${Date.now()}${ext}`);
  const content = Buffer.from(queuedFile.contentBase64, 'base64');
  fs.writeFileSync(tempPath, content);
  return tempPath;
};

export async function scheduleProposalJobProcessing(
  jobId: string,
  accessToken: string | null,
  options?: { awaitCompletion?: boolean }
): Promise<void> {
  const awaitCompletion = options?.awaitCompletion ?? false;

  if (isProposalQueueEnabled()) {
    await enqueueProposalJob({ type: 'proposal', jobId, accessToken: accessToken || null });
    if (awaitCompletion) {
      logger.warn('Proposal job requested synchronous completion but queue is enabled; running asynchronously.', {
        jobId,
      });
    }
    return;
  }

  const run = async () => {
    try {
      await processProposalJob(jobId, accessToken);
    } catch (error) {
      logger.error(`Proposal job ${jobId} failed during background processing`, error, { jobId });
    }
  };

  if (awaitCompletion) {
    await run();
    return;
  }

  setImmediate(() => {
    run().catch((error) => {
      logger.error(`Background proposal job ${jobId} crashed`, error, { jobId });
    });
  });
}

export const serializeProposalJobRecord = (job: any, includeDetails = false) => ({
  jobId: job.jobId,
  analysisType: job.analysisType,
  status: job.status,
  currentStep: job.currentStep,
  requestedBy: job.requestedBy,
  meetingId: job.meetingId,
  fileName: job.fileName,
  fileSize: job.fileSize,
  mimeType: job.mimeType,
  createdAt: job.createdAt,
  updatedAt: job.updatedAt,
  completedAt: job.completedAt,
  metadata: safeJsonParse(job.metadata),
  rfpSummary: job.rfpSummary,
  errorMessage: job.errorMessage,
  ...(includeDetails
    ? {
        proposalData: safeJsonParse(job.proposalData),
      }
    : {}),
});

export async function processProposalJob(jobId: string, accessToken: string | null) {
  const startTime = Date.now();
  let metadataState: Record<string, any> = {};

  const updateStep = async (currentStep: string, metadataPatch?: Record<string, any>) => {
    await assertProposalJobNotCancelled(jobId);
    if (metadataPatch) {
      metadataState = { ...metadataState, ...metadataPatch };
    }
    await prisma.proposalJob.update({
      where: { jobId },
      data: {
        currentStep,
        metadata: Object.keys(metadataState).length ? JSON.stringify(metadataState) : null,
      },
    });
  };

  try {
    await assertProposalJobNotCancelled(jobId);
    const job = await prisma.proposalJob.findUnique({ where: { jobId } });
    if (!job || !job.rfpText) {
      throw new Error('RFP text not found for this job');
    }

    if ((job.status || '').toLowerCase() === 'cancelled') {
      logger.info('Proposal job cancelled; skipping processing', { jobId });
      return;
    }

    metadataState = safeJsonParse(job.metadata) || {};

    if (job.analysisType === 'proposal_evaluation') {
      await updateStep('extract_documents', { mode: 'proposal_evaluation' });
      const payload = parseProposalEvaluationPayload(job.rfpText);
      const tempPaths: string[] = [];

      try {
        const rfpPath = writeQueuedFileToTemp(jobId, payload.rfp, 'rfp');
        const proposalPath = writeQueuedFileToTemp(jobId, payload.proposal, 'proposal');
        tempPaths.push(rfpPath, proposalPath);

        let pursuitBriefPath: string | undefined;
        if (payload.pursuitBrief?.contentBase64) {
          pursuitBriefPath = writeQueuedFileToTemp(jobId, payload.pursuitBrief, 'pursuit');
          tempPaths.push(pursuitBriefPath);
        } else if (payload.pursuitBriefText && payload.pursuitBriefText.trim()) {
          const inlinePath = path.join(
            os.tmpdir(),
            'proposal-evaluation-jobs',
            `${jobId}-pursuit-${Date.now()}.txt`
          );
          fs.writeFileSync(inlinePath, payload.pursuitBriefText, 'utf8');
          pursuitBriefPath = inlinePath;
          tempPaths.push(inlinePath);
        }

        await updateStep('analyzing', { progress: 20 });
        const evaluationResult = await proposalEvaluationService.runEvaluationFromFiles(
          jobId,
          rfpPath,
          proposalPath,
          pursuitBriefPath
        );

        await updateStep('saving', { progress: 95 });
        const totalTime = Date.now() - startTime;

        await prisma.proposalJob.update({
          where: { jobId },
          data: {
            status: 'completed',
            currentStep: 'completed',
            proposalData: JSON.stringify(evaluationResult),
            rfpText: null,
            completedAt: new Date(),
            metadata: JSON.stringify({
              ...metadataState,
              mode: 'proposal_evaluation',
              totalTime,
              progress: 100,
            }),
          },
        });

        logger.info('Proposal evaluation job completed', { jobId, totalTimeMs: totalTime });
        return;
      } finally {
        for (const tempPath of tempPaths) {
          try {
            fs.unlinkSync(tempPath);
          } catch {
            // ignore temp cleanup failures
          }
        }
      }
    }

    if (job.analysisType === 'rfp_research') {
      await updateStep('extract_requirements', { mode: 'rfp_research', textLength: job.rfpText.length });

      const customPrompt =
        metadataState && typeof metadataState.customPrompt === 'string' && metadataState.customPrompt.trim().length > 0
          ? metadataState.customPrompt.trim()
          : undefined;

      await updateStep('researching', {
        hasCustomPrompt: Boolean(customPrompt),
      });

      const result = await rfpResearchService.processRFP(
        job.rfpText,
        accessToken || undefined,
        undefined,
        customPrompt
      );

      const totalTime = Date.now() - startTime;
      await prisma.proposalJob.update({
        where: { jobId },
        data: {
          status: 'completed',
          currentStep: 'completed',
          proposalData: JSON.stringify(result),
          rfpText: null,
          completedAt: new Date(),
          metadata: JSON.stringify({
            ...metadataState,
            mode: 'rfp_research',
            totalTime,
            processingTimeMs: result?.metadata?.processingTimeMs ?? totalTime,
            totalQuestions: result?.metadata?.totalQuestions ?? 0,
            answeredQuestions: result?.metadata?.answeredQuestions ?? 0,
          }),
        },
      });

      logger.info('RFP research job completed', {
        jobId,
        totalTimeMs: totalTime,
        totalQuestions: result?.metadata?.totalQuestions ?? 0,
      });
      return;
    }

    await updateStep('extract_requirements', { textLength: job.rfpText.length });
    const rfpRequirements = pdfService.extractRFPRequirements(job.rfpText);

    await updateStep('analyze_context', { requirementsLength: rfpRequirements.length });
    const projectName = await projectAnalysisService.extractProjectName(rfpRequirements);
    const clientContext = await projectAnalysisService.extractClientContext(rfpRequirements);

    let internalKbDocuments: any[] = [];
    let projectDocumentsText: any[] = [];
    let internalKbSummary = '';

    if (job.analysisType !== 'quick') {
      await updateStep('search_documents');
      const internalKbContext = [
        `Project: ${projectName || 'Unknown Project'}`,
        `Client context: ${compactText(clientContext, 700)}`,
        `RFP summary: ${compactText(rfpRequirements, 900)}`,
        'Need: relevant past engagements, similar case studies, proposal/SOW artifacts.',
      ].join('\n');

      await updateStep('search_internal_kb');
      const maxKmhubAttempts = 3;
      let internalKbSuccess = false;
      let lastKmhubError: string | null = null;

      for (let attempt = 1; attempt <= maxKmhubAttempts; attempt++) {
        if (await isProposalJobCancelled(jobId)) {
          throw new CancellationError();
        }
        logger.info('InternalKnowledge proposal search attempt started', { jobId, attempt, maxKmhubAttempts });
        try {
          const internalKbResults = await internalKbService.searchWithStructuredSections(
            projectName || job.fileName || 'Client Research',
            internalKbContext,
            accessToken || '',
            {
              shouldAbort: () => isProposalJobCancelled(jobId),
            }
          );
          internalKbDocuments = internalKbResults.documents || [];
          internalKbSummary = internalKbResults.summary || '';
          projectDocumentsText = mapInternalKnowledgeResultsToDocuments(internalKbSummary, internalKbDocuments);

          if (projectDocumentsText.length > 0 || internalKbSummary.trim().length > 0) {
            internalKbSuccess = true;
            logger.info('InternalKnowledge proposal search succeeded', {
              jobId,
              attempt,
              documentCount: internalKbDocuments.length,
              internalKbSummaryLength: internalKbSummary.length,
            });
            break;
          }

          lastKmhubError = 'InternalKnowledge returned empty result';
          logger.warn('InternalKnowledge proposal search returned empty result', { jobId, attempt });
        } catch (internalKbError) {
          lastKmhubError = internalKbError instanceof Error ? internalKbError.message : 'InternalKnowledge search failed';
          logger.warn('InternalKnowledge proposal search attempt failed', {
            jobId,
            attempt,
            maxKmhubAttempts,
            error: lastKmhubError,
          });
        }

        if (attempt < maxKmhubAttempts) {
          await sleep(attempt * 1500);
        }
      }

      if (!internalKbSuccess) {
        internalKbDocuments = [];
        internalKbSummary = '';
        projectDocumentsText = [];
        logger.warn('InternalKnowledge failed after retries; proceeding with RFP-only context', {
          jobId,
          attempts: maxKmhubAttempts,
          lastKmhubError,
        });
      }

      await updateStep('load_internal_kb_documents', {
        documentCount: internalKbDocuments.length,
        internalKbSummaryLength: internalKbSummary.length,
        sharepointCount: 0,
        internalKbError: internalKbSuccess ? null : (lastKmhubError || 'InternalKnowledge search failed'),
        usedRfpOnlyFallback: !internalKbSuccess,
      });
    } else {
      await updateStep('skip_document_search', {
        reason: 'quick-analysis',
      });
    }

    await assertProposalJobNotCancelled(jobId);
    await updateStep('workflow');
    const result = await proposalWorkflow.generateProposal(
      rfpRequirements,
      { projectName, internalKbSummary },
      clientContext,
      projectDocumentsText
    );

    await assertProposalJobNotCancelled(jobId);
    if (!result.finalProposal) {
      throw new Error('Proposal generation returned no result');
    }

    logger.info('Proposal generated', {
      jobId,
      projectName,
      proposalLength: result.finalProposal.length,
    });

    const totalTime = Date.now() - startTime;
    const payload = {
      projectName,
      proposal: result.finalProposal,
      analysis: result.analysis,
      outline: result.outline,
      review: result.review,
      metadata: {
        relatedDocumentsLoaded: projectDocumentsText.length,
        totalTime,
        finalProposalLength: result.finalProposal?.length || 0,
        internalKbSummaryLength: internalKbSummary.length,
        sharepointDocumentsExamined: 0,
      },
      clientContext,
      internalKbSummary,
    };

    await assertProposalJobNotCancelled(jobId);
    await prisma.proposalJob.update({
      where: { jobId },
      data: {
        status: 'completed',
        currentStep: 'completed',
        proposalData: JSON.stringify(payload),
        rfpText: null,
        completedAt: new Date(),
        metadata: JSON.stringify({
          ...metadataState,
          totalTime,
          relatedDocumentsLoaded: projectDocumentsText.length,
          sharepointDocumentsExamined: 0,
        }),
      },
    });

    const workflowJobId = metadataState.workflowJobId as string | undefined;
    if (workflowJobId) {
      await prisma.meetingAnalysisJob.update({
        where: { jobId: workflowJobId },
        data: {
          proposalStatus: 'completed',
          proposalJobId: jobId,
        },
      });
    }

    const pptRequest = metadataState.pptRequest;
    if (metadataState.autoPptRequested && pptRequest) {
      try {
        const pptJobId = await createPptJobFromProposal({
          proposalJobId: jobId,
          meetingId: pptRequest.meetingId ?? job.meetingId ?? undefined,
          meetingTitle: pptRequest.meetingTitle ?? job.fileName ?? undefined,
          dealId: pptRequest.dealId ?? job.dealId ?? undefined,
          transcriptAnalysisId: pptRequest.transcriptAnalysisId ?? job.transcriptAnalysisId ?? undefined,
          requestedBy: pptRequest.requestedBy ?? job.requestedBy ?? undefined,
          workflowJobId: workflowJobId ?? pptRequest.workflowJobId ?? undefined,
        });

        if (workflowJobId) {
          await prisma.meetingAnalysisJob.update({
            where: { jobId: workflowJobId },
            data: {
              pptStatus: 'completed',
              pptJobId,
            },
          });
        }
      } catch (pptError) {
        logger.error(`Auto PPT generation failed for proposal job ${jobId}`, pptError, { jobId });
        if (workflowJobId) {
          await prisma.meetingAnalysisJob.update({
            where: { jobId: workflowJobId },
            data: {
              pptStatus: 'error',
              errorMessage:
                pptError instanceof Error ? pptError.message : 'PPT generation failed after proposal completion',
            },
          });
        }
      }
    }

    logger.info('Proposal stored in database', {
      jobId,
      relatedDocumentsLoaded: projectDocumentsText.length,
      totalTimeMs: totalTime,
      storedAt: 'proposal_jobs',
    });
  } catch (error) {
    if (error instanceof CancellationError) {
      logger.info('Proposal job cancelled', { jobId });
      return;
    }
    logger.error(`Proposal job ${jobId} failed`, error, {
      jobId,
    });
    await prisma.proposalJob.update({
      where: { jobId },
      data: {
        status: 'error',
        currentStep: 'error',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        rfpText: null,
        completedAt: new Date(),
      },
    });

    const workflowJobId = metadataState.workflowJobId as string | undefined;
    if (workflowJobId) {
      await prisma.meetingAnalysisJob.update({
        where: { jobId: workflowJobId },
        data: {
          proposalStatus: 'error',
          errorMessage: error instanceof Error ? error.message : 'Proposal generation failed',
        },
      });
    }
  }
}

type TranscriptJobParams = {
  transcriptAnalysisId: string;
  meetingId?: string | null;
  requestedBy?: string | null;
  analysisType?: 'quick' | 'enhanced';
  accessToken?: string | null;
  awaitProcessing?: boolean;
  metadata?: Record<string, unknown>;
};

const pickFirstString = (payload: any, paths: string[]): string | null => {
  for (const path of paths) {
    const segments = path.split('.');
    let current = payload;
    for (const segment of segments) {
      if (current && typeof current === 'object' && segment in current) {
        current = current[segment];
      } else {
        current = undefined;
        break;
      }
    }
    if (typeof current === 'string' && current.trim()) {
      return current.trim();
    }
  }
  return null;
};

const normalizeList = (value: any): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (!item) return '';
        if (typeof item === 'string') {
          return item.trim();
        }
        if (typeof item === 'object') {
          const fields = [
            item.title,
            item.name,
            item.summary,
            item.description,
            item.detail,
            item.impact,
            item.value,
          ].filter(Boolean);
          if (fields.length) {
            return fields.join(' — ');
          }
          return JSON.stringify(item);
        }
        return String(item);
      })
      .filter((entry) => entry && entry.trim());
  }
  if (typeof value === 'string') {
    return value
      .split(/\n+/)
      .map((line) => line.replace(/^[*-]\s*/, '').trim())
      .filter(Boolean);
  }
  if (typeof value === 'object') {
    try {
      return Object.values(value)
        .map((entry) => (typeof entry === 'string' ? entry : JSON.stringify(entry)))
        .filter((entry) => Boolean(entry));
    } catch {
      return [];
    }
  }
  return [];
};

const firstNonEmptyList = (...candidates: Array<string[]>) => {
  for (const candidate of candidates) {
    if (candidate && candidate.length) {
      return candidate;
    }
  }
  return [];
};

const formatSection = (title: string, body: string | string[] | null | undefined) => {
  if (!body) return null;
  if (Array.isArray(body)) {
    if (!body.length) return null;
    return `${title}:\n${body.map((line) => `- ${line}`).join('\n')}`;
  }
  const trimmed = body.toString().trim();
  return trimmed ? `${title}:\n${trimmed}` : null;
};

const buildTranscriptDrivenRfpText = ({
  transcriptText,
  meetingTitle,
  meetingDate,
  meetingNotes,
  parsedResult,
}: {
  transcriptText: string;
  meetingTitle?: string | null;
  meetingDate?: Date | null;
  meetingNotes?: string | null;
  parsedResult: any;
}) => {
  const summary =
    pickFirstString(parsedResult, [
      'summary',
      'executiveSummary',
      'overview',
      'data.summary',
      'data.executiveSummary',
      'data.overview',
    ]) || '';
  const keyPoints = firstNonEmptyList(
    normalizeList(pickFirstString(parsedResult, ['keyPoints', 'keyDiscussionPoints', 'data.keyPoints'])),
    normalizeList(parsedResult.keyPoints),
    normalizeList(parsedResult.keyDiscussionPoints),
    normalizeList(parsedResult?.data?.keyPoints)
  );
  const actionItems = firstNonEmptyList(
    normalizeList(pickFirstString(parsedResult, ['actionItems', 'nextSteps', 'data.actionItems'])),
    normalizeList(parsedResult.actionItems),
    normalizeList(parsedResult.nextSteps),
    normalizeList(parsedResult?.data?.actionItems)
  );
  const opportunities = firstNonEmptyList(
    normalizeList(pickFirstString(parsedResult, ['opportunitiesDetected', 'opportunities'])),
    normalizeList(parsedResult.opportunitiesDetected),
    normalizeList(parsedResult.opportunities),
    normalizeList(parsedResult?.data?.opportunitiesDetected)
  );
  const sentiment =
    pickFirstString(parsedResult, ['overallSentiment', 'sentiment', 'data.overallSentiment']) ||
    null;

  const sections = [
    formatSection(
      'Meeting Overview',
      [
        meetingTitle ? `Title: ${meetingTitle}` : null,
        meetingDate ? `Date: ${meetingDate.toISOString()}` : null,
      ]
        .filter(Boolean)
        .join('\n')
    ),
    meetingNotes ? formatSection('Meeting Notes', meetingNotes) : null,
    formatSection('Executive Summary', summary || transcriptText.substring(0, 500)),
    formatSection('Key Discussion Points', keyPoints),
    formatSection('Action Items & Next Steps', actionItems),
    formatSection('Opportunities Detected', opportunities),
    sentiment ? formatSection('Customer Sentiment', sentiment) : null,
  ].filter(Boolean);

  const combined = sections.join('\n\n').trim();
  return sanitizeText(combined || transcriptText);
};

export async function createProposalJobFromTranscript(params: TranscriptJobParams) {
  const {
    transcriptAnalysisId,
    meetingId,
    requestedBy,
    analysisType = 'enhanced',
    accessToken = null,
    awaitProcessing = false,
    metadata = {},
  } = params;

  const transcriptRecord = await prisma.transcriptAnalysis.findUnique({
    where: { analysisId: transcriptAnalysisId },
  });

  if (!transcriptRecord) {
    throw new Error('Transcript analysis not found');
  }

  const resolvedMeetingId = transcriptRecord.meetingId || meetingId || null;
  const resolvedDealId = transcriptRecord.dealId || null;
  const meetingRecord = resolvedMeetingId
    ? await prisma.meeting.findUnique({
        where: { meetingId: resolvedMeetingId },
      })
    : null;

  const parsedResult =
    typeof transcriptRecord.analysisResult === 'string'
      ? safeJsonParse(transcriptRecord.analysisResult) || {}
      : transcriptRecord.analysisResult || {};

  const rfpText = buildTranscriptDrivenRfpText({
    transcriptText: transcriptRecord.transcriptText,
    meetingTitle: meetingRecord?.title || transcriptRecord.meetingTitle || null,
    meetingDate: meetingRecord?.meetingDate || null,
    meetingNotes: meetingRecord?.notes || null,
    parsedResult,
  });

  if (!rfpText || !rfpText.trim()) {
    throw new Error('Unable to derive proposal input from transcript analysis.');
  }

  const jobId = uuidv4();
  const textByteLength = Buffer.byteLength(rfpText, 'utf8');

  const metadataPayload = {
    ...(metadata || {}),
    source: (metadata && (metadata as any).source) || 'transcript-analysis',
    transcriptAnalysisId,
    meetingId: resolvedMeetingId,
    dealId: resolvedDealId,
    textLength: rfpText.length,
  };

  const job = await prisma.proposalJob.create({
    data: {
      jobId,
      requestedBy: requestedBy || null,
      meetingId: resolvedMeetingId,
      dealId: resolvedDealId,
      transcriptAnalysisId,
      analysisType,
      status: 'processing',
      currentStep: 'queued',
      fileName: meetingRecord?.title
        ? `${meetingRecord.title} transcript analysis`
        : 'transcript-analysis.txt',
      fileSize: textByteLength,
      mimeType: 'text/plain',
      rfpText,
      rfpSummary: rfpText.substring(0, 500),
      metadata: JSON.stringify(metadataPayload),
    },
  });

  await scheduleProposalJobProcessing(jobId, accessToken, { awaitCompletion: awaitProcessing });

  return job;
}
