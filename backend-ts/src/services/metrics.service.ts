import { v4 as uuidv4 } from 'uuid';
import { getLoggerService } from './logger.service';
import { getPrismaClient } from '../config/database';

/**
 * Metric event types - comprehensive tracking for sales intelligence platform
 */
export type MetricEventType =
  // RFP Research Events
  | 'rfp_research_started'
  | 'rfp_research_completed'
  | 'rfp_research_failed'
  | 'rfp_file_uploaded'
  | 'rfp_text_extracted'
  | 'question_extracted'
  | 'answer_generated'
  | 'batch_processing_started'
  | 'batch_processing_completed'
  // Knowledge & Search Events
  | 'knowledge_search'
  | 'web_search'
  | 'case_study_matched'
  | 'knowledge_source_retrieved'
  // Meeting & Calendar Events
  | 'meeting_viewed'
  | 'meeting_transcript_fetched'
  | 'meeting_analysis_started'
  | 'meeting_analysis_completed'
  | 'calendar_synced'
  // Account & Deal Events
  | 'account_viewed'
  | 'account_research_started'
  | 'account_research_completed'
  | 'deal_created'
  | 'deal_updated'
  | 'deal_stage_changed'
  // AI & Generation Events
  | 'ai_prompt_sent'
  | 'ai_response_received'
  | 'ai_tokens_consumed'
  | 'proposal_generated'
  | 'ppt_generated'
  | 'pursuit_brief_created'
  // User Actions
  | 'user_action'
  | 'page_view'
  | 'feature_used'
  | 'export'
  // System Events
  | 'api_call'
  | 'api_latency'
  | 'error'
  | 'warning';

/**
 * Feature categories for tracking usage
 */
export type FeatureCategory =
  | 'rfp_research'
  | 'meeting_intelligence'
  | 'account_research'
  | 'deal_management'
  | 'proposal_generation'
  | 'ppt_generation'
  | 'atlassian_assessment'
  | 'ai_assistant'
  | 'calendar'
  | 'knowledge_search'
  | 'export'
  | 'navigation'
  | 'system';

/**
 * Single metric event with detailed tracking
 */
export interface MetricEvent {
  id: string;
  timestamp: Date;
  eventType: MetricEventType;
  category: FeatureCategory | string;
  action: string;
  label?: string;
  value?: number;
  duration?: number;
  metadata?: Record<string, any>;
  userId?: string;
  sessionId?: string;
  success: boolean;
  // Detailed context
  context?: {
    accountId?: string;
    accountName?: string;
    dealId?: string;
    dealName?: string;
    meetingId?: string;
    meetingTitle?: string;
    rfpFileName?: string;
    aiModel?: string;
    tokensUsed?: number;
    confidenceScore?: number;
    sourceCount?: number;
  };
  // Performance metrics
  performance?: {
    startTime?: number;
    endTime?: number;
    latencyMs?: number;
    memoryUsed?: number;
    cpuTime?: number;
  };
}

/**
 * Sales KPI metrics
 */
export interface SalesKPIs {
  // RFP Performance
  rfpMetrics: {
    totalProcessed: number;
    successRate: number;
    avgProcessingTimeMs: number;
    avgQuestionsPerRFP: number;
    avgConfidenceScore: number;
    totalQuestionsAnswered: number;
    highConfidenceAnswers: number;
    mediumConfidenceAnswers: number;
    lowConfidenceAnswers: number;
  };
  // Meeting Intelligence
  meetingMetrics: {
    totalMeetingsAnalyzed: number;
    avgTranscriptLength: number;
    meetingsWithActionItems: number;
    meetingsWithFollowUps: number;
  };
  // Account & Deal Metrics
  accountMetrics: {
    accountsResearched: number;
    avgResearchDepth: number;
    dealsCreated: number;
    dealsUpdated: number;
    dealStageChanges: number;
  };
  // AI Usage Metrics
  aiMetrics: {
    totalPromptsSent: number;
    totalTokensConsumed: number;
    avgResponseTimeMs: number;
    proposalsGenerated: number;
    pptsGenerated: number;
    pursuitBriefsCreated: number;
  };
  // Knowledge Base Metrics
  knowledgeMetrics: {
    totalSearches: number;
    caseStudiesMatched: number;
    internalKbSourcesUsed: number;
    webSearchesPerformed: number;
    avgSourcesPerAnswer: number;
  };
  // Feature Usage
  featureUsage: Record<FeatureCategory, number>;
  // Export Metrics
  exportMetrics: {
    excelExports: number;
    markdownExports: number;
    pptExports: number;
    pdfExports: number;
  };
}

/**
 * Aggregated metrics for a time period
 */
export interface AggregatedMetrics {
  period: {
    start: Date;
    end: Date;
    bucketSize: 'hour' | 'day' | 'week';
  };
  summary: {
    totalEvents: number;
    totalRFPResearch: number;
    successfulRFPResearch: number;
    failedRFPResearch: number;
    totalQuestionsExtracted: number;
    totalAnswersGenerated: number;
    avgProcessingTimeMs: number;
    avgConfidenceScore: number;
    totalKnowledgeSearches: number;
    totalWebSearches: number;
    totalExports: number;
    totalAITokens: number;
    totalMeetingsAnalyzed: number;
    totalAccountsResearched: number;
    totalDealsUpdated: number;
  };
  timeSeries: TimeSeriesData[];
  categoryBreakdown: Record<string, number>;
  confidenceDistribution: {
    high: number;
    medium: number;
    low: number;
  };
  errorBreakdown: Record<string, number>;
  topActions: Array<{ action: string; count: number }>;
  kpis: SalesKPIs;
}

/**
 * Time series data point with detailed metrics
 */
export interface TimeSeriesData {
  timestamp: Date;
  eventCount: number;
  rfpCount: number;
  questionsExtracted: number;
  answersGenerated: number;
  avgDuration: number;
  errorCount: number;
  aiTokens: number;
  meetingsAnalyzed: number;
  avgConfidence: number;
}

/**
 * Real-time dashboard metrics
 */
export interface DashboardMetrics {
  current: {
    activeResearches: number;
    activeMeetingAnalyses: number;
    todayRFPCount: number;
    todayQuestionCount: number;
    todayAnswerCount: number;
    todayMeetingsAnalyzed: number;
    todayAITokens: number;
    avgResponseTime: number;
    successRate: number;
    avgConfidenceScore: number;
  };
  trends: {
    rfpTrend: number; // percentage change from previous period
    answersTrend: number;
    confidenceTrend: number;
    tokensTrend: number;
  };
  last24Hours: AggregatedMetrics;
  last7Days: AggregatedMetrics;
  last30Days: AggregatedMetrics;
  recentEvents: MetricEvent[];
  topFeatures: Array<{ feature: string; count: number; trend: number }>;
  recentErrors: Array<{ message: string; count: number; lastOccurred: Date }>;
}

/**
 * Detailed log entry for debugging and analysis
 */
export interface DetailedLogEntry {
  id: string;
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  source: string;
  message: string;
  context: Record<string, any>;
  duration?: number;
  stack?: string;
}

/**
 * Metrics Service - Comprehensive analytics for sales intelligence
 */
export class MetricsService {
  private events: MetricEvent[] = [];
  private detailedLogs: DetailedLogEntry[] = [];
  private activeResearches: Map<string, { startTime: Date; metadata: any }> = new Map();
  private activeMeetingAnalyses: Map<string, { startTime: Date; metadata: any }> = new Map();
  private activeAccountResearches: Map<string, { startTime: Date; metadata: any }> = new Map();
  private logger = getLoggerService();
  private maxEventsInMemory = 50000;
  private maxLogsInMemory = 10000;
  private dbInitialized = false;

  // Token tracking
  private tokenUsage: { promptTokens: number; completionTokens: number; totalTokens: number } = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  };

  /**
   * Load recent events from DB into memory on startup
   */
  async initFromDatabase(): Promise<void> {
    if (this.dbInitialized) return;
    try {
      const prisma = getPrismaClient();
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const dbEvents = await prisma.usageEvent.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        orderBy: { createdAt: 'asc' },
        take: this.maxEventsInMemory,
      });

      for (const row of dbEvents) {
        this.events.push({
          id: row.id,
          timestamp: row.createdAt,
          eventType: row.eventType as MetricEventType,
          category: row.category,
          action: row.action,
          label: row.label || undefined,
          value: row.value ?? undefined,
          duration: row.duration ?? undefined,
          metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
          userId: row.userId || undefined,
          sessionId: row.sessionId || undefined,
          success: row.success,
          context: row.context ? JSON.parse(row.context) : undefined,
        });
      }

      this.dbInitialized = true;
      this.logger.info(`[METRICS] Loaded ${dbEvents.length} events from database`);
    } catch (err) {
      this.logger.warn('[METRICS] Failed to load events from DB, starting fresh', { error: String(err) });
      this.dbInitialized = true;
    }
  }

  /**
   * Persist a single event to the database (fire-and-forget)
   */
  private persistEvent(event: MetricEvent): void {
    try {
      const prisma = getPrismaClient();
      prisma.usageEvent.create({
        data: {
          id: event.id,
          eventType: event.eventType,
          category: event.category,
          action: event.action,
          label: event.label || null,
          value: event.value ?? null,
          duration: event.duration ?? null,
          userId: event.userId || null,
          sessionId: event.sessionId || null,
          success: event.success,
          metadata: event.metadata ? JSON.stringify(event.metadata) : null,
          context: event.context ? JSON.stringify(event.context) : null,
        },
      }).catch((err: any) => {
        this.logger.warn('[METRICS] Failed to persist event', { eventId: event.id, error: String(err) });
      });
    } catch {
      // Silently ignore if prisma is unavailable
    }
  }

  /**
   * Record a metric event with detailed context
   */
  recordEvent(
    eventType: MetricEventType,
    category: FeatureCategory | string,
    action: string,
    options?: {
      label?: string;
      value?: number;
      duration?: number;
      metadata?: Record<string, any>;
      userId?: string;
      sessionId?: string;
      success?: boolean;
      context?: MetricEvent['context'];
      performance?: MetricEvent['performance'];
    }
  ): string {
    const event: MetricEvent = {
      id: uuidv4(),
      timestamp: new Date(),
      eventType,
      category,
      action,
      label: options?.label,
      value: options?.value,
      duration: options?.duration,
      metadata: options?.metadata,
      userId: options?.userId,
      sessionId: options?.sessionId,
      success: options?.success ?? true,
      context: options?.context,
      performance: options?.performance,
    };

    this.events.push(event);

    // Persist to database
    this.persistEvent(event);

    // Log the event with structured data
    this.logger.info(`[METRIC] ${eventType} | ${category}/${action}`, {
      eventId: event.id,
      eventType,
      category,
      action,
      label: options?.label,
      value: options?.value,
      duration: options?.duration ? `${options.duration}ms` : undefined,
      success: event.success,
      context: options?.context,
      metadata: options?.metadata,
    });

    // Trim old events if exceeding limit
    if (this.events.length > this.maxEventsInMemory) {
      this.events = this.events.slice(-this.maxEventsInMemory);
    }

    return event.id;
  }

  /**
   * Add detailed log entry for debugging
   */
  addDetailedLog(
    level: 'debug' | 'info' | 'warn' | 'error',
    source: string,
    message: string,
    context: Record<string, any> = {},
    duration?: number,
    stack?: string
  ): void {
    const logEntry: DetailedLogEntry = {
      id: uuidv4(),
      timestamp: new Date(),
      level,
      source,
      message,
      context,
      duration,
      stack,
    };

    this.detailedLogs.push(logEntry);

    // Log based on level
    const logMessage = `[${source}] ${message}`;
    switch (level) {
      case 'debug':
        this.logger.debug(logMessage, context);
        break;
      case 'info':
        this.logger.info(logMessage, context);
        break;
      case 'warn':
        this.logger.warn(logMessage, context);
        break;
      case 'error':
        this.logger.error(logMessage, context);
        break;
    }

    // Trim old logs
    if (this.detailedLogs.length > this.maxLogsInMemory) {
      this.detailedLogs = this.detailedLogs.slice(-this.maxLogsInMemory);
    }
  }

  // =====================================
  // RFP Research Tracking
  // =====================================

  /**
   * Record RFP file upload
   */
  recordRFPUpload(
    sessionId: string,
    fileName: string,
    fileSize: number,
    fileType: 'pdf' | 'excel' | 'word' | 'text',
    hasCustomPrompt: boolean
  ): void {
    this.recordEvent('rfp_file_uploaded', 'rfp_research', 'file_uploaded', {
      sessionId,
      label: fileName,
      value: fileSize,
      metadata: { fileType, hasCustomPrompt, fileSizeKB: Math.round(fileSize / 1024) },
      context: { rfpFileName: fileName },
    });

    this.addDetailedLog('info', 'RFP_UPLOAD', `File uploaded: ${fileName}`, {
      sessionId,
      fileName,
      fileSize: `${Math.round(fileSize / 1024)}KB`,
      fileType,
      hasCustomPrompt,
    });
  }

  /**
   * Record text extraction from RFP
   */
  recordRFPTextExtraction(
    sessionId: string,
    textLength: number,
    pageCount: number,
    duration: number
  ): void {
    this.recordEvent('rfp_text_extracted', 'rfp_research', 'text_extracted', {
      sessionId,
      value: textLength,
      duration,
      metadata: { pageCount, charactersPerPage: Math.round(textLength / pageCount) },
      performance: { latencyMs: duration },
    });

    this.addDetailedLog('info', 'RFP_EXTRACT', `Text extracted: ${textLength} chars from ${pageCount} pages`, {
      sessionId,
      textLength,
      pageCount,
      duration: `${duration}ms`,
      throughput: `${Math.round(textLength / (duration / 1000))} chars/sec`,
    });
  }

  /**
   * Start tracking an RFP research session
   */
  startRFPResearch(sessionId: string, metadata?: Record<string, any>): void {
    this.activeResearches.set(sessionId, {
      startTime: new Date(),
      metadata: metadata || {},
    });

    this.recordEvent('rfp_research_started', 'rfp_research', 'research_started', {
      sessionId,
      metadata,
      context: { rfpFileName: metadata?.fileName },
    });

    this.addDetailedLog('info', 'RFP_RESEARCH', `Research session started: ${sessionId}`, {
      sessionId,
      fileName: metadata?.fileName,
      textLength: metadata?.textLength,
      hasCustomPrompt: metadata?.hasCustomPrompt,
    });
  }

  /**
   * Record batch processing start
   */
  recordBatchStart(
    sessionId: string,
    batchNumber: number,
    totalBatches: number,
    questionsInBatch: number
  ): void {
    this.recordEvent('batch_processing_started', 'rfp_research', 'batch_started', {
      sessionId,
      value: questionsInBatch,
      metadata: { batchNumber, totalBatches },
    });

    this.addDetailedLog('debug', 'RFP_BATCH', `Batch ${batchNumber}/${totalBatches} started with ${questionsInBatch} questions`, {
      sessionId,
      batchNumber,
      totalBatches,
      questionsInBatch,
    });
  }

  /**
   * Record batch processing completion
   */
  recordBatchComplete(
    sessionId: string,
    batchNumber: number,
    answersGenerated: number,
    duration: number,
    avgConfidence: number
  ): void {
    this.recordEvent('batch_processing_completed', 'rfp_research', 'batch_completed', {
      sessionId,
      value: answersGenerated,
      duration,
      metadata: { batchNumber, avgConfidence },
      performance: { latencyMs: duration },
    });

    this.addDetailedLog('info', 'RFP_BATCH', `Batch ${batchNumber} completed: ${answersGenerated} answers in ${duration}ms`, {
      sessionId,
      batchNumber,
      answersGenerated,
      duration: `${duration}ms`,
      avgConfidence: `${(avgConfidence * 100).toFixed(1)}%`,
      avgTimePerAnswer: `${Math.round(duration / answersGenerated)}ms`,
    });
  }

  /**
   * Complete an RFP research session
   */
  completeRFPResearch(
    sessionId: string,
    result: {
      questionsExtracted: number;
      answersGenerated: number;
      avgConfidence: number;
      success: boolean;
      errorMessage?: string;
      tokensUsed?: number;
      categories?: Record<string, number>;
    }
  ): void {
    const session = this.activeResearches.get(sessionId);
    const duration = session ? Date.now() - session.startTime.getTime() : 0;

    this.recordEvent(
      result.success ? 'rfp_research_completed' : 'rfp_research_failed',
      'rfp_research',
      result.success ? 'research_completed' : 'research_failed',
      {
        sessionId,
        duration,
        value: result.questionsExtracted,
        metadata: {
          ...result,
          ...session?.metadata,
          processingTimeMinutes: Math.round(duration / 60000 * 10) / 10,
        },
        success: result.success,
        context: {
          rfpFileName: session?.metadata?.fileName,
          confidenceScore: result.avgConfidence,
        },
        performance: { latencyMs: duration },
      }
    );

    const logLevel = result.success ? 'info' : 'error';
    this.addDetailedLog(logLevel, 'RFP_RESEARCH',
      result.success
        ? `Research completed: ${result.answersGenerated}/${result.questionsExtracted} questions answered`
        : `Research failed: ${result.errorMessage}`,
      {
        sessionId,
        questionsExtracted: result.questionsExtracted,
        answersGenerated: result.answersGenerated,
        avgConfidence: `${(result.avgConfidence * 100).toFixed(1)}%`,
        duration: `${Math.round(duration / 1000)}s`,
        tokensUsed: result.tokensUsed,
        categories: result.categories,
        success: result.success,
        errorMessage: result.errorMessage,
      },
      duration
    );

    this.activeResearches.delete(sessionId);
  }

  /**
   * Record question extraction
   */
  recordQuestionExtraction(
    sessionId: string,
    count: number,
    categories: Record<string, number>,
    duration?: number
  ): void {
    this.recordEvent('question_extracted', 'rfp_research', 'questions_extracted', {
      sessionId,
      value: count,
      duration,
      metadata: { categories, categoryCount: Object.keys(categories).length },
    });

    this.addDetailedLog('info', 'RFP_QUESTIONS', `Extracted ${count} questions across ${Object.keys(categories).length} categories`, {
      sessionId,
      totalQuestions: count,
      categories,
      duration: duration ? `${duration}ms` : undefined,
    });
  }

  /**
   * Record answer generation with detailed metrics
   */
  recordAnswerGeneration(
    sessionId: string,
    questionId: string,
    questionText: string,
    confidence: 'high' | 'medium' | 'low',
    duration: number,
    sourcesUsed: number,
    tokensUsed?: number,
    sourceDetails?: { internalKb: number; caseStudies: number; web: number }
  ): void {
    const confidenceScore = confidence === 'high' ? 0.85 : confidence === 'medium' ? 0.6 : 0.35;

    this.recordEvent('answer_generated', 'rfp_research', 'answer_generated', {
      sessionId,
      duration,
      metadata: {
        questionId,
        questionPreview: questionText.substring(0, 100),
        confidence,
        confidenceScore,
        sourcesUsed,
        sourceDetails,
        tokensUsed,
      },
      context: { confidenceScore, sourceCount: sourcesUsed },
      performance: { latencyMs: duration },
    });

    // Track tokens
    if (tokensUsed) {
      this.tokenUsage.totalTokens += tokensUsed;
    }
  }

  /**
   * Record knowledge search with details
   */
  recordKnowledgeSearch(
    sessionId: string,
    searchType: 'internal-kb' | 'case_study' | 'web',
    resultsCount: number,
    duration: number,
    query?: string,
    topResults?: string[]
  ): void {
    const eventType = searchType === 'web' ? 'web_search' : 'knowledge_search';
    this.recordEvent(eventType, 'knowledge_search', `${searchType}_search`, {
      sessionId,
      duration,
      value: resultsCount,
      metadata: { searchType, queryPreview: query?.substring(0, 100), topResults },
      performance: { latencyMs: duration },
    });

    this.addDetailedLog('debug', 'KNOWLEDGE_SEARCH', `${searchType} search: ${resultsCount} results in ${duration}ms`, {
      sessionId,
      searchType,
      resultsCount,
      duration: `${duration}ms`,
      queryPreview: query?.substring(0, 50),
    });
  }

  /**
   * Record case study match
   */
  recordCaseStudyMatch(
    sessionId: string,
    caseStudyId: string,
    caseStudyTitle: string,
    relevanceScore: number
  ): void {
    this.recordEvent('case_study_matched', 'knowledge_search', 'case_study_matched', {
      sessionId,
      value: relevanceScore,
      label: caseStudyTitle,
      metadata: { caseStudyId, caseStudyTitle, relevanceScore },
    });
  }

  // =====================================
  // Meeting Intelligence Tracking
  // =====================================

  /**
   * Record meeting view
   */
  recordMeetingView(meetingId: string, meetingTitle: string, accountName?: string): void {
    this.recordEvent('meeting_viewed', 'meeting_intelligence', 'meeting_viewed', {
      label: meetingTitle,
      context: { meetingId, meetingTitle, accountName },
    });
  }

  /**
   * Record transcript fetch
   */
  recordTranscriptFetch(
    meetingId: string,
    transcriptLength: number,
    duration: number,
    source: 'teams' | 'zoom' | 'manual'
  ): void {
    this.recordEvent('meeting_transcript_fetched', 'meeting_intelligence', 'transcript_fetched', {
      value: transcriptLength,
      duration,
      metadata: { source },
      context: { meetingId },
      performance: { latencyMs: duration },
    });

    this.addDetailedLog('info', 'MEETING', `Transcript fetched: ${transcriptLength} chars from ${source}`, {
      meetingId,
      transcriptLength,
      duration: `${duration}ms`,
      source,
    });
  }

  /**
   * Start meeting analysis
   */
  startMeetingAnalysis(meetingId: string, meetingTitle: string, metadata?: Record<string, any>): void {
    this.activeMeetingAnalyses.set(meetingId, {
      startTime: new Date(),
      metadata: { meetingTitle, ...metadata },
    });

    this.recordEvent('meeting_analysis_started', 'meeting_intelligence', 'analysis_started', {
      label: meetingTitle,
      context: { meetingId, meetingTitle },
    });
  }

  /**
   * Complete meeting analysis
   */
  completeMeetingAnalysis(
    meetingId: string,
    result: {
      actionItemsFound: number;
      followUpsIdentified: number;
      keyTopics: string[];
      sentiment: 'positive' | 'neutral' | 'negative';
      success: boolean;
    }
  ): void {
    const session = this.activeMeetingAnalyses.get(meetingId);
    const duration = session ? Date.now() - session.startTime.getTime() : 0;

    this.recordEvent('meeting_analysis_completed', 'meeting_intelligence', 'analysis_completed', {
      duration,
      metadata: result,
      success: result.success,
      context: { meetingId, meetingTitle: session?.metadata?.meetingTitle },
      performance: { latencyMs: duration },
    });

    this.activeMeetingAnalyses.delete(meetingId);
  }

  // =====================================
  // Account & Deal Tracking
  // =====================================

  /**
   * Record account view
   */
  recordAccountView(accountId: string, accountName: string): void {
    this.recordEvent('account_viewed', 'account_research', 'account_viewed', {
      label: accountName,
      context: { accountId, accountName },
    });
  }

  /**
   * Start account research
   */
  startAccountResearch(accountId: string, accountName: string, researchType: string): void {
    this.activeAccountResearches.set(accountId, {
      startTime: new Date(),
      metadata: { accountName, researchType },
    });

    this.recordEvent('account_research_started', 'account_research', 'research_started', {
      label: accountName,
      metadata: { researchType },
      context: { accountId, accountName },
    });
  }

  /**
   * Complete account research
   */
  completeAccountResearch(
    accountId: string,
    result: {
      dataPointsFound: number;
      sourcesUsed: number;
      success: boolean;
    }
  ): void {
    const session = this.activeAccountResearches.get(accountId);
    const duration = session ? Date.now() - session.startTime.getTime() : 0;

    this.recordEvent('account_research_completed', 'account_research', 'research_completed', {
      duration,
      value: result.dataPointsFound,
      metadata: { ...result, ...session?.metadata },
      success: result.success,
      context: { accountId, accountName: session?.metadata?.accountName },
      performance: { latencyMs: duration },
    });

    this.activeAccountResearches.delete(accountId);
  }

  /**
   * Record deal creation
   */
  recordDealCreated(dealId: string, dealName: string, accountName: string, value?: number): void {
    this.recordEvent('deal_created', 'deal_management', 'deal_created', {
      label: dealName,
      value,
      context: { dealId, dealName, accountName },
    });

    this.addDetailedLog('info', 'DEAL', `Deal created: ${dealName}`, {
      dealId,
      dealName,
      accountName,
      value,
    });
  }

  /**
   * Record deal update
   */
  recordDealUpdated(dealId: string, dealName: string, fieldsUpdated: string[]): void {
    this.recordEvent('deal_updated', 'deal_management', 'deal_updated', {
      label: dealName,
      value: fieldsUpdated.length,
      metadata: { fieldsUpdated },
      context: { dealId, dealName },
    });
  }

  /**
   * Record deal stage change
   */
  recordDealStageChange(
    dealId: string,
    dealName: string,
    fromStage: string,
    toStage: string,
    dealValue?: number
  ): void {
    this.recordEvent('deal_stage_changed', 'deal_management', 'stage_changed', {
      label: `${fromStage} → ${toStage}`,
      value: dealValue,
      metadata: { fromStage, toStage },
      context: { dealId, dealName },
    });

    this.addDetailedLog('info', 'DEAL', `Deal stage changed: ${dealName} from ${fromStage} to ${toStage}`, {
      dealId,
      dealName,
      fromStage,
      toStage,
      dealValue,
    });
  }

  // =====================================
  // AI & Generation Tracking
  // =====================================

  /**
   * Record AI token consumption
   */
  recordAITokens(
    model: string,
    promptTokens: number,
    completionTokens: number,
    purpose: string,
    sessionId?: string
  ): void {
    const totalTokens = promptTokens + completionTokens;

    this.tokenUsage.promptTokens += promptTokens;
    this.tokenUsage.completionTokens += completionTokens;
    this.tokenUsage.totalTokens += totalTokens;

    this.recordEvent('ai_tokens_consumed', 'ai_assistant', 'tokens_consumed', {
      sessionId,
      value: totalTokens,
      metadata: { model, promptTokens, completionTokens, purpose },
      context: { aiModel: model, tokensUsed: totalTokens },
    });
  }

  /**
   * Record proposal generation
   */
  recordProposalGenerated(
    dealId: string,
    dealName: string,
    duration: number,
    sectionCount: number
  ): void {
    this.recordEvent('proposal_generated', 'proposal_generation', 'proposal_generated', {
      label: dealName,
      value: sectionCount,
      duration,
      context: { dealId, dealName },
      performance: { latencyMs: duration },
    });

    this.addDetailedLog('info', 'PROPOSAL', `Proposal generated for ${dealName} with ${sectionCount} sections`, {
      dealId,
      dealName,
      sectionCount,
      duration: `${duration}ms`,
    });
  }

  /**
   * Record PPT generation
   */
  recordPPTGenerated(
    fileName: string,
    slideCount: number,
    duration: number,
    template: string
  ): void {
    this.recordEvent('ppt_generated', 'ppt_generation', 'ppt_generated', {
      label: fileName,
      value: slideCount,
      duration,
      metadata: { template },
      performance: { latencyMs: duration },
    });

    this.addDetailedLog('info', 'PPT', `PPT generated: ${fileName} with ${slideCount} slides`, {
      fileName,
      slideCount,
      duration: `${duration}ms`,
      template,
    });
  }

  /**
   * Record pursuit brief creation
   */
  recordPursuitBriefCreated(accountId: string, accountName: string, duration: number): void {
    this.recordEvent('pursuit_brief_created', 'proposal_generation', 'pursuit_brief_created', {
      label: accountName,
      duration,
      context: { accountId, accountName },
      performance: { latencyMs: duration },
    });
  }

  // =====================================
  // User Actions & Page Views
  // =====================================

  /**
   * Record page view
   */
  recordPageView(page: string, userId?: string, sessionId?: string): void {
    this.recordEvent('page_view', 'navigation', 'page_viewed', {
      label: page,
      userId,
      sessionId,
    });
  }

  /**
   * Record feature usage
   */
  recordFeatureUsed(feature: FeatureCategory, action: string, metadata?: Record<string, any>): void {
    this.recordEvent('feature_used', feature, action, {
      metadata,
    });
  }

  /**
   * Record export action
   */
  recordExport(format: 'excel' | 'markdown' | 'ppt' | 'pdf', itemCount: number, context?: string): void {
    this.recordEvent('export', 'export', `export_${format}`, {
      value: itemCount,
      label: context,
      metadata: { format },
    });

    this.addDetailedLog('info', 'EXPORT', `Exported ${itemCount} items as ${format.toUpperCase()}`, {
      format,
      itemCount,
      context,
    });
  }

  // =====================================
  // Error Tracking
  // =====================================

  /**
   * Record an error with detailed context
   */
  recordError(
    category: string,
    errorMessage: string,
    metadata?: Record<string, any>,
    stack?: string
  ): void {
    this.recordEvent('error', category, 'error', {
      success: false,
      label: errorMessage.substring(0, 100),
      metadata: {
        errorMessage,
        ...metadata,
      },
    });

    this.addDetailedLog('error', category.toUpperCase(), errorMessage, metadata || {}, undefined, stack);
  }

  /**
   * Record a warning
   */
  recordWarning(category: string, message: string, metadata?: Record<string, any>): void {
    this.recordEvent('warning', category, 'warning', {
      label: message.substring(0, 100),
      metadata: { message, ...metadata },
    });

    this.addDetailedLog('warn', category.toUpperCase(), message, metadata || {});
  }

  // =====================================
  // API Tracking
  // =====================================

  /**
   * Record API call latency
   */
  recordAPILatency(
    endpoint: string,
    method: string,
    statusCode: number,
    duration: number,
    success: boolean
  ): void {
    this.recordEvent('api_latency', 'system', 'api_call', {
      label: `${method} ${endpoint}`,
      value: statusCode,
      duration,
      success,
      metadata: { endpoint, method, statusCode },
      performance: { latencyMs: duration },
    });
  }

  // =====================================
  // Aggregation & Analytics
  // =====================================

  /**
   * Calculate Sales KPIs
   */
  private calculateKPIs(events: MetricEvent[]): SalesKPIs {
    // RFP Metrics
    const rfpCompleted = events.filter(e => e.eventType === 'rfp_research_completed');
    const rfpFailed = events.filter(e => e.eventType === 'rfp_research_failed');
    const rfpTotal = rfpCompleted.length + rfpFailed.length;
    const answerEvents = events.filter(e => e.eventType === 'answer_generated');
    const questionEvents = events.filter(e => e.eventType === 'question_extracted');

    const confidenceCounts = { high: 0, medium: 0, low: 0 };
    answerEvents.forEach(e => {
      const conf = e.metadata?.confidence as 'high' | 'medium' | 'low';
      if (conf) confidenceCounts[conf]++;
    });

    const rfpDurations = rfpCompleted.filter(e => e.duration).map(e => e.duration!);
    const avgRFPTime = rfpDurations.length > 0
      ? rfpDurations.reduce((a, b) => a + b, 0) / rfpDurations.length
      : 0;

    // Meeting Metrics
    const meetingsAnalyzed = events.filter(e => e.eventType === 'meeting_analysis_completed');
    const transcriptEvents = events.filter(e => e.eventType === 'meeting_transcript_fetched');
    const avgTranscriptLength = transcriptEvents.length > 0
      ? transcriptEvents.reduce((sum, e) => sum + (e.value || 0), 0) / transcriptEvents.length
      : 0;

    // Account & Deal Metrics
    const accountsResearched = events.filter(e => e.eventType === 'account_research_completed').length;
    const dealsCreated = events.filter(e => e.eventType === 'deal_created').length;
    const dealsUpdated = events.filter(e => e.eventType === 'deal_updated').length;
    const dealStageChanges = events.filter(e => e.eventType === 'deal_stage_changed').length;

    // AI Metrics
    const tokenEvents = events.filter(e => e.eventType === 'ai_tokens_consumed');
    const totalTokens = tokenEvents.reduce((sum, e) => sum + (e.value || 0), 0);
    const aiResponseEvents = events.filter(e => e.eventType === 'answer_generated' && e.duration);
    const avgAIResponseTime = aiResponseEvents.length > 0
      ? aiResponseEvents.reduce((sum, e) => sum + (e.duration || 0), 0) / aiResponseEvents.length
      : 0;

    const proposalsGenerated = events.filter(e => e.eventType === 'proposal_generated').length;
    const pptsGenerated = events.filter(e => e.eventType === 'ppt_generated').length;
    const pursuitBriefs = events.filter(e => e.eventType === 'pursuit_brief_created').length;

    // Knowledge Metrics
    const knowledgeSearches = events.filter(e => e.eventType === 'knowledge_search').length;
    const caseStudiesMatched = events.filter(e => e.eventType === 'case_study_matched').length;
    const webSearches = events.filter(e => e.eventType === 'web_search').length;
    const avgSources = answerEvents.length > 0
      ? answerEvents.reduce((sum, e) => sum + (e.context?.sourceCount || 0), 0) / answerEvents.length
      : 0;

    // Feature Usage
    const featureUsage: Record<FeatureCategory, number> = {
      rfp_research: events.filter(e => e.category === 'rfp_research').length,
      meeting_intelligence: events.filter(e => e.category === 'meeting_intelligence').length,
      account_research: events.filter(e => e.category === 'account_research').length,
      deal_management: events.filter(e => e.category === 'deal_management').length,
      proposal_generation: events.filter(e => e.category === 'proposal_generation').length,
      ppt_generation: events.filter(e => e.category === 'ppt_generation').length,
      atlassian_assessment: events.filter(e => e.category === 'atlassian_assessment').length,
      ai_assistant: events.filter(e => e.category === 'ai_assistant').length,
      calendar: events.filter(e => e.category === 'calendar').length,
      knowledge_search: events.filter(e => e.category === 'knowledge_search').length,
      export: events.filter(e => e.category === 'export').length,
      navigation: events.filter(e => e.category === 'navigation').length,
      system: events.filter(e => e.category === 'system').length,
    };

    // Export Metrics
    const exportEvents = events.filter(e => e.eventType === 'export');
    const exportMetrics = {
      excelExports: exportEvents.filter(e => e.metadata?.format === 'excel').length,
      markdownExports: exportEvents.filter(e => e.metadata?.format === 'markdown').length,
      pptExports: exportEvents.filter(e => e.metadata?.format === 'ppt').length,
      pdfExports: exportEvents.filter(e => e.metadata?.format === 'pdf').length,
    };

    // Calculate average confidence
    const avgConfidence = answerEvents.length > 0
      ? answerEvents.reduce((sum, e) => {
          const conf = e.metadata?.confidence;
          return sum + (conf === 'high' ? 0.85 : conf === 'medium' ? 0.6 : 0.35);
        }, 0) / answerEvents.length
      : 0;

    return {
      rfpMetrics: {
        totalProcessed: rfpTotal,
        successRate: rfpTotal > 0 ? (rfpCompleted.length / rfpTotal) * 100 : 100,
        avgProcessingTimeMs: Math.round(avgRFPTime),
        avgQuestionsPerRFP: rfpCompleted.length > 0
          ? questionEvents.reduce((sum, e) => sum + (e.value || 0), 0) / rfpCompleted.length
          : 0,
        avgConfidenceScore: avgConfidence,
        totalQuestionsAnswered: answerEvents.length,
        highConfidenceAnswers: confidenceCounts.high,
        mediumConfidenceAnswers: confidenceCounts.medium,
        lowConfidenceAnswers: confidenceCounts.low,
      },
      meetingMetrics: {
        totalMeetingsAnalyzed: meetingsAnalyzed.length,
        avgTranscriptLength: Math.round(avgTranscriptLength),
        meetingsWithActionItems: meetingsAnalyzed.filter(e => (e.metadata?.actionItemsFound || 0) > 0).length,
        meetingsWithFollowUps: meetingsAnalyzed.filter(e => (e.metadata?.followUpsIdentified || 0) > 0).length,
      },
      accountMetrics: {
        accountsResearched,
        avgResearchDepth: accountsResearched > 0
          ? events.filter(e => e.eventType === 'account_research_completed')
              .reduce((sum, e) => sum + (e.value || 0), 0) / accountsResearched
          : 0,
        dealsCreated,
        dealsUpdated,
        dealStageChanges,
      },
      aiMetrics: {
        totalPromptsSent: tokenEvents.length,
        totalTokensConsumed: totalTokens,
        avgResponseTimeMs: Math.round(avgAIResponseTime),
        proposalsGenerated,
        pptsGenerated,
        pursuitBriefsCreated: pursuitBriefs,
      },
      knowledgeMetrics: {
        totalSearches: knowledgeSearches + webSearches,
        caseStudiesMatched,
        internalKbSourcesUsed: events.filter(e => e.metadata?.searchType === 'internal-kb').reduce((sum, e) => sum + (e.value || 0), 0),
        webSearchesPerformed: webSearches,
        avgSourcesPerAnswer: Math.round(avgSources * 10) / 10,
      },
      featureUsage,
      exportMetrics,
    };
  }

  /**
   * Get aggregated metrics for a time period
   */
  getAggregatedMetrics(
    startDate: Date,
    endDate: Date,
    bucketSize: 'hour' | 'day' | 'week' = 'hour'
  ): AggregatedMetrics {
    const filteredEvents = this.events.filter(
      (e) => e.timestamp >= startDate && e.timestamp <= endDate
    );

    // Calculate summary metrics
    const rfpEvents = filteredEvents.filter(
      (e) => e.eventType === 'rfp_research_completed' || e.eventType === 'rfp_research_failed'
    );
    const successfulRFP = rfpEvents.filter((e) => e.success);
    const questionEvents = filteredEvents.filter((e) => e.eventType === 'question_extracted');
    const answerEvents = filteredEvents.filter((e) => e.eventType === 'answer_generated');
    const knowledgeSearchEvents = filteredEvents.filter((e) => e.eventType === 'knowledge_search');
    const webSearchEvents = filteredEvents.filter((e) => e.eventType === 'web_search');
    const exportEvents = filteredEvents.filter((e) => e.eventType === 'export');
    const errorEvents = filteredEvents.filter((e) => e.eventType === 'error' || !e.success);
    const tokenEvents = filteredEvents.filter((e) => e.eventType === 'ai_tokens_consumed');
    const meetingEvents = filteredEvents.filter((e) => e.eventType === 'meeting_analysis_completed');
    const accountEvents = filteredEvents.filter((e) => e.eventType === 'account_research_completed');
    const dealEvents = filteredEvents.filter((e) =>
      e.eventType === 'deal_created' || e.eventType === 'deal_updated' || e.eventType === 'deal_stage_changed'
    );

    // Calculate averages
    const durations = filteredEvents.filter((e) => e.duration).map((e) => e.duration!);
    const avgProcessingTime = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

    const confidenceScores = answerEvents
      .filter((e) => e.metadata?.confidence)
      .map((e) => {
        const conf = e.metadata?.confidence;
        return conf === 'high' ? 0.85 : conf === 'medium' ? 0.6 : 0.35;
      });
    const avgConfidence = confidenceScores.length > 0
      ? confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length
      : 0;

    // Build time series
    const timeSeries = this.buildTimeSeries(filteredEvents, startDate, endDate, bucketSize);

    // Category breakdown
    const categoryBreakdown: Record<string, number> = {};
    filteredEvents.forEach((e) => {
      categoryBreakdown[e.category] = (categoryBreakdown[e.category] || 0) + 1;
    });

    // Confidence distribution
    const confidenceDistribution = { high: 0, medium: 0, low: 0 };
    answerEvents.forEach((e) => {
      const conf = e.metadata?.confidence as 'high' | 'medium' | 'low';
      if (conf && confidenceDistribution[conf] !== undefined) {
        confidenceDistribution[conf]++;
      }
    });

    // Error breakdown
    const errorBreakdown: Record<string, number> = {};
    errorEvents.forEach((e) => {
      const errorType = e.metadata?.errorMessage?.substring(0, 50) || e.action || 'unknown';
      errorBreakdown[errorType] = (errorBreakdown[errorType] || 0) + 1;
    });

    // Top actions
    const actionCounts: Record<string, number> = {};
    filteredEvents.forEach((e) => {
      actionCounts[e.action] = (actionCounts[e.action] || 0) + 1;
    });
    const topActions = Object.entries(actionCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([action, count]) => ({ action, count }));

    // Calculate KPIs
    const kpis = this.calculateKPIs(filteredEvents);

    return {
      period: {
        start: startDate,
        end: endDate,
        bucketSize,
      },
      summary: {
        totalEvents: filteredEvents.length,
        totalRFPResearch: rfpEvents.length,
        successfulRFPResearch: successfulRFP.length,
        failedRFPResearch: rfpEvents.length - successfulRFP.length,
        totalQuestionsExtracted: questionEvents.reduce((sum, e) => sum + (e.value || 0), 0),
        totalAnswersGenerated: answerEvents.length,
        avgProcessingTimeMs: Math.round(avgProcessingTime),
        avgConfidenceScore: Math.round(avgConfidence * 100) / 100,
        totalKnowledgeSearches: knowledgeSearchEvents.length,
        totalWebSearches: webSearchEvents.length,
        totalExports: exportEvents.length,
        totalAITokens: tokenEvents.reduce((sum, e) => sum + (e.value || 0), 0),
        totalMeetingsAnalyzed: meetingEvents.length,
        totalAccountsResearched: accountEvents.length,
        totalDealsUpdated: dealEvents.length,
      },
      timeSeries,
      categoryBreakdown,
      confidenceDistribution,
      errorBreakdown,
      topActions,
      kpis,
    };
  }

  /**
   * Build time series data
   */
  private buildTimeSeries(
    events: MetricEvent[],
    startDate: Date,
    endDate: Date,
    bucketSize: 'hour' | 'day' | 'week'
  ): TimeSeriesData[] {
    const buckets: Map<string, MetricEvent[]> = new Map();

    // Determine bucket interval in ms
    const bucketMs = bucketSize === 'hour' ? 3600000 : bucketSize === 'day' ? 86400000 : 604800000;

    // Group events into buckets
    events.forEach((event) => {
      const bucketTime = Math.floor(event.timestamp.getTime() / bucketMs) * bucketMs;
      const key = new Date(bucketTime).toISOString();

      if (!buckets.has(key)) {
        buckets.set(key, []);
      }
      buckets.get(key)!.push(event);
    });

    // Generate all buckets in range
    const result: TimeSeriesData[] = [];
    let currentTime = Math.floor(startDate.getTime() / bucketMs) * bucketMs;

    while (currentTime <= endDate.getTime()) {
      const key = new Date(currentTime).toISOString();
      const bucketEvents = buckets.get(key) || [];

      const rfpEvents = bucketEvents.filter(
        (e) => e.eventType === 'rfp_research_completed' || e.eventType === 'rfp_research_failed'
      );
      const questionEvents = bucketEvents.filter((e) => e.eventType === 'question_extracted');
      const answerEvents = bucketEvents.filter((e) => e.eventType === 'answer_generated');
      const errorEvents = bucketEvents.filter((e) => !e.success || e.eventType === 'error');
      const tokenEvents = bucketEvents.filter((e) => e.eventType === 'ai_tokens_consumed');
      const meetingEvents = bucketEvents.filter((e) => e.eventType === 'meeting_analysis_completed');

      const durations = bucketEvents.filter((e) => e.duration).map((e) => e.duration!);
      const avgDuration = durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0;

      const confidenceScores = answerEvents
        .filter((e) => e.metadata?.confidence)
        .map((e) => {
          const conf = e.metadata?.confidence;
          return conf === 'high' ? 0.85 : conf === 'medium' ? 0.6 : 0.35;
        });
      const avgConfidence = confidenceScores.length > 0
        ? confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length
        : 0;

      result.push({
        timestamp: new Date(currentTime),
        eventCount: bucketEvents.length,
        rfpCount: rfpEvents.length,
        questionsExtracted: questionEvents.reduce((sum, e) => sum + (e.value || 0), 0),
        answersGenerated: answerEvents.length,
        avgDuration: Math.round(avgDuration),
        errorCount: errorEvents.length,
        aiTokens: tokenEvents.reduce((sum, e) => sum + (e.value || 0), 0),
        meetingsAnalyzed: meetingEvents.length,
        avgConfidence: Math.round(avgConfidence * 100) / 100,
      });

      currentTime += bucketMs;
    }

    return result;
  }

  /**
   * Calculate trend percentage
   */
  private calculateTrend(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  }

  /**
   * Get dashboard metrics for real-time display
   */
  getDashboardMetrics(): DashboardMetrics {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86400000);
    const twoDaysAgo = new Date(today.getTime() - 2 * 86400000);
    const last7Days = new Date(today.getTime() - 7 * 86400000);
    const last14Days = new Date(today.getTime() - 14 * 86400000);

    const todayEvents = this.events.filter((e) => e.timestamp >= today);
    const yesterdayEvents = this.events.filter((e) => e.timestamp >= yesterday && e.timestamp < today);

    // Today's metrics
    const rfpToday = todayEvents.filter(
      (e) => e.eventType === 'rfp_research_completed' || e.eventType === 'rfp_research_failed'
    );
    const successToday = rfpToday.filter((e) => e.success);
    const questionsToday = todayEvents
      .filter((e) => e.eventType === 'question_extracted')
      .reduce((sum, e) => sum + (e.value || 0), 0);
    const answersToday = todayEvents.filter((e) => e.eventType === 'answer_generated');
    const meetingsToday = todayEvents.filter((e) => e.eventType === 'meeting_analysis_completed').length;
    const tokensToday = todayEvents
      .filter((e) => e.eventType === 'ai_tokens_consumed')
      .reduce((sum, e) => sum + (e.value || 0), 0);

    // Yesterday's metrics for trends
    const rfpYesterday = yesterdayEvents.filter(
      (e) => e.eventType === 'rfp_research_completed' || e.eventType === 'rfp_research_failed'
    ).length;
    const answersYesterday = yesterdayEvents.filter((e) => e.eventType === 'answer_generated').length;
    const tokensYesterday = yesterdayEvents
      .filter((e) => e.eventType === 'ai_tokens_consumed')
      .reduce((sum, e) => sum + (e.value || 0), 0);

    const durationsToday = todayEvents.filter((e) => e.duration).map((e) => e.duration!);
    const avgResponseTime = durationsToday.length > 0
      ? durationsToday.reduce((a, b) => a + b, 0) / durationsToday.length
      : 0;

    // Calculate average confidence for today
    const confidenceScores = answersToday
      .filter((e) => e.metadata?.confidence)
      .map((e) => {
        const conf = e.metadata?.confidence;
        return conf === 'high' ? 0.85 : conf === 'medium' ? 0.6 : 0.35;
      });
    const avgConfidence = confidenceScores.length > 0
      ? confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length
      : 0;
    const confidenceYesterday = yesterdayEvents
      .filter((e) => e.eventType === 'answer_generated' && e.metadata?.confidence)
      .map((e) => {
        const conf = e.metadata?.confidence;
        return conf === 'high' ? 0.85 : conf === 'medium' ? 0.6 : 0.35;
      });
    const avgConfidenceYesterday = confidenceYesterday.length > 0
      ? confidenceYesterday.reduce((a, b) => a + b, 0) / confidenceYesterday.length
      : 0;

    // Feature usage with trends
    const last7DaysEvents = this.events.filter((e) => e.timestamp >= last7Days);
    const previousWeekEvents = this.events.filter((e) => e.timestamp >= last14Days && e.timestamp < last7Days);

    const featureCounts = new Map<string, { current: number; previous: number }>();
    const features = ['rfp_research', 'meeting_intelligence', 'account_research', 'deal_management',
                      'proposal_generation', 'ppt_generation', 'ai_assistant', 'knowledge_search'];

    features.forEach(feature => {
      const current = last7DaysEvents.filter(e => e.category === feature).length;
      const previous = previousWeekEvents.filter(e => e.category === feature).length;
      featureCounts.set(feature, { current, previous });
    });

    const topFeatures = Array.from(featureCounts.entries())
      .map(([feature, counts]) => ({
        feature,
        count: counts.current,
        trend: this.calculateTrend(counts.current, counts.previous),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Recent errors
    const recentErrors = this.events
      .filter(e => e.eventType === 'error' || !e.success)
      .slice(-100);

    const errorCounts = new Map<string, { count: number; lastOccurred: Date }>();
    recentErrors.forEach(e => {
      const msg = e.label || e.metadata?.errorMessage?.substring(0, 50) || 'Unknown error';
      const existing = errorCounts.get(msg);
      if (existing) {
        existing.count++;
        if (e.timestamp > existing.lastOccurred) {
          existing.lastOccurred = e.timestamp;
        }
      } else {
        errorCounts.set(msg, { count: 1, lastOccurred: e.timestamp });
      }
    });

    const recentErrorsList = Array.from(errorCounts.entries())
      .map(([message, data]) => ({ message, ...data }))
      .sort((a, b) => b.lastOccurred.getTime() - a.lastOccurred.getTime())
      .slice(0, 5);

    return {
      current: {
        activeResearches: this.activeResearches.size,
        activeMeetingAnalyses: this.activeMeetingAnalyses.size,
        todayRFPCount: rfpToday.length,
        todayQuestionCount: questionsToday,
        todayAnswerCount: answersToday.length,
        todayMeetingsAnalyzed: meetingsToday,
        todayAITokens: tokensToday,
        avgResponseTime: Math.round(avgResponseTime),
        successRate: rfpToday.length > 0 ? (successToday.length / rfpToday.length) * 100 : 100,
        avgConfidenceScore: Math.round(avgConfidence * 100) / 100,
      },
      trends: {
        rfpTrend: this.calculateTrend(rfpToday.length, rfpYesterday),
        answersTrend: this.calculateTrend(answersToday.length, answersYesterday),
        confidenceTrend: this.calculateTrend(avgConfidence * 100, avgConfidenceYesterday * 100),
        tokensTrend: this.calculateTrend(tokensToday, tokensYesterday),
      },
      last24Hours: this.getAggregatedMetrics(yesterday, now, 'hour'),
      last7Days: this.getAggregatedMetrics(last7Days, now, 'day'),
      last30Days: this.getAggregatedMetrics(new Date(today.getTime() - 30 * 86400000), now, 'day'),
      recentEvents: this.events.slice(-50).reverse(),
      topFeatures,
      recentErrors: recentErrorsList,
    };
  }

  /**
   * Get events for log explorer (like Kibana Discover)
   */
  getEvents(options: {
    startDate?: Date;
    endDate?: Date;
    eventTypes?: MetricEventType[];
    categories?: string[];
    searchQuery?: string;
    limit?: number;
    offset?: number;
  }): { events: MetricEvent[]; total: number } {
    let filtered = [...this.events];

    if (options.startDate) {
      filtered = filtered.filter((e) => e.timestamp >= options.startDate!);
    }
    if (options.endDate) {
      filtered = filtered.filter((e) => e.timestamp <= options.endDate!);
    }
    if (options.eventTypes && options.eventTypes.length > 0) {
      filtered = filtered.filter((e) => options.eventTypes!.includes(e.eventType));
    }
    if (options.categories && options.categories.length > 0) {
      filtered = filtered.filter((e) => options.categories!.includes(e.category));
    }
    if (options.searchQuery) {
      const query = options.searchQuery.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.action.toLowerCase().includes(query) ||
          e.category.toLowerCase().includes(query) ||
          (e.label && e.label.toLowerCase().includes(query)) ||
          JSON.stringify(e.metadata || {}).toLowerCase().includes(query) ||
          JSON.stringify(e.context || {}).toLowerCase().includes(query)
      );
    }

    // Sort by timestamp descending
    filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const total = filtered.length;
    const offset = options.offset || 0;
    const limit = options.limit || 100;

    return {
      events: filtered.slice(offset, offset + limit),
      total,
    };
  }

  /**
   * Get detailed logs
   */
  getDetailedLogs(options: {
    startDate?: Date;
    endDate?: Date;
    levels?: ('debug' | 'info' | 'warn' | 'error')[];
    sources?: string[];
    searchQuery?: string;
    limit?: number;
    offset?: number;
  }): { logs: DetailedLogEntry[]; total: number } {
    let filtered = [...this.detailedLogs];

    if (options.startDate) {
      filtered = filtered.filter((l) => l.timestamp >= options.startDate!);
    }
    if (options.endDate) {
      filtered = filtered.filter((l) => l.timestamp <= options.endDate!);
    }
    if (options.levels && options.levels.length > 0) {
      filtered = filtered.filter((l) => options.levels!.includes(l.level));
    }
    if (options.sources && options.sources.length > 0) {
      filtered = filtered.filter((l) => options.sources!.includes(l.source));
    }
    if (options.searchQuery) {
      const query = options.searchQuery.toLowerCase();
      filtered = filtered.filter(
        (l) =>
          l.message.toLowerCase().includes(query) ||
          l.source.toLowerCase().includes(query) ||
          JSON.stringify(l.context).toLowerCase().includes(query)
      );
    }

    // Sort by timestamp descending
    filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const total = filtered.length;
    const offset = options.offset || 0;
    const limit = options.limit || 100;

    return {
      logs: filtered.slice(offset, offset + limit),
      total,
    };
  }

  /**
   * Get token usage summary
   */
  getTokenUsage(): { promptTokens: number; completionTokens: number; totalTokens: number } {
    return { ...this.tokenUsage };
  }

  /**
   * Clear all events (for testing)
   */
  clearEvents(): void {
    this.events = [];
    this.detailedLogs = [];
    this.activeResearches.clear();
    this.activeMeetingAnalyses.clear();
    this.activeAccountResearches.clear();
    this.tokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  }
}

// Singleton instance
let metricsServiceInstance: MetricsService | null = null;

export function getMetricsService(): MetricsService {
  if (!metricsServiceInstance) {
    metricsServiceInstance = new MetricsService();
    // Load historical events from DB (fire-and-forget)
    metricsServiceInstance.initFromDatabase().catch(() => {});
  }
  return metricsServiceInstance;
}
