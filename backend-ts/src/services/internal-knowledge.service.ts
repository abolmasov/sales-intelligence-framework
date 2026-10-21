import axios from 'axios';

/**
 * Lightweight company profile extracted from public sources before the InternalKnowledge search.
 * Used to enrich query strings with specific, contextual terms so InternalKnowledge returns
 * more targeted documents rather than broad keyword matches.
 */
export interface CompanyContext {
  industry?: string;        // e.g. "financial services", "healthcare", "retail"
  size?: string;            // e.g. "enterprise (50k+)", "mid-market (500-5k)"
  techStack?: string[];     // e.g. ["Jira", "ServiceNow", "AWS", "Salesforce"]
  knownInitiatives?: string[]; // e.g. ["SAFe transformation", "cloud migration"]
  painPoints?: string[];    // e.g. ["slow release cycles", "tech debt", "M&A integration"]
}

/**
 * InternalKnowledge Document — compatible interface preserved for all existing callers.
 * Now populated from the Sales Intelligence Search API.
 */
export interface InternalKnowledgeDocument {
  id: string;
  title: string;
  content: string;
  url?: string;
  relevanceScore: number;
  documentType?: string;
  metadata?: any;
}

/**
 * Progress tracking — simplified now that we use a single HTTP POST
 * instead of a long-lived streaming session.
 */
export interface InternalKnowledgeProgress {
  status: 'idle' | 'signing_in' | 'creating_session' | 'streaming' | 'complete' | 'error';
  sessionId?: string;
  elapsedSeconds: number;
  messagesCollected: number;
  referencesCollected: number;
  eventsReceived: number;
  firstMessageAt?: number;
  lastUpdate: string;
}

interface InternalKnowledgeSearchPayload {
  input: string;
  sources: string[];
  useAlwaysTopicSearch?: boolean;
  onlyDocuments?: boolean;
  classificationModel?: string;
  answerModel?: string;
  topK?: number;
  topicsTopK?: number;
  minScore?: number;
}

interface CustomerDataSearchPayload {
  userId: string;
  input?: string;
  type: 'pre-call' | 'post-call';
  customer: string;
  classificationModel?: string;
  evaluationModel?: string;
  excludeDocumentTypes: string[];
  sources: string[];
}

interface CustomerDataSearchResultPayload {
  documents?: any[];
  executionDurationMs?: number | null;
  selectionBatchCount?: number | null;
}

const SALES_INTEL_BASE_URL =
  (process.env.SALES_INTELLIGENCE_API_URL || 'https://api.example.com/internal-knowledge').replace(/\/+$/, '');
const SALES_INTEL_KEY = process.env.SALES_INTELLIGENCE_KEY || '';
const SALES_INTEL_SEARCH_PATH = process.env.SALES_INTELLIGENCE_SEARCH_PATH || '/v1/agent/sales-intelligence-search';
const SALES_INTEL_CUSTOMER_DATA_SEARCH_PATH =
  process.env.SALES_INTELLIGENCE_CUSTOMER_DATA_SEARCH_PATH ||
  process.env.SALES_INTELLIGENCE_FACET_SEARCH_PATH ||
  '/v1/customer-data-search';
const KMHUB_USE_CUSTOMER_DATA_SEARCH_PRECALL = /^(1|true|yes)$/i.test(
  process.env.KMHUB_USE_CUSTOMER_DATA_SEARCH_PRECALL ||
  process.env.KMHUB_USE_FACET_SEARCH_PRECALL ||
  ''
);
const KMHUB_CUSTOMER_DATA_SEARCH_TIMEOUT_MS = Number(
  process.env.KMHUB_CUSTOMER_DATA_SEARCH_TIMEOUT_MS ||
  process.env.KMHUB_FACET_SEARCH_TIMEOUT_MS ||
  120000
);
const KMHUB_CUSTOMER_DATA_SEARCH_POLL_MS = Number(
  process.env.KMHUB_CUSTOMER_DATA_SEARCH_POLL_MS ||
  process.env.KMHUB_FACET_SEARCH_POLL_MS ||
  3000
);
const KMHUB_CUSTOMER_DATA_SEARCH_SOURCES = (
  process.env.KMHUB_CUSTOMER_DATA_SEARCH_SOURCES ||
  process.env.SALES_INTELLIGENCE_SOURCES ||
  'internal-kb'
)
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const KMHUB_CUSTOMER_DATA_SEARCH_EXCLUDE_DOCUMENT_TYPES = (
  process.env.KMHUB_CUSTOMER_DATA_SEARCH_EXCLUDE_DOCUMENT_TYPES || ''
)
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const KMHUB_CUSTOMER_DATA_SEARCH_USER_ID = process.env.KMHUB_CUSTOMER_DATA_SEARCH_USER_ID || 'internal-kb-service';
const KMHUB_CUSTOMER_DATA_SEARCH_CLASSIFICATION_MODEL =
  process.env.KMHUB_CUSTOMER_DATA_SEARCH_CLASSIFICATION_MODEL || 'gpt-4.1-mini';
const KMHUB_CUSTOMER_DATA_SEARCH_EVALUATION_MODEL =
  process.env.KMHUB_CUSTOMER_DATA_SEARCH_EVALUATION_MODEL || 'gpt-4.1';
const KMHUB_CUSTOMER_DATA_SEARCH_MIN_SCORE = Number(process.env.KMHUB_CUSTOMER_DATA_SEARCH_MIN_SCORE || 0);
const KMHUB_CUSTOMER_DATA_SEARCH_ACCEPTED_RETRY_MS = 15000;

/**
 * Sales Intelligence Search service.
 *
 * Replaces the old InternalKnowledge streaming service with a simple POST-based RAG pipeline
 * (POST /api/v1/agent/sales-intelligence-search). All method signatures are
 * backwards-compatible — the `accessToken` parameter is accepted but no longer
 * used, since the new API authenticates via a shared API key.
 */
export class InternalKnowledgeService {
  private currentProgress: InternalKnowledgeProgress = {
    status: 'idle',
    elapsedSeconds: 0,
    messagesCollected: 0,
    referencesCollected: 0,
    eventsReceived: 0,
    lastUpdate: new Date().toISOString(),
  };

  getProgress(): InternalKnowledgeProgress {
    return { ...this.currentProgress };
  }

  private resetProgress(): void {
    this.currentProgress = {
      status: 'idle',
      elapsedSeconds: 0,
      messagesCollected: 0,
      referencesCollected: 0,
      eventsReceived: 0,
      lastUpdate: new Date().toISOString(),
    };
  }

  private updateProgress(updates: Partial<InternalKnowledgeProgress>): void {
    this.currentProgress = {
      ...this.currentProgress,
      ...updates,
      lastUpdate: new Date().toISOString(),
    };
  }

  private getApiUrl(path: string): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${SALES_INTEL_BASE_URL}${normalizedPath}`;
  }

  private getRequestHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-sales-intelligence-key': SALES_INTEL_KEY,
    };
  }

  private normalizeDocument(doc: any, index: number, source: string): InternalKnowledgeDocument {
    const meta = doc.record?.metadata || doc.metadata || doc;
    const rawId = meta._id || doc.record?.id || doc._id || doc.id || `${source}-${index}`;
    const rawPath: string = meta.path || doc.path || '';
    const pathTitle = rawPath
      .split('/')
      .pop()
      ?.replace(/\.(md|docx|pdf|pptx)$/i, '')
      .replace(/-/g, ' ')
      .replace(/#.*$/, '')
      .replace(/\b\w/g, (c: string) => c.toUpperCase())
      .trim() || 'Untitled Document';
    const title = meta.title || doc.title || pathTitle;
    const content = meta.text || doc.content || doc.summary || '';
    const topics: string[] = Array.isArray(meta.topics)
      ? meta.topics
      : Array.isArray(meta.tags)
        ? meta.tags
        : [];
    const summary = typeof doc.summary === 'string' && doc.summary.trim()
      ? doc.summary.trim()
      : topics[0] || content.substring(0, 200);

    return {
      id: rawId,
      title,
      content,
      url: meta.referenceUrl || doc.referenceUrl || undefined,
      relevanceScore: doc.score ?? doc.relevanceScore ?? 0.85,
      documentType: meta.documentType || doc.documentType || doc.type || 'document',
      metadata: {
        source,
        summary,
        _id: rawId,
        path: rawPath,
        topics,
        customers: meta.customers || doc.customers || [],
        selectReason: doc.selectReason,
        evaluationReason: doc.evaluationReason,
      },
    };
  }

  private buildFacetSummary(documents: InternalKnowledgeDocument[]): string {
    if (!documents.length) return '';

    const bullets = documents.slice(0, 6).map((doc) => {
      const reasons = [doc.metadata?.selectReason, doc.metadata?.evaluationReason]
        .filter((value: unknown): value is string => typeof value === 'string' && value.trim().length > 0)
        .join(' ');
      return `- ${doc.title}: ${reasons || doc.metadata?.summary || 'Relevant internal document identified.'}`;
    });

    return ['## Internal Knowledge Findings', ...bullets].join('\n');
  }

  private buildPreCallCustomerDataSearchInput(params: {
    companyName: string;
    meetingContext?: string;
    externalAttendees?: Array<{ name?: string; email?: string; company?: string }>;
    companyContext?: CompanyContext;
  }): string {
    const { companyName, meetingContext, externalAttendees, companyContext } = params;

    const attendeeNames = (externalAttendees || [])
      .map((attendee) => attendee.name?.trim())
      .filter((value): value is string => Boolean(value));

    const focusAreas = [
      ...(companyContext?.knownInitiatives || []).slice(0, 4),
      ...(companyContext?.painPoints || []).slice(0, 4),
      ...(companyContext?.techStack || []).slice(0, 4),
    ].filter(Boolean);

    const inputParts = [
      `What are the solutions we delivered for ${companyName}?`,
      meetingContext?.trim() ? `Meeting context: ${meetingContext.trim().substring(0, 800)}` : null,
      attendeeNames.length ? `Attendees: ${attendeeNames.slice(0, 8).join(', ')}` : null,
      companyContext?.industry ? `Industry: ${companyContext.industry}` : null,
      companyContext?.size ? `Company size: ${companyContext.size}` : null,
      focusAreas.length ? `Focus areas: ${focusAreas.join(', ')}` : null,
    ].filter(Boolean);

    return inputParts.join('\n');
  }

  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async startCustomerDataSearch(payload: CustomerDataSearchPayload): Promise<string> {
    const response = await axios.post(
      this.getApiUrl(SALES_INTEL_CUSTOMER_DATA_SEARCH_PATH),
      payload,
      {
        headers: this.getRequestHeaders(),
        timeout: Math.min(KMHUB_CUSTOMER_DATA_SEARCH_TIMEOUT_MS, 30000),
      }
    );

    if (response.data?.error) {
      throw new Error(response.data.error?.message || response.data.error);
    }

    const requestId = response.data?.data?.requestId;
    if (!requestId) {
      throw new Error('Customer data search did not return requestId');
    }

    return String(requestId);
  }

  private async getCustomerDataSearchResult(
    requestId: string,
    minScore?: number
  ): Promise<{
    documents: InternalKnowledgeDocument[];
    rawReferences: any[];
    isComplete: boolean;
    statusCode: number;
    executionDurationMs: number | null;
    selectionBatchCount: number | null;
  }> {
    const params = new URLSearchParams();
    if (typeof minScore === 'number' && Number.isFinite(minScore)) {
      params.set('minScore', String(minScore));
    }

    const path = `${SALES_INTEL_CUSTOMER_DATA_SEARCH_PATH}/${encodeURIComponent(requestId)}`;
    const response = await axios.get(
      this.getApiUrl(params.toString() ? `${path}?${params.toString()}` : path),
      {
        headers: this.getRequestHeaders(),
        timeout: Math.min(KMHUB_CUSTOMER_DATA_SEARCH_POLL_MS + 5000, 15000),
      }
    );

    if (response.data?.error) {
      throw new Error(response.data.error?.message || response.data.error);
    }

    const data = (response.data?.data || {}) as CustomerDataSearchResultPayload;
    const documents = (data.documents || []).map((doc: any, index: number) =>
      this.normalizeDocument(doc, index, 'CustomerDataSearch')
    );
    const executionDurationMs = data.executionDurationMs ?? null;
    const selectionBatchCount = data.selectionBatchCount ?? null;
    const statusCode = response.status;
    const isComplete = statusCode === 200;

    return {
      documents,
      rawReferences: data.documents || [],
      isComplete,
      statusCode,
      executionDurationMs,
      selectionBatchCount,
    };
  }

  private async searchViaCustomerDataSearch(
    query: string,
    options?: {
      classificationModel?: string;
      evaluationModel?: string;
      timeoutMs?: number;
      pollMs?: number;
      userId?: string;
      customer?: string;
      type?: 'pre-call' | 'post-call';
      sources?: string[];
      excludeDocumentTypes?: string[];
      minScore?: number;
    }
  ): Promise<{ documents: InternalKnowledgeDocument[]; summary: string; rawMessages: string[]; rawReferences: any[] }> {
    const startTime = Date.now();
    const timeoutMs = options?.timeoutMs ?? KMHUB_CUSTOMER_DATA_SEARCH_TIMEOUT_MS;
    const pollMs = options?.pollMs ?? KMHUB_CUSTOMER_DATA_SEARCH_POLL_MS;
    const payload: CustomerDataSearchPayload = {
      userId: options?.userId || KMHUB_CUSTOMER_DATA_SEARCH_USER_ID,
      input: query,
      type: options?.type || 'pre-call',
      customer: options?.customer || '',
      classificationModel: options?.classificationModel,
      evaluationModel: options?.evaluationModel,
      excludeDocumentTypes: options?.excludeDocumentTypes ?? KMHUB_CUSTOMER_DATA_SEARCH_EXCLUDE_DOCUMENT_TYPES,
      sources: options?.sources ?? KMHUB_CUSTOMER_DATA_SEARCH_SOURCES,
    };

    this.updateProgress({ status: 'streaming' });
    console.log(
      '📦 Customer data search payload:',
      JSON.stringify(payload)
    );

    const requestId = await this.startCustomerDataSearch(payload);

    this.updateProgress({ sessionId: requestId });
    console.log(`🚀 Customer data search started for InternalKnowledge pre-call enrichment (requestId=${requestId})`);

    let attempts = 0;
    while (Date.now() - startTime < timeoutMs) {
      attempts += 1;
      const result = await this.getCustomerDataSearchResult(requestId, options?.minScore);

      if (result.isComplete) {
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        const summary = this.buildFacetSummary(result.documents);
        this.updateProgress({
          status: 'complete',
          elapsedSeconds: elapsed,
          messagesCollected: summary ? 1 : 0,
          referencesCollected: result.documents.length,
          eventsReceived: attempts + 1,
        });
        console.log(
          `✅ Customer data search completed in ${elapsed}s after ${attempts} poll(s) with ${result.documents.length} documents ` +
          `(selectionBatchCount=${result.selectionBatchCount ?? 'n/a'}, executionDurationMs=${result.executionDurationMs ?? 'n/a'})`
        );
        return {
          documents: result.documents,
          summary,
          rawMessages: summary ? [summary] : [],
          rawReferences: result.rawReferences,
        };
      }

      if (result.statusCode === 202) {
        console.log(
          `⏳ Customer data search still processing (requestId=${requestId}, poll=${attempts}, status=202). ` +
          `Polling again in ${KMHUB_CUSTOMER_DATA_SEARCH_ACCEPTED_RETRY_MS / 1000}s`
        );
        await this.delay(KMHUB_CUSTOMER_DATA_SEARCH_ACCEPTED_RETRY_MS);
        continue;
      }

      console.log(
        `⏳ Customer data search returned non-final status (requestId=${requestId}, poll=${attempts}, status=${result.statusCode}). ` +
        `Polling again in ${pollMs / 1000}s`
      );
      await this.delay(pollMs);
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    this.updateProgress({ status: 'error', elapsedSeconds: elapsed, eventsReceived: attempts + 1 });
    throw new Error(`Customer data search timed out after ${elapsed}s`);
  }

  /**
   * Core search method — wraps the Sales Intelligence Search API.
   */
  private async search(
    input: string,
    sources: string[] = [],
    options?: {
      topK?: number;
      topicsTopK?: number;
      minScore?: number;
      useAlwaysTopicSearch?: boolean;
      classificationModel?: string;
      answerModel?: string;
    }
  ): Promise<{ content: string; documents: InternalKnowledgeDocument[]; referenceUrls: Array<{ title: string; referenceUrl: string }> }> {
    const startTime = Date.now();
    this.updateProgress({ status: 'streaming' });

    try {
      const payload: InternalKnowledgeSearchPayload = {
        input,
        sources,
        onlyDocuments: true,
        topK: options?.topK ?? 5,
        topicsTopK: options?.topicsTopK ?? 5,
        minScore: options?.minScore ?? 5,
        useAlwaysTopicSearch: options?.useAlwaysTopicSearch ?? false,
        classificationModel: options?.classificationModel,
        answerModel: options?.answerModel,
      };

      const response = await axios.post(
        this.getApiUrl(SALES_INTEL_SEARCH_PATH),
        payload,
        {
          headers: this.getRequestHeaders(),
          timeout: 120_000,
        }
      );

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      const data = response.data?.data || {};
      const elapsed = Math.round((Date.now() - startTime) / 1000);

      const documents: InternalKnowledgeDocument[] = (data.documents || []).map((doc: any, index: number) =>
        this.normalizeDocument(doc, index, 'SalesIntelligence')
      );

      this.updateProgress({
        status: 'complete',
        elapsedSeconds: elapsed,
        messagesCollected: data.content ? 1 : 0,
        referencesCollected: documents.length,
        eventsReceived: 1,
      });

      console.log(
        `✅ Sales Intelligence Search: ${documents.length} documents in ${elapsed}s`
      );

      return {
        content: data.content || '',
        documents,
        referenceUrls: data.referenceUrls || [],
      };
    } catch (error: any) {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      this.updateProgress({ status: 'error', elapsedSeconds: elapsed });
      console.error('❌ Sales Intelligence Search failed:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Search with full research content — used by transcript analysis pipeline.
   * Runs THREE parallel searches covering different angles, then deduplicates.
   *   1. Direct company / prior engagement lookup
   *   2. Pain-point & opportunity matching from transcript themes
   *   3. Service/product alignment — proposals, SOWs, playbooks
   */
  async searchWithResearchContent(
    companyName: string,
    researchContent: string,
    _accessToken?: string,
    _options?: { shouldAbort?: () => boolean | Promise<boolean> }
  ): Promise<{ documents: InternalKnowledgeDocument[]; summary: string; rawMessages: string[]; rawReferences: any[] }> {
    this.resetProgress();
    try {
      console.log(`\n🔍 Sales Intelligence Search (transcript, 3-query) for "${companyName}"...`);

      const ctx = researchContent.substring(0, 2000);

      const [r1, r2, r3] = await Promise.allSettled([

        // 1. Direct company history — has Northstar Integrators worked with them before?
        this.search(
          `Has Northstar Integrators worked with ${companyName} before? Find any prior direct engagements, contracts, ` +
          `projects, or interactions. Surface all evidence of past or current relationship. ` +
          `Context: ${ctx.substring(0, 800)}`,
          [],
          { topK: 12, minScore: 3 }
        ),

        // 2. Pain-point & opportunity matching based on transcript themes
        this.search(
          `Find Northstar Integrators case studies and success stories that match the pain points and opportunities ` +
          `discussed with ${companyName}. Focus on similar transformation challenges, technology pain points, ` +
          `agile maturity, DevOps, Atlassian, ServiceNow, AI adoption, and scaling issues. ` +
          `Transcript context: ${ctx.substring(0, 1000)}`,
          [],
          { topK: 15, minScore: 3, useAlwaysTopicSearch: true }
        ),

        // 3. Service/solution alignment — proposals, SOWs, playbooks
        this.search(
          `Find the most relevant Northstar Integrators proposals, SOWs, playbooks, and enablement materials ` +
          `for positioning Northstar Integrators's value with ${companyName}. ` +
          `Context: ${ctx.substring(0, 600)}`,
          [],
          { topK: 10, minScore: 3, useAlwaysTopicSearch: true }
        ),
      ]);

      // Deduplicate by ID, sort by relevance
      const allDocs: InternalKnowledgeDocument[] = [];
      const allRefs: Array<{ title: string; referenceUrl: string }> = [];
      const seenIds = new Set<string>();
      let combinedContent = '';

      for (const result of [r1, r2, r3]) {
        if (result.status === 'fulfilled') {
          for (const doc of result.value.documents) {
            if (!seenIds.has(doc.id)) {
              seenIds.add(doc.id);
              allDocs.push(doc);
            }
          }
          for (const ref of result.value.referenceUrls) allRefs.push(ref);
          if (!combinedContent && result.value.content) combinedContent = result.value.content;
        }
      }

      allDocs.sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0));

      console.log(
        `✅ Multi-query transcript search: ${allDocs.length} unique documents ` +
        `(q1: ${r1.status === 'fulfilled' ? r1.value.documents.length : 'err'}, ` +
        `q2: ${r2.status === 'fulfilled' ? r2.value.documents.length : 'err'}, ` +
        `q3: ${r3.status === 'fulfilled' ? r3.value.documents.length : 'err'})`
      );

      this.updateProgress({ status: 'complete', referencesCollected: allDocs.length, messagesCollected: combinedContent ? 1 : 0, eventsReceived: 3 });

      return {
        documents: allDocs,
        summary: combinedContent,
        rawMessages: combinedContent ? [combinedContent] : [],
        rawReferences: allRefs,
      };
    } catch (error: any) {
      console.error('❌ searchWithResearchContent failed:', error.message);
      return { documents: [], summary: '', rawMessages: [], rawReferences: [] };
    }
  }

  /**
   * Search with structured sections — used by proposal generation pipeline.
   * Returns relevant proposals, SOWs, and case studies with structured detail.
   */
  async searchWithStructuredSections(
    companyName: string,
    researchContent: string,
    _accessToken?: string,
    _options?: { shouldAbort?: () => boolean | Promise<boolean> }
  ): Promise<{ documents: InternalKnowledgeDocument[]; summary: string; rawMessages: string[]; rawReferences: any[] }> {
    this.resetProgress();
    try {
      console.log(`\n🔍 Sales Intelligence Search (structured sections) for "${companyName}"...`);

      const context = researchContent.substring(0, 3000);

      const input =
        `Find the most relevant Northstar Integrators internal documents for a proposal targeting ${companyName}. ` +
        `Prioritise SOWs, proposals, case studies, and playbooks. ` +
        `For each document surface: executive summary, project scope, technical requirements, ` +
        `business requirements, cost considerations, timeline, and key deliverables. ` +
        `Company context: ${context}`;

      const result = await this.search(input, [], { topK: 10, minScore: 4, useAlwaysTopicSearch: true });

      return {
        documents: result.documents,
        summary: result.content,
        rawMessages: result.content ? [result.content] : [],
        rawReferences: result.referenceUrls,
      };
    } catch (error: any) {
      console.error('❌ searchWithStructuredSections failed:', error.message);
      return { documents: [], summary: '', rawMessages: [], rawReferences: [] };
    }
  }

  /**
   * Pre-call augmentation — runs THREE parallel searches covering different angles:
   *   1. Direct company history (prior Northstar Integrators ↔ company engagements)
   *   2. Analogous industry / challenge pattern matching
   *   3. Service & solution alignment (proposals, SOWs, playbooks)
   * Results are deduplicated by document ID and sorted by relevance score.
   */
  async searchPreCallAugmentation(
    companyName: string,
    meetingContext: string,
    externalAttendees: Array<{ name?: string; email?: string; company?: string }>,
    _accessToken?: string,
    _options?: { shouldAbort?: () => boolean | Promise<boolean> },
    companyContext?: CompanyContext
  ): Promise<{ documents: InternalKnowledgeDocument[]; summary: string; rawMessages: string[]; rawReferences: any[] }> {
    this.resetProgress();
    try {
      if (KMHUB_USE_CUSTOMER_DATA_SEARCH_PRECALL) {
        console.log(`\n🔍 Customer Data Search (pre-call) for "${companyName}"...`);
        try {
          const query = this.buildPreCallCustomerDataSearchInput({
            companyName,
            meetingContext,
            externalAttendees,
            companyContext,
          });

          console.log(
            '🧾 Pre-call customer-data-search input:',
            JSON.stringify({
              companyName,
              customer: companyName,
              meetingContext: meetingContext || '',
              externalAttendees,
              companyContext: companyContext || null,
              input: query,
            })
          );

          const facetResult = await this.searchViaCustomerDataSearch(query, {
            customer: companyName,
            type: 'pre-call',
            userId: KMHUB_CUSTOMER_DATA_SEARCH_USER_ID,
            classificationModel: KMHUB_CUSTOMER_DATA_SEARCH_CLASSIFICATION_MODEL,
            evaluationModel: KMHUB_CUSTOMER_DATA_SEARCH_EVALUATION_MODEL,
            excludeDocumentTypes: [],
            sources: [],
            minScore: KMHUB_CUSTOMER_DATA_SEARCH_MIN_SCORE,
          });

          if (facetResult.documents.length > 0) {
            return facetResult;
          }

          console.warn('⚠️ Customer data search returned no documents for pre-call; falling back to Sales Intelligence Search');
        } catch (error: any) {
          console.warn('⚠️ Customer data search failed for pre-call; falling back to Sales Intelligence Search:', error?.message || error);
        }
      }

      console.log(`\n🔍 Sales Intelligence Search (pre-call, 3-query) for "${companyName}"...`);
      if (companyContext && Object.keys(companyContext).length > 0) {
        console.log(`   Context enrichment: industry=${companyContext.industry || '?'}, size=${companyContext.size || '?'}, tech=[${(companyContext.techStack || []).join(', ')}]`);
      }

      const attendeeStr = (externalAttendees || [])
        .map((a) => [a.name, a.email, a.company].filter(Boolean).join(' | '))
        .filter(Boolean)
        .join('; ');

      const ctx = meetingContext ? meetingContext.substring(0, 800) : '';

      // ── Build context enrichment strings from quick company profile ──────
      const industryCtx = companyContext?.industry
        ? `${companyName} is in the ${companyContext.industry} industry. `
        : '';
      const sizeCtx = companyContext?.size
        ? `They are a ${companyContext.size} company. `
        : '';
      const techCtx = companyContext?.techStack?.length
        ? `Their known technology stack includes: ${companyContext.techStack.slice(0, 6).join(', ')}. `
        : '';
      const initiativesCtx = companyContext?.knownInitiatives?.length
        ? `Current strategic initiatives: ${companyContext.knownInitiatives.slice(0, 4).join(', ')}. `
        : '';
      const painCtx = companyContext?.painPoints?.length
        ? `Known pain points: ${companyContext.painPoints.slice(0, 4).join(', ')}. `
        : '';

      const enrichedProfile = industryCtx + sizeCtx + techCtx + initiativesCtx + painCtx;

      // ── Three complementary searches in parallel ───────────────────────
      const [r1, r2, r3] = await Promise.allSettled([

        // 1. Direct company relationship lookup — enriched with industry/size
        this.search(
          `Has Northstar Integrators worked with ${companyName} before? Find any prior direct engagements, contracts, ` +
          `projects, or interactions with ${companyName}. Surface all evidence of past or current relationship. ` +
          (enrichedProfile ? enrichedProfile : '') +
          (ctx ? `Meeting context: ${ctx}. ` : '') +
          (attendeeStr ? `Key attendees: ${attendeeStr}.` : ''),
          [],
          { topK: 12, minScore: 3 }
        ),

        // 2. Analogous industry & challenge pattern matching — enriched with tech/pain points
        this.search(
          `Find Northstar Integrators case studies, success stories, and past engagements most relevant to a ` +
          (companyContext?.industry ? `${companyContext.industry} company ` : 'company ') +
          `like ${companyName}. ` +
          (companyContext?.size ? `Focus on ${companyContext.size} organisations. ` : '') +
          (companyContext?.painPoints?.length
            ? `Target engagements addressing these challenges: ${companyContext.painPoints.slice(0, 4).join(', ')}. `
            : 'Include similar transformation journeys, business challenges, and pain points. ') +
          (companyContext?.techStack?.length
            ? `Prioritise results involving these technologies: ${companyContext.techStack.slice(0, 5).join(', ')}. `
            : 'Cover agile transformation, DevOps, Atlassian tools, SAFe, ServiceNow, AI adoption, cloud migration, and digital transformation. ') +
          (ctx ? `Context: ${ctx}.` : ''),
          [],
          { topK: 15, minScore: 3, useAlwaysTopicSearch: true }
        ),

        // 3. Service & solution alignment — proposals, SOWs, playbooks enriched with initiatives
        this.search(
          `Find the most relevant Northstar Integrators internal proposals, SOWs, statements of work, playbooks, ` +
          `and enablement materials for a pre-call meeting with ${companyName}. ` +
          (companyContext?.knownInitiatives?.length
            ? `They are currently focused on: ${companyContext.knownInitiatives.slice(0, 4).join(', ')}. Surface documents that align with these initiatives. `
            : 'Surface documents that would support positioning Northstar Integrators\'s value proposition and demonstrate expertise. ') +
          (companyContext?.techStack?.length
            ? `Relevant technology areas: ${companyContext.techStack.slice(0, 5).join(', ')}. `
            : '') +
          (ctx ? `Meeting purpose: ${ctx}.` : ''),
          [],
          { topK: 10, minScore: 3, useAlwaysTopicSearch: true }
        ),
      ]);

      // ── Deduplicate by ID, sort by relevance ──────────────────────────
      const allDocs: InternalKnowledgeDocument[] = [];
      const allRefs: Array<{ title: string; referenceUrl: string }> = [];
      const seenIds = new Set<string>();
      let combinedContent = '';

      for (const result of [r1, r2, r3]) {
        if (result.status === 'fulfilled') {
          for (const doc of result.value.documents) {
            if (!seenIds.has(doc.id)) {
              seenIds.add(doc.id);
              allDocs.push(doc);
            }
          }
          for (const ref of result.value.referenceUrls) {
            allRefs.push(ref);
          }
          if (!combinedContent && result.value.content) {
            combinedContent = result.value.content;
          }
        }
      }

      // Sort by relevance descending
      allDocs.sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0));

      console.log(
        `✅ Multi-query pre-call search: ${allDocs.length} unique documents ` +
        `(q1: ${r1.status === 'fulfilled' ? r1.value.documents.length : 'err'}, ` +
        `q2: ${r2.status === 'fulfilled' ? r2.value.documents.length : 'err'}, ` +
        `q3: ${r3.status === 'fulfilled' ? r3.value.documents.length : 'err'})`
      );

      this.updateProgress({
        status: 'complete',
        referencesCollected: allDocs.length,
        messagesCollected: combinedContent ? 1 : 0,
        eventsReceived: 3,
      });

      return {
        documents: allDocs,
        summary: combinedContent,
        rawMessages: combinedContent ? [combinedContent] : [],
        rawReferences: allRefs,
      };
    } catch (error: any) {
      this.updateProgress({ status: 'error' });
      console.error('❌ searchPreCallAugmentation failed:', error.message);
      return { documents: [], summary: '', rawMessages: [], rawReferences: [] };
    }
  }

  /**
   * Legacy document search — kept for backwards compatibility.
   * Uses broad Northstar Integrators service area query for the given company.
   */
  async searchRelevantDocuments(
    companyName: string,
    _accessToken?: string,
    _options?: { shouldAbort?: () => boolean | Promise<boolean> }
  ): Promise<{ documents: InternalKnowledgeDocument[]; summary: string; rawMessages: string[]; rawReferences: any[] }> {
    this.resetProgress();
    try {
      console.log(`\n🔍 Sales Intelligence Search (documents) for "${companyName}"...`);

      const input =
        `Find relevant Northstar Integrators knowledge base content for ${companyName} covering: ` +
        `agile transformation, DevOps and CI/CD, Atlassian tools (Jira, Confluence, Jira Align), ` +
        `cloud migration, ServiceNow ITSM, SAFe and enterprise agile coaching, ` +
        `digital transformation, and AI/data solutions. ` +
        `Include case studies, proposals, RFPs, SOWs, and enablement materials.`;

      const result = await this.search(input, [], { topK: 5, minScore: 5 });

      return {
        documents: result.documents,
        summary: result.content,
        rawMessages: result.content ? [result.content] : [],
        rawReferences: result.referenceUrls,
      };
    } catch (error: any) {
      console.error('❌ searchRelevantDocuments failed:', error.message);
      return { documents: [], summary: '', rawMessages: [], rawReferences: [] };
    }
  }
}

// Singleton instance
let internalKbServiceInstance: InternalKnowledgeService | null = null;

export function getInternalKnowledgeService(): InternalKnowledgeService {
  if (!internalKbServiceInstance) {
    internalKbServiceInstance = new InternalKnowledgeService();
  }
  return internalKbServiceInstance;
}
