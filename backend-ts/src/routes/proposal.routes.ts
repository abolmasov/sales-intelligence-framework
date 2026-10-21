import express, { Request, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { getPDFService } from '../services/pdf.service';
import { getProposalWorkflow } from '../services/langgraph-workflow.service';
import { getProjectAnalysisService } from '../services/project-analysis.service';
import { getPrismaClient } from '../config/database';
import {
  createProposalJobFromTranscript,
  serializeProposalJobRecord,
  scheduleProposalJobProcessing,
} from '../services/proposalJob.service';
import { getInternalKnowledgeService, InternalKnowledgeDocument } from '../services/internal-knowledge.service';
import { getLoggerService } from '../services/logger.service';
import { getAccessibleMeetingIdsForUserFlexible, userHasMeetingAccess, userMatchesRequestedBy } from '../utils/meetingAccess';
import { getRFPResearchService, RFPLogEntry } from '../services/rfp-research.service';
import { getExcelService } from '../services/excel.service';
import { generateRFPResponseDocx } from '../utils/rfpDocxExport';

const router = express.Router();
const prisma = getPrismaClient();
const pdfService = getPDFService();
const internalKbService = getInternalKnowledgeService();
const logger = getLoggerService();

// Configure multer for file upload (in-memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'application/vnd.ms-excel', // XLS
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // XLSX
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOCX, TXT, XLS, or XLSX files are allowed'));
    }
  }
});

const excelService = getExcelService();

// Configure multer for disk storage (for streaming)


// In-memory extracted text store
const extractedDocs: Record<string, string> = {};

const sanitizeText = (text: string | null | undefined) =>
  typeof text === 'string' ? text.replace(/\u0000/g, '') : '';

const compactText = (value: unknown, maxChars: number): string => {
  const raw = typeof value === 'string' ? value : JSON.stringify(value || {});
  return sanitizeText(raw).replace(/\s+/g, ' ').trim().slice(0, maxChars);
};

const sleep = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

const mapInternalKnowledgeResultsToDocuments = (
  internalKbSummary: string,
  internalKbDocuments: InternalKnowledgeDocument[] = []
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
    if (text.trim().length === 0) return;
    results.push({
      id: doc.id || `internal-kb-doc-${idx}`,
      name: doc.title || `InternalKnowledge Document ${idx + 1}`,
      text,
    });
  });

  return results;
};

async function extractTextFromUploadedFile(uploadedFile: Express.Multer.File): Promise<string> {
  if (uploadedFile.mimetype === 'application/pdf') {
    const healthCheck = await pdfService.checkPDFHealth(uploadedFile.buffer);
    if (!healthCheck.isHealthy) {
      throw new Error(healthCheck.issues.join(', ') || 'PDF file has issues');
    }
    return sanitizeText(await pdfService.extractTextFromPDF(uploadedFile.buffer));
  }
  if (uploadedFile.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return sanitizeText(await pdfService.extractTextFromDOCX(uploadedFile.buffer));
  }
  if (uploadedFile.mimetype === 'text/plain') {
    return sanitizeText(uploadedFile.buffer.toString('utf-8'));
  }
  if (
    uploadedFile.mimetype === 'application/vnd.ms-excel' ||
    uploadedFile.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) {
    return sanitizeText(excelService.extractTextFromExcel(uploadedFile.buffer));
  }
  throw new Error(`Unsupported file type: ${uploadedFile.mimetype}`);
}

router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No file uploaded"
      });
    }

    let extracted = "";

    // Extract text in-memory
    if (req.file.mimetype === "application/pdf") {
      extracted = sanitizeText(await pdfService.extractTextFromPDF(req.file.buffer));
    } else if (req.file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      extracted = sanitizeText(await pdfService.extractTextFromDOCX(req.file.buffer));
    } else {
      return res.status(400).json({ error: "Unsupported file type" });
    }

    // Create a fileId
    const fileId = uuidv4();

    // Store extracted text in memory
    extractedDocs[fileId] = extracted;

    return res.json({
      success: true,
      fileId,
      textLength: extracted.length
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Extraction failed" });
  }
});

router.post('/jobs', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Missing authenticated user id' });
    }

    const accessToken = req.user?.accessToken || null;
    const analysisTypeRaw = (req.body.analysisType as string) || 'enhanced';
    const normalizedType = (['quick', 'enhanced'].includes(analysisTypeRaw)
      ? analysisTypeRaw
      : 'enhanced') as 'quick' | 'enhanced';
    const requesterProfile = req.user as { email?: string } | undefined;
    const requestedBy =
      requesterProfile?.email ||
      (req.body.requestedBy as string) ||
      (req.headers['x-user-email'] as string) ||
      null;
    const meetingId =
      (req.body.meetingId as string) ||
      (req.body.meeting_id as string) ||
      (req.body.meetingID as string) ||
      null;
    const transcriptAnalysisIdRaw =
      (req.body.transcriptAnalysisId as string) ||
      (req.body.transcript_analysis_id as string) ||
      null;
    const transcriptAnalysisId = transcriptAnalysisIdRaw ? transcriptAnalysisIdRaw.trim() : null;

    let job;

    if (transcriptAnalysisId) {
      const transcriptAnalysis = await prisma.transcriptAnalysis.findUnique({
        where: { analysisId: transcriptAnalysisId },
        select: { analysisId: true, meetingId: true, requestedBy: true },
      });
      if (!transcriptAnalysis) {
        return res.status(404).json({ success: false, error: 'Transcript analysis not found' });
      }

      if (transcriptAnalysis.meetingId) {
        const canView = await userHasMeetingAccess(userId, transcriptAnalysis.meetingId);
        if (!canView) {
          return res.status(403).json({ success: false, error: 'You do not have access to this meeting.' });
        }
      } else if (!userMatchesRequestedBy(req.user, transcriptAnalysis.requestedBy)) {
        return res.status(403).json({ success: false, error: 'You do not have access to this analysis.' });
      }

      job = await createProposalJobFromTranscript({
        transcriptAnalysisId,
        meetingId,
        requestedBy,
        analysisType: normalizedType,
        accessToken,
        metadata: {
          submissionMethod: 'transcript-analysis',
        },
      });
    } else {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No RFP file uploaded' });
      }

      if (meetingId) {
        const canAttach = await userHasMeetingAccess(userId, meetingId);
        if (!canAttach) {
          return res.status(403).json({ success: false, error: 'You do not have access to this meeting.' });
        }
      }

      const rfpText = await extractTextFromUploadedFile(req.file);
      if (!rfpText || !rfpText.trim()) {
        return res
          .status(400)
          .json({ success: false, error: 'Extracted text is empty. Please upload a valid document.' });
      }

      const jobId = uuidv4();
      job = await prisma.proposalJob.create({
        data: {
          jobId,
          requestedBy,
          meetingId,
          analysisType: normalizedType,
          status: 'processing',
          currentStep: 'queued',
          fileName: req.file.originalname,
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
          rfpText,
          rfpSummary: rfpText.substring(0, 500),
          metadata: JSON.stringify({
            textLength: rfpText.length,
            fileSize: req.file.size,
            analysisType: normalizedType,
            submissionMethod: 'manual-upload',
          }),
        },
      });

      await scheduleProposalJobProcessing(jobId, accessToken || null, { awaitCompletion: false });
    }

    return res.status(202).json({
      success: true,
      message: transcriptAnalysisId
        ? 'Proposal job queued from transcript analysis'
        : 'Proposal job queued successfully',
      data: serializeProposalJobRecord(job),
    });
  } catch (error) {
    console.error('❌ Failed to create proposal job', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to queue proposal job',
    });
  }
});

/**
 * @route POST /api/proposal/research-rfp-jobs
 * @desc Queue RFP research as an async job (pre/post-call style)
 * @access Requires Bearer token authentication
 */
router.post('/research-rfp-jobs', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Missing authenticated user id' });
    }

    const accessToken = req.user?.accessToken;
    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: 'Missing authenticated Microsoft session. Please log in again.',
      });
    }

    // Extract RFP text from uploaded file or body
    let rfpText = '';
    let fileName = 'Text Input';
    let fileSize = 0;
    let mimeType = 'text/plain';

    if (req.file) {
      fileName = req.file.originalname;
      fileSize = req.file.size;
      mimeType = req.file.mimetype;
      rfpText = await extractTextFromUploadedFile(req.file);
    } else if (req.body.rfpText) {
      rfpText = sanitizeText(req.body.rfpText);
      fileSize = Buffer.byteLength(rfpText || '', 'utf8');
    } else {
      return res.status(400).json({
        success: false,
        error: 'No RFP document uploaded or text provided.',
      });
    }

    if (!rfpText || rfpText.trim().length < 100) {
      return res.status(400).json({
        success: false,
        error: 'RFP text is too short or empty. Please provide a valid RFP document.',
      });
    }

    const customPrompt = req.body.customPrompt?.trim() || null;
    const requestedBy =
      (req.user as { email?: string } | undefined)?.email ||
      (req.headers['x-user-email'] as string) ||
      null;

    const jobId = uuidv4();
    const job = await prisma.proposalJob.create({
      data: {
        jobId,
        requestedBy,
        analysisType: 'rfp_research',
        status: 'processing',
        currentStep: 'queued',
        fileName,
        fileSize,
        mimeType,
        rfpText,
        rfpSummary: rfpText.substring(0, 500),
        metadata: JSON.stringify({
          submissionMethod: req.file ? 'file-upload' : 'text-input',
          textLength: rfpText.length,
          hasCustomPrompt: Boolean(customPrompt),
          customPrompt,
          mode: 'rfp_research',
        }),
      },
    });

    await scheduleProposalJobProcessing(jobId, accessToken || null, { awaitCompletion: false });

    return res.status(202).json({
      success: true,
      message: 'RFP research job queued successfully',
      data: serializeProposalJobRecord(job),
    });
  } catch (error) {
    console.error('❌ Failed to queue RFP research job', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to queue RFP research job',
    });
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

    const job = await prisma.proposalJob.findUnique({
      where: { jobId },
      select: { jobId: true, meetingId: true, requestedBy: true, status: true },
    });
    if (!job) {
      return res.status(404).json({ success: false, error: 'Proposal job not found' });
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
        message: 'Proposal job is not running',
        data: { jobId, cancelled: false },
      });
    }

    await prisma.proposalJob.update({
      where: { jobId },
      data: {
        status: 'cancelled',
        errorMessage: 'Cancelled by user',
        completedAt: new Date(),
      },
    });

    return res.json({
      success: true,
      message: 'Proposal job cancelled',
      data: { jobId, cancelled: true },
    });
  } catch (error: any) {
    logger.error('Failed to cancel proposal job', error, { jobId: req.params.jobId });
    return res.status(500).json({ success: false, error: error?.message || 'Failed to cancel proposal job' });
  }
});

router.get('/jobs', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Missing authenticated user id' });
    }

    const statusFilter = req.query.status as string | undefined;
    const limitParam = parseInt((req.query.limit as string) || '25', 10);
    const take = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 25;

    const jobs = await prisma.proposalJob.findMany({
      where: statusFilter ? { status: statusFilter } : undefined,
      orderBy: { createdAt: 'desc' },
      take: Math.max(take * 4, 200),
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
      .slice(0, take);

    return res.json({
      success: true,
      data: visible.map((job: any) => serializeProposalJobRecord(job)),
    });
  } catch (error) {
    console.error('❌ Failed to list proposal jobs', error);
    return res.status(500).json({ success: false, error: 'Failed to load proposal jobs' });
  }
});

router.get('/jobs/:jobId', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Missing authenticated user id' });
    }

    const { jobId } = req.params;
    const job = await prisma.proposalJob.findUnique({ where: { jobId } });

    if (!job) {
      return res.status(404).json({ success: false, error: 'Proposal job not found' });
    }

    if (job.meetingId) {
      const canView = await userHasMeetingAccess(userId, job.meetingId);
      if (!canView) {
        return res.status(403).json({ success: false, error: 'You do not have access to this meeting.' });
      }
    } else if (!userMatchesRequestedBy(req.user, job.requestedBy)) {
      return res.status(403).json({ success: false, error: 'You do not have access to this proposal.' });
    }

    return res.json({ success: true, data: serializeProposalJobRecord(job, true) });
  } catch (error) {
    console.error('❌ Failed to load proposal job detail', error);
    return res.status(500).json({ success: false, error: 'Failed to load job detail' });
  }
});

/**
 * @route DELETE /api/proposal/jobs/:jobId
 * @desc Delete a proposal job
 */
router.delete('/jobs/:jobId', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Missing authenticated user id' });
    }

    const { jobId } = req.params;
    const job = await prisma.proposalJob.findUnique({ where: { jobId } });

    if (!job) {
      return res.status(404).json({ success: false, error: 'Proposal job not found' });
    }

    if (job.meetingId) {
      const canDelete = await userHasMeetingAccess(userId, job.meetingId);
      if (!canDelete) {
        return res.status(403).json({ success: false, error: 'You do not have access to delete this meeting\'s proposal.' });
      }
    } else if (!userMatchesRequestedBy(req.user, job.requestedBy)) {
      return res.status(403).json({ success: false, error: 'You do not have access to delete this proposal.' });
    }

    await prisma.proposalJob.delete({ where: { jobId } });

    return res.json({ success: true, message: 'Proposal job deleted successfully' });
  } catch (error) {
    console.error('❌ Failed to delete proposal job', error);
    return res.status(500).json({ success: false, error: 'Failed to delete proposal job' });
  }
});

/**
 * @route PATCH /api/proposal/jobs/:jobId
 * @desc Update/edit the proposal content (for editable outputs feature)
 */
router.patch('/jobs/:jobId', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Missing authenticated user id' });
    }

    const { jobId } = req.params;
    const { editedProposalData } = req.body;

    if (!editedProposalData) {
      return res.status(400).json({ success: false, error: 'editedProposalData is required' });
    }

    const job = await prisma.proposalJob.findUnique({ where: { jobId } });

    if (!job) {
      return res.status(404).json({ success: false, error: 'Proposal job not found' });
    }

    if (job.meetingId) {
      const canEdit = await userHasMeetingAccess(userId, job.meetingId);
      if (!canEdit) {
        return res.status(403).json({ success: false, error: 'You do not have access to edit this proposal.' });
      }
    } else if (!userMatchesRequestedBy(req.user, job.requestedBy)) {
      return res.status(403).json({ success: false, error: 'You do not have access to edit this proposal.' });
    }

    // Update the edited proposal data
    await prisma.proposalJob.update({
      where: { jobId },
      data: {
        editedProposalData: typeof editedProposalData === 'string'
          ? editedProposalData
          : JSON.stringify(editedProposalData),
        lastEditedAt: new Date(),
      },
    });

    return res.json({
      success: true,
      message: 'Proposal updated successfully',
      data: { jobId, lastEditedAt: new Date().toISOString() },
    });
  } catch (error) {
    console.error('❌ Failed to update proposal job', error);
    return res.status(500).json({ success: false, error: 'Failed to update proposal' });
  }
});

/**
 * @route POST /api/proposal/generate
 * @desc One-click proposal generation workflow with file upload
 * @access Requires Bearer token authentication
 */
router.post('/generate', upload.any(), async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    console.log('🚀 Starting one-click proposal generation...');
    
    // 1. Validate authentication
    const accessToken = req.user?.accessToken;
    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: 'Missing authenticated Microsoft session',
      });
    }
    
    // 2. Extract RFP text from uploaded file
    let rfpText = '';
    
    // With upload.any(), files are in req.files array
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded. Please upload an RFP document (PDF or DOCX).',
      });
    }

    // Get the first uploaded file
    const uploadedFile = (req.files as Express.Multer.File[])[0];
    console.log(`📄 File received: ${uploadedFile.originalname} (${uploadedFile.size} bytes)`);
    
    const pdfService = getPDFService();
    
    console.log('\n' + '═'.repeat(80));
    console.log('📝 STEP 3: EXTRACTING TEXT FROM FILE');
    console.log('═'.repeat(80));
    console.log(`📋 File Type: ${uploadedFile.mimetype}`);
    console.log(`📏 File Size: ${(uploadedFile.size / 1024).toFixed(2)} KB`);
    console.log('═'.repeat(80) + '\n');
    
    // Check file type and extract text accordingly
    if (uploadedFile.mimetype === 'application/pdf') {
      console.log('🔍 Detected: PDF file');
      console.log('📄 Processing PDF file...');
      const pdfBuffer = uploadedFile.buffer;
      
      // Check PDF health first
      console.log('🏥 Step 3.1: Checking PDF health...');
      const healthCheck = await pdfService.checkPDFHealth(pdfBuffer);
      
      console.log(`   ├─ Is Healthy: ${healthCheck.isHealthy ? '✅ YES' : '❌ NO'}`);
      console.log(`   └─ Issues: ${healthCheck.issues.length > 0 ? healthCheck.issues.join(', ') : 'None'}`);
      
      if (!healthCheck.isHealthy) {
        console.log('\n❌ PDF health check failed - returning error to client\n');
        return res.status(400).json({
          success: false,
          error: 'PDF file has issues',
          details: healthCheck.issues,
        });
      }
      
      console.log('✅ PDF is healthy, proceeding with extraction...');
      console.log('📖 Step 3.2: Extracting text from PDF...');
      
      rfpText = await pdfService.extractTextFromPDF(pdfBuffer);
      
      console.log(`✅ Extraction complete!`);
      console.log(`   ├─ Total Characters: ${rfpText.length.toLocaleString()}`);
      console.log(`   ├─ Total Words: ${rfpText.split(/\s+/).length.toLocaleString()}`);
      console.log(`   ├─ Total Lines: ${rfpText.split('\n').length.toLocaleString()}`);
      console.log(`   └─ First 200 chars: "${rfpText.substring(0, 200).replace(/\n/g, ' ')}..."`);
      
      // Display full extracted content
      console.log('\n' + '📄'.repeat(80));
      console.log('📄 EXTRACTED PDF CONTENT (First 5000 characters):');
      console.log('📄'.repeat(80));
      console.log('\n--- START OF EXTRACTED TEXT ---\n');
      console.log(rfpText.substring(0, 5000));
      if (rfpText.length > 5000) {
        console.log('\n\n... [TRUNCATED - Total length: ' + rfpText.length + ' characters] ...\n');
      }
      console.log('\n--- END OF EXTRACTED TEXT ---\n');
      console.log('📄'.repeat(80) + '\n');
      
    } else if (uploadedFile.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      console.log('🔍 Detected: DOCX (Word) file');
      console.log('📄 Processing DOCX file...');
      console.log('📖 Step 3.1: Extracting text from DOCX...');
      
      rfpText = await pdfService.extractTextFromDOCX(uploadedFile.buffer);
      
      console.log(`✅ Extraction complete!`);
      console.log(`   ├─ Total Characters: ${rfpText.length.toLocaleString()}`);
      console.log(`   ├─ Total Words: ${rfpText.split(/\s+/).length.toLocaleString()}`);
      console.log(`   ├─ Total Lines: ${rfpText.split('\n').length.toLocaleString()}`);
      console.log(`   └─ First 200 chars: "${rfpText.substring(0, 200).replace(/\n/g, ' ')}..."`);
      
    } else if (uploadedFile.mimetype === 'text/plain') {
      console.log('🔍 Detected: TXT (Plain Text) file');
      console.log('📄 Processing TXT file...');
      console.log('📖 Step 3.1: Reading text directly...');
      
      rfpText = uploadedFile.buffer.toString('utf-8');
      
      console.log(`✅ Reading complete!`);
      console.log(`   ├─ Total Characters: ${rfpText.length.toLocaleString()}`);
      console.log(`   ├─ Total Words: ${rfpText.split(/\s+/).length.toLocaleString()}`);
      console.log(`   ├─ Total Lines: ${rfpText.split('\n').length.toLocaleString()}`);
      console.log(`   └─ First 200 chars: "${rfpText.substring(0, 200).replace(/\n/g, ' ')}..."`);
      
    } else {
      console.log(`❌ Unsupported file type detected: ${uploadedFile.mimetype}`);
      console.log('   Supported types: application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document, text/plain');
      console.log('\n❌ Returning error to client\n');
      return res.status(400).json({
        success: false,
        error: `Unsupported file type: ${uploadedFile.mimetype}. Please upload PDF, DOCX, or TXT file.`,
      });
    }
    
    console.log('\n' + '═'.repeat(80));
    console.log('✅ STEP 3 COMPLETE: Text extraction successful');
    console.log('═'.repeat(80) + '\n');
    
    if (!rfpText || rfpText.trim().length === 0) {
      console.log('❌ VALIDATION FAILED: Extracted text is empty!');
      console.log('   This could mean:');
      console.log('   - The file is corrupted');
      console.log('   - The file contains only images (scanned PDF)');
      console.log('   - The file format is not supported');
      console.log('\n❌ Returning error to client\n');
      return res.status(400).json({
        success: false,
        error: 'Could not extract text from the uploaded file. The file may be empty or corrupted.',
      });
    }
    
    console.log('✅ VALIDATION PASSED: Extracted text is valid\n');
    
    // 3. Extract RFP requirements
    const rfpRequirements = pdfService.extractRFPRequirements(rfpText);
    console.log(`📋 Extracted RFP requirements: ${rfpRequirements.length} characters`);
    console.log(`🔍 Sample Requirements Text:\n${rfpRequirements.substring(0, 500)}\n...`);
    
    // 4. Get project context and client context
    console.log('⚙️ Analyzing project context...\n');
    const analysisService = getProjectAnalysisService();
    
    const projectName = await analysisService.extractProjectName(rfpRequirements);
    const clientContext = await analysisService.extractClientContext(rfpRequirements);
    
    // 5. Use InternalKnowledge directly (no SharePoint discovery/fallback)
    const internalKbContext = [
      `Project: ${projectName || 'Unknown Project'}`,
      `Client context: ${compactText(clientContext, 700)}`,
      `RFP summary: ${compactText(rfpRequirements, 900)}`,
      'Need: relevant past engagements, similar case studies, proposal/SOW artifacts.',
    ].join('\n');

    let projectDocumentsText: { id: string; name: string; text: string }[] = [];
    let internalKbSummaryLength = 0;
    let internalKbDocumentsFound = 0;
    let internalKbSummaryText = '';

    const maxKmhubAttempts = 3;
    let internalKbSuccess = false;
    let lastKmhubError: string | null = null;

    for (let attempt = 1; attempt <= maxKmhubAttempts; attempt++) {
      try {
        console.log(`🧠 Requesting InternalKnowledge research with structured sections (attempt ${attempt}/${maxKmhubAttempts})...`);
        const internalKbResults = await internalKbService.searchWithStructuredSections(
          projectName || uploadedFile?.originalname || 'Client Research',
          internalKbContext,
          accessToken
        );
        internalKbSummaryText = internalKbResults.summary || '';
        internalKbSummaryLength = internalKbSummaryText.length;
        internalKbDocumentsFound = internalKbResults.documents?.length || 0;
        projectDocumentsText = mapInternalKnowledgeResultsToDocuments(
          internalKbSummaryText,
          internalKbResults.documents || []
        );

        if (projectDocumentsText.length > 0 || internalKbSummaryLength > 0) {
          internalKbSuccess = true;
          console.log(
            `✅ InternalKnowledge returned ${internalKbDocumentsFound} documents (${projectDocumentsText.length} structured text blocks)`
          );
          if (internalKbSummaryLength > 0) {
            console.log('\n===== InternalKnowledge Structured Output =====\n');
            console.log(internalKbSummaryText);
            console.log('\n===== End InternalKnowledge Output =====\n');
            logger.info('InternalKnowledge structured summary captured for proposal upload workflow', {
              context: 'proposal-upload',
              attempt,
              internalKbSummaryLength,
              internalKbDocumentsFound,
              sharepointCandidates: 0,
            });
          }
          break;
        }

        lastKmhubError = 'InternalKnowledge returned empty result';
        logger.warn('InternalKnowledge returned empty result during proposal upload workflow', {
          context: 'proposal-upload',
          attempt,
          sharepointCandidates: 0,
        });
      } catch (err) {
        lastKmhubError = err instanceof Error ? err.message : String(err);
        console.warn(`⚠️ InternalKnowledge research failed (attempt ${attempt}/${maxKmhubAttempts}):`, err);
        logger.warn('InternalKnowledge structured research attempt failed for proposal upload workflow', {
          context: 'proposal-upload',
          attempt,
          maxKmhubAttempts,
          error: lastKmhubError,
          sharepointCandidates: 0,
        });
      }

      if (attempt < maxKmhubAttempts) {
        await sleep(attempt * 1500);
      }
    }

    if (!internalKbSuccess) {
      internalKbSummaryText = '';
      internalKbSummaryLength = 0;
      internalKbDocumentsFound = 0;
      projectDocumentsText = [];
      console.log('⚠️ InternalKnowledge failed after retries. Proceeding with RFP-only context.');
      logger.warn('Proceeding with RFP-only context after InternalKnowledge failure (proposal-upload)', {
        context: 'proposal-upload',
        attempts: maxKmhubAttempts,
        lastKmhubError,
      });
    }

    if (internalKbSummaryText.trim().length) {
      console.log('🧠 InternalKnowledge structured context being sent to proposal workflow:\n', internalKbSummaryText);
      logger.info('InternalKnowledge structured context sent to workflow', {
        context: 'proposal-upload',
        internalKbSummaryLength,
        internalKbDocumentsFound,
      });
    } else {
      console.log('⚠️ No InternalKnowledge context available; proceeding with RFP only.');
      logger.warn('Proceeding without InternalKnowledge context', { context: 'proposal-upload' });
    }
    
    // 6. Execute the 5-step LangGraph workflow
    console.log('⚙️ Starting AI-powered proposal generation workflow...\n');
    const workflow = getProposalWorkflow();
    const result = await workflow.generateProposal(
      rfpRequirements,
      { projectName },
      clientContext,
      projectDocumentsText
    );
    
    // 7. Check for errors
    if (!result.finalProposal || result.finalProposal.length === 0) {
      console.error('❌ Workflow failed to generate proposal');
      return res.status(500).json({
        success: false,
        error: 'Proposal generation failed - no output generated',
        partialResult: {
          analysis: result.analysis ? 'Complete' : 'Missing',
          outline: result.outline ? 'Complete' : 'Missing',
          fullProposal: result.fullProposal ? 'Complete' : 'Missing',
          review: result.review ? 'Complete' : 'Missing',
        },
      });
    }
    
    // 8. Return successful result
    const totalTime = Date.now() - startTime;
    console.log(`\n🎉 One-click proposal generation complete in ${(totalTime / 1000).toFixed(1)}s`);
    
    return res.status(200).json({
      success: true,
      message: 'Proposal generated successfully',
      data: {
        projectName: projectName,
        proposal: result.finalProposal,
        analysis: result.analysis,
        outline: result.outline,
        review: result.review,
        metadata: {
          documentName: uploadedFile?.originalname || 'Unknown Document',
          extractedTextLength: rfpText.length,
          relatedDocumentsLoaded: projectDocumentsText.length,
          sharepointCandidates: 0,
          internalKbDocumentsFound,
          internalKbSummaryLength,
          analysisComplete: !!result.analysis,
          outlineComplete: !!result.outline,
          fullProposalComplete: !!result.fullProposal,
          reviewComplete: !!result.review,
          finalProposalLength: result.finalProposal?.length || 0,
          totalTime,
        },
        clientContext: clientContext,
      },
    });
    
  } catch (error) {
    console.error('❌ One-click proposal generation failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Proposal generation failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
});

/**
 * @route GET /api/proposal/generate-stream
 * @desc Stream proposal generation with real-time progress updates (SSE)
 * @access Requires Bearer token in query param
 */
router.get('/generate-stream', async (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || 'http://localhost:3000');
  res.write(
    `data: ${JSON.stringify({
      type: 'error',
      message:
        'Streaming proposal generation requires a configured worker queue. Use POST /api/proposal/generate for local demos.',
    })}\n\n`
  );
  res.end();
});

/**
 * @route POST /api/proposal/analyze-rfp
 * @desc Analyze RFP document without generating full proposal
 * @access Requires Bearer token authentication
 */
router.post('/analyze-rfp', upload.single('rfpDocument'), async (req: Request, res: Response) => {
  try {
    console.log('🔍 Analyzing RFP document...');
    
    // Ensure we have an authenticated Microsoft session
    if (!req.user?.accessToken) {
      return res.status(401).json({
        success: false,
        error: 'Missing authenticated Microsoft session',
      });
    }
    
    // Validate file upload
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No RFP document uploaded',
      });
    }
    
    // Extract text
    const pdfService = getPDFService();
    let rfpText = '';
    
    if (req.file.mimetype === 'application/pdf') {
      rfpText = await pdfService.extractTextFromPDF(req.file.buffer);
    } else {
      rfpText = await pdfService.extractTextFromDOCX(req.file.buffer);
    }
    
    // Extract requirements and client context
    const rfpRequirements = pdfService.extractRFPRequirements(rfpText);
    
    // Use project analysis service to extract context
    
    const analysisService = getProjectAnalysisService();
    
    const [projectName, clientContext] = await Promise.all([
      analysisService.extractProjectName(rfpRequirements),
      analysisService.extractClientContext(rfpRequirements),
    ]);
    
    return res.status(200).json({
      success: true,
      data: {
        projectName,
        clientContext,
        textLength: rfpText.length,
        requirementsLength: rfpRequirements.length,
      },
    });
    
  } catch (error) {
    console.error('❌ RFP analysis failed:', error);
    return res.status(500).json({
      success: false,
      error: 'RFP analysis failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
});

/**
 * @route POST /api/proposal/research-rfp
 * @desc Research RFP - Extract questions and answer them using internal knowledge (InternalKnowledge + Case Studies)
 * @access Requires Bearer token authentication
 */
router.post('/research-rfp', upload.single('file'), async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    console.log('\n🔬 Starting RFP Research...');

    // Validate authentication
    const accessToken = req.user?.accessToken;
    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: 'Missing authenticated Microsoft session. Please log in again.',
      });
    }

    // Extract RFP text from uploaded file or body
    let rfpText = '';

    if (req.file) {
      console.log(`📄 File received: ${req.file.originalname} (${req.file.size} bytes)`);
      rfpText = await extractTextFromUploadedFile(req.file);
    } else if (req.body.rfpText) {
      rfpText = sanitizeText(req.body.rfpText);
    } else {
      return res.status(400).json({
        success: false,
        error: 'No RFP document uploaded or text provided.',
      });
    }

    if (!rfpText || rfpText.trim().length < 100) {
      return res.status(400).json({
        success: false,
        error: 'RFP text is too short or empty. Please provide a valid RFP document.',
      });
    }

    console.log(`📝 RFP text extracted: ${rfpText.length} characters`);

    // Process RFP using the research service
    const rfpResearchService = getRFPResearchService();
    const result = await rfpResearchService.processRFP(rfpText, accessToken);

    const totalTime = Date.now() - startTime;
    console.log(`\n✅ RFP Research complete in ${(totalTime / 1000).toFixed(1)}s`);

    return res.status(200).json({
      success: true,
      message: 'RFP research completed successfully',
      data: result,
    });
  } catch (error) {
    console.error('❌ RFP Research failed:', error);
    return res.status(500).json({
      success: false,
      error: 'RFP research failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
});

/**
 * @route POST /api/proposal/research-rfp-stream
 * @desc Research RFP with live streaming logs via SSE
 * @access Requires Bearer token authentication
 */
router.post('/research-rfp-stream', upload.single('file'), async (req: Request, res: Response) => {
  try {
    console.log('\n🔬 Starting RFP Research with Streaming Logs...');

    // Validate authentication
    const accessToken = req.user?.accessToken;
    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: 'Missing authenticated Microsoft session. Please log in again.',
      });
    }

    // Extract RFP text from uploaded file or body
    let rfpText = '';
    let fileName = 'Unknown';

    if (req.file) {
      fileName = req.file.originalname;
      console.log(`📄 File received: ${fileName} (${req.file.size} bytes)`);
      rfpText = await extractTextFromUploadedFile(req.file);
    } else if (req.body.rfpText) {
      rfpText = sanitizeText(req.body.rfpText);
      fileName = 'Text Input';
    } else {
      return res.status(400).json({
        success: false,
        error: 'No RFP document uploaded or text provided.',
      });
    }

    if (!rfpText || rfpText.trim().length < 100) {
      return res.status(400).json({
        success: false,
        error: 'RFP text is too short or empty. Please provide a valid RFP document.',
      });
    }

    // Get custom prompt if provided
    const customPrompt = req.body.customPrompt?.trim() || undefined;

    // Set up SSE headers for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Send initial log
    const sendLog = (log: RFPLogEntry) => {
      res.write(`event: log\ndata: ${JSON.stringify(log)}\n\n`);
    };

    sendLog({
      timestamp: new Date(),
      level: 'info',
      stage: 'upload',
      message: `File received: ${fileName}`,
      details: { fileSize: req.file?.size, textLength: rfpText.length, hasCustomPrompt: !!customPrompt },
    });

    if (customPrompt) {
      sendLog({
        timestamp: new Date(),
        level: 'info',
        stage: 'upload',
        message: `Custom analysis guidance provided`,
        details: { promptLength: customPrompt.length },
      });
    }

    // Process RFP with progress callback and custom prompt
    const rfpResearchService = getRFPResearchService();
    const result = await rfpResearchService.processRFP(rfpText, accessToken, sendLog, customPrompt);

    // Send final result
    res.write(`event: result\ndata: ${JSON.stringify({
      success: true,
      message: 'RFP research completed successfully',
      data: result,
    })}\n\n`);

    res.write(`event: done\ndata: {}\n\n`);
    res.end();
    return;

  } catch (error) {
    console.error('❌ Streaming RFP Research failed:', error);

    // If headers already sent, send error via SSE
    if (res.headersSent) {
      res.write(`event: error\ndata: ${JSON.stringify({
        error: 'RFP research failed',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      })}\n\n`);
      res.end();
      return;
    }
    return res.status(500).json({
      success: false,
      error: 'RFP research failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
});

/**
 * @route POST /api/proposal/research-rfp-excel-stream
 * @desc Research Excel RFP with live streaming logs via SSE
 * @access Requires Bearer token authentication
 */
router.post('/research-rfp-excel-stream', upload.single('file'), async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    console.log('\n📊 Starting Excel RFP Research with Streaming Logs...');

    // Validate authentication
    const accessToken = req.user?.accessToken;
    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: 'Missing authenticated Microsoft session. Please log in again.',
      });
    }

    // Validate file upload
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No Excel file uploaded.',
      });
    }

    const isExcel =
      req.file.mimetype === 'application/vnd.ms-excel' ||
      req.file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    if (!isExcel) {
      return res.status(400).json({
        success: false,
        error: 'Please upload an Excel file (.xlsx or .xls)',
      });
    }

    // Get custom prompt if provided
    const customPrompt = req.body.customPrompt?.trim() || undefined;

    // Set up SSE headers for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Send log helper
    const sendLog = (log: RFPLogEntry) => {
      res.write(`event: log\ndata: ${JSON.stringify(log)}\n\n`);
    };

    sendLog({
      timestamp: new Date(),
      level: 'info',
      stage: 'upload',
      message: `Excel file received: ${req.file.originalname}`,
      details: { fileSize: req.file.size },
    });

    // Validate Excel file
    const validation = excelService.validateExcelFile(req.file.buffer);
    if (!validation.valid) {
      sendLog({
        timestamp: new Date(),
        level: 'error',
        stage: 'extraction',
        message: validation.error || 'Invalid Excel file',
      });
      res.write(`event: error\ndata: ${JSON.stringify({ error: validation.error })}\n\n`);
      res.end();
      return;
    }

    sendLog({
      timestamp: new Date(),
      level: 'success',
      stage: 'upload',
      message: 'Excel file validated successfully',
    });

    // Parse Excel and extract questions
    sendLog({
      timestamp: new Date(),
      level: 'info',
      stage: 'extraction',
      message: 'Parsing Excel file and extracting questions...',
    });

    const parsedRFP = excelService.parseExcelRFP(req.file.buffer, req.file.originalname);

    if (parsedRFP.questions.length === 0) {
      sendLog({
        timestamp: new Date(),
        level: 'error',
        stage: 'extraction',
        message: 'Could not extract any questions from the Excel file',
      });
      res.write(`event: error\ndata: ${JSON.stringify({ error: 'No questions found in Excel file' })}\n\n`);
      res.end();
      return;
    }

    sendLog({
      timestamp: new Date(),
      level: 'success',
      stage: 'extraction',
      message: `Extracted ${parsedRFP.questions.length} questions from Excel`,
      details: {
        questionColumn: parsedRFP.columnMapping.headers[parsedRFP.columnMapping.questionColumn!] || 'Column ' + parsedRFP.columnMapping.questionColumn,
        totalQuestions: parsedRFP.questions.length,
      },
    });

    // Process ALL questions using batch RFP processing (much faster)
    const rfpResearchService = getRFPResearchService();
    const answers: Map<number, string> = new Map();
    const questionResults: Array<{
      rowIndex: number;
      question: string;
      answer: string;
      confidence: 'high' | 'medium' | 'low';
      sources: Array<{ type: string; title: string; excerpt?: string }>;
      category?: string;
      section?: string;
    }> = [];

    sendLog({
      timestamp: new Date(),
      level: 'info',
      stage: 'answer_generation',
      message: `Starting batch answer generation for ${parsedRFP.questions.length} questions...`,
    });

    // Build combined RFP text for batch processing
    const combinedRfpText = parsedRFP.questions
      .map((q, i) => `Q${i + 1}. [${q.category || 'General'}${q.section ? ` - ${q.section}` : ''}]\n${q.questionText}`)
      .join('\n\n');

    sendLog({
      timestamp: new Date(),
      level: 'progress',
      stage: 'answer_generation',
      message: 'Processing all questions in optimized batch mode...',
      details: { totalQuestions: parsedRFP.questions.length },
    });

    try {
      // Use the optimized batch processRFP - single API call for all questions
      const result = await rfpResearchService.processRFP(
        combinedRfpText,
        accessToken,
        (log) => sendLog(log), // Stream logs to client
        customPrompt
      );

      sendLog({
        timestamp: new Date(),
        level: 'success',
        stage: 'answer_generation',
        message: `Batch processing complete: ${result.answers.length} answers generated`,
        details: {
          highConfidence: result.answers.filter(a => a.confidence === 'high').length,
          mediumConfidence: result.answers.filter(a => a.confidence === 'medium').length,
          lowConfidence: result.answers.filter(a => a.confidence === 'low').length,
        },
      });

      // Map answers back to Excel questions
      for (let i = 0; i < parsedRFP.questions.length; i++) {
        const q = parsedRFP.questions[i];
        const answer = result.answers[i];
        const answerText = answer?.answer || 'Unable to generate answer for this question.';

        answers.set(q.rowIndex, answerText);

        questionResults.push({
          rowIndex: q.rowIndex,
          question: q.questionText,
          answer: answerText,
          confidence: answer?.confidence || 'low',
          sources: answer?.sources || [],
          category: q.category,
          section: q.section,
        });
      }
    } catch (err) {
      console.error('❌ Batch answer generation failed:', err);
      sendLog({
        timestamp: new Date(),
        level: 'error',
        stage: 'answer_generation',
        message: `Batch generation failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      });

      // Fallback: create placeholder answers
      for (const q of parsedRFP.questions) {
        answers.set(q.rowIndex, 'Unable to generate answer - please try again.');
        questionResults.push({
          rowIndex: q.rowIndex,
          question: q.questionText,
          answer: 'Unable to generate answer - please try again.',
          confidence: 'low',
          sources: [],
          category: q.category,
          section: q.section,
        });
      }
    }

    // Generate answered Excel file
    let answeredExcelBase64 = '';
    if (parsedRFP.columnMapping.answerColumn !== null) {
      sendLog({
        timestamp: new Date(),
        level: 'info',
        stage: 'complete',
        message: 'Generating answered Excel file...',
      });

      const answeredBuffer = excelService.generateAnsweredExcel(
        req.file.buffer,
        answers,
        parsedRFP.columnMapping.answerColumn
      );
      answeredExcelBase64 = answeredBuffer.toString('base64');
    }

    const totalTime = Date.now() - startTime;

    sendLog({
      timestamp: new Date(),
      level: 'success',
      stage: 'complete',
      message: `Excel RFP Research complete in ${(totalTime / 1000).toFixed(1)}s`,
      details: {
        totalQuestions: parsedRFP.questions.length,
        answeredQuestions: questionResults.length,
        processingTimeMs: totalTime,
      },
    });

    // Send final result
    res.write(`event: result\ndata: ${JSON.stringify({
      success: true,
      message: 'Excel RFP research completed successfully',
      data: {
        metadata: {
          fileName: req.file.originalname,
          totalQuestions: parsedRFP.questions.length,
          answeredQuestions: questionResults.length,
          processingTimeMs: totalTime,
          sheetProcessed: parsedRFP.metadata.processedSheet,
        },
        columnMapping: {
          questionColumn: parsedRFP.columnMapping.questionColumn,
          answerColumn: parsedRFP.columnMapping.answerColumn,
          headers: parsedRFP.columnMapping.headers,
        },
        questions: questionResults,
        answeredExcel: answeredExcelBase64 || null,
      },
    })}\n\n`);

    res.write(`event: done\ndata: {}\n\n`);
    res.end();
    return;
  } catch (error) {
    console.error('❌ Streaming Excel RFP Research failed:', error);

    if (res.headersSent) {
      res.write(`event: error\ndata: ${JSON.stringify({
        error: 'Excel RFP research failed',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      })}\n\n`);
      res.end();
      return;
    }
    return res.status(500).json({
      success: false,
      error: 'Excel RFP research failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
});

/**
 * @route POST /api/proposal/research-rfp-excel
 * @desc Research Excel RFP - Parse Excel, extract questions, answer them, and return answered Excel
 * @access Requires Bearer token authentication
 */
router.post('/research-rfp-excel', upload.single('file'), async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    console.log('\n📊 Starting Excel RFP Research...');

    // Validate authentication
    const accessToken = req.user?.accessToken;
    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: 'Missing authenticated Microsoft session. Please log in again.',
      });
    }

    // Validate file upload
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No Excel file uploaded.',
      });
    }

    const isExcel =
      req.file.mimetype === 'application/vnd.ms-excel' ||
      req.file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    if (!isExcel) {
      return res.status(400).json({
        success: false,
        error: 'Please upload an Excel file (.xlsx or .xls)',
      });
    }

    console.log(`📄 Excel file received: ${req.file.originalname} (${req.file.size} bytes)`);

    // Validate Excel file
    const validation = excelService.validateExcelFile(req.file.buffer);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error || 'Invalid Excel file',
      });
    }

    // Parse Excel and extract questions
    const parsedRFP = excelService.parseExcelRFP(req.file.buffer, req.file.originalname);

    if (parsedRFP.questions.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Could not extract any questions from the Excel file. Please ensure the file has a clear question column.',
        columnMapping: parsedRFP.columnMapping,
      });
    }

    console.log(`📝 Extracted ${parsedRFP.questions.length} questions from Excel`);
    console.log(`   Question column: ${parsedRFP.columnMapping.headers[parsedRFP.columnMapping.questionColumn!] || 'Column ' + parsedRFP.columnMapping.questionColumn}`);
    console.log(`   Answer column: ${parsedRFP.columnMapping.answerColumn !== null ? (parsedRFP.columnMapping.headers[parsedRFP.columnMapping.answerColumn] || 'Column ' + parsedRFP.columnMapping.answerColumn) : 'Not detected'}`);

    // Process each question using RFP research service
    const rfpResearchService = getRFPResearchService();
    const answers: Map<number, string> = new Map();
    const questionResults: Array<{
      rowIndex: number;
      question: string;
      answer: string;
      confidence: 'high' | 'medium' | 'low';
      sources: Array<{ type: string; title: string; excerpt?: string }>;
      category?: string;
      section?: string;
    }> = [];

    console.log('\n🤖 Generating answers for each question...');

    for (let i = 0; i < parsedRFP.questions.length; i++) {
      const q = parsedRFP.questions[i];
      console.log(`   [${i + 1}/${parsedRFP.questions.length}] Processing: "${q.questionText.substring(0, 60)}..."`);

      try {
        // Generate answer using the RFP research service
        const result = await rfpResearchService.processRFP(
          `Question: ${q.questionText}\n\nSection: ${q.section || 'General'}\nCategory: ${q.category || 'General'}`,
          accessToken
        );

        const answer = result.answers[0];
        const answerText = answer?.answer || 'Unable to generate answer for this question.';

        answers.set(q.rowIndex, answerText);

        questionResults.push({
          rowIndex: q.rowIndex,
          question: q.questionText,
          answer: answerText,
          confidence: answer?.confidence || 'low',
          sources: answer?.sources || [],
          category: q.category,
          section: q.section,
        });
      } catch (err) {
        console.warn(`   ⚠️ Failed to generate answer for question ${i + 1}:`, err);
        answers.set(q.rowIndex, 'Error generating answer.');
        questionResults.push({
          rowIndex: q.rowIndex,
          question: q.questionText,
          answer: 'Error generating answer.',
          confidence: 'low',
          sources: [],
          category: q.category,
          section: q.section,
        });
      }
    }

    // Generate answered Excel file
    let answeredExcelBase64 = '';
    if (parsedRFP.columnMapping.answerColumn !== null) {
      const answeredBuffer = excelService.generateAnsweredExcel(
        req.file.buffer,
        answers,
        parsedRFP.columnMapping.answerColumn
      );
      answeredExcelBase64 = answeredBuffer.toString('base64');
    }

    const totalTime = Date.now() - startTime;
    console.log(`\n✅ Excel RFP Research complete in ${(totalTime / 1000).toFixed(1)}s`);

    return res.status(200).json({
      success: true,
      message: 'Excel RFP research completed successfully',
      data: {
        metadata: {
          fileName: req.file.originalname,
          totalQuestions: parsedRFP.questions.length,
          answeredQuestions: questionResults.length,
          processingTimeMs: totalTime,
          sheetProcessed: parsedRFP.metadata.processedSheet,
        },
        columnMapping: {
          questionColumn: parsedRFP.columnMapping.questionColumn,
          answerColumn: parsedRFP.columnMapping.answerColumn,
          headers: parsedRFP.columnMapping.headers,
        },
        questions: questionResults,
        // Base64 encoded Excel file with answers filled in
        answeredExcel: answeredExcelBase64 || null,
      },
    });
  } catch (error) {
    console.error('❌ Excel RFP Research failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Excel RFP research failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
});

/**
 * @route POST /api/proposal/rfp-research
 * @desc Save RFP research results
 * @access Requires Bearer token authentication
 */
router.post('/rfp-research', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Missing authenticated user id' });
    }

    const requesterProfile = req.user as { email?: string } | undefined;
    const requestedBy =
      requesterProfile?.email ||
      (req.headers['x-user-email'] as string) ||
      null;

    const {
      fileName,
      fileType,
      companyName,
      rfpSummary,
      totalQuestions,
      answeredQuestions,
      averageConfidence,
      processingTimeMs,
      questions,
      answers,
      customPrompt,
    } = req.body;

    const researchId = uuidv4();

    const research = await prisma.rfpResearch.create({
      data: {
        researchId,
        fileName: fileName || null,
        fileType: fileType || null,
        companyName: companyName || null,
        rfpSummary: rfpSummary || null,
        totalQuestions: totalQuestions || 0,
        answeredQuestions: answeredQuestions || 0,
        averageConfidence: averageConfidence || 0,
        processingTimeMs: processingTimeMs || 0,
        questionsData: questions ? JSON.stringify(questions) : null,
        answersData: answers ? JSON.stringify(answers) : null,
        customPrompt: customPrompt || null,
        status: 'completed',
        requestedBy,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'RFP research saved successfully',
      data: {
        researchId: research.researchId,
        createdAt: research.createdAt,
      },
    });
  } catch (error) {
    console.error('❌ Failed to save RFP research', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save RFP research',
    });
  }
});

/**
 * @route GET /api/proposal/rfp-research
 * @desc List past RFP research results
 * @access Requires Bearer token authentication
 */
router.get('/rfp-research', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Missing authenticated user id' });
    }

    const requesterProfile = req.user as { email?: string } | undefined;
    const requestedBy = requesterProfile?.email || null;

    const limitParam = parseInt((req.query.limit as string) || '25', 10);
    const take = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 25;

    // Fetch research results for this user
    const research = await prisma.rfpResearch.findMany({
      where: requestedBy ? { requestedBy } : undefined,
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        researchId: true,
        fileName: true,
        fileType: true,
        companyName: true,
        rfpSummary: true,
        totalQuestions: true,
        answeredQuestions: true,
        averageConfidence: true,
        processingTimeMs: true,
        status: true,
        createdAt: true,
        customPrompt: true,
        isSaved: true,
      },
    });

    return res.json({
      success: true,
      data: research.map((r: any) => ({
        ...r,
        expiresAt: r.isSaved ? null : new Date(r.createdAt.getTime() + 48 * 60 * 60 * 1000).toISOString(),
      })),
    });
  } catch (error) {
    console.error('❌ Failed to list RFP research', error);
    return res.status(500).json({ success: false, error: 'Failed to load RFP research history' });
  }
});

/**
 * @route GET /api/proposal/rfp-research/:researchId
 * @desc Get a specific RFP research result with full details
 * @access Requires Bearer token authentication
 */
router.get('/rfp-research/:researchId', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Missing authenticated user id' });
    }

    const { researchId } = req.params;
    const research = await prisma.rfpResearch.findUnique({
      where: { researchId },
    });

    if (!research) {
      return res.status(404).json({ success: false, error: 'RFP research not found' });
    }

    // Parse JSON fields
    const questionsData = research.questionsData ? JSON.parse(research.questionsData) : [];
    const answersData = research.answersData ? JSON.parse(research.answersData) : [];

    return res.json({
      success: true,
      data: {
        researchId: research.researchId,
        fileName: research.fileName,
        fileType: research.fileType,
        companyName: research.companyName,
        rfpSummary: research.rfpSummary,
        totalQuestions: research.totalQuestions,
        answeredQuestions: research.answeredQuestions,
        averageConfidence: research.averageConfidence,
        processingTimeMs: research.processingTimeMs,
        questions: questionsData,
        answers: answersData,
        customPrompt: research.customPrompt,
        status: research.status,
        requestedBy: research.requestedBy,
        createdAt: research.createdAt,
        updatedAt: research.updatedAt,
      },
    });
  } catch (error) {
    console.error('❌ Failed to load RFP research detail', error);
    return res.status(500).json({ success: false, error: 'Failed to load RFP research detail' });
  }
});

/**
 * @route DELETE /api/proposal/rfp-research/:researchId
 * @desc Delete a specific RFP research result
 * @access Requires Bearer token authentication
 */
router.delete('/rfp-research/:researchId', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Missing authenticated user id' });
    }

    const { researchId } = req.params;
    const research = await prisma.rfpResearch.findUnique({
      where: { researchId },
      select: { researchId: true, requestedBy: true },
    });

    if (!research) {
      return res.status(404).json({ success: false, error: 'RFP research not found' });
    }

    await prisma.rfpResearch.delete({
      where: { researchId },
    });

    return res.json({
      success: true,
      message: 'RFP research deleted successfully',
    });
  } catch (error) {
    console.error('❌ Failed to delete RFP research', error);
    return res.status(500).json({ success: false, error: 'Failed to delete RFP research' });
  }
});

/**
 * @route GET /api/proposal/rfp-research/:researchId/download-docx
 * @desc Download RFP Q&A research as a formatted Word document
 * @access Requires Bearer token authentication
 */
router.get('/rfp-research/:researchId/download-docx', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Missing authenticated user id' });
    }

    const { researchId } = req.params;
    const research = await prisma.rfpResearch.findUnique({ where: { researchId } });

    if (!research) {
      return res.status(404).json({ success: false, error: 'RFP research not found' });
    }

    const questions = research.questionsData ? JSON.parse(research.questionsData as string) : [];
    const answers   = research.answersData   ? JSON.parse(research.answersData   as string) : [];

    const docxBuffer = await generateRFPResponseDocx({
      companyName:  research.companyName  ?? undefined,
      rfpSummary:   research.rfpSummary   ?? 'RFP Response',
      questions,
      answers,
      generatedBy:  'Northstar Integrators Sales Intelligence',
      generatedAt:  research.createdAt,
    });

    const safeName = (research.companyName ?? research.fileName ?? 'rfp-response')
      .replace(/[^a-z0-9]/gi, '-')
      .toLowerCase();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}-response.docx"`);
    res.setHeader('Content-Length', docxBuffer.length);
    return res.end(docxBuffer);
  } catch (error) {
    console.error('❌ Failed to generate RFP response DOCX', error);
    return res.status(500).json({ success: false, error: 'Failed to generate document' });
  }
});

/**
 * @route POST /api/proposal/generate-sow-from-research
 * @desc Generate a full SOW proposal document using saved RFP Q&A research as grounding context.
 *       Creates a ProposalJob and returns the jobId for polling.
 * @access Requires Bearer token authentication
 */
router.post('/generate-sow-from-research', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Missing authenticated user id' });
    }

    const { researchId } = req.body as { researchId?: string };
    if (!researchId) {
      return res.status(400).json({ success: false, error: 'researchId is required' });
    }

    const research = await prisma.rfpResearch.findUnique({ where: { researchId } });
    if (!research) {
      return res.status(404).json({ success: false, error: 'RFP research not found' });
    }

    const questions: any[] = research.questionsData ? JSON.parse(research.questionsData as string) : [];
    const answers:   any[] = research.answersData   ? JSON.parse(research.answersData   as string) : [];

    const answerMap = new Map(answers.map((a: any) => [a.questionId, a]));

    // Format Q&A answers as structured RFP text for the LangGraph workflow.
    // This is the bridge: grounded answers become the proposal input instead of raw RFP text.
    const categoryOrder = ['technical', 'business', 'compliance', 'timeline', 'pricing', 'general'];
    const grouped: Record<string, any[]> = {};
    for (const q of questions) {
      const cat = q.category ?? 'general';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(q);
    }

    const rfpTextFromResearch = [
      `RFP SUMMARY: ${research.rfpSummary ?? ''}`,
      `COMPANY: ${research.companyName ?? 'Client'}`,
      '',
      '=== RESEARCHED REQUIREMENTS & RESPONSES ===',
      '',
      ...categoryOrder.flatMap((cat) => {
        const qs = grouped[cat] ?? [];
        if (!qs.length) return [];
        return [
          `--- ${cat.toUpperCase()} ---`,
          ...qs.flatMap((q: any) => {
            const ans = answerMap.get(q.id) as any;
            return [
              `REQUIREMENT: ${q.questionText}`,
              `RESPONSE: ${ans?.answer ?? 'To be addressed.'}`,
              '',
            ];
          }),
        ];
      }),
    ].join('\n');

    const jobId = uuidv4();
    const textByteLength = Buffer.byteLength(rfpTextFromResearch, 'utf8');

    await prisma.proposalJob.create({
      data: {
        jobId,
        requestedBy: userId,
        analysisType: 'enhanced',
        status: 'processing',
        currentStep: 'queued',
        fileName: research.fileName ?? `${research.companyName ?? 'rfp'}-sow`,
        fileSize: textByteLength,
        mimeType: 'text/plain',
        rfpText: rfpTextFromResearch,
        rfpSummary: (research.rfpSummary ?? '').substring(0, 500),
        metadata: JSON.stringify({
          source: 'rfp-research',
          researchId,
          companyName: research.companyName,
          totalQuestions: questions.length,
        }),
      },
    });

    // Schedule processing with access token for InternalKnowledge enrichment
    const accessToken = req.headers.authorization?.replace('Bearer ', '') ?? null;
    await scheduleProposalJobProcessing(jobId, accessToken);

    return res.status(202).json({
      success: true,
      jobId,
      message: 'SOW generation started. Poll GET /api/proposal/jobs/:jobId for status.',
    });
  } catch (error) {
    console.error('❌ Failed to start SOW generation from research', error);
    return res.status(500).json({ success: false, error: 'Failed to start SOW generation' });
  }
});

/**
 * @route GET /api/proposal/health
 * @desc Health check for proposal generation service
 * @access Public
 */
router.get('/health', (_req: Request, res: Response) => {
  return res.status(200).json({
    success: true,
    service: 'Proposal Generation',
    status: 'operational',
    features: [
      'PDF text extraction',
      'DOCX text extraction',
      'Excel RFP parsing',
      'SharePoint document analysis',
      'AI-powered proposal generation',
      'Client context extraction',
      '5-step workflow automation',
      'RFP Research & Q&A',
      'Excel RFP Q&A with export',
    ],
    timestamp: new Date().toISOString(),
  });
});

export default router;
