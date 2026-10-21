import { getPrismaClient } from '../config/database';
import { getOpenAIService } from './openai.service';
import { AppError } from '../middleware/errorHandler';
import {
  JIRA_CLOUD_CAPABILITIES,
  CONFLUENCE_CLOUD_CAPABILITIES,
  PLATFORM_CLOUD_CAPABILITIES,
  DC_PAIN_POINTS,
  MIGRATION_PATHS,
  CLOUD_PRICING_TIERS,
  BASE_QUESTIONNAIRE_QUESTIONS,
  QUESTIONNAIRE_CATEGORIES,
  getAllCloudCapabilities,
  getCloudOnlyCapabilities,
  searchCapabilities,
  CloudCapability,
  DCPainPoint,
  MigrationPath,
  BaseQuestion
} from '../data/atlassian-knowledge-base';

const prisma = getPrismaClient();

// ============================================================================
// TYPES
// ============================================================================

export interface QuestionnaireQuestion extends BaseQuestion {
  followUp?: {
    condition: { questionId: string; value: any };
    questions: QuestionnaireQuestion[];
  };
}

export interface QuestionnaireResponses {
  [questionId: string]: any;
}

export interface AssessmentGap {
  area: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  cloudSolution: string;
  affectedUsers?: string;
}

export interface AssessmentRecommendation {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  category: string;
  relatedCapabilities: string[];
  estimatedImpact: string;
}

export interface MigrationScoreBreakdown {
  infrastructureReadiness: number;
  featureCompatibility: number;
  securityCompliance: number;
  businessUrgency: number;
  complexityRisk: number;
}

export interface AssessmentAnalysis {
  summary: string;
  migrationScore: number;
  migrationScoreBreakdown: MigrationScoreBreakdown;
  urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
  urgencyReason: string;
  gaps: AssessmentGap[];
  recommendations: AssessmentRecommendation[];
  matchedCapabilities: CloudCapability[];
  relevantMigrationPaths: MigrationPath[];
  estimatedTimeline: string;
  riskFactors: string[];
  nextSteps: string[];
}

export interface AssessmentSummary {
  id: string;
  companyName: string;
  status: string;
  migrationScore: number | null;
  urgencyLevel: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

class AtlassianAssessmentService {
  /**
   * Create a new assessment for a company
   */
  async createAssessment(params: {
    companyName: string;
    meetingId?: string;
    createdBy?: string;
  }): Promise<{ id: string }> {
    const assessment = await prisma.atlassianAssessment.create({
      data: {
        companyName: params.companyName,
        meetingId: params.meetingId,
        createdBy: params.createdBy,
        status: 'pending'
      }
    });

    return { id: assessment.id };
  }

  /**
   * Get assessment by ID
   */
  async getAssessment(id: string) {
    const assessment = await prisma.atlassianAssessment.findUnique({
      where: { id },
      include: {
        meeting: {
          select: {
            meetingId: true,
            title: true,
            meetingDate: true
          }
        }
      }
    });

    if (!assessment) {
      throw new AppError('Assessment not found', 404);
    }

    return assessment;
  }

  /**
   * List all assessments with optional filters
   */
  async listAssessments(params?: {
    companyName?: string;
    meetingId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ assessments: AssessmentSummary[]; total: number }> {
    const where: any = {};

    if (params?.companyName) {
      where.companyName = { contains: params.companyName, mode: 'insensitive' };
    }
    if (params?.meetingId) {
      where.meetingId = params.meetingId;
    }
    if (params?.status) {
      where.status = params.status;
    }

    const [assessments, total] = await Promise.all([
      prisma.atlassianAssessment.findMany({
        where,
        select: {
          id: true,
          companyName: true,
          status: true,
          migrationScore: true,
          urgencyLevel: true,
          createdAt: true,
          updatedAt: true,
          isSaved: true,
        },
        orderBy: { createdAt: 'desc' },
        take: params?.limit || 50,
        skip: params?.offset || 0
      }),
      prisma.atlassianAssessment.count({ where })
    ]);

    return { assessments, total };
  }

  /**
   * Generate a dynamic questionnaire based on company context
   */
  async generateQuestionnaire(params: {
    assessmentId: string;
    companyName: string;
    industry?: string;
    existingContext?: string;
  }): Promise<QuestionnaireQuestion[]> {
    // Start with base questions
    let questions: QuestionnaireQuestion[] = [...BASE_QUESTIONNAIRE_QUESTIONS];

    // If we have additional context, use AI to generate follow-up questions
    if (params.industry || params.existingContext) {
      try {
        const openai = getOpenAIService();
        const aiQuestions = await openai.generateStructuredCompletion<{ additionalQuestions: QuestionnaireQuestion[] }>(
          [
            {
              role: 'system',
              content: `You are an Atlassian Cloud migration expert. Based on the company context, generate 3-5 additional relevant questions for a migration assessment questionnaire. Return JSON in this format:
{
  "additionalQuestions": [
    {
      "id": "unique_id",
      "category": "environment|usage|painPoints|requirements|timeline",
      "question": "The question text",
      "type": "text|textarea|select|multiselect",
      "options": ["option1", "option2"] // for select/multiselect only
      "required": false
    }
  ]
}`
            },
            {
              role: 'user',
              content: `Company: ${params.companyName}
Industry: ${params.industry || 'Unknown'}
Additional Context: ${params.existingContext || 'None'}

Generate additional relevant questions for their Atlassian Cloud migration assessment.`
            }
          ],
          undefined,
          0.7
        );

        if (aiQuestions.additionalQuestions?.length > 0) {
          questions = [...questions, ...aiQuestions.additionalQuestions];
        }
      } catch (error) {
        console.error('Failed to generate AI questions:', error);
        // Continue with base questions only
      }
    }

    // Update assessment status
    await prisma.atlassianAssessment.update({
      where: { id: params.assessmentId },
      data: { status: 'questionnaire' }
    });

    return questions;
  }

  /**
   * Save questionnaire responses
   */
  async saveQuestionnaireResponses(assessmentId: string, responses: QuestionnaireResponses): Promise<void> {
    await prisma.atlassianAssessment.update({
      where: { id: assessmentId },
      data: {
        questionnaireResponses: responses as any,
        status: 'questionnaire'
      }
    });
  }

  /**
   * Analyze questionnaire responses and generate assessment report
   */
  async analyzeResponses(assessmentId: string): Promise<AssessmentAnalysis> {
    const assessment = await prisma.atlassianAssessment.findUnique({
      where: { id: assessmentId }
    });

    if (!assessment) {
      throw new AppError('Assessment not found', 404);
    }

    if (!assessment.questionnaireResponses) {
      throw new Error('No questionnaire responses found');
    }

    const responses = assessment.questionnaireResponses as QuestionnaireResponses;

    // Update status to analyzing
    await prisma.atlassianAssessment.update({
      where: { id: assessmentId },
      data: { status: 'analyzing' }
    });

    try {
      // 1. Calculate migration score based on responses
      const scoreBreakdown = this.calculateMigrationScoreBreakdown(responses);
      const migrationScore = Math.round(
        (scoreBreakdown.infrastructureReadiness * 0.2) +
        (scoreBreakdown.featureCompatibility * 0.2) +
        (scoreBreakdown.securityCompliance * 0.15) +
        (scoreBreakdown.businessUrgency * 0.25) +
        ((100 - scoreBreakdown.complexityRisk) * 0.2)
      );

      // 2. Determine urgency level
      const { urgencyLevel, urgencyReason } = this.determineUrgency(responses, migrationScore);

      // 3. Identify gaps
      const gaps = this.identifyGaps(responses);

      // 4. Match Cloud capabilities
      const matchedCapabilities = this.matchCapabilities(responses);

      // 5. Find relevant migration paths
      const relevantMigrationPaths = this.findRelevantMigrationPaths(responses);

      // 6. Generate AI-powered recommendations
      const recommendations = await this.generateRecommendations(
        assessment.companyName,
        responses,
        gaps,
        matchedCapabilities
      );

      // 7. Estimate timeline
      const estimatedTimeline = this.estimateTimeline(responses, gaps.length);

      // 8. Identify risk factors
      const riskFactors = this.identifyRiskFactors(responses);

      // 9. Generate next steps
      const nextSteps = this.generateNextSteps(urgencyLevel, responses);

      // 10. Generate AI summary
      const summary = await this.generateSummary(
        assessment.companyName,
        responses,
        migrationScore,
        urgencyLevel,
        gaps,
        recommendations
      );

      const analysis: AssessmentAnalysis = {
        summary,
        migrationScore,
        migrationScoreBreakdown: scoreBreakdown,
        urgencyLevel,
        urgencyReason,
        gaps,
        recommendations,
        matchedCapabilities,
        relevantMigrationPaths,
        estimatedTimeline,
        riskFactors,
        nextSteps
      };

      // Save analysis to database
      await prisma.atlassianAssessment.update({
        where: { id: assessmentId },
        data: {
          analysisResult: analysis as any,
          migrationScore,
          urgencyLevel,
          gaps: gaps as any,
          recommendations: recommendations as any,
          cloudCapabilities: matchedCapabilities.map(c => c.name) as any,
          status: 'completed'
        }
      });

      return analysis;
    } catch (error) {
      // Update status to failed
      await prisma.atlassianAssessment.update({
        where: { id: assessmentId },
        data: {
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Analysis failed'
        }
      });
      throw error;
    }
  }

  /**
   * Calculate migration score breakdown from responses
   */
  private calculateMigrationScoreBreakdown(responses: QuestionnaireResponses): MigrationScoreBreakdown {
    let infrastructureReadiness = 50;
    let featureCompatibility = 50;
    let securityCompliance = 50;
    let businessUrgency = 50;
    let complexityRisk = 50;

    // Infrastructure readiness factors
    const deploymentType = responses.deployment_type;
    if (deploymentType === 'Server (single node)') {
      infrastructureReadiness += 20; // Easier to migrate
    } else if (deploymentType === 'Data Center (clustered)') {
      infrastructureReadiness += 10;
      complexityRisk += 10;
    }

    const userCount = responses.user_count;
    if (userCount === '1-50' || userCount === '51-200') {
      infrastructureReadiness += 15;
    } else if (userCount === '5000+') {
      complexityRisk += 20;
    }

    // Feature compatibility factors
    const automationUsage = responses.automation_usage;
    if (automationUsage === 'Custom Groovy scripts throughout') {
      featureCompatibility -= 20;
      complexityRisk += 25;
    } else if (automationUsage === 'Heavy automation reliance') {
      complexityRisk += 15;
    } else if (automationUsage === 'None/Minimal') {
      featureCompatibility += 20;
    }

    const integrationCount = responses.integration_count;
    if (integrationCount === '15+') {
      complexityRisk += 20;
    } else if (integrationCount === 'None' || integrationCount === '1-5') {
      featureCompatibility += 15;
    }

    // Security compliance factors
    const dataResidency = responses.data_residency_required;
    if (dataResidency === 'On-premise only acceptable') {
      securityCompliance = 10; // Major blocker
    } else if (dataResidency?.includes('required')) {
      securityCompliance += 10; // Cloud supports this
    }

    const ssoRequirements = responses.sso_requirements || [];
    if (ssoRequirements.length > 0 && !ssoRequirements.includes('None specific')) {
      securityCompliance += 15; // Cloud has strong SSO
    }

    // Business urgency factors
    const migrationUrgency = responses.migration_urgency;
    if (migrationUrgency === 'Critical - need to migrate ASAP') {
      businessUrgency = 100;
    } else if (migrationUrgency === 'High - within 6 months') {
      businessUrgency = 80;
    } else if (migrationUrgency === 'Medium - within 12 months') {
      businessUrgency = 60;
    } else if (migrationUrgency === 'Low - exploring options') {
      businessUrgency = 40;
    } else {
      businessUrgency = 20;
    }

    // Adjust for current challenges
    const challenges = responses.current_challenges || [];
    if (challenges.includes('Security patching urgency')) {
      businessUrgency += 15;
      securityCompliance -= 10;
    }
    if (challenges.includes('Infrastructure management overhead')) {
      businessUrgency += 10;
    }
    if (challenges.includes('Upgrade complexity/downtime')) {
      businessUrgency += 10;
    }

    // Normalize scores to 0-100
    return {
      infrastructureReadiness: Math.max(0, Math.min(100, infrastructureReadiness)),
      featureCompatibility: Math.max(0, Math.min(100, featureCompatibility)),
      securityCompliance: Math.max(0, Math.min(100, securityCompliance)),
      businessUrgency: Math.max(0, Math.min(100, businessUrgency)),
      complexityRisk: Math.max(0, Math.min(100, complexityRisk))
    };
  }

  /**
   * Determine urgency level based on responses
   */
  private determineUrgency(responses: QuestionnaireResponses, score: number): {
    urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
    urgencyReason: string;
  } {
    const challenges = responses.current_challenges || [];
    const urgencyResponse = responses.migration_urgency;
    const deploymentType = responses.deployment_type;

    // Critical indicators
    if (
      challenges.includes('Security patching urgency') ||
      urgencyResponse === 'Critical - need to migrate ASAP' ||
      (deploymentType?.includes('Server') && challenges.includes('End of Server support'))
    ) {
      return {
        urgencyLevel: 'critical',
        urgencyReason: 'Critical security or support concerns require immediate action'
      };
    }

    // High urgency
    if (
      urgencyResponse === 'High - within 6 months' ||
      score >= 70 ||
      challenges.length >= 4
    ) {
      return {
        urgencyLevel: 'high',
        urgencyReason: 'Multiple pain points and business drivers indicate strong migration need'
      };
    }

    // Medium urgency
    if (
      urgencyResponse === 'Medium - within 12 months' ||
      score >= 50 ||
      challenges.length >= 2
    ) {
      return {
        urgencyLevel: 'medium',
        urgencyReason: 'Good candidate for migration with moderate business drivers'
      };
    }

    // Low urgency
    return {
      urgencyLevel: 'low',
      urgencyReason: 'Migration would provide benefits but no immediate urgency'
    };
  }

  /**
   * Identify gaps between current state and Cloud capabilities
   */
  private identifyGaps(responses: QuestionnaireResponses): AssessmentGap[] {
    const gaps: AssessmentGap[] = [];
    const challenges = responses.current_challenges || [];

    // Map challenges to gaps
    const challengeToGap: Record<string, Partial<AssessmentGap>> = {
      'Infrastructure management overhead': {
        area: 'Infrastructure',
        description: 'Significant IT resources spent on server management, patching, and monitoring',
        severity: 'high',
        cloudSolution: 'Fully managed Cloud infrastructure with automatic updates and 24/7 monitoring'
      },
      'Upgrade complexity/downtime': {
        area: 'Maintenance',
        description: 'Upgrades require planned downtime and extensive testing',
        severity: 'medium',
        cloudSolution: 'Zero-downtime continuous updates with automatic rollout'
      },
      'Security patching urgency': {
        area: 'Security',
        description: 'Manual security patches must be applied quickly to prevent vulnerabilities',
        severity: 'critical',
        cloudSolution: 'Automatic security patches applied by Atlassian with SOC2/ISO 27001 compliance'
      },
      'Scaling issues': {
        area: 'Performance',
        description: 'Difficulty scaling infrastructure to meet demand',
        severity: 'medium',
        cloudSolution: 'Elastic auto-scaling with global CDN and optimized performance'
      },
      'Remote access challenges': {
        area: 'Accessibility',
        description: 'Complex setup required for secure remote access',
        severity: 'high',
        cloudSolution: 'Secure cloud access from anywhere with SSO, IP allowlisting, and MDM support'
      },
      'App availability/compatibility': {
        area: 'Ecosystem',
        description: 'Limited access to modern apps and delayed releases',
        severity: 'medium',
        cloudSolution: 'Access to 3000+ Cloud-first apps with immediate availability'
      },
      'Performance issues': {
        area: 'Performance',
        description: 'Ongoing performance tuning and optimization required',
        severity: 'medium',
        cloudSolution: 'Optimized by Atlassian with CDN, caching, and performance monitoring'
      },
      'Disaster recovery concerns': {
        area: 'Business Continuity',
        description: 'DR requires separate infrastructure and regular testing',
        severity: 'high',
        cloudSolution: 'Built-in redundancy, automatic backups, and 99.9% SLA'
      }
    };

    for (const challenge of challenges) {
      const gapTemplate = challengeToGap[challenge];
      if (gapTemplate) {
        gaps.push({
          area: gapTemplate.area!,
          description: gapTemplate.description!,
          severity: gapTemplate.severity as AssessmentGap['severity'],
          cloudSolution: gapTemplate.cloudSolution!
        });
      }
    }

    // Check for feature gaps
    const automationUsage = responses.automation_usage;
    if (automationUsage === 'Custom Groovy scripts throughout') {
      gaps.push({
        area: 'Automation',
        description: 'Heavy reliance on custom Groovy scripts that may need migration',
        severity: 'high',
        cloudSolution: 'Native Jira Automation + ScriptRunner Cloud for complex scenarios'
      });
    }

    // Check for data residency gap
    const dataResidency = responses.data_residency_required;
    if (dataResidency === 'On-premise only acceptable') {
      gaps.push({
        area: 'Data Residency',
        description: 'Strict on-premise data requirement',
        severity: 'critical',
        cloudSolution: 'Cloud data residency available in US, EU, Australia, Germany - evaluate if acceptable'
      });
    }

    return gaps;
  }

  /**
   * Match Cloud capabilities to customer needs
   */
  private matchCapabilities(responses: QuestionnaireResponses): CloudCapability[] {
    const matched: CloudCapability[] = [];
    const desiredFeatures = responses.must_have_features || [];
    const challenges = responses.current_challenges || [];
    const useCases = responses.primary_use_cases || [];

    // Feature to capability mapping
    const featureMap: Record<string, string[]> = {
      'Automatic updates': ['atlassianAccess', 'premiumSupport'],
      'Advanced Roadmaps': ['advancedRoadmaps'],
      'Atlassian Intelligence (AI)': ['atlassianIntelligence', 'atlassianIntelligenceConfluence'],
      'Native automation': ['automation', 'globalAutomation'],
      'Improved collaboration': ['whiteboards', 'smartLinks', 'guestAccess'],
      'Mobile apps': ['mobileApps'],
      'Better integrations': ['nativeIntegrations'],
      'Reduced IT overhead': ['uptimeSLA', 'unlimitedStorage', 'premiumSupport']
    };

    // Add capabilities for desired features
    for (const feature of desiredFeatures) {
      const capabilityKeys = featureMap[feature] || [];
      for (const key of capabilityKeys) {
        const capability =
          JIRA_CLOUD_CAPABILITIES[key] ||
          CONFLUENCE_CLOUD_CAPABILITIES[key] ||
          PLATFORM_CLOUD_CAPABILITIES[key];
        if (capability && !matched.find(c => c.name === capability.name)) {
          matched.push(capability);
        }
      }
    }

    // Add capabilities for use cases
    if (useCases.includes('IT Service Management')) {
      const jsmCapabilities = [
        JIRA_CLOUD_CAPABILITIES.assetsInsight,
        JIRA_CLOUD_CAPABILITIES.jsmVirtualAgent
      ];
      for (const cap of jsmCapabilities) {
        if (cap && !matched.find(c => c.name === cap.name)) {
          matched.push(cap);
        }
      }
    }

    // Always recommend key platform capabilities
    const coreCapabilities = [
      PLATFORM_CLOUD_CAPABILITIES.atlassianAccess,
      PLATFORM_CLOUD_CAPABILITIES.adminInsights,
      JIRA_CLOUD_CAPABILITIES.atlassianIntelligence
    ];
    for (const cap of coreCapabilities) {
      if (cap && !matched.find(c => c.name === cap.name)) {
        matched.push(cap);
      }
    }

    return matched;
  }

  /**
   * Find relevant migration paths based on apps used
   */
  private findRelevantMigrationPaths(responses: QuestionnaireResponses): MigrationPath[] {
    const paths: MigrationPath[] = [];
    const appsUsed = (responses.apps_used || '').toLowerCase();
    const automationUsage = responses.automation_usage;

    for (const path of MIGRATION_PATHS) {
      const dcFeatureLower = path.dcFeature.toLowerCase();

      // Check if the DC feature is mentioned in apps used
      if (appsUsed.includes(dcFeatureLower) ||
          appsUsed.includes(dcFeatureLower.split(' ')[0])) {
        paths.push(path);
      }
    }

    // Add ScriptRunner path if heavy automation
    if (automationUsage === 'Custom Groovy scripts throughout' ||
        automationUsage === 'Heavy automation reliance') {
      const scriptRunnerPath = MIGRATION_PATHS.find(p => p.dcFeature.includes('ScriptRunner'));
      if (scriptRunnerPath && !paths.includes(scriptRunnerPath)) {
        paths.push(scriptRunnerPath);
      }
    }

    // Add Portfolio path if roadmaps mentioned
    if (appsUsed.includes('portfolio') || appsUsed.includes('roadmap') ||
        appsUsed.includes('bigpicture')) {
      const portfolioPath = MIGRATION_PATHS.find(p => p.dcFeature.includes('Portfolio'));
      if (portfolioPath && !paths.includes(portfolioPath)) {
        paths.push(portfolioPath);
      }
    }

    return paths;
  }

  /**
   * Generate AI-powered recommendations
   */
  private async generateRecommendations(
    companyName: string,
    responses: QuestionnaireResponses,
    gaps: AssessmentGap[],
    matchedCapabilities: CloudCapability[]
  ): Promise<AssessmentRecommendation[]> {
    try {
      const openai = getOpenAIService();

      const result = await openai.generateStructuredCompletion<{ recommendations: AssessmentRecommendation[] }>(
        [
          {
            role: 'system',
            content: `You are an Atlassian Cloud migration expert. Generate 5-8 specific, actionable recommendations for a company's Cloud migration based on their assessment data. Each recommendation should be tied to specific gaps or desired capabilities. Return JSON in this format:
{
  "recommendations": [
    {
      "title": "Short recommendation title",
      "description": "Detailed description of the recommendation",
      "priority": "high|medium|low",
      "category": "Infrastructure|Security|Features|Integration|Training|Planning",
      "relatedCapabilities": ["Capability Name 1", "Capability Name 2"],
      "estimatedImpact": "Description of expected impact"
    }
  ]
}`
          },
          {
            role: 'user',
            content: `Company: ${companyName}

Assessment Responses:
- Deployment Type: ${responses.deployment_type}
- User Count: ${responses.user_count}
- Products: ${JSON.stringify(responses.products_used)}
- Challenges: ${JSON.stringify(responses.current_challenges)}
- Desired Features: ${JSON.stringify(responses.must_have_features)}
- Automation Usage: ${responses.automation_usage}
- Migration Urgency: ${responses.migration_urgency}

Identified Gaps:
${gaps.map(g => `- ${g.area}: ${g.description} (${g.severity})`).join('\n')}

Matched Cloud Capabilities:
${matchedCapabilities.map(c => `- ${c.name}: ${c.description}`).join('\n')}

Generate specific recommendations for their Cloud migration.`
          }
        ],
        undefined,
        0.7
      );

      return result.recommendations || [];
    } catch (error) {
      console.error('Failed to generate AI recommendations:', error);

      // Return basic recommendations if AI fails
      return [
        {
          title: 'Start with Migration Assessment Tool',
          description: 'Use the Jira Cloud Migration Assistant to assess app compatibility and identify migration blockers.',
          priority: 'high',
          category: 'Planning',
          relatedCapabilities: [],
          estimatedImpact: 'Identify specific migration requirements and timeline'
        },
        {
          title: 'Evaluate Cloud Premium/Enterprise',
          description: 'Based on your requirements, evaluate Premium or Enterprise tiers for advanced features like data residency and SSO.',
          priority: 'medium',
          category: 'Planning',
          relatedCapabilities: ['Atlassian Access (Guard)', 'Data Residency'],
          estimatedImpact: 'Ensure Cloud plan meets security and compliance needs'
        },
        {
          title: 'Plan App Migration Strategy',
          description: 'Review your current apps and identify Cloud equivalents or alternatives for each.',
          priority: 'high',
          category: 'Integration',
          relatedCapabilities: ['Native Integrations'],
          estimatedImpact: 'Minimize functionality gaps during migration'
        }
      ];
    }
  }

  /**
   * Estimate migration timeline based on complexity
   */
  private estimateTimeline(responses: QuestionnaireResponses, gapCount: number): string {
    const userCount = responses.user_count;
    const automationUsage = responses.automation_usage;
    const integrationCount = responses.integration_count;

    let weeks = 4; // Base timeline

    // Adjust for user count
    if (userCount === '501-1000') weeks += 2;
    else if (userCount === '1001-5000') weeks += 4;
    else if (userCount === '5000+') weeks += 8;

    // Adjust for automation complexity
    if (automationUsage === 'Custom Groovy scripts throughout') weeks += 4;
    else if (automationUsage === 'Heavy automation reliance') weeks += 2;

    // Adjust for integrations
    if (integrationCount === '6-15') weeks += 2;
    else if (integrationCount === '15+') weeks += 4;

    // Adjust for gaps
    weeks += Math.floor(gapCount / 2);

    if (weeks <= 6) return '4-6 weeks';
    if (weeks <= 10) return '2-3 months';
    if (weeks <= 16) return '3-4 months';
    return '4-6 months';
  }

  /**
   * Identify risk factors
   */
  private identifyRiskFactors(responses: QuestionnaireResponses): string[] {
    const risks: string[] = [];
    const blockers = responses.migration_blockers || [];
    const automationUsage = responses.automation_usage;
    const dataResidency = responses.data_residency_required;

    if (blockers.includes('App compatibility')) {
      risks.push('Some apps may not have direct Cloud equivalents');
    }
    if (blockers.includes('Data migration complexity')) {
      risks.push('Large data volumes may require phased migration approach');
    }
    if (blockers.includes('Custom integrations')) {
      risks.push('Custom integrations will need to be rebuilt using Cloud APIs');
    }
    if (automationUsage === 'Custom Groovy scripts throughout') {
      risks.push('Groovy scripts will need conversion to Automation rules or ScriptRunner Cloud');
    }
    if (dataResidency === 'On-premise only acceptable') {
      risks.push('Strict on-premise requirement may be a migration blocker');
    }
    if (blockers.includes('Change management/training')) {
      risks.push('User adoption requires comprehensive training and change management');
    }

    return risks;
  }

  /**
   * Generate next steps based on assessment
   */
  private generateNextSteps(urgencyLevel: string, responses: QuestionnaireResponses): string[] {
    const steps: string[] = [];

    if (urgencyLevel === 'critical' || urgencyLevel === 'high') {
      steps.push('Schedule a discovery call with an Atlassian Solution Partner');
      steps.push('Run the Jira Cloud Migration Assistant for detailed compatibility report');
    }

    steps.push('Review and prioritize apps for Cloud migration');
    steps.push('Evaluate Cloud tier requirements (Standard, Premium, Enterprise)');

    if (responses.automation_usage !== 'None/Minimal') {
      steps.push('Audit existing automation rules and scripts for Cloud compatibility');
    }

    if (responses.sso_requirements?.length > 0) {
      steps.push('Plan SSO configuration with Atlassian Access');
    }

    steps.push('Develop user communication and training plan');
    steps.push('Create a phased migration timeline with rollback procedures');

    return steps;
  }

  /**
   * Generate executive summary using AI
   */
  private async generateSummary(
    companyName: string,
    responses: QuestionnaireResponses,
    score: number,
    urgencyLevel: string,
    gaps: AssessmentGap[],
    recommendations: AssessmentRecommendation[]
  ): Promise<string> {
    try {
      const openai = getOpenAIService();

      const result = await openai.generateChatCompletion({
        messages: [
          {
            role: 'system',
            content: 'You are an Atlassian Cloud migration expert. Generate a concise executive summary (2-3 paragraphs) for a migration assessment report. Be specific and actionable.'
          },
          {
            role: 'user',
            content: `Company: ${companyName}
Migration Score: ${score}/100
Urgency Level: ${urgencyLevel}
Current Deployment: ${responses.deployment_type}
User Count: ${responses.user_count}
Key Challenges: ${(responses.current_challenges || []).join(', ')}

Gaps Identified: ${gaps.length}
Top Recommendations: ${recommendations.slice(0, 3).map(r => r.title).join(', ')}

Write an executive summary for this assessment.`
          }
        ],
        temperature: 0.7
      });

      return result;
    } catch (error) {
      console.error('Failed to generate AI summary:', error);
      return `${companyName}'s Atlassian environment shows a migration score of ${score}/100 with ${urgencyLevel} urgency. Based on the assessment, ${gaps.length} key gaps were identified that Cloud migration would address. Primary recommendations focus on ${recommendations.slice(0, 2).map(r => r.title.toLowerCase()).join(' and ')}.`;
    }
  }

  /**
   * Search Cloud capabilities by keyword
   */
  searchCloudCapabilities(query: string): CloudCapability[] {
    return searchCapabilities(query);
  }

  /**
   * Get all Cloud-only capabilities (not available in DC)
   */
  getCloudOnlyCapabilities(): CloudCapability[] {
    return getCloudOnlyCapabilities();
  }

  /**
   * Get DC pain points by urgency
   */
  getPainPointsByUrgency(urgency: DCPainPoint['urgencyIndicator']): DCPainPoint[] {
    return DC_PAIN_POINTS.filter(pp => pp.urgencyIndicator === urgency);
  }

  /**
   * Get pricing information
   */
  getPricingInfo() {
    return CLOUD_PRICING_TIERS;
  }

  /**
   * Delete an assessment and all related data
   */
  async deleteAssessment(id: string): Promise<void> {
    // Use a transaction to ensure both deletes succeed or fail together
    await prisma.$transaction(async (tx) => {
      // First delete related credentials (foreign key constraint)
      await tx.atlassianCredential.deleteMany({
        where: { assessmentId: id }
      });

      // Then delete the assessment
      await tx.atlassianAssessment.delete({
        where: { id }
      });
    });
  }
}

// Singleton instance
let atlassianAssessmentService: AtlassianAssessmentService | null = null;

export function getAtlassianAssessmentService(): AtlassianAssessmentService {
  if (!atlassianAssessmentService) {
    atlassianAssessmentService = new AtlassianAssessmentService();
  }
  return atlassianAssessmentService;
}

export default AtlassianAssessmentService;
