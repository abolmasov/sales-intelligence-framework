import express, { Application } from 'express';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { corsMiddleware } from './middleware/cors';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestIdMiddleware, errorLoggingMiddleware, metricsTrackingMiddleware } from './middleware/logging';
import { authMiddleware } from './middleware/auth';
// Load environment variables
dotenv.config();

/**
 * Create and configure Express application
 */
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export function createApp(): Application {
  const app = express();

  // Security headers
  app.use(helmet());

  // Logging middleware (must be first)
  app.use(requestIdMiddleware);
  app.use(metricsTrackingMiddleware);

  // Body parsing middleware
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  app.use(corsMiddleware);
  app.use(cookieParser());

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({
      success: true,
      message: 'Sales Intelligence Backend is running',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
    });
  });

  // Public auth routes (rate limited)
  app.use('/auth', authRateLimit, require('./routes/auth.routes').default);
  app.use('/api/salesforce', require('./routes/salesforce.routes').publicRouter); // Salesforce OAuth callback (public)

  // All routes below require authenticated session
  app.use(authMiddleware);
  app.use('/api', apiRateLimit);

  // API Routes
  app.use('/api/research', require('./routes/research.routes').default);
  app.use('/api/deals', require('./routes/deals.routes').default);
  app.use('/api/accounts', require('./routes/accounts.routes').default);
  app.use('/api/transcripts', require('./routes/transcripts.routes').default);
  app.use('/api/analysis-workflow', require('./routes/analysisWorkflow.routes').default);
  app.use('/api/meetings', require('./routes/meetings.routes').default);
  app.use('/api/case-studies', require('./routes/caseStudies.routes').default);
  app.use('/api/user', require('./routes/userApiKeys.routes').default);
  app.use('/api/ai-questionnaire', require('./routes/aiQuestionnaire.routes').default);
  app.use('/api/logs', require('./routes/logs.routes').default); // Log viewer API
  app.use('/api/knowledge-graphs', require('./routes/knowledge-graphs.routes').default);
  
  app.use('/api/pursuit-brief', require('./routes/pursuit-brief.routes').default);
  app.use('/api', require('./routes/ms-graph.routes').default); // Microsoft Graph API (calendar, email)
 
  app.use('/api/proposal', require('./routes/proposal.routes').default); // AI Proposal Generation
  app.use('/api/pptx', require('./routes/pptxGeneration.routes').default); // PPTX Generation
  app.use('/api/template', require('./routes/templateManager.routes').default); // Template Management
  app.use('/api/notifications', require('./routes/notifications.routes').default); // User Notifications
  app.use('/api/atlassian', require('./routes/atlassian-assessment.routes').default); // Atlassian Migration Assessment
  app.use('/api/ai-assistant', require('./routes/ai-assistant.routes').default); // AI Chat Assistant
  app.use('/api/metrics', require('./routes/metrics.routes').default); // Usage Metrics & Analytics
  app.use('/api/proposal-evaluation', require('./routes/proposal-evaluation.routes').default); // Proposal Evaluation
  app.use('/api/salesforce', require('./routes/salesforce.routes').default); // Salesforce CRM Integration
  app.use('/api/workspaces', require('./routes/workspace.routes').default); // AI Workshop Workspaces
  app.use('/api/saved-items', require('./routes/savedItems.routes').default); // Save/Unsave toggle for auto-delete
  app.use('/api/discovery', require('./routes/discovery.routes').default); // Lead Discovery Chatbot
  app.use('/api/agents', require('./routes/agent.routes').default); // Agent Hub
  app.use('/api/feedback', require('./routes/feedback.routes').default); // User Feedback (Like/Dislike)

  // 404 Handler (must be after all routes)
  app.use(notFoundHandler);

  // Error logging middleware (before error handler)
  app.use(errorLoggingMiddleware);

  // Error Handler (must be last)
  app.use(errorHandler);

  return app;
}
