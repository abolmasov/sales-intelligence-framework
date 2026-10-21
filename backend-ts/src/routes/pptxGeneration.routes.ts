import { randomUUID } from 'crypto';
import { Router, Request, Response } from 'express';
import multer from 'multer';
import * as path from 'path';
import type { PptxJob } from '@prisma/client';
import { generatePPTXBuffer, clearImageCache } from '../services/pptxGeneration.service';
import { TemplateManagerService } from '../services/templateManager.service';
import {
  generatePresentationFromBuffers,
  clearContentCache,
} from '../services/contentGeneration.service';
import { getPrismaClient } from '../config/database';
import {
  assertPptxStorageConfigured,
  createPptxSignedUrl,
  uploadPptxToS3,
} from '../services/pptxStorage.service';
import { getAccessibleMeetingIdsForUserFlexible, userHasMeetingAccess, userMatchesRequestedBy } from '../utils/meetingAccess';

const router = Router();
const prisma = getPrismaClient();

class PptxCancellationError extends Error {
  constructor(message: string = 'PPTX generation cancelled') {
    super(message);
    this.name = 'PptxCancellationError';
  }
}

// Initialize template service
const templateService = new TemplateManagerService(process.env.TEMPLATE_REGISTRY_PATH);

// Helper functions
function getStatistics(presentationData: any, buffer: Buffer) {
  return {
    slideCount: presentationData?.slides?.length || 0,
    fileSize: `${(buffer.length / 1024 / 1024).toFixed(2)} MB`,
    fileSizeMB: buffer.length / 1024 / 1024,
    title: presentationData?.presentation_metadata?.title || 'Untitled',
    client: presentationData?.client_context?.company || 'Northstar Integrators'
  };
}

function extractFilename(presentationData: any): string {
  const title = presentationData?.presentation_metadata?.title ||
                presentationData?.client_context?.company ||
                'presentation';

  const sanitized = title
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 100);

  return `${sanitized}.pptx`;
}

function validatePresentationData(presentationData: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!presentationData) {
    errors.push('Presentation data is required');
    return { valid: false, errors };
  }

  if (!presentationData.slides || !Array.isArray(presentationData.slides)) {
    errors.push('Presentation data must contain slides array');
  } else if (presentationData.slides.length === 0) {
    errors.push('Presentation must contain at least one slide');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

const safeJsonParse = <T>(value?: string | null): T | null => {
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

const serializePptxJob = async (
  job: PptxJob,
  options?: { includePresentation?: boolean }
) => {
  const stats = safeJsonParse<Record<string, any>>(job.stats);
  const metadata = safeJsonParse<Record<string, any>>(job.metadata);
  const presentationData = options?.includePresentation
    ? safeJsonParse(job.presentationData)
    : undefined;

  let downloadUrl: string | null = null;
  try {
    downloadUrl = await createPptxSignedUrl(job.outputFile);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[pptx] Failed to create signed download URL for job ${job.jobId}: ${message}`);
  }

  return {
    jobId: job.jobId,
    status: job.status,
    analysisType: job.analysisType,
    requestedBy: job.requestedBy,
    templateName: job.templateName,
    templateVersion: job.templateVersion,
    slideCount: job.slideCount,
    outputFileSize: job.outputFileSize,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    completedAt: job.completedAt,
    errorMessage: job.errorMessage,
    stats,
    metadata,
    rfpFiles: safeJsonParse(job.rfpFiles),
    solutionFile: job.solutionFile,
    outputFile: job.outputFile,
    fileName: metadata?.filename || stats?.title || job.templateName || 'Presentation',
    downloadUrl,
    presentationData,
  };
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

const isPptxJobCancelled = async (jobId: string) => {
  const record = await prisma.pptxJob.findUnique({
    where: { jobId },
    select: { status: true },
  });
  return (record?.status || '').toLowerCase() === 'cancelled';
};

const assertPptxJobNotCancelled = async (jobId: string) => {
  if (await isPptxJobCancelled(jobId)) {
    throw new PptxCancellationError();
  }
};

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

// Configure file upload with memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.pdf', '.txt', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Only ${allowedExtensions.join(', ')} allowed.`));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

/**
 * POST /api/pptx/generate
 * Complete end-to-end PPTX generation from uploaded files
 */
router.post(
  '/generate',
  upload.fields([
    { name: 'rfpFiles', maxCount: 10 },
    { name: 'solutionFile', maxCount: 1 },
  ]),
  async (req: Request, res: Response) => {
    const requestId = 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const startTime = Date.now();
    let jobId: string | null = null;

    try {
      assertPptxStorageConfigured();
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };

      if (!files?.rfpFiles?.length) {
        return res.status(400).json({
          success: false,
          error: 'At least one RFP file is required',
          requestId,
        });
      }

      const rfpFileInputs = files.rfpFiles.map((file) => ({
        buffer: file.buffer,
        filename: file.originalname,
      }));
      const rfpFileMetadata = rfpFileInputs.map((file) => ({
        filename: file.filename,
        bytes: file.buffer.length,
      }));

      const solutionFileInput = files.solutionFile?.[0]
        ? {
            buffer: files.solutionFile[0].buffer,
            filename: files.solutionFile[0].originalname,
          }
        : undefined;

      const requestedTemplate = req.body.template as string | undefined;
      const requestedVersion = req.body.templateVersion as string | undefined;
      const requestedBy = req.user?.email || req.user?.userId || null;

      const pptxJobId = randomUUID();
      jobId = pptxJobId;

      await prisma.pptxJob.create({
        data: {
          jobId: pptxJobId,
          status: 'processing',
          analysisType: 'rfp',
          requestedBy,
          templateName: requestedTemplate || null,
          templateVersion: requestedVersion || null,
          rfpFiles: JSON.stringify(rfpFileMetadata),
          solutionFile: solutionFileInput?.filename || null,
          metadata: JSON.stringify({
            origin: 'pptx-generator',
            requestId,
            templateRequested: requestedTemplate || 'default',
          }),
        },
      });
      await assertPptxJobNotCancelled(pptxJobId);

      console.log('[' + requestId + '] Files received: ' + rfpFileInputs.length + ' RFP file(s)' + (solutionFileInput ? ' + 1 solution' : ''));
      console.log('[' + requestId + '] Template requested: ' + (requestedTemplate || 'default') + ', version: ' + (requestedVersion || 'default'));

      console.log('[' + requestId + '] Generating presentation content...');
      await assertPptxJobNotCancelled(pptxJobId);
      const presentation = await generatePresentationFromBuffers(rfpFileInputs, solutionFileInput, {
        shouldAbort: () => isPptxJobCancelled(pptxJobId),
      });

      console.log('[' + requestId + '] Content generated: ' + (presentation.slides?.length || 0) + ' slides');

      const templatePath = templateService.getTemplatePath(requestedTemplate, requestedVersion);
      const actualTemplate = requestedTemplate || templateService.getDefaultTemplate();
      const actualVersion = requestedVersion || templateService.getLatestVersion(actualTemplate);

      console.log('[' + requestId + '] Using template: ' + actualTemplate + ' v' + actualVersion);

      if (!templateService.validateTemplate(actualTemplate, actualVersion)) {
        throw new Error('Template validation failed for ' + actualTemplate + ' v' + actualVersion);
      }

      console.log('[' + requestId + '] Rendering PPTX...');
      await assertPptxJobNotCancelled(pptxJobId);
      const pptxBuffer = await generatePPTXBuffer(presentation, templatePath);

      const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
      const stats = getStatistics(presentation, pptxBuffer);
      const originalFilename = extractFilename(presentation);
      const { versionedFilename, baseFilename, version } = await getVersionedFilenameInfo(
        originalFilename
      );

      console.log('[' + requestId + '] PPTX generated in ' + elapsedTime + 's: ' + stats.fileSize);

      const uploadResult = await uploadPptxToS3({
        buffer: pptxBuffer,
        filename: versionedFilename,
        metadata: {
          job_id: pptxJobId,
          request_id: requestId,
          template: actualTemplate,
          template_version: actualVersion,
          generated_by: requestedBy || 'unknown',
          filename_base: baseFilename,
          filename_version: String(version),
        },
      });

      if (await isPptxJobCancelled(pptxJobId)) {
        return res.status(409).json({
          success: false,
          error: 'PPTX generation cancelled',
          requestId,
        });
      }

      await prisma.pptxJob.update({
        where: { jobId: pptxJobId },
        data: {
          status: 'completed',
          templateName: actualTemplate,
          templateVersion: actualVersion,
          slideCount: stats.slideCount,
          outputFile: uploadResult.key,
          outputFileSize: pptxBuffer.length,
          stats: JSON.stringify(stats),
          presentationData: JSON.stringify(presentation),
          metadata: JSON.stringify({
            origin: 'pptx-generator',
            requestId,
            filename: versionedFilename,
            filenameBase: baseFilename,
            filenameVersion: version,
            bucket: uploadResult.bucket,
            s3Key: uploadResult.key,
            client: stats.client,
          }),
          completedAt: new Date(),
        },
      });

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      );
      res.setHeader('Content-Disposition', 'attachment; filename="' + versionedFilename + '"');
      res.setHeader('Content-Length', pptxBuffer.length);
      res.setHeader('X-Request-ID', requestId);
      res.setHeader('X-Generation-Time', elapsedTime);
      res.setHeader('X-Template-Name', actualTemplate);
      res.setHeader('X-Template-Version', actualVersion);
      res.setHeader('X-Slide-Count', stats.slideCount.toString());
      res.setHeader('X-PPTX-Job-Id', pptxJobId);

      return res.send(pptxBuffer);

      console.log('[' + requestId + '] PPTX sent successfully');
    } catch (error: any) {
      const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
      console.error('[' + requestId + '] Error after ' + elapsedTime + 's:', error.message);

      if (jobId) {
        const cancelled = await isPptxJobCancelled(jobId).catch(() => false);
        if (!cancelled) {
          await prisma.pptxJob
            .update({
              where: { jobId },
              data: {
                status: 'error',
                errorMessage: error.message || 'Failed to generate PPTX',
                metadata: JSON.stringify({
                  origin: 'pptx-generator',
                  requestId,
                  error: error.message || 'unknown-error',
                }),
              },
            })
            .catch(() => null);
        }
      }

      if (!res.headersSent) {
        if (error instanceof PptxCancellationError || error?.name === 'GenerationCancelledError') {
          return res.status(409).json({
            success: false,
            error: 'PPTX generation cancelled',
            requestId,
            processingTime: elapsedTime,
          });
        }
        return res.status(500).json({
          success: false,
          error: error.message || 'Failed to generate PPTX',
          requestId,
          processingTime: elapsedTime,
        });
      }

      return;
    } finally {
      clearImageCache();
      clearContentCache();
    }
  }
);


/**
 * POST /api/pptx/generate-from-data
 * Generate PPTX from pre-generated presentation data
 */
router.post('/generate-from-data', async (req: Request, res: Response) => {
  const requestId = 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  const startTime = Date.now();
  let jobId: string | null = null;

  try {
    assertPptxStorageConfigured();
    const { presentationData, template, templateVersion } = req.body;

    if (!presentationData) {
      return res.status(400).json({
        success: false,
        error: 'Presentation data is required',
        requestId,
      });
    }

    const validation = validatePresentationData(presentationData);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        errors: validation.errors,
        requestId,
      });
    }

    const pptxJobId = randomUUID();
    jobId = pptxJobId;
    const requestedBy = req.user?.email || req.user?.userId || null;

    await prisma.pptxJob.create({
      data: {
        jobId: pptxJobId,
        status: 'processing',
        analysisType: 'presentation-data',
        requestedBy,
        templateName: template || null,
        templateVersion: templateVersion || null,
        presentationData: JSON.stringify(presentationData),
        metadata: JSON.stringify({
          origin: 'pptx-generator:data',
          requestId,
        }),
      },
    });
    await assertPptxJobNotCancelled(pptxJobId);

    const templatePath = templateService.getTemplatePath(template, templateVersion);
    const actualTemplate = template || templateService.getDefaultTemplate();
    const actualVersion = templateVersion || templateService.getLatestVersion(actualTemplate);

    console.log('[' + requestId + '] Rendering PPTX from prepared data using ' + actualTemplate + ' v' + actualVersion);

    await assertPptxJobNotCancelled(pptxJobId);
    const pptxBuffer = await generatePPTXBuffer(presentationData, templatePath);

    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
    const stats = getStatistics(presentationData, pptxBuffer);
    const originalFilename = extractFilename(presentationData);
    const { versionedFilename, baseFilename, version } = await getVersionedFilenameInfo(
      originalFilename
    );

    const uploadResult = await uploadPptxToS3({
      buffer: pptxBuffer,
      filename: versionedFilename,
      metadata: {
        job_id: pptxJobId,
        request_id: requestId,
        template: actualTemplate,
        template_version: actualVersion,
        generated_by: requestedBy || 'unknown',
        filename_base: baseFilename,
        filename_version: String(version),
      },
    });

    if (await isPptxJobCancelled(pptxJobId)) {
      return res.status(409).json({
        success: false,
        error: 'PPTX generation cancelled',
        requestId,
      });
    }

    await prisma.pptxJob.update({
      where: { jobId: pptxJobId },
      data: {
        status: 'completed',
        templateName: actualTemplate,
        templateVersion: actualVersion,
        slideCount: stats.slideCount,
        outputFile: uploadResult.key,
        outputFileSize: pptxBuffer.length,
        stats: JSON.stringify(stats),
        metadata: JSON.stringify({
          origin: 'pptx-generator:data',
          requestId,
          filename: versionedFilename,
          filenameBase: baseFilename,
          filenameVersion: version,
          bucket: uploadResult.bucket,
          s3Key: uploadResult.key,
        }),
        completedAt: new Date(),
      },
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    );
    res.setHeader('Content-Disposition', 'attachment; filename="' + versionedFilename + '"');
    res.setHeader('Content-Length', pptxBuffer.length);
    res.setHeader('X-Request-ID', requestId);
    res.setHeader('X-Generation-Time', elapsedTime);
    res.setHeader('X-Template-Name', actualTemplate);
    res.setHeader('X-Template-Version', actualVersion);
    res.setHeader('X-Slide-Count', stats.slideCount.toString());
    res.setHeader('X-PPTX-Job-Id', pptxJobId);

    return res.send(pptxBuffer);

    clearImageCache();

    console.log('[' + requestId + '] PPTX generated in ' + elapsedTime + 's');
  } catch (error: any) {
    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error('[' + requestId + '] Error:', error.message);

    if (jobId) {
      const cancelled = await isPptxJobCancelled(jobId).catch(() => false);
      if (!cancelled) {
        await prisma.pptxJob
          .update({
            where: { jobId },
            data: {
              status: 'error',
              errorMessage: error.message || 'Failed to generate PPTX',
              metadata: JSON.stringify({
                origin: 'pptx-generator:data',
                requestId,
                error: error.message || 'unknown-error',
              }),
            },
          })
          .catch(() => null);
      }
    }

    clearImageCache();

    if (error instanceof PptxCancellationError || error?.name === 'GenerationCancelledError') {
      return res.status(409).json({
        success: false,
        error: 'PPTX generation cancelled',
        requestId,
        processingTime: elapsedTime,
      });
    }

    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate PPTX',
      requestId,
      processingTime: elapsedTime,
    });
  }
});



router.get('/jobs', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Missing authenticated user id' });
    }

    const limitParam = Number(req.query.limit);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 200) : 50;
    const jobs = await prisma.pptxJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.max(limit * 4, 200),
    });

    const meetingIds = jobs
      .map((job: any) => job.meetingId)
      .filter((id: any): id is string => Boolean(id));
    const accessibleMeetingIds = await getAccessibleMeetingIdsForUserFlexible(userId, meetingIds);

    const visible = jobs
      .filter((job: any) => {
        if (job.meetingId) {
          return accessibleMeetingIds.has(job.meetingId);
        }
        return userMatchesRequestedBy(req.user, job.requestedBy);
      })
      .slice(0, limit);

    const data = await Promise.all(visible.map((job: PptxJob) => serializePptxJob(job)));
    return res.json({ success: true, data });
  } catch (error) {
    console.error('Failed to load PPTX jobs', error);
    return res.status(500).json({ success: false, error: 'Failed to load PPTX job history' });
  }
});

router.get('/jobs/:jobId', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Missing authenticated user id' });
    }

    const job = await prisma.pptxJob.findUnique({ where: { jobId: req.params.jobId } });
    if (!job) {
      return res.status(404).json({ success: false, error: 'PPTX job not found' });
    }

    if (job.meetingId) {
      const canView = await userHasMeetingAccess(userId, job.meetingId);
      if (!canView) {
        return res.status(403).json({ success: false, error: 'You do not have access to this meeting.' });
      }
    } else if (!userMatchesRequestedBy(req.user, job.requestedBy)) {
      return res.status(403).json({ success: false, error: 'You do not have access to this job.' });
    }

    const data = await serializePptxJob(job, { includePresentation: true });
    return res.json({ success: true, data });
  } catch (error) {
    console.error('Failed to load PPTX job detail', error);
    return res.status(500).json({ success: false, error: 'Failed to load PPTX job detail' });
  }
});

router.post('/jobs/:jobId/cancel', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Missing authenticated user id' });
    }

    const jobId = (req.params.jobId || '').trim();
    if (!jobId) {
      return res.status(400).json({ success: false, error: 'Missing jobId' });
    }

    const job = await prisma.pptxJob.findUnique({
      where: { jobId },
      select: { jobId: true, meetingId: true, requestedBy: true, status: true },
    });
    if (!job) {
      return res.status(404).json({ success: false, error: 'PPTX job not found' });
    }

    if (job.meetingId) {
      const canCancel = await userHasMeetingAccess(userId, job.meetingId);
      if (!canCancel) {
        return res.status(403).json({ success: false, error: 'You do not have access to this meeting.' });
      }
    } else if (!userMatchesRequestedBy(req.user, job.requestedBy)) {
      return res.status(403).json({ success: false, error: 'You do not have access to this job.' });
    }

    const normalizedStatus = (job.status || '').toLowerCase();
    const cancellable = ['queued', 'processing'].includes(normalizedStatus);
    if (!cancellable) {
      return res.json({
        success: false,
        message: 'PPTX job is not running',
        data: { jobId, cancelled: false },
      });
    }

    await prisma.pptxJob.update({
      where: { jobId },
      data: {
        status: 'cancelled',
        errorMessage: 'Cancelled by user',
        completedAt: new Date(),
      },
    });

    return res.json({
      success: true,
      message: 'PPTX job cancelled',
      data: { jobId, cancelled: true },
    });
  } catch (error: any) {
    console.error('Failed to cancel PPTX job', error);
    return res.status(500).json({ success: false, error: error?.message || 'Failed to cancel PPTX job' });
  }
});

router.delete('/jobs/:jobId', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Missing authenticated user id' });
    }

    const jobId = (req.params.jobId || '').trim();
    if (!jobId) {
      return res.status(400).json({ success: false, error: 'Missing jobId' });
    }

    const job = await prisma.pptxJob.findUnique({
      where: { jobId },
      select: { jobId: true, meetingId: true, requestedBy: true, status: true },
    });
    if (!job) {
      return res.status(404).json({ success: false, error: 'PPTX job not found' });
    }

    if (job.meetingId) {
      const canDelete = await userHasMeetingAccess(userId, job.meetingId);
      if (!canDelete) {
        return res.status(403).json({ success: false, error: 'You do not have access to this meeting.' });
      }
    } else if (!userMatchesRequestedBy(req.user, job.requestedBy)) {
      return res.status(403).json({ success: false, error: 'You do not have access to this job.' });
    }

    const normalizedStatus = (job.status || '').toLowerCase();
    const deletable = !['queued', 'processing'].includes(normalizedStatus);
    if (!deletable) {
      return res.status(409).json({
        success: false,
        error: 'PPTX job is still running. Cancel it before deleting.',
        data: { jobId, deleted: false },
      });
    }

    await prisma.pptxJob.delete({ where: { jobId } });

    return res.json({
      success: true,
      message: 'PPTX job deleted',
      data: { jobId, deleted: true },
    });
  } catch (error: any) {
    console.error('Failed to delete PPTX job', error);
    return res.status(500).json({ success: false, error: error?.message || 'Failed to delete PPTX job' });
  }
});

/**
 * PATCH /api/pptx/jobs/:jobId
 * Update/edit the PPTX presentation data (for editable outputs feature)
 */
router.patch('/jobs/:jobId', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Missing authenticated user id' });
    }

    const { jobId } = req.params;
    const { editedPresentationData } = req.body;

    if (!editedPresentationData) {
      return res.status(400).json({ success: false, error: 'editedPresentationData is required' });
    }

    const job = await prisma.pptxJob.findUnique({ where: { jobId } });

    if (!job) {
      return res.status(404).json({ success: false, error: 'PPTX job not found' });
    }

    if (job.meetingId) {
      const canEdit = await userHasMeetingAccess(userId, job.meetingId);
      if (!canEdit) {
        return res.status(403).json({ success: false, error: 'You do not have access to edit this job.' });
      }
    } else if (!userMatchesRequestedBy(req.user, job.requestedBy)) {
      return res.status(403).json({ success: false, error: 'You do not have access to edit this job.' });
    }

    // Update the edited presentation data
    await prisma.pptxJob.update({
      where: { jobId },
      data: {
        editedPresentationData: typeof editedPresentationData === 'string'
          ? editedPresentationData
          : JSON.stringify(editedPresentationData),
        lastEditedAt: new Date(),
      },
    });

    return res.json({
      success: true,
      message: 'PPTX job updated successfully',
      data: { jobId, lastEditedAt: new Date().toISOString() },
    });
  } catch (error) {
    console.error('Failed to update PPTX job', error);
    return res.status(500).json({ success: false, error: 'Failed to update PPTX job' });
  }
});

/**
 * POST /api/pptx/validate-data
 * Validate presentation data without generating PPTX
 */
router.post('/validate-data', (req: Request, res: Response) => {
  try {
    const { presentationData } = req.body;

    if (!presentationData) {
      return res.status(400).json({
        success: false,
        error: 'Presentation data is required'
      });
    }

    const validation = validatePresentationData(presentationData);

    return res.json({
      success: validation.valid,
      errors: validation.errors,
      slideCount: presentationData.slides?.length || 0
    });

  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/pptx/info
 * Get PPTX generation service information
 */
router.get('/info', (req: Request, res: Response) => {
  return res.json({
    service: 'PPTX Generation Service',
    version: '1.0.0',
    supportedFormats: ['PDF', 'TXT', 'DOCX'],
    maxFileSize: '10MB',
    maxFiles: 10,
    templates: templateService.getAllTemplatesInfo(),
    defaultTemplate: templateService.getDefaultTemplate(),
    endpoints: {
      generate: 'POST /api/pptx/generate',
      generateFromData: 'POST /api/pptx/generate-from-data',
      validateData: 'POST /api/pptx/validate-data',
      info: 'GET /api/pptx/info'
    }
  });
});

export default router;
