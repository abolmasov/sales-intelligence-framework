// Load polyfills FIRST for Node.js compatibility (pdf-parse needs DOM APIs)
import './polyfills';

// Load environment variables before any other imports
import dotenv from 'dotenv';
dotenv.config();

// Error monitoring — must be initialised before anything else
import * as Sentry from '@sentry/node';
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.2,
  });
}

import { createApp } from './app';
import { disconnectDatabase } from './config/database';
import { getLoggerService } from './services/logger.service';
import { startAutoDeleteScheduler } from './services/autoDeleteCleanup.service';

const PORT = process.env.PORT || 3001;
const logger = getLoggerService();

/**
 * Start the Express server
 */
async function startServer() {
  try {
    const app = createApp();

    // Start 48-hour auto-delete scheduler for unsaved records
    startAutoDeleteScheduler();

    const server = app.listen(PORT, () => {
      logger.info('Sales Intelligence Backend started', {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version,
        platform: process.platform,
      });

      console.log(`🚀 Sales Intelligence Backend running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      console.log(`📋 Logs API: http://localhost:${PORT}/api/logs/stats/summary`);
    });

    // Graceful shutdown handlers
    const shutdown = async (signal: string) => {
      logger.warn('Shutdown signal received', { signal });
      console.log(`\n${signal} received. Closing server gracefully...`);

      server.close(async () => {
        logger.info('HTTP server closed');
        console.log('HTTP server closed');

        try {
          await disconnectDatabase();
          logger.info('Database disconnected successfully');
          console.log('Database disconnected');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown', error);
          console.error('Error during shutdown:', error);
          process.exit(1);
        }
      });

      // Force close after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown - connections did not close in time');
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start server', error);
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();
