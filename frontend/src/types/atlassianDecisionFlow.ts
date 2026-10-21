// ============================================================================
// Atlassian Services Decision Flow Types
// Based on the Atlassian Services Decision Flow chart for license renewals
// and cloud migrations
// ============================================================================

export type DecisionNodeType = 'question' | 'outcome' | 'recommendation' | 'service';

export type ServiceCategory =
  | 'license_renewal'
  | 'cloud_migration'
  | 'managed_services'
  | 'training'
  | 'consulting'
  | 'support';

export type OutcomeType =
  | 'renew_dc_licenses'
  | 'cloud_migration_assessment'
  | 'managed_services_engagement'
  | 'training_engagement'
  | 'health_check'
  | 'strategic_consulting'
  | 'no_action';

export interface DecisionNode {
  id: string;
  type: DecisionNodeType;
  question?: string;
  options?: DecisionOption[];
  outcome?: OutcomeType;
  recommendation?: string;
  services?: string[];
  talkingPoints?: string[];
  nextSteps?: string[];
}

export interface DecisionOption {
  label: string;
  value: string;
  nextNodeId: string;
  hint?: string;
}

export interface DecisionPath {
  nodeId: string;
  selectedOption?: string;
  timestamp: Date;
}

export interface DecisionFlowState {
  currentNodeId: string;
  path: DecisionPath[];
  completed: boolean;
  outcome?: DecisionFlowOutcome;
}

export interface DecisionFlowOutcome {
  type: OutcomeType;
  title: string;
  description: string;
  recommendedServices: ServiceRecommendation[];
  talkingPoints: string[];
  nextSteps: string[];
  estimatedValue?: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  relatedQuestions: string[];
}

export interface ServiceRecommendation {
  name: string;
  category: ServiceCategory;
  description: string;
  valueProposition: string;
  estimatedEngagement: string;
  prerequisites?: string[];
}

// ============================================================================
// Atlassian Services Decision Flow Definition
// This encodes the decision tree from the Atlassian Services Decision Flow chart
// ============================================================================

export const ATLASSIAN_DECISION_FLOW: Record<string, DecisionNode> = {
  // Entry point
  'start': {
    id: 'start',
    type: 'question',
    question: 'What is the customer\'s current Atlassian deployment status?',
    options: [
      { label: 'Data Center / Server licenses up for renewal', value: 'dc_renewal', nextNodeId: 'renewal_intent' },
      { label: 'Currently on Cloud', value: 'on_cloud', nextNodeId: 'cloud_satisfaction' },
      { label: 'New to Atlassian', value: 'new_customer', nextNodeId: 'new_customer_needs' },
      { label: 'Mixed environment (DC + Cloud)', value: 'mixed', nextNodeId: 'consolidation_intent' },
    ],
  },

  // DC/Server Renewal Path
  'renewal_intent': {
    id: 'renewal_intent',
    type: 'question',
    question: 'What is the customer\'s intent regarding their upcoming renewal?',
    options: [
      { label: 'Want to stay on Data Center', value: 'stay_dc', nextNodeId: 'dc_optimization' },
      { label: 'Considering migration to Cloud', value: 'consider_cloud', nextNodeId: 'migration_timeline' },
      { label: 'Undecided / Need guidance', value: 'undecided', nextNodeId: 'decision_factors' },
      { label: 'Cost concerns with renewal', value: 'cost_concerns', nextNodeId: 'cost_discussion' },
    ],
  },

  'dc_optimization': {
    id: 'dc_optimization',
    type: 'question',
    question: 'Are they satisfied with their current Data Center performance and utilization?',
    options: [
      { label: 'Yes, running smoothly', value: 'satisfied', nextNodeId: 'outcome_dc_renew' },
      { label: 'Performance issues', value: 'performance_issues', nextNodeId: 'health_check_recommend' },
      { label: 'Underutilized / Over-licensed', value: 'license_optimization', nextNodeId: 'license_review' },
      { label: 'Need help with administration', value: 'admin_help', nextNodeId: 'managed_services_pitch' },
    ],
  },

  'migration_timeline': {
    id: 'migration_timeline',
    type: 'question',
    question: 'What is their desired timeline for cloud migration?',
    options: [
      { label: 'Before renewal (< 3 months)', value: 'urgent', nextNodeId: 'urgent_migration' },
      { label: 'Within 6-12 months', value: 'planned', nextNodeId: 'planned_migration' },
      { label: 'Long-term (1-2 years)', value: 'long_term', nextNodeId: 'phased_approach' },
      { label: 'Not sure yet', value: 'unsure', nextNodeId: 'assessment_recommend' },
    ],
  },

  'decision_factors': {
    id: 'decision_factors',
    type: 'question',
    question: 'What are their main concerns about making a decision?',
    options: [
      { label: 'Data security & compliance', value: 'security', nextNodeId: 'security_discussion' },
      { label: 'Migration complexity', value: 'complexity', nextNodeId: 'assessment_recommend' },
      { label: 'Cost comparison DC vs Cloud', value: 'cost', nextNodeId: 'tco_analysis' },
      { label: 'Feature parity concerns', value: 'features', nextNodeId: 'feature_comparison' },
    ],
  },

  'cost_discussion': {
    id: 'cost_discussion',
    type: 'question',
    question: 'What specific cost concerns do they have?',
    options: [
      { label: 'DC licensing costs too high', value: 'dc_expensive', nextNodeId: 'cloud_savings_pitch' },
      { label: 'Cloud subscription seems expensive', value: 'cloud_expensive', nextNodeId: 'cloud_value_pitch' },
      { label: 'Budget constraints for migration', value: 'migration_budget', nextNodeId: 'phased_migration' },
      { label: 'Total cost of ownership unclear', value: 'tco_unclear', nextNodeId: 'tco_analysis' },
    ],
  },

  // Cloud Customer Path
  'cloud_satisfaction': {
    id: 'cloud_satisfaction',
    type: 'question',
    question: 'How satisfied are they with their Cloud experience?',
    options: [
      { label: 'Very satisfied', value: 'satisfied', nextNodeId: 'expansion_opportunity' },
      { label: 'Some challenges', value: 'challenges', nextNodeId: 'cloud_challenges' },
      { label: 'Need more training', value: 'training', nextNodeId: 'training_recommend' },
      { label: 'Considering Premium/Enterprise', value: 'upgrade', nextNodeId: 'tier_upgrade' },
    ],
  },

  'expansion_opportunity': {
    id: 'expansion_opportunity',
    type: 'question',
    question: 'Are there opportunities to expand their Atlassian footprint?',
    options: [
      { label: 'More users/teams to onboard', value: 'user_expansion', nextNodeId: 'outcome_user_expansion' },
      { label: 'Additional products (JSM, Confluence)', value: 'product_expansion', nextNodeId: 'outcome_product_expansion' },
      { label: 'Advanced features needed', value: 'advanced_features', nextNodeId: 'tier_upgrade' },
      { label: 'No expansion needed', value: 'no_expansion', nextNodeId: 'outcome_maintain_relationship' },
    ],
  },

  'cloud_challenges': {
    id: 'cloud_challenges',
    type: 'question',
    question: 'What challenges are they facing with Cloud?',
    options: [
      { label: 'Performance issues', value: 'performance', nextNodeId: 'cloud_optimization' },
      { label: 'User adoption problems', value: 'adoption', nextNodeId: 'training_recommend' },
      { label: 'Missing features from DC', value: 'missing_features', nextNodeId: 'feature_workarounds' },
      { label: 'Integration issues', value: 'integrations', nextNodeId: 'integration_consulting' },
    ],
  },

  // New Customer Path
  'new_customer_needs': {
    id: 'new_customer_needs',
    type: 'question',
    question: 'What are their primary needs for Atlassian tools?',
    options: [
      { label: 'Project management (Jira)', value: 'jira', nextNodeId: 'jira_implementation' },
      { label: 'IT Service Management (JSM)', value: 'jsm', nextNodeId: 'jsm_implementation' },
      { label: 'Documentation (Confluence)', value: 'confluence', nextNodeId: 'confluence_implementation' },
      { label: 'Full suite implementation', value: 'full_suite', nextNodeId: 'enterprise_implementation' },
    ],
  },

  // Mixed Environment Path
  'consolidation_intent': {
    id: 'consolidation_intent',
    type: 'question',
    question: 'What is their goal for the mixed environment?',
    options: [
      { label: 'Full cloud migration', value: 'full_cloud', nextNodeId: 'planned_migration' },
      { label: 'Keep hybrid permanently', value: 'hybrid', nextNodeId: 'hybrid_optimization' },
      { label: 'Consolidate to DC', value: 'consolidate_dc', nextNodeId: 'dc_consolidation' },
      { label: 'Need assessment', value: 'need_assessment', nextNodeId: 'assessment_recommend' },
    ],
  },

  // Intermediate Nodes
  'security_discussion': {
    id: 'security_discussion',
    type: 'question',
    question: 'What specific security/compliance requirements do they have?',
    options: [
      { label: 'Data residency requirements', value: 'data_residency', nextNodeId: 'data_residency_options' },
      { label: 'Industry compliance (HIPAA, SOC2)', value: 'compliance', nextNodeId: 'compliance_discussion' },
      { label: 'SSO/Identity management', value: 'identity', nextNodeId: 'identity_requirements' },
      { label: 'General security concerns', value: 'general', nextNodeId: 'cloud_security_pitch' },
    ],
  },

  'urgent_migration': {
    id: 'urgent_migration',
    type: 'outcome',
    outcome: 'cloud_migration_assessment',
    recommendation: 'Urgent Cloud Migration Assessment',
    services: ['Cloud Migration Assessment', 'Expedited Migration Planning', 'Parallel Running Support'],
    talkingPoints: [
      'We can complete a migration assessment within 2 weeks',
      'Consider temporary DC renewal to avoid service disruption',
      'Our accelerated migration program can complete migration in 4-8 weeks for most customers',
    ],
    nextSteps: [
      'Schedule immediate discovery call',
      'Request instance scan data',
      'Prepare migration timeline proposal',
    ],
  },

  'planned_migration': {
    id: 'planned_migration',
    type: 'outcome',
    outcome: 'cloud_migration_assessment',
    recommendation: 'Planned Cloud Migration Program',
    services: ['Cloud Migration Assessment', 'Migration Planning', 'User Training', 'Go-Live Support'],
    talkingPoints: [
      'Phased migration approach reduces risk',
      'Include comprehensive user training',
      'Plan for pilot group before full rollout',
    ],
    nextSteps: [
      'Conduct Cloud Readiness Assessment',
      'Create detailed migration roadmap',
      'Identify pilot user group',
    ],
  },

  'phased_approach': {
    id: 'phased_approach',
    type: 'outcome',
    outcome: 'strategic_consulting',
    recommendation: 'Long-term Cloud Roadmap',
    services: ['Strategic Consulting', 'Cloud Readiness Assessment', 'Change Management Planning'],
    talkingPoints: [
      'Build a 12-24 month migration roadmap',
      'Consider short-term DC renewal with cloud migration milestones',
      'Include organizational change management',
    ],
    nextSteps: [
      'Strategic planning workshop',
      'Create cloud readiness baseline',
      'Develop change management strategy',
    ],
  },

  'assessment_recommend': {
    id: 'assessment_recommend',
    type: 'outcome',
    outcome: 'cloud_migration_assessment',
    recommendation: 'Cloud Readiness Assessment',
    services: ['Cloud Readiness Assessment', 'Environment Analysis', 'Migration Complexity Report'],
    talkingPoints: [
      'Our assessment provides a clear picture of migration complexity',
      'We analyze apps, customizations, and data for cloud compatibility',
      'You\'ll receive a detailed migration plan with timeline and cost estimates',
    ],
    nextSteps: [
      'Schedule assessment kickoff',
      'Collect environment data',
      'Review assessment findings together',
    ],
  },

  'health_check_recommend': {
    id: 'health_check_recommend',
    type: 'outcome',
    outcome: 'health_check',
    recommendation: 'Data Center Health Check',
    services: ['DC Health Check', 'Performance Optimization', 'Infrastructure Review'],
    talkingPoints: [
      'We can identify performance bottlenecks',
      'Optimize configuration for better performance',
      'Review infrastructure sizing and capacity',
    ],
    nextSteps: [
      'Schedule health check',
      'Collect performance metrics',
      'Present optimization recommendations',
    ],
  },

  'license_review': {
    id: 'license_review',
    type: 'outcome',
    outcome: 'strategic_consulting',
    recommendation: 'License Optimization Review',
    services: ['License Optimization', 'User Audit', 'Tier Optimization'],
    talkingPoints: [
      'Review actual vs licensed user counts',
      'Identify opportunities for license consolidation',
      'Consider tier optimization based on feature usage',
    ],
    nextSteps: [
      'Conduct user audit',
      'Analyze feature utilization',
      'Present optimization recommendations',
    ],
  },

  'managed_services_pitch': {
    id: 'managed_services_pitch',
    type: 'outcome',
    outcome: 'managed_services_engagement',
    recommendation: 'Managed Services Engagement',
    services: ['Managed Services', 'Administration Support', 'Proactive Monitoring'],
    talkingPoints: [
      'Our managed services team can handle day-to-day administration',
      'Proactive monitoring prevents issues before they impact users',
      'Free up your team to focus on strategic initiatives',
    ],
    nextSteps: [
      'Review current admin workload',
      'Propose managed services package',
      'Transition planning',
    ],
  },

  'training_recommend': {
    id: 'training_recommend',
    type: 'outcome',
    outcome: 'training_engagement',
    recommendation: 'Training & Enablement Program',
    services: ['Administrator Training', 'End User Training', 'Best Practices Workshop'],
    talkingPoints: [
      'Role-based training for admins and end users',
      'Hands-on workshops with real use cases',
      'Custom training materials for your organization',
    ],
    nextSteps: [
      'Assess training needs',
      'Design custom training program',
      'Schedule training sessions',
    ],
  },

  'tier_upgrade': {
    id: 'tier_upgrade',
    type: 'outcome',
    outcome: 'cloud_migration_assessment',
    recommendation: 'Premium/Enterprise Tier Upgrade',
    services: ['Tier Assessment', 'Enterprise Features Onboarding', 'Advanced Security Setup'],
    talkingPoints: [
      'Premium includes advanced security and compliance features',
      'Enterprise provides unlimited storage and 24/7 support',
      'Access to Atlassian Access for organization-wide security',
    ],
    nextSteps: [
      'Review feature requirements',
      'Calculate ROI of upgrade',
      'Plan feature rollout',
    ],
  },

  'tco_analysis': {
    id: 'tco_analysis',
    type: 'outcome',
    outcome: 'strategic_consulting',
    recommendation: 'Total Cost of Ownership Analysis',
    services: ['TCO Analysis', 'Cloud vs DC Cost Comparison', 'ROI Calculator'],
    talkingPoints: [
      'We provide comprehensive TCO comparison',
      'Include hidden costs: infrastructure, maintenance, upgrades',
      'Factor in productivity gains from cloud features',
    ],
    nextSteps: [
      'Gather current cost data',
      'Build TCO model',
      'Present comparison report',
    ],
  },

  'cloud_savings_pitch': {
    id: 'cloud_savings_pitch',
    type: 'outcome',
    outcome: 'cloud_migration_assessment',
    recommendation: 'Cloud Cost Savings Assessment',
    services: ['Cloud Cost Analysis', 'Migration ROI', 'Infrastructure Savings'],
    talkingPoints: [
      'Eliminate infrastructure costs with Cloud',
      'No more upgrade projects or maintenance windows',
      'Predictable subscription pricing',
    ],
    nextSteps: [
      'Document current infrastructure costs',
      'Calculate cloud pricing',
      'Present savings projection',
    ],
  },

  'cloud_value_pitch': {
    id: 'cloud_value_pitch',
    type: 'outcome',
    outcome: 'strategic_consulting',
    recommendation: 'Cloud Value Proposition Review',
    services: ['Value Assessment', 'Feature ROI Analysis', 'Productivity Gains Analysis'],
    talkingPoints: [
      'Cloud includes continuous updates and new features',
      'Better collaboration with remote/distributed teams',
      'Reduced IT overhead and faster time-to-value',
    ],
    nextSteps: [
      'Identify key value drivers',
      'Calculate productivity improvements',
      'Build business case',
    ],
  },

  'phased_migration': {
    id: 'phased_migration',
    type: 'outcome',
    outcome: 'cloud_migration_assessment',
    recommendation: 'Budget-Friendly Phased Migration',
    services: ['Phased Migration Planning', 'Product-by-Product Migration', 'Budget Optimization'],
    talkingPoints: [
      'Spread migration costs across fiscal periods',
      'Start with lower-risk products',
      'Demonstrate value before full commitment',
    ],
    nextSteps: [
      'Identify migration phases',
      'Create budget timeline',
      'Start with pilot project',
    ],
  },

  'feature_comparison': {
    id: 'feature_comparison',
    type: 'outcome',
    outcome: 'strategic_consulting',
    recommendation: 'DC to Cloud Feature Comparison',
    services: ['Feature Parity Analysis', 'Gap Assessment', 'Workaround Planning'],
    talkingPoints: [
      'Cloud has reached feature parity for most use cases',
      'Some DC-specific features have cloud alternatives',
      'Cloud-only features provide additional value',
    ],
    nextSteps: [
      'Document critical features',
      'Map to cloud equivalents',
      'Plan for any gaps',
    ],
  },

  // Outcome Nodes
  'outcome_dc_renew': {
    id: 'outcome_dc_renew',
    type: 'outcome',
    outcome: 'renew_dc_licenses',
    recommendation: 'Proceed with DC License Renewal',
    services: ['License Renewal Support', 'Renewal Discount Negotiation'],
    talkingPoints: [
      'Ensure renewal before expiration to maintain support',
      'Consider multi-year renewal for better pricing',
      'Keep cloud migration option open for future',
    ],
    nextSteps: [
      'Confirm renewal quantities',
      'Process renewal order',
      'Schedule annual review',
    ],
  },

  'outcome_user_expansion': {
    id: 'outcome_user_expansion',
    type: 'outcome',
    outcome: 'training_engagement',
    recommendation: 'User Expansion & Onboarding Program',
    services: ['User Onboarding', 'Training Program', 'Change Management'],
    talkingPoints: [
      'Structured onboarding improves adoption',
      'Role-based training accelerates productivity',
      'Champion program builds internal expertise',
    ],
    nextSteps: [
      'Identify new user groups',
      'Design onboarding program',
      'Execute rollout plan',
    ],
  },

  'outcome_product_expansion': {
    id: 'outcome_product_expansion',
    type: 'outcome',
    outcome: 'strategic_consulting',
    recommendation: 'Product Suite Expansion',
    services: ['Product Implementation', 'Integration Setup', 'Best Practices Configuration'],
    talkingPoints: [
      'Integrated suite provides better user experience',
      'Cross-product workflows increase efficiency',
      'Volume discounts on suite purchases',
    ],
    nextSteps: [
      'Assess product fit',
      'Plan implementation',
      'Configure integrations',
    ],
  },

  'outcome_maintain_relationship': {
    id: 'outcome_maintain_relationship',
    type: 'outcome',
    outcome: 'no_action',
    recommendation: 'Maintain Relationship & Monitor',
    services: ['Quarterly Business Review', 'Feature Updates Communication'],
    talkingPoints: [
      'Stay connected for future needs',
      'Share new feature announcements',
      'Offer periodic health checks',
    ],
    nextSteps: [
      'Schedule quarterly check-in',
      'Add to newsletter',
      'Monitor for expansion signals',
    ],
  },

  // Additional nodes for completeness
  'data_residency_options': {
    id: 'data_residency_options',
    type: 'outcome',
    outcome: 'cloud_migration_assessment',
    recommendation: 'Data Residency-Compliant Cloud Migration',
    services: ['Data Residency Assessment', 'Regional Cloud Setup', 'Compliance Configuration'],
    talkingPoints: [
      'Cloud now supports data residency in multiple regions',
      'US, EU, and Australia data residency available',
      'Can meet most regulatory requirements',
    ],
    nextSteps: [
      'Confirm residency requirements',
      'Verify region availability',
      'Plan compliant migration',
    ],
  },

  'compliance_discussion': {
    id: 'compliance_discussion',
    type: 'outcome',
    outcome: 'cloud_migration_assessment',
    recommendation: 'Compliance-Ready Cloud Assessment',
    services: ['Compliance Assessment', 'Security Configuration', 'Audit Preparation'],
    talkingPoints: [
      'Cloud maintains SOC2, ISO 27001, and other certifications',
      'Enterprise tier includes advanced compliance features',
      'We help configure compliant environments',
    ],
    nextSteps: [
      'Document compliance requirements',
      'Map to cloud capabilities',
      'Plan compliance-focused migration',
    ],
  },

  'identity_requirements': {
    id: 'identity_requirements',
    type: 'outcome',
    outcome: 'cloud_migration_assessment',
    recommendation: 'Identity & Access Management Setup',
    services: ['SSO Configuration', 'Atlassian Access Setup', 'User Provisioning'],
    talkingPoints: [
      'Atlassian Access provides SSO for all products',
      'SCIM provisioning for automated user management',
      'Integration with major IdPs (Okta, Azure AD, etc.)',
    ],
    nextSteps: [
      'Document IdP requirements',
      'Plan Access deployment',
      'Configure SSO and provisioning',
    ],
  },

  'cloud_security_pitch': {
    id: 'cloud_security_pitch',
    type: 'outcome',
    outcome: 'cloud_migration_assessment',
    recommendation: 'Cloud Security Assessment',
    services: ['Security Review', 'Trust Center Walkthrough', 'Security Configuration'],
    talkingPoints: [
      'Cloud has enterprise-grade security built in',
      'Regular security audits and penetration testing',
      'Transparent security practices via Trust Center',
    ],
    nextSteps: [
      'Review Trust Center documentation',
      'Address specific security questions',
      'Plan secure migration',
    ],
  },

  'cloud_optimization': {
    id: 'cloud_optimization',
    type: 'outcome',
    outcome: 'strategic_consulting',
    recommendation: 'Cloud Performance Optimization',
    services: ['Performance Analysis', 'Configuration Optimization', 'Best Practices Review'],
    talkingPoints: [
      'Review current configuration for optimization opportunities',
      'Implement performance best practices',
      'Consider Premium tier for advanced features',
    ],
    nextSteps: [
      'Analyze current performance',
      'Identify optimization areas',
      'Implement improvements',
    ],
  },

  'feature_workarounds': {
    id: 'feature_workarounds',
    type: 'outcome',
    outcome: 'strategic_consulting',
    recommendation: 'Feature Gap Workarounds',
    services: ['Gap Analysis', 'Workaround Implementation', 'Custom Solution Development'],
    talkingPoints: [
      'Many DC features have cloud equivalents or alternatives',
      'Marketplace apps can fill some gaps',
      'Custom solutions for unique requirements',
    ],
    nextSteps: [
      'Document missing features',
      'Research alternatives',
      'Implement workarounds',
    ],
  },

  'integration_consulting': {
    id: 'integration_consulting',
    type: 'outcome',
    outcome: 'strategic_consulting',
    recommendation: 'Integration Consulting',
    services: ['Integration Assessment', 'API Configuration', 'Third-Party Integration'],
    talkingPoints: [
      'Cloud APIs enable powerful integrations',
      'Pre-built integrations for common tools',
      'Custom integration development available',
    ],
    nextSteps: [
      'Map integration requirements',
      'Assess available options',
      'Implement integrations',
    ],
  },

  'jira_implementation': {
    id: 'jira_implementation',
    type: 'outcome',
    outcome: 'strategic_consulting',
    recommendation: 'Jira Implementation',
    services: ['Jira Setup', 'Workflow Configuration', 'User Training'],
    talkingPoints: [
      'Start with Cloud for faster time-to-value',
      'We configure best-practice workflows',
      'Training ensures rapid adoption',
    ],
    nextSteps: [
      'Gather requirements',
      'Design implementation plan',
      'Execute setup and training',
    ],
  },

  'jsm_implementation': {
    id: 'jsm_implementation',
    type: 'outcome',
    outcome: 'strategic_consulting',
    recommendation: 'Jira Service Management Implementation',
    services: ['JSM Setup', 'ITSM Configuration', 'Service Catalog Design'],
    talkingPoints: [
      'JSM Cloud includes powerful ITSM features',
      'We help design effective service catalogs',
      'Integration with Jira Software for Dev-Ops workflows',
    ],
    nextSteps: [
      'Assess ITSM requirements',
      'Design service catalog',
      'Implement and train',
    ],
  },

  'confluence_implementation': {
    id: 'confluence_implementation',
    type: 'outcome',
    outcome: 'strategic_consulting',
    recommendation: 'Confluence Implementation',
    services: ['Confluence Setup', 'Space Architecture', 'Template Development'],
    talkingPoints: [
      'Cloud Confluence has excellent collaboration features',
      'We design effective information architecture',
      'Templates accelerate content creation',
    ],
    nextSteps: [
      'Plan space structure',
      'Develop templates',
      'Execute migration/setup',
    ],
  },

  'enterprise_implementation': {
    id: 'enterprise_implementation',
    type: 'outcome',
    outcome: 'strategic_consulting',
    recommendation: 'Enterprise Suite Implementation',
    services: ['Suite Implementation', 'Integration Setup', 'Enterprise Training', 'Change Management'],
    talkingPoints: [
      'Full suite provides integrated experience',
      'Enterprise features for security and compliance',
      'Comprehensive implementation and training',
    ],
    nextSteps: [
      'Enterprise discovery workshop',
      'Design implementation roadmap',
      'Execute phased rollout',
    ],
  },

  'hybrid_optimization': {
    id: 'hybrid_optimization',
    type: 'outcome',
    outcome: 'strategic_consulting',
    recommendation: 'Hybrid Environment Optimization',
    services: ['Hybrid Assessment', 'Integration Setup', 'Sync Configuration'],
    talkingPoints: [
      'Optimize communication between DC and Cloud',
      'Set up effective data synchronization',
      'Plan for eventual full migration',
    ],
    nextSteps: [
      'Assess hybrid architecture',
      'Optimize integrations',
      'Create long-term roadmap',
    ],
  },

  'dc_consolidation': {
    id: 'dc_consolidation',
    type: 'outcome',
    outcome: 'strategic_consulting',
    recommendation: 'Data Center Consolidation',
    services: ['Consolidation Planning', 'Migration Execution', 'Optimization'],
    talkingPoints: [
      'Consolidate multiple DC instances for efficiency',
      'Optimize licensing across consolidated environment',
      'Improve performance and manageability',
    ],
    nextSteps: [
      'Inventory current instances',
      'Design consolidation plan',
      'Execute migration',
    ],
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

export const getDecisionNode = (nodeId: string): DecisionNode | undefined => {
  return ATLASSIAN_DECISION_FLOW[nodeId];
};

export const getOutcomeDetails = (outcome: OutcomeType): { title: string; description: string; urgency: 'low' | 'medium' | 'high' | 'critical' } => {
  const outcomeMap: Record<OutcomeType, { title: string; description: string; urgency: 'low' | 'medium' | 'high' | 'critical' }> = {
    'renew_dc_licenses': {
      title: 'Data Center License Renewal',
      description: 'Proceed with renewing existing Data Center licenses',
      urgency: 'medium',
    },
    'cloud_migration_assessment': {
      title: 'Cloud Migration Assessment',
      description: 'Conduct a comprehensive assessment for cloud migration',
      urgency: 'high',
    },
    'managed_services_engagement': {
      title: 'Managed Services Engagement',
      description: 'Propose managed services to reduce customer admin burden',
      urgency: 'medium',
    },
    'training_engagement': {
      title: 'Training & Enablement',
      description: 'Provide training and enablement services',
      urgency: 'low',
    },
    'health_check': {
      title: 'System Health Check',
      description: 'Perform a comprehensive health check on their environment',
      urgency: 'medium',
    },
    'strategic_consulting': {
      title: 'Strategic Consulting',
      description: 'Provide strategic consulting and planning services',
      urgency: 'medium',
    },
    'no_action': {
      title: 'Maintain Relationship',
      description: 'No immediate action needed, maintain relationship for future opportunities',
      urgency: 'low',
    },
  };

  return outcomeMap[outcome] || { title: 'Unknown', description: '', urgency: 'low' };
};

export const generatePreCallQuestions = (path: DecisionPath[]): string[] => {
  const questions: string[] = [];

  // Generate contextual questions based on the path taken
  for (const step of path) {
    const node = getDecisionNode(step.nodeId);
    if (node?.type === 'question' && step.selectedOption) {
      // Find the selected option
      const option = node.options?.find(o => o.value === step.selectedOption);
      if (option) {
        // Generate follow-up questions based on the selection
        switch (step.selectedOption) {
          case 'consider_cloud':
            questions.push('What\'s driving your consideration to move to Cloud?');
            questions.push('What concerns do you have about the migration process?');
            break;
          case 'cost_concerns':
            questions.push('Can you walk me through your current licensing costs?');
            questions.push('What infrastructure costs are you incurring for your DC deployment?');
            break;
          case 'security':
            questions.push('What specific compliance frameworks do you need to meet?');
            questions.push('Who are the key stakeholders in security decisions?');
            break;
          case 'performance_issues':
            questions.push('How are the performance issues impacting your users?');
            questions.push('When did you first notice these performance problems?');
            break;
        }
      }
    }
  }

  // Add default discovery questions
  if (questions.length === 0) {
    questions.push('What are your organization\'s priorities for the next 12 months?');
    questions.push('Who else should be involved in this conversation?');
    questions.push('What would success look like for this initiative?');
  }

  return questions;
};

export const getServiceValueEstimate = (services: string[]): string => {
  // Simple estimation logic - would be more sophisticated in production
  const serviceValues: Record<string, number> = {
    'Cloud Migration Assessment': 15000,
    'Migration Planning': 25000,
    'User Training': 10000,
    'Go-Live Support': 20000,
    'Managed Services': 50000,
    'Strategic Consulting': 30000,
    'Health Check': 8000,
    'Enterprise Implementation': 75000,
  };

  let total = 0;
  for (const service of services) {
    for (const [key, value] of Object.entries(serviceValues)) {
      if (service.toLowerCase().includes(key.toLowerCase())) {
        total += value;
        break;
      }
    }
  }

  if (total === 0) {
    return '$10,000 - $25,000';
  } else if (total < 20000) {
    return `$${(total * 0.8).toLocaleString()} - $${(total * 1.2).toLocaleString()}`;
  } else {
    return `$${(total * 0.7).toLocaleString()} - $${(total * 1.3).toLocaleString()}`;
  }
};
