import { Router, Request, Response } from 'express';
import { getPrismaClient } from '../config/database';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { ApiResponse } from '../types';
import { randomUUID } from 'crypto';
import { AccountService } from '../services/account.service';
import { DealService } from '../services/deal.service';
import { MeetingService } from '../services/meeting.service';
import { getAccessibleMeetingIdsForUser, userMatchesRequestedBy } from '../utils/meetingAccess';
import { createPptxSignedUrl, isPptxStorageConfigured } from '../services/pptxStorage.service';

const router = Router();
const prisma = getPrismaClient();

function transformOpportunityForFrontend(opportunity: any) {
  return {
    opportunity_id: opportunity.opportunityId,
    deal_id: opportunity.dealId,
    meeting_id: opportunity.meetingId,
    meeting_title: opportunity.meeting?.title || null,
    transcript_analysis_id: opportunity.transcriptAnalysisId,
    title: opportunity.title,
    description: opportunity.description,
    confidence_score: opportunity.confidenceScore,
    status: opportunity.status,
    source: opportunity.source,
    created_at: opportunity.createdAt,
    updated_at: opportunity.updatedAt,
    details: opportunity.details || null,
  };
}

// Helper function to transform deal to snake_case for frontend
function transformDealForFrontend(deal: any) {
  return {
    deal_id: deal.dealId,
    opportunity_name: deal.opportunityName,
    company_name: deal.companyName,
    account_id: deal.accountId,
    account_name: deal.account?.name || null,
    stage: deal.stage,
    progress_percentage: deal.progressPercentage,
    estimated_value: deal.estimatedValue,
    close_date: deal.closeDate,
    status: deal.status,
    priority: deal.priority,
    owner: deal.owner,
    team_members: deal.teamMembers ? JSON.parse(deal.teamMembers) : [],
    win_themes: deal.winThemes ? JSON.parse(deal.winThemes) : [],
    story: deal.story,
    notes: deal.notes,
    servicenow_id: deal.servicenowId,
    jira_key: deal.jiraKey,
    salesforce_id: deal.salesforceId || null,
    created_at: deal.createdAt,
    updated_at: deal.updatedAt,
    meetings: deal.meetings || [],
    analyses: deal.analyses || [],
    transcripts: deal.transcripts || [],
    proposalJobs: deal.proposalJobs || [],
    pptxJobs: deal.pptxJobs || [],
    caseStudies: deal.caseStudies || [],
    services: deal.services || [],
    actionPlans: deal.actionPlans || [],
    questionnaires: deal.questionnaires || [],
    opportunities: deal.opportunities ? deal.opportunities.map(transformOpportunityForFrontend) : [],
  };
}

/**
 * GET /api/deals/stats/overview
 * Get deal statistics overview
 */
router.get(
  '/stats/overview',
  asyncHandler(async (req: Request, res: Response) => {
    const [total, active, won, lost] = await Promise.all([
      prisma.deal.count(),
      prisma.deal.count({ where: { status: 'active' } }),
      prisma.deal.count({ where: { status: 'won' } }),
      prisma.deal.count({ where: { status: 'lost' } }),
    ]);

    const response: ApiResponse = {
      success: true,
      data: {
        total,
        active,
        won,
        lost,
      },
    };

    res.json(response);
  })
);

/**
 * GET /api/deals/list
 * List deals (alternative endpoint)
 */
router.get(
  '/list',
  asyncHandler(async (req: Request, res: Response) => {
    const { status, stage, companyName, accountId: accountIdCamel, account_id: accountIdSnake } = req.query;

    const filters: any = {};
    if (status) filters.status = status as string;
    if (stage) filters.stage = stage as string;
    if (companyName) filters.companyName = { contains: companyName as string };
    const requestedAccountId = (accountIdCamel || accountIdSnake) as string | undefined;
    if (requestedAccountId) {
      filters.accountId = requestedAccountId;
    }

    const deals = await prisma.deal.findMany({
      where: filters,
      include: {
        meetings: true,
        analyses: true,
        transcripts: true,
        proposalJobs: true,
        pptxJobs: true,
        opportunities: { orderBy: { createdAt: 'desc' }, include: { meeting: true } },
        account: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const response: ApiResponse = {
      success: true,
      data: deals.map(transformDealForFrontend),
    };

    res.json(response);
  })
);

/**
 * GET /api/deals
 * List all deals with optional filters
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { status, stage, companyName, accountId: accountIdCamel, account_id: accountIdSnake } = req.query;

    const filters: any = {};
    if (status) filters.status = status as string;
    if (stage) filters.stage = stage as string;
    if (companyName) filters.companyName = { contains: companyName as string };
    const requestedAccountId = (accountIdCamel || accountIdSnake) as string | undefined;
    if (requestedAccountId) {
      filters.accountId = requestedAccountId;
    }

    const deals = await prisma.deal.findMany({
      where: filters,
      include: {
        meetings: true,
        analyses: true,
        opportunities: { orderBy: { createdAt: 'desc' }, include: { meeting: true } },
        account: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const response: ApiResponse = {
      success: true,
      data: deals.map(transformDealForFrontend),
    };

    res.json(response);
  })
);

/**
 * GET /api/deals/:dealId
 * Get a specific deal by ID
 */
router.get(
  '/:dealId',
  asyncHandler(async (req: Request, res: Response) => {
    const { dealId } = req.params;

    const deal = await prisma.deal.findUnique({
      where: { dealId },
      include: {
        meetings: true,
        analyses: true,
        transcripts: true,
        proposalJobs: true,
        pptxJobs: true,
        caseStudies: true,
        services: {
          include: {
            service: true,
          },
        },
        actionPlans: true,
        questionnaires: true,
        opportunities: { orderBy: { createdAt: 'desc' }, include: { meeting: true } },
        account: true,
      },
    });

    if (!deal) {
      throw new AppError('Deal not found', 404);
    }

    const response: ApiResponse = {
      success: true,
      data: transformDealForFrontend(deal),
    };

    res.json(response);
  })
);

/**
 * POST /api/deals
 * Create a new deal
 */
router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    console.log('[deals.routes] POST /api/deals - req.body:', JSON.stringify(req.body, null, 2));
    console.log('[deals.routes] Content-Type:', req.headers['content-type']);

    const {
      opportunityName,
      companyName,
      stage,
      estimatedValue,
      closeDate,
      owner,
      notes,
      accountId: accountIdCamel,
      account_id: accountIdSnake,
    } = req.body;

    console.log('[deals.routes] Extracted opportunityName:', opportunityName, 'type:', typeof opportunityName);

    if (!opportunityName) {
      console.log('[deals.routes] opportunityName is falsy, throwing error');
      throw new AppError('Opportunity name is required', 400);
    }

    const requestedAccountId = (accountIdCamel || accountIdSnake || '').trim();
    if (!requestedAccountId) {
      throw new AppError('Account is required to create a deal', 400);
    }

    const account = await prisma.account.findUnique({
      where: { accountId: requestedAccountId },
    });

    if (!account) {
      throw new AppError('Account not found', 404);
    }

    let resolvedCompanyName = companyName?.trim() || account.name;
    const resolvedAccountId = account.accountId;

    const deal = await prisma.deal.create({
      data: {
        dealId: randomUUID(),
        opportunityName,
        companyName: resolvedCompanyName,
        stage: stage || 'prospecting',
        estimatedValue,
        closeDate: closeDate ? new Date(closeDate) : null,
        owner,
        notes,
        accountId: resolvedAccountId,
      },
      include: { account: true },
    });

    const response: ApiResponse = {
      success: true,
      data: transformDealForFrontend(deal),
      message: 'Deal created successfully',
    };

    res.status(201).json(response);
  })
);

/**
 * PATCH/PUT /api/deals/:dealId
 * Update a deal
 */
const updateDealHandler = asyncHandler(async (req: Request, res: Response) => {
  const { dealId } = req.params;
  const updates = { ...req.body };

  // Remove fields that shouldn't be updated directly
  delete updates.dealId;
  delete updates.createdAt;
  if (updates.account_id && !updates.accountId) {
    updates.accountId = updates.account_id;
  }
  delete updates.account_id;
  if (updates.company_name && !updates.companyName) {
    updates.companyName = updates.company_name;
  }
  delete updates.company_name;
  if (typeof updates.progress_percentage !== 'undefined' && typeof updates.progressPercentage === 'undefined') {
    updates.progressPercentage = updates.progress_percentage;
  }
  delete updates.progress_percentage;

  if (typeof updates.accountId === 'string') {
    const trimmedAccount = updates.accountId.trim();
    if (!trimmedAccount) {
      updates.accountId = null;
    } else {
      const account = await prisma.account.findUnique({
        where: { accountId: trimmedAccount },
      });
      if (!account) {
        throw new AppError('Account not found', 404);
      }
      updates.accountId = trimmedAccount;
      if (!updates.companyName && !updates.company_name) {
        updates.companyName = account.name;
      }
    }
  }

  const deal = await prisma.deal.update({
    where: { dealId },
    data: updates,
    include: { account: true },
  });

  const response: ApiResponse = {
    success: true,
    data: transformDealForFrontend(deal),
    message: 'Deal updated successfully',
  };

  res.json(response);
});

router.patch('/:dealId', updateDealHandler);
router.put('/:dealId', updateDealHandler);

/**
 * PATCH /api/deals/:dealId/link-meeting
 * Link an existing meeting to an existing deal
 */
router.patch(
  '/:dealId/link-meeting',
  asyncHandler(async (req: Request, res: Response) => {
    const { dealId } = req.params;
    const {
      meetingId,
      calendarEventId,
      onlineMeetingId,
      icalUid,
      meetingTitle,
      meetingDate,
      durationMinutes,
    } = req.body;

    // Verify the deal exists
    const deal = await prisma.deal.findUnique({
      where: { dealId },
      include: { account: true },
    });

    if (!deal) {
      throw new AppError('Deal not found', 404);
    }

    // Check if any meeting ID is provided
    const hasAnyMeetingId = meetingId || calendarEventId || onlineMeetingId || icalUid;
    if (!hasAnyMeetingId) {
      throw new AppError('At least one meeting ID is required', 400);
    }

    // Use MeetingService to find or create and link the meeting
    const meetingResult = await MeetingService.findOrCreate(
      {
        meetingId: meetingId || calendarEventId,
        calendarEventId: calendarEventId || meetingId,
        onlineMeetingId: onlineMeetingId || undefined,
        icalUid: icalUid || undefined,
      },
      {
        title: meetingTitle || `Meeting with ${deal.companyName}`,
        meetingDate: meetingDate ? new Date(meetingDate) : undefined,
        durationMinutes: durationMinutes || undefined,
        dealId: deal.dealId,
        accountId: deal.accountId || undefined,
      },
      true // updateIfExists - link to deal if meeting already exists
    );

    const response: ApiResponse = {
      success: true,
      data: {
        meeting: {
          meeting_id: meetingResult.meeting.meetingId,
          title: meetingResult.meeting.title,
          linked: true,
          created: meetingResult.created,
        },
        deal: transformDealForFrontend(deal),
      },
      message: meetingResult.created
        ? `Created and linked meeting to deal "${deal.opportunityName}"`
        : `Linked existing meeting to deal "${deal.opportunityName}"`,
    };

    res.json(response);
  })
);

/**
 * PATCH /api/deals/:dealId/unlink-meeting
 * Unlink a meeting from a deal (removes dealId from the meeting)
 */
router.patch(
  '/:dealId/unlink-meeting',
  asyncHandler(async (req: Request, res: Response) => {
    const { dealId } = req.params;
    const { meetingId } = req.body;

    if (!meetingId) {
      throw new AppError('Meeting ID is required', 400);
    }

    // Verify the deal exists
    const deal = await prisma.deal.findUnique({
      where: { dealId },
    });

    if (!deal) {
      throw new AppError('Deal not found', 404);
    }

    // Find the meeting and verify it's linked to this deal
    const meeting = await prisma.meeting.findUnique({
      where: { meetingId },
    });

    if (!meeting) {
      throw new AppError('Meeting not found', 404);
    }

    if (meeting.dealId !== dealId) {
      throw new AppError('Meeting is not linked to this deal', 400);
    }

    // Unlink the meeting by setting dealId to null
    const updatedMeeting = await prisma.meeting.update({
      where: { meetingId },
      data: { dealId: null },
    });

    const response: ApiResponse = {
      success: true,
      data: {
        meeting: {
          meeting_id: updatedMeeting.meetingId,
          title: updatedMeeting.title,
          unlinked: true,
        },
      },
      message: `Unlinked meeting "${updatedMeeting.title}" from deal "${deal.opportunityName}"`,
    };

    res.json(response);
  })
);

/**
 * DELETE /api/deals/:dealId
 * Delete a deal (soft delete by setting status to inactive)
 */
router.delete(
  '/:dealId',
  asyncHandler(async (req: Request, res: Response) => {
    const { dealId } = req.params;

    const deal = await prisma.deal.update({
      where: { dealId },
      data: { status: 'inactive' },
    });

    const response: ApiResponse = {
      success: true,
      data: deal,
      message: 'Deal deleted successfully',
    };

    res.json(response);
  })
);

/**
 * GET /api/deals/:dealId/analyses
 * Get all analyses for a specific deal
 */
router.get(
  '/:dealId/analyses',
  asyncHandler(async (req: Request, res: Response) => {
    const { dealId } = req.params;

    const analyses = await prisma.analysis.findMany({
      where: { dealId },
      orderBy: { startedAt: 'desc' },
    });

    const response: ApiResponse = {
      success: true,
      data: analyses,
    };

    res.json(response);
  })
);

/**
 * GET /api/deals/:dealId/meetings
 * Get all meetings for a specific deal
 */
router.get(
  '/:dealId/meetings',
  asyncHandler(async (req: Request, res: Response) => {
    const { dealId } = req.params;

    const meetings = await prisma.meeting.findMany({
      where: { dealId },
      orderBy: { meetingDate: 'desc' },
    });

    const response: ApiResponse = {
      success: true,
      data: meetings,
    };

    res.json(response);
  })
);

/**
 * GET /api/deals/:dealId/research
 * Get research/analyses for a specific deal
 * Includes analyses linked by:
 * - Direct dealId
 * - meetingId of linked meetings
 * - companyName match (case-insensitive)
 */
router.get(
  '/:dealId/research',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Missing authenticated user id', 401);
    }
    const { dealId } = req.params;

    // Get the deal to find company name and account
    const deal = await prisma.deal.findUnique({
      where: { dealId },
      include: { account: true },
    });

    const linkedMeetings = await prisma.meeting.findMany({
      where: { dealId },
      select: { meetingId: true },
    });
    const meetingIds = Array.from(
      new Set(
        linkedMeetings
          .map((meeting) => meeting.meetingId)
          .filter((meetingId): meetingId is string => Boolean(meetingId))
      )
    );

    // Build OR conditions for finding analyses
    const orConditions: any[] = [{ dealId }];

    if (meetingIds.length > 0) {
      orConditions.push({ meetingId: { in: meetingIds } });
    }

    // Also match by company name (case-insensitive)
    if (deal?.companyName) {
      orConditions.push({ companyName: { equals: deal.companyName, mode: 'insensitive' } });
    }

    // Also match by account name if different from company name
    if (deal?.account?.name && deal.account.name !== deal.companyName) {
      orConditions.push({ companyName: { equals: deal.account.name, mode: 'insensitive' } });
    }

    const analyses = await prisma.analysis.findMany({
      where: { OR: orConditions },
      orderBy: { startedAt: 'desc' },
    });

    const analysesMeetingIds = analyses
      .map((analysis: any) => analysis.meetingId)
      .filter((meetingId: any): meetingId is string => Boolean(meetingId));
    const accessibleMeetingIds = await getAccessibleMeetingIdsForUser(userId, analysesMeetingIds);

    const response: ApiResponse = {
      success: true,
      data: analyses
        .filter((analysis: any) => {
          if (analysis.meetingId) {
            return accessibleMeetingIds.has(analysis.meetingId);
          }
          return userMatchesRequestedBy(req.user, analysis.requestedBy);
        })
        .map((analysis: any) => ({
          session_id: analysis.sessionId,
          company_name: analysis.companyName,
          meeting_id: analysis.meetingId,
          meeting_title: analysis.meetingTitle || '',
          meeting_date: analysis.meetingDate || '',
          purpose_of_meeting: analysis.purposeOfMeeting || '',
          completed_at: analysis.completedAt ? analysis.completedAt.toISOString() : '',
          status: analysis.status,
          result: (() => {
            try {
              return analysis.result ? JSON.parse(analysis.result) : null;
            } catch (error) {
              console.warn(`Failed to parse research result for session ${analysis.sessionId}`, error);
              return null;
            }
          })(),
          attendees: (() => {
            try {
              return analysis.attendees ? JSON.parse(analysis.attendees) : [];
            } catch (error) {
              console.warn(`Failed to parse attendees for session ${analysis.sessionId}`, error);
              return [];
            }
          })(),
        })),
    };

    res.json(response);
  })
);

/**
 * GET /api/deals/:dealId/history
 * Get activity history for a specific deal
 */
router.get(
  '/:dealId/history',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Missing authenticated user id', 401);
    }
    const { dealId } = req.params;

    // Get all activities related to the deal
    const [analyses, meetings, transcriptAnalyses] = await Promise.all([
      prisma.analysis.findMany({
        where: { dealId },
        orderBy: { startedAt: 'desc' },
      }),
      prisma.meeting.findMany({
        where: { dealId },
        orderBy: { meetingDate: 'desc' },
      }),
      prisma.transcriptAnalysis.findMany({
        where: { dealId },
        orderBy: { analyzedAt: 'desc' },
      }),
    ]);

    const meetingIdsForAccessLookup = Array.from(
      new Set(
        [
          ...analyses.map((analysis: any) => analysis.meetingId).filter(Boolean),
          ...transcriptAnalyses.map((analysis: any) => analysis.meetingId).filter(Boolean),
        ] as string[]
      )
    );
    const accessibleMeetingIds = await getAccessibleMeetingIdsForUser(userId, meetingIdsForAccessLookup);

    // Combine and sort by date
    const history = [
      ...analyses
        .filter((a: any) => {
          if (a.meetingId) {
            return accessibleMeetingIds.has(a.meetingId);
          }
          return userMatchesRequestedBy(req.user, a.requestedBy);
        })
        .map((a: any) => ({
          type: 'research',
          id: a.sessionId,
          title: `Research: ${a.companyName}`,
          description: a.purposeOfMeeting || 'Sales intelligence research',
          date: a.completedAt || a.startedAt,
          status: a.status,
        })),
      ...meetings.map((m: any) => ({
        type: 'meeting',
        id: m.meetingId,
        title: m.title,
        description: `Meeting with ${m.externalAttendees ? JSON.parse(m.externalAttendees).length : 0} attendees`,
        date: m.meetingDate || m.createdAt,
        duration: m.durationMinutes,
      })),
      ...transcriptAnalyses
        .filter((t: any) => {
          if (t.meetingId) {
            return accessibleMeetingIds.has(t.meetingId);
          }
          return userMatchesRequestedBy(req.user, t.requestedBy);
        })
        .map((t: any) => ({
          type: 'post_call_analysis',
          id: t.analysisId,
          title: t.meetingTitle || 'Post Call Analysis',
          description: `Opportunity Score: ${t.opportunityScore || 'N/A'} | Sentiment: ${t.sentimentOverall || 'N/A'}`,
          date: t.analyzedAt,
          opportunity_score: t.opportunityScore,
          sentiment: t.sentimentOverall,
          success_probability: t.successProbability,
        })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const response: ApiResponse = {
      success: true,
      data: history,
    };

    res.json(response);
  })
);

/**
 * GET /api/deals/:dealId/questionnaires
 * Get all questionnaires for a specific deal
 */
router.get(
  '/:dealId/questionnaires',
  asyncHandler(async (req: Request, res: Response) => {
    const { dealId } = req.params;

    const questionnaires = await prisma.dealQuestionnaire.findMany({
      where: { dealId },
      orderBy: { createdAt: 'desc' },
    });

    const response: ApiResponse = {
      success: true,
      data: questionnaires.map((q: any) => ({
        id: q.id,
        deal_id: q.dealId,
        analysis_session_id: q.analysisSessionId,
        title: q.title,
        questions: q.questions,
        questionnaire_type: q.questionnaireType,
        completion_status: q.completionStatus,
        created_by: q.createdBy,
        created_at: q.createdAt,
        updated_at: q.updatedAt,
      })),
    };

    res.json(response);
  })
);

/**
 * GET /api/deals/:dealId/action-plans
 * Get all action plans for a specific deal
 */
router.get(
  '/:dealId/action-plans',
  asyncHandler(async (req: Request, res: Response) => {
    const { dealId } = req.params;

    const actionPlans = await prisma.dealActionPlan.findMany({
      where: { dealId },
      orderBy: { createdAt: 'desc' },
    });

    const response: ApiResponse = {
      success: true,
      data: actionPlans.map((ap: any) => ({
        id: ap.id,
        deal_id: ap.dealId,
        analysis_session_id: ap.analysisSessionId,
        title: ap.title,
        action_plan_text: ap.actionPlanText,
        action_items: ap.actionItems ? (
          typeof ap.actionItems === 'string' && ap.actionItems.trim().startsWith('[')
            ? JSON.parse(ap.actionItems)
            : ap.actionItems
        ) : null,
        version: ap.version,
        is_active: ap.isActive,
        created_by: ap.createdBy,
        created_at: ap.createdAt,
        updated_at: ap.updatedAt,
      })),
    };

    res.json(response);
  })
);

/**
 * GET /api/deals/:dealId/artifacts
 * Get latest questionnaire and action plan for a deal
 */
router.get(
  '/:dealId/artifacts',
  asyncHandler(async (req: Request, res: Response) => {
    const { dealId } = req.params;

    const [latestQuestionnaire, latestActionPlan] = await Promise.all([
      prisma.dealQuestionnaire.findFirst({
        where: { dealId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.dealActionPlan.findFirst({
        where: { dealId, isActive: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const response: ApiResponse = {
      success: true,
      data: {
        questionnaire: latestQuestionnaire
          ? {
              id: latestQuestionnaire.id,
              deal_id: latestQuestionnaire.dealId,
              analysis_session_id: latestQuestionnaire.analysisSessionId,
              title: latestQuestionnaire.title,
              questions: latestQuestionnaire.questions,
              questionnaire_type: latestQuestionnaire.questionnaireType,
              completion_status: latestQuestionnaire.completionStatus,
              created_by: latestQuestionnaire.createdBy,
              created_at: latestQuestionnaire.createdAt,
              updated_at: latestQuestionnaire.updatedAt,
            }
          : null,
        action_plan: latestActionPlan
          ? {
              id: latestActionPlan.id,
              deal_id: latestActionPlan.dealId,
              analysis_session_id: latestActionPlan.analysisSessionId,
              title: latestActionPlan.title,
              action_plan_text: latestActionPlan.actionPlanText,
              action_items: latestActionPlan.actionItems ? JSON.parse(latestActionPlan.actionItems) : [],
              version: latestActionPlan.version,
              is_active: latestActionPlan.isActive,
              created_by: latestActionPlan.createdBy,
              created_at: latestActionPlan.createdAt,
              updated_at: latestActionPlan.updatedAt,
            }
          : null,
      },
    };

    res.json(response);
  })
);

/**
 * GET /api/deals/:dealId/pursuit-brief-completeness
 * Get pursuit brief completeness with per-question breakdown
 */
router.get(
  '/:dealId/pursuit-brief-completeness',
  asyncHandler(async (req: Request, res: Response) => {
    const { dealId } = req.params;

    // Define the 16 pursuit brief questions
    const PURSUIT_BRIEF_QUESTIONS: Record<string, { section: string; question: string }> = {
      '1': { section: 'client_stakeholders', question: 'Who is the buyer and who are the key stakeholders?' },
      '2': { section: 'problem_goals', question: 'What problem is the client trying to solve?' },
      '3': { section: 'problem_goals', question: 'What goals and outcomes do they expect?' },
      '4': { section: 'problem_goals', question: 'Why now? What is driving urgency?' },
      '5': { section: 'partnership_procurement', question: 'What challenges could block success?' },
      '6': { section: 'partnership_procurement', question: 'What do they seek in a partner?' },
      '7': { section: 'competitive', question: 'What is the procurement process?' },
      '8': { section: 'competitive', question: 'Who are the likely competitors?' },
      '9': { section: 'vision_solution', question: 'Why would the client choose us?' },
      '10': { section: 'vision_solution', question: 'What could make them walk away?' },
      '11': { section: 'win_themes_pitch', question: 'What is our vision for their future state?' },
      '12': { section: 'win_themes_pitch', question: 'What are the core elements of our solution?' },
      '13': { section: 'proof_points', question: 'What assumptions are we making?' },
      '14': { section: 'proof_points', question: 'What are our win themes?' },
      '15': { section: 'proof_points', question: 'What is our storyline?' },
      '16': { section: 'proof_points', question: 'What demos or artifacts reinforce the story?' },
    };

    const SECTIONS = [
      { id: 'client_stakeholders', name: 'Client & Stakeholders' },
      { id: 'problem_goals', name: 'Business Problem & Goals' },
      { id: 'partnership_procurement', name: 'Partnership & Procurement' },
      { id: 'competitive', name: 'Competitive Landscape' },
      { id: 'vision_solution', name: 'Vision & Solution' },
      { id: 'win_themes_pitch', name: 'Win Themes & Pitch' },
      { id: 'proof_points', name: 'Proof Points' },
    ];

    // Fetch pursuit brief for this deal
    let brief: any = await prisma.$queryRaw`
      SELECT * FROM pursuit_briefs WHERE deal_id = ${dealId} LIMIT 1
    `;
    brief = brief[0];

    if (!brief) {
      // No pursuit brief exists - return 0% completeness
      const response: ApiResponse = {
        success: true,
        data: {
          overall: 0,
          answered_count: 0,
          total_count: 16,
          status: 'not_started',
          sections: SECTIONS.map((s) => {
            const sectionQuestions = Object.entries(PURSUIT_BRIEF_QUESTIONS).filter(
              ([, q]) => q.section === s.id
            );
            return {
              id: s.id,
              name: s.name,
              completeness: 0,
              answered: 0,
              total: sectionQuestions.length,
            };
          }),
          gaps: Object.entries(PURSUIT_BRIEF_QUESTIONS).map(([id, q]) => ({
            question_id: id,
            section: q.section,
            question: q.question,
          })),
        },
      };
      return res.json(response);
    }

    // Parse answers from brief
    const questionAnswers: Record<string, string> = (() => {
      try {
        return brief.question_answers ? JSON.parse(brief.question_answers) : {};
      } catch {
        return {};
      }
    })();

    const transcriptAnswers: Record<string, string> = (() => {
      try {
        return brief.transcript_answers ? JSON.parse(brief.transcript_answers) : {};
      } catch {
        return {};
      }
    })();

    // Merge answers (manual answers take precedence)
    const allAnswers = { ...transcriptAnswers, ...questionAnswers };

    // Calculate completeness
    const gaps: Array<{ question_id: string; section: string; question: string }> = [];
    let answeredCount = 0;

    Object.entries(PURSUIT_BRIEF_QUESTIONS).forEach(([id, q]) => {
      const answer = allAnswers[id];
      if (answer && answer.trim().length > 0) {
        answeredCount++;
      } else {
        gaps.push({
          question_id: id,
          section: q.section,
          question: q.question,
        });
      }
    });

    const totalCount = Object.keys(PURSUIT_BRIEF_QUESTIONS).length;
    const overallCompleteness = Math.round((answeredCount / totalCount) * 100);

    // Calculate per-section completeness
    const sections = SECTIONS.map((s) => {
      const sectionQuestions = Object.entries(PURSUIT_BRIEF_QUESTIONS).filter(
        ([, q]) => q.section === s.id
      );
      const sectionAnswered = sectionQuestions.filter(([id]) => {
        const answer = allAnswers[id];
        return answer && answer.trim().length > 0;
      }).length;

      return {
        id: s.id,
        name: s.name,
        completeness: sectionQuestions.length > 0
          ? Math.round((sectionAnswered / sectionQuestions.length) * 100)
          : 0,
        answered: sectionAnswered,
        total: sectionQuestions.length,
      };
    });

    const response: ApiResponse = {
      success: true,
      data: {
        overall: overallCompleteness,
        answered_count: answeredCount,
        total_count: totalCount,
        status: brief.status || 'draft',
        sections,
        gaps,
      },
    };

    return res.json(response);
  })
);

/**
 * POST /api/deals/quick-setup
 * Quick setup: Create account + deal + link meeting in one operation
 *
 * Uses centralized services for guaranteed deduplication:
 * - AccountService: Finds existing account by name/domain (case-insensitive)
 * - DealService: Reuses existing active deal for an account
 * - MeetingService: Finds existing meeting by any of 4 ID formats
 */
router.post(
  '/quick-setup',
  asyncHandler(async (req: Request, res: Response) => {
    const {
      companyName,
      opportunityName,
      // All 4 meeting ID formats for proper deduplication
      meetingId,
      calendarEventId,
      onlineMeetingId,
      icalUid,
      // Meeting metadata
      meetingTitle,
      meetingDate,
      durationMinutes,
      // Account info
      domain,
      existingAccountId,
      // Force create new deal even if one exists for the account
      forceCreateDeal,
    } = req.body;

    if (!companyName) {
      throw new AppError('Company name is required', 400);
    }

    // Step 1: Get or create account using AccountService
    let account: any;
    let accountCreated = false;

    if (existingAccountId) {
      // Use specified account
      account = await AccountService.getById(existingAccountId);
      if (!account) {
        throw new AppError('Specified account not found', 404);
      }
    } else {
      // Find or create account (handles deduplication by name/domain)
      const accountResult = await AccountService.findOrCreate({
        name: companyName,
        domain: domain || undefined,
      });
      account = accountResult.account;
      accountCreated = accountResult.created;
    }

    // Step 2: Get or create deal using DealService
    // If forceCreateDeal is true, always create a new deal even if one exists
    const dealName = opportunityName || `${companyName} Opportunity`;
    const dealResult = await DealService.findOrCreateForAccount({
      opportunityName: dealName,
      companyName: account.name,
      accountId: account.accountId,
    }, Boolean(forceCreateDeal));
    const deal = dealResult.deal;
    const dealCreated = dealResult.created;

    // Step 3: Link meeting using MeetingService (if any meeting ID provided)
    let meeting = null;
    let meetingCreated = false;
    const hasAnyMeetingId = meetingId || calendarEventId || onlineMeetingId || icalUid;

    if (hasAnyMeetingId) {
      // MeetingService handles all 4 ID formats + hex/base64 conversion
      const meetingResult = await MeetingService.findOrCreate(
        {
          meetingId: meetingId || calendarEventId, // Use meetingId or calendarEventId as primary
          calendarEventId: calendarEventId || meetingId,
          onlineMeetingId: onlineMeetingId || undefined,
          icalUid: icalUid || undefined,
        },
        {
          title: meetingTitle || `${companyName} Meeting`,
          meetingDate: meetingDate ? new Date(meetingDate) : undefined,
          durationMinutes: durationMinutes || undefined,
          dealId: deal.dealId,
          accountId: account.accountId,
        },
        true // updateIfExists - link to deal if meeting already exists
      );
      meeting = meetingResult.meeting;
      meetingCreated = meetingResult.created;
    }

    // Build appropriate message based on what was created vs reused
    let message: string;
    if (accountCreated && dealCreated) {
      message = `Created account "${account.name}" and deal "${deal.opportunityName}"`;
    } else if (accountCreated) {
      message = `Created account "${account.name}", linked to existing deal "${deal.opportunityName}"`;
    } else if (dealCreated) {
      message = `Created deal "${deal.opportunityName}" under existing account "${account.name}"`;
    } else {
      message = `Linked meeting to existing deal "${deal.opportunityName}" under "${account.name}"`;
    }

    const response: ApiResponse = {
      success: true,
      data: {
        account: {
          account_id: account.accountId,
          name: account.name,
          domain: account.domain,
          created: accountCreated,
        },
        deal: {
          ...transformDealForFrontend(deal),
          created: dealCreated,
        },
        meeting: meeting ? {
          meeting_id: meeting.meetingId,
          title: meeting.title,
          linked: true,
          created: meetingCreated,
        } : null,
      },
      message,
    };

    res.status(dealCreated ? 201 : 200).json(response);
  })
);

/**
 * GET /api/deals/:dealId/documents
 * Get all documents (proposals, presentations) linked to this deal with download URLs
 */
router.get(
  '/:dealId/documents',
  asyncHandler(async (req: Request, res: Response) => {
    const { dealId } = req.params;

    const deal = await prisma.deal.findUnique({
      where: { dealId },
      include: {
        proposalJobs: {
          where: { status: 'completed' },
          orderBy: { createdAt: 'desc' },
          include: { meeting: { select: { title: true } } },
        },
        pptxJobs: {
          where: { status: 'completed' },
          orderBy: { createdAt: 'desc' },
          include: { meeting: { select: { title: true } } },
        },
      },
    });

    if (!deal) {
      throw new AppError('Deal not found', 404);
    }

    // Transform proposals
    const proposals = deal.proposalJobs.map((job) => ({
      job_id: job.jobId,
      type: 'proposal' as const,
      file_name: job.fileName || `Proposal - ${deal.companyName}.md`,
      status: job.status,
      meeting_title: job.meeting?.title || null,
      meeting_id: job.meetingId,
      created_at: job.createdAt,
      completed_at: job.completedAt,
      has_content: !!job.proposalData,
    }));

    // Transform presentations with signed URLs
    const presentations = await Promise.all(
      deal.pptxJobs.map(async (job) => {
        let downloadUrl: string | null = null;
        if (job.outputFile && isPptxStorageConfigured()) {
          downloadUrl = await createPptxSignedUrl(job.outputFile);
        }
        return {
          job_id: job.jobId,
          type: 'presentation' as const,
          file_name: job.outputFile?.split('/').pop()?.replace(/^[a-f0-9-]{36}-/, '') || `Presentation - ${deal.companyName}.pptx`,
          status: job.status,
          meeting_title: job.meeting?.title || null,
          meeting_id: job.meetingId,
          slide_count: job.slideCount,
          output_file: job.outputFile,
          download_url: downloadUrl,
          created_at: job.createdAt,
          completed_at: job.completedAt,
        };
      })
    );

    const response: ApiResponse = {
      success: true,
      data: {
        proposals,
        presentations,
        total: proposals.length + presentations.length,
      },
    };

    res.json(response);
  })
);

/**
 * DELETE /api/deals/:dealId/documents/proposal/:jobId
 * Unlink a proposal from this deal (does not delete the proposal, just removes the deal association)
 */
router.delete(
  '/:dealId/documents/proposal/:jobId',
  asyncHandler(async (req: Request, res: Response) => {
    const { dealId, jobId } = req.params;

    const proposal = await prisma.proposalJob.findFirst({
      where: { jobId, dealId },
    });

    if (!proposal) {
      throw new AppError('Proposal not found or not linked to this deal', 404);
    }

    await prisma.proposalJob.update({
      where: { jobId },
      data: { dealId: null },
    });

    const response: ApiResponse = {
      success: true,
      message: 'Proposal unlinked from deal',
    };

    res.json(response);
  })
);

/**
 * DELETE /api/deals/:dealId/documents/presentation/:jobId
 * Unlink a presentation from this deal
 */
router.delete(
  '/:dealId/documents/presentation/:jobId',
  asyncHandler(async (req: Request, res: Response) => {
    const { dealId, jobId } = req.params;

    const pptx = await prisma.pptxJob.findFirst({
      where: { jobId, dealId },
    });

    if (!pptx) {
      throw new AppError('Presentation not found or not linked to this deal', 404);
    }

    await prisma.pptxJob.update({
      where: { jobId },
      data: { dealId: null },
    });

    const response: ApiResponse = {
      success: true,
      message: 'Presentation unlinked from deal',
    };

    res.json(response);
  })
);

/**
 * Nested integrations routes
 */
const dealIntegrationsRouter = require('./dealIntegrations.routes').default;
router.use('/:dealId/integrations', dealIntegrationsRouter);

export default router;
