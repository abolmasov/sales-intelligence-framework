import { randomUUID } from 'crypto';
import axios from 'axios';
import { getPrismaClient } from '../config/database';
import { getLoggerService } from './logger.service';
import { getOpenAIService } from './openai.service';
import { generatePPTXBuffer } from './pptxGeneration.service';
import { uploadPptxToS3, isPptxStorageConfigured } from './pptxStorage.service';
import { TemplateManagerService } from './templateManager.service';
import { WORKSHOP_ANALYSIS_PROMPT } from '../prompts/workshop-analysis';
import { USER_STORY_GENERATION_PROMPT } from '../prompts/user-story-generation';
import { WORKSHOP_PREP_PROMPT } from '../prompts/workshop-prep';
import { getResearchService } from './research.service';
import type {
  WorkshopAnalysisResult, UserStoryMapResult, WorkshopPrepResult,
  MiroBoardSnapshot, MiroFrame, MiroItem,
  WorkspaceType, WorkspaceSourceDocument,
} from '../../../shared/types/workspace';

const prisma = getPrismaClient();
const logger = getLoggerService();

function safeJsonParse<T = any>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

// ---------------------------------------------------------------------------
// Pipeline log helper — appends timestamped entries to workspace.pipelineLog
// ---------------------------------------------------------------------------

async function appendLog(workspaceId: string, message: string): Promise<void> {
  try {
    const ts = new Date().toISOString();
    const entry = `[${ts}] ${message}`;
    const ws = await prisma.workspace.findUnique({
      where: { workspaceId },
      select: { pipelineLog: true },
    });
    const existing = ws?.pipelineLog || '';
    await prisma.workspace.update({
      where: { workspaceId },
      data: { pipelineLog: existing ? `${existing}\n${entry}` : entry },
    });
  } catch (err) {
    logger.warn('[Workspace] appendLog failed (non-fatal)', { workspaceId, err });
  }
}

// ---------------------------------------------------------------------------
// Cancellation helper
// ---------------------------------------------------------------------------

class CancellationError extends Error {
  constructor() {
    super('Workspace pipeline was cancelled');
    this.name = 'CancellationError';
  }
}

async function assertNotCancelled(workspaceId: string): Promise<void> {
  const ws = await prisma.workspace.findUnique({
    where: { workspaceId },
    select: { status: true },
  });
  if (ws?.status === 'cancelled') throw new CancellationError();
}

// ---------------------------------------------------------------------------
// Pipeline orchestrator
// ---------------------------------------------------------------------------

export async function processWorkspacePipeline(
  workspaceId: string,
  options: { runAnalysis: boolean; runMiro: boolean; runPptx: boolean },
): Promise<void> {
  try {
    // Clear previous logs on fresh run
    await prisma.workspace.update({ where: { workspaceId }, data: { pipelineLog: null } });
    await appendLog(workspaceId, 'Pipeline started');

    // Read workspace type to determine pipeline strategy
    const wsType = await prisma.workspace.findUnique({
      where: { workspaceId },
      select: { workspaceType: true },
    });
    const workspaceType = (wsType?.workspaceType || 'workshop_analysis') as WorkspaceType;
    const isUserStory = workspaceType === 'user_story_generation';
    const isWorkshopPrep = workspaceType === 'workshop_prep';

    const modeLabel = isWorkshopPrep ? 'Workshop Preparation' : isUserStory ? 'User Story Generation' : 'Workshop Analysis';
    await appendLog(workspaceId, `  Mode: ${modeLabel}`);

    let analysis: WorkshopAnalysisResult | UserStoryMapResult | WorkshopPrepResult | null = null;

    // Stage 1: Analysis (type-specific)
    if (options.runAnalysis) {
      await assertNotCancelled(workspaceId);
      if (isWorkshopPrep) {
        await appendLog(workspaceId, 'Stage 1/3: Starting workshop preparation analysis...');
        analysis = await runWorkshopPrepAnalysis(workspaceId);
        await appendLog(workspaceId, `Stage 1/3: Analysis complete — ${(analysis as WorkshopPrepResult).agenda?.length ?? 0} sessions, ${(analysis as WorkshopPrepResult).surveyInsights?.length ?? 0} survey insights`);
      } else if (isUserStory) {
        await appendLog(workspaceId, 'Stage 1/3: Starting user story extraction...');
        analysis = await runUserStoryAnalysis(workspaceId);
        const storyCount = (analysis as UserStoryMapResult).backbone.reduce(
          (sum, act) => sum + act.steps.reduce((s, step) => s + step.stories.length, 0), 0
        );
        await appendLog(workspaceId, `Stage 1/3: Analysis complete — ${(analysis as UserStoryMapResult).backbone.length} epics, ${storyCount} user stories`);
      } else {
        await appendLog(workspaceId, 'Stage 1/3: Starting transcript analysis...');
        analysis = await runWorkshopAnalysis(workspaceId);
        await appendLog(workspaceId, `Stage 1/3: Analysis complete — ${(analysis as WorkshopAnalysisResult).clientNeeds?.length ?? 0} client needs, ${(analysis as WorkshopAnalysisResult).actionItems?.length ?? 0} action items identified`);
      }
    } else {
      await appendLog(workspaceId, 'Stage 1/3: Skipped (using existing analysis)');
      const ws = await prisma.workspace.findUnique({
        where: { workspaceId },
        select: { analysisResult: true },
      });
      if (ws?.analysisResult) {
        try {
          analysis = JSON.parse(ws.analysisResult) as WorkshopAnalysisResult | UserStoryMapResult | WorkshopPrepResult;
        } catch {
          throw new Error('Failed to parse existing analysis result — data may be corrupted.');
        }
      }
    }

    if (!analysis) {
      throw new Error('No analysis result available. Run analysis first.');
    }

    // Stage 2: Miro board (type-specific)
    if (options.runMiro) {
      await assertNotCancelled(workspaceId);
      await appendLog(workspaceId, 'Stage 2/3: Creating Miro board...');
      try {
        let snapshot: MiroBoardSnapshot;
        if (isWorkshopPrep) {
          snapshot = await runWorkshopPrepMiroBoardGeneration(workspaceId, analysis as WorkshopPrepResult);
        } else if (isUserStory) {
          snapshot = await runStoryMapMiroBoardGeneration(workspaceId, analysis as UserStoryMapResult);
        } else {
          snapshot = await runMiroBoardGeneration(workspaceId, analysis as WorkshopAnalysisResult);
        }
        await appendLog(workspaceId, `Stage 2/3: Miro board created — ${snapshot.frames.length} frames, board URL: ${snapshot.boardUrl}`);
      } catch (miroErr: any) {
        logger.warn(`[Workspace] Miro stage skipped: ${miroErr.message}`, { workspaceId });
        await appendLog(workspaceId, `Stage 2/3: Miro skipped — ${miroErr.message}`);
        await prisma.workspace.update({
          where: { workspaceId },
          data: { miroStatus: 'skipped', errorMessage: `Miro skipped: ${miroErr.message}` },
        });
      }
    } else {
      await appendLog(workspaceId, 'Stage 2/3: Miro board generation skipped');
    }

    // Stage 3: PPTX generation (type-specific)
    if (options.runPptx) {
      await assertNotCancelled(workspaceId);
      await appendLog(workspaceId, 'Stage 3/3: Generating PowerPoint deck...');
      if (isWorkshopPrep) {
        await runWorkshopPrepPptxGeneration(workspaceId, analysis as WorkshopPrepResult);
      } else if (isUserStory) {
        await runUserStoryPptxGeneration(workspaceId, analysis as UserStoryMapResult);
      } else {
        await runPptxGeneration(workspaceId, analysis as WorkshopAnalysisResult);
      }
      await appendLog(workspaceId, 'Stage 3/3: PowerPoint deck generated successfully');
    } else {
      await appendLog(workspaceId, 'Stage 3/3: PPTX generation skipped');
    }

    // Mark completed
    await appendLog(workspaceId, 'Pipeline completed successfully');
    await prisma.workspace.update({
      where: { workspaceId },
      data: { status: 'completed', completedAt: new Date() },
    });

    logger.info('[Workspace] Pipeline completed', { workspaceId });
  } catch (err: any) {
    if (err instanceof CancellationError) {
      await appendLog(workspaceId, 'Pipeline cancelled by user');
      logger.info('[Workspace] Pipeline cancelled', { workspaceId });
      return;
    }

    await appendLog(workspaceId, `Pipeline failed: ${err.message}`);
    logger.error('[Workspace] Pipeline failed', err, { workspaceId });
    await prisma.workspace.update({
      where: { workspaceId },
      data: {
        status: 'error',
        errorMessage: err.message || 'Unknown error',
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Stage 1: Workshop Analysis
// ---------------------------------------------------------------------------

async function runWorkshopAnalysis(workspaceId: string): Promise<WorkshopAnalysisResult> {
  await prisma.workspace.update({
    where: { workspaceId },
    data: { status: 'analyzing', analysisStatus: 'running' },
  });

  const ws = await prisma.workspace.findUniqueOrThrow({
    where: { workspaceId },
    select: { transcriptText: true, clientName: true, workshopDate: true },
  });

  if (!ws.transcriptText) {
    throw new Error('No transcript text found for this workspace');
  }

  const wordCount = ws.transcriptText.split(/\s+/).length;
  const charCount = ws.transcriptText.length;
  await appendLog(workspaceId, `  Transcript loaded: ${wordCount.toLocaleString()} words, ${charCount.toLocaleString()} characters`);
  await appendLog(workspaceId, `  Client: ${ws.clientName || '(not specified)'}`);

  const openai = getOpenAIService();

  const userMessage = [
    ws.clientName ? `Client: ${ws.clientName}` : '',
    ws.workshopDate ? `Date: ${ws.workshopDate.toISOString().slice(0, 10)}` : '',
    '',
    '--- TRANSCRIPT ---',
    ws.transcriptText,
  ]
    .filter(Boolean)
    .join('\n');

  await appendLog(workspaceId, `  Sending to GPT-4o for structured analysis (est. ${Math.round(charCount / 4).toLocaleString()} tokens)...`);

  const result = await openai.generateStructuredCompletion<WorkshopAnalysisResult>(
    [
      { role: 'system', content: WORKSHOP_ANALYSIS_PROMPT },
      { role: 'user', content: userMessage },
    ],
    undefined,
    0.6,
  );

  await prisma.workspace.update({
    where: { workspaceId },
    data: {
      analysisStatus: 'completed',
      analysisResult: JSON.stringify(result),
    },
  });

  // Log what was extracted
  await appendLog(workspaceId, `  Analysis results:`);
  await appendLog(workspaceId, `    - Workshop: ${result.workshopOverview?.title || 'Untitled'}`);
  await appendLog(workspaceId, `    - Participants: ${result.workshopOverview?.participants?.length ?? 0}`);
  await appendLog(workspaceId, `    - Client needs: ${result.clientNeeds?.length ?? 0}`);
  await appendLog(workspaceId, `    - Solutions presented: ${result.solutionsPresented?.length ?? 0}`);
  await appendLog(workspaceId, `    - Tech recommendations: ${result.technologyRecommendations?.length ?? 0}`);
  await appendLog(workspaceId, `    - Action items: ${result.actionItems?.length ?? 0}`);
  await appendLog(workspaceId, `    - Workshop flow segments: ${result.workshopFlow?.length ?? 0}`);
  await appendLog(workspaceId, `    - Roadmap phases: ${result.roadmap?.length ?? 0}`);

  return result;
}

// ---------------------------------------------------------------------------
// Stage 2: Miro Board Generation
// ---------------------------------------------------------------------------

const MIRO_API_BASE = 'https://api.miro.com/v2';

function getMiroToken(): string {
  const token = process.env.MIRO_API_TOKEN;
  if (!token) throw new Error('MIRO_API_TOKEN is not configured');
  return token;
}

function miroHeaders() {
  return {
    Authorization: `Bearer ${getMiroToken()}`,
    'Content-Type': 'application/json',
  };
}

async function runMiroBoardGeneration(
  workspaceId: string,
  analysis: WorkshopAnalysisResult,
): Promise<MiroBoardSnapshot> {
  await prisma.workspace.update({
    where: { workspaceId },
    data: { status: 'miro_generating', miroStatus: 'running' },
  });

  const ws = await prisma.workspace.findUniqueOrThrow({
    where: { workspaceId },
    select: { clientName: true },
  });

  logger.info('[Workspace] Creating Miro board', { workspaceId });

  const boardName = `${ws.clientName || 'Workshop'} - ${analysis.workshopOverview?.title || 'Summary'}`
    .replace(/[\n\r]/g, ' ')
    .substring(0, 60);
  const boardDesc = (analysis.summary || 'Workshop analysis board')
    .replace(/[\n\r]/g, ' ')
    .substring(0, 300);

  let boardRes: any;
  try {
    boardRes = await axios.post(
      `${MIRO_API_BASE}/boards`,
      { name: boardName, description: boardDesc },
      { headers: miroHeaders() },
    );
  } catch (err: any) {
    const respData = err.response?.data ? JSON.stringify(err.response.data) : 'no response body';
    logger.error('[Workspace] Miro board creation failed', { workspaceId, status: err.response?.status, respData });
    throw new Error(`Miro board creation failed (${err.response?.status}): ${respData}`);
  }

  const boardId = boardRes.data.id;
  const boardUrl = boardRes.data.viewLink || `https://miro.com/app/board/${boardId}/`;

  await appendLog(workspaceId, `  Board created: ${boardName}`);
  await appendLog(workspaceId, `  Board URL: ${boardUrl}`);

  const frames: MiroFrame[] = [];
  const hdrs = { headers: miroHeaders() };
  const api = (path: string) => `${MIRO_API_BASE}/boards/${boardId}/${path}`;

  // --- Rich widget helpers ---
  async function createFrame(
    title: string, x: number, y: number, width = 2000, height = 1500,
  ): Promise<string> {
    const res = await axios.post(api('frames'), {
      data: { title, format: 'custom', type: 'freeform' },
      position: { x, y }, geometry: { width, height },
    }, hdrs);
    return res.data.id;
  }

  async function createShape(
    content: string, shape: string, x: number, y: number,
    width: number, height: number,
    style: Record<string, any> = {}, parentFrameId?: string,
  ): Promise<string> {
    try {
      const merged = { fillColor: '#4262ff', fillOpacity: '1.0', fontSize: '14', textAlign: 'center', textAlignVertical: 'middle', color: '#ffffff', ...style };
      if (typeof merged.fontSize === 'number') merged.fontSize = String(merged.fontSize);
      const res = await axios.post(api('shapes'), {
        data: { content: content.substring(0, 500), shape },
        style: merged,
        geometry: { width, height },
        position: { x, y },
        ...(parentFrameId ? { parent: { id: parentFrameId } } : {}),
      }, hdrs);
      return res.data.id;
    } catch (err: any) {
      logger.warn('[Miro] createShape failed', { shape, err: err.response?.data || err.message });
      return '';
    }
  }

  async function createCard(
    title: string, description: string, x: number, y: number,
    opts: { cardTheme?: string; width?: number; parentFrameId?: string } = {},
  ): Promise<string> {
    try {
      const res = await axios.post(api('cards'), {
        data: { title: title.substring(0, 200), description: description.substring(0, 2000) },
        style: { cardTheme: opts.cardTheme || '#2d9bf0' },
        geometry: { width: opts.width || 320 },
        position: { x, y },
        ...(opts.parentFrameId ? { parent: { id: opts.parentFrameId } } : {}),
      }, hdrs);
      return res.data.id;
    } catch (err: any) {
      logger.warn('[Miro] createCard failed', { title, err: err.response?.data || err.message });
      return '';
    }
  }

  async function createText(
    content: string, x: number, y: number,
    opts: { fontSize?: number | string; color?: string; width?: number; parentFrameId?: string } = {},
  ): Promise<string> {
    try {
      const res = await axios.post(api('texts'), {
        data: { content: content.substring(0, 500) },
        style: { fontSize: String(opts.fontSize || 18), color: opts.color || '#1a1a2e', textAlign: 'left' },
        geometry: { width: opts.width || 400 },
        position: { x, y },
        ...(opts.parentFrameId ? { parent: { id: opts.parentFrameId } } : {}),
      }, hdrs);
      return res.data.id;
    } catch (err: any) {
      logger.warn('[Miro] createText failed', { err: err.response?.data || err.message });
      return '';
    }
  }

  async function createConnector(startId: string, endId: string, style: Record<string, any> = {}): Promise<void> {
    if (!startId || !endId) return; // Skip if either item failed to create
    try {
      const merged = { strokeColor: '#B0B0B0', strokeWidth: '2', ...style };
      if (typeof merged.strokeWidth === 'number') merged.strokeWidth = String(merged.strokeWidth);
      await axios.post(api('connectors'), {
        startItem: { id: startId, snapTo: 'auto' },
        endItem: { id: endId, snapTo: 'auto' },
        style: merged,
        shape: 'curved',
      }, hdrs);
    } catch {
      // Connectors can fail if items are in different frames — non-critical
    }
  }

  async function createStickyNote(
    content: string, x: number, y: number, color = 'light_yellow', parentFrameId?: string,
  ): Promise<string> {
    try {
      const res = await axios.post(api('sticky_notes'), {
        data: { content: content.substring(0, 500), shape: 'square' },
        style: { fillColor: color },
        position: { x, y },
        ...(parentFrameId ? { parent: { id: parentFrameId } } : {}),
      }, hdrs);
      return res.data.id;
    } catch (err: any) {
      logger.warn('[Miro] createStickyNote failed', { err: err.response?.data || err.message });
      return '';
    }
  }

  // =========================================================================
  // Layout: 3 columns × 3 rows of frames, each 3200×1800, 400px gap
  // Col offsets: 0, 3600, 7200   Row offsets: 0, 2200, 4400, 6600
  // Frame map:
  //   [0,0] Key Findings       [3600,0] Persona Deep Dives    [7200,0] Solution Catalog
  //   [0,2200] Workshop Flow   [3600,2200] Architecture       [7200,2200] Roadmap
  //   [0,4400] Action Items    [3600,4400] Readiness & KPIs   [7200,4400] Collab Space
  // =========================================================================

  const COL = [0, 3600, 7200];
  const ROW = [0, 2200, 4400, 6600];
  const FW = 3200;
  const FH = 1800;

  // =========================================================================
  // FRAME 1: Key Findings — cross-cutting themes + pain→solution mapping
  // =========================================================================
  await appendLog(workspaceId, `  Creating frame 1/9: Key Findings`);
  const f1Id = await createFrame('Key Findings', COL[0], ROW[0], FW, FH);
  const f1Items: MiroItem[] = [];

  await createShape(
    `<p><strong>Key Findings</strong></p>`,
    'round_rectangle', FW / 2, 60, FW - 200, 70,
    { fillColor: '#1a1a2e', fontSize: 18, color: '#ffffff' }, f1Id,
  );

  // Cross-cutting themes
  const themes = analysis.crossCuttingThemes || [];
  await createText('<p><strong>Cross-Cutting Themes</strong></p>', 200, 170,
    { fontSize: 14, color: '#0891b2', width: 400, parentFrameId: f1Id });
  for (let i = 0; i < Math.min(themes.length, 4); i++) {
    const t = themes[i];
    const tx = 200 + (i % 2) * 1450;
    const ty = 270 + Math.floor(i / 2) * 380;
    await createCard(
      t.theme.substring(0, 80),
      `<p>${t.whyItMatters}</p>${t.evidence.slice(0, 2).map((e) => `<p>• ${e.substring(0, 120)}</p>`).join('')}${t.quote ? `<p><em>"${t.quote.substring(0, 120)}"</em></p>` : ''}`,
      tx, ty, { cardTheme: '#0891b2', width: 1300, parentFrameId: f1Id },
    );
    f1Items.push({ type: 'card', content: t.theme, color: '#0891b2', position: { x: tx, y: ty } });
  }

  // Pain→Solution mapping strip
  await createText('<p><strong>Pain → Solution Mapping</strong></p>', 200, 1120,
    { fontSize: 13, color: '#7c3aed', width: 400, parentFrameId: f1Id });
  const topNeeds = (analysis.clientNeeds || []).slice(0, 5);
  for (let i = 0; i < topNeeds.length; i++) {
    const need = topNeeds[i];
    const nx = 200 + i * 570;
    const needColor = need.priority === 'high' ? '#ef4444' : need.priority === 'medium' ? '#f59e0b' : '#22c55e';
    await createShape(
      `<p><strong>${need.need.substring(0, 70)}</strong></p><p>[${(need.priority || 'medium').toUpperCase()}]</p>`,
      'round_rectangle', nx, 1200, 500, 80,
      { fillColor: needColor, fontSize: 11, color: '#ffffff' }, f1Id,
    );
    if (need.mappedSolution) {
      await createShape(
        `<p>${need.mappedSolution.substring(0, 80)}</p>`,
        'round_rectangle', nx, 1430, 500, 60,
        { fillColor: '#059669', fontSize: 11, color: '#ffffff' }, f1Id,
      );
    }
  }

  frames.push({ frameId: f1Id, title: 'Key Findings', items: f1Items });

  // =========================================================================
  // FRAME 2: Persona Deep Dives
  // =========================================================================
  await appendLog(workspaceId, `  Creating frame 2/9: Persona Deep Dives`);
  const f2Id = await createFrame('Persona Deep Dives', COL[1], ROW[0], FW, FH);
  const f2Items: MiroItem[] = [];

  await createShape(
    `<p><strong>Persona Deep Dives</strong></p>`,
    'round_rectangle', FW / 2, 60, FW - 200, 70,
    { fillColor: '#1a1a2e', fontSize: 18, color: '#ffffff' }, f2Id,
  );

  const personas = analysis.personas || [];
  const personaColors = ['#0891b2', '#7c3aed', '#059669', '#f59e0b', '#ef4444', '#ec4899'];
  for (let i = 0; i < Math.min(personas.length, 3); i++) {
    const p = personas[i];
    const px = 200 + i * 950;
    const pColor = personaColors[i % personaColors.length];

    // Persona header
    await createShape(
      `<p><strong>${p.name}</strong></p><p>${p.description.substring(0, 80)}</p>`,
      'round_rectangle', px, 180, 850, 110,
      { fillColor: pColor, fontSize: 12, color: '#ffffff' }, f2Id,
    );

    // Pain points
    const painHtml = p.painPoints.slice(0, 3).map((pp) => `<p>• ${pp.substring(0, 110)}</p>`).join('');
    await createCard('Pain Points', painHtml, px, 400, { cardTheme: '#ef4444', width: 850, parentFrameId: f2Id });

    // AI Solutions
    const solHtml = p.aiSolutions.slice(0, 3).map((s) => `<p>• ${s.substring(0, 110)}</p>`).join('');
    await createCard('AI Solutions', solHtml, px, 700, { cardTheme: pColor, width: 850, parentFrameId: f2Id });

    // Quote + Implication
    if (p.quote) {
      await createStickyNote(`"${p.quote.substring(0, 300)}"`, px, 1050, 'light_yellow', f2Id);
    }
    await createText(`<p><em>${p.implication.substring(0, 200)}</em></p>`, px, 1380,
      { fontSize: 11, color: '#64748b', width: 850, parentFrameId: f2Id });

    f2Items.push({ type: 'shape', content: p.name, color: pColor, position: { x: px, y: 180 } });
  }

  frames.push({ frameId: f2Id, title: 'Persona Deep Dives', items: f2Items });

  // =========================================================================
  // FRAME 3: Solution Catalog + Value vs. Feasibility Matrix
  // =========================================================================
  await appendLog(workspaceId, `  Creating frame 3/9: Solution Catalog`);
  const f3Id = await createFrame('Solution Catalog & Prioritization', COL[2], ROW[0], FW, FH);
  const f3Items: MiroItem[] = [];

  await createShape(
    `<p><strong>Solution Catalog & Prioritization</strong></p>`,
    'round_rectangle', FW / 2, 60, FW - 200, 70,
    { fillColor: '#1a1a2e', fontSize: 18, color: '#ffffff' }, f3Id,
  );

  const catalog = analysis.solutionCatalog || [];
  const priorityColors: Record<string, string> = {
    quick_win: '#059669',
    high_value: '#0891b2',
    build_foundation: '#7c3aed',
    strategic_bet: '#f59e0b',
    evaluate_later: '#94a3b8',
  };
  for (let i = 0; i < Math.min(catalog.length, 8); i++) {
    const item = catalog[i];
    const col3 = 200 + (i % 2) * 1450;
    const row3 = 180 + Math.floor(i / 2) * 330;
    const pColor3 = priorityColors[item.priority] || '#64748b';

    await createCard(
      `${item.aiSolution.substring(0, 70)} [${item.priority.replace(/_/g, ' ').toUpperCase()}]`,
      `<p><strong>Problem:</strong> ${item.problem.substring(0, 100)}</p><p><strong>Driver:</strong> ${item.valueDriver} | <strong>Feasibility:</strong> ${item.feasibility}${item.isCrossFunctional ? ' | Cross-functional' : ''}</p>`,
      col3, row3, { cardTheme: pColor3, width: 1300, parentFrameId: f3Id },
    );
    f3Items.push({ type: 'card', content: item.aiSolution, color: pColor3, position: { x: col3, y: row3 } });
  }

  // Priority legend
  const legendY = 1560;
  let lx = 200;
  for (const [label, lColor] of Object.entries(priorityColors)) {
    await createShape(
      `<p>${label.replace(/_/g, ' ')}</p>`,
      'round_rectangle', lx, legendY, 500, 40,
      { fillColor: lColor, fontSize: 10, color: '#ffffff' }, f3Id,
    );
    lx += 540;
  }

  frames.push({ frameId: f3Id, title: 'Solution Catalog & Prioritization', items: f3Items });

  // =========================================================================
  // FRAME 4: Workshop Flow
  // =========================================================================
  await appendLog(workspaceId, `  Creating frame 4/9: Workshop Flow`);
  const f4Id = await createFrame('Workshop Flow', COL[0], ROW[1], FW, FH);
  const f4Items: MiroItem[] = [];
  const segCount4 = analysis.workshopFlow?.length ?? 0;

  await createShape(
    `<p><strong>Workshop Flow — ${analysis.workshopOverview?.duration || 'Full Session'}</strong></p>`,
    'round_rectangle', FW / 2, 60, FW - 200, 70,
    { fillColor: '#1a1a2e', fontSize: 18, color: '#ffffff' }, f4Id,
  );

  const segIds4: string[] = [];
  const segSpacing = segCount4 > 0 ? Math.min(700, Math.floor((FW - 400) / segCount4)) : 700;
  for (let i = 0; i < segCount4; i++) {
    const seg = analysis.workshopFlow[i];
    const sx = 250 + i * segSpacing;

    const segId4 = await createShape(
      `<p><strong>${seg.segment}</strong></p><p>${seg.topic.substring(0, 60)}</p>${seg.duration ? `<p>${seg.duration}</p>` : ''}`,
      'round_rectangle', sx, 260, Math.min(segSpacing - 50, 620), 110,
      { fillColor: '#0891b2', fontSize: 12, color: '#ffffff' }, f4Id,
    );
    segIds4.push(segId4);

    const pointsHtml4 = seg.keyPoints.slice(0, 4).map((p) => `<p>• ${p.substring(0, 100)}</p>`).join('');
    await createCard('Key Points', pointsHtml4, sx, 490,
      { cardTheme: '#0891b2', width: Math.min(segSpacing - 50, 620), parentFrameId: f4Id });

    if (seg.decisions?.length) {
      await createStickyNote(`✅ ${seg.decisions[0].substring(0, 200)}`, sx, 900, 'light_green', f4Id);
    }
    if (seg.tensions?.length) {
      await createStickyNote(`⚠️ ${seg.tensions[0].substring(0, 200)}`, sx, 1160, 'light_pink', f4Id);
    }
    f4Items.push({ type: 'shape', content: seg.segment, color: '#0891b2', position: { x: sx, y: 260 } });
  }

  for (let i = 0; i < segIds4.length - 1; i++) {
    await createConnector(segIds4[i], segIds4[i + 1], { strokeColor: '#0891b2', strokeWidth: 3 });
  }

  await createText('Decisions', 80, 900, { fontSize: 12, color: '#059669', width: 140, parentFrameId: f4Id });
  await createText('Tensions', 80, 1160, { fontSize: 12, color: '#e11d48', width: 140, parentFrameId: f4Id });

  frames.push({ frameId: f4Id, title: 'Workshop Flow', items: f4Items });

  // =========================================================================
  // FRAME 5: Solution Architecture
  // =========================================================================
  await appendLog(workspaceId, `  Creating frame 5/9: Solution Architecture`);
  const f5Id = await createFrame('Solution & Implementation Architecture', COL[1], ROW[1], FW, FH);
  const f5Items: MiroItem[] = [];

  await createShape(
    `<p><strong>Solution & Implementation Architecture</strong></p>`,
    'round_rectangle', FW / 2, 60, FW - 200, 70,
    { fillColor: '#1a1a2e', fontSize: 18, color: '#ffffff' }, f5Id,
  );

  // Architecture layers
  const archLayers = [
    { label: 'Channels', color: '#0891b2', y: 180 },
    { label: 'Conversational AI / GenAI', color: '#7c3aed', y: 440 },
    { label: 'Platform & Workflow', color: '#059669', y: 700 },
    { label: 'Data & Integration', color: '#f59e0b', y: 960 },
    { label: 'Governance & Analytics', color: '#ef4444', y: 1220 },
  ];

  for (const layer of archLayers) {
    await createShape(
      `<p><strong>${layer.label}</strong></p>`,
      'round_rectangle', 250, layer.y, 2600, 80,
      { fillColor: layer.color, fontSize: 13, color: '#ffffff' }, f5Id,
    );
    f5Items.push({ type: 'shape', content: layer.label, color: layer.color, position: { x: 250, y: layer.y } });
  }

  // Top solutions presented
  const topSols = (analysis.solutionsPresented || []).slice(0, 3);
  for (let i = 0; i < topSols.length; i++) {
    const sol = topSols[i];
    const sx5 = 250 + i * 950;
    const reactionColor = sol.clientReaction === 'positive' ? '#059669' : sol.clientReaction === 'skeptical' ? '#f59e0b' : '#64748b';
    await createCard(
      sol.solution.substring(0, 70),
      `<p>${sol.description.substring(0, 150)}</p><p><strong>Reaction:</strong> ${sol.clientReaction || 'neutral'}</p>`,
      sx5, 1450, { cardTheme: reactionColor, width: 850, parentFrameId: f5Id },
    );
  }

  frames.push({ frameId: f5Id, title: 'Solution Architecture', items: f5Items });

  // =========================================================================
  // FRAME 6: Implementation Roadmap
  // =========================================================================
  await appendLog(workspaceId, `  Creating frame 6/9: Implementation Roadmap`);
  const f6Id = await createFrame('Implementation Roadmap', COL[2], ROW[1], FW, FH);
  const f6Items: MiroItem[] = [];
  const phaseCount6 = analysis.roadmap?.length ?? 0;
  const phaseColors6 = ['#0891b2', '#7c3aed', '#059669', '#f59e0b', '#ef4444'];

  await createShape(
    `<p><strong>Implementation Roadmap</strong></p>`,
    'round_rectangle', FW / 2, 60, FW - 200, 70,
    { fillColor: '#1a1a2e', fontSize: 18, color: '#ffffff' }, f6Id,
  );

  const phaseIds6: string[] = [];
  const phaseSpacing6 = phaseCount6 > 0 ? Math.min(900, Math.floor((FW - 300) / phaseCount6)) : 900;
  for (let i = 0; i < phaseCount6; i++) {
    const phase = analysis.roadmap[i];
    const px6 = 200 + i * phaseSpacing6;
    const pColor6 = phaseColors6[i % phaseColors6.length];

    const pId6 = await createShape(
      `<p><strong>${phase.phase}</strong></p><p>${phase.duration}</p>`,
      'round_rectangle', px6, 220, phaseSpacing6 - 60, 110,
      { fillColor: pColor6, fontSize: 13, color: '#ffffff' }, f6Id,
    );
    phaseIds6.push(pId6);

    const goalsHtml6 = phase.goals.slice(0, 4).map((g) => `<p>• ${g.substring(0, 90)}</p>`).join('');
    await createCard('Goals', goalsHtml6, px6, 450,
      { cardTheme: pColor6, width: phaseSpacing6 - 80, parentFrameId: f6Id });

    const delHtml6 = phase.deliverables.slice(0, 4).map((d) => `<p>• ${d.substring(0, 90)}</p>`).join('');
    await createCard('Deliverables', delHtml6, px6, 800,
      { cardTheme: pColor6, width: phaseSpacing6 - 80, parentFrameId: f6Id });

    if (phase.risks?.length) {
      await createStickyNote(`Risk: ${phase.risks[0].substring(0, 200)}`, px6, 1150, 'light_pink', f6Id);
    }
    if (phase.successCriteria?.length) {
      await createStickyNote(`✅ ${phase.successCriteria[0].substring(0, 200)}`, px6, 1400, 'light_green', f6Id);
    }
    f6Items.push({ type: 'shape', content: phase.phase, color: pColor6, position: { x: px6, y: 220 } });
  }

  for (let i = 0; i < phaseIds6.length - 1; i++) {
    await createConnector(phaseIds6[i], phaseIds6[i + 1], { strokeColor: '#1a1a2e', strokeWidth: 3 });
  }

  frames.push({ frameId: f6Id, title: 'Implementation Roadmap', items: f6Items });

  // =========================================================================
  // FRAME 7: Action Items & Key Decisions
  // =========================================================================
  const aiCount7 = analysis.actionItems?.length ?? 0;
  const kdCount7 = analysis.keyDecisions?.length ?? 0;
  await appendLog(workspaceId, `  Creating frame 7/9: Action Items & Decisions (${aiCount7} actions, ${kdCount7} decisions)`);
  const f7Id = await createFrame('Action Items & Key Decisions', COL[0], ROW[2], FW, FH);
  const f7Items: MiroItem[] = [];

  await createShape(
    `<p><strong>Action Items & Key Decisions</strong></p>`,
    'round_rectangle', FW / 2, 60, FW - 200, 70,
    { fillColor: '#1a1a2e', fontSize: 18, color: '#ffffff' }, f7Id,
  );

  await createText('<p><strong>Key Decisions</strong></p>', 200, 160,
    { fontSize: 14, color: '#7c3aed', width: 300, parentFrameId: f7Id });
  for (let i = 0; i < Math.min(kdCount7, 6); i++) {
    const kd = analysis.keyDecisions[i];
    const kx = 200 + (i % 3) * 960;
    const ky = 250 + Math.floor(i / 3) * 280;
    await createCard(
      kd.decision.substring(0, 80),
      `<p><strong>By:</strong> ${kd.madeBy}</p>${kd.rationale ? `<p>${kd.rationale.substring(0, 120)}</p>` : ''}<p><strong>Impact:</strong> ${kd.impact.substring(0, 100)}</p>`,
      kx, ky, { cardTheme: '#7c3aed', width: 880, parentFrameId: f7Id },
    );
  }

  const aiYStart7 = 250 + Math.ceil(Math.min(kdCount7, 6) / 3) * 280 + 100;
  await createText('<p><strong>Action Items</strong></p>', 200, aiYStart7,
    { fontSize: 14, color: '#059669', width: 300, parentFrameId: f7Id });
  for (let i = 0; i < Math.min(aiCount7, 6); i++) {
    const ai = analysis.actionItems[i];
    const ax = 200 + (i % 3) * 960;
    const ay = aiYStart7 + 90 + Math.floor(i / 3) * 260;
    const prioColor7 = ai.priority === 'high' ? '#ef4444' : ai.priority === 'medium' ? '#f59e0b' : '#22c55e';
    await createCard(
      `${ai.action.substring(0, 80)}`,
      `<p><strong>Owner:</strong> ${ai.owner || 'TBD'} | <strong>Priority:</strong> ${(ai.priority || 'medium').toUpperCase()}</p>${ai.dueDate ? `<p><strong>Due:</strong> ${ai.dueDate}</p>` : ''}${ai.dependsOn ? `<p><em>Depends: ${ai.dependsOn.substring(0, 80)}</em></p>` : ''}`,
      ax, ay, { cardTheme: prioColor7, width: 880, parentFrameId: f7Id },
    );
    f7Items.push({ type: 'card', content: ai.action, color: prioColor7, position: { x: ax, y: ay } });
  }

  frames.push({ frameId: f7Id, title: 'Action Items & Key Decisions', items: f7Items });

  // =========================================================================
  // FRAME 8: Readiness & KPIs
  // =========================================================================
  await appendLog(workspaceId, `  Creating frame 8/9: Readiness & KPIs`);
  const f8Id = await createFrame('Readiness & KPIs', COL[1], ROW[2], FW, FH);
  const f8Items: MiroItem[] = [];

  await createShape(
    `<p><strong>Readiness Assessment & KPIs</strong></p>`,
    'round_rectangle', FW / 2, 60, FW - 200, 70,
    { fillColor: '#1a1a2e', fontSize: 18, color: '#ffffff' }, f8Id,
  );

  // Readiness dimensions
  const readiness = analysis.readinessAssessment || [];
  const readinessColors: Record<string, string> = { ready: '#059669', partial: '#f59e0b', not_ready: '#ef4444' };
  await createText('<p><strong>Readiness Framework</strong></p>', 200, 160,
    { fontSize: 14, color: '#0891b2', width: 400, parentFrameId: f8Id });
  for (let i = 0; i < Math.min(readiness.length, 5); i++) {
    const dim = readiness[i];
    const rColor = readinessColors[dim.readinessLevel] || '#64748b';
    const rx = 200 + i * 580;
    await createShape(
      `<p><strong>${dim.dimension.toUpperCase()}</strong></p><p>${dim.readinessLevel.replace(/_/g, ' ')}</p>`,
      'round_rectangle', rx, 240, 520, 80,
      { fillColor: rColor, fontSize: 12, color: '#ffffff' }, f8Id,
    );
    await createCard(
      'Gap & Workstreams',
      `<p><strong>Current:</strong> ${dim.currentState.substring(0, 80)}</p><p><strong>Target:</strong> ${dim.targetState.substring(0, 80)}</p>${dim.keyWorkstreams.slice(0, 2).map((w) => `<p>• ${w.substring(0, 80)}</p>`).join('')}`,
      rx, 420, { cardTheme: rColor, width: 520, parentFrameId: f8Id },
    );
    f8Items.push({ type: 'shape', content: dim.dimension, color: rColor, position: { x: rx, y: 240 } });
  }

  // KPIs
  const kpis = analysis.kpis || [];
  const kpiColors: Record<string, string> = {
    productivity: '#0891b2', personalization: '#7c3aed', immediacy: '#059669', trust: '#f59e0b',
  };
  await createText('<p><strong>Success KPIs</strong></p>', 200, 900,
    { fontSize: 14, color: '#7c3aed', width: 300, parentFrameId: f8Id });
  for (let i = 0; i < Math.min(kpis.length, 8); i++) {
    const kpi = kpis[i];
    const kx = 200 + (i % 4) * 720;
    const ky = 980 + Math.floor(i / 4) * 280;
    const kColor = kpiColors[kpi.category] || '#64748b';
    await createCard(
      `${kpi.metric.substring(0, 60)}`,
      `<p><strong>Category:</strong> ${kpi.category}</p><p>${kpi.whyItMatters.substring(0, 100)}</p><p><strong>Target:</strong> ${kpi.targetDirection}</p>`,
      kx, ky, { cardTheme: kColor, width: 660, parentFrameId: f8Id },
    );
  }

  frames.push({ frameId: f8Id, title: 'Readiness & KPIs', items: f8Items });

  // =========================================================================
  // FRAME 9: Next Steps & Future Vision
  // =========================================================================
  await appendLog(workspaceId, `  Creating frame 9/9: Next Steps & Future Vision`);
  const f9Id = await createFrame('Next Steps & Future Vision', COL[2], ROW[2], FW, FH);
  const f9Items: MiroItem[] = [];

  await createShape(
    `<p><strong>Next Steps & Future Vision</strong></p>`,
    'round_rectangle', FW / 2, 60, FW - 200, 70,
    { fillColor: '#1a1a2e', fontSize: 18, color: '#ffffff' }, f9Id,
  );

  // Before / After from futureStateVision
  const fvToday = analysis.futureStateVision?.today || [];
  const fvTomorrow = analysis.futureStateVision?.tomorrow || [];
  await createShape('<p><strong>TODAY</strong></p>', 'round_rectangle', 650, 160, 900, 60,
    { fillColor: '#ef4444', fontSize: 15, color: '#ffffff' }, f9Id);
  await createShape('<p><strong>TOMORROW (AI-Powered)</strong></p>', 'round_rectangle', 2200, 160, 900, 60,
    { fillColor: '#059669', fontSize: 15, color: '#ffffff' }, f9Id);

  for (let i = 0; i < Math.min(Math.max(fvToday.length, fvTomorrow.length), 5); i++) {
    const fy = 280 + i * 200;
    if (fvToday[i]) {
      await createStickyNote(fvToday[i].substring(0, 200), 650, fy, 'light_pink', f9Id);
    }
    if (fvTomorrow[i]) {
      await createStickyNote(fvTomorrow[i].substring(0, 200), 2200, fy, 'light_green', f9Id);
    }
    if (fvToday[i] || fvTomorrow[i]) {
      f9Items.push({ type: 'sticky_note', content: fvToday[i] || '', color: '#ef4444', position: { x: 650, y: fy } });
    }
  }

  // Arrow between today/tomorrow
  await createText('→', 1580, 620, { fontSize: 48, color: '#0891b2', width: 200, parentFrameId: f9Id });

  // Strategic pillars
  const pillars = analysis.strategicPillars || [];
  await createText('<p><strong>Strategic Pillars</strong></p>', 200, 1220,
    { fontSize: 14, color: '#0891b2', width: 400, parentFrameId: f9Id });
  const pillarColors9 = ['#0891b2', '#7c3aed', '#059669', '#f59e0b', '#ec4899', '#64748b'];
  for (let i = 0; i < Math.min(pillars.length, 6); i++) {
    const pillar = pillars[i];
    const plx = 200 + (i % 3) * 950;
    const ply = 1300 + Math.floor(i / 3) * 200;
    await createShape(
      `<p><strong>${pillar.pillar}</strong></p><p>${pillar.description.substring(0, 80)}</p>`,
      'round_rectangle', plx, ply, 880, 80,
      { fillColor: pillarColors9[i % pillarColors9.length], fontSize: 11, color: '#ffffff' }, f9Id,
    );
  }

  // Collab zone — key takeaways
  if (analysis.keyTakeaways?.length) {
    for (let i = 0; i < Math.min(analysis.keyTakeaways.length, 3); i++) {
      await createStickyNote(
        analysis.keyTakeaways[i].substring(0, 300),
        500 + i * 850, 1600, 'light_blue', f9Id,
      );
    }
  }

  frames.push({ frameId: f9Id, title: 'Next Steps & Future Vision', items: f9Items });

  // =========================================================================

  const snapshot: MiroBoardSnapshot = { boardId, boardUrl, frames };

  await prisma.workspace.update({
    where: { workspaceId },
    data: {
      miroStatus: 'completed',
      miroBoardId: boardId,
      miroBoardUrl: boardUrl,
      miroSnapshot: JSON.stringify(snapshot),
    },
  });

  logger.info('[Workspace] Miro board created', { workspaceId, boardId, boardUrl });
  return snapshot;
}

// ---------------------------------------------------------------------------
// Workshop Prep — Miro Board Generation
// ---------------------------------------------------------------------------

async function runWorkshopPrepMiroBoardGeneration(
  workspaceId: string,
  analysis: WorkshopPrepResult,
): Promise<MiroBoardSnapshot> {
  await prisma.workspace.update({
    where: { workspaceId },
    data: { status: 'miro_generating', miroStatus: 'running' },
  });

  const ws = await prisma.workspace.findUniqueOrThrow({
    where: { workspaceId },
    select: { clientName: true },
  });

  logger.info('[Workspace] Creating Workshop Prep Miro board', { workspaceId });

  const boardName = `${ws.clientName || 'Workshop'} - Preparation Board`
    .replace(/[\n\r]/g, ' ')
    .substring(0, 60);
  const boardDesc = (analysis.workshopPlan?.title || 'Workshop preparation board')
    .replace(/[\n\r]/g, ' ')
    .substring(0, 300);

  let boardRes: any;
  try {
    boardRes = await axios.post(
      `${MIRO_API_BASE}/boards`,
      { name: boardName, description: boardDesc },
      { headers: miroHeaders() },
    );
  } catch (err: any) {
    const respData = err.response?.data ? JSON.stringify(err.response.data) : 'no response body';
    logger.error('[Workspace] Miro board creation failed', { workspaceId, status: err.response?.status, respData });
    throw new Error(`Miro board creation failed (${err.response?.status}): ${respData}`);
  }

  const boardId = boardRes.data.id;
  const boardUrl = boardRes.data.viewLink || `https://miro.com/app/board/${boardId}/`;

  await appendLog(workspaceId, `  Board created: ${boardName}`);
  await appendLog(workspaceId, `  Board URL: ${boardUrl}`);

  const frames: MiroFrame[] = [];
  const hdrs = { headers: miroHeaders() };
  const api = (path: string) => `${MIRO_API_BASE}/boards/${boardId}/${path}`;

  // --- Helpers ---
  async function createFrame(
    title: string, x: number, y: number, width = 2000, height = 1500,
  ): Promise<string> {
    const res = await axios.post(api('frames'), {
      data: { title, format: 'custom', type: 'freeform' },
      position: { x, y }, geometry: { width, height },
    }, hdrs);
    return res.data.id;
  }

  async function createShape(
    content: string, shape: string, x: number, y: number,
    width: number, height: number,
    style: Record<string, any> = {}, parentFrameId?: string,
  ): Promise<string> {
    try {
      const merged = { fillColor: '#4262ff', fillOpacity: '1.0', fontSize: '14', textAlign: 'center', textAlignVertical: 'middle', color: '#ffffff', ...style };
      if (typeof merged.fontSize === 'number') merged.fontSize = String(merged.fontSize);
      const res = await axios.post(api('shapes'), {
        data: { content: content.substring(0, 500), shape },
        style: merged,
        geometry: { width, height },
        position: { x, y },
        ...(parentFrameId ? { parent: { id: parentFrameId } } : {}),
      }, hdrs);
      return res.data.id;
    } catch (err: any) {
      logger.warn('[Miro] createShape failed', { shape, err: err.response?.data || err.message });
      return '';
    }
  }

  async function createCard(
    title: string, description: string, x: number, y: number,
    opts: { cardTheme?: string; width?: number; parentFrameId?: string } = {},
  ): Promise<string> {
    try {
      const res = await axios.post(api('cards'), {
        data: { title: title.substring(0, 200), description: description.substring(0, 2000) },
        style: { cardTheme: opts.cardTheme || '#2d9bf0' },
        geometry: { width: opts.width || 320 },
        position: { x, y },
        ...(opts.parentFrameId ? { parent: { id: opts.parentFrameId } } : {}),
      }, hdrs);
      return res.data.id;
    } catch (err: any) {
      logger.warn('[Miro] createCard failed', { title, err: err.response?.data || err.message });
      return '';
    }
  }

  async function createText(
    content: string, x: number, y: number,
    opts: { fontSize?: number | string; color?: string; width?: number; parentFrameId?: string } = {},
  ): Promise<string> {
    try {
      const res = await axios.post(api('texts'), {
        data: { content: content.substring(0, 500) },
        style: { fontSize: String(opts.fontSize || 18), color: opts.color || '#1a1a2e', textAlign: 'left' },
        geometry: { width: opts.width || 400 },
        position: { x, y },
        ...(opts.parentFrameId ? { parent: { id: opts.parentFrameId } } : {}),
      }, hdrs);
      return res.data.id;
    } catch (err: any) {
      logger.warn('[Miro] createText failed', { err: err.response?.data || err.message });
      return '';
    }
  }

  async function createConnector(startId: string, endId: string, style: Record<string, any> = {}): Promise<void> {
    if (!startId || !endId) return;
    try {
      const merged = { strokeColor: '#B0B0B0', strokeWidth: '2', ...style };
      if (typeof merged.strokeWidth === 'number') merged.strokeWidth = String(merged.strokeWidth);
      await axios.post(api('connectors'), {
        startItem: { id: startId, snapTo: 'auto' },
        endItem: { id: endId, snapTo: 'auto' },
        style: merged,
        shape: 'curved',
      }, hdrs);
    } catch {
      // Connectors can fail if items are in different frames — non-critical
    }
  }

  async function createStickyNote(
    content: string, x: number, y: number, color = 'light_yellow', parentFrameId?: string,
  ): Promise<string> {
    try {
      const res = await axios.post(api('sticky_notes'), {
        data: { content: content.substring(0, 500), shape: 'square' },
        style: { fillColor: color },
        position: { x, y },
        ...(parentFrameId ? { parent: { id: parentFrameId } } : {}),
      }, hdrs);
      return res.data.id;
    } catch (err: any) {
      logger.warn('[Miro] createStickyNote failed', { err: err.response?.data || err.message });
      return '';
    }
  }

  // =========================================================================
  // FRAME 1: Survey Insights — theme shapes + finding cards, connected
  // =========================================================================
  const insightCount = analysis.surveyInsights?.length ?? 0;
  await appendLog(workspaceId, `  Creating frame 1/5: Survey Insights (${insightCount} themes)`);
  const insightsW = Math.max(3000, insightCount * 500);
  const insightsFrameId = await createFrame('Survey Insights', 0, 0, insightsW, 1600);
  const insightsItems: MiroItem[] = [];

  // Section header
  await createShape(
    `<p><strong>${insightCount} Survey Themes Identified</strong></p>`,
    'round_rectangle', insightsW / 2, 60, insightsW - 200, 70,
    { fillColor: '#1a1a2e', fontSize: 16, color: '#ffffff' }, insightsFrameId,
  );

  for (let i = 0; i < insightCount; i++) {
    const si = analysis.surveyInsights![i];
    const col = i * 450 + 250;

    // Theme header shape
    const themeId = await createShape(
      `<p><strong>${si.theme}</strong></p>`,
      'round_rectangle', col, 200, 380, 70,
      { fillColor: '#4262ff', fontSize: 14, color: '#ffffff' }, insightsFrameId,
    );

    // Finding card
    const findingId = await createCard(
      si.theme,
      `<p><strong>Finding:</strong> ${si.findings}</p><p><strong>Implication:</strong> ${si.implications}</p>`,
      col, 420, { cardTheme: '#4262ff', width: 380, parentFrameId: insightsFrameId },
    );

    // Action card — participants can add notes here during the workshop
    const actionId = await createCard(
      `Focus: ${si.suggestedFocus.substring(0, 60)}`,
      `<p>${si.suggestedFocus}</p><p><br></p><p><em>Add your notes and reactions below...</em></p>`,
      col, 680, { cardTheme: '#059669', width: 380, parentFrameId: insightsFrameId },
    );

    // Connect theme → finding → action
    await createConnector(themeId, findingId, { strokeColor: '#4262ff' });
    await createConnector(findingId, actionId, { strokeColor: '#059669', strokeStyle: 'dashed' });

    insightsItems.push({ type: 'shape', content: si.theme, position: { x: col, y: 200 } });
  }

  // Blank sticky notes for participants to add additional themes
  await createText('Add your own themes below ↓', insightsW / 2, 880,
    { fontSize: 14, color: '#94a3b8', width: 300, parentFrameId: insightsFrameId });
  for (let i = 0; i < 3; i++) {
    await createStickyNote('', 200 + i * 450, 1000, 'light_yellow', insightsFrameId);
  }

  frames.push({ frameId: insightsFrameId, title: 'Survey Insights', items: insightsItems });

  // =========================================================================
  // FRAME 2: Workshop Agenda Flow — connected timeline with exercises below
  // =========================================================================
  const sessionCount = analysis.agenda?.length ?? 0;
  await appendLog(workspaceId, `  Creating frame 2/5: Workshop Agenda (${sessionCount} sessions)`);
  const agendaW = Math.max(4000, sessionCount * 550 + 400);
  const agendaFrameId = await createFrame('Workshop Agenda', 0, 1800, agendaW, 1800);
  const agendaItems: MiroItem[] = [];
  const sessionIds: string[] = [];

  // Header
  await createShape(
    `<p><strong>Workshop Flow — ${analysis.workshopPlan?.duration || ''}</strong></p>`,
    'round_rectangle', agendaW / 2, 60, agendaW - 200, 70,
    { fillColor: '#1a1a2e', fontSize: 16, color: '#ffffff' }, agendaFrameId,
  );

  for (let i = 0; i < sessionCount; i++) {
    const sess = analysis.agenda![i];
    const col = i * 550 + 300;

    // Session shape — main timeline node
    const sessId = await createShape(
      `<p><strong>${sess.sessionTitle}</strong></p><p>${sess.duration}</p>`,
      'round_rectangle', col, 220, 450, 100,
      { fillColor: '#0891b2', fontSize: 13, color: '#ffffff' }, agendaFrameId,
    );
    sessionIds.push(sessId);

    // Objective card below
    await createCard(
      'Objective',
      `<p>${sess.objective}</p><p><br></p><p><strong>Facilitator:</strong> ${sess.facilitatorNotes?.substring(0, 200) || ''}...</p>`,
      col, 430, { cardTheme: '#0891b2', width: 420, parentFrameId: agendaFrameId },
    );

    // Exercises as sticky notes below the card
    if (sess.exercises?.length) {
      for (let e = 0; e < Math.min(sess.exercises.length, 2); e++) {
        await createStickyNote(
          `Exercise: ${sess.exercises[e].substring(0, 200)}`,
          col - 100 + e * 220, 700, 'light_green', agendaFrameId,
        );
      }
    }

    // Discussion questions as sticky notes
    if (sess.discussionQuestions?.length) {
      for (let q = 0; q < Math.min(sess.discussionQuestions.length, 2); q++) {
        await createStickyNote(
          `Q: ${sess.discussionQuestions[q].substring(0, 200)}`,
          col - 100 + q * 220, 950, 'light_blue', agendaFrameId,
        );
      }
    }

    // Blank sticky for participant notes
    await createStickyNote('', col, 1180, 'light_yellow', agendaFrameId);

    agendaItems.push({ type: 'shape', content: sess.sessionTitle, position: { x: col, y: 220 } });
  }

  // Connect sessions in sequence
  for (let i = 0; i < sessionIds.length - 1; i++) {
    await createConnector(sessionIds[i], sessionIds[i + 1], { strokeColor: '#0891b2', strokeWidth: 3 });
  }

  // Labels
  await createText('Exercises', 100, 700, { fontSize: 12, color: '#059669', width: 120, parentFrameId: agendaFrameId });
  await createText('Discussion', 100, 950, { fontSize: 12, color: '#2563eb', width: 120, parentFrameId: agendaFrameId });
  await createText('Your Notes', 100, 1180, { fontSize: 12, color: '#94a3b8', width: 120, parentFrameId: agendaFrameId });

  frames.push({ frameId: agendaFrameId, title: 'Workshop Agenda', items: agendaItems });

  // =========================================================================
  // FRAME 3: Talking Points — topic headers with connected point cards
  // =========================================================================
  const tpCount = analysis.talkingPoints?.length ?? 0;
  await appendLog(workspaceId, `  Creating frame 3/5: Talking Points (${tpCount} topics)`);
  const tpW = Math.max(3000, tpCount * 500);
  const tpFrameId = await createFrame('Talking Points', 0, 3800, tpW, 1400);
  const tpItems: MiroItem[] = [];

  await createShape(
    `<p><strong>Key Talking Points — Grounded in Research</strong></p>`,
    'round_rectangle', tpW / 2, 60, tpW - 200, 70,
    { fillColor: '#1a1a2e', fontSize: 16, color: '#ffffff' }, tpFrameId,
  );

  for (let i = 0; i < tpCount; i++) {
    const tp = analysis.talkingPoints![i];
    const col = i * 500 + 300;

    // Topic header
    const topicId = await createShape(
      `<p><strong>${tp.topic}</strong></p>`,
      'round_rectangle', col, 200, 420, 60,
      { fillColor: '#7c3aed', fontSize: 13, color: '#ffffff' }, tpFrameId,
    );

    // Points as a card
    const pointsText = tp.points.slice(0, 5).map((p) => `<p>• ${p.substring(0, 100)}</p>`).join('');
    const pointsId = await createCard(
      tp.topic,
      `${pointsText}<p><br></p><p><em>Research: ${tp.contextFromResearch?.substring(0, 200) || ''}...</em></p>`,
      col, 450, { cardTheme: '#7c3aed', width: 420, parentFrameId: tpFrameId },
    );

    await createConnector(topicId, pointsId, { strokeColor: '#7c3aed' });

    tpItems.push({ type: 'shape', content: tp.topic, position: { x: col, y: 200 } });
  }

  frames.push({ frameId: tpFrameId, title: 'Talking Points', items: tpItems });

  // =========================================================================
  // FRAME 4: Risks & Mitigations — risk shapes connected to mitigation cards
  // =========================================================================
  const riskCount = analysis.risksMitigations?.length ?? 0;
  await appendLog(workspaceId, `  Creating frame 4/5: Risks & Mitigations (${riskCount} items)`);
  const riskW = Math.max(3000, Math.ceil(riskCount / 2) * 600 + 400);
  const risksFrameId = await createFrame('Risks & Mitigations', tpW + 200, 3800, riskW, 1400);
  const riskItems: MiroItem[] = [];

  await createShape(
    `<p><strong>Workshop Risks & Mitigations</strong></p>`,
    'round_rectangle', riskW / 2, 60, riskW - 200, 70,
    { fillColor: '#1a1a2e', fontSize: 16, color: '#ffffff' }, risksFrameId,
  );

  for (let i = 0; i < riskCount; i++) {
    const r = analysis.risksMitigations![i];
    const col = (i % 3) * 550 + 300;
    const row = Math.floor(i / 3);
    const yBase = 200 + row * 500;

    const riskColor = r.likelihood === 'high' ? '#ef4444' : r.likelihood === 'medium' ? '#f59e0b' : '#22c55e';

    // Risk rhombus shape
    const riskId = await createShape(
      `<p><strong>${r.risk.substring(0, 80)}</strong></p><p>[${(r.likelihood || 'medium').toUpperCase()}]</p>`,
      'rhombus', col, yBase, 250, 160,
      { fillColor: riskColor, fontSize: '11', color: '#ffffff' }, risksFrameId,
    );

    // Mitigation card
    const mitigationId = await createCard(
      `Mitigation`,
      `<p>${r.mitigation}</p>`,
      col, yBase + 250, { cardTheme: riskColor, width: 350, parentFrameId: risksFrameId },
    );

    await createConnector(riskId, mitigationId, { strokeColor: riskColor, strokeWidth: 2 });

    riskItems.push({ type: 'shape', content: r.risk, color: riskColor, position: { x: col, y: yBase } });
  }

  frames.push({ frameId: risksFrameId, title: 'Risks & Mitigations', items: riskItems });

  // =========================================================================
  // FRAME 5: Collaboration Space — open area for workshop participants
  // =========================================================================
  await appendLog(workspaceId, `  Creating frame 5/5: Collaboration Space`);
  const collabFrameId = await createFrame('Workshop Notes & Actions', tpW + 200, 0, 3000, 1600);
  const collabItems: MiroItem[] = [];

  await createShape(
    `<p><strong>Workshop Notes & Action Items</strong></p><p>Use this space during the workshop</p>`,
    'round_rectangle', 1500, 60, 2600, 80,
    { fillColor: '#1a1a2e', fontSize: 16, color: '#ffffff' }, collabFrameId,
  );

  // Pre-labeled sections
  const sections = [
    { title: 'Key Decisions', color: '#2563eb', x: 400 },
    { title: 'Action Items', color: '#059669', x: 1100 },
    { title: 'Open Questions', color: '#f59e0b', x: 1800 },
    { title: 'Parking Lot', color: '#94a3b8', x: 2500 },
  ];

  for (const sec of sections) {
    await createShape(
      `<p><strong>${sec.title}</strong></p>`,
      'round_rectangle', sec.x, 220, 500, 50,
      { fillColor: sec.color, fontSize: 13, color: '#ffffff' }, collabFrameId,
    );
    // Pre-place empty sticky notes for participants
    for (let r = 0; r < 4; r++) {
      await createStickyNote('', sec.x, 380 + r * 250, 'light_yellow', collabFrameId);
    }
  }

  collabItems.push({ type: 'shape', content: 'Collaboration Space', position: { x: 1500, y: 60 } });
  frames.push({ frameId: collabFrameId, title: 'Workshop Notes & Actions', items: collabItems });

  // =========================================================================

  const snapshot: MiroBoardSnapshot = { boardId, boardUrl, frames };

  await prisma.workspace.update({
    where: { workspaceId },
    data: {
      miroStatus: 'completed',
      miroBoardId: boardId,
      miroBoardUrl: boardUrl,
      miroSnapshot: JSON.stringify(snapshot),
    },
  });

  logger.info('[Workspace] Workshop Prep Miro board created', { workspaceId, boardId, boardUrl });
  return snapshot;
}

// ---------------------------------------------------------------------------
// Stage 3: PPTX Generation
// ---------------------------------------------------------------------------

async function runPptxGeneration(
  workspaceId: string,
  analysis: WorkshopAnalysisResult,
): Promise<string> {
  await prisma.workspace.update({
    where: { workspaceId },
    data: { status: 'pptx_generating', pptxStatus: 'running' },
  });

  const ws = await prisma.workspace.findUniqueOrThrow({
    where: { workspaceId },
    select: { clientName: true, name: true, requestedBy: true, transcriptText: true, description: true },
  });

  // Read workshop capture data (personas, pain points, mappings)
  const rawCapture = await (prisma as any).workspace.findUnique({
    where: { workspaceId },
    select: { workshopPersonas: true, workshopPainPoints: true, personaMappings: true },
  });
  const workshopPersonas: any[] = rawCapture ? safeJsonParse(rawCapture.workshopPersonas, []) : [];
  const workshopPainPoints: any[] = rawCapture ? safeJsonParse(rawCapture.workshopPainPoints, []) : [];
  const personaMappings: any[] = rawCapture ? safeJsonParse(rawCapture.personaMappings, []) : [];

  logger.info('[Workspace] Generating PPTX', { workspaceId });

  // Build PresentationConfig — AI-driven narrative pass
  await appendLog(workspaceId, `  Building AI-driven slide narrative (GPT-4o)...`);
  let slides: ContentSlide[];
  try {
    slides = await buildPresentationSlidesAI(
      analysis,
      ws.clientName || undefined,
      ws.transcriptText || undefined,
      ws.description || undefined,
      workshopPersonas,
      workshopPainPoints,
      personaMappings,
    );
    await appendLog(workspaceId, `  AI narrative complete — ${slides.length} slides with contextual imagery`);
  } catch (err: any) {
    await appendLog(workspaceId, `  AI slide build failed (${err.message}) — falling back to static builder`);
    logger.warn('[Workspace] AI slide build failed, using static fallback', { workspaceId, err: err.message });
    slides = buildPresentationSlides(analysis, ws.clientName || undefined);
  }
  await appendLog(workspaceId, `  Generated ${slides.length} slides`);
  slides.forEach((s, i) => {
    logger.info(`[Workspace] Slide ${i + 1}: ${s.slide_title}`);
  });

  const presentationData = {
    presentation_metadata: {
      title: analysis.workshopOverview?.title || ws.name,
    },
    slides,
  };

  // Get template path
  let templatePath: string;
  try {
    const templateManager = new TemplateManagerService();
    templatePath = templateManager.getTemplatePath();
    await appendLog(workspaceId, `  Using template: ${templatePath.split('/').pop()}`);
  } catch {
    throw new Error(
      'No PPTX template configured. Set TEMPLATE_REGISTRY_PATH or add a templates.json to the backend directory.',
    );
  }

  // Generate PPTX buffer
  await appendLog(workspaceId, `  Rendering PowerPoint file...`);
  const pptxBuffer = await generatePPTXBuffer(presentationData, templatePath);
  await appendLog(workspaceId, `  PPTX rendered: ${(pptxBuffer.length / 1024).toFixed(0)} KB`);

  // Upload to S3
  const jobId = randomUUID();
  let outputFile = '';
  let outputFileSize = 0;

  if (isPptxStorageConfigured()) {
    await appendLog(workspaceId, `  Uploading to S3...`);
    const uploadResult = await uploadPptxToS3({
      buffer: pptxBuffer,
      filename: `workspace-${ws.clientName || 'workshop'}.pptx`,
      metadata: { workspaceId, source: 'workspace-pipeline' },
    });
    outputFile = uploadResult.key;
    outputFileSize = pptxBuffer.length;
    await appendLog(workspaceId, `  Uploaded: ${outputFile}`);
  } else {
    await appendLog(workspaceId, `  S3 not configured — PPTX stored in database only`);
  }

  // Create PptxJob record
  await prisma.pptxJob.create({
    data: {
      jobId,
      status: 'completed',
      requestedBy: ws.requestedBy,
      analysisType: 'workshop',
      templateName: 'default',
      outputFile,
      outputFileSize,
      slideCount: slides.length,
      presentationData: JSON.stringify(presentationData),
      completedAt: new Date(),
    },
  });

  // Link to workspace
  await prisma.workspace.update({
    where: { workspaceId },
    data: { pptxStatus: 'completed', pptxJobId: jobId },
  });

  logger.info('[Workspace] PPTX generated', { workspaceId, jobId, slideCount: slides.length });
  return jobId;
}

// ---------------------------------------------------------------------------
// Slide builder — AI-driven narrative pass
// ---------------------------------------------------------------------------

interface ContentSlide {
  slide_title: string;
  content_sections: string[];
  visual_directives?: any;
  speaker_notes?: string;
}

async function buildPresentationSlidesAI(
  analysis: WorkshopAnalysisResult,
  clientName?: string,
  transcriptText?: string,
  description?: string,
  workshopPersonas?: any[],
  workshopPainPoints?: any[],
  personaMappings?: any[],
): Promise<ContentSlide[]> {
  const openai = getOpenAIService();

  const transcriptExcerpt = transcriptText
    ? transcriptText.replace(/\s+/g, ' ').trim().substring(0, 3000)
    : '';

  const analysisJson = JSON.stringify(analysis, null, 2).substring(0, 8000);

  // Build workshop capture section if data exists
  let workshopCaptureSection = '';
  if (workshopPersonas && workshopPersonas.length > 0) {
    const personaLines = workshopPersonas.map((p: any) => `  - ${p.name}${p.title ? ` (${p.title})` : ''}`).join('\n');
    workshopCaptureSection += `\n### Live Workshop Capture — Personas (captured during session):\n${personaLines}\n`;
  }
  if (workshopPainPoints && workshopPainPoints.length > 0) {
    const painLines = workshopPainPoints.map((pp: any) => {
      const persona = workshopPersonas?.find((p: any) => p.id === pp.personaId);
      return `  - ${pp.text}${persona ? ` [${persona.name}]` : ''}`;
    }).join('\n');
    workshopCaptureSection += `\n### Live Workshop Capture — Pain Points (captured during session):\n${painLines}\n`;
  }
  if (personaMappings && personaMappings.length > 0) {
    const mappingJson = JSON.stringify(personaMappings, null, 2).substring(0, 3000);
    workshopCaptureSection += `\n### AI-Generated Persona Mappings (user stories + ServiceNow agent matches):\n${mappingJson}\n`;
  }

  const prompt = `You are a senior solution consultant at Northstar Integrators creating a polished executive-grade post-workshop readout deck for: **${clientName || 'the client'}**.

This deck MUST follow Northstar Integrators's Standard Post-Workshop Readout structure — a repeatable playbook used across all engagements.
The narrative arc is: Strategic Context → Workshop Approach → Key Findings → Persona/Domain Insights → Solutions → Prioritization → Roadmap → Readiness → KPIs → Next Steps

## Input Data

### Workshop Analysis (structured JSON):
${analysisJson}

### Raw Transcript Excerpt:
${transcriptExcerpt || 'Not available — infer from analysis.'}

${description ? `### Engagement Description: ${description}` : ''}
${workshopCaptureSection ? workshopCaptureSection : ''}

## Rules
1. Use the client's EXACT language, system names, stakeholder names, and numbers from the transcript — no generic filler
2. Every content bullet must be specific and substantive
3. Every slide gets a DALL-E image prompt specific to that slide's industry/content context
4. Speaker notes: 2-3 talking points + 1 objection/rebuttal + transition sentence
5. Table slides get a data_specification block

## REQUIRED SLIDE STRUCTURE (follow this order exactly)

### SECTION 1 — COVER & NAVIGATION
Slide 1: **Cover** — Engagement title (e.g. "AI-Powered Enterprise Transformation"), subtitle "Workshop Readout & Strategic Roadmap", client name, prepared by Northstar Integrators, date
Slide 2: **Agenda / Contents** — list all 9 sections with one-line descriptions

### SECTION 2 — EXECUTIVE SUMMARY
Slide 3: **Section Divider** — "SECTION 01 — Executive Summary" with tagline
Slide 4: **Why AI, Why Now for ${clientName || 'this Client'}** — specific urgency triggers: business pressures, scale/complexity, competitive threats, opportunity cost of inaction — all grounded in the transcript
Slide 5: **Strategic Transformation Pillars** — 4-6 pillars from analysis.strategicPillars (e.g. Productivity, Service Experience, Risk & Governance, Workforce Augmentation) with one-line descriptions and workshop alignment
Slide 6: **AI Value Framework** — Northstar Integrators's standard lens: Productivity (reduce manual effort), Personalization (tailor to user context), Immediacy (speed to answer/action), Trust (transparency, governance, grounded answers) — show how each applies to ${clientName || 'this client'}
Slide 7: **Opportunity Snapshot** — 3-5 top AI opportunities from analysis.solutionCatalog, grouped by domain, with pain point and expected impact

### SECTION 3 — WORKSHOP OVERVIEW
Slide 8: **Section Divider** — "SECTION 02 — Workshop Overview"
Slide 9: **Workshop Structure & Participants** — agenda covered, participant groups represented with roles, cross-functional representation
Slide 10: **Methodology** — human-centered approach: persona identification, empathy mapping, pain point extraction, ideation, prioritization, feasibility scoring

### SECTION 4 — KEY FINDINGS
Slide 11: **Section Divider** — "SECTION 03 — Key Findings"
Slide 12: **Cross-Cutting Themes** — 3-4 themes from analysis.crossCuttingThemes, each with proof points and why it matters — these should be the most insight-dense executive slide in the deck
Slide 13: **Pain Point → Solution → Outcome Mapping** — table: Problem | AI Solution | Persona(s) | Value Driver — use analysis.solutionCatalog
Slide 14: **Alignment to Strategic Priorities** — show how workshop findings map directly to analysis.strategicPillars

### SECTION 5 — PERSONA DEEP DIVES
Slide 15: **Section Divider** — "SECTION 04 — Persona Deep Dives"
[Generate one slide per persona. PRIORITY: use "Live Workshop Capture — Personas" list if provided above — these are the actual personas identified during the session. Otherwise fall back to analysis.personas. Up to 5 personas. Each persona slide title = persona name + title. Content = their pain points (from "Live Workshop Capture — Pain Points" if available), AI user stories (from "AI-Generated Persona Mappings" if available), ServiceNow agent recommendations, expected outcomes. Include quote if available from transcript.]

### SECTION 6 — SOLUTION ARCHITECTURE
Slide [N]: **Section Divider** — "SECTION 05 — Solution Architecture"
Slide [N+1]: **Architecture Overview** — user channels → conversational/AI layer → platform workflow → data/integration → governance
Slide [N+2]: **Detailed Implementation Blueprint** — pick the highest-priority use case from analysis.solutionCatalog and show end-to-end: components, user flow (7 steps: initiate → identify intent → enrich context → clarify → create/resolve → route → confirm), integrations, guardrails

### SECTION 7 — SOLUTION CATALOG & PRIORITIZATION
Slide [N]: **Section Divider** — "SECTION 06 — Solution Catalog & Prioritization"
Slide [N+1]: **Solution Catalog** — full table: Problem | Solution | Persona(s) | Priority | Value Driver — use analysis.solutionCatalog. Priority labels: Quick Win / High Value / Build Foundation / Strategic Bet / Evaluate Later
Slide [N+2]: **Value vs. Feasibility Matrix** — 4 quadrants: Quick Wins (high value + high feasibility), Strategic Bets (high value + lower feasibility), Build Foundation (moderate value + necessary enabler), Evaluate Later. Populate from analysis.solutionCatalog

### SECTION 8 — ROADMAP, READINESS & KPIs
Slide [N]: **Section Divider** — "SECTION 07 — Roadmap, Readiness & KPIs"
Slide [N+1]: **Phased Implementation Roadmap** — Phase 1: Quick Wins | Phase 2: Foundation/Build | Phase 3: Transformation/Scale — use analysis.roadmap, populate use cases and dependencies per phase
Slide [N+2]: **Readiness Framework** — table from analysis.readinessAssessment: Dimension | Current State | Target State | Readiness Level | Key Workstreams. Formula: Agent Success = Platform × Data × Integration × Governance × Organizational Readiness
Slide [N+3]: **Success Metrics / KPIs** — table from analysis.kpis: Category | Metric | Why It Matters | Target Direction — grouped by Productivity / Personalization / Immediacy / Trust

### SECTION 9 — NEXT STEPS & FUTURE VISION
Slide [N]: **Section Divider** — "SECTION 08 — Next Steps & Future Vision"
Slide [N+1]: **Recommended Next Steps** — 5-6 concrete action-oriented steps: confirm use cases, readiness deep dive, governance setup, Phase 1 kick-off, measurement baseline
Slide [N+2]: **Future State Vision: Before vs. After** — two columns. Today (from analysis.futureStateVision.today): manual, fragmented, slow. Tomorrow (from analysis.futureStateVision.tomorrow): AI-powered, trusted, fast — use client's own language
Slide [N+3]: **Thank You / Next Discussion** — closing slide with Northstar Integrators contact prompt

## JSON Response Format

Return {"slides": [...]}. Each slide:
{
  "slide_title": "string",
  "slide_type": "cover|section_divider|content|table|persona|matrix",
  "section": "string — section name e.g. 'Executive Summary'",
  "content_sections": ["bullet 1", "bullet 2", ...],
  "speaker_notes": "string — 150-250 words: talking points, objection+rebuttal, transition",
  "visual_directives": {
    "type": "image|table|image_and_table",
    "image_prompt": "string — DALL-E 3 prompt, 50-100 words, specific to this slide's industry/content",
    "data_specification": {
      "structure": "table",
      "table": { "headers": [...], "rows": [[...], ...] }
    }
  }
}`;

  const result = await openai.generateStructuredCompletion<{ slides: ContentSlide[] }>(
    [{ role: 'user', content: prompt }],
    undefined,
    0.7,
  );

  if (!Array.isArray(result.slides) || result.slides.length === 0) {
    throw new Error('AI returned empty slides array');
  }

  return result.slides;
}

// ---------------------------------------------------------------------------
// Slide builder — static fallback (used if AI call fails)
// ---------------------------------------------------------------------------

function buildPresentationSlides(
  analysis: WorkshopAnalysisResult,
  clientName?: string,
): ContentSlide[] {
  const slides: ContentSlide[] = [];

  // 1. Title slide
  slides.push({
    slide_title: analysis.workshopOverview.title || 'AI Workshop Summary',
    content_sections: [
      clientName ? `Prepared for: ${clientName}` : '',
      analysis.workshopOverview.date ? `Date: ${analysis.workshopOverview.date}` : '',
      analysis.workshopOverview.duration ? `Duration: ${analysis.workshopOverview.duration}` : '',
    ].filter(Boolean),
    speaker_notes: 'Title slide for the workshop summary presentation.',
  });

  // 2. Agenda / Overview
  if (analysis.workshopOverview.agendaCovered?.length) {
    slides.push({
      slide_title: 'Workshop Agenda',
      content_sections: analysis.workshopOverview.agendaCovered.map((a, i) => `${i + 1}. ${a}`),
      speaker_notes: 'Topics covered during the workshop session.',
    });
  }

  // 3. Executive Summary
  if (analysis.summary) {
    slides.push({
      slide_title: 'Executive Summary',
      content_sections: [analysis.summary],
      speaker_notes: 'High-level summary of the workshop outcomes.',
    });
  }

  // 4. Workshop Flow (1 slide per 3 segments to avoid overcrowding)
  if (analysis.workshopFlow?.length) {
    const chunkSize = 3;
    for (let i = 0; i < analysis.workshopFlow.length; i += chunkSize) {
      const chunk = analysis.workshopFlow.slice(i, i + chunkSize);
      slides.push({
        slide_title: `Workshop Flow${analysis.workshopFlow.length > chunkSize ? ` (${Math.floor(i / chunkSize) + 1})` : ''}`,
        content_sections: chunk.map(
          (seg) => `${seg.topic}${seg.duration ? ` (${seg.duration})` : ''}\n${seg.keyPoints.map((p) => `  • ${p}`).join('\n')}`,
        ),
      });
    }
  }

  // 5. Client Needs & Solutions
  if (analysis.clientNeeds?.length) {
    slides.push({
      slide_title: 'Client Needs & Solutions',
      content_sections: analysis.clientNeeds.map(
        (n) =>
          `${n.need} [${(n.priority || 'medium').toUpperCase()}]\n${n.context}${n.mappedSolution ? `\n→ Solution: ${n.mappedSolution}` : ''}`,
      ),
      visual_directives: {
        type: 'table',
        data_specification: {
          structure: 'table',
          table: {
            headers: ['Need', 'Priority', 'Mapped Solution'],
            rows: analysis.clientNeeds.map((n) => [n.need, n.priority, n.mappedSolution || '-']),
          },
        },
      },
    });
  }

  // 6. Technology Recommendations
  if (analysis.technologyRecommendations?.length) {
    slides.push({
      slide_title: 'Technology Recommendations',
      content_sections: analysis.technologyRecommendations.map(
        (t) => `${t.technology} — ${t.purpose}\nPriority: ${t.priority} | Complexity: ${t.complexity}`,
      ),
      visual_directives: {
        type: 'table',
        data_specification: {
          structure: 'table',
          table: {
            headers: ['Technology', 'Purpose', 'Priority', 'Complexity'],
            rows: analysis.technologyRecommendations.map((t) => [
              t.technology,
              t.purpose,
              t.priority,
              t.complexity,
            ]),
          },
        },
      },
    });
  }

  // 7. Maturity Assessment
  if (analysis.clientMaturityAssessment) {
    const ma = analysis.clientMaturityAssessment;
    slides.push({
      slide_title: 'Client Maturity Assessment',
      content_sections: [
        `Current State: ${ma.currentState}`,
        `Target State: ${ma.targetState}`,
        `Maturity Level: ${(ma.maturityLevel || 'developing').toUpperCase()}`,
        '',
        'Identified Gaps:',
        ...(ma.gaps || []).map((g) => `  • ${g}`),
      ],
    });
  }

  // 8. Roadmap
  if (analysis.roadmap?.length) {
    slides.push({
      slide_title: 'Proposed Roadmap',
      content_sections: analysis.roadmap.map(
        (p) =>
          `${p.phase} (${p.duration})\nGoals: ${p.goals.join(', ')}\nDeliverables: ${p.deliverables.join(', ')}`,
      ),
      visual_directives: {
        type: 'timeline',
        data_specification: {
          structure: 'timeline',
          phases: analysis.roadmap.map((p) => ({
            name: p.phase,
            duration: p.duration,
            tasks: [...(p.goals || []), ...(p.deliverables || [])],
          })),
        },
      },
    });
  }

  // 9. Action Items
  if (analysis.actionItems?.length) {
    slides.push({
      slide_title: 'Action Items',
      content_sections: analysis.actionItems.map(
        (a) =>
          `${a.action}\nOwner: ${a.owner} | Priority: ${a.priority}${a.dueDate ? ` | Due: ${a.dueDate}` : ''}`,
      ),
      visual_directives: {
        type: 'table',
        data_specification: {
          structure: 'table',
          table: {
            headers: ['Action', 'Owner', 'Priority', 'Due Date'],
            rows: analysis.actionItems.map((a) => [a.action, a.owner, a.priority, a.dueDate || '-']),
          },
        },
      },
    });
  }

  // 10. Key Takeaways
  if (analysis.keyTakeaways?.length) {
    slides.push({
      slide_title: 'Key Takeaways',
      content_sections: analysis.keyTakeaways.map((t) => `• ${t}`),
      speaker_notes: 'Summary of the most important outcomes from the workshop.',
    });
  }

  // 11. Next Steps / Thank You
  slides.push({
    slide_title: 'Next Steps',
    content_sections: [
      'Thank you for your participation in this workshop.',
      '',
      'Next steps have been captured as action items — please review and confirm ownership.',
      '',
      'We look forward to continuing this journey together.',
    ],
  });

  return slides;
}

// ---------------------------------------------------------------------------
// User Story Generation — Stage 1: AI Analysis
// ---------------------------------------------------------------------------

async function runUserStoryAnalysis(workspaceId: string): Promise<UserStoryMapResult> {
  await prisma.workspace.update({
    where: { workspaceId },
    data: { status: 'analyzing', analysisStatus: 'running' },
  });

  const ws = await prisma.workspace.findUniqueOrThrow({
    where: { workspaceId },
    select: { transcriptText: true, clientName: true, sourceDocuments: true },
  });

  if (!ws.transcriptText) {
    throw new Error('No source document text found for this workspace');
  }

  // Log source document info
  let sourceDocs: WorkspaceSourceDocument[] = [];
  try {
    sourceDocs = ws.sourceDocuments ? JSON.parse(ws.sourceDocuments as string) : [];
  } catch {
    logger.warn('[Workspace] Failed to parse sourceDocuments', { workspaceId });
  }
  await appendLog(workspaceId, `  Source documents: ${sourceDocs.length}`);
  for (const doc of sourceDocs) {
    await appendLog(workspaceId, `    - ${doc.originalFilename} (${doc.sourceType}, ${doc.extractedWordCount} words)`);
  }

  const wordCount = ws.transcriptText.split(/\s+/).length;
  const charCount = ws.transcriptText.length;
  await appendLog(workspaceId, `  Combined text: ${wordCount.toLocaleString()} words, ${charCount.toLocaleString()} characters`);

  const openai = getOpenAIService();

  const userMessage = [
    ws.clientName ? `Client/Product: ${ws.clientName}` : '',
    `Source document count: ${sourceDocs.length}`,
    '',
    ws.transcriptText,
  ].filter(Boolean).join('\n');

  await appendLog(workspaceId, `  Sending to GPT-4o for story map extraction (est. ${Math.round(charCount / 4).toLocaleString()} tokens)...`);

  const result = await openai.generateStructuredCompletion<UserStoryMapResult>(
    [
      { role: 'system', content: USER_STORY_GENERATION_PROMPT },
      { role: 'user', content: userMessage },
    ],
    undefined,
    0.6,
  );

  await prisma.workspace.update({
    where: { workspaceId },
    data: {
      analysisStatus: 'completed',
      analysisResult: JSON.stringify(result),
    },
  });

  // Log extraction stats
  const totalStories = result.backbone.reduce(
    (sum, act) => sum + act.steps.reduce((s, step) => s + step.stories.length, 0), 0,
  );
  await appendLog(workspaceId, `  Story map results:`);
  await appendLog(workspaceId, `    - Activities (backbone): ${result.backbone.length}`);
  await appendLog(workspaceId, `    - Total user stories: ${totalStories}`);
  await appendLog(workspaceId, `    - Releases defined: ${result.releases?.length ?? 0}`);
  await appendLog(workspaceId, `    - Risks identified: ${result.risks?.length ?? 0}`);

  return result;
}

// ---------------------------------------------------------------------------
// User Story Generation — Stage 2: Miro Story Map Board
// ---------------------------------------------------------------------------

async function runStoryMapMiroBoardGeneration(
  workspaceId: string,
  analysis: UserStoryMapResult,
): Promise<MiroBoardSnapshot> {
  await prisma.workspace.update({
    where: { workspaceId },
    data: { status: 'miro_generating', miroStatus: 'running' },
  });

  const ws = await prisma.workspace.findUniqueOrThrow({
    where: { workspaceId },
    select: { clientName: true },
  });

  logger.info('[Workspace] Creating Story Map Miro board', { workspaceId });

  const boardName = `${ws.clientName || 'Product'} - Story Map: ${analysis.storyMapOverview?.title || 'User Stories'}`
    .replace(/[\n\r]/g, ' ')
    .substring(0, 60);
  const boardDesc = (analysis.summary || 'User Story Map')
    .replace(/[\n\r]/g, ' ')
    .substring(0, 300);

  let boardRes: any;
  try {
    boardRes = await axios.post(
      `${MIRO_API_BASE}/boards`,
      { name: boardName, description: boardDesc },
      { headers: miroHeaders() },
    );
  } catch (err: any) {
    const respData = err.response?.data ? JSON.stringify(err.response.data) : 'no response body';
    throw new Error(`Miro board creation failed (${err.response?.status}): ${respData}`);
  }

  const boardId = boardRes.data.id;
  const boardUrl = boardRes.data.viewLink || `https://miro.com/app/board/${boardId}/`;

  await appendLog(workspaceId, `  Board created: ${boardName}`);
  await appendLog(workspaceId, `  Board URL: ${boardUrl}`);

  const frames: MiroFrame[] = [];

  // Reusable helpers (same API as existing ones but scoped to this board)
  async function createFrame(title: string, x: number, y: number, width = 2000, height = 1500): Promise<string> {
    const res = await axios.post(
      `${MIRO_API_BASE}/boards/${boardId}/frames`,
      { data: { title, format: 'custom', type: 'freeform' }, position: { x, y }, geometry: { width, height } },
      { headers: miroHeaders() },
    );
    return res.data.id;
  }

  async function createStickyNote(content: string, x: number, y: number, color = 'light_yellow', parentFrameId?: string): Promise<MiroItem> {
    await axios.post(
      `${MIRO_API_BASE}/boards/${boardId}/sticky_notes`,
      {
        data: { content: content.substring(0, 500), shape: 'square' },
        style: { fillColor: color },
        position: { x, y },
        ...(parentFrameId ? { parent: { id: parentFrameId } } : {}),
      },
      { headers: miroHeaders() },
    );
    return { type: 'sticky_note', content, color, position: { x, y } };
  }

  // Layout constants
  const COL_WIDTH = 400;
  const COL_GAP = 50;

  // Calculate total columns (sum of steps across all activities)
  let totalColumns = 0;
  for (const activity of analysis.backbone) {
    totalColumns += Math.max(activity.steps.length, 1);
  }

  const frameWidth = Math.max(3000, totalColumns * (COL_WIDTH + COL_GAP) + 400);
  const frameHeight = 4000;

  // Frame 1: Story Map (main)
  await appendLog(workspaceId, `  Creating frame 1/3: Story Map (${analysis.backbone.length} activities, ${totalColumns} columns)`);
  const mainFrameId = await createFrame(`Story Map: ${analysis.storyMapOverview?.title || ''}`, 0, 0, frameWidth, frameHeight);
  const mainItems: MiroItem[] = [];

  const priorityColors: Record<string, string> = {
    must_have: 'light_green',
    should_have: 'yellow',
    could_have: 'light_pink',
    wont_have: 'gray',
  };

  let currentX = 200;
  for (const activity of analysis.backbone) {
    const activityStartX = currentX;
    const stepsCount = Math.max(activity.steps.length, 1);
    const activityWidth = stepsCount * (COL_WIDTH + COL_GAP);

    // Activity card (backbone row)
    const actItem = await createStickyNote(
      `${activity.activityId}: ${activity.activity}\n\n${activity.description}`,
      activityStartX + activityWidth / 2 - COL_WIDTH / 2,
      100,
      'dark_blue',
      mainFrameId,
    );
    mainItems.push(actItem);

    // Steps (walking skeleton row) + stories below
    for (const step of activity.steps) {
      const stepItem = await createStickyNote(
        `${step.stepId}: ${step.step}\n${step.description}`,
        currentX, 400, 'light_blue', mainFrameId,
      );
      mainItems.push(stepItem);

      // Stories stacked by priority
      let storyY = 750;
      const priorityOrder = ['must_have', 'should_have', 'could_have', 'wont_have'];
      for (const priority of priorityOrder) {
        const storiesForPriority = step.stories.filter((s) => s.priority === priority);
        for (const story of storiesForPriority) {
          const storyContent = `${story.title}\n\n${story.userStory}\n\nEffort: ${story.estimatedEffort} | ${story.release}`;
          const storyItem = await createStickyNote(
            storyContent, currentX, storyY,
            priorityColors[priority] || 'light_yellow', mainFrameId,
          );
          mainItems.push(storyItem);
          storyY += 280;
        }
      }

      currentX += COL_WIDTH + COL_GAP;
    }
    currentX += 100; // Extra gap between activities
  }
  frames.push({ frameId: mainFrameId, title: 'Story Map', items: mainItems });

  // Frame 2: Release Plan
  await appendLog(workspaceId, `  Creating frame 2/3: Release Plan (${analysis.releases?.length ?? 0} releases)`);
  const releaseFrameId = await createFrame('Release Plan', 0, frameHeight + 200, 2500, 800);
  const releaseItems: MiroItem[] = [];
  for (let i = 0; i < (analysis.releases?.length ?? 0); i++) {
    const rel = analysis.releases[i];
    const relItem = await createStickyNote(
      `${rel.name}\n${rel.goal}\n\nStories: ${rel.storyCount}\nDuration: ${rel.estimatedDuration}`,
      200 + i * 500, 200, 'cyan', releaseFrameId,
    );
    releaseItems.push(relItem);
  }
  frames.push({ frameId: releaseFrameId, title: 'Release Plan', items: releaseItems });

  // Frame 3: Risks & Assumptions
  await appendLog(workspaceId, `  Creating frame 3/3: Risks & Assumptions (${analysis.risks?.length ?? 0} risks)`);
  const risksFrameId = await createFrame('Risks & Assumptions', 2700, frameHeight + 200, 2000, 800);
  const riskItems: MiroItem[] = [];
  for (let i = 0; i < (analysis.risks?.length ?? 0); i++) {
    const risk = analysis.risks[i];
    const color = risk.impact === 'high' ? 'red' : risk.impact === 'medium' ? 'yellow' : 'light_green';
    const riskItem = await createStickyNote(
      `${risk.risk}\n\nImpact: ${risk.impact}\nMitigation: ${risk.mitigation}`,
      200 + (i % 3) * 500, 200 + Math.floor(i / 3) * 280, color, risksFrameId,
    );
    riskItems.push(riskItem);
  }
  frames.push({ frameId: risksFrameId, title: 'Risks & Assumptions', items: riskItems });

  const snapshot: MiroBoardSnapshot = { boardId, boardUrl, frames };

  await prisma.workspace.update({
    where: { workspaceId },
    data: {
      miroStatus: 'completed',
      miroBoardId: boardId,
      miroBoardUrl: boardUrl,
      miroSnapshot: JSON.stringify(snapshot),
    },
  });

  logger.info('[Workspace] Story Map Miro board created', { workspaceId, boardId, boardUrl });
  return snapshot;
}

// ---------------------------------------------------------------------------
// User Story Generation — Stage 3: PPTX
// ---------------------------------------------------------------------------

async function runUserStoryPptxGeneration(
  workspaceId: string,
  analysis: UserStoryMapResult,
): Promise<string> {
  await prisma.workspace.update({
    where: { workspaceId },
    data: { status: 'pptx_generating', pptxStatus: 'running' },
  });

  const ws = await prisma.workspace.findUniqueOrThrow({
    where: { workspaceId },
    select: { clientName: true, name: true, requestedBy: true },
  });

  logger.info('[Workspace] Generating User Story PPTX', { workspaceId });

  await appendLog(workspaceId, `  Building slide content from story map...`);
  const slides = buildUserStorySlides(analysis, ws.clientName || undefined);
  await appendLog(workspaceId, `  Generated ${slides.length} slides`);

  const presentationData = {
    presentation_metadata: {
      title: analysis.storyMapOverview?.title || ws.name,
    },
    slides,
  };

  let templatePath: string;
  try {
    const templateManager = new TemplateManagerService();
    templatePath = templateManager.getTemplatePath();
    await appendLog(workspaceId, `  Using template: ${templatePath.split('/').pop()}`);
  } catch {
    throw new Error('No PPTX template configured.');
  }

  await appendLog(workspaceId, `  Rendering PowerPoint file...`);
  const pptxBuffer = await generatePPTXBuffer(presentationData, templatePath);
  await appendLog(workspaceId, `  PPTX rendered: ${(pptxBuffer.length / 1024).toFixed(0)} KB`);

  const jobId = randomUUID();
  let outputFile = '';
  let outputFileSize = 0;

  if (isPptxStorageConfigured()) {
    await appendLog(workspaceId, `  Uploading to S3...`);
    const uploadResult = await uploadPptxToS3({
      buffer: pptxBuffer,
      filename: `user-stories-${ws.clientName || 'product'}.pptx`,
      metadata: { workspaceId, source: 'workspace-pipeline' },
    });
    outputFile = uploadResult.key;
    outputFileSize = pptxBuffer.length;
    await appendLog(workspaceId, `  Uploaded: ${outputFile}`);
  } else {
    await appendLog(workspaceId, `  S3 not configured — PPTX stored in database only`);
  }

  await prisma.pptxJob.create({
    data: {
      jobId,
      status: 'completed',
      requestedBy: ws.requestedBy,
      analysisType: 'user_story_generation',
      templateName: 'default',
      outputFile,
      outputFileSize,
      slideCount: slides.length,
      presentationData: JSON.stringify(presentationData),
      completedAt: new Date(),
    },
  });

  await prisma.workspace.update({
    where: { workspaceId },
    data: { pptxStatus: 'completed', pptxJobId: jobId },
  });

  logger.info('[Workspace] User Story PPTX generated', { workspaceId, jobId, slideCount: slides.length });
  return jobId;
}

// ---------------------------------------------------------------------------
// User Story slide builder
// ---------------------------------------------------------------------------

function buildUserStorySlides(analysis: UserStoryMapResult, clientName?: string): ContentSlide[] {
  const slides: ContentSlide[] = [];

  // 1. Title
  slides.push({
    slide_title: analysis.storyMapOverview?.title || 'User Story Map',
    content_sections: [
      clientName ? `Prepared for: ${clientName}` : '',
      `Product Vision: ${analysis.storyMapOverview?.productVision || ''}`,
    ].filter(Boolean),
  });

  // 2. Target Users
  if (analysis.storyMapOverview?.targetUsers?.length) {
    slides.push({
      slide_title: 'Target Users',
      content_sections: analysis.storyMapOverview.targetUsers.map(
        (u) => `${u.persona}\n${u.description}\nGoals: ${u.goals.join(', ')}`,
      ),
    });
  }

  // 3. Executive Summary
  if (analysis.summary) {
    slides.push({
      slide_title: 'Executive Summary',
      content_sections: [analysis.summary],
    });
  }

  // 4. Story Map Overview
  slides.push({
    slide_title: 'Story Map Overview',
    content_sections: analysis.backbone.map(
      (act) => `${act.activity} (${act.steps.length} steps, ${act.steps.reduce((s, st) => s + st.stories.length, 0)} stories)`,
    ),
    visual_directives: {
      type: 'table',
      data_specification: {
        structure: 'table',
        table: {
          headers: ['Activity', 'Steps', 'Stories', 'Primary Persona'],
          rows: analysis.backbone.map((act) => [
            act.activity,
            String(act.steps.length),
            String(act.steps.reduce((s, st) => s + st.stories.length, 0)),
            act.persona,
          ]),
        },
      },
    },
  });

  // 5-N. One slide per epic
  for (const activity of analysis.backbone) {
    slides.push({
      slide_title: `Epic: ${activity.activity}`,
      content_sections: [
        activity.description,
        '',
        ...activity.steps.map(
          (step) => `${step.step}\n${step.stories.map((s) => `  - [${s.priority.replace('_', ' ')}] ${s.title} (${s.estimatedEffort})`).join('\n')}`,
        ),
      ],
    });
  }

  // Release Plan
  if (analysis.releases?.length) {
    slides.push({
      slide_title: 'Release Plan',
      content_sections: analysis.releases.map(
        (r) => `${r.name}\n${r.goal}\nStories: ${r.storyCount} | Duration: ${r.estimatedDuration}`,
      ),
      visual_directives: {
        type: 'timeline',
        data_specification: {
          structure: 'timeline',
          phases: analysis.releases.map((r) => ({
            name: r.name,
            duration: r.estimatedDuration,
            tasks: [r.goal],
          })),
        },
      },
    });
  }

  // Risks
  if (analysis.risks?.length) {
    slides.push({
      slide_title: 'Risks & Mitigations',
      content_sections: analysis.risks.map(
        (r) => `${r.risk} [${(r.impact || 'medium').toUpperCase()}]\nMitigation: ${r.mitigation}`,
      ),
    });
  }

  // Next Steps
  slides.push({
    slide_title: 'Next Steps',
    content_sections: [
      'Review the story map with the product team.',
      'Validate user personas and acceptance criteria with stakeholders.',
      'Prioritize MVP stories for sprint planning.',
      'Begin detailed estimation sessions.',
    ],
  });

  return slides;
}

// ---------------------------------------------------------------------------
// Workshop Preparation — Analysis (with company research)
// ---------------------------------------------------------------------------

async function runWorkshopPrepAnalysis(workspaceId: string): Promise<WorkshopPrepResult> {
  await prisma.workspace.update({
    where: { workspaceId },
    data: { status: 'analyzing', analysisStatus: 'running' },
  });

  const ws = await prisma.workspace.findUniqueOrThrow({
    where: { workspaceId },
    select: { transcriptText: true, clientName: true },
  });

  if (!ws.transcriptText) {
    throw new Error('No survey content found for this workspace. Upload survey documents first.');
  }

  const wordCount = ws.transcriptText.split(/\s+/).length;
  await appendLog(workspaceId, `  Survey content loaded: ${wordCount.toLocaleString()} words`);
  await appendLog(workspaceId, `  Company: ${ws.clientName || '(not specified)'}`);

  // Run company research if clientName is available
  let companyResearchContext = '';
  if (ws.clientName) {
    try {
      await appendLog(workspaceId, `  Running company research for "${ws.clientName}"...`);
      const researchService = getResearchService();
      const researchSessionId = randomUUID();
      const researchResult = await researchService.runResearchPipeline(
        { companyName: ws.clientName },
        researchSessionId,
      );
      // Extract the most useful research fields for the prompt
      const researchData = {
        executiveSummary: researchResult?.executiveSummary || '',
        companyIntelligence: researchResult?.companyIntelligence || {},
        stakeholderInsights: researchResult?.stakeholderInsights || {},
      };
      companyResearchContext = JSON.stringify(researchData, null, 2);
      await appendLog(workspaceId, `  Company research completed successfully`);
    } catch (researchErr: any) {
      logger.warn(`[Workspace] Company research failed: ${researchErr.message}`, { workspaceId });
      await appendLog(workspaceId, `  Company research failed (continuing without): ${researchErr.message}`);
    }
  } else {
    await appendLog(workspaceId, `  No company name set — skipping company research`);
  }

  const openai = getOpenAIService();

  const userMessage = [
    '### SURVEY CONTENT',
    ws.transcriptText,
    '',
    companyResearchContext ? '### COMPANY RESEARCH' : '',
    companyResearchContext || '(No company research available)',
  ].join('\n');

  await appendLog(workspaceId, `  Sending to GPT-4o for workshop prep synthesis...`);

  const result = await openai.generateStructuredCompletion<WorkshopPrepResult>(
    [
      { role: 'system', content: WORKSHOP_PREP_PROMPT },
      { role: 'user', content: userMessage },
    ],
    undefined,
    0.6,
  );

  await prisma.workspace.update({
    where: { workspaceId },
    data: {
      analysisStatus: 'completed',
      analysisResult: JSON.stringify(result),
    },
  });

  await appendLog(workspaceId, `  Workshop prep results:`);
  await appendLog(workspaceId, `    - Title: ${result.workshopPlan?.title || 'Untitled'}`);
  await appendLog(workspaceId, `    - Agenda sessions: ${result.agenda?.length ?? 0}`);
  await appendLog(workspaceId, `    - Survey insights: ${result.surveyInsights?.length ?? 0}`);
  await appendLog(workspaceId, `    - Talking points: ${result.talkingPoints?.length ?? 0}`);
  await appendLog(workspaceId, `    - Risks: ${result.risksMitigations?.length ?? 0}`);

  return result;
}

// ---------------------------------------------------------------------------
// Workshop Preparation — Slide builder
// ---------------------------------------------------------------------------

function buildWorkshopPrepSlides(analysis: WorkshopPrepResult, clientName?: string): ContentSlide[] {
  const slides: ContentSlide[] = [];

  // --- 1. Title slide ---
  slides.push({
    slide_title: analysis.workshopPlan?.title || 'Workshop Preparation',
    content_sections: [
      clientName ? `Prepared for: ${clientName}` : '',
      analysis.workshopPlan?.objective || '',
      analysis.workshopPlan?.duration ? `Duration: ${analysis.workshopPlan.duration}` : '',
      analysis.workshopPlan?.targetAudience ? `Audience: ${analysis.workshopPlan.targetAudience}` : '',
    ].filter(Boolean),
    visual_directives: {
      type: 'image',
      image_prompt: `Professional corporate workshop title slide background, modern abstract design with subtle geometric shapes, dark blue and teal gradient, clean and minimal, business presentation style, no text`,
    },
    speaker_notes: 'Title slide for the workshop preparation deck.',
  });

  // --- 2. Executive Summary ---
  if (analysis.summary) {
    // Split long summary into 2 paragraphs per slide
    const paragraphs = analysis.summary.split('\n').filter(Boolean);
    const chunkSize = 2;
    for (let i = 0; i < paragraphs.length; i += chunkSize) {
      const chunk = paragraphs.slice(i, i + chunkSize);
      slides.push({
        slide_title: i === 0 ? 'Executive Summary' : 'Executive Summary (cont.)',
        content_sections: chunk,
        speaker_notes: 'High-level executive summary of workshop preparation.',
      });
    }
  }

  // --- 3. Company Context — split into overview + challenges ---
  if (analysis.companyContext) {
    // Slide A: Company Overview
    slides.push({
      slide_title: `About ${clientName || 'the Company'}`,
      content_sections: [
        analysis.companyContext.companyOverview,
        '',
        `Industry: ${analysis.companyContext.industry}`,
        '',
        `Current State: ${analysis.companyContext.currentState}`,
      ].filter(Boolean),
      visual_directives: {
        type: 'image',
        image_prompt: `Professional infographic style illustration representing ${analysis.companyContext.industry} industry, modern flat design, corporate colors blue and gray, abstract buildings and data visualization elements, no text`,
      },
      speaker_notes: 'Background research on the company to contextualize the workshop.',
    });

    // Slide B: Challenges & Recent Developments
    const challengeSections: string[] = [];
    if (analysis.companyContext.challenges?.length) {
      challengeSections.push('Key Challenges:', ...analysis.companyContext.challenges.map((c) => `• ${c}`));
    }
    if ((analysis.companyContext.recentDevelopments?.length ?? 0) > 0) {
      challengeSections.push('', 'Recent Developments:', ...analysis.companyContext.recentDevelopments!.map((d) => `• ${d}`));
    }
    if (challengeSections.length) {
      slides.push({
        slide_title: 'Challenges & Landscape',
        content_sections: challengeSections,
        speaker_notes: 'Key challenges facing the company that inform workshop design.',
      });
    }
  }

  // --- 4. Survey Insights — max 3 per slide ---
  if (analysis.surveyInsights?.length) {
    const insightsPerSlide = 3;
    for (let i = 0; i < analysis.surveyInsights.length; i += insightsPerSlide) {
      const chunk = analysis.surveyInsights.slice(i, i + insightsPerSlide);
      const slideNum = Math.floor(i / insightsPerSlide) + 1;
      const totalSlides = Math.ceil(analysis.surveyInsights.length / insightsPerSlide);

      slides.push({
        slide_title: totalSlides > 1
          ? `Survey Insights (${slideNum}/${totalSlides})`
          : 'Survey Insights',
        content_sections: chunk.map(
          (s) => `${s.theme}\n${s.findings}`
        ),
        speaker_notes: `Survey themes: ${chunk.map((s) => s.theme).join(', ')}. ` +
          chunk.map((s) => `${s.theme}: ${s.implications}`).join(' '),
      });
    }

    // Survey insights table summary
    slides.push({
      slide_title: 'Survey Insights — Action Matrix',
      content_sections: analysis.surveyInsights.map(
        (s) => `${s.theme}: ${s.suggestedFocus}`,
      ),
      visual_directives: {
        type: 'table',
        data_specification: {
          structure: 'table',
          table: {
            headers: ['Theme', 'Key Finding', 'Suggested Focus'],
            rows: analysis.surveyInsights.map((s) => [
              s.theme,
              s.findings.substring(0, 80) + (s.findings.length > 80 ? '...' : ''),
              s.suggestedFocus,
            ]),
          },
        },
      },
      speaker_notes: 'Summary table mapping survey themes to recommended workshop focus areas.',
    });
  }

  // --- 5. Workshop Agenda — timeline overview ---
  if (analysis.agenda?.length) {
    slides.push({
      slide_title: 'Workshop Agenda',
      content_sections: analysis.agenda.map(
        (s) => `${s.sessionTitle} — ${s.duration}`
      ),
      visual_directives: {
        type: 'timeline',
        data_specification: {
          structure: 'timeline',
          phases: analysis.agenda.map((s) => ({
            name: s.sessionTitle,
            duration: s.duration,
            tasks: [s.objective],
          })),
        },
      },
      speaker_notes: 'High-level agenda overview. Each session is detailed in the following slides.',
    });
  }

  // --- 6. Session Detail slides — split exercises & discussion to separate slides if needed ---
  for (const session of (analysis.agenda || [])) {
    // Session overview slide
    slides.push({
      slide_title: session.sessionTitle,
      content_sections: [
        `Duration: ${session.duration}`,
        '',
        `Objective: ${session.objective}`,
        '',
        'Facilitator Notes:',
        session.facilitatorNotes,
      ],
      visual_directives: {
        type: 'image',
        image_prompt: `Minimalist abstract illustration for a workshop session about "${session.sessionTitle}", professional corporate style, soft gradient background, geometric icons representing collaboration and strategy, no text`,
      },
      speaker_notes: session.facilitatorNotes,
    });

    // Exercises slide (separate to avoid overcrowding)
    if (session.exercises?.length) {
      slides.push({
        slide_title: `${session.sessionTitle} — Exercises`,
        content_sections: session.exercises.map((e, i) => `Exercise ${i + 1}: ${e}`),
        speaker_notes: `Hands-on exercises for the "${session.sessionTitle}" session.`,
      });
    }

    // Discussion Questions slide (separate)
    if (session.discussionQuestions?.length) {
      slides.push({
        slide_title: `${session.sessionTitle} — Discussion Questions`,
        content_sections: session.discussionQuestions.map((q) => `• ${q}`),
        speaker_notes: `Discussion prompts for the "${session.sessionTitle}" session.`,
      });
    }

    // Required materials (combine with the session if short, or note in speaker notes)
    if (session.requiredMaterials?.length) {
      // Add to speaker notes of the session overview slide
      const materialsNote = `Required materials: ${session.requiredMaterials.join(', ')}`;
      const lastSlideIdx = slides.length - 1;
      slides[lastSlideIdx].speaker_notes =
        (slides[lastSlideIdx].speaker_notes || '') + '\n\n' + materialsNote;
    }
  }

  // --- 7. Talking Points — max 2 topics per slide ---
  if (analysis.talkingPoints?.length) {
    const tpPerSlide = 2;
    for (let i = 0; i < analysis.talkingPoints.length; i += tpPerSlide) {
      const chunk = analysis.talkingPoints.slice(i, i + tpPerSlide);
      const slideNum = Math.floor(i / tpPerSlide) + 1;
      const totalSlides = Math.ceil(analysis.talkingPoints.length / tpPerSlide);

      slides.push({
        slide_title: totalSlides > 1
          ? `Talking Points (${slideNum}/${totalSlides})`
          : 'Talking Points',
        content_sections: chunk.map(
          (tp) => `${tp.topic}\n${tp.points.slice(0, 4).map((p) => `  • ${p}`).join('\n')}`
        ),
        speaker_notes: chunk.map(
          (tp) => `${tp.topic} — Research context: ${tp.contextFromResearch}`
        ).join('\n\n'),
      });
    }
  }

  // --- 8. Preparation Checklist — chunk if long ---
  if (analysis.preparationChecklist?.length) {
    const checklistPerSlide = 8;
    for (let i = 0; i < analysis.preparationChecklist.length; i += checklistPerSlide) {
      const chunk = analysis.preparationChecklist.slice(i, i + checklistPerSlide);
      const isMulti = analysis.preparationChecklist.length > checklistPerSlide;
      const slideNum = Math.floor(i / checklistPerSlide) + 1;
      const totalSlides = Math.ceil(analysis.preparationChecklist.length / checklistPerSlide);

      slides.push({
        slide_title: isMulti
          ? `Preparation Checklist (${slideNum}/${totalSlides})`
          : 'Preparation Checklist',
        content_sections: chunk.map((item, idx) => `${i + idx + 1}. ${item}`),
        speaker_notes: 'Pre-workshop preparation checklist for the facilitator.',
      });
    }
  }

  // --- 9. Risks & Mitigations — table format ---
  if (analysis.risksMitigations?.length) {
    slides.push({
      slide_title: 'Risks & Mitigations',
      content_sections: analysis.risksMitigations.map(
        (r) => `${r.risk} [${(r.likelihood || 'medium').toUpperCase()}] → ${r.mitigation}`
      ),
      visual_directives: {
        type: 'table',
        data_specification: {
          structure: 'table',
          table: {
            headers: ['Risk', 'Likelihood', 'Mitigation Strategy'],
            rows: analysis.risksMitigations.map((r) => [
              r.risk,
              (r.likelihood || 'medium').toUpperCase(),
              r.mitigation,
            ]),
          },
        },
      },
      speaker_notes: 'Identified risks to workshop success and concrete mitigation strategies.',
    });
  }

  // --- 10. Expected Outcomes ---
  if (analysis.workshopPlan?.expectedOutcomes?.length) {
    slides.push({
      slide_title: 'Expected Outcomes',
      content_sections: analysis.workshopPlan.expectedOutcomes.map((o) => `• ${o}`),
      visual_directives: {
        type: 'image',
        image_prompt: `Professional illustration of business goals and outcomes being achieved, abstract target with checkmarks, modern corporate style, blue and green tones, clean minimal design, no text`,
      },
      speaker_notes: 'Measurable outcomes expected from a successful workshop delivery.',
    });
  }

  // --- 11. Closing slide ---
  slides.push({
    slide_title: 'Ready to Begin',
    content_sections: [
      `This workshop preparation deck covers ${analysis.surveyInsights?.length || 0} survey themes, ${analysis.agenda?.length || 0} agenda sessions, and ${analysis.talkingPoints?.length || 0} contextualized talking points.`,
      '',
      'All content has been tailored using pre-workshop survey responses and company research.',
      '',
      clientName ? `Prepared for: ${clientName}` : '',
    ].filter(Boolean),
    speaker_notes: 'Closing slide. The facilitator should review all materials and the preparation checklist before the workshop.',
  });

  return slides;
}

// ---------------------------------------------------------------------------
// Workshop Preparation — PPTX Generation
// ---------------------------------------------------------------------------

async function runWorkshopPrepPptxGeneration(
  workspaceId: string,
  analysis: WorkshopPrepResult,
): Promise<string> {
  await prisma.workspace.update({
    where: { workspaceId },
    data: { status: 'pptx_generating', pptxStatus: 'running' },
  });

  const ws = await prisma.workspace.findUniqueOrThrow({
    where: { workspaceId },
    select: { clientName: true, name: true, requestedBy: true },
  });

  logger.info('[Workspace] Generating Workshop Prep PPTX', { workspaceId });

  await appendLog(workspaceId, `  Building slide content from workshop prep analysis...`);
  const slides = buildWorkshopPrepSlides(analysis, ws.clientName || undefined);
  await appendLog(workspaceId, `  Generated ${slides.length} slides`);

  const presentationData = {
    presentation_metadata: {
      title: analysis.workshopPlan?.title || ws.name,
    },
    slides,
  };

  let templatePath: string;
  try {
    const templateManager = new TemplateManagerService();
    templatePath = templateManager.getTemplatePath();
    await appendLog(workspaceId, `  Using template: ${templatePath.split('/').pop()}`);
  } catch {
    throw new Error(
      'No PPTX template configured. Set TEMPLATE_REGISTRY_PATH or add a templates.json to the backend directory.',
    );
  }

  await appendLog(workspaceId, `  Rendering PowerPoint file...`);
  const pptxBuffer = await generatePPTXBuffer(presentationData, templatePath);
  await appendLog(workspaceId, `  PPTX rendered: ${(pptxBuffer.length / 1024).toFixed(0)} KB`);

  const jobId = randomUUID();
  let outputFile = '';
  let outputFileSize = 0;

  if (isPptxStorageConfigured()) {
    await appendLog(workspaceId, `  Uploading to S3...`);
    const uploadResult = await uploadPptxToS3({
      buffer: pptxBuffer,
      filename: `workshop-prep-${ws.clientName || 'workshop'}.pptx`,
      metadata: { workspaceId, source: 'workspace-pipeline' },
    });
    outputFile = uploadResult.key;
    outputFileSize = pptxBuffer.length;
    await appendLog(workspaceId, `  Uploaded: ${outputFile}`);
  } else {
    await appendLog(workspaceId, `  S3 not configured — PPTX stored in database only`);
  }

  await prisma.pptxJob.create({
    data: {
      jobId,
      status: 'completed',
      requestedBy: ws.requestedBy,
      analysisType: 'workshop_prep',
      templateName: 'default',
      outputFile,
      outputFileSize,
      slideCount: slides.length,
      presentationData: JSON.stringify(presentationData),
      completedAt: new Date(),
    },
  });

  await prisma.workspace.update({
    where: { workspaceId },
    data: { pptxStatus: 'completed', pptxJobId: jobId },
  });

  logger.info('[Workspace] Workshop Prep PPTX generated', { workspaceId, jobId, slideCount: slides.length });
  return jobId;
}

// ---------------------------------------------------------------------------
// Cancel helper (called from routes)
// ---------------------------------------------------------------------------

export async function cancelWorkspacePipeline(workspaceId: string): Promise<void> {
  await prisma.workspace.update({
    where: { workspaceId },
    data: { status: 'cancelled' },
  });
}
