/**
 * Workshop Prep Miro Board Service
 *
 * Generates a pre-workshop facilitation Miro board following the
 * AI-First Service Transformation Workshop facilitation guide.
 *
 * 9-zone layout (3×3 grid, 3400×2000 each frame, 500px gaps):
 *   [0,0]    Zone 1: Current State Assessment
 *   [3900,0] Zone 2: AI Opportunity Scoping
 *   [7800,0] Zone 3: Constraints & Risk Landscape
 *   [0,2500] Zone 4: Persona Development
 *   [3900,2500] Zone 5: Service Journey Blueprint
 *   [7800,2500] Zone 6: TISDA Flow Mapping
 *   [0,5000] Zone 7: Ideation (Diverge → Shape → Commit)
 *   [3900,5000] Zone 8: Use Case Consolidation
 *   [7800,5000] Zone 9: Value–Feasibility Matrix
 */

import axios from 'axios';
import { getPrismaClient } from '../config/database';
import { getLoggerService } from './logger.service';
import { getOpenAIService } from './openai.service';
import type { ClientIntelligenceResult, SurveyResponses, MiroBoardSnapshot, MiroFrame, MiroItem } from '../../../shared/types/workspace';

// ── Workshop prediction types ─────────────────────────────────────────────────

interface PredictedPersona {
  name: string;
  department: string;
  responsibilities: string[];
  snApps: string[];
  kpis: string[];
  painPoints: string[];
  aiMoments: string[];
}

interface PredictedUseCase {
  title: string;
  description: string;
  personas: string[];
  journeyStages: string[];
  tisdaHighlight: string;
  ootbAgent: string;
  dependencies: string;
  metricsImpact: string;
  quadrant: 'quick_win' | 'strategic_bet' | 'foundation' | 'evaluate_later';
}

interface TisdaExample {
  useCase: string;
  trigger: string;
  intent: string;
  signals: string;
  decision: string;
  action: string;
}

interface WorkshopPredictions {
  personas: PredictedPersona[];
  useCases: PredictedUseCase[];
  tisdaExamples: TisdaExample[];
  hmwPrompts: string[];
  journeyPainPoints: { report: string; triage: string; diagnose: string; resolve: string; close: string };
}

async function generateWorkshopPredictions(
  clientName: string,
  intelligence: ClientIntelligenceResult | null,
  surveyResponses: SurveyResponses | null,
): Promise<WorkshopPredictions | null> {
  if (!intelligence) return null;
  try {
    const openai = getOpenAIService();
    const intelJson = JSON.stringify(intelligence, null, 2).substring(0, 4000);
    const surveyJson = surveyResponses ? JSON.stringify(surveyResponses, null, 2).substring(0, 2000) : 'Not available';

    const prompt = `You are a senior ServiceNow solution consultant at Northstar Integrators. Before an AI-First Service Transformation Workshop with ${clientName}, generate realistic pre-workshop predictions based on the client intelligence research below.

## Client Intelligence:
${intelJson}

## Pre-Workshop Survey Responses:
${surveyJson}

Generate the following predictions. Base everything specifically on the client data — no generic filler.

Return ONLY valid JSON matching this exact schema:
{
  "personas": [
    {
      "name": "role title specific to this client (e.g. 'IT Service Desk Manager')",
      "department": "IT / HR / Operations / Finance etc.",
      "responsibilities": ["top 3 day-to-day responsibilities"],
      "snApps": ["ServiceNow modules they likely use e.g. ITSM, HRSD, SPM"],
      "kpis": ["2-3 KPIs they care about e.g. MTTR, ticket deflection rate"],
      "painPoints": ["2-3 specific pain points grounded in client data"],
      "aiMoments": ["2-3 specific AI use cases for this persona"]
    }
  ],
  "useCases": [
    {
      "title": "specific use case name",
      "description": "one sentence description",
      "personas": ["affected roles"],
      "journeyStages": ["Report", "Triage", etc.],
      "tisdaHighlight": "one-line TISDA note e.g. 'Intent: employee submits HR request via chat'",
      "ootbAgent": "exact OOTB ServiceNow agent name e.g. 'HR Case Management Agent', 'Change Management Agent'",
      "dependencies": "key dependency e.g. 'CMDB accuracy, KB articles'",
      "metricsImpact": "expected metric change e.g. 'Reduce L1 handle time 30%'",
      "quadrant": "quick_win | strategic_bet | foundation | evaluate_later"
    }
  ],
  "tisdaExamples": [
    {
      "useCase": "name of the use case this example illustrates",
      "trigger": "what initiates this — user action, system event, or scheduled",
      "intent": "user's goal in natural language",
      "signals": "context data needed — e.g. device ID, assignment group, user history",
      "decision": "AI logic — model vs rule, approval needed, rollback condition",
      "action": "what happens — ticket created, response sent, workflow triggered"
    }
  ],
  "hmwPrompts": [
    "How might we... (6-8 specific HMW statements grounded in client pain points)"
  ],
  "journeyPainPoints": {
    "report": "friction at report/request stage specific to this client",
    "triage": "friction at triage stage",
    "diagnose": "friction at diagnose/work stage",
    "resolve": "friction at resolve/fulfill stage",
    "close": "friction at close/learn stage"
  }
}

Rules:
- Generate exactly 3-4 personas, 5-7 use cases, 2 TISDA examples, 6-8 HMW prompts
- Use the client's industry, tech stack, and pain points to make everything specific
- OOTB agent names must be real ServiceNow agents (e.g. "HR Candidate Onboarding Agent", "Change Management Agent", "IT Service Desk Agent", "Procurement Operations Agent")
- Quick wins: OOTB agents available now, low data dependency. Strategic bets: high value but complex. Foundation: enablers like CMDB fix, KB cleanup. Evaluate later: future state.`;

    return await openai.generateStructuredCompletion<WorkshopPredictions>(
      [{ role: 'user', content: prompt }],
      undefined,
      0.7,
    );
  } catch (err: any) {
    logger.warn('[PrepMiro] Workshop predictions generation failed (non-fatal)', { err: err.message });
    return null;
  }
}

const prisma = getPrismaClient();
const logger = getLoggerService();

const MIRO_API_BASE = 'https://api.miro.com/v2';
const COL = [0, 3900, 7800];
const ROW = [0, 2500, 5000];
const FW = 3400;
const FH = 2000;

function getMiroToken(): string {
  const t = process.env.MIRO_API_TOKEN;
  if (!t) throw new Error('MIRO_API_TOKEN not configured');
  return t;
}
function hdrs() {
  return { headers: { Authorization: `Bearer ${getMiroToken()}`, 'Content-Type': 'application/json' } };
}
const api = (boardId: string, path: string) => `${MIRO_API_BASE}/boards/${boardId}/${path}`;

async function appendLog(workspaceId: string, msg: string) {
  try {
    const ws = await prisma.workspace.findUnique({ where: { workspaceId }, select: { pipelineLog: true } });
    const ts = new Date().toISOString().substring(11, 19);
    await prisma.workspace.update({
      where: { workspaceId },
      data: { pipelineLog: `${ws?.pipelineLog || ''}\n[${ts}] ${msg}`.trim() },
    });
  } catch { /* non-fatal */ }
}

// ── Widget helpers ───────────────────────────────────────────────────────────

async function createFrame(boardId: string, title: string, x: number, y: number, w = FW, h = FH): Promise<string> {
  const res = await axios.post(api(boardId, 'frames'), {
    data: { title, format: 'custom', type: 'freeform' },
    position: { x, y }, geometry: { width: w, height: h },
  }, hdrs());
  return res.data.id;
}

async function createShape(
  boardId: string, content: string, shape: string,
  x: number, y: number, width: number, height: number,
  style: Record<string, any> = {}, parentId?: string,
): Promise<string> {
  try {
    const { fillColor = '#f8fafc', fontSize = 14, color = '#1a1a2e', ...rest } = style;
    const res = await axios.post(api(boardId, 'shapes'), {
      data: { content, shape },
      position: { x, y },
      geometry: { width, height },
      style: { fillColor, fontSize, color, borderColor: 'transparent', textAlign: 'center', textAlignVertical: 'middle', ...rest },
      ...(parentId ? { parent: { id: parentId } } : {}),
    }, hdrs());
    return res.data.id;
  } catch (err: any) {
    logger.warn('[PrepMiro] createShape failed', { err: err.response?.data || err.message });
    return '';
  }
}

async function createCard(
  boardId: string, title: string, content: string,
  x: number, y: number, opts: { cardTheme?: string; width?: number; parentFrameId?: string } = {},
): Promise<string> {
  try {
    const res = await axios.post(api(boardId, 'cards'), {
      data: { title: title.substring(0, 255), description: content.substring(0, 1000) },
      position: { x, y },
      geometry: { width: opts.width || 400 },
      style: { cardTheme: opts.cardTheme || '#2563eb' },
      ...(opts.parentFrameId ? { parent: { id: opts.parentFrameId } } : {}),
    }, hdrs());
    return res.data.id;
  } catch (err: any) {
    logger.warn('[PrepMiro] createCard failed', { err: err.response?.data || err.message });
    return '';
  }
}

async function createText(
  boardId: string, content: string, x: number, y: number,
  style: { fontSize?: number; color?: string; width?: number; parentFrameId?: string } = {},
): Promise<string> {
  try {
    const res = await axios.post(api(boardId, 'texts'), {
      data: { content },
      position: { x, y },
      geometry: { width: style.width || 300 },
      style: { fontSize: style.fontSize || 14, color: style.color || '#1a1a2e', textAlign: 'left' },
      ...(style.parentFrameId ? { parent: { id: style.parentFrameId } } : {}),
    }, hdrs());
    return res.data.id;
  } catch (err: any) {
    logger.warn('[PrepMiro] createText failed', { err: err.response?.data || err.message });
    return '';
  }
}

async function createStickyNote(
  boardId: string, content: string, x: number, y: number,
  color = 'light_yellow', parentId?: string,
): Promise<string> {
  try {
    const res = await axios.post(api(boardId, 'sticky_notes'), {
      data: { content: content.substring(0, 500), shape: 'square' },
      style: { fillColor: color },
      position: { x, y },
      ...(parentId ? { parent: { id: parentId } } : {}),
    }, hdrs());
    return res.data.id;
  } catch (err: any) {
    logger.warn('[PrepMiro] createStickyNote failed', { err: err.response?.data || err.message });
    return '';
  }
}

// ── Section header helper ────────────────────────────────────────────────────
async function zoneHeader(boardId: string, frameId: string, title: string, subtitle: string, color: string) {
  await createShape(boardId, `<p><strong>${title}</strong></p>`, 'round_rectangle',
    FW / 2, 60, FW - 160, 80, { fillColor: color, fontSize: 18, color: '#ffffff' }, frameId);
  if (subtitle) {
    await createText(boardId, `<p><em>${subtitle}</em></p>`, 200, 165,
      { fontSize: 12, color: '#64748b', width: FW - 300, parentFrameId: frameId });
  }
}

// ── Blank sticky cluster for participant input ───────────────────────────────
async function blankStickyCluster(boardId: string, frameId: string, labelY: number, label: string, color: string, count = 4) {
  await createText(boardId, `<p><strong>${label}</strong></p>`, 200, labelY,
    { fontSize: 13, color: '#475569', width: 400, parentFrameId: frameId });
  for (let i = 0; i < count; i++) {
    const x = 200 + i * 700;
    await createStickyNote(boardId, '', x, labelY + 60, color as any, frameId);
  }
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

export async function runWorkshopPrepMiroBoardGeneration(
  workspaceId: string,
  intelligence: ClientIntelligenceResult | null,
  surveyResponses: SurveyResponses | null,
): Promise<MiroBoardSnapshot> {

  await prisma.workspace.update({
    where: { workspaceId },
    data: { workshopPrepMiroStatus: 'running' },
  });

  const ws = await prisma.workspace.findUniqueOrThrow({
    where: { workspaceId },
    select: { clientName: true },
  });

  const clientName = ws.clientName || 'Client';
  logger.info('[PrepMiro] Creating workshop prep Miro board', { workspaceId, clientName });

  // ── Generate AI predictions before building the board ─────────────────────
  await appendLog(workspaceId, '[Stage 2] Running AI pre-workshop predictions (personas, use cases, TISDA, roadmap)...');
  const predictions = await generateWorkshopPredictions(clientName, intelligence, surveyResponses);
  if (predictions) {
    await appendLog(workspaceId, `[Stage 2] Predictions ready — ${predictions.personas.length} personas, ${predictions.useCases.length} use cases, ${predictions.tisdaExamples.length} TISDA examples`);
  } else {
    await appendLog(workspaceId, '[Stage 2] Predictions unavailable — board will use template stickies');
  }

  const boardName = `${clientName} — AI Workshop Facilitation Board`.substring(0, 60);
  const boardDesc = 'Pre-workshop facilitation board — AI-First Service Transformation Workshop';

  let boardRes: any;
  try {
    boardRes = await axios.post(`${MIRO_API_BASE}/boards`,
      { name: boardName, description: boardDesc },
      hdrs(),
    );
  } catch (err: any) {
    const msg = JSON.stringify(err.response?.data || err.message);
    throw new Error(`Miro board creation failed: ${msg}`);
  }

  const boardId: string = boardRes.data.id;
  const boardUrl: string = boardRes.data.viewLink || `https://miro.com/app/board/${boardId}/`;

  await appendLog(workspaceId, `[Stage 2] Miro board created: ${boardName}`);
  await appendLog(workspaceId, `[Stage 2] URL: ${boardUrl}`);

  const frames: MiroFrame[] = [];
  const pain = intelligence?.painPointHypotheses || [];
  const initiatives = intelligence?.strategicInitiatives || [];
  const techStack = intelligence?.techStack || [];

  // ══════════════════════════════════════════════════════════════════════════
  // ZONE 1 — Where Are We Today? (Current State Assessment)
  // ══════════════════════════════════════════════════════════════════════════
  await appendLog(workspaceId, '[Stage 2] Zone 1/9: Current State Assessment');
  const z1 = await createFrame(boardId, 'Zone 1: Where Are We Today?', COL[0], ROW[0]);
  await zoneHeader(boardId, z1, '🔵 Zone 1 — Where Are We Today?', 'Establish a shared understanding of your current service operations, data quality, and AI readiness', '#1d4ed8');

  const z1Sub = [
    { label: 'a) Data Health', items: ['CMDB accuracy?', 'Duplicate/incorrect users?', 'Knowledge base quality?'], color: 'light_blue' },
    { label: 'b) AI Usage Today', items: ['Predictive Intelligence usage?', 'Virtual Agent performance?', 'Now Assist adoption?'], color: 'light_green' },
    { label: 'c) Automation Maturity', items: ['Flow Designer utilization?', 'IntegrationHub spokes?', 'RPA deployment?'], color: 'light_yellow' },
    { label: 'd) AI Blockers', items: intelligence ? pain.slice(0, 3).map((p) => p.substring(0, 120)) : ['Process ownership gaps?', 'Data gaps?', 'Legacy system constraints?'], color: 'light_pink' },
  ];

  let z1X = 200;
  for (const sub of z1Sub) {
    await createText(boardId, `<p><strong>${sub.label}</strong></p>`, z1X, 240,
      { fontSize: 13, color: '#1d4ed8', width: 700, parentFrameId: z1 });
    for (let i = 0; i < sub.items.length; i++) {
      await createStickyNote(boardId, sub.items[i].substring(0, 200), z1X + i * 230, 320, sub.color as any, z1);
    }
    z1X += 800;
  }

  // Pre-populated context from intelligence
  if (intelligence) {
    await createText(boardId, `<p><strong>📋 Pre-Workshop Intel: ${clientName}</strong></p>`, 200, 820,
      { fontSize: 13, color: '#475569', width: FW - 300, parentFrameId: z1 });
    await createCard(boardId, `${clientName} Overview`,
      `Industry: ${intelligence.industry} | Size: ${intelligence.size}\n\nTech Stack: ${techStack.slice(0, 5).join(', ')}\n\nServiceNow signals: ${intelligence.servicenowMaturitySignals.slice(0, 2).join('; ')}`,
      200, 900, { cardTheme: '#1d4ed8', width: 1400, parentFrameId: z1 });
    if (initiatives.length) {
      await createCard(boardId, 'Known Strategic Initiatives',
        initiatives.slice(0, 4).map((i) => `• ${i.substring(0, 120)}`).join('\n'),
        1700, 900, { cardTheme: '#0891b2', width: 1400, parentFrameId: z1 });
    }
  }

  // Survey response context
  if (surveyResponses?.responses?.length) {
    await createText(boardId, '<p><strong>📝 Pre-Workshop Survey Insights</strong></p>', 200, 1340,
      { fontSize: 13, color: '#059669', width: 600, parentFrameId: z1 });
    const textAnswers = surveyResponses.responses
      .filter((r) => typeof r.answer === 'string' && (r.answer as string).length > 20)
      .slice(0, 4);
    for (let i = 0; i < textAnswers.length; i++) {
      await createStickyNote(boardId, String(textAnswers[i].answer).substring(0, 200),
        200 + i * 750, 1440, 'light_green', z1);
    }
  }

  await blankStickyCluster(boardId, z1, 1700, 'Additional observations (add during workshop):', 'light_yellow' as any, 4);
  frames.push({ frameId: z1, title: 'Zone 1: Current State Assessment', items: [] });

  // ══════════════════════════════════════════════════════════════════════════
  // ZONE 2 — Where Should AI Change the Game? (Opportunity Scoping)
  // ══════════════════════════════════════════════════════════════════════════
  await appendLog(workspaceId, '[Stage 2] Zone 2/9: AI Opportunity Scoping');
  const z2 = await createFrame(boardId, 'Zone 2: Where Should AI Change the Game?', COL[1], ROW[0]);
  await zoneHeader(boardId, z2, '🟢 Zone 2 — Where Should AI Change the Game?', 'Identify service areas where AI can deliver meaningful business and operational impact', '#059669');

  const z2Categories = [
    { label: 'Service Experience', desc: 'Virtual Agent, Now Assist, Journeys', color: '#0891b2', x: 250 },
    { label: 'Better Decisions', desc: 'Predictive Intelligence, AI Search, Analytics', color: '#7c3aed', x: 1100 },
    { label: 'Risk & Control', desc: 'GRC/SecOps enhancements, guardrails', color: '#ef4444', x: 1950 },
    { label: 'Smart Automation', desc: 'Flow Designer, RPA, Spokes', color: '#f59e0b', x: 2800 },
  ];

  // Map predicted use cases into opportunity categories
  const z2UcByCategory: Record<string, string[]> = {
    'Service Experience': [],
    'Better Decisions': [],
    'Risk & Control': [],
    'Smart Automation': [],
  };
  if (predictions?.useCases) {
    for (const uc of predictions.useCases) {
      const lower = uc.title.toLowerCase() + ' ' + uc.description.toLowerCase();
      if (lower.includes('virtual agent') || lower.includes('chat') || lower.includes('portal') || lower.includes('employee') || lower.includes('journey')) {
        z2UcByCategory['Service Experience'].push(uc.title);
      } else if (lower.includes('predict') || lower.includes('analytics') || lower.includes('search') || lower.includes('insight')) {
        z2UcByCategory['Better Decisions'].push(uc.title);
      } else if (lower.includes('risk') || lower.includes('governance') || lower.includes('compliance') || lower.includes('security')) {
        z2UcByCategory['Risk & Control'].push(uc.title);
      } else {
        z2UcByCategory['Smart Automation'].push(uc.title);
      }
    }
  }

  for (const cat of z2Categories) {
    await createShape(boardId, `<p><strong>${cat.label}</strong></p><p>${cat.desc}</p>`,
      'round_rectangle', cat.x, 230, 750, 100,
      { fillColor: cat.color, fontSize: 12, color: '#ffffff' }, z2);
    const catUcs = z2UcByCategory[cat.label] || [];
    const fallback = pain.slice(0, 2).map((p) => p.substring(0, 150));
    for (let i = 0; i < 3; i++) {
      const text = catUcs[i] || (i < fallback.length ? fallback[i] : '');
      await createStickyNote(boardId, text,
        cat.x + (i % 2) * 370, 380 + Math.floor(i / 2) * 280, 'light_yellow' as any, z2);
    }
  }

  await createText(boardId, '<p><strong>Facilitation prompts:</strong></p><p>• Where does friction occur today that AI could remove?</p><p>• Which decisions could be faster or safer with AI?</p><p>• Which tasks could be automated end-to-end?</p>', 200, 1000,
    { fontSize: 12, color: '#64748b', width: 2800, parentFrameId: z2 });
  await blankStickyCluster(boardId, z2, 1200, 'New opportunities identified (add during workshop):', 'light_green' as any, 4);
  frames.push({ frameId: z2, title: 'Zone 2: AI Opportunity Scoping', items: [] });

  // ══════════════════════════════════════════════════════════════════════════
  // ZONE 3 — What Is Slowing AI Down? (Constraints & Risks)
  // ══════════════════════════════════════════════════════════════════════════
  await appendLog(workspaceId, '[Stage 2] Zone 3/9: Constraints & Risk Landscape');
  const z3 = await createFrame(boardId, 'Zone 3: What Is Slowing AI Down?', COL[2], ROW[0]);
  await zoneHeader(boardId, z3, '🟣 Zone 3 — What Is Slowing AI Down?', 'Reveal constraints that could limit execution speed or safe deployment of AI', '#7c3aed');

  const z3Themes = [
    { label: 'Process & Ownership', items: ['Missing SOPs?', 'Workflow ownership gaps?', 'Unclear accountability?'], color: 'light_pink' },
    { label: 'Data Gaps', items: ['CMDB accuracy issues', 'KB content quality', 'Profile data completeness'], color: 'light_yellow' },
    { label: 'Technical Debt', items: ['Legacy systems?', 'Missing integrations?', 'API limitations?'], color: 'light_blue' },
    { label: 'Governance & Trust', items: ['Redaction/PII concerns?', 'Override rate fears?', 'Compliance requirements?'], color: 'light_green' },
  ];

  let z3Y = 250;
  for (const theme of z3Themes) {
    await createShape(boardId, `<p><strong>${theme.label}</strong></p>`, 'round_rectangle',
      FW / 2, z3Y, FW - 400, 60,
      { fillColor: '#7c3aed', fontSize: 13, color: '#ffffff' }, z3);
    for (let i = 0; i < theme.items.length; i++) {
      await createStickyNote(boardId, theme.items[i], 250 + i * 950, z3Y + 80, theme.color as any, z3);
    }
    // Pre-populate from intelligence
    if (intelligence?.regulatoryContext && theme.label === 'Governance & Trust') {
      await createStickyNote(boardId, intelligence.regulatoryContext.substring(0, 200), 250 + 3 * 950, z3Y + 80, 'light_pink' as any, z3);
    }
    z3Y += 350;
  }

  await blankStickyCluster(boardId, z3, 1700, 'Additional constraints (add during workshop):', 'light_yellow' as any, 4);
  frames.push({ frameId: z3, title: 'Zone 3: Constraints & Risk Landscape', items: [] });

  // ══════════════════════════════════════════════════════════════════════════
  // ZONE 4 — Persona Development
  // ══════════════════════════════════════════════════════════════════════════
  await appendLog(workspaceId, '[Stage 2] Zone 4/9: Persona Development');
  const z4 = await createFrame(boardId, 'Zone 4: Persona Development', COL[0], ROW[1], FW, FH + 200);
  await zoneHeader(boardId, z4, '👤 Zone 4 — Persona Development', 'Build a shared understanding of key user roles, goals, frustrations, and AI opportunities', '#0891b2');

  const personaColors = ['#0891b2', '#7c3aed', '#059669', '#f59e0b', '#ef4444'];
  const personasToRender = predictions?.personas?.length
    ? predictions.personas.slice(0, 3)
    : [
        { name: 'IT Service Manager', department: 'IT', responsibilities: [], snApps: [], kpis: [], painPoints: [], aiMoments: [] },
        { name: 'HR Business Partner', department: 'HR', responsibilities: [], snApps: [], kpis: [], painPoints: [], aiMoments: [] },
        { name: 'End User / Employee', department: 'All', responsibilities: [], snApps: [], kpis: [], painPoints: [], aiMoments: [] },
      ];

  for (let pi = 0; pi < personasToRender.length; pi++) {
    const persona = personasToRender[pi];
    const pColor = personaColors[pi];
    const px = 200 + pi * 1050;
    const pyBase = 240;

    await createShape(boardId, `<p><strong>${persona.name}</strong></p><p style="font-size:11px">${persona.department}</p>`,
      'round_rectangle', px, pyBase, 950, 80, { fillColor: pColor, fontSize: 14, color: '#ffffff' }, z4);

    const personaRows: Array<{ label: string; color: string; items: string[] }> = [
      { label: 'Responsibilities', color: 'light_blue', items: persona.responsibilities.slice(0, 2) },
      { label: 'SN Apps Used', color: 'light_green', items: persona.snApps.slice(0, 2) },
      { label: 'KPIs / OKRs', color: 'light_yellow', items: persona.kpis.slice(0, 2) },
      { label: 'Pain Points', color: 'light_pink', items: persona.painPoints.slice(0, 2) },
      { label: 'AI Moments', color: 'light_green', items: persona.aiMoments.slice(0, 2) },
    ];

    for (let ri = 0; ri < personaRows.length; ri++) {
      const row = personaRows[ri];
      await createText(boardId, row.label, px, pyBase + 110 + ri * 270,
        { fontSize: 11, color: '#64748b', width: 200, parentFrameId: z4 });
      for (let si = 0; si < 2; si++) {
        const text = row.items[si] || '';
        await createStickyNote(boardId, text.substring(0, 200), px + si * 470, pyBase + 140 + ri * 270, row.color as any, z4);
      }
    }
  }

  frames.push({ frameId: z4, title: 'Zone 4: Persona Development', items: [] });

  // ══════════════════════════════════════════════════════════════════════════
  // ZONE 5 — Service Journey Blueprint
  // ══════════════════════════════════════════════════════════════════════════
  await appendLog(workspaceId, '[Stage 2] Zone 5/9: Service Journey Blueprint');
  const z5 = await createFrame(boardId, 'Zone 5: Service Journey Blueprint', COL[1], ROW[1], FW, FH + 200);
  await zoneHeader(boardId, z5, '🗺️ Zone 5 — Service Journey Blueprint', 'Document the end-to-end flow across 5 stages: Report → Triage → Diagnose → Resolve → Close', '#059669');

  const journeyStages = [
    { name: 'Report / Request', x: 200, color: '#0891b2' },
    { name: 'Triage', x: 820, color: '#7c3aed' },
    { name: 'Diagnose / Work', x: 1440, color: '#f59e0b' },
    { name: 'Resolve / Fulfill', x: 2060, color: '#059669' },
    { name: 'Close / Learn', x: 2680, color: '#ef4444' },
  ];

  const journeyRows = [
    { label: 'Frontstage (User/Agent)', color: 'light_blue', yOff: 100 },
    { label: 'Backstage Platform', color: 'light_green', yOff: 380 },
    { label: 'Signals & Data', color: 'light_yellow', yOff: 660 },
    { label: 'Decision & Controls', color: 'light_pink', yOff: 940 },
    { label: 'Automation & Experience', color: 'light_green', yOff: 1220 },
  ];

  // Stage headers
  for (const stage of journeyStages) {
    await createShape(boardId, `<p><strong>${stage.name}</strong></p>`, 'round_rectangle',
      stage.x, 220, 580, 70, { fillColor: stage.color, fontSize: 12, color: '#ffffff' }, z5);
  }

  // Pre-populate frontstage row with journey pain point predictions
  const journeyPainMap: Record<string, string> = predictions?.journeyPainPoints ? {
    'Report / Request': predictions.journeyPainPoints.report,
    'Triage': predictions.journeyPainPoints.triage,
    'Diagnose / Work': predictions.journeyPainPoints.diagnose,
    'Resolve / Fulfill': predictions.journeyPainPoints.resolve,
    'Close / Learn': predictions.journeyPainPoints.close,
  } : {};

  // Top use case as the journey context card
  const topUseCase = predictions?.useCases?.[0];
  if (topUseCase) {
    await createShape(boardId, `<p><strong>Example Journey: ${topUseCase.title}</strong></p>`,
      'round_rectangle', 200, 150, FW - 300, 50,
      { fillColor: '#1e293b', fontSize: 12, color: '#ffffff' }, z5);
  }

  for (const row of journeyRows) {
    await createText(boardId, `<p><strong>${row.label}</strong></p>`, 60, 320 + row.yOff,
      { fontSize: 11, color: '#475569', width: 160, parentFrameId: z5 });
    for (const stage of journeyStages) {
      // Pre-fill frontstage with predicted friction; leave other rows as prompts
      const isFrontstage = row.label === 'Frontstage (User/Agent)';
      const isAutomation = row.label === 'Automation & Experience';
      let text = '';
      if (isFrontstage && journeyPainMap[stage.name]) {
        text = journeyPainMap[stage.name].substring(0, 200);
      } else if (isAutomation && topUseCase && stage.name === 'Resolve / Fulfill') {
        text = `OOTB: ${topUseCase.ootbAgent}`;
      }
      await createStickyNote(boardId, text, stage.x, 320 + row.yOff, row.color as any, z5);
    }
  }

  frames.push({ frameId: z5, title: 'Zone 5: Service Journey Blueprint', items: [] });

  // ══════════════════════════════════════════════════════════════════════════
  // ZONE 6 — TISDA Flow Mapping
  // ══════════════════════════════════════════════════════════════════════════
  await appendLog(workspaceId, '[Stage 2] Zone 6/9: TISDA Flow Mapping');
  const z6 = await createFrame(boardId, 'Zone 6: TISDA Flow Mapping', COL[2], ROW[1], FW, FH + 200);
  await zoneHeader(boardId, z6, '⚡ Zone 6 — TISDA Flow Mapping', 'Trigger → Intent → Signals → Decision → Action: break tasks into automation-ready components', '#f59e0b');

  const tisdaComponents = [
    { label: 'T — Trigger', desc: 'What initiates the task?', color: '#0891b2', y: 240 },
    { label: 'I — Intent', desc: 'User goal in natural language', color: '#7c3aed', y: 540 },
    { label: 'S — Signals & Data', desc: 'Required fields, context, device info, history', color: '#059669', y: 840 },
    { label: 'D — Decision', desc: 'Logic (model vs. rule), safety, rollback, approvals', color: '#f59e0b', y: 1140 },
    { label: 'A — Action', desc: 'Automation path, assistant output, system changes', color: '#ef4444', y: 1440 },
  ];

  // Map TISDA predictions to component fields
  const tisdaEx1 = predictions?.tisdaExamples?.[0];
  const tisdaEx2 = predictions?.tisdaExamples?.[1];
  const tisdaValueMap: Record<string, string[]> = {
    'T — Trigger': [tisdaEx1?.trigger || '', tisdaEx2?.trigger || ''],
    'I — Intent': [tisdaEx1?.intent || '', tisdaEx2?.intent || ''],
    'S — Signals & Data': [tisdaEx1?.signals || '', tisdaEx2?.signals || ''],
    'D — Decision': [tisdaEx1?.decision || '', tisdaEx2?.decision || ''],
    'A — Action': [tisdaEx1?.action || '', tisdaEx2?.action || ''],
  };

  // Header cards for the two examples
  if (tisdaEx1) {
    await createShape(boardId, `<p><strong>Example 1: ${tisdaEx1.useCase}</strong></p>`, 'round_rectangle',
      1200, 150, 2000, 50, { fillColor: '#0891b2', fontSize: 12, color: '#ffffff' }, z6);
  }
  if (tisdaEx2) {
    await createShape(boardId, `<p><strong>Example 2: ${tisdaEx2.useCase}</strong></p>`, 'round_rectangle',
      3280, 150, 2000, 50, { fillColor: '#7c3aed', fontSize: 12, color: '#ffffff' }, z6);
  }

  for (const comp of tisdaComponents) {
    await createShape(boardId, `<p><strong>${comp.label}</strong></p><p>${comp.desc}</p>`,
      'round_rectangle', 200, comp.y, 900, 80,
      { fillColor: comp.color, fontSize: 12, color: '#ffffff' }, z6);
    const values = tisdaValueMap[comp.label] || [];
    for (let i = 0; i < 3; i++) {
      const text = i < values.length && values[i] ? values[i].substring(0, 200) : '';
      await createStickyNote(boardId, text,
        1200 + i * 680, comp.y, 'light_yellow' as any, z6);
    }
  }

  frames.push({ frameId: z6, title: 'Zone 6: TISDA Flow Mapping', items: [] });

  // ══════════════════════════════════════════════════════════════════════════
  // ZONE 7 — Ideation (Diverge → Shape → Commit)
  // ══════════════════════════════════════════════════════════════════════════
  await appendLog(workspaceId, '[Stage 2] Zone 7/9: Ideation Sessions');
  const z7 = await createFrame(boardId, 'Zone 7: Ideation Sessions', COL[0], ROW[2]);
  await zoneHeader(boardId, z7, '💡 Zone 7 — Ideation Sessions', 'Diverge → Shape → Commit: from pain points to prioritised AI solutions', '#ec4899');

  const ideationSessions = [
    { label: 'Session 1: Problem Framing (Diverge)', desc: 'Convert persona & journey pain points into How-Might-We (HMW) statements', color: '#ec4899', x: 200 },
    { label: 'Session 2: Solution Sketching (Shape)', desc: 'Design early solution ideas, automation paths, and AI interactions', color: '#7c3aed', x: 1250 },
    { label: 'Session 3: Feasibility & 90-Day Plan (Commit)', desc: 'Score ideas, outline dependencies, governance needs, and rollout sequencing', color: '#059669', x: 2300 },
  ];

  const hmwPrompts = predictions?.hmwPrompts || [];

  for (const session of ideationSessions) {
    await createShape(boardId, `<p><strong>${session.label}</strong></p>`, 'round_rectangle',
      session.x, 240, 950, 80, { fillColor: session.color, fontSize: 12, color: '#ffffff' }, z7);
    await createText(boardId, `<p><em>${session.desc}</em></p>`, session.x, 340,
      { fontSize: 11, color: '#64748b', width: 900, parentFrameId: z7 });
    for (let i = 0; i < 4; i++) {
      let text = '';
      if (session.label.includes('Diverge') && hmwPrompts.length) {
        // Distribute HMW prompts evenly across the 4 Diverge stickies (first 4)
        text = hmwPrompts[i]?.substring(0, 200) || 'HMW...';
      } else if (session.label.includes('Shape') && predictions?.useCases?.length) {
        text = i < predictions.useCases.length ? `Idea: ${predictions.useCases[i].title}` : 'Solution idea...';
      } else {
        text = session.label.includes('Commit') ? 'Commitment...' : '';
      }
      await createStickyNote(boardId, text, session.x + (i % 2) * 460, 480 + Math.floor(i / 2) * 320, 'light_yellow' as any, z7);
    }
  }

  // Add remaining HMW prompts (5-8) as extra stickies at the bottom of Zone 7
  if (hmwPrompts.length > 4) {
    await createText(boardId, '<p><strong>Additional HMW prompts (pre-seeded from research):</strong></p>', 200, 1150,
      { fontSize: 12, color: '#475569', width: 2400, parentFrameId: z7 });
    for (let i = 4; i < Math.min(hmwPrompts.length, 8); i++) {
      await createStickyNote(boardId, hmwPrompts[i].substring(0, 200),
        200 + ((i - 4) % 4) * 700, 1250, 'light_pink' as any, z7);
    }
  }

  frames.push({ frameId: z7, title: 'Zone 7: Ideation Sessions', items: [] });

  // ══════════════════════════════════════════════════════════════════════════
  // ZONE 8 — Use Case Consolidation
  // ══════════════════════════════════════════════════════════════════════════
  await appendLog(workspaceId, '[Stage 2] Zone 8/9: Use Case Consolidation');
  const z8 = await createFrame(boardId, 'Zone 8: Use Case Consolidation', COL[1], ROW[2]);
  await zoneHeader(boardId, z8, '📋 Zone 8 — Use Case Consolidation', 'Synthesize all outputs into a structured list of use cases', '#0891b2');

  const ucFields = ['Description', 'Persona(s) Affected', 'Journey Stage(s)', 'TISDA Elements', 'Dependencies & Guardrails', 'Expected Metrics Impact'];
  const ucColX = [200, 820, 1440, 2060, 2680];

  // Column headers
  for (let ci = 0; ci < Math.min(ucFields.length, ucColX.length); ci++) {
    await createShape(boardId, `<p><strong>${ucFields[ci]}</strong></p>`, 'round_rectangle',
      ucColX[ci], 240, 540, 60, { fillColor: '#0891b2', fontSize: 11, color: '#ffffff' }, z8);
  }

  const ucRows = predictions?.useCases?.slice(0, 5) || [];
  const ucRowCount = Math.max(ucRows.length, 5);

  for (let row = 0; row < ucRowCount; row++) {
    const uc = ucRows[row];
    await createShape(boardId, `<p><strong>UC ${row + 1}</strong></p>`, 'round_rectangle',
      60, 360 + row * 260, 100, 60, { fillColor: '#e2e8f0', fontSize: 12, color: '#475569' }, z8);

    const ucCellData = uc ? [
      uc.title + (uc.description ? `\n${uc.description}` : ''),
      uc.personas.join(', '),
      uc.journeyStages.join(', '),
      uc.tisdaHighlight,
      uc.dependencies,
      uc.metricsImpact + `\n\nOOTB: ${uc.ootbAgent}`,
    ] : Array(5).fill('');

    for (let ci = 0; ci < ucColX.length; ci++) {
      const text = (ucCellData[ci] || '').substring(0, 200);
      await createStickyNote(boardId, text, ucColX[ci], 360 + row * 260,
        uc ? 'light_blue' : 'light_yellow' as any, z8);
    }
  }

  frames.push({ frameId: z8, title: 'Zone 8: Use Case Consolidation', items: [] });

  // ══════════════════════════════════════════════════════════════════════════
  // ZONE 9 — Value–Feasibility Matrix
  // ══════════════════════════════════════════════════════════════════════════
  await appendLog(workspaceId, '[Stage 2] Zone 9/9: Value–Feasibility Matrix');
  const z9 = await createFrame(boardId, 'Zone 9: Value–Feasibility Matrix', COL[2], ROW[2]);
  await zoneHeader(boardId, z9, '🔶 Zone 9 — Value–Feasibility Matrix', 'Prioritize use cases: High Value/High Feasibility = 90-day bets', '#f59e0b');

  // Axis labels
  await createShape(boardId, '<p><strong>↑ HIGH VALUE</strong></p>', 'round_rectangle',
    FW / 2 - 200, 230, 400, 50, { fillColor: '#1a1a2e', fontSize: 13, color: '#ffffff' }, z9);
  await createShape(boardId, '<p><strong>↓ LOW VALUE</strong></p>', 'round_rectangle',
    FW / 2 - 200, 1850, 400, 50, { fillColor: '#e2e8f0', fontSize: 13, color: '#475569' }, z9);
  await createShape(boardId, '<p><strong>← LOW FEASIBILITY</strong></p>', 'round_rectangle',
    140, 1000, 300, 50, { fillColor: '#e2e8f0', fontSize: 11, color: '#475569' }, z9);
  await createShape(boardId, '<p><strong>HIGH FEASIBILITY →</strong></p>', 'round_rectangle',
    FW - 500, 1000, 300, 50, { fillColor: '#e2e8f0', fontSize: 11, color: '#475569' }, z9);

  // 4 quadrant areas
  const quadrants = [
    { label: '🚀 Quick Wins\n(High Value / High Feasibility)', color: '#059669', x: 1750, y: 350, w: 1400, h: 620 },
    { label: '⭐ Strategic Bets\n(High Value / Lower Feasibility)', color: '#7c3aed', x: 250, y: 350, w: 1400, h: 620 },
    { label: '🏗 Build Foundation\n(Necessary Enablers)', color: '#f59e0b', x: 1750, y: 1100, w: 1400, h: 620 },
    { label: '⏳ Evaluate Later\n(Lower Value / Lower Readiness)', color: '#94a3b8', x: 250, y: 1100, w: 1400, h: 620 },
  ];

  // Bucket predicted use cases into quadrants
  const quadrantBuckets: Record<string, string[]> = {
    quick_win: [], strategic_bet: [], foundation: [], evaluate_later: [],
  };
  if (predictions?.useCases) {
    for (const uc of predictions.useCases) {
      const key = uc.quadrant || 'evaluate_later';
      if (quadrantBuckets[key]) quadrantBuckets[key].push(`${uc.title}\n${uc.ootbAgent}`);
    }
  }

  const quadrantKeyMap: Record<string, string> = {
    '🚀 Quick Wins\n(High Value / High Feasibility)': 'quick_win',
    '⭐ Strategic Bets\n(High Value / Lower Feasibility)': 'strategic_bet',
    '🏗 Build Foundation\n(Necessary Enablers)': 'foundation',
    '⏳ Evaluate Later\n(Lower Value / Lower Readiness)': 'evaluate_later',
  };

  for (const q of quadrants) {
    await createShape(boardId, `<p><strong>${q.label}</strong></p>`, 'round_rectangle',
      q.x, q.y, q.w, 60, { fillColor: q.color, fontSize: 12, color: '#ffffff' }, z9);
    const bucketKey = quadrantKeyMap[q.label] || 'evaluate_later';
    const items = quadrantBuckets[bucketKey] || [];
    for (let i = 0; i < 3; i++) {
      const text = items[i] ? items[i].substring(0, 200) : '';
      await createStickyNote(boardId, text, q.x + i * 450, q.y + 80, 'light_yellow' as any, z9);
    }
  }

  frames.push({ frameId: z9, title: 'Zone 9: Value–Feasibility Matrix', items: [] });

  // ── Persist + return ──────────────────────────────────────────────────────
  const snapshot: MiroBoardSnapshot = { boardId, boardUrl, frames };

  await prisma.workspace.update({
    where: { workspaceId },
    data: {
      workshopPrepMiroId: boardId,
      workshopPrepMiroUrl: boardUrl,
      workshopPrepMiroSnapshot: JSON.stringify(snapshot),
      workshopPrepMiroStatus: 'completed',
      engagementStage: 'workshop_prep',
    },
  });

  await appendLog(workspaceId, `[Stage 2] Workshop prep Miro board complete — ${frames.length} zones created`);
  logger.info('[PrepMiro] Board generation complete', { workspaceId, boardId, boardUrl });
  return snapshot;
}
