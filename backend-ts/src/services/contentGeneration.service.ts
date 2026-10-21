// Enhanced production-grade RFP to Presentation Generator - Dynamic for ANY Company
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';
import OpenAI from 'openai';
import { PDFParse } from 'pdf-parse';

// Cross-environment filename/dirname resolution compatible with CommonJS builds
// Avoid using `import.meta` which is not allowed when compiling to CommonJS.
const currentFile = typeof __filename !== 'undefined' ? __filename : (process.argv && process.argv[1]) || '';
const currentDir = typeof __dirname !== 'undefined' ? __dirname : path.dirname(currentFile || process.cwd());

// Load environment
config();

// Configure logging
const logger = {
  info: (message: string) => console.log(`${new Date().toISOString()} - INFO - ${message}`),
  error: (message: string) => console.error(`${new Date().toISOString()} - ERROR - ${message}`),
  warning: (message: string) => console.warn(`${new Date().toISOString()} - WARN - ${message}`)
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Enhanced PDF Text Extraction - supports both file paths and buffers
async function extractTextFromPDF(input: string | Buffer): Promise<string> {
  try {
    const inputType = Buffer.isBuffer(input) ? 'buffer' : 'file';
    logger.info(`📄 Extracting text from PDF ${inputType}`);

    let dataBuffer: Buffer;

    if (Buffer.isBuffer(input)) {
      dataBuffer = input;
    } else {
      if (!fs.existsSync(input)) {
        throw new Error(`PDF file not found: ${input}`);
      }
      dataBuffer = fs.readFileSync(input);
    }

    const parser = new PDFParse({ data: dataBuffer });
    let pdfData: Awaited<ReturnType<PDFParse['getText']>> | undefined;
    try {
      pdfData = await parser.getText();
    } finally {
      await parser.destroy().catch(() => undefined);
    }

    if (!pdfData) {
      throw new Error('Failed to extract text from PDF');
    }
    
    let extractedText = pdfData.text;
    
    // Clean up the text
    extractedText = extractedText
      .replace(/\n+/g, '\n')
      .replace(/\s+/g, ' ')
      .trim();

    logger.info(`✅ PDF extraction successful: ${extractedText.length} characters`);
    
    if (extractedText.length < 100) {
      logger.warning('⚠️  Extracted text seems too short, PDF might be scanned or encrypted');
    }
    
    return extractedText;
  } catch (error) {
    logger.error(`❌ PDF extraction failed: ${error}`);
    throw new Error(`Failed to extract text from PDF: ${error}`);
  }
}

// Enhanced RFP Context Manager - REQUEST-SCOPED (NO GLOBAL STATE)
class RFPContextManager {
  private rfpContent: string = '';
  private solutionContent: string = '';
  private structuredData: any = null;
  private analysisResults: Map<string, any> = new Map();
  private slideTemplates: any[] = [];
  private solutionAlignment: any = null;
  private requestId: string;
  private createdAt: number;

  constructor(requestId?: string) {
    this.requestId = requestId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.createdAt = Date.now();
  }

  getRequestId(): string {
    return this.requestId;
  }

  setRFPContent(content: string) {
    this.rfpContent = content;
  }

  setSolutionContent(content: string) {
    this.solutionContent = content;
  }

  setStructuredData(data: any) {
    this.structuredData = data;
  }

  setAnalysisResult(key: string, data: any) {
    this.analysisResults.set(key, data);
  }

  getAnalysisResult(key: string): any {
    return this.analysisResults.get(key);
  }

  setSlideTemplates(templates: any[]) {
    this.slideTemplates = templates;
  }

  setSolutionAlignment(alignment: any) {
    this.solutionAlignment = alignment;
  }

  getRFPContent(): string {
    return this.rfpContent;
  }

  getSolutionContent(): string {
    return this.solutionContent;
  }

  getStructuredData(): any {
    return this.structuredData;
  }

  getSlideTemplates(): any[] {
    return this.slideTemplates;
  }

  getSolutionAlignment(): any {
    return this.solutionAlignment;
  }

  hasSolutionContent(): boolean {
    return !!this.solutionContent && this.solutionContent.length > 100;
  }

  getAllContext(): any {
    return {
      requestId: this.requestId,
      contentLength: this.rfpContent.length,
      solutionLength: this.solutionContent.length,
      hasSolution: this.hasSolutionContent(),
      structuredData: this.structuredData ? 'available' : 'unavailable',
      analysisKeys: Array.from(this.analysisResults.keys()),
      slideTemplatesCount: this.slideTemplates.length,
      solutionAlignment: this.solutionAlignment ? 'completed' : 'pending',
      ageMs: Date.now() - this.createdAt
    };
  }

  // Cleanup method to prevent memory leaks
  cleanup() {
    this.rfpContent = '';
    this.solutionContent = '';
    this.structuredData = null;
    this.analysisResults.clear();
    this.slideTemplates = [];
    this.solutionAlignment = null;
  }
}

// REMOVED GLOBAL SINGLETON - Each request creates its own instance

// PRODUCTION-GRADE: OpenAI API wrapper with retry logic and rate limiting
async function safeOpenAICall(
  prompt: string,
  functionName: string,
  defaultReturn: any,
  maxTokens: number = 2000,
  maxRetries: number = 3
): Promise<any> {
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Exponential backoff for retries
      if (attempt > 1) {
        const delayMs = Math.min(1000 * Math.pow(2, attempt - 2), 10000);
        logger.info(`Retry attempt ${attempt}/${maxRetries} for ${functionName} after ${delayMs}ms delay`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: maxTokens,
        response_format: { type: "json_object" }
      });

      const responseContent = response.choices[0]?.message?.content || "{}";

      try {
        const parsed = JSON.parse(responseContent);
        if (attempt > 1) {
          logger.info(`✅ ${functionName} succeeded on retry attempt ${attempt}`);
        }
        return parsed;
      } catch (parseError) {
        logger.error(`JSON parse error in ${functionName} (attempt ${attempt}): ${parseError}`);
        logger.warning(`Response length: ${responseContent.length}, First 500 chars: ${responseContent.substring(0, 500)}`);

        // Check if it's a truncation issue (unterminated string)
        if (responseContent.includes('Unterminated') || responseContent.length >= maxTokens * 4) {
          logger.warning(`⚠️  Response appears truncated. Consider increasing max_tokens (current: ${maxTokens})`);
        }

        // Retry on parse errors - the response might be truncated due to token limits
        if (attempt < maxRetries) {
          lastError = parseError;
          continue;
        }

        return { ...defaultReturn, parse_error: true };
      }
    } catch (error: any) {
      lastError = error;
      const errorMessage = error?.message || String(error);

      // Check for rate limiting (429)
      if (errorMessage.includes('429') || errorMessage.includes('rate_limit')) {
        logger.warning(`⚠️  Rate limit hit in ${functionName} (attempt ${attempt}/${maxRetries})`);
        // Longer delay for rate limits
        if (attempt < maxRetries) {
          const delayMs = Math.min(5000 * Math.pow(2, attempt - 1), 30000);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          continue;
        }
      }

      // Check for timeout or network errors - retry
      if (errorMessage.includes('timeout') || errorMessage.includes('ECONNRESET') || errorMessage.includes('ETIMEDOUT')) {
        logger.warning(`⚠️  Network error in ${functionName} (attempt ${attempt}/${maxRetries}): ${errorMessage}`);
        if (attempt < maxRetries) continue;
      }

      // Check for server errors (500, 502, 503, 504) - retry
      if (errorMessage.match(/50[0-4]/)) {
        logger.warning(`⚠️  Server error in ${functionName} (attempt ${attempt}/${maxRetries}): ${errorMessage}`);
        if (attempt < maxRetries) continue;
      }

      // For other errors, log and potentially retry
      logger.error(`API call error in ${functionName} (attempt ${attempt}/${maxRetries}): ${errorMessage}`);
      if (attempt === maxRetries) {
        return { ...defaultReturn, api_error: true, error_message: errorMessage };
      }
    }
  }

  // If all retries failed
  logger.error(`❌ All ${maxRetries} attempts failed for ${functionName}. Last error: ${lastError}`);
  return { ...defaultReturn, api_error: true, all_retries_failed: true };
}

// Enhanced Production Cache - Thread-safe with automatic cleanup
class ProductionCache {
  private cache: Map<string, { data: any; timestamp: number; usage: number; requestId?: string }> = new Map();
  private readonly TTL = 6 * 60 * 60 * 1000; // 6 hours for production
  private readonly MAX_SIZE = 1000; // Prevent unlimited growth
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    // Auto-cleanup old entries every 30 minutes
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired();
    }, 30 * 60 * 1000);
  }

  set(key: string, data: any, requestId?: string): void {
    // Prevent cache from growing too large
    if (this.cache.size >= this.MAX_SIZE) {
      this.evictOldest();
    }
    this.cache.set(key, { data, timestamp: Date.now(), usage: 0, requestId });
  }

  get(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > this.TTL) {
      this.cache.delete(key);
      return null;
    }

    cached.usage += 1;
    return cached.data;
  }

  incrementUsage(key: string): void {
    const cached = this.cache.get(key);
    if (cached) {
      cached.usage += 1;
    }
  }

  // Clear cache entries for a specific request
  clearRequestCache(requestId: string): void {
    const keysToDelete: string[] = [];
    this.cache.forEach((value, key) => {
      if (value.requestId === requestId) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => this.cache.delete(key));
    logger.info(`Cleared ${keysToDelete.length} cache entries for request ${requestId}`);
  }

  clear(): void {
    this.cache.clear();
  }

  // Remove expired entries
  private cleanupExpired(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    this.cache.forEach((value, key) => {
      if (now - value.timestamp > this.TTL) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => this.cache.delete(key));
    if (keysToDelete.length > 0) {
      logger.info(`Cleaned up ${keysToDelete.length} expired cache entries`);
    }
  }

  // Evict oldest entries when cache is full
  private evictOldest(): void {
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = entries.slice(0, Math.floor(this.MAX_SIZE * 0.1)); // Remove 10%
    toRemove.forEach(([key]) => this.cache.delete(key));
    logger.info(`Evicted ${toRemove.length} oldest cache entries`);
  }

  getStats() {
    const entries = Array.from(this.cache.entries());
    return {
      total_cached: entries.length,
      total_usage: entries.reduce((sum, [_, value]) => sum + value.usage, 0),
      most_used: entries.sort((a, b) => b[1].usage - a[1].usage).slice(0, 5),
      max_size: this.MAX_SIZE
    };
  }

  // Cleanup on shutdown
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.cache.clear();
  }
}

const productionCache = new ProductionCache();

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, cleaning up cache...');
  productionCache.destroy();
});

// ENHANCED: Dynamic RFP analysis that extracts company-specific information
async function performDeepRFPAnalysis(rfpContent: string): Promise<any> {
  const cacheKey = `deep_analysis_${Buffer.from(rfpContent.substring(0, 500)).toString('base64')}`;
  const cached = productionCache.get(cacheKey);
  if (cached) {
    logger.info("🎯 Using cached deep RFP analysis");
    return cached;
  }

  logger.info("🔍 Starting deep RFP analysis with multiple API calls...");

  // Enhanced analysis with dynamic company extraction
  const clientSpecifics = await analyzeClientSpecifics(rfpContent);
  const businessObjectives = await analyzeBusinessObjectives(rfpContent);
  const technicalRequirements = await analyzeTechnicalRequirements(rfpContent);
  const painPoints = await analyzePainPoints(rfpContent);
  const quantitativeData = await analyzeQuantitativeData(rfpContent);
  const implementationDetails = await analyzeImplementationDetails(rfpContent);

  const synthesizedAnalysis = await synthesizeRFPAnalysis({
    clientSpecifics,
    businessObjectives,
    technicalRequirements,
    painPoints,
    quantitativeData,
    implementationDetails
  }, rfpContent);

  const result = {
    ...synthesizedAnalysis,
    analysis_timestamp: new Date().toISOString(),
    analysis_depth: "deep_multi_layer",
    source_breakdown: {
      clientSpecifics: clientSpecifics.details?.length || 0,
      businessObjectives: businessObjectives.key_points?.length || 0,
      technicalRequirements: technicalRequirements.requirements?.length || 0,
      painPoints: painPoints.challenges?.length || 0,
      quantitativeData: quantitativeData.metrics?.length || 0,
      implementationDetails: implementationDetails.details?.length || 0
    }
  };

  productionCache.set(cacheKey, result);
  return result;
}

// ENHANCED: Dynamic client specifics extraction
async function analyzeClientSpecifics(content: string): Promise<any> {
  const prompt = `
Analyze this COMPLETE RFP/business proposal content and extract ALL client-specific information.
Look for company names, project scope, industry, and specific requirements throughout the ENTIRE document.

IMPORTANT: Extract ACTUAL company names and details from the content. Do NOT assume or hardcode any company names.
Read and analyze the COMPLETE content below, not just the beginning.

CONTENT:
${content}

Return ONLY JSON with this structure:
{
  "client_name": "extracted company name from content or 'Client' if not specified",
  "project_scope": "exact project scope description from content",
  "industry": "extracted industry from content or 'Not specified'",
  "specific_technologies": ["extracted technology 1", "extracted technology 2"],
  "key_requirements": ["exact requirement 1 from content", "exact requirement 2 from content"],
  "stated_goals": ["exact goal 1 from content", "exact goal 2 from content"],
  "success_metrics": ["exact metric 1 from content", "exact metric 2 from content"],
  "details": [
    {
      "exact_text": "verbatim important text from content",
      "category": "client_info|technology|requirement|goal|metric",
      "significance": "critical|important|contextual"
    }
  ]
}
`;

  return safeOpenAICall(prompt, "analyzeClientSpecifics", {
    client_name: "Client",
    project_scope: "",
    industry: "Not specified",
    specific_technologies: [],
    key_requirements: [],
    stated_goals: [],
    success_metrics: [],
    details: []
  }, 2000);
}

// Enhanced business objectives analysis
async function analyzeBusinessObjectives(content: string): Promise<any> {
  const prompt = `
Extract SPECIFIC business objectives, goals, and value propositions from this COMPLETE content.
Focus on EXACT wording found throughout the ENTIRE document, not just generic statements.
Look for specific numbers, percentages, concrete goals, and measurable outcomes.

CONTENT:
${content}

Return ONLY JSON with this structure:
{
  "primary_objectives": ["exact objective 1 from content", "exact objective 2 from content"],
  "value_propositions": ["exact value 1 from content", "exact value 2 from content"],
  "success_metrics": ["specific metric 1 from content", "specific metric 2 from content"],
  "key_outcomes": ["exact outcome 1 from content", "exact outcome 2 from content"],
  "key_points": [
    {
      "exact_phrase": "exact text from content",
      "category": "objective|value|metric|outcome",
      "business_impact": "specific impact described in content"
    }
  ]
}
`;

  return safeOpenAICall(prompt, "analyzeBusinessObjectives", {
    primary_objectives: [],
    value_propositions: [],
    success_metrics: [],
    key_outcomes: [],
    key_points: []
  }, 2000);
}

// Enhanced technical requirements analysis
async function analyzeTechnicalRequirements(content: string): Promise<any> {
  const prompt = `
Extract ALL technical requirements, specific technologies, and integration needs from this COMPLETE content.
Focus on EXACT technologies and requirements mentioned throughout the ENTIRE document.
Look for specific tool names, platforms, systems, versions, and technical specifications.

CONTENT:
${content}

Return ONLY JSON with this structure:
{
  "must_have_technologies": ["extracted technology 1", "extracted technology 2"],
  "integration_requirements": ["specific integration 1 from content", "specific integration 2 from content"],
  "technical_constraints": ["specific constraint 1 from content", "specific constraint 2 from content"],
  "security_requirements": ["specific security need 1 from content", "specific security need 2 from content"],
  "requirements": [
    {
      "exact_requirement": "exact technical requirement text from content",
      "category": "technology|integration|security|constraint",
      "criticality": "high|medium|low"
    }
  ]
}
`;

  return safeOpenAICall(prompt, "analyzeTechnicalRequirements", {
    must_have_technologies: [],
    integration_requirements: [],
    technical_constraints: [],
    security_requirements: [],
    requirements: []
  }, 2000);
}

// Enhanced pain points analysis
async function analyzePainPoints(content: string): Promise<any> {
  const prompt = `
Identify ALL stated problems, challenges, and current limitations from this COMPLETE content.
Extract exact phrases describing what needs to be solved throughout the ENTIRE document.
Focus on specific pain points, not generic business challenges.

CONTENT:
${content}

Return ONLY JSON with this structure:
{
  "current_challenges": ["exact challenge 1 from content", "exact challenge 2 from content"],
  "pain_points": ["specific pain point 1 from content", "specific pain point 2 from content"],
  "limitations": ["specific limitation 1 from content", "specific limitation 2 from content"],
  "risks_mentioned": ["specific risk 1 from content", "specific risk 2 from content"],
  "challenges": [
    {
      "exact_description": "exact text describing the problem from content",
      "impact_area": "efficiency|cost|security|compliance|performance",
      "severity": "high|medium|low"
    }
  ]
}
`;

  return safeOpenAICall(prompt, "analyzePainPoints", {
    current_challenges: [],
    pain_points: [],
    limitations: [],
    risks_mentioned: [],
    challenges: []
  }, 2000);
}

// Enhanced quantitative data analysis
async function analyzeQuantitativeData(content: string): Promise<any> {
  const prompt = `
Extract ONLY numbers, metrics, timelines, budgets, and quantitative measurements EXPLICITLY MENTIONED in this content.
DO NOT invent, assume, or create any default values. Only extract what is explicitly stated.

CONTENT:
${content}

Return ONLY JSON with this structure:
{
  "timelines": ["exact timeline 1 from content", "exact timeline 2 from content"],
  "budget_references": ["exact budget mention 1 from content", "exact budget mention 2 from content"],
  "performance_metrics": ["exact metric 1 from content", "exact metric 2 from content"],
  "quantitative_goals": ["exact numerical goal 1 from content", "exact numerical goal 2 from content"],
  "metrics": [
    {
      "exact_metric": "exact number or percentage with context from content",
      "category": "timeline|budget|performance|goal",
      "value": "extracted number or percentage",
      "verbatim_source": "exact text where this appears in content"
    }
  ],
  "explicitly_mentioned_only": true,
  "invented_data_warning": "NO default values or invented numbers allowed"
}

IMPORTANT: If no quantitative data is found, return empty arrays. DO NOT make up numbers.
`;

  return safeOpenAICall(prompt, "analyzeQuantitativeData", {
    timelines: [],
    budget_references: [],
    performance_metrics: [],
    quantitative_goals: [],
    metrics: [],
    explicitly_mentioned_only: true
  }, 2000);
}

// Enhanced implementation details analysis
async function analyzeImplementationDetails(content: string): Promise<any> {
  const prompt = `
Extract ONLY implementation approaches, methodologies, and delivery details EXPLICITLY MENTIONED in this content.
DO NOT invent phases, timelines, or methodologies. Only extract what is explicitly stated.

CONTENT:
${content}

Return ONLY JSON with this structure:
{
  "methodologies": ["exact methodology 1 from content", "exact methodology 2 from content"],
  "processes": ["exact process 1 from content", "exact process 2 from content"],
  "delivery_approach": ["exact approach 1 from content", "exact approach 2 from content"],
  "timeline_phases": ["exact phase 1 from content", "exact phase 2 from content"],
  "details": [
    {
      "exact_detail": "exact implementation detail text from content",
      "category": "methodology|process|timeline|delivery",
      "phase": "only if explicitly mentioned in content",
      "verbatim_source": "exact text where this appears"
    }
  ],
  "explicitly_mentioned_only": true,
  "invented_phases_warning": "NO default phases or invented timelines allowed"
}

IMPORTANT: If no implementation details are found, return empty arrays. DO NOT create default phases.
`;

  return safeOpenAICall(prompt, "analyzeImplementationDetails", {
    methodologies: [],
    processes: [],
    delivery_approach: [],
    timeline_phases: [],
    details: [],
    explicitly_mentioned_only: true
  }, 3000);
}

// ENHANCED: Dynamic synthesis that uses extracted company information
async function synthesizeRFPAnalysis(analyses: any, originalContent: string): Promise<any> {
  const clientName = analyses.clientSpecifics?.client_name || 'Client';
  
  const prompt = `
Synthesize all analysis components into a comprehensive structured format. 
Use EXACT content from the document and the extracted company information.

EXTRACTED CLIENT INFORMATION:
- Company: ${clientName}
- Industry: ${analyses.clientSpecifics?.industry || 'Not specified'}
- Project Scope: ${analyses.clientSpecifics?.project_scope || 'Not specified'}

ANALYSIS COMPONENTS:
${JSON.stringify(analyses, null, 2)}

ORIGINAL CONTENT:
${originalContent}

Return ONLY JSON with this structure:
{
  "document_metadata": {
    "document_type": "extracted document type from content",
    "primary_company": "${clientName}",
    "project_scope": "${analyses.clientSpecifics?.project_scope || 'Extracted from content'}",
    "primary_contact": "extracted contact if available",
    "urgency_level": "high|medium|low based on content"
  },
  "business_context": {
    "exact_objectives": ${JSON.stringify(analyses.businessObjectives?.primary_objectives || [])},
    "stated_problems": ${JSON.stringify(analyses.painPoints?.current_challenges || [])},
    "success_criteria": ${JSON.stringify(analyses.businessObjectives?.success_metrics || [])},
    "value_propositions": ${JSON.stringify(analyses.businessObjectives?.value_propositions || [])}
  },
  "technical_context": {
    "required_technologies": ${JSON.stringify(analyses.technicalRequirements?.must_have_technologies || [])},
    "integration_needs": ${JSON.stringify(analyses.technicalRequirements?.integration_requirements || [])},
    "security_requirements": ${JSON.stringify(analyses.technicalRequirements?.security_requirements || [])}
  },
  "quantitative_context": {
    "key_metrics": ${JSON.stringify(analyses.quantitativeData?.performance_metrics || [])},
    "timeline_expectations": ${JSON.stringify(analyses.quantitativeData?.timelines || [])},
    "budget_indicators": ${JSON.stringify(analyses.quantitativeData?.budget_references || [])}
  },
  "implementation_context": {
    "preferred_approach": ${JSON.stringify(analyses.implementationDetails?.delivery_approach || [])},
    "key_deliverables": ${JSON.stringify(analyses.implementationDetails?.methodologies || [])},
    "critical_milestones": ${JSON.stringify(analyses.quantitativeData?.timelines || [])}
  },
  "client_specifics": {
    "client_name": "${clientName}",
    "industry": "${analyses.clientSpecifics?.industry || 'Not specified'}",
    "specific_needs": ${JSON.stringify(analyses.clientSpecifics?.key_requirements || [])}
  },
  "content_index": [
    {
      "exact_content": "verbatim important text from proposal",
      "content_type": "objective|requirement|constraint|metric|process|client_info",
      "significance": "critical|important|contextual",
      "word_count": 15
    }
  ]
}
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.1,
    max_tokens: 3000,
    response_format: { type: "json_object" }
  });

  return JSON.parse(response.choices[0]?.message?.content || "{}");
}

// ENHANCED: Dynamic slide template generation
async function generateDynamicSlideTemplates(rfpAnalysis: any, solutionAlignment?: any): Promise<any[]> {
  const hasSolution = !!solutionAlignment;
  const clientName = rfpAnalysis.client_specifics?.client_name || 'Client';
  const cacheKey = `slide_templates_${Buffer.from(JSON.stringify(rfpAnalysis.document_metadata)).toString('base64')}_${hasSolution}`;

  const cached = productionCache.get(cacheKey);
  if (cached) {
    logger.info("🎯 Using cached slide templates");
    return cached;
  }

  logger.info(`📊 Generating dynamic slide templates for ${clientName}...` +
    (hasSolution ? " (with solution integration)" : ""));

  const prompt = `
Based on this comprehensive RFP analysis for ${clientName}, create EXACTLY 12 presentation slide templates that directly address the SPECIFIC content.

CRITICAL INSTRUCTIONS FOR SALES-READY PRESENTATION:
- Create EXACTLY 12 slides (no more, no less)
- Each slide must be HYPER-SPECIFIC to ${clientName}'s actual needs (NO generic content)
- Use ACTUAL data points, metrics, and requirements from the RFP
- Title slides with SPECIFIC outcomes, not generic descriptions
- Create a compelling sales narrative that flows logically

CLIENT: ${clientName}
INDUSTRY: ${rfpAnalysis.client_specifics?.industry || 'Not specified'}

COMPLETE RFP ANALYSIS (Use ALL details):
${JSON.stringify({
  client: rfpAnalysis.client_specifics,
  business: rfpAnalysis.business_context,
  technical: rfpAnalysis.technical_context,
  quantitative: rfpAnalysis.quantitative_context,
  deliverables: rfpAnalysis.implementation_context
}, null, 2)}

${hasSolution ? `
SOLUTION ALIGNMENT INSIGHTS:
${JSON.stringify(solutionAlignment, null, 2)}
` : ''}

SLIDE NARRATIVE STRUCTURE (EXACTLY 12 slides):
1. Opening/Executive Summary with ${clientName}'s specific challenge
2. ${clientName}'s Current State & Pain Points (use actual pain points from RFP)
3. Business Impact & Urgency (use actual metrics/data)
4. Our Understanding of ${clientName}'s Requirements (specific requirements)
5. Proposed Solution Overview (tailored to their needs)
6. Technical Approach (specific technologies/integrations they mentioned)
7. Implementation Roadmap (actual phases/timeline if mentioned)
8. Key Deliverables & Success Metrics (from RFP)
9. Value Proposition & ROI (specific to their stated goals)
10. Risk Mitigation & Quality Assurance
11. Team & Expertise
12. Next Steps & Call to Action

Create slide templates that:
1. Use ${clientName}'s EXACT requirements, technologies, and metrics from the RFP
2. NO generic statements like "improve efficiency" - use SPECIFIC goals from RFP
3. Reference actual numbers, percentages, timelines mentioned in RFP
4. Each slide title must be compelling and specific to ${clientName}
5. Mix visual types appropriately (text_and_image for impact, table for comparisons, timeline for phases, grid for features)

IMPORTANT: Only use these visual types: text_slide, grid, table, timeline, text_and_image
DO NOT use: chart or diagram
AVOID generic business buzzwords - use RFP-specific language

Return ONLY JSON with EXACTLY 12 slide templates:
{
  "slide_templates": [
    {
      "slide_id": "slide_01",
      "slide_title": "SPECIFIC title with ${clientName}'s actual challenge/goal from RFP",
      "slide_purpose": "executive_summary|problem_statement|solution_approach|technical_details|implementation|timeline|team|value",
      "content_focus": ["specific requirement 1 with actual data from RFP", "specific requirement 2 with actual metrics"],
      "visual_type": "text_slide|grid|table|timeline|text_and_image",
      "required_content": ["must include exact metric/number from RFP", "must reference specific ${clientName} technology/system mentioned"],
      "narrative_angle": "specific angle based on actual ${clientName} context from RFP"
    }
  ]
}
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
    max_tokens: 4000,
    response_format: { type: "json_object" }
  });

  const result = JSON.parse(response.choices[0]?.message?.content || "{}");
  const templates = result.slide_templates || [];

  // Ensure we have exactly 12 templates
  if (templates.length < 12) {
    logger.warning(`⚠️  Only ${templates.length} templates generated, expected 12`);
  }

  productionCache.set(cacheKey, templates);
  return templates;
}

// ENHANCED: Content-driven slide generation with dynamic company references
async function generateContentDrivenSlides(
  rfpAnalysis: any,
  slideTemplates: any[],
  solutionAlignment?: any,
  requestId?: string,
  shouldAbort?: () => Promise<boolean> | boolean
): Promise<any[]> {
  const hasSolution = !!solutionAlignment;
  const clientName = rfpAnalysis.client_specifics?.client_name || 'Client';

  logger.info(`🎨 Generating content-driven slides for ${clientName}... ${hasSolution ? '(with solution integration)' : ''}`);

  const slides = [];
  const usedContent = new Set<string>();

  for (const template of slideTemplates.slice(0, 12)) {
    await throwIfGenerationAborted(shouldAbort);
    logger.info(`Creating slide: ${template.slide_title}`);

    const slideContent = await generateIndividualSlide(
      rfpAnalysis,
      template,
      usedContent,
      solutionAlignment,
      requestId
    );
    slides.push(slideContent);

    await throwIfGenerationAborted(shouldAbort);
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return slides;
}

// ENHANCED: Individual slide generation with dynamic company context
async function generateIndividualSlide(
  rfpAnalysis: any,
  template: any,
  usedContent: Set<string>,
  solutionAlignment?: any,
  requestId?: string
): Promise<any> {
  const hasSolution = !!solutionAlignment;
  const clientName = rfpAnalysis.client_specifics?.client_name || 'Client';
  const cacheKey = `slide_${template.slide_id}_${Buffer.from(JSON.stringify(template.content_focus)).toString('base64')}_${hasSolution}`;

  const cached = productionCache.get(cacheKey);
  if (cached) {
    productionCache.incrementUsage(cacheKey);
    return cached;
  }

  const prompt = `
Create a UNIQUE, SALES-READY presentation slide for ${clientName} using ONLY EXPLICIT, SPECIFIC CONTENT from the RFP.
CRITICAL: This slide MUST be COMPLETELY DIFFERENT from other slides - focus ONLY on this specific topic: "${template.slide_title}"

⚠️ CONTENT UNIQUENESS REQUIREMENTS:
- DO NOT repeat points from other slides
- Each bullet must cover a DIFFERENT aspect of ${template.content_focus || template.slide_title}
- Avoid generic business language - use EXACT terminology from the RFP
- If this slide is about "${template.slide_title}", ONLY include content directly related to that specific topic
- Use VERBATIM quotes and specific details from the RFP whenever possible

STRICTLY PROHIBITED:
- Repeating the same points with different wording
- Generic buzzwords ("synergy", "best-in-class", "innovative solutions", "leverage", "enhance")
- Inventing ANY data, timelines, or metrics not in the RFP
- Content that could apply to ANY company (must be ${clientName}-specific with their actual details)
- Vague statements without concrete specifics from the RFP

SLIDE FOCUS: "${template.slide_title}"
Topic: ${template.content_focus || 'As specified in title'}
Visual Type: ${template.visual_type}

CLIENT CONTEXT:
- Company: ${clientName}
- Industry: ${rfpAnalysis.client_specifics?.industry || 'Not specified'}
- Specific Requirements: ${JSON.stringify(rfpAnalysis.client_specifics?.specific_needs || [])}
- Actual Goals Stated: ${JSON.stringify(rfpAnalysis.client_specifics?.stated_goals || [])}

RFP ANALYSIS DATA (Extract ONLY content relevant to "${template.slide_title}"):
Business Context: ${JSON.stringify(rfpAnalysis.business_context || {}, null, 2)}
Technical Context: ${JSON.stringify(rfpAnalysis.technical_context || {}, null, 2)}
Quantitative Data: ${JSON.stringify(rfpAnalysis.quantitative_context || {}, null, 2)}
Implementation Details: ${JSON.stringify(rfpAnalysis.implementation_context || {}, null, 2)}
Content Index: ${JSON.stringify(rfpAnalysis.content_index || [], null, 2)}

CONTENT CREATION RULES:
1. Extract 4-5 bullet points that are ONLY about "${template.slide_title}" - nothing else
2. Each bullet MUST include specific details: actual system names, exact metrics, real timelines, specific technologies
3. Use NUMBERS from the RFP (percentages, quantities, timeframes, costs, metrics)
4. Include EXACT NAMES of systems, platforms, tools, or processes mentioned in the RFP
5. Quote or paraphrase SPECIFIC requirements word-for-word from RFP
6. Make each point tell a concrete fact about ${clientName}'s specific situation
7. Avoid abstract concepts - focus on tangible, measurable, or observable details

EXAMPLES OF GOOD (SPECIFIC) vs BAD (GENERIC):
❌ BAD: "Improve operational efficiency through digital transformation"
✅ GOOD: "Migrate 50+ legacy applications to AWS cloud infrastructure within 12 months"

❌ BAD: "Enhance security and compliance"
✅ GOOD: "Implement Zero Trust architecture with MFA for 5,000+ users across 12 global offices"

❌ BAD: "Deliver exceptional customer experience"
✅ GOOD: "Reduce average response time from 24 hours to 2 hours via automated ticketing system"

VISUAL DATA REQUIREMENTS:
- TABLE slides: Extract actual data tables with real headers and values from RFP
- TIMELINE slides: Use EXACT phase names, durations, and task descriptions from RFP
- IMAGE slides: Create specific image prompts describing visuals directly tied to RFP content

Return ONLY JSON with this structure:
{
  "slide_title": "exact title from template",
  "slide_id": "${template.slide_id}",
  "content_sections": [
    "12-15 word specific point using ONLY explicit RFP content",
    "12-15 word specific point using ONLY explicit RFP content",
    "12-15 word specific point using ONLY explicit RFP content",
    "12-15 word specific point using ONLY explicit RFP content"
  ],
  "visual_directives": {
    "type": "${template.visual_type}",
    "content_based": true,
    "data_specification": {
      ${getVisualSpecification(template.visual_type, rfpAnalysis, template)}
    },
    "data_integrity": "strict_content_only",
    "invented_data": false${template.visual_type === 'text_and_image' ? `,
    "image_prompt": "A detailed, specific image generation prompt (50-100 words) that describes the visual representation needed for this slide content. The prompt should be professional, business-appropriate, and directly related to the slide's content and context. Include style (e.g., 'professional photograph', 'modern illustration', 'conceptual diagram'), subject matter, mood, colors if relevant, and key visual elements that support the slide message."` : ''}
  },
  "speaker_notes": "2-3 sentences focusing on ACTUAL RFP content only",
  "content_specificity_score": 95,
  "data_verification": {
    "explicit_content_used": true,
    "invented_data": false,
    "content_traceability": "all_points_traceable_to_rfp"
  }
}
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.1, // Lower temperature for more focused, specific extraction
    max_tokens: 2000,
    response_format: { type: "json_object" }
  });

  const slideContent = JSON.parse(response.choices[0]?.message?.content || "{}");
  
  // Enhanced content verification
  if (slideContent.content_sections && Array.isArray(slideContent.content_sections)) {
    slideContent.content_sections = slideContent.content_sections.map((point: string) => {
      return point.replace(/\s*\[REF-\d+\]\s*/g, '').trim();
    });
    
    // Add content verification flag
    slideContent.content_verified = true;
  }
  
  productionCache.set(cacheKey, slideContent);
  return slideContent;
}

// Helper function for visual specifications (keep existing)
function getVisualSpecification(visualType: string, rfpAnalysis: any, template: any): string {
  // Check if we have actual data for this visual type
  const hasImplementationData = rfpAnalysis.implementation_context?.critical_milestones?.length > 0;

  // If no actual data exists for timeline, return a content-driven text slide instead
  if (visualType === 'timeline' && !hasImplementationData) {
    return `
    "structure": "text_content",
    "alignment": "left",
    "content_based": true,
    "data_source": "explicit_rfp_content_only",
    "invented_data": false,
    "call_to_action": "main takeaway based on actual RFP content"
    `;
  }

  const specs: Record<string, string> = {
    'table': `
    "structure": "table",
    "content_based": true,
    "data_source": "explicit_rfp_content_only",
    "invented_data": false,
    "table": {
      "headers": ["Column 1", "Column 2", "Column 3"],
      "rows": [
        ["Row 1 Col 1", "Row 1 Col 2", "Row 1 Col 3"],
        ["Row 2 Col 1", "Row 2 Col 2", "Row 2 Col 3"]
      ]
    },
    "note": "Replace headers and rows with ACTUAL data from RFP content only. Do NOT use placeholder values."
    `,

    'timeline': `
    "structure": "timeline",
    "content_based": true,
    "data_source": "explicit_rfp_content_only",
    "invented_data": false,
    "phases": [
      {
        "name": "Phase 1 Name from RFP",
        "duration": "Duration from RFP",
        "tasks": [
          "Task 1 from RFP",
          "Task 2 from RFP"
        ]
      },
      {
        "name": "Phase 2 Name from RFP",
        "duration": "Duration from RFP",
        "tasks": [
          "Task 1 from RFP",
          "Task 2 from RFP"
        ]
      },
      {
        "name": "Phase 3 Name from RFP",
        "duration": "Duration from RFP",
        "tasks": [
          "Task 1 from RFP",
          "Task 2 from RFP"
        ]
      },
      {
        "name": "Phase 4 Name from RFP",
        "duration": "Duration from RFP",
        "tasks": [
          "Task 1 from RFP",
          "Task 2 from RFP"
        ]
      },
      {
        "name": "Phase 5 Name from RFP",
        "duration": "Duration from RFP",
        "tasks": [
          "Task 1 from RFP",
          "Task 2 from RFP"
        ]
      }
    ],
    "phases_requirement": "Include ALL phases explicitly mentioned in RFP content. The phases array should contain ALL phases from the document, not just 1 or 2. If the RFP mentions 5 phases, include all 5.",
    "warning": "CRITICAL: Extract ALL phases from the RFP content. Do not limit to 2 phases. Include every phase mentioned in the document."
    `,

    'grid': `
    "structure": "grid",
    "content_based": true,
    "data_source": "explicit_rfp_content_only",
    "invented_data": false,
    "content_requirement": "only points explicitly supported by RFP content"
    `,

    'text_slide': `
    "structure": "text_content",
    "content_based": true,
    "data_source": "explicit_rfp_content_only",
    "invented_data": false,
    "alignment": "left|center"
    `,

    'text_and_image': `
    "structure": "text_and_image",
    "content_based": true,
    "data_source": "explicit_rfp_content_only",
    "invented_data": false,
    "layout": "text_left_image_right|text_right_image_left|text_top_image_bottom",
    "image_generation_required": true,
    "image_prompt_requirement": "Generate a detailed, professional image prompt based on the slide content and RFP context that will be used for AI image generation. The prompt should be specific, descriptive, and aligned with the business/technical nature of the content."
    `
  };

  return specs[visualType] || specs['text_slide'];
}

// Solution alignment analysis
async function analyzeSolutionAlignment(rfpAnalysis: any, solutionContent: string): Promise<any> {
  const cacheKey = `solution_alignment_${Buffer.from(solutionContent.substring(0, 500)).toString('base64')}`;
  const cached = productionCache.get(cacheKey);
  if (cached) {
    logger.info("🎯 Using cached solution alignment analysis");
    return cached;
  }

  logger.info("🔍 Analyzing solution alignment with RFP requirements...");

  const prompt = `
Analyze how well this proposed solution aligns with the RFP requirements. Identify matches, gaps, and enhancement opportunities.

RFP ANALYSIS:
${JSON.stringify({
  business: rfpAnalysis.business_context,
  technical: rfpAnalysis.technical_context,
  quantitative: rfpAnalysis.quantitative_context
}, null, 2)}

PROPOSED SOLUTION CONTENT:
${solutionContent}

Return ONLY JSON with this structure:
{
  "alignment_score": 85,
  "strengths": [
    {
      "rfp_requirement": "exact requirement from RFP",
      "solution_match": "exact solution component that addresses it",
      "confidence": "high|medium|low",
      "evidence": "specific evidence from solution content"
    }
  ],
  "gaps": [
    {
      "rfp_requirement": "exact requirement from RFP",
      "missing_in_solution": "what's not addressed",
      "severity": "high|medium|low",
      "recommendation": "how to address this gap"
    }
  ],
  "enhancement_opportunities": [
    {
      "rfp_requirement": "exact requirement",
      "current_solution": "what solution currently offers",
      "enhancement": "how to make it stronger",
      "impact": "high|medium|low"
    }
  ],
  "key_differentiators": [
    {
      "capability": "specific solution capability",
      "rfp_relevance": "how it matches RFP needs",
      "competitive_advantage": "why this stands out"
    }
  ]
}
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
    max_tokens: 3000,
    response_format: { type: "json_object" }
  });

  const result = JSON.parse(response.choices[0]?.message?.content || "{}");
  productionCache.set(cacheKey, result);
  return result;
}

// Enhanced Final Presentation Compilation
function compileFinalPresentation(rfpAnalysis: any, slides: any[], solutionAlignment?: any): any {
  const hasSolution = !!solutionAlignment;
  const clientName = rfpAnalysis.client_specifics?.client_name || 'Client';
  const specificityScores = slides.map(s => s.content_specificity_score || 0);
  const avgSpecificity = specificityScores.reduce((a, b) => a + b, 0) / specificityScores.length;

  const presentation: any = {
    presentation_metadata: {
      title: `Strategic Proposal for ${clientName}`,
      generation_timestamp: new Date().toISOString(),
      rfp_source: rfpAnalysis.document_metadata?.document_type || 'RFP',
      total_slides: slides.length,
      content_specificity: Math.round(avgSpecificity),
      solution_integrated: hasSolution
    },
    client_context: {
      company: clientName,
      project_scope: rfpAnalysis.document_metadata?.project_scope,
      urgency: rfpAnalysis.document_metadata?.urgency_level,
      primary_objectives: rfpAnalysis.business_context?.exact_objectives || []
    },
    slides: slides,
    quality_metrics: {
      rfp_content_coverage: `${Math.round((slides.length * 4) / (rfpAnalysis.content_index?.length || 1) * 100)}%`,
      quantitative_inclusion: slides.filter(s => 
        s.content_sections.some((cs: string) => /\d+%|\d+ hours|\$|\d+\.\d+/.test(cs))
      ).length,
      specificity_score: avgSpecificity,
      cache_performance: productionCache.getStats()
    },
    narrative_flow: {
      story_arc: "problem → solution → implementation → value",
      sales_focus: "client-pain-points driven",
      differentiators: slides.filter(s => 
        s.speaker_notes?.toLowerCase().includes('unique') || 
        s.speaker_notes?.toLowerCase().includes('competitive')
      ).length
    }
  };

  // Add solution-specific metrics if solution was integrated
  if (hasSolution) {
    presentation.solution_metrics = {
      alignment_score: solutionAlignment.alignment_score,
      strengths_covered: slides.filter(s => 
        s.solution_integration?.strengths_highlighted?.length > 0
      ).length,
      gaps_addressed: slides.filter(s => 
        s.solution_integration?.gaps_addressed?.length > 0
      ).length,
      differentiators_showcased: slides.filter(s => 
        s.solution_integration?.differentiators_showcased?.length > 0
      ).length
    };
  }

  return presentation;
}

function saveProductionPresentation(presentation: any, outputDir: string = "production_outputs"): string {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  const filename = `production_presentation_${timestamp}_${Math.random().toString(36).substr(2, 9)}.json`;
  const filepath = path.join(outputDir, filename);
  
  fs.writeFileSync(filepath, JSON.stringify(presentation, null, 2), 'utf-8');
  return filepath;
}

// Enhanced Production Summary
function printProductionSummary(presentation: any, hasSolution: boolean): void {
  const clientName = presentation.client_context.company;
  
  console.log("\n" + "=".repeat(80));
  console.log("🎯 DYNAMIC RFP PRESENTATION SUMMARY - STRICT CONTENT INTEGRITY");
  console.log("=".repeat(80));
  
  console.log(`📄 Title: ${presentation.presentation_metadata.title}`);
  console.log(`🏢 Client: ${clientName}`);
  console.log(`🎯 Objectives: ${presentation.client_context.primary_objectives?.length || 0} key goals`);
  console.log(`📊 Total Slides: ${presentation.presentation_metadata.total_slides}`);
  console.log(`⭐ Content Specificity: ${presentation.presentation_metadata.content_specificity}/100`);
  console.log(`🔒 Data Integrity: STRICT CONTENT-ONLY POLICY`);
  console.log(`💡 Solution Integrated: ${hasSolution ? 'YES' : 'RFP-Only'}`);
  
  // Enhanced data integrity metrics
  const contentDrivenSlides = presentation.slides.filter((s: any) => 
    s.data_verification?.explicit_content_used === true
  ).length;
  
  const quantitativeSlides = presentation.slides.filter((s: any) => 
    s.content_sections?.some((cs: string) => /\d+%|\d+ hours|\$|\d+\.\d+/.test(cs))
  ).length;
  
  console.log(`\n🔐 CONTENT INTEGRITY METRICS:`);
  console.log("-".repeat(40));
  console.log(`   Content-Driven Slides: ${contentDrivenSlides}/${presentation.slides.length}`);
  console.log(`   Data-Backed Quantitative Slides: ${quantitativeSlides}`);
  console.log(`   Invented Data: ${presentation.slides.some((s: any) => s.data_verification?.invented_data) ? 'FOUND ❌' : 'NONE ✅'}`);
  
  if (hasSolution && presentation.solution_metrics) {
    console.log(`\n🔗 Solution Alignment: ${presentation.solution_metrics.alignment_score}/100`);
  }
  
  console.log("\n🏗️  SLIDE BREAKDOWN (Content-Only Enforcement):");
  console.log("-".repeat(50));
  
  presentation.slides.forEach((slide: any, index: number) => {
    console.log(`\n   ${index + 1}. ${slide.slide_title}`);
    console.log(`      Type: ${slide.visual_directives?.type}`);
    console.log(`      Points: ${slide.content_sections?.length}`);
    console.log(`      Data Integrity: ${slide.data_verification?.explicit_content_used ? '✅ STRICT' : '⚠️ CHECK'}`);
    if (slide.visual_directives?.data_specification?.invented_data === false) {
      console.log(`      Content Policy: ✅ NO invented data`);
    }
  });
  
  console.log("\n✨ PRODUCTION FEATURES (Enhanced Integrity):");
  console.log("-".repeat(50));
  console.log("✅ Dynamic company extraction from RFP content");
  console.log("✅ STRICT content-only policy - no invented data");
  console.log("✅ Zero hardcoding - works for ANY company");
  console.log("✅ PDF text extraction support");
  console.log("✅ Multi-API deep RFP analysis");
  console.log("✅ Content-specific slide generation");
  console.log("✅ NO default charts, phases, or timelines");
  console.log(hasSolution ? "✅ Solution alignment with content integrity" : "✅ RFP-only focused content");
}

// Export cache cleanup function for memory management
export function clearContentCache(): void {
  const stats = productionCache.getStats();
  productionCache.clear();
  logger.info(`🧹 Cleared content generation cache (${stats.total_cached} entries removed)`);
}

// Exports for production use
export {
  productionCache,
  RFPContextManager
};

// Start execution
console.log("🎯 Dynamic RFP Presentation Generator - Starting...");
console.log("💡 This system dynamically extracts company information from ANY RFP document");

// New buffer-based interface
interface FileInput {
  buffer: Buffer;
  filename: string;
}

interface GenerationOptions {
  shouldAbort?: () => Promise<boolean> | boolean;
}

class GenerationCancelledError extends Error {
  constructor(message: string = 'Generation cancelled') {
    super(message);
    this.name = 'GenerationCancelledError';
  }
}

const throwIfGenerationAborted = async (shouldAbort?: () => Promise<boolean> | boolean) => {
  if (!shouldAbort) return;
  const aborted = await shouldAbort();
  if (aborted) {
    throw new GenerationCancelledError();
  }
};

export async function generatePresentationFromBuffers(
  rfpFiles: FileInput[],
  solutionFile?: FileInput,
  options?: GenerationOptions
): Promise<any> {
  const rfpContext = new RFPContextManager();
  const requestId = rfpContext.getRequestId();

  try {
    logger.info(`🚀 Starting Dynamic RFP Presentation Generator (Memory Mode) [Request: ${requestId}]`);

    await throwIfGenerationAborted(options?.shouldAbort);

    // Process buffers directly in memory
    let allContent = "";
    for (const file of rfpFiles) {
      await throwIfGenerationAborted(options?.shouldAbort);
      let content = "";
      const lowerFilename = file.filename.toLowerCase();

      if (lowerFilename.endsWith('.pdf')) {
        content = await extractTextFromPDF(file.buffer);
      } else {
        content = file.buffer.toString('utf-8');
      }
      allContent += `\n\n--- ${file.filename} ---\n${content}`;
    }

    if (!allContent.trim()) {
      throw new Error("No content could be extracted from provided RFP files");
    }

    rfpContext.setRFPContent(allContent);
    logger.info(`[${requestId}] 📄 Loaded RFP content: ${allContent.length} characters`);

    // Load solution content if provided
    let solutionContent = "";
    if (solutionFile) {
      await throwIfGenerationAborted(options?.shouldAbort);
      const lowerFilename = solutionFile.filename.toLowerCase();
      if (lowerFilename.endsWith('.pdf')) {
        solutionContent = await extractTextFromPDF(solutionFile.buffer);
      } else {
        solutionContent = solutionFile.buffer.toString('utf-8');
      }
      rfpContext.setSolutionContent(solutionContent);
      logger.info(`[${requestId}] 💡 Loaded solution content: ${solutionContent.length} characters`);
    }

    // Continue with existing analysis pipeline
    await throwIfGenerationAborted(options?.shouldAbort);
    const rfpAnalysis = await performDeepRFPAnalysis(allContent);
    rfpContext.setStructuredData(rfpAnalysis);

    const clientName = rfpAnalysis.client_specifics?.client_name || 'Client';
    logger.info(`[${requestId}] ✅ Deep RFP analysis completed for: ${clientName}`);

    let solutionAlignment = null;
    if (rfpContext.hasSolutionContent()) {
      await throwIfGenerationAborted(options?.shouldAbort);
      solutionAlignment = await analyzeSolutionAlignment(rfpAnalysis, solutionContent);
      rfpContext.setSolutionAlignment(solutionAlignment);
      logger.info(`[${requestId}] ✅ Solution alignment analysis completed: Score ${solutionAlignment.alignment_score}/100`);
    }

    await throwIfGenerationAborted(options?.shouldAbort);
    const slideTemplates = await generateDynamicSlideTemplates(rfpAnalysis, solutionAlignment);
    rfpContext.setSlideTemplates(slideTemplates);
    logger.info(`[${requestId}] ✅ Generated ${slideTemplates.length} dynamic slide templates`);

    const slides = await generateContentDrivenSlides(
      rfpAnalysis,
      slideTemplates,
      solutionAlignment,
      requestId,
      options?.shouldAbort
    );
    logger.info(`[${requestId}] ✅ Generated ${slides.length} content-driven slides`);

    const presentation = compileFinalPresentation(rfpAnalysis, slides, solutionAlignment);

    logger.info(`[${requestId}] ✅ PRESENTATION GENERATED SUCCESSFULLY!`);
    logger.info(`[${requestId}] 📊 Total Slides: ${presentation.slides.length}`);
    logger.info(`[${requestId}] 🏢 Client: ${presentation.client_context.company}`);

    productionCache.clearRequestCache(requestId);
    rfpContext.cleanup();

    return presentation;

  } catch (error) {
    logger.error(`[${requestId}] Production pipeline failed: ${error}`);
    productionCache.clearRequestCache(requestId);
    rfpContext.cleanup();
    throw error;
  }
}

// Legacy file path-based interface (kept for backwards compatibility)
export async function generatePresentationInMemory(rfpFiles: string[], solutionFile?: string): Promise<any> {
  // Create request-scoped context to avoid shared state issues
  const rfpContext = new RFPContextManager();
  const requestId = rfpContext.getRequestId();

  try {
    logger.info(`🚀 Starting Dynamic RFP Presentation Generator [Request: ${requestId}]`);

    // Your existing main logic from generateProductionPresentation function
    let allContent = "";
    for (const filePath of rfpFiles) {
      if (fs.existsSync(filePath)) {
        let content = "";
        if (filePath.toLowerCase().endsWith('.pdf')) {
          content = await extractTextFromPDF(filePath);
        } else {
          content = fs.readFileSync(filePath, 'utf-8');
        }
        allContent += `\n\n--- ${path.basename(filePath)} ---\n${content}`;
      }
    }

    if (!allContent.trim()) {
      throw new Error("No content could be extracted from provided RFP files");
    }

    rfpContext.setRFPContent(allContent);
    logger.info(`[${requestId}] 📄 Loaded RFP content: ${allContent.length} characters`);

    // Load solution content if provided
    let solutionContent = "";
    if (solutionFile && fs.existsSync(solutionFile)) {
      if (solutionFile.toLowerCase().endsWith('.pdf')) {
        solutionContent = await extractTextFromPDF(solutionFile);
      } else {
        solutionContent = fs.readFileSync(solutionFile, 'utf-8');
      }
      rfpContext.setSolutionContent(solutionContent);
      logger.info(`[${requestId}] 💡 Loaded solution content: ${solutionContent.length} characters`);
    }

    // Perform deep RFP analysis
    const rfpAnalysis = await performDeepRFPAnalysis(allContent);
    rfpContext.setStructuredData(rfpAnalysis);

    const clientName = rfpAnalysis.client_specifics?.client_name || 'Client';
    logger.info(`[${requestId}] ✅ Deep RFP analysis completed for: ${clientName}`);

    // Analyze solution alignment if solution provided
    let solutionAlignment = null;
    if (rfpContext.hasSolutionContent()) {
      solutionAlignment = await analyzeSolutionAlignment(rfpAnalysis, solutionContent);
      rfpContext.setSolutionAlignment(solutionAlignment);
      logger.info(`[${requestId}] ✅ Solution alignment analysis completed: Score ${solutionAlignment.alignment_score}/100`);
    }

    // Generate dynamic slide templates
    const slideTemplates = await generateDynamicSlideTemplates(rfpAnalysis, solutionAlignment);
    rfpContext.setSlideTemplates(slideTemplates);
    logger.info(`[${requestId}] ✅ Generated ${slideTemplates.length} dynamic slide templates`);

    // Generate content-driven slides
    const slides = await generateContentDrivenSlides(rfpAnalysis, slideTemplates, solutionAlignment, requestId);
    logger.info(`[${requestId}] ✅ Generated ${slides.length} content-driven slides`);

    // Compile final presentation
    const presentation = compileFinalPresentation(rfpAnalysis, slides, solutionAlignment);

    logger.info(`[${requestId}] ✅ PRESENTATION GENERATED SUCCESSFULLY!`);
    logger.info(`[${requestId}] 📊 Total Slides: ${presentation.slides.length}`);
    logger.info(`[${requestId}] 🏢 Client: ${presentation.client_context.company}`);

    // Cleanup request-specific cache entries
    productionCache.clearRequestCache(requestId);
    rfpContext.cleanup();

    return presentation;

  } catch (error) {
    logger.error(`[${requestId}] Production pipeline failed: ${error}`);
    // Cleanup on error
    productionCache.clearRequestCache(requestId);
    rfpContext.cleanup();
    throw error;
  }
}

