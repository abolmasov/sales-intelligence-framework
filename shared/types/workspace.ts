/**
 * Workspace and Workshop Analysis type definitions
 * Shared between frontend and backend
 */

export type WorkspaceType = 'workshop_analysis' | 'user_story_generation' | 'workshop_prep' | 'client_engagement';

// ── Engagement lifecycle ─────────────────────────────────────────────────────
export type EngagementStage = 'pre_workshop' | 'workshop_prep' | 'workshop' | 'post_workshop';
export type EngagementStageStatus = 'idle' | 'running' | 'completed' | 'error';

// ── Stage 1: Client Intelligence ────────────────────────────────────────────
export interface ClientLeader {
  name: string;
  title: string;
  relevance?: string;
}

export interface ClientIntelligenceResult {
  companyOverview: string;
  industry: string;
  size: string;                           // e.g. "5,000–10,000 employees"
  hqLocation?: string;
  businessModel: string;                  // e.g. "B2B SaaS", "Enterprise Services"
  keyLeadership?: ClientLeader[];         // named leaders relevant to the workshop
  recentDevelopments: string[];           // news, M&A, funding, leadership changes
  strategicInitiatives: string[];         // known priorities / transformation programs
  techStack: string[];                    // known platforms (ServiceNow, Salesforce, SAP…)
  servicenowMaturitySignals: string[];    // signals about their SN deployment / maturity
  aiAdoptionSignals?: string[];           // signals about AI readiness / adoption
  painPointHypotheses: string[];          // inferred pain points before the workshop
  operationalFriction?: string[];         // specific operational blockers
  regulatoryContext?: string;             // HIPAA, SOX, GDPR etc if applicable
  competitivePressures?: string[];
  workshopObjectiveHypotheses?: string[]; // hypothesised goals for the workshop
  generatedAt?: string;
}

// ── Stage 1: Pre-Workshop Survey ─────────────────────────────────────────────
export interface SurveyQuestion {
  id: string;
  section: string;
  question: string;
  type: 'text' | 'rating' | 'multiple_choice' | 'checkbox';
  options?: string[];                 // for multiple_choice / checkbox
  placeholder?: string;
  contextHint?: string;              // why this question matters for this client
}

export interface PreWorkshopSurvey {
  generatedAt: string;
  clientName: string;
  sections: Array<{
    title: string;
    description?: string;
    questions: SurveyQuestion[];
  }>;
}

export interface SurveyResponse {
  questionId: string;
  answer: string | string[] | number;
}

export interface SurveyResponses {
  respondentName?: string;
  respondentRole?: string;
  submittedAt?: string;
  responses: SurveyResponse[];
}

// ── Stage 3: OOTB Agent Mapping ──────────────────────────────────────────────
export interface OOTBAgent {
  id: number;
  category: string;
  name: string;
  description: string;
  offeredBy: string;
  type: 'Agents' | 'Agentic Workflows';
}

export interface AgentMapping {
  contextItem: string;               // pain point, use case, or constraint text
  contextSource: 'survey' | 'miro' | 'notes';
  matchedAgents: Array<{
    agent: OOTBAgent;
    relevanceScore: number;          // 0–1
    rationale: string;
    aiMomentType: 'assist' | 'automate' | 'advise' | 'answer';
    prerequisites?: string[];
  }>;
  tisda?: {                          // optional TISDA decomposition
    trigger: string;
    intent: string;
    signals: string[];
    decision: string;
    action: string;
  };
}

export interface MiroContextItem {
  id: string;
  text: string;
  zone: string;                      // which Miro zone it came from
  type: 'pain_point' | 'opportunity' | 'constraint' | 'use_case' | 'note';
  addedAt: string;
}

// ── Northstar Integrators Services Catalog ──────────────────────────────────────────────────
export interface IntegratorService {
  id: string;
  phase: string;
  name: string;
  description: string;
  outcome: string;
  complexity: string;
  problem_statements: string[];
  primary_kpis: string[];
  client_need_signals: string[];
  primary_sku: string;
  also_bundles_with: string[];
  standalone_micro_bundle_potential: string;
}

export interface ServiceMapping {
  contextItem: string;
  contextSource: 'survey' | 'miro' | 'notes' | 'intelligence';
  matchedServices: Array<{
    service: IntegratorService;
    relevanceScore: number;       // 0–1
    rationale: string;
    matchedSignals: string[];     // which client_need_signals triggered this
    recommendedAs: 'primary' | 'bundle' | 'standalone';
  }>;
}

// ── Engagement summary/detail extensions ────────────────────────────────────
export interface EngagementSummary extends WorkspaceSummary {
  engagementStage?: EngagementStage;
  clientIntelligenceStatus?: EngagementStageStatus;
  surveyGenStatus?: EngagementStageStatus;
  workshopPrepMiroStatus?: EngagementStageStatus;
  agentMappingStatus?: EngagementStageStatus;
  serviceMappingStatus?: EngagementStageStatus;
}

export interface EngagementDetail extends WorkspaceDetail {
  engagementStage?: EngagementStage;
  clientIntelligence?: ClientIntelligenceResult | null;
  preworkshopSurvey?: PreWorkshopSurvey | null;
  surveyDocUrl?: string | null;
  surveyResponses?: SurveyResponses | null;
  workshopPrepMiroId?: string | null;
  workshopPrepMiroUrl?: string | null;
  workshopPrepMiroStatus?: string | null;
  workshopNotes?: string | null;
  miroContextItems?: MiroContextItem[] | null;
  agentMappings?: AgentMapping[] | null;
  agentMappingStatus?: string | null;
  serviceMappings?: ServiceMapping[] | null;
  serviceMappingStatus?: string | null;
}

export type WorkspaceStatus =
  | 'draft'
  | 'analyzing'
  | 'miro_generating'
  | 'pptx_generating'
  | 'completed'
  | 'error'
  | 'cancelled';

export type StageStatus = 'pending' | 'running' | 'completed' | 'error' | 'skipped';

export interface WorkspaceSummary {
  workspace_id: string;
  name: string;
  description?: string | null;
  status: WorkspaceStatus;
  client_name?: string | null;
  workshop_date?: string | null;
  analysis_status: StageStatus;
  miro_status: StageStatus;
  pptx_status: StageStatus;
  miro_board_url?: string | null;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
  error_message?: string | null;
  is_saved?: boolean;
  expires_at?: string | null;
  workspace_type?: WorkspaceType;
  source_documents?: WorkspaceSourceDocument[] | null;
}

export interface WorkspaceDetail extends WorkspaceSummary {
  transcript_text?: string | null;
  transcript_excerpt?: string | null;
  workshop_duration?: number | null;
  analysis_result?: WorkshopAnalysisResult | UserStoryMapResult | WorkshopPrepResult | null;
  miro_board_id?: string | null;
  miro_snapshot?: MiroBoardSnapshot | null;
  pptx_job_id?: string | null;
  pptx_download_url?: string | null;
  pipeline_log?: string | null;
  account_id?: string | null;
  deal_id?: string | null;
  requested_by?: string | null;
}

export interface CreateWorkspaceRequest {
  name: string;
  description?: string;
  transcriptText: string;
  clientName?: string;
  workshopDate?: string;
  workshopDuration?: number;
  accountId?: string;
  dealId?: string;
  workspaceType?: WorkspaceType;
}

export interface WorkshopAnalysisResult {
  workshopOverview: {
    title: string;
    date?: string;
    duration?: string;
    participants: WorkshopParticipant[];
    agendaCovered: string[];
  };

  clientNeeds: ClientNeed[];
  solutionsPresented: SolutionPresented[];
  technologyRecommendations: TechRecommendation[];
  actionItems: WorkshopActionItem[];
  keyDecisions: KeyDecision[];

  clientMaturityAssessment: {
    currentState: string;
    targetState: string;
    maturityLevel: 'beginner' | 'developing' | 'intermediate' | 'advanced' | 'expert';
    gaps: (string | MaturityGap)[];
    strengths?: string[];
  };

  workshopFlow: WorkshopFlowSegment[];
  roadmap: RoadmapPhase[];
  strategicInsights?: StrategicInsight[];

  // Standard Readout Playbook fields
  personas?: WorkshopPersona[];
  crossCuttingThemes?: CrossCuttingTheme[];
  strategicPillars?: StrategicPillar[];
  solutionCatalog?: SolutionCatalogItem[];
  readinessAssessment?: ReadinessDimension[];
  kpis?: ReadoutKPI[];
  futureStateVision?: { today: string[]; tomorrow: string[] };

  summary: string;
  keyTakeaways: string[];
}

export interface WorkshopPersona {
  name: string;           // e.g. "IT Service Manager"
  description: string;   // who they are and how they interact with systems
  painPoints: string[];   // top 3 pain points from the workshop
  aiSolutions: string[];  // 3 AI solution recommendations
  quote?: string;         // verbatim or summarised quote from workshop
  implication: string;    // design/adoption implication
}

export interface CrossCuttingTheme {
  theme: string;          // theme title
  evidence: string[];     // 2-4 proof points from the workshop
  quote?: string;         // supporting participant quote
  whyItMatters: string;   // one sentence on why this is important
}

export interface StrategicPillar {
  pillar: string;         // e.g. "Productivity / Smart Automation"
  description: string;   // one-line description
  workshopAlignment: string; // how workshop outputs support this pillar
}

export interface SolutionCatalogItem {
  problem: string;
  aiSolution: string;
  personas: string[];
  priority: 'quick_win' | 'high_value' | 'build_foundation' | 'strategic_bet' | 'evaluate_later';
  valueDriver: 'productivity' | 'personalization' | 'immediacy' | 'trust';
  feasibility: 'high' | 'medium' | 'low';
  isCrossFunctional?: boolean;
}

export interface ReadinessDimension {
  dimension: 'platform' | 'data' | 'integration' | 'governance' | 'organizational';
  currentState: string;
  targetState: string;
  readinessLevel: 'not_ready' | 'partial' | 'ready';
  keyWorkstreams: string[];
}

export interface ReadoutKPI {
  category: 'productivity' | 'personalization' | 'immediacy' | 'trust';
  metric: string;
  whyItMatters: string;
  targetDirection: string; // e.g. "Reduce by 40%", "Increase to 80%"
}

export interface StrategicInsight {
  insight: string;
  evidence: string;
  recommendation: string;
}

export interface WorkshopParticipant {
  name: string;
  role?: string;
  organization: 'client' | 'presenter' | 'other';
  contributions?: string[];
}

export interface ClientNeed {
  need: string;
  priority: 'high' | 'medium' | 'low';
  context: string;
  mappedSolution?: string;
  urgency?: string;
  currentWorkaround?: string;
}

export interface SolutionPresented {
  solution: string;
  description: string;
  clientReaction?: 'positive' | 'neutral' | 'skeptical' | 'negative';
  reactionDetail?: string;
  addressedNeeds: string[];
  openQuestions?: string[];
}

export interface TechRecommendation {
  technology: string;
  purpose: string;
  priority: 'immediate' | 'short_term' | 'long_term';
  complexity: 'low' | 'medium' | 'high';
  prerequisites?: string[];
  estimatedEffort?: string;
  alternativesConsidered?: string[];
}

export interface WorkshopActionItem {
  action: string;
  owner: string;
  dueDate?: string;
  priority: 'high' | 'medium' | 'low';
  status: 'open' | 'in_progress' | 'completed';
  dependsOn?: string;
  context?: string;
}

export interface KeyDecision {
  decision: string;
  madeBy: string;
  rationale?: string;
  impact: string;
  reversibility?: string;
}

export interface MaturityGap {
  gap: string;
  severity: 'critical' | 'significant' | 'minor';
  recommendation: string;
}

export interface WorkshopFlowSegment {
  segment: string;
  topic: string;
  duration?: string;
  keyPoints: string[];
  decisions?: string[];
  tensions?: string[];
}

export interface RoadmapPhase {
  phase: string;
  duration: string;
  goals: string[];
  deliverables: string[];
  dependencies?: string[];
  risks?: string[];
  successCriteria?: string[];
}

export interface MiroBoardSnapshot {
  boardId: string;
  boardUrl: string;
  frames: MiroFrame[];
}

export interface MiroFrame {
  frameId: string;
  title: string;
  items: MiroItem[];
}

export interface MiroItem {
  type: 'sticky_note' | 'shape' | 'text' | 'connector' | 'card';
  content: string;
  color?: string;
  position?: { x: number; y: number };
  metadata?: Record<string, any>;
}

// ---------- User Story Generation types ----------

export interface UserStoryMapResult {
  storyMapOverview: {
    title: string;
    productVision: string;
    targetUsers: StoryMapPersona[];
    scope: string;
    sourceDocumentCount: number;
    confidenceLevel: 'high' | 'medium' | 'low';
    confidenceNotes?: string;
  };
  backbone: StoryMapActivity[];
  releases: StoryMapRelease[];
  dependencies: StoryDependency[];
  assumptions: (string | StoryMapAssumption)[];
  risks: StoryMapRisk[];
  technicalConsiderations?: TechnicalConsideration[];
  summary: string;
}

export interface StoryMapPersona {
  persona: string;
  description: string;
  goals: string[];
  frustrations?: string[];
}

export interface StoryMapActivity {
  activityId: string;
  activity: string;
  description: string;
  persona: string;
  businessValue?: string;
  sortOrder: number;
  steps: StoryMapStep[];
}

export interface StoryMapStep {
  stepId: string;
  step: string;
  description: string;
  sortOrder: number;
  stories: UserStory[];
}

export interface UserStory {
  storyId: string;
  title: string;
  userStory: string;
  acceptanceCriteria: string[];
  priority: 'must_have' | 'should_have' | 'could_have' | 'wont_have';
  estimatedEffort: 'XS' | 'S' | 'M' | 'L' | 'XL';
  release: 'MVP' | 'R1' | 'R2' | 'future';
  notes?: string | null;
  sourceReference?: string | null;
  dependencies?: string[];
  outOfScope?: string[];
}

export interface StoryMapRelease {
  releaseId: string;
  name: string;
  goal: string;
  storyCount: number;
  estimatedDuration: string;
  keyCapabilities?: string[];
}

export interface StoryDependency {
  fromStoryId: string;
  toStoryId: string;
  type: 'blocks' | 'requires' | 'enhances';
  description: string;
}

export interface StoryMapRisk {
  risk: string;
  impact: 'high' | 'medium' | 'low';
  likelihood?: 'high' | 'medium' | 'low';
  mitigation: string;
  affectedStories?: string[];
}

export interface StoryMapAssumption {
  assumption: string;
  impact: string;
  validation: string;
}

export interface TechnicalConsideration {
  area: string;
  consideration: string;
  recommendation: string;
  affectedActivities?: string[];
}

// ---------- Workshop Preparation types ----------

export interface WorkshopPrepResult {
  workshopPlan: {
    title: string;
    objective: string;
    duration: string;
    targetAudience: string;
    expectedOutcomes: string[];
  };
  companyContext: {
    companyOverview: string;
    industry: string;
    challenges: string[];
    currentState: string;
    recentDevelopments?: string[];
  };
  agenda: WorkshopPrepAgendaSession[];
  surveyInsights: WorkshopPrepSurveyInsight[];
  talkingPoints: WorkshopPrepTalkingPoint[];
  preparationChecklist: string[];
  risksMitigations: WorkshopPrepRisk[];
  summary: string;
}

export interface WorkshopPrepAgendaSession {
  sessionTitle: string;
  duration: string;
  objective: string;
  facilitatorNotes: string;
  exercises: string[];
  discussionQuestions: string[];
  requiredMaterials?: string[];
}

export interface WorkshopPrepSurveyInsight {
  theme: string;
  findings: string;
  implications: string;
  suggestedFocus: string;
}

export interface WorkshopPrepTalkingPoint {
  topic: string;
  points: string[];
  contextFromResearch: string;
}

export interface WorkshopPrepRisk {
  risk: string;
  mitigation: string;
  likelihood?: 'high' | 'medium' | 'low';
}

export interface WorkspaceSourceDocument {
  documentId: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  sourceType: 'transcript' | 'requirements' | 'prd' | 'notes' | 'other';
  extractedWordCount: number;
  uploadedAt: string;
}
