import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';

// ── Create mock Prisma inline (vi.mock factories can't import .ts files) ──
const noop = vi.fn();
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
const mp: Record<string, any> = { user: createModel() };

vi.mock('../config/database', () => ({
  getPrismaClient: () => mp,
  default: () => mp,
}));

vi.mock('../services/ms-graph.service', () => ({
  getMSGraphService: () => ({
    isConfigured: vi.fn().mockReturnValue(true),
    getAuthorizationUrl: vi.fn().mockReturnValue(
      'https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=test'
    ),
    exchangeCodeForToken: vi.fn().mockResolvedValue({
      access_token: 'ms-access-token',
      refresh_token: 'ms-refresh-token',
    }),
    getUserInfo: vi.fn().mockResolvedValue({
      id: 'ms-user-id',
      displayName: 'Test User',
      userPrincipalName: 'test@example.com',
      mail: 'test@example.com',
    }),
    refreshAccessToken: vi.fn().mockResolvedValue({
      access_token: 'ms-new-access-token',
      refresh_token: 'ms-new-refresh-token',
    }),
  }),
}));

import { authHeader } from '../test/mocks';

async function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  const authRoutes = (await import('./auth.routes')).default;
  app.use('/auth', authRoutes);
  return app;
}

describe('Auth Routes', () => {
  let app: express.Application;

  beforeEach(async () => {
    app = await buildApp();
  });

  describe('GET /auth/login', () => {
    it('redirects to Microsoft OAuth URL', async () => {
      const res = await request(app).get('/auth/login');
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('login.microsoftonline.com');
    });
  });

  describe('GET /auth/callback', () => {
    it('redirects with error when no code provided', async () => {
      const res = await request(app).get('/auth/callback');
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('error=missing_code');
    });

    it('exchanges code and redirects with token', async () => {
      mp.user.upsert.mockResolvedValueOnce({
        userId: 'ms-user-id',
        email: 'test@example.com',
      });

      const res = await request(app).get('/auth/callback?code=auth-unique-code-123');
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('status=success');
      expect(res.headers.location).toContain('token=');
    });
  });

  describe('GET /auth/verify', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get('/auth/verify');
      expect(res.status).toBe(401);
    });

    it('returns 200 with valid token', async () => {
      const res = await request(app)
        .get('/auth/verify')
        .set(authHeader());
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /auth/status', () => {
    it('returns OAuth configuration status', async () => {
      const res = await request(app).get('/auth/status');
      expect(res.status).toBe(200);
      expect(res.body.oauth_configured).toBe(true);
    });
  });

  describe('POST /auth/logout', () => {
    it('clears cookie and returns success', async () => {
      const res = await request(app).post('/auth/logout');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
