import { randomUUID } from 'crypto';
import { getPrismaClient } from '../config/database';

const prisma = getPrismaClient();

export interface OpportunitySyncParams {
  analysisId: string;
  rawAnalysis: any;
  dealId?: string | null;
  meetingId?: string | null;
}

export const extractOpportunityCandidates = (analysis: any): any[] => {
  if (!analysis || typeof analysis !== 'object') {
    return [];
  }

  const candidateLists = [
    analysis.opportunitiesDetected,
    analysis.opportunities,
    analysis.data?.opportunitiesDetected,
    analysis.data?.opportunities,
  ];

  for (const list of candidateLists) {
    if (Array.isArray(list) && list.length > 0) {
      return list;
    }
  }

  return [];
};

export const parseConfidenceScore = (value: any): number | null => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const numeric = parseFloat(value.replace(/[^0-9.]/g, ''));
    if (!Number.isNaN(numeric)) {
      return numeric <= 1 ? Math.round(numeric * 100) : numeric;
    }
  }
  return null;
};

export const normalizeOpportunityStatus = (status: any): string => {
  if (typeof status !== 'string' || !status.trim()) {
    return 'open';
  }
  return status.trim().toLowerCase();
};

export const deriveOpportunityTitle = (opportunity: any, index: number): string => {
  const titleFields = ['title', 'name', 'opportunity', 'headline', 'category'];
  for (const field of titleFields) {
    const value = opportunity?.[field];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  const description = opportunity?.description || opportunity?.summary;
  if (typeof description === 'string' && description.trim()) {
    const snippet = description.trim();
    return snippet.length > 80 ? `${snippet.slice(0, 77)}...` : snippet;
  }
  return `Opportunity ${index + 1}`;
};

export const deriveOpportunityDescription = (opportunity: any): string | null => {
  const descriptionFields = ['description', 'summary', 'notes', 'context'];
  for (const field of descriptionFields) {
    const value = opportunity?.[field];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
};

export const syncOpportunitiesFromAnalysis = async ({
  analysisId,
  rawAnalysis,
  dealId,
  meetingId,
}: OpportunitySyncParams) => {
  try {
    const candidates = extractOpportunityCandidates(rawAnalysis);
    await prisma.opportunity.deleteMany({ where: { transcriptAnalysisId: analysisId } });

    if (!candidates.length) {
      return;
    }

    let resolvedDealId = dealId ?? null;
    let resolvedMeetingId = meetingId ?? null;
    if (!resolvedDealId || !resolvedMeetingId) {
      const transcriptRecord = await prisma.transcriptAnalysis.findUnique({
        where: { analysisId },
        select: { dealId: true, meetingId: true },
      });
      resolvedDealId = resolvedDealId ?? transcriptRecord?.dealId ?? null;
      resolvedMeetingId = resolvedMeetingId ?? transcriptRecord?.meetingId ?? null;
    }

    const rows = candidates
      .map((candidate, index) => {
        const rawConfidence =
          candidate?.confidence ??
          candidate?.confidenceScore ??
          candidate?.score ??
          candidate?.probability ??
          candidate?.opportunityScore ??
          candidate?.likelihood;
        const confidenceScore = parseConfidenceScore(rawConfidence);
        const title = deriveOpportunityTitle(candidate, index);
        const description = deriveOpportunityDescription(candidate);
        return {
          opportunityId: randomUUID(),
          dealId: resolvedDealId,
          meetingId: resolvedMeetingId,
          transcriptAnalysisId: analysisId,
          title,
          description,
          confidenceScore,
          status: normalizeOpportunityStatus(candidate?.status),
          source: candidate?.source || 'post_call_analysis',
          details: candidate,
        };
      })
      .filter((row) => row.title || row.description);

    if (!rows.length) {
      return;
    }

    await prisma.opportunity.createMany({ data: rows });
    console.log(
      `📈 Added ${rows.length} opportunity${rows.length === 1 ? '' : 'ies'} from analysis ${analysisId} (deal: ${resolvedDealId || 'unlinked'})`
    );
  } catch (error: any) {
    console.error(
      `⚠️ Failed to sync opportunities from analysis ${analysisId}: ${error?.message || error}`,
      error
    );
  }
};
