import { Router, Request, Response } from 'express';
import { getPrismaClient } from '../config/database';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { ApiResponse } from '../types';
import { randomUUID } from 'crypto';
import { getOpenAIService } from '../services/openai.service';
import {
  applyTranscriptToPursuitBrief,
  normalizePursuitBriefAnswers,
  PURSUIT_BRIEF_KEYS,
  PURSUIT_BRIEF_QUESTIONS,
} from '../services/pursuitBrief.service';

const router = Router();
const prisma = getPrismaClient();
const openai = getOpenAIService();

/**
 * Initialize pursuit_briefs table and run migrations
 */
const initTable = async () => {
  try {
    // Create table if it doesn't exist
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS pursuit_briefs (
        id TEXT PRIMARY KEY,
        deal_id TEXT NOT NULL,
        meeting_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        status TEXT NOT NULL,
        completeness INTEGER NOT NULL DEFAULT 0,
        linked_research_sessions TEXT,
        linked_transcripts TEXT,
        linked_case_studies TEXT,
        FOREIGN KEY (deal_id) REFERENCES deals(deal_id),
        FOREIGN KEY (meeting_id) REFERENCES meetings(meeting_id)
      )
    `;

    // Migration: Add content column if it doesn't exist
    try {
      await prisma.$executeRaw`
        ALTER TABLE pursuit_briefs ADD COLUMN content TEXT NOT NULL DEFAULT ''
      `;
      console.log('✅ Added content column to pursuit_briefs table');
    } catch (error: any) {
      // Column already exists, ignore error
      if (!error.message?.includes('duplicate column name')) {
        console.log('ℹ️ Content column already exists in pursuit_briefs table');
      }
    }

    // Migration: Add question_answers column if it doesn't exist
    try {
      await prisma.$executeRaw`
        ALTER TABLE pursuit_briefs ADD COLUMN question_answers TEXT NOT NULL DEFAULT '{}'
      `;
      console.log('✅ Added question_answers column to pursuit_briefs table');
    } catch (error: any) {
      if (!error.message?.includes('duplicate column name')) {
        console.log('ℹ️ question_answers column already exists in pursuit_briefs table');
      }
    }

    // Migration: Add transcript_answers column if it doesn't exist
    try {
      await prisma.$executeRaw`
        ALTER TABLE pursuit_briefs ADD COLUMN transcript_answers TEXT NOT NULL DEFAULT '{}'
      `;
      console.log('✅ Added transcript_answers column to pursuit_briefs table');
    } catch (error: any) {
      if (!error.message?.includes('duplicate column name')) {
        console.log('ℹ️ transcript_answers column already exists in pursuit_briefs table');
      }
    }

    // Migration: Add meeting_id column if it doesn't exist
    try {
      await prisma.$executeRaw`
        ALTER TABLE pursuit_briefs ADD COLUMN meeting_id TEXT
      `;
      console.log('✅ Added meeting_id column to pursuit_briefs table');
    } catch (error: any) {
      if (!error.message?.includes('duplicate column name')) {
        console.log('ℹ️ meeting_id column already exists in pursuit_briefs table');
      }
    }

    // Ensure pursuit_brief_snapshots table exists
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS pursuit_brief_snapshots (
        snapshot_id TEXT PRIMARY KEY,
        deal_id TEXT NOT NULL REFERENCES deals(deal_id),
        meeting_id TEXT REFERENCES meetings(meeting_id),
        transcript_analysis_id TEXT REFERENCES transcript_analyses(analysis_id),
        question_answers JSONB NOT NULL DEFAULT '{}'::jsonb,
        source TEXT NOT NULL DEFAULT 'transcript',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
  } catch (error) {
    console.error('Error initializing pursuit_briefs table:', error);
  }
};

initTable();

/**
 * GET /api/pursuit-brief/deal/:dealId
 * Get or create pursuit brief for a deal
 */
router.get(
  '/deal/:dealId',
  asyncHandler(async (req: Request, res: Response) => {
    const { dealId } = req.params;

    let brief: any = await prisma.$queryRaw`
      SELECT * FROM pursuit_briefs WHERE deal_id = ${dealId} LIMIT 1
    `;

    brief = brief[0];

    if (!brief) {
      // Create new empty brief
      const id = randomUUID();
      const now = new Date().toISOString();

      await prisma.$executeRaw`
        INSERT INTO pursuit_briefs
        (id, deal_id, meeting_id, created_at, updated_at, status, completeness, content, linked_research_sessions, linked_transcripts, question_answers, transcript_answers)
        VALUES (
          ${id},
          ${dealId},
          ${null},
          ${now},
          ${now},
          ${'draft'},
          ${0},
          ${''},
          ${'[]'},
          ${'[]'},
          ${'{}'},
          ${'{}'}
        )
      `;

      brief = {
        id,
        deal_id: dealId,
        meeting_id: null,
        created_at: now,
        updated_at: now,
        status: 'draft',
        completeness: 0,
        content: '',
        linked_research_sessions: [],
        linked_transcripts: [],
        question_answers: {},
        transcript_answers: {},
      };
    } else {
      // Parse JSON fields
      brief.linked_research_sessions = JSON.parse(brief.linked_research_sessions || '[]');
      brief.linked_transcripts = JSON.parse(brief.linked_transcripts || '[]');
      brief.question_answers = JSON.parse(brief.question_answers || '{}');
      brief.transcript_answers = JSON.parse(brief.transcript_answers || '{}');
    }

    const snapshots = await prisma.pursuitBriefSnapshot.findMany({
      where: { dealId },
      orderBy: { createdAt: 'desc' },
      take: 25,
    });

    const normalizedSnapshots = snapshots.map((snapshot: any) => {
      const answers =
        typeof snapshot.questionAnswers === 'string'
          ? (() => {
              try {
                return JSON.parse(snapshot.questionAnswers);
              } catch {
                return {};
              }
            })()
          : snapshot.questionAnswers || {};

      return {
        snapshot_id: snapshot.snapshotId,
        deal_id: snapshot.dealId,
        meeting_id: snapshot.meetingId,
        transcript_analysis_id: snapshot.transcriptAnalysisId,
        source: snapshot.source,
        created_at: snapshot.createdAt,
        updated_at: snapshot.updatedAt,
        question_answers: answers,
      };
    });

    if (!brief.transcript_answers || Object.keys(brief.transcript_answers).length === 0) {
      const latestSnapshotWithAnswers = normalizedSnapshots.find(
        (snapshot: any) =>
          snapshot.question_answers && Object.keys(snapshot.question_answers).length > 0
      );
      if (latestSnapshotWithAnswers) {
        brief.transcript_answers = latestSnapshotWithAnswers.question_answers;
        if (!brief.meeting_id) {
          brief.meeting_id = latestSnapshotWithAnswers.meeting_id || null;
        }
      }
    }

    const response: ApiResponse = {
      success: true,
      data: {
        ...brief,
        snapshots: normalizedSnapshots,
      },
    };
    res.json(response);
  })
);

/**
 * POST /api/pursuit-brief/:briefId/update-from-research
 * Update pursuit brief from research session
 */
router.post(
  '/:briefId/update-from-research',
  asyncHandler(async (req: Request, res: Response) => {
    const { briefId } = req.params;
    const { research_session_id } = req.body;

    // Get brief
    let brief: any = await prisma.$queryRaw`
      SELECT * FROM pursuit_briefs WHERE id = ${briefId} LIMIT 1
    `;
    brief = brief[0];

    if (!brief) {
      throw new AppError('Pursuit brief not found', 404);
    }

    // Get research analysis
    const analysis = await prisma.analysis.findUnique({
      where: { sessionId: research_session_id },
    });

    if (!analysis || !analysis.result) {
      throw new AppError('Research analysis not found', 404);
    }

    const result = typeof analysis.result === 'string' ? JSON.parse(analysis.result) : analysis.result;

    // Generate pursuit brief content from research
    const briefContent = `# Pursuit Brief - ${analysis.companyName}

## Executive Summary
${result.executive_summary || 'No summary available'}

## Company Analysis
${result.company_analysis ? JSON.stringify(result.company_analysis, null, 2) : 'No analysis available'}

## Sales Opportunities
${result.sales_opportunities || 'No opportunities identified'}

## Recommended Action Plan
${result.action_plan || 'No action plan available'}

## Discovery Questions
${result.questionnaire || 'No questions available'}

---
*Last Updated: ${new Date().toISOString()}*
*Source: Research Session ${research_session_id}*
`;

    // Update linked research
    const linkedResearch = JSON.parse(brief.linked_research_sessions || '[]');
    if (!linkedResearch.includes(research_session_id)) {
      linkedResearch.push(research_session_id);
    }

    // Calculate completeness based on content length
    const completeness = Math.min(90, Math.round((briefContent.length / 5000) * 100));

    // Update status
    let status = 'draft';
    if (completeness > 30) status = 'in_progress';
    if (completeness > 70) status = 'ready_for_review';

    // Save updated brief
    const updatedAt = new Date().toISOString();
    await prisma.$executeRaw`
      UPDATE pursuit_briefs
      SET content = ${briefContent},
          linked_research_sessions = ${JSON.stringify(linkedResearch)},
          completeness = ${completeness},
          status = ${status},
          updated_at = ${updatedAt}
      WHERE id = ${briefId}
    `;

    const response: ApiResponse = {
      success: true,
      data: {
        id: briefId,
        completeness,
        status,
        content: briefContent,
        linked_research_sessions: linkedResearch,
      },
      message: 'Pursuit brief updated from research',
    };

    res.json(response);
  })
);

/**
 * POST /api/pursuit-brief/:briefId/update-from-transcript
 * Update pursuit brief from post-call analysis
 */
router.post(
  '/:briefId/update-from-transcript',
  asyncHandler(async (req: Request, res: Response) => {
    const { briefId } = req.params;
    const { transcript_id } = req.body;

    const updateResult = await applyTranscriptToPursuitBrief(briefId, transcript_id);

    const response: ApiResponse = {
      success: true,
      data: updateResult,
      message: 'Pursuit brief updated from post-call analysis',
    };

    res.json(response);
  })
);

/**
 * PUT /api/pursuit-brief/:briefId/content
 * Manually update pursuit brief content
 */
router.put(
  '/:briefId/content',
  asyncHandler(async (req: Request, res: Response) => {
    const { briefId } = req.params;
    const { content } = req.body;

    if (!content) {
      throw new AppError('Content is required', 400);
    }

    // Calculate completeness
    const completeness = Math.min(100, Math.round((content.length / 5000) * 100));

    // Update status
    let status = 'draft';
    if (completeness > 30) status = 'in_progress';
    if (completeness > 70) status = 'ready_for_review';
    if (completeness >= 90) status = 'ready_for_proposal';

    const updatedAt = new Date().toISOString();
    await prisma.$executeRaw`
      UPDATE pursuit_briefs
      SET content = ${content},
          completeness = ${completeness},
          status = ${status},
          updated_at = ${updatedAt}
      WHERE id = ${briefId}
    `;

    const response: ApiResponse = {
      success: true,
      data: {
        id: briefId,
        completeness,
        status,
      },
      message: 'Pursuit brief updated',
    };

    res.json(response);
  })
);

router.get(
  '/deal/:dealId/snapshots',
  asyncHandler(async (req: Request, res: Response) => {
    const { dealId } = req.params;

    const snapshots: any[] = await prisma.$queryRaw`
      SELECT
        s.snapshot_id,
        s.deal_id,
        s.meeting_id,
        s.transcript_analysis_id,
        s.question_answers,
        s.source,
        s.created_at,
        s.updated_at,
        m.title AS meeting_title,
        t.meeting_title AS transcript_title
      FROM pursuit_brief_snapshots s
      LEFT JOIN meetings m ON m.meeting_id = s.meeting_id
      LEFT JOIN transcript_analyses t ON t.analysis_id = s.transcript_analysis_id
      WHERE s.deal_id = ${dealId}
      ORDER BY s.created_at DESC
      LIMIT 200
    `;

    const data = snapshots.map((snapshot) => {
      let answers: Record<string, any> = {};
      if (!snapshot.question_answers) {
        answers = {};
      } else if (typeof snapshot.question_answers === 'string') {
        try {
          answers = JSON.parse(snapshot.question_answers);
        } catch {
          answers = {};
        }
      } else {
        answers = snapshot.question_answers;
      }

      const responses = PURSUIT_BRIEF_KEYS.map((key) => ({
        questionKey: key,
        questionText: PURSUIT_BRIEF_QUESTIONS[key],
        answer: answers[key] || null,
      }));

      return {
        snapshot_id: snapshot.snapshot_id,
        deal_id: snapshot.deal_id,
        meeting_id: snapshot.meeting_id,
        transcript_analysis_id: snapshot.transcript_analysis_id,
        source: snapshot.source,
        created_at: snapshot.created_at,
        updated_at: snapshot.updated_at,
        meeting_title: snapshot.meeting_title || null,
        transcript_title: snapshot.transcript_title || null,
        responses,
      };
    });

    const response: ApiResponse = {
      success: true,
      data,
    };

    res.json(response);
  })
);

/**
 * PUT /api/pursuit-brief/:briefId/answers
 * Update pursuit brief question answers
 */
router.put(
  '/:briefId/answers',
  asyncHandler(async (req: Request, res: Response) => {
    const { briefId } = req.params;
    const { question_answers } = req.body;

    if (!question_answers || typeof question_answers !== 'object') {
      throw new AppError('question_answers is required', 400);
    }

    const existing = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM pursuit_briefs WHERE id = ${briefId} LIMIT 1
    `;

    if (!existing || !existing[0]) {
      throw new AppError('Pursuit brief not found', 404);
    }

    const updatedAt = new Date().toISOString();
    await prisma.$executeRaw`
      UPDATE pursuit_briefs
      SET question_answers = ${JSON.stringify(question_answers)},
          status = ${'in_progress'},
          updated_at = ${updatedAt}
      WHERE id = ${briefId}
    `;

    const response: ApiResponse = {
      success: true,
      data: {
        id: briefId,
        question_answers,
      },
      message: 'Pursuit brief answers updated',
    };

    res.json(response);
  })
);

/**
 * DELETE /api/pursuit-brief/:briefId
 * Delete a pursuit brief
 */
router.delete(
  '/:briefId',
  asyncHandler(async (req: Request, res: Response) => {
    const { briefId } = req.params;

    await prisma.$executeRaw`
      DELETE FROM pursuit_briefs WHERE id = ${briefId}
    `;

    const response: ApiResponse = {
      success: true,
      message: 'Pursuit brief deleted',
    };

    res.json(response);
  })
);

export default router;
