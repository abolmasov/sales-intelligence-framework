import { getOpenAIService } from './openai.service';
import { getInternalKnowledgeService } from './internal-knowledge.service';
import { getPrismaClient } from '../config/database';
import { ChatMessage } from '../types';
import { AGENT_METADATA, getAgentMetadata } from '../config/agentMetadata';

interface ChatRequest {
  message: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  accessToken?: string;
  context?: AppContext;
}

interface AppContext {
  currentPage?: string;
  currentRoute?: string;
  selectedRecord?: {
    type: string;
    id: string;
    name: string;
    data?: Record<string, any>;
  } | null;
  recentPages?: string[];
}

interface AIAction {
  id: string;
  type: 'navigate' | 'create' | 'update' | 'search' | 'open_modal' | 'trigger';
  label: string;
  description?: string;
  icon?: string;
  payload: Record<string, any>;
  confirmRequired?: boolean;
  primary?: boolean;
}

interface DataPreview {
  type: string;
  title?: string;
  data: Record<string, any> | Array<Record<string, any>>;
}

interface ThinkingStep {
  step: number;
  thought: string;
  action?: string;
  observation?: string;
}

interface ChatWidget {
  id: string;
  type: string;
  data: Record<string, any>;
}

interface ChatResponse {
  response: string;
  actions?: AIAction[];
  dataPreview?: DataPreview;
  sources?: Array<{ title: string; type: string; url?: string }>;
  thinking?: ThinkingStep[]; // Chain-of-thought reasoning steps
  widgets?: ChatWidget[];
  quickReplies?: string[];
  context?: {
    companiesFound?: string[];
    dealsFound?: number;
    meetingsFound?: number;
    internalKbResults?: number;
  };
}

/**
 * Comprehensive App Knowledge Base
 * Detailed descriptions of all app features for AI context
 */
const APP_KNOWLEDGE_BASE = `
SALES INTELLIGENCE PLATFORM - COMPLETE FEATURE GUIDE

This is a Sales Intelligence platform built for Northstar Integrators sales professionals. It helps with meeting preparation, company research, deal management, proposal generation, and post-call analysis.

=== MAIN NAVIGATION & PAGES ===

1. CALENDAR (/calendar)
   - Shows upcoming sales meetings synced from Outlook/Teams
   - Click any meeting to see full details
   - Run "Pre-Call Analysis" before meetings to prepare
   - See attendees, agenda, and meeting context
   - Access past meeting transcripts and notes
   USE CASES: View upcoming meetings, prepare for calls, check who you're meeting with

2. ACCOUNTS (/accounts)
   - Manage company accounts you're selling to
   - View company details, industry, domain
   - See deal history and engagement timeline
   - Track contacts at each account
   USE CASES: Research a company, see your history with them, find account contacts

3. DEALS (/deals)
   - Full sales pipeline management
   - Filter by stage (Prospecting, Qualification, Proposal, Negotiation, Closed Won/Lost)
   - Track estimated value, close dates, and deal health
   - Click any deal for detailed view with analysis
   USE CASES: Check pipeline, find deals closing this month, see deal progress

4. ANALYSIS (/analysis)
   - Company Research: Deep intelligence on any company
   - Pre-Call Analysis: Prepare for meetings with company context
   - Gathers data from web, financials, news, InternalKnowledge
   - Provides talking points, questions to ask, and case study suggestions
   USE CASES: Research before a call, understand a prospect, find talking points

5. POST-CALL ANALYSIS (/analysis/postcall)
   - Analyze meeting transcripts
   - Extract action items and key discussion points
   - Generate follow-up recommendations
   - Create meeting summaries for stakeholders
   USE CASES: Process meeting recordings, extract action items, create summaries

6. RFP/SOW GENERATOR (/rfp-sow-generator)
   - Upload RFP documents
   - AI automatically extracts requirements
   - Generate responses to each RFP section
   - Find relevant case studies and capabilities
   - Export formatted responses
   USE CASES: Respond to RFPs, create SOWs, proposal content

7. PPT GENERATOR (/ppt-generator)
   - Create presentation decks from analysis data
   - Generate slides for client pitches
   - Customize with company branding
   - Export to PowerPoint format
   USE CASES: Create pitch decks, prepare presentations

8. PROPOSAL EVALUATION (/proposal-evaluation)
   - Evaluate proposals against scoring criteria
   - Multiple evaluation frameworks
   - Collaborative scoring with team
   - Risk and opportunity assessment
   USE CASES: Score proposals, compare vendors, evaluate bids

9. ATLASSIAN ASSESSMENT (/atlassian-assessment)
   - Service-specific guidance for Atlassian sales
   - Cloud migration assessment flows
   - License renewal decision trees
   - Service recommendations based on customer needs
   USE CASES: Plan Atlassian engagements, migration assessment

10. METRICS (/metrics)
    - Sales analytics dashboard
    - Win rate tracking
    - Pipeline health metrics
    - Activity tracking
    USE CASES: Check performance, see win rates, pipeline analysis

11. SETTINGS (/settings)
    - API key management
    - User preferences
    - Integration configuration
    USE CASES: Configure settings, update API keys

=== KEY WORKFLOWS ===

PRE-CALL PREPARATION:
1. Go to Calendar or click upcoming meeting
2. Run Pre-Call Analysis on the meeting
3. Review company research, talking points, questions
4. Check for relevant case studies
5. Note key stakeholders attending

POST-CALL FOLLOW-UP:
1. Go to Analysis > Post-Call
2. Upload or paste meeting transcript
3. AI extracts action items, key points
4. Generate follow-up email or summary
5. Create deal notes from insights

COMPANY RESEARCH:
1. Go to Analysis page
2. Enter company name
3. AI gathers web info, financials, news
4. Checks InternalKnowledge for internal knowledge
5. Provides comprehensive research report

PROPOSAL/RFP RESPONSE:
1. Go to RFP/SOW Generator
2. Upload RFP document
3. AI extracts requirements
4. Generate responses for each section
5. Export formatted proposal

DEAL MANAGEMENT:
1. View pipeline on Deals page
2. Click any deal for details
3. Run analysis on deal company
4. Track progress through stages
5. Log meeting notes and updates

=== KEYBOARD SHORTCUTS ===
- Cmd/Ctrl + K: Quick search (Command Palette)
- Navigate across all records and pages quickly

=== TIPS FOR USING THIS APP ===
- Always run Pre-Call Analysis before important meetings
- Check InternalKnowledge results for internal case studies
- Use the AI Chat (me!) to navigate quickly
- Create deals to track opportunities through the pipeline
- Use Post-Call Analysis to capture meeting insights
`;

/**
 * AI Assistant Tool Definitions for OpenAI function calling
 * Enhanced with more workflow options and detailed descriptions
 */
const AI_ASSISTANT_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'navigate_to_page',
      description: 'Navigate user to a specific page or record in the application. Use this to help users find features, open specific records, or get to the right place in the app.',
      parameters: {
        type: 'object',
        properties: {
          page: {
            type: 'string',
            enum: ['calendar', 'deals', 'accounts', 'analysis', 'analysis-postcall', 'metrics', 'rfp-generator', 'ppt-generator', 'proposal-evaluation', 'atlassian-assessment', 'settings', 'help'],
            description: 'The page to navigate to. analysis-postcall is for post-call transcript analysis.'
          },
          recordId: {
            type: 'string',
            description: 'Optional specific record ID to view (deal ID, account ID, or meeting ID)'
          },
          recordType: {
            type: 'string',
            enum: ['deal', 'account', 'meeting'],
            description: 'Type of record if recordId is provided'
          },
          reason: {
            type: 'string',
            description: 'Brief explanation of why navigating here helps the user - shown as action description'
          }
        },
        required: ['page', 'reason']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'execute_research',
      description: 'Execute real-time company research using web search and InternalKnowledge. Use this when user asks to research a company, prepare for a meeting, or gather intelligence on a prospect.',
      parameters: {
        type: 'object',
        properties: {
          companyName: {
            type: 'string',
            description: 'Name of the company to research'
          },
          researchType: {
            type: 'string',
            enum: ['comprehensive', 'quick', 'financial', 'news', 'competitive'],
            description: 'Type of research to perform: comprehensive (full analysis), quick (key facts), financial (financials focus), news (recent news), competitive (competitive landscape)'
          },
          context: {
            type: 'string',
            description: 'Additional context like meeting purpose or specific focus areas'
          }
        },
        required: ['companyName', 'researchType']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'search_internal_kb',
      description: 'Search the internal InternalKnowledge knowledge base for case studies, proposals, past engagements, and internal expertise. Use this when user needs internal knowledge, past work examples, or relevant case studies.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query for InternalKnowledge - can include company names, industries, services, or specific topics'
          },
          category: {
            type: 'string',
            enum: ['case_studies', 'proposals', 'all'],
            description: 'Category to search within'
          },
          industry: {
            type: 'string',
            description: 'Optional industry filter (e.g., healthcare, financial, technology)'
          },
          service: {
            type: 'string',
            description: 'Optional service filter (e.g., cloud migration, Jira, DevOps)'
          }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'analyze_meeting',
      description: 'Start or retrieve analysis for a meeting. Can start pre-call preparation or post-call analysis.',
      parameters: {
        type: 'object',
        properties: {
          meetingId: {
            type: 'string',
            description: 'ID of the meeting to analyze (if known)'
          },
          companyName: {
            type: 'string',
            description: 'Company name for the meeting (used to find meeting if ID not provided)'
          },
          analysisType: {
            type: 'string',
            enum: ['pre_call', 'post_call'],
            description: 'Type of analysis to perform'
          },
          meetingContext: {
            type: 'string',
            description: 'Additional context about the meeting purpose or goals'
          }
        },
        required: ['analysisType']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_record',
      description: 'Help user create a new deal, account, or meeting with optional prefilled data. Use when user wants to track a new opportunity, add a company, or schedule a meeting.',
      parameters: {
        type: 'object',
        properties: {
          recordType: {
            type: 'string',
            enum: ['deal', 'account', 'meeting'],
            description: 'Type of record to create'
          },
          prefillData: {
            type: 'object',
            description: 'Data to prefill the creation form based on conversation context',
            properties: {
              companyName: { type: 'string' },
              opportunityName: { type: 'string' },
              title: { type: 'string' },
              estimatedValue: { type: 'number' },
              stage: { type: 'string' },
              notes: { type: 'string' },
              industry: { type: 'string' }
            }
          }
        },
        required: ['recordType']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'search_records',
      description: 'Search for deals, accounts, or meetings matching criteria. Use for finding specific records, filtering by criteria, or discovering relevant information.',
      parameters: {
        type: 'object',
        properties: {
          recordType: {
            type: 'string',
            enum: ['deal', 'account', 'meeting', 'all'],
            description: 'Type of records to search. Use "all" for broad searches.'
          },
          query: {
            type: 'string',
            description: 'Search query text - company name, deal name, or keywords'
          },
          filters: {
            type: 'object',
            description: 'Optional filters to narrow results',
            properties: {
              stage: { type: 'string', description: 'Deal stage: Prospecting, Qualification, Proposal, Negotiation, Closed Won, Closed Lost' },
              dateRange: { type: 'string', description: 'Date filter: today, this_week, this_month, this_quarter' },
              minValue: { type: 'number', description: 'Minimum deal value' },
              maxValue: { type: 'number', description: 'Maximum deal value' }
            }
          }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'trigger_workflow',
      description: 'Start an analysis or generation workflow. Use this to help users perform key sales tasks like company research, meeting preparation, post-call analysis, or proposal generation.',
      parameters: {
        type: 'object',
        properties: {
          workflow: {
            type: 'string',
            enum: ['pre_call_analysis', 'post_call_analysis', 'company_research', 'proposal_generation', 'rfp_analysis', 'ppt_generation', 'proposal_evaluation'],
            description: 'The workflow to trigger: pre_call_analysis (meeting prep), post_call_analysis (transcript analysis), company_research (deep research), proposal_generation (create proposal), rfp_analysis (RFP response), ppt_generation (create deck), proposal_evaluation (score proposal)'
          },
          targetId: {
            type: 'string',
            description: 'ID of meeting, deal, or account to analyze (if applicable)'
          },
          targetName: {
            type: 'string',
            description: 'Display name of the target (company name, meeting title) for user feedback'
          }
        },
        required: ['workflow']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'show_data',
      description: 'Display data summary inline in the chat. Use to show quick previews of meetings, deals, metrics, or other data without navigating away.',
      parameters: {
        type: 'object',
        properties: {
          dataType: {
            type: 'string',
            enum: ['upcoming_meetings', 'recent_deals', 'pipeline_summary', 'account_details', 'deal_details', 'deals_by_stage', 'meetings_this_week'],
            description: 'Type of data to display inline'
          },
          recordId: {
            type: 'string',
            description: 'Specific record ID for detail views (account_details, deal_details)'
          },
          filters: {
            type: 'object',
            description: 'Optional filters',
            properties: {
              limit: { type: 'number', description: 'Max results to show (default 5)' },
              dateRange: { type: 'string', description: 'Date filter' },
              stage: { type: 'string', description: 'Deal stage filter' }
            }
          }
        },
        required: ['dataType']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'explain_feature',
      description: 'Explain how a specific feature or workflow works in the app. Use when user asks "how do I...", "what is...", "how does... work".',
      parameters: {
        type: 'object',
        properties: {
          feature: {
            type: 'string',
            enum: ['pre_call_analysis', 'post_call_analysis', 'company_research', 'rfp_generator', 'ppt_generator', 'proposal_evaluation', 'deals', 'accounts', 'calendar', 'atlassian_assessment', 'command_palette', 'pipeline', 'case_studies'],
            description: 'The feature to explain'
          },
          context: {
            type: 'string',
            description: 'Additional context about what aspect the user wants to understand'
          }
        },
        required: ['feature']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'trigger_agent',
      description: 'Trigger an AI agent from chat. Returns an agent card widget for inline rendering. Use when user wants to run an agent, analyze transcripts, generate proposals, research leads, or run bulk analysis.',
      parameters: {
        type: 'object',
        properties: {
          agentId: {
            type: 'string',
            enum: ['transcript-analysis', 'pre-call-research', 'proposal-generation', 'pptx-generation', 'discovery', 'workshop-analysis', 'user-story-generation', 'bulk-analysis'],
            description: 'ID of the agent to trigger'
          },
          input: {
            type: 'object',
            description: 'Input data for the agent (meetingId, dealId, accountId, query, etc.)',
          },
        },
        required: ['agentId']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'ask_user_input',
      description: 'Request structured input from the user via an inline form widget. Use when you need specific data from the user to proceed, like selecting a deal, entering a company name, or providing meeting details.',
      parameters: {
        type: 'object',
        properties: {
          formId: {
            type: 'string',
            description: 'Unique identifier for this form'
          },
          fields: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                label: { type: 'string' },
                type: { type: 'string', enum: ['text', 'select', 'checkbox', 'number', 'textarea'] },
                required: { type: 'boolean' },
                placeholder: { type: 'string' },
                options: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      label: { type: 'string' },
                      value: { type: 'string' }
                    }
                  }
                }
              },
              required: ['name', 'label', 'type']
            },
            description: 'Form fields to display'
          },
          submitLabel: {
            type: 'string',
            description: 'Text for the submit button (default: "Submit")'
          }
        },
        required: ['formId', 'fields']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'suggest_replies',
      description: 'Suggest follow-up questions or actions as clickable chips below your response. Use this to guide the conversation and help users discover capabilities. Always suggest 2-4 relevant follow-ups.',
      parameters: {
        type: 'object',
        properties: {
          replies: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of suggested follow-up messages (max 4). Keep each under 50 characters.',
            maxItems: 4,
          }
        },
        required: ['replies']
      }
    }
  }
];

/**
 * Atlassian Services Decision Flow Knowledge Base
 * Encodes the decision tree for license renewals and cloud migrations
 */
const ATLASSIAN_DECISION_FLOW_KNOWLEDGE = `
ATLASSIAN SERVICES DECISION FLOW:

1. DATA CENTER/SERVER LICENSE RENEWAL PATH:
   - If customer wants to stay on DC:
     * If satisfied: Proceed with renewal, consider multi-year discount
     * If performance issues: Recommend DC Health Check service
     * If license optimization needed: Conduct user audit and tier optimization
     * If admin help needed: Propose Managed Services engagement

   - If considering Cloud migration:
     * Urgent (<3 months): Offer expedited migration assessment, temporary DC renewal
     * Planned (6-12 months): Full Cloud Migration Assessment with phased approach
     * Long-term (1-2 years): Strategic consulting and roadmap planning
     * Undecided: Start with Cloud Readiness Assessment

   - If cost concerns:
     * DC too expensive: Present Cloud cost savings (no infrastructure, predictable pricing)
     * Cloud seems expensive: Show TCO analysis and productivity gains
     * Budget constraints: Propose phased migration across fiscal periods

2. CLOUD CUSTOMER PATH:
   - If satisfied: Look for expansion opportunities (users, products, tier upgrade)
   - If challenges: Identify specific issues (performance, adoption, missing features)
   - If needs training: Propose role-based training program
   - If considering Premium/Enterprise: Highlight advanced security, unlimited storage

3. KEY SERVICES TO RECOMMEND:
   - Cloud Migration Assessment: $15,000-25,000 - Comprehensive readiness analysis
   - Migration Planning & Execution: $25,000-50,000 - Full migration support
   - Managed Services: $50,000+/year - Ongoing administration and monitoring
   - Training & Enablement: $10,000-20,000 - Role-based training programs
   - Strategic Consulting: $30,000+ - Long-term planning and optimization
   - Health Check: $8,000-15,000 - Performance and configuration review

4. COMMON CONCERNS AND RESPONSES:
   - Data residency: Cloud now supports US, EU, Australia data residency
   - Security: Enterprise-grade security, SOC2/ISO certifications, Trust Center transparency
   - Feature parity: Most DC features have cloud equivalents, plus cloud-only features
   - Integrations: Cloud APIs enable powerful integrations, pre-built connectors available
   - SSO: Atlassian Access provides SSO for all products, SCIM provisioning

5. TALKING POINTS BY SCENARIO:
   - Urgent migration: "We can complete assessment in 2 weeks, migration in 4-8 weeks"
   - Cost concerns: "Cloud eliminates infrastructure costs and upgrade projects"
   - Security concerns: "Review our Trust Center for transparent security practices"
   - Hybrid environment: "We can optimize DC-Cloud communication and plan consolidation"
`;

/**
 * Service-specific talking points for common scenarios
 */
const SERVICE_TALKING_POINTS: Record<string, string[]> = {
  cloud_migration: [
    'Cloud includes continuous updates and new features without upgrade projects',
    'Better collaboration with remote/distributed teams',
    'Reduced IT overhead and faster time-to-value',
    'Predictable subscription pricing eliminates infrastructure costs',
  ],
  managed_services: [
    'Our team handles day-to-day administration',
    'Proactive monitoring prevents issues before they impact users',
    'Free up your internal team for strategic initiatives',
    '24/7 support with defined SLAs',
  ],
  training: [
    'Role-based training for admins and end users',
    'Hands-on workshops with real use cases',
    'Custom training materials for your organization',
    'Champion program builds internal expertise',
  ],
  health_check: [
    'Identify performance bottlenecks',
    'Optimize configuration for better performance',
    'Review infrastructure sizing and capacity',
    'Get actionable recommendations',
  ],
};

interface InternalData {
  meetings: any[];
  deals: any[];
  analyses: any[];
}

/**
 * AI Assistant Service
 * Provides intelligent responses using internal data (meetings, deals, analyses),
 * InternalKnowledge knowledge, and LLM-based web search
 */
export class AIAssistantService {
  private openai = getOpenAIService();
  private internalKb = getInternalKnowledgeService();
  private prisma = getPrismaClient();

  /**
   * Main chat method - orchestrates all data sources to provide intelligent responses
   * Now supports tool calling for actionable responses with chain-of-thought reasoning
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const { message, history = [], accessToken, context: appContext } = request;

    console.log('\n=== AI Assistant Chat ===');
    console.log('User message:', message.substring(0, 100) + (message.length > 100 ? '...' : ''));
    console.log('App context:', appContext ? `${appContext.currentPage} - ${appContext.selectedRecord?.name || 'no selection'}` : 'none');

    const thinking: ThinkingStep[] = [];
    let stepNumber = 1;

    try {
      // Step 1: Analyze the query to understand intent
      thinking.push({
        step: stepNumber++,
        thought: 'Analyzing user query to understand intent and required data sources...',
        action: 'Analyzing query intent',
      });

      const queryIntent = await this.analyzeQueryIntent(message);
      thinking[thinking.length - 1].observation = `Intent: ${queryIntent.type}, Companies: ${queryIntent.companies.join(', ') || 'none'}, Needs Web: ${queryIntent.needsWebSearch}, Needs InternalKnowledge: ${queryIntent.needsInternalKnowledge}`;
      console.log('Query intent:', queryIntent);

      // Step 2: Determine if real-time operations are needed
      const needsRealTimeResearch = this.shouldPerformRealTimeResearch(message, queryIntent);
      if (needsRealTimeResearch) {
        thinking.push({
          step: stepNumber++,
          thought: 'User request requires real-time data gathering. Initiating parallel searches...',
          action: 'Gathering data from multiple sources',
        });
      }

      // Step 3: Gather relevant data based on intent
      const [internalData, webSearchData, internalKbData] = await Promise.all([
        this.fetchInternalData(queryIntent),
        this.performWebSearch(queryIntent, message),
        this.searchInternalKnowledge(queryIntent, message, accessToken || ''),
      ]);

      if (needsRealTimeResearch) {
        const sources: string[] = [];
        if (internalData.deals.length > 0 || internalData.meetings.length > 0) sources.push('CRM data');
        if (webSearchData) sources.push('Web search');
        if (internalKbData?.documents?.length > 0) sources.push(`InternalKnowledge (${internalKbData.documents.length} docs)`);
        thinking[thinking.length - 1].observation = `Retrieved data from: ${sources.join(', ') || 'no external sources'}`;
      }

      // Step 4: Build context for the AI response
      thinking.push({
        step: stepNumber++,
        thought: 'Processing gathered information and preparing response...',
        action: 'Building response context',
      });

      const dataContext = this.buildContext(internalData, webSearchData, internalKbData, queryIntent);
      thinking[thinking.length - 1].observation = `Context built with ${dataContext.length} characters of relevant data`;

      // Step 5: Generate AI response with tool calling
      thinking.push({
        step: stepNumber++,
        thought: 'Generating intelligent response with actionable suggestions...',
        action: 'Generating response',
      });

      const { response, actions, dataPreview, widgets, quickReplies } = await this.generateResponseWithTools(
        message,
        history,
        dataContext,
        appContext,
        internalData,
        accessToken
      );

      thinking[thinking.length - 1].observation = `Generated response with ${actions?.length || 0} actions, ${widgets?.length || 0} widgets`;

      // Step 6: Extract sources
      const sources = this.extractSources(internalData, webSearchData, internalKbData);

      return {
        response,
        actions,
        dataPreview,
        sources,
        thinking,
        widgets,
        quickReplies,
        context: {
          companiesFound: queryIntent.companies,
          dealsFound: internalData.deals.length,
          meetingsFound: internalData.meetings.length,
          internalKbResults: internalKbData?.documents?.length || 0,
        },
      };
    } catch (error: any) {
      console.error('AI Assistant error:', error);
      throw new Error(`Failed to generate response: ${error.message}`);
    }
  }

  /**
   * Determine if the request requires real-time research operations
   */
  private shouldPerformRealTimeResearch(message: string, intent: any): boolean {
    const lowerMessage = message.toLowerCase();
    const researchKeywords = [
      'research', 'find out', 'look up', 'search', 'gather', 'intelligence',
      'prepare for', 'before my', 'learn about', 'tell me about', 'what do we know',
      'case stud', 'past work', 'experience with', 'similar', 'internal-kb'
    ];
    return researchKeywords.some(kw => lowerMessage.includes(kw)) ||
           intent.needsWebSearch ||
           intent.needsInternalKnowledge ||
           intent.companies.length > 0;
  }

  /**
   * Analyze the user's query to understand intent and extract entities
   */
  private async analyzeQueryIntent(message: string): Promise<{
    type: 'company_research' | 'meeting_info' | 'deal_info' | 'case_study' | 'general' | 'metrics' | 'atlassian_guidance';
    companies: string[];
    keywords: string[];
    needsWebSearch: boolean;
    needsInternalKnowledge: boolean;
    needsAtlassianGuidance: boolean;
  }> {
    const lowerMessage = message.toLowerCase();

    // Detect if this is an Atlassian-related guidance question
    const atlassianKeywords = [
      'atlassian', 'jira', 'confluence', 'data center', 'cloud migration',
      'license', 'renewal', 'dc to cloud', 'server to cloud', 'migration',
      'jsm', 'service management', 'bitbucket', 'trello', 'premium', 'enterprise',
      'sso', 'atlassian access', 'playbook', 'decision', 'recommend', 'should i',
      'what service', 'which service', 'how to sell', 'pitch', 'proposal'
    ];
    const needsAtlassianGuidance = atlassianKeywords.some(kw => lowerMessage.includes(kw));

    // Simple intent detection
    let type: 'company_research' | 'meeting_info' | 'deal_info' | 'case_study' | 'general' | 'metrics' | 'atlassian_guidance' = 'general';
    const needsWebSearch = lowerMessage.includes('research') ||
                           lowerMessage.includes('know about') ||
                           lowerMessage.includes('tell me about') ||
                           lowerMessage.includes('what is') ||
                           lowerMessage.includes('who is');
    const needsInternalKnowledge = lowerMessage.includes('case stud') ||
                       lowerMessage.includes('past') ||
                       lowerMessage.includes('experience') ||
                       lowerMessage.includes('similar') ||
                       lowerMessage.includes('internal') ||
                       lowerMessage.includes('internal-kb');

    if (needsAtlassianGuidance && (lowerMessage.includes('how') || lowerMessage.includes('should') ||
        lowerMessage.includes('recommend') || lowerMessage.includes('what service') ||
        lowerMessage.includes('pitch') || lowerMessage.includes('sell'))) {
      type = 'atlassian_guidance';
    } else if (lowerMessage.includes('meeting') || lowerMessage.includes('calendar') || lowerMessage.includes('schedule')) {
      type = 'meeting_info';
    } else if (lowerMessage.includes('deal') || lowerMessage.includes('pipeline') || lowerMessage.includes('opportunity')) {
      type = 'deal_info';
    } else if (lowerMessage.includes('case stud') || lowerMessage.includes('previous work') || lowerMessage.includes('past engagement')) {
      type = 'case_study';
    } else if (lowerMessage.includes('win rate') || lowerMessage.includes('metrics') || lowerMessage.includes('performance') || lowerMessage.includes('how many')) {
      type = 'metrics';
    } else if (needsWebSearch) {
      type = 'company_research';
    }

    // Extract potential company names (simple heuristic - capitalize words)
    const companies: string[] = [];
    const companyPatterns = [
      /about\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)/g,
      /know about\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)/g,
      /for\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)/g,
      /with\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)/g,
    ];

    for (const pattern of companyPatterns) {
      let match;
      while ((match = pattern.exec(message)) !== null) {
        const company = match[1].trim();
        if (company.length > 2 && !['The', 'This', 'That', 'What', 'How', 'When', 'Where', 'Why'].includes(company)) {
          companies.push(company);
        }
      }
    }

    // Extract keywords for search
    const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'what', 'who', 'where', 'when', 'why', 'how', 'which', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'my', 'your', 'his', 'her', 'its', 'our', 'their', 'me', 'him', 'us', 'them', 'about', 'with', 'for', 'from', 'to', 'of', 'in', 'on', 'at', 'by']);
    const keywords = message
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .slice(0, 10);

    return {
      type,
      companies,
      keywords,
      needsWebSearch,
      needsInternalKnowledge,
      needsAtlassianGuidance,
    };
  }

  /**
   * Fetch internal data (meetings, deals, analyses) based on query intent
   */
  private async fetchInternalData(intent: {
    type: string;
    companies: string[];
    keywords: string[];
  }): Promise<InternalData> {
    const results: InternalData = {
      meetings: [],
      deals: [],
      analyses: [],
    };

    try {
      // Fetch recent meetings
      if (intent.type === 'meeting_info' || intent.type === 'general' || intent.type === 'metrics') {
        const meetings = await this.prisma.meeting.findMany({
          take: 20,
          orderBy: { meetingDate: 'desc' },
        });
        results.meetings = meetings;
      }

      // Search meetings by title if companies specified (Meeting doesn't have companyName)
      if (intent.companies.length > 0) {
        const companyMeetings = await this.prisma.meeting.findMany({
          where: {
            OR: intent.companies.map(company => ({
              title: { contains: company, mode: 'insensitive' as const },
            })),
          },
          take: 10,
          orderBy: { meetingDate: 'desc' },
        });
        results.meetings = [...results.meetings, ...companyMeetings];
      }

      // Fetch deals
      if (intent.type === 'deal_info' || intent.type === 'metrics' || intent.type === 'general') {
        const deals = await this.prisma.deal.findMany({
          take: 20,
          orderBy: { updatedAt: 'desc' },
        });
        results.deals = deals;
      }

      // Search deals by company name
      if (intent.companies.length > 0) {
        const companyDeals = await this.prisma.deal.findMany({
          where: {
            OR: intent.companies.map(company => ({
              companyName: { contains: company, mode: 'insensitive' as const },
            })),
          },
          take: 10,
        });
        results.deals = [...results.deals, ...companyDeals];
      }

      // Fetch recent analyses
      const analyses = await this.prisma.analysis.findMany({
        where: intent.companies.length > 0 ? {
          OR: intent.companies.map(company => ({
            companyName: { contains: company, mode: 'insensitive' as const },
          })),
        } : undefined,
        take: 10,
        orderBy: { startedAt: 'desc' },
      });
      results.analyses = analyses;

    } catch (error) {
      console.error('Error fetching internal data:', error);
    }

    return results;
  }

  /**
   * Perform web search for company/topic research
   */
  private async performWebSearch(
    intent: { type: string; companies: string[]; keywords: string[]; needsWebSearch: boolean },
    message: string
  ): Promise<any> {
    if (!intent.needsWebSearch && intent.type !== 'company_research') {
      return null;
    }

    try {
      // Build search query
      let searchQuery = message;
      if (intent.companies.length > 0) {
        searchQuery = `${intent.companies[0]} company information products services`;
      }

      const webResults = await this.openai.webSearch({ query: searchQuery });
      return webResults;
    } catch (error) {
      console.error('Web search error:', error);
      return null;
    }
  }

  /**
   * Search InternalKnowledge for internal knowledge
   */
  private async searchInternalKnowledge(
    intent: { type: string; companies: string[]; keywords: string[]; needsInternalKnowledge: boolean },
    message: string,
    accessToken: string
  ): Promise<any> {
    if (!intent.needsInternalKnowledge && intent.type !== 'case_study') {
      return null;
    }

    try {
      const companyName = intent.companies[0] || intent.keywords.slice(0, 3).join(' ');
      if (!companyName) {
        return null;
      }

      const internalKbResults = await this.internalKb.searchRelevantDocuments(companyName, accessToken);
      return internalKbResults;
    } catch (error) {
      console.error('InternalKnowledge search error:', error);
      return null;
    }
  }

  /**
   * Build context string for the AI response
   */
  private buildContext(
    internalData: InternalData,
    webSearchData: any,
    internalKbData: any,
    intent: { type: string; companies: string[]; keywords: string[]; needsAtlassianGuidance?: boolean }
  ): string {
    const contextParts: string[] = [];

    // Add Atlassian decision flow knowledge if relevant
    if (intent.type === 'atlassian_guidance' || intent.needsAtlassianGuidance) {
      contextParts.push(ATLASSIAN_DECISION_FLOW_KNOWLEDGE);

      // Add relevant service talking points based on keywords
      const keywords = intent.keywords.join(' ').toLowerCase();
      if (keywords.includes('migration') || keywords.includes('cloud')) {
        contextParts.push(`Cloud Migration Talking Points:\n${SERVICE_TALKING_POINTS.cloud_migration.map(p => `- ${p}`).join('\n')}`);
      }
      if (keywords.includes('managed') || keywords.includes('support')) {
        contextParts.push(`Managed Services Talking Points:\n${SERVICE_TALKING_POINTS.managed_services.map(p => `- ${p}`).join('\n')}`);
      }
      if (keywords.includes('training') || keywords.includes('enablement')) {
        contextParts.push(`Training Talking Points:\n${SERVICE_TALKING_POINTS.training.map(p => `- ${p}`).join('\n')}`);
      }
      if (keywords.includes('health') || keywords.includes('performance')) {
        contextParts.push(`Health Check Talking Points:\n${SERVICE_TALKING_POINTS.health_check.map(p => `- ${p}`).join('\n')}`);
      }
    }

    // Add meeting context
    if (internalData.meetings.length > 0) {
      const meetingSummary = internalData.meetings.slice(0, 5).map((m: any) => ({
        title: m.title,
        date: m.meetingDate ? new Date(m.meetingDate).toLocaleDateString() : 'Unknown',
        duration: m.durationMinutes || 0,
      }));
      contextParts.push(`Recent Meetings:\n${JSON.stringify(meetingSummary, null, 2)}`);
    }

    // Add deal context
    if (internalData.deals.length > 0) {
      const dealSummary = internalData.deals.slice(0, 5).map((d: any) => ({
        name: d.opportunityName || d.companyName,
        company: d.companyName,
        stage: d.stage,
        value: d.estimatedValue || d.amount,
      }));
      contextParts.push(`Recent Deals:\n${JSON.stringify(dealSummary, null, 2)}`);

      // Calculate metrics if needed
      if (intent.type === 'metrics') {
        const totalDeals = internalData.deals.length;
        const wonDeals = internalData.deals.filter((d: any) => d.stage?.toLowerCase().includes('won') || d.isWon).length;
        const lostDeals = internalData.deals.filter((d: any) => d.stage?.toLowerCase().includes('lost') || (d.isClosed && !d.isWon)).length;
        const winRate = totalDeals > 0 ? ((wonDeals / (wonDeals + lostDeals)) * 100).toFixed(1) : 'N/A';
        const totalValue = internalData.deals.reduce((sum: number, d: any) => sum + (d.estimatedValue || d.amount || 0), 0);

        contextParts.push(`Deal Metrics:
- Total Deals: ${totalDeals}
- Won Deals: ${wonDeals}
- Lost Deals: ${lostDeals}
- Win Rate: ${winRate}%
- Total Pipeline Value: $${totalValue.toLocaleString()}`);
      }
    }

    // Add analysis context
    if (internalData.analyses.length > 0) {
      const analysisSummary = internalData.analyses.slice(0, 3).map((a: any) => ({
        company: a.companyName,
        date: a.startedAt ? new Date(a.startedAt).toLocaleDateString() : 'Unknown',
        status: a.status,
      }));
      contextParts.push(`Recent Analyses:\n${JSON.stringify(analysisSummary, null, 2)}`);
    }

    // Add web search results
    if (webSearchData) {
      const webContent = typeof webSearchData === 'string' ? webSearchData :
                         webSearchData.output_text ||
                         JSON.stringify(webSearchData).substring(0, 2000);
      contextParts.push(`Web Search Results:\n${webContent.substring(0, 2000)}`);
    }

    // Add InternalKnowledge results
    if (internalKbData?.summary) {
      contextParts.push(`Internal Knowledge (InternalKnowledge):\n${internalKbData.summary.substring(0, 2000)}`);
    }

    if (internalKbData?.documents?.length > 0) {
      const docList = internalKbData.documents.slice(0, 5).map((d: any) => `- ${d.title}`).join('\n');
      contextParts.push(`Relevant Internal Documents:\n${docList}`);
    }

    return contextParts.join('\n\n---\n\n');
  }

  /**
   * Generate the AI response using the gathered context
   */
  private async generateResponse(
    message: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    context: string
  ): Promise<string> {
    const systemPrompt = `You are a helpful AI sales assistant for Northstar Integrators, a technology consulting company specializing in Atlassian, ServiceNow, Agile, and DevOps transformations.

You have access to:
1. Internal data (meetings, deals, analyses) from the CRM
2. Web search results for real-time company information
3. InternalKnowledge - Northstar Integrators's internal knowledge base with case studies, proposals, and past engagements
4. Atlassian Services Decision Flow - A comprehensive guide for recommending the right Atlassian services based on customer scenarios

Your job is to provide helpful, accurate, and actionable information to sales professionals.

Guidelines:
- Be concise but comprehensive
- Always cite your sources when providing specific information
- If you don't have information about something, say so honestly
- Provide actionable insights and recommendations when appropriate
- Use bullet points and formatting for clarity
- When discussing companies, focus on sales-relevant information (opportunities, pain points, contacts)
- When discussing deals, provide pipeline context and next steps
- When discussing meetings, highlight key attendees and preparation needs

For Atlassian-related questions:
- Use the Atlassian Services Decision Flow to guide recommendations
- Provide specific service recommendations with estimated value ranges
- Include relevant talking points for the scenario
- Suggest follow-up questions to qualify the opportunity
- Reference the Sales Playbook wizard for interactive guidance
- Always consider: customer deployment type, migration urgency, budget constraints, and technical requirements

Available Context:
${context || 'No specific context available for this query.'}`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
      { role: 'user', content: message },
    ];

    const response = await this.openai.generateChatCompletion({
      messages,
      temperature: 0.7,
      maxTokens: 2000,
    });

    return response;
  }

  /**
   * Generate AI response with tool calling for actionable responses
   */
  private async generateResponseWithTools(
    message: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    dataContext: string,
    appContext: AppContext | undefined,
    internalData: InternalData,
    accessToken?: string
  ): Promise<{
    response: string;
    actions?: AIAction[];
    dataPreview?: DataPreview;
    widgets?: ChatWidget[];
    quickReplies?: string[];
  }> {
    // Build enhanced system prompt with app context
    const appContextInfo = appContext
      ? `\n=== CURRENT USER CONTEXT ===
- User is viewing: ${appContext.currentPage || 'unknown page'}
- Current route: ${appContext.currentRoute || 'unknown'}
- Selected record: ${appContext.selectedRecord ? `${appContext.selectedRecord.type} - ${appContext.selectedRecord.name}` : 'none'}
- Recent pages visited: ${appContext.recentPages?.slice(0, 3).join(', ') || 'none'}

Use this context to provide relevant suggestions. For example:
- If on Calendar, suggest pre-call analysis for upcoming meetings
- If on Deals, offer to show pipeline or create deals
- If viewing a specific account, offer to research that company
- If on Analysis, help them start research or review results`
      : '';

    const systemPrompt = `You are a powerful AI assistant for the Sales Intelligence platform. You don't just navigate - you EXECUTE real operations. You can research companies, search internal knowledge, analyze meetings, and take action on behalf of sales professionals.

=== YOUR CAPABILITIES ===
You have access to powerful tools. USE THEM PROACTIVELY:

1. **execute_research** - ACTUALLY research companies using web + InternalKnowledge
   - Use for: "Research Salesforce", "What do we know about Microsoft?", "Prepare for my Acme meeting"
   - This performs REAL searches and returns actual data

2. **search_internal_kb** - Search internal knowledge base for case studies, proposals, past work
   - Use for: "Find case studies", "Past Jira migrations", "Experience with healthcare"
   - Returns REAL internal documents and expertise

3. **analyze_meeting** - Start pre-call or post-call analysis
   - Use for: "Prepare for my call", "Analyze this meeting", "Pre-call research"
   - Triggers ACTUAL analysis workflows

4. **navigate_to_page** - Go to pages or open records
5. **create_record** - Create deals, accounts, meetings
6. **search_records** - Find records by criteria
7. **trigger_workflow** - Start analysis, proposals, RFPs
8. **show_data** - Display inline data previews
9. **explain_feature** - Explain how features work
10. **trigger_agent** - Trigger an AI agent (shows interactive agent card in chat)
11. **ask_user_input** - Request structured input via inline form
12. **suggest_replies** - Suggest follow-up questions as clickable chips

=== AGENTS AVAILABLE ===
${AGENT_METADATA.map(a => `- ${a.id}: ${a.name} — ${a.description}`).join('\n')}

=== INTERACTIVE FEATURES ===
- Use **suggest_replies** at the end of EVERY response to guide users to next steps
- Use **trigger_agent** when user wants to run analysis, generate content, or automate tasks
- Use **ask_user_input** when you need specific info (company name, meeting selection, etc.)

=== WHEN TO USE REAL OPERATIONS ===
ALWAYS use execute_research or search_internal_kb when user asks about:
- Company information, research, intelligence, preparation
- Case studies, past work, similar engagements
- Internal knowledge, expertise, proposals

ALWAYS use analyze_meeting when user wants:
- Pre-call preparation or meeting research
- Post-call analysis or transcript processing
- Meeting-specific intelligence

=== RESPONSE STYLE ===
- Be action-oriented - DO things, don't just describe them
- Use tools FIRST, then explain what you did/found
- When researching, provide the actual findings in your response
- Be concise - users are busy sales professionals
- Lead with results, not process descriptions
${appContextInfo}

=== APP KNOWLEDGE BASE ===
${APP_KNOWLEDGE_BASE}

=== AVAILABLE INTERNAL DATA ===
${dataContext || 'No specific data context available for this query.'}`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
      { role: 'user', content: message },
    ];

    try {
      // Call OpenAI with tools
      const result = await this.openai.generateChatWithTools(
        messages,
        AI_ASSISTANT_TOOLS,
        { temperature: 0.7, toolChoice: 'auto' }
      );

      // Process tool calls into actions, widgets, and quick replies
      const actions: AIAction[] = [];
      const widgets: ChatWidget[] = [];
      let dataPreview: DataPreview | undefined;
      let quickReplies: string[] | undefined;

      for (const toolCall of result.toolCalls) {
        const { name, arguments: args } = toolCall;

        // Handle new widget-producing tools
        if (name === 'trigger_agent') {
          const agentMeta = getAgentMetadata(args.agentId);
          if (agentMeta) {
            widgets.push({
              id: `widget_${toolCall.id}`,
              type: 'agent_card',
              data: {
                agentId: agentMeta.id,
                agentName: agentMeta.name,
                description: agentMeta.description,
                icon: agentMeta.icon,
                color: agentMeta.color,
              },
            });
          }
          continue;
        }

        if (name === 'ask_user_input') {
          widgets.push({
            id: `widget_${toolCall.id}`,
            type: 'inline_form',
            data: {
              formId: args.formId,
              fields: args.fields,
              submitLabel: args.submitLabel || 'Submit',
            },
          });
          continue;
        }

        if (name === 'suggest_replies') {
          quickReplies = (args.replies || []).slice(0, 4);
          continue;
        }

        // Existing tool call processing
        const action = this.toolCallToAction(toolCall, internalData);
        if (action) {
          if (action.payload.dataPreview) {
            dataPreview = action.payload.dataPreview as DataPreview;
          } else {
            actions.push(action);
          }
        }
      }

      // If tools were called but no text response, generate one
      let responseText = result.content || '';
      if (!responseText && actions.length > 0) {
        responseText = this.generateActionSummary(actions);
      }

      return {
        response: responseText,
        actions: actions.length > 0 ? actions : undefined,
        dataPreview,
        widgets: widgets.length > 0 ? widgets : undefined,
        quickReplies,
      };
    } catch (error: any) {
      console.error('Tool calling failed, falling back to standard response:', error);
      // Fallback to standard response without tools
      const response = await this.generateResponse(message, history, dataContext);
      return { response };
    }
  }

  /**
   * Convert a tool call to an AIAction
   */
  private toolCallToAction(
    toolCall: { id: string; name: string; arguments: Record<string, any> },
    internalData: InternalData
  ): AIAction | null {
    const { id, name, arguments: args } = toolCall;

    switch (name) {
      case 'execute_research':
        return {
          id: `action_${id}`,
          type: 'trigger',
          label: `Research ${args.companyName}`,
          description: `${args.researchType} research${args.context ? ` - ${args.context}` : ''}`,
          icon: 'Search',
          payload: {
            workflow: 'company_research',
            targetName: args.companyName,
            data: {
              researchType: args.researchType,
              context: args.context,
            },
          },
          primary: true,
        };

      case 'search_internal_kb':
        return {
          id: `action_${id}`,
          type: 'trigger',
          label: 'Search InternalKnowledge',
          description: `Find "${args.query}"${args.category ? ` in ${args.category}` : ''}`,
          icon: 'Search',
          payload: {
            workflow: 'company_research',
            data: {
              internalKbQuery: args.query,
              category: args.category || 'all',
              industry: args.industry,
              service: args.service,
            },
          },
          primary: true,
        };

      case 'analyze_meeting':
        const isPreCall = args.analysisType === 'pre_call';
        return {
          id: `action_${id}`,
          type: 'trigger',
          label: isPreCall ? 'Start Pre-Call Analysis' : 'Start Post-Call Analysis',
          description: args.companyName ? `for ${args.companyName}` : undefined,
          icon: isPreCall ? 'Event' : 'Analytics',
          payload: {
            workflow: isPreCall ? 'pre_call_analysis' : 'post_call_analysis',
            targetId: args.meetingId,
            targetName: args.companyName,
            data: {
              meetingContext: args.meetingContext,
            },
          },
          primary: true,
        };

      case 'navigate_to_page':
        return {
          id: `action_${id}`,
          type: 'navigate',
          label: `Go to ${this.formatPageName(args.page)}`,
          description: args.reason || undefined,
          icon: 'NavigateNext',
          payload: {
            page: args.page,
            recordId: args.recordId,
            recordType: args.recordType,
          },
          primary: true,
        };

      case 'create_record':
        const recordTypeLabel = args.recordType.charAt(0).toUpperCase() + args.recordType.slice(1);
        return {
          id: `action_${id}`,
          type: 'create',
          label: `Create ${recordTypeLabel}`,
          description: args.prefillData?.companyName
            ? `For ${args.prefillData.companyName}`
            : undefined,
          icon: 'Add',
          payload: {
            recordType: args.recordType,
            prefillData: args.prefillData,
          },
          primary: true,
        };

      case 'search_records':
        return {
          id: `action_${id}`,
          type: 'search',
          label: `Search ${args.recordType === 'all' ? 'All Records' : args.recordType + 's'}`,
          description: `for "${args.query}"`,
          icon: 'Search',
          payload: {
            recordType: args.recordType || 'all',
            query: args.query,
            filters: args.filters,
          },
        };

      case 'trigger_workflow':
        const workflowLabels: Record<string, string> = {
          pre_call_analysis: 'Pre-Call Analysis',
          post_call_analysis: 'Post-Call Analysis',
          company_research: 'Company Research',
          proposal_generation: 'Generate Proposal',
          rfp_analysis: 'Analyze RFP',
          ppt_generation: 'Create Presentation',
          proposal_evaluation: 'Evaluate Proposal',
        };
        const workflowIcons: Record<string, string> = {
          pre_call_analysis: 'Event',
          post_call_analysis: 'Analytics',
          company_research: 'Search',
          proposal_generation: 'Description',
          rfp_analysis: 'Description',
          ppt_generation: 'Slideshow',
          proposal_evaluation: 'Assessment',
        };
        return {
          id: `action_${id}`,
          type: 'trigger',
          label: `Start ${workflowLabels[args.workflow] || args.workflow}`,
          description: args.targetName ? `for ${args.targetName}` : undefined,
          icon: workflowIcons[args.workflow] as any || 'PlayArrow',
          payload: {
            workflow: args.workflow,
            targetId: args.targetId,
            targetName: args.targetName,
          },
          primary: true,
        };

      case 'show_data':
        // Generate data preview from internal data
        const preview = this.generateDataPreview(args.dataType, args, internalData);
        return {
          id: `action_${id}`,
          type: 'navigate',
          label: 'View Full Details',
          description: `Open ${this.formatPageName(this.getPageForDataType(args.dataType))}`,
          icon: 'OpenInNew',
          payload: {
            page: this.getPageForDataType(args.dataType),
            dataPreview: preview,
          },
        };

      case 'explain_feature':
        // For explain_feature, we return a navigation action to the relevant page
        const featurePages: Record<string, string> = {
          pre_call_analysis: 'analysis',
          post_call_analysis: 'analysis-postcall',
          company_research: 'analysis',
          rfp_generator: 'rfp-generator',
          ppt_generator: 'ppt-generator',
          proposal_evaluation: 'proposal-evaluation',
          deals: 'deals',
          accounts: 'accounts',
          calendar: 'calendar',
          atlassian_assessment: 'atlassian-assessment',
          command_palette: 'help',
          pipeline: 'deals',
          case_studies: 'analysis',
        };
        return {
          id: `action_${id}`,
          type: 'navigate',
          label: `Go to ${this.formatPageName(featurePages[args.feature] || 'help')}`,
          description: 'See it in action',
          icon: 'NavigateNext',
          payload: {
            page: featurePages[args.feature] || 'help',
          },
        };

      default:
        return null;
    }
  }

  /**
   * Generate a data preview based on internal data
   */
  private generateDataPreview(
    dataType: string,
    args: Record<string, any>,
    internalData: InternalData
  ): DataPreview | null {
    const limit = args.filters?.limit || 5;

    switch (dataType) {
      case 'upcoming_meetings':
        const upcomingMeetings = internalData.meetings
          .filter((m: any) => new Date(m.meetingDate) >= new Date())
          .slice(0, limit)
          .map((m: any) => ({
            id: m.meetingId,
            title: m.title,
            date: m.meetingDate,
            duration: m.durationMinutes,
          }));
        return {
          type: 'meetings_list',
          title: 'Upcoming Meetings',
          data: upcomingMeetings,
        };

      case 'recent_deals':
        const recentDeals = internalData.deals.slice(0, limit).map((d: any) => ({
          id: d.dealId,
          name: d.opportunityName || d.companyName,
          stage: d.stage,
          value: d.estimatedValue,
        }));
        return {
          type: 'deals_list',
          title: 'Recent Deals',
          data: recentDeals,
        };

      case 'pipeline_summary':
        const pipeline = {
          totalDeals: internalData.deals.length,
          totalValue: internalData.deals.reduce((sum: number, d: any) => sum + (d.estimatedValue || 0), 0),
          byStage: this.groupDealsByStage(internalData.deals),
        };
        return {
          type: 'metrics',
          title: 'Pipeline Summary',
          data: pipeline,
        };

      default:
        return null;
    }
  }

  /**
   * Group deals by stage for metrics
   */
  private groupDealsByStage(deals: any[]): Record<string, number> {
    return deals.reduce((acc: Record<string, number>, deal: any) => {
      const stage = deal.stage || 'Unknown';
      acc[stage] = (acc[stage] || 0) + 1;
      return acc;
    }, {});
  }

  /**
   * Get the appropriate page for a data type
   */
  private getPageForDataType(dataType: string): string {
    const pageMap: Record<string, string> = {
      upcoming_meetings: 'calendar',
      recent_deals: 'deals',
      pipeline_summary: 'metrics',
      account_details: 'accounts',
      deal_details: 'deals',
    };
    return pageMap[dataType] || 'calendar';
  }

  /**
   * Format page name for display
   */
  private formatPageName(page: string): string {
    const names: Record<string, string> = {
      calendar: 'Calendar',
      deals: 'Deals',
      accounts: 'Accounts',
      analysis: 'Company Research',
      'analysis-postcall': 'Post-Call Analysis',
      metrics: 'Metrics',
      'rfp-generator': 'RFP Generator',
      'ppt-generator': 'PPT Generator',
      'proposal-evaluation': 'Proposal Evaluation',
      'atlassian-assessment': 'Atlassian Assessment',
      settings: 'Settings',
      help: 'Help',
    };
    return names[page] || page;
  }

  /**
   * Generate a summary text for actions
   */
  private generateActionSummary(actions: AIAction[]): string {
    if (actions.length === 0) return '';

    if (actions.length === 1) {
      const action = actions[0];
      return `I can help you with that. ${action.description || `Click below to ${action.label.toLowerCase()}.`}`;
    }

    return `I can help you with that. Here are some actions you can take:`;
  }

  /**
   * Extract sources from the gathered data
   */
  private extractSources(
    internalData: InternalData,
    webSearchData: any,
    internalKbData: any
  ): Array<{ title: string; type: string; url?: string }> {
    const sources: Array<{ title: string; type: string; url?: string }> = [];

    // Add internal data sources
    if (internalData.meetings.length > 0) {
      sources.push({ title: 'CRM Meetings', type: 'internal' });
    }
    if (internalData.deals.length > 0) {
      sources.push({ title: 'CRM Deals', type: 'internal' });
    }
    if (internalData.analyses.length > 0) {
      sources.push({ title: 'Previous Analyses', type: 'internal' });
    }

    // Add web search sources
    if (webSearchData) {
      sources.push({ title: 'Web Search', type: 'web' });
    }

    // Add InternalKnowledge sources
    if (internalKbData?.documents) {
      internalKbData.documents.slice(0, 3).forEach((doc: any) => {
        sources.push({
          title: doc.title || 'InternalKnowledge Document',
          type: 'internal-kb',
          url: doc.url,
        });
      });
    }

    return sources;
  }

  /**
   * Get quick suggestions based on recent activity
   */
  async getSuggestions(): Promise<string[]> {
    try {
      const recentMeetings = await this.prisma.meeting.findMany({
        take: 5,
        orderBy: { meetingDate: 'desc' },
        where: {
          meetingDate: { gte: new Date() },
        },
      });

      const recentDeals = await this.prisma.deal.findMany({
        take: 3,
        orderBy: { updatedAt: 'desc' },
      });

      const suggestions: string[] = [];

      if (recentMeetings.length > 0) {
        const meeting = recentMeetings[0];
        // Meeting doesn't have companyName, use title instead
        suggestions.push(`What do I need to know before my meeting "${meeting.title || 'upcoming meeting'}"?`);
      }

      if (recentDeals.length > 0) {
        suggestions.push(`What deals need follow-up this week?`);
        suggestions.push(`Show me our pipeline summary`);
      }

      suggestions.push(`Find case studies for my next pitch`);
      suggestions.push(`What's our win rate this quarter?`);

      return suggestions.slice(0, 6);
    } catch (error) {
      console.error('Error getting suggestions:', error);
      return [
        "What do we know about Microsoft?",
        "Find case studies about Jira migrations",
        "What's our win rate this quarter?",
        "What deals need follow-up?",
      ];
    }
  }
}

// Singleton instance
let aiAssistantServiceInstance: AIAssistantService | null = null;

export function getAIAssistantService(): AIAssistantService {
  if (!aiAssistantServiceInstance) {
    aiAssistantServiceInstance = new AIAssistantService();
  }
  return aiAssistantServiceInstance;
}
