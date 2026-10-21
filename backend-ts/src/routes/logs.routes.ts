import { Router, Request, Response } from 'express';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { ApiResponse } from '../types';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const router = Router();
const readFile = promisify(fs.readFile);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

const LOG_DIR = process.env.LOG_DIR || path.join(process.cwd(), 'logs');

/**
 * GET /api/logs/files
 * List all log files
 */
router.get(
  '/files',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const files = await readdir(LOG_DIR);
      const logFiles = files.filter((file) => file.endsWith('.log'));

      const fileStats = await Promise.all(
        logFiles.map(async (file) => {
          const filePath = path.join(LOG_DIR, file);
          const stats = await stat(filePath);
          return {
            name: file,
            path: filePath,
            size: stats.size,
            sizeFormatted: formatBytes(stats.size),
            modified: stats.mtime,
            type: getLogFileType(file),
          };
        })
      );

      // Sort by modified date (newest first)
      fileStats.sort((a, b) => b.modified.getTime() - a.modified.getTime());

      const response: ApiResponse = {
        success: true,
        data: fileStats,
        message: `Found ${fileStats.length} log files`,
      };

      return res.json(response);
    } catch (error: any) {
      throw new AppError('Failed to list log files', 500);
    }
  })
);

/**
 * GET /api/logs/:filename
 * View a specific log file with filtering options
 */
router.get(
  '/:filename',
  asyncHandler(async (req: Request, res: Response) => {
    const { filename } = req.params;
    const { level, search, limit = '100', offset = '0' } = req.query;

    // Security: prevent directory traversal
    if (filename.includes('..') || filename.includes('/')) {
      throw new AppError('Invalid filename', 400);
    }

    const filePath = path.join(LOG_DIR, filename);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new AppError('Log file not found', 404);
    }

    try {
      const content = await readFile(filePath, 'utf-8');
      const lines = content.split('\n').filter((line) => line.trim());

      // Parse JSON log lines
      const parsedLogs = lines
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            // If not JSON, return as plain text
            return { message: line, level: 'info', timestamp: new Date() };
          }
        })
        .filter((log) => {
          // Filter by level if specified
          if (level && log.level !== level) {
            return false;
          }

          // Filter by search term if specified
          if (search && typeof search === 'string') {
            const searchTerm = search.toLowerCase();
            const logStr = JSON.stringify(log).toLowerCase();
            return logStr.includes(searchTerm);
          }

          return true;
        });

      // Reverse to show newest first
      parsedLogs.reverse();

      // Apply pagination
      const limitNum = parseInt(limit as string, 10);
      const offsetNum = parseInt(offset as string, 10);
      const paginatedLogs = parsedLogs.slice(offsetNum, offsetNum + limitNum);

      const response: ApiResponse = {
        success: true,
        data: {
          logs: paginatedLogs,
          total: parsedLogs.length,
          limit: limitNum,
          offset: offsetNum,
          hasMore: offsetNum + limitNum < parsedLogs.length,
        },
        message: `Retrieved ${paginatedLogs.length} of ${parsedLogs.length} log entries`,
      };

      res.json(response);
    } catch (error: any) {
      throw new AppError(`Failed to read log file: ${error.message}`, 500);
    }
  })
);

/**
 * GET /api/logs/recent/:type
 * Get recent logs by type (application, http, error, performance)
 */
router.get(
  '/recent/:type',
  asyncHandler(async (req: Request, res: Response) => {
    const { type } = req.params;
    const { limit = '50' } = req.query;

    // Find the most recent log file for the type
    const files = await readdir(LOG_DIR);
    const pattern = getLogFilePattern(type);
    const matchingFiles = files.filter((file) => file.match(pattern));

    if (matchingFiles.length === 0) {
      const response: ApiResponse = {
        success: true,
        data: { logs: [], total: 0 },
        message: `No ${type} logs found`,
      };
      return res.json(response);
    }

    // Sort by date and get the most recent
    matchingFiles.sort().reverse();
    const mostRecentFile = matchingFiles[0];
    const filePath = path.join(LOG_DIR, mostRecentFile);

    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n').filter((line) => line.trim());

    // Parse and get recent logs
    const parsedLogs = lines
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter((log) => log !== null);

    // Reverse to show newest first and limit
    parsedLogs.reverse();
    const limitedLogs = parsedLogs.slice(0, parseInt(limit as string, 10));

    const response: ApiResponse = {
      success: true,
      data: {
        logs: limitedLogs,
        total: limitedLogs.length,
        file: mostRecentFile,
      },
      message: `Retrieved ${limitedLogs.length} recent ${type} logs`,
    };

    return res.json(response);
  })
);

/**
 * GET /api/logs/stats/summary
 * Get log statistics summary
 */
router.get(
  '/stats/summary',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const files = await readdir(LOG_DIR);
      const logFiles = files.filter((file) => file.endsWith('.log'));

      const stats = {
        totalFiles: logFiles.length,
        totalSize: 0,
        filesByType: {
          application: 0,
          http: 0,
          error: 0,
          performance: 0,
        },
        oldestFile: null as Date | null,
        newestFile: null as Date | null,
      };

      for (const file of logFiles) {
        const filePath = path.join(LOG_DIR, file);
        const fileStat = await stat(filePath);
        stats.totalSize += fileStat.size;

        if (!stats.oldestFile || fileStat.mtime < stats.oldestFile) {
          stats.oldestFile = fileStat.mtime;
        }
        if (!stats.newestFile || fileStat.mtime > stats.newestFile) {
          stats.newestFile = fileStat.mtime;
        }

        const type = getLogFileType(file);
        if (type in stats.filesByType) {
          stats.filesByType[type as keyof typeof stats.filesByType]++;
        }
      }

      const response: ApiResponse = {
        success: true,
        data: {
          ...stats,
          totalSizeFormatted: formatBytes(stats.totalSize),
        },
        message: 'Log statistics retrieved successfully',
      };

      res.json(response);
    } catch (error: any) {
      throw new AppError('Failed to get log statistics', 500);
    }
  })
);

/**
 * Helper: Determine log file type from filename
 */
function getLogFileType(filename: string): string {
  if (filename.startsWith('application-')) return 'application';
  if (filename.startsWith('http-')) return 'http';
  if (filename.startsWith('error-')) return 'error';
  if (filename.startsWith('performance-')) return 'performance';
  return 'unknown';
}

/**
 * Helper: Get regex pattern for log file type
 */
function getLogFilePattern(type: string): RegExp {
  switch (type) {
    case 'application':
      return /^application-.*\.log$/;
    case 'http':
      return /^http-.*\.log$/;
    case 'error':
      return /^error-.*\.log$/;
    case 'performance':
      return /^performance-.*\.log$/;
    default:
      return /\.log$/;
  }
}

/**
 * Helper: Format bytes to human-readable format
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

export default router;
