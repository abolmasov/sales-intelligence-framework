import { Request, Response, NextFunction } from 'express';
import morgan from 'morgan';
import { getLoggerService, httpLogger } from '../services/logger.service';
import { randomUUID } from 'crypto';
import { getMetricsService, MetricEventType, FeatureCategory } from '../services/metrics.service';

const loggerService = getLoggerService();

/**
 * Add request ID to all requests for tracing
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = randomUUID();
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
}

/**
 * Morgan HTTP logger middleware
 * Logs all HTTP requests in Apache combined format
 */
export const morganMiddleware = morgan(
  ':method :url :status :res[content-length] - :response-time ms',
  {
    stream: {
      write: (message: string) => {
        httpLogger.http(message.trim());
      },
    },
  }
);

/**
 * Comprehensive request/response logging middleware
 */
export function requestLoggingMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] as string;

  // Log incoming request
  loggerService.info('Incoming Request', {
    requestId,
    method: req.method,
    url: req.url,
    path: req.path,
    query: req.query,
    ip: req.ip || req.socket.remoteAddress,
    userAgent: req.get('user-agent'),
  });

  // Capture the original res.json method
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);

  // Override res.json to log response
  res.json = function (body: any) {
    const durationMs = Date.now() - startTime;

    loggerService.apiRequest({
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      durationMs,
      ip: req.ip || req.socket.remoteAddress,
    });

    // Log slow requests (> 1 second)
    if (durationMs > 1000) {
      loggerService.warn('Slow API Request', {
        requestId,
        method: req.method,
        url: req.url,
        durationMs,
        durationSeconds: (durationMs / 1000).toFixed(2),
      });
    }

    // Log performance metric
    loggerService.performance(`${req.method} ${req.path}`, durationMs, {
      requestId,
      statusCode: res.statusCode,
    });

    return originalJson(body);
  };

  // Override res.send to log response
  res.send = function (body: any) {
    const durationMs = Date.now() - startTime;

    loggerService.apiRequest({
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      durationMs,
      ip: req.ip || req.socket.remoteAddress,
    });

    // Log slow requests (> 1 second)
    if (durationMs > 1000) {
      loggerService.warn('Slow API Request', {
        requestId,
        method: req.method,
        url: req.url,
        durationMs,
        durationSeconds: (durationMs / 1000).toFixed(2),
      });
    }

    return originalSend(body);
  };

  next();
}

/**
 * Performance monitoring middleware
 * Tracks request duration and logs slow requests
 */
export function performanceMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] as string;

  // Monitor response finish event
  res.on('finish', () => {
    const durationMs = Date.now() - startTime;

    // Define slow request thresholds
    const SLOW_REQUEST_THRESHOLD = 1000; // 1 second
    const VERY_SLOW_REQUEST_THRESHOLD = 3000; // 3 seconds

    if (durationMs > VERY_SLOW_REQUEST_THRESHOLD) {
      loggerService.error('Very Slow API Request', undefined, {
        requestId,
        method: req.method,
        url: req.url,
        path: req.path,
        durationMs,
        durationSeconds: (durationMs / 1000).toFixed(2),
        statusCode: res.statusCode,
        threshold: 'very_slow',
      });
    } else if (durationMs > SLOW_REQUEST_THRESHOLD) {
      loggerService.warn('Slow API Request', {
        requestId,
        method: req.method,
        url: req.url,
        path: req.path,
        durationMs,
        durationSeconds: (durationMs / 1000).toFixed(2),
        statusCode: res.statusCode,
        threshold: 'slow',
      });
    }

    // Log performance metrics for all requests
    loggerService.performance(`API: ${req.method} ${req.path}`, durationMs, {
      requestId,
      statusCode: res.statusCode,
      contentLength: res.get('content-length'),
    });
  });

  next();
}

/**
 * Error logging middleware
 * Catches and logs all errors
 */
export function errorLoggingMiddleware(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const requestId = req.headers['x-request-id'] as string;

  // Log the error with sanitized context — never log raw body (may contain transcripts/PII)
  const SENSITIVE_FIELDS = new Set([
    'transcriptText', 'transcript_text',
    'password', 'passwd',
    'token', 'accessToken', 'access_token', 'bearerToken', 'bearer_token',
    'refreshToken', 'refresh_token', 'idToken', 'id_token',
    'msToken', 'ms_token', 'authToken', 'auth_token',
    'secret', 'clientSecret', 'client_secret',
    'apiKey', 'api_key', 'x-api-key',
    'authorization', 'Authorization',
    'ssn', 'creditCard', 'credit_card', 'bankAccount', 'bank_account',
  ]);

  const sanitizeValue = (k: string, v: unknown): unknown => {
    if (SENSITIVE_FIELDS.has(k)) {
      return typeof v === 'string' ? `[REDACTED ${v.length} chars]` : '[REDACTED]';
    }
    // Recursively sanitize nested objects (but not arrays of primitives)
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>).map(([ik, iv]) => [ik, sanitizeValue(ik, iv)])
      );
    }
    return v;
  };

  const sanitizedBody = req.body
    ? Object.fromEntries(
        Object.entries(req.body as Record<string, unknown>).map(([k, v]) => [k, sanitizeValue(k, v)])
      )
    : undefined;

  loggerService.error('Request Error', err, {
    requestId,
    method: req.method,
    url: req.url,
    path: req.path,
    query: req.query,
    body: sanitizedBody,
    ip: req.ip || req.socket.remoteAddress,
    userAgent: req.get('user-agent'),
    statusCode: err.status || err.statusCode || 500,
  });

  // Pass to next error handler
  next(err);
}

/**
 * User activity logging helper
 */
export function logUserActivity(userId: string | undefined, action: string, meta?: Record<string, any>) {
  loggerService.activity(userId, action, meta);
}

/**
 * Database query logging helper
 */
export function logDatabaseQuery(query: string, durationMs: number, meta?: Record<string, any>) {
  loggerService.dbQuery(query, durationMs, meta);
}

/**
 * External API call logging helper
 */
export function logExternalApiCall(
  service: string,
  endpoint: string,
  durationMs: number,
  meta?: Record<string, any>
) {
  loggerService.externalApi(service, endpoint, durationMs, meta);
}

/**
 * Route-to-category mapping for automatic metrics tracking
 */
const ROUTE_CATEGORY_MAP: Array<{
  pattern: RegExp;
  category: FeatureCategory;
  eventType: MetricEventType;
}> = [
  { pattern: /^\/api\/transcripts/, category: 'meeting_intelligence', eventType: 'meeting_analysis_started' },
  { pattern: /^\/api\/calendar|^\/api\/meetings/, category: 'calendar', eventType: 'calendar_synced' },
  { pattern: /^\/api\/accounts/, category: 'account_research', eventType: 'account_viewed' },
  { pattern: /^\/api\/deals/, category: 'deal_management', eventType: 'deal_updated' },
  { pattern: /^\/api\/proposal/, category: 'proposal_generation', eventType: 'proposal_generated' },
  { pattern: /^\/api\/research/, category: 'account_research', eventType: 'account_research_started' },
  { pattern: /^\/api\/rfp|^\/api\/proposal\/research-rfp/, category: 'rfp_research', eventType: 'rfp_research_started' },
  { pattern: /^\/api\/ppt/, category: 'ppt_generation', eventType: 'ppt_generated' },
  { pattern: /^\/api\/atlassian/, category: 'atlassian_assessment', eventType: 'feature_used' },
  { pattern: /^\/api\/knowledge|^\/api\/internal-kb/, category: 'knowledge_search', eventType: 'knowledge_search' },
];

/**
 * Metrics tracking middleware
 * Automatically records API usage events to the metrics service
 */
export function metricsTrackingMiddleware(req: Request, res: Response, next: NextFunction) {
  // Skip health checks, static assets, metrics endpoints (avoid recursion)
  if (req.path === '/health' || req.path.startsWith('/api/metrics') || req.path.startsWith('/api/logs')) {
    return next();
  }

  const startTime = Date.now();
  const userId = (req as any).user?.email || (req as any).user?.userId || undefined;

  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    const success = res.statusCode < 400;

    // Find matching category
    const match = ROUTE_CATEGORY_MAP.find((r) => r.pattern.test(req.path));
    if (!match) {
      // Record as generic api_call for unmatched routes
      getMetricsService().recordEvent('api_call', 'system', `${req.method} ${req.path}`, {
        duration: durationMs,
        success,
        userId,
        metadata: { statusCode: res.statusCode },
      });
      return;
    }

    const action = `${req.method.toLowerCase()}_${req.path.replace(/\/api\//, '').replace(/\//g, '_').replace(/[^a-zA-Z0-9_]/g, '')}`;

    getMetricsService().recordEvent(match.eventType, match.category, action, {
      duration: durationMs,
      success,
      userId,
      metadata: {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
      },
    });
  });

  next();
}
