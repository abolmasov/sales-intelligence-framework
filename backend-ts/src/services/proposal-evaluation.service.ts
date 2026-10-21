import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import pdfParse from '@cedrugs/pdf-parse';
import * as mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { getLoggerService } from './logger.service';
import { getMetricsService } from './metrics.service';
import { getPrismaClient } from '../config/database';
import { PURSUIT_BRIEF_QUESTIONS } from './pursuitBrief.service';

const logger = getLoggerService();
const prisma = getPrismaClient();

// Validate OpenAI API key at startup
if (!process.env.OPENAI_API_KEY) {
  logger.warn('OPENAI_API_KEY is not set. Proposal evaluation will not work.');
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

/**
 * Requirement priority/compliance level
 */
export type RequirementPriority = 'mandatory' | 'important' | 'nice_to_have';

/**
 * An RFP requirement extracted from the document
 */
export interface RFPRequirement {
  id: string;
  requirementNumber: number;
  requirementText: string;
  section: string;
  category: string;
  priority: RequirementPriority;
  complianceKeywords: string[]; // "must", "shall", "required" etc.
}

/**
 * Evidence of whether a requirement is addressed
 */
export interface RequirementAnalysis {
  requirementId: string;
  requirementText: string;
  section: string;
  category: string;
  priority: RequirementPriority;

  // Coverage assessment
  isAddressed: boolean;
  coverageLevel: 'full' | 'partial' | 'none';
  confidence: 'high' | 'medium' | 'low';

  // Evidence from proposal
  proposalExcerpts: {
    text: string;
    pageOrSection: string;
    relevance: string;
  }[];

  // Evidence from pursuit brief (strategic context that supports the response)
  pursuitBriefExcerpts: {
    text: string;
    questionOrSection: string;
    howItHelps: string;
  }[];

  // Gap analysis
  gaps: string[];
  verdict: string;

  // Remediation suggestions - AI-generated content to fill gaps
  suggestedContent?: string;
  suggestedApproach?: string;

  // Compliance risk
  complianceRisk: 'high' | 'medium' | 'low' | 'none';
  complianceNotes?: string;
}

/**
 * Section-level analysis
 */
export interface SectionAnalysis {
  section: string;
  requirements: RequirementAnalysis[];
  totalCount: number;
  addressedCount: number;
  partialCount: number;
  notAddressedCount: number;
  mandatoryMet: number;
  mandatoryTotal: number;
  complianceScore: number; // 0-100
  sectionStrengths: string[];
  sectionWeaknesses: string[];
}

/**
 * Competitive comparison (when multiple proposals are provided)
 */
export interface CompetitiveInsight {
  requirement: string;
  ourCoverage: 'full' | 'partial' | 'none';
  competitorCoverage: 'full' | 'partial' | 'none';
  competitorStrength?: string;
  recommendation: string;
}

/**
 * Win/Loss analysis insights
 */
export interface WinLossInsight {
  category: 'strength' | 'weakness' | 'differentiator' | 'risk';
  title: string;
  description: string;
  impactLevel: 'high' | 'medium' | 'low';
  affectedRequirements: string[];
  recommendation?: string;
}

/**
 * Analysis of how well the proposal addresses a pursuit brief question
 */
export interface PursuitBriefQuestionAnalysis {
  questionId: string;
  questionText: string;
  isAddressed: boolean;
  coverageLevel: 'full' | 'partial' | 'none';
  proposalEvidence: {
    text: string;
    location: string;
  }[];
  pursuitBriefAnswer?: string;
  assessment: string;
  gaps?: string[];
  suggestedImprovement?: string;
}

/**
 * Overall pursuit brief question coverage summary
 */
export interface PursuitBriefAnalysisSummary {
  totalQuestions: number;
  fullyAddressed: number;
  partiallyAddressed: number;
  notAddressed: number;
  coverageScore: number; // 0-100
  questionAnalysis: PursuitBriefQuestionAnalysis[];
}

/**
 * Overall evaluation result - comprehensive analysis
 */
export interface ProposalEvaluationResult {
  id: string;
  status: 'processing' | 'extracting_requirements' | 'analyzing_coverage' | 'generating_insights' | 'completed' | 'failed';
  progress: number; // 0-100
  currentStep: string;
  createdAt: Date;
  completedAt?: Date;

  // Input files
  rfpFileName: string;
  proposalFileName: string;
  pursuitBriefFileName?: string;
  competitorProposalFileName?: string;

  // Requirements from RFP
  requirements: RFPRequirement[];
  totalRequirements: number;

  // Detailed analysis
  analysis: RequirementAnalysis[];

  // Section-level rollup
  bySection: SectionAnalysis[];

  // Summary metrics
  summary: {
    totalRequirements: number;
    addressed: number;
    partiallyAddressed: number;
    notAddressed: number;

    // Compliance metrics
    mandatoryRequirements: number;
    mandatoryMet: number;
    complianceScore: number; // Percentage of mandatory requirements met

    // Coverage by priority
    byPriority: {
      mandatory: { total: number; met: number };
      important: { total: number; met: number };
      nice_to_have: { total: number; met: number };
    };
  };

  // Critical issues - requirements that MUST be addressed
  criticalGaps: {
    requirement: string;
    section: string;
    priority: RequirementPriority;
    complianceRisk: string;
    suggestedFix: string;
  }[];

  // Win/Loss Analysis
  winLossInsights: WinLossInsight[];

  // Competitive analysis (if competitor proposal provided)
  competitiveInsights?: CompetitiveInsight[];

  // Pursuit brief question analysis - how well does proposal address strategic questions
  pursuitBriefAnalysis?: PursuitBriefAnalysisSummary;

  // Executive summary
  executiveSummary: {
    overallAssessment: string;
    keyStrengths: string[];
    criticalWeaknesses: string[];
    winProbabilityFactors: string[];
    immediateActions: string[];
  };

  // Error info
  error?: string;
}

/**
 * Active evaluation session
 */
interface EvaluationSession {
  id: string;
  startTime: Date;
  rfpText: string;
  proposalText: string;
  pursuitBriefText?: string;
  competitorProposalText?: string;
  result: ProposalEvaluationResult;
}

/**
 * Proposal Evaluation Service
 * Comprehensive proposal analysis with compliance, gap remediation, and win/loss insights
 */
export class ProposalEvaluationService {
  private sessions: Map<string, EvaluationSession> = new Map();
  private metricsService = getMetricsService();

  private createEmptyResult(
    sessionId: string,
    startTime: Date,
    fileNames: {
      rfpFileName: string;
      proposalFileName: string;
      pursuitBriefFileName?: string;
      competitorProposalFileName?: string;
    }
  ): ProposalEvaluationResult {
    return {
      id: sessionId,
      status: 'processing',
      progress: 0,
      currentStep: 'Initializing...',
      createdAt: startTime,
      rfpFileName: fileNames.rfpFileName,
      proposalFileName: fileNames.proposalFileName,
      pursuitBriefFileName: fileNames.pursuitBriefFileName,
      competitorProposalFileName: fileNames.competitorProposalFileName,
      requirements: [],
      totalRequirements: 0,
      analysis: [],
      bySection: [],
      summary: {
        totalRequirements: 0,
        addressed: 0,
        partiallyAddressed: 0,
        notAddressed: 0,
        mandatoryRequirements: 0,
        mandatoryMet: 0,
        complianceScore: 0,
        byPriority: {
          mandatory: { total: 0, met: 0 },
          important: { total: 0, met: 0 },
          nice_to_have: { total: 0, met: 0 }
        }
      },
      criticalGaps: [],
      winLossInsights: [],
      executiveSummary: {
        overallAssessment: '',
        keyStrengths: [],
        criticalWeaknesses: [],
        winProbabilityFactors: [],
        immediateActions: []
      }
    };
  }

  /**
   * Extract text from various file formats
   */
  async extractTextFromFile(filePath: string): Promise<string> {
    const ext = path.extname(filePath).toLowerCase();

    try {
      switch (ext) {
        case '.pdf':
          const pdfBuffer = fs.readFileSync(filePath);
          const pdfData = await pdfParse(pdfBuffer);
          return pdfData.text;

        case '.docx':
          const docxResult = await mammoth.extractRawText({ path: filePath });
          return docxResult.value;

        case '.xlsx':
        case '.xls':
          const workbook = XLSX.readFile(filePath);
          let excelText = '';
          workbook.SheetNames.forEach(sheetName => {
            const sheet = workbook.Sheets[sheetName];
            excelText += XLSX.utils.sheet_to_txt(sheet) + '\n\n';
          });
          return excelText;

        case '.txt':
        case '.md':
          return fs.readFileSync(filePath, 'utf-8');

        default:
          throw new Error(`Unsupported file format: ${ext}`);
      }
    } catch (error) {
      logger.error(`Failed to extract text from ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Extract requirements with priority/compliance classification
   */
  async extractRequirements(rfpText: string): Promise<RFPRequirement[]> {
    const systemPrompt = `You are an expert RFP analyst. Extract ALL requirements from the RFP document.

For each requirement, determine:
1. The EXACT text (verbatim copy)
2. Section it belongs to
3. Category (Technical, Commercial, Experience, Legal, Timeline, Security, Support, etc.)
4. Priority level based on language:
   - "mandatory": Contains "must", "shall", "required", "mandatory", "essential"
   - "important": Contains "should", "expected", "prefer", "important"
   - "nice_to_have": Contains "may", "optional", "desired", "bonus", "plus"
5. Compliance keywords found in the requirement

Be thorough - include:
- Explicit questions (ending with ?)
- Numbered requirements
- Bullet point items
- Qualification criteria
- Evaluation criteria mentioned

Return JSON:
{
  "requirements": [
    {
      "requirementNumber": 1,
      "requirementText": "Exact verbatim text",
      "section": "Section name",
      "category": "Category",
      "priority": "mandatory|important|nice_to_have",
      "complianceKeywords": ["must", "required"]
    }
  ]
}`;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Extract all requirements from this RFP:\n\n${rfpText.substring(0, 100000)}` }
        ],
        temperature: 0.1,
        max_tokens: 16000,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content || '{"requirements": []}';
      const parsed = JSON.parse(content);

      const requirements: RFPRequirement[] = (parsed.requirements || []).map((r: any, idx: number) => ({
        id: uuidv4(),
        requirementNumber: r.requirementNumber || idx + 1,
        requirementText: r.requirementText || '',
        section: r.section || 'General',
        category: r.category || 'General',
        priority: r.priority || 'important',
        complianceKeywords: r.complianceKeywords || []
      }));

      logger.info(`Extracted ${requirements.length} requirements (${requirements.filter(r => r.priority === 'mandatory').length} mandatory)`);
      return requirements;

    } catch (error) {
      logger.error('Failed to extract requirements:', error);
      throw error;
    }
  }

  /**
   * Analyze requirements with gap remediation suggestions and pursuit brief context
   */
  async analyzeRequirements(
    requirements: RFPRequirement[],
    proposalText: string,
    pursuitBriefText?: string
  ): Promise<RequirementAnalysis[]> {
    const results: RequirementAnalysis[] = [];
    const batchSize = 4; // Smaller batches for more detailed analysis
    const hasPursuitBrief = !!pursuitBriefText && pursuitBriefText.trim().length > 0;

    for (let i = 0; i < requirements.length; i += batchSize) {
      const batch = requirements.slice(i, i + batchSize);

      const pursuitBriefInstructions = hasPursuitBrief ? `
6. Search the PURSUIT BRIEF for strategic context that supports this requirement
7. Quote relevant pursuit brief content that helps address this requirement
8. Explain how the pursuit brief information strengthens or informs the response` : '';

      const pursuitBriefJsonSchema = hasPursuitBrief ? `
      "pursuitBriefExcerpts": [
        {
          "text": "EXACT quote from pursuit brief",
          "questionOrSection": "Which pursuit brief question/section this came from",
          "howItHelps": "How this strategic context helps address the requirement"
        }
      ],` : '';

      const systemPrompt = `You are an expert proposal analyst. For each RFP requirement, analyze the proposal's coverage and provide actionable remediation.

For each requirement:
1. Search the proposal for relevant content
2. Quote EXACT text from the proposal (verbatim)
3. Assess coverage level: "full", "partial", or "none"
4. If not fully covered, provide SPECIFIC suggested content that could be added
5. Assess compliance risk for mandatory requirements${pursuitBriefInstructions}

Return JSON:
{
  "analysis": [
    {
      "requirementId": "id",
      "isAddressed": true/false,
      "coverageLevel": "full|partial|none",
      "confidence": "high|medium|low",
      "proposalExcerpts": [
        {
          "text": "EXACT quote from proposal",
          "pageOrSection": "Where found in proposal",
          "relevance": "How this addresses the requirement"
        }
      ],${pursuitBriefJsonSchema}
      "gaps": ["Specific gaps if not fully covered"],
      "verdict": "Clear assessment in plain English",
      "suggestedContent": "If gaps exist, write 2-3 sentences that could be added to the proposal to address this requirement. Be specific and actionable.${hasPursuitBrief ? ' Use pursuit brief context to inform the suggestion.' : ''}",
      "suggestedApproach": "Brief strategy for addressing this gap",
      "complianceRisk": "high|medium|low|none",
      "complianceNotes": "For mandatory requirements, explain compliance implications"
    }
  ]
}

IMPORTANT:
- For mandatory requirements with gaps, always mark complianceRisk as "high"
- Suggested content should be ready to use, not generic advice
- Quote exact proposal text, don't paraphrase${hasPursuitBrief ? `
- ALWAYS search the pursuit brief for relevant strategic context
- The pursuit brief contains win themes, differentiators, and strategic positioning - USE IT
- Include pursuit brief excerpts that support or inform the response to each requirement` : ''}`;

      const requirementsJson = JSON.stringify(batch.map(r => ({
        id: r.id,
        requirement: r.requirementText,
        section: r.section,
        category: r.category,
        priority: r.priority,
        complianceKeywords: r.complianceKeywords
      })));

      let userContent = `REQUIREMENTS TO ANALYZE:\n${requirementsJson}\n\nPROPOSAL CONTENT:\n${proposalText.substring(0, 70000)}`;

      if (hasPursuitBrief) {
        userContent += `\n\n=== PURSUIT BRIEF (Strategic Context) ===\n${pursuitBriefText!.substring(0, 15000)}`;
      }

      try {
        const response = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent }
          ],
          temperature: 0.1,
          max_tokens: 10000,
          response_format: { type: 'json_object' }
        });

        const content = response.choices[0]?.message?.content || '{"analysis": []}';
        const parsed = JSON.parse(content);

        for (const analysis of parsed.analysis || []) {
          const req = batch.find(r => r.id === analysis.requirementId);
          if (req) {
            results.push({
              requirementId: req.id,
              requirementText: req.requirementText,
              section: req.section,
              category: req.category,
              priority: req.priority,
              isAddressed: analysis.isAddressed || false,
              coverageLevel: analysis.coverageLevel || 'none',
              confidence: analysis.confidence || 'low',
              proposalExcerpts: (analysis.proposalExcerpts || []).map((e: any) => ({
                text: e.text || '',
                pageOrSection: e.pageOrSection || '',
                relevance: e.relevance || ''
              })),
              pursuitBriefExcerpts: (analysis.pursuitBriefExcerpts || []).map((e: any) => ({
                text: e.text || '',
                questionOrSection: e.questionOrSection || '',
                howItHelps: e.howItHelps || ''
              })),
              gaps: analysis.gaps || [],
              verdict: analysis.verdict || 'Unable to determine',
              suggestedContent: analysis.suggestedContent,
              suggestedApproach: analysis.suggestedApproach,
              complianceRisk: analysis.complianceRisk || 'none',
              complianceNotes: analysis.complianceNotes
            });
          }
        }

        // Handle missed requirements
        for (const req of batch) {
          if (!results.find(r => r.requirementId === req.id)) {
            results.push({
              requirementId: req.id,
              requirementText: req.requirementText,
              section: req.section,
              category: req.category,
              priority: req.priority,
              isAddressed: false,
              coverageLevel: 'none',
              confidence: 'low',
              proposalExcerpts: [],
              pursuitBriefExcerpts: [],
              gaps: ['No relevant content found in proposal'],
              verdict: 'The proposal does NOT appear to address this requirement.',
              complianceRisk: req.priority === 'mandatory' ? 'high' : 'low'
            });
          }
        }

      } catch (error) {
        logger.error(`Failed to analyze batch starting at ${i}:`, error);
        for (const req of batch) {
          if (!results.find(r => r.requirementId === req.id)) {
            results.push({
              requirementId: req.id,
              requirementText: req.requirementText,
              section: req.section,
              category: req.category,
              priority: req.priority,
              isAddressed: false,
              coverageLevel: 'none',
              confidence: 'low',
              proposalExcerpts: [],
              pursuitBriefExcerpts: [],
              gaps: ['Analysis failed - manual review required'],
              verdict: 'Unable to analyze - please review manually.',
              complianceRisk: req.priority === 'mandatory' ? 'high' : 'medium'
            });
          }
        }
      }
    }

    return results;
  }

  /**
   * Generate win/loss insights
   */
  async generateWinLossInsights(
    analysis: RequirementAnalysis[],
    proposalText: string,
    rfpText: string
  ): Promise<WinLossInsight[]> {
    const systemPrompt = `You are a sales strategy expert analyzing a proposal for win/loss insights.

Based on the requirement analysis and proposal content, identify:
1. KEY STRENGTHS - Where the proposal excels
2. CRITICAL WEAKNESSES - Gaps that could lose the deal
3. DIFFERENTIATORS - Unique value propositions
4. RISKS - Factors that could negatively impact evaluation

For each insight, provide:
- Clear title
- Detailed description
- Impact level (high/medium/low)
- Which requirements are affected
- Actionable recommendation

Return JSON:
{
  "insights": [
    {
      "category": "strength|weakness|differentiator|risk",
      "title": "Brief title",
      "description": "Detailed explanation",
      "impactLevel": "high|medium|low",
      "affectedRequirements": ["req text 1", "req text 2"],
      "recommendation": "Specific action to take"
    }
  ]
}

Focus on actionable insights that would influence the win/loss outcome.`;

    const analysisContext = analysis.map(a => ({
      requirement: a.requirementText.substring(0, 100),
      priority: a.priority,
      coverage: a.coverageLevel,
      complianceRisk: a.complianceRisk
    }));

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `REQUIREMENT ANALYSIS SUMMARY:\n${JSON.stringify(analysisContext, null, 2)}\n\nPROPOSAL EXCERPT:\n${proposalText.substring(0, 30000)}\n\nRFP CONTEXT:\n${rfpText.substring(0, 20000)}`
          }
        ],
        temperature: 0.3,
        max_tokens: 4000,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content || '{"insights": []}';
      const parsed = JSON.parse(content);

      return (parsed.insights || []).map((i: any) => ({
        category: i.category || 'risk',
        title: i.title || 'Insight',
        description: i.description || '',
        impactLevel: i.impactLevel || 'medium',
        affectedRequirements: i.affectedRequirements || [],
        recommendation: i.recommendation
      }));

    } catch (error) {
      logger.error('Failed to generate win/loss insights:', error);
      return [];
    }
  }

  /**
   * Generate executive summary
   */
  async generateExecutiveSummary(
    analysis: RequirementAnalysis[],
    summary: ProposalEvaluationResult['summary'],
    winLossInsights: WinLossInsight[]
  ): Promise<ProposalEvaluationResult['executiveSummary']> {
    const strengths = winLossInsights.filter(i => i.category === 'strength' || i.category === 'differentiator');
    const weaknesses = winLossInsights.filter(i => i.category === 'weakness' || i.category === 'risk');
    const highRiskGaps = analysis.filter(a => a.complianceRisk === 'high');

    const systemPrompt = `You are writing an executive summary for a proposal evaluation.

Generate a concise executive summary with:
1. Overall assessment (1-2 sentences)
2. Key strengths (3-5 bullet points)
3. Critical weaknesses (3-5 bullet points)
4. Win probability factors (what will determine success)
5. Immediate actions (top 3 things to do now)

Be direct and actionable. This is for busy executives.

Return JSON:
{
  "overallAssessment": "One sentence summary",
  "keyStrengths": ["strength 1", "strength 2"],
  "criticalWeaknesses": ["weakness 1", "weakness 2"],
  "winProbabilityFactors": ["factor 1", "factor 2"],
  "immediateActions": ["action 1", "action 2", "action 3"]
}`;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `METRICS:
- Total requirements: ${summary.totalRequirements}
- Fully addressed: ${summary.addressed}
- Partially addressed: ${summary.partiallyAddressed}
- Not addressed: ${summary.notAddressed}
- Mandatory requirements: ${summary.mandatoryRequirements}
- Mandatory met: ${summary.mandatoryMet}
- Compliance score: ${summary.complianceScore}%

STRENGTHS IDENTIFIED:
${strengths.map(s => `- ${s.title}: ${s.description}`).join('\n')}

WEAKNESSES IDENTIFIED:
${weaknesses.map(w => `- ${w.title}: ${w.description}`).join('\n')}

HIGH RISK GAPS (${highRiskGaps.length}):
${highRiskGaps.slice(0, 5).map(g => `- ${g.requirementText.substring(0, 80)}...`).join('\n')}`
          }
        ],
        temperature: 0.3,
        max_tokens: 2000,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);

      return {
        overallAssessment: parsed.overallAssessment || 'Evaluation completed.',
        keyStrengths: parsed.keyStrengths || [],
        criticalWeaknesses: parsed.criticalWeaknesses || [],
        winProbabilityFactors: parsed.winProbabilityFactors || [],
        immediateActions: parsed.immediateActions || []
      };

    } catch (error) {
      logger.error('Failed to generate executive summary:', error);
      return {
        overallAssessment: `Proposal addresses ${summary.addressed} of ${summary.totalRequirements} requirements with ${summary.complianceScore}% compliance.`,
        keyStrengths: strengths.slice(0, 3).map(s => s.title),
        criticalWeaknesses: weaknesses.slice(0, 3).map(w => w.title),
        winProbabilityFactors: ['Compliance score', 'Coverage of mandatory requirements'],
        immediateActions: ['Address high-risk compliance gaps', 'Review critical weaknesses', 'Strengthen differentiators']
      };
    }
  }

  /**
   * Analyze how well the proposal addresses each of the 16 pursuit brief questions
   */
  async analyzePursuitBriefQuestions(
    pursuitBriefText: string,
    proposalText: string
  ): Promise<PursuitBriefAnalysisSummary> {
    const questions = Object.entries(PURSUIT_BRIEF_QUESTIONS);

    const systemPrompt = `You are an expert proposal analyst. For each strategic pursuit brief question, analyze if and how well the proposal addresses it.

These are the 16 strategic questions used in pursuit briefs to capture key strategic information about an opportunity. The proposal should ideally incorporate or address the answers to these questions to be compelling.

For each question:
1. Search the proposal for content that answers or addresses this strategic question
2. Quote EXACT text from the proposal as evidence
3. Assess coverage: "full" (clearly addresses), "partial" (touches on it), or "none" (not addressed)
4. Provide specific gaps if not fully covered
5. Suggest improvements if there are gaps

Return JSON:
{
  "analysis": [
    {
      "questionId": "1",
      "isAddressed": true/false,
      "coverageLevel": "full|partial|none",
      "proposalEvidence": [
        {
          "text": "EXACT quote from proposal",
          "location": "Section/page where found"
        }
      ],
      "assessment": "Clear explanation of how well this is addressed",
      "gaps": ["Specific gaps if not fully covered"],
      "suggestedImprovement": "What could be added to better address this question"
    }
  ]
}

IMPORTANT:
- These are STRATEGIC questions about the opportunity - the proposal should demonstrate understanding of these areas
- Quote exact proposal text as evidence, don't paraphrase
- Be specific about what's missing if there are gaps`;

    const questionsJson = questions.map(([id, question]) => ({
      questionId: id,
      questionText: question
    }));

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `PURSUIT BRIEF STRATEGIC QUESTIONS:\n${JSON.stringify(questionsJson, null, 2)}\n\nPURSUIT BRIEF CONTENT:\n${pursuitBriefText.substring(0, 15000)}\n\nPROPOSAL CONTENT:\n${proposalText.substring(0, 70000)}`
          }
        ],
        temperature: 0.1,
        max_tokens: 12000,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content || '{"analysis": []}';
      const parsed = JSON.parse(content);

      const questionAnalysis: PursuitBriefQuestionAnalysis[] = [];

      for (const [id, questionText] of questions) {
        const analysis = (parsed.analysis || []).find((a: any) => a.questionId === id);

        if (analysis) {
          questionAnalysis.push({
            questionId: id,
            questionText,
            isAddressed: analysis.isAddressed || false,
            coverageLevel: analysis.coverageLevel || 'none',
            proposalEvidence: (analysis.proposalEvidence || []).map((e: any) => ({
              text: e.text || '',
              location: e.location || ''
            })),
            assessment: analysis.assessment || 'Unable to determine',
            gaps: analysis.gaps,
            suggestedImprovement: analysis.suggestedImprovement
          });
        } else {
          questionAnalysis.push({
            questionId: id,
            questionText,
            isAddressed: false,
            coverageLevel: 'none',
            proposalEvidence: [],
            assessment: 'This strategic question is not addressed in the proposal.'
          });
        }
      }

      const fullyAddressed = questionAnalysis.filter(q => q.coverageLevel === 'full').length;
      const partiallyAddressed = questionAnalysis.filter(q => q.coverageLevel === 'partial').length;
      const notAddressed = questionAnalysis.filter(q => q.coverageLevel === 'none').length;

      // Calculate coverage score (full = 100%, partial = 50%)
      const coverageScore = Math.round(
        ((fullyAddressed * 100) + (partiallyAddressed * 50)) / questions.length
      );

      logger.info(`Pursuit brief question analysis: ${fullyAddressed} full, ${partiallyAddressed} partial, ${notAddressed} none (${coverageScore}% coverage)`);

      return {
        totalQuestions: questions.length,
        fullyAddressed,
        partiallyAddressed,
        notAddressed,
        coverageScore,
        questionAnalysis
      };

    } catch (error) {
      logger.error('Failed to analyze pursuit brief questions:', error);

      // Return empty analysis on error
      return {
        totalQuestions: questions.length,
        fullyAddressed: 0,
        partiallyAddressed: 0,
        notAddressed: questions.length,
        coverageScore: 0,
        questionAnalysis: questions.map(([id, questionText]) => ({
          questionId: id,
          questionText,
          isAddressed: false,
          coverageLevel: 'none' as const,
          proposalEvidence: [],
          assessment: 'Analysis failed - please review manually.'
        }))
      };
    }
  }

  /**
   * Start a proposal evaluation
   */
  async startEvaluation(
    rfpFilePath: string,
    proposalFilePath: string,
    pursuitBriefFilePath?: string,
    competitorProposalFilePath?: string
  ): Promise<string> {
    const sessionId = uuidv4();
    const startTime = new Date();
    const result = this.createEmptyResult(sessionId, startTime, {
      rfpFileName: path.basename(rfpFilePath),
      proposalFileName: path.basename(proposalFilePath),
      pursuitBriefFileName: pursuitBriefFilePath ? path.basename(pursuitBriefFilePath) : undefined,
      competitorProposalFileName: competitorProposalFilePath ? path.basename(competitorProposalFilePath) : undefined,
    });

    logger.info(`Starting proposal evaluation session ${sessionId}`);

    try {
      const rfpText = await this.extractTextFromFile(rfpFilePath);
      const proposalText = await this.extractTextFromFile(proposalFilePath);
      const pursuitBriefText = pursuitBriefFilePath
        ? await this.extractTextFromFile(pursuitBriefFilePath)
        : undefined;
      const competitorProposalText = competitorProposalFilePath
        ? await this.extractTextFromFile(competitorProposalFilePath)
        : undefined;

      this.sessions.set(sessionId, {
        id: sessionId,
        startTime,
        rfpText,
        proposalText,
        pursuitBriefText,
        competitorProposalText,
        result
      });

      // Run evaluation async
      this.runEvaluation(sessionId).catch(err => {
        logger.error(`Evaluation ${sessionId} failed:`, err);
        const session = this.sessions.get(sessionId);
        if (session) {
          session.result.status = 'failed';
          session.result.error = err.message;
        }
      });

      return sessionId;

    } catch (error: any) {
      result.status = 'failed';
      result.error = error.message;
      this.sessions.set(sessionId, {
        id: sessionId,
        startTime,
        rfpText: '',
        proposalText: '',
        result
      });
      throw error;
    }
  }

  /**
   * Run a proposal evaluation synchronously (used by DB-backed job workers)
   */
  async runEvaluationFromFiles(
    sessionId: string,
    rfpFilePath: string,
    proposalFilePath: string,
    pursuitBriefFilePath?: string,
    competitorProposalFilePath?: string
  ): Promise<ProposalEvaluationResult> {
    const startTime = new Date();
    const result = this.createEmptyResult(sessionId, startTime, {
      rfpFileName: path.basename(rfpFilePath),
      proposalFileName: path.basename(proposalFilePath),
      pursuitBriefFileName: pursuitBriefFilePath ? path.basename(pursuitBriefFilePath) : undefined,
      competitorProposalFileName: competitorProposalFilePath ? path.basename(competitorProposalFilePath) : undefined,
    });

    logger.info(`Running proposal evaluation job session ${sessionId}`);

    const rfpText = await this.extractTextFromFile(rfpFilePath);
    const proposalText = await this.extractTextFromFile(proposalFilePath);
    const pursuitBriefText = pursuitBriefFilePath
      ? await this.extractTextFromFile(pursuitBriefFilePath)
      : undefined;
    const competitorProposalText = competitorProposalFilePath
      ? await this.extractTextFromFile(competitorProposalFilePath)
      : undefined;

    this.sessions.set(sessionId, {
      id: sessionId,
      startTime,
      rfpText,
      proposalText,
      pursuitBriefText,
      competitorProposalText,
      result
    });

    await this.runEvaluation(sessionId);

    const evaluated = this.sessions.get(sessionId)?.result;
    if (!evaluated) {
      throw new Error(`Evaluation session ${sessionId} not found after processing`);
    }
    return evaluated;
  }

  /**
   * Run the full evaluation pipeline
   */
  private async runEvaluation(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    const { rfpText, proposalText, pursuitBriefText, result } = session;

    try {
      // Step 1: Extract requirements (20%)
      result.status = 'extracting_requirements';
      result.currentStep = 'Extracting requirements from RFP...';
      result.progress = 5;
      logger.info(`[${sessionId}] Extracting requirements...`);

      const requirements = await this.extractRequirements(rfpText);
      result.requirements = requirements;
      result.totalRequirements = requirements.length;
      result.progress = 20;

      // Step 2: Analyze coverage (60%)
      result.status = 'analyzing_coverage';
      const stepDesc = pursuitBriefText
        ? `Analyzing ${requirements.length} requirements against proposal and pursuit brief...`
        : `Analyzing ${requirements.length} requirements against proposal...`;
      result.currentStep = stepDesc;
      result.progress = 25;
      logger.info(`[${sessionId}] ${stepDesc}`);

      // Pass pursuit brief to analysis for strategic context
      const analysis = await this.analyzeRequirements(requirements, proposalText, pursuitBriefText);
      result.analysis = analysis;
      result.progress = 60;

      // Step 3: Calculate metrics
      result.currentStep = 'Calculating compliance metrics...';
      const addressed = analysis.filter(a => a.coverageLevel === 'full').length;
      const partiallyAddressed = analysis.filter(a => a.coverageLevel === 'partial').length;
      const notAddressed = analysis.filter(a => a.coverageLevel === 'none').length;

      const mandatoryReqs = analysis.filter(a => a.priority === 'mandatory');
      const mandatoryMet = mandatoryReqs.filter(a => a.coverageLevel === 'full' || a.coverageLevel === 'partial').length;

      const importantReqs = analysis.filter(a => a.priority === 'important');
      const importantMet = importantReqs.filter(a => a.coverageLevel === 'full' || a.coverageLevel === 'partial').length;

      const niceToHaveReqs = analysis.filter(a => a.priority === 'nice_to_have');
      const niceToHaveMet = niceToHaveReqs.filter(a => a.coverageLevel === 'full' || a.coverageLevel === 'partial').length;

      // Calculate weighted compliance score:
      // - Full coverage = 100% of weight
      // - Partial coverage = 50% of weight
      // - Mandatory = 3x weight, Important = 2x weight, Nice-to-have = 1x weight
      const calculateWeightedScore = () => {
        let totalWeight = 0;
        let earnedWeight = 0;

        for (const a of analysis) {
          const priorityWeight = a.priority === 'mandatory' ? 3 : a.priority === 'important' ? 2 : 1;
          totalWeight += priorityWeight;

          if (a.coverageLevel === 'full') {
            earnedWeight += priorityWeight;
          } else if (a.coverageLevel === 'partial') {
            earnedWeight += priorityWeight * 0.5;
          }
        }

        return totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 100;
      };

      const complianceScore = calculateWeightedScore();

      result.summary = {
        totalRequirements: requirements.length,
        addressed,
        partiallyAddressed,
        notAddressed,
        mandatoryRequirements: mandatoryReqs.length,
        mandatoryMet,
        complianceScore,
        byPriority: {
          mandatory: { total: mandatoryReqs.length, met: mandatoryMet },
          important: { total: importantReqs.length, met: importantMet },
          nice_to_have: { total: niceToHaveReqs.length, met: niceToHaveMet }
        }
      };

      // Step 4: Group by section
      const sections = [...new Set(requirements.map(r => r.section))];
      result.bySection = sections.map(section => {
        const sectionAnalysis = analysis.filter(a => a.section === section);
        const sectionMandatory = sectionAnalysis.filter(a => a.priority === 'mandatory');
        const sectionMandatoryMet = sectionMandatory.filter(a => a.coverageLevel !== 'none').length;

        // Calculate weighted section score
        let sectionTotalWeight = 0;
        let sectionEarnedWeight = 0;
        for (const a of sectionAnalysis) {
          const priorityWeight = a.priority === 'mandatory' ? 3 : a.priority === 'important' ? 2 : 1;
          sectionTotalWeight += priorityWeight;
          if (a.coverageLevel === 'full') {
            sectionEarnedWeight += priorityWeight;
          } else if (a.coverageLevel === 'partial') {
            sectionEarnedWeight += priorityWeight * 0.5;
          }
        }
        const sectionComplianceScore = sectionTotalWeight > 0 ? Math.round((sectionEarnedWeight / sectionTotalWeight) * 100) : 100;

        return {
          section,
          requirements: sectionAnalysis,
          totalCount: sectionAnalysis.length,
          addressedCount: sectionAnalysis.filter(a => a.coverageLevel === 'full').length,
          partialCount: sectionAnalysis.filter(a => a.coverageLevel === 'partial').length,
          notAddressedCount: sectionAnalysis.filter(a => a.coverageLevel === 'none').length,
          mandatoryMet: sectionMandatoryMet,
          mandatoryTotal: sectionMandatory.length,
          complianceScore: sectionComplianceScore,
          sectionStrengths: sectionAnalysis.filter(a => a.coverageLevel === 'full').slice(0, 2).map(a => a.verdict),
          sectionWeaknesses: sectionAnalysis.filter(a => a.coverageLevel === 'none').slice(0, 2).map(a => a.verdict)
        };
      });

      // Step 5: Identify critical gaps
      result.criticalGaps = analysis
        .filter(a => a.complianceRisk === 'high' || (a.priority === 'mandatory' && a.coverageLevel === 'none'))
        .map(a => ({
          requirement: a.requirementText,
          section: a.section,
          priority: a.priority,
          complianceRisk: a.complianceNotes || 'This mandatory requirement is not addressed',
          suggestedFix: a.suggestedContent || a.suggestedApproach || 'Address this requirement before submission'
        }));

      result.progress = 70;

      // Step 6: Generate win/loss insights (85%)
      result.status = 'generating_insights';
      result.currentStep = 'Generating win/loss insights...';
      logger.info(`[${sessionId}] Generating win/loss insights...`);

      const winLossInsights = await this.generateWinLossInsights(analysis, proposalText, rfpText);
      result.winLossInsights = winLossInsights;
      result.progress = 85;

      // Step 7: Generate executive summary (90%)
      result.currentStep = 'Generating executive summary...';
      logger.info(`[${sessionId}] Generating executive summary...`);

      const executiveSummary = await this.generateExecutiveSummary(analysis, result.summary, winLossInsights);
      result.executiveSummary = executiveSummary;
      result.progress = 90;

      // Step 8: Analyze pursuit brief questions (95%)
      if (pursuitBriefText) {
        result.currentStep = 'Analyzing pursuit brief questions coverage...';
        logger.info(`[${sessionId}] Analyzing pursuit brief questions...`);

        const pursuitBriefAnalysis = await this.analyzePursuitBriefQuestions(pursuitBriefText, proposalText);
        result.pursuitBriefAnalysis = pursuitBriefAnalysis;
        result.progress = 95;

        logger.info(`[${sessionId}] Pursuit brief coverage: ${pursuitBriefAnalysis.coverageScore}%`);
      }

      // Step 9: Save to database (98%)
      result.currentStep = 'Saving evaluation...';
      logger.info(`[${sessionId}] Saving evaluation to database...`);

      try {
        await prisma.proposalEvaluation.create({
          data: {
            id: sessionId,
            rfpFileName: result.rfpFileName,
            proposalFileName: result.proposalFileName,
            pursuitBriefFileName: result.pursuitBriefFileName,
            status: 'completed',
            complianceScore: result.summary.complianceScore,
            totalRequirements: result.summary.totalRequirements,
            addressedCount: result.summary.addressed,
            partialCount: result.summary.partiallyAddressed,
            notAddressedCount: result.summary.notAddressed,
            mandatoryTotal: result.summary.mandatoryRequirements,
            mandatoryMet: result.summary.mandatoryMet,
            analysisData: JSON.stringify(result.analysis),
            executiveSummary: JSON.stringify(result.executiveSummary),
            winLossInsights: JSON.stringify(result.winLossInsights),
            criticalGaps: JSON.stringify(result.criticalGaps),
            bySection: JSON.stringify(result.bySection),
            pursuitBriefAnalysis: result.pursuitBriefAnalysis
              ? JSON.stringify(result.pursuitBriefAnalysis)
              : null
          }
        });
        logger.info(`[${sessionId}] Evaluation saved to database`);
      } catch (dbError) {
        logger.error(`[${sessionId}] Failed to save to database:`, dbError);
        // Don't fail the evaluation if DB save fails
      }

      result.progress = 98;

      // Complete
      result.status = 'completed';
      result.progress = 100;
      result.currentStep = 'Complete';
      result.completedAt = new Date();

      const duration = Date.now() - session.startTime.getTime();
      logger.info(`[${sessionId}] Evaluation completed in ${Math.round(duration / 1000)}s`);
      logger.info(`[${sessionId}] Compliance score: ${result.summary.complianceScore}%`);

    } catch (error: any) {
      result.status = 'failed';
      result.error = error.message;
      logger.error(`[${sessionId}] Evaluation failed:`, error);
      throw error;
    }
  }

  /**
   * Get evaluation status and results
   */
  getEvaluation(sessionId: string): ProposalEvaluationResult | null {
    const session = this.sessions.get(sessionId);
    return session?.result || null;
  }

  /**
   * Get all evaluations
   */
  getAllEvaluations(): ProposalEvaluationResult[] {
    return Array.from(this.sessions.values())
      .map(s => s.result)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Generate export report
   */
  generateExportReport(sessionId: string, format: 'json' | 'markdown' | 'html'): string {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    const { result } = session;

    switch (format) {
      case 'json':
        return JSON.stringify(result, null, 2);
      case 'markdown':
        return this.generateMarkdownReport(result);
      case 'html':
        return this.generateHTMLReport(result);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Generate comprehensive markdown report
   */
  private generateMarkdownReport(result: ProposalEvaluationResult): string {
    const lines: string[] = [];

    lines.push(`# Proposal Evaluation Report`);
    lines.push(`\n**Generated:** ${new Date().toLocaleString()}`);

    // Executive Summary
    lines.push(`\n## Executive Summary`);
    lines.push(`\n${result.executiveSummary.overallAssessment}`);

    lines.push(`\n### Key Strengths`);
    result.executiveSummary.keyStrengths.forEach(s => lines.push(`- ${s}`));

    lines.push(`\n### Critical Weaknesses`);
    result.executiveSummary.criticalWeaknesses.forEach(w => lines.push(`- ${w}`));

    lines.push(`\n### Immediate Actions`);
    result.executiveSummary.immediateActions.forEach((a, i) => lines.push(`${i + 1}. ${a}`));

    // Compliance Scorecard
    lines.push(`\n## Compliance Scorecard`);
    lines.push(`\n| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| **Compliance Score** | ${result.summary.complianceScore}% |`);
    lines.push(`| Mandatory Requirements | ${result.summary.mandatoryMet}/${result.summary.mandatoryRequirements} |`);
    lines.push(`| Total Addressed | ${result.summary.addressed}/${result.summary.totalRequirements} |`);
    lines.push(`| Partially Addressed | ${result.summary.partiallyAddressed} |`);
    lines.push(`| Not Addressed | ${result.summary.notAddressed} |`);

    // Critical Gaps
    if (result.criticalGaps.length > 0) {
      lines.push(`\n## ⚠️ Critical Gaps (${result.criticalGaps.length})`);
      result.criticalGaps.forEach((gap, i) => {
        lines.push(`\n### Gap ${i + 1}: ${gap.section}`);
        lines.push(`**Priority:** ${gap.priority.toUpperCase()}`);
        lines.push(`**Requirement:** ${gap.requirement}`);
        lines.push(`**Risk:** ${gap.complianceRisk}`);
        lines.push(`**Suggested Fix:** ${gap.suggestedFix}`);
      });
    }

    // Win/Loss Insights
    lines.push(`\n## Win/Loss Analysis`);
    const categories = ['strength', 'differentiator', 'weakness', 'risk'];
    categories.forEach(cat => {
      const insights = result.winLossInsights.filter(i => i.category === cat);
      if (insights.length > 0) {
        lines.push(`\n### ${cat.charAt(0).toUpperCase() + cat.slice(1)}s`);
        insights.forEach(insight => {
          lines.push(`\n**${insight.title}** (${insight.impactLevel} impact)`);
          lines.push(`${insight.description}`);
          if (insight.recommendation) {
            lines.push(`→ *${insight.recommendation}*`);
          }
        });
      }
    });

    // Detailed Analysis
    lines.push(`\n## Detailed Analysis by Section`);
    result.bySection.forEach(section => {
      const icon = section.complianceScore === 100 ? '✅' : section.complianceScore >= 70 ? '⚠️' : '❌';
      lines.push(`\n### ${icon} ${section.section}`);
      lines.push(`**Compliance:** ${section.complianceScore}% | **Coverage:** ${section.addressedCount}/${section.totalCount}`);

      section.requirements.forEach((req, i) => {
        const statusIcon = req.coverageLevel === 'full' ? '✅' : req.coverageLevel === 'partial' ? '⚠️' : '❌';
        lines.push(`\n#### ${statusIcon} Req ${i + 1} [${req.priority.toUpperCase()}]`);
        lines.push(`"${req.requirementText}"`);
        lines.push(`\n**Verdict:** ${req.verdict}`);

        if (req.proposalExcerpts.length > 0) {
          lines.push(`\n**Evidence:**`);
          req.proposalExcerpts.forEach(e => {
            lines.push(`> "${e.text}"`);
            lines.push(`> _${e.relevance}_`);
          });
        }

        if (req.suggestedContent) {
          lines.push(`\n**Suggested Content:**`);
          lines.push(`> ${req.suggestedContent}`);
        }
      });
    });

    return lines.join('\n');
  }

  /**
   * Generate HTML report
   */
  private generateHTMLReport(result: ProposalEvaluationResult): string {
    const markdown = this.generateMarkdownReport(result);
    let html = markdown
      .replace(/^#### (.*$)/gm, '<h4>$1</h4>')
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^\- (.*$)/gm, '<li>$1</li>')
      .replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>')
      .replace(/\n\n/g, '</p><p>');

    return `<!DOCTYPE html>
<html>
<head>
  <title>Proposal Evaluation Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; color: #333; line-height: 1.6; }
    h1 { color: #171717; border-bottom: 2px solid #171717; padding-bottom: 10px; }
    h2 { color: #171717; margin-top: 30px; border-bottom: 1px solid #e5e5e5; padding-bottom: 8px; }
    h3 { color: #525252; }
    h4 { color: #737373; margin-top: 20px; }
    table { border-collapse: collapse; width: 100%; margin: 15px 0; }
    th, td { border: 1px solid #e5e5e5; padding: 12px; text-align: left; }
    th { background: #f5f5f5; }
    blockquote { border-left: 3px solid #525252; margin: 10px 0; padding: 10px 20px; background: #fafafa; font-style: italic; }
    li { margin: 5px 0; }
    .critical { background: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 15px 0; }
    .success { color: #059669; }
    .warning { color: #d97706; }
    .error { color: #dc2626; }
  </style>
</head>
<body>
${html}
</body>
</html>`;
  }
}

// Singleton
let evaluationServiceInstance: ProposalEvaluationService | null = null;

export function getProposalEvaluationService(): ProposalEvaluationService {
  if (!evaluationServiceInstance) {
    evaluationServiceInstance = new ProposalEvaluationService();
  }
  return evaluationServiceInstance;
}
