import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import cors from 'cors';
import { corsOptions } from './cors';

type StaticOrigin = boolean | string | RegExp | Array<boolean | string | RegExp>;
type OriginHandler = (
  requestOrigin: string | undefined,
  callback: (err: Error | null, origin?: StaticOrigin) => void,
) => void;

describe('corsOptions', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalCorsOrigin = process.env.CORS_ORIGIN;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.NODE_ENV = 'production';
    process.env.CORS_ORIGIN = 'https://app.example.com';
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.CORS_ORIGIN = originalCorsOrigin;
  });

  it('allows requests without an Origin header in production', () => {
    const originHandler = corsOptions.origin as OriginHandler;

    originHandler(undefined, (err: Error | null, allow?: StaticOrigin) => {
      expect(err).toBeNull();
      expect(allow).toBe(true);
    });
  });

  it('allows configured browser origins', () => {
    const originHandler = corsOptions.origin as OriginHandler;

    originHandler('https://app.example.com', (err: Error | null, allow?: StaticOrigin) => {
      expect(err).toBeNull();
      expect(allow).toBe(true);
    });
  });

  it('rejects unconfigured browser origins', () => {
    const originHandler = corsOptions.origin as OriginHandler;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    originHandler('https://evil.example.com', (err: Error | null, allow?: StaticOrigin) => {
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toBe('Not allowed by CORS');
      expect(allow).toBeUndefined();
    });

    expect(warnSpy).toHaveBeenCalledWith('[CORS] Blocked origin: https://evil.example.com');
  });
});
