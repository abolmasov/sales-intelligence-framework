import { getOpenAIService } from './openai.service';
import { getOpportunityDetectorService } from './opportunity-detector.service';

import axios from "axios";
import jwt from "jsonwebtoken";
import { TRANSCRIPT_PROMPT } from '../prompts/transcript-analysis';
import OpenAI from "openai";
import * as XLSX from 'xlsx';

/**
 * Enhanced Transcript Analysis Service (Pure TypeScript)
 * Integrates: Opportunity Detector + OpenAI Synthesis
 * No Python backend required!
 */

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
export class EnhancedTranscriptAnalysisService {
  private openai = getOpenAIService();
  private opportunityDetector = getOpportunityDetectorService();
  private readonly searchBaseUrl = (
    process.env.SALES_INTELLIGENCE_API_URL ||
    process.env.SALES_INTELLIGENCE_BASE_URL ||
    ''
  ).replace(/\/+$/, '');
  private readonly searchPath = process.env.SALES_INTELLIGENCE_SEARCH_PATH || '/v1/agent/sales-intelligence-search';
  private readonly searchApiKey = process.env.SALES_INTELLIGENCE_KEY || '';
  private readonly defaultSources = (process.env.SALES_INTELLIGENCE_SOURCES || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  private readonly requestTimeoutMs = Number(process.env.SALES_INTELLIGENCE_TIMEOUT_MS || 120000);

  private getSearchUrl(): string {
    if (!this.searchBaseUrl) {
      throw new Error('Missing SALES_INTELLIGENCE_BASE_URL');
    }
    if (!this.searchApiKey) {
      throw new Error('Missing SALES_INTELLIGENCE_KEY');
    }
    const path = this.searchPath.startsWith('/') ? this.searchPath : `/${this.searchPath}`;
    return `${this.searchBaseUrl}${path}`;
  }

  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private isRetryableSalesIntelligenceError(error: any): boolean {
    const status = Number(error?.response?.status || 0);
    const message = String(error?.message || '').toLowerCase();
    const dataText = typeof error?.response?.data === 'string' ? error.response.data.toLowerCase() : '';

    if (status === 429 || status === 502 || status === 503 || status === 504) return true;
    if (message.includes('timeout') || message.includes('socket hang up') || message.includes('econnreset')) return true;
    if (dataText.includes('gateway time-out') || dataText.includes('error code 504')) return true;
    return false;
  }

  async getOppurtunities(_email: String, _accessToken: String, prompt: String):Promise<string>{
    const url = this.getSearchUrl();
    const maxAttempts = 3;
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try{
        console.log('🔎 [Post-Call SI] Sending request to Sales Intelligence endpoint', {
          attempt,
          maxAttempts,
          url,
          onlyDocuments: true,
          useAlwaysTopicSearch: true,
          topK: 6,
          topicsTopK: 10,
          minScore: 5,
          promptChars: String(prompt || '').length,
        });

        const response = await axios.post(
          url,
          {
            input: String(prompt || ''),
            sources: this.defaultSources,
            useAlwaysTopicSearch: true,
            // Faster and more resilient for long transcript contexts: retrieve docs, synthesize locally.
            onlyDocuments: true,
            classificationModel: 'gpt-4.1-mini',
            answerModel: 'gpt-4.1-nano',
            topK: 6,
            topicsTopK: 10,
            minScore: 5,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'x-sales-intelligence-key': this.searchApiKey,
            },
            timeout: this.requestTimeoutMs,
          }
        );

        console.log('✅ [Post-Call SI] Response received', {
          attempt,
          status: response.status,
          hasData: Boolean(response?.data?.data),
          hasError: Boolean(response?.data?.error),
        });

        const payload = response?.data?.data;
        if (!payload) {
          console.warn('⚠ [Post-Call SI] No data payload returned', {
            attempt,
            error: response?.data?.error || null,
          });
          throw new Error(response?.data?.error || 'No data returned from sales intelligence search');
        }

        const references = (payload.referenceUrls || []).map((item: any) => ({
          title: item?.title || 'Untitled Reference',
          url: item?.referenceUrl,
        }));

        const docs = (payload.documents || []).slice(0, 8).map((doc: any) => ({
          title: doc?.title || 'Untitled Document',
          url: doc?.referenceUrl,
          snippet: typeof doc?.summary === 'string' && doc.summary.trim()
            ? doc.summary.trim()
            : typeof doc?.content === 'string'
              ? doc.content.replace(/\s+/g, ' ').trim().slice(0, 500)
              : '',
        }));

        const messages = payload.content && String(payload.content).trim()
          ? String(payload.content)
          : docs
              .map((d: any) => `- ${d.title}${d.url ? ` (${d.url})` : ''}\n  ${d.snippet || 'Relevant internal artifact.'}`)
              .join('\n\n');

        if (!docs.length && !references.length && !messages.trim()) {
          console.warn('⚠ [Post-Call SI] Empty result: no documents, references, or content returned');
        } else {
          console.log('📦 [Post-Call SI] Parsed result summary', {
            documents: docs.length,
            references: references.length,
            contentChars: messages.length,
          });
        }

        return JSON.stringify(
          {
            messages,
            references,
            documents: docs,
          },
          null,
          2
        );
      } catch(error: any) {
        lastError = error;
        const retryable = this.isRetryableSalesIntelligenceError(error);
        console.error(`❌ Error in get opportunities (attempt ${attempt}/${maxAttempts}):`, error.response?.data || error.message);

        if (!retryable || attempt === maxAttempts) {
          break;
        }

        const backoffMs = attempt * 1500;
        await this.delay(backoffMs);
      }
    }

    throw new Error(`Failed to fetch opportunities: ${lastError?.message || 'Unknown error'}`);
  }
  /**
   * Comprehensive transcript analysis combining all intelligence sources
   */
async analyzeTranscript(params: {
  transcriptText: string;
  companyName?: string;
  meetingTitle?: string;
  meetingContext?: string;
  dealId?: string;
  accountId?: string;
  accessToken?: string;
}) {
  console.log("🚀 Starting enhanced transcript analysis...");

  const results: any = {
    timestamp: new Date().toISOString(),
    transcriptLength: params.transcriptText.length,
    wordCount: params.transcriptText.split(/\s+/).length,
  };

  console.log("🎯 Step 1/4: Running opportunity detection...");

  try {
    const accessToken = params.accessToken;

    if (!accessToken) {
      throw new Error("Missing access token");
    }

    // Decode JWT
    const decoded = jwt.decode(accessToken) as any;
    const email =
      decoded?.unique_name ||
      decoded?.preferred_username ||
      decoded?.upn ||
      decoded?.email;

    if (!email) throw new Error("Unable to extract email from access token");

    // Keep SI request compact to reduce timeout risk and improve retrieval precision.
    const transcriptExcerpt = params.transcriptText.substring(0, 6000);
    const company = (params.companyName || 'Unknown company').trim();
    const meeting = (params.meetingTitle || 'Post-call analysis').trim();
    const context = (params.meetingContext || '').trim();
    const prompt = `Find internal Northstar Integrators artifacts relevant to this post-call.

Company: ${company}
Meeting: ${meeting}
${context ? `Context: ${context}` : ''}
Focus: Identify strongest proof points for follow-up and proposal.

Return artifacts that include:
- similar client context
- measurable outcomes
- delivery approach
- timeline or governance signals

Transcript excerpt:
${transcriptExcerpt}`;

    let opportunities = '';
    try {
      opportunities = await this.getOppurtunities(
        email,
        accessToken,
        prompt
      );
    } catch (siError: any) {
      console.warn('⚠ Sales Intelligence unavailable for transcript stage, continuing with transcript-only analysis:', siError?.message || siError);
      opportunities = JSON.stringify(
        {
          messages: 'Sales Intelligence service was temporarily unavailable. Proceeding with transcript-only analysis.',
          references: [],
          documents: [],
        },
        null,
        2
      );
    }
    const metadataBlock = [
      params.companyName ? `Account: ${params.companyName}` : null,
      params.meetingTitle ? `Meeting title: ${params.meetingTitle}` : null,
      params.meetingContext ? `Meeting context: ${params.meetingContext}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    const combinedUserMessage = `
${metadataBlock ? `### Context\n${metadataBlock}\n\n` : ''}### Sales Call Transcript
${params.transcriptText}

### Trusted Opportunity Intelligence (InternalKnowledge Output)
${opportunities}

### Reminder
- Use the transcript for timestamps, sentiment, and conversational context.
- Use ONLY the trusted opportunity data when listing opportunities.
- You MUST provide an explicit answer for every pursuit brief question (1-16). If information is missing, respond with "[Not enough information]".
`;

    const finalPrompt = [
      { role: "system", content: TRANSCRIPT_PROMPT },
      { role: "user", content: combinedUserMessage.trim() },
    ];

    const response = await openai.responses.create({
      model: "gpt-5",
      input: finalPrompt as any,
    });

    const outputText = response.output_text;

    // Safely parse JSON
    let data: any;
    try {
      data = JSON.parse(outputText);
    } catch (err) {
      console.warn("⚠ Model did not return valid JSON. Extracting...");
      const match = outputText.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("No JSON found in model output");
      data = JSON.parse(match[0]);
    }

    const requiredPursuitKeys = Array.from({ length: 16 }, (_, idx) => `${idx + 1}`);
    const defaultPursuitAnswer = "[Not enough information]";
    const pursuitBrief =
      data && typeof data.pursuitBrief === "object" && data.pursuitBrief !== null
        ? { ...data.pursuitBrief }
        : {};
    requiredPursuitKeys.forEach((key) => {
      const value = pursuitBrief[key];
      pursuitBrief[key] =
        typeof value === "string" && value.trim().length > 0
          ? value.trim()
          : defaultPursuitAnswer;
    });
    data.pursuitBrief = pursuitBrief;

    return { data };
  } catch (error: any) {
    console.error("❌ analyzeTranscript failed:", error.message);

    return {
      error: "Transcript analysis failed",
      details: error.message || String(error),
    };
  }
}

  /**
   * Enhanced AI analysis using OpenAI (replaces Python backend enhanced analysis)
   */
  private async performEnhancedAnalysis(
    transcriptText: string,
    companyName?: string,
    opportunityDetection?: any
  ) {
    const prompt = `You are an expert sales analyst for Northstar Integrators, a Platinum Atlassian Partner and Elite ServiceNow Partner with 20+ years of expertise in enterprise transformation.

Analyze this sales conversation transcript and provide comprehensive insights:

## Transcript:
${transcriptText.substring(0, 8000)}  // Limit to avoid token limits

## Opportunity Detection Signals:
${JSON.stringify(opportunityDetection, null, 2)}

## Your Task:

Analyze this transcript deeply and provide:

1. **Opportunity Score** (0-100): Overall opportunity strength
2. **Success Probability** (0.0-1.0): Likelihood this deal will close
3. **Sentiment Analysis**:
   - Overall sentiment (positive/neutral/negative)
   - Confidence (0.0-1.0)
   - Engagement level (high/medium/low)
   - Key emotions detected

4. **Buying Signals** - List specific buying signals with:
   - Signal description
   - Strength (strong/medium/weak)
   - Evidence (quote from transcript)

5. **Pain Points** - List specific pain points with:
   - Pain point description
   - Severity (critical/high/medium/low)
   - Evidence (quote from transcript)

6. **Recommended Products/Services**:
   - Atlassian products (Jira Software, Jira Service Management, Confluence, Jira Align, etc.)
   - ServiceNow modules (ITSM, ITOM, ITAM, HR Service Delivery, etc.)
   - Northstar Integrators services (Agile Transformation, SAFe Implementation, DevOps/CI-CD, Cloud Migration, etc.)
   For each recommendation:
     - Product/module/service name
     - Why it's relevant
     - Confidence (0.0-1.0)

7. **Competitive Landscape**:
   - Competitors mentioned
   - Our advantages vs competitors

8. **Stakeholders** - List stakeholders with:
   - Name or role
   - Role/title
   - Influence level (decision_maker/influencer/champion/user)
   - Sentiment toward our solution

9. **Timeline & Budget**:
   - Timeline information or "not mentioned"
   - Budget information or "not mentioned"
   - Urgency level (high/medium/low)

10. **Recommended Team Members** (who from Northstar Integrators should be involved):
    - Role (Enterprise Architects, Agile Coaches, DevOps Engineers, Training Specialists, etc.)
    - Reason why they should be involved
    - Priority (critical/high/medium/low)

11. **Next Steps** - Specific actions with:
    - Action description
    - Priority (critical/high/medium/low)
    - Timeline (when to do it)
    - Owner (who should do it)

12. **Executive Summary**: 2-3 paragraph summary of the conversation

13. **Risk Factors**: List potential risks or red flags

Format your response as JSON with this exact structure:
{
  "opportunity_score": 0-100,
  "success_probability": 0.0-1.0,
  "sentiment": {
    "overall": "positive|neutral|negative",
    "confidence": 0.0-1.0,
    "engagement_level": "high|medium|low",
    "key_emotions": ["curious", "excited", etc.]
  },
  "buying_signals": [
    {
      "signal": "Description",
      "strength": "strong|medium|weak",
      "evidence": "Quote"
    }
  ],
  "pain_points": [
    {
      "pain_point": "Description",
      "severity": "critical|high|medium|low",
      "evidence": "Quote"
    }
  ],
  "recommended_products": {
    "atlassian": [
      {
        "product": "Name",
        "relevance": "Why",
        "confidence": 0.0-1.0
      }
    ],
    "servicenow": [
      {
        "module": "Name",
        "relevance": "Why",
        "confidence": 0.0-1.0
      }
    ],
    "enterprise_services": [
      {
        "service": "Name",
        "relevance": "Why",
        "confidence": 0.0-1.0
      }
    ]
  },
  "competitive_landscape": {
    "competitors_mentioned": ["List"],
    "our_advantages": ["List"]
  },
  "stakeholders": [
    {
      "name": "Name or role",
      "role": "Role/title",
      "influence_level": "decision_maker|influencer|champion|user",
      "sentiment": "positive|neutral|negative"
    }
  ],
  "timeline_budget": {
    "timeline": "Timeline or 'not mentioned'",
    "budget": "Budget or 'not mentioned'",
    "urgency": "high|medium|low"
  },
  "recommended_team": [
    {
      "role": "Northstar Integrators role",
      "reason": "Why",
      "priority": "critical|high|medium|low"
    }
  ],
  "next_steps": [
    {
      "action": "Action",
      "priority": "critical|high|medium|low",
      "timeline": "When",
      "owner": "Who"
    }
  ],
  "executive_summary": "Summary",
  "risk_factors": ["List"]
}

Be specific, reference actual quotes from the transcript, and make concrete recommendations.`;

    const messages = [
      {
        role: 'system' as const,
        content:
          'You are an expert sales analyst for Northstar Integrators specializing in opportunity detection, sentiment analysis, and product/service matching for Atlassian and ServiceNow solutions.',
      },
      {
        role: 'user' as const,
        content: prompt,
      },
    ];

    return await this.openai.generateStructuredCompletion(messages, null, 0.3);
  }

  /**
   * Synthesize all analysis results into comprehensive summary
   */
  private async synthesizeAnalysis(
    transcriptText: string,
    enhancedAnalysis: any,
    opportunityDetection: any,
    services: any[],
    caseStudies: any[],
    companyName?: string
  ) {
    const prompt = `You are an expert sales strategist synthesizing multiple intelligence sources into actionable insights.

## Context
Company: ${companyName || 'Prospect'}
Transcript Length: ${transcriptText.split(/\s+/).length} words

## Intelligence Gathered

### 1. Opportunity Detection Signals
${JSON.stringify(opportunityDetection, null, 2)}

### 2. Enhanced AI Analysis
${JSON.stringify(enhancedAnalysis, null, 2)}

### 3. Relevant Services (${services.length} matched)
${services.map((s: any) => `- ${s.name} (${s.relevanceScore}% match): ${s.description?.substring(0, 100) || ''}`).join('\n')}

### 4. Relevant Case Studies (${caseStudies.length} matched)
${caseStudies.map((cs: any) => `- ${cs.title} (${cs.relevanceScore}% match)`).join('\n')}

## Your Task
Create a comprehensive, executive-ready summary that:

1. **Opportunity Assessment** (2-3 sentences)
   - Overall opportunity strength
   - Key decision drivers
   - Deal velocity indicators

2. **Recommended Solution Architecture**
   - Which services to propose (from the matched services)
   - How they address the pain points
   - Why they're better than alternatives

3. **Proof Points**
   - Which case studies to reference
   - How they relate to this prospect

4. **Action Plan**
   - Immediate next steps (next 48 hours)
   - Short-term (next 2 weeks)
   - Medium-term (next 30-60 days)

5. **Risk Mitigation**
   - Concerns raised
   - How to address them
   - Competitive positioning

6. **Win Strategy**
   - Key stakeholders to engage
   - Messages to emphasize
   - Proof points to leverage

Format as JSON:
{
  "opportunity_assessment": {
    "strength": "strong|moderate|weak",
    "confidence": 0.0-1.0,
    "key_drivers": ["..."],
    "velocity_indicators": ["..."]
  },
  "solution_architecture": {
    "recommended_services": [
      {
        "service_name": "...",
        "why_relevant": "...",
        "addresses_pain_points": ["..."]
      }
    ],
    "implementation_approach": "...",
    "competitive_advantages": ["..."]
  },
  "proof_strategy": {
    "case_studies_to_reference": [
      {
        "title": "...",
        "relevance": "...",
        "key_takeaway": "..."
      }
    ]
  },
  "action_plan": {
    "immediate": ["..."],
    "short_term": ["..."],
    "medium_term": ["..."]
  },
  "risk_mitigation": {
    "concerns": ["..."],
    "responses": ["..."],
    "competitive_positioning": "..."
  },
  "win_strategy": {
    "stakeholders": ["..."],
    "key_messages": ["..."],
    "proof_points": ["..."]
  },
  "executive_summary": "3-4 sentence summary for senior leadership"
}`;

    const messages = [
      {
        role: 'system' as const,
        content:
          'You are an expert sales strategist who synthesizes intelligence from multiple sources into actionable strategies.',
      },
      {
        role: 'user' as const,
        content: prompt,
      },
    ];

    return await this.openai.generateStructuredCompletion(messages, null, 0.5);
  }

  generateExcel(analysis: any): Buffer {
    const payload = analysis?.data || analysis || {};
    const wb = XLSX.utils.book_new();

    const summaryRows = [
      ['Field', 'Value'],
      ['Opportunity Score', payload.opportunity_score ?? ''],
      ['Success Probability', payload.success_probability ?? ''],
      ['Overall Sentiment', payload.sentiment?.overall ?? ''],
      ['Engagement Level', payload.sentiment?.engagement_level ?? ''],
      ['Executive Summary', payload.executive_summary ?? ''],
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    wsSummary['!cols'] = [{ wch: 24 }, { wch: 110 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

    const nextSteps = Array.isArray(payload.next_steps) ? payload.next_steps : [];
    const nextStepRows = [
      ['Action', 'Priority', 'Timeline', 'Owner'],
      ...nextSteps.map((n: any) => [n.action || '', n.priority || '', n.timeline || '', n.owner || '']),
    ];
    const wsNext = XLSX.utils.aoa_to_sheet(nextStepRows);
    wsNext['!cols'] = [{ wch: 70 }, { wch: 14 }, { wch: 24 }, { wch: 24 }];
    XLSX.utils.book_append_sheet(wb, wsNext, 'Next Steps');

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  /**
   * Extract key metrics from analysis results
   */
  private extractMetrics(results: any) {
    const enhancedAnalysis = results.enhancedAIAnalysis || {};
    const opportunityDetection = results.opportunityDetection || {};

    return {
      opportunityScore: enhancedAnalysis.opportunity_score || null,
      successProbability: enhancedAnalysis.success_probability || null,
      sentiment: enhancedAnalysis.sentiment?.overall || 'unknown',
      sentimentConfidence: enhancedAnalysis.sentiment?.confidence || null,
      engagementLevel: enhancedAnalysis.sentiment?.engagement_level || 'unknown',
      buyingSignalsCount: enhancedAnalysis.buying_signals?.length || 0,
      painPointsCount: enhancedAnalysis.pain_points?.length || 0,
      competitorsMentioned: enhancedAnalysis.competitive_landscape?.competitors_mentioned || [],
      timelineBudget: enhancedAnalysis.timeline_budget || {},
      urgency: enhancedAnalysis.timeline_budget?.urgency || 'unknown',
      opportunityDetected: opportunityDetection.hasOpportunity || null,
      opportunityProbability: opportunityDetection.opportunityProbability || null,
      topSignals: opportunityDetection.topSignals || [],
      relevantServicesCount: results.relevantServices?.length || 0,
      relevantCaseStudiesCount: results.relevantCaseStudies?.length || 0,
    };
  }
}

// Singleton instance
let enhancedAnalysisServiceInstance: EnhancedTranscriptAnalysisService | null = null;

export function getEnhancedTranscriptAnalysisService(): EnhancedTranscriptAnalysisService {
  if (!enhancedAnalysisServiceInstance) {
    enhancedAnalysisServiceInstance = new EnhancedTranscriptAnalysisService();
  }
  return enhancedAnalysisServiceInstance;
}
