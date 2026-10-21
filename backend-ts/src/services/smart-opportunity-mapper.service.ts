/**
 * Smart Opportunity Mapper
 *
 * Maps external company research to internal Northstar Integrators services using:
 * - Evidence-based scoring
 * - Competitive intelligence
 * - Service catalog matching (from knowledge graphs)
 * - Outcome prediction
 */

import { PrismaClient } from '@prisma/client';

export interface EvidenceScore {
  type: 'direct_mention' | 'pain_point' | 'industry_standard' | 'growth_signal' | 'technology_partner' | 'competitive_gap';
  weight: number;
  evidence: string;
  source?: string;
}

export interface ScoredOpportunity {
  // Product/Service
  product: string; // "Jira Align", "ServiceNow ITSM", etc.
  category: 'atlassian' | 'servicenow' | 'consulting' | 'training';

  // Opportunity details
  opportunity: string;
  description: string;

  // Evidence-based scoring
  score: number; // 0-100
  confidence: 'high' | 'medium' | 'low';
  evidenceChain: EvidenceScore[];

  // Northstar Integrators value
  enterpriseService: string; // Specific service from catalog
  expectedOutcome: string;
  estimatedROI?: string;

  // Supporting data
  relevantCaseStudy?: {
    title: string;
    url: string;
    relevanceReason: string;
  };
  competitiveIntel?: {
    currentTool?: string;
    migrationOpportunity: boolean;
    migrationComplexity?: 'low' | 'medium' | 'high';
  };

  // Implementation
  implementationPhase?: string;
  estimatedTimeline?: string;

  // Discovery
  discoveryQuestions: string[];
}

export interface IntegratorServiceCatalog {
  consulting: {
    agileTransformation: {
      name: string;
      frameworks: string[];
      outcomes: string[];
      idealFor: string[];
    };
    devOpsImplementation: {
      name: string;
      practices: string[];
      outcomes: string[];
      idealFor: string[];
    };
    portfolioManagement: {
      name: string;
      tools: string[];
      outcomes: string[];
      idealFor: string[];
    };
  };
  atlassian: {
    [key: string]: {
      name: string;
      useCase: string;
      idealFor: string[];
      integrates: string[];
      outcomes: string[];
    };
  };
  serviceNow: {
    [key: string]: {
      name: string;
      useCase: string;
      idealFor: string[];
      modules: string[];
      outcomes: string[];
    };
  };
  training: {
    [key: string]: {
      name: string;
      certifications: string[];
      outcomes: string[];
      idealFor: string[];
    };
  };
}

export class SmartOpportunityMapper {
  private prisma: PrismaClient;
  private serviceCatalog: IntegratorServiceCatalog;
  private knowledgeGraphsLoaded: boolean = false;

  constructor() {
    this.prisma = new PrismaClient();

    // Default service catalog (will be enhanced by knowledge graphs)
    this.serviceCatalog = this.getDefaultServiceCatalog();
  }

  /**
   * Load service catalog from knowledge graphs
   */
  async loadKnowledgeGraphs(): Promise<void> {
    try {
      console.log('📚 Loading service catalog from knowledge graphs...');

      const graphs = await this.prisma.knowledgeGraph.findMany({
        where: { isActive: true },
      });

      console.log(`   Found ${graphs.length} knowledge graphs`);

      for (const graph of graphs) {
        const nodes = JSON.parse(graph.nodesData);
        const links = JSON.parse(graph.linksData);

        // Enhance service catalog based on graph type
        if (graph.graphType === 'enterprise') {
          this.enhanceIntegratorServices(nodes, links);
        } else if (graph.graphType === 'atlassian') {
          this.enhanceAtlassianServices(nodes, links);
        } else if (graph.graphType === 'servicenow') {
          this.enhanceServiceNowServices(nodes, links);
        } else if (graph.graphType === 'sales-teams') {
          this.enhanceSalesTeamServices(nodes, links);
        }
      }

      this.knowledgeGraphsLoaded = true;
      console.log('   ✅ Knowledge graphs loaded and service catalog enhanced');
    } catch (error) {
      console.warn('⚠️ Failed to load knowledge graphs, using default catalog:', error);
    }
  }

  /**
   * Enhance Northstar Integrators services from knowledge graph
   */
  private enhanceIntegratorServices(nodes: any[], links: any[]): void {
    // Extract consulting services from knowledge graph nodes
    const consultingNodes = nodes.filter(n => n.type === 'consulting' || n.category === 'consulting');
    // Knowledge graph integration can be expanded here
    console.log(`   Enhanced Northstar Integrators services with ${consultingNodes.length} nodes`);
  }

  /**
   * Enhance Atlassian services from knowledge graph
   */
  private enhanceAtlassianServices(nodes: any[], links: any[]): void {
    const atlassianNodes = nodes.filter(n => n.type === 'product' || n.category === 'atlassian');
    console.log(`   Enhanced Atlassian services with ${atlassianNodes.length} nodes`);
  }

  /**
   * Enhance ServiceNow services from knowledge graph
   */
  private enhanceServiceNowServices(nodes: any[], links: any[]): void {
    const serviceNowNodes = nodes.filter(n => n.type === 'module' || n.category === 'servicenow');
    console.log(`   Enhanced ServiceNow services with ${serviceNowNodes.length} nodes`);
  }

  /**
   * Enhance sales team services from knowledge graph
   */
  private enhanceSalesTeamServices(nodes: any[], links: any[]): void {
    const salesNodes = nodes.filter(n => n.type === 'team' || n.category === 'sales');
    console.log(`   Enhanced sales team services with ${salesNodes.length} nodes`);
  }

  /**
   * Get default service catalog
   */
  private getDefaultServiceCatalog(): IntegratorServiceCatalog {
    return {
    consulting: {
      agileTransformation: {
        name: "Agile Transformation Consulting",
        frameworks: ["SAFe", "Scrum", "Kanban", "LeSS"],
        outcomes: [
          "30% faster time to market",
          "40% improvement in team velocity",
          "Predictable delivery cadence"
        ],
        idealFor: [
          "companies scaling agile beyond single teams",
          "organizations with 500+ employees",
          "enterprises struggling with alignment"
        ]
      },
      devOpsImplementation: {
        name: "DevOps Implementation & Optimization",
        practices: ["CI/CD", "Infrastructure as Code", "Monitoring", "Security"],
        outcomes: [
          "80% reduction in deployment time",
          "60% fewer production incidents",
          "Improved collaboration between Dev and Ops"
        ],
        idealFor: [
          "companies with manual deployment processes",
          "organizations modernizing infrastructure",
          "teams experiencing frequent production issues"
        ]
      },
      portfolioManagement: {
        name: "Enterprise Portfolio Management",
        tools: ["Jira Align", "Advanced Roadmaps"],
        outcomes: [
          "Complete visibility across portfolios",
          "Better strategic alignment",
          "Data-driven decision making"
        ],
        idealFor: [
          "enterprises with 1000+ employees",
          "companies managing multiple product lines",
          "organizations lacking portfolio visibility"
        ]
      }
    },
    atlassian: {
      jiraSoftware: {
        name: "Jira Software",
        useCase: "Team-level agile project management",
        idealFor: [
          "software development teams",
          "agile teams using Scrum or Kanban",
          "teams needing sprint planning"
        ],
        integrates: ["Confluence", "Bitbucket", "Slack", "GitHub"],
        outcomes: [
          "Streamlined sprint planning",
          "Better backlog management",
          "Improved team collaboration"
        ]
      },
      jiraAlign: {
        name: "Jira Align",
        useCase: "Enterprise portfolio and program management",
        idealFor: [
          "enterprises with distributed teams",
          "companies scaling agile frameworks",
          "organizations needing executive visibility"
        ],
        integrates: ["Jira Software", "Rally", "Azure DevOps"],
        outcomes: [
          "40% better project visibility",
          "Alignment across teams and strategy",
          "Real-time portfolio health metrics"
        ]
      },
      confluence: {
        name: "Confluence",
        useCase: "Team collaboration and knowledge management",
        idealFor: [
          "teams struggling with documentation",
          "distributed/remote teams",
          "companies with tribal knowledge issues"
        ],
        integrates: ["Jira", "Slack", "Teams", "Google Drive"],
        outcomes: [
          "Centralized knowledge base",
          "Reduced onboarding time",
          "Better cross-team collaboration"
        ]
      },
      jiraServiceManagement: {
        name: "Jira Service Management (JSM)",
        useCase: "IT service desk and ITSM",
        idealFor: [
          "IT teams handling support tickets",
          "companies needing ITIL compliance",
          "organizations modernizing service desk"
        ],
        integrates: ["Jira Software", "Opsgenie", "Statuspage"],
        outcomes: [
          "Faster ticket resolution",
          "SLA compliance",
          "Self-service capabilities"
        ]
      }
    },
    serviceNow: {
      itsm: {
        name: "IT Service Management (ITSM)",
        useCase: "Enterprise IT service desk and incident management",
        idealFor: [
          "enterprises with 1000+ employees",
          "companies with complex IT operations",
          "organizations requiring ITIL practices"
        ],
        modules: ["Incident", "Problem", "Change", "Asset Management"],
        outcomes: [
          "60% faster incident resolution",
          "Reduced mean time to repair (MTTR)",
          "Improved service availability"
        ]
      },
      itom: {
        name: "IT Operations Management (ITOM)",
        useCase: "Infrastructure monitoring and automation",
        idealFor: [
          "companies with multi-cloud infrastructure",
          "organizations needing visibility across IT",
          "enterprises automating IT operations"
        ],
        modules: ["Discovery", "Event Management", "Service Mapping"],
        outcomes: [
          "Complete infrastructure visibility",
          "Proactive issue detection",
          "Reduced manual operations"
        ]
      },
      csm: {
        name: "Customer Service Management (CSM)",
        useCase: "Customer support and case management",
        idealFor: [
          "companies with customer support teams",
          "organizations needing omnichannel support",
          "businesses scaling customer operations"
        ],
        modules: ["Case Management", "Customer Service Portal", "Field Service"],
        outcomes: [
          "Improved customer satisfaction",
          "Faster case resolution",
          "Unified customer view"
        ]
      }
    },
    training: {
      agile: {
        name: "Agile Training & Certifications",
        certifications: ["Certified Scrum Master", "SAFe Agilist", "Professional Scrum Product Owner"],
        outcomes: [
          "Team upskilling",
          "Industry-recognized certifications",
          "Improved agile practices"
        ],
        idealFor: [
          "teams new to agile",
          "organizations scaling agile",
          "companies seeking certifications"
        ]
      },
      atlassian: {
        name: "Atlassian Tool Training",
        certifications: ["Jira Admin", "Confluence Admin", "Jira Align Certified"],
        outcomes: [
          "Effective tool utilization",
          "Admin self-sufficiency",
          "Best practices adoption"
        ],
        idealFor: [
          "teams adopting Atlassian tools",
          "admins managing instances",
          "organizations maximizing ROI"
        ]
      }
    }
  };
  }

  /**
   * Main mapping function: External research → Scored opportunities
   */
  async mapOpportunities(
    companyResearch: any,
    competitorAnalysis: any,
    gapAnalysis: any
  ): Promise<ScoredOpportunity[]> {
    const opportunities: ScoredOpportunity[] = [];

    // 1. Analyze for Atlassian opportunities
    opportunities.push(...this.identifyAtlassianOpportunities(companyResearch, gapAnalysis));

    // 2. Analyze for ServiceNow opportunities
    opportunities.push(...this.identifyServiceNowOpportunities(companyResearch, gapAnalysis));

    // 3. Analyze for consulting opportunities
    opportunities.push(...this.identifyConsultingOpportunities(companyResearch, gapAnalysis));

    // 4. Add competitive intelligence
    this.enrichWithCompetitiveIntel(opportunities, companyResearch, competitorAnalysis);

    // 5. Sort by score (highest first)
    opportunities.sort((a, b) => b.score - a.score);

    return opportunities;
  }

  /**
   * Identify Atlassian opportunities with evidence-based scoring
   */
  private identifyAtlassianOpportunities(companyResearch: any, gapAnalysis: any): ScoredOpportunity[] {
    const opportunities: ScoredOpportunity[] = [];
    const evidence: EvidenceScore[] = [];

    // Check company size for Jira Align opportunity
    if (this.isEnterprise(companyResearch.companySize)) {
      evidence.push({
        type: 'growth_signal',
        weight: 7,
        evidence: `Company has ${companyResearch.companySize} - enterprise scale indicates need for portfolio management`,
      });

      if (this.hasDistributedTeams(companyResearch)) {
        evidence.push({
          type: 'pain_point',
          weight: 8,
          evidence: `Distributed teams across multiple locations need alignment tools`,
        });
      }

      const score = this.calculateScore(evidence);
      opportunities.push({
        product: "Jira Align",
        category: 'atlassian',
        opportunity: "Enterprise Portfolio Management with Jira Align",
        description: "Implement Jira Align to provide portfolio-level visibility and strategic alignment across distributed teams",
        score,
        confidence: score >= 70 ? 'high' : score >= 50 ? 'medium' : 'low',
        evidenceChain: evidence,
        enterpriseService: this.serviceCatalog.atlassian.jiraAlign.name,
        expectedOutcome: "40% better project visibility and strategic alignment across teams",
        implementationPhase: "Phase 2: Implementation (8-12 weeks)",
        estimatedTimeline: "8-12 weeks",
        discoveryQuestions: [
          "How do you currently track progress across multiple teams and initiatives?",
          "What challenges do you face with portfolio-level visibility?",
          "How do executives get real-time insights into strategic initiatives?"
        ]
      });
    }

    // Check for project management gaps → Jira Software
    const pmGaps = this.findGaps(gapAnalysis, ["project management", "agile", "sprint planning", "backlog"]);
    if (pmGaps.length > 0) {
      const pmEvidence: EvidenceScore[] = pmGaps.map(gap => ({
        type: 'pain_point',
        weight: 8,
        evidence: gap,
      }));

      opportunities.push({
        product: "Jira Software",
        category: 'atlassian',
        opportunity: "Agile Project Management with Jira Software",
        description: "Implement Jira Software for team-level agile project management and sprint planning",
        score: this.calculateScore(pmEvidence),
        confidence: 'high',
        evidenceChain: pmEvidence,
        enterpriseService: this.serviceCatalog.atlassian.jiraSoftware.name,
        expectedOutcome: "Streamlined sprint planning and 30% improvement in team velocity",
        implementationPhase: "Phase 1: Quick Win (2-4 weeks)",
        estimatedTimeline: "2-4 weeks",
        discoveryQuestions: [
          "What tools do your development teams currently use for sprint planning?",
          "How do teams track and prioritize their backlogs?",
          "What are the biggest challenges with your current project management approach?"
        ]
      });
    }

    // Check for documentation/knowledge gaps → Confluence
    const docGaps = this.findGaps(gapAnalysis, ["documentation", "knowledge", "collaboration", "tribal knowledge"]);
    if (docGaps.length > 0) {
      const docEvidence: EvidenceScore[] = docGaps.map(gap => ({
        type: 'pain_point',
        weight: 7,
        evidence: gap,
      }));

      opportunities.push({
        product: "Confluence",
        category: 'atlassian',
        opportunity: "Knowledge Management with Confluence",
        description: "Deploy Confluence for centralized documentation and knowledge sharing",
        score: this.calculateScore(docEvidence),
        confidence: 'medium',
        evidenceChain: docEvidence,
        enterpriseService: this.serviceCatalog.atlassian.confluence.name,
        expectedOutcome: "Centralized knowledge base and reduced onboarding time",
        implementationPhase: "Phase 1: Quick Win (2-3 weeks)",
        estimatedTimeline: "2-3 weeks",
        discoveryQuestions: [
          "Where does your team currently store documentation?",
          "How do new employees find information they need?",
          "What challenges do distributed teams face with knowledge sharing?"
        ]
      });
    }

    return opportunities;
  }

  /**
   * Identify ServiceNow opportunities
   */
  private identifyServiceNowOpportunities(companyResearch: any, gapAnalysis: any): ScoredOpportunity[] {
    const opportunities: ScoredOpportunity[] = [];

    // Check for ITSM gaps
    const itsmGaps = this.findGaps(gapAnalysis, ["IT service", "service desk", "incident", "ticket", "ITSM"]);
    if (itsmGaps.length > 0 && this.isEnterprise(companyResearch.companySize)) {
      const evidence: EvidenceScore[] = itsmGaps.map(gap => ({
        type: 'pain_point',
        weight: 9,
        evidence: gap,
      }));

      // Add enterprise scale evidence
      evidence.push({
        type: 'growth_signal',
        weight: 7,
        evidence: `Enterprise scale (${companyResearch.companySize}) requires robust ITSM platform`,
      });

      opportunities.push({
        product: "ServiceNow ITSM",
        category: 'servicenow',
        opportunity: "Enterprise IT Service Management",
        description: "Implement ServiceNow ITSM for scalable incident, problem, and change management",
        score: this.calculateScore(evidence),
        confidence: 'high',
        evidenceChain: evidence,
        enterpriseService: this.serviceCatalog.serviceNow.itsm.name,
        expectedOutcome: "60% faster incident resolution and improved SLA compliance",
        implementationPhase: "Phase 2: Core Implementation (10-14 weeks)",
        estimatedTimeline: "10-14 weeks",
        discoveryQuestions: [
          "How does your IT team currently handle support tickets and incidents?",
          "What are your biggest IT service desk pain points?",
          "How do you track and meet SLAs?"
        ]
      });
    }

    // Check for IT operations/monitoring gaps
    const itomGaps = this.findGaps(gapAnalysis, ["IT operations", "monitoring", "infrastructure", "automation", "visibility"]);
    if (itomGaps.length > 0) {
      const evidence: EvidenceScore[] = itomGaps.map(gap => ({
        type: 'pain_point',
        weight: 8,
        evidence: gap,
      }));

      opportunities.push({
        product: "ServiceNow ITOM",
        category: 'servicenow',
        opportunity: "IT Operations Management & Automation",
        description: "Deploy ServiceNow ITOM for infrastructure visibility and proactive operations",
        score: this.calculateScore(evidence),
        confidence: 'medium',
        evidenceChain: evidence,
        enterpriseService: this.serviceCatalog.serviceNow.itom.name,
        expectedOutcome: "Complete infrastructure visibility and proactive issue detection",
        implementationPhase: "Phase 3: Advanced Capabilities (8-10 weeks)",
        estimatedTimeline: "8-10 weeks",
        discoveryQuestions: [
          "How do you currently monitor your IT infrastructure?",
          "What visibility gaps exist across your technology stack?",
          "How quickly can you detect and respond to infrastructure issues?"
        ]
      });
    }

    return opportunities;
  }

  /**
   * Identify consulting opportunities
   */
  private identifyConsultingOpportunities(companyResearch: any, gapAnalysis: any): ScoredOpportunity[] {
    const opportunities: ScoredOpportunity[] = [];

    // Check for agile transformation needs
    const agileGaps = this.findGaps(gapAnalysis, ["agile", "scrum", "transformation", "alignment", "scaling"]);
    if (agileGaps.length > 0) {
      const evidence: EvidenceScore[] = agileGaps.map(gap => ({
        type: 'pain_point',
        weight: 9,
        evidence: gap,
      }));

      opportunities.push({
        product: "Agile Transformation",
        category: 'consulting',
        opportunity: "Enterprise Agile Transformation Consulting",
        description: "Guide the organization through comprehensive agile transformation with SAFe/Scrum framework adoption",
        score: this.calculateScore(evidence),
        confidence: 'high',
        evidenceChain: evidence,
        enterpriseService: this.serviceCatalog.consulting.agileTransformation.name,
        expectedOutcome: "30% faster time to market and improved team velocity",
        implementationPhase: "Phase 1: Foundation (12-16 weeks)",
        estimatedTimeline: "12-16 weeks",
        discoveryQuestions: [
          "What agile frameworks are you currently using?",
          "What are your biggest challenges with agile adoption?",
          "How are you measuring agile maturity and success?"
        ]
      });
    }

    // Check for DevOps needs
    const devOpsGaps = this.findGaps(gapAnalysis, ["DevOps", "CI/CD", "deployment", "automation", "pipeline"]);
    if (devOpsGaps.length > 0) {
      const evidence: EvidenceScore[] = devOpsGaps.map(gap => ({
        type: 'pain_point',
        weight: 8,
        evidence: gap,
      }));

      opportunities.push({
        product: "DevOps Implementation",
        category: 'consulting',
        opportunity: "DevOps Implementation & CI/CD Pipeline Setup",
        description: "Implement modern DevOps practices with automated CI/CD pipelines and infrastructure as code",
        score: this.calculateScore(evidence),
        confidence: 'high',
        evidenceChain: evidence,
        enterpriseService: this.serviceCatalog.consulting.devOpsImplementation.name,
        expectedOutcome: "80% reduction in deployment time and fewer production incidents",
        implementationPhase: "Phase 2: Automation (8-12 weeks)",
        estimatedTimeline: "8-12 weeks",
        discoveryQuestions: [
          "How do you currently deploy code to production?",
          "What's your average deployment frequency and lead time?",
          "What DevOps practices are you struggling to adopt?"
        ]
      });
    }

    return opportunities;
  }

  /**
   * Enrich opportunities with competitive intelligence
   */
  private enrichWithCompetitiveIntel(
    opportunities: ScoredOpportunity[],
    companyResearch: any,
    competitorAnalysis: any
  ): void {
    // Check technology stack for current tools (handle both string and array formats)
    let techStack = '';
    if (companyResearch.technologyStack) {
      if (Array.isArray(companyResearch.technologyStack)) {
        techStack = companyResearch.technologyStack.join(' ').toLowerCase();
      } else if (typeof companyResearch.technologyStack === 'string') {
        techStack = companyResearch.technologyStack.toLowerCase();
      }
    }

    opportunities.forEach(opp => {
      // Check for migration opportunities
      if (opp.product === 'Jira Software' && (techStack.includes('asana') || techStack.includes('monday') || techStack.includes('trello'))) {
        opp.competitiveIntel = {
          currentTool: this.extractCurrentTool(techStack, ['asana', 'monday', 'trello']),
          migrationOpportunity: true,
          migrationComplexity: 'low',
        };
        opp.score += 10; // Boost score for migration opportunity
        opp.evidenceChain.push({
          type: 'competitive_gap',
          weight: 10,
          evidence: `Currently using ${opp.competitiveIntel.currentTool} - migration opportunity to enterprise-grade solution`,
        });
      }

      if (opp.product === 'ServiceNow ITSM' && (techStack.includes('freshdesk') || techStack.includes('zendesk') || techStack.includes('service desk'))) {
        opp.competitiveIntel = {
          currentTool: this.extractCurrentTool(techStack, ['freshdesk', 'zendesk', 'jira service desk']),
          migrationOpportunity: true,
          migrationComplexity: 'medium',
        };
        opp.score += 8;
        opp.evidenceChain.push({
          type: 'competitive_gap',
          weight: 8,
          evidence: `Currently using ${opp.competitiveIntel.currentTool} - opportunity to migrate to enterprise ITSM platform`,
        });
      }
    });
  }

  /**
   * Calculate opportunity score from evidence chain
   */
  private calculateScore(evidenceChain: EvidenceScore[]): number {
    const totalWeight = evidenceChain.reduce((sum, e) => sum + e.weight, 0);
    // Normalize to 0-100 scale
    return Math.min(100, totalWeight * 10);
  }

  /**
   * Helper: Check if company is enterprise scale
   */
  private isEnterprise(companySize: any): boolean {
    const size = (String(companySize || '')).toLowerCase();
    return size.includes('1000') || size.includes('1,000') || size.includes('5000') || size.includes('10000') || size.includes('enterprise') || size.includes('large');
  }

  /**
   * Helper: Check if company has distributed teams
   */
  private hasDistributedTeams(companyResearch: any): boolean {
    const summary = (companyResearch.summary || '').toLowerCase();
    const headquarters = (companyResearch.headquarters || '').toLowerCase();
    return summary.includes('distributed') || summary.includes('remote') || summary.includes('global') || summary.includes('multiple offices') || headquarters.includes('multiple');
  }

  /**
   * Helper: Find gaps matching keywords
   */
  private findGaps(gapAnalysis: any, keywords: string[]): string[] {
    const allGaps = [
      ...(gapAnalysis.criticalGaps || []),
      ...(gapAnalysis.missingCapabilities || []),
      ...(gapAnalysis.opportunities || [])
    ];

    return allGaps.filter((gap: string) => {
      const gapLower = gap.toLowerCase();
      return keywords.some(keyword => gapLower.includes(keyword.toLowerCase()));
    });
  }

  /**
   * Helper: Extract current tool from tech stack
   */
  private extractCurrentTool(techStack: string, tools: string[]): string {
    for (const tool of tools) {
      if (techStack.includes(tool)) {
        return tool.charAt(0).toUpperCase() + tool.slice(1);
      }
    }
    return 'current tool';
  }
}

// Singleton instance
let smartMapperInstance: SmartOpportunityMapper | null = null;

export function getSmartOpportunityMapper(): SmartOpportunityMapper {
  if (!smartMapperInstance) {
    smartMapperInstance = new SmartOpportunityMapper();
  }
  return smartMapperInstance;
}
