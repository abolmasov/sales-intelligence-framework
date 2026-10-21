import { getOpenAIService } from './openai.service';
import {
  DealHealthSignals,
  ActionItem,
  EnhancedCompanyIntelligence,
  StakeholderInsight,
} from '../types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Research Enhancement Service
 * Generates deal health signals, action items, and enhanced insights from research data
 */
export class ResearchEnhancementService {
  private openai = getOpenAIService();

  /**
   * Analyze research data to generate deal health signals
   */
  async generateDealHealthSignals(
    companyName: string,
    executiveSummary: string,
    attendees: Array<{ name: string; role?: string; company?: string }>,
    internalKbHistory: string,
    purposeOfMeeting?: string
  ): Promise<DealHealthSignals> {
    const prompt = `You are a sales intelligence analyst. Analyze the following meeting and company data to generate deal health signals.

COMPANY: ${companyName}

EXECUTIVE SUMMARY:
${executiveSummary || 'No summary available'}

PURPOSE OF MEETING:
${purposeOfMeeting || 'General discovery/discussion'}

ATTENDEES:
${attendees.map(a => `- ${a.name}${a.role ? ` (${a.role})` : ''}${a.company ? ` at ${a.company}` : ''}`).join('\n') || 'No attendees listed'}

PAST ENGAGEMENT HISTORY:
${internalKbHistory || 'No prior engagement history found'}

Based on this information, provide a JSON response with the following structure:
{
  "budgetMentioned": <true if budget, investment, cost, pricing, ROI, spend or dollar amounts are discussed>,
  "timelineUrgency": "<high if deadline/urgency mentioned, medium if timeline discussed, low if vague, unknown if not mentioned>",
  "decisionMakerPresent": <true if a C-suite, VP, Director, or confirmed budget owner is an attendee>,
  "painPointsIdentified": ["<specific pain point verbatim or paraphrased>"],
  "competitorMentions": ["<competitor name if explicitly mentioned>"],
  "riskFactors": ["<specific risk or obstacle to closing>"],
  "opportunitySignals": ["<specific positive buying signal>"]
}

Respond ONLY with the JSON object, no additional text.`;

    try {
      const response = await this.openai.generateChatCompletion({
        messages: [
          { role: 'system', content: 'You are a sales intelligence analyst. Respond only with valid JSON.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        maxTokens: 1000,
      });

      const content = response.trim();
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        // Compute score deterministically from the signals GPT identified —
        // avoids score randomness across identical inputs.
        const computedScore = (() => {
          let s = 40; // baseline
          if (parsed.budgetMentioned) s += 15;
          s += parsed.timelineUrgency === 'high' ? 20 : parsed.timelineUrgency === 'medium' ? 10 : 3;
          if (parsed.decisionMakerPresent) s += 15;
          s += Math.min(10, (parsed.painPointsIdentified?.length || 0) * 2);
          s += Math.min(10, (parsed.opportunitySignals?.length || 0) * 2);
          s -= Math.min(15, (parsed.riskFactors?.length || 0) * 3);
          s -= Math.min(10, (parsed.competitorMentions?.length || 0) * 2);
          return Math.round(Math.max(0, Math.min(100, s)) / 5) * 5; // round to nearest 5
        })();
        return {
          overallScore: computedScore,
          budgetMentioned: Boolean(parsed.budgetMentioned),
          timelineUrgency: ['high', 'medium', 'low', 'unknown'].includes(parsed.timelineUrgency)
            ? parsed.timelineUrgency
            : 'unknown',
          decisionMakerPresent: Boolean(parsed.decisionMakerPresent),
          painPointsIdentified: Array.isArray(parsed.painPointsIdentified)
            ? parsed.painPointsIdentified.slice(0, 5)
            : [],
          competitorMentions: Array.isArray(parsed.competitorMentions)
            ? parsed.competitorMentions.slice(0, 3)
            : [],
          riskFactors: Array.isArray(parsed.riskFactors)
            ? parsed.riskFactors.slice(0, 5)
            : [],
          opportunitySignals: Array.isArray(parsed.opportunitySignals)
            ? parsed.opportunitySignals.slice(0, 5)
            : [],
        };
      }
    } catch (error) {
      console.error('Error generating deal health signals:', error);
    }

    // Default fallback
    return {
      overallScore: 50,
      budgetMentioned: false,
      timelineUrgency: 'unknown',
      decisionMakerPresent: false,
      painPointsIdentified: [],
      competitorMentions: [],
      riskFactors: ['Limited information available'],
      opportunitySignals: [],
    };
  }

  /**
   * Generate actionable next steps based on research
   */
  async generateActionItems(
    companyName: string,
    executiveSummary: string,
    attendees: Array<{ name: string; role?: string }>,
    purposeOfMeeting?: string,
    dealHealthSignals?: DealHealthSignals
  ): Promise<ActionItem[]> {
    const prompt = `You are a sales strategist. Based on the following meeting information, generate 3-5 prioritized action items for the sales rep.

COMPANY: ${companyName}

PURPOSE OF MEETING:
${purposeOfMeeting || 'General discovery/discussion'}

EXECUTIVE SUMMARY:
${executiveSummary || 'No summary available'}

ATTENDEES:
${attendees.map(a => `- ${a.name}${a.role ? ` (${a.role})` : ''}`).join('\n') || 'No attendees listed'}

${dealHealthSignals ? `
DEAL HEALTH ANALYSIS:
- Overall Score: ${dealHealthSignals.overallScore}/100
- Budget Discussed: ${dealHealthSignals.budgetMentioned ? 'Yes' : 'No'}
- Timeline Urgency: ${dealHealthSignals.timelineUrgency}
- Decision Maker Present: ${dealHealthSignals.decisionMakerPresent ? 'Yes' : 'No'}
- Pain Points: ${dealHealthSignals.painPointsIdentified.join(', ') || 'None identified'}
- Risks: ${dealHealthSignals.riskFactors.join(', ') || 'None identified'}
` : ''}

Generate action items in the following JSON array format:
[
  {
    "priority": "<high|medium|low>",
    "action": "<specific actionable task>",
    "rationale": "<why this action is important>",
    "dueWithin": "<24 hours|48 hours|1 week|2 weeks>",
    "category": "<follow-up|meeting|research|internal|other>"
  }
]

Focus on:
1. Immediate follow-up actions
2. Building multi-threaded relationships
3. Addressing identified risks
4. Leveraging opportunity signals
5. Advancing the deal to next stage

Respond ONLY with the JSON array.`;

    try {
      const response = await this.openai.generateChatCompletion({
        messages: [
          { role: 'system', content: 'You are a sales strategist. Respond only with a valid JSON array.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.4,
        maxTokens: 1500,
      });

      const content = response.trim();
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed)) {
          return parsed.slice(0, 5).map((item: any, idx: number) => ({
            id: uuidv4(),
            priority: ['high', 'medium', 'low'].includes(item.priority) ? item.priority : 'medium',
            action: String(item.action || `Action item ${idx + 1}`),
            rationale: String(item.rationale || 'No rationale provided'),
            dueWithin: String(item.dueWithin || '1 week'),
            category: ['follow-up', 'meeting', 'research', 'internal', 'other'].includes(item.category)
              ? item.category
              : 'other',
          }));
        }
      }
    } catch (error) {
      console.error('Error generating action items:', error);
    }

    // Default fallback
    return [
      {
        id: uuidv4(),
        priority: 'high',
        action: `Send follow-up email to ${companyName} summarizing key discussion points`,
        rationale: 'Maintain momentum and demonstrate attentiveness',
        dueWithin: '24 hours',
        category: 'follow-up',
      },
      {
        id: uuidv4(),
        priority: 'medium',
        action: 'Research additional stakeholders to build multi-threaded relationship',
        rationale: 'Reduce single-point-of-contact risk',
        dueWithin: '1 week',
        category: 'research',
      },
    ];
  }

  /**
   * Extract enhanced company intelligence from research data
   */
  async extractCompanyIntelligence(
    companyName: string,
    executiveSummary: string,
    newsData?: any
  ): Promise<EnhancedCompanyIntelligence> {
    const prompt = `You are a company research analyst. Extract structured company intelligence from the following data.

COMPANY: ${companyName}

EXECUTIVE SUMMARY:
${executiveSummary || 'No summary available'}

${newsData ? `
NEWS DATA:
${JSON.stringify(newsData).substring(0, 2000)}
` : ''}

Extract company intelligence in the following JSON format:
{
  "employeeCount": "<e.g., '500-1000' or 'Unknown'>",
  "revenue": "<e.g., '$50M-$100M' or 'Unknown'>",
  "industry": "<primary industry>",
  "sector": "<specific sector if known>",
  "techStack": ["<technology 1>", "<technology 2>"],
  "recentNewsSentiment": "<positive|neutral|negative>",
  "keyHighlights": ["<highlight 1>", "<highlight 2>"],
  "fundingInfo": "<funding stage or amount if known>",
  "headquarters": "<city, state/country>"
}

If information is not available, use "Unknown" or omit the field.
Respond ONLY with the JSON object.`;

    try {
      const response = await this.openai.generateChatCompletion({
        messages: [
          { role: 'system', content: 'You are a company research analyst. Respond only with valid JSON.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        maxTokens: 1000,
      });

      const content = response.trim();
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          employeeCount: parsed.employeeCount || undefined,
          revenue: parsed.revenue || undefined,
          industry: String(parsed.industry || 'Unknown'),
          sector: parsed.sector || undefined,
          techStack: Array.isArray(parsed.techStack) ? parsed.techStack.slice(0, 10) : undefined,
          recentNewsSentiment: ['positive', 'neutral', 'negative'].includes(parsed.recentNewsSentiment)
            ? parsed.recentNewsSentiment
            : 'neutral',
          keyHighlights: Array.isArray(parsed.keyHighlights) ? parsed.keyHighlights.slice(0, 5) : [],
          fundingInfo: parsed.fundingInfo || undefined,
          headquarters: parsed.headquarters || undefined,
        };
      }
    } catch (error) {
      console.error('Error extracting company intelligence:', error);
    }

    // Default fallback
    return {
      industry: 'Unknown',
      recentNewsSentiment: 'neutral',
      keyHighlights: [],
    };
  }

  /**
   * Generate stakeholder insights with talking points
   */
  async generateStakeholderInsights(
    companyName: string,
    attendees: Array<{ name: string; role?: string; company?: string; email?: string }>,
    executiveSummary: string,
    linkedInData?: Record<string, string>
  ): Promise<StakeholderInsight[]> {
    if (!attendees || attendees.length === 0) {
      return [];
    }

    const prompt = `You are a sales intelligence analyst. Analyze the following attendees for a meeting with ${companyName} and provide stakeholder insights.

ATTENDEES:
${attendees.map(a => `- ${a.name}${a.role ? ` (${a.role})` : ''}${a.company ? ` at ${a.company}` : ''}`).join('\n')}

COMPANY CONTEXT:
${executiveSummary || 'No summary available'}

${linkedInData ? `
LINKEDIN INSIGHTS:
${Object.entries(linkedInData).map(([name, info]) => `${name}: ${info}`).join('\n')}
` : ''}

For each attendee, provide analysis in the following JSON array format:
[
  {
    "name": "<attendee name>",
    "role": "<role/title>",
    "influenceLevel": "<high|medium|low>",
    "isDecisionMaker": <boolean>,
    "department": "<department if identifiable>",
    "talkingPoints": ["<relevant talking point 1>", "<talking point 2>"],
    "linkedInSummary": "<brief professional summary if available>"
  }
]

INFLUENCE LEVEL GUIDELINES:
- High: C-suite, VP, Director, or anyone with budget/decision authority
- Medium: Senior managers, team leads, technical architects
- Low: Individual contributors, analysts, associates

Respond ONLY with the JSON array.`;

    try {
      const response = await this.openai.generateChatCompletion({
        messages: [
          { role: 'system', content: 'You are a sales intelligence analyst. Respond only with a valid JSON array.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        maxTokens: 2000,
      });

      const content = response.trim();
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed)) {
          return parsed.map((item: any) => ({
            name: String(item.name || 'Unknown'),
            role: String(item.role || 'Unknown'),
            company: companyName,
            influenceLevel: ['high', 'medium', 'low'].includes(item.influenceLevel)
              ? item.influenceLevel
              : 'medium',
            talkingPoints: Array.isArray(item.talkingPoints)
              ? item.talkingPoints.slice(0, 5)
              : [],
            linkedInSummary: item.linkedInSummary || undefined,
            department: item.department || undefined,
            isDecisionMaker: Boolean(item.isDecisionMaker),
          }));
        }
      }
    } catch (error) {
      console.error('Error generating stakeholder insights:', error);
    }

    // Default fallback - return basic info for each attendee
    return attendees.map(a => ({
      name: a.name,
      role: a.role || 'Unknown',
      company: a.company || companyName,
      influenceLevel: 'medium' as const,
      talkingPoints: [],
      isDecisionMaker: false,
    }));
  }
}

// Singleton instance
let enhancementService: ResearchEnhancementService | null = null;

export function getResearchEnhancementService(): ResearchEnhancementService {
  if (!enhancementService) {
    enhancementService = new ResearchEnhancementService();
  }
  return enhancementService;
}
