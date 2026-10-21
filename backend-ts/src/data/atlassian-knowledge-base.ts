/**
 * Atlassian Cloud Knowledge Base
 *
 * Comprehensive data structure containing:
 * - Cloud capabilities and features
 * - DC/Server to Cloud migration paths
 * - Common DC pain points
 * - Cloud pricing tiers
 * - Migration complexity factors
 */

export interface CloudCapability {
  name: string;
  description: string;
  dcEquivalent: string | null;  // null = Cloud-only feature
  migrationComplexity: 'low' | 'medium' | 'high';
  benefits: string[];
  category: string;
}

export interface DCPainPoint {
  issue: string;
  description: string;
  cloudSolution: string;
  urgencyIndicator: 'low' | 'medium' | 'high' | 'critical';
  affectedAreas: string[];
}

export interface MigrationPath {
  dcFeature: string;
  cloudReplacement: string;
  migrationSteps: string[];
  potentialIssues: string[];
  complexity: 'low' | 'medium' | 'high';
}

// ============================================================================
// JIRA CLOUD CAPABILITIES
// ============================================================================

export const JIRA_CLOUD_CAPABILITIES: Record<string, CloudCapability> = {
  // Automation & Rules
  automation: {
    name: 'Jira Automation',
    description: 'Native no-code automation rules for workflows, notifications, and issue management. Includes 100+ pre-built templates.',
    dcEquivalent: 'ScriptRunner, Automation for Jira (paid add-ons)',
    migrationComplexity: 'medium',
    benefits: [
      'Native integration - no add-on costs',
      'Global and project-level rules',
      'Smart values and branching logic',
      'Audit log for all automation runs',
      'Cross-project automation support'
    ],
    category: 'Automation'
  },

  advancedRoadmaps: {
    name: 'Advanced Roadmaps',
    description: 'Enterprise-grade planning tool for cross-team roadmaps, capacity planning, and dependency management.',
    dcEquivalent: 'Portfolio for Jira (paid add-on)',
    migrationComplexity: 'medium',
    benefits: [
      'Included in Premium/Enterprise plans',
      'Real-time roadmap sync with Jira data',
      'Scenario planning capabilities',
      'Dependency visualization across teams',
      'Capacity planning with team workload view'
    ],
    category: 'Planning'
  },

  atlassianIntelligence: {
    name: 'Atlassian Intelligence (AI)',
    description: 'AI-powered features including natural language JQL, smart summaries, and automated work suggestions.',
    dcEquivalent: null,
    migrationComplexity: 'low',
    benefits: [
      'Natural language to JQL conversion',
      'AI-generated issue summaries',
      'Smart work suggestions',
      'Automated sprint planning insights',
      'Intelligent search across projects'
    ],
    category: 'AI & Intelligence'
  },

  jsmVirtualAgent: {
    name: 'Virtual Service Agent',
    description: 'AI-powered chatbot for Jira Service Management that handles common requests automatically.',
    dcEquivalent: null,
    migrationComplexity: 'low',
    benefits: [
      'Deflect up to 30% of common requests',
      'Natural language understanding',
      'Integrates with knowledge base',
      'Custom conversation flows',
      '24/7 automated support'
    ],
    category: 'AI & Intelligence'
  },

  assetsInsight: {
    name: 'Assets (Insight)',
    description: 'Native CMDB and asset management integrated into Jira Service Management.',
    dcEquivalent: 'Insight for Jira (paid add-on)',
    migrationComplexity: 'high',
    benefits: [
      'Included in JSM Premium/Enterprise',
      'Native integration with service requests',
      'Discovery and scanning capabilities',
      'Dependency mapping',
      'Impact analysis for changes'
    ],
    category: 'ITSM'
  },

  securityFeatures: {
    name: 'Security & Compliance',
    description: 'Enterprise security features including data residency, audit logs, SCIM provisioning, and compliance certifications.',
    dcEquivalent: 'Limited native capabilities',
    migrationComplexity: 'low',
    benefits: [
      'SOC2, ISO 27001, GDPR compliance',
      'Data residency options (US, EU, AU)',
      'SCIM user provisioning',
      'IP allowlisting',
      'Mobile device management (MDM)'
    ],
    category: 'Security'
  },

  teamManagedProjects: {
    name: 'Team-Managed Projects',
    description: 'Simplified project management for teams who want autonomy without admin involvement.',
    dcEquivalent: null,
    migrationComplexity: 'low',
    benefits: [
      'Quick project setup without admin',
      'Team-level customization',
      'Simplified board configuration',
      'Self-service for team leads'
    ],
    category: 'Project Management'
  },

  globalAutomation: {
    name: 'Global Automation Rules',
    description: 'Create automation rules that span multiple projects for organization-wide consistency.',
    dcEquivalent: 'ScriptRunner (limited)',
    migrationComplexity: 'medium',
    benefits: [
      'Single rule for multiple projects',
      'Easier maintenance',
      'Consistent behavior across org',
      'Centralized audit trail'
    ],
    category: 'Automation'
  },

  nativeIntegrations: {
    name: 'Native Integrations',
    description: 'Out-of-box integrations with 3000+ apps including Slack, Teams, GitHub, GitLab, and more.',
    dcEquivalent: 'Manual configuration/webhooks',
    migrationComplexity: 'low',
    benefits: [
      'One-click integration setup',
      'Bidirectional sync',
      'OAuth-based authentication',
      'Marketplace with 3000+ apps'
    ],
    category: 'Integrations'
  },

  sandbox: {
    name: 'Sandbox Environment',
    description: 'Test configuration changes in an isolated environment before applying to production.',
    dcEquivalent: 'Requires separate instance',
    migrationComplexity: 'low',
    benefits: [
      'Risk-free testing',
      'Test app upgrades',
      'Validate automations',
      'Train users safely'
    ],
    category: 'Administration'
  },

  releaseHub: {
    name: 'Releases Hub',
    description: 'Track and coordinate releases across multiple projects with deployment tracking.',
    dcEquivalent: 'Limited native support',
    migrationComplexity: 'medium',
    benefits: [
      'Cross-project release visibility',
      'Deployment tracking integration',
      'Release health monitoring',
      'Automated release notes'
    ],
    category: 'DevOps'
  },

  goals: {
    name: 'Goals',
    description: 'Connect daily work to strategic objectives with OKR-style goal tracking.',
    dcEquivalent: null,
    migrationComplexity: 'low',
    benefits: [
      'Strategic alignment visibility',
      'Progress tracking',
      'Team and org-level goals',
      'Integration with Jira work'
    ],
    category: 'Planning'
  }
};

// ============================================================================
// CONFLUENCE CLOUD CAPABILITIES
// ============================================================================

export const CONFLUENCE_CLOUD_CAPABILITIES: Record<string, CloudCapability> = {
  analytics: {
    name: 'Confluence Analytics',
    description: 'Built-in analytics showing page views, engagement, and content health metrics.',
    dcEquivalent: null,
    migrationComplexity: 'low',
    benefits: [
      'Page view tracking',
      'Content engagement metrics',
      'Space-level analytics',
      'User contribution insights',
      'Content health scoring'
    ],
    category: 'Analytics'
  },

  whiteboards: {
    name: 'Whiteboards',
    description: 'Collaborative digital whiteboard for brainstorming, diagramming, and visual collaboration.',
    dcEquivalent: null,
    migrationComplexity: 'low',
    benefits: [
      'Real-time collaboration',
      'Sticky notes, shapes, connectors',
      'Convert to Confluence pages',
      'Templates for workshops',
      'Infinite canvas'
    ],
    category: 'Collaboration'
  },

  databases: {
    name: 'Databases (Beta)',
    description: 'Structured data management within Confluence pages using database-like tables.',
    dcEquivalent: null,
    migrationComplexity: 'low',
    benefits: [
      'Structured data storage',
      'Custom field types',
      'Filtering and sorting',
      'Cross-page data reuse'
    ],
    category: 'Content Management'
  },

  smartLinks: {
    name: 'Smart Links',
    description: 'Rich previews when pasting URLs from supported services showing live data.',
    dcEquivalent: 'Limited',
    migrationComplexity: 'low',
    benefits: [
      'Live data from linked services',
      'Jira issue previews',
      'Figma, Google Docs, GitHub support',
      'No switching context'
    ],
    category: 'Integrations'
  },

  atlassianIntelligenceConfluence: {
    name: 'Atlassian Intelligence for Confluence',
    description: 'AI-powered features including content summarization, writing assistance, and smart search.',
    dcEquivalent: null,
    migrationComplexity: 'low',
    benefits: [
      'AI content summarization',
      'Writing tone adjustment',
      'Smart search results',
      'Content recommendations',
      'Action item extraction'
    ],
    category: 'AI & Intelligence'
  },

  teamCalendars: {
    name: 'Team Calendars',
    description: 'Shared calendars for team events, releases, and milestones within Confluence.',
    dcEquivalent: 'Team Calendars (paid add-on)',
    migrationComplexity: 'medium',
    benefits: [
      'Included in Premium',
      'Jira release sync',
      'iCal integration',
      'Space-level calendars'
    ],
    category: 'Collaboration'
  },

  guestAccess: {
    name: 'Guest Access',
    description: 'Invite external collaborators with limited access to specific spaces.',
    dcEquivalent: 'Complex licensing',
    migrationComplexity: 'low',
    benefits: [
      'External collaboration',
      '5 guests per paid user',
      'Granular permissions',
      'Separate from user count'
    ],
    category: 'Collaboration'
  },

  pageVersioning: {
    name: 'Advanced Page History',
    description: 'Detailed version comparison with visual diff and granular restoration.',
    dcEquivalent: 'Basic version history',
    migrationComplexity: 'low',
    benefits: [
      'Visual diff comparison',
      'Partial restoration',
      'Unlimited version history',
      'Author attribution'
    ],
    category: 'Content Management'
  },

  templates: {
    name: 'Premium Templates',
    description: '75+ premium templates for various use cases from decision docs to project plans.',
    dcEquivalent: 'Limited templates',
    migrationComplexity: 'low',
    benefits: [
      '75+ pre-built templates',
      'Custom template creation',
      'Template variables',
      'Team-specific templates'
    ],
    category: 'Content Management'
  }
};

// ============================================================================
// PLATFORM-WIDE CLOUD CAPABILITIES
// ============================================================================

export const PLATFORM_CLOUD_CAPABILITIES: Record<string, CloudCapability> = {
  atlassianAccess: {
    name: 'Atlassian Access (Guard)',
    description: 'Enterprise identity and access management with SSO, SCIM, and security policies.',
    dcEquivalent: 'Crowd + manual configuration',
    migrationComplexity: 'medium',
    benefits: [
      'Centralized user management',
      'SAML SSO with any IdP',
      'SCIM automated provisioning',
      'Organization-wide security policies',
      'Audit logs for all products'
    ],
    category: 'Security'
  },

  dataResidency: {
    name: 'Data Residency',
    description: 'Choose where your data is stored (US, EU, Australia, or Germany).',
    dcEquivalent: 'On-premise control',
    migrationComplexity: 'low',
    benefits: [
      'Compliance with data sovereignty laws',
      'Regional data storage',
      'Realm migration support',
      'Clear data location transparency'
    ],
    category: 'Security'
  },

  premiumSupport: {
    name: 'Premium Support',
    description: '24/7 support with 1-hour response time for critical issues.',
    dcEquivalent: 'Support depends on contract',
    migrationComplexity: 'low',
    benefits: [
      '24/7/365 availability',
      '1-hour critical response',
      'Dedicated support team',
      'Proactive monitoring'
    ],
    category: 'Support'
  },

  uptimeSLA: {
    name: '99.9% Uptime SLA',
    description: 'Guaranteed uptime with financial credits for any outages.',
    dcEquivalent: 'Self-managed uptime',
    migrationComplexity: 'low',
    benefits: [
      'Financially-backed SLA',
      'Proactive maintenance',
      'Global CDN',
      'Auto-scaling infrastructure'
    ],
    category: 'Infrastructure'
  },

  unlimitedStorage: {
    name: 'Unlimited Storage',
    description: 'No storage limits for attachments and files.',
    dcEquivalent: 'Hardware-limited',
    migrationComplexity: 'low',
    benefits: [
      'No capacity planning',
      'Automatic scaling',
      'No archive management',
      'Large file support'
    ],
    category: 'Infrastructure'
  },

  adminInsights: {
    name: 'Admin Insights',
    description: 'Organization-wide analytics for usage, adoption, and security.',
    dcEquivalent: null,
    migrationComplexity: 'low',
    benefits: [
      'Cross-product analytics',
      'User adoption tracking',
      'Security posture dashboard',
      'License utilization reports'
    ],
    category: 'Administration'
  },

  mobileApps: {
    name: 'Mobile Apps',
    description: 'Full-featured iOS and Android apps with push notifications.',
    dcEquivalent: 'Limited mobile support',
    migrationComplexity: 'low',
    benefits: [
      'Native mobile experience',
      'Push notifications',
      'Offline support',
      'MDM integration'
    ],
    category: 'Access'
  }
};

// ============================================================================
// COMMON DC/SERVER PAIN POINTS
// ============================================================================

export const DC_PAIN_POINTS: DCPainPoint[] = [
  {
    issue: 'Infrastructure Management',
    description: 'Significant IT overhead for server maintenance, patching, upgrades, and monitoring.',
    cloudSolution: 'Fully managed infrastructure with automatic updates, scaling, and 24/7 monitoring.',
    urgencyIndicator: 'high',
    affectedAreas: ['Operations', 'IT', 'Budget']
  },
  {
    issue: 'Version Upgrade Complexity',
    description: 'Upgrading DC/Server requires planned downtime, testing, and rollback procedures.',
    cloudSolution: 'Automatic updates with zero downtime. New features available immediately.',
    urgencyIndicator: 'medium',
    affectedAreas: ['Operations', 'IT', 'User Experience']
  },
  {
    issue: 'Security Patching',
    description: 'Manual security patches must be applied quickly to prevent vulnerabilities.',
    cloudSolution: 'Automatic security patches applied by Atlassian. SOC2, ISO 27001 certified.',
    urgencyIndicator: 'critical',
    affectedAreas: ['Security', 'Compliance', 'IT']
  },
  {
    issue: 'Scaling Limitations',
    description: 'Scaling requires additional hardware, clustering configuration, and load balancing.',
    cloudSolution: 'Automatic elastic scaling based on demand. No hardware procurement.',
    urgencyIndicator: 'medium',
    affectedAreas: ['Performance', 'IT', 'Budget']
  },
  {
    issue: 'Disaster Recovery',
    description: 'DR requires separate infrastructure, replication setup, and regular testing.',
    cloudSolution: 'Built-in redundancy, automatic backups, and multi-region failover.',
    urgencyIndicator: 'high',
    affectedAreas: ['Business Continuity', 'IT', 'Compliance']
  },
  {
    issue: 'App Marketplace Limitations',
    description: 'Many modern apps are Cloud-only or have delayed DC/Server releases.',
    cloudSolution: 'Access to 3000+ Cloud apps with immediate availability and auto-updates.',
    urgencyIndicator: 'medium',
    affectedAreas: ['Productivity', 'Integration', 'User Experience']
  },
  {
    issue: 'Remote Access Challenges',
    description: 'Enabling secure remote access requires VPN, reverse proxy, or complex networking.',
    cloudSolution: 'Secure access from anywhere with SSO, IP allowlisting, and MDM support.',
    urgencyIndicator: 'high',
    affectedAreas: ['Remote Work', 'Security', 'User Experience']
  },
  {
    issue: 'License Compliance',
    description: 'Managing DC license tiers and ensuring compliance can be complex.',
    cloudSolution: 'Flexible user-based licensing with clear seat management.',
    urgencyIndicator: 'low',
    affectedAreas: ['Budget', 'Compliance', 'Administration']
  },
  {
    issue: 'End of Server Support',
    description: 'Atlassian Server products reached end of support in February 2024.',
    cloudSolution: 'Full support with 24/7 availability and dedicated customer success.',
    urgencyIndicator: 'critical',
    affectedAreas: ['Support', 'Security', 'Compliance']
  },
  {
    issue: 'Performance Optimization',
    description: 'Requires ongoing tuning of JVM, database, and caching configurations.',
    cloudSolution: 'Optimized by Atlassian with CDN, caching, and performance monitoring.',
    urgencyIndicator: 'medium',
    affectedAreas: ['Performance', 'IT', 'User Experience']
  },
  {
    issue: 'User Authentication',
    description: 'Setting up SSO requires Crowd or complex SAML configuration.',
    cloudSolution: 'One-click SSO with any SAML/OIDC provider via Atlassian Access.',
    urgencyIndicator: 'medium',
    affectedAreas: ['Security', 'IT', 'User Experience']
  },
  {
    issue: 'Collaboration Features',
    description: 'Limited real-time collaboration and modern features in DC/Server.',
    cloudSolution: 'Real-time editing, @mentions, Smart Links, AI features, and whiteboards.',
    urgencyIndicator: 'medium',
    affectedAreas: ['Productivity', 'Collaboration', 'User Experience']
  }
];

// ============================================================================
// MIGRATION PATHS
// ============================================================================

export const MIGRATION_PATHS: MigrationPath[] = [
  {
    dcFeature: 'ScriptRunner for Jira',
    cloudReplacement: 'Jira Automation + ScriptRunner for Cloud',
    migrationSteps: [
      'Audit existing ScriptRunner scripts',
      'Identify scripts replaceable by native Automation',
      'Migrate complex scripts to ScriptRunner Cloud',
      'Test all automated workflows'
    ],
    potentialIssues: [
      'Some Groovy scripts may need rewriting',
      'Cloud API differences',
      'Rate limiting considerations'
    ],
    complexity: 'high'
  },
  {
    dcFeature: 'Portfolio for Jira',
    cloudReplacement: 'Advanced Roadmaps (included in Premium)',
    migrationSteps: [
      'Export portfolio plans',
      'Recreate plans in Advanced Roadmaps',
      'Configure team and capacity settings',
      'Validate dependencies and timelines'
    ],
    potentialIssues: [
      'Some custom fields may need recreation',
      'Different capacity calculation model'
    ],
    complexity: 'medium'
  },
  {
    dcFeature: 'Insight (Asset Management)',
    cloudReplacement: 'Assets (included in JSM Premium)',
    migrationSteps: [
      'Export Insight object schemas',
      'Import to Assets using migration tool',
      'Validate object relationships',
      'Update automation rules referencing assets'
    ],
    potentialIssues: [
      'Large datasets may need chunked migration',
      'Custom attributes may need mapping'
    ],
    complexity: 'high'
  },
  {
    dcFeature: 'Confluence Questions',
    cloudReplacement: 'Third-party app or native Confluence features',
    migrationSteps: [
      'Export Q&A content',
      'Migrate to Confluence pages with labels',
      'Or implement StackOverflow for Teams'
    ],
    potentialIssues: [
      'No direct equivalent in Cloud',
      'May lose Q&A-specific features'
    ],
    complexity: 'medium'
  },
  {
    dcFeature: 'Custom JIRA Issue Types',
    cloudReplacement: 'Cloud Issue Types',
    migrationSteps: [
      'Document current issue type configurations',
      'Use Jira Cloud Migration Assistant',
      'Validate workflows and screens post-migration'
    ],
    potentialIssues: [
      'Some field configurations may differ',
      'Workflow conditions may need adjustment'
    ],
    complexity: 'low'
  },
  {
    dcFeature: 'Crowd',
    cloudReplacement: 'Atlassian Access',
    migrationSteps: [
      'Configure SAML/OIDC with identity provider',
      'Set up SCIM provisioning',
      'Migrate user groups',
      'Test authentication flow'
    ],
    potentialIssues: [
      'Need to update IdP configuration',
      'Group naming conventions may differ'
    ],
    complexity: 'medium'
  }
];

// ============================================================================
// CLOUD PRICING TIERS
// ============================================================================

export const CLOUD_PRICING_TIERS = {
  jira: {
    free: {
      name: 'Free',
      maxUsers: 10,
      storage: '2 GB',
      support: 'Community',
      features: ['Basic boards', 'Backlog', 'Basic reporting']
    },
    standard: {
      name: 'Standard',
      pricePerUser: 7.75,
      storage: '250 GB',
      support: 'Business hours',
      features: ['All Free features', 'User roles', 'Audit logs', '1,000 automation rules/month']
    },
    premium: {
      name: 'Premium',
      pricePerUser: 15.25,
      storage: 'Unlimited',
      support: '24/7',
      features: ['All Standard features', 'Advanced Roadmaps', 'Sandbox', 'Admin Insights', 'Unlimited automation']
    },
    enterprise: {
      name: 'Enterprise',
      pricePerUser: 'Contact sales',
      storage: 'Unlimited',
      support: '24/7 Premium',
      features: ['All Premium features', 'Data residency', 'SCIM', 'Atlassian Access included', '99.9% SLA']
    }
  },
  confluence: {
    free: {
      name: 'Free',
      maxUsers: 10,
      storage: '2 GB',
      support: 'Community',
      features: ['Unlimited pages', 'Page trees', 'Templates']
    },
    standard: {
      name: 'Standard',
      pricePerUser: 5.75,
      storage: '250 GB',
      support: 'Business hours',
      features: ['All Free features', 'User permissions', 'Guest access', 'External sharing']
    },
    premium: {
      name: 'Premium',
      pricePerUser: 11,
      storage: 'Unlimited',
      support: '24/7',
      features: ['All Standard features', 'Analytics', 'Team Calendars', 'Admin Insights', 'Sandbox']
    },
    enterprise: {
      name: 'Enterprise',
      pricePerUser: 'Contact sales',
      storage: 'Unlimited',
      support: '24/7 Premium',
      features: ['All Premium features', 'Data residency', 'SCIM', 'Atlassian Access included', '99.9% SLA']
    }
  },
  jsm: {
    free: {
      name: 'Free',
      maxAgents: 3,
      storage: '2 GB',
      support: 'Community',
      features: ['Service request management', 'Knowledge base', 'Basic SLAs']
    },
    standard: {
      name: 'Standard',
      pricePerAgent: 21,
      storage: '250 GB',
      support: 'Business hours',
      features: ['All Free features', 'Change management', '20,000 customers', 'Multi-channel support']
    },
    premium: {
      name: 'Premium',
      pricePerAgent: 47,
      storage: 'Unlimited',
      support: '24/7',
      features: ['All Standard features', 'Assets (CMDB)', 'Virtual Service Agent', 'Incident management', 'Problem management']
    },
    enterprise: {
      name: 'Enterprise',
      pricePerAgent: 'Contact sales',
      storage: 'Unlimited',
      support: '24/7 Premium',
      features: ['All Premium features', 'Data residency', 'Analytics+', 'Atlassian Access included', '99.9% SLA']
    }
  }
};

// ============================================================================
// QUESTIONNAIRE CATEGORIES & QUESTIONS
// ============================================================================

export const QUESTIONNAIRE_CATEGORIES = {
  environment: {
    title: 'Current Environment',
    description: 'Understanding your existing Atlassian deployment',
    icon: 'server'
  },
  usage: {
    title: 'Usage Patterns',
    description: 'How your teams use Atlassian tools today',
    icon: 'chart'
  },
  painPoints: {
    title: 'Challenges & Pain Points',
    description: 'Current frustrations and limitations',
    icon: 'warning'
  },
  requirements: {
    title: 'Requirements & Goals',
    description: 'What you need from a Cloud migration',
    icon: 'target'
  },
  timeline: {
    title: 'Timeline & Constraints',
    description: 'Migration timeline and business constraints',
    icon: 'calendar'
  }
};

export type QuestionType = 'text' | 'textarea' | 'select' | 'multiselect' | 'number' | 'boolean';

export interface BaseQuestion {
  id: string;
  category: string;
  question: string;
  type: QuestionType;
  options?: string[];
  placeholder?: string;
  required: boolean;
}

export const BASE_QUESTIONNAIRE_QUESTIONS: BaseQuestion[] = [
  // Environment
  {
    id: 'products_used',
    category: 'environment',
    question: 'Which Atlassian products are you currently using?',
    type: 'multiselect',
    options: ['Jira Software', 'Jira Service Management', 'Confluence', 'Bitbucket', 'Bamboo', 'Crowd', 'Other'],
    required: true
  },
  {
    id: 'deployment_type',
    category: 'environment',
    question: 'What is your current deployment type?',
    type: 'select',
    options: ['Server (single node)', 'Data Center (clustered)', 'Mix of Server and DC'],
    required: true
  },
  {
    id: 'user_count',
    category: 'environment',
    question: 'Approximately how many users do you have across all Atlassian products?',
    type: 'select',
    options: ['1-50', '51-200', '201-500', '501-1000', '1001-5000', '5000+'],
    required: true
  },
  {
    id: 'version_current',
    category: 'environment',
    question: 'What version of Jira/Confluence are you currently running?',
    type: 'text',
    placeholder: 'e.g., Jira 9.4.0, Confluence 8.2.0',
    required: false
  },
  {
    id: 'apps_used',
    category: 'environment',
    question: 'Which major apps/add-ons do you rely on heavily? (List top 5)',
    type: 'textarea',
    placeholder: 'e.g., ScriptRunner, Tempo Timesheets, BigPicture, Structure, etc.',
    required: false
  },

  // Usage Patterns
  {
    id: 'primary_use_cases',
    category: 'usage',
    question: 'What are your primary use cases for Jira?',
    type: 'multiselect',
    options: ['Software Development', 'IT Service Management', 'Project Management', 'HR/Ops Workflows', 'Customer Support', 'Other'],
    required: true
  },
  {
    id: 'jql_complexity',
    category: 'usage',
    question: 'How complex are your JQL queries and filters?',
    type: 'select',
    options: ['Basic (simple filters)', 'Moderate (multiple conditions)', 'Advanced (JQL functions, scripted filters)', 'Expert (complex calculated fields)'],
    required: false
  },
  {
    id: 'automation_usage',
    category: 'usage',
    question: 'Do you use automation extensively (ScriptRunner, Automation for Jira, custom scripts)?',
    type: 'select',
    options: ['None/Minimal', 'Some automation rules', 'Heavy automation reliance', 'Custom Groovy scripts throughout'],
    required: true
  },
  {
    id: 'integration_count',
    category: 'usage',
    question: 'How many external systems integrate with your Atlassian instance?',
    type: 'select',
    options: ['None', '1-5', '6-15', '15+'],
    required: true
  },

  // Pain Points
  {
    id: 'current_challenges',
    category: 'painPoints',
    question: 'What are your biggest challenges with the current deployment?',
    type: 'multiselect',
    options: [
      'Infrastructure management overhead',
      'Upgrade complexity/downtime',
      'Security patching urgency',
      'Scaling issues',
      'Remote access challenges',
      'App availability/compatibility',
      'Performance issues',
      'Disaster recovery concerns',
      'License management'
    ],
    required: true
  },
  {
    id: 'upgrade_frequency',
    category: 'painPoints',
    question: 'How often do you upgrade your Atlassian products?',
    type: 'select',
    options: ['Every release', 'Quarterly', 'Every 6-12 months', 'Rarely (1+ years between)', 'Never upgraded'],
    required: true
  },
  {
    id: 'security_concerns',
    category: 'painPoints',
    question: 'Have you experienced security concerns or compliance requirements?',
    type: 'multiselect',
    options: ['Security vulnerability incidents', 'Compliance audit findings', 'Data residency requirements', 'SSO/Identity management gaps', 'None'],
    required: false
  },

  // Requirements
  {
    id: 'must_have_features',
    category: 'requirements',
    question: 'Which Cloud features are most appealing to you?',
    type: 'multiselect',
    options: [
      'Automatic updates',
      'Advanced Roadmaps',
      'Atlassian Intelligence (AI)',
      'Native automation',
      'Improved collaboration',
      'Mobile apps',
      'Better integrations',
      'Reduced IT overhead'
    ],
    required: true
  },
  {
    id: 'data_residency_required',
    category: 'requirements',
    question: 'Do you have data residency requirements?',
    type: 'select',
    options: ['No specific requirements', 'US preferred', 'EU required (GDPR)', 'Australia required', 'Germany required', 'On-premise only acceptable'],
    required: true
  },
  {
    id: 'sso_requirements',
    category: 'requirements',
    question: 'What are your identity management requirements?',
    type: 'multiselect',
    options: ['SAML SSO', 'OIDC', 'SCIM provisioning', 'MFA enforcement', 'IP allowlisting', 'None specific'],
    required: false
  },

  // Timeline
  {
    id: 'migration_urgency',
    category: 'timeline',
    question: 'How urgent is your migration to Cloud?',
    type: 'select',
    options: [
      'Critical - need to migrate ASAP',
      'High - within 6 months',
      'Medium - within 12 months',
      'Low - exploring options',
      'Just evaluating, no plans yet'
    ],
    required: true
  },
  {
    id: 'migration_blockers',
    category: 'timeline',
    question: 'What are potential blockers for migration?',
    type: 'multiselect',
    options: [
      'App compatibility',
      'Data migration complexity',
      'Security/compliance concerns',
      'Budget constraints',
      'Change management/training',
      'Current contract obligations',
      'Custom integrations',
      'None identified'
    ],
    required: false
  },
  {
    id: 'budget_approach',
    category: 'timeline',
    question: 'How are you approaching the budget for Cloud migration?',
    type: 'select',
    options: [
      'Budget already allocated',
      'Need to build business case',
      'Seeking cost reduction vs DC',
      'Budget is a major constraint',
      'Not sure yet'
    ],
    required: false
  }
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getAllCloudCapabilities(): CloudCapability[] {
  return [
    ...Object.values(JIRA_CLOUD_CAPABILITIES),
    ...Object.values(CONFLUENCE_CLOUD_CAPABILITIES),
    ...Object.values(PLATFORM_CLOUD_CAPABILITIES)
  ];
}

export function getCloudOnlyCapabilities(): CloudCapability[] {
  return getAllCloudCapabilities().filter(cap => cap.dcEquivalent === null);
}

export function searchCapabilities(query: string): CloudCapability[] {
  const lowerQuery = query.toLowerCase();
  return getAllCloudCapabilities().filter(cap =>
    cap.name.toLowerCase().includes(lowerQuery) ||
    cap.description.toLowerCase().includes(lowerQuery) ||
    cap.category.toLowerCase().includes(lowerQuery) ||
    cap.benefits.some(b => b.toLowerCase().includes(lowerQuery))
  );
}

export function getPainPointsByUrgency(urgency: DCPainPoint['urgencyIndicator']): DCPainPoint[] {
  return DC_PAIN_POINTS.filter(pp => pp.urgencyIndicator === urgency);
}

export function getMigrationPathsByComplexity(complexity: MigrationPath['complexity']): MigrationPath[] {
  return MIGRATION_PATHS.filter(mp => mp.complexity === complexity);
}

// ============================================================================
// ATLASSIAN DC/SERVER REST API ENDPOINTS (Phase 2: Environment Scanning)
// ============================================================================

export interface AtlassianAPIEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  description: string;
  category: string;
  product: 'jira' | 'confluence' | 'common';
  requiresAuth: boolean;
  responseFields?: string[];
  notes?: string;
}

/**
 * Jira Data Center / Server REST API Endpoints
 * Base URL: https://<instance>/rest/api/2
 * Documentation: https://docs.atlassian.com/software/jira/docs/api/REST/9.14.0/
 */
export const JIRA_DC_API_ENDPOINTS: AtlassianAPIEndpoint[] = [
  // ========== Server & System Information ==========
  {
    method: 'GET',
    path: '/rest/api/2/serverInfo',
    description: 'Get server version, build number, deployment type, and base URL',
    category: 'System',
    product: 'jira',
    requiresAuth: false,
    responseFields: ['version', 'versionNumbers', 'deploymentType', 'buildNumber', 'buildDate', 'serverTime', 'scmInfo', 'serverTitle', 'baseUrl']
  },
  {
    method: 'GET',
    path: '/rest/api/2/configuration',
    description: 'Get feature enablement status and time tracking settings',
    category: 'System',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['votingEnabled', 'watchingEnabled', 'unassignedIssuesAllowed', 'subTasksEnabled', 'issueLinkingEnabled', 'timeTrackingEnabled', 'attachmentsEnabled', 'timeTrackingConfiguration']
  },
  {
    method: 'GET',
    path: '/rest/api/2/application-properties',
    description: 'Get application configuration properties',
    category: 'System',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['id', 'key', 'value', 'name', 'desc', 'type', 'defaultValue']
  },
  {
    method: 'GET',
    path: '/rest/api/2/application-properties/advanced-settings',
    description: 'Get advanced configuration settings',
    category: 'System',
    product: 'jira',
    requiresAuth: true
  },
  {
    method: 'GET',
    path: '/rest/api/2/cluster/nodes',
    description: 'List all nodes in a Data Center cluster',
    category: 'System',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['nodeId', 'state', 'alive', 'cacheListenerPort', 'ip'],
    notes: 'Data Center only - returns empty for Server'
  },
  {
    method: 'PUT',
    path: '/rest/api/2/cluster/node/{nodeId}/offline',
    description: 'Set a cluster node to offline state',
    category: 'System',
    product: 'jira',
    requiresAuth: true,
    notes: 'Data Center only'
  },

  // ========== License & Plugins (UPM API) ==========
  {
    method: 'GET',
    path: '/rest/plugins/1.0/',
    description: 'List all installed plugins/apps',
    category: 'Plugins',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['plugins[].key', 'plugins[].name', 'plugins[].version', 'plugins[].enabled', 'plugins[].userInstalled', 'plugins[].vendor'],
    notes: 'UPM API - note trailing slash is required'
  },
  {
    method: 'GET',
    path: '/rest/plugins/1.0/installed-marketplace',
    description: 'List all installed Marketplace apps with license info',
    category: 'Plugins',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['plugins[].key', 'plugins[].name', 'plugins[].version', 'plugins[].rawLicense', 'plugins[].licenseType', 'plugins[].expiryDate'],
    notes: 'Includes license keys in rawLicense field - undocumented API'
  },
  {
    method: 'GET',
    path: '/rest/plugins/1.0/{plugin-key}/license',
    description: 'Get license details for a specific plugin',
    category: 'Plugins',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['rawLicense', 'licenseType', 'organizationName', 'contactEmail', 'licenseExpiryDate', 'maintenanceExpiryDate', 'maintenanceExpired'],
    notes: 'Example: /rest/plugins/1.0/com.onresolve.jira.groovy.groovyrunner/license'
  },
  {
    method: 'GET',
    path: '/rest/plugins/applications/1.0/installed/jira-software/license',
    description: 'Get Jira Software application license',
    category: 'License',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['licenseKey', 'licenseType', 'organizationName', 'maximumNumberOfUsers', 'expiryDate', 'supportEntitlementNumber'],
    notes: 'Private endpoint - may change without notice'
  },
  {
    method: 'GET',
    path: '/rest/plugins/applications/1.0/installed/jira-servicedesk/license',
    description: 'Get Jira Service Management application license',
    category: 'License',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['licenseKey', 'licenseType', 'organizationName', 'maximumNumberOfUsers', 'expiryDate'],
    notes: 'Private endpoint - may change without notice'
  },
  {
    method: 'GET',
    path: '/rest/plugins/applications/1.0/installed/jira-core/license',
    description: 'Get Jira Core application license',
    category: 'License',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['licenseKey', 'licenseType', 'organizationName', 'maximumNumberOfUsers', 'expiryDate'],
    notes: 'Private endpoint - may change without notice'
  },

  // ========== Projects ==========
  {
    method: 'GET',
    path: '/rest/api/2/project',
    description: 'List all projects visible to the user',
    category: 'Projects',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['id', 'key', 'name', 'projectTypeKey', 'lead', 'description', 'url', 'avatarUrls']
  },
  {
    method: 'GET',
    path: '/rest/api/2/project/{projectIdOrKey}',
    description: 'Get detailed project information',
    category: 'Projects',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['id', 'key', 'name', 'description', 'lead', 'components', 'issueTypes', 'url', 'projectCategory', 'roles']
  },
  {
    method: 'GET',
    path: '/rest/api/2/project/{projectIdOrKey}/components',
    description: 'Get project components',
    category: 'Projects',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['id', 'name', 'description', 'lead', 'assigneeType', 'project', 'projectId']
  },
  {
    method: 'GET',
    path: '/rest/api/2/project/{projectIdOrKey}/versions',
    description: 'Get project versions',
    category: 'Projects',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['id', 'name', 'description', 'archived', 'released', 'releaseDate', 'projectId']
  },
  {
    method: 'GET',
    path: '/rest/api/2/project/{projectIdOrKey}/statuses',
    description: 'Get all statuses available in a project',
    category: 'Projects',
    product: 'jira',
    requiresAuth: true
  },

  // ========== Issues & Search ==========
  {
    method: 'GET',
    path: '/rest/api/2/search',
    description: 'Search for issues using JQL (GET method)',
    category: 'Issues',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['expand', 'startAt', 'maxResults', 'total', 'issues[]'],
    notes: 'Query params: jql, startAt, maxResults, fields, expand'
  },
  {
    method: 'POST',
    path: '/rest/api/2/search',
    description: 'Search for issues using JQL (POST for large queries)',
    category: 'Issues',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['expand', 'startAt', 'maxResults', 'total', 'issues[]'],
    notes: 'Use POST when JQL is too long for GET request'
  },
  {
    method: 'GET',
    path: '/rest/api/2/issue/{issueIdOrKey}',
    description: 'Get a single issue with all fields',
    category: 'Issues',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['id', 'key', 'self', 'fields', 'changelog', 'renderedFields', 'names', 'schema', 'transitions']
  },
  {
    method: 'GET',
    path: '/rest/api/2/issue/{issueIdOrKey}/changelog',
    description: 'Get issue change history',
    category: 'Issues',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['startAt', 'maxResults', 'total', 'histories[]']
  },
  {
    method: 'GET',
    path: '/rest/api/2/issue/{issueIdOrKey}/comment',
    description: 'Get issue comments',
    category: 'Issues',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['startAt', 'maxResults', 'total', 'comments[]']
  },
  {
    method: 'GET',
    path: '/rest/api/2/issue/{issueIdOrKey}/watchers',
    description: 'Get issue watchers',
    category: 'Issues',
    product: 'jira',
    requiresAuth: true
  },

  // ========== Fields & Custom Fields ==========
  {
    method: 'GET',
    path: '/rest/api/2/field',
    description: 'List all fields (system and custom)',
    category: 'Fields',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['id', 'key', 'name', 'custom', 'orderable', 'navigable', 'searchable', 'clauseNames', 'schema']
  },
  {
    method: 'GET',
    path: '/rest/api/2/customFields',
    description: 'List custom fields with pagination',
    category: 'Fields',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['id', 'name', 'description', 'type', 'searcherKey'],
    notes: 'Paginated - use startAt and maxResults'
  },
  {
    method: 'GET',
    path: '/rest/api/2/field/{fieldId}/option',
    description: 'Get options for a custom field',
    category: 'Fields',
    product: 'jira',
    requiresAuth: true
  },

  // ========== Users & Groups ==========
  {
    method: 'GET',
    path: '/rest/api/2/user',
    description: 'Get user details by username or key',
    category: 'Users',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['key', 'name', 'emailAddress', 'avatarUrls', 'displayName', 'active', 'timeZone', 'groups', 'applicationRoles'],
    notes: 'Query params: username, key, accountId'
  },
  {
    method: 'GET',
    path: '/rest/api/2/user/search',
    description: 'Search for users',
    category: 'Users',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['users[]'],
    notes: 'Query params: username, startAt, maxResults'
  },
  {
    method: 'GET',
    path: '/rest/api/2/user/assignable/search',
    description: 'Find users assignable to issues',
    category: 'Users',
    product: 'jira',
    requiresAuth: true,
    notes: 'Query params: project, issueKey, username'
  },
  {
    method: 'GET',
    path: '/rest/api/2/group',
    description: 'Get group details',
    category: 'Users',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['name', 'self', 'users'],
    notes: 'Query param: groupname'
  },
  {
    method: 'GET',
    path: '/rest/api/2/group/member',
    description: 'Get group members',
    category: 'Users',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['self', 'maxResults', 'startAt', 'total', 'isLast', 'values[]'],
    notes: 'Query param: groupname'
  },
  {
    method: 'GET',
    path: '/rest/api/2/groups/picker',
    description: 'Search for groups',
    category: 'Users',
    product: 'jira',
    requiresAuth: true,
    notes: 'Query params: query, exclude, maxResults'
  },

  // ========== Permissions ==========
  {
    method: 'GET',
    path: '/rest/api/2/mypermissions',
    description: 'Get permissions for the authenticated user',
    category: 'Permissions',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['permissions'],
    notes: 'Query params: projectKey, projectId, issueKey, issueId'
  },
  {
    method: 'GET',
    path: '/rest/api/2/permissions',
    description: 'Get all permissions available in the system',
    category: 'Permissions',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['permissions']
  },
  {
    method: 'GET',
    path: '/rest/api/2/permissionscheme',
    description: 'List all permission schemes',
    category: 'Permissions',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['permissionSchemes[]']
  },
  {
    method: 'GET',
    path: '/rest/api/2/permissionscheme/{schemeId}',
    description: 'Get a permission scheme with all grants',
    category: 'Permissions',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['id', 'name', 'description', 'permissions[]']
  },
  {
    method: 'GET',
    path: '/rest/api/2/applicationrole',
    description: 'Get all application roles',
    category: 'Permissions',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['key', 'groups', 'name', 'defaultGroups', 'selectedByDefault', 'defined', 'numberOfSeats', 'remainingSeats', 'userCount', 'userCountDescription', 'hasUnlimitedSeats', 'platform']
  },

  // ========== Workflows ==========
  {
    method: 'GET',
    path: '/rest/api/2/workflow',
    description: 'List all workflows',
    category: 'Workflows',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['name', 'description', 'lastModifiedDate', 'lastModifiedUser', 'steps', 'default']
  },
  {
    method: 'GET',
    path: '/rest/api/2/workflowscheme',
    description: 'List all workflow schemes',
    category: 'Workflows',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['id', 'name', 'description', 'defaultWorkflow', 'issueTypeMappings', 'draft']
  },
  {
    method: 'GET',
    path: '/rest/api/2/workflowscheme/{id}',
    description: 'Get a workflow scheme',
    category: 'Workflows',
    product: 'jira',
    requiresAuth: true
  },
  {
    method: 'GET',
    path: '/rest/api/2/status',
    description: 'List all statuses',
    category: 'Workflows',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['id', 'name', 'description', 'iconUrl', 'statusCategory']
  },
  {
    method: 'GET',
    path: '/rest/api/2/statuscategory',
    description: 'List all status categories',
    category: 'Workflows',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['id', 'key', 'colorName', 'name']
  },

  // ========== Issue Types & Screens ==========
  {
    method: 'GET',
    path: '/rest/api/2/issuetype',
    description: 'List all issue types',
    category: 'IssueTypes',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['id', 'name', 'description', 'iconUrl', 'subtask', 'avatarId']
  },
  {
    method: 'GET',
    path: '/rest/api/2/issuetypescheme',
    description: 'List all issue type schemes',
    category: 'IssueTypes',
    product: 'jira',
    requiresAuth: true
  },
  {
    method: 'GET',
    path: '/rest/api/2/screens',
    description: 'List all screens',
    category: 'Screens',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['id', 'name', 'description']
  },
  {
    method: 'GET',
    path: '/rest/api/2/screenscheme',
    description: 'List all screen schemes',
    category: 'Screens',
    product: 'jira',
    requiresAuth: true
  },

  // ========== Priorities & Resolutions ==========
  {
    method: 'GET',
    path: '/rest/api/2/priority',
    description: 'List all priorities',
    category: 'Configuration',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['id', 'name', 'description', 'iconUrl', 'statusColor']
  },
  {
    method: 'GET',
    path: '/rest/api/2/resolution',
    description: 'List all resolutions',
    category: 'Configuration',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['id', 'name', 'description']
  },

  // ========== Attachments ==========
  {
    method: 'GET',
    path: '/rest/api/2/attachment/{id}',
    description: 'Get attachment metadata',
    category: 'Attachments',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['id', 'filename', 'author', 'created', 'size', 'mimeType', 'content', 'thumbnail']
  },
  {
    method: 'GET',
    path: '/rest/api/2/attachment/meta',
    description: 'Get attachment capabilities and limits',
    category: 'Attachments',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['enabled', 'uploadLimit']
  },

  // ========== Filters & Dashboards ==========
  {
    method: 'GET',
    path: '/rest/api/2/filter',
    description: 'List filters (saved searches)',
    category: 'Filters',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['id', 'name', 'description', 'owner', 'jql', 'viewUrl', 'searchUrl', 'favourite', 'sharePermissions']
  },
  {
    method: 'GET',
    path: '/rest/api/2/filter/{id}',
    description: 'Get a specific filter',
    category: 'Filters',
    product: 'jira',
    requiresAuth: true
  },
  {
    method: 'GET',
    path: '/rest/api/2/filter/favourite',
    description: 'Get favourite filters for current user',
    category: 'Filters',
    product: 'jira',
    requiresAuth: true
  },
  {
    method: 'GET',
    path: '/rest/api/2/dashboard',
    description: 'List all dashboards',
    category: 'Dashboards',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['startAt', 'maxResults', 'total', 'dashboards[]']
  },
  {
    method: 'GET',
    path: '/rest/api/2/dashboard/{id}',
    description: 'Get a dashboard',
    category: 'Dashboards',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['id', 'name', 'self', 'view', 'owner']
  },

  // ========== Agile/Boards (Jira Software) ==========
  {
    method: 'GET',
    path: '/rest/agile/1.0/board',
    description: 'List all boards',
    category: 'Agile',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['maxResults', 'startAt', 'total', 'isLast', 'values[]'],
    notes: 'Jira Software only'
  },
  {
    method: 'GET',
    path: '/rest/agile/1.0/board/{boardId}',
    description: 'Get a specific board',
    category: 'Agile',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['id', 'name', 'type', 'location'],
    notes: 'Jira Software only'
  },
  {
    method: 'GET',
    path: '/rest/agile/1.0/board/{boardId}/configuration',
    description: 'Get board configuration',
    category: 'Agile',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['id', 'name', 'filter', 'columnConfig', 'ranking'],
    notes: 'Jira Software only'
  },
  {
    method: 'GET',
    path: '/rest/agile/1.0/board/{boardId}/sprint',
    description: 'Get sprints for a board',
    category: 'Agile',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['maxResults', 'startAt', 'total', 'isLast', 'values[]'],
    notes: 'Jira Software only'
  },
  {
    method: 'GET',
    path: '/rest/agile/1.0/sprint/{sprintId}',
    description: 'Get a specific sprint',
    category: 'Agile',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['id', 'state', 'name', 'startDate', 'endDate', 'completeDate', 'originBoardId', 'goal'],
    notes: 'Jira Software only'
  },
  {
    method: 'GET',
    path: '/rest/agile/1.0/epic/{epicIdOrKey}',
    description: 'Get an epic',
    category: 'Agile',
    product: 'jira',
    requiresAuth: true,
    notes: 'Jira Software only'
  },

  // ========== Service Management (JSM) ==========
  {
    method: 'GET',
    path: '/rest/servicedeskapi/servicedesk',
    description: 'List all service desks',
    category: 'ServiceDesk',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['size', 'start', 'limit', 'isLastPage', 'values[]'],
    notes: 'Jira Service Management only'
  },
  {
    method: 'GET',
    path: '/rest/servicedeskapi/servicedesk/{serviceDeskId}',
    description: 'Get a service desk',
    category: 'ServiceDesk',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['id', 'projectId', 'projectName', 'projectKey'],
    notes: 'Jira Service Management only'
  },
  {
    method: 'GET',
    path: '/rest/servicedeskapi/servicedesk/{serviceDeskId}/queue',
    description: 'Get queues for a service desk',
    category: 'ServiceDesk',
    product: 'jira',
    requiresAuth: true,
    notes: 'Jira Service Management only'
  },
  {
    method: 'GET',
    path: '/rest/servicedeskapi/servicedesk/{serviceDeskId}/requesttype',
    description: 'Get request types for a service desk',
    category: 'ServiceDesk',
    product: 'jira',
    requiresAuth: true,
    notes: 'Jira Service Management only'
  }
];

/**
 * Confluence Data Center / Server REST API Endpoints
 * Base URL: https://<instance>/rest/api
 * Documentation: https://developer.atlassian.com/server/confluence/confluence-server-rest-api/
 */
export const CONFLUENCE_DC_API_ENDPOINTS: AtlassianAPIEndpoint[] = [
  // ========== Content ==========
  {
    method: 'GET',
    path: '/rest/api/content',
    description: 'List content (pages, blogs, etc.)',
    category: 'Content',
    product: 'confluence',
    requiresAuth: true,
    responseFields: ['results[]', 'start', 'limit', 'size', '_links'],
    notes: 'Query params: type, spaceKey, title, status, expand'
  },
  {
    method: 'GET',
    path: '/rest/api/content/{id}',
    description: 'Get content by ID',
    category: 'Content',
    product: 'confluence',
    requiresAuth: true,
    responseFields: ['id', 'type', 'status', 'title', 'space', 'history', 'version', 'body', '_links'],
    notes: 'Query param: expand (space,body.storage,version,etc.)'
  },
  {
    method: 'GET',
    path: '/rest/api/content/{id}/child',
    description: 'Get child content (pages under a page)',
    category: 'Content',
    product: 'confluence',
    requiresAuth: true
  },
  {
    method: 'GET',
    path: '/rest/api/content/{id}/descendant',
    description: 'Get all descendants of a page',
    category: 'Content',
    product: 'confluence',
    requiresAuth: true
  },
  {
    method: 'GET',
    path: '/rest/api/content/{id}/history',
    description: 'Get content history',
    category: 'Content',
    product: 'confluence',
    requiresAuth: true,
    responseFields: ['latest', 'createdBy', 'createdDate', 'previousVersion', 'nextVersion', '_links']
  },
  {
    method: 'GET',
    path: '/rest/api/content/{id}/version',
    description: 'Get content versions',
    category: 'Content',
    product: 'confluence',
    requiresAuth: true
  },
  {
    method: 'GET',
    path: '/rest/api/content/{id}/label',
    description: 'Get labels for content',
    category: 'Content',
    product: 'confluence',
    requiresAuth: true,
    responseFields: ['results[]', 'start', 'limit', 'size']
  },
  {
    method: 'GET',
    path: '/rest/api/content/{id}/property',
    description: 'Get content properties (metadata)',
    category: 'Content',
    product: 'confluence',
    requiresAuth: true
  },
  {
    method: 'GET',
    path: '/rest/api/content/{id}/restriction',
    description: 'Get content restrictions (permissions)',
    category: 'Content',
    product: 'confluence',
    requiresAuth: true
  },

  // ========== Search ==========
  {
    method: 'GET',
    path: '/rest/api/content/search',
    description: 'Search content using CQL (Confluence Query Language)',
    category: 'Search',
    product: 'confluence',
    requiresAuth: true,
    responseFields: ['results[]', 'start', 'limit', 'size', 'totalSize', 'cqlQuery', 'searchDuration', '_links'],
    notes: 'Query param: cql (required), expand, limit, start'
  },
  {
    method: 'GET',
    path: '/rest/api/search',
    description: 'Universal search across content, spaces, users',
    category: 'Search',
    product: 'confluence',
    requiresAuth: true,
    notes: 'Query params: cql, cqlcontext, expand, start, limit'
  },

  // ========== Spaces ==========
  {
    method: 'GET',
    path: '/rest/api/space',
    description: 'List all spaces',
    category: 'Spaces',
    product: 'confluence',
    requiresAuth: true,
    responseFields: ['results[]', 'start', 'limit', 'size', '_links'],
    notes: 'Query params: spaceKey, type, status, label, expand'
  },
  {
    method: 'GET',
    path: '/rest/api/space/{spaceKey}',
    description: 'Get a space by key',
    category: 'Spaces',
    product: 'confluence',
    requiresAuth: true,
    responseFields: ['id', 'key', 'name', 'type', 'status', 'description', 'homepage', 'metadata', '_links']
  },
  {
    method: 'GET',
    path: '/rest/api/space/{spaceKey}/content',
    description: 'Get content in a space',
    category: 'Spaces',
    product: 'confluence',
    requiresAuth: true,
    notes: 'Query params: depth, expand, start, limit'
  },
  {
    method: 'GET',
    path: '/rest/api/space/{spaceKey}/content/page',
    description: 'Get all pages in a space',
    category: 'Spaces',
    product: 'confluence',
    requiresAuth: true
  },
  {
    method: 'GET',
    path: '/rest/api/space/{spaceKey}/property',
    description: 'Get space properties',
    category: 'Spaces',
    product: 'confluence',
    requiresAuth: true
  },
  {
    method: 'GET',
    path: '/rest/api/space/{spaceKey}/permission',
    description: 'Get space permissions',
    category: 'Spaces',
    product: 'confluence',
    requiresAuth: true,
    notes: 'Premium/Enterprise feature for detailed permissions'
  },

  // ========== Users & Groups ==========
  {
    method: 'GET',
    path: '/rest/api/user',
    description: 'Get user by username or key',
    category: 'Users',
    product: 'confluence',
    requiresAuth: true,
    responseFields: ['type', 'username', 'userKey', 'profilePicture', 'displayName', '_links'],
    notes: 'Query param: username or key'
  },
  {
    method: 'GET',
    path: '/rest/api/user/current',
    description: 'Get currently authenticated user',
    category: 'Users',
    product: 'confluence',
    requiresAuth: true
  },
  {
    method: 'GET',
    path: '/rest/api/user/memberof',
    description: 'Get groups for a user',
    category: 'Users',
    product: 'confluence',
    requiresAuth: true,
    notes: 'Query param: username'
  },
  {
    method: 'GET',
    path: '/rest/api/group',
    description: 'List all groups',
    category: 'Users',
    product: 'confluence',
    requiresAuth: true,
    responseFields: ['results[]', 'start', 'limit', 'size']
  },
  {
    method: 'GET',
    path: '/rest/api/group/{groupName}',
    description: 'Get a group',
    category: 'Users',
    product: 'confluence',
    requiresAuth: true
  },
  {
    method: 'GET',
    path: '/rest/api/group/{groupName}/member',
    description: 'Get group members',
    category: 'Users',
    product: 'confluence',
    requiresAuth: true
  },

  // ========== Attachments ==========
  {
    method: 'GET',
    path: '/rest/api/content/{id}/child/attachment',
    description: 'Get attachments for a page',
    category: 'Attachments',
    product: 'confluence',
    requiresAuth: true,
    responseFields: ['results[]', 'start', 'limit', 'size']
  },

  // ========== Templates ==========
  {
    method: 'GET',
    path: '/rest/api/template/blueprint',
    description: 'Get blueprint templates',
    category: 'Templates',
    product: 'confluence',
    requiresAuth: true,
    notes: 'Query params: spaceKey, expand, start, limit'
  },
  {
    method: 'GET',
    path: '/rest/api/template/page',
    description: 'Get page templates',
    category: 'Templates',
    product: 'confluence',
    requiresAuth: true,
    notes: 'Query params: spaceKey, expand, start, limit'
  },

  // ========== System & Administration ==========
  {
    method: 'GET',
    path: '/rest/api/settings/lookandfeel',
    description: 'Get look and feel settings',
    category: 'System',
    product: 'confluence',
    requiresAuth: true,
    responseFields: ['selected', 'custom', 'theme', 'global']
  },
  {
    method: 'GET',
    path: '/rest/api/settings/systemInfo',
    description: 'Get system information',
    category: 'System',
    product: 'confluence',
    requiresAuth: true,
    responseFields: ['cloudId', 'commitHash']
  },
  {
    method: 'GET',
    path: '/rest/api/audit',
    description: 'Get audit log entries',
    category: 'System',
    product: 'confluence',
    requiresAuth: true,
    notes: 'Query params: startDate, endDate, searchString, start, limit'
  },

  // ========== Plugins (UPM API - same as Jira) ==========
  {
    method: 'GET',
    path: '/rest/plugins/1.0/',
    description: 'List all installed plugins',
    category: 'Plugins',
    product: 'confluence',
    requiresAuth: true,
    responseFields: ['plugins[].key', 'plugins[].name', 'plugins[].version', 'plugins[].enabled'],
    notes: 'UPM API - note trailing slash is required'
  },
  {
    method: 'GET',
    path: '/rest/plugins/1.0/installed-marketplace',
    description: 'List installed Marketplace apps with licenses',
    category: 'Plugins',
    product: 'confluence',
    requiresAuth: true,
    notes: 'Includes license info - undocumented API'
  },
  {
    method: 'GET',
    path: '/rest/plugins/1.0/{plugin-key}/license',
    description: 'Get license for a specific plugin',
    category: 'Plugins',
    product: 'confluence',
    requiresAuth: true
  }
];

/**
 * Common utility endpoints that work across products
 */
export const COMMON_DC_API_ENDPOINTS: AtlassianAPIEndpoint[] = [
  {
    method: 'GET',
    path: '/rest/auth/1/session',
    description: 'Get current session information',
    category: 'Authentication',
    product: 'common',
    requiresAuth: true,
    responseFields: ['name', 'self', 'loginInfo']
  },
  {
    method: 'GET',
    path: '/status',
    description: 'Health check endpoint (no auth required)',
    category: 'System',
    product: 'common',
    requiresAuth: false,
    responseFields: ['state']
  }
];

/**
 * Get all DC/Server API endpoints for a specific product
 */
export function getDCAPIEndpoints(product: 'jira' | 'confluence' | 'all'): AtlassianAPIEndpoint[] {
  if (product === 'jira') {
    return [...JIRA_DC_API_ENDPOINTS, ...COMMON_DC_API_ENDPOINTS.filter(e => e.product === 'common')];
  }
  if (product === 'confluence') {
    return [...CONFLUENCE_DC_API_ENDPOINTS, ...COMMON_DC_API_ENDPOINTS.filter(e => e.product === 'common')];
  }
  return [...JIRA_DC_API_ENDPOINTS, ...CONFLUENCE_DC_API_ENDPOINTS, ...COMMON_DC_API_ENDPOINTS];
}

/**
 * Get DC/Server API endpoints by category
 */
export function getDCAPIEndpointsByCategory(category: string): AtlassianAPIEndpoint[] {
  return [...JIRA_DC_API_ENDPOINTS, ...CONFLUENCE_DC_API_ENDPOINTS, ...COMMON_DC_API_ENDPOINTS]
    .filter(e => e.category.toLowerCase() === category.toLowerCase());
}

/**
 * Essential endpoints for migration assessment scanning
 */
export const MIGRATION_ASSESSMENT_SCAN_ENDPOINTS = {
  jira: {
    system: ['/rest/api/2/serverInfo', '/rest/api/2/configuration', '/rest/api/2/cluster/nodes'],
    license: ['/rest/plugins/applications/1.0/installed/jira-software/license', '/rest/plugins/applications/1.0/installed/jira-servicedesk/license'],
    plugins: ['/rest/plugins/1.0/', '/rest/plugins/1.0/installed-marketplace'],
    usage: ['/rest/api/2/project', '/rest/api/2/user/search', '/rest/api/2/field', '/rest/api/2/workflow', '/rest/api/2/customFields'],
    configuration: ['/rest/api/2/issuetype', '/rest/api/2/status', '/rest/api/2/priority', '/rest/api/2/resolution', '/rest/api/2/permissionscheme']
  },
  confluence: {
    system: ['/rest/api/settings/systemInfo'],
    plugins: ['/rest/plugins/1.0/', '/rest/plugins/1.0/installed-marketplace'],
    usage: ['/rest/api/space', '/rest/api/user/current', '/rest/api/group'],
    content: ['/rest/api/content', '/rest/api/content/search']
  }
};

// ============================================================================
// ATLASSIAN CLOUD REST API ENDPOINTS
// ============================================================================

/**
 * Jira Cloud REST API v3 Endpoints
 * Base URL: https://your-domain.atlassian.net/rest/api/3
 * Documentation: https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/
 */
export const JIRA_CLOUD_API_ENDPOINTS: AtlassianAPIEndpoint[] = [
  // ========== Server & System Information ==========
  {
    method: 'GET',
    path: '/rest/api/3/serverInfo',
    description: 'Get Jira instance info including version, deployment type, build number',
    category: 'System',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['baseUrl', 'version', 'versionNumbers', 'deploymentType', 'buildNumber', 'buildDate', 'serverTime', 'scmInfo', 'serverTitle', 'healthChecks']
  },
  {
    method: 'GET',
    path: '/rest/api/3/instance/license',
    description: 'Get license information for the Jira instance',
    category: 'License',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['applications[]'],
    notes: 'Requires Administer Jira global permission'
  },
  {
    method: 'GET',
    path: '/rest/api/3/application-properties',
    description: 'Get application configuration properties',
    category: 'System',
    product: 'jira',
    requiresAuth: true,
    notes: 'Requires Administer Jira global permission'
  },
  {
    method: 'GET',
    path: '/rest/api/3/configuration',
    description: 'Get global Jira settings',
    category: 'System',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['votingEnabled', 'watchingEnabled', 'unassignedIssuesAllowed', 'subTasksEnabled', 'issueLinkingEnabled', 'timeTrackingEnabled', 'attachmentsEnabled']
  },

  // ========== Projects ==========
  {
    method: 'GET',
    path: '/rest/api/3/project',
    description: 'List all projects',
    category: 'Projects',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['self', 'id', 'key', 'name', 'projectTypeKey', 'simplified', 'style', 'isPrivate', 'properties', 'entityId', 'uuid'],
    notes: 'Query params: startAt, maxResults, orderBy, expand, query, typeKey, categoryId, action, status'
  },
  {
    method: 'GET',
    path: '/rest/api/3/project/{projectIdOrKey}',
    description: 'Get project details',
    category: 'Projects',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['self', 'id', 'key', 'description', 'lead', 'components', 'issueTypes', 'url', 'email', 'assigneeType', 'versions', 'name', 'roles', 'avatarUrls', 'projectCategory', 'projectTypeKey', 'simplified', 'style', 'favourite', 'isPrivate', 'issueTypeHierarchy', 'permissions', 'properties', 'uuid', 'insight', 'deleted', 'retentionTillDate', 'deletedDate', 'deletedBy', 'archived', 'archivedDate', 'archivedBy', 'landingPageInfo']
  },
  {
    method: 'GET',
    path: '/rest/api/3/project/search',
    description: 'Search for projects',
    category: 'Projects',
    product: 'jira',
    requiresAuth: true,
    notes: 'Query params: startAt, maxResults, orderBy, id, keys, query, typeKey, categoryId, action, expand, status, properties, propertyQuery'
  },
  {
    method: 'GET',
    path: '/rest/api/3/project/{projectIdOrKey}/components',
    description: 'Get project components',
    category: 'Projects',
    product: 'jira',
    requiresAuth: true
  },
  {
    method: 'GET',
    path: '/rest/api/3/project/{projectIdOrKey}/versions',
    description: 'Get project versions',
    category: 'Projects',
    product: 'jira',
    requiresAuth: true
  },
  {
    method: 'GET',
    path: '/rest/api/3/project/{projectIdOrKey}/statuses',
    description: 'Get all statuses for a project',
    category: 'Projects',
    product: 'jira',
    requiresAuth: true
  },
  {
    method: 'GET',
    path: '/rest/api/3/projectCategory',
    description: 'Get all project categories',
    category: 'Projects',
    product: 'jira',
    requiresAuth: true
  },

  // ========== Issues & Search ==========
  {
    method: 'GET',
    path: '/rest/api/3/search',
    description: 'Search for issues using JQL',
    category: 'Issues',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['expand', 'startAt', 'maxResults', 'total', 'issues[]', 'warningMessages', 'names', 'schema'],
    notes: 'Query params: jql, startAt, maxResults, validateQuery, fields, expand, properties, fieldsByKeys'
  },
  {
    method: 'POST',
    path: '/rest/api/3/search',
    description: 'Search for issues using JQL (POST for complex queries)',
    category: 'Issues',
    product: 'jira',
    requiresAuth: true,
    notes: 'Use POST when JQL is too long for GET request'
  },
  {
    method: 'GET',
    path: '/rest/api/3/issue/{issueIdOrKey}',
    description: 'Get issue details',
    category: 'Issues',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['id', 'key', 'self', 'fields', 'renderedFields', 'properties', 'names', 'schema', 'transitions', 'operations', 'editmeta', 'changelog', 'versionedRepresentations', 'fieldsToInclude', 'expand'],
    notes: 'Query params: fields, fieldsByKeys, expand, properties, updateHistory'
  },
  {
    method: 'POST',
    path: '/rest/api/3/issue',
    description: 'Create issue',
    category: 'Issues',
    product: 'jira',
    requiresAuth: true,
    notes: 'Requires Browse projects and Create issues permissions'
  },
  {
    method: 'PUT',
    path: '/rest/api/3/issue/{issueIdOrKey}',
    description: 'Update issue',
    category: 'Issues',
    product: 'jira',
    requiresAuth: true,
    notes: 'Requires Browse projects and Edit issues permissions'
  },
  {
    method: 'DELETE',
    path: '/rest/api/3/issue/{issueIdOrKey}',
    description: 'Delete issue',
    category: 'Issues',
    product: 'jira',
    requiresAuth: true,
    notes: 'Requires Browse projects and Delete issues permissions'
  },
  {
    method: 'GET',
    path: '/rest/api/3/issue/{issueIdOrKey}/changelog',
    description: 'Get issue changelog',
    category: 'Issues',
    product: 'jira',
    requiresAuth: true
  },
  {
    method: 'GET',
    path: '/rest/api/3/issue/{issueIdOrKey}/comment',
    description: 'Get issue comments',
    category: 'Issues',
    product: 'jira',
    requiresAuth: true
  },
  {
    method: 'POST',
    path: '/rest/api/3/issue/bulk',
    description: 'Bulk create issues',
    category: 'Issues',
    product: 'jira',
    requiresAuth: true
  },

  // ========== Fields ==========
  {
    method: 'GET',
    path: '/rest/api/3/field',
    description: 'Get all fields (system and custom)',
    category: 'Fields',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['id', 'key', 'name', 'custom', 'orderable', 'navigable', 'searchable', 'clauseNames', 'scope', 'schema', 'untranslatedName', 'isLocked']
  },
  {
    method: 'GET',
    path: '/rest/api/3/field/search',
    description: 'Search for fields',
    category: 'Fields',
    product: 'jira',
    requiresAuth: true,
    notes: 'Query params: startAt, maxResults, type, id, query, orderBy, expand'
  },
  {
    method: 'POST',
    path: '/rest/api/3/field',
    description: 'Create custom field',
    category: 'Fields',
    product: 'jira',
    requiresAuth: true,
    notes: 'Requires Administer Jira global permission'
  },

  // ========== Users & Groups ==========
  {
    method: 'GET',
    path: '/rest/api/3/user',
    description: 'Get user by account ID',
    category: 'Users',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['self', 'key', 'accountId', 'accountType', 'name', 'emailAddress', 'avatarUrls', 'displayName', 'active', 'timeZone', 'locale', 'groups', 'applicationRoles', 'expand'],
    notes: 'Query param: accountId (required)'
  },
  {
    method: 'GET',
    path: '/rest/api/3/user/search',
    description: 'Find users',
    category: 'Users',
    product: 'jira',
    requiresAuth: true,
    notes: 'Query params: query, accountId, startAt, maxResults'
  },
  {
    method: 'GET',
    path: '/rest/api/3/user/bulk',
    description: 'Bulk get users',
    category: 'Users',
    product: 'jira',
    requiresAuth: true,
    notes: 'Query params: startAt, maxResults, accountId[]'
  },
  {
    method: 'GET',
    path: '/rest/api/3/users/search',
    description: 'Get all users',
    category: 'Users',
    product: 'jira',
    requiresAuth: true,
    notes: 'Query params: startAt, maxResults'
  },
  {
    method: 'GET',
    path: '/rest/api/3/group',
    description: 'Get group',
    category: 'Users',
    product: 'jira',
    requiresAuth: true,
    notes: 'Query params: groupname, groupId, expand'
  },
  {
    method: 'GET',
    path: '/rest/api/3/group/bulk',
    description: 'Bulk get groups',
    category: 'Users',
    product: 'jira',
    requiresAuth: true,
    notes: 'Query params: startAt, maxResults, groupId[], groupName[]'
  },
  {
    method: 'GET',
    path: '/rest/api/3/group/member',
    description: 'Get group members',
    category: 'Users',
    product: 'jira',
    requiresAuth: true,
    notes: 'Query params: groupname, groupId, includeInactiveUsers, startAt, maxResults'
  },
  {
    method: 'GET',
    path: '/rest/api/3/groups/picker',
    description: 'Find groups',
    category: 'Users',
    product: 'jira',
    requiresAuth: true,
    notes: 'Query params: accountId, query, exclude, excludeId, maxResults, caseInsensitive'
  },

  // ========== Permissions ==========
  {
    method: 'GET',
    path: '/rest/api/3/mypermissions',
    description: 'Get my permissions',
    category: 'Permissions',
    product: 'jira',
    requiresAuth: true,
    notes: 'Query params: projectKey, projectId, issueKey, issueId, permissions, projectUuid, projectConfigurationUuid, commentId'
  },
  {
    method: 'GET',
    path: '/rest/api/3/permissions',
    description: 'Get all permissions',
    category: 'Permissions',
    product: 'jira',
    requiresAuth: true
  },
  {
    method: 'POST',
    path: '/rest/api/3/permissions/check',
    description: 'Get bulk permissions',
    category: 'Permissions',
    product: 'jira',
    requiresAuth: true
  },
  {
    method: 'GET',
    path: '/rest/api/3/permissionscheme',
    description: 'Get all permission schemes',
    category: 'Permissions',
    product: 'jira',
    requiresAuth: true,
    notes: 'Requires Administer Jira global permission'
  },
  {
    method: 'GET',
    path: '/rest/api/3/permissionscheme/{schemeId}',
    description: 'Get permission scheme',
    category: 'Permissions',
    product: 'jira',
    requiresAuth: true
  },

  // ========== Workflows ==========
  {
    method: 'GET',
    path: '/rest/api/3/workflow',
    description: 'Get all workflows (paginated)',
    category: 'Workflows',
    product: 'jira',
    requiresAuth: true,
    notes: 'Query params: startAt, maxResults, workflowName, expand'
  },
  {
    method: 'GET',
    path: '/rest/api/3/workflow/search',
    description: 'Search for workflows',
    category: 'Workflows',
    product: 'jira',
    requiresAuth: true,
    notes: 'Query params: startAt, maxResults, workflowName, expand, queryString, orderBy, isActive'
  },
  {
    method: 'GET',
    path: '/rest/api/3/workflowscheme',
    description: 'Get all workflow schemes',
    category: 'Workflows',
    product: 'jira',
    requiresAuth: true
  },
  {
    method: 'GET',
    path: '/rest/api/3/workflowscheme/{id}',
    description: 'Get workflow scheme',
    category: 'Workflows',
    product: 'jira',
    requiresAuth: true
  },
  {
    method: 'GET',
    path: '/rest/api/3/status',
    description: 'Get all statuses',
    category: 'Workflows',
    product: 'jira',
    requiresAuth: true
  },
  {
    method: 'GET',
    path: '/rest/api/3/statuses/search',
    description: 'Search statuses (paginated)',
    category: 'Workflows',
    product: 'jira',
    requiresAuth: true,
    notes: 'Query params: expand, projectId, startAt, maxResults, searchString, statusCategory'
  },
  {
    method: 'GET',
    path: '/rest/api/3/statuscategory',
    description: 'Get all status categories',
    category: 'Workflows',
    product: 'jira',
    requiresAuth: true
  },

  // ========== Issue Types ==========
  {
    method: 'GET',
    path: '/rest/api/3/issuetype',
    description: 'Get all issue types',
    category: 'IssueTypes',
    product: 'jira',
    requiresAuth: true
  },
  {
    method: 'GET',
    path: '/rest/api/3/issuetype/{id}',
    description: 'Get issue type',
    category: 'IssueTypes',
    product: 'jira',
    requiresAuth: true
  },
  {
    method: 'GET',
    path: '/rest/api/3/issuetypescheme',
    description: 'Get all issue type schemes',
    category: 'IssueTypes',
    product: 'jira',
    requiresAuth: true,
    notes: 'Query params: startAt, maxResults, id[], orderBy, expand, queryString'
  },

  // ========== Priorities & Resolutions ==========
  {
    method: 'GET',
    path: '/rest/api/3/priority',
    description: 'Get all priorities',
    category: 'Configuration',
    product: 'jira',
    requiresAuth: true
  },
  {
    method: 'GET',
    path: '/rest/api/3/priority/search',
    description: 'Search priorities',
    category: 'Configuration',
    product: 'jira',
    requiresAuth: true,
    notes: 'Query params: startAt, maxResults, id[], projectId[], priorityName, onlyDefault'
  },
  {
    method: 'GET',
    path: '/rest/api/3/resolution',
    description: 'Get all resolutions',
    category: 'Configuration',
    product: 'jira',
    requiresAuth: true
  },
  {
    method: 'GET',
    path: '/rest/api/3/resolution/search',
    description: 'Search resolutions',
    category: 'Configuration',
    product: 'jira',
    requiresAuth: true,
    notes: 'Query params: startAt, maxResults, id[], onlyDefault'
  },

  // ========== Filters & Dashboards ==========
  {
    method: 'GET',
    path: '/rest/api/3/filter',
    description: 'Get filters (paginated)',
    category: 'Filters',
    product: 'jira',
    requiresAuth: true,
    notes: 'Deprecated - use /rest/api/3/filter/search'
  },
  {
    method: 'GET',
    path: '/rest/api/3/filter/search',
    description: 'Search for filters',
    category: 'Filters',
    product: 'jira',
    requiresAuth: true,
    notes: 'Query params: filterName, accountId, owner, groupname, groupId, projectId, id[], orderBy, startAt, maxResults, expand, overrideSharePermissions'
  },
  {
    method: 'GET',
    path: '/rest/api/3/filter/{id}',
    description: 'Get filter',
    category: 'Filters',
    product: 'jira',
    requiresAuth: true
  },
  {
    method: 'GET',
    path: '/rest/api/3/filter/favourite',
    description: 'Get favorite filters',
    category: 'Filters',
    product: 'jira',
    requiresAuth: true
  },
  {
    method: 'GET',
    path: '/rest/api/3/dashboard',
    description: 'Get all dashboards',
    category: 'Dashboards',
    product: 'jira',
    requiresAuth: true,
    notes: 'Query params: filter, startAt, maxResults'
  },
  {
    method: 'GET',
    path: '/rest/api/3/dashboard/search',
    description: 'Search dashboards',
    category: 'Dashboards',
    product: 'jira',
    requiresAuth: true,
    notes: 'Query params: dashboardName, accountId, owner, groupname, groupId, projectId, orderBy, startAt, maxResults, status, expand'
  },
  {
    method: 'GET',
    path: '/rest/api/3/dashboard/{id}',
    description: 'Get dashboard',
    category: 'Dashboards',
    product: 'jira',
    requiresAuth: true
  },

  // ========== Audit ==========
  {
    method: 'GET',
    path: '/rest/api/3/auditing/record',
    description: 'Get audit records',
    category: 'Audit',
    product: 'jira',
    requiresAuth: true,
    notes: 'Query params: offset, limit, filter, from, to. Requires Administer Jira global permission'
  },

  // ========== Labels ==========
  {
    method: 'GET',
    path: '/rest/api/3/label',
    description: 'Get all labels',
    category: 'Labels',
    product: 'jira',
    requiresAuth: true,
    notes: 'Query params: startAt, maxResults'
  },

  // ========== Attachments ==========
  {
    method: 'GET',
    path: '/rest/api/3/attachment/{id}',
    description: 'Get attachment metadata',
    category: 'Attachments',
    product: 'jira',
    requiresAuth: true
  },
  {
    method: 'GET',
    path: '/rest/api/3/attachment/meta',
    description: 'Get Jira attachment settings',
    category: 'Attachments',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['enabled', 'uploadLimit']
  },
  {
    method: 'POST',
    path: '/rest/api/3/issue/{issueIdOrKey}/attachments',
    description: 'Add attachment to issue',
    category: 'Attachments',
    product: 'jira',
    requiresAuth: true
  },

  // ========== Application Roles ==========
  {
    method: 'GET',
    path: '/rest/api/3/applicationrole',
    description: 'Get all application roles',
    category: 'Permissions',
    product: 'jira',
    requiresAuth: true,
    notes: 'Requires Administer Jira global permission'
  },
  {
    method: 'GET',
    path: '/rest/api/3/applicationrole/{key}',
    description: 'Get application role',
    category: 'Permissions',
    product: 'jira',
    requiresAuth: true
  }
];

/**
 * Jira Software Cloud REST API Endpoints (Agile)
 * Base URL: https://your-domain.atlassian.net/rest/agile/1.0
 * Documentation: https://developer.atlassian.com/cloud/jira/software/rest/
 */
export const JIRA_SOFTWARE_CLOUD_API_ENDPOINTS: AtlassianAPIEndpoint[] = [
  // ========== Boards ==========
  {
    method: 'GET',
    path: '/rest/agile/1.0/board',
    description: 'Get all boards',
    category: 'Agile',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['maxResults', 'startAt', 'total', 'isLast', 'values[]'],
    notes: 'Query params: startAt, maxResults, type, name, projectKeyOrId, accountIdLocation, projectLocation, includePrivate, negateLocationFiltering, orderBy, expand, filterId'
  },
  {
    method: 'GET',
    path: '/rest/agile/1.0/board/{boardId}',
    description: 'Get board',
    category: 'Agile',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['id', 'self', 'name', 'type', 'location']
  },
  {
    method: 'POST',
    path: '/rest/agile/1.0/board',
    description: 'Create board',
    category: 'Agile',
    product: 'jira',
    requiresAuth: true
  },
  {
    method: 'DELETE',
    path: '/rest/agile/1.0/board/{boardId}',
    description: 'Delete board',
    category: 'Agile',
    product: 'jira',
    requiresAuth: true
  },
  {
    method: 'GET',
    path: '/rest/agile/1.0/board/{boardId}/configuration',
    description: 'Get board configuration',
    category: 'Agile',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['id', 'name', 'self', 'type', 'location', 'filter', 'subQuery', 'columnConfig', 'estimation', 'ranking']
  },
  {
    method: 'GET',
    path: '/rest/agile/1.0/board/{boardId}/issue',
    description: 'Get issues for board',
    category: 'Agile',
    product: 'jira',
    requiresAuth: true,
    notes: 'Query params: startAt, maxResults, jql, validateQuery, fields, expand'
  },
  {
    method: 'GET',
    path: '/rest/agile/1.0/board/{boardId}/backlog',
    description: 'Get issues for board backlog',
    category: 'Agile',
    product: 'jira',
    requiresAuth: true
  },
  {
    method: 'GET',
    path: '/rest/agile/1.0/board/{boardId}/project',
    description: 'Get projects for board',
    category: 'Agile',
    product: 'jira',
    requiresAuth: true
  },
  {
    method: 'GET',
    path: '/rest/agile/1.0/board/{boardId}/version',
    description: 'Get all versions for board',
    category: 'Agile',
    product: 'jira',
    requiresAuth: true
  },

  // ========== Sprints ==========
  {
    method: 'GET',
    path: '/rest/agile/1.0/board/{boardId}/sprint',
    description: 'Get all sprints for board',
    category: 'Agile',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['maxResults', 'startAt', 'total', 'isLast', 'values[]'],
    notes: 'Query params: startAt, maxResults, state'
  },
  {
    method: 'GET',
    path: '/rest/agile/1.0/sprint/{sprintId}',
    description: 'Get sprint',
    category: 'Agile',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['id', 'self', 'state', 'name', 'startDate', 'endDate', 'completeDate', 'createdDate', 'originBoardId', 'goal']
  },
  {
    method: 'POST',
    path: '/rest/agile/1.0/sprint',
    description: 'Create sprint',
    category: 'Agile',
    product: 'jira',
    requiresAuth: true
  },
  {
    method: 'PUT',
    path: '/rest/agile/1.0/sprint/{sprintId}',
    description: 'Update sprint',
    category: 'Agile',
    product: 'jira',
    requiresAuth: true
  },
  {
    method: 'POST',
    path: '/rest/agile/1.0/sprint/{sprintId}/issue',
    description: 'Move issues to sprint',
    category: 'Agile',
    product: 'jira',
    requiresAuth: true
  },
  {
    method: 'GET',
    path: '/rest/agile/1.0/sprint/{sprintId}/issue',
    description: 'Get issues for sprint',
    category: 'Agile',
    product: 'jira',
    requiresAuth: true
  },
  {
    method: 'DELETE',
    path: '/rest/agile/1.0/sprint/{sprintId}',
    description: 'Delete sprint',
    category: 'Agile',
    product: 'jira',
    requiresAuth: true
  },

  // ========== Epics ==========
  {
    method: 'GET',
    path: '/rest/agile/1.0/board/{boardId}/epic',
    description: 'Get epics for board',
    category: 'Agile',
    product: 'jira',
    requiresAuth: true,
    notes: 'Query params: startAt, maxResults, done'
  },
  {
    method: 'GET',
    path: '/rest/agile/1.0/epic/{epicIdOrKey}',
    description: 'Get epic',
    category: 'Agile',
    product: 'jira',
    requiresAuth: true,
    responseFields: ['id', 'key', 'self', 'name', 'summary', 'color', 'done']
  },
  {
    method: 'GET',
    path: '/rest/agile/1.0/epic/{epicIdOrKey}/issue',
    description: 'Get issues for epic',
    category: 'Agile',
    product: 'jira',
    requiresAuth: true
  },
  {
    method: 'POST',
    path: '/rest/agile/1.0/epic/{epicIdOrKey}/issue',
    description: 'Move issues to epic',
    category: 'Agile',
    product: 'jira',
    requiresAuth: true
  },
  {
    method: 'POST',
    path: '/rest/agile/1.0/epic/none/issue',
    description: 'Remove issues from epic',
    category: 'Agile',
    product: 'jira',
    requiresAuth: true
  },

  // ========== Backlog ==========
  {
    method: 'POST',
    path: '/rest/agile/1.0/backlog/issue',
    description: 'Move issues to backlog',
    category: 'Agile',
    product: 'jira',
    requiresAuth: true
  },
  {
    method: 'POST',
    path: '/rest/agile/1.0/backlog/{boardId}/issue',
    description: 'Move issues to backlog for board',
    category: 'Agile',
    product: 'jira',
    requiresAuth: true
  },

  // ========== Issue Ranking ==========
  {
    method: 'PUT',
    path: '/rest/agile/1.0/issue/rank',
    description: 'Rank issues',
    category: 'Agile',
    product: 'jira',
    requiresAuth: true
  },
  {
    method: 'GET',
    path: '/rest/agile/1.0/issue/{issueIdOrKey}',
    description: 'Get issue with agile fields',
    category: 'Agile',
    product: 'jira',
    requiresAuth: true
  },
  {
    method: 'GET',
    path: '/rest/agile/1.0/issue/{issueIdOrKey}/estimation',
    description: 'Get issue estimation for board',
    category: 'Agile',
    product: 'jira',
    requiresAuth: true
  }
];

/**
 * Confluence Cloud REST API v1 Endpoints
 * Base URL: https://your-domain.atlassian.net/wiki/rest/api
 * Documentation: https://developer.atlassian.com/cloud/confluence/rest/v1/intro/
 */
export const CONFLUENCE_CLOUD_API_ENDPOINTS: AtlassianAPIEndpoint[] = [
  // ========== Content ==========
  {
    method: 'GET',
    path: '/wiki/rest/api/content',
    description: 'Get content (deprecated - use v2)',
    category: 'Content',
    product: 'confluence',
    requiresAuth: true,
    notes: 'Query params: type, spaceKey, title, status, postingDay, expand, trigger, orderby, start, limit'
  },
  {
    method: 'POST',
    path: '/wiki/rest/api/content',
    description: 'Create content (page, blog post, comment)',
    category: 'Content',
    product: 'confluence',
    requiresAuth: true
  },
  {
    method: 'GET',
    path: '/wiki/rest/api/content/{id}',
    description: 'Get content by ID',
    category: 'Content',
    product: 'confluence',
    requiresAuth: true,
    notes: 'Query params: status, version, embeddedContentRender, expand, trigger'
  },
  {
    method: 'PUT',
    path: '/wiki/rest/api/content/{id}',
    description: 'Update content',
    category: 'Content',
    product: 'confluence',
    requiresAuth: true
  },
  {
    method: 'DELETE',
    path: '/wiki/rest/api/content/{id}',
    description: 'Delete content',
    category: 'Content',
    product: 'confluence',
    requiresAuth: true
  },
  {
    method: 'POST',
    path: '/wiki/rest/api/content/archive',
    description: 'Archive pages (bulk)',
    category: 'Content',
    product: 'confluence',
    requiresAuth: true
  },
  {
    method: 'GET',
    path: '/wiki/rest/api/content/{id}/history',
    description: 'Get content history',
    category: 'Content',
    product: 'confluence',
    requiresAuth: true
  },
  {
    method: 'GET',
    path: '/wiki/rest/api/content/{id}/version',
    description: 'Get content versions',
    category: 'Content',
    product: 'confluence',
    requiresAuth: true
  },
  {
    method: 'GET',
    path: '/wiki/rest/api/content/{id}/child',
    description: 'Get content children',
    category: 'Content',
    product: 'confluence',
    requiresAuth: true,
    notes: 'Query params: expand, parentVersion, start, limit'
  },
  {
    method: 'GET',
    path: '/wiki/rest/api/content/{id}/child/page',
    description: 'Get child pages',
    category: 'Content',
    product: 'confluence',
    requiresAuth: true
  },
  {
    method: 'GET',
    path: '/wiki/rest/api/content/{id}/child/comment',
    description: 'Get content comments',
    category: 'Content',
    product: 'confluence',
    requiresAuth: true,
    notes: 'Query params: expand, parentVersion, start, limit, location, depth'
  },
  {
    method: 'GET',
    path: '/wiki/rest/api/content/{id}/child/attachment',
    description: 'Get content attachments',
    category: 'Content',
    product: 'confluence',
    requiresAuth: true
  },
  {
    method: 'POST',
    path: '/wiki/rest/api/content/{id}/child/attachment',
    description: 'Create or update attachment',
    category: 'Content',
    product: 'confluence',
    requiresAuth: true
  },
  {
    method: 'GET',
    path: '/wiki/rest/api/content/{id}/descendant',
    description: 'Get content descendants',
    category: 'Content',
    product: 'confluence',
    requiresAuth: true
  },
  {
    method: 'GET',
    path: '/wiki/rest/api/content/{id}/descendant/page',
    description: 'Get descendant pages',
    category: 'Content',
    product: 'confluence',
    requiresAuth: true
  },

  // ========== Content Properties ==========
  {
    method: 'GET',
    path: '/wiki/rest/api/content/{id}/property',
    description: 'Get content properties',
    category: 'Content',
    product: 'confluence',
    requiresAuth: true
  },
  {
    method: 'POST',
    path: '/wiki/rest/api/content/{id}/property',
    description: 'Create content property',
    category: 'Content',
    product: 'confluence',
    requiresAuth: true
  },
  {
    method: 'GET',
    path: '/wiki/rest/api/content/{id}/property/{key}',
    description: 'Get content property',
    category: 'Content',
    product: 'confluence',
    requiresAuth: true
  },
  {
    method: 'PUT',
    path: '/wiki/rest/api/content/{id}/property/{key}',
    description: 'Update content property',
    category: 'Content',
    product: 'confluence',
    requiresAuth: true
  },
  {
    method: 'DELETE',
    path: '/wiki/rest/api/content/{id}/property/{key}',
    description: 'Delete content property',
    category: 'Content',
    product: 'confluence',
    requiresAuth: true
  },

  // ========== Content Labels ==========
  {
    method: 'GET',
    path: '/wiki/rest/api/content/{id}/label',
    description: 'Get content labels',
    category: 'Content',
    product: 'confluence',
    requiresAuth: true
  },
  {
    method: 'POST',
    path: '/wiki/rest/api/content/{id}/label',
    description: 'Add labels to content',
    category: 'Content',
    product: 'confluence',
    requiresAuth: true
  },
  {
    method: 'DELETE',
    path: '/wiki/rest/api/content/{id}/label/{label}',
    description: 'Remove label from content',
    category: 'Content',
    product: 'confluence',
    requiresAuth: true
  },

  // ========== Content Restrictions ==========
  {
    method: 'GET',
    path: '/wiki/rest/api/content/{id}/restriction',
    description: 'Get content restrictions',
    category: 'Content',
    product: 'confluence',
    requiresAuth: true
  },
  {
    method: 'PUT',
    path: '/wiki/rest/api/content/{id}/restriction',
    description: 'Update content restrictions',
    category: 'Content',
    product: 'confluence',
    requiresAuth: true
  },
  {
    method: 'POST',
    path: '/wiki/rest/api/content/{id}/restriction',
    description: 'Add content restrictions',
    category: 'Content',
    product: 'confluence',
    requiresAuth: true
  },
  {
    method: 'DELETE',
    path: '/wiki/rest/api/content/{id}/restriction',
    description: 'Delete content restrictions',
    category: 'Content',
    product: 'confluence',
    requiresAuth: true
  },
  {
    method: 'GET',
    path: '/wiki/rest/api/content/{id}/restriction/byOperation',
    description: 'Get restrictions by operation',
    category: 'Content',
    product: 'confluence',
    requiresAuth: true
  },
  {
    method: 'GET',
    path: '/wiki/rest/api/content/{id}/restriction/byOperation/{operationKey}',
    description: 'Get restrictions for operation',
    category: 'Content',
    product: 'confluence',
    requiresAuth: true
  },

  // ========== Search ==========
  {
    method: 'GET',
    path: '/wiki/rest/api/content/search',
    description: 'Search content by CQL',
    category: 'Search',
    product: 'confluence',
    requiresAuth: true,
    notes: 'Query params: cql, cqlcontext, expand, cursor, limit'
  },
  {
    method: 'GET',
    path: '/wiki/rest/api/search',
    description: 'Search using CQL',
    category: 'Search',
    product: 'confluence',
    requiresAuth: true,
    notes: 'Query params: cql, cqlcontext, cursor, next, prev, limit, start, includeArchivedSpaces, excludeCurrentSpaces, excerpt, sitePermissionTypeFilter, expand'
  },
  {
    method: 'GET',
    path: '/wiki/rest/api/search/user',
    description: 'Search users by CQL',
    category: 'Search',
    product: 'confluence',
    requiresAuth: true
  },

  // ========== Spaces ==========
  {
    method: 'GET',
    path: '/wiki/rest/api/space',
    description: 'Get all spaces',
    category: 'Spaces',
    product: 'confluence',
    requiresAuth: true,
    notes: 'Query params: spaceKey, spaceId, type, status, label, favourite, favouriteUserKey, expand, start, limit'
  },
  {
    method: 'POST',
    path: '/wiki/rest/api/space',
    description: 'Create space',
    category: 'Spaces',
    product: 'confluence',
    requiresAuth: true
  },
  {
    method: 'POST',
    path: '/wiki/rest/api/space/_private',
    description: 'Create private space',
    category: 'Spaces',
    product: 'confluence',
    requiresAuth: true
  },
  {
    method: 'GET',
    path: '/wiki/rest/api/space/{spaceKey}',
    description: 'Get space by key',
    category: 'Spaces',
    product: 'confluence',
    requiresAuth: true,
    responseFields: ['id', 'key', 'name', 'type', 'status', 'description', 'icon', 'homepage', '_expandable', '_links']
  },
  {
    method: 'PUT',
    path: '/wiki/rest/api/space/{spaceKey}',
    description: 'Update space',
    category: 'Spaces',
    product: 'confluence',
    requiresAuth: true
  },
  {
    method: 'DELETE',
    path: '/wiki/rest/api/space/{spaceKey}',
    description: 'Delete space',
    category: 'Spaces',
    product: 'confluence',
    requiresAuth: true
  },
  {
    method: 'GET',
    path: '/wiki/rest/api/space/{spaceKey}/content',
    description: 'Get content for space',
    category: 'Spaces',
    product: 'confluence',
    requiresAuth: true,
    notes: 'Query params: depth, expand, start, limit'
  },
  {
    method: 'GET',
    path: '/wiki/rest/api/space/{spaceKey}/content/page',
    description: 'Get pages in space',
    category: 'Spaces',
    product: 'confluence',
    requiresAuth: true
  },
  {
    method: 'GET',
    path: '/wiki/rest/api/space/{spaceKey}/content/blogpost',
    description: 'Get blog posts in space',
    category: 'Spaces',
    product: 'confluence',
    requiresAuth: true
  },

  // ========== Space Properties ==========
  {
    method: 'GET',
    path: '/wiki/rest/api/space/{spaceKey}/property',
    description: 'Get space properties',
    category: 'Spaces',
    product: 'confluence',
    requiresAuth: true
  },
  {
    method: 'POST',
    path: '/wiki/rest/api/space/{spaceKey}/property',
    description: 'Create space property',
    category: 'Spaces',
    product: 'confluence',
    requiresAuth: true
  },
  {
    method: 'GET',
    path: '/wiki/rest/api/space/{spaceKey}/property/{key}',
    description: 'Get space property',
    category: 'Spaces',
    product: 'confluence',
    requiresAuth: true
  },
  {
    method: 'PUT',
    path: '/wiki/rest/api/space/{spaceKey}/property/{key}',
    description: 'Update space property',
    category: 'Spaces',
    product: 'confluence',
    requiresAuth: true
  },
  {
    method: 'DELETE',
    path: '/wiki/rest/api/space/{spaceKey}/property/{key}',
    description: 'Delete space property',
    category: 'Spaces',
    product: 'confluence',
    requiresAuth: true
  },

  // ========== Space Permissions ==========
  {
    method: 'GET',
    path: '/wiki/rest/api/space/{spaceKey}/permission',
    description: 'Get space permissions',
    category: 'Spaces',
    product: 'confluence',
    requiresAuth: true,
    notes: 'Premium feature'
  },
  {
    method: 'POST',
    path: '/wiki/rest/api/space/{spaceKey}/permission',
    description: 'Add permission to space',
    category: 'Spaces',
    product: 'confluence',
    requiresAuth: true
  },
  {
    method: 'POST',
    path: '/wiki/rest/api/space/{spaceKey}/permission/custom-content',
    description: 'Add custom content permission',
    category: 'Spaces',
    product: 'confluence',
    requiresAuth: true
  },
  {
    method: 'DELETE',
    path: '/wiki/rest/api/space/{spaceKey}/permission/{id}',
    description: 'Remove permission from space',
    category: 'Spaces',
    product: 'confluence',
    requiresAuth: true
  },

  // ========== Users ==========
  {
    method: 'GET',
    path: '/wiki/rest/api/user',
    description: 'Get user',
    category: 'Users',
    product: 'confluence',
    requiresAuth: true,
    notes: 'Query params: key, username, accountId, expand'
  },
  {
    method: 'GET',
    path: '/wiki/rest/api/user/current',
    description: 'Get current user',
    category: 'Users',
    product: 'confluence',
    requiresAuth: true
  },
  {
    method: 'GET',
    path: '/wiki/rest/api/user/anonymous',
    description: 'Get anonymous user',
    category: 'Users',
    product: 'confluence',
    requiresAuth: true
  },
  {
    method: 'GET',
    path: '/wiki/rest/api/user/memberof',
    description: 'Get groups for user',
    category: 'Users',
    product: 'confluence',
    requiresAuth: true,
    notes: 'Query params: key, username, accountId, start, limit'
  },
  {
    method: 'GET',
    path: '/wiki/rest/api/user/bulk',
    description: 'Bulk get users',
    category: 'Users',
    product: 'confluence',
    requiresAuth: true,
    notes: 'Query params: accountId, expand, limit'
  },

  // ========== Groups ==========
  {
    method: 'GET',
    path: '/wiki/rest/api/group',
    description: 'Get all groups',
    category: 'Users',
    product: 'confluence',
    requiresAuth: true,
    notes: 'Query params: start, limit, accessType'
  },
  {
    method: 'POST',
    path: '/wiki/rest/api/group',
    description: 'Create group',
    category: 'Users',
    product: 'confluence',
    requiresAuth: true
  },
  {
    method: 'DELETE',
    path: '/wiki/rest/api/group',
    description: 'Delete group',
    category: 'Users',
    product: 'confluence',
    requiresAuth: true,
    notes: 'Query params: name'
  },
  {
    method: 'GET',
    path: '/wiki/rest/api/group/by-name',
    description: 'Get group by name',
    category: 'Users',
    product: 'confluence',
    requiresAuth: true,
    notes: 'Query params: name'
  },
  {
    method: 'GET',
    path: '/wiki/rest/api/group/by-id',
    description: 'Get group by ID',
    category: 'Users',
    product: 'confluence',
    requiresAuth: true,
    notes: 'Query params: id'
  },
  {
    method: 'GET',
    path: '/wiki/rest/api/group/{groupName}/member',
    description: 'Get group members',
    category: 'Users',
    product: 'confluence',
    requiresAuth: true
  },
  {
    method: 'POST',
    path: '/wiki/rest/api/group/userByGroupId',
    description: 'Add user to group by ID',
    category: 'Users',
    product: 'confluence',
    requiresAuth: true
  },
  {
    method: 'DELETE',
    path: '/wiki/rest/api/group/userByGroupId',
    description: 'Remove user from group by ID',
    category: 'Users',
    product: 'confluence',
    requiresAuth: true
  },

  // ========== Audit ==========
  {
    method: 'GET',
    path: '/wiki/rest/api/audit',
    description: 'Get audit records',
    category: 'Audit',
    product: 'confluence',
    requiresAuth: true,
    notes: 'Query params: startDate, endDate, searchString, start, limit'
  },
  {
    method: 'POST',
    path: '/wiki/rest/api/audit',
    description: 'Create audit record',
    category: 'Audit',
    product: 'confluence',
    requiresAuth: true
  },
  {
    method: 'GET',
    path: '/wiki/rest/api/audit/export',
    description: 'Export audit records',
    category: 'Audit',
    product: 'confluence',
    requiresAuth: true,
    notes: 'Query params: startDate, endDate, searchString, format'
  },
  {
    method: 'GET',
    path: '/wiki/rest/api/audit/retention',
    description: 'Get retention period',
    category: 'Audit',
    product: 'confluence',
    requiresAuth: true
  },
  {
    method: 'PUT',
    path: '/wiki/rest/api/audit/retention',
    description: 'Set retention period',
    category: 'Audit',
    product: 'confluence',
    requiresAuth: true
  },
  {
    method: 'GET',
    path: '/wiki/rest/api/audit/since',
    description: 'Get audit records since time',
    category: 'Audit',
    product: 'confluence',
    requiresAuth: true,
    notes: 'Query params: number, units, searchString, start, limit'
  },

  // ========== Templates ==========
  {
    method: 'GET',
    path: '/wiki/rest/api/template/blueprint',
    description: 'Get blueprint templates',
    category: 'Templates',
    product: 'confluence',
    requiresAuth: true,
    notes: 'Query params: spaceKey, start, limit, expand'
  },
  {
    method: 'GET',
    path: '/wiki/rest/api/template/page',
    description: 'Get content templates',
    category: 'Templates',
    product: 'confluence',
    requiresAuth: true,
    notes: 'Query params: spaceKey, start, limit, expand'
  },
  {
    method: 'POST',
    path: '/wiki/rest/api/template',
    description: 'Create content template',
    category: 'Templates',
    product: 'confluence',
    requiresAuth: true
  },
  {
    method: 'PUT',
    path: '/wiki/rest/api/template',
    description: 'Update content template',
    category: 'Templates',
    product: 'confluence',
    requiresAuth: true
  },
  {
    method: 'GET',
    path: '/wiki/rest/api/template/{contentTemplateId}',
    description: 'Get content template',
    category: 'Templates',
    product: 'confluence',
    requiresAuth: true
  },
  {
    method: 'DELETE',
    path: '/wiki/rest/api/template/{contentTemplateId}',
    description: 'Remove content template',
    category: 'Templates',
    product: 'confluence',
    requiresAuth: true
  },

  // ========== Settings & System ==========
  {
    method: 'GET',
    path: '/wiki/rest/api/settings/lookandfeel',
    description: 'Get look and feel settings',
    category: 'System',
    product: 'confluence',
    requiresAuth: true
  },
  {
    method: 'PUT',
    path: '/wiki/rest/api/settings/lookandfeel/custom',
    description: 'Update look and feel settings',
    category: 'System',
    product: 'confluence',
    requiresAuth: true
  },
  {
    method: 'GET',
    path: '/wiki/rest/api/settings/lookandfeel/selected',
    description: 'Get selected look and feel',
    category: 'System',
    product: 'confluence',
    requiresAuth: true
  },
  {
    method: 'GET',
    path: '/wiki/rest/api/settings/theme',
    description: 'Get themes',
    category: 'System',
    product: 'confluence',
    requiresAuth: true
  },
  {
    method: 'GET',
    path: '/wiki/rest/api/settings/theme/selected',
    description: 'Get selected theme',
    category: 'System',
    product: 'confluence',
    requiresAuth: true
  },
  {
    method: 'GET',
    path: '/wiki/rest/api/settings/systemInfo',
    description: 'Get system information',
    category: 'System',
    product: 'confluence',
    requiresAuth: true
  },

  // ========== Long Running Tasks ==========
  {
    method: 'GET',
    path: '/wiki/rest/api/longtask',
    description: 'Get long-running tasks',
    category: 'System',
    product: 'confluence',
    requiresAuth: true,
    notes: 'Query params: start, limit'
  },
  {
    method: 'GET',
    path: '/wiki/rest/api/longtask/{id}',
    description: 'Get long-running task',
    category: 'System',
    product: 'confluence',
    requiresAuth: true
  },

  // ========== Labels ==========
  {
    method: 'GET',
    path: '/wiki/rest/api/label',
    description: 'Get label information',
    category: 'Labels',
    product: 'confluence',
    requiresAuth: true,
    notes: 'Query params: name, type, start, limit'
  },

  // ========== Content Body Conversion ==========
  {
    method: 'POST',
    path: '/wiki/rest/api/contentbody/convert/{to}',
    description: 'Convert content body',
    category: 'Content',
    product: 'confluence',
    requiresAuth: true,
    notes: 'Convert between storage, view, styled_view, export_view, anonymous_export_view, editor formats'
  },

  // ========== Inline Tasks ==========
  {
    method: 'GET',
    path: '/wiki/rest/api/inlinetasks/search',
    description: 'Get inline tasks',
    category: 'Content',
    product: 'confluence',
    requiresAuth: true,
    notes: 'Query params: start, limit, spaceKey, pageId, assignee, creator, completedUser, duedateFrom, duedateTo, createdateFrom, createdateTo, completedateFrom, completedateTo, status'
  },
  {
    method: 'GET',
    path: '/wiki/rest/api/inlinetasks/{inlineTaskId}',
    description: 'Get inline task by ID',
    category: 'Content',
    product: 'confluence',
    requiresAuth: true
  },
  {
    method: 'PUT',
    path: '/wiki/rest/api/inlinetasks/{inlineTaskId}',
    description: 'Update inline task',
    category: 'Content',
    product: 'confluence',
    requiresAuth: true
  }
];

/**
 * Get all Cloud API endpoints for a specific product
 */
export function getCloudAPIEndpoints(product: 'jira' | 'jira-software' | 'confluence' | 'all'): AtlassianAPIEndpoint[] {
  if (product === 'jira') {
    return JIRA_CLOUD_API_ENDPOINTS;
  }
  if (product === 'jira-software') {
    return JIRA_SOFTWARE_CLOUD_API_ENDPOINTS;
  }
  if (product === 'confluence') {
    return CONFLUENCE_CLOUD_API_ENDPOINTS;
  }
  return [...JIRA_CLOUD_API_ENDPOINTS, ...JIRA_SOFTWARE_CLOUD_API_ENDPOINTS, ...CONFLUENCE_CLOUD_API_ENDPOINTS];
}

/**
 * Get Cloud API endpoints by category
 */
export function getCloudAPIEndpointsByCategory(category: string): AtlassianAPIEndpoint[] {
  return [...JIRA_CLOUD_API_ENDPOINTS, ...JIRA_SOFTWARE_CLOUD_API_ENDPOINTS, ...CONFLUENCE_CLOUD_API_ENDPOINTS]
    .filter(e => e.category.toLowerCase() === category.toLowerCase());
}

/**
 * Essential endpoints for Cloud migration verification
 */
export const CLOUD_MIGRATION_VERIFICATION_ENDPOINTS = {
  jira: {
    system: ['/rest/api/3/serverInfo', '/rest/api/3/instance/license', '/rest/api/3/configuration'],
    data: ['/rest/api/3/project/search', '/rest/api/3/users/search', '/rest/api/3/field', '/rest/api/3/workflow/search'],
    configuration: ['/rest/api/3/issuetype', '/rest/api/3/status', '/rest/api/3/priority', '/rest/api/3/permissionscheme']
  },
  jiraSoftware: {
    agile: ['/rest/agile/1.0/board', '/rest/agile/1.0/sprint/{sprintId}']
  },
  confluence: {
    system: ['/wiki/rest/api/settings/systemInfo'],
    data: ['/wiki/rest/api/space', '/wiki/rest/api/search', '/wiki/rest/api/user/current'],
    content: ['/wiki/rest/api/content', '/wiki/rest/api/content/search']
  }
};
