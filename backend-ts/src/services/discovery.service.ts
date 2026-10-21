import { getOpenAIService } from './openai.service';
import { getInternalKnowledgeService, InternalKnowledgeDocument } from './internal-knowledge.service';
import { ChatMessage } from '../types';

interface DiscoveryAccount {
  name: string;
  domain?: string;
  industry?: string;
  location?: string;
  summary?: string;
}

interface DiscoverySource {
  title: string;
  url: string;
}

interface ThinkingStep {
  step: string;
  detail: string;
}

interface DiscoveryChatRequest {
  message: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  accessToken?: string;
}

interface DiscoveryChatResponse {
  response: string;
  accounts?: DiscoveryAccount[];
  sources?: DiscoverySource[];
  thinking?: ThinkingStep[];
  internalKbResults?: { summary: string; documents: InternalKnowledgeDocument[] };
}

const SYSTEM_PROMPT = `You are a Sales Intelligence Discovery assistant specializing in lead research and competitive analysis. Your job is to help sales teams find and qualify potential leads.

You have access to real-time web search to find current information about companies, industries, and contacts.
You also have access to Northstar Integrators's internal knowledge base (InternalKnowledge) which contains case studies, proposals, past engagements, and internal expertise.

Your capabilities:
- Research specific companies (overview, financials, tech stack, recent news)
- Analyze competitive landscapes and market positioning
- Find key decision makers and points of contact at companies
- Identify qualified leads in specific industries or geographies
- Analyze market trends and industry dynamics
- Search internal knowledge for prior engagements and relevant case studies

Guidelines:
- Always use web search to provide current, accurate information
- When researching a specific company, also search InternalKnowledge for internal knowledge about prior engagements
- Structure responses clearly with headers and bullet points using markdown
- When researching companies, include: overview, industry, location, key products/services, leadership, and recent developments
- When finding contacts, include: name, title/role, and any publicly available professional details
- When you identify companies that could be saved as leads/accounts, use the save_as_account tool to make them available for saving
- Be thorough but concise — focus on actionable intelligence for sales teams
- If the user asks about multiple companies or a market segment, call save_as_account for each notable company discovered
- When internal knowledge is found from InternalKnowledge, highlight prior Northstar Integrators engagements and relevant case studies`;

const TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'web_search_live',
      description: 'Search the web for real-time information about companies, industries, contacts, market trends, and competitive intelligence.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query to find information about companies, people, industries, or markets',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'save_as_account',
      description: 'When you discover a company that could be a qualified lead or prospect, use this tool to make it available for the user to save as an account. Call this for each notable company you find during research.',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Company name',
          },
          domain: {
            type: 'string',
            description: 'Company website domain (e.g., "example.com")',
          },
          industry: {
            type: 'string',
            description: 'Industry or sector',
          },
          location: {
            type: 'string',
            description: 'Headquarters location',
          },
          summary: {
            type: 'string',
            description: 'Brief summary of the company and why they could be a qualified lead',
          },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'search_internal_kb',
      description: 'Search Northstar Integrators Sales Intelligence knowledge base for case studies, proposals, past engagements, SOWs, and internal expertise related to a company or topic. ALWAYS call this when the user asks about a specific company or industry to find relevant prior work.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query or topic to look up in the internal knowledge base',
          },
          companyName: {
            type: 'string',
            description: 'Optional company name to search for prior engagements',
          },
        },
        required: ['query'],
      },
    },
  },
];

export class DiscoveryService {
  private openai = getOpenAIService();

  async chat(request: DiscoveryChatRequest): Promise<DiscoveryChatResponse> {
    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...request.history.map((h) => ({
        role: h.role as 'user' | 'assistant',
        content: h.content,
      })),
      { role: 'user', content: request.message },
    ];

    const accounts: DiscoveryAccount[] = [];
    const sources: DiscoverySource[] = [];
    const thinking: ThinkingStep[] = [];
    let internalKbResults: { summary: string; documents: InternalKnowledgeDocument[] } | undefined;

    // Allow multiple rounds of tool calling (up to 5 iterations)
    let currentMessages = [...messages];
    let maxIterations = 5;

    while (maxIterations > 0) {
      maxIterations--;

      const result = await this.openai.generateChatWithTools(
        currentMessages,
        TOOLS,
        { temperature: 0.7, maxTokens: 4000 }
      );

      // No tool calls — we have our final response
      if (result.toolCalls.length === 0) {
        thinking.push({ step: 'Synthesizing findings', detail: 'Combining research results into a comprehensive response' });

        return {
          response: result.content || 'I was unable to generate a response. Please try again.',
          accounts: accounts.length > 0 ? accounts : undefined,
          sources: sources.length > 0 ? sources : undefined,
          thinking: thinking.length > 0 ? thinking : undefined,
          internalKbResults,
        };
      }

      // Process tool calls
      // Add assistant message with tool calls to the conversation
      currentMessages.push({
        role: 'assistant',
        content: result.content || '',
      });

      for (const toolCall of result.toolCalls) {
        if (toolCall.name === 'web_search_live') {
          thinking.push({ step: 'Searching the web', detail: toolCall.arguments.query });

          try {
            const searchResult = await this.openai.webSearch({
              query: toolCall.arguments.query,
            });
            const searchText = searchResult?.output_text || 'No results found.';

            // Extract any source URLs from the search response
            if (searchResult?.output) {
              for (const item of searchResult.output) {
                if (item.type === 'web_search_call' && item.results) {
                  for (const r of item.results) {
                    if (r.url && r.title) {
                      sources.push({ title: r.title, url: r.url });
                    }
                  }
                }
              }
            }

            currentMessages.push({
              role: 'user' as const,
              content: `[Tool result for web_search_live]: ${searchText}`,
            });
          } catch (error: any) {
            currentMessages.push({
              role: 'user' as const,
              content: `[Tool result for web_search_live]: Error performing search: ${error.message}`,
            });
          }
        } else if (toolCall.name === 'save_as_account') {
          accounts.push({
            name: toolCall.arguments.name,
            domain: toolCall.arguments.domain,
            industry: toolCall.arguments.industry,
            location: toolCall.arguments.location,
            summary: toolCall.arguments.summary,
          });
          currentMessages.push({
            role: 'user' as const,
            content: `[Tool result for save_as_account]: Account "${toolCall.arguments.name}" has been prepared for saving.`,
          });
        } else if (toolCall.name === 'search_internal_kb') {
          const query = toolCall.arguments.query;
          const companyName = toolCall.arguments.companyName || query;
          thinking.push({ step: 'Searching Sales Intelligence', detail: query });

          try {
            const internalKb = getInternalKnowledgeService();
            const kmResult = await internalKb.searchWithResearchContent(
              companyName,
              `${query}\n\nUser context: ${request.message}`,
            );

            internalKbResults = {
              summary: kmResult.summary,
              documents: kmResult.documents,
            };

            const docSummaries = kmResult.documents
              .slice(0, 5)
              .map((d) => `- ${d.title}: ${d.content.substring(0, 200)}...`)
              .join('\n');

            currentMessages.push({
              role: 'user' as const,
              content: `[Tool result for search_internal_kb]: ${kmResult.summary}\n\nRelevant documents:\n${docSummaries || 'No matching documents found.'}`,
            });
          } catch (error: any) {
            currentMessages.push({
              role: 'user' as const,
              content: `[Tool result for search_internal_kb]: Error searching internal knowledge: ${error.message}`,
            });
          }
        }
      }
    }

    // If we exhausted iterations, return what we have
    thinking.push({ step: 'Synthesizing findings', detail: 'Combining research results into a comprehensive response' });

    const finalResult = await this.openai.generateChatCompletion({
      messages: currentMessages,
      maxTokens: 4000,
    });

    return {
      response: finalResult || 'Research completed. Please check the discovered accounts below.',
      accounts: accounts.length > 0 ? accounts : undefined,
      sources: sources.length > 0 ? sources : undefined,
      thinking: thinking.length > 0 ? thinking : undefined,
      internalKbResults,
    };
  }
}

let discoveryService: DiscoveryService | null = null;

export function getDiscoveryService(): DiscoveryService {
  if (!discoveryService) {
    discoveryService = new DiscoveryService();
  }
  return discoveryService;
}
