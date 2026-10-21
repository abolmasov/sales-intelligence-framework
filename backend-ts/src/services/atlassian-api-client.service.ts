/**
 * Atlassian API Client Service
 *
 * Connects to customer Atlassian instances (Cloud, DC, or Server) to fetch real infrastructure data:
 * - Custom fields, workflows, users
 * - Installed apps/plugins
 * - Utilization patterns
 * - Configuration and metadata
 *
 * Automatically detects instance type from URL and uses appropriate APIs
 */

import { getPrismaClient } from '../config/database';
import { getEncryptionService } from '../utils/encryption';
import { EventEmitter } from 'events';

const prisma = getPrismaClient();
const encryptionService = getEncryptionService();

// ============================================================================
// SCAN LOGGING
// ============================================================================

export interface ScanLogEntry {
  timestamp: string;
  type: 'info' | 'success' | 'error' | 'api_call' | 'progress';
  message: string;
  endpoint?: string;
  duration?: number;
  details?: Record<string, any>;
}

// Global event emitter for scan logs
export const scanLogEmitter = new EventEmitter();
scanLogEmitter.setMaxListeners(100);

// In-memory log store per assessment (cleared after scan completes)
const scanLogs: Map<string, ScanLogEntry[]> = new Map();

function emitScanLog(assessmentId: string, entry: ScanLogEntry) {
  // Store in memory
  if (!scanLogs.has(assessmentId)) {
    scanLogs.set(assessmentId, []);
  }
  scanLogs.get(assessmentId)!.push(entry);

  // Emit for SSE listeners
  scanLogEmitter.emit(`scan:${assessmentId}`, entry);
}

export function getScanLogs(assessmentId: string): ScanLogEntry[] {
  return scanLogs.get(assessmentId) || [];
}

export function clearScanLogs(assessmentId: string) {
  scanLogs.delete(assessmentId);
}

// ============================================================================
// TYPES
// ============================================================================

export type InstanceType = 'cloud' | 'datacenter' | 'server';
export type ProductType = 'jira' | 'confluence' | 'jira_dc' | 'jira_server' | 'confluence_dc' | 'confluence_server' | 'jira_cloud' | 'confluence_cloud';

export interface AtlassianInstance {
  url: string;
  username: string;  // Email for Cloud, username for DC/Server
  apiToken: string;
  productType: ProductType;
  instanceType?: InstanceType;  // Auto-detected or specified
  cloudId?: string;  // For Cloud instances
}

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

export interface JiraUser {
  key: string;
  name: string;
  displayName: string;
  emailAddress?: string;
  active: boolean;
  lastActive?: string;
  groups: string[];
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
  workflowScheme?: string;
  permissionScheme?: string;
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
  atlassianAccountId?: string;  // Cloud account ID
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

// Filter information (JCMA: Cross-project filters, Filters on boards)
export interface JiraFilter {
  id: string;
  name: string;
  owner: string;
  jql: string;
  sharePermissions: { type: string; projectKey?: string; groupName?: string }[];
  isFavourite: boolean;
  isSharedGlobally: boolean;
}

// Screen information (JCMA: Screens, Screen schemes)
export interface JiraScreen {
  id: number;
  name: string;
  description?: string;
  isDefault: boolean;
  tabs: { name: string; fieldCount: number }[];
}

// Issue type information (JCMA: Issue types, Issue type schemes)
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

// Notification scheme info (JCMA: Notification schemes)
export interface JiraNotificationScheme {
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

// Priority info (JCMA: Priorities and priority schemes)
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
  notificationSchemes?: {
    total: number;
    schemes: JiraNotificationScheme[];
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

// Cloud equivalent database for common plugins
const PLUGIN_CLOUD_MAPPING: Record<string, { exists: boolean; name?: string; notes?: string }> = {
  'com.atlassian.jira.plugins.jira-workflow-designer': {
    exists: true,
    name: 'Native Workflow Editor',
    notes: 'Built into Jira Cloud'
  },
  'com.onresolve.jira.groovy.groovyrunner': {
    exists: true,
    name: 'ScriptRunner for Jira Cloud',
    notes: 'Cloud version has some limitations on Groovy'
  },
  'com.atlassian.jira.ext.charting': {
    exists: true,
    name: 'Native Jira Cloud Dashboards',
    notes: 'Built-in gadgets and charts'
  },
  'com.tempoplugin.tempo-teams': {
    exists: true,
    name: 'Tempo Timesheets Cloud',
    notes: 'Full cloud version available'
  },
  'com.pyxis.greenhopper.jira': {
    exists: true,
    name: 'Jira Software (Agile)',
    notes: 'Built into Jira Cloud'
  },
  'com.atlassian.jira.plugins.jira-importers-plugin': {
    exists: true,
    name: 'Native Import Tools',
    notes: 'Cloud Migration Assistant'
  },
  'com.atlassian.jira.jira-mail-plugin': {
    exists: true,
    name: 'Native Email Integration',
    notes: 'Built into Jira Cloud'
  },
  'com.atlassian.plugins.atlassian-connect-plugin': {
    exists: true,
    name: 'Atlassian Connect',
    notes: 'Cloud-native app framework'
  },
  'com.atlassian.jira.plugins.jira-capture-plugin': {
    exists: true,
    name: 'Capture for Jira Cloud',
    notes: 'Available in Cloud'
  },
  'com.riadalabs.jira.plugins.insight': {
    exists: true,
    name: 'Assets (formerly Insight)',
    notes: 'Included in Jira Service Management Cloud'
  },
  'com.atlassian.servicedesk': {
    exists: true,
    name: 'Jira Service Management Cloud',
    notes: 'Full cloud version with enhanced features'
  },
  'com.adaptavist.labs.plugins.jmwe': {
    exists: true,
    name: 'JWT (Jira Workflow Toolbox) Cloud',
    notes: 'Cloud version available'
  },
  'eazybi.jira': {
    exists: true,
    name: 'eazyBI Reports and Charts Cloud',
    notes: 'Full cloud version available'
  },
  'com.xpandit.plugins.xray': {
    exists: true,
    name: 'Xray Test Management Cloud',
    notes: 'Cloud version with some feature differences'
  },
  'com.atlassian.confluence.plugins.confluence-questions': {
    exists: true,
    name: 'Confluence Questions',
    notes: 'Built into Confluence Cloud'
  }
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Detect instance type from URL
 */
function detectInstanceType(url: string): InstanceType {
  const normalizedUrl = url.toLowerCase();
  if (normalizedUrl.includes('.atlassian.net')) {
    return 'cloud';
  }
  // Could also check for specific DC indicators, but default to datacenter for self-hosted
  return 'datacenter';
}

/**
 * Normalize product type to internal format
 */
function normalizeProductType(productType: ProductType, instanceType: InstanceType): 'jira' | 'confluence' {
  const pt = productType.toLowerCase();
  if (pt.includes('jira')) return 'jira';
  if (pt.includes('confluence')) return 'confluence';
  return 'jira'; // Default
}

/**
 * Get Cloud ID from site URL
 */
async function getCloudId(siteUrl: string, email: string, apiToken: string): Promise<string | null> {
  try {
    const authString = Buffer.from(`${email}:${apiToken}`).toString('base64');
    const response = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
      headers: {
        'Authorization': `Basic ${authString}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      // Try alternative method - extract from site directly
      const siteMatch = siteUrl.match(/https?:\/\/([^.]+)\.atlassian\.net/);
      if (siteMatch) {
        // For basic auth with Cloud, we can use the site URL directly
        return null; // Will use site URL instead
      }
      return null;
    }

    const resources = await response.json() as { id: string; url: string }[];
    const siteName = siteUrl.match(/https?:\/\/([^.]+)\.atlassian\.net/)?.[1];

    for (const resource of resources) {
      if (resource.url.includes(siteName || '')) {
        return resource.id;
      }
    }

    return resources[0]?.id || null;
  } catch (error) {
    console.error('Error getting Cloud ID:', error);
    return null;
  }
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

class AtlassianApiClientService {
  private currentAssessmentId: string | null = null;

  /**
   * Set the current assessment ID for logging
   */
  setAssessmentId(assessmentId: string | null) {
    this.currentAssessmentId = assessmentId;
  }

  /**
   * Log a scan event
   */
  private log(type: ScanLogEntry['type'], message: string, details?: Partial<ScanLogEntry>) {
    if (this.currentAssessmentId) {
      emitScanLog(this.currentAssessmentId, {
        timestamp: new Date().toISOString(),
        type,
        message,
        ...details
      });
    }
    // Also log to console
    console.log(`[Scan ${type}] ${message}`, details?.endpoint ? `- ${details.endpoint}` : '');
  }

  /**
   * Detect and return instance type for a given URL
   */
  detectInstanceType(url: string): InstanceType {
    return detectInstanceType(url);
  }

  /**
   * Test connection to an Atlassian instance (Cloud or DC/Server)
   */
  async testConnection(instance: AtlassianInstance): Promise<{
    success: boolean;
    serverInfo?: ServerInfo;
    instanceType?: InstanceType;
    error?: string;
  }> {
    try {
      const instanceType = instance.instanceType || detectInstanceType(instance.url);
      const serverInfo = await this.getServerInfo({ ...instance, instanceType });
      return { success: true, serverInfo, instanceType };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to connect to instance'
      };
    }
  }

  /**
   * Store credentials for an assessment
   */
  async storeCredentials(
    assessmentId: string,
    companyName: string,
    instance: AtlassianInstance
  ): Promise<string> {
    const encryptedToken = encryptionService.encrypt(instance.apiToken);

    if (!encryptedToken) {
      throw new Error('Failed to encrypt API token');
    }

    const credential = await prisma.atlassianCredential.create({
      data: {
        assessmentId,
        companyName,
        instanceUrl: instance.url,
        username: instance.username,
        apiTokenEnc: new Uint8Array(encryptedToken),
        productType: instance.productType,
        isValid: true,
        lastTestedAt: new Date()
      }
    });

    return credential.id;
  }

  /**
   * Get stored credentials for an assessment
   */
  async getCredentials(assessmentId: string): Promise<AtlassianInstance[]> {
    const credentials = await prisma.atlassianCredential.findMany({
      where: { assessmentId, isValid: true }
    });

    return credentials.map(cred => ({
      url: cred.instanceUrl,
      username: cred.username || '',
      apiToken: encryptionService.decrypt(Buffer.from(cred.apiTokenEnc)) || '',
      productType: cred.productType as AtlassianInstance['productType']
    }));
  }

  /**
   * Perform a full environment scan (auto-detects Cloud vs DC/Server)
   */
  async scanEnvironment(instance: AtlassianInstance): Promise<InstanceScanResult> {
    const startTime = Date.now();
    const instanceType = instance.instanceType || detectInstanceType(instance.url);
    const enrichedInstance = { ...instance, instanceType };

    if (instanceType === 'cloud') {
      return this.scanCloudEnvironment(enrichedInstance, startTime);
    } else {
      return this.scanDCServerEnvironment(enrichedInstance, startTime);
    }
  }

  /**
   * Scan Cloud instance
   */
  private async scanCloudEnvironment(
    instance: AtlassianInstance & { instanceType: InstanceType },
    startTime: number
  ): Promise<InstanceScanResult> {
    this.log('info', '🔍 Starting Cloud environment scan...', { details: { url: instance.url } });
    this.log('progress', 'Phase 1/4: Scanning core entities (Server Info, Users, Projects, Custom Fields, Workflows, Apps)');

    // Run core scans in parallel
    const [serverInfo, users, projects, customFields, workflows, plugins] = await Promise.all([
      this.getCloudServerInfo(instance),
      this.scanCloudUsers(instance),
      this.scanCloudProjects(instance),
      this.scanCloudCustomFields(instance),
      this.scanCloudWorkflows(instance),
      this.scanCloudApps(instance)
    ]);

    this.log('info', `✓ Core scan complete: ${users.total} users, ${projects.total} projects, ${customFields.customFields} custom fields`);
    this.log('progress', 'Phase 2/4: Scanning JCMA entities (Boards, Filters, Screens, Issue Types, Schemes, Dashboards, etc.)');

    // Run JCMA-aligned additional scans in parallel
    const [
      boards,
      filters,
      screens,
      issueTypes,
      permissionSchemes,
      dashboards,
      priorities,
      statuses,
      issueLinkTypes,
      resolutions,
      automationRules
    ] = await Promise.all([
      this.scanCloudBoards(instance),
      this.scanCloudFilters(instance),
      this.scanCloudScreens(instance),
      this.scanCloudIssueTypes(instance),
      this.scanCloudPermissionSchemes(instance),
      this.scanCloudDashboards(instance),
      this.scanCloudPriorities(instance),
      this.scanCloudStatuses(instance),
      this.scanCloudIssueLinkTypes(instance),
      this.scanCloudResolutions(instance),
      this.scanCloudAutomation(instance)
    ]);

    this.log('info', `✓ JCMA entities scan complete: ${boards?.total || 0} boards, ${filters?.total || 0} filters, ${issueTypes?.total || 0} issue types`);
    this.log('progress', 'Phase 3/4: Fetching utilization metrics');

    // Get utilization metrics
    const utilization = await this.getCloudUtilizationMetrics(instance);

    this.log('progress', 'Phase 4/4: Fetching cloud health metrics');

    // Get cloud health metrics
    const cloudHealth = await this.getCloudHealthMetrics(instance);

    const scanDurationMs = Date.now() - startTime;
    this.log('success', `🎉 Scan completed in ${(scanDurationMs / 1000).toFixed(1)}s`, { duration: scanDurationMs });

    return {
      serverInfo,
      instanceType: 'cloud',
      users,
      projects,
      customFields,
      workflows,
      plugins,
      boards,
      filters,
      screens,
      issueTypes,
      permissionSchemes,
      dashboards,
      priorities,
      statuses,
      issueLinkTypes,
      resolutions,
      automationRules,
      cloudHealth,
      utilization,
      scanTimestamp: new Date().toISOString(),
      scanDurationMs
    };
  }

  /**
   * Scan DC/Server instance
   */
  private async scanDCServerEnvironment(
    instance: AtlassianInstance & { instanceType: InstanceType },
    startTime: number
  ): Promise<InstanceScanResult> {
    // Run scans in parallel where possible
    const [serverInfo, users, projects, customFields, workflows, plugins] = await Promise.all([
      this.getServerInfo(instance),
      this.scanUsers(instance),
      this.scanProjects(instance),
      this.scanCustomFields(instance),
      this.scanWorkflows(instance),
      this.scanPlugins(instance)
    ]);

    // Get utilization metrics
    const utilization = await this.getUtilizationMetrics(instance);

    return {
      serverInfo,
      instanceType: instance.instanceType,
      users,
      projects,
      customFields,
      workflows,
      plugins,
      utilization,
      scanTimestamp: new Date().toISOString(),
      scanDurationMs: Date.now() - startTime
    };
  }

  /**
   * Get server info
   */
  private async getServerInfo(instance: AtlassianInstance): Promise<ServerInfo> {
    const response = await this.makeRequest(instance, '/rest/api/2/serverInfo');

    return {
      version: response.version,
      versionNumbers: response.versionNumbers || [],
      deploymentType: response.deploymentType || 'Server',
      buildNumber: response.buildNumber,
      buildDate: response.buildDate,
      serverTitle: response.serverTitle,
      baseUrl: response.baseUrl
    };
  }

  /**
   * Scan users
   */
  private async scanUsers(instance: AtlassianInstance): Promise<InstanceScanResult['users']> {
    // Get all users (paginated)
    const users: JiraUser[] = [];
    let startAt = 0;
    const maxResults = 1000;

    try {
      while (true) {
        const response = await this.makeRequest(
          instance,
          `/rest/api/2/user/search?startAt=${startAt}&maxResults=${maxResults}&username=.`
        );

        if (!response || response.length === 0) break;

        users.push(...response.map((u: any) => ({
          key: u.key,
          name: u.name,
          displayName: u.displayName,
          emailAddress: u.emailAddress,
          active: u.active,
          groups: []
        })));

        if (response.length < maxResults) break;
        startAt += maxResults;
      }
    } catch (error) {
      console.error('Error scanning users:', error);
    }

    // Get groups
    const groups: { name: string; memberCount: number }[] = [];
    try {
      const groupsResponse = await this.makeRequest(instance, '/rest/api/2/groups/picker');
      if (groupsResponse.groups) {
        for (const group of groupsResponse.groups.slice(0, 50)) {
          try {
            const membersResponse = await this.makeRequest(
              instance,
              `/rest/api/2/group/member?groupname=${encodeURIComponent(group.name)}&maxResults=0`
            );
            groups.push({
              name: group.name,
              memberCount: membersResponse.total || 0
            });
          } catch {
            groups.push({ name: group.name, memberCount: 0 });
          }
        }
      }
    } catch (error) {
      console.error('Error scanning groups:', error);
    }

    const activeUsers = users.filter(u => u.active);
    const inactiveUsers = users.filter(u => !u.active);

    return {
      total: users.length,
      active: activeUsers.length,
      inactive: inactiveUsers.length,
      groups
    };
  }

  /**
   * Scan projects
   */
  private async scanProjects(instance: AtlassianInstance): Promise<InstanceScanResult['projects']> {
    const projects: ProjectInfo[] = [];
    const byType: Record<string, number> = {};

    try {
      let startAt = 0;
      const maxResults = 50;

      while (true) {
        const response = await this.makeRequest(
          instance,
          `/rest/api/2/project/search?startAt=${startAt}&maxResults=${maxResults}&expand=lead`
        );

        if (!response.values || response.values.length === 0) break;

        for (const project of response.values) {
          const projectType = project.projectTypeKey || 'business';
          byType[projectType] = (byType[projectType] || 0) + 1;

          projects.push({
            key: project.key,
            name: project.name,
            projectTypeKey: projectType,
            lead: project.lead?.displayName
          });
        }

        if (response.values.length < maxResults) break;
        startAt += maxResults;
      }
    } catch (error) {
      console.error('Error scanning projects:', error);
    }

    return {
      total: projects.length,
      byType,
      projects: projects.slice(0, 100) // Limit for response size
    };
  }

  /**
   * Scan custom fields
   */
  private async scanCustomFields(instance: AtlassianInstance): Promise<InstanceScanResult['customFields']> {
    const fields: JiraCustomField[] = [];

    try {
      const response = await this.makeRequest(instance, '/rest/api/2/field');

      for (const field of response) {
        const isSystem = !field.custom;

        fields.push({
          id: field.id,
          name: field.name,
          type: field.schema?.type || field.schema?.custom || 'unknown',
          description: field.description,
          isAllProjects: field.scope?.type === 'GLOBAL',
          searcherKey: field.searcherKey,
          isSystem
        });
      }
    } catch (error) {
      console.error('Error scanning custom fields:', error);
    }

    const systemFields = fields.filter(f => f.isSystem);
    const customFields = fields.filter(f => !f.isSystem);

    return {
      total: fields.length,
      systemFields: systemFields.length,
      customFields: customFields.length,
      fields: customFields // Only return custom fields
    };
  }

  /**
   * Scan workflows
   */
  private async scanWorkflows(instance: AtlassianInstance): Promise<InstanceScanResult['workflows']> {
    const workflows: JiraWorkflow[] = [];

    try {
      const response = await this.makeRequest(instance, '/rest/api/2/workflow');

      for (const workflow of response) {
        const isSystem = workflow.name.startsWith('jira') || workflow.default;

        // Get workflow details
        let steps = 0;
        let transitions = 0;
        let hasPostFunctions = false;
        let hasValidators = false;
        let hasConditions = false;

        try {
          const detailResponse = await this.makeRequest(
            instance,
            `/rest/api/2/workflow/${encodeURIComponent(workflow.name)}/transitions`
          );

          if (detailResponse.transitions) {
            transitions = detailResponse.transitions.length;
            steps = new Set(detailResponse.transitions.flatMap((t: any) => [t.from, t.to])).size;

            for (const transition of detailResponse.transitions) {
              if (transition.rules?.postFunctions?.length > 0) hasPostFunctions = true;
              if (transition.rules?.validators?.length > 0) hasValidators = true;
              if (transition.rules?.conditions?.configuration) hasConditions = true;
            }
          }
        } catch {
          // Some workflows may not be accessible
        }

        workflows.push({
          name: workflow.name,
          description: workflow.description,
          isDefault: workflow.default || false,
          isSystem,
          steps,
          transitions,
          hasPostFunctions,
          hasValidators,
          hasConditions
        });
      }
    } catch (error) {
      console.error('Error scanning workflows:', error);
    }

    const systemWorkflows = workflows.filter(w => w.isSystem);
    const customWorkflows = workflows.filter(w => !w.isSystem);

    return {
      total: workflows.length,
      systemWorkflows: systemWorkflows.length,
      customWorkflows: customWorkflows.length,
      workflows: customWorkflows // Only return custom workflows
    };
  }

  /**
   * Scan installed plugins
   */
  private async scanPlugins(instance: AtlassianInstance): Promise<InstanceScanResult['plugins']> {
    const plugins: InstalledPlugin[] = [];

    try {
      // Get UPM plugin list
      const response = await this.makeRequest(
        instance,
        '/rest/plugins/1.0/',
        { Accept: 'application/vnd.atl.plugins.installed+json' }
      );

      if (response.plugins) {
        for (const plugin of response.plugins) {
          const cloudMapping = PLUGIN_CLOUD_MAPPING[plugin.key];

          plugins.push({
            key: plugin.key,
            name: plugin.name,
            version: plugin.version,
            vendor: plugin.vendor?.name,
            description: plugin.description,
            enabled: plugin.enabled !== false,
            userInstalled: plugin.userInstalled !== false,
            cloudEquivalent: cloudMapping ? {
              exists: cloudMapping.exists,
              name: cloudMapping.name,
              migrationNotes: cloudMapping.notes
            } : undefined
          });
        }
      }
    } catch (error) {
      console.error('Error scanning plugins:', error);
    }

    const userInstalledPlugins = plugins.filter(p => p.userInstalled);
    const systemPlugins = plugins.filter(p => !p.userInstalled);

    // Calculate cloud migration summary
    let readyToMigrate = 0;
    let needsAlternative = 0;
    let noCloudVersion = 0;

    for (const plugin of userInstalledPlugins) {
      if (plugin.cloudEquivalent?.exists) {
        readyToMigrate++;
      } else {
        // Check marketplace (simplified - in production would query marketplace API)
        noCloudVersion++;
      }
    }

    return {
      total: plugins.length,
      userInstalled: userInstalledPlugins.length,
      systemPlugins: systemPlugins.length,
      plugins: userInstalledPlugins, // Only return user-installed plugins
      cloudMigrationSummary: {
        readyToMigrate,
        needsAlternative,
        noCloudVersion
      }
    };
  }

  /**
   * Get utilization metrics (DC/Server)
   */
  private async getUtilizationMetrics(
    instance: AtlassianInstance
  ): Promise<InstanceScanResult['utilization']> {
    const metrics: InstanceScanResult['utilization'] = {};

    try {
      // Get issues created in last 30 days
      const createdJql = 'created >= -30d';
      const createdResponse = await this.makeRequest(
        instance,
        `/rest/api/2/search?jql=${encodeURIComponent(createdJql)}&maxResults=0`
      );
      metrics.issuesCreatedLast30Days = createdResponse.total;

      // Get issues resolved in last 30 days
      const resolvedJql = 'resolved >= -30d';
      const resolvedResponse = await this.makeRequest(
        instance,
        `/rest/api/2/search?jql=${encodeURIComponent(resolvedJql)}&maxResults=0`
      );
      metrics.issuesResolvedLast30Days = resolvedResponse.total;
    } catch (error) {
      console.error('Error getting utilization metrics:', error);
    }

    return metrics;
  }

  // ============================================================================
  // CLOUD-SPECIFIC METHODS
  // ============================================================================

  /**
   * Get Cloud server info (uses Cloud API v3)
   */
  private async getCloudServerInfo(instance: AtlassianInstance): Promise<ServerInfo> {
    // Cloud uses API v3 for server info
    const response = await this.makeCloudRequest(instance, '/rest/api/3/serverInfo');

    return {
      version: response.version,
      versionNumbers: response.versionNumbers || [],
      deploymentType: 'Cloud',
      buildNumber: response.buildNumber || 0,
      buildDate: response.buildDate,
      serverTitle: response.serverTitle || 'Atlassian Cloud',
      baseUrl: response.baseUrl || instance.url,
      cloudId: response.cloudId,
      scimEnabled: response.scimInfo?.isEnabled
    };
  }

  /**
   * Scan Cloud users
   */
  private async scanCloudUsers(instance: AtlassianInstance): Promise<InstanceScanResult['users']> {
    const users: JiraUser[] = [];
    let startAt = 0;
    const maxResults = 100;

    try {
      while (true) {
        // Cloud uses different user search endpoint
        const response = await this.makeCloudRequest(
          instance,
          `/rest/api/3/users/search?startAt=${startAt}&maxResults=${maxResults}`
        );

        if (!response || response.length === 0) break;

        users.push(...response.map((u: any) => ({
          key: u.accountId,
          name: u.displayName,
          displayName: u.displayName,
          emailAddress: u.emailAddress,
          active: u.active,
          groups: []
        })));

        if (response.length < maxResults) break;
        startAt += maxResults;
      }
    } catch (error) {
      console.error('Error scanning cloud users:', error);
    }

    // Get groups via Cloud API with member counts
    const groups: { name: string; memberCount: number }[] = [];
    try {
      const groupsResponse = await this.makeCloudRequest(instance, '/rest/api/3/group/bulk?maxResults=100');
      if (groupsResponse.values) {
        // Fetch member count for each group (in batches to avoid rate limiting)
        const groupsToFetch = groupsResponse.values.slice(0, 50);
        for (const group of groupsToFetch) {
          let memberCount = 0;
          try {
            // Get group members to get accurate count
            const membersResponse = await this.makeCloudRequest(
              instance,
              `/rest/api/3/group/member?groupname=${encodeURIComponent(group.name)}&maxResults=0`
            );
            memberCount = membersResponse.total || membersResponse.values?.length || 0;
          } catch (memberError) {
            // If we can't get members, try alternative approach
            console.error(`Error getting members for group ${group.name}:`, memberError);
          }
          groups.push({
            name: group.name,
            memberCount
          });
        }
      }
    } catch (error) {
      console.error('Error scanning cloud groups:', error);
    }

    const activeUsers = users.filter(u => u.active);
    const inactiveUsers = users.filter(u => !u.active);

    return {
      total: users.length,
      active: activeUsers.length,
      inactive: inactiveUsers.length,
      groups,
      managedAccounts: activeUsers.length, // In Cloud, all are managed
    };
  }

  /**
   * Scan Cloud projects
   */
  private async scanCloudProjects(instance: AtlassianInstance): Promise<InstanceScanResult['projects']> {
    const projects: ProjectInfo[] = [];
    const byType: Record<string, number> = {};

    try {
      let startAt = 0;
      const maxResults = 50;

      while (true) {
        const response = await this.makeCloudRequest(
          instance,
          `/rest/api/3/project/search?startAt=${startAt}&maxResults=${maxResults}&expand=lead`
        );

        if (!response.values || response.values.length === 0) break;

        for (const project of response.values) {
          const projectType = project.projectTypeKey || 'business';
          byType[projectType] = (byType[projectType] || 0) + 1;

          projects.push({
            key: project.key,
            name: project.name,
            projectTypeKey: projectType,
            lead: project.lead?.displayName
          });
        }

        if (response.values.length < maxResults) break;
        startAt += maxResults;
      }
    } catch (error) {
      console.error('Error scanning cloud projects:', error);
    }

    return {
      total: projects.length,
      byType,
      projects: projects.slice(0, 100)
    };
  }

  /**
   * Scan Cloud custom fields
   */
  private async scanCloudCustomFields(instance: AtlassianInstance): Promise<InstanceScanResult['customFields']> {
    const fields: JiraCustomField[] = [];

    try {
      const response = await this.makeCloudRequest(instance, '/rest/api/3/field');

      for (const field of response) {
        const isSystem = !field.custom;

        fields.push({
          id: field.id,
          name: field.name,
          type: field.schema?.type || field.schema?.custom || 'unknown',
          description: field.description,
          isAllProjects: field.scope?.type === 'GLOBAL',
          searcherKey: field.searcherKey,
          isSystem
        });
      }
    } catch (error) {
      console.error('Error scanning cloud custom fields:', error);
    }

    const systemFields = fields.filter(f => f.isSystem);
    const customFields = fields.filter(f => !f.isSystem);

    return {
      total: fields.length,
      systemFields: systemFields.length,
      customFields: customFields.length,
      fields: customFields
    };
  }

  /**
   * Scan Cloud workflows
   */
  private async scanCloudWorkflows(instance: AtlassianInstance): Promise<InstanceScanResult['workflows']> {
    const workflows: JiraWorkflow[] = [];

    try {
      // Cloud uses paginated workflow search
      const response = await this.makeCloudRequest(
        instance,
        '/rest/api/3/workflow/search?maxResults=100'
      );

      if (response.values) {
        for (const workflow of response.values) {
          const isSystem = workflow.scope?.type === 'GLOBAL' && !workflow.isEditable;

          workflows.push({
            id: workflow.id?.uuid,
            name: workflow.name,
            description: workflow.description || '',
            isDefault: workflow.isDefault || false,
            isSystem,
            steps: workflow.statuses?.length || 0,
            transitions: workflow.transitions?.length || 0,
            hasPostFunctions: false, // Cloud has different automation model
            hasValidators: false,
            hasConditions: false
          });
        }
      }
    } catch (error) {
      console.error('Error scanning cloud workflows:', error);
    }

    const systemWorkflows = workflows.filter(w => w.isSystem);
    const customWorkflows = workflows.filter(w => !w.isSystem);

    return {
      total: workflows.length,
      systemWorkflows: systemWorkflows.length,
      customWorkflows: customWorkflows.length,
      workflows: customWorkflows
    };
  }

  /**
   * Scan Cloud apps (Connect and Forge apps)
   * Uses multiple endpoints to capture all installed apps
   */
  private async scanCloudApps(instance: AtlassianInstance): Promise<InstanceScanResult['plugins']> {
    const plugins: InstalledPlugin[] = [];
    const seenKeys = new Set<string>();

    // Method 1: Try the connect addons endpoint
    try {
      const response = await this.makeCloudRequest(
        instance,
        '/rest/atlassian-connect/1/addons'
      );

      if (response && Array.isArray(response)) {
        for (const addon of response) {
          if (!seenKeys.has(addon.key)) {
            seenKeys.add(addon.key);
            plugins.push({
              key: addon.key,
              name: addon.name || addon.key,
              version: addon.version || 'Cloud',
              vendor: addon.vendor?.name,
              description: addon.description,
              enabled: addon.state === 'ENABLED',
              userInstalled: true,
              cloudEquivalent: {
                exists: true,
                name: addon.name,
                migrationNotes: 'Already running in Cloud'
              }
            });
          }
        }
      }
    } catch (error) {
      console.error('Error getting connect apps:', error);
    }

    // Method 2: Try getting app fields (apps that add custom fields)
    try {
      const response = await this.makeCloudRequest(
        instance,
        '/rest/api/3/field'
      );

      if (response && Array.isArray(response)) {
        for (const field of response) {
          // App-provided fields have schema.custom that includes the app key
          if (field.schema?.custom && field.custom) {
            const customType = field.schema.custom;
            // Extract app key from custom field type (format: com.vendor.app:field-type)
            const appKeyMatch = customType.match(/^([^:]+):/);
            if (appKeyMatch) {
              const appKey = appKeyMatch[1];
              // Skip Atlassian's own fields
              if (!appKey.startsWith('com.atlassian') && !seenKeys.has(appKey)) {
                seenKeys.add(appKey);
                plugins.push({
                  key: appKey,
                  name: appKey.split('.').pop() || appKey,
                  version: 'Cloud',
                  enabled: true,
                  userInstalled: true,
                  cloudEquivalent: {
                    exists: true,
                    migrationNotes: 'App detected via custom field'
                  }
                });
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error scanning app fields:', error);
    }

    // Method 3: Try to get installed apps via ecosystem API
    try {
      const response = await this.makeCloudRequest(
        instance,
        '/rest/api/3/applicationProperty'
      );
      // This endpoint may list some app configurations
    } catch (error) {
      // This endpoint may not be accessible
    }

    // Method 4: Check for common marketplace apps via their known endpoints
    const knownApps = [
      { key: 'com.onresolve.jira.groovy.groovyrunner', name: 'ScriptRunner', endpoint: '/rest/scriptrunner/latest/custom/project' },
      { key: 'com.tempoplugin.tempo-teams', name: 'Tempo Timesheets', endpoint: '/rest/tempo-timesheets/4/worklogs' },
      { key: 'com.riadalabs.jira.plugins.insight', name: 'Assets/Insight', endpoint: '/rest/insight/1.0/objecttype' },
      { key: 'com.xpandit.plugins.xray', name: 'Xray Test Management', endpoint: '/rest/raven/1.0/api/testrun' },
      { key: 'com.kanoah.test-manager', name: 'Zephyr Scale', endpoint: '/rest/tests/1.0/project' },
    ];

    for (const app of knownApps) {
      if (!seenKeys.has(app.key)) {
        try {
          await this.makeCloudRequest(instance, app.endpoint);
          // If we get here without error, the app is installed
          seenKeys.add(app.key);
          const cloudMapping = PLUGIN_CLOUD_MAPPING[app.key];
          plugins.push({
            key: app.key,
            name: app.name,
            version: 'Cloud',
            enabled: true,
            userInstalled: true,
            cloudEquivalent: cloudMapping ? {
              exists: cloudMapping.exists,
              name: cloudMapping.name,
              migrationNotes: cloudMapping.notes
            } : {
              exists: true,
              migrationNotes: 'App detected in Cloud instance'
            }
          });
        } catch (error) {
          // App not installed or not accessible - skip
        }
      }
    }

    return {
      total: plugins.length,
      userInstalled: plugins.length,
      systemPlugins: 0,
      plugins,
      cloudMigrationSummary: {
        readyToMigrate: plugins.length, // Already in Cloud
        needsAlternative: 0,
        noCloudVersion: 0
      }
    };
  }

  /**
   * Scan Cloud boards (JCMA: Jira Software Boards)
   */
  private async scanCloudBoards(instance: AtlassianInstance): Promise<InstanceScanResult['boards']> {
    const boards: JiraBoard[] = [];

    try {
      let startAt = 0;
      const maxResults = 50;

      while (true) {
        const response = await this.makeCloudRequest(
          instance,
          `/rest/agile/1.0/board?startAt=${startAt}&maxResults=${maxResults}`
        );

        if (!response.values || response.values.length === 0) break;

        for (const board of response.values) {
          boards.push({
            id: board.id,
            name: board.name,
            type: board.type?.toLowerCase() as 'scrum' | 'kanban' | 'simple',
            projectKey: board.location?.projectKey,
            projectName: board.location?.projectName,
            isPrivate: board.location?.projectTypeKey === 'business',
            location: board.location?.displayName,
            filterId: board.filter?.id
          });
        }

        if (response.values.length < maxResults) break;
        startAt += maxResults;
      }
    } catch (error) {
      console.error('Error scanning cloud boards:', error);
    }

    const scrumBoards = boards.filter(b => b.type === 'scrum').length;
    const kanbanBoards = boards.filter(b => b.type === 'kanban').length;

    return {
      total: boards.length,
      scrumBoards,
      kanbanBoards,
      boards
    };
  }

  /**
   * Scan Cloud filters (JCMA: Cross-project filters, Filters on boards)
   */
  private async scanCloudFilters(instance: AtlassianInstance): Promise<InstanceScanResult['filters']> {
    const filters: JiraFilter[] = [];

    try {
      let startAt = 0;
      const maxResults = 50;

      while (true) {
        const response = await this.makeCloudRequest(
          instance,
          `/rest/api/3/filter/search?startAt=${startAt}&maxResults=${maxResults}&expand=sharePermissions`
        );

        if (!response.values || response.values.length === 0) break;

        for (const filter of response.values) {
          const sharePermissions = filter.sharePermissions || [];
          filters.push({
            id: filter.id,
            name: filter.name,
            owner: filter.owner?.displayName || 'Unknown',
            jql: filter.jql || '',
            sharePermissions: sharePermissions.map((p: any) => ({
              type: p.type,
              projectKey: p.project?.key,
              groupName: p.group?.name
            })),
            isFavourite: filter.favourite || false,
            isSharedGlobally: sharePermissions.some((p: any) => p.type === 'global')
          });
        }

        if (response.values.length < maxResults) break;
        startAt += maxResults;
      }
    } catch (error) {
      console.error('Error scanning cloud filters:', error);
    }

    const sharedFilters = filters.filter(f => f.sharePermissions.length > 0).length;

    return {
      total: filters.length,
      sharedFilters,
      privateFilters: filters.length - sharedFilters,
      filters
    };
  }

  /**
   * Scan Cloud screens (JCMA: Screens, Screen schemes)
   */
  private async scanCloudScreens(instance: AtlassianInstance): Promise<InstanceScanResult['screens']> {
    const screens: JiraScreen[] = [];

    try {
      let startAt = 0;
      const maxResults = 100;

      while (true) {
        const response = await this.makeCloudRequest(
          instance,
          `/rest/api/3/screens?startAt=${startAt}&maxResults=${maxResults}`
        );

        if (!response.values || response.values.length === 0) break;

        for (const screen of response.values) {
          // Get screen tabs for field counts
          let tabs: { name: string; fieldCount: number }[] = [];
          try {
            const tabsResponse = await this.makeCloudRequest(
              instance,
              `/rest/api/3/screens/${screen.id}/tabs`
            );
            if (tabsResponse && Array.isArray(tabsResponse)) {
              tabs = tabsResponse.map((tab: any) => ({
                name: tab.name,
                fieldCount: tab.fields?.length || 0
              }));
            }
          } catch (tabError) {
            // Skip tab details if not accessible
          }

          screens.push({
            id: screen.id,
            name: screen.name,
            description: screen.description,
            isDefault: screen.name?.toLowerCase().includes('default') || false,
            tabs
          });
        }

        if (response.values.length < maxResults) break;
        startAt += maxResults;
      }
    } catch (error) {
      console.error('Error scanning cloud screens:', error);
    }

    const customScreens = screens.filter(s => !s.isDefault).length;

    return {
      total: screens.length,
      customScreens,
      screens
    };
  }

  /**
   * Scan Cloud issue types (JCMA: Issue types, Issue type schemes)
   */
  private async scanCloudIssueTypes(instance: AtlassianInstance): Promise<InstanceScanResult['issueTypes']> {
    const issueTypes: JiraIssueType[] = [];

    try {
      const response = await this.makeCloudRequest(instance, '/rest/api/3/issuetype');

      if (response && Array.isArray(response)) {
        for (const type of response) {
          issueTypes.push({
            id: type.id,
            name: type.name,
            description: type.description,
            iconUrl: type.iconUrl,
            subtask: type.subtask || false,
            isDefault: type.name?.toLowerCase() === 'task' || type.name?.toLowerCase() === 'story',
            hierarchyLevel: type.hierarchyLevel || (type.subtask ? -1 : 0),
            scope: type.scope?.type
          });
        }
      }
    } catch (error) {
      console.error('Error scanning cloud issue types:', error);
    }

    const standardTypes = issueTypes.filter(t => !t.subtask).length;
    const subtaskTypes = issueTypes.filter(t => t.subtask).length;

    return {
      total: issueTypes.length,
      standardTypes,
      subtaskTypes,
      issueTypes
    };
  }

  /**
   * Scan Cloud permission schemes (JCMA: Permission schemes)
   */
  private async scanCloudPermissionSchemes(instance: AtlassianInstance): Promise<InstanceScanResult['permissionSchemes']> {
    const schemes: JiraPermissionScheme[] = [];

    try {
      const response = await this.makeCloudRequest(instance, '/rest/api/3/permissionscheme');

      if (response.permissionSchemes) {
        for (const scheme of response.permissionSchemes) {
          schemes.push({
            id: scheme.id,
            name: scheme.name,
            description: scheme.description,
            projectCount: 0 // Would need separate query per scheme
          });
        }
      }
    } catch (error) {
      console.error('Error scanning cloud permission schemes:', error);
    }

    return {
      total: schemes.length,
      schemes
    };
  }

  /**
   * Scan Cloud dashboards (JCMA: Dashboards)
   */
  private async scanCloudDashboards(instance: AtlassianInstance): Promise<InstanceScanResult['dashboards']> {
    const dashboards: JiraDashboard[] = [];

    try {
      let startAt = 0;
      const maxResults = 50;

      while (true) {
        const response = await this.makeCloudRequest(
          instance,
          `/rest/api/3/dashboard?startAt=${startAt}&maxResults=${maxResults}`
        );

        if (!response.dashboards || response.dashboards.length === 0) break;

        for (const dash of response.dashboards) {
          dashboards.push({
            id: dash.id,
            name: dash.name,
            owner: dash.owner?.displayName,
            isFavourite: dash.isFavourite || false,
            sharePermissions: dash.sharePermissions || [],
            gadgetCount: 0 // Would need separate call to get gadgets
          });
        }

        if (response.dashboards.length < maxResults) break;
        startAt += maxResults;
      }
    } catch (error) {
      console.error('Error scanning cloud dashboards:', error);
    }

    const sharedDashboards = dashboards.filter(d => d.sharePermissions.length > 0).length;

    return {
      total: dashboards.length,
      sharedDashboards,
      dashboards
    };
  }

  /**
   * Scan Cloud priorities (JCMA: Priorities and priority schemes)
   */
  private async scanCloudPriorities(instance: AtlassianInstance): Promise<InstanceScanResult['priorities']> {
    const priorities: JiraPriority[] = [];

    try {
      const response = await this.makeCloudRequest(instance, '/rest/api/3/priority');

      if (response && Array.isArray(response)) {
        for (const priority of response) {
          priorities.push({
            id: priority.id,
            name: priority.name,
            description: priority.description,
            iconUrl: priority.iconUrl,
            statusColor: priority.statusColor || '',
            isDefault: priority.isDefault || false
          });
        }
      }
    } catch (error) {
      console.error('Error scanning cloud priorities:', error);
    }

    return {
      total: priorities.length,
      priorities
    };
  }

  /**
   * Scan Cloud statuses (JCMA: Status category)
   */
  private async scanCloudStatuses(instance: AtlassianInstance): Promise<InstanceScanResult['statuses']> {
    const statuses: JiraStatus[] = [];

    try {
      const response = await this.makeCloudRequest(instance, '/rest/api/3/status');

      if (response && Array.isArray(response)) {
        for (const status of response) {
          statuses.push({
            id: status.id,
            name: status.name,
            description: status.description,
            statusCategory: {
              id: status.statusCategory?.id,
              key: status.statusCategory?.key,
              name: status.statusCategory?.name,
              colorName: status.statusCategory?.colorName
            }
          });
        }
      }
    } catch (error) {
      console.error('Error scanning cloud statuses:', error);
    }

    return {
      total: statuses.length,
      statuses
    };
  }

  /**
   * Scan Cloud issue link types (JCMA: Issue links)
   */
  private async scanCloudIssueLinkTypes(instance: AtlassianInstance): Promise<InstanceScanResult['issueLinkTypes']> {
    const linkTypes: JiraIssueLinkType[] = [];

    try {
      const response = await this.makeCloudRequest(instance, '/rest/api/3/issueLinkType');

      if (response.issueLinkTypes) {
        for (const linkType of response.issueLinkTypes) {
          linkTypes.push({
            id: linkType.id,
            name: linkType.name,
            inward: linkType.inward,
            outward: linkType.outward
          });
        }
      }
    } catch (error) {
      console.error('Error scanning cloud issue link types:', error);
    }

    return {
      total: linkTypes.length,
      linkTypes
    };
  }

  /**
   * Scan Cloud resolutions (JCMA: Resolution)
   */
  private async scanCloudResolutions(instance: AtlassianInstance): Promise<InstanceScanResult['resolutions']> {
    const resolutions: JiraResolution[] = [];

    try {
      const response = await this.makeCloudRequest(instance, '/rest/api/3/resolution');

      if (response && Array.isArray(response)) {
        for (const resolution of response) {
          resolutions.push({
            id: resolution.id,
            name: resolution.name,
            description: resolution.description,
            isDefault: resolution.isDefault || false
          });
        }
      }
    } catch (error) {
      console.error('Error scanning cloud resolutions:', error);
    }

    return {
      total: resolutions.length,
      resolutions
    };
  }

  /**
   * Scan Cloud automation rules
   */
  private async scanCloudAutomation(
    instance: AtlassianInstance
  ): Promise<InstanceScanResult['automationRules']> {
    const rules: InstanceScanResult['automationRules'] = {
      total: 0,
      enabled: 0,
      disabled: 0,
      rules: []
    };

    try {
      // Automation API
      const response = await this.makeCloudRequest(
        instance,
        '/rest/api/3/automation/rule/search?maxResults=100'
      );

      if (response.values) {
        rules.total = response.total || response.values.length;

        for (const rule of response.values) {
          const isEnabled = rule.state === 'ENABLED';
          if (isEnabled) rules.enabled++;
          else rules.disabled++;

          rules.rules.push({
            id: rule.id.toString(),
            name: rule.name,
            state: isEnabled ? 'enabled' : 'disabled',
            ruleScope: rule.ruleScope?.resources?.[0]?.type || 'GLOBAL',
            actorType: rule.actor?.type || 'SYSTEM'
          });
        }
      }
    } catch (error) {
      console.error('Error scanning cloud automation:', error);
    }

    return rules;
  }

  /**
   * Get Cloud utilization metrics
   * Uses the new /rest/api/3/search/jql POST endpoint (as of 2024, the old GET endpoint is deprecated)
   */
  private async getCloudUtilizationMetrics(
    instance: AtlassianInstance
  ): Promise<InstanceScanResult['utilization']> {
    const metrics: InstanceScanResult['utilization'] = {};

    try {
      // Get issues created in last 30 days using new POST endpoint
      const createdResponse = await this.makeCloudRequest(
        instance,
        '/rest/api/3/search/jql',
        'POST',
        { jql: 'created >= -30d', maxResults: 0 }
      );
      metrics.issuesCreatedLast30Days = createdResponse.total;

      // Get issues resolved in last 30 days
      const resolvedResponse = await this.makeCloudRequest(
        instance,
        '/rest/api/3/search/jql',
        'POST',
        { jql: 'resolved >= -30d', maxResults: 0 }
      );
      metrics.issuesResolvedLast30Days = resolvedResponse.total;

      // Get issues updated in last 30 days for activity metric
      const updatedResponse = await this.makeCloudRequest(
        instance,
        '/rest/api/3/search/jql',
        'POST',
        { jql: 'updated >= -30d', maxResults: 0 }
      );
      metrics.activeUsersLast30Days = updatedResponse.total; // Proxy for activity
    } catch (error) {
      console.error('Error getting cloud utilization metrics:', error);
    }

    return metrics;
  }

  /**
   * Get Cloud health metrics (API limits, storage, etc.)
   */
  private async getCloudHealthMetrics(
    instance: AtlassianInstance
  ): Promise<InstanceScanResult['cloudHealth']> {
    const health: InstanceScanResult['cloudHealth'] = {};

    try {
      // Get license info
      const licenseResponse = await this.makeCloudRequest(
        instance,
        '/rest/api/3/instance/license'
      );

      if (licenseResponse.applications) {
        health.productAccess = licenseResponse.applications.map((app: any) => ({
          product: app.id,
          tier: app.plan || 'Unknown',
          userLimit: app.seats
        }));
      }
    } catch (error) {
      // License endpoint may not be accessible
      console.error('Error getting cloud health metrics:', error);
    }

    return health;
  }

  /**
   * Make HTTP request to Atlassian DC/Server instance
   */
  private async makeRequest(
    instance: AtlassianInstance,
    endpoint: string,
    additionalHeaders?: Record<string, string>
  ): Promise<any> {
    const url = `${instance.url.replace(/\/$/, '')}${endpoint}`;

    const authString = Buffer.from(`${instance.username}:${instance.apiToken}`).toString('base64');

    const headers: Record<string, string> = {
      'Authorization': `Basic ${authString}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...additionalHeaders
    };

    const response = await fetch(url, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  /**
   * Make HTTP request to Atlassian Cloud instance
   * Uses API v3 and Basic Auth with email:api-token
   */
  private async makeCloudRequest(
    instance: AtlassianInstance,
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    body?: Record<string, any>
  ): Promise<any> {
    const url = `${instance.url.replace(/\/$/, '')}${endpoint}`;
    const startTime = Date.now();

    // Log the API call
    this.log('api_call', `Calling: ${endpoint}`, { endpoint });

    // Cloud uses email:api_token for Basic Auth
    const authString = Buffer.from(`${instance.username}:${instance.apiToken}`).toString('base64');

    const headers: Record<string, string> = {
      'Authorization': `Basic ${authString}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    const fetchOptions: RequestInit = {
      method,
      headers
    };

    if (body && method === 'POST') {
      fetchOptions.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, fetchOptions);

      const duration = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        this.log('error', `Failed: ${endpoint} (${response.status})`, { endpoint, duration, details: { status: response.status, error: errorText.substring(0, 200) } });
        throw new Error(`Cloud API request failed: ${response.status} - ${errorText}`);
      }

      this.log('success', `Completed: ${endpoint} (${duration}ms)`, { endpoint, duration });
      return response.json();
    } catch (error: any) {
      const duration = Date.now() - startTime;
      if (!error.message?.includes('Cloud API request failed')) {
        this.log('error', `Error: ${endpoint} - ${error.message}`, { endpoint, duration });
      }
      throw error;
    }
  }
}

// Singleton instance
let atlassianApiClientService: AtlassianApiClientService | null = null;

export function getAtlassianApiClientService(): AtlassianApiClientService {
  if (!atlassianApiClientService) {
    atlassianApiClientService = new AtlassianApiClientService();
  }
  return atlassianApiClientService;
}

export default AtlassianApiClientService;
