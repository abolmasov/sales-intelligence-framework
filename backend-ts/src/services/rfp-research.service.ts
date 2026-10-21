import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import { getInternalKnowledgeService, InternalKnowledgeDocument } from './internal-knowledge.service';
import { getCaseStudyService } from './caseStudy.service';
import { getOpenAIService } from './openai.service';
import { getMetricsService } from './metrics.service';

/**
 * Log entry for RFP research progress
 */
export interface RFPLogEntry {
  timestamp: Date;
  level: 'info' | 'success' | 'warning' | 'error' | 'progress';
  stage: 'upload' | 'extraction' | 'knowledge_search' | 'answer_generation' | 'complete';
  message: string;
  details?: any;
}

/**
 * Progress callback type for streaming logs
 */
export type RFPProgressCallback = (log: RFPLogEntry) => void;

/**
 * Represents a question or requirement extracted from an RFP
 */
export interface RFPQuestion {
  id: string;
  questionText: string;
  category: 'technical' | 'business' | 'compliance' | 'timeline' | 'pricing' | 'general';
  section?: string;
  originalContext?: string;
  /** Main keywords extracted from the question */
  keywords: string[];
  /** Brief summary of what the question is asking about */
  summary: string;
}

/**
 * Source reference for an answer
 */
export interface AnswerSource {
  type: 'internal-kb' | 'case_study';
  title: string;
  excerpt: string;
  url?: string;
  relevanceScore?: number;
}

/**
 * Answer to an RFP question with confidence and sources
 */
export interface RFPAnswer {
  questionId: string;
  answer: string;
  confidence: 'high' | 'medium' | 'low';
  confidenceScore: number;
  sources: AnswerSource[];
}

/**
 * Complete RFP research result
 */
export interface RFPResearchResult {
  rfpSummary: string;
  companyName?: string;
  questions: RFPQuestion[];
  answers: RFPAnswer[];
  metadata: {
    totalQuestions: number;
    answeredQuestions: number;
    averageConfidence: number;
    processingTimeMs: number;
  };
}

/**
 * Internal knowledge context for answer generation
 */
interface InternalKnowledge {
  source: 'internal-kb' | 'case_study';
  title: string;
  content: string;
  url?: string;
  relevanceScore: number;
}

/**
 * Web search result for RFP research
 */
interface WebSearchKnowledge {
  source: 'web';
  title: string;
  content: string;
  url?: string;
  relevanceScore: number;
}

/**
 * RFP Research Service
 * Extracts questions from RFPs and answers them using internal knowledge AND web search
 */
export class RFPResearchService {
  private client: OpenAI;
  private model: string;
  private openaiService: ReturnType<typeof getOpenAIService>;
  private metricsService: ReturnType<typeof getMetricsService>;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not set in environment variables');
    }

    this.client = new OpenAI({ apiKey });
    this.model = process.env.OPENAI_MODEL || 'gpt-4o';
    this.openaiService = getOpenAIService();
    this.metricsService = getMetricsService();
  }

  /**
   * Search the web for Northstar Integrators-specific capabilities and information
   */
  private async searchIntegratorWebKnowledge(
    topics: string[],
    onProgress?: RFPProgressCallback
  ): Promise<WebSearchKnowledge[]> {
    const webKnowledge: WebSearchKnowledge[] = [];

    // Build search queries for Northstar Integrators capabilities
    const searchQueries = [
      `Northstar Integrators consulting ${topics.slice(0, 3).join(' ')} capabilities methodology`,
      `Northstar Integrators ${topics.includes('agile') || topics.includes('scrum') ? 'agile transformation SAFe scrum' : 'digital transformation'} services`,
      `Northstar Integrators ${topics.includes('servicenow') ? 'ServiceNow ITSM implementation' : 'Atlassian Jira Confluence'} expertise`,
    ];

    this.emitLog(onProgress, 'info', 'knowledge_search', 'Searching web for Northstar Integrators capabilities...');

    try {
      // Run web searches in parallel
      const searchPromises = searchQueries.map(async (query) => {
        try {
          const response: any = await this.openaiService.webSearch({ query, maxResults: 5 });
          const outputText = response?.output_text || '';

          if (outputText && outputText.length > 50) {
            return {
              source: 'web' as const,
              title: `Northstar Integrators Web Research: ${query.substring(0, 50)}...`,
              content: outputText.substring(0, 2000),
              relevanceScore: 0.75,
            };
          }
          return null;
        } catch (err) {
          console.warn(`Web search failed for query: ${query}`, err);
          return null;
        }
      });

      const results = await Promise.all(searchPromises);

      for (const result of results) {
        if (result) {
          webKnowledge.push(result);
        }
      }

      if (webKnowledge.length > 0) {
        this.emitLog(onProgress, 'success', 'knowledge_search', `Found ${webKnowledge.length} web sources about Northstar Integrators capabilities`);
      }
    } catch (error: any) {
      console.warn('Web search for Northstar Integrators knowledge failed:', error.message);
    }

    return webKnowledge;
  }

  /**
   * Extract all questions and requirements from RFP text
   */
  async extractRFPQuestions(rfpText: string): Promise<{ questions: RFPQuestion[]; summary: string; companyName?: string }> {
    console.log('\n📋 Extracting questions from RFP...');
    console.log(`   RFP text length: ${rfpText.length} characters`);

    const extractionPrompt = `Analyze this RFP/SOW document and extract ALL questions, requirements, and information requests that need to be addressed in a proposal response.

For each item, identify:
1. The exact question or requirement text (paraphrase if needed for clarity)
2. Category: technical, business, compliance, timeline, pricing, or general
3. The section of the RFP it appears in (if identifiable)
4. Keywords: Extract 3-6 main keywords that capture the core topics/concepts of this question (e.g., "integration", "API", "security", "timeline", "budget", "scalability")
5. Summary: A brief 1-2 sentence summary explaining what this question is fundamentally asking about and why it matters

Also provide:
- A brief summary of what this RFP is about (2-3 sentences)
- The company/organization name if mentioned

IMPORTANT: Include ALL types of requirements, not just explicit questions. This includes:
- Direct questions (e.g., "How will you handle...?")
- Implicit requirements (e.g., "The vendor must provide...")
- Capability requests (e.g., "Describe your approach to...")
- Compliance requirements (e.g., "Must be SOC 2 certified")
- Technical specifications (e.g., "System must integrate with...")
- Experience requirements (e.g., "Provide examples of similar work")

Return as JSON in this exact format:
{
  "summary": "Brief summary of the RFP",
  "companyName": "Company name or null if not found",
  "questions": [
    {
      "questionText": "The question or requirement",
      "category": "technical|business|compliance|timeline|pricing|general",
      "section": "Section name if identifiable",
      "keywords": ["keyword1", "keyword2", "keyword3"],
      "questionSummary": "Brief summary of what this question is asking about and its purpose"
    }
  ]
}

RFP DOCUMENT:
${rfpText.substring(0, 50000)}`;

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content: 'You are an expert RFP analyst. Extract all questions and requirements that need responses. Be thorough - capture both explicit questions and implicit requirements. For each question, identify the main keywords and provide a brief summary of what the question is fundamentally asking about. Return valid JSON only.',
          },
          { role: 'user', content: extractionPrompt },
        ],
      });

      const content = response.choices[0]?.message?.content?.trim() || '';

      // Parse JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('Failed to parse questions JSON from response');
        return { questions: [], summary: 'Unable to analyze RFP', companyName: undefined };
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Add unique IDs to each question and include keywords/summary
      const questions: RFPQuestion[] = (parsed.questions || []).map((q: any) => ({
        id: uuidv4(),
        questionText: q.questionText || q.question || '',
        category: q.category || 'general',
        section: q.section,
        keywords: q.keywords || this.extractKeywords(q.questionText || q.question || '').slice(0, 6),
        summary: q.questionSummary || q.summary || '',
      }));

      console.log(`   ✅ Extracted ${questions.length} questions/requirements`);
      console.log(`   Categories: ${this.summarizeCategories(questions)}`);

      return {
        questions,
        summary: parsed.summary || 'RFP analysis complete',
        companyName: parsed.companyName,
      };
    } catch (error: any) {
      console.error('❌ Failed to extract RFP questions:', error.message);
      return { questions: [], summary: 'Error analyzing RFP', companyName: undefined };
    }
  }

  /**
   * Search internal knowledge sources for relevant information.
   * Uses searchWithStructuredSections (proposal/SOW-focused) for InternalKnowledge, plus
   * three parallel category-level searches for technical, business, and compliance context.
   */
  async searchInternalKnowledge(
    question: string,
    rfpContext: string,
    accessToken?: string
  ): Promise<InternalKnowledge[]> {
    const knowledge: InternalKnowledge[] = [];

    const caseStudyService = getCaseStudyService();
    const keywords = this.extractKeywords(question);

    // Case studies — Northstar Integrators + Northstar library in parallel
    const [integratorResults, libraryResults] = await Promise.all([
      Promise.resolve(caseStudyService.searchIntegratorCaseStudies({ search: keywords.join(' '), pageSize: 5 })),
      Promise.resolve(caseStudyService.searchLibraryCaseStudies({ search: keywords.join(' '), pageSize: 5 })),
    ]);

    for (const cs of integratorResults.caseStudies) {
      const relevance = this.calculateRelevance(question, cs);
      if (relevance > 0.3) {
        knowledge.push({
          source: 'case_study',
          title: cs.title || 'Northstar Integrators Case Study',
          content: this.formatCaseStudyContent(cs),
          url: cs.url || cs.link,
          relevanceScore: relevance,
        });
      }
    }

    for (const cs of libraryResults.caseStudies) {
      const relevance = this.calculateRelevance(question, cs);
      if (relevance > 0.3) {
        knowledge.push({
          source: 'case_study',
          title: cs.title || cs.client_company_name || 'Northstar library Case Study',
          content: this.formatCaseStudyContent(cs),
          url: cs.url || cs.link,
          relevanceScore: relevance,
        });
      }
    }

    // InternalKnowledge — three parallel searches targeting proposals/SOWs specifically
    if (accessToken) {
      try {
        const internalKbService = getInternalKnowledgeService();
        const ctx = rfpContext.substring(0, 800);

        const keywordStr = keywords.slice(0, 4).join(' ');

        const [primaryResult, technicalResult, businessResult] = await Promise.allSettled([
          // Primary: proposal/SOW-focused with full RFP context
          internalKbService.searchWithStructuredSections(
            ctx.substring(0, 120),
            `${ctx}\n\nFocus area: ${question.substring(0, 300)}`,
            accessToken
          ),
          // Technical: methodology, implementation patterns, architecture
          internalKbService.searchWithStructuredSections(
            `technical implementation ${keywordStr}`,
            `Find Northstar Integrators technical approach, methodology, architecture patterns, and implementation ` +
            `deliverables relevant to: ${keywordStr}. Focus on SOWs, playbooks, and technical proposals.`,
            accessToken
          ),
          // Business: outcomes, value props, case study results
          internalKbService.searchWithStructuredSections(
            `business outcomes ${keywordStr}`,
            `Find Northstar Integrators engagement outcomes, value propositions, ROI results, and case studies ` +
            `relevant to: ${keywordStr}. Focus on business case and proven results.`,
            accessToken
          ),
        ]);

        const addInternalKnowledgeDocs = (docs: InternalKnowledgeDocument[], summary?: string, defaultScore = 0.7) => {
          for (const doc of docs) {
            knowledge.push({
              source: 'internal-kb',
              title: doc.title,
              content: doc.content || '',
              url: doc.url,
              relevanceScore: doc.relevanceScore || defaultScore,
            });
          }
          if (summary && docs.length === 0) {
            knowledge.push({
              source: 'internal-kb',
              title: 'InternalKnowledge Research Summary',
              content: summary.substring(0, 2000),
              relevanceScore: 0.6,
            });
          }
        };

        if (primaryResult.status === 'fulfilled') {
          addInternalKnowledgeDocs(primaryResult.value.documents, primaryResult.value.summary, 0.8);
        }
        if (technicalResult.status === 'fulfilled') {
          addInternalKnowledgeDocs(technicalResult.value.documents, undefined, 0.65);
        }
        if (businessResult.status === 'fulfilled') {
          addInternalKnowledgeDocs(businessResult.value.documents, undefined, 0.65);
        }
      } catch (error: any) {
        console.warn('InternalKnowledge search failed:', error.message);
      }
    }

    // Deduplicate by title, sort by relevance
    const seen = new Set<string>();
    const deduped: InternalKnowledge[] = [];
    for (const k of knowledge) {
      if (!seen.has(k.title)) {
        seen.add(k.title);
        deduped.push(k);
      }
    }
    deduped.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return deduped.slice(0, 15);
  }

  /**
   * Generate an answer to an RFP question using internal knowledge
   */
  async generateAnswer(
    question: RFPQuestion,
    knowledge: InternalKnowledge[],
    rfpContext: string
  ): Promise<RFPAnswer> {
    const knowledgeContext = knowledge
      .slice(0, 5)
      .map((k, i) => `[Source ${i + 1}: ${k.title}]\n${k.content}`)
      .join('\n\n---\n\n');

    const answerPrompt = `You are a proposal writer for Northstar Integrators, a consulting company specializing in Agile, DevOps, Atlassian tools, ServiceNow, and digital transformation.

Answer this RFP question/requirement using the provided internal knowledge. Your answer should:
1. Directly address the question/requirement
2. Reference specific capabilities, case studies, or experience from the knowledge provided
3. Be professional and confident in tone
4. Be specific rather than generic when possible

QUESTION/REQUIREMENT:
${question.questionText}

CATEGORY: ${question.category}
${question.section ? `SECTION: ${question.section}` : ''}

INTERNAL KNOWLEDGE (from our case studies and documentation):
${knowledgeContext || 'No specific internal knowledge found. Provide a general response based on typical consulting capabilities.'}

RFP CONTEXT (for reference):
${rfpContext.substring(0, 2000)}

Provide a professional response (2-4 paragraphs) that could be used in a proposal. If internal knowledge is limited, acknowledge this by being more general but still professional.`;

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        temperature: 0.5,
        messages: [
          {
            role: 'system',
            content: 'You are a senior proposal writer creating responses for RFP questions. Write professional, confident answers that leverage internal knowledge when available.',
          },
          { role: 'user', content: answerPrompt },
        ],
      });

      const answer = response.choices[0]?.message?.content?.trim() || 'Unable to generate answer.';

      // Calculate confidence based on knowledge availability and relevance
      const { confidence, confidenceScore } = this.calculateConfidence(knowledge);

      // Build sources list
      const sources: AnswerSource[] = knowledge.slice(0, 3).map((k) => ({
        type: k.source,
        title: k.title,
        excerpt: k.content.substring(0, 300) + (k.content.length > 300 ? '...' : ''),
        url: k.url,
        relevanceScore: k.relevanceScore,
      }));

      return {
        questionId: question.id,
        answer,
        confidence,
        confidenceScore,
        sources,
      };
    } catch (error: any) {
      console.error(`Failed to generate answer for question ${question.id}:`, error.message);
      return {
        questionId: question.id,
        answer: 'Unable to generate answer due to an error.',
        confidence: 'low',
        confidenceScore: 0,
        sources: [],
      };
    }
  }

  /**
   * Emit a log entry to the callback if provided
   */
  private emitLog(
    onProgress: RFPProgressCallback | undefined,
    level: RFPLogEntry['level'],
    stage: RFPLogEntry['stage'],
    message: string,
    details?: any
  ): void {
    const entry: RFPLogEntry = {
      timestamp: new Date(),
      level,
      stage,
      message,
      details,
    };
    console.log(`[RFP ${level.toUpperCase()}] ${stage}: ${message}`, details ? JSON.stringify(details).substring(0, 200) : '');
    if (onProgress) {
      onProgress(entry);
    }
  }

  /**
   * Process an entire RFP - extract questions and generate answers
   * @param rfpText The RFP document text
   * @param accessToken Optional access token for InternalKnowledge
   * @param onProgress Optional callback for streaming progress logs
   * @param customPrompt Optional custom prompt to guide the analysis
   */
  async processRFP(
    rfpText: string,
    accessToken?: string,
    onProgress?: RFPProgressCallback,
    customPrompt?: string
  ): Promise<RFPResearchResult> {
    const startTime = Date.now();
    const sessionId = uuidv4();

    // Start metrics tracking
    this.metricsService.startRFPResearch(sessionId, {
      textLength: rfpText.length,
      hasCustomPrompt: !!customPrompt,
    });

    this.emitLog(onProgress, 'info', 'upload', 'Starting RFP Research Process', {
      textLength: rfpText.length,
      hasAccessToken: !!accessToken,
      sessionId,
    });

    // Step 1: Extract questions
    this.emitLog(onProgress, 'info', 'extraction', 'Extracting questions and requirements from RFP document...');
    this.emitLog(onProgress, 'progress', 'extraction', `Analyzing ${rfpText.length.toLocaleString()} characters of RFP content`);

    const { questions, summary, companyName } = await this.extractRFPQuestions(rfpText);

    if (questions.length === 0) {
      this.emitLog(onProgress, 'warning', 'extraction', 'No questions or requirements found in document');
      return {
        rfpSummary: summary,
        companyName,
        questions: [],
        answers: [],
        metadata: {
          totalQuestions: 0,
          answeredQuestions: 0,
          averageConfidence: 0,
          processingTimeMs: Date.now() - startTime,
        },
      };
    }

    // Track question extraction metrics
    const categoryBreakdown: Record<string, number> = {};
    questions.forEach(q => {
      categoryBreakdown[q.category] = (categoryBreakdown[q.category] || 0) + 1;
    });
    this.metricsService.recordQuestionExtraction(sessionId, questions.length, categoryBreakdown);

    this.emitLog(onProgress, 'success', 'extraction', `Extracted ${questions.length} questions/requirements`, {
      categories: this.summarizeCategories(questions),
      companyName,
    });

    if (companyName) {
      this.emitLog(onProgress, 'info', 'extraction', `Identified company: ${companyName}`);
    }

    this.emitLog(onProgress, 'info', 'extraction', `RFP Summary: ${summary}`);

    // Step 2: Search knowledge from multiple sources in parallel
    this.emitLog(onProgress, 'info', 'knowledge_search', 'Searching internal knowledge base and web...');

    // Extract key topics from questions for better search
    const allQuestionText = questions.map(q => q.questionText).join(' ');
    const keyTopics = this.extractKeywords(allQuestionText);

    // Run internal knowledge search and web search in parallel
    const [internalKnowledge, webKnowledge] = await Promise.all([
      this.searchInternalKnowledge(
        `${summary}\n\nKey topics: ${questions.slice(0, 5).map(q => q.questionText).join('; ')}`,
        `${summary}\n\nCompany: ${companyName || 'Unknown'}`,
        accessToken
      ),
      this.searchIntegratorWebKnowledge(keyTopics, onProgress),
    ]);

    // Combine all knowledge sources
    const allKnowledge: InternalKnowledge[] = [
      ...internalKnowledge,
      ...webKnowledge.map(w => ({
        source: 'internal-kb' as const, // Treat web results as general knowledge
        title: w.title,
        content: w.content,
        url: w.url,
        relevanceScore: w.relevanceScore,
      })),
    ];

    // Sort by relevance
    allKnowledge.sort((a, b) => b.relevanceScore - a.relevanceScore);

    const internalKbSources = internalKnowledge.filter(k => k.source === 'internal-kb').length;
    const caseStudySources = internalKnowledge.filter(k => k.source === 'case_study').length;
    const webSources = webKnowledge.length;

    // Track knowledge search metrics
    this.metricsService.recordKnowledgeSearch(sessionId, 'internal-kb', internalKbSources, 0);
    this.metricsService.recordKnowledgeSearch(sessionId, 'case_study', caseStudySources, 0);
    if (webSources > 0) {
      this.metricsService.recordKnowledgeSearch(sessionId, 'web', webSources, 0);
    }

    this.emitLog(onProgress, 'success', 'knowledge_search', `Found ${allKnowledge.length} relevant sources`, {
      internalKbDocs: internalKbSources,
      caseStudies: caseStudySources,
      webSources: webSources,
    });

    // Step 3: Generate ALL answers in a single batch call (much faster)
    this.emitLog(onProgress, 'info', 'answer_generation', `Generating answers for ${questions.length} questions in batch...`);

    const answers = await this.generateBatchAnswers(questions, allKnowledge, rfpText, summary, onProgress, customPrompt);

    // Calculate metadata
    const answeredCount = answers.filter((a) => a.answer && a.answer !== 'Unable to generate answer due to an error.').length;
    const avgConfidence = answers.length > 0
      ? answers.reduce((sum, a) => sum + a.confidenceScore, 0) / answers.length
      : 0;

    const result: RFPResearchResult = {
      rfpSummary: summary,
      companyName,
      questions,
      answers,
      metadata: {
        totalQuestions: questions.length,
        answeredQuestions: answeredCount,
        averageConfidence: Math.round(avgConfidence * 100) / 100,
        processingTimeMs: Date.now() - startTime,
      },
    };

    // Track completion metrics
    this.metricsService.completeRFPResearch(sessionId, {
      questionsExtracted: result.metadata.totalQuestions,
      answersGenerated: result.metadata.answeredQuestions,
      avgConfidence: result.metadata.averageConfidence,
      success: true,
    });

    // Track individual answer metrics for confidence distribution
    answers.forEach(answer => {
      const question = result.questions.find(q => q.id === answer.questionId);
      this.metricsService.recordAnswerGeneration(
        sessionId,
        answer.questionId,
        question?.questionText || '',
        answer.confidence,
        0,
        answer.sources.length
      );
    });

    this.emitLog(onProgress, 'success', 'complete', 'RFP Research Complete!', {
      totalQuestions: result.metadata.totalQuestions,
      answeredQuestions: result.metadata.answeredQuestions,
      averageConfidence: `${(result.metadata.averageConfidence * 100).toFixed(1)}%`,
      processingTime: `${(result.metadata.processingTimeMs / 1000).toFixed(1)}s`,
      highConfidenceAnswers: answers.filter(a => a.confidence === 'high').length,
      mediumConfidenceAnswers: answers.filter(a => a.confidence === 'medium').length,
      lowConfidenceAnswers: answers.filter(a => a.confidence === 'low').length,
    });

    return result;
  }

  /**
   * Generate answers for multiple questions using chunked batch processing (handles large RFPs)
   */
  private async generateBatchAnswers(
    questions: RFPQuestion[],
    knowledge: InternalKnowledge[],
    _rfpText: string, // Reserved for future use
    summary: string,
    onProgress?: RFPProgressCallback,
    customPrompt?: string
  ): Promise<RFPAnswer[]> {
    // Process in chunks of 8 questions — gives ~900 tokens per answer vs 267 at 15
    const CHUNK_SIZE = 8;
    const chunks: RFPQuestion[][] = [];

    for (let i = 0; i < questions.length; i += CHUNK_SIZE) {
      chunks.push(questions.slice(i, i + CHUNK_SIZE));
    }

    this.emitLog(onProgress, 'info', 'answer_generation', `Processing ${questions.length} questions in ${chunks.length} batch(es)...`, {
      totalQuestions: questions.length,
      batches: chunks.length,
    });

    const allAnswers: RFPAnswer[] = [];

    for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
      const chunk = chunks[chunkIdx];
      const chunkStartIdx = chunkIdx * CHUNK_SIZE;

      this.emitLog(onProgress, 'progress', 'answer_generation', `Generating batch ${chunkIdx + 1}/${chunks.length} (questions ${chunkStartIdx + 1}-${chunkStartIdx + chunk.length})...`, {
        batch: chunkIdx + 1,
        totalBatches: chunks.length,
        progress: Math.round((chunkIdx / chunks.length) * 100),
      });

      const chunkAnswers = await this.generateSingleBatch(chunk, knowledge, summary, chunkStartIdx, onProgress, customPrompt);
      allAnswers.push(...chunkAnswers);

      this.emitLog(onProgress, 'success', 'answer_generation', `Batch ${chunkIdx + 1}/${chunks.length} complete`, {
        answersGenerated: chunkAnswers.length,
        progress: Math.round(((chunkIdx + 1) / chunks.length) * 100),
      });
    }

    return allAnswers;
  }

  /**
   * Generate answers for a single batch of questions (max ~15 questions)
   */
  private async generateSingleBatch(
    questions: RFPQuestion[],
    knowledge: InternalKnowledge[],
    summary: string,
    startIndex: number,
    _onProgress?: RFPProgressCallback, // Reserved for future per-batch logging
    customPrompt?: string
  ): Promise<RFPAnswer[]> {
    const knowledgeContext = knowledge
      .slice(0, 6)
      .map((k, i) => `[Source ${i + 1}: ${k.title}]\n${k.content.substring(0, 600)}`)
      .join('\n\n---\n\n');

    // Format questions for batch processing (shorter answers for efficiency)
    const questionsText = questions
      .map((q, i) => `Q${startIndex + i + 1}. [${q.category?.toUpperCase() || 'GENERAL'}]\n${q.questionText.substring(0, 300)}`)
      .join('\n\n');

    // Build custom guidance section if provided
    const customGuidanceSection = customPrompt
      ? `\nUSER-PROVIDED ANALYSIS GUIDANCE (IMPORTANT - Follow these instructions carefully):
${customPrompt}
`
      : '';

    const batchPrompt = `You are a senior proposal writer for Northstar Integrators, a leading consulting company.

ENTERPRISE'S EXPERTISE:
- Agile Transformation: SAFe implementation, Scrum, Kanban, Agile coaching, team training
- DevOps & Platform Engineering: CI/CD pipelines, cloud migration, automation, GitOps
- Atlassian Solutions: Jira, Confluence, Jira Service Management, Atlassian Cloud migration
- ServiceNow: ITSM, ITOM, HRSD, CSM implementation and optimization
- Digital Transformation: Process optimization, workflow automation, enterprise integration
${customGuidanceSection}
CRITICAL INSTRUCTIONS:
1. Answer as Northstar Integrators - use "we", "our team", "Northstar Integrators has", etc.
2. Be SPECIFIC - reference actual Northstar Integrators capabilities, methodologies, and experience
3. When knowledge sources mention case studies or clients, reference them specifically
4. Do NOT give generic consulting answers - be concrete about Northstar Integrators's approach
5. If knowledge is limited for a question, acknowledge it but still provide Northstar Integrators's general capability
${customPrompt ? '6. IMPORTANT: Follow the user-provided analysis guidance above when crafting your answers' : ''}

KNOWLEDGE FROM ENTERPRISE SOURCES:
${knowledgeContext || 'Limited internal knowledge available - use Northstar Integrators general capabilities.'}

RFP CONTEXT: ${summary}

QUESTIONS TO ANSWER:
${questionsText}

Return a JSON array with answers. Be specific and reference Northstar Integrators capabilities:
[{"questionIndex": ${startIndex}, "answer": "Northstar Integrators's approach to... Our team has extensive experience..."}, ...]`;

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        temperature: 0.4,
        max_tokens: 8000,
        messages: [
          {
            role: 'system',
            content: 'Generate detailed professional RFP responses as JSON array. Each answer should be 3-5 substantive paragraphs with specific references to Northstar Integrators capabilities, methodologies, and relevant experience.',
          },
          { role: 'user', content: batchPrompt },
        ],
      });

      const content = response.choices[0]?.message?.content?.trim() || '';

      // Parse JSON array from response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.error('Failed to parse batch answers JSON for chunk');
        return this.createFallbackAnswers(questions, knowledge);
      }

      const parsedAnswers = JSON.parse(jsonMatch[0]);

      // Map parsed answers to RFPAnswer format with REAL confidence based on knowledge
      return questions.map((question, idx) => {
        const globalIdx = startIndex + idx;
        const parsed = parsedAnswers.find((a: any) => a.questionIndex === globalIdx) || parsedAnswers[idx];
        const answerText = parsed?.answer || 'Unable to generate answer.';

        // Find sources relevant to this specific question
        const relevantSources = knowledge
          .filter(k => this.isSourceRelevantToQuestion(k, question))
          .slice(0, 3);

        // Calculate REAL confidence based on actual knowledge matches, not LLM opinion
        const { confidence, confidenceScore } = this.calculateRealConfidence(
          question,
          answerText,
          relevantSources
        );

        const sourcesForAnswer: AnswerSource[] = relevantSources
          .slice(0, 2)
          .map(k => ({
            type: k.source,
            title: k.title,
            excerpt: k.content.substring(0, 200) + '...',
            url: k.url,
            relevanceScore: k.relevanceScore,
          }));

        return {
          questionId: question.id,
          answer: answerText,
          confidence,
          confidenceScore,
          sources: sourcesForAnswer,
        };
      });
    } catch (error: any) {
      console.error('Single batch generation failed:', error.message);
      return this.createFallbackAnswers(questions, knowledge);
    }
  }

  /**
   * Check if a knowledge source is relevant to a specific question
   */
  private isSourceRelevantToQuestion(source: InternalKnowledge, question: RFPQuestion): boolean {
    const questionKeywords = this.extractKeywords(question.questionText);
    const sourceText = (source.title + ' ' + source.content).toLowerCase();

    const matchCount = questionKeywords.filter(kw => sourceText.includes(kw.toLowerCase())).length;
    return matchCount >= 2 || source.relevanceScore > 0.6;
  }

  /**
   * Create fallback answers when batch generation fails - with category-specific responses
   */
  private createFallbackAnswers(questions: RFPQuestion[], knowledge: InternalKnowledge[]): RFPAnswer[] {
    const categoryResponses: Record<string, string> = {
      technical: 'Northstar Integrators brings deep technical expertise to address this requirement. Our engineering teams have successfully delivered complex implementations across Atlassian, ServiceNow, and custom DevOps solutions. We employ proven methodologies including infrastructure-as-code, automated testing, and continuous integration to ensure reliable, scalable solutions.',
      business: 'Northstar Integrators understands the business drivers behind this requirement. Our consultants combine technical expertise with business acumen, having helped organizations across industries achieve measurable ROI through digital transformation. We focus on outcomes that matter: improved efficiency, reduced costs, and enhanced user satisfaction.',
      compliance: 'Northstar Integrators has extensive experience with compliance and governance requirements. Our implementations follow industry best practices for security, audit trails, and regulatory compliance. We have helped clients achieve SOC 2, ISO 27001, and industry-specific compliance requirements.',
      timeline: 'Northstar Integrators follows proven delivery methodologies that ensure predictable timelines. Our typical engagements use iterative approaches with clear milestones, allowing for early value delivery while maintaining flexibility. We work collaboratively to establish realistic timelines based on scope and resource availability.',
      pricing: 'Northstar Integrators offers flexible engagement models tailored to client needs, including fixed-price projects, time-and-materials engagements, and managed services. Our pricing reflects the value and expertise we bring, with transparent scoping to ensure alignment on deliverables and investment.',
      general: 'Northstar Integrators is well-positioned to address this requirement. With over 15 years of experience in Agile, DevOps, and enterprise tools, our team brings proven methodologies and deep expertise. We would be happy to discuss our specific approach and relevant case studies during a follow-up conversation.',
    };

    return questions.map(question => {
      const response = categoryResponses[question.category] || categoryResponses.general;
      return {
        questionId: question.id,
        answer: response,
        confidence: 'low' as const,
        confidenceScore: 0.25,
        sources: knowledge.slice(0, 2).map(k => ({
          type: k.source,
          title: k.title,
          excerpt: k.content.substring(0, 150) + '...',
          url: k.url,
          relevanceScore: k.relevanceScore,
        })),
      };
    });
  }

  // Helper methods

  private extractKeywords(text: string): string[] {
    // Extract meaningful keywords for search
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
      'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'your', 'our',
      'their', 'this', 'that', 'these', 'those', 'what', 'which', 'who', 'whom',
      'how', 'when', 'where', 'why', 'please', 'describe', 'explain', 'provide',
    ]);

    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2 && !stopWords.has(word));

    // Return unique keywords, max 10
    return [...new Set(words)].slice(0, 10);
  }

  private calculateRelevance(question: string, caseStudy: any): number {
    const questionLower = question.toLowerCase();
    const caseStudyText = JSON.stringify(caseStudy).toLowerCase();

    // Extract keywords from question
    const keywords = this.extractKeywords(question);

    // Count keyword matches
    let matches = 0;
    for (const keyword of keywords) {
      if (caseStudyText.includes(keyword)) {
        matches++;
      }
    }

    // Calculate base relevance
    const baseRelevance = keywords.length > 0 ? matches / keywords.length : 0;

    // Bonus for industry/technology matches
    let bonus = 0;
    const techKeywords = ['agile', 'devops', 'jira', 'confluence', 'atlassian', 'servicenow', 'cloud', 'migration', 'transformation', 'scrum', 'safe', 'kanban'];
    for (const tech of techKeywords) {
      if (questionLower.includes(tech) && caseStudyText.includes(tech)) {
        bonus += 0.1;
      }
    }

    return Math.min(1, baseRelevance + bonus);
  }

  private formatCaseStudyContent(cs: any): string {
    const parts: string[] = [];

    if (cs.title) parts.push(`Title: ${cs.title}`);
    if (cs.client_company_name) parts.push(`Client: ${cs.client_company_name}`);
    if (cs.industry || cs.industry_sector) parts.push(`Industry: ${cs.industry || cs.industry_sector}`);
    if (cs.description) parts.push(`Description: ${cs.description}`);
    if (cs.challenge_problem_solved) parts.push(`Challenge: ${cs.challenge_problem_solved}`);
    if (cs.solution_approach) parts.push(`Solution: ${cs.solution_approach}`);
    if (cs.results || cs.outcomes) parts.push(`Results: ${cs.results || cs.outcomes}`);
    if (cs.key_technologies_used) {
      const techs = Array.isArray(cs.key_technologies_used) ? cs.key_technologies_used.join(', ') : cs.key_technologies_used;
      parts.push(`Technologies: ${techs}`);
    }
    if (cs.tags) {
      const tags = Array.isArray(cs.tags) ? cs.tags.join(', ') : cs.tags;
      parts.push(`Tags: ${tags}`);
    }

    return parts.join('\n');
  }

  private calculateConfidence(knowledge: InternalKnowledge[]): { confidence: 'high' | 'medium' | 'low'; confidenceScore: number } {
    if (knowledge.length === 0) {
      return { confidence: 'low', confidenceScore: 0.2 };
    }

    // Calculate weighted average of relevance scores
    const totalWeight = knowledge.reduce((sum, _, i) => sum + (1 / (i + 1)), 0);
    const weightedScore = knowledge.reduce((sum, k, i) => sum + k.relevanceScore * (1 / (i + 1)), 0) / totalWeight;

    // Boost for having multiple sources
    const sourceBonus = Math.min(0.2, knowledge.length * 0.05);

    // Boost for having high-relevance sources
    const highRelevanceCount = knowledge.filter((k) => k.relevanceScore > 0.7).length;
    const highRelevanceBonus = Math.min(0.15, highRelevanceCount * 0.05);

    const finalScore = Math.min(1, weightedScore + sourceBonus + highRelevanceBonus);

    let confidence: 'high' | 'medium' | 'low';
    if (finalScore >= 0.7) {
      confidence = 'high';
    } else if (finalScore >= 0.4) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }

    return { confidence, confidenceScore: finalScore };
  }

  /**
   * Calculate REAL confidence based on actual knowledge matches and answer quality
   * This replaces the hardcoded LLM-provided confidence with data-driven scoring
   */
  private calculateRealConfidence(
    _question: RFPQuestion,
    answer: string,
    relevantSources: InternalKnowledge[]
  ): { confidence: 'high' | 'medium' | 'low'; confidenceScore: number } {
    let score = 0;

    // Factor 1: Number of relevant sources (0-0.3)
    const sourceCountScore = Math.min(0.3, relevantSources.length * 0.1);
    score += sourceCountScore;

    // Factor 2: Quality of source relevance scores (0-0.25)
    if (relevantSources.length > 0) {
      const avgRelevance = relevantSources.reduce((sum, s) => sum + s.relevanceScore, 0) / relevantSources.length;
      score += avgRelevance * 0.25;
    }

    // Factor 3: Source diversity - having both case studies and internal-kb (0-0.15)
    const hasCaseStudy = relevantSources.some(s => s.source === 'case_study');
    const hasInternalKb = relevantSources.some(s => s.source === 'internal-kb');
    if (hasCaseStudy && hasInternalKb) {
      score += 0.15;
    } else if (hasCaseStudy || hasInternalKb) {
      score += 0.08;
    }

    // Factor 4: Answer specificity - check for specific Northstar Integrators mentions (0-0.15)
    const answerLower = answer.toLowerCase();
    const specificityIndicators = [
      'enterprise', 'our team', 'we have', 'our experience', 'our methodology',
      'case study', 'client', 'implemented', 'delivered', 'successfully'
    ];
    const specificityMatches = specificityIndicators.filter(ind => answerLower.includes(ind)).length;
    score += Math.min(0.15, specificityMatches * 0.03);

    // Factor 5: Answer length and substance (0-0.15)
    // Very short answers or generic fallbacks get penalized
    if (answer.length > 500 && !answer.includes('Unable to generate')) {
      score += 0.15;
    } else if (answer.length > 200) {
      score += 0.08;
    } else if (answer.length < 100 || answer.includes('Unable to generate')) {
      score -= 0.1;
    }

    // Ensure score is between 0 and 1
    score = Math.max(0.1, Math.min(1, score));

    // Map score to confidence level
    let confidence: 'high' | 'medium' | 'low';
    if (score >= 0.65) {
      confidence = 'high';
    } else if (score >= 0.4) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }

    return { confidence, confidenceScore: Math.round(score * 100) / 100 };
  }

  private summarizeCategories(questions: RFPQuestion[]): string {
    const counts: Record<string, number> = {};
    for (const q of questions) {
      counts[q.category] = (counts[q.category] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([cat, count]) => `${cat}: ${count}`)
      .join(', ');
  }
}

// Singleton instance
let rfpResearchServiceInstance: RFPResearchService | null = null;

export function getRFPResearchService(): RFPResearchService {
  if (!rfpResearchServiceInstance) {
    rfpResearchServiceInstance = new RFPResearchService();
  }
  return rfpResearchServiceInstance;
}
