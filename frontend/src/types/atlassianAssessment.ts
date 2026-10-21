// ============================================================================
// Atlassian Assessment Types
// ============================================================================

export type QuestionType = 'text' | 'textarea' | 'select' | 'multiselect' | 'number' | 'boolean';
export type UrgencyLevel = 'low' | 'medium' | 'high' | 'critical';
export type AssessmentStatus = 'pending' | 'questionnaire' | 'analyzing' | 'completed' | 'failed';
export type MigrationType = 'dc-to-cloud' | 'cloud-to-cloud' | 'server-to-cloud' | 'unknown';

// Determines migration type from deployment type response
export const getMigrationType = (deploymentType: string | undefined): MigrationType => {
  if (!deploymentType) return 'unknown';
  const lower = deploymentType.toLowerCase();
  if (lower.includes('data center') || lower.includes('dc')) return 'dc-to-cloud';
  if (lower.includes('server')) return 'server-to-cloud';
  if (lower.includes('cloud')) return 'cloud-to-cloud';
  return 'unknown';
};

export const getMigrationTypeLabel = (type: MigrationType): string => {
  switch (type) {
    case 'dc-to-cloud': return 'Data Center → Cloud';
    case 'server-to-cloud': return 'Server → Cloud';
    case 'cloud-to-cloud': return 'Cloud → Cloud';
    default: return 'Unknown';
  }
};

export const getMigrationTypeDescription = (type: MigrationType): string => {
  switch (type) {
    case 'dc-to-cloud':
      return 'Migrating from self-managed Atlassian Data Center deployment to Atlassian Cloud';
    case 'server-to-cloud':
      return 'Migrating from deprecated Atlassian Server to Atlassian Cloud';
    case 'cloud-to-cloud':
      return 'Consolidating or reorganizing existing Atlassian Cloud instances';
    default:
      return 'Migration type will be determined based on questionnaire responses';
  }
};

export interface QuestionnaireQuestion {
  id: string;
  category: string;
  question: string;
  type: QuestionType;
  options?: string[];
  placeholder?: string;
  required: boolean;
}

export interface QuestionnaireCategory {
  title: string;
  description: string;
  icon: string;
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

export interface CloudCapability {
  name: string;
  description: string;
  dcEquivalent: string | null;
  migrationComplexity: 'low' | 'medium' | 'high';
  benefits: string[];
  category: string;
}

export interface MigrationPath {
  dcFeature: string;
  cloudReplacement: string;
  migrationSteps: string[];
  potentialIssues: string[];
  complexity: 'low' | 'medium' | 'high';
}

// Migration compatibility item
export interface MigrationCompatibilityItem {
  item: string;
  canMigrate: boolean;
  notes: string;
  complexity?: 'low' | 'medium' | 'high';
}

// Get migration compatibility breakdown from analysis
export const getMigrationCompatibility = (
  responses: QuestionnaireResponses,
  matchedCapabilities: CloudCapability[],
  migrationPaths: MigrationPath[]
): { canMigrate: MigrationCompatibilityItem[]; cannotMigrate: MigrationCompatibilityItem[]; needsReview: MigrationCompatibilityItem[] } => {
  const canMigrate: MigrationCompatibilityItem[] = [];
  const cannotMigrate: MigrationCompatibilityItem[] = [];
  const needsReview: MigrationCompatibilityItem[] = [];

  // Products
  if (responses.products_used) {
    const products = Array.isArray(responses.products_used) ? responses.products_used : [responses.products_used];
    products.forEach((product: string) => {
      canMigrate.push({
        item: product,
        canMigrate: true,
        notes: 'Core product available in Cloud with feature parity',
        complexity: 'low',
      });
    });
  }

  // Check apps/add-ons
  if (responses.apps_used) {
    const appsText = String(responses.apps_used);
    // Check for common problematic patterns
    if (appsText.toLowerCase().includes('scriptrunner') || appsText.toLowerCase().includes('groovy')) {
      needsReview.push({
        item: 'ScriptRunner / Groovy Scripts',
        canMigrate: false,
        notes: 'Requires migration to ScriptRunner Cloud or native automation. Custom Groovy scripts need rewriting.',
        complexity: 'high',
      });
    }
    if (appsText.toLowerCase().includes('insight') || appsText.toLowerCase().includes('assets')) {
      canMigrate.push({
        item: 'Assets (Insight)',
        canMigrate: true,
        notes: 'Now included in Jira Service Management Cloud Premium',
        complexity: 'medium',
      });
    }
  }

  // Automation
  if (responses.automation_usage) {
    const automation = String(responses.automation_usage);
    if (automation.toLowerCase().includes('groovy') || automation.toLowerCase().includes('custom')) {
      needsReview.push({
        item: 'Custom Automation',
        canMigrate: false,
        notes: 'Groovy scripts not supported in Cloud. Migrate to Jira Automation rules.',
        complexity: 'high',
      });
    } else if (automation.toLowerCase().includes('automation')) {
      canMigrate.push({
        item: 'Built-in Automation Rules',
        canMigrate: true,
        notes: 'Automation rules can be migrated with minor adjustments',
        complexity: 'low',
      });
    }
  }

  // Data residency
  if (responses.data_residency_required) {
    const residency = String(responses.data_residency_required).toLowerCase();
    if (residency === 'yes' || residency === 'true' || residency.includes('required')) {
      needsReview.push({
        item: 'Data Residency Requirements',
        canMigrate: true,
        notes: 'Atlassian Cloud supports data residency in select regions (US, EU, AU). Verify your region is supported.',
        complexity: 'medium',
      });
    }
  }

  // SSO/Identity
  if (responses.sso_requirements) {
    const ssoReqs = Array.isArray(responses.sso_requirements) ? responses.sso_requirements : [responses.sso_requirements];
    ssoReqs.forEach((req: string) => {
      if (req.toLowerCase().includes('saml') || req.toLowerCase().includes('okta') || req.toLowerCase().includes('azure')) {
        canMigrate.push({
          item: `SSO: ${req}`,
          canMigrate: true,
          notes: 'Supported via Atlassian Access (requires Enterprise subscription)',
          complexity: 'low',
        });
      } else if (req.toLowerCase().includes('ldap')) {
        needsReview.push({
          item: 'LDAP Directory Sync',
          canMigrate: false,
          notes: 'Direct LDAP not supported. Use Azure AD, Okta, or Google Workspace for user provisioning.',
          complexity: 'medium',
        });
      }
    });
  }

  // Add matched capabilities
  matchedCapabilities.forEach(cap => {
    if (cap.dcEquivalent && !canMigrate.some(c => c.item === cap.name)) {
      canMigrate.push({
        item: cap.name,
        canMigrate: true,
        notes: `Replaces: ${cap.dcEquivalent}. ${cap.benefits[0] || ''}`,
        complexity: cap.migrationComplexity,
      });
    }
  });

  // Add migration paths as items
  migrationPaths.forEach(path => {
    if (!canMigrate.some(c => c.item === path.dcFeature) && !needsReview.some(c => c.item === path.dcFeature)) {
      if (path.complexity === 'high' || path.potentialIssues.length > 2) {
        needsReview.push({
          item: path.dcFeature,
          canMigrate: true,
          notes: `Migrates to: ${path.cloudReplacement}. ${path.potentialIssues[0] || ''}`,
          complexity: path.complexity,
        });
      } else {
        canMigrate.push({
          item: path.dcFeature,
          canMigrate: true,
          notes: `Migrates to: ${path.cloudReplacement}`,
          complexity: path.complexity,
        });
      }
    }
  });

  return { canMigrate, cannotMigrate, needsReview };
};

export interface AssessmentAnalysis {
  summary: string;
  migrationScore: number;
  migrationScoreBreakdown: MigrationScoreBreakdown;
  urgencyLevel: UrgencyLevel;
  urgencyReason: string;
  gaps: AssessmentGap[];
  recommendations: AssessmentRecommendation[];
  matchedCapabilities: CloudCapability[];
  relevantMigrationPaths: MigrationPath[];
  estimatedTimeline: string;
  riskFactors: string[];
  nextSteps: string[];
}

// ============================================================================
// Environment Scanning Types (Phase 2 - Real Infrastructure Data)
// ============================================================================

export type InstanceType = 'cloud' | 'datacenter' | 'server';

/**
 * Detect instance type from URL
 */
export const detectInstanceType = (url: string): InstanceType => {
  const normalizedUrl = url.toLowerCase();
  if (normalizedUrl.includes('.atlassian.net')) {
    return 'cloud';
  }
  return 'datacenter';
};

/**
 * Get instance type label for display
 */
export const getInstanceTypeLabel = (type: InstanceType): string => {
  switch (type) {
    case 'cloud': return 'Atlassian Cloud';
    case 'datacenter': return 'Data Center';
    case 'server': return 'Server';
    default: return 'Unknown';
  }
};

/**
 * Get instance type color
 */
export const getInstanceTypeColor = (type: InstanceType): string => {
  switch (type) {
    case 'cloud': return '#0052CC';
    case 'datacenter': return '#6554C0';
    case 'server': return '#FF5630';
    default: return '#6B778C';
  }
};

export interface JiraCustomField {
  id: string;
  name: string;
  type: string;
  description?: string;
  isAllProjects: boolean;
  projectCount?: number;
  searcherKey?: string;
  isSystem: boolean;
}

export interface JiraWorkflow {
  id?: string;
  name: string;
  description?: string;
  isDefault: boolean;
  isSystem: boolean;
  steps: number;
  transitions: number;
  projectCount?: number;
  hasPostFunctions: boolean;
  hasValidators: boolean;
  hasConditions: boolean;
}

// Board information (JCMA: Jira Software Boards)
export interface JiraBoard {
  id: number;
  name: string;
  type: 'scrum' | 'kanban' | 'simple';
  projectKey?: string;
  projectName?: string;
  isPrivate: boolean;
  adminUsers?: string[];
  filterName?: string;
  filterId?: number;
  location?: string;
}

// Filter information (JCMA: Cross-project filters)
export interface JiraFilter {
  id: string;
  name: string;
  owner: string;
  jql: string;
  sharePermissions: { type: string; projectKey?: string; groupName?: string }[];
  isFavourite: boolean;
  isSharedGlobally: boolean;
}

// Screen information (JCMA: Screens)
export interface JiraScreen {
  id: number;
  name: string;
  description?: string;
  isDefault: boolean;
  tabs: { name: string; fieldCount: number }[];
}

// Issue type information (JCMA: Issue types)
export interface JiraIssueType {
  id: string;
  name: string;
  description?: string;
  iconUrl?: string;
  subtask: boolean;
  isDefault: boolean;
  hierarchyLevel: number;
  scope?: string;
}

// Permission scheme info (JCMA: Permission schemes)
export interface JiraPermissionScheme {
  id: number;
  name: string;
  description?: string;
  projectCount: number;
}

// Dashboard info (JCMA: Dashboards)
export interface JiraDashboard {
  id: string;
  name: string;
  owner?: string;
  isFavourite: boolean;
  sharePermissions: { type: string }[];
  gadgetCount: number;
}

// Priority info (JCMA: Priorities)
export interface JiraPriority {
  id: string;
  name: string;
  description?: string;
  iconUrl?: string;
  statusColor: string;
  isDefault: boolean;
}

// Status info (JCMA: Status category)
export interface JiraStatus {
  id: string;
  name: string;
  description?: string;
  statusCategory: {
    id: number;
    key: string;
    name: string;
    colorName: string;
  };
}

// Issue link type (JCMA: Issue links)
export interface JiraIssueLinkType {
  id: string;
  name: string;
  inward: string;
  outward: string;
}

// Resolution info
export interface JiraResolution {
  id: string;
  name: string;
  description?: string;
  isDefault: boolean;
}

export interface InstalledPlugin {
  key: string;
  name: string;
  version: string;
  vendor?: string;
  description?: string;
  enabled: boolean;
  userInstalled: boolean;
  cloudEquivalent?: {
    exists: boolean;
    name?: string;
    marketplaceUrl?: string;
    migrationNotes?: string;
  };
}

export interface ProjectInfo {
  key: string;
  name: string;
  projectTypeKey: string;
  lead?: string;
  issueCount?: number;
  lastUpdated?: string;
}

export interface ServerInfo {
  version: string;
  versionNumbers: number[];
  deploymentType: string;  // 'Cloud', 'DataCenter', 'Server'
  buildNumber: number;
  buildDate?: string;
  serverTitle?: string;
  baseUrl: string;
  cloudId?: string;  // For Cloud instances
  scimEnabled?: boolean;  // Cloud SCIM provisioning
}

export interface InstanceScanResult {
  serverInfo: ServerInfo;
  instanceType: InstanceType;
  users: {
    total: number;
    active: number;
    inactive: number;
    groups: { name: string; memberCount: number }[];
    // Cloud-specific
    managedAccounts?: number;
    externalUsers?: number;
  };
  projects: {
    total: number;
    byType: Record<string, number>;
    projects: ProjectInfo[];
  };
  customFields: {
    total: number;
    systemFields: number;
    customFields: number;
    fields: JiraCustomField[];
  };
  workflows: {
    total: number;
    systemWorkflows: number;
    customWorkflows: number;
    workflows: JiraWorkflow[];
  };
  plugins: {
    total: number;
    userInstalled: number;
    systemPlugins: number;
    plugins: InstalledPlugin[];
    cloudMigrationSummary: {
      readyToMigrate: number;
      needsAlternative: number;
      noCloudVersion: number;
    };
  };
  // JCMA-aligned additional entities
  boards?: {
    total: number;
    scrumBoards: number;
    kanbanBoards: number;
    boards: JiraBoard[];
  };
  filters?: {
    total: number;
    sharedFilters: number;
    privateFilters: number;
    filters: JiraFilter[];
  };
  screens?: {
    total: number;
    customScreens: number;
    screens: JiraScreen[];
  };
  issueTypes?: {
    total: number;
    standardTypes: number;
    subtaskTypes: number;
    issueTypes: JiraIssueType[];
  };
  permissionSchemes?: {
    total: number;
    schemes: JiraPermissionScheme[];
  };
  dashboards?: {
    total: number;
    sharedDashboards: number;
    dashboards: JiraDashboard[];
  };
  priorities?: {
    total: number;
    priorities: JiraPriority[];
  };
  statuses?: {
    total: number;
    statuses: JiraStatus[];
  };
  issueLinkTypes?: {
    total: number;
    linkTypes: JiraIssueLinkType[];
  };
  resolutions?: {
    total: number;
    resolutions: JiraResolution[];
  };
  // Cloud-specific: Automation rules
  automationRules?: {
    total: number;
    enabled: number;
    disabled: number;
    rules: {
      id: string;
      name: string;
      state: 'enabled' | 'disabled';
      ruleScope: string;
      actorType: string;
    }[];
  };
  // Cloud health metrics
  cloudHealth?: {
    apiUsage?: {
      remainingRequests: number;
      resetTime: string;
    };
    storageUsed?: number;
    storageLimit?: number;
    productAccess?: {
      product: string;
      tier: string;
      userLimit?: number;
    }[];
  };
  utilization: {
    issuesCreatedLast30Days?: number;
    issuesResolvedLast30Days?: number;
    activeUsersLast30Days?: number;
    peakConcurrentUsers?: number;
    storageUsedGB?: number;
  };
  scanTimestamp: string;
  scanDurationMs: number;
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
    overallMigrationReadiness: number;
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
    migrationReadinessScore: number;
    complexity: 'simple' | 'moderate' | 'complex' | 'very_complex';
    estimatedEffort: string;
    majorBlockers: string[];
    keyConsiderations: string[];
    recommendedApproach: string;
  };
}

export interface EnvironmentData {
  scanResult?: InstanceScanResult;
  analysis?: EnvironmentAnalysis;
  scannedAt?: string;
}

export interface AtlassianAssessment {
  id: string;
  companyName: string;
  meetingId?: string;
  questionnaireResponses?: QuestionnaireResponses;
  environmentData?: EnvironmentData;
  analysisResult?: AssessmentAnalysis;
  migrationScore?: number;
  urgencyLevel?: UrgencyLevel;
  gaps?: AssessmentGap[];
  recommendations?: AssessmentRecommendation[];
  status: AssessmentStatus;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  meeting?: {
    meetingId: string;
    title: string;
    meetingDate: string;
  };
}

export interface AssessmentSummary {
  id: string;
  companyName: string;
  status: AssessmentStatus;
  migrationScore: number | null;
  urgencyLevel: UrgencyLevel | null;
  migrationType?: MigrationType;
  isSaved?: boolean;
  createdAt: string;
  updatedAt: string;
}

// Helper functions
export const getUrgencyColor = (urgency: UrgencyLevel | null): 'error' | 'warning' | 'info' | 'success' | 'default' => {
  switch (urgency) {
    case 'critical':
      return 'error';
    case 'high':
      return 'warning';
    case 'medium':
      return 'info';
    case 'low':
      return 'success';
    default:
      return 'default';
  }
};

export const getScoreColor = (score: number | null): string => {
  if (score === null) return '#9e9e9e';
  if (score >= 70) return '#10b981';
  if (score >= 50) return '#f59e0b';
  if (score >= 30) return '#f97316';
  return '#ef4444';
};

export const getStatusLabel = (status: string): string => {
  switch (status) {
    case 'pending':
      return 'Not Started';
    case 'questionnaire':
      return 'In Progress';
    case 'analyzing':
      return 'Analyzing...';
    case 'completed':
      return 'Complete';
    case 'failed':
      return 'Failed';
    default:
      return status;
  }
};

// ============================================================================
// Questionnaire Metadata for Display
// ============================================================================

export const QUESTIONNAIRE_METADATA: Record<string, { question: string; category: string }> = {
  products_used: { question: 'Atlassian products in use', category: 'environment' },
  deployment_type: { question: 'Deployment type', category: 'environment' },
  user_count: { question: 'Total users', category: 'environment' },
  version_current: { question: 'Current version', category: 'environment' },
  apps_used: { question: 'Critical apps/add-ons', category: 'environment' },
  primary_use_cases: { question: 'Primary use cases', category: 'usage' },
  jql_complexity: { question: 'JQL complexity level', category: 'usage' },
  automation_usage: { question: 'Automation usage', category: 'usage' },
  integration_count: { question: 'External integrations', category: 'usage' },
  current_challenges: { question: 'Current challenges', category: 'painPoints' },
  upgrade_frequency: { question: 'Upgrade frequency', category: 'painPoints' },
  security_concerns: { question: 'Security concerns', category: 'painPoints' },
  must_have_features: { question: 'Desired Cloud features', category: 'requirements' },
  data_residency_required: { question: 'Data residency', category: 'requirements' },
  sso_requirements: { question: 'Identity requirements', category: 'requirements' },
  migration_urgency: { question: 'Migration urgency', category: 'timeline' },
  budget_constraints: { question: 'Budget constraints', category: 'timeline' },
  decision_timeline: { question: 'Decision timeline', category: 'timeline' },
};

export const CATEGORY_LABELS: Record<string, { title: string; icon: string }> = {
  environment: { title: 'Current Environment', icon: 'Storage' },
  usage: { title: 'Usage Patterns', icon: 'TrendingUp' },
  painPoints: { title: 'Challenges', icon: 'Warning' },
  requirements: { title: 'Requirements', icon: 'CheckCircle' },
  timeline: { title: 'Timeline', icon: 'Schedule' },
};

// ============================================================================
// Score Explanation Functions
// ============================================================================

export interface ScoreExplanation {
  factor: string;
  score: number;
  explanation: string;
  dataPoints: string[];
}

export const getScoreExplanations = (
  breakdown: MigrationScoreBreakdown,
  responses: QuestionnaireResponses
): ScoreExplanation[] => {
  const explanations: ScoreExplanation[] = [];

  // Infrastructure Readiness
  const infraDataPoints: string[] = [];
  if (responses.deployment_type) {
    infraDataPoints.push(`Deployment: ${responses.deployment_type}`);
  }
  if (responses.user_count) {
    infraDataPoints.push(`Users: ${responses.user_count}`);
  }
  explanations.push({
    factor: 'Infrastructure Readiness',
    score: breakdown.infrastructureReadiness,
    explanation: breakdown.infrastructureReadiness >= 70
      ? 'Your infrastructure setup is well-suited for Cloud migration.'
      : breakdown.infrastructureReadiness >= 50
      ? 'Some infrastructure adjustments may be needed for optimal migration.'
      : 'Significant infrastructure considerations required before migration.',
    dataPoints: infraDataPoints,
  });

  // Feature Compatibility
  const featureDataPoints: string[] = [];
  if (responses.automation_usage) {
    featureDataPoints.push(`Automation: ${responses.automation_usage}`);
  }
  if (responses.integration_count) {
    featureDataPoints.push(`Integrations: ${responses.integration_count}`);
  }
  if (responses.apps_used) {
    featureDataPoints.push(`Apps: ${responses.apps_used.substring(0, 50)}...`);
  }
  explanations.push({
    factor: 'Feature Compatibility',
    score: breakdown.featureCompatibility,
    explanation: breakdown.featureCompatibility >= 70
      ? 'Your current features map well to Cloud capabilities.'
      : breakdown.featureCompatibility >= 50
      ? 'Some features may need alternative approaches in Cloud.'
      : 'Heavy customization may require significant rework for Cloud.',
    dataPoints: featureDataPoints,
  });

  // Security & Compliance
  const securityDataPoints: string[] = [];
  if (responses.data_residency_required) {
    securityDataPoints.push(`Data residency: ${responses.data_residency_required}`);
  }
  if (responses.sso_requirements && responses.sso_requirements.length > 0) {
    securityDataPoints.push(`SSO: ${Array.isArray(responses.sso_requirements) ? responses.sso_requirements.join(', ') : responses.sso_requirements}`);
  }
  if (responses.security_concerns && responses.security_concerns.length > 0) {
    securityDataPoints.push(`Concerns: ${Array.isArray(responses.security_concerns) ? responses.security_concerns.join(', ') : responses.security_concerns}`);
  }
  explanations.push({
    factor: 'Security & Compliance',
    score: breakdown.securityCompliance,
    explanation: breakdown.securityCompliance >= 70
      ? 'Cloud meets your security and compliance requirements.'
      : breakdown.securityCompliance >= 50
      ? 'Most requirements are met; verify specific compliance needs.'
      : 'Critical data residency or compliance constraints may limit options.',
    dataPoints: securityDataPoints,
  });

  // Business Urgency
  const urgencyDataPoints: string[] = [];
  if (responses.migration_urgency) {
    urgencyDataPoints.push(`Urgency: ${responses.migration_urgency}`);
  }
  if (responses.current_challenges && responses.current_challenges.length > 0) {
    urgencyDataPoints.push(`${responses.current_challenges.length} challenges identified`);
  }
  explanations.push({
    factor: 'Business Urgency',
    score: breakdown.businessUrgency,
    explanation: breakdown.businessUrgency >= 70
      ? 'Strong business drivers support immediate migration action.'
      : breakdown.businessUrgency >= 50
      ? 'Moderate business case for migration within planning horizon.'
      : 'Migration is optional; no immediate business pressure.',
    dataPoints: urgencyDataPoints,
  });

  // Complexity Risk (inverted - lower is better)
  const complexityDataPoints: string[] = [];
  if (responses.automation_usage === 'Custom Groovy scripts throughout') {
    complexityDataPoints.push('Heavy Groovy scripting');
  }
  if (responses.integration_count === '15+') {
    complexityDataPoints.push('15+ integrations');
  }
  if (responses.user_count === '5000+') {
    complexityDataPoints.push('Large user base (5000+)');
  }
  explanations.push({
    factor: 'Complexity Risk',
    score: 100 - breakdown.complexityRisk, // Invert for display (higher = better/less complex)
    explanation: breakdown.complexityRisk <= 30
      ? 'Low complexity - straightforward migration expected.'
      : breakdown.complexityRisk <= 50
      ? 'Moderate complexity - plan for phased migration approach.'
      : 'High complexity - consider pilot migration and detailed assessment.',
    dataPoints: complexityDataPoints.length > 0 ? complexityDataPoints : ['Standard complexity'],
  });

  return explanations;
};
