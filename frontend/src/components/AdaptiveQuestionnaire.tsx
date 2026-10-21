import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  RadioGroup,
  FormControlLabel,
  Radio,
  Stack,
  Chip,
  Card,
  CardContent,
  LinearProgress,
  IconButton,
  Tooltip,
  Divider
} from '@mui/material';
import {
  ArrowForward,
  ArrowBack,
  Refresh,
  CheckCircle,
  AccountTree
} from '@mui/icons-material';
import * as d3 from 'd3';

interface QuestionOption {
  value: string;
  label: string;
  nextQuestionId: string | null;
  tags?: string[];
}

interface Question {
  id: string;
  text: string;
  category: string;
  options: QuestionOption[];
  context?: string;
}

interface Answer {
  questionId: string;
  questionText: string;
  answer: string;
  tags?: string[];
}

interface QuestionNode {
  id: string;
  question: Question;
  x?: number;
  y?: number;
}

interface QuestionLink {
  source: string;
  target: string;
  label: string;
}

const AdaptiveQuestionnaire: React.FC = () => {
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [showDAG, setShowDAG] = useState(false);
  const dagRef = useRef<SVGSVGElement>(null);

  // Enhanced question tree with conditional logic
  const questionTree: Record<string, Question> = {
    start: {
      id: 'start',
      text: 'What is the primary challenge your organization is facing?',
      category: 'discovery',
      context: 'Understanding the core business problem',
      options: [
        {
          value: 'collaboration',
          label: 'Team collaboration and knowledge sharing',
          nextQuestionId: 'collab_current_tools',
          tags: ['collaboration', 'knowledge-management']
        },
        {
          value: 'development',
          label: 'Software development and DevOps efficiency',
          nextQuestionId: 'dev_current_state',
          tags: ['devops', 'development']
        },
        {
          value: 'service_management',
          label: 'IT service management and support',
          nextQuestionId: 'itsm_current_tools',
          tags: ['itsm', 'support']
        },
        {
          value: 'project_management',
          label: 'Project and work management',
          nextQuestionId: 'pm_methodology',
          tags: ['project-management', 'agile']
        }
      ]
    },

    // Collaboration Path
    collab_current_tools: {
      id: 'collab_current_tools',
      text: 'What collaboration tools are you currently using?',
      category: 'current-state',
      context: 'Assessing existing collaboration infrastructure',
      options: [
        {
          value: 'confluence',
          label: 'Already using Confluence',
          nextQuestionId: 'collab_confluence_usage',
          tags: ['confluence', 'existing-customer']
        },
        {
          value: 'sharepoint',
          label: 'Microsoft SharePoint / Teams',
          nextQuestionId: 'collab_migration_interest',
          tags: ['microsoft', 'migration-candidate']
        },
        {
          value: 'google',
          label: 'Google Workspace',
          nextQuestionId: 'collab_search_issues',
          tags: ['google', 'cloud']
        },
        {
          value: 'none',
          label: 'No centralized collaboration tool',
          nextQuestionId: 'collab_team_size',
          tags: ['greenfield']
        }
      ]
    },

    collab_confluence_usage: {
      id: 'collab_confluence_usage',
      text: 'How satisfied are you with Confluence for finding information?',
      category: 'satisfaction',
      context: 'Identifying upsell opportunities',
      options: [
        {
          value: 'difficult',
          label: 'Very difficult - we struggle to find information',
          nextQuestionId: 'rovo_recommendation',
          tags: ['pain-point', 'rovo-fit']
        },
        {
          value: 'moderate',
          label: 'Somewhat difficult - takes time to find things',
          nextQuestionId: 'rovo_recommendation',
          tags: ['improvement-opportunity', 'rovo-fit']
        },
        {
          value: 'satisfied',
          label: 'Satisfied with current search capabilities',
          nextQuestionId: 'collab_other_needs',
          tags: ['satisfied']
        }
      ]
    },

    rovo_recommendation: {
      id: 'rovo_recommendation',
      text: 'Have you heard about Atlassian Rovo for AI-powered search and knowledge management?',
      category: 'solution',
      context: 'Introducing Rovo capabilities',
      options: [
        {
          value: 'interested',
          label: 'No, tell me more - sounds interesting',
          nextQuestionId: 'rovo_integration_scope',
          tags: ['rovo-lead', 'ai-interest']
        },
        {
          value: 'aware',
          label: 'Yes, but not implemented yet',
          nextQuestionId: 'rovo_barriers',
          tags: ['rovo-aware', 'sales-opportunity']
        },
        {
          value: 'using',
          label: 'Already using Rovo',
          nextQuestionId: 'collab_other_needs',
          tags: ['rovo-customer']
        }
      ]
    },

    rovo_integration_scope: {
      id: 'rovo_integration_scope',
      text: 'Besides Atlassian tools, what other systems do your teams use daily?',
      category: 'integration',
      context: 'Scoping Rovo connector opportunities',
      options: [
        {
          value: 'google_ms',
          label: 'Google Drive and/or Microsoft 365',
          nextQuestionId: 'rovo_agent_interest',
          tags: ['google', 'microsoft', 'multi-platform']
        },
        {
          value: 'crm',
          label: 'Salesforce or other CRM',
          nextQuestionId: 'rovo_agent_interest',
          tags: ['salesforce', 'crm']
        },
        {
          value: 'many',
          label: 'Multiple systems across different departments',
          nextQuestionId: 'rovo_agent_interest',
          tags: ['complex-environment', 'high-value']
        }
      ]
    },

    rovo_agent_interest: {
      id: 'rovo_agent_interest',
      text: 'Would AI agents that can automate repetitive tasks be valuable to your team?',
      category: 'value-prop',
      context: 'Qualifying Rovo Agents interest',
      options: [
        {
          value: 'very_interested',
          label: 'Yes - we have many manual, repetitive processes',
          nextQuestionId: 'rovo_use_cases',
          tags: ['automation-need', 'high-priority']
        },
        {
          value: 'somewhat',
          label: 'Possibly - depends on the use cases',
          nextQuestionId: 'rovo_use_cases',
          tags: ['education-needed']
        },
        {
          value: 'not_priority',
          label: 'Not a current priority',
          nextQuestionId: 'final_summary',
          tags: ['future-opportunity']
        }
      ]
    },

    rovo_use_cases: {
      id: 'rovo_use_cases',
      text: 'Which of these automation scenarios is most appealing?',
      category: 'use-case',
      context: 'Identifying specific Rovo Agent applications',
      options: [
        {
          value: 'onboarding',
          label: 'Automated employee onboarding and training',
          nextQuestionId: 'final_summary',
          tags: ['hr', 'onboarding-agent']
        },
        {
          value: 'documentation',
          label: 'Auto-generating documentation from code/meetings',
          nextQuestionId: 'final_summary',
          tags: ['documentation', 'code-review-agent']
        },
        {
          value: 'support',
          label: 'Intelligent support ticket triage and response',
          nextQuestionId: 'final_summary',
          tags: ['support', 'support-agent']
        }
      ]
    },

    rovo_barriers: {
      id: 'rovo_barriers',
      text: 'What is preventing you from implementing Rovo?',
      category: 'objection-handling',
      context: 'Understanding and addressing barriers',
      options: [
        {
          value: 'cost',
          label: 'Budget constraints',
          nextQuestionId: 'rovo_roi',
          tags: ['pricing-concern']
        },
        {
          value: 'complexity',
          label: 'Seems complex to implement',
          nextQuestionId: 'rovo_implementation',
          tags: ['implementation-concern']
        },
        {
          value: 'priority',
          label: 'Other priorities came first',
          nextQuestionId: 'rovo_quick_win',
          tags: ['timing']
        }
      ]
    },

    rovo_roi: {
      id: 'rovo_roi',
      text: 'If Rovo could save each team member 2-3 hours per week on search and information gathering, would that justify the investment?',
      category: 'roi-justification',
      context: 'Building business case',
      options: [
        {
          value: 'yes',
          label: 'Yes - that would be significant',
          nextQuestionId: 'rovo_next_steps',
          tags: ['roi-positive', 'closing']
        },
        {
          value: 'need_proof',
          label: 'Need to see proof of that time savings',
          nextQuestionId: 'rovo_trial',
          tags: ['proof-needed']
        }
      ]
    },

    rovo_implementation: {
      id: 'rovo_implementation',
      text: 'Would you be interested in a guided implementation with our solutions team?',
      category: 'services',
      context: 'Offering professional services',
      options: [
        {
          value: 'yes',
          label: 'Yes - professional services would help',
          nextQuestionId: 'rovo_next_steps',
          tags: ['services-opportunity', 'closing']
        },
        {
          value: 'self_service',
          label: 'Prefer self-service implementation',
          nextQuestionId: 'rovo_trial',
          tags: ['self-serve']
        }
      ]
    },

    rovo_quick_win: {
      id: 'rovo_quick_win',
      text: 'Would a 30-day pilot with measurable KPIs help prioritize Rovo?',
      category: 'pilot-offer',
      context: 'Proposing low-risk trial',
      options: [
        {
          value: 'yes',
          label: 'Yes - a pilot would be valuable',
          nextQuestionId: 'rovo_trial',
          tags: ['pilot-interest', 'closing']
        },
        {
          value: 'timing',
          label: 'Good idea, but need to wait 3-6 months',
          nextQuestionId: 'final_summary',
          tags: ['future-opportunity']
        }
      ]
    },

    rovo_trial: {
      id: 'rovo_trial',
      text: 'Which department should we start the Rovo pilot with?',
      category: 'implementation-planning',
      context: 'Planning pilot rollout',
      options: [
        {
          value: 'engineering',
          label: 'Engineering/Development teams',
          nextQuestionId: 'rovo_next_steps',
          tags: ['engineering-pilot']
        },
        {
          value: 'support',
          label: 'Customer support teams',
          nextQuestionId: 'rovo_next_steps',
          tags: ['support-pilot']
        },
        {
          value: 'cross_functional',
          label: 'Cross-functional pilot across departments',
          nextQuestionId: 'rovo_next_steps',
          tags: ['enterprise-pilot']
        }
      ]
    },

    rovo_next_steps: {
      id: 'rovo_next_steps',
      text: 'What would be the best next step for you?',
      category: 'closing',
      context: 'Defining action items',
      options: [
        {
          value: 'demo',
          label: 'Schedule a personalized demo',
          nextQuestionId: 'final_summary',
          tags: ['demo-request', 'hot-lead']
        },
        {
          value: 'proposal',
          label: 'Receive a formal proposal with pricing',
          nextQuestionId: 'final_summary',
          tags: ['proposal-request', 'hot-lead']
        },
        {
          value: 'trial',
          label: 'Start a free trial immediately',
          nextQuestionId: 'final_summary',
          tags: ['trial-signup', 'hot-lead']
        }
      ]
    },

    collab_other_needs: {
      id: 'collab_other_needs',
      text: 'Beyond search, what other collaboration challenges do you face?',
      category: 'additional-needs',
      context: 'Exploring additional opportunities',
      options: [
        {
          value: 'whiteboarding',
          label: 'Visual collaboration and brainstorming',
          nextQuestionId: 'final_summary',
          tags: ['whiteboards', 'confluence-whiteboards']
        },
        {
          value: 'video',
          label: 'Async video communication',
          nextQuestionId: 'loom_recommendation',
          tags: ['loom-fit', 'async-video']
        },
        {
          value: 'goals',
          label: 'Team alignment and goal tracking',
          nextQuestionId: 'atlas_recommendation',
          tags: ['atlas-fit', 'okr']
        }
      ]
    },

    loom_recommendation: {
      id: 'loom_recommendation',
      text: 'Loom is now part of Atlassian. Are you familiar with async video messaging?',
      category: 'solution',
      context: 'Introducing Loom',
      options: [
        {
          value: 'interested',
          label: 'Tell me more about Loom',
          nextQuestionId: 'final_summary',
          tags: ['loom-lead']
        },
        {
          value: 'using',
          label: 'Already using Loom',
          nextQuestionId: 'final_summary',
          tags: ['loom-customer']
        }
      ]
    },

    atlas_recommendation: {
      id: 'atlas_recommendation',
      text: 'How does your organization currently track goals and OKRs?',
      category: 'solution',
      context: 'Qualifying Atlas opportunity',
      options: [
        {
          value: 'spreadsheets',
          label: 'Spreadsheets or documents',
          nextQuestionId: 'final_summary',
          tags: ['atlas-opportunity', 'manual-process']
        },
        {
          value: 'other_tool',
          label: 'Dedicated OKR tool',
          nextQuestionId: 'final_summary',
          tags: ['competitive-situation']
        },
        {
          value: 'none',
          label: 'No formal goal tracking',
          nextQuestionId: 'final_summary',
          tags: ['atlas-high-priority']
        }
      ]
    },

    // Development Path
    dev_current_state: {
      id: 'dev_current_state',
      text: 'What is your current source code management solution?',
      category: 'current-state',
      context: 'Understanding dev tools landscape',
      options: [
        {
          value: 'bitbucket',
          label: 'Atlassian Bitbucket',
          nextQuestionId: 'dev_cicd_status',
          tags: ['bitbucket-customer']
        },
        {
          value: 'github',
          label: 'GitHub',
          nextQuestionId: 'dev_why_switch',
          tags: ['github', 'competitive']
        },
        {
          value: 'gitlab',
          label: 'GitLab',
          nextQuestionId: 'dev_why_switch',
          tags: ['gitlab', 'competitive']
        }
      ]
    },

    dev_cicd_status: {
      id: 'dev_cicd_status',
      text: 'Are you using Bitbucket Pipelines for CI/CD?',
      category: 'feature-adoption',
      context: 'Identifying upsell opportunity',
      options: [
        {
          value: 'yes',
          label: 'Yes, actively using Pipelines',
          nextQuestionId: 'dev_other_needs',
          tags: ['pipelines-user']
        },
        {
          value: 'no',
          label: 'No, using external CI/CD tools',
          nextQuestionId: 'pipelines_pitch',
          tags: ['pipelines-opportunity']
        }
      ]
    },

    pipelines_pitch: {
      id: 'pipelines_pitch',
      text: 'Would you be interested in consolidating your CI/CD with native Bitbucket Pipelines?',
      category: 'solution',
      context: 'Pitching integrated solution',
      options: [
        {
          value: 'yes',
          label: 'Yes - consolidation would simplify our stack',
          nextQuestionId: 'final_summary',
          tags: ['pipelines-lead']
        },
        {
          value: 'maybe',
          label: 'Maybe - need to understand benefits better',
          nextQuestionId: 'final_summary',
          tags: ['education-needed']
        }
      ]
    },

    dev_why_switch: {
      id: 'dev_why_switch',
      text: 'What would motivate you to consider switching code repositories?',
      category: 'competitive',
      context: 'Understanding switching criteria',
      options: [
        {
          value: 'cost',
          label: 'Lower cost or better licensing',
          nextQuestionId: 'final_summary',
          tags: ['price-sensitive']
        },
        {
          value: 'integration',
          label: 'Better integration with Jira',
          nextQuestionId: 'final_summary',
          tags: ['integration-value']
        },
        {
          value: 'not_switching',
          label: 'Not considering a switch',
          nextQuestionId: 'dev_other_needs',
          tags: ['satisfied-competitor']
        }
      ]
    },

    dev_other_needs: {
      id: 'dev_other_needs',
      text: 'What development challenges are you facing?',
      category: 'additional-needs',
      context: 'Exploring other opportunities',
      options: [
        {
          value: 'visibility',
          label: 'Lack of visibility into service dependencies',
          nextQuestionId: 'compass_recommendation',
          tags: ['compass-fit']
        },
        {
          value: 'standards',
          label: 'Inconsistent development practices across teams',
          nextQuestionId: 'compass_recommendation',
          tags: ['compass-fit', 'governance']
        },
        {
          value: 'none',
          label: 'Development tools are working well',
          nextQuestionId: 'final_summary',
          tags: ['satisfied']
        }
      ]
    },

    compass_recommendation: {
      id: 'compass_recommendation',
      text: 'Have you explored Atlassian Compass for developer experience and service catalog?',
      category: 'solution',
      context: 'Introducing Compass',
      options: [
        {
          value: 'interested',
          label: 'No, tell me more',
          nextQuestionId: 'final_summary',
          tags: ['compass-lead']
        },
        {
          value: 'aware',
          label: 'Aware but not implemented',
          nextQuestionId: 'final_summary',
          tags: ['compass-opportunity']
        }
      ]
    },

    // ITSM Path
    itsm_current_tools: {
      id: 'itsm_current_tools',
      text: 'What ITSM platform are you currently using?',
      category: 'current-state',
      context: 'Understanding ITSM landscape',
      options: [
        {
          value: 'jsm',
          label: 'Jira Service Management',
          nextQuestionId: 'jsm_satisfaction',
          tags: ['jsm-customer']
        },
        {
          value: 'servicenow',
          label: 'ServiceNow',
          nextQuestionId: 'servicenow_pain_points',
          tags: ['servicenow', 'competitive']
        },
        {
          value: 'zendesk',
          label: 'Zendesk or Freshdesk',
          nextQuestionId: 'itsm_enterprise_needs',
          tags: ['zendesk', 'competitive']
        },
        {
          value: 'basic',
          label: 'Email or basic ticketing',
          nextQuestionId: 'itsm_scale',
          tags: ['greenfield', 'basic-tools']
        }
      ]
    },

    jsm_satisfaction: {
      id: 'jsm_satisfaction',
      text: 'How well is JSM meeting your service management needs?',
      category: 'satisfaction',
      context: 'Identifying expansion opportunities',
      options: [
        {
          value: 'great',
          label: 'Working great - happy with JSM',
          nextQuestionId: 'jsm_expansion',
          tags: ['satisfied', 'expansion-opportunity']
        },
        {
          value: 'gaps',
          label: 'Some gaps in functionality',
          nextQuestionId: 'jsm_gaps',
          tags: ['improvement-needed']
        }
      ]
    },

    jsm_expansion: {
      id: 'jsm_expansion',
      text: 'Are you using JSM beyond IT support (HR, Legal, Facilities)?',
      category: 'expansion',
      context: 'Enterprise Service Management opportunity',
      options: [
        {
          value: 'yes',
          label: 'Yes, multiple service desks',
          nextQuestionId: 'final_summary',
          tags: ['esm-customer']
        },
        {
          value: 'no',
          label: 'No, just IT support currently',
          nextQuestionId: 'esm_recommendation',
          tags: ['esm-opportunity']
        }
      ]
    },

    esm_recommendation: {
      id: 'esm_recommendation',
      text: 'Would extending JSM to HR, Legal, or Facilities be valuable?',
      category: 'solution',
      context: 'Pitching Enterprise Service Management',
      options: [
        {
          value: 'very_interested',
          label: 'Yes - those teams need better request management',
          nextQuestionId: 'final_summary',
          tags: ['esm-lead', 'high-priority']
        },
        {
          value: 'maybe',
          label: 'Possibly - need to understand the use cases',
          nextQuestionId: 'final_summary',
          tags: ['esm-education-needed']
        }
      ]
    },

    jsm_gaps: {
      id: 'jsm_gaps',
      text: 'What functionality gaps are you experiencing?',
      category: 'gap-analysis',
      context: 'Understanding specific needs',
      options: [
        {
          value: 'assets',
          label: 'Asset and configuration management',
          nextQuestionId: 'jsm_assets_recommendation',
          tags: ['assets-need']
        },
        {
          value: 'automation',
          label: 'More advanced automation',
          nextQuestionId: 'jsm_automation_recommendation',
          tags: ['automation-need']
        },
        {
          value: 'reporting',
          label: 'Better analytics and reporting',
          nextQuestionId: 'final_summary',
          tags: ['analytics-need']
        }
      ]
    },

    jsm_assets_recommendation: {
      id: 'jsm_assets_recommendation',
      text: 'Are you aware of JSM Assets for IT asset and configuration management?',
      category: 'solution',
      context: 'Introducing JSM Assets feature',
      options: [
        {
          value: 'interested',
          label: 'No, tell me about it',
          nextQuestionId: 'final_summary',
          tags: ['assets-lead']
        },
        {
          value: 'aware',
          label: 'Aware but not using it',
          nextQuestionId: 'final_summary',
          tags: ['assets-opportunity']
        }
      ]
    },

    jsm_automation_recommendation: {
      id: 'jsm_automation_recommendation',
      text: 'Have you explored JSM automation rules and Forge apps from the marketplace?',
      category: 'solution',
      context: 'Explaining automation capabilities',
      options: [
        {
          value: 'interested',
          label: 'Need help with automation',
          nextQuestionId: 'final_summary',
          tags: ['automation-services', 'services-opportunity']
        },
        {
          value: 'doing_it',
          label: 'We build our own automations',
          nextQuestionId: 'final_summary',
          tags: ['power-user']
        }
      ]
    },

    servicenow_pain_points: {
      id: 'servicenow_pain_points',
      text: 'What are your biggest challenges with ServiceNow?',
      category: 'competitive',
      context: 'Understanding ServiceNow dissatisfaction',
      options: [
        {
          value: 'cost',
          label: 'High cost and complex licensing',
          nextQuestionId: 'jsm_competitive_pitch',
          tags: ['cost-concern', 'switch-candidate']
        },
        {
          value: 'complexity',
          label: 'Too complex for our needs',
          nextQuestionId: 'jsm_competitive_pitch',
          tags: ['complexity-concern', 'switch-candidate']
        },
        {
          value: 'satisfied',
          label: 'Generally satisfied with ServiceNow',
          nextQuestionId: 'final_summary',
          tags: ['satisfied-competitor']
        }
      ]
    },

    jsm_competitive_pitch: {
      id: 'jsm_competitive_pitch',
      text: 'Would you be interested in comparing JSM as a modern, more affordable ITSM solution?',
      category: 'competitive-pitch',
      context: 'Positioning JSM against ServiceNow',
      options: [
        {
          value: 'yes',
          label: 'Yes - open to exploring alternatives',
          nextQuestionId: 'final_summary',
          tags: ['competitive-opportunity', 'hot-lead']
        },
        {
          value: 'maybe',
          label: 'Maybe in the future',
          nextQuestionId: 'final_summary',
          tags: ['future-opportunity']
        }
      ]
    },

    itsm_enterprise_needs: {
      id: 'itsm_enterprise_needs',
      text: 'As your organization grows, what capabilities are becoming important?',
      category: 'growth-needs',
      context: 'Identifying enterprise feature needs',
      options: [
        {
          value: 'sla',
          label: 'SLA management and reporting',
          nextQuestionId: 'final_summary',
          tags: ['jsm-fit', 'enterprise-features']
        },
        {
          value: 'change',
          label: 'Change and release management',
          nextQuestionId: 'final_summary',
          tags: ['jsm-fit', 'itil-needs']
        },
        {
          value: 'integration',
          label: 'Deep integration with dev tools',
          nextQuestionId: 'final_summary',
          tags: ['jsm-fit', 'devops-integration']
        }
      ]
    },

    itsm_scale: {
      id: 'itsm_scale',
      text: 'What is driving the need for a proper ITSM solution?',
      category: 'motivation',
      context: 'Understanding buying triggers',
      options: [
        {
          value: 'growth',
          label: 'Company growth - outgrowing current tools',
          nextQuestionId: 'final_summary',
          tags: ['growth', 'jsm-greenfield']
        },
        {
          value: 'compliance',
          label: 'Compliance or audit requirements',
          nextQuestionId: 'final_summary',
          tags: ['compliance', 'jsm-greenfield']
        },
        {
          value: 'efficiency',
          label: 'Need better efficiency and automation',
          nextQuestionId: 'final_summary',
          tags: ['efficiency', 'jsm-greenfield']
        }
      ]
    },

    // Project Management Path
    pm_methodology: {
      id: 'pm_methodology',
      text: 'What project management methodology does your team primarily use?',
      category: 'current-state',
      context: 'Understanding PM approach',
      options: [
        {
          value: 'agile',
          label: 'Agile/Scrum',
          nextQuestionId: 'pm_current_tools',
          tags: ['agile', 'scrum']
        },
        {
          value: 'waterfall',
          label: 'Waterfall or traditional PM',
          nextQuestionId: 'pm_current_tools',
          tags: ['waterfall', 'traditional']
        },
        {
          value: 'hybrid',
          label: 'Hybrid approach',
          nextQuestionId: 'pm_current_tools',
          tags: ['hybrid']
        }
      ]
    },

    pm_current_tools: {
      id: 'pm_current_tools',
      text: 'What tools are you currently using for project management?',
      category: 'current-state',
      context: 'Tool landscape assessment',
      options: [
        {
          value: 'jira',
          label: 'Jira Software or Jira Work Management',
          nextQuestionId: 'pm_jira_satisfaction',
          tags: ['jira-customer']
        },
        {
          value: 'monday',
          label: 'Monday.com, Asana, or similar',
          nextQuestionId: 'pm_why_switch',
          tags: ['competitive']
        },
        {
          value: 'microsoft',
          label: 'Microsoft Project or Planner',
          nextQuestionId: 'pm_why_switch',
          tags: ['microsoft', 'competitive']
        },
        {
          value: 'spreadsheets',
          label: 'Spreadsheets and documents',
          nextQuestionId: 'pm_scale_need',
          tags: ['greenfield', 'manual']
        }
      ]
    },

    pm_jira_satisfaction: {
      id: 'pm_jira_satisfaction',
      text: 'How well is Jira supporting your project management needs?',
      category: 'satisfaction',
      context: 'Assessing satisfaction and upsell opportunities',
      options: [
        {
          value: 'great',
          label: 'Great - Jira works well for us',
          nextQuestionId: 'pm_scaling_needs',
          tags: ['satisfied']
        },
        {
          value: 'challenges',
          label: 'Facing some challenges',
          nextQuestionId: 'pm_jira_challenges',
          tags: ['improvement-needed']
        }
      ]
    },

    pm_scaling_needs: {
      id: 'pm_scaling_needs',
      text: 'Are you managing projects at an enterprise or portfolio level?',
      category: 'scale',
      context: 'Qualifying for Jira Align',
      options: [
        {
          value: 'yes',
          label: 'Yes - managing large programs with multiple teams',
          nextQuestionId: 'jira_align_awareness',
          tags: ['enterprise', 'jira-align-fit']
        },
        {
          value: 'growing',
          label: 'Growing to that level',
          nextQuestionId: 'jira_align_awareness',
          tags: ['growth', 'jira-align-fit']
        },
        {
          value: 'no',
          label: 'No - team-level projects only',
          nextQuestionId: 'final_summary',
          tags: ['team-level']
        }
      ]
    },

    jira_align_awareness: {
      id: 'jira_align_awareness',
      text: 'Are you familiar with Jira Align for enterprise agile planning?',
      category: 'solution',
      context: 'Introducing Jira Align',
      options: [
        {
          value: 'interested',
          label: 'No, tell me more',
          nextQuestionId: 'final_summary',
          tags: ['jira-align-lead', 'enterprise']
        },
        {
          value: 'using',
          label: 'Already using Jira Align',
          nextQuestionId: 'final_summary',
          tags: ['jira-align-customer']
        },
        {
          value: 'aware',
          label: 'Aware but not implemented',
          nextQuestionId: 'final_summary',
          tags: ['jira-align-opportunity']
        }
      ]
    },

    pm_jira_challenges: {
      id: 'pm_jira_challenges',
      text: 'What specific challenges are you experiencing with Jira?',
      category: 'gap-analysis',
      context: 'Identifying improvement areas',
      options: [
        {
          value: 'complexity',
          label: 'Too complex for non-technical teams',
          nextQuestionId: 'jwm_recommendation',
          tags: ['complexity', 'jwm-fit']
        },
        {
          value: 'reporting',
          label: 'Reporting and visibility gaps',
          nextQuestionId: 'final_summary',
          tags: ['reporting-need']
        },
        {
          value: 'training',
          label: 'User adoption and training issues',
          nextQuestionId: 'final_summary',
          tags: ['training-need', 'services-opportunity']
        }
      ]
    },

    jwm_recommendation: {
      id: 'jwm_recommendation',
      text: 'Have you tried Jira Work Management for business teams?',
      category: 'solution',
      context: 'Introducing JWM as simpler alternative',
      options: [
        {
          value: 'interested',
          label: 'No - sounds interesting',
          nextQuestionId: 'final_summary',
          tags: ['jwm-lead']
        },
        {
          value: 'using',
          label: 'Already using it',
          nextQuestionId: 'final_summary',
          tags: ['jwm-customer']
        }
      ]
    },

    pm_why_switch: {
      id: 'pm_why_switch',
      text: 'What would motivate you to consider Jira for project management?',
      category: 'competitive',
      context: 'Understanding switching criteria',
      options: [
        {
          value: 'integration',
          label: 'Better integration with dev and IT tools',
          nextQuestionId: 'final_summary',
          tags: ['integration-value', 'jira-opportunity']
        },
        {
          value: 'scale',
          label: 'Better support for scaling agile',
          nextQuestionId: 'final_summary',
          tags: ['scale-value', 'jira-opportunity']
        },
        {
          value: 'cost',
          label: 'More cost-effective solution',
          nextQuestionId: 'final_summary',
          tags: ['cost-value', 'jira-opportunity']
        },
        {
          value: 'not_switching',
          label: 'Not considering a switch',
          nextQuestionId: 'final_summary',
          tags: ['satisfied-competitor']
        }
      ]
    },

    pm_scale_need: {
      id: 'pm_scale_need',
      text: 'What is driving the need to move beyond spreadsheets?',
      category: 'motivation',
      context: 'Understanding buying triggers',
      options: [
        {
          value: 'visibility',
          label: 'Need better visibility and reporting',
          nextQuestionId: 'final_summary',
          tags: ['visibility-need', 'jira-greenfield']
        },
        {
          value: 'collaboration',
          label: 'Better team collaboration',
          nextQuestionId: 'final_summary',
          tags: ['collaboration-need', 'jira-greenfield']
        },
        {
          value: 'growth',
          label: 'Company growth - outgrowing spreadsheets',
          nextQuestionId: 'final_summary',
          tags: ['growth', 'jira-greenfield']
        }
      ]
    },

    final_summary: {
      id: 'final_summary',
      text: 'Thank you! Based on your responses, would you like a customized recommendation report?',
      category: 'closing',
      context: 'Offering value-add report',
      options: [
        {
          value: 'yes',
          label: 'Yes, send me recommendations',
          nextQuestionId: null,
          tags: ['report-request', 'engaged-lead']
        },
        {
          value: 'demo',
          label: 'Yes, and schedule a demo',
          nextQuestionId: null,
          tags: ['demo-request', 'hot-lead']
        },
        {
          value: 'later',
          label: 'No thanks, just gathering information',
          nextQuestionId: null,
          tags: ['research-phase']
        }
      ]
    }
  };

  useEffect(() => {
    if (!currentQuestion) {
      setCurrentQuestion(questionTree.start);
      setHistory(['start']);
    }
  }, []);

  useEffect(() => {
    if (showDAG && currentQuestion) {
      renderDAG();
    }
  }, [showDAG, currentQuestion, answers]);

  const handleAnswer = () => {
    if (!selectedAnswer || !currentQuestion) return;

    const selectedOption = currentQuestion.options.find(opt => opt.value === selectedAnswer);
    if (!selectedOption) return;

    // Record answer
    const newAnswer: Answer = {
      questionId: currentQuestion.id,
      questionText: currentQuestion.text,
      answer: selectedOption.label,
      tags: selectedOption.tags
    };

    setAnswers([...answers, newAnswer]);

    // Navigate to next question
    if (selectedOption.nextQuestionId) {
      const nextQuestion = questionTree[selectedOption.nextQuestionId];
      setCurrentQuestion(nextQuestion);
      setHistory([...history, selectedOption.nextQuestionId]);
      setSelectedAnswer('');
    } else {
      // End of questionnaire
      setIsComplete(true);
    }
  };

  const handleBack = () => {
    if (history.length <= 1) return;

    const newHistory = [...history];
    newHistory.pop();
    const previousQuestionId = newHistory[newHistory.length - 1];

    setCurrentQuestion(questionTree[previousQuestionId]);
    setHistory(newHistory);
    setSelectedAnswer('');

    const newAnswers = [...answers];
    newAnswers.pop();
    setAnswers(newAnswers);
  };

  const handleReset = () => {
    setCurrentQuestion(questionTree.start);
    setSelectedAnswer('');
    setAnswers([]);
    setHistory(['start']);
    setIsComplete(false);
  };

  const renderDAG = () => {
    if (!dagRef.current) return;

    const width = 1200;
    const height = 600;

    d3.select(dagRef.current).selectAll("*").remove();

    const svg = d3.select(dagRef.current)
      .attr('width', width)
      .attr('height', height);

    // Build graph from current path
    const nodes: QuestionNode[] = history.map(qId => ({
      id: qId,
      question: questionTree[qId]
    }));

    const links: QuestionLink[] = [];
    for (let i = 0; i < history.length - 1; i++) {
      const answer = answers[i];
      links.push({
        source: history[i],
        target: history[i + 1],
        label: answer?.answer.substring(0, 20) + '...' || ''
      });
    }

    // Add potential next steps
    if (currentQuestion && !isComplete) {
      currentQuestion.options.forEach(opt => {
        if (opt.nextQuestionId) {
          const exists = nodes.find(n => n.id === opt.nextQuestionId);
          if (!exists) {
            nodes.push({
              id: opt.nextQuestionId,
              question: questionTree[opt.nextQuestionId]
            });
            links.push({
              source: currentQuestion.id,
              target: opt.nextQuestionId,
              label: opt.label.substring(0, 20) + '...'
            });
          }
        }
      });
    }

    // Layout nodes
    const levelMap: Record<string, number> = {};
    history.forEach((qId, idx) => {
      levelMap[qId] = idx;
    });

    nodes.forEach(node => {
      if (levelMap[node.id] !== undefined) {
        node.x = 150 + levelMap[node.id] * 200;
        node.y = height / 2;
      } else {
        // Potential future nodes
        const sourceLevel = levelMap[currentQuestion!.id];
        node.x = 150 + (sourceLevel + 1) * 200;
        const currentOptions = currentQuestion!.options.filter(opt => opt.nextQuestionId === node.id);
        const optionIndex = currentQuestion!.options.indexOf(currentOptions[0]);
        node.y = height / 2 + (optionIndex - 1) * 120;
      }
    });

    // Draw links
    const link = svg.append('g').selectAll('.dag-link')
      .data(links)
      .enter()
      .append('g')
      .attr('class', 'dag-link');

    link.append('path')
      .attr('d', (d: any) => {
        const source = nodes.find(n => n.id === d.source)!;
        const target = nodes.find(n => n.id === d.target)!;
        return `M ${source.x} ${source.y} L ${target.x} ${target.y}`;
      })
      .attr('stroke', (d: any) => {
        const sourceIdx = history.indexOf(d.source);
        const targetIdx = history.indexOf(d.target);
        return (targetIdx === sourceIdx + 1) ? '#10b981' : '#475569';
      })
      .attr('stroke-width', (d: any) => {
        const sourceIdx = history.indexOf(d.source);
        const targetIdx = history.indexOf(d.target);
        return (targetIdx === sourceIdx + 1) ? 3 : 1.5;
      })
      .attr('fill', 'none')
      .attr('opacity', 0.6)
      .attr('marker-end', 'url(#arrowhead)');

    // Arrow marker
    svg.append('defs').append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 25)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .append('path')
      .attr('d', 'M 0,-5 L 10,0 L 0,5')
      .attr('fill', '#10b981');

    // Draw nodes
    const node = svg.append('g').selectAll('.dag-node')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'dag-node')
      .attr('transform', d => `translate(${d.x},${d.y})`);

    node.append('circle')
      .attr('r', 30)
      .attr('fill', d => {
        if (d.id === currentQuestion?.id) return '#2563eb';
        if (history.includes(d.id)) return '#10b981';
        return '#475569';
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);

    node.append('text')
      .text((d, i) => history.includes(d.id) ? (history.indexOf(d.id) + 1).toString() : '?')
      .attr('text-anchor', 'middle')
      .attr('dy', '.35em')
      .attr('fill', '#fff')
      .attr('font-weight', 600)
      .attr('font-size', 16);

    // Labels
    node.append('text')
      .text(d => d.question.text.substring(0, 30) + '...')
      .attr('text-anchor', 'middle')
      .attr('dy', 50)
      .attr('fill', '#cbd5e1')
      .attr('font-size', 11)
      .style('max-width', '150px');
  };

  const getProgress = () => {
    if (!currentQuestion) return 0;
    const totalQuestions = Object.keys(questionTree).length;
    return (answers.length / totalQuestions) * 100;
  };

  const getAllTags = (): string[] => {
    const allTags: string[] = [];
    answers.forEach(answer => {
      if (answer.tags) {
        allTags.push(...answer.tags);
      }
    });
    return [...new Set(allTags)];
  };

  if (isComplete) {
    const tags = getAllTags();
    return (
      <Box>
        <Paper sx={{ p: 4, bgcolor: 'rgba(30, 35, 50, 0.95)', mb: 3 }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <CheckCircle sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
            <Typography variant="h4" sx={{ color: '#fff', mb: 2 }}>
              Questionnaire Complete!
            </Typography>
            <Typography variant="body1" sx={{ color: '#cbd5e1', mb: 3 }}>
              Thank you for providing detailed information. Here's a summary of your journey:
            </Typography>
          </Box>

          <Divider sx={{ my: 3, borderColor: '#334155' }} />

          <Typography variant="h6" sx={{ color: '#fff', mb: 2 }}>
            Your Responses ({answers.length} questions)
          </Typography>

          <Stack spacing={2} sx={{ mb: 3 }}>
            {answers.map((answer, idx) => (
              <Card key={idx} sx={{ bgcolor: 'rgba(15, 23, 42, 0.6)', border: '1px solid #334155' }}>
                <CardContent>
                  <Typography variant="subtitle2" sx={{ color: 'text.disabled', mb: 1 }}>
                    Q{idx + 1}: {answer.questionText}
                  </Typography>
                  <Typography variant="body1" sx={{ color: 'success.main', fontWeight: 600 }}>
                    {answer.answer}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Stack>

          <Divider sx={{ my: 3, borderColor: '#334155' }} />

          <Typography variant="h6" sx={{ color: '#fff', mb: 2 }}>
            Identified Opportunities
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
            {tags.map((tag, idx) => (
              <Chip
                key={idx}
                label={tag}
                size="small"
                sx={{
                  bgcolor: tag.includes('lead') || tag.includes('opportunity') ? '#10b981' : '#475569',
                  color: '#fff'
                }}
              />
            ))}
          </Box>

          <Stack direction="row" spacing={2} justifyContent="center">
            <Button
              variant="contained"
              onClick={handleReset}
              startIcon={<Refresh />}
              sx={{ bgcolor: 'secondary.main' }}
            >
              Start New Interview
            </Button>
            <Button
              variant="outlined"
              onClick={() => setShowDAG(!showDAG)}
              startIcon={<AccountTree />}
              sx={{ borderColor: '#334155', color: '#cbd5e1' }}
            >
              {showDAG ? 'Hide' : 'Show'} Question Flow
            </Button>
          </Stack>

          {showDAG && (
            <Paper sx={{ mt: 3, p: 2, bgcolor: 'rgba(15, 23, 42, 0.95)', border: '1px solid #334155' }}>
              <Typography variant="h6" sx={{ color: '#fff', mb: 2 }}>
                Your Question Journey (DAG)
              </Typography>
              <Box sx={{ overflow: 'auto' }}>
                <svg ref={dagRef} />
              </Box>
              <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mt: 2 }}>
                Green path shows your actual journey. Gray nodes show alternative paths not taken.
              </Typography>
            </Paper>
          )}
        </Paper>
      </Box>
    );
  }

  if (!currentQuestion) return null;

  return (
    <Box>
      {/* Progress Bar */}
      <Paper sx={{ p: 2, mb: 3, bgcolor: 'rgba(30, 35, 50, 0.95)' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="body2" sx={{ color: '#cbd5e1' }}>
            Question {answers.length + 1}
          </Typography>
          <Typography variant="body2" sx={{ color: '#cbd5e1' }}>
            {Math.round(getProgress())}% Complete
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={getProgress()}
          sx={{
            height: 8,
            borderRadius: 4,
            bgcolor: 'text.primary',
            '& .MuiLinearProgress-bar': { bgcolor: 'success.main' }
          }}
        />
      </Paper>

      {/* Current Question */}
      <Paper sx={{ p: 4, bgcolor: 'rgba(30, 35, 50, 0.95)', mb: 3 }}>
        <Chip
          label={currentQuestion.category.replace('_', ' ').toUpperCase()}
          size="small"
          sx={{ mb: 2, bgcolor: 'secondary.main', color: '#fff' }}
        />

        <Typography variant="h5" sx={{ color: '#fff', mb: 1 }}>
          {currentQuestion.text}
        </Typography>

        {currentQuestion.context && (
          <Typography variant="body2" sx={{ color: 'text.disabled', mb: 3, fontStyle: 'italic' }}>
            Context: {currentQuestion.context}
          </Typography>
        )}

        <RadioGroup value={selectedAnswer} onChange={(e) => setSelectedAnswer(e.target.value)}>
          <Stack spacing={2}>
            {currentQuestion.options.map((option) => (
              <Paper
                key={option.value}
                sx={{
                  p: 2,
                  bgcolor: selectedAnswer === option.value ? 'rgba(37, 99, 235, 0.2)' : 'rgba(15, 23, 42, 0.6)',
                  border: 1,
                  borderColor: selectedAnswer === option.value ? '#2563eb' : '#334155',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': {
                    borderColor: '#2563eb',
                    bgcolor: 'rgba(37, 99, 235, 0.1)'
                  }
                }}
                onClick={() => setSelectedAnswer(option.value)}
              >
                <FormControlLabel
                  value={option.value}
                  control={<Radio sx={{ color: 'text.disabled' }} />}
                  label={
                    <Typography sx={{ color: '#fff', fontSize: '1rem' }}>
                      {option.label}
                    </Typography>
                  }
                  sx={{ margin: 0, width: '100%' }}
                />
              </Paper>
            ))}
          </Stack>
        </RadioGroup>

        <Stack direction="row" spacing={2} sx={{ mt: 4 }}>
          <Button
            variant="outlined"
            onClick={handleBack}
            disabled={history.length <= 1}
            startIcon={<ArrowBack />}
            sx={{ borderColor: '#334155', color: '#cbd5e1' }}
          >
            Back
          </Button>
          <Button
            variant="contained"
            onClick={handleAnswer}
            disabled={!selectedAnswer}
            endIcon={<ArrowForward />}
            sx={{ bgcolor: 'success.main', flex: 1 }}
          >
            Continue
          </Button>
          <Tooltip title="View question flow">
            <IconButton
              onClick={() => setShowDAG(!showDAG)}
              sx={{ color: '#cbd5e1', border: '1px solid #334155' }}
            >
              <AccountTree />
            </IconButton>
          </Tooltip>
        </Stack>
      </Paper>

      {/* DAG Visualization */}
      {showDAG && (
        <Paper sx={{ p: 3, bgcolor: 'rgba(30, 35, 50, 0.95)', mb: 3 }}>
          <Typography variant="h6" sx={{ color: '#fff', mb: 2 }}>
            Question Flow (DAG)
          </Typography>
          <Box sx={{ overflow: 'auto', bgcolor: 'rgba(15, 23, 42, 0.6)', borderRadius: 2, p: 2 }}>
            <svg ref={dagRef} />
          </Box>
          <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mt: 2 }}>
            Blue = Current Question | Green = Completed | Gray = Potential Next Steps
          </Typography>
        </Paper>
      )}

      {/* Answer History */}
      {answers.length > 0 && (
        <Paper sx={{ p: 3, bgcolor: 'rgba(30, 35, 50, 0.95)' }}>
          <Typography variant="h6" sx={{ color: '#fff', mb: 2 }}>
            Your Answers So Far
          </Typography>
          <Stack spacing={1}>
            {answers.map((answer, idx) => (
              <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Chip
                  label={`Q${idx + 1}`}
                  size="small"
                  sx={{ bgcolor: 'success.main', color: '#fff', minWidth: 45 }}
                />
                <Typography variant="body2" sx={{ color: '#cbd5e1' }}>
                  {answer.answer}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Paper>
      )}
    </Box>
  );
};

export default AdaptiveQuestionnaire;
