import { Router, Request, Response } from 'express';
import { getMetricsService, MetricEventType, FeatureCategory } from '../services/metrics.service';

const router = Router();

/**
 * @route GET /api/metrics/dashboard
 * @desc Get real-time dashboard metrics with trends and KPIs
 */
router.get('/dashboard', async (_req: Request, res: Response) => {
  try {
    const metricsService = getMetricsService();
    const dashboardMetrics = metricsService.getDashboardMetrics();

    return res.status(200).json({
      success: true,
      data: dashboardMetrics,
    });
  } catch (error) {
    console.error('Failed to get dashboard metrics:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve dashboard metrics',
    });
  }
});

/**
 * @route GET /api/metrics/kpis
 * @desc Get sales-specific KPIs
 */
router.get('/kpis', async (req: Request, res: Response) => {
  try {
    const metricsService = getMetricsService();

    const period = (req.query.period as string) || '7d';
    let startDate: Date;

    switch (period) {
      case '1h':
        startDate = new Date(Date.now() - 60 * 60 * 1000);
        break;
      case '24h':
        startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    }

    const bucketSize = period === '1h' || period === '24h' ? 'hour' : 'day';
    const metrics = metricsService.getAggregatedMetrics(startDate, new Date(), bucketSize);

    return res.status(200).json({
      success: true,
      data: {
        period,
        startDate,
        endDate: new Date(),
        kpis: metrics.kpis,
        summary: metrics.summary,
      },
    });
  } catch (error) {
    console.error('Failed to get KPIs:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve KPIs',
    });
  }
});

/**
 * @route GET /api/metrics/aggregated
 * @desc Get aggregated metrics for a time period
 */
router.get('/aggregated', async (req: Request, res: Response) => {
  try {
    const metricsService = getMetricsService();

    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : new Date(Date.now() - 24 * 60 * 60 * 1000); // Default: last 24 hours

    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : new Date();

    const bucketSize = (req.query.bucketSize as 'hour' | 'day' | 'week') || 'hour';

    const aggregatedMetrics = metricsService.getAggregatedMetrics(startDate, endDate, bucketSize);

    return res.status(200).json({
      success: true,
      data: aggregatedMetrics,
    });
  } catch (error) {
    console.error('Failed to get aggregated metrics:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve aggregated metrics',
    });
  }
});

/**
 * @route GET /api/metrics/events
 * @desc Get events for log explorer (like Kibana Discover)
 */
router.get('/events', async (req: Request, res: Response) => {
  try {
    const metricsService = getMetricsService();

    const options: {
      startDate?: Date;
      endDate?: Date;
      eventTypes?: MetricEventType[];
      categories?: string[];
      searchQuery?: string;
      limit?: number;
      offset?: number;
    } = {};

    if (req.query.startDate) {
      options.startDate = new Date(req.query.startDate as string);
    }
    if (req.query.endDate) {
      options.endDate = new Date(req.query.endDate as string);
    }
    if (req.query.eventTypes) {
      options.eventTypes = (req.query.eventTypes as string).split(',') as MetricEventType[];
    }
    if (req.query.categories) {
      options.categories = (req.query.categories as string).split(',');
    }
    if (req.query.searchQuery) {
      options.searchQuery = req.query.searchQuery as string;
    }
    if (req.query.limit) {
      options.limit = parseInt(req.query.limit as string, 10);
    }
    if (req.query.offset) {
      options.offset = parseInt(req.query.offset as string, 10);
    }

    const result = metricsService.getEvents(options);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Failed to get events:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve events',
    });
  }
});

/**
 * @route GET /api/metrics/logs
 * @desc Get detailed logs for debugging (like Kibana Discover)
 */
router.get('/logs', async (req: Request, res: Response) => {
  try {
    const metricsService = getMetricsService();

    const options: {
      startDate?: Date;
      endDate?: Date;
      levels?: ('debug' | 'info' | 'warn' | 'error')[];
      sources?: string[];
      searchQuery?: string;
      limit?: number;
      offset?: number;
    } = {};

    if (req.query.startDate) {
      options.startDate = new Date(req.query.startDate as string);
    }
    if (req.query.endDate) {
      options.endDate = new Date(req.query.endDate as string);
    }
    if (req.query.levels) {
      options.levels = (req.query.levels as string).split(',') as ('debug' | 'info' | 'warn' | 'error')[];
    }
    if (req.query.sources) {
      options.sources = (req.query.sources as string).split(',');
    }
    if (req.query.searchQuery) {
      options.searchQuery = req.query.searchQuery as string;
    }
    if (req.query.limit) {
      options.limit = parseInt(req.query.limit as string, 10);
    }
    if (req.query.offset) {
      options.offset = parseInt(req.query.offset as string, 10);
    }

    const result = metricsService.getDetailedLogs(options);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Failed to get logs:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve logs',
    });
  }
});

/**
 * @route POST /api/metrics/record
 * @desc Record a custom metric event (for frontend tracking)
 */
router.post('/record', async (req: Request, res: Response) => {
  try {
    const metricsService = getMetricsService();

    const { eventType, category, action, label, value, duration, metadata, userId, sessionId, success, context } = req.body;

    if (!eventType || !category || !action) {
      return res.status(400).json({
        success: false,
        error: 'eventType, category, and action are required',
      });
    }

    const eventId = metricsService.recordEvent(eventType, category, action, {
      label,
      value,
      duration,
      metadata,
      userId,
      sessionId,
      success,
      context,
    });

    return res.status(200).json({
      success: true,
      data: { eventId },
    });
  } catch (error) {
    console.error('Failed to record metric:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to record metric',
    });
  }
});

/**
 * @route POST /api/metrics/page-view
 * @desc Record a page view (convenience endpoint)
 */
router.post('/page-view', async (req: Request, res: Response) => {
  try {
    const metricsService = getMetricsService();
    const { page, sessionId } = req.body;
    const userId = (req as any).user?.email || (req as any).user?.userId || req.body.userId;

    if (!page) {
      return res.status(400).json({
        success: false,
        error: 'page is required',
      });
    }

    metricsService.recordPageView(page, userId, sessionId);

    return res.status(200).json({
      success: true,
    });
  } catch (error) {
    console.error('Failed to record page view:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to record page view',
    });
  }
});

/**
 * @route POST /api/metrics/feature
 * @desc Record feature usage (convenience endpoint)
 */
router.post('/feature', async (req: Request, res: Response) => {
  try {
    const metricsService = getMetricsService();
    const { feature, action, metadata } = req.body;
    const userId = (req as any).user?.email || (req as any).user?.userId || req.body.userId;

    if (!feature || !action) {
      return res.status(400).json({
        success: false,
        error: 'feature and action are required',
      });
    }

    metricsService.recordFeatureUsed(feature as FeatureCategory, action, {
      ...metadata,
      userId,
    });

    return res.status(200).json({
      success: true,
    });
  } catch (error) {
    console.error('Failed to record feature usage:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to record feature usage',
    });
  }
});

/**
 * @route POST /api/metrics/export
 * @desc Record an export action (convenience endpoint)
 */
router.post('/export', async (req: Request, res: Response) => {
  try {
    const metricsService = getMetricsService();
    const { format, itemCount, context } = req.body;

    if (!format || itemCount === undefined) {
      return res.status(400).json({
        success: false,
        error: 'format and itemCount are required',
      });
    }

    metricsService.recordExport(format, itemCount, context);

    return res.status(200).json({
      success: true,
    });
  } catch (error) {
    console.error('Failed to record export:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to record export',
    });
  }
});

/**
 * @route GET /api/metrics/tokens
 * @desc Get AI token usage summary
 */
router.get('/tokens', async (_req: Request, res: Response) => {
  try {
    const metricsService = getMetricsService();
    const tokenUsage = metricsService.getTokenUsage();

    return res.status(200).json({
      success: true,
      data: tokenUsage,
    });
  } catch (error) {
    console.error('Failed to get token usage:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve token usage',
    });
  }
});

/**
 * @route GET /api/metrics/summary
 * @desc Get quick summary stats
 */
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const metricsService = getMetricsService();

    const period = (req.query.period as string) || '24h';
    let startDate: Date;

    switch (period) {
      case '1h':
        startDate = new Date(Date.now() - 60 * 60 * 1000);
        break;
      case '24h':
        startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    }

    const bucketSize = period === '1h' || period === '24h' ? 'hour' : 'day';
    const metrics = metricsService.getAggregatedMetrics(startDate, new Date(), bucketSize);

    return res.status(200).json({
      success: true,
      data: {
        period,
        ...metrics.summary,
        kpis: metrics.kpis,
        confidenceDistribution: metrics.confidenceDistribution,
        categoryBreakdown: metrics.categoryBreakdown,
        topActions: metrics.topActions.slice(0, 10),
        errorBreakdown: metrics.errorBreakdown,
      },
    });
  } catch (error) {
    console.error('Failed to get summary:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve summary',
    });
  }
});

/**
 * @route GET /api/metrics/time-series
 * @desc Get time series data for charts
 */
router.get('/time-series', async (req: Request, res: Response) => {
  try {
    const metricsService = getMetricsService();

    const period = (req.query.period as string) || '24h';
    let startDate: Date;
    let bucketSize: 'hour' | 'day' | 'week';

    switch (period) {
      case '1h':
        startDate = new Date(Date.now() - 60 * 60 * 1000);
        bucketSize = 'hour';
        break;
      case '6h':
        startDate = new Date(Date.now() - 6 * 60 * 60 * 1000);
        bucketSize = 'hour';
        break;
      case '24h':
        startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
        bucketSize = 'hour';
        break;
      case '7d':
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        bucketSize = 'day';
        break;
      case '30d':
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        bucketSize = 'day';
        break;
      case '90d':
        startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        bucketSize = 'week';
        break;
      default:
        startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
        bucketSize = 'hour';
    }

    const metrics = metricsService.getAggregatedMetrics(startDate, new Date(), bucketSize);

    return res.status(200).json({
      success: true,
      data: {
        period,
        bucketSize,
        startDate,
        endDate: new Date(),
        timeSeries: metrics.timeSeries,
      },
    });
  } catch (error) {
    console.error('Failed to get time series:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve time series data',
    });
  }
});

export default router;
