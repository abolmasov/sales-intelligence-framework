import { Router, Request, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { getProposalEvaluationService } from '../services/proposal-evaluation.service';
import { getLoggerService } from '../services/logger.service';
import { getPrismaClient } from '../config/database';
import { PURSUIT_BRIEF_QUESTIONS } from '../services/pursuitBrief.service';
import { scheduleProposalJobProcessing } from '../services/proposalJob.service';

const router = Router();
const logger = getLoggerService();
const prisma = getPrismaClient();

// Configure multer for file uploads.
// Lambda /var/task is read-only; default to /tmp unless overridden.
const uploadRoot = process.env.UPLOAD_DIR || path.join(os.tmpdir(), 'uploads');
const uploadDir = path.join(uploadRoot, 'evaluations');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.txt', '.md'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${ext} not supported. Allowed: ${allowedTypes.join(', ')}`));
    }
  }
});

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

const queueFileFromUpload = (file: Express.Multer.File): ProposalEvaluationQueuedFile => {
  const contentBase64 = fs.readFileSync(file.path).toString('base64');
  return {
    fileName: file.originalname,
    mimeType: file.mimetype,
    contentBase64,
  };
};

const cleanupUploadedFiles = (files: Express.Multer.File[]) => {
  for (const file of files) {
    try {
      fs.unlinkSync(file.path);
    } catch {
      // ignore cleanup failures
    }
  }
};

const normalizeEvaluationStatusFromJob = (job: any) => {
  const status = (job?.status || '').toLowerCase();
  if (status === 'completed') return 'completed';
  if (status === 'error') return 'failed';
  return 'processing';
};

const parseJsonSafe = <T = any>(value?: string | null): T | null => {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

/**
 * @route POST /api/proposal-evaluation/start
 * @desc Start a new proposal evaluation
 */
router.post('/start', upload.fields([
  { name: 'rfp', maxCount: 1 },
  { name: 'proposal', maxCount: 1 },
  { name: 'pursuitBrief', maxCount: 1 }
]), async (req: Request, res: Response) => {
  const uploadedFilesForCleanup: Express.Multer.File[] = [];
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    if (!files.rfp || !files.rfp[0]) {
      return res.status(400).json({
        success: false,
        error: 'RFP file is required'
      });
    }

    if (!files.proposal || !files.proposal[0]) {
      return res.status(400).json({
        success: false,
        error: 'Proposal file is required'
      });
    }

    const rfpFile = files.rfp[0];
    const proposalFile = files.proposal[0];
    const pursuitBriefFile = files.pursuitBrief?.[0];
    uploadedFilesForCleanup.push(rfpFile, proposalFile);
    if (pursuitBriefFile) {
      uploadedFilesForCleanup.push(pursuitBriefFile);
    }

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      logger.error('OPENAI_API_KEY is not configured');
      return res.status(500).json({
        success: false,
        error: 'AI service is not configured. Please contact administrator.'
      });
    }

    logger.info('Starting proposal evaluation:', {
      rfp: rfpFile.originalname,
      proposal: proposalFile.originalname,
      pursuitBrief: pursuitBriefFile?.originalname,
      rfpSize: rfpFile.size,
      proposalSize: proposalFile.size
    });

    const payload: ProposalEvaluationQueuedPayload = {
      mode: 'proposal_evaluation',
      rfp: queueFileFromUpload(rfpFile),
      proposal: queueFileFromUpload(proposalFile),
      ...(pursuitBriefFile ? { pursuitBrief: queueFileFromUpload(pursuitBriefFile) } : {}),
    };

    const sessionId = uuidv4();
    const requestedBy =
      (req.user as { email?: string } | undefined)?.email ||
      (req.headers['x-user-email'] as string) ||
      null;

    await prisma.proposalJob.create({
      data: {
        jobId: sessionId,
        requestedBy,
        analysisType: 'proposal_evaluation',
        status: 'processing',
        currentStep: 'queued',
        fileName: `${rfpFile.originalname} | ${proposalFile.originalname}`,
        fileSize: rfpFile.size + proposalFile.size + (pursuitBriefFile?.size || 0),
        mimeType: 'multipart/form-data',
        rfpText: JSON.stringify(payload),
        rfpSummary: null,
        metadata: JSON.stringify({
          mode: 'proposal_evaluation',
          hasPursuitBrief: Boolean(pursuitBriefFile),
          progress: 0,
        }),
      }
    });

    await scheduleProposalJobProcessing(sessionId, null, { awaitCompletion: false });

    return res.status(202).json({
      success: true,
      data: {
        sessionId,
        message: 'Evaluation queued. Poll the status endpoint for results.'
      }
    });

  } catch (error: any) {
    logger.error('Failed to start evaluation:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to start evaluation'
    });
  } finally {
    cleanupUploadedFiles(uploadedFilesForCleanup);
  }
});

/**
 * @route POST /api/proposal-evaluation/start-with-deal
 * @desc Start evaluation using stored pursuit brief from a deal
 */
router.post('/start-with-deal', upload.fields([
  { name: 'rfp', maxCount: 1 },
  { name: 'proposal', maxCount: 1 }
]), async (req: Request, res: Response) => {
  const uploadedFilesForCleanup: Express.Multer.File[] = [];
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const { dealId } = req.body;

    if (!files.rfp || !files.rfp[0]) {
      return res.status(400).json({
        success: false,
        error: 'RFP file is required'
      });
    }

    if (!files.proposal || !files.proposal[0]) {
      return res.status(400).json({
        success: false,
        error: 'Proposal file is required'
      });
    }

    const rfpFile = files.rfp[0];
    const proposalFile = files.proposal[0];
    uploadedFilesForCleanup.push(rfpFile, proposalFile);
    let pursuitBriefText: string | undefined;

    // If dealId provided, fetch the pursuit brief from database
    if (dealId) {
      const brief: any[] = await prisma.$queryRaw`
        SELECT * FROM pursuit_briefs WHERE deal_id = ${dealId} LIMIT 1
      `;

      if (brief && brief[0]) {
        const briefData = brief[0];
        const questionAnswers = JSON.parse(briefData.question_answers || '{}');
        const transcriptAnswers = JSON.parse(briefData.transcript_answers || '{}');
        const content = briefData.content || '';

        // Generate pursuit brief text from stored data
        pursuitBriefText = `# Pursuit Brief\n\n`;

        if (content) {
          pursuitBriefText += content + '\n\n';
        }

        pursuitBriefText += `## Strategic Questions & Answers\n\n`;

        // Add question answers
        for (const [key, question] of Object.entries(PURSUIT_BRIEF_QUESTIONS)) {
          const manualAnswer = questionAnswers[key];
          const transcriptAnswer = transcriptAnswers[key];
          const answer = manualAnswer || transcriptAnswer;

          if (answer) {
            pursuitBriefText += `### ${question}\n${answer}\n\n`;
          }
        }

        logger.info('Using stored pursuit brief from deal:', {
          dealId,
          briefId: briefData.id,
          contentLength: pursuitBriefText.length
        });
      }
    }

    logger.info('Starting proposal evaluation with deal pursuit brief:', {
      rfp: rfpFile.originalname,
      proposal: proposalFile.originalname,
      dealId,
      hasPursuitBrief: !!pursuitBriefText
    });

    const payload: ProposalEvaluationQueuedPayload = {
      mode: 'proposal_evaluation',
      rfp: queueFileFromUpload(rfpFile),
      proposal: queueFileFromUpload(proposalFile),
      ...(pursuitBriefText ? { pursuitBriefText } : {}),
    };

    const sessionId = uuidv4();
    const requestedBy =
      (req.user as { email?: string } | undefined)?.email ||
      (req.headers['x-user-email'] as string) ||
      null;

    await prisma.proposalJob.create({
      data: {
        jobId: sessionId,
        requestedBy,
        analysisType: 'proposal_evaluation',
        status: 'processing',
        currentStep: 'queued',
        fileName: `${rfpFile.originalname} | ${proposalFile.originalname}`,
        fileSize: rfpFile.size + proposalFile.size,
        mimeType: 'multipart/form-data',
        rfpText: JSON.stringify(payload),
        rfpSummary: null,
        metadata: JSON.stringify({
          mode: 'proposal_evaluation',
          dealId,
          hasStoredPursuitBrief: Boolean(pursuitBriefText),
          progress: 0,
        }),
      }
    });

    await scheduleProposalJobProcessing(sessionId, null, { awaitCompletion: false });

    return res.status(202).json({
      success: true,
      data: {
        sessionId,
        usedStoredPursuitBrief: !!pursuitBriefText,
        message: 'Evaluation queued. Poll the status endpoint for results.'
      }
    });

  } catch (error: any) {
    logger.error('Failed to start evaluation with deal:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to start evaluation'
    });
  } finally {
    cleanupUploadedFiles(uploadedFilesForCleanup);
  }
});

/**
 * @route GET /api/proposal-evaluation/status/:sessionId
 * @desc Get evaluation status and results
 */
router.get('/status/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const evaluationService = getProposalEvaluationService();
    let result = evaluationService.getEvaluation(sessionId);

    if (!result) {
      const job = await prisma.proposalJob.findUnique({
        where: { jobId: sessionId },
        select: {
          jobId: true,
          status: true,
          currentStep: true,
          proposalData: true,
          errorMessage: true,
          fileName: true,
          metadata: true,
          createdAt: true,
          updatedAt: true,
        }
      });

      if (!job || job.status === null) {
        return res.status(404).json({
          success: false,
          error: 'Evaluation not found'
        });
      }

      const metadata = parseJsonSafe<Record<string, any>>(job.metadata);
      const isProposalEvaluationJob = metadata?.mode === 'proposal_evaluation';

      if (!isProposalEvaluationJob) {
        return res.status(404).json({
          success: false,
          error: 'Evaluation not found'
        });
      }

      const normalizedStatus = normalizeEvaluationStatusFromJob(job);
      if (normalizedStatus === 'completed' && job.proposalData) {
        result = parseJsonSafe(job.proposalData);
        if (!result) {
          return res.status(500).json({
            success: false,
            error: 'Stored evaluation result is invalid'
          });
        }
      } else {
        result = {
          id: job.jobId,
          status: normalizedStatus,
          progress: metadata?.progress || 0,
          currentStep: job.currentStep || 'processing',
          createdAt: job.createdAt,
          completedAt: job.updatedAt,
          rfpFileName: job.fileName || 'RFP',
          proposalFileName: job.fileName || 'Proposal',
          pursuitBriefFileName: undefined,
          totalRequirements: 0,
          analysis: [],
          bySection: [],
          summary: {
            totalRequirements: 0,
            addressed: 0,
            partiallyAddressed: 0,
            notAddressed: 0,
            mandatoryRequirements: 0,
            mandatoryMet: 0,
            complianceScore: 0,
            byPriority: {
              mandatory: { total: 0, met: 0 },
              important: { total: 0, met: 0 },
              nice_to_have: { total: 0, met: 0 }
            }
          },
          criticalGaps: [],
          winLossInsights: [],
          executiveSummary: {
            overallAssessment: '',
            keyStrengths: [],
            criticalWeaknesses: [],
            winProbabilityFactors: [],
            immediateActions: []
          },
          error: normalizedStatus === 'failed' ? (job.errorMessage || 'Evaluation failed') : undefined,
        } as any;
      }
    }

    return res.status(200).json({
      success: true,
      data: result
    });

  } catch (error: any) {
    logger.error('Failed to get evaluation status:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get evaluation status'
    });
  }
});

/**
 * @route GET /api/proposal-evaluation/list
 * @desc Get all evaluations (from database)
 */
router.get('/list', async (_req: Request, res: Response) => {
  try {
    // First try to get from database
    const savedEvaluations = await prisma.proposalEvaluation.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    const queuedEvaluationJobs = await prisma.proposalJob.findMany({
      where: {
        status: { in: ['processing', 'queued'] },
        analysisType: 'proposal_evaluation',
      },
      orderBy: { createdAt: 'desc' },
      take: 25,
      select: {
        jobId: true,
        status: true,
        fileName: true,
        createdAt: true,
        updatedAt: true,
        metadata: true,
      },
    });

    // Also get in-memory evaluations (currently processing)
    const evaluationService = getProposalEvaluationService();
    const inMemoryEvaluations = evaluationService.getAllEvaluations();

    // Merge and dedupe
    const dbIds = new Set(savedEvaluations.map((e: { id: string }) => e.id));
    const processingEvaluations = inMemoryEvaluations.filter(e =>
      !dbIds.has(e.id) && (e.status === 'processing' || e.status === 'extracting_requirements' || e.status === 'analyzing_coverage' || e.status === 'generating_insights')
    );

    const queuedIds = new Set(queuedEvaluationJobs.map(j => j.jobId));
    const allEvaluations = [
      ...queuedEvaluationJobs
        .filter((j: any) => !dbIds.has(j.jobId))
        .map((j: any) => {
          const metadata = parseJsonSafe<Record<string, any>>(j.metadata) || {};
          return {
            id: j.jobId,
            status: normalizeEvaluationStatusFromJob(j),
            createdAt: j.createdAt,
            completedAt: j.updatedAt,
            rfpFileName: j.fileName || 'RFP',
            proposalFileName: j.fileName || 'Proposal',
            pursuitBriefFileName: undefined,
            totalRequirements: 0,
            complianceScore: 0,
            progress: metadata.progress || 0,
          };
        }),
      // In-progress evaluations first
      ...processingEvaluations.map(e => ({
        id: e.id,
        status: e.status,
        createdAt: e.createdAt,
        completedAt: e.completedAt,
        rfpFileName: e.rfpFileName,
        proposalFileName: e.proposalFileName,
        pursuitBriefFileName: e.pursuitBriefFileName,
        totalRequirements: e.totalRequirements,
        complianceScore: e.summary.complianceScore,
        progress: e.progress
      })),
      // Saved evaluations from database
      ...savedEvaluations.map((e: any) => ({
        id: e.id,
        status: e.status,
        createdAt: e.createdAt,
        completedAt: e.updatedAt,
        rfpFileName: e.rfpFileName,
        proposalFileName: e.proposalFileName,
        pursuitBriefFileName: e.pursuitBriefFileName,
        totalRequirements: e.totalRequirements,
        complianceScore: e.complianceScore
      }))
    ].filter((entry: any) => !queuedIds.has(entry.id) || entry.status !== 'completed');

    return res.status(200).json({
      success: true,
      data: allEvaluations
    });

  } catch (error: any) {
    logger.error('Failed to list evaluations:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to list evaluations'
    });
  }
});

/**
 * @route GET /api/proposal-evaluation/saved/:evaluationId
 * @desc Get a saved evaluation from database
 */
router.get('/saved/:evaluationId', async (req: Request, res: Response) => {
  try {
    const { evaluationId } = req.params;

    const evaluation = await prisma.proposalEvaluation.findUnique({
      where: { id: evaluationId }
    });

    if (!evaluation) {
      return res.status(404).json({
        success: false,
        error: 'Evaluation not found'
      });
    }

    // Reconstruct the full evaluation result from saved JSON data
    const result = {
      id: evaluation.id,
      status: evaluation.status,
      progress: 100,
      currentStep: 'Complete',
      createdAt: evaluation.createdAt,
      completedAt: evaluation.updatedAt,
      rfpFileName: evaluation.rfpFileName,
      proposalFileName: evaluation.proposalFileName,
      pursuitBriefFileName: evaluation.pursuitBriefFileName,
      totalRequirements: evaluation.totalRequirements,
      analysis: JSON.parse(evaluation.analysisData),
      bySection: JSON.parse(evaluation.bySection),
      summary: {
        totalRequirements: evaluation.totalRequirements,
        addressed: evaluation.addressedCount,
        partiallyAddressed: evaluation.partialCount,
        notAddressed: evaluation.notAddressedCount,
        mandatoryRequirements: evaluation.mandatoryTotal,
        mandatoryMet: evaluation.mandatoryMet,
        complianceScore: evaluation.complianceScore,
        byPriority: {
          mandatory: { total: evaluation.mandatoryTotal, met: evaluation.mandatoryMet },
          important: { total: 0, met: 0 },
          nice_to_have: { total: 0, met: 0 }
        }
      },
      criticalGaps: JSON.parse(evaluation.criticalGaps),
      winLossInsights: JSON.parse(evaluation.winLossInsights),
      executiveSummary: JSON.parse(evaluation.executiveSummary),
      pursuitBriefAnalysis: evaluation.pursuitBriefAnalysis
        ? JSON.parse(evaluation.pursuitBriefAnalysis)
        : undefined
    };

    return res.status(200).json({
      success: true,
      data: result
    });

  } catch (error: any) {
    logger.error('Failed to get saved evaluation:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get saved evaluation'
    });
  }
});

/**
 * @route GET /api/proposal-evaluation/export/:sessionId
 * @desc Export evaluation report
 */
router.get('/export/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const format = (req.query.format as string) || 'markdown';

    if (!['json', 'markdown', 'html'].includes(format)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid format. Supported: json, markdown, html'
      });
    }

    const evaluationService = getProposalEvaluationService();
    const report = evaluationService.generateExportReport(sessionId, format as 'json' | 'markdown' | 'html');

    // Set appropriate content type
    const contentTypes: Record<string, string> = {
      json: 'application/json',
      markdown: 'text/markdown',
      html: 'text/html'
    };

    const extensions: Record<string, string> = {
      json: 'json',
      markdown: 'md',
      html: 'html'
    };

    res.setHeader('Content-Type', contentTypes[format]);
    res.setHeader('Content-Disposition', `attachment; filename="proposal-evaluation-${sessionId}.${extensions[format]}"`);

    return res.send(report);

  } catch (error: any) {
    logger.error('Failed to export evaluation:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to export evaluation'
    });
  }
});

/**
 * @route GET /api/proposal-evaluation/requirements/:sessionId
 * @desc Get extracted requirements from evaluation
 */
router.get('/requirements/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const evaluationService = getProposalEvaluationService();
    const result = evaluationService.getEvaluation(sessionId);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Evaluation not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        totalRequirements: result.totalRequirements,
        requirements: result.requirements,
        categories: [...new Set(result.requirements.map((r: any) => r.category))]
      }
    });

  } catch (error: any) {
    logger.error('Failed to get requirements:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get requirements'
    });
  }
});

/**
 * @route GET /api/proposal-evaluation/coverage/:sessionId
 * @desc Get coverage analysis from evaluation
 */
router.get('/coverage/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { filter } = req.query; // 'all', 'full', 'partial', 'none'

    const evaluationService = getProposalEvaluationService();
    const result = evaluationService.getEvaluation(sessionId);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Evaluation not found'
      });
    }

    let analysis = result.analysis;

    // Apply filter if specified
    if (filter === 'full') {
      analysis = analysis.filter((a: any) => a.coverageLevel === 'full');
    } else if (filter === 'partial') {
      analysis = analysis.filter((a: any) => a.coverageLevel === 'partial');
    } else if (filter === 'none') {
      analysis = analysis.filter((a: any) => a.coverageLevel === 'none');
    }

    return res.status(200).json({
      success: true,
      data: {
        summary: result.summary,
        bySection: result.bySection,
        analysis
      }
    });

  } catch (error: any) {
    logger.error('Failed to get coverage:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get coverage'
    });
  }
});

export default router;
