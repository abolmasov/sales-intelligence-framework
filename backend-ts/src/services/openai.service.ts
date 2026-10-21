import OpenAI from 'openai';
import { ChatMessage, ChatCompletionOptions, SearchOptions, SearchResult } from '../types';

/**
 * OpenAI Service for AI completions and embeddings
 */
export class OpenAIService {
  private client: OpenAI;
  private defaultModel: string = 'gpt-4o';
  private embeddingModel: string = 'text-embedding-ada-002';

  constructor(apiKey?: string) {
    this.client = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Generate chat completion
   */
  async generateChatCompletion(options: ChatCompletionOptions): Promise<string> {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key is not configured. Please add OPENAI_API_KEY to your .env file.');
    }

    try {
      const response = await this.client.chat.completions.create({
        model: options.model || this.defaultModel,
        messages: options.messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens,
      });

      return response.choices[0]?.message?.content || '';
    } catch (error: any) {
      console.error('OpenAI chat completion error:', error);

      // Provide more specific error messages
      if (error?.status === 401) {
        throw new Error('Invalid OpenAI API key. Please check your OPENAI_API_KEY in .env file.');
      }
      if (error?.status === 429) {
        throw new Error('OpenAI API rate limit exceeded. Please try again later or check your billing.');
      }
      if (error?.status === 500) {
        throw new Error('OpenAI service is currently unavailable. Please try again later.');
      }

      throw new Error(`Failed to generate chat completion: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate chat completion with structured JSON output
   */
  async generateStructuredCompletion<T = any>(
    messages: ChatMessage[],
    schema?: any,
    temperature: number = 0.5,
    options?: { model?: string; maxTokens?: number }
  ): Promise<T> {
    try {
      const systemMessage: ChatMessage = {
        role: 'system',
        content: 'You must respond with valid JSON only. Do not include any explanatory text outside the JSON structure.',
      };

      const response = await this.client.chat.completions.create({
        model: options?.model || this.defaultModel,
        messages: [systemMessage, ...messages],
        temperature,
        response_format: { type: 'json_object' },
        ...(options?.maxTokens ? { max_tokens: options.maxTokens } : {}),
      });

      const content = response.choices[0]?.message?.content || '{}';
      return JSON.parse(content) as T;
    } catch (error) {
      console.error('OpenAI structured completion error:', error);
      throw new Error(`Failed to generate structured completion: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate embeddings for text
   */
  async generateEmbeddings(text: string | string[]): Promise<number[][]> {
    try {
      const input = Array.isArray(text) ? text : [text];

      const response = await this.client.embeddings.create({
        model: this.embeddingModel,
        input,
      });

      return response.data.map(item => item.embedding);
    } catch (error) {
      console.error('OpenAI embeddings error:', error);
      throw new Error(`Failed to generate embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Web search via OpenAI Responses API tool `web_search`
   * Returns results normalized to the existing SearchResult[] shape.
   */
  async webSearch(options: SearchOptions & { model?: string }): Promise<any> {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key is not configured. Please add OPENAI_API_KEY to your .env file.');
    }

    const model = options.model || process.env.OPENAI_WEB_SEARCH_MODEL || 'gpt-5.2';
    

    try {
      const response: any = await (this.client as any).responses.create({
        model,
        tools: [{ type: 'web_search' }],
        input: options.query,
      });

      // If no structured results, return whatever output is available
      return response;
    } catch (error: any) {
      console.error('OpenAI web search error:', error);
      if (error?.status === 401) {
        throw new Error('Invalid OpenAI API key. Please check your OPENAI_API_KEY in .env file.');
      }
      if (error?.status === 429) {
        throw new Error('OpenAI API rate limit exceeded. Please try again later or check your billing.');
      }
      throw new Error(`Failed to run web search: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Stream chat completion (for real-time responses)
   */
  async *streamChatCompletion(options: ChatCompletionOptions): AsyncGenerator<string> {
    try {
      const stream = await this.client.chat.completions.create({
        model: options.model || this.defaultModel,
        messages: options.messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield content;
        }
      }
    } catch (error) {
      console.error('OpenAI streaming error:', error);
      throw new Error(`Failed to stream chat completion: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Analyze company information
   */
  async analyzeCompany(companyData: string): Promise<any> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are an elite sales intelligence analyst with deep expertise in enterprise technology, market dynamics, and competitive positioning. Your analysis will inform a critical enterprise sales strategy.

MISSION: Extract COMPREHENSIVE, SPECIFIC, and ACTIONABLE intelligence from the provided company data. Every statement must be backed by concrete facts, numbers, dates, and sources.

CRITICAL ANALYSIS REQUIREMENTS:

1. **Key business information** (Be exhaustively detailed)
   - Company Name: [exact legal name]
   - Industries: [specific industry verticals and sub-sectors]
   - Headquarters: [full address if available: city, state/country, region]
   - Company Size: [exact employee count or specific range, with growth trajectory]
   - Founded: [year established and founding story if available]
   - Business Model: [detailed revenue model - subscription, licensing, services, etc.]
   - Description: [4-6 sentences explaining: what they do, how they do it, who they serve, what makes them unique]
   - Products: [comprehensive list with product names, categories, and specific capabilities]
   - Services: [detailed service offerings with delivery models]
   - Target Customers: [specific customer profiles: industries, company sizes, geographies, use cases]
   - Key Customers: [notable client names and logos if mentioned]
   - Website: [primary URL and key resource pages]
   - Stock Symbol: [if public company]
   - Parent Company/Subsidiaries: [corporate structure]

2. **Financial highlights** (Extract ALL available financial data with precision)
   - Annual Revenue: [exact figure with fiscal year, e.g., "$3.2B FY2024"]
   - Revenue Growth Rate: [YoY percentage with multi-year trend]
   - Quarterly Revenue: [most recent quarter with comparison]
   - Profitability: [operating margin, net income, EBITDA with specific numbers]
   - Recent Funding: [amount, date, round type, lead investors, valuation]
   - Total Funding Raised: [cumulative amount across all rounds]
   - Stock Performance: [current price, 52-week range, market cap if public]
   - Financial Health: [debt levels, cash position, burn rate if available]
   - Analyst Ratings: [price targets, recommendations if public company]
   - Fiscal Year: [fiscal year end date]

3. **Quarterly financials** (Detailed trend analysis if available)
   - Q1: [revenue, growth %, key metrics, highlights, YoY comparison]
   - Q2: [revenue, growth %, key metrics, highlights, YoY comparison]
   - Q3: [revenue, growth %, key metrics, highlights, YoY comparison]
   - Q4: [revenue, growth %, key metrics, highlights, YoY comparison]
   - Quarterly Trend: [growth trajectory, seasonal patterns, forward guidance]
   - Key Performance Indicators: [ARR, NRR, customer count, ACV, etc.]

4. **Market position and intelligence** (Deep competitive context)
   - Market Size: [TAM, SAM, SOM with specific dollar amounts]
   - Market Share: [specific percentage or ranking with source]
   - Competitive Position: [Gartner quadrant, Forrester wave, G2 ranking if available]
   - Market Leadership: [categories where they're #1, #2, emerging leader]
   - Industry Recognition: [awards, certifications, analyst mentions]
   - Market Trends: [macro trends affecting their business with impact assessment]
   - Growth Opportunities: [white space, expansion potential, emerging markets]
   - Market Threats: [disruptive technologies, regulatory changes, economic factors]

5. **Competitor analysis** (Comprehensive competitive landscape)
   - Direct Competitors: [5-8 companies with head-to-head comparison]
     For EACH competitor provide:
     * Company name and market position
     * How they compete (product overlap, pricing, target market)
     * Their strengths vs our target company
     * Their weaknesses vs our target company
     * Market share comparison
     * Recent competitive moves
   - Indirect/Adjacent Competitors: [companies in related spaces]
   - Competitive Advantages: [specific, defensible differentiators with evidence]
   - Competitive Disadvantages: [vulnerabilities, gaps, challenges with examples]
   - Competitive Pricing: [how they position on price vs competitors]
   - Win/Loss Analysis: [why they win or lose deals if mentioned]
   - Switching Costs: [barriers to customers leaving for competitors]

6. **Strategic initiatives and technology landscape** (What they're investing in)
   - Digital Transformation: [specific programs, technologies, investment levels, timelines]
   - Cloud Strategy: [cloud providers (AWS/Azure/GCP), migration plans, cloud-native development]
   - Platform Consolidation: [tools being consolidated, vendors being replaced, integration projects]
   - Agile/DevOps Transformation: [methodologies adopted, tool stack, maturity level]
   - AI/ML Initiatives: [specific AI use cases, technologies, maturity]
   - Data Strategy: [data platforms, analytics tools, data governance initiatives]
   - Security/Compliance: [certifications (SOC2, ISO), compliance requirements, security investments]
   - M&A Activity: [recent acquisitions, integration challenges, strategic rationale]
   - Innovation Initiatives: [R&D investments, innovation labs, partnerships]
   - Technology Stack: [known technologies, platforms, and tools in use]

7. **Potential pain points and challenges** (Evidence-based problem identification)
   - Collaboration Challenges: [specific issues: siloed teams, remote work, communication gaps]
   - Project Management Needs: [portfolio complexity, resource constraints, visibility gaps]
   - ITSM Challenges: [incident volume, MTTR, service desk inefficiencies, user satisfaction]
   - DevOps Maturity: [deployment frequency, lead time, change failure rate, DORA metrics]
   - Workflow Automation: [manual processes, approval bottlenecks, repetitive tasks]
   - Integration Complexity: [tool sprawl, API challenges, data silos]
   - Scalability Issues: [growth constraints, performance problems, capacity challenges]
   - Technical Debt: [legacy systems, modernization needs, upgrade cycles]
   - Compliance/Governance: [audit requirements, policy enforcement, risk management]
   - Talent Challenges: [hiring needs, skills gaps, retention issues]

8. **Buying signals and triggers** (Time-sensitive opportunity indicators)
   - Recent Funding: [amount, date, series, investors, use of funds stated]
   - Leadership Changes: [new executives with names, titles, start dates, backgrounds]
   - Organizational Changes: [restructuring, new departments, headcount changes]
   - Technology Investments: [announced purchases, technology partnerships, vendor selections]
   - Expansion Plans: [new markets, new offices, international expansion, M&A plans]
   - Contract Renewals: [incumbent vendor contracts expiring if mentioned]
   - Regulatory Drivers: [compliance deadlines, new regulations, audit findings]
   - Recent News: [press releases, media coverage, analyst reports with dates]
   - Conference Presence: [speaking engagements, booth presence, sponsorships]
   - Job Postings: [key technical or leadership roles being hired for]
   - Financial Pressure: [cost reduction initiatives, efficiency drives, restructuring]

9. **Customer intelligence** (Who uses them and why)
   - Customer Segments: [detailed breakdown of customer types]
   - Customer Count: [total customers, enterprise vs SMB split]
   - Notable Customers: [named references, case studies, logos]
   - Customer Satisfaction: [NPS, CSAT, reviews, churn rate if available]
   - Use Cases: [how customers actually use their products/services]

10. **Sources and citations**
   - List ALL source URLs for key facts
   - Format each citation: [Specific fact]: [Source URL and date]
   - Prioritize recent sources (within last 12 months)
   - Note credibility of sources (official company, analyst report, news, etc.)

CRITICAL: If specific information is NOT available in the source material, explicitly state "Information not available in sources" rather than making assumptions or generic statements. However, you MAY make informed inferences if you clearly label them as "[Inferred based on...]"

Respond with a structured JSON object with these exact keys. Ensure every section is COMPREHENSIVE and DETAILED with specific facts, figures, dates, and sources.`,
      },
      {
        role: 'user',
        content: `Analyze this company data and extract COMPREHENSIVE, SPECIFIC, DETAILED intelligence:\n\n${companyData}`,
      },
    ];

    return this.generateStructuredCompletion(messages);
  }

  /**
   * Analyze attendee profiles for personalized engagement
   */
  async analyzeAttendeeProfiles(
    attendeeProfiles: any[],
    companyName: string,
    companyAnalysis: any
  ): Promise<any[]> {
    const analyzedProfiles = await Promise.all(
      attendeeProfiles.map(async (profile) => {
        const messages: ChatMessage[] = [
          {
            role: 'system',
            content: `You are an expert sales psychologist and executive relationship strategist. Analyze the provided attendee profile data to create a comprehensive engagement strategy.

MISSION: Generate a DETAILED, PERSONALIZED analysis for engaging with this specific individual in a sales context.

ANALYSIS REQUIREMENTS:

1. **Professional Background**
   - Current role and responsibilities (detailed)
   - Career trajectory and progression
   - Notable achievements and specializations
   - Industry expertise and thought leadership
   - Education and certifications
   - Years of experience in current role and industry

2. **Decision-Making Profile**
   - Likely decision-making authority for this opportunity
   - Key priorities based on their role (efficiency, innovation, cost, risk mitigation)
   - Typical objections or concerns from this persona
   - Success metrics they care about (KPIs, OKRs)
   - Approval requirements and budget influence

3. **Communication Strategy**
   - Preferred communication style (data-driven, visionary, practical, relationship-oriented)
   - Technical depth appropriate for their background
   - Key value propositions that resonate with their role
   - Industry language and terminology to use
   - Examples and analogies that will connect with them

4. **Engagement Tactics**
   - Best approach for initial outreach
   - Topics likely to capture their interest
   - Relevant case studies or examples for their role
   - Potential quick wins to demonstrate value
   - Relationship-building opportunities (shared interests, mutual connections)

5. **Personalized Talking Points**
   - Role-specific benefits of Atlassian/ServiceNow solutions
   - How our solutions address their specific pain points
   - Metrics and outcomes that matter to them
   - Competitive advantages relevant to their concerns
   - Strategic alignment with their objectives

6. **Discovery Questions**
   - 5-7 targeted questions specific to their role and responsibilities
   - Questions about their current challenges and priorities
   - Questions to uncover decision criteria and process
   - Questions to identify stakeholders and influence mapping

7. **Risk Factors and Mitigation**
   - Potential resistance points based on their background
   - Concerns they might raise (technical, organizational, financial)
   - How to address their specific objections
   - Strategies to build trust and credibility

8. **LinkedIn Intelligence** (if available)
   - Recent activities, posts, or engagement
   - Professional interests and content they share
   - Connections or mutual contacts
   - Groups and communities they're part of
   - Recommendations to leverage

Respond with a structured JSON object containing all sections.`,
          },
          {
            role: 'user',
            content: `Analyze this attendee profile for a sales engagement at ${companyName}:

Attendee: ${profile.name}
Role: ${profile.role}
Email: ${profile.email}
Company: ${companyName}

Profile Data:
${JSON.stringify(profile.profileData, null, 2)}

Company Context:
${JSON.stringify(companyAnalysis, null, 2)}`,
          },
        ];

        try {
          const analysis = await this.generateStructuredCompletion(messages, undefined, 0.3);
          return {
            ...profile,
            detailedAnalysis: analysis,
          };
        } catch (error) {
          console.error(`Error analyzing profile for ${profile.name}:`, error);
          return profile;
        }
      })
    );

    return analyzedProfiles;
  }

  /**
   * Analyze meeting transcript
   */
  async analyzeTranscript(transcriptText: string): Promise<any> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are a sales intelligence analyst. Analyze the meeting transcript and provide:
- Summary of the meeting
- Key discussion points
- Action items with owners
- Sentiment analysis (positive/neutral/negative)
- Opportunity score (0-100)
- Success probability (0-1)
- Next steps
- Technical requirements mentioned
- Budget/timeline indicators

Respond with a structured JSON object.`,
      },
      {
        role: 'user',
        content: `Analyze this transcript:\n\n${transcriptText}`,
      },
    ];

    return this.generateStructuredCompletion(messages);
  }

  /**
   * Generate sales recommendations
   */
  async generateRecommendations(context: {
    companyInfo?: any;
    transcriptAnalysis?: any;
    dealStage?: string;
    caseStudies?: any[];
    relevantServices?: any[];
  }): Promise<any> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are an elite sales strategist and solutions architect specializing in Atlassian and ServiceNow enterprise transformations. You have 15+ years of experience helping Fortune 500 companies optimize their digital operations.

Based on the provided context, generate HIGHLY DETAILED, ACTIONABLE recommendations with specific metrics, timelines, and implementation strategies.

CRITICAL REQUIREMENTS:
- Be SPECIFIC with product names, versions, modules, and features
- Include CONCRETE metrics, ROI projections, and success criteria
- Reference SPECIFIC pain points from the company analysis
- Provide DETAILED implementation timelines and milestones
- Include COMPETITIVE positioning against their current tools
- Add INDUSTRY-SPECIFIC examples and best practices
- Cite RELEVANT case studies with measurable outcomes

DETAILED OUTPUT STRUCTURE:

1. **Atlassian opportunities** (Be extremely detailed)
   For EACH recommended Atlassian product/service:
   - Product name and specific modules/features (e.g., "Jira Software Data Center with Advanced Roadmaps and Automation")
   - Specific business problem it solves (reference company's pain points)
   - Expected ROI and metrics (e.g., "30% reduction in cycle time, $2M annual savings")
   - Implementation timeline with phases (e.g., "Phase 1: 2-4 weeks for core setup")
   - Integration points with their existing systems
   - Team size and training requirements
   - Success criteria and KPIs
   - Competitive advantage over their current tools
   - Industry-specific best practices
   - Risk mitigation strategies

2. **ServiceNow opportunities** (Be extremely detailed)
   For EACH recommended ServiceNow module:
   - Module name and specific capabilities (e.g., "ITSM Pro with Service Portal, Virtual Agent, and Predictive Intelligence")
   - Specific operational challenge it addresses
   - Quantified business value (e.g., "50% faster incident resolution, 40% reduction in service desk costs")
   - Deployment roadmap with milestones (e.g., "Month 1-2: Discovery and design")
   - Integration architecture with Atlassian and other systems
   - License requirements and cost considerations
   - Change management and adoption strategy
   - Success metrics and benchmarking data
   - Comparison to competitors (ServiceNow vs Remedy, etc.)
   - Compliance and security benefits

3. **Recommended next steps** (Actionable and sequenced)
   - Immediate actions (within 1 week) - e.g., "Schedule discovery workshop with IT and business stakeholders"
   - Short-term actions (2-4 weeks) - e.g., "Conduct technical assessment of current Jira/Confluence usage"
   - Medium-term actions (1-3 months) - e.g., "Develop proof-of-concept for ServiceNow ITSM integration"
   - Include specific deliverables, owners, and success criteria for each step
   - Identify executive sponsors and decision-makers to engage

4. **Key talking points** (Highly targeted)
   - Executive-level value propositions (CFO, CIO, CEO perspectives)
   - Technical benefits for IT/DevOps teams
   - Business benefits for end-users and stakeholders
   - Strategic alignment with company's digital transformation goals
   - Cost-benefit analysis and TCO considerations
   - Time-to-value and quick wins
   - Scalability for future growth
   - Security, compliance, and governance advantages

5. **Value propositions to emphasize**
   - Map EACH company pain point to SPECIFIC solutions
   - Include quantified benefits (time savings, cost reduction, efficiency gains)
   - Provide industry benchmarks and comparative data
   - Highlight unique differentiators vs competitors
   - Address strategic initiatives (digital transformation, cloud migration, etc.)
   - Show alignment with company's business objectives

6. **Potential objections and responses**
   - Pricing/budget concerns → TCO analysis, phased approach, ROI timeline
   - Migration complexity → Proven methodologies, automation tools, case study examples
   - Training requirements → Comprehensive enablement plans, user adoption strategies
   - Integration challenges → Technical architecture, API capabilities, reference implementations
   - Change management → Executive sponsorship, change champions, communication strategies
   - Vendor lock-in concerns → Openness, extensibility, exit strategies
   - Competitive alternatives → Head-to-head comparisons with specific advantages

7. **Relevant case studies**
   - Reference PROVIDED case studies with specific outcomes
   - Highlight companies in same industry or with similar challenges
   - Emphasize measurable results (% improvements, $ savings, time reductions)
   - Include implementation timelines and lessons learned
   - Provide contact information for references if available

8. **Discovery questions for next meeting** (Very detailed)
   Organize by category with 4-6 questions each:

   **Current State Assessment:**
   - "Can you walk me through your current project management toolset and where you see bottlenecks?"
   - "What percentage of your IT incidents are resolved within SLA today?"
   - "How many separate tools are your teams using for collaboration, and what's the integration overhead?"

   **Pain Points and Challenges:**
   - "What are the top 3 operational inefficiencies costing you the most time or money?"
   - "Where do you see the biggest gaps in visibility across projects, services, or IT operations?"
   - "What compliance or governance challenges are you facing with your current tools?"

   **Strategic Initiatives:**
   - "What are your top technology priorities for the next 12-18 months?"
   - "Are you planning any cloud migrations, M&A integrations, or platform consolidations?"
   - "How does tool modernization fit into your digital transformation roadmap?"

   **Decision Process:**
   - "Who are the key stakeholders involved in tool selection decisions?"
   - "What's your typical evaluation and procurement timeline for enterprise software?"
   - "What criteria will you use to evaluate solutions (TCO, features, security, support)?"

   **Budget and Timeline:**
   - "Is there a dedicated budget for tool modernization this fiscal year?"
   - "What's driving the timeline - contract renewals, strategic initiatives, or pain points?"
   - "How do you typically structure investments - CapEx vs OpEx, subscription vs perpetual?"

   **Competitive Landscape:**
   - "What's your experience with Atlassian/ServiceNow to date?"
   - "What alternatives are you considering, and what appeals to you about them?"
   - "What would make you choose one vendor over another?"

9. **Implementation roadmap** (Detailed phased approach)
   - Phase 1: Discovery and assessment (2-4 weeks)
   - Phase 2: Proof of concept / Pilot (4-8 weeks)
   - Phase 3: Production deployment (8-16 weeks)
   - Phase 4: Adoption and optimization (ongoing)
   - Include specific milestones, deliverables, and success gates for each phase

10. **Risk assessment and mitigation**
   - Identify potential risks (technical, organizational, financial)
   - Provide mitigation strategies for each risk
   - Include contingency plans and fallback options

Respond with a structured JSON object with these exact keys. Ensure ALL recommendations are DETAILED, SPECIFIC, and ACTIONABLE with concrete metrics and timelines.`,
      },
      {
        role: 'user',
        content: `Generate comprehensive, detailed recommendations based on:\n\n${JSON.stringify(context, null, 2)}`,
      },
    ];

    return this.generateStructuredCompletion(messages);
  }

  /**
   * Generate chat completion with function/tool calling support
   * Returns both the response and any tool calls made
   */
  async generateChatWithTools(
    messages: ChatMessage[],
    tools: any[],
    options: {
      temperature?: number;
      maxTokens?: number;
      toolChoice?: 'auto' | 'none' | 'required';
    } = {}
  ): Promise<{
    content: string | null;
    toolCalls: Array<{
      id: string;
      name: string;
      arguments: Record<string, any>;
    }>;
    finishReason: string;
  }> {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key is not configured.');
    }

    try {
      const response = await this.client.chat.completions.create({
        model: this.defaultModel,
        messages,
        tools,
        tool_choice: options.toolChoice || 'auto',
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens || 2000,
      });

      const choice = response.choices[0];
      const toolCalls = choice.message.tool_calls?.map(tc => ({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments || '{}'),
      })) || [];

      return {
        content: choice.message.content,
        toolCalls,
        finishReason: choice.finish_reason || 'stop',
      };
    } catch (error: any) {
      console.error('OpenAI chat with tools error:', error);
      throw new Error(`Failed to generate chat with tools: ${error.message}`);
    }
  }
  /**
   * Transcribe audio file using OpenAI Whisper
   */
  async transcribeAudio(
    fileBuffer: Buffer,
    filename: string,
    language?: string,
  ): Promise<string> {
    try {
      const file = new File([fileBuffer], filename, {
        type: this.getAudioMimeType(filename),
      });

      const response = await this.client.audio.transcriptions.create({
        file,
        model: 'whisper-1',
        response_format: 'text',
        ...(language ? { language } : {}),
      });

      return typeof response === 'string' ? response : (response as any).text || '';
    } catch (error: any) {
      console.error('OpenAI Whisper transcription error:', error);

      if (error?.status === 413) {
        throw new Error('Audio file is too large. Maximum size is 25MB. Consider splitting the file into smaller segments.');
      }

      throw new Error(`Failed to transcribe audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private getAudioMimeType(filename: string): string {
    const ext = filename.toLowerCase().split('.').pop();
    const mimeTypes: Record<string, string> = {
      mp3: 'audio/mpeg',
      mp4: 'audio/mp4',
      m4a: 'audio/mp4',
      wav: 'audio/wav',
      webm: 'audio/webm',
      ogg: 'audio/ogg',
      flac: 'audio/flac',
      mpeg: 'audio/mpeg',
    };
    return mimeTypes[ext || ''] || 'audio/mpeg';
  }
}

// Singleton instance
let openAIServiceInstance: OpenAIService | null = null;

class MockOpenAIService extends OpenAIService {
  override async generateChatCompletion(options: ChatCompletionOptions): Promise<string> {
    const lastUser = [...options.messages].reverse().find((m) => m.role === 'user');
    return `[MOCK_LLM] Demo response for: ${(lastUser?.content || '').toString().slice(0, 120)}`;
  }

  override async generateStructuredCompletion<T = any>(
    _messages: ChatMessage[],
    _schema?: any,
    _temperature?: number,
    _options?: { model?: string; maxTokens?: number }
  ): Promise<T> {
    return {
      summary: 'Mock structured completion for local portfolio demo.',
      actionItems: ['Review discovery notes', 'Draft phased roadmap'],
      recommendedNextSteps: ['Schedule technical workshop'],
    } as T;
  }

  override async transcribeAudio(): Promise<string> {
    return 'Mock transcript: synthetic demo content for offline mode.';
  }
}

export function getOpenAIService(apiKey?: string): OpenAIService {
  const useMock =
    process.env.MOCK_LLM === 'true' ||
    process.env.MOCK_LLM === '1' ||
    (!process.env.OPENAI_API_KEY && process.env.NODE_ENV !== 'production');

  if (!openAIServiceInstance) {
    openAIServiceInstance = useMock ? new MockOpenAIService(apiKey) : new OpenAIService(apiKey);
  }
  return openAIServiceInstance;
}
