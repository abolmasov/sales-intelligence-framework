import { getPrismaClient } from '../config/database';
import { getOpenAIService } from './openai.service';

const prisma = getPrismaClient();

// Northstar Integrators Service Line definitions
export const ENTERPRISE_SERVICE_LINES = {
  AGILE_TRANSFORMATION: {
    name: 'Agile Transformation',
    keywords: ['agile', 'scrum', 'kanban', 'sprint', 'backlog', 'product owner', 'scrum master', 'agile coach', 'SAFe', 'scaled agile', 'PI planning', 'agile at scale'],
    description: 'Enterprise Agile coaching, training, and transformation services',
    color: '#1976d2',
  },
  DEVOPS: {
    name: 'DevOps & Platform Engineering',
    keywords: ['devops', 'ci/cd', 'pipeline', 'automation', 'kubernetes', 'docker', 'jenkins', 'github actions', 'terraform', 'infrastructure', 'cloud native', 'platform engineering', 'SRE'],
    description: 'DevOps practices, toolchain implementation, and platform engineering',
    color: '#7b1fa2',
  },
  TRAINING: {
    name: 'Training & Certification',
    keywords: ['training', 'certification', 'workshop', 'bootcamp', 'learning', 'upskill', 'CSM', 'CSPO', 'PSM', 'SAFe certification', 'coaching', 'mentoring'],
    description: 'Professional training and certification programs',
    color: '#388e3c',
  },
  ATLASSIAN: {
    name: 'Atlassian Solutions',
    keywords: ['jira', 'confluence', 'bitbucket', 'atlassian', 'jira align', 'jira service management', 'opsgenie', 'trello', 'atlassian cloud', 'data center'],
    description: 'Atlassian product implementation, migration, and optimization',
    color: '#0052cc',
  },
  SERVICENOW: {
    name: 'ServiceNow',
    keywords: ['servicenow', 'itsm', 'itom', 'itbm', 'service portal', 'workflow automation', 'incident management', 'service catalog', 'cmdb'],
    description: 'ServiceNow implementation and ITSM solutions',
    color: '#81b532',
  },
  PRODUCT_MANAGEMENT: {
    name: 'Product Management',
    keywords: ['product management', 'product strategy', 'roadmap', 'product owner', 'mvp', 'product discovery', 'user research', 'product metrics', 'okr'],
    description: 'Product management consulting and coaching',
    color: '#f57c00',
  },
  // AI Services - New Northstar Integrators offerings
  AI_BEHAVIORAL_TRANSFORMATION: {
    name: 'AI Behavioral Transformation',
    keywords: [
      'ai adoption', 'ai resistance', 'change management ai', 'ai readiness', 'ai culture',
      'ai training', 'ai enablement', 'ai skills', 'ai literacy', 'upskilling ai',
      'ai mindset', 'ai skepticism', 'ai fear', 'ai anxiety', 'workforce ai',
      'ai behavioral', 'ai habits', 'human ai', 'ai coaching', 'ai champions',
      'ai change', 'ai transformation culture', 'ai reluctance', 'ai hesitation',
      'copilot adoption', 'chatgpt adoption', 'generative ai adoption'
    ],
    description: 'Accelerating enterprise AI adoption through behavioral change, overcoming resistance, and building AI-ready culture',
    color: '#9c27b0',
  },
  ROVO_AUGMENTED_PRODUCT_DEV: {
    name: 'Rovo Augmented Product Development',
    keywords: [
      'rovo', 'atlassian rovo', 'atlassian ai', 'ai agents', 'ai teammates',
      'ai product development', 'ai powered jira', 'ai confluence', 'ai search',
      'knowledge discovery', 'ai assistant', 'virtual teammates', 'ai workflow',
      'rovo agents', 'rovo search', 'rovo chat', 'atlassian intelligence',
      'ai backlog', 'ai requirements', 'ai user stories', 'ai sprint planning',
      'ai retrospective', 'ai standup', 'ai meeting notes'
    ],
    description: 'Leveraging Atlassian Rovo for AI-augmented product development, knowledge discovery, and virtual AI teammates',
    color: '#0052cc',
  },
  AI_FIRST_OPERATING_MODEL: {
    name: 'AI-First Operating Model Design',
    keywords: [
      'ai operating model', 'ai strategy', 'ai governance', 'ai center of excellence',
      'ai coe', 'enterprise ai', 'ai architecture', 'ai platform', 'ai infrastructure',
      'ai maturity', 'ai roadmap', 'ai framework', 'ai standardization', 'ai policy',
      'responsible ai', 'ai ethics', 'ai risk', 'ai compliance', 'ai security',
      'llm strategy', 'generative ai strategy', 'ai transformation', 'ai at scale',
      'ai operating rhythm', 'ai metrics', 'ai kpi', 'ai roi', 'ai value realization'
    ],
    description: 'Designing enterprise AI-first operating models with governance, CoE establishment, and scalable AI practices',
    color: '#00838f',
  },
};

// Opportunity Category definitions
export const OPPORTUNITY_CATEGORIES = {
  NEW_LOGO: {
    name: 'New Logo',
    description: 'First-time customer acquisition',
    color: '#1976d2',
    indicators: ['new customer', 'first engagement', 'prospect', 'no prior relationship', 'rfp response', 'competitive bid'],
  },
  EXPANSION: {
    name: 'Expansion',
    description: 'Growing existing customer relationship',
    color: '#388e3c',
    indicators: ['additional teams', 'new department', 'scale up', 'more users', 'expand scope', 'phase 2', 'follow-on'],
  },
  RENEWAL: {
    name: 'Renewal',
    description: 'Renewing existing contract',
    color: '#f57c00',
    indicators: ['renewal', 'contract extension', 'continue engagement', 'annual renewal', 'multi-year'],
  },
  UPSELL: {
    name: 'Upsell',
    description: 'Selling additional services to existing customer',
    color: '#7b1fa2',
    indicators: ['additional services', 'premium tier', 'add-on', 'upgrade', 'enhanced package'],
  },
  CROSS_SELL: {
    name: 'Cross-sell',
    description: 'Selling different service lines to existing customer',
    color: '#c2185b',
    indicators: ['new service line', 'different practice', 'complementary services', 'bundled offering'],
  },
};

export interface IntegratorServiceLine {
  name: string;
  relevanceScore: number; // 0-100
  evidence: string[];
  recommendedServices: string[];
  color: string;
}

export interface OpportunityCategory {
  category: string;
  name: string;
  confidence: number; // 0-100
  indicators: string[];
  color: string;
}

export interface IntegratorOpportunityMappingResult {
  serviceLines: IntegratorServiceLine[];
  opportunityCategory: OpportunityCategory;
  strategicFitScore: number;
  strategicFitAnalysis: string;
}

class IntegratorOpportunityMappingService {
  /**
   * Map company research to Northstar Integrators service lines
   */
  async mapServiceLines(
    companyResearch: any,
    gapAnalysis?: any,
    transcriptInsights?: any
  ): Promise<IntegratorServiceLine[]> {
    const serviceLines: IntegratorServiceLine[] = [];

    // Combine all text for keyword analysis
    const allText = this.extractSearchableText(companyResearch, gapAnalysis, transcriptInsights);
    const lowerText = allText.toLowerCase();

    // Score each service line based on keyword matches
    for (const [key, serviceLine] of Object.entries(ENTERPRISE_SERVICE_LINES)) {
      const matches: string[] = [];
      let score = 0;

      for (const keyword of serviceLine.keywords) {
        const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
        const matchCount = (lowerText.match(regex) || []).length;
        if (matchCount > 0) {
          matches.push(`${keyword} (${matchCount}x)`);
          score += Math.min(matchCount * 10, 30); // Cap per-keyword contribution
        }
      }

      // Normalize score to 0-100
      const normalizedScore = Math.min(score, 100);

      if (normalizedScore > 0) {
        serviceLines.push({
          name: serviceLine.name,
          relevanceScore: normalizedScore,
          evidence: matches.slice(0, 5), // Top 5 matches
          recommendedServices: this.getRecommendedServices(key),
          color: serviceLine.color,
        });
      }
    }

    // Sort by relevance score
    serviceLines.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // If no matches, add a default based on general consulting
    if (serviceLines.length === 0) {
      serviceLines.push({
        name: 'Agile Transformation',
        relevanceScore: 30,
        evidence: ['General consulting opportunity'],
        recommendedServices: ['Agile Assessment', 'Discovery Workshop'],
        color: ENTERPRISE_SERVICE_LINES.AGILE_TRANSFORMATION.color,
      });
    }

    return serviceLines;
  }

  /**
   * Detect opportunity category based on deal context
   */
  async detectOpportunityCategory(
    dealContext?: any,
    companyInfo?: any,
    existingRelationship?: boolean
  ): Promise<OpportunityCategory> {
    // Default to New Logo
    let category = 'NEW_LOGO';
    let confidence = 50;
    const indicators: string[] = [];

    // Check for existing relationship indicators
    if (existingRelationship || dealContext?.existingCustomer) {
      // Look for expansion/renewal/upsell signals
      const dealText = JSON.stringify(dealContext || {}).toLowerCase();
      const companyText = JSON.stringify(companyInfo || {}).toLowerCase();
      const combinedText = dealText + ' ' + companyText;

      if (this.containsAny(combinedText, OPPORTUNITY_CATEGORIES.RENEWAL.indicators)) {
        category = 'RENEWAL';
        confidence = 75;
        indicators.push('Renewal signals detected');
      } else if (this.containsAny(combinedText, OPPORTUNITY_CATEGORIES.EXPANSION.indicators)) {
        category = 'EXPANSION';
        confidence = 70;
        indicators.push('Expansion signals detected');
      } else if (this.containsAny(combinedText, OPPORTUNITY_CATEGORIES.UPSELL.indicators)) {
        category = 'UPSELL';
        confidence = 65;
        indicators.push('Upsell opportunity detected');
      } else if (this.containsAny(combinedText, OPPORTUNITY_CATEGORIES.CROSS_SELL.indicators)) {
        category = 'CROSS_SELL';
        confidence = 60;
        indicators.push('Cross-sell opportunity detected');
      } else {
        category = 'EXPANSION';
        confidence = 55;
        indicators.push('Existing customer relationship');
      }
    } else {
      // New logo indicators
      const dealText = JSON.stringify(dealContext || {}).toLowerCase();
      if (this.containsAny(dealText, OPPORTUNITY_CATEGORIES.NEW_LOGO.indicators)) {
        confidence = 80;
        indicators.push('New customer acquisition');
      } else {
        indicators.push('No existing relationship detected');
      }
    }

    const categoryDef = OPPORTUNITY_CATEGORIES[category as keyof typeof OPPORTUNITY_CATEGORIES];

    return {
      category: category.toLowerCase(),
      name: categoryDef.name,
      confidence,
      indicators,
      color: categoryDef.color,
    };
  }

  /**
   * Generate strategic fit analysis using AI
   */
  async generateStrategicFitAnalysis(
    serviceLines: IntegratorServiceLine[],
    opportunityCategory: OpportunityCategory,
    companyName: string,
    companyResearch?: any
  ): Promise<{ score: number; analysis: string }> {
    const openaiService = getOpenAIService();

    // Calculate base score from service line relevance
    const avgRelevance = serviceLines.length > 0
      ? serviceLines.reduce((sum, sl) => sum + sl.relevanceScore, 0) / serviceLines.length
      : 30;

    const baseScore = Math.round((avgRelevance + opportunityCategory.confidence) / 2);

    // Generate AI analysis
    const topServices = serviceLines.slice(0, 3).map(sl => sl.name).join(', ');
    const prompt = `Analyze the strategic fit for Northstar Integrators services with ${companyName}.

Service Lines Identified: ${topServices || 'General consulting'}
Opportunity Type: ${opportunityCategory.name}
Company Context: ${JSON.stringify(companyResearch?.summary || companyResearch?.company_overview || 'Technology company').slice(0, 500)}

Provide a 2-3 sentence strategic fit analysis explaining:
1. Why Northstar Integrators's services are a good fit for this opportunity
2. The key value proposition for the customer
3. Recommended engagement approach

Keep the response concise and actionable.`;

    try {
      const analysis = await openaiService.generateChatCompletion({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        maxTokens: 200,
      });

      return {
        score: baseScore,
        analysis: analysis || 'Strategic fit analysis pending.',
      };
    } catch (error) {
      console.error('Failed to generate strategic fit analysis:', error);
      return {
        score: baseScore,
        analysis: `${opportunityCategory.name} opportunity with strong alignment to ${topServices || 'Northstar Integrators consulting services'}.`,
      };
    }
  }

  /**
   * Full mapping pipeline - maps research to Northstar Integrators opportunity areas
   */
  async generateFullMapping(
    analysisSessionId: string,
    companyName: string,
    companyResearch?: any,
    gapAnalysis?: any,
    transcriptInsights?: any,
    dealContext?: any,
    existingCustomer?: boolean
  ): Promise<IntegratorOpportunityMappingResult> {
    // Map service lines
    const serviceLines = await this.mapServiceLines(companyResearch, gapAnalysis, transcriptInsights);

    // Detect opportunity category
    const opportunityCategory = await this.detectOpportunityCategory(dealContext, companyResearch, existingCustomer);

    // Generate strategic fit analysis
    const { score, analysis } = await this.generateStrategicFitAnalysis(
      serviceLines,
      opportunityCategory,
      companyName,
      companyResearch
    );

    const result: IntegratorOpportunityMappingResult = {
      serviceLines,
      opportunityCategory,
      strategicFitScore: score,
      strategicFitAnalysis: analysis,
    };

    // Save to database
    try {
      await prisma.integratorOpportunityMapping.upsert({
        where: { analysisSessionId },
        create: {
          analysisSessionId,
          serviceLines: serviceLines as any,
          opportunityCategory: opportunityCategory.category,
          strategicFitScore: score,
          strategicFitAnalysis: analysis,
        },
        update: {
          serviceLines: serviceLines as any,
          opportunityCategory: opportunityCategory.category,
          strategicFitScore: score,
          strategicFitAnalysis: analysis,
        },
      });
    } catch (error) {
      console.error('Failed to save Northstar Integrators opportunity mapping:', error);
    }

    return result;
  }

  /**
   * Get mapping by session ID
   */
  async getMappingBySessionId(sessionId: string): Promise<IntegratorOpportunityMappingResult | null> {
    const mapping = await prisma.integratorOpportunityMapping.findUnique({
      where: { analysisSessionId: sessionId },
    });

    if (!mapping) return null;

    const categoryDef = OPPORTUNITY_CATEGORIES[mapping.opportunityCategory.toUpperCase() as keyof typeof OPPORTUNITY_CATEGORIES]
      || OPPORTUNITY_CATEGORIES.NEW_LOGO;

    return {
      serviceLines: mapping.serviceLines as unknown as IntegratorServiceLine[],
      opportunityCategory: {
        category: mapping.opportunityCategory,
        name: categoryDef.name,
        confidence: 70, // Default confidence for stored mappings
        indicators: [],
        color: categoryDef.color,
      },
      strategicFitScore: mapping.strategicFitScore || 50,
      strategicFitAnalysis: mapping.strategicFitAnalysis || '',
    };
  }

  // Helper methods
  private extractSearchableText(companyResearch: any, gapAnalysis: any, transcriptInsights: any): string {
    const parts: string[] = [];

    if (companyResearch) {
      parts.push(JSON.stringify(companyResearch));
    }
    if (gapAnalysis) {
      parts.push(JSON.stringify(gapAnalysis));
    }
    if (transcriptInsights) {
      parts.push(JSON.stringify(transcriptInsights));
    }

    return parts.join(' ');
  }

  private containsAny(text: string, keywords: string[]): boolean {
    return keywords.some(keyword => text.includes(keyword.toLowerCase()));
  }

  private getRecommendedServices(serviceLineKey: string): string[] {
    const recommendations: Record<string, string[]> = {
      AGILE_TRANSFORMATION: ['Agile Assessment', 'Transformation Roadmap', 'Agile Coaching', 'SAFe Implementation'],
      DEVOPS: ['DevOps Assessment', 'CI/CD Pipeline Setup', 'Platform Engineering', 'Cloud Migration'],
      TRAINING: ['CSM Certification', 'SAFe Training', 'Custom Workshops', 'Team Coaching'],
      ATLASSIAN: ['Jira Implementation', 'Cloud Migration', 'Jira Align Setup', 'Atlassian Optimization'],
      SERVICENOW: ['ITSM Implementation', 'ServiceNow Optimization', 'Workflow Automation', 'Portal Development'],
      PRODUCT_MANAGEMENT: ['Product Strategy Workshop', 'Roadmap Development', 'Product Coaching', 'OKR Implementation'],
      // AI Services
      AI_BEHAVIORAL_TRANSFORMATION: [
        'AI Readiness Assessment',
        'AI Adoption Workshop',
        'AI Champions Program',
        'Change Management for AI',
        'AI Skills Training',
      ],
      ROVO_AUGMENTED_PRODUCT_DEV: [
        'Rovo Implementation',
        'AI Agent Configuration',
        'Rovo + Jira Integration',
        'Knowledge Base AI Setup',
        'AI-Powered Workflow Design',
      ],
      AI_FIRST_OPERATING_MODEL: [
        'AI Strategy Workshop',
        'AI CoE Design',
        'AI Governance Framework',
        'AI Maturity Assessment',
        'Enterprise AI Roadmap',
      ],
    };

    return recommendations[serviceLineKey] || ['Discovery Workshop', 'Assessment'];
  }
}

// Singleton instance
let serviceInstance: IntegratorOpportunityMappingService | null = null;

export function getIntegratorOpportunityMappingService(): IntegratorOpportunityMappingService {
  if (!serviceInstance) {
    serviceInstance = new IntegratorOpportunityMappingService();
  }
  return serviceInstance;
}

export default IntegratorOpportunityMappingService;
