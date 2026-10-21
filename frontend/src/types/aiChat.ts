/**
 * AI Chat Types
 * Type definitions for the enhanced AI chat assistant with action capabilities
 */

// Action types the AI can trigger
export type AIActionType =
  | 'navigate'      // Navigate to a page or record
  | 'create'        // Create a new record (deal, account, meeting)
  | 'update'        // Update an existing record
  | 'search'        // Search for records
  | 'open_modal'    // Open a modal/dialog
  | 'trigger';      // Trigger a workflow (analysis, etc.)

// Icon names for actions (MUI icon names)
export type ActionIcon =
  | 'NavigateNext'
  | 'Add'
  | 'Edit'
  | 'Search'
  | 'OpenInNew'
  | 'PlayArrow'
  | 'Analytics'
  | 'Description'
  | 'Event'
  | 'Business'
  | 'TrendingUp';

// Pages available for navigation
export type AppPage =
  | 'calendar'
  | 'deals'
  | 'accounts'
  | 'analysis'
  | 'analysis-postcall'
  | 'metrics'
  | 'rfp-generator'
  | 'ppt-generator'
  | 'proposal-evaluation'
  | 'atlassian-assessment'
  | 'agents'
  | 'settings'
  | 'help';

// Record types for CRUD operations
export type RecordType = 'deal' | 'account' | 'meeting';

// Workflow types
export type WorkflowType =
  | 'pre_call_analysis'
  | 'post_call_analysis'
  | 'company_research'
  | 'proposal_generation'
  | 'rfp_analysis'
  | 'ppt_generation'
  | 'proposal_evaluation'
  | 'bulk_analysis'
  | 'workshop_analysis'
  | 'user_story_generation';

// Modal types
export type ModalType =
  | 'proposal_flow'
  | 'post_call_flow'
  | 'create_deal'
  | 'create_account'
  | 'create_meeting';

// Action payload types
export interface NavigatePayload {
  page: AppPage;
  recordId?: string;
  recordType?: RecordType;
  reason?: string;
}

export interface CreatePayload {
  recordType: RecordType;
  prefillData?: Record<string, any>;
}

export interface UpdatePayload {
  recordType: RecordType;
  recordId: string;
  updates: Record<string, any>;
}

export interface SearchPayload {
  recordType: RecordType | 'all';
  query: string;
  filters?: Record<string, any>;
}

export interface OpenModalPayload {
  modal: ModalType;
  data?: Record<string, any>;
}

export interface TriggerPayload {
  workflow: WorkflowType;
  targetId?: string;
  targetName?: string;
  data?: Record<string, any>;
}

// Union type for all payloads
export type ActionPayload =
  | NavigatePayload
  | CreatePayload
  | UpdatePayload
  | SearchPayload
  | OpenModalPayload
  | TriggerPayload;

// AI Action definition
export interface AIAction {
  id: string;
  type: AIActionType;
  label: string;
  description?: string;
  icon?: ActionIcon;
  payload: ActionPayload;
  confirmRequired?: boolean;
  primary?: boolean; // Highlight as main action
}

// Data preview types for showing inline data
export interface DataPreview {
  type: 'deal' | 'account' | 'meeting' | 'meetings_list' | 'deals_list' | 'metrics';
  title?: string;
  data: Record<string, any> | Array<Record<string, any>>;
}

// Navigation hint for directing users
export interface NavigationHint {
  route: string;
  label: string;
  description?: string;
}

// Source citation
export interface ChatSource {
  title: string;
  type: 'internal' | 'web' | 'internal-kb' | 'crm';
  url?: string;
}

// Chain-of-thought thinking step
export interface ThinkingStep {
  step: number;
  thought: string;
  action?: string;
  observation?: string;
}

// Base message interface
export interface BaseMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// Enhanced message with actions and rich content
export interface EnhancedMessage extends BaseMessage {
  actions?: AIAction[];
  dataPreview?: DataPreview;
  navigationHint?: NavigationHint;
  sources?: ChatSource[];
  thinking?: ThinkingStep[];
  isStreaming?: boolean;
  widgets?: ChatWidget[];
  quickReplies?: string[];
  agentStatus?: AgentStatusWidget;
}

// App context sent to backend
export interface AppContext {
  currentPage: AppPage | string;
  currentRoute: string;
  selectedRecord?: {
    type: RecordType;
    id: string;
    name: string;
    data?: Record<string, any>;
  } | null;
  recentPages?: string[];
}

// Chat request to backend
export interface ChatRequest {
  message: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  context?: AppContext;
}

// Enhanced chat response from backend
export interface EnhancedChatResponse {
  response: string;
  actions?: AIAction[];
  dataPreview?: DataPreview;
  navigationHint?: NavigationHint;
  sources?: ChatSource[];
  thinking?: ThinkingStep[];
  widgets?: ChatWidget[];
  quickReplies?: string[];
  agentStatus?: AgentStatusWidget;
  context?: {
    companiesFound?: string[];
    dealsFound?: number;
    meetingsFound?: number;
    internalKbResults?: number;
  };
}

// Action execution result
export interface ActionResult {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
}

// Chat panel size states
export type ChatPanelSize = 'collapsed' | 'normal' | 'expanded' | 'fullscreen';

// Chat panel preferences (persisted)
export interface ChatPreferences {
  panelSize: ChatPanelSize;
  showCapabilities: boolean;
}

// Capability category for help panel
export interface CapabilityCategory {
  id: string;
  title: string;
  icon: ActionIcon;
  description: string;
  examples: string[];
}

// ---------------------------------------------------------------------------
// Chat Widgets — interactive elements rendered inline in messages
// ---------------------------------------------------------------------------

export type ChatWidgetType =
  | 'data_table'
  | 'inline_form'
  | 'approval'
  | 'agent_card'
  | 'summary_card';

export interface ChatWidget {
  id: string;
  type: ChatWidgetType;
  data: DataTableWidgetData | InlineFormWidgetData | ApprovalWidgetData | AgentCardWidgetData | SummaryCardWidgetData;
}

export interface DataTableWidgetData {
  columns: Array<{ key: string; label: string; type?: 'text' | 'chip' | 'date' | 'currency' }>;
  rows: Array<Record<string, any>>;
  onClickRoute?: string;
  title?: string;
}

export interface InlineFormField {
  name: string;
  label: string;
  type: 'text' | 'select' | 'checkbox' | 'number' | 'textarea';
  options?: Array<{ label: string; value: string }>;
  required?: boolean;
  placeholder?: string;
  defaultValue?: any;
}

export interface InlineFormWidgetData {
  formId: string;
  fields: InlineFormField[];
  submitLabel?: string;
  cancelLabel?: string;
}

export interface ApprovalWidgetData {
  approvalId: string;
  title: string;
  summary: string;
  approveLabel?: string;
  rejectLabel?: string;
}

export interface AgentCardWidgetData {
  agentId: string;
  agentName: string;
  description: string;
  icon: string;
  color: string;
  inputRequired?: InlineFormWidgetData;
}

export interface AgentStatusWidget {
  agentId: string;
  agentName: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  percentage: number;
  currentStep?: string;
  jobId?: string;
}

export interface SummaryCardWidgetData {
  title: string;
  metrics: Array<{ label: string; value: string | number; color?: string }>;
  actions?: AIAction[];
}

// ---------------------------------------------------------------------------
// Agent Hub types
// ---------------------------------------------------------------------------

export type AgentCategory = 'analysis' | 'generation' | 'research' | 'automation';

export interface AgentInfo {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  category: AgentCategory;
  capabilities: string[];
  status: 'available' | 'running' | 'disabled';
  lastRunAt?: string;
  totalRuns?: number;
  avgDurationMs?: number;
}

// All capabilities the AI can perform
export const AI_CAPABILITIES: CapabilityCategory[] = [
  {
    id: 'navigation',
    title: 'Navigate',
    icon: 'NavigateNext',
    description: 'Go to any page or open specific records',
    examples: [
      'Go to the deals page',
      'Show me the Microsoft account',
      'Open my calendar',
      'Take me to post-call analysis',
      'Where can I respond to RFPs?',
    ],
  },
  {
    id: 'research',
    title: 'Research',
    icon: 'Search',
    description: 'Deep company research and meeting preparation',
    examples: [
      'Research Salesforce before my call',
      'What do we know about Microsoft?',
      'Prepare me for my meeting with Acme',
      'Find case studies for cloud migration',
    ],
  },
  {
    id: 'analyze',
    title: 'Analyze',
    icon: 'Analytics',
    description: 'Post-call analysis and transcript processing',
    examples: [
      'Help me analyze a meeting transcript',
      'Run post-call analysis',
      'Extract action items from my last call',
      'Summarize the key discussion points',
    ],
  },
  {
    id: 'generate',
    title: 'Generate',
    icon: 'Description',
    description: 'Create proposals, presentations, and RFP responses',
    examples: [
      'Help me respond to an RFP',
      'Create a presentation deck',
      'Generate a proposal',
      'Start proposal evaluation',
    ],
  },
  {
    id: 'manage',
    title: 'Manage',
    icon: 'Add',
    description: 'Create and manage deals, accounts, and meetings',
    examples: [
      'Create a deal for Acme Corp',
      'Add a new account',
      'Find deals closing this month',
      'Show my pipeline summary',
    ],
  },
  {
    id: 'help',
    title: 'Help',
    icon: 'TrendingUp',
    description: 'Learn how features work and get guidance',
    examples: [
      'How do I use pre-call analysis?',
      'What can the RFP generator do?',
      'Explain proposal evaluation',
      'How does post-call analysis work?',
    ],
  },
];
