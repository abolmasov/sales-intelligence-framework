/**
 * Agent Metadata — hardcoded definitions for all available agents.
 * Used by the Agent Hub UI and the AI chat assistant to present agent capabilities.
 */

export type AgentCategory = 'analysis' | 'generation' | 'research' | 'automation';

export interface AgentMetadata {
  id: string;
  name: string;
  description: string;
  icon: string;          // MUI icon name
  color: string;         // hex color for the icon circle
  category: AgentCategory;
  capabilities: string[];
  inputFields?: AgentInputField[];
  prerequisite?: string; // human-readable prerequisite description
}

export interface AgentInputField {
  name: string;
  label: string;
  type: 'text' | 'select' | 'textarea' | 'deal_select' | 'account_select' | 'meeting_select' | 'workspace_select';
  required?: boolean;
  placeholder?: string;
  helpText?: string;     // shown below the field
  requiresTranscript?: boolean; // filter meeting selector to meetings with transcripts
}

export const AGENT_METADATA: AgentMetadata[] = [
  {
    id: 'transcript-analysis',
    name: 'Transcript Analyzer',
    description: 'Analyzes meeting transcripts to extract key discussion points, action items, sentiment, and competitive intelligence.',
    icon: 'RecordVoiceOver',
    color: '#1976d2',
    category: 'analysis',
    capabilities: [
      'Extract action items & next steps',
      'Identify key discussion topics',
      'Sentiment & engagement analysis',
      'Competitive intelligence extraction',
      'Stakeholder mapping',
    ],
    prerequisite: 'Requires a meeting with a synced transcript',
    inputFields: [
      { name: 'meetingId', label: 'Meeting', type: 'meeting_select', required: true, helpText: 'Select a meeting that has a transcript available', requiresTranscript: true },
    ],
  },
  {
    id: 'pre-call-research',
    name: 'Pre-Call Researcher',
    description: 'Performs deep company research to prepare you for upcoming meetings with comprehensive briefings.',
    icon: 'TravelExplore',
    color: '#0288d1',
    category: 'research',
    capabilities: [
      'Company overview & financials',
      'Recent news & press releases',
      'Key stakeholder profiles',
      'Industry trends & competitive landscape',
      'Talking points & conversation starters',
    ],
    inputFields: [
      { name: 'meetingId', label: 'Meeting', type: 'meeting_select', required: true, helpText: 'Select an upcoming meeting to research the company' },
    ],
  },
  {
    id: 'proposal-generation',
    name: 'Proposal Generator',
    description: 'Analyzes the meeting transcript and generates a tailored solution proposal with executive summary, architecture, and pricing.',
    icon: 'Description',
    color: '#7b1fa2',
    category: 'generation',
    capabilities: [
      'Executive summary generation',
      'Solution architecture proposals',
      'Pricing & timeline recommendations',
      'Case study integration',
      'Risk mitigation strategies',
    ],
    prerequisite: 'Requires a meeting with a synced transcript. Runs transcript analysis automatically before generating the proposal.',
    inputFields: [
      { name: 'meetingId', label: 'Meeting', type: 'meeting_select', required: true, helpText: 'Select a meeting with a transcript. The agent will analyze the transcript and generate a proposal.', requiresTranscript: true },
      { name: 'dealId', label: 'Deal (optional)', type: 'deal_select', helpText: 'Link to a deal for additional context' },
    ],
  },
  {
    id: 'pptx-generation',
    name: 'Deck Builder',
    description: 'Runs the full pipeline: analyzes transcript, generates a proposal, and builds a PowerPoint deck — all in one step.',
    icon: 'Slideshow',
    color: '#e65100',
    category: 'generation',
    capabilities: [
      'End-to-end: transcript → proposal → PPTX',
      'Template-based formatting',
      'Chart & diagram creation',
      'Brand-consistent styling',
      'Export to PPTX format',
    ],
    prerequisite: 'Requires a meeting with a synced transcript. Runs transcript analysis and proposal generation automatically.',
    inputFields: [
      { name: 'meetingId', label: 'Meeting', type: 'meeting_select', required: true, helpText: 'Select a meeting with a transcript. The agent will analyze, create a proposal, and build a deck.', requiresTranscript: true },
      { name: 'dealId', label: 'Deal (optional)', type: 'deal_select', helpText: 'Link to a deal for additional context' },
    ],
  },
  {
    id: 'discovery',
    name: 'Lead Discovery',
    description: 'Finds and qualifies potential leads through intelligent web research and data analysis.',
    icon: 'PersonSearch',
    color: '#2e7d32',
    category: 'research',
    capabilities: [
      'Lead identification & qualification',
      'Company fit scoring',
      'Contact information gathering',
      'Market segment analysis',
      'Competitive positioning insights',
    ],
    inputFields: [
      { name: 'query', label: 'Search criteria', type: 'textarea', required: true, placeholder: 'Describe your ideal customer profile...' },
    ],
  },
  {
    id: 'workshop-analysis',
    name: 'Workshop Analyzer',
    description: 'Analyzes workshop transcripts and notes to extract insights, decisions, and structured outputs.',
    icon: 'Groups',
    color: '#00838f',
    category: 'analysis',
    capabilities: [
      'Workshop summary generation',
      'Decision & action item extraction',
      'Participant contribution analysis',
      'Theme & pattern identification',
      'Follow-up recommendation generation',
    ],
    prerequisite: 'Requires a workspace with uploaded transcript or documents.',
    inputFields: [
      { name: 'workspaceId', label: 'Workspace', type: 'workspace_select', required: true, helpText: 'Select a workspace with uploaded documents to analyze' },
    ],
  },
  {
    id: 'user-story-generation',
    name: 'User Story Generator',
    description: 'Generates structured user stories and requirements from workshop outputs and meeting notes.',
    icon: 'ListAlt',
    color: '#4527a0',
    category: 'generation',
    capabilities: [
      'User story creation (As a... I want... So that...)',
      'Acceptance criteria generation',
      'Story point estimation',
      'Epic & theme grouping',
      'Priority recommendation',
    ],
    prerequisite: 'Requires a workspace with uploaded documents (transcripts, PRDs, requirements).',
    inputFields: [
      { name: 'workspaceId', label: 'Workspace', type: 'workspace_select', required: true, helpText: 'Select a workspace with uploaded documents for story generation' },
    ],
  },
  {
    id: 'workshop-prep',
    name: 'Workshop Prep',
    description: 'Ingests pre-workshop surveys, runs company research, and generates a contextualized workshop slide deck with agenda, talking points, and exercises.',
    icon: 'EventNote',
    color: '#059669',
    category: 'generation',
    capabilities: [
      'Survey theme synthesis',
      'Automated company research',
      'Contextualized agenda generation',
      'Talking points with research context',
      'Exercise & discussion question design',
      'PowerPoint deck generation',
    ],
    prerequisite: 'Requires a workspace with uploaded survey documents and a company name set for research.',
    inputFields: [
      { name: 'workspaceId', label: 'Workspace', type: 'workspace_select', required: true, helpText: 'Select a workspace with survey documents and a company name' },
    ],
  },
  {
    id: 'bulk-analysis',
    name: 'Bulk Analyzer',
    description: 'Runs transcript analysis across multiple meetings in a deal or account simultaneously.',
    icon: 'BatchPrediction',
    color: '#c62828',
    category: 'automation',
    capabilities: [
      'Multi-meeting batch processing',
      'Deal-level analysis rollup',
      'Account-level analysis rollup',
      'Progress tracking & notifications',
    ],
    prerequisite: 'Analyzes all meetings with transcripts in the selected deal or account.',
    inputFields: [
      { name: 'dealId', label: 'Deal', type: 'deal_select', helpText: 'Analyze all meetings in this deal' },
      { name: 'accountId', label: 'Account', type: 'account_select', helpText: 'Or analyze all meetings in this account' },
    ],
  },
];

/** Look up agent metadata by ID */
export function getAgentMetadata(agentId: string): AgentMetadata | undefined {
  return AGENT_METADATA.find((a) => a.id === agentId);
}
