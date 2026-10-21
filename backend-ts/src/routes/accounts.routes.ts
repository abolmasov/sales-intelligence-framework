import { Router } from 'express';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { getPrismaClient } from '../config/database';
import { ApiResponse } from '../types';
import { createPptxSignedUrl } from '../services/pptxStorage.service';
import { AccountService } from '../services/account.service';

const router = Router();
const prisma = getPrismaClient();

type AccountMetrics = {
  postCallCount?: number;
  proposalCount?: number;
  meetingsLast30?: number;
  dealsWon?: number;
  dealsLost?: number;
};

const safeJsonParse = <T>(value?: string | null): T | null => {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

const serializeAnalysisJob = async (job: any) => {
  const pptMetadata = safeJsonParse<Record<string, any>>(job.pptJob?.metadata);
  const pptStats = safeJsonParse<Record<string, any>>(job.pptJob?.stats);
  let pptDownloadUrl: string | null = null;
  if (job.pptJob?.outputFile) {
    try {
      pptDownloadUrl = await createPptxSignedUrl(job.pptJob.outputFile);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[accounts] Failed to create PPT download URL for job ${job.jobId}: ${message}`);
    }
  }
  return {
    job_id: job.jobId,
    status: job.status,
    transcript_status: job.transcriptStatus,
    transcript_analysis_id: job.transcriptAnalysisId || null,
    proposal_status: job.proposalStatus,
    proposal_job_id: job.proposalJobId || null,
    ppt_status: job.pptStatus,
    ppt_job_id: job.pptJobId,
    ppt_download_url: pptDownloadUrl,
    ppt_file_name: pptMetadata?.filename || pptStats?.title || null,
    ppt_slide_count: job.pptJob?.slideCount ?? null,
    error_message: job.errorMessage,
    updated_at: job.updatedAt,
    completed_at: job.completedAt,
  };
};

const serializeAccountSummary = (account: any, metrics: AccountMetrics = {}) => ({
  account_id: account.accountId,
  name: account.name,
  domain: account.domain,
  owner: account.owner,
  industry: account.industry,
  location: account.location,
  summary: account.summary,
  summary_updated: account.summaryUpdated,
  salesforce_id: account.salesforceId || null,
  created_at: account.createdAt,
  updated_at: account.updatedAt,
  metrics: {
    deals: account._count?.deals || 0,
    meetings: account._count?.meetings || 0,
    post_calls: metrics.postCallCount || 0,
    proposals: metrics.proposalCount || 0,
    meetings_last_30: metrics.meetingsLast30 || 0,
    deals_won: metrics.dealsWon || 0,
    deals_lost: metrics.dealsLost || 0,
  },
});

const serializeMeetingForAccount = async (
  meeting: any,
  meetingMetrics: { postCallDone: boolean; proposalGenerated: boolean }
) => ({
  meeting_id: meeting.meetingId,
  title: meeting.title,
  meeting_date: meeting.meetingDate,
  duration_minutes: meeting.durationMinutes,
  deal_id: meeting.dealId,
  deal_name: meeting.deal?.opportunityName || null,
  pre_call_done: Boolean(meeting.analysisId),
  post_call_done: meetingMetrics.postCallDone,
  proposal_generated: meetingMetrics.proposalGenerated,
  internal_attendees: meeting.internalAttendees ? JSON.parse(meeting.internalAttendees) : [],
  external_attendees: meeting.externalAttendees ? JSON.parse(meeting.externalAttendees) : [],
  notes: meeting.notes,
  analysis_job: meeting.analysisJobs?.[0]
    ? await serializeAnalysisJob(meeting.analysisJobs[0])
    : null,
});

const buildCountMap = (entries: Array<{ accountId: string | null; _count: { accountId: number } }>) => {
  const map = new Map<string, number>();
  entries.forEach((entry) => {
    if (entry.accountId) {
      map.set(entry.accountId, entry._count.accountId);
    }
  });
  return map;
};

const buildProposalMap = (entries: Array<{ meeting: { accountId: string | null } | null }>) => {
  const map = new Map<string, number>();
  entries.forEach((entry) => {
    const accountId = entry.meeting?.accountId;
    if (accountId) {
      map.set(accountId, (map.get(accountId) || 0) + 1);
    }
  });
  return map;
};

const buildMeetingMetricMap = (entries: Array<{ meetingId: string | null; status?: string | null }>) => {
  const map = new Map<string, string>();
  entries.forEach((entry) => {
    if (entry.meetingId) {
      map.set(entry.meetingId, entry.status || 'completed');
    }
  });
  return map;
};

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { search, owner } = req.query;

    const where: any = {};
    if (owner && typeof owner === 'string' && owner.trim() && owner !== 'all') {
      where.owner = owner.trim();
    }
    if (search && typeof search === 'string' && search.trim()) {
      const term = search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { industry: { contains: term, mode: 'insensitive' } },
        { domain: { contains: term, mode: 'insensitive' } },
      ];
    }

    const accounts = await prisma.account.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            deals: true,
            meetings: true,
          },
        },
      },
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [postCallGroups, recentMeetingGroups, proposalEntries, wonDeals, lostDeals] = await Promise.all([
      prisma.transcriptAnalysis.groupBy({
        by: ['accountId'],
        where: { accountId: { not: null } },
        _count: { accountId: true },
      }),
      prisma.meeting.groupBy({
        by: ['accountId'],
        where: {
          accountId: { not: null },
          meetingDate: { gte: thirtyDaysAgo },
        },
        _count: { accountId: true },
      }),
      prisma.proposalJob.findMany({
        where: {
          meeting: {
            accountId: { not: null },
          },
        },
        select: {
          meeting: {
            select: { accountId: true },
          },
        },
      }),
      prisma.deal.groupBy({
        by: ['accountId'],
        where: { accountId: { not: null }, status: { in: ['won', 'closed_won'] } },
        _count: { accountId: true },
      }),
      prisma.deal.groupBy({
        by: ['accountId'],
        where: { accountId: { not: null }, status: { in: ['lost', 'closed_lost'] } },
        _count: { accountId: true },
      }),
    ]);

    const postCallMap = buildCountMap(postCallGroups as any);
    const recentMeetingMap = buildCountMap(recentMeetingGroups as any);
    const proposalCountMap = buildProposalMap(proposalEntries);
    const dealsWonMap = buildCountMap(wonDeals as any);
    const dealsLostMap = buildCountMap(lostDeals as any);

    const response: ApiResponse = {
      success: true,
      data: accounts.map((account: any) =>
        serializeAccountSummary(account, {
          postCallCount: postCallMap.get(account.accountId) || 0,
          proposalCount: proposalCountMap.get(account.accountId) || 0,
          meetingsLast30: recentMeetingMap.get(account.accountId) || 0,
          dealsWon: dealsWonMap.get(account.accountId) || 0,
          dealsLost: dealsLostMap.get(account.accountId) || 0,
        })
      ),
    };

    res.json(response);
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { name, domain, owner, industry, location, summary } = req.body;

    if (!name || !name.trim()) {
      throw new AppError('Account name is required', 400);
    }

    const { account, created } = await AccountService.findOrCreate(
      {
        name: name.trim(),
        domain: domain?.trim(),
        owner: owner?.trim(),
        industry: industry?.trim(),
        location: location?.trim(),
      },
      true // updateIfExists: fill in missing fields
    );

    // Update summary separately (not part of AccountService.findOrCreate)
    const finalAccount = summary?.trim()
      ? await prisma.account.update({
          where: { accountId: account.accountId },
          data: {
            summary: summary.trim(),
            summaryUpdated: new Date(),
          },
        })
      : account;

    const response: ApiResponse = {
      success: true,
      data: serializeAccountSummary(
        {
          ...finalAccount,
          _count: { deals: 0, meetings: 0 },
        },
        { postCallCount: 0, proposalCount: 0, meetingsLast30: 0 }
      ),
    };

    res.status(created ? 201 : 200).json(response);
  })
);

router.get(
  '/:accountId',
  asyncHandler(async (req, res) => {
    const { accountId } = req.params;

    const account = await prisma.account.findUnique({
      where: { accountId },
      include: {
        deals: {
          orderBy: { updatedAt: 'desc' },
          include: {
            meetings: {
              orderBy: { meetingDate: 'desc' },
              take: 50, // Increased from 5 to show all meetings per deal
              include: {
                analysisJobs: {
                  orderBy: { createdAt: 'desc' },
                  take: 1,
                  include: {
                    pptJob: true,
                  },
                },
                deal: {
                  select: {
                    dealId: true,
                    opportunityName: true,
                  },
                },
              },
            },
          },
        },
        meetings: {
          orderBy: { meetingDate: 'desc' },
          take: 100, // Increased from 10 to show all meetings for account
          include: {
            analysisJobs: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: {
                pptJob: true,
              },
            },
            deal: {
              select: {
                dealId: true,
                opportunityName: true,
              },
            },
          },
        },
        _count: {
          select: {
            deals: true,
            meetings: true,
          },
        },
      },
    });

    if (!account) {
      throw new AppError('Account not found', 404);
    }

    const meetingSet = new Set<string>();
    account.meetings.forEach((meeting: any) => meetingSet.add(meeting.meetingId));
    account.deals.forEach((deal: any) => {
      deal.meetings.forEach((meeting: any) => meetingSet.add(meeting.meetingId));
    });
    const meetingIds = Array.from(meetingSet);

    const [transcriptByMeeting, proposalByMeeting, metrics] = await Promise.all([
      meetingIds.length
        ? prisma.transcriptAnalysis.findMany({
            where: { meetingId: { in: meetingIds } },
            select: { meetingId: true, status: true },
          })
        : [],
      meetingIds.length
        ? prisma.proposalJob.findMany({
            where: { meetingId: { in: meetingIds } },
            select: { meetingId: true, status: true },
          })
        : [],
      getAccountMetrics(account.accountId),
    ]);

    const transcriptMap = buildMeetingMetricMap(transcriptByMeeting as any);
    const proposalMap = buildMeetingMetricMap(proposalByMeeting as any);

    const deals = await Promise.all(
      account.deals.map(async (deal: any) => ({
        deal_id: deal.dealId,
        opportunity_name: deal.opportunityName,
        stage: deal.stage,
        status: deal.status,
        progress_percentage: deal.progressPercentage,
        estimated_value: deal.estimatedValue,
        updated_at: deal.updatedAt,
        meetings: await Promise.all(
          deal.meetings.map((meeting: any) =>
            serializeMeetingForAccount(meeting, {
              postCallDone: transcriptMap.get(meeting.meetingId) === 'completed',
              proposalGenerated: proposalMap.get(meeting.meetingId) === 'completed',
            })
          )
        ),
      }))
    );

    const meetings = await Promise.all(
      account.meetings.map((meeting: any) =>
        serializeMeetingForAccount(meeting, {
          postCallDone: transcriptMap.get(meeting.meetingId) === 'completed',
          proposalGenerated: proposalMap.get(meeting.meetingId) === 'completed',
        })
      )
    );

    const response: ApiResponse = {
      success: true,
      data: {
        ...serializeAccountSummary(account, metrics),
        deals,
        meetings,
      },
    };

    res.json(response);
  })
);

router.patch(
  '/:accountId',
  asyncHandler(async (req, res) => {
    const { accountId } = req.params;
    const updates: any = {};

    ['name', 'domain', 'owner', 'industry', 'location'].forEach((field) => {
      if (field in req.body) {
        const value = req.body[field];
        updates[field] = typeof value === 'string' ? value.trim() || null : value;
      }
    });

    if ('summary' in req.body) {
      const summaryValue =
        typeof req.body.summary === 'string' ? req.body.summary.trim() : req.body.summary;
      updates.summary = summaryValue || null;
      updates.summaryUpdated = summaryValue ? new Date() : null;
    }

    if (Object.keys(updates).length === 0) {
      throw new AppError('No account fields were provided for update', 400);
    }

    const account = await prisma.account.update({
      where: { accountId },
      data: updates,
      include: {
        _count: {
          select: { deals: true, meetings: true },
        },
      },
    });

    const metrics = await getAccountMetrics(accountId);

    const response: ApiResponse = {
      success: true,
      data: serializeAccountSummary(account, metrics),
    };

    res.json(response);
  })
);

async function getAccountMetrics(accountId: string) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [postCallCount, proposalCount, meetingsLast30, dealsWon, dealsLost] = await Promise.all([
    prisma.transcriptAnalysis.count({ where: { accountId } }),
    prisma.proposalJob.count({
      where: {
        meeting: {
          accountId,
        },
      },
    }),
    prisma.meeting.count({
      where: {
        accountId,
        meetingDate: { gte: thirtyDaysAgo },
      },
    }),
    prisma.deal.count({
      where: {
        accountId,
        status: { in: ['won', 'closed_won'] },
      },
    }),
    prisma.deal.count({
      where: {
        accountId,
        status: { in: ['lost', 'closed_lost'] },
      },
    }),
  ]);

  return {
    postCallCount,
    proposalCount,
    meetingsLast30,
    dealsWon,
    dealsLost,
  };
}

export default router;
