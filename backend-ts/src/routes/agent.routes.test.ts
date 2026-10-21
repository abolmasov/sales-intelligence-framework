/**
 * Tests for Agent Hub routes -- /api/agents
 *
 * Covers:
 *  - GET  /api/agents                    (list all agents)
 *  - POST /api/agents/:id/run            (trigger agent run)
 *  - GET  /api/agents/runs/:jobId/status (poll job status)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';

// ── Inline mock Prisma (cannot use require inside vi.mock factory) ──────────
const createModel = () => ({
  findUnique: vi.fn().mockResolvedValue(null),
  findFirst: vi.fn().mockResolvedValue(null),
  findMany: vi.fn().mockResolvedValue([]),
  create: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'mock-id', ...data })),
  update: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'mock-id', ...data })),
  upsert: vi.fn().mockImplementation(({ create }: any) => Promise.resolve(create)),
  delete: vi.fn().mockResolvedValue({}),
  deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  count: vi.fn().mockResolvedValue(0),
  groupBy: vi.fn().mockResolvedValue([]),
});

const mp: Record<string, any> = {
  workspace: createModel(),
  meeting: createModel(),
  meetingAnalysisJob: createModel(),
  analysis: createModel(),
  discoverySession: createModel(),
};

vi.mock('../config/database', () => ({
  getPrismaClient: () => mp,
  default: () => mp,
}));

// ── Service mocks ───────────────────────────────────────────────────────────

vi.mock('../services/logger.service', () => ({
  getLoggerService: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    http: vi.fn(),
  }),
}));

vi.mock('../services/workspace.service', () => ({
  processWorkspacePipeline: vi.fn().mockResolvedValue(undefined),
  cancelWorkspacePipeline: vi.fn(),
}));

vi.mock('../services/analysisWorkflowJob.service', () => ({
  processAnalysisWorkflowJob: vi.fn().mockResolvedValue(undefined),
}));

const mockGetBulkJobStatus = vi.fn().mockResolvedValue(null);
const mockCreateBulkAnalysisJob = vi.fn().mockResolvedValue({ bulkJobId: 'bulk-123' });
const mockProcessBulkAnalysisJob = vi.fn().mockResolvedValue(undefined);

vi.mock('../services/bulkAnalysisJob.service', () => ({
  createBulkAnalysisJob: mockCreateBulkAnalysisJob,
  processBulkAnalysisJob: mockProcessBulkAnalysisJob,
  getBulkJobStatus: mockGetBulkJobStatus,
}));

vi.mock('../services/research.service', () => ({
  getResearchService: () => ({
    runResearchPipeline: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('../services/discovery.service', () => ({
  getDiscoveryService: () => ({
    chat: vi.fn().mockResolvedValue({ response: 'test' }),
  }),
}));

// ── Imports that work as normal imports ─────────────────────────────────────

import { authHeader, mockMeeting, mockWorkspace } from '../test/mocks';
import { authMiddleware } from '../middleware/auth';
import { errorHandler } from '../middleware/errorHandler';

// ── App builder ─────────────────────────────────────────────────────────────

async function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(authMiddleware);
  const routes = (await import('./agent.routes')).default;
  app.use('/api/agents', routes);
  app.use(errorHandler);
  return app;
}

// ── Test setup ──────────────────────────────────────────────────────────────

let app: express.Application;

beforeEach(async () => {
  // Reset all mock call history between tests
  for (const model of Object.values(mp)) {
    if (model && typeof model === 'object') {
      for (const fn of Object.values(model)) {
        if (typeof fn === 'function' && 'mockClear' in fn) {
          (fn as any).mockClear();
        }
      }
    }
  }
  mockGetBulkJobStatus.mockClear();
  mockGetBulkJobStatus.mockResolvedValue(null);
  mockCreateBulkAnalysisJob.mockClear();
  mockCreateBulkAnalysisJob.mockResolvedValue({ bulkJobId: 'bulk-123' });

  app = await buildApp();
});

// ===========================================================================
// GET /api/agents -- List all agents
// ===========================================================================

describe('GET /api/agents', () => {
  it('returns all 9 agents from AGENT_METADATA with success: true', async () => {
    mp.meetingAnalysisJob.groupBy.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/agents')
      .set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.agents).toHaveLength(9);
    expect(res.body.data.summary.total).toBe(9);
    expect(res.body.data.summary.running).toBe(0);

    // Verify each agent has required fields
    for (const agent of res.body.data.agents) {
      expect(agent).toHaveProperty('id');
      expect(agent).toHaveProperty('name');
      expect(agent).toHaveProperty('description');
      expect(agent).toHaveProperty('category');
      expect(agent).toHaveProperty('status', 'available');
    }
  });

  it('computes running job count from groupBy results', async () => {
    mp.meetingAnalysisJob.groupBy.mockResolvedValue([
      { status: 'queued', _count: 2 },
      { status: 'running', _count: 3 },
    ]);

    const res = await request(app)
      .get('/api/agents')
      .set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data.summary.running).toBe(5);
  });

  it('returns known agent ids', async () => {
    mp.meetingAnalysisJob.groupBy.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/agents')
      .set(authHeader());

    const ids = res.body.data.agents.map((a: any) => a.id);
    expect(ids).toContain('transcript-analysis');
    expect(ids).toContain('pre-call-research');
    expect(ids).toContain('proposal-generation');
    expect(ids).toContain('pptx-generation');
    expect(ids).toContain('discovery');
    expect(ids).toContain('workshop-analysis');
    expect(ids).toContain('user-story-generation');
    expect(ids).toContain('workshop-prep');
    expect(ids).toContain('bulk-analysis');
  });
});

// ===========================================================================
// POST /api/agents/:id/run -- Trigger agent run
// ===========================================================================

describe('POST /api/agents/:id/run', () => {
  // ── Auth & validation ────────────────────────────────────────────────

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/agents/transcript-analysis/run')
      .send({ meetingId: 'mtg-1' });

    expect(res.status).toBe(401);
  });

  it('returns 404 for unknown agent', async () => {
    const res = await request(app)
      .post('/api/agents/nonexistent-agent/run')
      .set(authHeader())
      .send({});

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('Unknown agent');
  });

  // ── Transcript analysis ──────────────────────────────────────────────

  describe('transcript-analysis', () => {
    it('returns 400 without meetingId', async () => {
      const res = await request(app)
        .post('/api/agents/transcript-analysis/run')
        .set(authHeader())
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('meetingId');
    });

    it('returns 404 when meeting not found', async () => {
      mp.meeting.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/agents/transcript-analysis/run')
        .set(authHeader())
        .send({ meetingId: 'nonexistent' });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('Meeting not found');
    });

    it('returns 400 when meeting has no transcript', async () => {
      mp.meeting.findUnique.mockResolvedValue(
        mockMeeting({ transcript: null })
      );

      const res = await request(app)
        .post('/api/agents/transcript-analysis/run')
        .set(authHeader())
        .send({ meetingId: 'mtg-test-123' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('no transcript');
    });

    it('returns 409 when active job exists', async () => {
      mp.meeting.findUnique.mockResolvedValue(mockMeeting());
      mp.meetingAnalysisJob.findFirst.mockResolvedValue({
        jobId: 'existing-job',
        status: 'running',
      });

      const res = await request(app)
        .post('/api/agents/transcript-analysis/run')
        .set(authHeader())
        .send({ meetingId: 'mtg-test-123' });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('already running');
    });

    it('succeeds and returns jobId', async () => {
      mp.meeting.findUnique.mockResolvedValue(mockMeeting());
      mp.meetingAnalysisJob.findFirst.mockResolvedValue(null);
      mp.meetingAnalysisJob.create.mockResolvedValue({
        jobId: 'job-uuid-123',
        meetingId: 'mtg-test-123',
        status: 'queued',
      });

      const res = await request(app)
        .post('/api/agents/transcript-analysis/run')
        .set(authHeader())
        .send({ meetingId: 'mtg-test-123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.jobId).toBe('job-uuid-123');
      expect(res.body.data.agentId).toBe('transcript-analysis');
      expect(res.body.data.agentName).toBe('Transcript Analyzer');
      expect(res.body.data.jobType).toBe('meeting-analysis');
      expect(res.body.data.status).toBe('queued');
    });
  });

  // ── Proposal generation ──────────────────────────────────────────────

  describe('proposal-generation', () => {
    it('returns 400 without meetingId', async () => {
      const res = await request(app)
        .post('/api/agents/proposal-generation/run')
        .set(authHeader())
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('meetingId');
    });

    it('returns 404 when meeting not found', async () => {
      mp.meeting.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/agents/proposal-generation/run')
        .set(authHeader())
        .send({ meetingId: 'nope' });

      expect(res.status).toBe(404);
    });

    it('returns 400 when meeting has no transcript', async () => {
      mp.meeting.findUnique.mockResolvedValue(mockMeeting({ transcript: null }));

      const res = await request(app)
        .post('/api/agents/proposal-generation/run')
        .set(authHeader())
        .send({ meetingId: 'mtg-test-123' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('no transcript');
    });

    it('returns 409 when active job exists', async () => {
      mp.meeting.findUnique.mockResolvedValue(mockMeeting());
      mp.meetingAnalysisJob.findFirst.mockResolvedValue({ jobId: 'j1', status: 'queued' });

      const res = await request(app)
        .post('/api/agents/proposal-generation/run')
        .set(authHeader())
        .send({ meetingId: 'mtg-test-123' });

      expect(res.status).toBe(409);
    });

    it('succeeds and creates job with runProposal=true', async () => {
      mp.meeting.findUnique.mockResolvedValue(mockMeeting());
      mp.meetingAnalysisJob.findFirst.mockResolvedValue(null);
      mp.meetingAnalysisJob.create.mockResolvedValue({
        jobId: 'proposal-job-1',
        status: 'queued',
      });

      const res = await request(app)
        .post('/api/agents/proposal-generation/run')
        .set(authHeader())
        .send({ meetingId: 'mtg-test-123' });

      expect(res.status).toBe(200);
      expect(res.body.data.jobId).toBe('proposal-job-1');
      expect(res.body.data.agentId).toBe('proposal-generation');
      expect(res.body.data.jobType).toBe('meeting-analysis');

      // Verify create was called with runProposal: true
      const createCall = mp.meetingAnalysisJob.create.mock.calls[0][0];
      expect(createCall.data.runProposal).toBe(true);
      expect(createCall.data.runTranscript).toBe(true);
      expect(createCall.data.runPpt).toBe(false);
    });
  });

  // ── PPTX generation ──────────────────────────────────────────────────

  describe('pptx-generation', () => {
    it('returns 400 without meetingId', async () => {
      const res = await request(app)
        .post('/api/agents/pptx-generation/run')
        .set(authHeader())
        .send({});

      expect(res.status).toBe(400);
    });

    it('succeeds and creates job with full pipeline flags', async () => {
      mp.meeting.findUnique.mockResolvedValue(mockMeeting());
      mp.meetingAnalysisJob.findFirst.mockResolvedValue(null);
      mp.meetingAnalysisJob.create.mockResolvedValue({
        jobId: 'pptx-job-1',
        status: 'queued',
      });

      const res = await request(app)
        .post('/api/agents/pptx-generation/run')
        .set(authHeader())
        .send({ meetingId: 'mtg-test-123' });

      expect(res.status).toBe(200);
      expect(res.body.data.jobId).toBe('pptx-job-1');
      expect(res.body.data.agentId).toBe('pptx-generation');

      const createCall = mp.meetingAnalysisJob.create.mock.calls[0][0];
      expect(createCall.data.runTranscript).toBe(true);
      expect(createCall.data.runProposal).toBe(true);
      expect(createCall.data.runPpt).toBe(true);
    });
  });

  // ── Workshop analysis (workspace-based) ──────────────────────────────

  describe('workshop-analysis', () => {
    it('returns 400 without workspaceId', async () => {
      const res = await request(app)
        .post('/api/agents/workshop-analysis/run')
        .set(authHeader())
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('workspaceId');
    });

    it('returns 404 when workspace not found', async () => {
      mp.workspace.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/agents/workshop-analysis/run')
        .set(authHeader())
        .send({ workspaceId: 'nope' });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('Workspace not found');
    });

    it('returns 400 when workspace has no transcript', async () => {
      mp.workspace.findUnique.mockResolvedValue(
        mockWorkspace({ transcriptText: null })
      );

      const res = await request(app)
        .post('/api/agents/workshop-analysis/run')
        .set(authHeader())
        .send({ workspaceId: 'ws-test-123' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('no transcript');
    });

    it('returns 409 when pipeline is already running', async () => {
      mp.workspace.findUnique.mockResolvedValue(
        mockWorkspace({ status: 'analyzing' })
      );

      const res = await request(app)
        .post('/api/agents/workshop-analysis/run')
        .set(authHeader())
        .send({ workspaceId: 'ws-test-123' });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('already running');
    });

    it('succeeds with valid workspace', async () => {
      mp.workspace.findUnique.mockResolvedValue(mockWorkspace());
      mp.workspace.update.mockResolvedValue(
        mockWorkspace({ status: 'analyzing' })
      );

      const res = await request(app)
        .post('/api/agents/workshop-analysis/run')
        .set(authHeader())
        .send({ workspaceId: 'ws-test-123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.jobId).toBe('ws-test-123');
      expect(res.body.data.agentId).toBe('workshop-analysis');
      expect(res.body.data.jobType).toBe('workspace');
      expect(res.body.data.status).toBe('queued');

      // Verify workspace was updated to analyzing status
      expect(mp.workspace.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workspaceId: 'ws-test-123' },
          data: expect.objectContaining({
            status: 'analyzing',
            workspaceType: 'workshop_analysis',
          }),
        })
      );
    });
  });

  // ── User Story Generation (workspace-based) ─────────────────────────

  describe('user-story-generation', () => {
    it('returns 400 without workspaceId', async () => {
      const res = await request(app)
        .post('/api/agents/user-story-generation/run')
        .set(authHeader())
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('workspaceId');
    });

    it('returns 404 when workspace not found', async () => {
      mp.workspace.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/agents/user-story-generation/run')
        .set(authHeader())
        .send({ workspaceId: 'nope' });

      expect(res.status).toBe(404);
    });

    it('succeeds and sets workspaceType to user_story_generation', async () => {
      mp.workspace.findUnique.mockResolvedValue(mockWorkspace());
      mp.workspace.update.mockResolvedValue(
        mockWorkspace({ status: 'analyzing', workspaceType: 'user_story_generation' })
      );

      const res = await request(app)
        .post('/api/agents/user-story-generation/run')
        .set(authHeader())
        .send({ workspaceId: 'ws-test-123' });

      expect(res.status).toBe(200);
      expect(res.body.data.agentId).toBe('user-story-generation');
      expect(res.body.data.jobType).toBe('workspace');

      const updateCall = mp.workspace.update.mock.calls[0][0];
      expect(updateCall.data.workspaceType).toBe('user_story_generation');
    });
  });

  // ── Workshop Prep (workspace-based + needs clientName) ───────────────

  describe('workshop-prep', () => {
    it('returns 400 without workspaceId', async () => {
      const res = await request(app)
        .post('/api/agents/workshop-prep/run')
        .set(authHeader())
        .send({});

      expect(res.status).toBe(400);
    });

    it('returns 400 when workspace has no clientName', async () => {
      mp.workspace.findUnique.mockResolvedValue(
        mockWorkspace({ clientName: null })
      );

      const res = await request(app)
        .post('/api/agents/workshop-prep/run')
        .set(authHeader())
        .send({ workspaceId: 'ws-test-123' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Company name');
    });

    it('succeeds with valid workspace that has clientName', async () => {
      mp.workspace.findUnique.mockResolvedValue(
        mockWorkspace({ clientName: 'Acme Corp' })
      );
      mp.workspace.update.mockResolvedValue(
        mockWorkspace({ status: 'analyzing', workspaceType: 'workshop_prep' })
      );

      const res = await request(app)
        .post('/api/agents/workshop-prep/run')
        .set(authHeader())
        .send({ workspaceId: 'ws-test-123' });

      expect(res.status).toBe(200);
      expect(res.body.data.agentId).toBe('workshop-prep');
      expect(res.body.data.jobType).toBe('workspace');
    });
  });

  // ── Bulk analysis ────────────────────────────────────────────────────

  describe('bulk-analysis', () => {
    it('returns 400 without dealId or accountId', async () => {
      const res = await request(app)
        .post('/api/agents/bulk-analysis/run')
        .set(authHeader())
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('dealId or accountId');
    });

    it('succeeds with dealId and returns bulkJobId', async () => {
      const res = await request(app)
        .post('/api/agents/bulk-analysis/run')
        .set(authHeader())
        .send({ dealId: 'deal-1' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.jobId).toBe('bulk-123');
      expect(res.body.data.agentId).toBe('bulk-analysis');
      expect(res.body.data.jobType).toBe('bulk-analysis');
    });

    it('succeeds with accountId', async () => {
      const res = await request(app)
        .post('/api/agents/bulk-analysis/run')
        .set(authHeader())
        .send({ accountId: 'acc-1' });

      expect(res.status).toBe(200);
      expect(res.body.data.jobId).toBe('bulk-123');
      expect(res.body.data.jobType).toBe('bulk-analysis');
    });
  });

  // ── Pre-call research ────────────────────────────────────────────────

  describe('pre-call-research', () => {
    it('returns 400 without meetingId', async () => {
      const res = await request(app)
        .post('/api/agents/pre-call-research/run')
        .set(authHeader())
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('meetingId');
    });

    it('returns 404 when meeting not found', async () => {
      mp.meeting.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/agents/pre-call-research/run')
        .set(authHeader())
        .send({ meetingId: 'nope' });

      expect(res.status).toBe(404);
    });

    it('succeeds and returns research jobId', async () => {
      mp.meeting.findUnique.mockResolvedValue(
        mockMeeting({ title: 'Call with Acme', account: { accountId: 'acc-1', name: 'Acme Corp' } })
      );

      const res = await request(app)
        .post('/api/agents/pre-call-research/run')
        .set(authHeader())
        .send({ meetingId: 'mtg-test-123' });

      expect(res.status).toBe(200);
      expect(res.body.data.agentId).toBe('pre-call-research');
      expect(res.body.data.jobType).toBe('research');
      expect(res.body.data.jobId).toBeDefined();
    });
  });

  // ── Discovery ────────────────────────────────────────────────────────

  describe('discovery', () => {
    it('returns 400 without query', async () => {
      const res = await request(app)
        .post('/api/agents/discovery/run')
        .set(authHeader())
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('query');
    });

    it('succeeds with valid query', async () => {
      mp.discoverySession.create.mockResolvedValue({
        sessionId: 'disc-session-1',
      });

      const res = await request(app)
        .post('/api/agents/discovery/run')
        .set(authHeader())
        .send({ query: 'Enterprise SaaS companies in fintech' });

      expect(res.status).toBe(200);
      expect(res.body.data.agentId).toBe('discovery');
      expect(res.body.data.jobType).toBe('discovery');
      expect(res.body.data.jobId).toBeDefined();

      // Verify discovery session was created in DB
      expect(mp.discoverySession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: expect.any(String),
          }),
        })
      );
    });
  });
});

// ===========================================================================
// GET /api/agents/runs/:jobId/status -- Poll run status
// ===========================================================================

describe('GET /api/agents/runs/:jobId/status', () => {
  it('returns 404 for unknown jobId', async () => {
    mp.meetingAnalysisJob.findUnique.mockResolvedValue(null);
    mp.analysis.findFirst.mockResolvedValue(null);
    mp.workspace.findUnique.mockResolvedValue(null);
    mp.discoverySession.findUnique.mockResolvedValue(null);

    // getBulkJobStatus already mocked to return null

    const res = await request(app)
      .get('/api/agents/runs/nonexistent-job/status')
      .set(authHeader());

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('Job not found');
  });

  it('returns meeting analysis job status', async () => {
    mp.meetingAnalysisJob.findUnique.mockResolvedValue({
      jobId: 'job-1',
      status: 'running',
      transcriptStatus: 'completed',
      proposalStatus: 'running',
      pptStatus: 'pending',
      errorMessage: null,
      createdAt: new Date('2025-01-01'),
      completedAt: null,
      meeting: { title: 'Q4 Review' },
    });

    const res = await request(app)
      .get('/api/agents/runs/job-1/status')
      .set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.jobId).toBe('job-1');
    expect(res.body.data.jobType).toBe('meeting-analysis');
    expect(res.body.data.status).toBe('running');
    expect(res.body.data.meetingTitle).toBe('Q4 Review');
    expect(res.body.data.transcriptStatus).toBe('completed');
    expect(res.body.data.proposalStatus).toBe('running');
    expect(res.body.data.pptStatus).toBe('pending');
    expect(res.body.data.errorMessage).toBeNull();
  });

  it('returns completed meeting analysis job status', async () => {
    mp.meetingAnalysisJob.findUnique.mockResolvedValue({
      jobId: 'job-2',
      status: 'completed',
      transcriptStatus: 'completed',
      proposalStatus: 'completed',
      pptStatus: 'completed',
      errorMessage: null,
      createdAt: new Date('2025-01-01'),
      completedAt: new Date('2025-01-01'),
      meeting: { title: 'Strategy Session' },
    });

    const res = await request(app)
      .get('/api/agents/runs/job-2/status')
      .set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('completed');
    expect(res.body.data.completedAt).toBeDefined();
  });

  it('returns bulk analysis job status when found', async () => {
    mp.meetingAnalysisJob.findUnique.mockResolvedValue(null);

    mockGetBulkJobStatus.mockResolvedValue({
      status: 'running',
      totalMeetings: 5,
      completedMeetings: 2,
      failedMeetings: 0,
    });

    const res = await request(app)
      .get('/api/agents/runs/bulk-123/status')
      .set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data.jobId).toBe('bulk-123');
    expect(res.body.data.jobType).toBe('bulk-analysis');
    expect(res.body.data.status).toBe('running');
    expect(res.body.data.totalMeetings).toBe(5);
    expect(res.body.data.completedMeetings).toBe(2);
  });

  it('returns research session status', async () => {
    mp.meetingAnalysisJob.findUnique.mockResolvedValue(null);
    mp.analysis.findFirst.mockResolvedValue({
      sessionId: 'research-session-1',
      status: 'completed',
      currentStep: 'Finished research',
      companyName: 'Acme Corp',
    });

    // getBulkJobStatus returns null by default from mock

    const res = await request(app)
      .get('/api/agents/runs/research-session-1/status')
      .set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data.jobId).toBe('research-session-1');
    expect(res.body.data.jobType).toBe('research');
    expect(res.body.data.status).toBe('completed');
    expect(res.body.data.companyName).toBe('Acme Corp');
  });

  it('returns research session with running status', async () => {
    mp.meetingAnalysisJob.findUnique.mockResolvedValue(null);
    mp.analysis.findFirst.mockResolvedValue({
      sessionId: 'research-2',
      status: 'in_progress',
      currentStep: 'Gathering financials',
      companyName: 'Beta Inc',
    });

    const res = await request(app)
      .get('/api/agents/runs/research-2/status')
      .set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('running');
    expect(res.body.data.message).toContain('Gathering financials');
  });

  it('returns research session with error status as failed', async () => {
    mp.meetingAnalysisJob.findUnique.mockResolvedValue(null);
    mp.analysis.findFirst.mockResolvedValue({
      sessionId: 'research-3',
      status: 'error',
      currentStep: 'Failed at step 3',
      companyName: 'Gamma LLC',
    });

    const res = await request(app)
      .get('/api/agents/runs/research-3/status')
      .set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('failed');
  });

  it('returns workspace pipeline status', async () => {
    mp.meetingAnalysisJob.findUnique.mockResolvedValue(null);
    mp.analysis.findFirst.mockResolvedValue(null);
    mp.workspace.findUnique.mockResolvedValue({
      workspaceId: 'ws-1',
      name: 'Q4 Workshop',
      status: 'analyzing',
      workspaceType: 'workshop_analysis',
      analysisStatus: 'running',
      miroStatus: 'pending',
      pptxStatus: 'pending',
      errorMessage: null,
      createdAt: new Date('2025-01-15'),
      completedAt: null,
    });

    const res = await request(app)
      .get('/api/agents/runs/ws-1/status')
      .set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data.jobId).toBe('ws-1');
    expect(res.body.data.jobType).toBe('workspace');
    expect(res.body.data.status).toBe('running');
    expect(res.body.data.workspaceName).toBe('Q4 Workshop');
    expect(res.body.data.workspaceType).toBe('workshop_analysis');
    expect(res.body.data.analysisStatus).toBe('running');
    expect(res.body.data.miroStatus).toBe('pending');
    expect(res.body.data.pptxStatus).toBe('pending');
  });

  it('returns completed workspace pipeline status', async () => {
    mp.meetingAnalysisJob.findUnique.mockResolvedValue(null);
    mp.analysis.findFirst.mockResolvedValue(null);
    mp.workspace.findUnique.mockResolvedValue({
      workspaceId: 'ws-2',
      name: 'Sprint Planning',
      status: 'completed',
      workspaceType: 'user_story_generation',
      analysisStatus: 'completed',
      miroStatus: 'completed',
      pptxStatus: 'completed',
      errorMessage: null,
      createdAt: new Date('2025-01-10'),
      completedAt: new Date('2025-01-10'),
    });

    const res = await request(app)
      .get('/api/agents/runs/ws-2/status')
      .set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('completed');
    expect(res.body.data.workspaceType).toBe('user_story_generation');
  });

  it('returns error workspace pipeline status as failed', async () => {
    mp.meetingAnalysisJob.findUnique.mockResolvedValue(null);
    mp.analysis.findFirst.mockResolvedValue(null);
    mp.workspace.findUnique.mockResolvedValue({
      workspaceId: 'ws-err',
      name: 'Broken Workshop',
      status: 'error',
      workspaceType: 'workshop_analysis',
      analysisStatus: 'error',
      miroStatus: 'skipped',
      pptxStatus: 'skipped',
      errorMessage: 'Analysis failed: timeout',
      createdAt: new Date(),
      completedAt: null,
    });

    const res = await request(app)
      .get('/api/agents/runs/ws-err/status')
      .set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('failed');
    expect(res.body.data.errorMessage).toBe('Analysis failed: timeout');
  });

  it('returns cancelled workspace pipeline status', async () => {
    mp.meetingAnalysisJob.findUnique.mockResolvedValue(null);
    mp.analysis.findFirst.mockResolvedValue(null);
    mp.workspace.findUnique.mockResolvedValue({
      workspaceId: 'ws-cancel',
      name: 'Cancelled Workshop',
      status: 'cancelled',
      workspaceType: 'workshop_analysis',
      analysisStatus: 'cancelled',
      miroStatus: 'cancelled',
      pptxStatus: 'cancelled',
      errorMessage: null,
      createdAt: new Date(),
      completedAt: null,
    });

    const res = await request(app)
      .get('/api/agents/runs/ws-cancel/status')
      .set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('cancelled');
  });

  it('returns discovery session status when completed', async () => {
    mp.meetingAnalysisJob.findUnique.mockResolvedValue(null);
    mp.analysis.findFirst.mockResolvedValue(null);
    mp.workspace.findUnique.mockResolvedValue(null);
    mp.discoverySession.findUnique.mockResolvedValue({
      sessionId: 'disc-1',
      messages: JSON.stringify([
        { role: 'user', content: 'Find fintech leads' },
        { role: 'assistant', content: 'Here are some leads...' },
      ]),
    });

    const res = await request(app)
      .get('/api/agents/runs/disc-1/status')
      .set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data.jobId).toBe('disc-1');
    expect(res.body.data.jobType).toBe('discovery');
    expect(res.body.data.status).toBe('completed');
    expect(res.body.data.message).toBe('Discovery complete');
  });

  it('returns discovery session status when still running', async () => {
    mp.meetingAnalysisJob.findUnique.mockResolvedValue(null);
    mp.analysis.findFirst.mockResolvedValue(null);
    mp.workspace.findUnique.mockResolvedValue(null);
    mp.discoverySession.findUnique.mockResolvedValue({
      sessionId: 'disc-2',
      messages: JSON.stringify([
        { role: 'user', content: 'Find healthcare leads' },
      ]),
    });

    const res = await request(app)
      .get('/api/agents/runs/disc-2/status')
      .set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('running');
    expect(res.body.data.message).toContain('Searching');
  });

  it('returns meeting job status with default title when meeting has no title', async () => {
    mp.meetingAnalysisJob.findUnique.mockResolvedValue({
      jobId: 'job-no-title',
      status: 'completed',
      transcriptStatus: 'completed',
      proposalStatus: 'skipped',
      pptStatus: 'skipped',
      errorMessage: null,
      createdAt: new Date(),
      completedAt: new Date(),
      meeting: null,
    });

    const res = await request(app)
      .get('/api/agents/runs/job-no-title/status')
      .set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data.meetingTitle).toBe('Untitled Meeting');
  });
});
