import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { getResearchService } from '../services/research.service';
import { getIntegratorOpportunityMappingService } from '../services/enterprise-opportunity-mapping.service';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { ApiResponse, ResearchRequest } from '../types';
import { getPrismaClient } from '../config/database';
import { expandMeetingIdentifiers } from '../utils/idConversion';
import { getAccessibleMeetingIdsForUserFlexible, userHasMeetingAccess, userMatchesRequestedBy } from '../utils/meetingAccess';

const router = Router();
const researchService = getResearchService();
const enterpriseService = getIntegratorOpportunityMappingService();
const prisma = getPrismaClient();

/**
 * POST /api/research/start
 * Start a new research analysis
 */
router.post(
  '/start',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Missing authenticated user id', 401);
    }

    const request: ResearchRequest = req.body;

    const accessToken = req.user?.accessToken;
    const requestedBy = req.user?.email || userId;

    // Accept both snake_case and camelCase for backward compatibility
    const companyName = (request as any).companyName || (request as any).company_name;

    if (!companyName) {
      throw new AppError('Company name is required', 400);
    }

    // Normalize the request object to camelCase
    const normalizedRequest: ResearchRequest = {
      companyName: companyName,
      purposeOfMeeting: (request as any).purposeOfMeeting || (request as any).purpose_of_meeting || '',
      meetingContext: (request as any).meetingContext || (request as any).meeting_context || '',
      attendees: request.attendees || [],
      meetingTitle: (request as any).meetingTitle || (request as any).meeting_title,
      meetingDate: (request as any).meetingDate || (request as any).meeting_date,
      dealId: (request as any).dealId || (request as any).deal_id,
      meetingId: (request as any).meetingId || (request as any).meeting_id,
      accessToken,
    };

    const missingKeys: string[] = [];

    if (!process.env.OPENAI_API_KEY) {
      missingKeys.push('OpenAI API key');
    }

    if (missingKeys.length > 0) {
      throw new AppError(
        `Missing required API keys: ${missingKeys.join(', ')}. Please configure ${missingKeys.join(' and ')} in your .env file or Settings page.`,
        400
      );
    }

    // Start research in background (don't await - run asynchronously)
    if (normalizedRequest.meetingId) {
      const expandedMeetingIds = expandMeetingIdentifiers({
        meetingId: normalizedRequest.meetingId,
        calendarEventId: normalizedRequest.meetingId,
        onlineMeetingId: normalizedRequest.meetingId,
        icalUid: normalizedRequest.meetingId,
      });

      const existing = await prisma.analysis.findFirst({
        where: {
          meetingId: { in: expandedMeetingIds.length ? expandedMeetingIds : [normalizedRequest.meetingId] },
          status: { in: ['running', 'pending', 'in_progress'] },
        },
        orderBy: { startedAt: 'desc' },
      });

	      if (existing) {
	        res.status(409).json({
	          success: false,
	          message: 'Pre-call analysis is already running for this meeting.',
	          data: {
	            sessionId: existing.sessionId,
	            status: existing.status === 'in_progress' ? 'running' : existing.status,
	          },
	        });
	        return;
	      }
	    }

    if (normalizedRequest.meetingId) {
      const canStart = await userHasMeetingAccess(userId, normalizedRequest.meetingId);
      if (!canStart) {
        throw new AppError('You do not have access to this meeting. Sync your Outlook/Teams calendar and try again.', 403);
      }
    }

    const sessionId = randomUUID();

    // Fire off research pipeline without waiting
    researchService.runResearchPipeline(normalizedRequest, sessionId, undefined, requestedBy).catch((error) => {
      console.error('Background research error:', error);
    });

    const response: ApiResponse = {
      success: true,
      data: { sessionId },
      message: 'Research started successfully',
    };

	    res.json(response);
	    return;
	  })
	);

/**
 * GET /api/research/status/:sessionId
 * Get status of an ongoing or completed research
 */
router.get(
  '/status/:sessionId',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Missing authenticated user id', 401);
    }

    const { sessionId } = req.params;

    // Validate sessionId
    if (!sessionId || sessionId === 'undefined' || sessionId === 'null') {
      throw new AppError('Invalid session ID provided', 400);
    }

    const record = await prisma.analysis.findUnique({
      where: { sessionId },
      select: { meetingId: true, requestedBy: true },
    });
    if (!record) {
      throw new AppError('Analysis not found', 404);
    }

    if (record.meetingId) {
      const canView = await userHasMeetingAccess(userId, record.meetingId);
      if (!canView) {
        throw new AppError('You do not have access to this meeting analysis.', 403);
      }
    } else if (!userMatchesRequestedBy(req.user, record.requestedBy)) {
      throw new AppError('You do not have access to this analysis.', 403);
    }

    const status = await researchService.getAnalysisStatus(sessionId);

    const response: ApiResponse = {
      success: true,
      data: status,
    };

    res.json(response);
  })
);

/**
 * GET /api/research/list
 * List all research analyses with optional filters
 */
router.get(
  '/list',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Missing authenticated user id', 401);
    }

    const { companyName, dealId, status } = req.query;

    const filters: any = {};
    if (companyName) filters.companyName = companyName as string;
    if (dealId) filters.dealId = dealId as string;
    if (status) filters.status = status as string;

    const analyses = await prisma.analysis.findMany({
      where: filters,
      orderBy: { startedAt: 'desc' },
      take: 200,
    });

    const meetingIds = analyses
      .map((analysis: any) => analysis.meetingId)
      .filter((id: any): id is string => Boolean(id));
    const accessibleMeetingIds = await getAccessibleMeetingIdsForUserFlexible(userId, meetingIds);

    const visible = analyses
      .filter((analysis: any) => {
        if (analysis.meetingId) {
          return accessibleMeetingIds.has(analysis.meetingId);
        }
        return userMatchesRequestedBy(req.user, analysis.requestedBy);
      })
      .slice(0, 50);

    const mapped = visible.map((analysis: any) => ({
      session_id: analysis.sessionId,
      company_name: analysis.companyName,
      meeting_id: analysis.meetingId,
      meeting_title: analysis.meetingTitle || '',
      meeting_date: analysis.meetingDate || '',
      purpose_of_meeting: analysis.purposeOfMeeting || '',
      completed_at: analysis.completedAt ? analysis.completedAt.toISOString() : '',
      attendees: analysis.attendees ? JSON.parse(analysis.attendees) : [],
      dealId: analysis.dealId,
      status: analysis.status,
    }));

    const response: ApiResponse = {
      success: true,
      data: mapped,
    };

    res.json(response);
  })
);

/**
 * GET /api/research/:sessionId/result
 * Get the analysis result for a specific session
 */
router.get(
  '/:sessionId/result',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Missing authenticated user id', 401);
    }

    const { sessionId } = req.params;

    const record = await prisma.analysis.findUnique({
      where: { sessionId },
      select: { meetingId: true, requestedBy: true },
    });
    if (!record) {
      throw new AppError('Analysis not found', 404);
    }

    if (record.meetingId) {
      const canView = await userHasMeetingAccess(userId, record.meetingId);
      if (!canView) {
        throw new AppError('You do not have access to this meeting analysis.', 403);
      }
    } else if (!userMatchesRequestedBy(req.user, record.requestedBy)) {
      throw new AppError('You do not have access to this analysis.', 403);
    }

    const status = await researchService.getAnalysisStatus(sessionId);

    if (!status.result) {
      throw new AppError('Analysis result not found or not yet completed', 404);
    }

    // Return just the result data directly (not wrapped in ApiResponse)
    // This matches what the frontend expects
    res.json(status.result);
  })
);

/**
 * POST /api/research/:sessionId/cancel
 * Cancel an ongoing research session
 */
router.post(
  '/:sessionId/cancel',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Missing authenticated user id', 401);
    }

    const { sessionId } = req.params;

    if (!sessionId || sessionId === 'undefined' || sessionId === 'null') {
      throw new AppError('Invalid session ID provided', 400);
    }

    const record = await prisma.analysis.findUnique({
      where: { sessionId },
      select: { meetingId: true, requestedBy: true },
    });
    if (!record) {
      throw new AppError('Analysis not found', 404);
    }

    if (record.meetingId) {
      const canCancel = await userHasMeetingAccess(userId, record.meetingId);
      if (!canCancel) {
        throw new AppError('You do not have access to this meeting analysis.', 403);
      }
    } else if (!userMatchesRequestedBy(req.user, record.requestedBy)) {
      throw new AppError('You do not have access to this analysis.', 403);
    }

    const cancelled = await researchService.cancelResearch(sessionId);

    const response: ApiResponse = {
      success: cancelled,
      message: cancelled ? 'Research cancelled successfully' : 'Research was not running or already completed',
      data: { sessionId, cancelled },
    };

    res.json(response);
  })
);

/**
 * DELETE /api/research/:sessionId
 * Delete an analysis
 */
router.delete(
  '/:sessionId',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Missing authenticated user id', 401);
    }

    const { sessionId } = req.params;

    const record = await prisma.analysis.findUnique({
      where: { sessionId },
      select: { meetingId: true, requestedBy: true },
    });
    if (!record) {
      throw new AppError('Analysis not found', 404);
    }

    if (record.meetingId) {
      const canDelete = await userHasMeetingAccess(userId, record.meetingId);
      if (!canDelete) {
        throw new AppError('You do not have access to this meeting analysis.', 403);
      }
    } else if (!userMatchesRequestedBy(req.user, record.requestedBy)) {
      throw new AppError('You do not have access to this analysis.', 403);
    }

    await researchService.deleteAnalysis(sessionId);

    const response: ApiResponse = {
      success: true,
      message: 'Analysis deleted successfully',
      data: { sessionId },
    };

    res.json(response);
  })
);

/**
 * GET /api/research/:sessionId/enterprise-mapping
 * Get Northstar Integrators opportunity area mapping for a research session
 */
router.get(
  '/:sessionId/enterprise-mapping',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Missing authenticated user id', 401);
    }

    const { sessionId } = req.params;

    const record = await prisma.analysis.findUnique({
      where: { sessionId },
      select: { meetingId: true, requestedBy: true, companyName: true, result: true },
    });
    if (!record) {
      throw new AppError('Analysis not found', 404);
    }

    if (record.meetingId) {
      const canView = await userHasMeetingAccess(userId, record.meetingId);
      if (!canView) {
        throw new AppError('You do not have access to this meeting analysis.', 403);
      }
    } else if (!userMatchesRequestedBy(req.user, record.requestedBy)) {
      throw new AppError('You do not have access to this analysis.', 403);
    }

    // Try to get existing mapping first
    let mapping = await enterpriseService.getMappingBySessionId(sessionId);

    // If no mapping exists, generate one from the analysis result
    if (!mapping && record.result) {
      try {
        const analysisResult = typeof record.result === 'string' ? JSON.parse(record.result) : record.result;
        mapping = await enterpriseService.generateFullMapping(
          sessionId,
          record.companyName,
          analysisResult.companyDeepDive || analysisResult.company_overview,
          analysisResult.gapAnalysis || analysisResult.gap_analysis,
          undefined, // transcript insights
          undefined, // deal context
          false // existing customer
        );
      } catch (error) {
        console.error('Failed to generate Northstar Integrators mapping:', error);
      }
    }

    const response: ApiResponse = {
      success: true,
      data: mapping || {
        serviceLines: [],
        opportunityCategory: { category: 'new_logo', name: 'New Logo', confidence: 50, indicators: [], color: '#1976d2' },
        strategicFitScore: 50,
        strategicFitAnalysis: 'Analysis pending.',
      },
    };

    res.json(response);
  })
);

/**
 * PATCH /api/research/:sessionId
 * Update/edit the research result (for editable outputs feature)
 */
router.patch(
  '/:sessionId',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Missing authenticated user id', 401);
    }

    const { sessionId } = req.params;
    const { editedResult } = req.body;

    if (!editedResult) {
      throw new AppError('editedResult is required', 400);
    }

    const record = await prisma.analysis.findUnique({
      where: { sessionId },
      select: { meetingId: true, requestedBy: true },
    });
    if (!record) {
      throw new AppError('Analysis not found', 404);
    }

    if (record.meetingId) {
      const canEdit = await userHasMeetingAccess(userId, record.meetingId);
      if (!canEdit) {
        throw new AppError('You do not have access to edit this analysis.', 403);
      }
    } else if (!userMatchesRequestedBy(req.user, record.requestedBy)) {
      throw new AppError('You do not have access to edit this analysis.', 403);
    }

    // Update the edited result
    await prisma.analysis.update({
      where: { sessionId },
      data: {
        editedResult: typeof editedResult === 'string' ? editedResult : JSON.stringify(editedResult),
        lastEditedAt: new Date(),
      },
    });

    const response: ApiResponse = {
      success: true,
      message: 'Analysis updated successfully',
      data: { sessionId, lastEditedAt: new Date().toISOString() },
    };

    res.json(response);
  })
);

/**
 * PATCH /api/research/:sessionId/link-deal
 * Link an analysis to a deal
 */
router.patch(
  '/:sessionId/link-deal',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Missing authenticated user id', 401);
    }

    const { sessionId } = req.params;
    const { dealId } = req.body;

    const record = await prisma.analysis.findUnique({
      where: { sessionId },
      select: { meetingId: true, requestedBy: true },
    });
    if (!record) {
      throw new AppError('Analysis not found', 404);
    }

    if (record.meetingId) {
      const canLink = await userHasMeetingAccess(userId, record.meetingId);
      if (!canLink) {
        throw new AppError('You do not have access to this meeting analysis.', 403);
      }
    } else if (!userMatchesRequestedBy(req.user, record.requestedBy)) {
      throw new AppError('You do not have access to this analysis.', 403);
    }

    if (!dealId) {
      throw new AppError('Deal ID is required', 400);
    }

    await researchService.linkToDeal(sessionId, dealId);

    const response: ApiResponse = {
      success: true,
      message: 'Analysis linked to deal successfully',
      data: { sessionId, dealId },
    };

    res.json(response);
  })
);

export default router;
