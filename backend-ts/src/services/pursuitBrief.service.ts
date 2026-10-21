import { randomUUID } from 'crypto';
import { getPrismaClient } from '../config/database';
import { AppError } from '../middleware/errorHandler';

const prisma = getPrismaClient();

export const PURSUIT_BRIEF_QUESTIONS: Record<string, string> = {
  '1': 'Who is the buyer and who are the key stakeholders?',
  '2': 'What problem is the client trying to solve?',
  '3': 'What goals and outcomes do they expect?',
  '4': 'Why now? What is driving urgency?',
  '5': 'What challenges could block success?',
  '6': 'What do they seek in a partner?',
  '7': 'What is the procurement process?',
  '8': 'Who are the likely competitors?',
  '9': 'Why would the client choose us?',
  '10': 'What could make them walk away?',
  '11': 'What is our vision for their future state?',
  '12': 'What are the core elements of our solution?',
  '13': 'What assumptions are we making?',
  '14': 'What are our win themes?',
  '15': 'What is our storyline?',
  '16': 'What demos or artifacts reinforce the story?',
};

export const PURSUIT_BRIEF_KEYS = Object.keys(PURSUIT_BRIEF_QUESTIONS);

export const normalizePursuitBriefAnswers = (answers: Record<string, unknown>): Record<string, string> => {
  const normalized: Record<string, string> = {};
  if (!answers || typeof answers !== 'object') {
    return normalized;
  }

  for (const key of PURSUIT_BRIEF_KEYS) {
    const rawValue = (answers as Record<string, unknown>)[key];
    if (rawValue === undefined || rawValue === null) {
      continue;
    }
    if (typeof rawValue === 'string') {
      const trimmed = rawValue.trim();
      if (trimmed.length > 0) {
        normalized[key] = trimmed;
      }
    } else {
      normalized[key] = JSON.stringify(rawValue);
    }
  }

  return normalized;
};

type PursuitBriefUpdateResult = {
  id: string;
  completeness: number;
  status: string;
  linked_transcripts: string[];
  transcript_answers: Record<string, string>;
};

export async function applyTranscriptToPursuitBrief(
  briefId: string,
  transcriptId: string
): Promise<PursuitBriefUpdateResult> {
  let brief: any = await prisma.$queryRaw`
    SELECT * FROM pursuit_briefs WHERE id = ${briefId} LIMIT 1
  `;
  brief = brief[0];

  if (!brief) {
    throw new AppError('Pursuit brief not found', 404);
  }

  const transcript = await prisma.transcriptAnalysis.findUnique({
    where: { analysisId: transcriptId },
  });

  if (!transcript) {
    throw new AppError('Transcript analysis not found', 404);
  }

  // Check idempotency - if transcript already applied, return current state
  const linkedTranscripts = JSON.parse(brief.linked_transcripts || '[]');
  const alreadyApplied = linkedTranscripts.includes(transcriptId);

  if (alreadyApplied) {
    console.log(`ℹ️ Transcript ${transcriptId} already applied to brief ${briefId}, skipping`);
    return {
      id: briefId,
      completeness: brief.completeness || 0,
      status: brief.status || 'draft',
      linked_transcripts: linkedTranscripts,
      transcript_answers: JSON.parse(brief.transcript_answers || '{}'),
    };
  }

  const parsedAnalysis = (() => {
    if (!transcript.analysisResult) {
      return {};
    }
    try {
      return JSON.parse(transcript.analysisResult);
    } catch (error) {
      console.warn('⚠️ Failed to parse transcript analysis JSON', error);
      return {};
    }
  })();

  const analysisDetails: Record<string, unknown> =
    (parsedAnalysis?.data as Record<string, unknown>) ||
    (parsedAnalysis as Record<string, unknown>) ||
    {};
  const getAnalysisValue = (...keys: string[]) => {
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(analysisDetails, key)) {
        return analysisDetails[key];
      }
    }
    return undefined;
  };
  const formatAnalysisValue = (value: unknown, fallback: string) => {
    if (value === null || value === undefined) {
      return fallback;
    }
    return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  };

  const pursuitBriefAnswersRaw =
    getAnalysisValue('pursuitBrief', 'pursuit_brief') || {};
  const transcriptAnswersRaw =
    typeof pursuitBriefAnswersRaw === 'string'
      ? (() => {
          try {
            return JSON.parse(pursuitBriefAnswersRaw);
          } catch {
            return {};
          }
        })()
      : pursuitBriefAnswersRaw || {};
  const newTranscriptAnswers = normalizePursuitBriefAnswers(transcriptAnswersRaw || {});

  // Merge new answers with existing transcript_answers (new answers fill gaps, don't overwrite)
  const existingTranscriptAnswers = JSON.parse(brief.transcript_answers || '{}');
  const mergedTranscriptAnswers: Record<string, string> = { ...existingTranscriptAnswers };
  for (const key of PURSUIT_BRIEF_KEYS) {
    // Only add new answers if existing is empty/missing
    if (newTranscriptAnswers[key] && !mergedTranscriptAnswers[key]) {
      mergedTranscriptAnswers[key] = newTranscriptAnswers[key];
    }
  }

  const keyInsights = formatAnalysisValue(
    getAnalysisValue('keyInsights', 'summary'),
    'No insights available'
  );
  const painPoints = formatAnalysisValue(
    getAnalysisValue('painPoints', 'pain_points', 'painpoints'),
    'None identified'
  );
  const nextSteps = formatAnalysisValue(
    getAnalysisValue('nextSteps', 'next_steps'),
    'None defined'
  );
  const actionItems = formatAnalysisValue(
    getAnalysisValue('actionItems', 'action_items'),
    'None assigned'
  );

  let currentContent = brief.content || '';
  const transcriptInsights = `

## Post-Call Analysis Insights

### Meeting: ${transcript.meetingTitle || 'Untitled Meeting'}
*Analyzed: ${transcript.analyzedAt?.toISOString() || 'Unknown'}*

**Sentiment:** ${transcript.sentimentOverall || 'N/A'}
**Opportunity Score:** ${transcript.opportunityScore || 'N/A'} / 100
**Success Probability:** ${transcript.successProbability ? Math.round(transcript.successProbability * 100) + '%' : 'N/A'}

### Key Insights
${keyInsights}

### Pain Points Discussed
${painPoints}

### Next Steps
${nextSteps}

### Action Items
${actionItems}

---
`;

  const updatedContent = currentContent + transcriptInsights;

  // Add to linked transcripts
  linkedTranscripts.push(transcriptId);

  // Calculate completeness based on how many pursuit brief questions have answers
  // Each answered question contributes ~6% (16 questions total = ~100%)
  const answeredCount = Object.keys(mergedTranscriptAnswers).filter(
    key => PURSUIT_BRIEF_KEYS.includes(key) && mergedTranscriptAnswers[key]
  ).length;
  const answerBasedCompleteness = Math.round((answeredCount / PURSUIT_BRIEF_KEYS.length) * 100);

  // Also factor in content length (up to 20% bonus)
  const contentLengthBonus = Math.min(20, Math.round((updatedContent.length / 5000) * 20));

  // Final completeness: answer coverage (80%) + content bonus (20%)
  const completeness = Math.min(100, Math.round(answerBasedCompleteness * 0.8 + contentLengthBonus));

  let status = brief.status || 'in_progress';
  if (completeness >= 90) status = 'ready_for_proposal';
  else if (completeness >= 50) status = 'in_progress';
  else status = 'draft';

  const updatedAt = new Date().toISOString();
  await prisma.$executeRaw`
      UPDATE pursuit_briefs
      SET content = ${updatedContent},
          linked_transcripts = ${JSON.stringify(linkedTranscripts)},
          completeness = ${completeness},
          status = ${status},
          transcript_answers = ${JSON.stringify(mergedTranscriptAnswers)},
          meeting_id = ${transcript.meetingId || null},
          updated_at = ${updatedAt}
      WHERE id = ${briefId}
    `;

  if (Object.keys(newTranscriptAnswers).length > 0) {
    const snapshotId = randomUUID();
    await prisma.pursuitBriefSnapshot.create({
      data: {
        snapshotId,
        dealId: brief.deal_id,
        meetingId: transcript.meetingId || null,
        transcriptAnalysisId: transcript.analysisId,
        questionAnswers: newTranscriptAnswers,
        source: 'transcript',
        createdAt: new Date(updatedAt),
        updatedAt: new Date(updatedAt),
      },
    });
  }

  console.log(`✅ Applied transcript ${transcriptId} to brief ${briefId}: ${completeness}% complete, ${Object.keys(newTranscriptAnswers).length} new answers`);

  return {
    id: briefId,
    completeness,
    status,
    linked_transcripts: linkedTranscripts,
    transcript_answers: mergedTranscriptAnswers,
  };
}

/**
 * Ensure a pursuit brief exists for the given deal and update it with transcript insights.
 * This mirrors the logic previously embedded in transcripts.routes to keep behavior consistent
 * across manual transcript uploads and the automated analysis workflow.
 */
export async function updatePursuitBriefFromTranscript(
  dealId: string | null | undefined,
  transcriptId: string
): Promise<void> {
  if (!dealId) {
    console.log('⚠️ No dealId provided, skipping pursuit brief update');
    return;
  }

  try {
    let brief: any = await prisma.$queryRaw`
      SELECT * FROM pursuit_briefs WHERE deal_id = ${dealId} LIMIT 1
    `;
    brief = brief[0];

    let briefId: string;

    if (!brief) {
      briefId = randomUUID();
      const now = new Date().toISOString();
      await prisma.$executeRaw`
        INSERT INTO pursuit_briefs
        (id, deal_id, created_at, updated_at, status, completeness, content, linked_research_sessions, linked_transcripts)
        VALUES (
          ${briefId},
          ${dealId},
          ${now},
          ${now},
          ${'draft'},
          ${0},
          ${''},
          ${'[]'},
          ${'[]'}
        )
      `;
      console.log(`✅ Created new pursuit brief ${briefId} for deal ${dealId}`);
    } else {
      briefId = brief.id;
    }

    await applyTranscriptToPursuitBrief(briefId, transcriptId);
    console.log(`✅ Pursuit brief ${briefId} updated from transcript ${transcriptId}`);
  } catch (error) {
    console.error('Error in updatePursuitBriefFromTranscript:', error);
  }
}
