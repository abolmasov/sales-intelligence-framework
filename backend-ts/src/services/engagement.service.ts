/**
 * Engagement Service — 4-stage client workshop lifecycle
 *
 * Stage 1: Client Intelligence + Pre-Workshop Survey generation + DOCX export
 * Stage 2: Workshop Prep (Miro board via workshop-prep-miro.service, prep deck)  ← delegated
 * Stage 3: Live Agent Mapping (survey responses, Miro context, meeting notes → OOTB agents)
 *
 * Stage 4 (post-workshop readout) reuses the existing workspace.service pipeline.
 */

import path from 'path';
import { readFileSync } from 'fs';
import { getPrismaClient } from '../config/database';
import { getLoggerService } from './logger.service';
import { getOpenAIService } from './openai.service';
import { sendNotification } from './notification.service';
import type {
  ClientIntelligenceResult,
  PreWorkshopSurvey,
  OOTBAgent,
  AgentMapping,
  MiroContextItem,
  SurveyResponses,
  IntegratorService,
  ServiceMapping,
} from '../../../shared/types/workspace';

const prisma = getPrismaClient();
const logger = getLoggerService();

// ── OOTB Agent catalog (loaded once at module init) ──────────────────────────
let _agentCatalog: OOTBAgent[] | null = null;
function getAgentCatalog(): OOTBAgent[] {
  if (!_agentCatalog) {
    const p = path.join(__dirname, '../data/servicenow-agents.json');
    _agentCatalog = JSON.parse(readFileSync(p, 'utf-8')) as OOTBAgent[];
  }
  return _agentCatalog;
}

// ── Northstar Integrators Services catalog (loaded once at module init) ─────────────────────
let _serviceCatalog: IntegratorService[] | null = null;
function getServiceCatalog(): IntegratorService[] {
  if (!_serviceCatalog) {
    const p = path.join(__dirname, '../data/enterprise-services.json');
    _serviceCatalog = JSON.parse(readFileSync(p, 'utf-8')) as IntegratorService[];
  }
  return _serviceCatalog;
}

// ── Append to workspace pipeline log ────────────────────────────────────────
async function appendLog(workspaceId: string, msg: string): Promise<void> {
  try {
    const ws = await prisma.workspace.findUnique({
      where: { workspaceId },
      select: { pipelineLog: true },
    });
    const existing = ws?.pipelineLog || '';
    const ts = new Date().toISOString().substring(11, 19);
    await prisma.workspace.update({
      where: { workspaceId },
      data: { pipelineLog: `${existing}\n[${ts}] ${msg}`.trim() },
    });
  } catch { /* non-fatal */ }
}

// ============================================================================
// STAGE 1-A: Client Intelligence
// ============================================================================

export async function runClientIntelligence(workspaceId: string): Promise<ClientIntelligenceResult> {
  const ws = await prisma.workspace.findUniqueOrThrow({
    where: { workspaceId },
    select: { clientName: true, description: true, requestedBy: true },
  });

  const clientName = ws.clientName || 'the client';
  const dealContext = ws.description || '';
  await appendLog(workspaceId, `[Stage 1] Building deep client intelligence for: ${clientName}`);

  const openai = getOpenAIService();
  const getText = (r: PromiseSettledResult<any>, maxLen = 3000): string => {
    if (r.status !== 'fulfilled') return '';
    const val = r.value;
    // webSearch may return { output_text } or an array — normalise both
    if (typeof val === 'string') return val.substring(0, maxLen);
    if (val?.output_text) return String(val.output_text).substring(0, maxLen);
    return JSON.stringify(val).substring(0, maxLen);
  };

  // Build a focused ServiceNow scope string from deal context (e.g. "HRSM, HRSD, CSM")
  const snScopeTerms = dealContext
    ? dealContext.replace(/[^a-zA-Z0-9\s,]/g, ' ').trim()
    : 'ITSM ITOM HRSD';

  // ── PHASE 1: 8 parallel deep searches (mirrors pre-call research depth) ───
  await appendLog(workspaceId, '[Stage 1] Phase 1: Running 8 parallel web searches…');
  const [
    overviewRaw,        // Company basics, leadership, financials
    newsRaw,            // Latest news, press releases, announcements
    strategyRaw,        // Strategic initiatives, transformation programmes
    servicenowRaw,      // ServiceNow deployment, ITSM maturity, AI adoption
    aiAdoptionRaw,      // AI/automation tools, AI-first signals, Copilot/GenAI usage
    painPointsRaw,      // Business challenges, operational friction, complaints
    regulatoryRaw,      // Compliance, regulatory environment, audit requirements
    competitorRaw,      // Competitive pressures, market position
  ] = await Promise.allSettled([
    openai.webSearch({ query: `${clientName} company overview leadership CEO CTO CIO employees revenue headquarters 2024 2025`, maxResults: 8 }),
    openai.webSearch({ query: `${clientName} latest news press releases announcements strategic decisions 2024 2025`, maxResults: 8 }),
    openai.webSearch({ query: `${clientName} digital transformation strategic initiatives cloud modernization programme goals`, maxResults: 8 }),
    openai.webSearch({ query: `${clientName} ServiceNow ${snScopeTerms} IT service management deployment maturity challenges 2024 2025`, maxResults: 8 }),
    openai.webSearch({ query: `${clientName} AI artificial intelligence automation generative AI Copilot adoption strategy operating model`, maxResults: 8 }),
    openai.webSearch({ query: `${clientName} operational challenges pain points bottlenecks IT friction workforce productivity problems`, maxResults: 6 }),
    openai.webSearch({ query: `${clientName} compliance regulatory requirements data governance risk audit industry standards`, maxResults: 6 }),
    openai.webSearch({ query: `${clientName} competitors market position competitive landscape industry ranking`, maxResults: 6 }),
  ]);

  await appendLog(workspaceId, '[Stage 1] Phase 1 complete. Phase 2: Synthesizing intelligence…');

  const overviewText   = getText(overviewRaw, 3000);
  const newsText       = getText(newsRaw, 2500);
  const strategyText   = getText(strategyRaw, 2500);
  const servicenowText = getText(servicenowRaw, 2500);
  const aiText         = getText(aiAdoptionRaw, 2000);
  const painText       = getText(painPointsRaw, 2000);
  const regulatoryText = getText(regulatoryRaw, 1500);
  const competitorText = getText(competitorRaw, 1500);

  const synthesisPrompt = `You are a senior Northstar Integrators consultant preparing a deep intelligence brief for an AI-First Operating Model workshop with ${clientName}.

You have the following multi-source research. Synthesise it into a highly specific, evidence-grounded JSON brief. Every claim must be traceable to the research — do not hallucinate facts. Where data is absent, make clearly-labelled inferences based on industry norms.

${dealContext ? `DEAL TEAM CONTEXT: ${dealContext}\n\n` : ''}
--- COMPANY OVERVIEW / LEADERSHIP ---
${overviewText}

--- LATEST NEWS & ANNOUNCEMENTS ---
${newsText}

--- STRATEGIC INITIATIVES & TRANSFORMATION ---
${strategyText}

--- SERVICENOW DEPLOYMENT & ITSM MATURITY ---
${servicenowText}

--- AI / AUTOMATION ADOPTION ---
${aiText}

--- OPERATIONAL PAIN POINTS ---
${painText}

--- REGULATORY & COMPLIANCE CONTEXT ---
${regulatoryText}

--- COMPETITIVE LANDSCAPE ---
${competitorText}

Return ONLY valid JSON (no markdown, no commentary) matching this exact structure:
{
  "companyOverview": "3-4 sentence specific overview — what they do, who they serve, scale, and current strategic focus",
  "industry": "specific industry vertical (e.g. 'Global Financial Services', 'Healthcare IT', 'Public Sector – Federal')",
  "size": "employee count range and/or annual revenue if known (e.g. '~12,000 employees, $2.4B revenue')",
  "hqLocation": "city, country",
  "businessModel": "B2B / B2C / B2G / mixed, and service/product type",
  "keyLeadership": [
    { "name": "Name", "title": "CTO / CIO / CHRO etc.", "relevance": "why relevant to this workshop" }
  ],
  "recentDevelopments": [
    "Specific dated development with impact — e.g. 'Q1 2025: Announced $450M cloud modernisation programme targeting 40% reduction in legacy infrastructure by 2027'"
  ],
  "strategicInitiatives": [
    "Specific initiative with scope — e.g. 'AI-First Operations: deploying Copilot across 8,000 knowledge workers by end of 2025'"
  ],
  "techStack": ["ServiceNow (ITSM/HRSD)", "Microsoft Azure", "Jira", "Salesforce", "..."],
  "servicenowMaturitySignals": [
    "Evidence-based signal — e.g. 'ITSM deployed but Virtual Agent at <20% containment rate, significant manual triage remaining'"
  ],
  "aiAdoptionSignals": [
    "Specific AI/automation signal — e.g. 'Microsoft Copilot pilot underway for 2,000 users but no formal AI operating model or governance in place'"
  ],
  "painPointHypotheses": [
    "Specific hypothesis grounded in evidence — e.g. 'High L1 triage cost: manual routing consuming estimated 35-40% of service desk capacity based on ITSM deployment signals'"
  ],
  "operationalFriction": [
    "Concrete friction point — e.g. 'Knowledge fragmentation: 3 separate knowledge bases with no unified search, leading to duplicate ticket creation'"
  ],
  "regulatoryContext": "Specific compliance obligations relevant to AI/data (e.g. 'Subject to FCA AI governance requirements and GDPR — any AI agent deployment requires explainability and audit trail') or null",
  "competitivePressures": [
    "Specific competitive pressure — e.g. 'Competitor X launched AI-powered self-service in 2024, creating CX gap that is driving executive urgency around Now Assist'"
  ],
  "workshopObjectiveHypotheses": [
    "Hypothesis about what they want from a Northstar Integrators AI workshop — e.g. 'Prioritise OOTB Now Assist use cases to avoid bespoke AI build risk'"
  ],
  "dealTeamNotes": "${dealContext ? 'See deal team context above' : 'none provided'}"
}`;

  const raw = await openai.generateChatCompletion({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: synthesisPrompt }],
    temperature: 0.2,
    maxTokens: 3000,
  });

  let intelligence: ClientIntelligenceResult;
  try {
    const cleaned = (raw || '').replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    intelligence = JSON.parse(cleaned);
  } catch {
    intelligence = {
      companyOverview: `${clientName} — research synthesis unavailable.`,
      industry: 'Unknown',
      size: 'Unknown',
      businessModel: 'Unknown',
      recentDevelopments: [],
      strategicInitiatives: [],
      techStack: [],
      servicenowMaturitySignals: [],
      painPointHypotheses: [],
    };
  }

  // Stamp generatedAt so the frontend can detect re-runs via version comparison
  intelligence = { ...intelligence, generatedAt: new Date().toISOString() } as any;

  await prisma.workspace.update({
    where: { workspaceId },
    data: {
      clientIntelligence: JSON.stringify(intelligence),
      engagementStage: 'pre_workshop',
    },
  });

  const painCount = (intelligence.painPointHypotheses || []).length;
  const initCount = (intelligence.strategicInitiatives || []).length;
  const snCount   = (intelligence.servicenowMaturitySignals || []).length;
  await appendLog(workspaceId, `[Stage 1] Intelligence complete — ${painCount} pain hypotheses, ${initCount} initiatives, ${snCount} ServiceNow signals`);
  logger.info('[Engagement] Deep client intelligence built', { workspaceId, clientName });

  if (ws.requestedBy) {
    sendNotification({
      type: 'intelligence_complete',
      userId: ws.requestedBy,
      title: 'Client Intelligence Ready',
      message: `Intelligence brief for ${clientName} is complete — ${painCount} pain hypotheses and ${initCount} strategic initiatives identified.`,
      companyName: clientName,
    }).catch(() => {});
  }

  return intelligence;
}

// ============================================================================
// STAGE 1-B: Pre-Workshop Survey Generation
// ============================================================================

export async function runSurveyGeneration(workspaceId: string, focusArea?: string): Promise<PreWorkshopSurvey> {
  const ws = await prisma.workspace.findUniqueOrThrow({
    where: { workspaceId },
    select: { clientName: true, clientIntelligence: true, description: true, workshopFocus: true, requestedBy: true },
  });

  // Persist focusArea if provided, otherwise use what's stored
  const focus = (focusArea || ws.workshopFocus || 'ITSM').toUpperCase() as 'ITSM' | 'HRSD' | 'HRSD_ITSM';
  if (focusArea) {
    await prisma.workspace.update({ where: { workspaceId }, data: { workshopFocus: focus } });
  }

  const clientName = ws.clientName || 'the client';
  const dealContext = ws.description || '';
  const intelligence: ClientIntelligenceResult | null = ws.clientIntelligence
    ? JSON.parse(ws.clientIntelligence)
    : null;

  await appendLog(workspaceId, '[Stage 1] Generating contextual pre-workshop survey...');

  const openai = getOpenAIService();

  const fmt = (arr: unknown[] | undefined | null, max?: number) => {
    const items = (arr || []).slice(0, max ?? arr?.length ?? 0);
    return items.length ? items.map((x, i) => `  ${i + 1}. ${x}`).join('\n') : '  none identified';
  };

  const contextBlock = intelligence
    ? `CLIENT: ${clientName}
${dealContext ? `DEAL TEAM CONTEXT (treat this as the highest-priority input — questions and contextHints must directly address this scope):\n${dealContext}\n` : ''}INDUSTRY: ${intelligence.industry}
SIZE: ${intelligence.size}
BUSINESS MODEL: ${intelligence.businessModel}

COMPANY OVERVIEW:
${intelligence.companyOverview || 'not available'}

KEY LEADERSHIP (reference these people by name in contextHints):
${(intelligence.keyLeadership || []).map(l => `  - ${l.name}, ${l.title}${l.relevance ? ': ' + l.relevance : ''}`).join('\n') || '  none identified'}

RECENT DEVELOPMENTS (use specific dates and facts in contextHints):
${fmt(intelligence.recentDevelopments)}

STRATEGIC INITIATIVES:
${fmt(intelligence.strategicInitiatives)}

KNOWN TECH STACK:
${(intelligence.techStack || []).join(', ') || 'unknown'}

SERVICENOW MATURITY SIGNALS (critical for tailoring SN questions):
${fmt(intelligence.servicenowMaturitySignals)}

AI ADOPTION SIGNALS:
${fmt(intelligence.aiAdoptionSignals)}

PAIN POINT HYPOTHESES:
${fmt(intelligence.painPointHypotheses)}

OPERATIONAL FRICTION:
${fmt(intelligence.operationalFriction)}

REGULATORY / COMPLIANCE CONTEXT:
${intelligence.regulatoryContext || 'none identified'}

COMPETITIVE PRESSURES:
${fmt(intelligence.competitivePressures)}

WORKSHOP OBJECTIVE HYPOTHESES (use these to frame questions and contextHints):
${fmt(intelligence.workshopObjectiveHypotheses)}`
    : `Client: ${clientName}`;

  // Synthesise the top most-specific findings to force GPT to use them
  const topFindings = intelligence ? [
    ...(intelligence.servicenowMaturitySignals || []).slice(0, 3),
    ...(intelligence.painPointHypotheses || []).slice(0, 3),
    ...(intelligence.workshopObjectiveHypotheses || []).slice(0, 2),
    ...(intelligence.recentDevelopments || []).slice(0, 2),
    ...(intelligence.operationalFriction || []).slice(0, 2),
    ...(intelligence.aiAdoptionSignals || []).slice(0, 2),
    ...(intelligence.competitivePressures || []).slice(0, 1),
  ].filter(Boolean) : [];

  const finalSectionPrefix = focus === 'HRSD_ITSM' ? 's8' : 's7';
  const finalSectionNum   = focus === 'HRSD_ITSM' ? '8' : '7';
  const totalSections     = focus === 'HRSD_ITSM' ? '8' : '7';

  const sectionStructure = focus === 'ITSM'
    ? [
        'SECTION REFERENCE STRUCTURE — ITSM FOCUS (6 tailored + 1 verbatim = 7 sections total):',
        'Section 1 (s1): Workshop Outcomes, Priorities and KPIs — 4 questions: top workshop outcomes (text), leadership KPIs (checkbox ~9 options), how AI transformation is measured (multiple_choice ~5 options), time horizon for AI investment (multiple_choice ~4 options)',
        'Section 2 (s2): ServiceNow Current State — 4 questions: current SN version/upgrade timeline (text), modules live (checkbox ~12 options incl. ITSM/ITOM/CSM/GRC), platform ownership (checkbox ~5 options), top SN limitations/frustrations (text)',
        'Section 3 (s3): ITSM Process Maturity and Operations — 4 questions: monthly incident/request volumes (multiple_choice ~6 options), service catalogue maturity (multiple_choice ~5 options), CMDB accuracy rating (rating 1-5), top ITSM pain points (checkbox ~8 options)',
        'Section 4 (s4): AI Strategy, Governance and Readiness — 4 questions: Now Assist/SN AI capabilities in use (checkbox ~8 options), AI governance maturity (multiple_choice ~5 options), AI readiness rating (rating 1-5), AI adoption blockers (checkbox ~8 options)',
        'Section 5 (s5): Use Case Exploration — 3 questions: ITSM workflows ready for AI now (text), AI capability priority ranking (checkbox ~8 options), prior AI pilots and outcomes (text)',
        'Section 6 (s6): Constraints, Risks and Key Decisions — 3 questions: regulatory/compliance constraints (text), primary investment decision constraint (multiple_choice ~7 options), open comments for Northstar Integrators (text)',
        'ID pattern: s1q1-s1q4, s2q1-s2q4, s3q1-s3q4, s4q1-s4q4, s5q1-s5q3, s6q1-s6q3, s7q1-s7q6',
      ].join('\n')
    : focus === 'HRSD'
    ? [
        'SECTION REFERENCE STRUCTURE — HRSD FOCUS (6 tailored + 1 verbatim = 7 sections total):',
        'Section 1 (s1): Outcomes, Priorities, and Success Measures — 4 questions: top 3 HRSD outcomes over 6-18 months (text), what would make this workshop a success (text), KPIs that matter most (checkbox ~10 options incl. case deflection/eNPS/cost per case/backlog), whether baseline metrics exist and where reported (multiple_choice ~3 options)',
        'Section 2 (s2): ServiceNow HRSD Current State — 4 questions: HRSD modules in scope (checkbox: Employee Relations/Benefits/Payroll/Leave/Recruiting/Onboarding/Offboarding/Policy/Workplace), top 5 HR case types by volume (text), primary employee channels (checkbox: Employee Center/Virtual Agent/Email/Phone), HRSD self-service adoption level (multiple_choice ~4 options)',
        'Section 3 (s3): HR Process and Platform Health — maturity ratings (rating 1-4 Ad hoc/Defined/Managed/Optimized) for: HR case management taxonomy and SLAs, HR service catalog and lifecycle events, knowledge management, reporting and performance analytics — plus top 3 HR operational friction points (text)',
        'Section 4 (s4): Enterprise AI Posture — 4 questions: overall AI adoption level (multiple_choice ~4 options), AI patterns in use (checkbox: Predictive/ML/NLP/GenAI content/GenAI chatbots/Agentic automation), AI governance status (multiple_choice ~4 options), data/security constraints for AI in HR (checkbox: HIPAA/PHI/Employee privacy/Data residency/Audit/Union-HR policy)',
        'Section 5 (s5): AI in ServiceNow HRSD — 4 questions: current SN AI licensing (checkbox: Now Assist platform/Now Assist for HRSD/Virtual Agent/AI Agents), AI capabilities live in HRSD today (checkbox: Case summarization/Draft responses/Knowledge article assistance/AI search deflection/Virtual Agent with GenAI/None), AI opportunity priorities for HRSD (checkbox: Smarter self-service/Case summarization and drafting/Knowledge creation/Multi-language/Intake automation/Predictive routing/Proactive notifications), constraints unique to HR AI (text)',
        'Section 6 (s6): Constraints, Risks and Key Decisions — 3 questions: who must approve AI capabilities for HRSD (checkbox: HR leadership/IT/Security/Privacy/Compliance/Legal), top 3 blockers to scaling AI in the next 12 months (text), open comments for Northstar Integrators (text)',
        'ID pattern: s1q1-s1q4, s2q1-s2q4, s3q1-s3q4, s4q1-s4q4, s5q1-s5q4, s6q1-s6q3, s7q1-s7q6',
      ].join('\n')
    : [
        'SECTION REFERENCE STRUCTURE — HRSD + ITSM COMBINED FOCUS (7 tailored + 1 verbatim = 8 sections total):',
        'Section 1 (s1): Outcomes, Priorities, and Success Measures — 4 questions: top 3 outcomes for HRSD/ITSM over 6-18 months (text), what would make this workshop a success (text), KPIs that matter most (checkbox ~10 options covering both HRSD and ITSM), whether baseline metrics exist (multiple_choice ~3 options)',
        'Section 2 (s2): ServiceNow Current State — 4 questions: platform instance/hosting/version (text), modules in scope (checkbox: HRSD/ITSM/ITOM/SecOps/GRC/CSM/Other), primary employee channels (checkbox: Employee Center/Virtual Agent/Email/Phone/Walk-up), major integrations relevant to HRSD/ITSM (text: HRIS, IAM, monitoring/AIOps, collaboration)',
        'Section 3 (s3): Process, Data, and Platform Health — maturity ratings (rating 1-4) for: HR case management, HR service catalog and lifecycle, ITSM incident/problem/change/request, CMDB/CSDM adoption and data quality, knowledge management, reporting and performance analytics, integration and automation, security/compliance controls — plus top 3 friction points across HRSD/ITSM (text)',
        'Section 4 (s4): Enterprise AI Posture — 4 questions: overall AI adoption level (multiple_choice ~4 options), AI patterns in use (checkbox: Predictive/ML/NLP/GenAI content/GenAI chatbots/Agentic automation), AI governance status (multiple_choice ~4 options), data/security constraints for AI in HR and IT (checkbox: HIPAA/PHI/Employee privacy/Data residency/Audit requirements/Vendor risk/Union-HR policy)',
        'Section 5 (s5): AI in ServiceNow — 4 questions: SN AI licensing/enablement (checkbox: Now Assist platform/Now Assist for ITSM/Now Assist for HRSD/Virtual Agent/AI Agents), AI capabilities live today (checkbox: Incident summarization/Case summarization/Draft responses/Knowledge article assistance/AI search deflection/Virtual Agent with GenAI/Predictive Intelligence/None), measured impact if anything is live (text), AI opportunity priorities (checkbox spanning HRSD and ITSM)',
        'Section 6 (s6): HRSD Deep Dive — 4 questions: HRSD scope in use (checkbox: Employee relations/Benefits/Payroll/Leave/Recruiting/Onboarding/Offboarding/Policy/Workplace), top 5 HR case types by volume (text), where HR spends most time (checkbox: Triage/Repetitive questions/Document collection/Policy interpretation/Escalations/Handoffs/Reporting), AI opportunity priorities for HRSD (checkbox: Smarter self-service/Case summarization/Knowledge creation/Multi-language/Intake automation/Predictive routing/Proactive notifications)',
        'Section 7 (s7): ITSM Deep Dive — 4 questions: ITSM scope in use (checkbox: Incident/Request/Problem/Change/Major Incident/Asset/CMDB), top 5 IT incident categories by volume (text), most painful parts of IT operations (checkbox: Ticket triage/Duplicates/Knowledge gaps/Major incident comms/Change risk/Cross-team handoffs/On-call load), AI opportunity priorities for ITSM (checkbox: Incident summarization and response drafting/Similar incident detection/Knowledge suggestion/Self-service deflection/Change risk insights/Predictive routing/AIOps event-to-incident)',
        'ID pattern: s1q1-s1q4, s2q1-s2q4, s3q1-s3q4, s4q1-s4q4, s5q1-s5q4, s6q1-s6q4, s7q1-s7q4, s8q1-s8q6',
      ].join('\n');

  const verbatimSection = [
    'FINAL SECTION — REPRODUCE VERBATIM (do not change a single word, option, or contextHint):',
    'The final section uses ID prefix "' + finalSectionPrefix + '":',
    '{',
    '  "title": "Section ' + finalSectionNum + ': Operating Model and Transformation Readiness",',
    '  "description": "Help us understand where you are in your AI operating model journey so we can recommend the right Northstar Integrators engagement",',
    '  "questions": [',
    '    { "id": "' + finalSectionPrefix + 'q1", "section": "Operating Model and Transformation Readiness", "question": "How would you describe your organisation\'s current AI operating model maturity?", "type": "multiple_choice", "options": ["No formal AI operating model — AI is ad hoc / project-by-project", "Early stage — some AI pilots running but no coordinated model", "Developing — a few workflows redesigned for AI but not scaled", "Mature — structured AI governance and workflow ownership in place", "Advanced — enterprise-wide AI-first operating model with continuous improvement"], "contextHint": "Helps us calibrate which Northstar Integrators engagement phase is the right starting point for your organisation" },',
    '    { "id": "' + finalSectionPrefix + 'q2", "section": "Operating Model and Transformation Readiness", "question": "Which of the following best describes how AI value is currently measured at your organisation?", "type": "multiple_choice", "options": ["We measure AI activity (usage, number of tools, pilots launched)", "We have some operational KPIs but they are inconsistently tracked", "We have a KPI spine tied to workflow outcomes (capacity, cost, cycle time, quality, risk)", "We have full P&L linkage and benefits realisation tracking for AI"], "contextHint": "Establishes whether a KPI baseline or benefits realisation engagement is needed before or alongside workflow redesign" },',
    '    { "id": "' + finalSectionPrefix + 'q3", "section": "Operating Model and Transformation Readiness", "question": "Where is AI governance today at your organisation? (select all that apply)", "type": "checkbox", "options": ["Governance exists mainly on paper (policies, committees) but not in day-to-day workflows", "Controls and monitoring are reactive — we respond to incidents rather than preventing them", "We have clear autonomy boundaries for what AI agents can do vs. when humans must approve", "Governance is embedded in tools and workflows, not just policy documents", "We have no formal AI governance yet"], "contextHint": "Identifies whether a governance assessment or governance-in-execution engagement is a priority" },',
    '    { "id": "' + finalSectionPrefix + 'q4", "section": "Operating Model and Transformation Readiness", "question": "What is the single biggest bottleneck to scaling AI in your organisation right now?", "type": "multiple_choice", "options": ["Unclear ownership / decision rights for AI workflows and outcomes", "Lack of agreed KPIs or value hypotheses to justify investment", "Risk, compliance or governance concerns blocking deployment", "AI pilots are successful locally but we cannot replicate across the enterprise", "People, culture and change management — teams are not adopting AI-enabled ways of working", "Portfolio sprawl — too many initiatives with no coherent prioritisation", "Data quality or integration gaps preventing AI from working reliably"], "contextHint": "The single most powerful signal for identifying which Northstar Integrators engagement addresses the root blocker" },',
    '    { "id": "' + finalSectionPrefix + 'q5", "section": "Operating Model and Transformation Readiness", "question": "How aligned is your executive team on the AI transformation agenda?", "type": "rating", "options": ["1", "2", "3", "4", "5"], "placeholder": "1 = completely misaligned / no shared vision, 5 = fully aligned with clear accountabilities", "contextHint": "Low scores indicate a Leadership Alignment & Narrative or Executive Briefing engagement should come first" },',
    '    { "id": "' + finalSectionPrefix + 'q6", "section": "Operating Model and Transformation Readiness", "question": "Which transformation outcomes are your top priorities for the next 12 months? (select up to 3)", "type": "checkbox", "options": ["Reduce cost-to-serve across AI-enabled workflows", "Increase workforce capacity without headcount growth", "Reduce cycle time and eliminate workflow bottlenecks", "Improve quality and reliability of AI-assisted decisions", "Reduce risk exposure from ungoverned or opaque AI", "Scale AI adoption across business units or geographies", "Build internal capability to sustain AI-first ways of working"], "contextHint": "Maps directly to Northstar Integrators service KPIs (Capacity, Cost-to-serve, Cycle time, Quality, Risk) to identify the highest-value starting point" }',
    '  ]',
    '}',
  ].join('\n');

  const prompt = `You are a senior Northstar Integrators consultant preparing a pre-workshop discovery questionnaire for a ServiceNow AI transformation workshop with ${clientName}.

CRITICAL INSTRUCTION: This is NOT a generic template. Every question must feel like it was written by someone who spent a day researching ${clientName} specifically. A generic question is a failure.

CLIENT INTELLIGENCE BRIEF:
${contextBlock}

TOP RESEARCH FINDINGS — YOU MUST USE ALL OF THESE (each must appear somewhere in the questionnaire — in question text, as a named option, or in a contextHint):
${topFindings.map((f, i) => `${i + 1}. ${f}`).join('\n') || 'No specific signals — use company overview and industry context.'}

YOUR TASK:
Produce a JSON questionnaire using the section structure below for the "${focus}" focus area. The final "Operating Model and Transformation Readiness" section must be reproduced verbatim. All other sections must be written from the intelligence above.

HOW TO WRITE RESEARCH-DRIVEN QUESTIONS (mandatory — no exceptions):

1. QUESTION TEXT: Every question must contain at least one specific reference to ${clientName}'s actual context. Do not write generic questions — write questions that reference the client's real signals, initiatives, or named systems.

2. OPTIONS: For every checkbox/multiple_choice question, at least 2 options must be drawn directly from client intelligence (a known pain point, named initiative, known tech platform, regulatory constraint, or competitive pressure). Label them naturally.

3. PLACEHOLDERS: For every text question, the placeholder must name a real thing from the research — never a generic example.

4. CONTEXT HINTS: Every section must have at least 2 contextHints. Each contextHint must quote or directly reference a specific finding, and name a person, date, system, or initiative where possible.

5. LEADERSHIP REFERENCES: At least 2 questions across the questionnaire must name a specific leader from the keyLeadership list.

6. RECENCY: At least 1 question must reference a specific recent development (with date/fact).

${sectionStructure}

${verbatimSection}

OUTPUT FORMAT — return ONLY valid JSON, no markdown, no preamble:
{
  "generatedAt": "${new Date().toISOString()}",
  "clientName": "${clientName}",
  "sections": [ ...${totalSections} sections... ]
}

Question object schema: { "id": "sXqY", "section": "<section name>", "question": "...", "type": "text|multiple_choice|checkbox|rating", "options": [...] (for non-text), "placeholder": "..." (optional), "contextHint": "..." (optional) }`;

  const raw = await openai.generateChatCompletion({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.5,
    maxTokens: 6000,
  });

  let survey: PreWorkshopSurvey;
  try {
    const cleaned = (raw || '').replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    survey = JSON.parse(cleaned);
  } catch {
    survey = {
      generatedAt: new Date().toISOString(),
      clientName,
      sections: [],
    };
  }

  await prisma.workspace.update({
    where: { workspaceId },
    data: { preworkshopSurvey: JSON.stringify(survey) },
  });

  const qCount = survey.sections.reduce((n, s) => n + s.questions.length, 0);
  await appendLog(workspaceId, `[Stage 1] Survey generated — ${survey.sections.length} sections, ${qCount} questions`);

  if (ws.requestedBy) {
    sendNotification({
      type: 'survey_complete',
      userId: ws.requestedBy,
      title: 'Pre-Workshop Survey Ready',
      message: `Survey for ${ws.clientName || 'client'} is ready — ${survey.sections.length} sections, ${qCount} questions.`,
      companyName: ws.clientName || undefined,
    }).catch(() => {});
  }

  return survey;
}

// ============================================================================
// STAGE 1-C: Survey DOCX Export (server-side)
// ============================================================================

export async function buildSurveyDocx(workspaceId: string): Promise<Buffer> {
  const {
    Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
    Table, TableRow, TableCell, WidthType, BorderStyle,
  } = await import('docx');

  const ws = await prisma.workspace.findUniqueOrThrow({
    where: { workspaceId },
    select: { clientName: true, preworkshopSurvey: true },
  });

  if (!ws.preworkshopSurvey) throw new Error('Survey not yet generated');
  const survey: PreWorkshopSurvey = JSON.parse(ws.preworkshopSurvey);

  const DARK = '1F2937';
  const BLUE = '1D4ED8';
  const GREY = '6B7280';
  const LIGHT_GREY = '9CA3AF';
  const RULE_GREY = 'D1D5DB';

  const noBorder = {
    top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  };

  const thinBorder = {
    top: { style: BorderStyle.SINGLE, size: 4, color: RULE_GREY },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: RULE_GREY },
    left: { style: BorderStyle.SINGLE, size: 4, color: RULE_GREY },
    right: { style: BorderStyle.SINGLE, size: 4, color: RULE_GREY },
  };

  const dateStr = new Date(survey.generatedAt).toLocaleDateString('en-GB', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const docChildren: any[] = [
    // ── Cover ──────────────────────────────────────────────────────────────
    new Paragraph({ children: [], spacing: { after: 800 } }),
    new Paragraph({
      children: [new TextRun({ text: 'Northstar Integrators', bold: true, size: 22, color: BLUE })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [new TextRun({ text: survey.clientName, bold: true, size: 48, color: DARK })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 160 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'Pre-Workshop Discovery Questionnaire', size: 30, color: GREY })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'AI-First Service Transformation Workshop', size: 22, color: LIGHT_GREY })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 800 },
    }),
    new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: RULE_GREY } },
      children: [],
      spacing: { after: 400 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `Prepared by Northstar Integrators  |  ${dateStr}  |  Confidential`, size: 18, color: LIGHT_GREY })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 1200 },
    }),

    // ── Instructions ───────────────────────────────────────────────────────
    new Paragraph({
      children: [new TextRun({ text: 'Instructions', bold: true, size: 26, color: DARK })],
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 400, after: 160 },
    }),
    new Paragraph({
      children: [new TextRun({
        text: 'Please complete this questionnaire prior to the workshop. Your responses are confidential and will be used solely to tailor the session to your team\'s context, priorities and readiness. There are no right or wrong answers — candid responses will ensure the workshop delivers maximum value.',
        size: 20,
        color: GREY,
      })],
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [new TextRun({
        text: 'Estimated completion time: 10–15 minutes.',
        size: 20,
        color: GREY,
        italics: true,
      })],
      spacing: { after: 800 },
    }),
  ];

  for (let si = 0; si < survey.sections.length; si++) {
    const section = survey.sections[si];

    // Section heading
    docChildren.push(
      new Paragraph({
        children: [new TextRun({ text: section.title, bold: true, size: 28, color: DARK })],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 720, after: 0 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: BLUE } },
      }),
    );

    if (section.description) {
      docChildren.push(
        new Paragraph({
          children: [new TextRun({ text: section.description, italics: true, size: 19, color: GREY })],
          spacing: { before: 160, after: 320 },
        }),
      );
    } else {
      docChildren.push(new Paragraph({ children: [], spacing: { after: 320 } }));
    }

    for (let qi = 0; qi < section.questions.length; qi++) {
      const q = section.questions[qi];
      const qNum = `${qi + 1}.`;

      // Question label
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${qNum}  `, bold: true, size: 21, color: BLUE }),
            new TextRun({ text: q.question, bold: true, size: 21, color: DARK }),
          ],
          spacing: { before: 360, after: 100 },
        }),
      );

      // Context hint — plain italic, no emoji
      if (q.contextHint) {
        docChildren.push(
          new Paragraph({
            children: [new TextRun({ text: `Note: ${q.contextHint}`, italics: true, size: 17, color: LIGHT_GREY })],
            spacing: { after: 120 },
            indent: { left: 360 },
          }),
        );
      }

      if (q.type === 'text') {
        docChildren.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: q.placeholder || '', size: 19, color: LIGHT_GREY, italics: true })],
                        spacing: { before: 100, after: 100 },
                      }),
                      new Paragraph({ children: [], spacing: { after: 240 } }),
                    ],
                    borders: thinBorder,
                    margins: { top: 140, bottom: 140, left: 220, right: 220 },
                  }),
                ],
              }),
            ],
          }),
        );
      } else if (q.type === 'rating') {
        // Rating scale as a compact table
        const labelRow = new TableRow({
          children: ['1', '2', '3', '4', '5'].map((n) =>
            new TableCell({
              width: { size: 20, type: WidthType.PERCENTAGE },
              children: [new Paragraph({
                children: [new TextRun({ text: n, size: 20, bold: true, color: DARK })],
                alignment: AlignmentType.CENTER,
              })],
              borders: thinBorder,
              margins: { top: 100, bottom: 100 },
            }),
          ),
        });
        const boxRow = new TableRow({
          children: Array(5).fill(null).map(() =>
            new TableCell({
              width: { size: 20, type: WidthType.PERCENTAGE },
              children: [new Paragraph({ children: [], spacing: { after: 280 } })],
              borders: thinBorder,
            }),
          ),
        });
        docChildren.push(new Table({
          width: { size: 40, type: WidthType.PERCENTAGE },
          rows: [labelRow, boxRow],
        }));
        if (q.placeholder) {
          docChildren.push(new Paragraph({
            children: [new TextRun({ text: q.placeholder, size: 17, color: LIGHT_GREY, italics: true })],
            spacing: { before: 80, after: 80 },
          }));
        }
      } else if (q.type === 'multiple_choice' || q.type === 'checkbox') {
        // Two-column option layout for checkbox, single column for multiple choice
        const opts = q.options || [];
        if (q.type === 'checkbox' && opts.length > 4) {
          // Split into two columns via table
          const half = Math.ceil(opts.length / 2);
          const left = opts.slice(0, half);
          const right = opts.slice(half);
          const maxRows = Math.max(left.length, right.length);
          const rows: any[] = [];
          for (let r = 0; r < maxRows; r++) {
            const makeCell = (opt?: string) =>
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                children: [new Paragraph({
                  children: opt
                    ? [new TextRun({ text: '  ', size: 19 }), new TextRun({ text: `[ ]  ${opt}`, size: 19, color: DARK })]
                    : [],
                  spacing: { before: 60, after: 60 },
                })],
                borders: noBorder,
              });
            rows.push(new TableRow({ children: [makeCell(left[r]), makeCell(right[r])] }));
          }
          docChildren.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }));
        } else {
          for (const opt of opts) {
            const prefix = q.type === 'multiple_choice' ? '( )  ' : '[ ]  ';
            docChildren.push(
              new Paragraph({
                children: [new TextRun({ text: `${prefix}${opt}`, size: 19, color: DARK })],
                spacing: { before: 60, after: 60 },
                indent: { left: 360 },
              }),
            );
          }
        }
      }

      docChildren.push(new Paragraph({ children: [], spacing: { after: 120 } }));
    }
  }

  // ── Footer ─────────────────────────────────────────────────────────────
  docChildren.push(
    new Paragraph({
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: RULE_GREY } },
      children: [],
      spacing: { before: 1000, after: 240 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'Thank you for taking the time to complete this questionnaire.', bold: true, size: 22, color: DARK })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 160 },
    }),
    new Paragraph({
      children: [new TextRun({
        text: 'Your responses will be reviewed by the Northstar Integrators team prior to the workshop and used to ensure the session is focused, relevant and actionable for your organisation.',
        size: 19,
        color: GREY,
      })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'Northstar Integrators  |  northstar.example', size: 18, color: LIGHT_GREY })],
      alignment: AlignmentType.CENTER,
    }),
  );

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 20, color: DARK },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 1080, bottom: 1080, left: 1260, right: 1260 },
        },
      },
      children: docChildren,
    }],
  });

  return Packer.toBuffer(doc);
}

// ============================================================================
// STAGE 3: OOTB Agent Mapping
// ============================================================================

export async function runAgentMapping(workspaceId: string): Promise<AgentMapping[]> {
  const ws = await prisma.workspace.findUniqueOrThrow({
    where: { workspaceId },
    select: {
      clientName: true,
      clientIntelligence: true,
      surveyResponses: true,
      workshopNotes: true,
      miroContextItems: true,
      requestedBy: true,
    },
  });

  await appendLog(workspaceId, '[Stage 3] Running OOTB agent mapping...');

  const openai = getOpenAIService();
  const catalog = getAgentCatalog();

  // Build context items from all sources
  const contextItems: Array<{ text: string; source: 'survey' | 'miro' | 'notes' }> = [];

  // From survey responses — extract free-text answers
  if (ws.surveyResponses) {
    const responses: SurveyResponses = JSON.parse(ws.surveyResponses);
    // we don't need survey structure for mapping, just the free-text answers
    for (const r of responses.responses || []) {
      if (typeof r.answer === 'string' && r.answer.trim().length > 20) {
        contextItems.push({ text: r.answer.trim(), source: 'survey' });
      }
    }
  }

  // From Miro context items
  if (ws.miroContextItems) {
    const items: MiroContextItem[] = JSON.parse(ws.miroContextItems);
    for (const item of items) {
      if (item.text?.trim().length > 10) {
        contextItems.push({ text: item.text.trim(), source: 'miro' });
      }
    }
  }

  // From meeting notes — split into paragraphs/bullet points
  if (ws.workshopNotes) {
    const noteLines = ws.workshopNotes
      .split(/\n|•|-/)
      .map((l) => l.trim())
      .filter((l) => l.length > 20);
    for (const line of noteLines.slice(0, 20)) {
      contextItems.push({ text: line, source: 'notes' });
    }
  }

  if (contextItems.length === 0) {
    await appendLog(workspaceId, '[Stage 3] No context items found — agent mapping skipped');
    return [];
  }

  await appendLog(workspaceId, `[Stage 3] Mapping ${contextItems.length} context items to OOTB agents...`);

  // Batch context items into groups of 10 to avoid token limits
  const BATCH_SIZE = 10;
  const allMappings: AgentMapping[] = [];

  // Build catalog summary for the prompt (name + description + category)
  const catalogSummary = catalog.map((a) =>
    `ID:${a.id} [${a.category}] "${a.name}" — ${a.description.substring(0, 120)}`
  ).join('\n');

  for (let i = 0; i < contextItems.length; i += BATCH_SIZE) {
    const batch = contextItems.slice(i, i + BATCH_SIZE);

    const batchPrompt = `You are a ServiceNow AI solution expert. Given a list of client context items (pain points, use cases, or workshop notes) and a catalog of ServiceNow OOTB AI agents, map each context item to the most relevant agents.

CLIENT: ${ws.clientName || 'the client'}

CONTEXT ITEMS:
${batch.map((c, idx) => `${idx + 1}. [${c.source}] ${c.text}`).join('\n')}

SERVICENOW OOTB AGENT CATALOG (ID | Category | Name | Description):
${catalogSummary}

Return ONLY valid JSON array (no markdown):
[
  {
    "contextItemIndex": 0,
    "matchedAgentIds": [12, 45, 78],
    "relevanceScores": [0.95, 0.82, 0.71],
    "rationales": ["reason for agent 12", "reason for agent 45", "reason for agent 78"],
    "aiMomentTypes": ["automate", "assist", "advise"],
    "tisda": {
      "trigger": "what initiates this",
      "intent": "user goal in natural language",
      "signals": ["key data fields or context needed"],
      "decision": "logic to be applied",
      "action": "what the system does"
    }
  }
]

Rules:
- Return 2–4 most relevant agents per context item
- aiMomentType must be one of: assist, automate, advise, answer
- relevanceScore: 0.0–1.0
- Only return agents from the provided catalog (use exact IDs)
- If no agent is relevant, return matchedAgentIds: []`;

    try {
      const raw = await openai.generateChatCompletion({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: batchPrompt }],
        temperature: 0.2,
        maxTokens: 3000,
      });

      const cleaned = (raw || '').replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const batchResults: any[] = JSON.parse(cleaned);

      for (const result of batchResults) {
        const contextItem = batch[result.contextItemIndex];
        if (!contextItem) continue;

        const matchedAgents = (result.matchedAgentIds || [])
          .map((id: number, idx: number) => {
            const agent = catalog.find((a) => a.id === id);
            if (!agent) return null;
            return {
              agent,
              relevanceScore: result.relevanceScores?.[idx] ?? 0.5,
              rationale: result.rationales?.[idx] ?? '',
              aiMomentType: result.aiMomentTypes?.[idx] ?? 'assist',
              prerequisites: [],
            };
          })
          .filter(Boolean);

        if (matchedAgents.length > 0) {
          allMappings.push({
            contextItem: contextItem.text,
            contextSource: contextItem.source,
            matchedAgents,
            tisda: result.tisda || undefined,
          });
        }
      }
    } catch (err: any) {
      logger.warn('[Engagement] Agent mapping batch failed', { i, err: err.message });
    }
  }

  // Sort by top relevance score descending
  allMappings.sort((a, b) => {
    const topA = Math.max(...a.matchedAgents.map((m) => m.relevanceScore));
    const topB = Math.max(...b.matchedAgents.map((m) => m.relevanceScore));
    return topB - topA;
  });

  await prisma.workspace.update({
    where: { workspaceId },
    data: {
      agentMappings: JSON.stringify(allMappings),
      agentMappingStatus: 'completed',
    },
  });

  await appendLog(workspaceId, `[Stage 3] Agent mapping complete — ${allMappings.length} mappings generated`);
  logger.info('[Engagement] Agent mapping complete', { workspaceId, count: allMappings.length });

  if (ws.requestedBy) {
    sendNotification({
      type: 'agent_mapping_complete',
      userId: ws.requestedBy,
      title: 'Agent Mapping Ready',
      message: `ServiceNow agent mapping for ${ws.clientName || 'client'} complete — ${allMappings.length} use cases mapped.`,
      companyName: ws.clientName || undefined,
    }).catch(() => {});
  }

  return allMappings;
}

// ============================================================================
// STAGE 3-C: Persona + Pain Point Mapping (user stories + agent mapping)
// ============================================================================

export interface WorkshopPersona {
  id: string;
  name: string;
  title: string;
}

export interface WorkshopPainPoint {
  id: string;
  text: string;
  personaId?: string;
  priority?: 'high' | 'medium' | 'low';
}

export interface PersonaAgentMatch {
  name: string;
  category: string;
  rationale: string;
  aiMomentType: string;
}

export interface PersonaPainPointMapping {
  painPointId: string;
  text: string;
  agents: PersonaAgentMatch[];
}

export interface PersonaMapping {
  persona: WorkshopPersona;
  userStories: string[];
  painPoints: PersonaPainPointMapping[];
}

export async function runPersonaMapping(workspaceId: string): Promise<PersonaMapping[]> {
  const ws = await prisma.workspace.findUniqueOrThrow({
    where: { workspaceId },
    select: {
      clientName: true,
      workshopPersonas: true,
      workshopPainPoints: true,
      clientIntelligence: true,
      requestedBy: true,
    },
  });

  const personas: WorkshopPersona[] = ws.workshopPersonas ? JSON.parse(ws.workshopPersonas) : [];
  const painPoints: WorkshopPainPoint[] = ws.workshopPainPoints ? JSON.parse(ws.workshopPainPoints) : [];

  if (personas.length === 0 || painPoints.length === 0) {
    await prisma.workspace.update({
      where: { workspaceId },
      data: { personaMappingStatus: 'completed', personaMappings: JSON.stringify([]) },
    });
    return [];
  }

  await prisma.workspace.update({ where: { workspaceId }, data: { personaMappingStatus: 'running' } });
  await appendLog(workspaceId, `[Workshop] Running persona mapping for ${personas.length} personas, ${painPoints.length} pain points...`);

  const openai = getOpenAIService();
  const catalog = getAgentCatalog();
  const catalogSummary = catalog.slice(0, 80).map((a) =>
    `ID:${a.id} [${a.category}] "${a.name}" — ${a.description.substring(0, 100)}`
  ).join('\n');

  const clientName = ws.clientName || 'the client';
  const intelContext = ws.clientIntelligence
    ? (() => { try { const i = JSON.parse(ws.clientIntelligence); return `Industry: ${i.industry || ''}\nBusiness: ${i.businessModel || ''}`; } catch { return ''; } })()
    : '';

  const personaList = personas.map((p) => `- ${p.name} (${p.title})`).join('\n');
  const painPointList = painPoints.map((pp) => {
    const persona = pp.personaId ? personas.find((p) => p.id === pp.personaId) : null;
    return `ID:${pp.id} [${persona ? `${persona.name} – ${persona.title}` : 'Unassigned'}] ${pp.text}`;
  }).join('\n');

  const prompt = `You are a ServiceNow solution architect helping map workshop findings to ServiceNow AI agents and user stories.

CLIENT: ${clientName}
${intelContext}

PERSONAS DISCOVERED IN WORKSHOP:
${personaList}

PAIN POINTS CAPTURED:
${painPointList}

SERVICENOW OOTB AGENT CATALOG (subset):
${catalogSummary}

Generate a JSON array with one entry per persona. For each persona:
1. userStories: 2–4 user stories in format "As a [persona title], I want to [action] so that [business outcome]" — derived from their pain points
2. painPoints: for each pain point belonging to this persona (or unassigned ones), list 2–3 matching ServiceNow agents from the catalog

Return ONLY valid JSON (no markdown):
[
  {
    "personaId": "...",
    "userStories": ["As a ...", "..."],
    "painPoints": [
      {
        "painPointId": "...",
        "agents": [
          { "agentId": 12, "rationale": "...", "aiMomentType": "automate" }
        ]
      }
    ]
  }
]

Rules:
- Only include pain points that belong to this persona (matching personaId) OR unassigned pain points (include once under first persona)
- aiMomentType: assist | automate | advise | answer
- Only reference agent IDs from the catalog above
- User stories must be specific to the persona's role and pain points at ${clientName}`;

  const allMappings: PersonaMapping[] = [];

  try {
    const raw = await openai.generateChatCompletion({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      maxTokens: 4000,
    });

    const cleaned = (raw || '').replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const results: any[] = JSON.parse(cleaned);

    for (const result of results) {
      const persona = personas.find((p) => p.id === result.personaId);
      if (!persona) continue;

      const painPointMappings: PersonaPainPointMapping[] = (result.painPoints || []).map((pp: any) => {
        const originalPP = painPoints.find((p) => p.id === pp.painPointId);
        const agents: PersonaAgentMatch[] = (pp.agents || []).map((a: any) => {
          const catalogEntry = catalog.find((c) => c.id === a.agentId);
          if (!catalogEntry) return null;
          return {
            name: catalogEntry.name,
            category: catalogEntry.category,
            rationale: a.rationale || '',
            aiMomentType: a.aiMomentType || 'assist',
          };
        }).filter(Boolean);

        return {
          painPointId: pp.painPointId,
          text: originalPP?.text || pp.painPointId,
          agents,
        };
      });

      allMappings.push({
        persona,
        userStories: result.userStories || [],
        painPoints: painPointMappings,
      });
    }
  } catch (err: any) {
    logger.warn('[Engagement] Persona mapping failed', { workspaceId, err: err.message });
  }

  await prisma.workspace.update({
    where: { workspaceId },
    data: {
      personaMappings: JSON.stringify(allMappings),
      personaMappingStatus: 'completed',
    },
  });

  await appendLog(workspaceId, `[Workshop] Persona mapping complete — ${allMappings.length} persona mappings generated`);

  if (ws.requestedBy) {
    sendNotification({
      type: 'persona_mapping_complete',
      userId: ws.requestedBy,
      title: 'Persona Mapping Ready',
      message: `Persona mapping for ${ws.clientName || 'client'} complete — ${allMappings.length} persona${allMappings.length !== 1 ? 's' : ''} mapped with user stories and agent recommendations.`,
      companyName: ws.clientName || undefined,
    }).catch(() => {});
  }

  return allMappings;
}

// ============================================================================
// STAGE 3-B: Northstar Integrators Service Mapping
// ============================================================================

export async function runServiceMapping(workspaceId: string): Promise<ServiceMapping[]> {
  const ws = await prisma.workspace.findUniqueOrThrow({
    where: { workspaceId },
    select: {
      clientName: true,
      clientIntelligence: true,
      surveyResponses: true,
      workshopNotes: true,
      miroContextItems: true,
      requestedBy: true,
    },
  });

  await appendLog(workspaceId, '[Stage 3] Running Northstar Integrators service mapping...');

  const openai = getOpenAIService();
  const catalog = getServiceCatalog();

  // Build context items from all sources (same as agent mapping)
  const contextItems: Array<{ text: string; source: 'survey' | 'miro' | 'notes' | 'intelligence' }> = [];

  if (ws.clientIntelligence) {
    const intel: ClientIntelligenceResult = JSON.parse(ws.clientIntelligence);
    for (const item of [...(intel.painPointHypotheses || []), ...(intel.strategicInitiatives || [])]) {
      if (item?.trim().length > 15) contextItems.push({ text: item.trim(), source: 'intelligence' });
    }
  }

  if (ws.surveyResponses) {
    const responses: SurveyResponses = JSON.parse(ws.surveyResponses);
    for (const r of responses.responses || []) {
      if (typeof r.answer === 'string' && r.answer.trim().length > 20) {
        contextItems.push({ text: r.answer.trim(), source: 'survey' });
      }
    }
  }

  if (ws.miroContextItems) {
    const items: MiroContextItem[] = JSON.parse(ws.miroContextItems);
    for (const item of items) {
      if (item.text?.trim().length > 10) contextItems.push({ text: item.text.trim(), source: 'miro' });
    }
  }

  if (ws.workshopNotes) {
    const noteLines = ws.workshopNotes.split(/\n|•|-/).map((l) => l.trim()).filter((l) => l.length > 20);
    for (const line of noteLines.slice(0, 15)) {
      contextItems.push({ text: line, source: 'notes' });
    }
  }

  if (contextItems.length === 0) {
    await appendLog(workspaceId, '[Stage 3] No context items for service mapping — skipped');
    return [];
  }

  await appendLog(workspaceId, `[Stage 3] Mapping ${contextItems.length} context items to Northstar Integrators services...`);

  // Build compact catalog index for the prompt
  const catalogIndex = catalog.map((s) =>
    `ID:${s.id} [${s.phase}] "${s.name}"\n  Problem: ${s.problem_statements.slice(0, 2).join(' | ')}\n  Signals: ${s.client_need_signals.slice(0, 3).join(' | ')}`
  ).join('\n\n');

  // Batch context items in groups of 8
  const BATCH_SIZE = 8;
  const allMappings: ServiceMapping[] = [];

  for (let i = 0; i < contextItems.length; i += BATCH_SIZE) {
    const batch = contextItems.slice(i, i + BATCH_SIZE);
    const batchText = batch.map((c, idx) => `[${idx}] (${c.source}) ${c.text}`).join('\n');

    const prompt = `You are a Northstar Integrators consulting expert. Map each client statement below to the most relevant Northstar Integrators AI-First Operating Model services.

ENTERPRISE SERVICE CATALOG:
${catalogIndex}

CLIENT STATEMENTS (index | source | text):
${batchText}

For each statement, identify up to 3 matching services. Only match when there is genuine relevance — skip if no strong match.

Return JSON array:
[
  {
    "contextItemIndex": 0,
    "matchedServiceIds": ["phase0_exec_briefing", "phase1_diagnostic"],
    "relevanceScores": [0.9, 0.7],
    "rationales": ["Rationale for service 1", "Rationale for service 2"],
    "matchedSignals": [["signal that matched for s1"], ["signal that matched for s2"]],
    "recommendedAs": ["primary", "bundle"]
  }
]

Rules:
- relevanceScore 0–1 (only include if >= 0.5)
- recommendedAs: "primary" if it's the best fit, "bundle" if it pairs with another, "standalone" if it's a quick win
- matchedSignals: list the actual client_need_signals from the catalog that matched`;

    try {
      const raw = await openai.generateChatCompletion({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        maxTokens: 3000,
      });

      const cleaned = (raw || '').replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const batchResults: any[] = JSON.parse(cleaned);

      for (const result of batchResults) {
        const contextItem = batch[result.contextItemIndex];
        if (!contextItem) continue;

        const matchedServices = (result.matchedServiceIds || [])
          .map((id: string, idx: number) => {
            const service = catalog.find((s) => s.id === id);
            if (!service) return null;
            const score = result.relevanceScores?.[idx] ?? 0.5;
            if (score < 0.5) return null;
            return {
              service,
              relevanceScore: score,
              rationale: result.rationales?.[idx] ?? '',
              matchedSignals: result.matchedSignals?.[idx] ?? [],
              recommendedAs: result.recommendedAs?.[idx] ?? 'primary',
            };
          })
          .filter(Boolean);

        if (matchedServices.length > 0) {
          allMappings.push({
            contextItem: contextItem.text,
            contextSource: contextItem.source,
            matchedServices,
          });
        }
      }
    } catch (err: any) {
      logger.warn('[Engagement] Service mapping batch failed', { i, err: err.message });
    }
  }

  // Sort by top relevance score descending
  allMappings.sort((a, b) => {
    const topA = Math.max(...a.matchedServices.map((m) => m.relevanceScore));
    const topB = Math.max(...b.matchedServices.map((m) => m.relevanceScore));
    return topB - topA;
  });

  await prisma.$executeRawUnsafe(
    `UPDATE workspaces SET service_mappings = $1, service_mapping_status = 'completed' WHERE workspace_id = $2`,
    JSON.stringify(allMappings),
    workspaceId,
  );

  await appendLog(workspaceId, `[Stage 3] Service mapping complete — ${allMappings.length} mappings generated`);
  logger.info('[Engagement] Service mapping complete', { workspaceId, count: allMappings.length });

  if (ws.requestedBy) {
    sendNotification({
      type: 'service_mapping_complete',
      userId: ws.requestedBy,
      title: 'Service Mapping Ready',
      message: `Northstar Integrators service recommendations for ${ws.clientName || 'client'} complete — ${allMappings.length} opportunity areas identified.`,
      companyName: ws.clientName || undefined,
    }).catch(() => {});
  }

  return allMappings;
}

// ============================================================================
// DB migration — called at app startup
// ============================================================================

export async function runEngagementMigration(): Promise<void> {
  const migrations: Array<{ col: string; sql: string }> = [
    { col: 'engagement_stage', sql: `ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS engagement_stage TEXT` },
    { col: 'client_intelligence', sql: `ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS client_intelligence TEXT` },
    { col: 'preworkshop_survey', sql: `ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS preworkshop_survey TEXT` },
    { col: 'survey_doc_url', sql: `ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS survey_doc_url TEXT` },
    { col: 'survey_responses', sql: `ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS survey_responses TEXT` },
    { col: 'workshop_prep_miro_id', sql: `ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS workshop_prep_miro_id TEXT` },
    { col: 'workshop_prep_miro_url', sql: `ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS workshop_prep_miro_url TEXT` },
    { col: 'workshop_prep_miro_snapshot', sql: `ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS workshop_prep_miro_snapshot TEXT` },
    { col: 'workshop_prep_miro_status', sql: `ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS workshop_prep_miro_status TEXT DEFAULT 'pending'` },
    { col: 'workshop_prep_deck_url', sql: `ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS workshop_prep_deck_url TEXT` },
    { col: 'workshop_notes', sql: `ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS workshop_notes TEXT` },
    { col: 'miro_context_items', sql: `ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS miro_context_items TEXT` },
    { col: 'agent_mappings', sql: `ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS agent_mappings TEXT` },
    { col: 'agent_mapping_status', sql: `ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS agent_mapping_status TEXT DEFAULT 'pending'` },
    { col: 'service_mappings', sql: `ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS service_mappings TEXT` },
    { col: 'service_mapping_status', sql: `ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS service_mapping_status TEXT DEFAULT 'pending'` },
  ];

  for (const m of migrations) {
    try {
      await prisma.$executeRawUnsafe(m.sql);
      logger.info(`[Engagement] Migration: added column ${m.col}`);
    } catch {
      // Column already exists — expected on subsequent starts
    }
  }
}
