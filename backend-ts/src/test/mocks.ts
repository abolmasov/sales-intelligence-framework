/**
 * Reusable mock factories for backend tests.
 *
 * mockPrisma — auto-stub for every model method (findUnique, create, update, etc.)
 * createTestApp — Express app with all routes mounted + auth bypassed
 */
import { vi } from 'vitest';
import jwt from 'jsonwebtoken';

// ── Prisma Mock ────────────────────────────────────────────────────

function createModelMock() {
  return {
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
    aggregate: vi.fn().mockResolvedValue({}),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
  };
}

export const mockPrisma: Record<string, any> = {
  workspace: createModelMock(),
  meeting: createModelMock(),
  meetingAnalysisJob: createModelMock(),
  deal: createModelMock(),
  account: createModelMock(),
  contact: createModelMock(),
  analysis: createModelMock(),
  transcriptAnalysis: createModelMock(),
  opportunity: createModelMock(),
  proposalJob: createModelMock(),
  pptxJob: createModelMock(),
  bulkAnalysisJob: createModelMock(),
  user: createModelMock(),
  userAPIKeys: createModelMock(),
  userCalendarMeeting: createModelMock(),
  salesTeamMember: createModelMock(),
  document: createModelMock(),
  notification: createModelMock(),
  discoverySession: createModelMock(),
  atlassianAssessment: createModelMock(),
  atlassianCredential: createModelMock(),
  proposalEvaluation: createModelMock(),
  vectorIndex: createModelMock(),
  embeddingDocument: createModelMock(),
  knowledgeGraph: createModelMock(),
  company: createModelMock(),
  attendee: createModelMock(),
  meetingAttendeeResearch: createModelMock(),
  integratorOpportunityMapping: createModelMock(),
  serviceOffering: createModelMock(),
  dealActionPlan: createModelMock(),
  dealQuestionnaire: createModelMock(),
  dealCaseStudy: createModelMock(),
  dealService: createModelMock(),
  salesforceSync: createModelMock(),
  rfpResearch: createModelMock(),
  usageEvent: createModelMock(),
  aPICache: createModelMock(),
  pursuitBriefSnapshot: createModelMock(),
  pursuit_briefs: createModelMock(),
  opportunityStage: createModelMock(),
  $connect: vi.fn(),
  $disconnect: vi.fn(),
  $transaction: vi.fn().mockImplementation(async (fn: any) => {
    if (typeof fn === 'function') return fn(mockPrisma);
    return Promise.all(fn);
  }),
};

// ── Auth helpers ───────────────────────────────────────────────────

const TEST_USER = {
  email: 'test@example.com',
  userId: 'test-user-id',
  accessToken: 'ms-access-token-stub',
};

/** Generate a valid JWT for test requests */
export function getTestToken(): string {
  return jwt.sign(TEST_USER, process.env.JWT_SECRET || 'test-jwt-secret-for-vitest', {
    expiresIn: '1h',
  });
}

/** Returns an auth header object for supertest */
export function authHeader(): Record<string, string> {
  return { Authorization: `Bearer ${getTestToken()}` };
}

// ── Test app factory ───────────────────────────────────────────────

/** Create an Express app with full middleware (including real auth verification via JWT).
 *  Use `authHeader()` when making requests to authenticate.
 */
export async function createTestApp() {
  const { createApp } = await import('../app');
  return createApp();
}

// ── OpenAI mock helper ────────────────────────────────────────────

export function mockOpenAIService() {
  return {
    generateStructuredCompletion: vi.fn().mockResolvedValue({
      workshopFlow: [],
      clientNeeds: [],
      technologyRecommendations: [],
      roadmap: [],
      actionItems: [],
      keyDecisions: [],
    }),
    transcribeAudio: vi.fn().mockResolvedValue('Mock transcription text'),
  };
}

// ── Fixture helpers ───────────────────────────────────────────────

export function mockWorkspace(overrides: Record<string, any> = {}) {
  return {
    workspaceId: 'ws-test-123',
    name: 'Test Workspace',
    description: 'A test workspace',
    transcriptText: 'Sample transcript content for testing.',
    transcriptExcerpt: 'Sample transcript content...',
    clientName: 'Test Corp',
    workshopDate: new Date(),
    workshopDuration: '2 hours',
    accountId: null,
    dealId: null,
    status: 'draft',
    workspaceType: 'workshop_analysis',
    analysisResult: null,
    analysisStatus: null,
    miroStatus: null,
    miroBoardUrl: null,
    miroSnapshot: null,
    pptxStatus: null,
    pptxS3Key: null,
    pipelineLog: null,
    errorMessage: null,
    sourceDocuments: null,
    requestedBy: 'test-user-id',
    requestedByEmail: 'test@example.com',
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: null,
    isCancelled: false,
    ...overrides,
  };
}

export function mockMeeting(overrides: Record<string, any> = {}) {
  return {
    meetingId: 'mtg-test-123',
    title: 'Test Meeting',
    startTime: new Date(),
    endTime: new Date(),
    transcript: 'Sample meeting transcript.',
    notes: null,
    dealId: null,
    accountId: null,
    attendees: null,
    source: 'manual',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function mockDeal(overrides: Record<string, any> = {}) {
  return {
    dealId: 'deal-test-123',
    name: 'Test Deal',
    company: 'Test Corp',
    value: 100000,
    stage: 'Proposal',
    probability: 50,
    expectedCloseDate: new Date(),
    description: 'A test deal',
    ownerId: 'test-user-id',
    accountId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function mockAccount(overrides: Record<string, any> = {}) {
  return {
    accountId: 'acc-test-123',
    name: 'Test Corp',
    industry: 'Technology',
    website: 'https://testcorp.com',
    description: 'A test account',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}
