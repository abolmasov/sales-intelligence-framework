import { Router, Request, Response } from 'express';
import { getPrismaClient } from '../config/database';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { ApiResponse } from '../types';
import { getCaseStudyService } from '../services/caseStudy.service';
import { getAccessibleMeetingIdsForUser, userMatchesRequestedBy } from '../utils/meetingAccess';

const router = Router({ mergeParams: true });
const prisma = getPrismaClient();
const caseStudyService = getCaseStudyService();

/**
 * POST /api/deals/:dealId/integrations/research/link
 * Link a research session to a deal
 */
router.post(
  '/research/link',
  asyncHandler(async (req: Request, res: Response) => {
    const { dealId } = req.params;
    const { sessionId, autoExtract = true } = req.body;

    if (!sessionId) {
      throw new AppError('Session ID is required', 400);
    }

    // Verify deal exists
    const deal = await prisma.deal.findUnique({
      where: { dealId },
    });
    if (!deal) {
      throw new AppError('Deal not found', 404);
    }

    // Verify research session exists
    const analysis = await prisma.analysis.findUnique({
      where: { sessionId },
    });
    if (!analysis) {
      throw new AppError('Research session not found', 404);
    }

    // Link research to deal
    await prisma.analysis.update({
      where: { sessionId },
      data: { dealId },
    });

    // Auto-extract if requested and result exists
    if (autoExtract && analysis.result) {
      const result = JSON.parse(analysis.result);

      // Extract win themes
      if (result.keyInsights) {
        const existingThemes = deal.winThemes ? JSON.parse(deal.winThemes) : [];
        const newThemes = result.keyInsights.slice(0, 5);
        const mergedThemes = Array.from(new Set([...existingThemes, ...newThemes]));

        await prisma.deal.update({
          where: { dealId },
          data: { winThemes: JSON.stringify(mergedThemes) },
        });
      }

      // Create action plan if available
      if (result.actionPlan) {
        await prisma.dealActionPlan.create({
          data: {
            dealId,
            analysisSessionId: sessionId,
            title: `Action Plan from ${analysis.companyName} Research`,
            actionPlanText: result.actionPlan,
            createdBy: 'ai_generated',
          },
        });
      }

      // Link relevant Northstar Integrators case studies from research
      if (result.integratorCaseStudies) {
        for (const caseStudy of result.integratorCaseStudies.slice(0, 5)) {
          await prisma.dealCaseStudy.create({
            data: {
              dealId,
              caseStudyId: caseStudy.id || caseStudy.title || 'unknown',
              caseStudySource: 'enterprise',
              relevanceScore: caseStudy.relevanceScore || 0.5,
              relevanceReason: `From AI research analysis of ${analysis.companyName}`,
            },
          });
        }
      }

      // Link relevant Northstar library case studies from research
      if (result.libraryCaseStudies) {
        for (const caseStudy of result.libraryCaseStudies.slice(0, 5)) {
          await prisma.dealCaseStudy.create({
            data: {
              dealId,
              caseStudyId: caseStudy.id || caseStudy.title || 'unknown',
              caseStudySource: 'library',
              relevanceScore: caseStudy.relevanceScore || 0.5,
              relevanceReason: `From AI research analysis of ${analysis.companyName}`,
            },
          });
        }
      }
    }

    const response: ApiResponse = {
      success: true,
      data: {
        dealId,
        sessionId,
        autoExtracted: autoExtract,
      },
      message: 'Research linked successfully',
    };

    res.json(response);
  })
);

/**
 * GET /api/deals/:dealId/integrations/research
 * Get all research sessions linked to this deal
 */
router.get(
  '/research',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Missing authenticated user id', 401);
    }
    const { dealId } = req.params;

    const analyses = await prisma.analysis.findMany({
      where: {
        dealId,
        status: 'completed',
      },
      orderBy: { completedAt: 'desc' },
    });

    const meetingIds = analyses
      .map((analysis: any) => analysis.meetingId)
      .filter((id: any): id is string => Boolean(id));
    const accessibleMeetingIds = await getAccessibleMeetingIdsForUser(userId, meetingIds);

    const response: ApiResponse = {
      success: true,
      data: {
        dealId,
        researchCount: analyses.filter((a: any) => {
          if (a.meetingId) {
            return accessibleMeetingIds.has(a.meetingId);
          }
          return userMatchesRequestedBy(req.user, a.requestedBy);
        }).length,
        researchSessions: analyses
          .filter((a: any) => {
            if (a.meetingId) {
              return accessibleMeetingIds.has(a.meetingId);
            }
            return userMatchesRequestedBy(req.user, a.requestedBy);
          })
          .map((a: any) => ({
          sessionId: a.sessionId,
          companyName: a.companyName,
          purpose: a.purposeOfMeeting,
          startedAt: a.startedAt,
          completedAt: a.completedAt,
          hasResult: !!a.result,
        })),
      },
    };

    res.json(response);
  })
);

/**
 * POST /api/deals/:dealId/integrations/case-studies/link
 * Link a case study to a deal
 */
router.post(
  '/case-studies/link',
  asyncHandler(async (req: Request, res: Response) => {
    const { dealId } = req.params;
    const { caseStudyId, caseStudySource, relevanceScore, relevanceReason } = req.body;

    if (!caseStudyId || !caseStudySource) {
      throw new AppError('Case study ID and source are required', 400);
    }

    // Verify deal exists
    const deal = await prisma.deal.findUnique({
      where: { dealId },
    });
    if (!deal) {
      throw new AppError('Deal not found', 404);
    }

    // Check if already linked
    const existing = await prisma.dealCaseStudy.findFirst({
      where: {
        dealId,
        caseStudyId,
        isActive: true,
      },
    });

    if (existing) {
      throw new AppError('Case study already linked to this deal', 400);
    }

    // Create link
    await prisma.dealCaseStudy.create({
      data: {
        dealId,
        caseStudyId,
        caseStudySource,
        relevanceScore,
        relevanceReason,
      },
    });

    const response: ApiResponse = {
      success: true,
      message: 'Case study linked successfully',
    };

    res.json(response);
  })
);

/**
 * GET /api/deals/:dealId/integrations/case-studies
 * Get all case studies linked to this deal
 */
router.get(
  '/case-studies',
  asyncHandler(async (req: Request, res: Response) => {
    const { dealId } = req.params;

    const links = await prisma.dealCaseStudy.findMany({
      where: {
        dealId,
        isActive: true,
      },
      orderBy: { relevanceScore: 'desc' },
    });

    // Load actual case study data
    const integratorResults = caseStudyService.searchIntegratorCaseStudies({ pageSize: 1000 });
    const libraryResults = caseStudyService.searchLibraryCaseStudies({ pageSize: 1000 });

    const integratorCases = Object.fromEntries(
      integratorResults.caseStudies.map((cs) => [cs.title, cs])
    );
    const libraryCases = Object.fromEntries(
      libraryResults.caseStudies.map((cs) => [cs.title, cs])
    );

    // Merge link data with actual case study content
    const caseStudies = links
      .map((link: any) => {
        let caseData = null;
        if (link.caseStudySource === 'enterprise' || link.caseStudySource === 'integrator') {
          caseData = integratorCases[link.caseStudyId];
        } else if (link.caseStudySource === 'inry' || link.caseStudySource === 'library') {
          caseData = libraryCases[link.caseStudyId];
        }

        if (caseData) {
          return {
            ...caseData,
            relevanceScore: link.relevanceScore,
            relevanceReason: link.relevanceReason,
            linkedAt: link.linkedAt,
            source: link.caseStudySource,
          };
        }
        return null;
      })
      .filter((cs: any) => cs !== null);

    const response: ApiResponse = {
      success: true,
      data: {
        dealId,
        caseStudies,
        count: caseStudies.length,
      },
    };

    res.json(response);
  })
);

/**
 * POST /api/deals/:dealId/integrations/services/link
 * Link a service offering to a deal
 */
router.post(
  '/services/link',
  asyncHandler(async (req: Request, res: Response) => {
    const { dealId } = req.params;
    const { serviceId, priority = 'secondary', recommendationReason, recommendedBy = 'sales_rep' } = req.body;

    if (!serviceId) {
      throw new AppError('Service ID is required', 400);
    }

    // Verify deal and service exist
    const deal = await prisma.deal.findUnique({ where: { dealId } });
    if (!deal) {
      throw new AppError('Deal not found', 404);
    }

    const service = await prisma.serviceOffering.findUnique({ where: { serviceId } });
    if (!service) {
      throw new AppError('Service not found', 404);
    }

    // Check if already linked
    const existing = await prisma.dealService.findFirst({
      where: { dealId, serviceId },
    });

    if (existing) {
      // Update existing link
      await prisma.dealService.update({
        where: { id: existing.id },
        data: {
          priority,
          recommendationReason,
          recommendedBy,
        },
      });
    } else {
      // Create new link
      await prisma.dealService.create({
        data: {
          dealId,
          serviceId,
          priority,
          recommendationReason,
          recommendedBy,
        },
      });
    }

    const response: ApiResponse = {
      success: true,
      message: 'Service linked successfully',
    };

    res.json(response);
  })
);

/**
 * GET /api/deals/:dealId/integrations/services
 * Get all services linked to this deal
 */
router.get(
  '/services',
  asyncHandler(async (req: Request, res: Response) => {
    const { dealId } = req.params;

    const links = await prisma.dealService.findMany({
      where: { dealId },
      include: { service: true },
    });

    const services = links.map((link: any) => ({
      serviceId: link.service.serviceId,
      serviceName: link.service.serviceName,
      category: link.service.category,
      description: link.service.description,
      priority: link.priority,
      recommendationReason: link.recommendationReason,
      recommendedBy: link.recommendedBy,
      status: link.status,
      linkedAt: link.linkedAt,
    }));

    const response: ApiResponse = {
      success: true,
      data: {
        dealId,
        services,
        count: services.length,
      },
    };

    res.json(response);
  })
);

/**
 * POST /api/deals/:dealId/integrations/action-plans
 * Create an action plan for a deal
 */
router.post(
  '/action-plans',
  asyncHandler(async (req: Request, res: Response) => {
    const { dealId } = req.params;
    const { title, actionPlanText, actionItems, analysisSessionId } = req.body;

    if (!title || !actionPlanText) {
      throw new AppError('Title and action plan text are required', 400);
    }

    const deal = await prisma.deal.findUnique({ where: { dealId } });
    if (!deal) {
      throw new AppError('Deal not found', 404);
    }

    const actionPlan = await prisma.dealActionPlan.create({
      data: {
        dealId,
        analysisSessionId,
        title,
        actionPlanText,
        actionItems: actionItems ? JSON.stringify(actionItems) : null,
        createdBy: 'sales_rep',
      },
    });

    const response: ApiResponse = {
      success: true,
      data: { actionPlanId: actionPlan.id },
      message: 'Action plan created successfully',
    };

    res.status(201).json(response);
  })
);

/**
 * GET /api/deals/:dealId/integrations/action-plans
 * Get all action plans for a deal
 */
router.get(
  '/action-plans',
  asyncHandler(async (req: Request, res: Response) => {
    const { dealId } = req.params;

    const plans = await prisma.dealActionPlan.findMany({
      where: {
        dealId,
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const response: ApiResponse = {
      success: true,
      data: {
        dealId,
        actionPlans: plans.map((p: any) => ({
          id: p.id,
          title: p.title,
          actionPlanText: p.actionPlanText,
          actionItems: p.actionItems ? JSON.parse(p.actionItems) : null,
          analysisSessionId: p.analysisSessionId,
          createdBy: p.createdBy,
          version: p.version,
          createdAt: p.createdAt,
        })),
        count: plans.length,
      },
    };

    res.json(response);
  })
);

/**
 * POST /api/deals/:dealId/integrations/questionnaires
 * Create a questionnaire for a deal
 */
router.post(
  '/questionnaires',
  asyncHandler(async (req: Request, res: Response) => {
    const { dealId } = req.params;
    const { title, questions, questionnaireType = 'discovery', analysisSessionId } = req.body;

    if (!title || !questions) {
      throw new AppError('Title and questions are required', 400);
    }

    const deal = await prisma.deal.findUnique({ where: { dealId } });
    if (!deal) {
      throw new AppError('Deal not found', 404);
    }

    const questionnaire = await prisma.dealQuestionnaire.create({
      data: {
        dealId,
        analysisSessionId,
        title,
        questions: JSON.stringify(questions),
        questionnaireType,
        createdBy: 'sales_rep',
      },
    });

    const response: ApiResponse = {
      success: true,
      data: { questionnaireId: questionnaire.id },
      message: 'Questionnaire created successfully',
    };

    res.status(201).json(response);
  })
);

/**
 * GET /api/deals/:dealId/integrations/questionnaires
 * Get all questionnaires for a deal
 */
router.get(
  '/questionnaires',
  asyncHandler(async (req: Request, res: Response) => {
    const { dealId } = req.params;

    const questionnaires = await prisma.dealQuestionnaire.findMany({
      where: { dealId },
      orderBy: { createdAt: 'desc' },
    });

    const response: ApiResponse = {
      success: true,
      data: {
        dealId,
        questionnaires: questionnaires.map((q: any) => ({
          id: q.id,
          title: q.title,
          questions: JSON.parse(q.questions),
          questionnaireType: q.questionnaireType,
          analysisSessionId: q.analysisSessionId,
          completionStatus: q.completionStatus,
          createdAt: q.createdAt,
        })),
        count: questionnaires.length,
      },
    };

    res.json(response);
  })
);

/**
 * GET /api/deals/:dealId/integrations/all
 * Get comprehensive view of all integrations for a deal
 */
router.get(
  '/all',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Missing authenticated user id', 401);
    }
    const { dealId } = req.params;

    const deal = await prisma.deal.findUnique({ where: { dealId } });
    if (!deal) {
      throw new AppError('Deal not found', 404);
    }

    // Get counts for all integrations
    const [research, meetings, transcripts, caseStudyLinks, serviceLinks, actionPlans, questionnaires] =
      await Promise.all([
        prisma.analysis.findMany({
          where: { dealId, status: 'completed' },
          orderBy: { completedAt: 'desc' },
        }),
        prisma.meeting.findMany({
          where: { dealId },
          orderBy: { meetingDate: 'desc' },
        }),
        prisma.transcriptAnalysis.findMany({
          where: { dealId },
          orderBy: { analyzedAt: 'desc' },
        }),
        prisma.dealCaseStudy.count({
          where: { dealId, isActive: true },
        }),
        prisma.dealService.count({ where: { dealId } }),
        prisma.dealActionPlan.count({
          where: { dealId, isActive: true },
        }),
        prisma.dealQuestionnaire.count({ where: { dealId } }),
      ]);

    const meetingIdsForAccess = Array.from(
      new Set(
        [
          ...research.map((r: any) => r.meetingId).filter(Boolean),
          ...transcripts.map((t: any) => t.meetingId).filter(Boolean),
        ] as string[]
      )
    );
    const accessibleMeetingIds = await getAccessibleMeetingIdsForUser(userId, meetingIdsForAccess);

    const visibleResearch = research.filter((r: any) => {
      if (r.meetingId) {
        return accessibleMeetingIds.has(r.meetingId);
      }
      return userMatchesRequestedBy(req.user, r.requestedBy);
    });

    const visibleTranscripts = transcripts.filter((t: any) => {
      if (t.meetingId) {
        return accessibleMeetingIds.has(t.meetingId);
      }
      return userMatchesRequestedBy(req.user, t.requestedBy);
    });

    const response: ApiResponse = {
      success: true,
      data: {
        dealId,
        deal: {
          opportunityName: deal.opportunityName,
          companyName: deal.companyName,
          stage: deal.stage,
          status: deal.status,
          hasPursuitBrief: !!deal.story,
        },
        integrations: {
          researchSessions: visibleResearch.length,
          meetings: meetings.length,
          transcriptsAnalyzed: visibleTranscripts.length,
          caseStudies: caseStudyLinks,
          services: serviceLinks,
          actionPlans,
          questionnaires,
        },
        latestResearch: visibleResearch[0]?.sessionId || null,
        latestMeeting: meetings[0]?.meetingId || null,
        latestTranscript: visibleTranscripts[0]?.analysisId || null,
        canGeneratePursuitBrief: visibleResearch.length > 0 || visibleTranscripts.length > 0,
      },
    };

    res.json(response);
  })
);

export default router;
