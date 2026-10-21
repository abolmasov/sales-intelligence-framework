/**
 * Workshop Prep Slide Deck Service
 *
 * Generates an AI-driven pre-workshop facilitation deck in 5 batches,
 * mirroring the 9-zone Miro board structure. Progress is tracked per batch
 * so the frontend can show real-time generation status.
 */

import { randomUUID } from 'crypto';
import { getPrismaClient } from '../config/database';
import { getLoggerService } from './logger.service';
import { getOpenAIService } from './openai.service';
import { generatePPTXBuffer } from './pptxGeneration.service';
import { uploadPptxToS3, isPptxStorageConfigured } from './pptxStorage.service';
import { TemplateManagerService } from './templateManager.service';
import type { ClientIntelligenceResult, SurveyResponses } from '../../../shared/types/workspace';

const prisma = getPrismaClient();
const logger = getLoggerService();

// Step keys emitted during generation — must match DECK_STEPS in WorkspacesPage.tsx
export const PPTX_STEP = {
  BATCH_COVER_Z1: 'batch_cover_z1',
  BATCH_Z2_Z3: 'batch_z2_z3',
  BATCH_Z4_Z5: 'batch_z4_z5',
  BATCH_Z6_Z7: 'batch_z6_z7',
  BATCH_Z8_CLOSE: 'batch_z8_close',
  RENDERING: 'rendering',
  UPLOADING: 'uploading',
} as const;

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

async function setStep(workspaceId: string, step: string) {
  try {
    await prisma.workspace.update({
      where: { workspaceId },
      data: { workshopPrepPptxStep: step } as any,
    });
  } catch { /* non-fatal */ }
}

interface ContentSlide {
  slide_title: string;
  content_sections: string[];
  visual_directives?: any;
  speaker_notes?: string;
}

const COMMON_RULES = (clientName: string) => `
## Mandatory Rules
1. Zero generic consulting filler — every bullet references ${clientName}'s specific context, systems, or known challenges
2. All table slides must have fully populated rows — no "[Example]" placeholders
3. Speaker notes per slide: 150–200 words structured as: (a) Talking points, (b) Facilitation tip, (c) Transition to next slide/zone
4. Section divider slides always include a visual_directives.image_prompt (60–80 words, premium consulting aesthetic)
5. Persona names must be realistic first names + descriptive role titles grounded in ${clientName}'s industry
6. Return {"slides": [...]} — each slide: slide_title, slide_type (cover|section_divider|content|table|matrix), zone, content_sections (array of strings), speaker_notes, visual_directives
`;

const SLIDE_SCHEMA = `{
  "slide_title": "string",
  "slide_type": "cover|section_divider|content|table|matrix",
  "zone": "string",
  "content_sections": ["bullet/paragraph as separate strings"],
  "speaker_notes": "string — 150-200 words",
  "visual_directives": {
    "type": "image|table|matrix",
    "image_prompt": "DALL-E 3 prompt for section dividers",
    "data_specification": {
      "structure": "table|matrix",
      "table": { "headers": ["col1",...], "rows": [["cell1",...]] },
      "matrix": {
        "quadrants": {
          "quick_win": ["use case names"],
          "strategic_bet": ["use case names"],
          "foundation": ["use case names"],
          "evaluate_later": ["use case names"]
        }
      }
    }
  }
}`;

async function generateBatch(
  batchLabel: string,
  clientName: string,
  intelJson: string,
  surveyJson: string,
  instructions: string,
): Promise<ContentSlide[]> {
  const openai = getOpenAIService();

  const prompt = `You are a Principal Solution Consultant and Executive Facilitator at Northstar Integrators building slides for an AI-First Service Transformation Workshop pre-read deck for **${clientName}**.

### Client Intelligence
${intelJson}

### Survey Responses
${surveyJson}

${COMMON_RULES(clientName)}

---

## Slides to Generate — ${batchLabel}

${instructions}

## JSON Schema for Each Slide
${SLIDE_SCHEMA}

Return {"slides": [...]} with ONLY the slides listed above. Do not include slides from other batches.`;

  const result = await openai.generateStructuredCompletion<{ slides: ContentSlide[] }>(
    [{ role: 'user', content: prompt }],
    undefined,
    0.75,
    { model: 'gpt-4o', maxTokens: 8000 },
  );

  return Array.isArray(result.slides) ? result.slides : [];
}

async function buildAllSlides(
  workspaceId: string,
  clientName: string,
  intelligence: ClientIntelligenceResult | null,
  surveyResponses: SurveyResponses | null,
): Promise<ContentSlide[]> {
  const intelJson = intelligence ? JSON.stringify(intelligence, null, 2).substring(0, 6000) : 'Not available';
  const surveyJson = surveyResponses ? JSON.stringify(surveyResponses, null, 2).substring(0, 3000) : 'Not available';

  // ── Batch 1: Cover + Zone 1 ──────────────────────────────────────────────
  await setStep(workspaceId, PPTX_STEP.BATCH_COVER_Z1);
  await appendLog(workspaceId, `[Prep PPTX] Batch 1/5: Cover + Zone 1 (Current State)...`);

  const batch1 = await generateBatch('Cover + Zone 1: Current State Assessment (9 slides)', clientName, intelJson, surveyJson, `
**Slide 1 — Cover (type: cover, zone: Cover)**
Title: "AI-First Service Transformation Workshop". Subtitle: "Facilitator Preparation & Pre-Read Deck". Client: "${clientName}". Tagline: "Prepared by Northstar Integrators | ServiceNow Center of Excellence". Footer: "Workshop Date: TBD | CONFIDENTIAL".
visual_directives.image_prompt: Dark navy/purple gradient with glowing AI neural network motif, premium consulting aesthetic, elegant typography space, 4K quality.

**Slide 2 — Executive Summary (type: content, zone: Cover)**
4-paragraph narrative specific to ${clientName}: Why this workshop now, what they stand to gain from AI transformation on ServiceNow, how this deck is organized, and what happens after the workshop. Reference their strategic context from intelligence data.

**Slide 3 — Workshop Agenda (type: content, zone: Cover)**
All 9 zones with one-line purpose each, time allocation (total 6 hours), plus pre-workshop and post-workshop milestones. Format as numbered list with time next to each zone.

**Slide 4 — How to Use This Deck (type: content, zone: Cover)**
3-column layout: Before Workshop / During Workshop / After Workshop. Explain the relationship between this deck (prep context) and the Miro board (live facilitation canvas).

**Slide 5 — Zone 1 Section Divider (type: section_divider, zone: Zone 1: Current State Assessment)**
Tagline: "Understanding where ${clientName} stands today before defining where AI can take them".
Include visual_directives.image_prompt: industrial operations center or data center, blue/teal tones, professional, data-rich environment aesthetic.

**Slide 6 — ServiceNow Platform Maturity (type: table, zone: Zone 1: Current State Assessment)**
Draw from intelligence.serviceNowMaturitySignals. Table headers: Module | Current Status | Maturity (1-5) | Key Gap | Fix Priority. Rows for: ITSM, HRSD, CSM, ITOM, SPM, Virtual Agent, Predictive Intelligence. Score each 1-5 based on intelligence signals.

**Slide 7 — CMDB & Data Health (type: content, zone: Zone 1: Current State Assessment)**
CMDB coverage estimate, CI relationship accuracy, discovery gaps, stale data risks based on intelligence. 3 specific data quality risks that will impede AI adoption. Include remediation priority for each.

**Slide 8 — Pain Point Landscape (type: table, zone: Zone 1: Current State Assessment)**
Draw from intelligence.painPointHypotheses and survey. Table headers: Pain Point | Affected Personas | Business Impact | Root Cause | AI-Ready?. Minimum 7 rows, ranked by severity. Make pain points specific to ${clientName}.

**Slide 9 — Current State Themes (type: content, zone: Zone 1: Current State Assessment)**
3 overarching themes that connect the pain points (e.g., "Fragmented Service Experience"). For each theme: name, evidence from intelligence, likely executive sponsor, estimated annual cost of inaction.
`);

  // ── Batch 2: Zone 2-3 ────────────────────────────────────────────────────
  await setStep(workspaceId, PPTX_STEP.BATCH_Z2_Z3);
  await appendLog(workspaceId, `[Prep PPTX] Batch 2/5: Zone 2 (Opportunities) + Zone 3 (Constraints)...`);

  const batch2 = await generateBatch('Zone 2: AI Opportunity Scoping + Zone 3: Constraints (7 slides)', clientName, intelJson, surveyJson, `
**Slide 10 — Zone 2 Section Divider (type: section_divider, zone: Zone 2: AI Opportunity Scoping)**
Tagline: "Mapping ${clientName}'s AI opportunity landscape across the ServiceNow platform".
visual_directives.image_prompt: bright future cityscape at dawn, interconnected glowing light nodes, AI opportunity landscape, optimistic forward-looking mood, deep blue and gold.

**Slide 11 — AI Opportunity Landscape (type: table, zone: Zone 2: AI Opportunity Scoping)**
6 AI opportunity areas for ${clientName}. Table headers: Opportunity | ServiceNow Capability | Maturity Required | Implementation Effort (S/M/L) | Expected Business Value | Quick Win?. Examples: Now Assist for ITSM, Predictive Intelligence, Virtual Agent, Process Automation, AI Search, AIOps.

**Slide 12 — Strategic Initiative Alignment (type: table, zone: Zone 2: AI Opportunity Scoping)**
Map intelligence.strategicInitiatives to AI capabilities. Table headers: Strategic Initiative | AI Lever | ServiceNow Module | Outcome KPI | Timeline. Draw from intelligence data.

**Slide 13 — Now Assist Capability Map (type: content, zone: Zone 2: AI Opportunity Scoping)**
Map Now Assist features (ITSM, HR, CSM, Dev) to ${clientName}'s priority domains. For each: specific use case, predicted productivity gain %, affected user population. Reference their known ServiceNow modules.

**Slide 14 — Zone 3 Section Divider (type: section_divider, zone: Zone 3: Constraints & Risk Landscape)**
Tagline: "Honest inventory of what must be resolved before AI initiatives can succeed".
visual_directives.image_prompt: structured amber/red tones environment, caution without alarm, risk management blueprint aesthetic, precision engineering visual.

**Slide 15 — Constraints Matrix (type: table, zone: Zone 3: Constraints & Risk Landscape)**
Table headers: Constraint | Type (Technical/Org/Regulatory/Financial) | Severity (H/M/L) | Mitigation Approach | Owner Hypothesis. Minimum 8 rows from intelligence.regulatoryContext, survey, maturity signals. Make constraints specific to ${clientName}.

**Slide 16 — AI Readiness Scorecard (type: content, zone: Zone 3: Constraints & Risk Landscape)**
Score ${clientName} across 5 dimensions: Data Quality, Integration Maturity, Change Management Capacity, Governance Readiness, Executive Sponsorship. Traffic light per dimension (Red/Amber/Green) with rationale. Overall score out of 100. Base scores on intelligence signals.
`);

  // ── Batch 3: Zone 4-5 ────────────────────────────────────────────────────
  await setStep(workspaceId, PPTX_STEP.BATCH_Z4_Z5);
  await appendLog(workspaceId, `[Prep PPTX] Batch 3/5: Zone 4 (Personas) + Zone 5 (Journey)...`);

  const batch3 = await generateBatch('Zone 4: Persona Development + Zone 5: Service Journey Blueprint (8 slides)', clientName, intelJson, surveyJson, `
**Slide 17 — Zone 4 Section Divider (type: section_divider, zone: Zone 4: Persona Development)**
Tagline: "Building empathy for the humans at the center of service transformation at ${clientName}".
visual_directives.image_prompt: diverse team of professionals in modern collaborative workspace, warm lighting, human-centered design aesthetic, genuine connection and empathy.

**Slide 18 — Persona Overview Grid (type: table, zone: Zone 4: Persona Development)**
4 personas predicted for ${clientName} based on intelligence + survey. Table headers: Persona Role | Primary Goal | Biggest Pain | Current Workaround | AI Moment That Matters | Success Metric. Make roles specific to ${clientName}'s industry and known teams.

**Slide 19 — Persona Deep Dive: Persona 1 (type: content, zone: Zone 4: Persona Development)**
Full persona card for a realistic persona (e.g., "Marcus — IT Operations Manager"). Include: day-in-life narrative (3 sentences), top 3 pain points with specifics, tools currently used, biggest frustration, what success looks like with AI, ideal AI interaction on ServiceNow.

**Slide 20 — Persona Deep Dive: Persona 2 (type: content, zone: Zone 4: Persona Development)**
Full persona card for a different persona (e.g., "Priya — Employee Experience Manager" or field service). Same format as Slide 19. Contrast with Persona 1 to show breadth of needs.

**Slide 21 — Personas 3 & 4 (type: content, zone: Zone 4: Persona Development)**
Two-column condensed format for Personas 3 and 4. Each includes: role title (with first name), primary pain, current workaround, AI opportunity on ServiceNow, critical success factor. Make them specific to ${clientName}.

**Slide 22 — Zone 5 Section Divider (type: section_divider, zone: Zone 5: Service Journey Blueprint)**
Tagline: "Mapping the end-to-end service experience to surface AI intervention points at ${clientName}".
visual_directives.image_prompt: journey map visualization, flowing timeline with nodes, teal and white, clean professional design, forward movement aesthetic.

**Slide 23 — As-Is Service Journey (type: table, zone: Zone 5: Service Journey Blueprint)**
End-to-end journey for ${clientName}'s highest-priority use case from intelligence. Stages: Trigger | Initiate | Identify | Clarify | Route | Resolve | Confirm | Learn. Table headers: Stage | User Action | System Action | Pain/Friction | Emotion | Time Spent. Mark AI intervention points with ⚡. Make stages specific to ${clientName}'s context.

**Slide 24 — Journey Friction Heatmap (type: content, zone: Zone 5: Service Journey Blueprint)**
Visual representation of highest-friction journey stages. For each high-friction stage (minimum 3): what causes it, who suffers most (persona name), what AI resolves, quantified time-waste estimate. Include a "time saved with AI" projection per stage.
`);

  // ── Batch 4: Zone 6-7 ────────────────────────────────────────────────────
  await setStep(workspaceId, PPTX_STEP.BATCH_Z6_Z7);
  await appendLog(workspaceId, `[Prep PPTX] Batch 4/5: Zone 6 (TISDA) + Zone 7 (Ideation)...`);

  const batch4 = await generateBatch('Zone 6: TISDA Flow Mapping + Zone 7: Ideation (7 slides)', clientName, intelJson, surveyJson, `
**Slide 25 — Zone 6 Section Divider (type: section_divider, zone: Zone 6: TISDA Flow Mapping)**
Tagline: "The TISDA framework: how AI agents perceive, decide, and act in ${clientName}'s environment".
visual_directives.image_prompt: AI decision flow diagram, deep blue background with glowing neural pathways, Trigger→Intent→Signals→Decision→Action visualized, precision engineering aesthetic.

**Slide 26 — TISDA Framework Primer (type: content, zone: Zone 6: TISDA Flow Mapping)**
Explain each step: Trigger → Intent → Signals → Decision → Action. For each: definition (1 sentence), what it means for ServiceNow AI agents, concrete example from ${clientName}'s context. Include which ServiceNow agents handle each step (Virtual Agent, Predictive Intelligence, Decision Builder, Flow Designer).

**Slide 27 — TISDA Applied: Example 1 (type: table, zone: Zone 6: TISDA Flow Mapping)**
Apply TISDA to ${clientName}'s #1 pain point. Table headers: TISDA Step | Description for ${clientName} | Data Source | ServiceNow Capability | AI Agent | Expected Output. Make every cell specific to their context — not generic.

**Slide 28 — TISDA Applied: Example 2 (type: table, zone: Zone 6: TISDA Flow Mapping)**
Apply TISDA to a second distinct use case (HR self-service or proactive ITOM alerting). Same format as Slide 27. Highlight architectural differences from Example 1.

**Slide 29 — Zone 7 Section Divider (type: section_divider, zone: Zone 7: Ideation)**
Tagline: "Structured creative exploration: from unconstrained ideas to committed use case candidates".
visual_directives.image_prompt: colorful sticky notes explosion on a Miro-style digital board, warm energetic brainstorm atmosphere, creative divergence visualization.

**Slide 30 — How Might We Prompts (type: content, zone: Zone 7: Ideation)**
8 pre-seeded HMW prompts specific to ${clientName}'s challenges. Organize into 3 buckets: Employee Experience / IT Operations / Business Outcomes. For each HMW: the prompt + why it matters for ${clientName} + what a great answer would unlock. Make prompts specific — not generic ServiceNow prompts.

**Slide 31 — Ideation to Use Case Pathway (type: content, zone: Zone 7: Ideation)**
Explain Diverge → Shape → Commit with time allocation per phase. What distinguishes a "shaped" use case from a raw idea. Commit criteria framework: Strategic Fit, Data Readiness, Persona Impact, Feasibility Score, Executive Sponsorship.
`);

  // ── Batch 5: Zone 8-9 + Closing ─────────────────────────────────────────
  await setStep(workspaceId, PPTX_STEP.BATCH_Z8_CLOSE);
  await appendLog(workspaceId, `[Prep PPTX] Batch 5/5: Zone 8 (Use Cases) + Zone 9 (Matrix) + Closing...`);

  const batch5 = await generateBatch('Zone 8: Use Case Consolidation + Zone 9: Value-Feasibility Matrix + Closing (9 slides)', clientName, intelJson, surveyJson, `
**Slide 32 — Zone 8 Section Divider (type: section_divider, zone: Zone 8: Use Case Consolidation)**
Tagline: "Pre-built hypothesis use cases from Northstar Integrators's pre-workshop research — ready for ${clientName} to validate, refine, or reject".
visual_directives.image_prompt: structured workspace with organized prioritized cards, modern clean office aesthetic, systematic clarity and organization.

**Slide 33 — Hypothesis Use Cases Table (type: table, zone: Zone 8: Use Case Consolidation)**
7 hypothesis use cases for ${clientName}. Table headers: # | Use Case Title | Description (1 sentence) | Primary Persona(s) | ServiceNow OOTB Capability | Maturity Required | Priority Hypothesis. Give use cases punchy client-specific names (e.g., "Zero-Touch Incident Triage for [their ops team]"). Assign each a quadrant for the matrix: quick_win, strategic_bet, foundation, or evaluate_later.

**Slide 34 — Top 3 Use Case Deep Dive (type: content, zone: Zone 8: Use Case Consolidation)**
For the top 3 use cases from Slide 33: title, 3-sentence description, key TISDA elements, expected business KPI with numbers, implementation phase, executive sponsor hypothesis. Layout: 3 stacked cards.

**Slide 35 — Zone 9 Section Divider (type: section_divider, zone: Zone 9: Value-Feasibility Matrix)**
Tagline: "Plotting ${clientName}'s use case portfolio against business value and implementation feasibility".
visual_directives.image_prompt: executive strategy boardroom with 2x2 matrix on large screen, confident professionals making decisions, strategic clarity aesthetic.

**Slide 36 — Pre-Seeded Value–Feasibility Matrix (type: matrix, zone: Zone 9: Value-Feasibility Matrix)**
Place ALL 7 hypothesis use cases from Slide 33 into the 4 quadrants using visual_directives.data_specification.matrix.quadrants: quick_win (High Value, High Feasibility — 0-3 months), strategic_bet (High Value, Lower Feasibility — 6-12 months), foundation (Lower Value, High Feasibility — build to enable), evaluate_later (Lower Value, Lower Feasibility — deprioritize). For each use case in content_sections: rationale + what must be true to move quadrants.

**Slide 37 — Roadmap Preview (type: content, zone: Zone 9: Value-Feasibility Matrix)**
3-horizon roadmap from matrix placement. Horizon 1 (Q1-Q2 2025, Quick Wins): 2-3 initiatives. Horizon 2 (Q3 2025-Q1 2026, Strategic Bets): 2-3 initiatives. Horizon 3 (2026+, Platform Vision): 1-2 strategic outcomes. For each horizon: initiatives, success KPIs, key dependencies. Make dates specific.

**Slide 38 — Facilitator Playbook (type: content, zone: Closing)**
Facilitation techniques: time boxing per zone, managing dominant voices, handling tangents, energizing the group after lunch. Zone-by-zone energy map (which zones are high/low energy). 3 common workshop failure modes + how to prevent each. Co-facilitator coordination tips.

**Slide 39 — Post-Workshop Deliverables (type: content, zone: Closing)**
What Northstar Integrators delivers within 5 business days: AI Opportunity Readout Deck, Agent Architecture Blueprint, Value-Feasibility Prioritization Summary, 90-Day Roadmap, Deal Proposal Outline. For each deliverable: format, audience, key decisions it enables.

**Slide 40 — Next Steps & Contact (type: cover, zone: Closing)**
Action items before workshop: confirm date, distribute pre-read, connect system owners to Northstar Integrators technical leads. Placeholder team contacts: Lead Consultant, Solution Architect, Engagement Manager. Closing statement specific to ${clientName}'s transformation journey.
visual_directives.image_prompt: clean professional partnership closing visual, Northstar Integrators and client logos side by side (conceptual), confident forward momentum aesthetic, warm lighting.
`);

  return [...batch1, ...batch2, ...batch3, ...batch4, ...batch5];
}

export async function runWorkshopPrepPptxGeneration(
  workspaceId: string,
  intelligence: ClientIntelligenceResult | null,
  surveyResponses: SurveyResponses | null,
): Promise<string> {
  await prisma.workspace.update({
    where: { workspaceId },
    data: { workshopPrepPptxStatus: 'running', workshopPrepPptxStep: null } as any,
  });

  const ws = await prisma.workspace.findUniqueOrThrow({
    where: { workspaceId },
    select: { clientName: true, requestedBy: true },
  });

  const clientName = ws.clientName || 'Client';
  logger.info('[PrepPptx] Generating workshop prep deck', { workspaceId, clientName });
  await appendLog(workspaceId, `[Prep PPTX] Generating AI-driven facilitation deck for ${clientName} (5 batches)...`);

  let slides: ContentSlide[];
  try {
    slides = await buildAllSlides(workspaceId, clientName, intelligence, surveyResponses);
    await appendLog(workspaceId, `[Prep PPTX] AI generation complete — ${slides.length} slides`);
  } catch (err: any) {
    await appendLog(workspaceId, `[Prep PPTX] AI generation failed: ${err.message}`);
    throw err;
  }

  const presentationData = {
    presentation_metadata: { title: `${clientName} — AI Workshop Facilitation Deck` },
    slides,
  };

  let templatePath: string;
  try {
    const templateManager = new TemplateManagerService();
    templatePath = templateManager.getTemplatePath();
  } catch {
    throw new Error('No PPTX template configured.');
  }

  await setStep(workspaceId, PPTX_STEP.RENDERING);
  await appendLog(workspaceId, `[Prep PPTX] Rendering PowerPoint file...`);
  const pptxBuffer = await generatePPTXBuffer(presentationData, templatePath);
  await appendLog(workspaceId, `[Prep PPTX] Rendered: ${(pptxBuffer.length / 1024).toFixed(0)} KB`);

  const jobId = randomUUID();
  let outputFile = '';
  let outputFileSize = 0;

  if (isPptxStorageConfigured()) {
    await setStep(workspaceId, PPTX_STEP.UPLOADING);
    await appendLog(workspaceId, `[Prep PPTX] Uploading to S3...`);
    const uploadResult = await uploadPptxToS3({
      buffer: pptxBuffer,
      filename: `workshop-prep-deck-${clientName.replace(/\s+/g, '-').toLowerCase()}.pptx`,
      metadata: { workspaceId, source: 'workshop-prep-pptx' },
    });
    outputFile = uploadResult.key;
    outputFileSize = pptxBuffer.length;
    await appendLog(workspaceId, `[Prep PPTX] Uploaded: ${outputFile}`);
  }

  await prisma.pptxJob.create({
    data: {
      jobId,
      status: 'completed',
      requestedBy: ws.requestedBy,
      analysisType: 'workshop_prep_deck',
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
    data: {
      workshopPrepPptxStatus: 'completed',
      workshopPrepPptxJobId: jobId,
      workshopPrepPptxStep: null,
    } as any,
  });

  logger.info('[PrepPptx] Workshop prep deck generated', { workspaceId, jobId, slideCount: slides.length });
  return jobId;
}
