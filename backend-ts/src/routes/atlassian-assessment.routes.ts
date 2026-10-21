import { Router, Request, Response } from 'express';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { ApiResponse } from '../types';
import { getAtlassianAssessmentService } from '../services/atlassian-assessment.service';
import { getAtlassianApiClientService, scanLogEmitter, getScanLogs, ScanLogEntry } from '../services/atlassian-api-client.service';
import { getAtlassianEnvironmentScannerService } from '../services/atlassian-environment-scanner.service';
import {
  JIRA_CLOUD_CAPABILITIES,
  CONFLUENCE_CLOUD_CAPABILITIES,
  PLATFORM_CLOUD_CAPABILITIES,
  DC_PAIN_POINTS,
  MIGRATION_PATHS,
  CLOUD_PRICING_TIERS,
  QUESTIONNAIRE_CATEGORIES,
  getAllCloudCapabilities
} from '../data/atlassian-knowledge-base';

const router = Router();
const assessmentService = getAtlassianAssessmentService();
const apiClient = getAtlassianApiClientService();
const envScanner = getAtlassianEnvironmentScannerService();

// ============================================================================
// ASSESSMENT CRUD ROUTES
// ============================================================================

/**
 * POST /api/atlassian/assessments
 * Create a new assessment
 */
router.post(
  '/assessments',
  asyncHandler(async (req: Request, res: Response) => {
    const { companyName, meetingId } = req.body;

    if (!companyName) {
      throw new AppError('Company name is required', 400);
    }

    // Get user from session if available
    const createdBy = (req as any).session?.userId || undefined;

    const result = await assessmentService.createAssessment({
      companyName,
      meetingId,
      createdBy
    });

    const response: ApiResponse<{ id: string }> = {
      success: true,
      data: result
    };

    res.status(201).json(response);
  })
);

/**
 * GET /api/atlassian/assessments
 * List all assessments with optional filters
 */
router.get(
  '/assessments',
  asyncHandler(async (req: Request, res: Response) => {
    const {
      companyName,
      meetingId,
      status,
      limit,
      offset
    } = req.query;

    const result = await assessmentService.listAssessments({
      companyName: companyName as string,
      meetingId: meetingId as string,
      status: status as string,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined
    });

    const response: ApiResponse<typeof result> = {
      success: true,
      data: result
    };

    res.json(response);
  })
);

/**
 * GET /api/atlassian/assessments/:id
 * Get assessment details
 */
router.get(
  '/assessments/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const assessment = await assessmentService.getAssessment(id);

    const response: ApiResponse<typeof assessment> = {
      success: true,
      data: assessment
    };

    res.json(response);
  })
);

/**
 * DELETE /api/atlassian/assessments/:id
 * Delete an assessment
 */
router.delete(
  '/assessments/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    await assessmentService.deleteAssessment(id);

    const response: ApiResponse<{ deleted: boolean }> = {
      success: true,
      data: { deleted: true }
    };

    res.json(response);
  })
);

// ============================================================================
// QUESTIONNAIRE ROUTES
// ============================================================================

/**
 * POST /api/atlassian/assessments/:id/questionnaire
 * Generate questionnaire for an assessment
 */
router.post(
  '/assessments/:id/questionnaire',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { industry, existingContext } = req.body;

    // Get assessment to get company name
    const assessment = await assessmentService.getAssessment(id);

    const questionnaire = await assessmentService.generateQuestionnaire({
      assessmentId: id,
      companyName: assessment.companyName,
      industry,
      existingContext
    });

    const response: ApiResponse<{
      questions: typeof questionnaire;
      categories: typeof QUESTIONNAIRE_CATEGORIES;
    }> = {
      success: true,
      data: {
        questions: questionnaire,
        categories: QUESTIONNAIRE_CATEGORIES
      }
    };

    res.json(response);
  })
);

/**
 * POST /api/atlassian/assessments/:id/responses
 * Submit questionnaire responses
 */
router.post(
  '/assessments/:id/responses',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { responses } = req.body;

    if (!responses || typeof responses !== 'object') {
      throw new AppError('Responses object is required', 400);
    }

    await assessmentService.saveQuestionnaireResponses(id, responses);

    const response: ApiResponse<{ saved: boolean }> = {
      success: true,
      data: { saved: true }
    };

    res.json(response);
  })
);

// ============================================================================
// ANALYSIS ROUTES
// ============================================================================

/**
 * POST /api/atlassian/assessments/:id/analyze
 * Run analysis on questionnaire responses
 */
router.post(
  '/assessments/:id/analyze',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const analysis = await assessmentService.analyzeResponses(id);

    const response: ApiResponse<typeof analysis> = {
      success: true,
      data: analysis
    };

    res.json(response);
  })
);

/**
 * GET /api/atlassian/assessments/:id/report
 * Get the full assessment report
 */
router.get(
  '/assessments/:id/report',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const assessment = await assessmentService.getAssessment(id);

    if (!assessment.analysisResult) {
      throw new AppError('Assessment analysis not yet completed', 400);
    }

    const response: ApiResponse<{
      assessment: typeof assessment;
      report: any;
    }> = {
      success: true,
      data: {
        assessment,
        report: assessment.analysisResult
      }
    };

    res.json(response);
  })
);

// ============================================================================
// KNOWLEDGE BASE ROUTES
// ============================================================================

/**
 * GET /api/atlassian/knowledge-base/capabilities
 * Get all Cloud capabilities
 */
router.get(
  '/knowledge-base/capabilities',
  asyncHandler(async (req: Request, res: Response) => {
    const { product, cloudOnly } = req.query;

    let capabilities;

    if (cloudOnly === 'true') {
      capabilities = assessmentService.getCloudOnlyCapabilities();
    } else if (product === 'jira') {
      capabilities = Object.values(JIRA_CLOUD_CAPABILITIES);
    } else if (product === 'confluence') {
      capabilities = Object.values(CONFLUENCE_CLOUD_CAPABILITIES);
    } else if (product === 'platform') {
      capabilities = Object.values(PLATFORM_CLOUD_CAPABILITIES);
    } else {
      capabilities = getAllCloudCapabilities();
    }

    const response: ApiResponse<typeof capabilities> = {
      success: true,
      data: capabilities
    };

    res.json(response);
  })
);

/**
 * GET /api/atlassian/knowledge-base/search
 * Search Cloud capabilities
 */
router.get(
  '/knowledge-base/search',
  asyncHandler(async (req: Request, res: Response) => {
    const { q } = req.query;

    if (!q || typeof q !== 'string') {
      throw new AppError('Search query (q) is required', 400);
    }

    const results = assessmentService.searchCloudCapabilities(q);

    const response: ApiResponse<typeof results> = {
      success: true,
      data: results
    };

    res.json(response);
  })
);

/**
 * GET /api/atlassian/knowledge-base/pain-points
 * Get DC pain points
 */
router.get(
  '/knowledge-base/pain-points',
  asyncHandler(async (req: Request, res: Response) => {
    const { urgency } = req.query;

    let painPoints = DC_PAIN_POINTS;

    if (urgency && ['low', 'medium', 'high', 'critical'].includes(urgency as string)) {
      painPoints = assessmentService.getPainPointsByUrgency(urgency as any);
    }

    const response: ApiResponse<typeof painPoints> = {
      success: true,
      data: painPoints
    };

    res.json(response);
  })
);

/**
 * GET /api/atlassian/knowledge-base/migration-paths
 * Get migration paths
 */
router.get(
  '/knowledge-base/migration-paths',
  asyncHandler(async (req: Request, res: Response) => {
    const response: ApiResponse<typeof MIGRATION_PATHS> = {
      success: true,
      data: MIGRATION_PATHS
    };

    res.json(response);
  })
);

/**
 * GET /api/atlassian/knowledge-base/pricing
 * Get Cloud pricing information
 */
router.get(
  '/knowledge-base/pricing',
  asyncHandler(async (req: Request, res: Response) => {
    const pricing = assessmentService.getPricingInfo();

    const response: ApiResponse<typeof pricing> = {
      success: true,
      data: pricing
    };

    res.json(response);
  })
);

// ============================================================================
// ENVIRONMENT SCANNING ROUTES (Phase 2)
// ============================================================================

/**
 * POST /api/atlassian/assessments/:id/connect
 * Test connection to an Atlassian instance
 */
router.post(
  '/assessments/:id/connect',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { url, username, apiToken, productType } = req.body;

    if (!url || !username || !apiToken || !productType) {
      throw new AppError('Missing required fields: url, username, apiToken, productType', 400);
    }

    // Verify assessment exists
    await assessmentService.getAssessment(id);

    const connectionTest = await apiClient.testConnection({
      url,
      username,
      apiToken,
      productType
    });

    const response: ApiResponse<typeof connectionTest> = {
      success: connectionTest.success,
      data: connectionTest,
      error: connectionTest.error
    };

    res.json(response);
  })
);

/**
 * POST /api/atlassian/assessments/:id/scan
 * Scan an Atlassian instance and analyze for migration readiness
 */
router.post(
  '/assessments/:id/scan',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { url, username, apiToken, productType } = req.body;

    if (!url || !username || !apiToken || !productType) {
      throw new AppError('Missing required fields: url, username, apiToken, productType', 400);
    }

    // Verify assessment exists
    await assessmentService.getAssessment(id);

    const result = await envScanner.scanAndAnalyze(id, {
      url,
      username,
      apiToken,
      productType
    });

    const response: ApiResponse<typeof result> = {
      success: true,
      data: result
    };

    res.json(response);
  })
);

/**
 * GET /api/atlassian/assessments/:id/scan-results
 * Get scan results for an assessment
 */
router.get(
  '/assessments/:id/scan-results',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const scanResult = await envScanner.getScanResults(id);

    if (!scanResult) {
      throw new AppError('No scan results found for this assessment', 404);
    }

    const response: ApiResponse<typeof scanResult> = {
      success: true,
      data: scanResult
    };

    res.json(response);
  })
);

/**
 * GET /api/atlassian/assessments/:id/environment-analysis
 * Get environment analysis for an assessment
 */
router.get(
  '/assessments/:id/environment-analysis',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const analysis = await envScanner.getAnalysis(id);

    if (!analysis) {
      throw new AppError('No environment analysis found for this assessment', 404);
    }

    const response: ApiResponse<typeof analysis> = {
      success: true,
      data: analysis
    };

    res.json(response);
  })
);

/**
 * POST /api/atlassian/assessments/:id/rescan
 * Re-scan an Atlassian instance using stored credentials
 */
router.post(
  '/assessments/:id/rescan',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    // Get stored credentials
    const credentials = await apiClient.getCredentials(id);

    if (!credentials || credentials.length === 0) {
      throw new AppError('No stored credentials found for this assessment. Please connect your instance first.', 400);
    }

    // Use the first valid credential
    const instance = credentials[0];

    const result = await envScanner.scanAndAnalyze(id, instance);

    const response: ApiResponse<typeof result> = {
      success: true,
      data: result
    };

    res.json(response);
  })
);

/**
 * GET /api/atlassian/assessments/:id/scan-logs
 * Get scan logs for an assessment (for polling)
 */
router.get(
  '/assessments/:id/scan-logs',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const logs = getScanLogs(id);

    const response: ApiResponse<ScanLogEntry[]> = {
      success: true,
      data: logs
    };

    res.json(response);
  })
);

/**
 * GET /api/atlassian/assessments/:id/scan-logs/stream
 * Stream scan logs via Server-Sent Events for real-time updates
 */
router.get(
  '/assessments/:id/scan-logs/stream',
  (req: Request, res: Response) => {
    const { id } = req.params;

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Send existing logs first
    const existingLogs = getScanLogs(id);
    for (const log of existingLogs) {
      res.write(`data: ${JSON.stringify(log)}\n\n`);
    }

    // Listen for new logs
    const logHandler = (entry: ScanLogEntry) => {
      res.write(`data: ${JSON.stringify(entry)}\n\n`);
    };

    scanLogEmitter.on(`scan:${id}`, logHandler);

    // Cleanup on disconnect
    req.on('close', () => {
      scanLogEmitter.off(`scan:${id}`, logHandler);
    });

    // Send a heartbeat every 30 seconds to keep connection alive
    const heartbeat = setInterval(() => {
      res.write(`:heartbeat\n\n`);
    }, 30000);

    req.on('close', () => {
      clearInterval(heartbeat);
    });
  }
);

export default router;
