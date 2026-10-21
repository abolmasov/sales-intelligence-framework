import OpenAI from 'openai';

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type RelatedDocInput = { name: string; text?: string; extractedText?: string };

interface WorkflowRequirements {
  rfpText: string;
  clientContext: any;
  projectContext: any;
  relatedDocuments: Array<{ name: string; content: string }>;
}

export interface ProposalWorkflowResult {
  requirements: WorkflowRequirements;
  analysis: any;
  outline: string;
  fullProposal: string;
  review: string;
  finalProposal: string;
}

export class ProposalWorkflow {
  private client: OpenAI;
  private model: string;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not set in environment variables');
    }

    this.client = new OpenAI({ apiKey });
    this.model = process.env.OPENAI_MODEL || 'gpt-5';
  }

  private async chat(messages: ChatMessage[], temperature = 1): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      temperature,
      messages,
    });
    return response.choices[0]?.message?.content?.trim() || '';
  }

  private parseJson<T>(raw: string, fallback: T): T {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return fallback;
    }
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.warn('⚠️ Failed to parse JSON response, returning fallback value.', error);
      return fallback;
    }
  }

  private mapRelatedDocuments(docs: RelatedDocInput[] = []) {
    return docs.map((doc) => ({
      name: doc.name,
      content: doc.extractedText || doc.text || '',
    }));
  }

  private formatRelatedDocuments(docs: WorkflowRequirements['relatedDocuments']) {
    if (!docs.length) {
      return 'No related documents provided.';
    }
    return docs
      .map((doc) => `### ${doc.name}\n${doc.content || '[No content extracted]'}`)
      .join('\n\n');
  }

  private async analyzeRequirementsAndOutline(
    state: ProposalWorkflowResult
  ): Promise<{ analysis: any; outline: string }> {
    console.log('   - Running detailed requirements analysis and outline generation...');

    const cleanedRequirements = `
RFP TEXT:
${state.requirements.rfpText || ''}

CLIENT CONTEXT:
${JSON.stringify(state.requirements.clientContext, null, 2)}

PROJECT CONTEXT:
${JSON.stringify(state.requirements.projectContext, null, 2)}

RELATED DOCUMENTS:
${this.formatRelatedDocuments(state.requirements.relatedDocuments)}
`;

    const combinedPrompt = `You are an expert business analyst and proposal writer. Carefully read the supplied RFP context and produce **one JSON object** with two parts:

---
{
  "analysis": {
    "project_overview": "...",
    "key_objectives": [],
    "technical_requirements": [],
    "deliverables": [],
    "timeline_indicators": "...",
    "budget_indicators": "...",
    "complexity_level": "...",
    "industry_sector": "...",
    "stakeholders": [],
    "success_criteria": [],
    "risks_identified": [],
    "compliance_requirements": []
  },
  "outline": "Markdown outline text"
}
---

### PART 1 - ANALYSIS
As an expert business analyst, analyze the following RFP requirements and extract comprehensive information.
Ensure that you consider any related project documents contextually but **do not** hallucinate missing content.

RFP REQUIREMENTS:
${cleanedRequirements || 'No requirements provided.'}

Return the analysis field strictly as **valid JSON only** in the following format:
{
  "project_overview": "Brief summary of the project",
  "key_objectives": ["objective1", "objective2", "objective3"],
  "technical_requirements": ["req1", "req2", "req3"],
  "deliverables": ["deliverable1", "deliverable2"],
  "timeline_indicators": "estimated project duration",
  "budget_indicators": "budget range or indicators",
  "complexity_level": "low/medium/high",
  "industry_sector": "relevant industry",
  "stakeholders": ["stakeholder1", "stakeholder2"],
  "success_criteria": ["criteria1", "criteria2"],
  "risks_identified": ["risk1", "risk2"],
  "compliance_requirements": ["requirement1", "requirement2"]
}
- Populate each field using only the provided inputs.
- Use arrays exactly where indicated; do not fabricate details absent from the source content.

### PART 2 - OUTLINE
Replicate the original outline instructions verbatim:

Based on the comprehensive analysis, create a detailed, SOW-style business proposal outline that maps directly to a professional review framework.

1. COMPLETENESS & ALIGNMENT
   - Purpose: Explain how this section will validate that the proposal fully meets the RFP.
   - Subpoints to include:
     - Mapping of proposal sections to explicit RFP requirements.
     - Identification of any gaps or missing requirements.
     - Confirmation of expected deliverables vs. RFP success criteria.
     - Required approvals, artifacts, and acceptance criteria.
     - Evidence or artifacts to demonstrate coverage (e.g., traceability matrix).

2. TECHNICAL & OPERATIONAL SOUNDNESS
   - Purpose: Describe how the technical approach and operational plan satisfy client needs.
   - Subpoints to include:
     - High-level technical approach and architecture summary.
     - Key methodologies, tools, and standards to be used.
     - Deliverable-level feasibility checks and acceptance tests.
     - Realistic timeline overview and milestone rationale.
     - Dependencies, integrations, and operational handoffs.

3. BUSINESS VALUE & CLIENT RELEVANCE
   - Purpose: Articulate measurable value and alignment to client objectives.
   - Subpoints to include:
     - Clear statement of business outcomes and KPIs.
     - How proposed work maps to client pain points from the analysis.
     - ROI assumptions and benefit quantification approach.
     - Business continuity, compliance, and governance benefits.
     - Stakeholder value and executive-level benefits summary.

4. STRUCTURE, FLOW & PROFESSIONAL TONE
   - Purpose: Define document organization, readability, and tone expectations.
   - Subpoints to include:
     - Recommended section order and navigation aids (TOC, executive summary).
     - Paragraph-level guidance (narrative, transitions, and call-to-action).
     - Formatting and legal/contractual language requirements.
     - Accessibility and localization considerations (if applicable).
     - Visual artifacts to include (diagrams, tables, timelines).

5. RISK MANAGEMENT
   - Purpose: Capture key risks and realistic mitigation strategies.
   - Subpoints to include:
     - Top project risks with impact and likelihood descriptions.
     - Proposed mitigation actions and owners for each risk.
     - Contingency plans and escalation paths.
     - Dependencies on third parties and how they are controlled.
     - Monitoring and reporting cadence for risks.

6. PERSUASIVENESS & DIFFERENTIATION
   - Purpose: Show how the proposal will position the provider as the preferred partner.
   - Subpoints to include:
     - Unique strengths, credentials, and differentiators tied to the analysis.
     - Case studies, proof points, or relevant experience to cite.
     - Competitive positioning and comparative advantages.
     - Value-add services or accelerated options.
     - Executive summary messaging tailored to decision-makers.

7. IMPROVEMENT RECOMMENDATIONS
   - Purpose: Define where the draft SOW can be strengthened and how.
   - Subpoints to include:
     - Specific content gaps and recommended expansions.
     - Suggested evidence, artifacts, or appendices to include.
     - Language edits to increase persuasiveness or clarity.
     - Structural changes to improve flow or reduce ambiguity.
     - Suggested metrics and dashboard elements for client reporting.

8. DELIVERY & GOVERNANCE (optional but recommended)
   - Purpose: Define how work will be governed, tracked, and validated.
   - Subpoints to include:
     - Project governance model and steering committee roles.
     - Change control and scope management process.
     - Reporting cadence, sample status dashboard, and KPIs.
     - Quality assurance and acceptance testing approach.
     - Handover, knowledge transfer, and post-implementation review.

9. PRICING & CONTRACTUAL NOTES
   - Purpose: Outline pricing structure guidance and contractual clauses (leave monetary values blank).
   - Subpoints to include:
     - Suggested pricing model (T&M, fixed-price, hybrid) and rationale.
     - Table layout for phases, rates, quantity, and blank totals.
     - Payment milestones and invoicing cadence.
     - Standard contractual terms to call out (validity, travel reimbursement).
     - Statements about pricing placeholders: use $____ or TBD.

Writing instructions:
- For each numbered section above, produce: (a) an 8-sentence explanatory paragraph, and (b) the 4–8 one-sentence subpoints described.
- Use professional, persuasive language tied explicitly to the provided ANALYSIS and ORIGINAL REQUIREMENTS.
- Ensure the outline can be handed directly to a proposal writer to generate a long-form, paragraph-driven SOW.
- Leave all monetary fields blank when referring to pricing.

### SOURCE CONTENT
${cleanedRequirements}

Respond with strict JSON matching the schema.`;

    const raw = await this.chat([
      {
        role: 'system',
        content:
          'You are an expert business analyst and proposal writer. Respond ONLY with valid JSON matching the requested schema.',
      },
      { role: 'user', content: combinedPrompt },
    ]);

    const fallbackAnalysis = {
      project_overview: 'Complex project requiring detailed analysis',
      key_objectives: ['Meet RFP requirements', 'Deliver quality solution', 'Ensure client satisfaction'],
      technical_requirements: ['Technical solution', 'Implementation', 'Testing'],
      deliverables: ['Final product', 'Documentation', 'Support'],
      timeline_indicators: 'To be determined',
      budget_indicators: 'Competitive pricing',
      complexity_level: 'medium',
      industry_sector: 'general',
      stakeholders: ['Client', 'End users', 'Technical team'],
      success_criteria: ['On-time delivery', 'Quality standards', 'Client approval'],
      risks_identified: ['Technical challenges', 'Timeline constraints'],
      compliance_requirements: ['Industry standards', 'Best practices'],
    };

    const fallback = {
      analysis: fallbackAnalysis,
      outline: 'No outline could be generated. Please verify your input data.',
    };

    const parsed = this.parseJson(raw, fallback);
    const analysis = parsed.analysis ?? fallbackAnalysis;
    const outline =
      typeof parsed.outline === 'string' && parsed.outline.trim().length > 0
        ? parsed.outline
        : fallback.outline;

    console.log('   - Analysis and outline generation complete.');
    return { analysis, outline };
  }

  private async createFullProposal(state: ProposalWorkflowResult) {
    console.log('\n📄 STEP 2: GENERATING COMPREHENSIVE BUSINESS PROPOSAL...');

    const proposalPrompt = `
Using the provided project analysis, outline, and client requirements, generate a **comprehensive and detailed Statement of Work (SOW)** document.

The SOW should be written in the style and tone of professional consulting firms (e.g., Northstar Integrators, Deloitte, or Accenture) — formal, structured, and ready for client presentation. It must read as a complete engagement document between the service provider and the client.

Use the inputs below as the sole foundation for the SOW:

PROJECT ANALYSIS:
${JSON.stringify(state.analysis, null, 2)}

PROPOSAL OUTLINE:
${state.outline}

CLIENT REQUIREMENTS (RFP):
${JSON.stringify(state.requirements, null, 2)}

### 🔧 TASK INSTRUCTIONS:

Create the **final, polished version** of this business proposal that:

1. **Uses everything above as context** — incorporate the RFP, analysis, and review feedback fully.
2. **Is NOT limited by word count** — write as long as needed to explain every section thoroughly in rich, professional paragraphs.
3. **Goes far beyond a basic SOW** — include detailed, narrative explanations for:
   - Project background and client challenges
   - Your proposed approach and methodology
   - Technical and strategic solutions
   - Timelines and milestones
   - Resource and role justification
   - Benefits, ROI, and business value
   - Risk mitigation
   - Pricing rationale (no numeric limits)
4. **Be highly persuasive** — use confident, consultative language that positions the service provider as the *best and most capable partner*.
5. **Be deeply structured** — with headings, subheadings, and clearly flowing paragraphs.
6. **End with a strong closing section** summarizing why the client should choose this proposal.

**Writing Instructions:**
- Write fully developed paragraphs for every section based on the outline and requirements.
- Leave all monetary values blank.
The result must read like a full, custom-written proposal document ready to present to a client, not a form template.
`;

    const response = await this.chat([
      {
        role: 'system',
        content:
          'You are a senior proposal writer and business development expert. Create a comprehensive business proposal that demonstrates deep understanding of the client’s needs.',
      },
      { role: 'user', content: proposalPrompt },
    ]);

    console.log('📄 ✅ Full proposal generated successfully.');
    return response;
  }

  async generateProposal(
    requirements: string,
    projectContext: any = {},
    clientContext: any = {},
    projectDocumentsText: RelatedDocInput[] = []
  ): Promise<ProposalWorkflowResult> {
    console.log('\n🚀 STARTING COMPREHENSIVE PROPOSAL GENERATION WORKFLOW');

    const state: ProposalWorkflowResult = {
      requirements: {
        rfpText: requirements,
        clientContext,
        projectContext,
        relatedDocuments: this.mapRelatedDocuments(projectDocumentsText),
      },
      analysis: null,
      outline: '',
      fullProposal: '',
      review: '',
      finalProposal: '',
    };

    console.log('\n🧠 STEP 1: ANALYSIS & OUTLINE PREPARATION');
    const { analysis, outline } = await this.analyzeRequirementsAndOutline(state);
    state.analysis = analysis;
    state.outline = outline;

    state.fullProposal = await this.createFullProposal(state);
    state.review = '';
    state.finalProposal = state.fullProposal;

    console.log('✨ WORKFLOW COMPLETED SUCCESSFULLY!');
    return state;
  }
}

// Export singleton instance
let proposalWorkflowInstance: ProposalWorkflow | null = null;

export function getProposalWorkflow(): ProposalWorkflow {
  if (!proposalWorkflowInstance) {
    proposalWorkflowInstance = new ProposalWorkflow();
  }
  return proposalWorkflowInstance;
}

// For backward compatibility
export const proposalWorkflow = new ProposalWorkflow();
