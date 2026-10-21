import { randomUUID } from 'crypto';
import { getPrismaClient } from '../config/database';
import { TemplateManagerService } from './templateManager.service';
import {
  generatePresentationFromBuffers,
  clearContentCache,
} from './contentGeneration.service';
import {
  generatePPTXBuffer,
  clearImageCache,
} from './pptxGeneration.service';
import {
  uploadPptxToS3,
  assertPptxStorageConfigured,
} from './pptxStorage.service';

const prisma = getPrismaClient();
const templateService = new TemplateManagerService(process.env.TEMPLATE_REGISTRY_PATH);

export interface FileInput {
  buffer: Buffer;
  filename: string;
}

const safeJsonParse = <T>(value?: string | null): T | null => {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

const normalizeBaseFilename = (filename: string) => {
  const withoutExt = filename.replace(/\.pptx$/i, '');
  return (
    withoutExt
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/\.+$/, '') || 'presentation'
  );
};

const derivePresentationFilename = (presentationData: any, fallbackTitle?: string | null) => {
  const title =
    presentationData?.presentation_metadata?.title ||
    presentationData?.client_context?.company ||
    fallbackTitle ||
    'presentation';
  const sanitized = title
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 100);
  return `${sanitized}.pptx`;
};

const buildProposalFileInputs = (params: {
  proposalJob: any;
  proposalPayload: any;
  fallbackTitle?: string | null;
}): FileInput[] => {
  const { proposalJob, proposalPayload, fallbackTitle } = params;
  const files: FileInput[] = [];
  const addTextFile = (filename: string, value?: string | null) => {
    if (!value) return;
    const trimmed = value.toString().trim();
    if (!trimmed) return;
    files.push({
      filename,
      buffer: Buffer.from(trimmed, 'utf8'),
    });
  };

  addTextFile(`${fallbackTitle || 'meeting'}-final-proposal.txt`, proposalPayload?.proposal);
  addTextFile('proposal-outline.txt', proposalPayload?.outline);
  addTextFile('proposal-review.txt', proposalPayload?.review);

  if (proposalPayload?.analysis) {
    addTextFile('proposal-analysis.json', JSON.stringify(proposalPayload.analysis, null, 2));
  }

  if (proposalPayload?.clientContext) {
    addTextFile('client-context.json', JSON.stringify(proposalPayload.clientContext, null, 2));
  }

  addTextFile('rfp-summary.txt', proposalJob.rfpSummary);

  if (!files.length && proposalJob.rfpText) {
    addTextFile(`${fallbackTitle || 'meeting'}-rfp-source.txt`, proposalJob.rfpText);
  }

  return files;
};

const getPresentationStats = (presentationData: any, buffer: Buffer) => ({
  slideCount: presentationData?.slides?.length || 0,
  fileSize: `${(buffer.length / 1024 / 1024).toFixed(2)} MB`,
  fileSizeMB: buffer.length / 1024 / 1024,
  title: presentationData?.presentation_metadata?.title || 'Untitled',
  client: presentationData?.client_context?.company || 'Northstar Integrators',
});

async function getVersionedFilenameInfo(rawFilename: string) {
  const baseFilename = normalizeBaseFilename(rawFilename);
  const searchFragment = `"filenameBase":"${baseFilename}"`;
  const existingCount = await prisma.pptxJob.count({
    where: {
      metadata: {
        contains: searchFragment,
      },
    },
  });

  const version = existingCount + 1;
  const versionedFilename =
    version === 1 ? `${baseFilename}.pptx` : `${baseFilename}_v${version}.pptx`;

  return {
    versionedFilename,
    baseFilename,
    version,
  };
}

interface PptJobParams {
  proposalJobId: string;
  meetingId?: string | null;
  meetingTitle?: string | null;
  dealId?: string | null;
  transcriptAnalysisId?: string | null;
  workflowJobId?: string | null;
  requestedBy?: string | null;
  templateName?: string;
  templateVersion?: string;
}

export async function createPptJobFromProposal(params: PptJobParams) {
  const {
    proposalJobId,
    meetingId,
    meetingTitle,
    dealId,
    transcriptAnalysisId,
    workflowJobId,
    requestedBy,
    templateName: templateOverride,
    templateVersion: templateVersionOverride,
  } = params;

  assertPptxStorageConfigured();

  const proposalJob = await prisma.proposalJob.findUnique({
    where: { jobId: proposalJobId },
  });

  if (!proposalJob || proposalJob.status !== 'completed') {
    throw new Error('Proposal job is not ready for PPT generation.');
  }

  const proposalPayload = safeJsonParse<any>(proposalJob.proposalData);
  const fileInputs = buildProposalFileInputs({
    proposalJob,
    proposalPayload,
    fallbackTitle: meetingTitle,
  });

  if (fileInputs.length === 0) {
    throw new Error('No proposal content available for PPT generation.');
  }

  const templateName =
    templateOverride || process.env.ANALYSIS_WORKFLOW_PPT_TEMPLATE || templateService.getDefaultTemplate();
  const templateVersion =
    templateVersionOverride ||
    process.env.ANALYSIS_WORKFLOW_PPT_TEMPLATE_VERSION ||
    templateService.getLatestVersion(templateName);
  const templatePath = templateService.getTemplatePath(templateName, templateVersion);

  try {
    const presentationData = await generatePresentationFromBuffers(fileInputs);
    const pptxBuffer = await generatePPTXBuffer(presentationData, templatePath);
    const stats = getPresentationStats(presentationData, pptxBuffer);
    const rawFilename = derivePresentationFilename(presentationData, meetingTitle || proposalJob.fileName);
    const { versionedFilename, baseFilename, version } = await getVersionedFilenameInfo(rawFilename);

    const uploadResult = await uploadPptxToS3({
      buffer: pptxBuffer,
      filename: versionedFilename,
      metadata: {
        job_id: proposalJobId,
        workflow: workflowJobId ? 'analysis' : 'transcript',
        meeting_id: meetingId || undefined,
        deal_id: dealId || undefined,
        template: templateName,
        template_version: templateVersion,
        filename_base: baseFilename,
        filename_version: String(version),
      },
    });

    const pptxJobId = randomUUID();
    await prisma.pptxJob.create({
      data: {
        jobId: pptxJobId,
        status: 'completed',
        analysisType: workflowJobId ? 'analysis-workflow' : 'transcript-workflow',
        meetingId: meetingId || null,
        dealId: dealId || null,
        proposalJobId: proposalJobId,
        transcriptAnalysisId: transcriptAnalysisId || null,
        templateName,
        templateVersion,
        requestedBy: requestedBy || proposalJob.requestedBy,
        slideCount: stats.slideCount,
        outputFile: uploadResult.key,
        outputFileSize: pptxBuffer.length,
        stats: JSON.stringify(stats),
        presentationData: JSON.stringify(presentationData),
        metadata: JSON.stringify({
          origin: workflowJobId ? 'analysis-workflow' : 'transcript-analysis',
          workflowJobId,
          proposalJobId,
          transcriptAnalysisId,
          filename: versionedFilename,
          filenameBase: baseFilename,
          filenameVersion: version,
          bucket: uploadResult.bucket,
          s3Key: uploadResult.key,
        }),
        completedAt: new Date(),
      },
    });

    await prisma.proposalJob.update({
      where: { jobId: proposalJobId },
      data: {
        metadata: JSON.stringify({
          ...(safeJsonParse<Record<string, any>>(proposalJob.metadata) || {}),
          pptJobId: pptxJobId,
        }),
      },
    });

    return pptxJobId;
  } finally {
    clearImageCache();
    clearContentCache();
  }
}
