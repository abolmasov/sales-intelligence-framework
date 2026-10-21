/**
 * Vitest global setup — runs before every test file.
 *
 * - Sets required environment variables
 * - Mocks logger (universally needed)
 * - Prisma mock is handled per-test via mocks.ts since vi.mock factories can't import external modules
 */
import { vi, beforeEach } from 'vitest';

// ── Environment variables ──────────────────────────────────────────
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-for-vitest';
process.env.DATABASE_URL = 'postgresql://user:dummy_password@localhost:5432/test';
process.env.OPENAI_API_KEY = 'sk-test-key';
process.env.MIRO_ACCESS_TOKEN = 'miro-test-token';
process.env.MIRO_BOARD_ID = 'test-board-id';

// ── Mock Logger ────────────────────────────────────────────────────
vi.mock('../services/logger.service', () => {
  const noop = vi.fn();
  const loggerInstance = {
    info: noop,
    warn: noop,
    error: noop,
    debug: noop,
    http: noop,
    performance: noop,
    activity: noop,
    apiRequest: noop,
    setContext: noop,
    clearContext: noop,
  };
  return {
    getLoggerService: () => loggerInstance,
    logger: { info: noop, warn: noop, error: noop, debug: noop, http: noop },
    httpLogger: { http: noop },
    performanceLogger: { info: noop },
    LoggerService: vi.fn().mockImplementation(() => loggerInstance),
    default: { info: noop, warn: noop, error: noop, debug: noop, http: noop },
  };
});

// ── Reset mocks between tests ──────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
});
