import axios from 'axios';
import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import multer from 'multer';
import pdfParse from '@cedrugs/pdf-parse';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { getPrismaClient } from '../config/database';
import { getLoggerService } from '../services/logger.service';
import { getOpenAIService } from '../services/openai.service';
import { processWorkspacePipeline, cancelWorkspacePipeline } from '../services/workspace.service';
import { createPptxSignedUrl, isPptxStorageConfigured } from '../services/pptxStorage.service';
import { generatePPTXBuffer } from '../services/pptxGeneration.service';
import { TemplateManagerService } from '../services/templateManager.service';

const mammoth = require('mammoth');
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } }); // 25MB limit (Whisper max)

/** Safely parse JSON, returning fallback on failure */
function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

const router = Router();
const prisma = getPrismaClient();
const logger = getLoggerService();

const AUDIO_MIMETYPES = new Set([
  'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/m4a', 'audio/wav',
  'audio/wave', 'audio/x-wav', 'audio/webm', 'audio/ogg', 'audio/flac',
  'audio/x-flac', 'video/mp4', 'video/webm',
]);

const TEXT_MIMETYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);

async function extractTextFromFile(buffer: Buffer, mimetype: string): Promise<string> {
  if (mimetype === 'application/pdf') {
    const parsed = await pdfParse(buffer);
    return parsed.text || '';
  }
  if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const parsed = await mammoth.extractRawText({ buffer });
    return parsed.value || '';
  }
  if (mimetype.startsWith('text/')) {
    return buffer.toString('utf-8');
  }
  throw new Error(`Unsupported text file type: ${mimetype}`);
}

async function transcribeAudioFile(buffer: Buffer, filename: string): Promise<string> {
  const openai = getOpenAIService();
  return openai.transcribeAudio(buffer, filename);
}

// ---------------------------------------------------------------------------
// POST /api/workspaces — Create a new workspace
// ---------------------------------------------------------------------------
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const userId = (req as any).user?.userId;
    if (!userId) throw new AppError('Missing authenticated user id', 401);

    const { name, description, transcriptText, clientName, workshopDate, workshopDuration, accountId, dealId, workspaceType, workshopFocus } =
      req.body;

    if (!name?.trim()) throw new AppError('Workspace name is required', 400);
    // workshop_prep and client_engagement workspaces start with no transcript
    const noTranscriptRequired = workspaceType === 'workshop_prep' || workspaceType === 'client_engagement';
    if (!noTranscriptRequired && !transcriptText?.trim()) throw new AppError('Transcript text is required', 400);

    const workspace = await prisma.workspace.create({
      data: {
        workspaceId: randomUUID(),
        name: name.trim(),
        description: description?.trim() || null,
        transcriptText: transcriptText?.trim() || null,
        transcriptExcerpt: transcriptText?.trim()?.substring(0, 500) || null,
        clientName: clientName?.trim() || null,
        workshopDate: workshopDate ? new Date(workshopDate) : null,
        workshopDuration: workshopDuration || null,
        accountId: accountId || null,
        dealId: dealId || null,
        requestedBy: userId,
        requestedByEmail: (req as any).user?.email || null,
        status: 'draft',
        workspaceType: workspaceType || 'workshop_analysis',
        workshopFocus: workshopFocus || 'ITSM',
      },
    });

    logger.info('[Workspace] Created', { workspaceId: workspace.workspaceId, userId });

    res.json({
      success: true,
      data: {
        workspace_id: workspace.workspaceId,
        name: workspace.name,
        status: workspace.status,
      },
    });
  }),
);

// ---------------------------------------------------------------------------
// POST /api/workspaces/upload — Create workspace from file (audio, PDF, DOCX, TXT)
// ---------------------------------------------------------------------------
router.post(
  '/upload',
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId;
    if (!userId) throw new AppError('Missing authenticated user id', 401);

    const file = req.file;
    if (!file) throw new AppError('File is required', 400);

    const { name, description, clientName, workshopDate, accountId, dealId, workspaceType } = req.body;
    if (!name?.trim()) throw new AppError('Workspace name is required', 400);

    const isAudio = AUDIO_MIMETYPES.has(file.mimetype);
    const isText = TEXT_MIMETYPES.has(file.mimetype) || file.mimetype.startsWith('text/');

    if (!isAudio && !isText) {
      throw new AppError(
        'Unsupported file type. Supported: audio (MP3, M4A, WAV, WEBM, OGG, FLAC, MP4) or text (PDF, DOCX, TXT).',
        400,
      );
    }

    logger.info('[Workspace] File upload', {
      userId,
      filename: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      isAudio,
    });

    // Extract / transcribe
    let transcriptText: string;
    if (isAudio) {
      transcriptText = await transcribeAudioFile(file.buffer, file.originalname);
    } else {
      transcriptText = await extractTextFromFile(file.buffer, file.mimetype);
    }

    if (!transcriptText.trim()) {
      throw new AppError('Could not extract any text from the uploaded file.', 400);
    }

    // Create workspace
    const workspace = await prisma.workspace.create({
      data: {
        workspaceId: randomUUID(),
        name: name.trim(),
        description: description?.trim() || null,
        transcriptText: transcriptText.trim(),
        transcriptExcerpt: transcriptText.trim().substring(0, 500),
        clientName: clientName?.trim() || null,
        workshopDate: workshopDate ? new Date(workshopDate) : null,
        accountId: accountId || null,
        dealId: dealId || null,
        requestedBy: userId,
        requestedByEmail: (req as any).user?.email || null,
        status: 'draft',
        workspaceType: workspaceType || 'workshop_analysis',
      },
    });

    logger.info('[Workspace] Created from file', {
      workspaceId: workspace.workspaceId,
      userId,
      source: isAudio ? 'audio' : 'document',
      wordCount: transcriptText.split(/\s+/).length,
    });

    res.json({
      success: true,
      data: {
        workspace_id: workspace.workspaceId,
        name: workspace.name,
        status: workspace.status,
        source: isAudio ? 'audio_transcription' : 'document_extraction',
        word_count: transcriptText.split(/\s+/).length,
      },
    });
  }),
);

// ---------------------------------------------------------------------------
// POST /api/workspaces/upload-multi — Create workspace from multiple files
// ---------------------------------------------------------------------------
router.post(
  '/upload-multi',
  upload.array('files', 10),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId;
    if (!userId) throw new AppError('Missing authenticated user id', 401);

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) throw new AppError('At least one file is required', 400);

    const { name, description, clientName, workshopDate, accountId, dealId, workspaceType } = req.body;
    if (!name?.trim()) throw new AppError('Workspace name is required', 400);

    // Parse optional source types for each file
    const sourceTypes: string[] = req.body.sourceTypes
      ? safeJsonParse<string[]>(req.body.sourceTypes, files.map(() => 'other'))
      : files.map(() => 'other');

    // Process each file
    const sourceDocuments: Array<{
      documentId: string; originalFilename: string; mimeType: string;
      sizeBytes: number; sourceType: string; extractedWordCount: number; uploadedAt: string;
    }> = [];
    const textParts: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isAudio = AUDIO_MIMETYPES.has(file.mimetype);
      const isText = TEXT_MIMETYPES.has(file.mimetype) || file.mimetype.startsWith('text/');

      if (!isAudio && !isText) {
        throw new AppError(`Unsupported file type for "${file.originalname}": ${file.mimetype}`, 400);
      }

      let extractedText: string;
      if (isAudio) {
        extractedText = await transcribeAudioFile(file.buffer, file.originalname);
      } else {
        extractedText = await extractTextFromFile(file.buffer, file.mimetype);
      }

      if (!extractedText.trim()) {
        throw new AppError(`Could not extract text from "${file.originalname}"`, 400);
      }

      const sourceType = sourceTypes[i] || 'other';

      sourceDocuments.push({
        documentId: randomUUID(),
        originalFilename: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        sourceType,
        extractedWordCount: extractedText.split(/\s+/).length,
        uploadedAt: new Date().toISOString(),
      });

      textParts.push(
        `--- DOCUMENT: ${file.originalname} (type: ${sourceType}) ---\n${extractedText.trim()}`,
      );
    }

    const combinedText = textParts.join('\n\n');

    const workspace = await prisma.workspace.create({
      data: {
        workspaceId: randomUUID(),
        name: name.trim(),
        description: description?.trim() || null,
        transcriptText: combinedText,
        transcriptExcerpt: combinedText.substring(0, 500),
        clientName: clientName?.trim() || null,
        workshopDate: workshopDate ? new Date(workshopDate) : null,
        accountId: accountId || null,
        dealId: dealId || null,
        requestedBy: userId,
        requestedByEmail: (req as any).user?.email || null,
        status: 'draft',
        workspaceType: workspaceType || 'user_story_generation',
        sourceDocuments: JSON.stringify(sourceDocuments),
      },
    });

    logger.info('[Workspace] Created from multi-file upload', {
      workspaceId: workspace.workspaceId,
      userId,
      fileCount: files.length,
      totalWordCount: combinedText.split(/\s+/).length,
    });

    res.json({
      success: true,
      data: {
        workspace_id: workspace.workspaceId,
        name: workspace.name,
        status: workspace.status,
        workspace_type: workspace.workspaceType,
        source_documents: sourceDocuments,
        total_word_count: combinedText.split(/\s+/).length,
      },
    });
  }),
);

// ---------------------------------------------------------------------------
// POST /api/workspaces/:workspaceId/upload-responses — Upload Phase 2 survey responses
// to an existing workshop_prep workspace (replaces transcript content)
// ---------------------------------------------------------------------------
router.post(
  '/:workspaceId/upload-responses',
  upload.array('files', 10),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId;
    if (!userId) throw new AppError('Missing authenticated user id', 401);

    const { workspaceId } = req.params;
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) throw new AppError('At least one file is required', 400);

    const ws = await prisma.workspace.findUnique({ where: { workspaceId } });
    if (!ws) throw new AppError('Workspace not found', 404);
    if (ws.requestedBy !== userId) throw new AppError('Access denied', 403);

    const textParts: string[] = [];
    const sourceDocuments: Array<{
      documentId: string; originalFilename: string; mimeType: string;
      sizeBytes: number; sourceType: string; extractedWordCount: number; uploadedAt: string;
    }> = [];

    for (const file of files) {
      const isText = TEXT_MIMETYPES.has(file.mimetype) || file.mimetype.startsWith('text/');
      if (!isText) throw new AppError(`Unsupported file type: ${file.mimetype}`, 400);

      const text = await extractTextFromFile(file.buffer, file.mimetype);
      if (!text.trim()) throw new AppError(`Could not extract text from "${file.originalname}"`, 400);

      textParts.push(`--- DOCUMENT: ${file.originalname} (type: survey_response) ---\n${text.trim()}`);
      sourceDocuments.push({
        documentId: randomUUID(),
        originalFilename: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        sourceType: 'notes',
        extractedWordCount: text.split(/\s+/).length,
        uploadedAt: new Date().toISOString(),
      });
    }

    const combinedText = textParts.join('\n\n');

    await prisma.workspace.update({
      where: { workspaceId },
      data: {
        transcriptText: combinedText,
        transcriptExcerpt: combinedText.substring(0, 500),
        sourceDocuments: JSON.stringify(sourceDocuments),
        status: 'draft',
        analysisStatus: 'pending',
        miroStatus: 'pending',
        pptxStatus: 'pending',
        analysisResult: null,
        errorMessage: null,
      },
    });

    res.json({ success: true, data: { workspace_id: workspaceId, file_count: files.length } });
  }),
);

// ---------------------------------------------------------------------------
// GET /api/workspaces — List workspaces for the current user
// ---------------------------------------------------------------------------
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const userId = (req as any).user?.userId;
    if (!userId) throw new AppError('Missing authenticated user id', 401);

    const workspaces = await prisma.workspace.findMany({
      where: { requestedBy: userId },
      orderBy: { createdAt: 'desc' },
      select: {
        workspaceId: true,
        name: true,
        description: true,
        status: true,
        clientName: true,
        workshopDate: true,
        analysisStatus: true,
        miroStatus: true,
        pptxStatus: true,
        miroBoardUrl: true,
        createdAt: true,
        updatedAt: true,
        completedAt: true,
        errorMessage: true,
        isSaved: true,
        workspaceType: true,
        engagementStage: true,
        sourceDocuments: true,
      },
    });

    res.json({
      success: true,
      data: workspaces.map((w) => ({
        workspace_id: w.workspaceId,
        name: w.name,
        engagement_stage: w.engagementStage || null,
        description: w.description,
        status: w.status,
        client_name: w.clientName,
        workshop_date: w.workshopDate?.toISOString() || null,
        analysis_status: w.analysisStatus,
        miro_status: w.miroStatus,
        pptx_status: w.pptxStatus,
        miro_board_url: w.miroBoardUrl,
        created_at: w.createdAt.toISOString(),
        updated_at: w.updatedAt.toISOString(),
        completed_at: w.completedAt?.toISOString() || null,
        error_message: w.errorMessage,
        is_saved: w.isSaved,
        expires_at: w.isSaved ? null : new Date(w.createdAt.getTime() + 48 * 60 * 60 * 1000).toISOString(),
        workspace_type: w.workspaceType || 'workshop_analysis',
        source_documents: safeJsonParse(w.sourceDocuments, null),
      })),
    });
  }),
);

// ---------------------------------------------------------------------------
// GET /api/workspaces/:workspaceId — Get workspace detail
// ---------------------------------------------------------------------------
router.get(
  '/:workspaceId',
  asyncHandler(async (req, res) => {
    const userId = (req as any).user?.userId;
    if (!userId) throw new AppError('Missing authenticated user id', 401);

    const { workspaceId } = req.params;

    const ws = await prisma.workspace.findUnique({ where: { workspaceId } });
    if (!ws) throw new AppError('Workspace not found', 404);
    if (ws.requestedBy !== userId) throw new AppError('Access denied', 403);

    let downloadUrl: string | null = null;
    if (ws.pptxJobId) {
      const pptxJob = await prisma.pptxJob.findUnique({
        where: { jobId: ws.pptxJobId },
        select: { outputFile: true },
      });
      if (pptxJob?.outputFile) {
        try {
          downloadUrl = await createPptxSignedUrl(pptxJob.outputFile);
        } catch {
          // S3 URL generation may fail; non-critical
        }
      }
    }

    res.json({
      success: true,
      data: {
        workspace_id: ws.workspaceId,
        name: ws.name,
        description: ws.description,
        status: ws.status,
        client_name: ws.clientName,
        workshop_date: ws.workshopDate?.toISOString() || null,
        workshop_duration: ws.workshopDuration,
        transcript_text: ws.transcriptText || null,
        transcript_excerpt: ws.transcriptExcerpt,
        analysis_status: ws.analysisStatus,
        analysis_result: safeJsonParse(ws.analysisResult, null),
        miro_status: ws.miroStatus,
        miro_board_id: ws.miroBoardId,
        miro_board_url: ws.miroBoardUrl,
        miro_snapshot: safeJsonParse(ws.miroSnapshot, null),
        pptx_status: ws.pptxStatus,
        pptx_job_id: ws.pptxJobId,
        pptx_download_url: downloadUrl,
        pipeline_log: ws.pipelineLog || null,
        account_id: ws.accountId,
        deal_id: ws.dealId,
        requested_by: ws.requestedBy,
        error_message: ws.errorMessage,
        created_at: ws.createdAt.toISOString(),
        updated_at: ws.updatedAt.toISOString(),
        completed_at: ws.completedAt?.toISOString() || null,
        is_saved: ws.isSaved,
        expires_at: ws.isSaved ? null : new Date(ws.createdAt.getTime() + 48 * 60 * 60 * 1000).toISOString(),
        workspace_type: ws.workspaceType || 'workshop_analysis',
        source_documents: safeJsonParse(ws.sourceDocuments, null),
      },
    });
  }),
);

// ---------------------------------------------------------------------------
// PUT /api/workspaces/:workspaceId — Update workspace metadata
// ---------------------------------------------------------------------------
router.put(
  '/:workspaceId',
  asyncHandler(async (req, res) => {
    const userId = (req as any).user?.userId;
    if (!userId) throw new AppError('Missing authenticated user id', 401);

    const { workspaceId } = req.params;
    const ws = await prisma.workspace.findUnique({ where: { workspaceId } });
    if (!ws) throw new AppError('Workspace not found', 404);
    if (ws.requestedBy !== userId) throw new AppError('Access denied', 403);

    const { name, description, clientName } = req.body;

    const updated = await prisma.workspace.update({
      where: { workspaceId },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(description !== undefined ? { description: description?.trim() || null } : {}),
        ...(clientName !== undefined ? { clientName: clientName?.trim() || null } : {}),
      },
    });

    res.json({
      success: true,
      data: { workspace_id: updated.workspaceId, name: updated.name },
    });
  }),
);

// ---------------------------------------------------------------------------
// DELETE /api/workspaces/:workspaceId — Delete a workspace
// ---------------------------------------------------------------------------
router.delete(
  '/:workspaceId',
  asyncHandler(async (req, res) => {
    const userId = (req as any).user?.userId;
    if (!userId) throw new AppError('Missing authenticated user id', 401);

    const { workspaceId } = req.params;
    const ws = await prisma.workspace.findUnique({ where: { workspaceId } });
    if (!ws) throw new AppError('Workspace not found', 404);
    if (ws.requestedBy !== userId) throw new AppError('Access denied', 403);

    await prisma.workspace.delete({ where: { workspaceId } });

    logger.info('[Workspace] Deleted', { workspaceId, userId });
    res.json({ success: true });
  }),
);

// ---------------------------------------------------------------------------
// POST /api/workspaces/:workspaceId/run — Trigger the pipeline
// ---------------------------------------------------------------------------
router.post(
  '/:workspaceId/run',
  asyncHandler(async (req, res) => {
    const userId = (req as any).user?.userId;
    if (!userId) throw new AppError('Missing authenticated user id', 401);

    const { workspaceId } = req.params;
    const { runAnalysis = true, runMiro = true, runPptx = true } = req.body;

    const ws = await prisma.workspace.findUnique({ where: { workspaceId } });
    if (!ws) throw new AppError('Workspace not found', 404);
    if (ws.requestedBy !== userId) throw new AppError('Access denied', 403);

    if (['analyzing', 'miro_generating', 'pptx_generating'].includes(ws.status)) {
      throw new AppError('Pipeline is already running for this workspace', 409);
    }

    // Reset stage statuses
    await prisma.workspace.update({
      where: { workspaceId },
      data: {
        status: 'analyzing',
        analysisStatus: runAnalysis ? 'pending' : 'skipped',
        miroStatus: runMiro ? 'pending' : 'skipped',
        pptxStatus: runPptx ? 'pending' : 'skipped',
        errorMessage: null,
        completedAt: null,
      },
    });

    // Fire and forget — runs asynchronously
    processWorkspacePipeline(workspaceId, { runAnalysis, runMiro, runPptx }).catch((err) =>
      logger.error('[Workspace] Pipeline error (unhandled)', err, { workspaceId }),
    );

    res.json({
      success: true,
      data: { workspace_id: workspaceId, status: 'analyzing' },
    });
  }),
);

// ---------------------------------------------------------------------------
// GET /api/workspaces/:workspaceId/status — Poll pipeline status
// ---------------------------------------------------------------------------
router.get(
  '/:workspaceId/status',
  asyncHandler(async (req, res) => {
    const userId = (req as any).user?.userId;
    if (!userId) throw new AppError('Missing authenticated user id', 401);

    const { workspaceId } = req.params;

    const ws = await prisma.workspace.findUnique({
      where: { workspaceId },
      select: {
        workspaceId: true,
        status: true,
        analysisStatus: true,
        miroStatus: true,
        pptxStatus: true,
        miroBoardUrl: true,
        pptxJobId: true,
        errorMessage: true,
        pipelineLog: true,
        completedAt: true,
      },
    });
    if (!ws) throw new AppError('Workspace not found', 404);

    res.json({
      success: true,
      data: {
        workspace_id: ws.workspaceId,
        status: ws.status,
        analysis_status: ws.analysisStatus,
        miro_status: ws.miroStatus,
        pptx_status: ws.pptxStatus,
        miro_board_url: ws.miroBoardUrl,
        pptx_job_id: ws.pptxJobId,
        error_message: ws.errorMessage,
        pipeline_log: ws.pipelineLog || null,
        completed_at: ws.completedAt?.toISOString() || null,
      },
    });
  }),
);

// ---------------------------------------------------------------------------
// POST /api/workspaces/:workspaceId/cancel — Cancel a running pipeline
// ---------------------------------------------------------------------------
router.post(
  '/:workspaceId/cancel',
  asyncHandler(async (req, res) => {
    const userId = (req as any).user?.userId;
    if (!userId) throw new AppError('Missing authenticated user id', 401);

    const { workspaceId } = req.params;
    const ws = await prisma.workspace.findUnique({ where: { workspaceId } });
    if (!ws) throw new AppError('Workspace not found', 404);
    if (ws.requestedBy !== userId) throw new AppError('Access denied', 403);

    await cancelWorkspacePipeline(workspaceId);

    res.json({ success: true, data: { workspace_id: workspaceId, status: 'cancelled' } });
  }),
);

// ---------------------------------------------------------------------------
// POST /api/workspaces/demo/workshop-prep — Create a demo workspace with sample survey data
// ---------------------------------------------------------------------------
router.post(
  '/demo/workshop-prep',
  asyncHandler(async (req, res) => {
    const userId = (req as any).user?.userId;
    if (!userId) throw new AppError('Missing authenticated user id', 401);

    // Read test survey files from disk
    const surveyDir = join(__dirname, '..', '..', 'test-data', 'workshop-prep-surveys');
    let files: string[];
    try {
      files = readdirSync(surveyDir).filter((f) => f.endsWith('.txt')).sort();
    } catch {
      throw new AppError('Demo survey data not found on server', 500);
    }

    if (files.length === 0) throw new AppError('No demo survey files found', 500);

    const textParts: string[] = [];
    const sourceDocuments: Array<{
      documentId: string; originalFilename: string; mimeType: string;
      sizeBytes: number; sourceType: string; extractedWordCount: number; uploadedAt: string;
    }> = [];

    for (const filename of files) {
      const content = readFileSync(join(surveyDir, filename), 'utf-8');
      textParts.push(`--- DOCUMENT: ${filename} (type: notes) ---\n${content.trim()}`);
      sourceDocuments.push({
        documentId: randomUUID(),
        originalFilename: filename,
        mimeType: 'text/plain',
        sizeBytes: Buffer.byteLength(content),
        sourceType: 'notes',
        extractedWordCount: content.split(/\s+/).length,
        uploadedAt: new Date().toISOString(),
      });
    }

    const combinedText = textParts.join('\n\n');

    const workspace = await prisma.workspace.create({
      data: {
        workspaceId: randomUUID(),
        name: 'Meridian Financial Group — ServiceNow ITSM AI Enablement Workshop Prep',
        description: 'Demo workspace with 4 pre-workshop survey responses from Meridian Financial Group stakeholders.',
        transcriptText: combinedText,
        transcriptExcerpt: combinedText.substring(0, 500),
        clientName: 'Meridian Financial Group',
        workshopDate: null,
        requestedBy: userId,
        requestedByEmail: (req as any).user?.email || null,
        status: 'draft',
        workspaceType: 'workshop_prep',
        sourceDocuments: JSON.stringify(sourceDocuments),
      },
    });

    // Auto-run the full pipeline
    await prisma.workspace.update({
      where: { workspaceId: workspace.workspaceId },
      data: {
        status: 'analyzing',
        analysisStatus: 'pending',
        miroStatus: 'pending',
        pptxStatus: 'pending',
        errorMessage: null,
      },
    });

    processWorkspacePipeline(workspace.workspaceId, { runAnalysis: true, runMiro: true, runPptx: true }).catch((err) =>
      logger.error('[Workspace] Demo pipeline error', err, { workspaceId: workspace.workspaceId }),
    );

    logger.info('[Workspace] Demo workshop-prep created', {
      workspaceId: workspace.workspaceId,
      userId,
      surveyCount: files.length,
    });

    res.json({
      success: true,
      data: {
        workspace_id: workspace.workspaceId,
        name: workspace.name,
        status: 'analyzing',
        survey_count: files.length,
      },
    });
  }),
);

// ---------------------------------------------------------------------------
// GET /api/workspaces/:workspaceId/download — Get PPTX download URL
// ---------------------------------------------------------------------------
router.get(
  '/:workspaceId/download',
  asyncHandler(async (req, res) => {
    const userId = (req as any).user?.userId;
    if (!userId) throw new AppError('Missing authenticated user id', 401);

    const { workspaceId } = req.params;
    const ws = await prisma.workspace.findUnique({ where: { workspaceId } });
    if (!ws) throw new AppError('Workspace not found', 404);
    if (ws.requestedBy !== userId) throw new AppError('Access denied', 403);
    if (!ws.pptxJobId) throw new AppError('No PPTX generated for this workspace yet', 404);

    const pptxJob = await prisma.pptxJob.findUnique({
      where: { jobId: ws.pptxJobId },
      select: { outputFile: true },
    });
    if (!pptxJob) throw new AppError('PPTX job not found', 404);

    // If S3 file exists, return signed URL; otherwise direct-serve endpoint
    let downloadUrl: string;
    if (pptxJob.outputFile && isPptxStorageConfigured()) {
      downloadUrl = (await createPptxSignedUrl(pptxJob.outputFile)) || '';
    } else {
      downloadUrl = `/api/workspaces/${workspaceId}/download-file`;
    }
    res.json({ success: true, data: { download_url: downloadUrl } });
  }),
);

// ---------------------------------------------------------------------------
// GET /api/workspaces/:workspaceId/download-file — Direct PPTX binary download (no S3)
// ---------------------------------------------------------------------------
router.get(
  '/:workspaceId/download-file',
  asyncHandler(async (req, res) => {
    const userId = (req as any).user?.userId;
    if (!userId) throw new AppError('Missing authenticated user id', 401);

    const { workspaceId } = req.params;
    const ws = await prisma.workspace.findUnique({ where: { workspaceId } });
    if (!ws) throw new AppError('Workspace not found', 404);
    if (ws.requestedBy !== userId) throw new AppError('Access denied', 403);
    if (!ws.pptxJobId) throw new AppError('No PPTX generated yet', 404);

    const pptxJob = await prisma.pptxJob.findUnique({
      where: { jobId: ws.pptxJobId },
      select: { presentationData: true },
    });
    if (!pptxJob?.presentationData) throw new AppError('No presentation data available', 404);

    const presentationData = safeJsonParse(pptxJob.presentationData as string, null);
    if (!presentationData) throw new AppError('Presentation data is corrupted', 500);
    const templateManager = new TemplateManagerService();
    const templatePath = templateManager.getTemplatePath();
    const pptxBuffer = await generatePPTXBuffer(presentationData, templatePath);

    const filename = `${ws.name.replace(/[^\w.-]+/g, '_')}.pptx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pptxBuffer.length.toString());
    res.send(pptxBuffer);
  }),
);

// ---------------------------------------------------------------------------
// GET /api/workspaces/:workspaceId/prep-pptx-download — Download workshop prep deck
// ---------------------------------------------------------------------------
router.get(
  '/:workspaceId/prep-pptx-download',
  asyncHandler(async (req, res) => {
    const userId = (req as any).user?.userId;
    if (!userId) throw new AppError('Missing authenticated user id', 401);

    const { workspaceId } = req.params;
    const ws = await prisma.workspace.findUnique({ where: { workspaceId } });
    if (!ws) throw new AppError('Workspace not found', 404);
    if (ws.requestedBy !== userId) throw new AppError('Access denied', 403);

    const jobId = (ws as any).workshopPrepPptxJobId as string | null;
    if (!jobId) throw new AppError('No workshop prep deck generated yet', 404);

    const pptxJob = await prisma.pptxJob.findUnique({
      where: { jobId },
      select: { presentationData: true, outputFile: true },
    });
    if (!pptxJob?.presentationData) throw new AppError('No presentation data available', 404);

    if (pptxJob.outputFile && isPptxStorageConfigured()) {
      const signedUrl = await createPptxSignedUrl(pptxJob.outputFile);
      res.json({ success: true, data: { download_url: signedUrl } });
      return;
    }

    const presentationData = safeJsonParse(pptxJob.presentationData as string, null);
    if (!presentationData) throw new AppError('Presentation data is corrupted', 500);
    const templateManager = new TemplateManagerService();
    const templatePath = templateManager.getTemplatePath();
    const pptxBuffer = await generatePPTXBuffer(presentationData, templatePath);

    const filename = `workshop-prep-deck-${(ws.clientName || 'workshop').replace(/[^\w.-]+/g, '_')}.pptx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pptxBuffer.length.toString());
    res.send(pptxBuffer);
  }),
);

// ---------------------------------------------------------------------------
// POST /api/workspaces/:workspaceId/generate-survey-questions — AI pre-workshop survey generation
// ---------------------------------------------------------------------------
router.post(
  '/:workspaceId/generate-survey-questions',
  asyncHandler(async (req, res) => {
    const userId = (req as any).user?.userId;
    if (!userId) throw new AppError('Missing authenticated user id', 401);

    const { workspaceId } = req.params;
    const ws = await prisma.workspace.findUnique({ where: { workspaceId } });
    if (!ws) throw new AppError('Workspace not found', 404);
    if (ws.requestedBy !== userId) throw new AppError('Access denied', 403);

    const openai = getOpenAIService();
    const clientName = ws.clientName || 'the client company';

    // Use web search to get fresh company context if available
    let companyContext = '';
    try {
      const searchResult = await openai.webSearch({
        query: `${clientName} company overview IT challenges digital transformation ServiceNow 2024 2025`,
      });
      companyContext = typeof searchResult === 'string'
        ? searchResult
        : JSON.stringify(searchResult).substring(0, 3000);
    } catch {
      companyContext = `Company: ${clientName}`;
    }

    const prompt = `You are an expert ServiceNow sales consultant (enterprise) preparing a Pre-Workshop Discovery Questionnaire for ${clientName}.

Company research:
${companyContext}

Generate a structured pre-workshop discovery questionnaire following this exact section structure. Tailor every question, option, and example specifically to ${clientName} based on the company research above. Replace "[Insert Client Name]" with the actual company name throughout.

The questionnaire must have these sections:

**Section 0 — Respondent & Scope**
Questions about: respondent name/role/department, primary focus area for the workshop (HRSD / ITSM / both / other), scope (enterprise-wide vs specific BU/region)

**Section 1 — Desired Outcomes & KPIs**
Questions about: top 3 outcomes they want from ServiceNow AI/HRSD/ITSM, how they currently measure success (KPIs/SLAs), what "good looks like" in 12 months. Make outcomes specific to ${clientName}'s industry and challenges.

**Section 2 — ServiceNow Current State**
Questions about: which ServiceNow modules are live, go-live dates, current ServiceNow version/release, number of active users (HR agents / employees / IT agents), integrations in use (HRIS, payroll, directory, etc.), whether they use Now Assist / AI features today

**Section 3 — Process Maturity (Rating Scale 1–4)**
Rate each process on: 1=Ad hoc/manual, 2=Defined but inconsistent, 3=Standardised & measured, 4=Optimised & automated
HRSD processes: Case Management, Knowledge Management, Employee Document Management, Lifecycle Events, Employee Center / Portal
ITSM processes: Incident Management, Problem Management, Change Management, Service Catalog, CMDB

**Section 4 — Enterprise AI Posture**
Questions about: whether the company has an AI strategy/policy, governance or responsible-AI frameworks in place, data privacy / sovereignty constraints relevant to AI, appetite for AI-generated content in workflows, who owns AI decisions (IT / HR / executive sponsor). Tailor to ${clientName}'s public AI stance if known.

**Section 5 — AI in ServiceNow**
Questions about: awareness and interest in Now Assist (GenAI) features, which AI use cases are highest priority (case summarisation, virtual agent, knowledge generation, search, predictive intelligence), blockers to AI adoption (data quality, change management, cost, compliance)

**Section 6 — HRSD Deep Dive**
Questions about: top HR case types by volume (new hire, offboarding, benefits, payroll, leave), current employee self-service adoption rate, biggest pain points in HR service delivery, whether they use Virtual Agent for HR today, document management challenges, lifecycle events in scope

**Section 7 — ITSM Deep Dive**
Questions about: top incident categories, % of incidents resolved via self-service today, CMDB accuracy and coverage, change success rate and CAB process, biggest ITSM pain points, whether they have a service portal and its adoption

**Section 8 — Volumes & Baseline Metrics**
Questions about: monthly HR case volumes (by category if possible), monthly IT incident/request volumes, current MTTR for P1/P2 incidents, HR case resolution SLA, agent headcount (HR service centre, IT service desk), cost-per-ticket if known

Return JSON in this exact format:
{
  "companySnapshot": "3-4 sentence summary of ${clientName} based on research, covering industry, scale, known ServiceNow footprint, and AI posture",
  "sections": [
    {
      "sectionId": "s0",
      "title": "Section 0 — Respondent & Scope",
      "questions": [
        {
          "id": "s0q1",
          "question": "...",
          "type": "text | single_choice | multi_choice | rating_scale | table",
          "options": ["option1", "option2"],
          "rationale": "Why this is relevant for ${clientName}"
        }
      ]
    }
  ]
}

IMPORTANT requirements:
- Include ALL 9 sections (s0–s8)
- Each section must have 5–7 questions minimum
- Use a variety of question types within each section: mix text, single_choice, multi_choice, rating_scale
- For Section 3 (Process Maturity), create one rating_scale question per process area with the full list of processes as options
- Options for choice questions must be specific and realistic (not generic) — reference ${clientName}'s tech stack and industry
- Rationale must be specific to ${clientName}'s known challenges from the research
- Questions in Section 6 (HRSD) and Section 7 (ITSM) must reference specific products/tools ${clientName} uses (e.g. Workday, Okta, Jira, etc.) if known from research
- Section 8 must ask for actual numeric baselines (volumes, SLAs, headcount) with example formats
- Do NOT use generic questions — every question must feel bespoke to ${clientName}`;

    const result = await openai.generateStructuredCompletion(
      [{ role: 'user' as const, content: prompt }],
      undefined,
      0.4,
    );

    res.json({
      success: true,
      data: {
        companySnapshot: (result as any)?.companySnapshot || '',
        sections: Array.isArray((result as any)?.sections) ? (result as any).sections : [],
      },
    });
  }),
);

// ---------------------------------------------------------------------------
// POST /api/workspaces/:workspaceId/generate-sample-responses — AI-generated realistic mock survey responses
// ---------------------------------------------------------------------------
router.post(
  '/:workspaceId/generate-sample-responses',
  asyncHandler(async (req, res) => {
    const userId = (req as any).user?.userId;
    if (!userId) throw new AppError('Missing authenticated user id', 401);

    const { workspaceId } = req.params;
    const { sections } = req.body; // survey sections passed from frontend localStorage

    const ws = await prisma.workspace.findUnique({ where: { workspaceId } });
    if (!ws) throw new AppError('Workspace not found', 404);
    if (ws.requestedBy !== userId) throw new AppError('Access denied', 403);

    const clientName = ws.clientName || 'the client company';
    const openai = getOpenAIService();

    // Build a condensed question list for the prompt
    const questionSummary = Array.isArray(sections)
      ? sections.map((s: any) => {
          const qs = (s.questions || []).map((q: any, i: number) =>
            `  ${i + 1}. [${q.type || 'text'}] ${q.question}${q.options?.length ? `\n     Options: ${q.options.join(', ')}` : ''}`
          ).join('\n');
          return `${s.title}:\n${qs}`;
        }).join('\n\n')
      : 'No sections provided';

    const prompt = `You are a senior IT director / VP of HR Operations at ${clientName} responding to a pre-workshop discovery questionnaire sent by enterprise (a ServiceNow partner).

Write realistic, detailed, plausible responses to every question below. Responses should:
- Sound like a real ${clientName} executive — reference their actual products, org scale, known challenges, and tech stack
- Include specific numbers where asked (e.g. "~2,400 HR cases/month", "MTTR P1: 4 hours")
- Reflect realistic pain points a large tech company would have with ITSM/HRSD
- Be appropriately candid about gaps and maturity levels
- For rating_scale questions, give a rating (1–4) plus a brief justification
- For multi_choice, select the most realistic options given ${clientName}'s profile
- For open text, write 2–4 sentences of realistic content

QUESTIONNAIRE STRUCTURE:
${questionSummary}

Return a single JSON object:
{
  "persona": { "name": "string", "title": "string", "department": "string" },
  "responses": [
    {
      "sectionId": "s0",
      "sectionTitle": "string",
      "answers": [
        {
          "questionIndex": 0,
          "question": "string",
          "answer": "string or array of strings for multi-choice",
          "rating": null or 1-4 for rating_scale questions
        }
      ]
    }
  ],
  "coveringNote": "A 3-4 sentence covering note from the persona, highlighting their top priorities for the workshop"
}`;

    const result = await openai.generateStructuredCompletion(
      [{ role: 'user' as const, content: prompt }],
      undefined,
      0.6,
    );

    // Also build a formatted plain-text version for download/upload
    const persona = (result as any)?.persona || {};
    const responses = (result as any)?.responses || [];
    const coveringNote = (result as any)?.coveringNote || '';

    const textLines: string[] = [
      `PRE-WORKSHOP DISCOVERY QUESTIONNAIRE — COMPLETED RESPONSES`,
      `Client: ${clientName}`,
      `Respondent: ${persona.name || 'Senior Executive'}, ${persona.title || ''} — ${persona.department || ''}`,
      ``,
      `Covering Note:`,
      coveringNote,
      ``,
      `${'═'.repeat(70)}`,
    ];

    responses.forEach((section: any) => {
      textLines.push(``, `${section.sectionTitle}`, `${'─'.repeat(60)}`);
      (section.answers || []).forEach((a: any, i: number) => {
        textLines.push(``, `${i + 1}. ${a.question}`);
        if (a.rating !== null && a.rating !== undefined) {
          textLines.push(`   Rating: ${a.rating}/4`);
          if (a.answer) textLines.push(`   Comments: ${a.answer}`);
        } else if (Array.isArray(a.answer)) {
          a.answer.forEach((opt: string) => textLines.push(`   ✓ ${opt}`));
        } else {
          textLines.push(`   ${a.answer || ''}`);
        }
      });
    });

    textLines.push(``, `${'═'.repeat(70)}`);

    res.json({
      success: true,
      data: {
        persona,
        responses,
        coveringNote,
        responsesText: textLines.join('\n'),
      },
    });
  }),
);

// Load the static ServiceNow agent catalog once at module load
const AGENT_CATALOG: Array<{
  id: number; category: string; name: string; description: string; offeredBy: string; type: string;
}> = (() => {
  try {
    return JSON.parse(readFileSync(join(__dirname, '../data/servicenow-agents.json'), 'utf-8'));
  } catch {
    return [];
  }
})();

// ---------------------------------------------------------------------------
// POST /api/workspaces/:workspaceId/recommend-agents — real catalog + AI relevance
// ---------------------------------------------------------------------------
router.post(
  '/:workspaceId/recommend-agents',
  asyncHandler(async (req, res) => {
    const userId = (req as any).user?.userId;
    if (!userId) throw new AppError('Missing authenticated user id', 401);

    const { workspaceId } = req.params;
    const { query } = req.body;

    const ws = await prisma.workspace.findUnique({ where: { workspaceId } });
    if (!ws) throw new AppError('Workspace not found', 404);
    if (ws.requestedBy !== userId) throw new AppError('Access denied', 403);

    const openai = getOpenAIService();
    const analysisResult = ws.analysisResult ? safeJsonParse(ws.analysisResult as string, null) : null;

    const clientContext = analysisResult
      ? JSON.stringify({
          clientName: ws.clientName,
          companyContext: (analysisResult as any).companyContext,
          challenges: (analysisResult as any).companyContext?.challenges,
          workshopPlan: (analysisResult as any).workshopPlan,
          surveyInsights: (analysisResult as any).surveyInsights,
        }, null, 2)
      : `Client: ${ws.clientName || 'Unknown'}`;

    // Build a compact catalog index for the prompt — id + name + description
    const catalogIndex = AGENT_CATALOG.map(a =>
      `[${a.id}] (${a.category} / ${a.type}) ${a.name} — ${a.description}`
    ).join('\n');

    const prompt = `You are a ServiceNow AI expert at enterprise selecting the most relevant agents for a client from the official ServiceNow agent catalog.

Client context:
${clientContext}
${query ? `\nFocus area requested by the sales team: ${query}\n` : ''}

OFFICIAL SERVICENOW AGENT CATALOG (id / category / type / name / description):
${catalogIndex}

Select the 8–12 most impactful agents from the catalog above for this client. You MUST only select agents from the list — do not invent new ones. Prioritise agents that directly address the client's known pain points, industry, and use cases.

For each selected agent return:
- id: the numeric id from the catalog
- relevance: 2-sentence explanation of why this specific agent is relevant to this client's challenges
- useCase: one concrete sentence describing how this client would use it in their environment

Return JSON: { "selections": [{ "id": number, "relevance": string, "useCase": string }] }`;

    const result = await openai.generateStructuredCompletion(
      [{ role: 'user' as const, content: prompt }],
      undefined,
      0.3,
    );

    const selections: Array<{ id: number; relevance: string; useCase: string }> =
      Array.isArray((result as any)?.selections) ? (result as any).selections : [];

    // Merge catalog data with AI-generated relevance
    const agents = selections.flatMap(sel => {
      const catalogEntry = AGENT_CATALOG.find(a => a.id === sel.id);
      if (!catalogEntry) return [];
      return [{
        name: catalogEntry.name,
        category: catalogEntry.category,
        description: catalogEntry.description,
        offeredBy: catalogEntry.offeredBy,
        agentType: catalogEntry.type,
        relevance: sel.relevance,
        useCase: sel.useCase,
      }];
    });

    res.json({ success: true, data: { agents, totalCatalogSize: AGENT_CATALOG.length } });
  }),
);

// ---------------------------------------------------------------------------
// POST /api/workspaces/:workspaceId/update-miro-workshop
// Appends a "Workshop — AI Agents" frame to the existing Miro board
// ---------------------------------------------------------------------------
router.post(
  '/:workspaceId/update-miro-workshop',
  asyncHandler(async (req, res) => {
    const userId = (req as any).user?.userId;
    if (!userId) throw new AppError('Missing authenticated user id', 401);

    const { workspaceId } = req.params;
    const { agents } = req.body as { agents: Array<{ name: string; category: string; description: string; relevance: string; useCase?: string }> };

    if (!Array.isArray(agents) || agents.length === 0) {
      throw new AppError('agents array is required', 400);
    }

    const ws = await prisma.workspace.findUnique({ where: { workspaceId } });
    if (!ws) throw new AppError('Workspace not found', 404);
    if (ws.requestedBy !== userId) throw new AppError('Access denied', 403);

    const miroToken = process.env.MIRO_API_TOKEN;
    if (!miroToken) throw new AppError('Miro is not configured', 500);

    const headers = {
      Authorization: `Bearer ${miroToken}`,
      'Content-Type': 'application/json',
    };

    let boardId = ws.miroBoardId;
    let boardUrl = ws.miroBoardUrl;

    // If no existing board, create a standalone one for agent recommendations
    if (!boardId) {
      const clientName = ws.clientName || 'Client';
      const boardName = `${clientName} — AI Agent Recommendations`.substring(0, 60);
      const newBoardRes = await axios.post(
        'https://api.miro.com/v2/boards',
        { name: boardName, description: `ServiceNow AI agent recommendations for ${clientName}` },
        { headers },
      );
      boardId = newBoardRes.data.id;
      boardUrl = newBoardRes.data.viewLink || `https://miro.com/app/board/${boardId}/`;
      // Persist the new board onto the workspace
      await prisma.workspace.update({
        where: { workspaceId },
        data: { miroBoardId: boardId, miroBoardUrl: boardUrl },
      });
    }

    const api = (path: string) => `https://api.miro.com/v2/boards/${boardId}/${path}`;

    // ── helpers (same pattern as workspace.service.ts) ────────────────────
    async function createFrame(title: string, x: number, y: number, w: number, h: number): Promise<string> {
      const r = await axios.post(api('frames'), {
        data: { title, format: 'custom', type: 'freeform' },
        position: { x, y }, geometry: { width: w, height: h },
      }, { headers });
      return r.data.id;
    }

    async function createShape(content: string, shape: string, x: number, y: number, w: number, h: number, style: Record<string, any> = {}, parentId?: string): Promise<string> {
      try {
        const merged = { fillColor: '#1a1a2e', fillOpacity: '1.0', fontSize: '14', textAlign: 'center', textAlignVertical: 'middle', color: '#ffffff', ...style };
        if (typeof merged.fontSize === 'number') merged.fontSize = String(merged.fontSize);
        const r = await axios.post(api('shapes'), {
          data: { content: content.substring(0, 500), shape },
          style: merged, geometry: { width: w, height: h }, position: { x, y },
          ...(parentId ? { parent: { id: parentId } } : {}),
        }, { headers });
        return r.data.id;
      } catch { return ''; }
    }

    async function createCard(title: string, description: string, x: number, y: number, cardTheme: string, w: number, parentId?: string): Promise<string> {
      try {
        const r = await axios.post(api('cards'), {
          data: { title: title.substring(0, 200), description: description.substring(0, 1000) },
          style: { cardTheme },
          geometry: { width: w },
          position: { x, y },
          ...(parentId ? { parent: { id: parentId } } : {}),
        }, { headers });
        return r.data.id;
      } catch { return ''; }
    }

    async function createStickyNote(content: string, x: number, y: number, color: string, parentId?: string): Promise<string> {
      try {
        const r = await axios.post(api('sticky_notes'), {
          data: { content: content.substring(0, 500), shape: 'square' },
          style: { fillColor: color }, position: { x, y },
          ...(parentId ? { parent: { id: parentId } } : {}),
        }, { headers });
        return r.data.id;
      } catch { return ''; }
    }

    // ── Build the frame ───────────────────────────────────────────────────
    // Frame is placed at absolute board position (0, 5000) — below Phase 2 content.
    // All child item positions are RELATIVE to the frame's top-left corner.
    const analysisResult = ws.analysisResult ? safeJsonParse(ws.analysisResult as string, null) : null;
    const clientName = ws.clientName || 'Client';
    const frameW = 3200;
    const frameH = 2200;

    const frameId = await createFrame(`Workshop — AI Agent Recommendations (${clientName})`, 0, 5000, frameW, frameH);

    // Header banner — relative to frame top-left
    await createShape(
      `<p><strong>ServiceNow AI Agent Recommendations — ${clientName}</strong></p>`,
      'round_rectangle', frameW / 2, 60, frameW - 80, 72,
      { fillColor: '#2563eb', fontSize: 18, color: '#ffffff' }, frameId,
    );

    // Client context strip (if available)
    const contextText = analysisResult
      ? `Context: ${(analysisResult as any).companyContext?.companyOverview || (analysisResult as any).workshopPlan?.objective || ws.description || clientName}`
      : `Client: ${clientName} · ${ws.description || 'ServiceNow AI enablement engagement'}`;

    await createShape(
      contextText.substring(0, 300),
      'round_rectangle', frameW / 2, 145, frameW - 80, 56,
      { fillColor: '#eff6ff', fontSize: 12, color: '#1e40af', fillOpacity: '1.0', textAlign: 'left' }, frameId,
    );

    // Group agents by category
    const byCategory: Record<string, typeof agents> = {};
    for (const agent of agents) {
      const cat = agent.category || 'Other';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(agent);
    }

    // Category color palette
    const CATEGORY_COLORS: Record<string, string> = {
      ITSM: '#1d4ed8', HRSD: '#059669', CSM: '#7c3aed',
      FSM: '#b45309', SPM: '#0891b2', GRC: '#dc2626',
      ITOM: '#6d28d9', SecOps: '#be123c', ITBM: '#0369a1',
      Platform: '#374151', Other: '#64748b',
    };

    const CARD_THEMES: Record<string, string> = {
      ITSM: '#2563eb', HRSD: '#10b981', CSM: '#8b5cf6',
      FSM: '#f59e0b', SPM: '#06b6d4', GRC: '#ef4444',
      ITOM: '#7c3aed', SecOps: '#f43f5e', ITBM: '#0284c7',
      Platform: '#6b7280', Other: '#94a3b8',
    };

    const categories = Object.keys(byCategory);
    const colW = Math.floor((frameW - 120) / Math.max(categories.length, 1));
    const colStartY = 240; // relative to frame

    for (let ci = 0; ci < categories.length; ci++) {
      const cat = categories[ci];
      const catAgents = byCategory[cat];
      const colX = 60 + ci * colW; // relative to frame
      const catColor = CATEGORY_COLORS[cat] || CATEGORY_COLORS.Other;
      const cardTheme = CARD_THEMES[cat] || CARD_THEMES.Other;

      // Category header pill
      await createShape(cat, 'round_rectangle', colX + colW / 2, colStartY, colW - 20, 44,
        { fillColor: catColor, fontSize: 14, color: '#ffffff', fontWeight: 'bold' }, frameId,
      );

      // Agent cards
      for (let ai = 0; ai < catAgents.length; ai++) {
        const agent = catAgents[ai];
        const cardY = colStartY + 60 + ai * 260;
        const desc = [
          agent.description,
          agent.relevance ? `\n\nWhy relevant: ${agent.relevance}` : '',
          agent.useCase ? `\n\nUse case: ${agent.useCase}` : '',
        ].join('').trim();

        await createCard(agent.name, desc, colX + colW / 2, cardY, cardTheme, colW - 24, frameId);
      }
    }

    // Bottom: implementation sequence row
    const seqY = frameH - 180; // relative to frame
    await createShape(
      'Recommended Implementation Sequence',
      'round_rectangle', frameW / 2, seqY, frameW - 80, 44,
      { fillColor: '#1a1a2e', fontSize: 13, color: '#aaaaaa' }, frameId,
    );

    // Sort agents by phase hints in their names/descriptions then add stickies
    const stickyColors = ['light_blue', 'light_yellow', 'light_green', 'light_pink', 'orange'];
    const flatAgents = agents.slice(0, 6);
    const stickyW = Math.floor((frameW - 120) / Math.max(flatAgents.length, 1));
    for (let i = 0; i < flatAgents.length; i++) {
      const sX = 60 + i * stickyW + stickyW / 2; // relative to frame
      await createStickyNote(`${i + 1}. ${flatAgents[i].name}`, sX, seqY + 80, stickyColors[i % stickyColors.length], frameId);
    }

    // Ensure boardUrl is set (may have been assigned above if board was newly created)
    boardUrl = boardUrl || `https://miro.com/app/board/${boardId}/`;

    res.json({
      success: true,
      data: {
        boardUrl,
        frameAdded: `Workshop — AI Agent Recommendations (${clientName})`,
        agentCount: agents.length,
        categories: categories,
      },
    });
  }),
);

// =============================================================================
// ENGAGEMENT LIFECYCLE ROUTES (4-stage client workshop)
// =============================================================================

import {
  runClientIntelligence,
  runSurveyGeneration,
  buildSurveyDocx,
  runAgentMapping,
  runServiceMapping,
  runPersonaMapping,
  runEngagementMigration,
} from '../services/engagement.service';
import { runWorkshopPrepMiroBoardGeneration } from '../services/workshopPrepMiro.service';
import { runWorkshopPrepPptxGeneration } from '../services/workshopPrepPptx.service';

// Run DB migration at route registration time
runEngagementMigration().catch((err) =>
  logger.warn('[Engagement] Migration failed (non-fatal)', { err: err.message }),
);

// ---------------------------------------------------------------------------
// POST /api/workspaces — Create engagement (extends existing create)
// client_engagement workspaceType starts in pre_workshop stage
// Already handled by the existing POST / route above with workspaceType param
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// POST /api/workspaces/:id/intelligence — Run Stage 1a: Client Intelligence
// ---------------------------------------------------------------------------
router.post(
  '/:id/intelligence',
  asyncHandler(async (req, res) => {
    const userId = (req as any).user?.userId;
    if (!userId) throw new AppError('Unauthorized', 401);
    const { id } = req.params;

    const ws = await prisma.workspace.findUnique({ where: { workspaceId: id }, select: { requestedBy: true } });
    if (!ws) throw new AppError('Engagement not found', 404);

    // Run async — return immediately, poll for result
    runClientIntelligence(id).catch((err) => {
      logger.error('[Engagement] Intelligence failed', { id, err: err.message });
      prisma.workspace.update({ where: { workspaceId: id }, data: { errorMessage: `Intelligence failed: ${err.message}` } }).catch(() => {});
    });

    res.json({ success: true, message: 'Client intelligence started' });
  }),
);

// ---------------------------------------------------------------------------
// POST /api/workspaces/:id/survey — Run Stage 1b: Survey Generation
// ---------------------------------------------------------------------------
router.post(
  '/:id/survey',
  asyncHandler(async (req, res) => {
    const userId = (req as any).user?.userId;
    if (!userId) throw new AppError('Unauthorized', 401);
    const { id } = req.params;
    const { focusArea } = req.body as { focusArea?: string };

    const ws = await prisma.workspace.findUnique({
      where: { workspaceId: id },
      select: { clientIntelligence: true },
    });
    if (!ws) throw new AppError('Engagement not found', 404);

    runSurveyGeneration(id, focusArea).catch((err) => {
      logger.error('[Engagement] Survey gen failed', { id, err: err.message });
    });

    res.json({ success: true, message: 'Survey generation started' });
  }),
);

// ---------------------------------------------------------------------------
// GET /api/workspaces/:id/survey/download — Download survey DOCX
// ---------------------------------------------------------------------------
router.get(
  '/:id/survey/download',
  asyncHandler(async (req, res) => {
    const userId = (req as any).user?.userId;
    if (!userId) throw new AppError('Unauthorized', 401);
    const { id } = req.params;

    const buffer = await buildSurveyDocx(id);
    const ws = await prisma.workspace.findUnique({ where: { workspaceId: id }, select: { clientName: true } });
    const filename = `${(ws?.clientName || 'Workshop').replace(/[^a-z0-9]/gi, '_')}_PreWorkshop_Survey.docx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }),
);

// ---------------------------------------------------------------------------
// POST /api/workspaces/:id/survey/responses — Ingest survey responses
// ---------------------------------------------------------------------------
router.post(
  '/:id/survey/responses',
  asyncHandler(async (req, res) => {
    const userId = (req as any).user?.userId;
    if (!userId) throw new AppError('Unauthorized', 401);
    const { id } = req.params;
    const { responses } = req.body;

    if (!responses) throw new AppError('responses payload required', 400);

    await prisma.workspace.update({
      where: { workspaceId: id },
      data: {
        surveyResponses: typeof responses === 'string' ? responses : JSON.stringify(responses),
        engagementStage: 'workshop_prep',
      },
    });

    res.json({ success: true, message: 'Survey responses saved' });
  }),
);

// ---------------------------------------------------------------------------
// POST /api/workspaces/:id/prep-miro — Run Stage 2: Workshop Prep Miro Board
// ---------------------------------------------------------------------------
router.post(
  '/:id/prep-miro',
  asyncHandler(async (req, res) => {
    const userId = (req as any).user?.userId;
    if (!userId) throw new AppError('Unauthorized', 401);
    const { id } = req.params;

    const ws = await prisma.workspace.findUnique({
      where: { workspaceId: id },
      select: { clientIntelligence: true, surveyResponses: true },
    });
    if (!ws) throw new AppError('Engagement not found', 404);

    const intelligence = ws.clientIntelligence ? safeJsonParse(ws.clientIntelligence, null) : null;
    const surveyResponses = ws.surveyResponses ? safeJsonParse(ws.surveyResponses, null) : null;

    // Run async
    runWorkshopPrepMiroBoardGeneration(id, intelligence, surveyResponses).catch((err) => {
      logger.error('[Engagement] Prep Miro failed', { id, err: err.message });
      prisma.workspace.update({
        where: { workspaceId: id },
        data: { workshopPrepMiroStatus: 'error', errorMessage: `Prep Miro failed: ${err.message}` },
      }).catch(() => {});
    });

    res.json({ success: true, message: 'Workshop prep Miro board generation started' });
  }),
);

// ---------------------------------------------------------------------------
// POST /api/workspaces/:id/prep-pptx — Generate Workshop Prep Slide Deck
// ---------------------------------------------------------------------------
router.post(
  '/:id/prep-pptx',
  asyncHandler(async (req, res) => {
    const userId = (req as any).user?.userId;
    if (!userId) throw new AppError('Unauthorized', 401);
    const { id } = req.params;

    const ws = await prisma.workspace.findUnique({
      where: { workspaceId: id },
      select: { clientIntelligence: true, surveyResponses: true },
    });
    if (!ws) throw new AppError('Engagement not found', 404);

    const intelligence = ws.clientIntelligence ? safeJsonParse(ws.clientIntelligence, null) : null;
    const surveyResponses = ws.surveyResponses ? safeJsonParse(ws.surveyResponses, null) : null;

    // Set status to running immediately
    await prisma.workspace.update({
      where: { workspaceId: id },
      data: { workshopPrepPptxStatus: 'running' } as any,
    });

    // Run async
    runWorkshopPrepPptxGeneration(id, intelligence, surveyResponses).catch((err) => {
      logger.error('[PrepPptx] Generation failed', { id, err: err.message });
      prisma.workspace.update({
        where: { workspaceId: id },
        data: { workshopPrepPptxStatus: 'error' } as any,
      }).catch(() => {});
    });

    res.json({ success: true, message: 'Workshop prep slide deck generation started' });
  }),
);

// ---------------------------------------------------------------------------
// POST /api/workspaces/:id/workshop/notes — Save live meeting notes (Stage 3)
// ---------------------------------------------------------------------------
router.post(
  '/:id/workshop/notes',
  asyncHandler(async (req, res) => {
    const userId = (req as any).user?.userId;
    if (!userId) throw new AppError('Unauthorized', 401);
    const { id } = req.params;
    const { notes } = req.body;

    await prisma.workspace.update({
      where: { workspaceId: id },
      data: { workshopNotes: notes || '', engagementStage: 'workshop' },
    });

    res.json({ success: true, message: 'Notes saved' });
  }),
);

// ---------------------------------------------------------------------------
// POST /api/workspaces/:id/workshop/miro-context — Sync Miro items (Stage 3)
// ---------------------------------------------------------------------------
router.post(
  '/:id/workshop/miro-context',
  asyncHandler(async (req, res) => {
    const userId = (req as any).user?.userId;
    if (!userId) throw new AppError('Unauthorized', 401);
    const { id } = req.params;
    const { items } = req.body; // MiroContextItem[]

    await prisma.workspace.update({
      where: { workspaceId: id },
      data: {
        miroContextItems: typeof items === 'string' ? items : JSON.stringify(items || []),
        engagementStage: 'workshop',
      },
    });

    res.json({ success: true, message: 'Miro context saved' });
  }),
);

// ---------------------------------------------------------------------------
// POST /api/workspaces/:id/workshop/personas — Save workshop personas
// ---------------------------------------------------------------------------
router.post(
  '/:id/workshop/personas',
  asyncHandler(async (req, res) => {
    const userId = (req as any).user?.userId;
    if (!userId) throw new AppError('Unauthorized', 401);
    const { id } = req.params;
    const { personas } = req.body;

    await prisma.workspace.update({
      where: { workspaceId: id },
      data: {
        workshopPersonas: typeof personas === 'string' ? personas : JSON.stringify(personas || []),
        engagementStage: 'workshop',
      },
    });

    res.json({ success: true, message: 'Personas saved' });
  }),
);

// ---------------------------------------------------------------------------
// POST /api/workspaces/:id/workshop/pain-points — Save workshop pain points
// ---------------------------------------------------------------------------
router.post(
  '/:id/workshop/pain-points',
  asyncHandler(async (req, res) => {
    const userId = (req as any).user?.userId;
    if (!userId) throw new AppError('Unauthorized', 401);
    const { id } = req.params;
    const { painPoints } = req.body;

    await prisma.workspace.update({
      where: { workspaceId: id },
      data: {
        workshopPainPoints: typeof painPoints === 'string' ? painPoints : JSON.stringify(painPoints || []),
        engagementStage: 'workshop',
      },
    });

    res.json({ success: true, message: 'Pain points saved' });
  }),
);

// ---------------------------------------------------------------------------
// POST /api/workspaces/:id/workshop/generate-persona-mapping
// ---------------------------------------------------------------------------
router.post(
  '/:id/workshop/generate-persona-mapping',
  asyncHandler(async (req, res) => {
    const userId = (req as any).user?.userId;
    if (!userId) throw new AppError('Unauthorized', 401);
    const { id } = req.params;

    await prisma.workspace.update({
      where: { workspaceId: id },
      data: { personaMappingStatus: 'running' },
    });

    runPersonaMapping(id).catch((err) => {
      logger.error('[Engagement] Persona mapping failed', { id, err: err.message });
      prisma.workspace.update({
        where: { workspaceId: id },
        data: { personaMappingStatus: 'error' },
      }).catch(() => {});
    });

    res.json({ success: true, message: 'Persona mapping started' });
  }),
);

// ---------------------------------------------------------------------------
// POST /api/workspaces/:id/map-agents — Run Stage 3: OOTB Agent Mapping
// ---------------------------------------------------------------------------
router.post(
  '/:id/map-agents',
  asyncHandler(async (req, res) => {
    const userId = (req as any).user?.userId;
    if (!userId) throw new AppError('Unauthorized', 401);
    const { id } = req.params;

    await prisma.workspace.update({
      where: { workspaceId: id },
      data: { agentMappingStatus: 'running' },
    });

    runAgentMapping(id).catch((err) => {
      logger.error('[Engagement] Agent mapping failed', { id, err: err.message });
      prisma.workspace.update({
        where: { workspaceId: id },
        data: { agentMappingStatus: 'error', errorMessage: `Agent mapping failed: ${err.message}` },
      }).catch(() => {});
    });

    res.json({ success: true, message: 'Agent mapping started' });
  }),
);

// ---------------------------------------------------------------------------
// POST /api/workspaces/:id/map-services — Run Northstar Integrators Service Mapping
// ---------------------------------------------------------------------------
router.post(
  '/:id/map-services',
  asyncHandler(async (req, res) => {
    const userId = (req as any).user?.userId;
    if (!userId) throw new AppError('Unauthorized', 401);
    const { id } = req.params;

    await prisma.$executeRawUnsafe(
      `UPDATE workspaces SET service_mapping_status = 'running' WHERE workspace_id = $1`,
      id,
    );

    runServiceMapping(id).catch((err) => {
      logger.error('[Engagement] Service mapping failed', { id, err: err.message });
      prisma.$executeRawUnsafe(
        `UPDATE workspaces SET service_mapping_status = 'error' WHERE workspace_id = $1`,
        id,
      ).catch(() => {});
    });

    res.json({ success: true, message: 'Service mapping started' });
  }),
);

// ---------------------------------------------------------------------------
// GET /api/workspaces/:id/engagement — Get full engagement detail
// ---------------------------------------------------------------------------
router.get(
  '/:id/engagement',
  asyncHandler(async (req, res) => {
    const userId = (req as any).user?.userId;
    if (!userId) throw new AppError('Unauthorized', 401);
    const { id } = req.params;

    const ws = await prisma.workspace.findUnique({ where: { workspaceId: id } });
    if (!ws) throw new AppError('Engagement not found', 404);

    // Fetch raw columns that are not in Prisma schema (added via ALTER TABLE migration)
    const rawRows = await prisma.$queryRawUnsafe<Array<{ service_mappings: string | null; service_mapping_status: string | null }>>(
      `SELECT service_mappings, service_mapping_status FROM workspaces WHERE workspace_id = $1`,
      id,
    );
    const rawRow = rawRows[0] ?? {};

    res.json({
      success: true,
      data: {
        workspace_id: ws.workspaceId,
        workspace_type: ws.workspaceType || 'workshop_analysis',
        name: ws.name,
        client_name: ws.clientName,
        engagement_stage: (ws as any).engagementStage,
        // Stage 1
        workshop_focus: (ws as any).workshopFocus || 'ITSM',
        client_intelligence: safeJsonParse((ws as any).clientIntelligence, null),
        preworkshop_survey: safeJsonParse((ws as any).preworkshopSurvey, null),
        survey_doc_url: (ws as any).surveyDocUrl,
        // Stage 2
        survey_responses: safeJsonParse((ws as any).surveyResponses, null),
        workshop_prep_miro_id: (ws as any).workshopPrepMiroId,
        workshop_prep_miro_url: (ws as any).workshopPrepMiroUrl,
        workshop_prep_miro_status: (ws as any).workshopPrepMiroStatus,
        workshop_prep_pptx_status: (ws as any).workshopPrepPptxStatus || 'pending',
        workshop_prep_pptx_job_id: (ws as any).workshopPrepPptxJobId,
        workshop_prep_pptx_step: (ws as any).workshopPrepPptxStep || null,
        // Stage 3
        workshop_notes: (ws as any).workshopNotes,
        miro_context_items: safeJsonParse((ws as any).miroContextItems, []),
        agent_mappings: safeJsonParse((ws as any).agentMappings, []),
        agent_mapping_status: (ws as any).agentMappingStatus,
        service_mappings: safeJsonParse(rawRow.service_mappings ?? null, []),
        service_mapping_status: rawRow.service_mapping_status ?? 'pending',
        workshop_personas: safeJsonParse((ws as any).workshopPersonas, []),
        workshop_pain_points: safeJsonParse((ws as any).workshopPainPoints, []),
        persona_mappings: safeJsonParse((ws as any).personaMappings, []),
        persona_mapping_status: (ws as any).personaMappingStatus || 'pending',
        // Stage 4 (post-workshop)
        analysis_status: ws.analysisStatus,
        analysis_result: safeJsonParse(ws.analysisResult, null),
        miro_status: ws.miroStatus,
        miro_board_url: ws.miroBoardUrl,
        pptx_status: ws.pptxStatus,
        pipeline_log: ws.pipelineLog,
        error_message: ws.errorMessage,
        updated_at: ws.updatedAt,
      },
    });
  }),
);

export default router;
