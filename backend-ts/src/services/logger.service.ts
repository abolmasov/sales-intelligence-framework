import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';

/**
 * Log levels:
 * - error: 0
 * - warn: 1
 * - info: 2
 * - http: 3
 * - debug: 4
 */

const LOG_DIR = process.env.LOG_DIR || path.join(process.cwd(), 'logs');
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

/**
 * Custom format for console output (colorized, human-readable)
 */
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...meta } = info;
    let metaString = '';

    if (Object.keys(meta).length > 0) {
      // Format metadata nicely
      const filteredMeta = { ...meta };
      delete filteredMeta.service;
      delete filteredMeta.label;

      if (Object.keys(filteredMeta).length > 0) {
        metaString = '\n' + JSON.stringify(filteredMeta, null, 2);
      }
    }

    return `${timestamp} [${level}]: ${message}${metaString}`;
  })
);

/**
 * Custom format for file output (JSON, structured)
 */
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

/**
 * Daily rotating file transport for all logs
 */
const allLogsTransport = new DailyRotateFile({
  filename: path.join(LOG_DIR, 'application-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  format: fileFormat,
  level: LOG_LEVEL,
});

/**
 * Daily rotating file transport for error logs only
 */
const errorLogsTransport = new DailyRotateFile({
  filename: path.join(LOG_DIR, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '30d',
  format: fileFormat,
  level: 'error',
});

/**
 * Daily rotating file transport for HTTP requests
 */
const httpLogsTransport = new DailyRotateFile({
  filename: path.join(LOG_DIR, 'http-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '7d',
  format: fileFormat,
  level: 'http',
});

/**
 * Daily rotating file transport for performance metrics
 */
const performanceLogsTransport = new DailyRotateFile({
  filename: path.join(LOG_DIR, 'performance-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '7d',
  format: fileFormat,
  level: 'info',
});

/**
 * Console transport for development
 */
const consoleTransport = new winston.transports.Console({
  format: consoleFormat,
  level: LOG_LEVEL,
});

/**
 * Main application logger
 */
export const logger = winston.createLogger({
  level: LOG_LEVEL,
  defaultMeta: { service: 'sales-intelligence' },
  transports: [
    consoleTransport,
    allLogsTransport,
    errorLogsTransport,
  ],
  exitOnError: false,
});

/**
 * HTTP logger (separate from main logger)
 */
export const httpLogger = winston.createLogger({
  level: 'http',
  defaultMeta: { service: 'sales-intelligence-http' },
  transports: [
    httpLogsTransport,
  ],
  exitOnError: false,
});

/**
 * Performance logger (separate from main logger)
 */
export const performanceLogger = winston.createLogger({
  level: 'info',
  defaultMeta: { service: 'sales-intelligence-performance' },
  transports: [
    performanceLogsTransport,
  ],
  exitOnError: false,
});

/**
 * Logger service class with enhanced functionality
 */
export class LoggerService {
  private contextData: Record<string, any> = {};

  /**
   * Set context data that will be included in all subsequent logs
   */
  setContext(context: Record<string, any>): void {
    this.contextData = { ...this.contextData, ...context };
  }

  /**
   * Clear context data
   */
  clearContext(): void {
    this.contextData = {};
  }

  /**
   * Log an info message
   */
  info(message: string, meta?: Record<string, any>): void {
    logger.info(message, { ...this.contextData, ...meta });
  }

  /**
   * Log a warning message
   */
  warn(message: string, meta?: Record<string, any>): void {
    logger.warn(message, { ...this.contextData, ...meta });
  }

  /**
   * Log an error message
   */
  error(message: string, error?: Error | any, meta?: Record<string, any>): void {
    const errorMeta: any = { ...this.contextData, ...meta };

    if (error) {
      errorMeta.error = {
        message: error.message,
        stack: error.stack,
        name: error.name,
        ...error,
      };
    }

    logger.error(message, errorMeta);
  }

  /**
   * Log a debug message
   */
  debug(message: string, meta?: Record<string, any>): void {
    logger.debug(message, { ...this.contextData, ...meta });
  }

  /**
   * Log an HTTP request
   */
  http(message: string, meta?: Record<string, any>): void {
    httpLogger.http(message, { ...this.contextData, ...meta });
  }

  /**
   * Log a performance metric
   */
  performance(operation: string, durationMs: number, meta?: Record<string, any>): void {
    performanceLogger.info(`Performance: ${operation}`, {
      ...this.contextData,
      ...meta,
      operation,
      durationMs,
      durationSeconds: (durationMs / 1000).toFixed(2),
    });
  }

  /**
   * Log user activity
   */
  activity(userId: string | undefined, action: string, meta?: Record<string, any>): void {
    logger.info(`User Activity: ${action}`, {
      ...this.contextData,
      ...meta,
      userId,
      action,
      activityType: 'user_activity',
    });
  }

  /**
   * Log API request
   */
  apiRequest(req: {
    method: string;
    url: string;
    statusCode?: number;
    durationMs?: number;
    userId?: string;
    ip?: string;
  }): void {
    httpLogger.http('API Request', {
      ...this.contextData,
      method: req.method,
      url: req.url,
      statusCode: req.statusCode,
      durationMs: req.durationMs,
      userId: req.userId,
      ip: req.ip,
      requestType: 'api_request',
    });
  }

  /**
   * Log database query
   */
  dbQuery(query: string, durationMs: number, meta?: Record<string, any>): void {
    performanceLogger.info('Database Query', {
      ...this.contextData,
      ...meta,
      query,
      durationMs,
      queryType: 'database',
    });
  }

  /**
   * Log external API call
   */
  externalApi(service: string, endpoint: string, durationMs: number, meta?: Record<string, any>): void {
    performanceLogger.info('External API Call', {
      ...this.contextData,
      ...meta,
      service,
      endpoint,
      durationMs,
      callType: 'external_api',
    });
  }
}

// Singleton instance
let loggerServiceInstance: LoggerService | null = null;

export function getLoggerService(): LoggerService {
  if (!loggerServiceInstance) {
    loggerServiceInstance = new LoggerService();
  }
  return loggerServiceInstance;
}

// Export default logger instance
export default logger;
