/**
 * Atlassian Environment Scanner Service
 *
 * Analyzes scanned Atlassian DC/Server instance data and generates
 * migration readiness assessments based on real infrastructure.
 */

import { getPrismaClient } from '../config/database';
import {
  getAtlassianApiClientService,
  AtlassianInstance,
  InstanceScanResult,
  InstalledPlugin,
  JiraCustomField,
  JiraWorkflow,
  clearScanLogs
} from './atlassian-api-client.service';
import { getOpenAIService } from './openai.service';

const prisma = getPrismaClient();

// ============================================================================
// TYPES
// ============================================================================

export interface EnvironmentAnalysis {
  overview: {
    instanceType: string;
    version: string;
    userCount: number;
    projectCount: number;
    customizationLevel: 'low' | 'medium' | 'high' | 'very_high';
  };
  users: {
    totalUsers: number;
    activeUsers: number;
    inactiveUsers: number;
    utilizationRate: number;
    licenseRecommendation: string;
    groups: { name: string; memberCount: number }[];
  };
  customFields: {
    totalCustomFields: number;
    fieldsByType: Record<string, number>;
    migrationComplexity: 'low' | 'medium' | 'high';
    fieldsNeedingReview: JiraCustomField[];
    recommendations: string[];
  };
  workflows: {
    totalCustomWorkflows: number;
    complexWorkflows: JiraWorkflow[];
    workflowsWithGroovy: number;
    migrationComplexity: 'low' | 'medium' | 'high';
    recommendations: string[];
  };
  plugins: {
    totalUserPlugins: number;
    cloudReadyPlugins: PluginMigrationStatus[];
    pluginsNeedingAlternative: PluginMigrationStatus[];
    pluginsWithNoCloudVersion: PluginMigrationStatus[];
    overallMigrationReadiness: number; // 0-100
    recommendations: string[];
  };
  dataVolume: {
    estimatedIssues?: number;
    estimatedAttachmentSizeGB?: number;
    migrationTimeEstimate: string;
    recommendations: string[];
  };
  securityAndCompliance: {
    ssoConfigured: boolean;
    ldapIntegration: boolean;
    customPermissionSchemes: number;
    recommendations: string[];
  };
  overallAssessment: {
    migrationReadinessScore: number; // 0-100
    complexity: 'simple' | 'moderate' | 'complex' | 'very_complex';
    estimatedEffort: string;
    majorBlockers: string[];
    keyConsiderations: string[];
    recommendedApproach: string;
  };
}

export interface PluginMigrationStatus {
  name: string;
  key: string;
  currentVersion: string;
  status: 'ready' | 'alternative_available' | 'no_cloud_version' | 'needs_review';
  cloudEquivalent?: string;
  migrationNotes?: string;
  businessCriticality?: 'low' | 'medium' | 'high' | 'critical';
}

export interface ScanAndAnalyzeResult {
  scanResult: InstanceScanResult;
  analysis: EnvironmentAnalysis;
  savedToAssessment: boolean;
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

class AtlassianEnvironmentScannerService {
  private apiClient = getAtlassianApiClientService();

  /**
   * Scan an instance and analyze for migration readiness
   */
  async scanAndAnalyze(
    assessmentId: string,
    instance: AtlassianInstance
  ): Promise<ScanAndAnalyzeResult> {
    // Clear any previous logs for this assessment
    clearScanLogs(assessmentId);

    // Set assessment ID for logging
    this.apiClient.setAssessmentId(assessmentId);

    try {
      // Test connection first
      const connectionTest = await this.apiClient.testConnection(instance);
      if (!connectionTest.success) {
        throw new Error(`Connection failed: ${connectionTest.error}`);
      }

      // Store credentials securely
      const assessment = await prisma.atlassianAssessment.findUnique({
        where: { id: assessmentId }
      });

      if (!assessment) {
        throw new Error('Assessment not found');
      }

      await this.apiClient.storeCredentials(
        assessmentId,
        assessment.companyName,
        instance
      );

      // Perform full environment scan
      const scanResult = await this.apiClient.scanEnvironment(instance);

      // Analyze scan results
      const analysis = await this.analyzeEnvironment(scanResult, assessment.companyName);

      // Save to assessment
      await prisma.atlassianAssessment.update({
        where: { id: assessmentId },
        data: {
          environmentData: {
            scanResult,
            analysis,
            scannedAt: new Date().toISOString()
          } as any
        }
      });

      return {
        scanResult,
        analysis,
        savedToAssessment: true
      };
    } finally {
      // Clear assessment ID after scan
      this.apiClient.setAssessmentId(null);
    }
  }

  /**
   * Analyze scanned environment data
   */
  async analyzeEnvironment(
    scanResult: InstanceScanResult,
    companyName: string
  ): Promise<EnvironmentAnalysis> {
    // Analyze users
    const userAnalysis = this.analyzeUsers(scanResult);

    // Analyze custom fields
    const customFieldAnalysis = this.analyzeCustomFields(scanResult);

    // Analyze workflows
    const workflowAnalysis = this.analyzeWorkflows(scanResult);

    // Analyze plugins
    const pluginAnalysis = this.analyzePlugins(scanResult);

    // Analyze data volume
    const dataVolumeAnalysis = this.analyzeDataVolume(scanResult);

    // Analyze security
    const securityAnalysis = this.analyzeSecurityAndCompliance(scanResult);

    // Calculate overall customization level
    const customizationLevel = this.calculateCustomizationLevel(
      customFieldAnalysis,
      workflowAnalysis,
      pluginAnalysis
    );

    // Calculate overall assessment
    const overallAssessment = await this.calculateOverallAssessment(
      companyName,
      scanResult,
      {
        userAnalysis,
        customFieldAnalysis,
        workflowAnalysis,
        pluginAnalysis,
        dataVolumeAnalysis,
        customizationLevel
      }
    );

    return {
      overview: {
        instanceType: scanResult.serverInfo.deploymentType,
        version: scanResult.serverInfo.version,
        userCount: scanResult.users.total,
        projectCount: scanResult.projects.total,
        customizationLevel
      },
      users: userAnalysis,
      customFields: customFieldAnalysis,
      workflows: workflowAnalysis,
      plugins: pluginAnalysis,
      dataVolume: dataVolumeAnalysis,
      securityAndCompliance: securityAnalysis,
      overallAssessment
    };
  }

  /**
   * Analyze user data
   */
  private analyzeUsers(scanResult: InstanceScanResult): EnvironmentAnalysis['users'] {
    const { users } = scanResult;
    const utilizationRate = users.total > 0 ? (users.active / users.total) * 100 : 0;

    let licenseRecommendation = 'Cloud Free tier';
    if (users.active > 10000) {
      licenseRecommendation = 'Enterprise tier with custom pricing';
    } else if (users.active > 1000) {
      licenseRecommendation = 'Premium tier (1000+ users)';
    } else if (users.active > 100) {
      licenseRecommendation = 'Standard tier (up to 5000 users)';
    } else if (users.active > 10) {
      licenseRecommendation = 'Standard tier';
    }

    return {
      totalUsers: users.total,
      activeUsers: users.active,
      inactiveUsers: users.inactive,
      utilizationRate: Math.round(utilizationRate),
      licenseRecommendation,
      groups: users.groups
    };
  }

  /**
   * Analyze custom fields
   */
  private analyzeCustomFields(scanResult: InstanceScanResult): EnvironmentAnalysis['customFields'] {
    const { customFields } = scanResult;
    const fieldsByType: Record<string, number> = {};
    const fieldsNeedingReview: JiraCustomField[] = [];
    const recommendations: string[] = [];

    for (const field of customFields.fields) {
      const fieldType = field.type || 'unknown';
      fieldsByType[fieldType] = (fieldsByType[fieldType] || 0) + 1;

      // Flag complex field types that need review
      if (
        fieldType.includes('script') ||
        fieldType.includes('groovy') ||
        fieldType.includes('calculated') ||
        fieldType.includes('external')
      ) {
        fieldsNeedingReview.push(field);
      }
    }

    // Determine complexity
    let migrationComplexity: 'low' | 'medium' | 'high' = 'low';
    if (customFields.customFields > 200 || fieldsNeedingReview.length > 20) {
      migrationComplexity = 'high';
      recommendations.push('Consider consolidating duplicate custom fields before migration');
      recommendations.push('Review scripted fields for Cloud-compatible alternatives');
    } else if (customFields.customFields > 50 || fieldsNeedingReview.length > 5) {
      migrationComplexity = 'medium';
      recommendations.push('Plan for custom field mapping during migration');
    }

    if (fieldsNeedingReview.length > 0) {
      recommendations.push(
        `${fieldsNeedingReview.length} custom fields use scripting or external data - review for Cloud compatibility`
      );
    }

    return {
      totalCustomFields: customFields.customFields,
      fieldsByType,
      migrationComplexity,
      fieldsNeedingReview,
      recommendations
    };
  }

  /**
   * Analyze workflows
   */
  private analyzeWorkflows(scanResult: InstanceScanResult): EnvironmentAnalysis['workflows'] {
    const { workflows } = scanResult;
    const complexWorkflows: JiraWorkflow[] = [];
    const recommendations: string[] = [];
    let workflowsWithGroovy = 0;

    for (const workflow of workflows.workflows) {
      // Complex if it has post-functions, validators, or conditions
      if (workflow.hasPostFunctions || workflow.hasValidators || workflow.hasConditions) {
        complexWorkflows.push(workflow);

        // Assume scripted post-functions might use Groovy
        if (workflow.hasPostFunctions) {
          workflowsWithGroovy++;
        }
      }
    }

    // Determine complexity
    let migrationComplexity: 'low' | 'medium' | 'high' = 'low';
    if (workflows.customWorkflows > 30 || workflowsWithGroovy > 10) {
      migrationComplexity = 'high';
      recommendations.push('Significant workflow customization detected - plan for workflow redesign');
      recommendations.push('ScriptRunner Cloud or Automation for Jira can replace many Groovy scripts');
    } else if (workflows.customWorkflows > 10 || workflowsWithGroovy > 3) {
      migrationComplexity = 'medium';
      recommendations.push('Review custom post-functions and validators for Cloud equivalents');
    }

    if (workflowsWithGroovy > 0) {
      recommendations.push(
        `${workflowsWithGroovy} workflows may have Groovy scripts - migration to Jira Automation or ScriptRunner Cloud required`
      );
    }

    return {
      totalCustomWorkflows: workflows.customWorkflows,
      complexWorkflows,
      workflowsWithGroovy,
      migrationComplexity,
      recommendations
    };
  }

  /**
   * Analyze plugins
   */
  private analyzePlugins(scanResult: InstanceScanResult): EnvironmentAnalysis['plugins'] {
    const { plugins } = scanResult;
    const cloudReadyPlugins: PluginMigrationStatus[] = [];
    const pluginsNeedingAlternative: PluginMigrationStatus[] = [];
    const pluginsWithNoCloudVersion: PluginMigrationStatus[] = [];
    const recommendations: string[] = [];

    for (const plugin of plugins.plugins) {
      const status: PluginMigrationStatus = {
        name: plugin.name,
        key: plugin.key,
        currentVersion: plugin.version,
        status: 'needs_review',
        cloudEquivalent: plugin.cloudEquivalent?.name,
        migrationNotes: plugin.cloudEquivalent?.migrationNotes
      };

      if (plugin.cloudEquivalent?.exists) {
        status.status = 'ready';
        cloudReadyPlugins.push(status);
      } else {
        // Check common patterns to identify critical plugins
        const pluginKeyLower = plugin.key.toLowerCase();
        const pluginNameLower = plugin.name.toLowerCase();

        if (
          pluginKeyLower.includes('scriptrunner') ||
          pluginKeyLower.includes('groovy') ||
          pluginNameLower.includes('automation')
        ) {
          status.businessCriticality = 'high';
          status.status = 'alternative_available';
          status.migrationNotes = 'Use ScriptRunner Cloud or native Jira Automation';
          pluginsNeedingAlternative.push(status);
        } else if (
          pluginKeyLower.includes('tempo') ||
          pluginKeyLower.includes('time') ||
          pluginNameLower.includes('insight') ||
          pluginNameLower.includes('asset')
        ) {
          status.businessCriticality = 'medium';
          status.status = 'needs_review';
          pluginsNeedingAlternative.push(status);
        } else {
          status.status = 'no_cloud_version';
          pluginsWithNoCloudVersion.push(status);
        }
      }
    }

    // Calculate readiness percentage
    const totalUserPlugins = plugins.userInstalled;
    const readyCount = cloudReadyPlugins.length;
    const overallMigrationReadiness = totalUserPlugins > 0
      ? Math.round((readyCount / totalUserPlugins) * 100)
      : 100;

    // Generate recommendations
    if (pluginsWithNoCloudVersion.length > 0) {
      recommendations.push(
        `${pluginsWithNoCloudVersion.length} plugins have no known Cloud equivalent - evaluate alternatives or custom development`
      );
    }

    if (pluginsNeedingAlternative.length > 0) {
      recommendations.push(
        `${pluginsNeedingAlternative.length} plugins need migration to Cloud alternatives`
      );
    }

    if (overallMigrationReadiness < 50) {
      recommendations.push('Low plugin migration readiness - conduct detailed app audit before migration');
    }

    return {
      totalUserPlugins,
      cloudReadyPlugins,
      pluginsNeedingAlternative,
      pluginsWithNoCloudVersion,
      overallMigrationReadiness,
      recommendations
    };
  }

  /**
   * Analyze data volume
   */
  private analyzeDataVolume(scanResult: InstanceScanResult): EnvironmentAnalysis['dataVolume'] {
    const { utilization, projects } = scanResult;
    const recommendations: string[] = [];

    // Estimate total issues based on created rate
    const estimatedIssues = (utilization.issuesCreatedLast30Days || 0) * 12 * 5; // Rough 5-year estimate

    // Estimate migration time based on data volume
    let migrationTimeEstimate = '2-4 weeks';
    if (estimatedIssues > 1000000) {
      migrationTimeEstimate = '3-6 months';
      recommendations.push('Large data volume - consider phased migration approach');
      recommendations.push('Use Jira Cloud Migration Assistant for data migration planning');
    } else if (estimatedIssues > 100000) {
      migrationTimeEstimate = '1-2 months';
      recommendations.push('Moderate data volume - plan for migration during low-activity period');
    } else if (estimatedIssues > 10000) {
      migrationTimeEstimate = '2-4 weeks';
    } else {
      migrationTimeEstimate = '1-2 weeks';
    }

    if (projects.total > 100) {
      recommendations.push('Consider migrating projects in batches by business unit');
    }

    return {
      estimatedIssues,
      migrationTimeEstimate,
      recommendations
    };
  }

  /**
   * Analyze security and compliance
   */
  private analyzeSecurityAndCompliance(
    scanResult: InstanceScanResult
  ): EnvironmentAnalysis['securityAndCompliance'] {
    const recommendations: string[] = [];

    // These would need additional API calls to detect properly
    // For now, we provide recommendations based on enterprise patterns
    const ssoConfigured = scanResult.users.groups.some(g =>
      g.name.toLowerCase().includes('sso') || g.name.toLowerCase().includes('saml')
    );

    const ldapIntegration = scanResult.users.groups.some(g =>
      g.name.toLowerCase().includes('ldap') || g.name.toLowerCase().includes('ad-')
    );

    recommendations.push('Review permission schemes for Cloud compatibility');
    recommendations.push('Plan SSO configuration with Atlassian Access (Guard)');

    if (ldapIntegration) {
      recommendations.push('LDAP sync will need to be replaced with SCIM provisioning via identity provider');
    }

    return {
      ssoConfigured,
      ldapIntegration,
      customPermissionSchemes: 0, // Would need additional API call
      recommendations
    };
  }

  /**
   * Calculate overall customization level
   */
  private calculateCustomizationLevel(
    customFieldAnalysis: EnvironmentAnalysis['customFields'],
    workflowAnalysis: EnvironmentAnalysis['workflows'],
    pluginAnalysis: EnvironmentAnalysis['plugins']
  ): 'low' | 'medium' | 'high' | 'very_high' {
    let score = 0;

    // Custom fields factor
    if (customFieldAnalysis.totalCustomFields > 200) score += 3;
    else if (customFieldAnalysis.totalCustomFields > 100) score += 2;
    else if (customFieldAnalysis.totalCustomFields > 50) score += 1;

    // Workflows factor
    if (workflowAnalysis.totalCustomWorkflows > 30) score += 3;
    else if (workflowAnalysis.totalCustomWorkflows > 15) score += 2;
    else if (workflowAnalysis.totalCustomWorkflows > 5) score += 1;

    // Plugins factor
    if (pluginAnalysis.totalUserPlugins > 30) score += 3;
    else if (pluginAnalysis.totalUserPlugins > 15) score += 2;
    else if (pluginAnalysis.totalUserPlugins > 5) score += 1;

    // Scripting factor
    if (workflowAnalysis.workflowsWithGroovy > 10) score += 2;
    else if (workflowAnalysis.workflowsWithGroovy > 0) score += 1;

    if (score >= 9) return 'very_high';
    if (score >= 6) return 'high';
    if (score >= 3) return 'medium';
    return 'low';
  }

  /**
   * Calculate overall assessment
   */
  private async calculateOverallAssessment(
    companyName: string,
    scanResult: InstanceScanResult,
    analyses: {
      userAnalysis: EnvironmentAnalysis['users'];
      customFieldAnalysis: EnvironmentAnalysis['customFields'];
      workflowAnalysis: EnvironmentAnalysis['workflows'];
      pluginAnalysis: EnvironmentAnalysis['plugins'];
      dataVolumeAnalysis: EnvironmentAnalysis['dataVolume'];
      customizationLevel: string;
    }
  ): Promise<EnvironmentAnalysis['overallAssessment']> {
    const majorBlockers: string[] = [];
    const keyConsiderations: string[] = [];

    // Calculate readiness score components
    let readinessScore = 70; // Start with base score

    // User factor
    if (analyses.userAnalysis.totalUsers > 5000) {
      readinessScore -= 10;
      keyConsiderations.push('Large user base requires careful migration planning');
    }

    // Custom fields factor
    if (analyses.customFieldAnalysis.migrationComplexity === 'high') {
      readinessScore -= 15;
      keyConsiderations.push('High custom field complexity');
    } else if (analyses.customFieldAnalysis.migrationComplexity === 'medium') {
      readinessScore -= 5;
    }

    // Workflow factor
    if (analyses.workflowAnalysis.migrationComplexity === 'high') {
      readinessScore -= 15;
      majorBlockers.push('Extensive workflow customization with scripting');
    } else if (analyses.workflowAnalysis.migrationComplexity === 'medium') {
      readinessScore -= 5;
    }

    // Plugin factor
    if (analyses.pluginAnalysis.overallMigrationReadiness < 30) {
      readinessScore -= 20;
      majorBlockers.push('Low app/plugin migration readiness');
    } else if (analyses.pluginAnalysis.overallMigrationReadiness < 60) {
      readinessScore -= 10;
      keyConsiderations.push('Some apps need Cloud alternatives');
    }

    // Ensure score is within bounds
    readinessScore = Math.max(0, Math.min(100, readinessScore));

    // Determine complexity
    let complexity: EnvironmentAnalysis['overallAssessment']['complexity'] = 'simple';
    if (readinessScore < 40) {
      complexity = 'very_complex';
    } else if (readinessScore < 60) {
      complexity = 'complex';
    } else if (readinessScore < 80) {
      complexity = 'moderate';
    }

    // Estimate effort
    let estimatedEffort = '2-4 weeks';
    if (complexity === 'very_complex') {
      estimatedEffort = '4-6 months';
    } else if (complexity === 'complex') {
      estimatedEffort = '2-3 months';
    } else if (complexity === 'moderate') {
      estimatedEffort = '1-2 months';
    }

    // Generate recommended approach using AI
    let recommendedApproach = '';
    try {
      const openai = getOpenAIService();
      recommendedApproach = await openai.generateChatCompletion({
        messages: [
          {
            role: 'system',
            content: 'You are an Atlassian Cloud migration expert. Provide a concise 2-3 sentence recommendation for migration approach based on the analysis.'
          },
          {
            role: 'user',
            content: `Company: ${companyName}
Instance: ${scanResult.serverInfo.deploymentType} v${scanResult.serverInfo.version}
Users: ${scanResult.users.total} (${scanResult.users.active} active)
Projects: ${scanResult.projects.total}
Custom Fields: ${analyses.customFieldAnalysis.totalCustomFields}
Custom Workflows: ${analyses.workflowAnalysis.totalCustomWorkflows}
User Plugins: ${analyses.pluginAnalysis.totalUserPlugins}
Plugin Cloud Readiness: ${analyses.pluginAnalysis.overallMigrationReadiness}%
Major Blockers: ${majorBlockers.join(', ') || 'None'}

Provide migration approach recommendation.`
          }
        ],
        temperature: 0.7
      });
    } catch (error) {
      recommendedApproach = complexity === 'simple' || complexity === 'moderate'
        ? 'Standard migration using Jira Cloud Migration Assistant with phased user rollout.'
        : 'Recommend phased migration approach with pilot group, extensive app compatibility testing, and workflow redesign before full migration.';
    }

    return {
      migrationReadinessScore: readinessScore,
      complexity,
      estimatedEffort,
      majorBlockers,
      keyConsiderations,
      recommendedApproach
    };
  }

  /**
   * Get scan results for an assessment
   */
  async getScanResults(assessmentId: string): Promise<InstanceScanResult | null> {
    const assessment = await prisma.atlassianAssessment.findUnique({
      where: { id: assessmentId },
      select: { environmentData: true }
    });

    if (!assessment?.environmentData) return null;

    const envData = assessment.environmentData as any;
    return envData.scanResult || null;
  }

  /**
   * Get analysis for an assessment
   */
  async getAnalysis(assessmentId: string): Promise<EnvironmentAnalysis | null> {
    const assessment = await prisma.atlassianAssessment.findUnique({
      where: { id: assessmentId },
      select: { environmentData: true }
    });

    if (!assessment?.environmentData) return null;

    const envData = assessment.environmentData as any;
    return envData.analysis || null;
  }
}

// Singleton instance
let atlassianEnvironmentScannerService: AtlassianEnvironmentScannerService | null = null;

export function getAtlassianEnvironmentScannerService(): AtlassianEnvironmentScannerService {
  if (!atlassianEnvironmentScannerService) {
    atlassianEnvironmentScannerService = new AtlassianEnvironmentScannerService();
  }
  return atlassianEnvironmentScannerService;
}

export default AtlassianEnvironmentScannerService;
