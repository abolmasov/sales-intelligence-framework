import { getOpenAIService } from './openai.service';
import { getCaseStudyService } from './caseStudy.service';
import { getSmartOpportunityMapper } from './smart-opportunity-mapper.service';
import { getInternalKnowledgeService, InternalKnowledgeProgress, InternalKnowledgeDocument, CompanyContext } from './internal-knowledge.service';
import { getResearchEnhancementService } from './research-enhancement.service';
import { getPrismaClient } from '../config/database';
import { ResearchRequest, ResearchProgress } from '../types';
import { MeetingService } from './meeting.service';
import { AccountService } from './account.service';

/**
 * Research Service V2 - Restructured for better organization and client-to-service mapping
 *
 * NEW STRUCTURE:
 * 1. Company Deep Dive (OpenAI Web Search + OpenAI)
 * 2. Competitor Analysis
 * 3. Northstar Integrators Fit Analysis
 * 4. Gap Analysis (what they're missing)
 * 5. Case Study Recommendations (with links)
 * 6. Internal Service Mapping (Northstar Integrators, Atlassian, ServiceNow)
 * 7. Final Compilation
 */
export class ResearchService {
  private openai = getOpenAIService();
  private caseStudy = getCaseStudyService();
  private smartMapper = getSmartOpportunityMapper();
  private internalKb = getInternalKnowledgeService(); // InternalKnowledge for relevant client documents
  private enhancement = getResearchEnhancementService(); // Enhanced sales intelligence
  private prisma = getPrismaClient();
  private knowledgeGraphsLoaded = false;

  // Track cancelled sessions for graceful termination
  private cancelledSessions = new Set<string>();

  private static CancellationError = class CancellationError extends Error {
    constructor(message: string = 'Research cancelled') {
      super(message);
      this.name = 'CancellationError';
    }
  };

  private throwIfCancelled(sessionId: string): void {
    if (this.cancelledSessions.has(sessionId)) {
      throw new ResearchService.CancellationError();
    }
  }

  private isPrismaNotFoundError(error: unknown): boolean {
    const anyErr = error as any;
    const code = anyErr?.code;
    const message = String(anyErr?.message || '');
    return code === 'P2025' || message.includes('Record to update not found') || message.includes('Record to delete does not exist');
  }

  private summarizeInternalKnowledgeStructuredResult(result: any): Record<string, any> {
    return {
      pastEngagementsPreview: String(result?.pastEngagements || '').substring(0, 500),
      directEngagementsCount: Array.isArray(result?.directEngagements) ? result.directEngagements.length : 0,
      ongoingWorkCount: Array.isArray(result?.ongoingWork) ? result.ongoingWork.length : 0,
      caseStudiesCount: Array.isArray(result?.caseStudies) ? result.caseStudies.length : 0,
      similarEngagementsCount: Array.isArray(result?.similarEngagements) ? result.similarEngagements.length : 0,
      relevantArtifactsCount: Array.isArray(result?.relevantArtifacts) ? result.relevantArtifacts.length : 0,
      relevantInternalDocumentsCount: Array.isArray(result?.relevantInternalDocuments) ? result.relevantInternalDocuments.length : 0,
      evidenceCount: Array.isArray(result?.evidence) ? result.evidence.length : 0,
      rawMatchedDocumentsCount: Array.isArray(result?.rawMatchedDocuments) ? result.rawMatchedDocuments.length : 0,
      directEngagementsPreview: Array.isArray(result?.directEngagements)
        ? result.directEngagements.slice(0, 5).map((item: any) => item?.title).filter(Boolean)
        : [],
      caseStudiesPreview: Array.isArray(result?.caseStudies)
        ? result.caseStudies.slice(0, 5).map((item: any) => item?.title).filter(Boolean)
        : [],
      relevantArtifactsPreview: Array.isArray(result?.relevantArtifacts)
        ? result.relevantArtifacts.slice(0, 5).map((item: any) => item?.title).filter(Boolean)
        : [],
    };
  }

  /**
   * Load knowledge graphs into smart mapper (lazy loading)
   */
  private async ensureKnowledgeGraphsLoaded(): Promise<void> {
    if (!this.knowledgeGraphsLoaded) {
      try {
        await this.smartMapper.loadKnowledgeGraphs();
        this.knowledgeGraphsLoaded = true;
      } catch (error) {
        console.warn('⚠️ Could not load knowledge graphs, using default catalog:', error);
        this.knowledgeGraphsLoaded = true; // Don't try again
      }
    }
  }

  /**
   * Main research pipeline - restructured for clarity
   */
  async runResearchPipeline(
    request: ResearchRequest,
    sessionId: string,
    onProgress?: (progress: ResearchProgress) => void,
    requestedBy?: string | null
  ): Promise<any> {
    const startTime = Date.now();

    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔬 STARTING ENHANCED RESEARCH PIPELINE V2');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 Target Company:', request.companyName);
    console.log('🆔 Session ID:', sessionId);
    console.log('⏰ Started at:', new Date().toLocaleString());
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');

    try {
      const canonicalMeetingId = request.meetingId
        ? await this.ensureMeetingExistsForResearch(request)
        : null;

      // Create analysis record
      await this.prisma.analysis.create({
        data: {
          sessionId,
          companyName: request.companyName,
          dealId: request.dealId,
          meetingId: canonicalMeetingId || request.meetingId,
          purposeOfMeeting: request.purposeOfMeeting,
          requestedBy: requestedBy || null,
          status: 'running',
          currentStep: 'Starting research',
        },
      });
      this.throwIfCancelled(sessionId);

      // Run research tasks in parallel
      console.log('');
      console.log('▶ PHASE 0: QUICK COMPANY PROFILE (context for InternalKnowledge)');
      console.log('──────────────────────────────────────────────────────────');
      await this.updateProgress(sessionId, 'Building company profile to enrich internal search', 8, onProgress);

      // Quick profile runs first (~3-5s) so InternalKnowledge queries can be enriched with
      // industry, tech stack, and pain point context rather than just the company name.
      const companyContext = await this.buildQuickCompanyProfile(
        request.companyName,
        request.meetingContext || request.purposeOfMeeting || ''
      );

      console.log('');
      console.log('▶ PHASE 1/6: COMPANY DEEP DIVE (parallel)');
      console.log('──────────────────────────────────────────────────────────');
      await this.updateProgress(sessionId, 'Launching company research, attendees, InternalKnowledge in parallel', 10, onProgress);

      const companyDeepDivePromise = this.performCompanyDeepDive(
        request.companyName,
        request.meetingContext || request.purposeOfMeeting || '',
        request.accessToken
      );
      const externalAttendeeResearchPromise = this.researchExternalAttendees(
        canonicalMeetingId,
        request.companyName,
        request.attendees || []
      );

      // InternalKnowledge now starts with enriched context from the quick profile above.
      const internalKbPreCallPromise = this.fetchInternalKnowledgePreCallAugmentation({
        companyName: request.companyName,
        meetingContext: request.meetingContext || '',
        externalAttendees: request.attendees || [],
        accessToken: request.accessToken,
        companyContext,
      });

      const [companyDeepDive, externalAttendeeResearch] = await Promise.all([
        companyDeepDivePromise,
        externalAttendeeResearchPromise,
      ]);
      this.throwIfCancelled(sessionId);

      // Use whatever internal results have already arrived (non-blocking peek)
      type InternalKbPreCallResult = {
        pastEngagements: string;
        similarEngagements: Array<{ title: string; url?: string; why_relevant: string }>;
        relevantArtifacts: Array<{ title: string; url?: string; type: string; why_relevant: string; excerpt?: string }>;
        caseStudies?: Array<{ title: string; url?: string; why_relevant: string; client?: string; industry?: string; services?: string[]; outcome?: string }>;
        directEngagements?: Array<{ title: string; url?: string; status?: string; why_relevant: string; evidence?: string }>;
        ongoingWork?: Array<{ title: string; url?: string; status?: string; why_relevant: string; evidence?: string }>;
        relevantInternalDocuments?: Array<{ title: string; url?: string; type?: string; why_relevant: string; excerpt?: string }>;
        evidence?: Array<{ claim: string; evidenceTitles: string[] }>;
        rawMatchedDocuments?: Array<{ title: string; url?: string; type?: string; relevanceScore?: number; selectReason?: string; evaluationReason?: string }>;
        rawSummary: string;
      } | null;
      let internalKbPreCall: InternalKbPreCallResult = null;

      console.log('companyDeepDive ->', companyDeepDive);
      console.log('externalAttendeeResearch ->', externalAttendeeResearch);
      console.log('internalKbPreCall ->', internalKbPreCall);

      console.log('✓ Parallel research tasks completed');

      await this.updateProgress(sessionId, 'Generating meeting questionnaire', 65, onProgress);
      const aiQuestionnaire = await this.generatePreCallQuestionnaire({
        companyName: request.companyName,
        purposeOfMeeting: request.purposeOfMeeting || '',
        companyDeepDive: companyDeepDive,
        companyLatestNews: [],
        externalAttendeeResearch,
      });
      this.throwIfCancelled(sessionId);

      // ENHANCED SALES INTELLIGENCE (65-85%)
      console.log('');
      console.log('▶ PHASE 2/6: ENHANCED SALES INTELLIGENCE');
      console.log('──────────────────────────────────────────────────────────');
      await this.updateProgress(sessionId, 'Generating deal health signals and action items', 70, onProgress);

      // Prepare attendees array for enhancement service
      const attendeesForAnalysis = (request.attendees || []).map(a => ({
        name: a.name,
        role: a.role,
        company: a.company,
        email: a.email,
      }));

      // Extract summary text for enhancement service
      const executiveSummaryText = companyDeepDive?.summary || '';

      // Run enhanced analysis in parallel
      const [dealHealthSignals, companyIntelligence, stakeholderInsights] = await Promise.all([
        this.enhancement.generateDealHealthSignals(
          request.companyName,
          executiveSummaryText,
          attendeesForAnalysis,
          '', // internal-kb runs in background; not available yet
          request.purposeOfMeeting
        ),
        this.enhancement.extractCompanyIntelligence(
          request.companyName,
          executiveSummaryText
        ),
        this.enhancement.generateStakeholderInsights(
          request.companyName,
          attendeesForAnalysis,
          executiveSummaryText
        ),
      ]);
      this.throwIfCancelled(sessionId);

      await this.updateProgress(sessionId, 'Generating action items', 80, onProgress);
      const suggestedActions = await this.enhancement.generateActionItems(
        request.companyName,
        executiveSummaryText,
        attendeesForAnalysis,
        request.purposeOfMeeting,
        dealHealthSignals
      );
      this.throwIfCancelled(sessionId);

      console.log('✓ Enhanced sales intelligence generated');
      console.log('  - Deal Health Score:', dealHealthSignals.overallScore);
      console.log('  - Action Items:', suggestedActions.length);
      console.log('  - Stakeholder Insights:', stakeholderInsights.length);

      // FINAL: COMPILE REPORT (85-100%)
      await this.updateProgress(sessionId, 'Compiling final report', 90, onProgress);

      const result = {
        sessionId,
        companyName: request.companyName,

        // Phase 1: Company Deep Dive
        companyDeepDive: companyDeepDive,
        externalAttendeeResearch,
        internalKbPreCall,

        // Metadata
        generatedAt: new Date().toISOString(),
        executionTimeMs: Date.now() - startTime,

        // Fields consumed by the UI
        executiveSummary: companyDeepDive,
        meetingQuestionnaire: (aiQuestionnaire?.questions || []).map((q: any) => q?.question).filter(Boolean).join('\n'),
        aiQuestionnaire,
        integratorCaseStudies: [],
        libraryCaseStudies: [],
        internalKbAiInsights: '', // populated by background merge when internal-kb completes

        // Enhanced Sales Intelligence (NEW)
        dealHealthSignals,
        suggestedActions,
        companyIntelligence,
        stakeholderInsights,
      };

      // Save result to database (external data only — internal search still in-flight)
      try {
        await this.prisma.analysis.update({
          where: { sessionId },
          data: {
            status: 'completed',
            currentStep: 'Completed',
            completedAt: new Date(),
            result: JSON.stringify({ ...result, internalKbStatus: 'pending' }),
          },
        });
      } catch (error) {
        if (this.isCancelled(sessionId) || this.isPrismaNotFoundError(error)) {
          throw new ResearchService.CancellationError();
        }
        throw error;
      }

      await this.updateProgress(sessionId, 'Research completed successfully', 100, onProgress);

      // Background merge: await the internal search (already in-flight) and patch the DB record.
      // Runs in a detached setImmediate — never blocks the response or causes a proxy timeout.
      setImmediate(async () => {
        try {
          const internalKbResult = await internalKbPreCallPromise;

          // Generate discovery questions grounded in internal InternalKnowledge findings
          const internalKbQuestions = internalKbResult
            ? await this.generateInternalKnowledgeContextualQuestions(request.companyName, internalKbResult)
            : [];

          // Re-number InternalKnowledge questions to avoid ID conflicts with existing questions
          const existingQuestions: any[] = result.aiQuestionnaire?.questions || [];
          const maxId = existingQuestions.reduce((max: number, q: any) => Math.max(max, Number(q.id) || 0), 0);
          const numberedInternalKbQuestions = internalKbQuestions.map((q: any, idx: number) => ({
            ...q,
            id: maxId + idx + 1,
          }));

          const mergedResult = {
            ...result,
            internalKbPreCall: internalKbResult,
            internalKbAiInsights: internalKbResult?.pastEngagements || '',
            integratorCaseStudies: internalKbResult?.caseStudies || internalKbResult?.similarEngagements || [],
            internalKbStatus: 'completed',
            aiQuestionnaire: result.aiQuestionnaire
              ? {
                  ...result.aiQuestionnaire,
                  questions: [...existingQuestions, ...numberedInternalKbQuestions],
                }
              : result.aiQuestionnaire,
          };
          await this.prisma.analysis.update({
            where: { sessionId },
            data: { result: JSON.stringify(mergedResult) },
          });
          console.log(`✅ Internal search merged for session ${sessionId} (${internalKbResult?.relevantArtifacts?.length ?? 0} artifacts, ${numberedInternalKbQuestions.length} internal KB questions added)`);
        } catch (err: any) {
          console.error(`⚠️ Background internal search merge failed for session ${sessionId}:`, err.message);
          // Non-fatal — external results are already saved and visible
        }
      });

      console.log('');
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`✅ RESEARCH COMPLETED in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
      console.log('═══════════════════════════════════════════════════════════');
      console.log('');

      return result;

    } catch (error) {
      if (error instanceof ResearchService.CancellationError || this.isCancelled(sessionId)) {
        console.log(`🛑 Research session ${sessionId} stopped (cancelled)`);
        return null;
      }
      console.error('❌ Research pipeline error:', error);

      try {
        await this.prisma.analysis.update({
          where: { sessionId },
          data: {
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      } catch (updateError) {
        if (this.isCancelled(sessionId) || this.isPrismaNotFoundError(updateError)) {
          return null;
        }
        throw updateError;
      }

      throw error;
    }
  }

  private normalizeCompanyCandidate(companyName: string, attendee: { company?: string; email?: string }) {
    if (attendee.company && attendee.company.trim()) return attendee.company.trim();
    const email = (attendee.email || '').trim().toLowerCase();
    if (!email.includes('@')) return companyName;
    return email.split('@')[1] || companyName;
  }

  private isInternalAttendeeEmail(email?: string): boolean {
    if (!email) return false;
    const normalized = email.trim().toLowerCase();
    return normalized.includes('@example.com') || normalized.endsWith('.internal');
  }

  private parseMeetingDate(value?: string): Date | null {
    if (!value) return null;
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }

  private async ensureMeetingExistsForResearch(request: ResearchRequest): Promise<string> {
    const meetingId = (request.meetingId || '').trim();
    if (!meetingId) {
      throw new Error('Missing meetingId for meeting-linked research');
    }

    // Link to account if company name is provided
    let accountId: string | undefined;
    if (request.companyName?.trim()) {
      const { account } = await AccountService.findOrCreate(
        { name: request.companyName.trim() },
        true
      );
      accountId = account.accountId;
    }

    const meetingTitle = (request.meetingTitle || '').trim();
    const fallbackTitle = meetingTitle || `${request.companyName} meeting`;
    const meetingDate = this.parseMeetingDate(request.meetingDate);

    const { meeting } = await MeetingService.findOrCreate(
      {
        meetingId,
        calendarEventId: meetingId,
      },
      {
        title: fallbackTitle,
        meetingDate: meetingDate || undefined,
        accountId,
      },
      true // updateIfExists: fill in accountId if missing
    );

    // Set attendees separately (not part of MeetingService)
    if (request.attendees) {
      await this.prisma.meeting.update({
        where: { meetingId: meeting.meetingId },
        data: {
          externalAttendees: JSON.stringify(request.attendees),
        },
      });
    }

    return meeting.meetingId;
  }

  private async researchExternalAttendees(
    meetingId: string | null,
    companyName: string,
    attendees: Array<{ name: string; email?: string; role?: string; company?: string }>
  ): Promise<any[]> {
    if (!attendees || attendees.length === 0) {
      return [];
    }

    const normalizedInputs = attendees.map((attendee) => ({
      name: (attendee?.name || '').trim() || 'Unknown',
      email: attendee?.email?.trim() || null,
      role: attendee?.role?.trim() || null,
      company: attendee?.company?.trim() || null,
    }));

    const prompt = `You are doing pre-call research.
Analyze ALL external attendees in one run and return ONLY valid JSON (no markdown, no explanations, no extra text).
Context
Target company: ${companyName}
Attendees (JSON array)
${JSON.stringify(normalizedInputs)}
Rules
Return exactly one result per attendee, in the same order as the input array.
Do NOT invent facts.
You may include multiple plausible matches for a single attendee when ambiguity exists.
Order matches from most to least likely.
Clearly label each match with a confidence level: high / medium / low.
Say "couldn’t find" only if there are zero credible matches.
Do not ask follow-up questions.
Use neutral, professional language.
Research content requirements (embedded in the research string)
For each plausible match, include:
Current role and company (if known)
Primary geographic origin inferred from educational background (explicitly state if inferred or unknown)
Field of study and institution (if known)
Relevant professional background
Explicit confidence statement for that match
Call out assumptions, ambiguity, or missing data when applicable
If multiple matches exist, clearly separate them (e.g., “Match 1”, “Match 2”) and order by likelihood.
Output JSON schema (must match exactly)
{
  "attendees": [
    {
      "name": string,
      "company": string,
      "research": string
    }
  ]
}`;

    let batchOutputText = '';
    let parsed: any | null = null;
    try {
      const response: any = await this.openai.webSearch({ query: prompt });
      batchOutputText = String(response?.output_text || '').trim();
      parsed = this.tryParseJsonObjectFromText(batchOutputText);
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to research external attendees';
      console.error('❌ External attendee batch research error:', errorMessage);
    }

    const parsedList: any[] | null = Array.isArray(parsed?.attendees) ? parsed.attendees : null;

    const results = normalizedInputs.map((input, idx) => {
      const fallbackCompany = input.company || companyName || '';
      const candidate =
        (parsedList && parsedList[idx] && typeof parsedList[idx] === 'object' ? parsedList[idx] : null) ||
        (parsedList
          ? parsedList.find((item) => {
              const itemName = typeof item?.name === 'string' ? item.name.trim().toLowerCase() : '';
              return itemName && itemName === input.name.trim().toLowerCase();
            })
          : null);

      const name = typeof candidate?.name === 'string' && candidate.name.trim() ? candidate.name.trim() : input.name;
      const company =
        typeof candidate?.company === 'string' && candidate.company.trim() ? candidate.company.trim() : fallbackCompany;
      const research =
        typeof candidate?.research === 'string' && candidate.research.trim()
          ? candidate.research.trim()
          : batchOutputText || 'No research output generated.';

      return { name, company, research };
    });

    const persistOne = async (input: (typeof normalizedInputs)[number], result: any) => {
      const attendeeKey = (input.email || `${input.name}|${input.company || companyName}`).toLowerCase();
      const researchJson = { name: result.name, company: result.company, research: result.research };

      try {
        const attendeeRecord = await this.upsertAttendeeProfile({
          name: input.name,
          email: input.email,
          company: input.company || result.company || null,
          research: researchJson,
        });

        if (meetingId) {
          await this.prisma.meetingAttendeeResearch.upsert({
            where: {
              meetingId_key_attendeeType: {
                meetingId,
                key: attendeeKey,
                attendeeType: 'external',
              },
            },
            update: {
              attendeeId: attendeeRecord?.id || null,
              key: attendeeKey,
              name: input.name,
              email: input.email,
              company: input.company || result.company || null,
              research: researchJson,
              status: 'completed',
              errorMessage: null,
              lastResearchedAt: new Date(),
            },
            create: {
              meetingId,
              attendeeId: attendeeRecord?.id || null,
              attendeeType: 'external',
              key: attendeeKey,
              name: input.name,
              email: input.email,
              company: input.company || result.company || null,
              research: researchJson,
              status: 'completed',
              errorMessage: null,
              lastResearchedAt: new Date(),
            },
          });
        }
      } catch (error: any) {
        const errorMessage = error?.message || 'Failed to persist attendee research';
        console.error('❌ Failed to persist attendee research:', errorMessage, { attendeeKey });

        if (meetingId) {
          await this.prisma.meetingAttendeeResearch.upsert({
            where: {
              meetingId_key_attendeeType: {
                meetingId,
                key: attendeeKey,
                attendeeType: 'external',
              },
            },
            update: {
              key: attendeeKey,
              name: input.name,
              email: input.email,
              company: input.company || result.company || null,
              status: 'error',
              errorMessage,
              lastResearchedAt: new Date(),
            },
            create: {
              meetingId,
              attendeeType: 'external',
              key: attendeeKey,
              name: input.name,
              email: input.email,
              company: input.company || result.company || null,
              status: 'error',
              errorMessage,
              lastResearchedAt: new Date(),
            },
          });
        }
      }
    };

    await Promise.all(results.map((result, idx) => persistOne(normalizedInputs[idx], result)));
    return results;
  }

  private async upsertAttendeeProfile(input: {
    name: string;
    email: string | null;
    company: string | null;
    research: any;
  }) {
    const email = input.email ? input.email.trim().toLowerCase() : null;

    const existing = email
      ? await this.prisma.attendee.findFirst({ where: { email } })
      : await this.prisma.attendee.findFirst({
          where: {
            name: input.name,
            company: input.company || undefined,
          },
        });

    const profileData = input.research ? JSON.stringify(input.research) : null;
    const linkedinUrl =
      typeof input.research?.linkedin_url === 'string'
        ? input.research.linkedin_url
        : typeof input.research?.linkedinUrl === 'string'
          ? input.research.linkedinUrl
          : null;
    const role =
      typeof input.research?.role === 'string'
        ? input.research.role
        : typeof input.research?.current_role === 'string'
          ? input.research.current_role
          : null;

    if (existing) {
      return this.prisma.attendee.update({
        where: { id: existing.id },
        data: {
          name: input.name,
          email,
          company: input.company,
          role: role || existing.role,
          linkedinUrl: linkedinUrl || existing.linkedinUrl,
          profileData: profileData || existing.profileData,
          lastUpdated: new Date(),
        },
      });
    }

    return this.prisma.attendee.create({
      data: {
        name: input.name,
        email,
        company: input.company,
        role,
        linkedinUrl,
        profileData,
        lastUpdated: new Date(),
      },
    });
  }

  private async researchPersonPublic(attendee: { name: string; email?: string; company?: string },companyName: string) {
    const name = attendee.name || 'Unknown person';
    const email = attendee.email;
    const company = companyName;

    // Single web search for the person; use results directly (no second LLM call)
    const results = await this.openai
      .webSearch({
        query: ` ${name} ${company} reserach Linkedin or signalhire and do a background check like who he is whered he study what was he doing before this role with publicly available information. fetch details even if matches slightly with confidence > 0.4. also tell how confident you are with a confidence score. you can trust signalhire.give me only the result dont speak unneccesarily
        `
        
      })
      .catch(() => []);

    
    return `# External attendee research: ${name}\n${company ? `Company: ${company}\n\n` : ''}${results.output_text}`;
  }
  private async fetchCompanyLatestNews(companyName: string) {
    const results = await this.openai
      .webSearch({
        query: `${companyName} latest news updates`,
        maxResults: 8,
      })
      .catch(() => []);

    const sourceMaterial = results
      .slice(0, 10)
      .map((r: any, idx: number) => `[${idx + 1}] ${r.title}\nURL: ${r.url}\n${r.content}\n`)
      .join('\n---\n');

    const prompt = `Research the following organization using public web data only.

Identifier:
- Organization: ${companyName}

Tasks:
1. Focus on the most recent notable updates (press releases, filings, leadership changes, product launches, partnerships, incidents).
2. Cross-check claims across sources when possible.
3. Summarize only verified facts.
4. Clearly state unknowns.

Constraints:
- Public sources only.
- No speculation.
- No sensitive personal data.

Return JSON only:
{
  "company": string,
  "highlights": string[],
  "unknowns": string[],
  "sources": { "title": string, "url": string, "snippet": string }[]
}

Sources:
${sourceMaterial || '(no sources found)'}`;

    const structured = await this.openai.generateStructuredCompletion<any>(
      [
        { role: 'system', content: 'You output valid JSON only and follow the rules strictly.' },
        { role: 'user', content: prompt },
      ],
      undefined,
      0.1
    );

    return {
      ...(structured || {}),
      company: companyName,
      sources: results.slice(0, 8).map((r: any) => ({
        title: r.title,
        url: r.url,
        snippet: (r.content || '').slice(0, 280),
      })),
    };
  }

  private tryParseJsonObjectFromText(text: string): any | null {
    if (!text) return null;
    const trimmed = text.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return null;
      }
    }

    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }

  private extractQuestionsFromText(text: string): string[] {
    if (!text) return [];
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const questions: string[] = [];

    for (const line of lines) {
      const normalized = line.replace(/^\d+[\).\s-]+/, '').replace(/^[-*•]\s+/, '').trim();
      if (!normalized) continue;
      if (normalized.length < 8) continue;
      if (!normalized.includes('?') && !/^(how|what|why|who|when|where|which|tell|walk|describe)\b/i.test(normalized)) {
        continue;
      }
      const candidate = normalized.endsWith('?') ? normalized : `${normalized}?`;
      questions.push(candidate);
    }

    const unique = Array.from(new Set(questions.map((q) => q.trim()))).filter(Boolean);
    return unique.slice(0, 20);
  }

  private async fetchInternalKnowledgePreCallAugmentation(params: {
    companyName: string;
    meetingContext: string;
    externalAttendees: Array<{ name: string; email?: string; role?: string; company?: string }>;
    accessToken?: string;
    companyContext?: CompanyContext;
  }): Promise<
    | {
        pastEngagements: string;
        similarEngagements: Array<{ title: string; url?: string; why_relevant: string }>;
        relevantArtifacts: Array<{ title: string; url?: string; type: string; why_relevant: string; excerpt?: string }>;
        caseStudies?: Array<{ title: string; url?: string; why_relevant: string; client?: string; industry?: string; services?: string[]; outcome?: string }>;
        directEngagements?: Array<{ title: string; url?: string; status?: string; why_relevant: string; evidence?: string }>;
        ongoingWork?: Array<{ title: string; url?: string; status?: string; why_relevant: string; evidence?: string }>;
        relevantInternalDocuments?: Array<{ title: string; url?: string; type?: string; why_relevant: string; excerpt?: string }>;
        evidence?: Array<{ claim: string; evidenceTitles: string[] }>;
        rawMatchedDocuments?: Array<{ title: string; url?: string; type?: string; relevanceScore?: number; selectReason?: string; evaluationReason?: string }>;
        rawSummary: string;
      }
    | null
  > {
    const { companyName, meetingContext, externalAttendees, accessToken, companyContext } = params;

    const externalOnly = (externalAttendees || [])
      .map((attendee) => ({
        name: (attendee.name || '').trim(),
        email: attendee.email ? attendee.email.trim().toLowerCase() : undefined,
        company: this.normalizeCompanyCandidate(companyName, attendee),
      }))
      .filter((attendee) => attendee.name)
      .filter((attendee) => !this.isInternalAttendeeEmail(attendee.email));

    console.log(
      '📤 Pre-call InternalKnowledge request context:',
      JSON.stringify({
        companyName,
        meetingContext: meetingContext || '',
        externalAttendeesCount: externalOnly.length,
        externalAttendees: externalOnly,
        companyContext: companyContext || null,
      })
    );

    const response = await this.internalKb.searchPreCallAugmentation(
      companyName,
      meetingContext || '',
      externalOnly,
      accessToken,
      undefined,
      companyContext
    );

    console.log(
      '📥 InternalKnowledge raw result received (before LLM synthesis):',
      JSON.stringify(response)
    );

    const allDocs = response.documents || [];

    if (allDocs.length === 0) {
      const emptyResult = {
        pastEngagements: response.summary || '',
        similarEngagements: [],
        relevantArtifacts: [],
        caseStudies: [],
        directEngagements: [],
        ongoingWork: [],
        relevantInternalDocuments: [],
        evidence: [],
        rawMatchedDocuments: [],
        rawSummary: response.summary || '',
      };
      console.log('📦 Structured InternalKnowledge pre-call result:', JSON.stringify(this.summarizeInternalKnowledgeStructuredResult(emptyResult)));
      return emptyResult;
    }

    // ── GPT synthesis pass ────────────────────────────────────────────
    // Feed all raw documents to GPT for structured, in-depth analysis
    // instead of relying on the Sales Intelligence API's own summary.
    const normalizedCompanyName = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const directEvidenceDocs = allDocs.filter((doc: InternalKnowledgeDocument) => {
      const haystack = [
        doc.title,
        doc.content,
        doc.url,
        doc.metadata?.path,
        doc.metadata?.summary,
        ...(Array.isArray(doc.metadata?.customers) ? doc.metadata.customers : []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');

      return haystack.includes(normalizedCompanyName);
    });

    const directEvidenceSummary = directEvidenceDocs.length
      ? directEvidenceDocs
          .slice(0, 12)
          .map((doc, i) => `- [${i + 1}] ${doc.title}${doc.url ? ` (${doc.url})` : ''}`)
          .join('\n')
      : '- None found by exact company-name match in document titles/content/URLs.';

    const docContext = allDocs
      .map((doc: InternalKnowledgeDocument, i: number) => {
        const topics = (doc.metadata?.topics || []).slice(0, 5).join(', ');
        const content = doc.content.substring(0, 250).replace(/\s+/g, ' ').trim();
        const customers = Array.isArray(doc.metadata?.customers) ? doc.metadata.customers.slice(0, 5).join(', ') : '';
        return (
          `[${i + 1}] "${doc.title}" | type: ${doc.documentType || 'document'} | score: ${(doc.relevanceScore ?? 0).toFixed(2)}\n` +
          (doc.metadata?.path ? `   path: ${doc.metadata.path}\n` : '') +
          (customers ? `   customers: ${customers}\n` : '') +
          (topics ? `   topics: ${topics}\n` : '') +
          (doc.metadata?.selectReason ? `   selectReason: ${doc.metadata.selectReason}\n` : '') +
          (doc.metadata?.evaluationReason ? `   evaluationReason: ${doc.metadata.evaluationReason}\n` : '') +
          `   content: ${content}`
        );
      })
      .join('\n\n');

    const synthesisPrompt = `You are a senior Northstar Integrators sales strategist. Analyse these ${allDocs.length} internal Northstar Integrators knowledge-base documents retrieved for a pre-call meeting with ${companyName} and produce a structured JSON response.

Direct engagement evidence for ${companyName} from the full result set:
${directEvidenceSummary}

Documents (sorted by relevance, full set):
${docContext}

${meetingContext ? `Meeting context: ${meetingContext.substring(0, 600)}` : ''}

Return ONLY valid JSON matching this exact schema — no markdown, no prose outside JSON:
{
  "pastEngagements": "<Detailed markdown narrative using ## headings and bullet lists. Cover: direct work with ${companyName}, active pursuits or ongoing work, strongest analogous case studies, recurring patterns, service areas, outcomes, and concrete metrics where available. Cite document titles inline in parentheses.>",
  "directEngagements": [
    {
      "title": "<direct customer document or engagement title>",
      "status": "<ongoing|completed|proposal|rfp|unknown>",
      "why_relevant": "<specific explanation based on the document>",
      "evidence": "<direct evidence from the document title/content showing relationship>"
    }
  ],
  "ongoingWork": [
    {
      "title": "<active pursuit / ongoing work document title>",
      "status": "<ongoing|proposal|renewal|support|unknown>",
      "why_relevant": "<why this suggests active work or an open pursuit>",
      "evidence": "<direct evidence from the document>"
    }
  ],
  "caseStudies": [
    {
      "title": "<case study or most relevant analogous engagement>",
      "why_relevant": "<specific, concrete explanation referencing actual content from the document>",
      "client": "<client name if mentioned, else omit>",
      "industry": "<industry/sector>",
      "services": ["<Northstar Integrators service delivered>"],
      "outcome": "<measurable outcome or result if mentioned>"
    }
  ],
  "similarEngagements": [
    {
      "title": "<document or engagement title>",
      "why_relevant": "<specific, concrete explanation referencing actual content from the document>",
      "client": "<client name if mentioned, else omit>",
      "industry": "<industry/sector>",
      "services": ["<Northstar Integrators service delivered>"],
      "outcome": "<measurable outcome or result if mentioned>"
    }
  ],
  "relevantArtifacts": [
    {
      "title": "<document title>",
      "type": "<case_study|proposal|sow|playbook|document>",
      "why_relevant": "<one sentence on why this is useful for the meeting>",
      "excerpt": "<the single most compelling sentence from the document content>"
    }
  ],
  "relevantInternalDocuments": [
    {
      "title": "<internal document title>",
      "type": "<proposal|sow|case_study|deck|spreadsheet|document>",
      "why_relevant": "<specific reason it matters for this meeting>",
      "excerpt": "<important supporting excerpt>"
    }
  ],
  "evidence": [
    {
      "claim": "<claim about direct experience, ongoing work, or relevant capability>",
      "evidenceTitles": ["<supporting document title>"]
    }
  ],
  "unknowns": ["<topic or area where no relevant information was found>"]
}

Rules:
- directEngagements: up to 10 entries, strongest direct evidence first
- ongoingWork: up to 10 entries
- caseStudies: up to 12 entries
- similarEngagements: up to 12 entries, most relevant first
- relevantArtifacts: up to 15 entries covering the breadth of document types found
- relevantInternalDocuments: up to 20 entries
- evidence: up to 20 entries
- Unless the evidence is genuinely absent, do not return tiny sections. Aim for at least 4 direct or ongoing items, 6 similar/case-study items, and 8 relevant internal documents when the source set supports it.
- Be specific — reference actual client names, metrics, and services from the documents
- If the direct engagement evidence section or any document clearly references ${companyName}, treat that as evidence of direct engagement or active pursuit and do NOT say "no evidence"
- When there are direct-engagement documents, prioritize them over analogous examples
- Do not mix weakly related analogs into direct engagement sections
- Prefer documents that explicitly name ${companyName}; put unrelated generic decks lower in relevance
- Use the full document set provided here, not just the first few results`;

    try {
      const synthesis = await this.openai.generateStructuredCompletion<any>(
        [
          { role: 'system', content: 'Output valid JSON only. No markdown code fences. No text outside the JSON object.' },
          { role: 'user', content: synthesisPrompt },
        ],
        undefined,
        0.2
      );

      // Preserve document URLs by matching titles back to allDocs
      const urlByTitle = new Map<string, string>();
      for (const doc of allDocs) {
        if (doc.url) urlByTitle.set(doc.title.toLowerCase(), doc.url);
      }

      const enrichedSimilar = (Array.isArray(synthesis?.similarEngagements) ? synthesis.similarEngagements : [])
        .map((e: any) => ({
          ...e,
          url: e.url || urlByTitle.get((e.title || '').toLowerCase()),
        }));

      const enrichedDirect = (Array.isArray(synthesis?.directEngagements) ? synthesis.directEngagements : [])
        .map((e: any) => ({
          ...e,
          url: e.url || urlByTitle.get((e.title || '').toLowerCase()),
        }));

      const enrichedOngoing = (Array.isArray(synthesis?.ongoingWork) ? synthesis.ongoingWork : [])
        .map((e: any) => ({
          ...e,
          url: e.url || urlByTitle.get((e.title || '').toLowerCase()),
        }));

      const enrichedCaseStudies = (Array.isArray(synthesis?.caseStudies) ? synthesis.caseStudies : [])
        .map((e: any) => ({
          ...e,
          url: e.url || urlByTitle.get((e.title || '').toLowerCase()),
        }));

      const enrichedArtifacts = (Array.isArray(synthesis?.relevantArtifacts) ? synthesis.relevantArtifacts : [])
        .map((a: any) => ({
          ...a,
          url: a.url || urlByTitle.get((a.title || '').toLowerCase()),
        }));

      const enrichedInternalDocuments = (Array.isArray(synthesis?.relevantInternalDocuments) ? synthesis.relevantInternalDocuments : [])
        .map((a: any) => ({
          ...a,
          url: a.url || urlByTitle.get((a.title || '').toLowerCase()),
        }));

      const dedupeByTitle = <T extends { title?: string }>(items: T[]): T[] => {
        const seen = new Set<string>();
        return items.filter((item) => {
          const key = String(item?.title || '').trim().toLowerCase();
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      };

      const fallbackDirectFromDocs = directEvidenceDocs.map((doc: InternalKnowledgeDocument) => ({
        title: doc.title,
        url: doc.url,
        status: 'unknown',
        why_relevant: 'Direct customer evidence found in matched InternalKnowledge documents.',
        evidence: doc.metadata?.summary || doc.content.substring(0, 220).replace(/\s+/g, ' ').trim(),
      }));

      const fallbackSimilarFromDocs = allDocs.map((doc: InternalKnowledgeDocument) => ({
        title: doc.title,
        url: doc.url,
        why_relevant: doc.metadata?.summary || doc.content.substring(0, 220).replace(/\s+/g, ' ').trim(),
        client: undefined,
        industry: undefined,
        services: [],
        outcome: undefined,
      }));

      const fallbackArtifactsFromDocs = allDocs.map((doc: InternalKnowledgeDocument) => ({
        title: doc.title,
        url: doc.url,
        type: doc.documentType || 'document',
        why_relevant: doc.metadata?.summary || doc.content.substring(0, 220).replace(/\s+/g, ' ').trim(),
        excerpt: doc.content.substring(0, 180).replace(/\s+/g, ' ').trim(),
      }));

      const fallbackEvidenceFromDocs = dedupeByTitle(allDocs.map((doc: InternalKnowledgeDocument) => ({
        title: doc.title,
        claim: `Relevant internal evidence found for ${companyName}`,
        evidenceTitles: [doc.title],
      }))).map(({ title: _title, ...rest }) => rest);

      const finalDirect = dedupeByTitle([
        ...enrichedDirect,
        ...fallbackDirectFromDocs,
      ]).slice(0, 10);

      const finalOngoing = dedupeByTitle([
        ...enrichedOngoing,
        ...finalDirect,
      ]).slice(0, 10);

      const finalCaseStudies = dedupeByTitle([
        ...enrichedCaseStudies,
        ...enrichedSimilar,
        ...fallbackSimilarFromDocs,
      ]).slice(0, 12);

      const finalSimilar = dedupeByTitle([
        ...enrichedSimilar,
        ...enrichedCaseStudies,
        ...fallbackSimilarFromDocs,
      ]).slice(0, 12);

      const finalInternalDocuments = dedupeByTitle([
        ...enrichedInternalDocuments,
        ...enrichedArtifacts,
        ...fallbackArtifactsFromDocs,
      ]).slice(0, 20);

      const finalArtifacts = dedupeByTitle([
        ...enrichedArtifacts,
        ...enrichedInternalDocuments,
        ...fallbackArtifactsFromDocs,
      ]).slice(0, 15);

      const finalEvidence = Array.isArray(synthesis?.evidence) && synthesis.evidence.length
        ? synthesis.evidence
        : fallbackEvidenceFromDocs.slice(0, 20);

      const synthesizedPastEngagements = String(synthesis?.pastEngagements || '').trim();
      const finalPastEngagements = synthesizedPastEngagements.length > 700
        ? synthesizedPastEngagements
        : [
            synthesizedPastEngagements,
            finalDirect.length
              ? `## Direct Engagements\n${finalDirect.slice(0, 5).map((item: any) => `- ${item.title}: ${item.why_relevant}`).join('\n')}`
              : '',
            finalCaseStudies.length
              ? `## Relevant Case Studies\n${finalCaseStudies.slice(0, 6).map((item: any) => `- ${item.title}: ${item.why_relevant}`).join('\n')}`
              : '',
            finalArtifacts.length
              ? `## Relevant Internal Documents\n${finalArtifacts.slice(0, 8).map((item: any) => `- ${item.title}: ${item.why_relevant}`).join('\n')}`
              : '',
          ]
            .filter(Boolean)
            .join('\n\n');

      console.log(
        `✅ InternalKnowledge synthesis: ${finalDirect.length} direct engagements, ` +
        `${finalCaseStudies.length} case studies, ${finalArtifacts.length} artifacts from ${allDocs.length} documents`
      );

      const structuredResult = {
        pastEngagements: finalPastEngagements || response.summary || '',
        directEngagements: finalDirect,
        ongoingWork: finalOngoing,
        caseStudies: finalCaseStudies,
        similarEngagements: finalSimilar,
        relevantArtifacts: finalArtifacts,
        relevantInternalDocuments: finalInternalDocuments,
        evidence: finalEvidence,
        rawMatchedDocuments: allDocs.map((doc: InternalKnowledgeDocument) => ({
          title: doc.title,
          url: doc.url,
          type: doc.documentType || 'document',
          relevanceScore: doc.relevanceScore,
          selectReason: doc.metadata?.selectReason,
          evaluationReason: doc.metadata?.evaluationReason,
        })),
        rawSummary: response.summary || '',
      };
      console.log('📦 Structured InternalKnowledge pre-call result:', JSON.stringify(this.summarizeInternalKnowledgeStructuredResult(structuredResult)));
      return structuredResult;
    } catch (synthErr: any) {
      // Synthesis failed — fall back to basic mapping so we don't lose the documents
      console.error('⚠️ InternalKnowledge GPT synthesis failed, falling back to basic mapping:', synthErr.message);
      const fallbackResult = {
        pastEngagements: response.summary || '',
        directEngagements: directEvidenceDocs.map((doc: InternalKnowledgeDocument) => ({
          title: doc.title,
          url: doc.url,
          status: 'unknown',
          why_relevant: 'Document directly references the customer or active pursuit.',
          evidence: doc.metadata?.summary || doc.content.substring(0, 200).replace(/\s+/g, ' ').trim(),
        })),
        ongoingWork: directEvidenceDocs.map((doc: InternalKnowledgeDocument) => ({
          title: doc.title,
          url: doc.url,
          status: 'unknown',
          why_relevant: 'Potential ongoing work, proposal, or direct customer artifact.',
          evidence: doc.metadata?.summary || doc.content.substring(0, 200).replace(/\s+/g, ' ').trim(),
        })),
        caseStudies: (response.rawReferences || []).map((ref: any) => ({
          title: ref.title || 'Northstar Integrators Resource',
          url: ref.referenceUrl || ref.url,
          why_relevant: 'Relevant Northstar Integrators case study or knowledge base resource',
        })),
        similarEngagements: (response.rawReferences || []).map((ref: any) => ({
          title: ref.title || 'Northstar Integrators Resource',
          url: ref.referenceUrl || ref.url,
          why_relevant: 'Relevant Northstar Integrators case study or knowledge base resource',
        })),
        relevantArtifacts: allDocs.map((doc: InternalKnowledgeDocument) => ({
          title: doc.title,
          url: doc.url,
          type: doc.documentType || 'document',
          why_relevant: doc.content.substring(0, 200).replace(/\s+/g, ' ').trim(),
          excerpt: doc.metadata?.summary?.substring(0, 150),
        })),
        relevantInternalDocuments: allDocs.map((doc: InternalKnowledgeDocument) => ({
          title: doc.title,
          url: doc.url,
          type: doc.documentType || 'document',
          why_relevant: doc.content.substring(0, 200).replace(/\s+/g, ' ').trim(),
          excerpt: doc.metadata?.summary?.substring(0, 150),
        })),
        evidence: directEvidenceDocs.map((doc: InternalKnowledgeDocument) => ({
          claim: `Document evidence found for ${companyName}`,
          evidenceTitles: [doc.title],
        })),
        rawMatchedDocuments: allDocs.map((doc: InternalKnowledgeDocument) => ({
          title: doc.title,
          url: doc.url,
          type: doc.documentType || 'document',
          relevanceScore: doc.relevanceScore,
          selectReason: doc.metadata?.selectReason,
          evaluationReason: doc.metadata?.evaluationReason,
        })),
        rawSummary: response.summary || '',
      };
      console.log('📦 Structured InternalKnowledge pre-call result:', JSON.stringify(this.summarizeInternalKnowledgeStructuredResult(fallbackResult)));
      return fallbackResult;
    }
  }

  private async generatePreCallQuestionnaire(params: {
    companyName: string;
    purposeOfMeeting: string;
    companyDeepDive: any;
    companyLatestNews: any;
    externalAttendeeResearch: any[];
  }): Promise<any> {
    const { companyName, purposeOfMeeting, companyDeepDive, companyLatestNews, externalAttendeeResearch } = params;

    const latestHighlights = Array.isArray(companyLatestNews?.highlights)
      ? companyLatestNews.highlights.filter(Boolean).slice(0, 8)
      : [];

    const attendeeNames = Array.isArray(externalAttendeeResearch)
      ? externalAttendeeResearch
          .map((a: any) => a?.name || a?.email)
          .filter(Boolean)
          .slice(0, 8)
      : [];

    const prompt = `Create a pre-call discovery questionnaire for an upcoming meeting.

Company: ${companyName}
Purpose of meeting (if provided): ${purposeOfMeeting || '(not provided)'}

Public company research summary:
${companyDeepDive?.summary || '(not available)'}

Most recent company updates (public sources):
${latestHighlights.length ? latestHighlights.map((h: string) => `- ${h}`).join('\n') : '(not available)'}

External attendees (names only; public research handled separately):
${attendeeNames.length ? attendeeNames.map((n: string) => `- ${n}`).join('\n') : '(none)'}

Requirements:
- Output valid JSON only.
- Return 10–14 questions.
- Use categories from: discovery, pain-point, business-value, solution-fit, technical, transformation, ai-readiness.
- Each question should be specific and actionable.
- Include at least 2 questions explicitly referencing recent company updates.
- Do not mention competitor analysis.

IMPORTANT - AI Services Discovery:
Always include 2-3 questions that probe for AI-related opportunities. Northstar Integrators offers three new AI services:

1. **AI Behavioral Transformation** - Overcoming AI adoption resistance and building AI-ready culture
   - Probe: AI tool adoption (Copilot, ChatGPT), workforce readiness, skills gaps, cultural barriers
   - Example: "What has been your team's experience with AI tools like Copilot or ChatGPT? Are there adoption challenges?"

2. **Rovo Augmented Product Development** - Leveraging Atlassian Rovo for AI-powered development
   - Probe: Atlassian usage, interest in AI agents, knowledge discovery pain points
   - Example: "How do teams currently find information across Confluence and Jira? Would AI-powered search help?"

3. **AI-First Operating Model Design** - Enterprise AI governance and scalable practices
   - Probe: AI strategy maturity, governance needs, scaling challenges
   - Example: "Do you have an AI Center of Excellence or governance framework for AI initiatives?"

JSON format:
{
  "researchContext": string,
  "valueProposition": string,
  "questions": [
    {
      "id": number,
      "question": string,
      "category": string,
      "context": string,
      "northstar_connection": string,
      "product_focus": string,
      "target_persona": string
    }
  ]
}`;

    const structured = await this.openai.generateStructuredCompletion<any>(
      [
        { role: 'system', content: 'You output valid JSON only.' },
        { role: 'user', content: prompt },
      ],
      undefined,
      0.2
    );

    const baseQuestions = Array.isArray(structured?.questions) ? structured.questions : [];
    const normalizedBase = baseQuestions
      .map((q: any, idx: number) => ({
        id: Number.isFinite(Number(q?.id)) ? Number(q.id) : idx + 1,
        question: String(q?.question || '').trim(),
        category: String(q?.category || 'discovery').trim(),
        context: String(q?.context || '').trim(),
        northstar_connection: String(q?.northstar_connection || '').trim(),
        product_focus: String(q?.product_focus || '').trim(),
        target_persona: String(q?.target_persona || '').trim(),
      }))
      .filter((q: any) => q.question);

    const existing = new Set(normalizedBase.map((q: any) => q.question.toLowerCase()));
    return {
      researchContext: String(structured?.researchContext || '').trim(),
      valueProposition: String(structured?.valueProposition || '').trim(),
      questions: normalizedBase,
    };
  }

  /**
   * Generate discovery questions grounded in internal InternalKnowledge findings.
   * Called from the background merge after InternalKnowledge search completes.
   */
  private async generateInternalKnowledgeContextualQuestions(
    companyName: string,
    internalKbResult: { pastEngagements: string; similarEngagements: Array<any>; relevantArtifacts: Array<any>; rawSummary: string }
  ): Promise<any[]> {
    const engagementTitles = (internalKbResult.similarEngagements || [])
      .slice(0, 5)
      .map((e: any) => e.title)
      .filter(Boolean)
      .join('\n- ');

    const artifactTitles = (internalKbResult.relevantArtifacts || [])
      .slice(0, 5)
      .map((a: any) => `${a.title} (${a.type || 'document'})`)
      .filter(Boolean)
      .join('\n- ');

    const summary = (internalKbResult.pastEngagements || internalKbResult.rawSummary || '').substring(0, 1500);

    if (!summary && !engagementTitles && !artifactTitles) return [];

    const prompt = `You are a senior Northstar Integrators sales strategist preparing for a meeting with ${companyName}.

Based on the following INTERNAL Northstar Integrators knowledge base findings, generate 4-5 highly targeted discovery questions a Northstar Integrators sales rep should ask. These must be directly grounded in the specific internal findings below — not generic questions.

Internal Findings Summary:
${summary || '(not available)'}

Similar Past Engagements Found:
${engagementTitles ? `- ${engagementTitles}` : '(none)'}

Relevant Internal Artifacts:
${artifactTitles ? `- ${artifactTitles}` : '(none)'}

Requirements:
- Directly reference patterns, outcomes, or themes from the internal case studies above
- Probe how ${companyName}'s situation compares to past Northstar Integrators engagements
- Be specific — avoid generic questions
- Output a valid JSON array only (no markdown code fences, no extra text)

JSON format:
[
  {
    "id": 1,
    "question": "...",
    "category": "internal-knowledge",
    "context": "Based on Northstar Integrators's internal case studies: [specific reference to the findings above]",
    "northstar_connection": "...",
    "product_focus": "...",
    "target_persona": "Decision Makers",
    "internal_kb_sourced": true
  }
]`;

    try {
      const parsed = await this.openai.generateStructuredCompletion<any>(
        [
          { role: 'system', content: 'Output a valid JSON array only. No markdown code fences, no extra text.' },
          { role: 'user', content: prompt },
        ],
        undefined,
        0.3
      );
      const questions = Array.isArray(parsed) ? parsed : (parsed as any)?.questions || [];
      return questions.filter((q: any) => q?.question);
    } catch (err: any) {
      console.error('⚠️ generateInternalKnowledgeContextualQuestions failed:', err.message);
      return [];
    }
  }

  /**
   * Search SharePoint for past RFPs, SOWs, and proposals related to the company
   * This is optional and requires SharePoint configuration
   */
  /**
   * PHASE 0: Quick Company Profile
   *
   * Fast (~4-5s) single web search + GPT extraction that returns a structured
   * snapshot of the company (industry, size, tech stack, initiatives, pain points).
   * This runs before InternalKnowledge so its output can be injected into the search queries,
   * making them significantly more targeted than bare company-name searches.
   */
  private async buildQuickCompanyProfile(
    companyName: string,
    meetingContext?: string
  ): Promise<CompanyContext> {
    try {
      const searchResult = await this.openai
        .webSearch({
          query: `${companyName} company industry size technology stack strategic initiatives challenges 2024 2025`,
          maxResults: 5,
        })
        .catch(() => ({ output_text: '' } as any));

      const rawText: string = (searchResult?.output_text || '').substring(0, 3000);
      if (!rawText) return {};

      const extracted = await this.openai.generateChatCompletion({
        messages: [
          {
            role: 'system',
            content: 'You are a B2B sales researcher. Extract structured company attributes from web search snippets. Be concise and factual. Return ONLY valid JSON — no markdown, no prose.',
          },
          {
            role: 'user',
            content: `Extract attributes for ${companyName} from the text below.${meetingContext ? ` Meeting context: ${meetingContext.substring(0, 300)}.` : ''}

Text:
${rawText}

Return JSON matching exactly this schema (omit fields you cannot determine):
{
  "industry": "<primary industry/sector, e.g. financial services, healthcare IT, retail>",
  "size": "<company size tier: startup / mid-market / enterprise / large enterprise>",
  "techStack": ["<tool or platform>", ...],
  "knownInitiatives": ["<current strategic initiative>", ...],
  "painPoints": ["<known business challenge>", ...]
}`,
          },
        ],
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        maxTokens: 400,
      });

      const json = extracted.replace(/```json|```/g, '').trim();
      const parsed: CompanyContext = JSON.parse(json);
      console.log(`✅ Quick company profile for "${companyName}":`, JSON.stringify(parsed));
      return parsed;
    } catch (err: any) {
      console.warn(`⚠️ buildQuickCompanyProfile failed for "${companyName}": ${err.message} — proceeding without enrichment`);
      return {};
    }
  }

  /**
   * PHASE 1: Company Deep Dive - COMPREHENSIVE External Research
   */
  private async performCompanyDeepDive(
    companyName: string,
    meetingContext?: string,
    accessToken?: string
  ) {
    console.log('🔍 PHASE 1: COMPREHENSIVE EXTERNAL RESEARCH');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    console.log('Running single web search for pre-call brief (overview + latest + context-relevant)...');

    const query = `Research ${companyName} for a pre-call brief.

Meeting context:
${meetingContext || '(none provided)'}

Explicit tasks:
- Fetch the latest news and press releases and recent updates.
- Also fetch: company overview, core products/services, and current leadership (CEO/CFO/CTO).
- Include recent earnings/quarterly results highlights (2024–2025) if available.
- also fetch news and updates that might be relevant to the meeting context

Return sources that directly support these points.`;

    const results = await this.openai
      .webSearch({ query, maxResults: 10 })
      .catch(() => ({ output_text: '' } as any));

    return {
      summary: results.output_text,
    };
  }

  /**
   * PHASE 2: Competitor Analysis (web search)
   */
  private async analyzeCompetitors(companyName: string) {
    console.log('🔍 PHASE 2: COMPETITOR ANALYSIS - OPTIMIZED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[1/3] Running 3 parallel competitor searches (optimized for speed)...');

    // OPTIMIZED: Reduced from 5 to 3 searches by combining related topics
    const [
      competitorOverviewResults,  // 10 sources: competitors + market position + rankings
      competitivePositioningResults, // 8 sources: differentiation + strengths/weaknesses
      customerSentimentResults,   // 7 sources: reviews + comparisons
    ] = await Promise.all([
      // Search 1: COMBINED Competitors + Market Position
      this.openai.webSearch({
        query: `${companyName} top competitors main rivals market share market position industry ranking alternative solutions`,
        maxResults: 10,
      }).catch(() => []),

      // Search 2: COMBINED Competitive advantages + differentiation
      this.openai.webSearch({
        query: `${companyName} competitive advantage differentiation vs competitors strengths weaknesses pricing comparison`,
        maxResults: 8,
      }).catch(() => []),

      // Search 3: Customer sentiment and reviews
      this.openai.webSearch({
        query: `${companyName} vs competitors customer reviews G2 Gartner comparison ratings`,
        maxResults: 7,
      }).catch(() => []),
    ]);

    const allResults = [
      ...competitorOverviewResults,
      ...competitivePositioningResults,
      ...customerSentimentResults,
    ];

    console.log(`   ✅ Competitor overview + market position: ${competitorOverviewResults.length} sources`);
    console.log(`   ✅ Competitive positioning + advantages: ${competitivePositioningResults.length} sources`);
    console.log(`   ✅ Customer sentiment + reviews: ${customerSentimentResults.length} sources`);
    console.log(`   📊 Total sources: ${allResults.length}`);
    console.log('');

    console.log('[2/5] Analyzing competitive positioning...');

    const sourceMaterial = allResults
      .map((result, idx) => `[${idx + 1}] ${result.title}\n${result.content}\n`)
      .join('\n---\n');

    const analysis = await this.openai.generateChatCompletion({
      messages: [
        {
          role: 'system',
          content: 'You are a competitive intelligence analyst with deep market research expertise.',
        },
        {
          role: 'user',
          content: `Analyze ${companyName}'s competitive landscape using comprehensive sources:

1. **Top Competitors** (array of objects with name, description, marketShare): List 3-5 main competitors with details
2. **Competitive Positioning**: Where ${companyName} stands in the market (include market share data if available)
3. **Market Differentiation**: How ${companyName} differentiates from competitors
4. **Pricing Positioning**: How pricing compares to competitors (premium, value, competitive)
5. **Strengths vs Competitors**: What ${companyName} does better
6. **Weaknesses vs Competitors**: Where competitors have advantages

Format as JSON with keys: topCompetitors (array with name, description, marketShare),
positioning, differentiation, pricingPositioning, strengths (array), weaknesses (array)

Sources (${allResults.length} total):
${sourceMaterial}`,
        },
      ],
      temperature: 0.3,
      maxTokens: 800, // Reduced from 1200 for speed
    });

    let parsed;
    try {
      const jsonMatch = analysis.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(analysis);
    } catch (e) {
      parsed = { topCompetitors: [], positioning: analysis, differentiation: '', strengths: [], weaknesses: [] };
    }

    return {
      ...parsed,
      citations: allResults.map((r, idx) => ({
        number: idx + 1,
        title: r.title,
        url: r.url,
        snippet: r.content.substring(0, 150) + '...',
      })),
    };
  }

  /**
   * PHASE 3: Northstar Integrators Fit Analysis - EXPANDED with evidence-based opportunity identification
   */
  private async analyzeIntegratorFit(companyName: string, companyInfo: any, competitorInfo: any) {
    console.log('🎯 PHASE 3: ENTERPRISE FIT ANALYSIS - OPTIMIZED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[1/7] Running 4 parallel opportunity searches (optimized for speed)...');

    // OPTIMIZED: Reduced from 6 to 4 searches by combining related topics
    const [
      atlassianToolingResults,    // 10 sources: Atlassian + project management
      serviceNowITSMResults,      // 10 sources: ServiceNow + ITSM challenges
      agileDevOpsResults,         // 8 sources: Agile + DevOps combined
      transformationSignalsResults, // 7 sources: General transformation indicators
    ] = await Promise.all([
      // Search 1: COMBINED Atlassian + Project Management
      this.openai.webSearch({
        query: `${companyName} Atlassian Jira Confluence project management portfolio management PMO tools collaboration`,
        maxResults: 10,
      }).catch(() => []),

      // Search 2: COMBINED ServiceNow + ITSM challenges
      this.openai.webSearch({
        query: `${companyName} ServiceNow ITSM ITOM IT service management incident management service desk support tickets challenges`,
        maxResults: 10,
      }).catch(() => []),

      // Search 3: COMBINED Agile + DevOps
      this.openai.webSearch({
        query: `${companyName} agile transformation scrum DevOps CI/CD continuous integration deployment automation`,
        maxResults: 8,
      }).catch(() => []),

      // Search 4: General transformation signals
      this.openai.webSearch({
        query: `${companyName} digital transformation cloud migration modernization initiatives strategic goals`,
        maxResults: 7,
      }).catch(() => []),
    ]);

    const allFitResults = [
      ...atlassianToolingResults,
      ...serviceNowITSMResults,
      ...agileDevOpsResults,
      ...transformationSignalsResults,
    ];

    console.log(`   ✅ Atlassian + Project Management: ${atlassianToolingResults.length} sources`);
    console.log(`   ✅ ServiceNow + ITSM: ${serviceNowITSMResults.length} sources`);
    console.log(`   ✅ Agile + DevOps: ${agileDevOpsResults.length} sources`);
    console.log(`   ✅ Transformation signals: ${transformationSignalsResults.length} sources`);
    console.log(`   📊 Total sources for fit analysis: ${allFitResults.length}`);
    console.log('');

    console.log('[2/7] Analyzing fit with full context and evidence...');

    // Build comprehensive context from ALL the research
    const companyContext = `
COMPANY PROFILE FOR ${companyName}:

**Summary:**
${companyInfo.summary}

**Industry:** ${companyInfo.industry}
**Size:** ${companyInfo.companySize}
**Headquarters:** ${companyInfo.headquarters}

**Business Model:**
${companyInfo.businessModel}

**Financial Performance:**
- Annual Revenue: ${companyInfo.financialPerformance?.annualRevenue || 'N/A'}
- Quarterly Data: ${companyInfo.financialPerformance?.quarterlyData || 'N/A'}
- Growth Rate: ${companyInfo.financialPerformance?.growthRate || 'N/A'}
- Profitability: ${companyInfo.financialPerformance?.profitability || 'N/A'}

**Growth Trajectory:**
${companyInfo.growthTrajectory || 'Not available'}

**Partner Ecosystem:**
${companyInfo.partnerEcosystem?.join(', ') || 'Not available'}

**Technology Stack:**
${companyInfo.technologyStack || 'Not available'}

**Recent Developments:**
${companyInfo.recentDevelopments?.join('\n') || 'Not available'}

**Leadership:**
${companyInfo.leadership || 'Not available'}

**Competitive Position:**
${competitorInfo.positioning}
`;

    // Build detailed evidence sources for AI analysis
    const evidenceSources = `
**ATLASSIAN + PROJECT MANAGEMENT (${atlassianToolingResults.length} sources):**
${atlassianToolingResults.map((r: any) => `- ${r.title}\n  ${r.content.substring(0, 200)}...\n  URL: ${r.url}`).join('\n\n')}

**SERVICENOW + ITSM (${serviceNowITSMResults.length} sources):**
${serviceNowITSMResults.map((r: any) => `- ${r.title}\n  ${r.content.substring(0, 200)}...\n  URL: ${r.url}`).join('\n\n')}

**AGILE + DEVOPS (${agileDevOpsResults.length} sources):**
${agileDevOpsResults.map((r: any) => `- ${r.title}\n  ${r.content.substring(0, 200)}...\n  URL: ${r.url}`).join('\n\n')}

**TRANSFORMATION SIGNALS (${transformationSignalsResults.length} sources):**
${transformationSignalsResults.map((r: any) => `- ${r.title}\n  ${r.content.substring(0, 200)}...\n  URL: ${r.url}`).join('\n\n')}
`;

    const analysis = await this.openai.generateChatCompletion({
      messages: [
        {
          role: 'system',
          content: `You are a senior sales consultant for Northstar Integrators with deep knowledge of our service offerings.

**ENTERPRISE'S ACTUAL SERVICES (be specific - reference these exact services):**

ATLASSIAN SERVICES:
- Jira Software implementation & optimization (for agile teams, DevOps, portfolio management)
- Jira Service Management (JSM) for IT service desk and ITSM
- Jira Align for enterprise portfolio management and OKRs
- Confluence for documentation, knowledge management, team collaboration
- Bitbucket for code repositories and CI/CD
- Atlassian Cloud migrations (Data Center to Cloud)
- Atlassian licensing optimization and assessments

SERVICENOW SERVICES:
- IT Service Management (ITSM) - incident, problem, change, service catalog
- IT Operations Management (ITOM) - discovery, event management, orchestration
- IT Asset Management (ITAM)
- Customer Service Management (CSM)
- HR Service Delivery (HRSD)
- Security Operations (SecOps)
- ServiceNow platform implementations and upgrades

CONSULTING & TRAINING:
- Agile transformation coaching (SAFe, Scrum, Kanban)
- DevOps consulting and CI/CD pipeline implementations
- PMO setup and project portfolio management
- Change management and adoption support
- Certified training (SAFe, Scrum Master, Product Owner, DevOps)
- Agile assessments and maturity evaluations

Your job: Identify SPECIFIC, ACTIONABLE opportunities that map to these EXACT services based on evidence from the company research.`,
        },
        {
          role: 'user',
          content: `Based on comprehensive research about ${companyName}, identify SPECIFIC Northstar Integrators opportunities with EVIDENCE.

CRITICAL: Be specific, not generic. Instead of "Jira for project management", say "Jira Align for portfolio management across 5000+ employees in 12 global offices to improve executive visibility into $2B in annual projects."

${companyContext}

**EVIDENCE FROM ${allFitResults.length} WEB SOURCES:**
${evidenceSources}

**Your Task:**
Using ALL the information above (company profile + ${allFitResults.length} evidence sources), identify HIGHLY SPECIFIC opportunities for Northstar Integrators services.

REQUIREMENTS FOR EACH OPPORTUNITY:
1. Reference EXACT Northstar Integrators service names (e.g., "Jira Align", "ServiceNow ITSM", "SAFe Agile Transformation")
2. Include SPECIFIC company details (size, revenue, # of employees, locations, growth rate)
3. Quantify the impact/scale (e.g., "$500M revenue at risk", "5000+ employees need visibility", "12 global offices")
4. Reference SPECIFIC evidence from sources (dates, quotes, metrics)
5. Make it actionable (what exactly would we implement/do)

Provide JSON with:
1. **fitScore** (1-10): Overall fit score based on company size, growth, tech needs
2. **rationale**: Why they're a good fit - include SPECIFIC numbers (revenue, size, growth %, employees, etc.)
3. **atlassianOpportunities** (array of objects): Each with:
   - 'opportunity': SPECIFIC Northstar Integrators Atlassian service (use exact service names from list above)
   - 'justification': DETAILED justification with company-specific numbers, scale, and impact
   - 'evidence': SPECIFIC quote, metric, or finding from sources with source number
   - 'estimatedImpact': Quantified expected outcome (e.g., "Improve visibility for $2B annual project portfolio", "Connect 5000+ employees across 12 offices")
4. **serviceNowOpportunities** (array of objects): Each with:
   - 'opportunity': SPECIFIC Northstar Integrators ServiceNow service (use exact service names)
   - 'justification': DETAILED with company-specific context and scale
   - 'evidence': SPECIFIC evidence from sources
   - 'estimatedImpact': Quantified outcome
5. **transformationSignals** (array): SPECIFIC indicators with dates/details (e.g., "Q3 2024 earnings call mentioned cloud migration initiative with $50M investment", "AWS partnership announced Nov 2024")

Example format (BE THIS SPECIFIC):
{
  "fitScore": 9,
  "rationale": "Excellent fit - Salesforce is a $35B revenue company with 73,000+ employees across 150+ offices, growing at 11% YoY. Currently undergoing massive cloud transformation with $1.2B investment [1], and research shows agile scaling challenges with distributed teams [2]. Perfect fit for Jira Align and ServiceNow ITSM implementations.",
  "atlassianOpportunities": [
    {
      "opportunity": "Jira Align for Enterprise Portfolio Management and OKR alignment",
      "justification": "Salesforce has 73,000+ employees across 150+ global offices managing an estimated $10B+ annual project portfolio. Research shows they struggle with executive visibility into agile team progress across distributed locations [source 15]. With 11% YoY growth, they need enterprise-scale portfolio management to align 500+ agile teams to strategic OKRs.",
      "evidence": "Q3 2024 investor call mentioned challenges with cross-team coordination as they scale internationally [source 15]. Glassdoor reviews mention lack of project visibility [source 23].",
      "estimatedImpact": "Provide real-time visibility into $10B+ project portfolio for C-suite, align 500+ teams to company OKRs, reduce project delays by 30%"
    },
    {
      "opportunity": "Atlassian Cloud Migration (Data Center to Cloud) for Jira & Confluence",
      "justification": "Salesforce currently uses on-premise Atlassian Data Center for 50,000+ users [source 8]. With their cloud-first strategy announced in Q2 2024 [source 12], they need to migrate to Atlassian Cloud for better scalability, reduced infrastructure costs, and improved collaboration.",
      "evidence": "CTO mentioned in tech blog: 'Moving all tooling to cloud by 2025' [source 8]. Current Data Center licenses expire Q1 2025 [source 19].",
      "estimatedImpact": "Migrate 50,000+ users to cloud, reduce infrastructure costs by $5M annually, improve uptime to 99.9%"
    }
  ],
  "serviceNowOpportunities": [
    {
      "opportunity": "ServiceNow IT Service Management (ITSM) platform implementation",
      "justification": "With 73,000 employees and rapid 11% growth, Salesforce IT teams handle 100,000+ support tickets monthly using outdated legacy systems [source 27]. Research shows average ticket resolution time is 48 hours vs. industry standard of 12 hours [source 31], costing an estimated $10M annually in lost productivity.",
      "evidence": "Job postings for 'IT Service Desk Transformation Lead' mention modernizing ticketing systems [source 27]. Employee surveys show IT support satisfaction at only 3.2/5 [source 31].",
      "estimatedImpact": "Reduce ticket resolution time from 48h to 12h, automate 40% of repetitive tickets, save $10M annually in productivity"
    }
  ],
  "transformationSignals": [
    "Q3 2024 earnings call announced $1.2B cloud transformation initiative with 2025 completion target [source 4]",
    "AWS Strategic Partnership announced Oct 2024 for infrastructure modernization [source 9]",
    "Posted 15 DevOps Engineer positions in Sept 2024, indicating CI/CD pipeline buildout [source 18]",
    "CTO blog post Nov 2024 mentioned moving to agile at scale using SAFe framework [source 22]"
  ]
}`,
        },
      ],
      temperature: 0.2, // Lower for more specific, factual responses
      maxTokens: 2000, // Reduced from 3000 for speed
    });

    let parsed;
    try {
      const jsonMatch = analysis.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(analysis);
    } catch (e) {
      parsed = {
        fitScore: 5,
        rationale: analysis,
        atlassianOpportunities: [],
        serviceNowOpportunities: [],
        transformationSignals: [],
      };
    }

    console.log('[3/7] Enhancing opportunities with Smart Opportunity Mapper...');

    // Load knowledge graphs if not already loaded
    await this.ensureKnowledgeGraphsLoaded();

    // Use smart mapper to enhance opportunities with evidence-based scoring
    console.log('   🤖 Running evidence-based opportunity analysis...');

    // Prepare structured data for smart mapper
    const structuredCompanyResearch = {
      companyName: companyName,
      companySize: companyInfo.companySize,
      industry: companyInfo.industry,
      headquarters: companyInfo.headquarters,
      summary: companyInfo.summary,
      technologyStack: companyInfo.technologyStack,
      businessModel: companyInfo.businessModel,
      growthTrajectory: companyInfo.growthTrajectory,
      partnerEcosystem: companyInfo.partnerEcosystem,
      recentDevelopments: companyInfo.recentDevelopments,
    };

    const structuredCompetitorInfo = {
      topCompetitors: competitorInfo.topCompetitors || [],
      positioning: competitorInfo.positioning,
      differentiation: competitorInfo.differentiation,
    };

    // For now, gap analysis is empty since it comes after Phase 3
    // Smart mapper will work with company and competitor context
    const emptyGapAnalysis = {
      criticalGaps: [],
      missingCapabilities: [],
      opportunities: [],
    };

    try {
      const scoredOpportunities = await this.smartMapper.mapOpportunities(
        structuredCompanyResearch,
        structuredCompetitorInfo,
        emptyGapAnalysis
      );

      console.log(`   ✅ Smart mapper identified ${scoredOpportunities.length} scored opportunities`);
      console.log(`   📊 Top opportunity: ${scoredOpportunities[0]?.product} (score: ${scoredOpportunities[0]?.score})`);

      // Merge smart mapper results with OpenAI results
      // Keep OpenAI's fitScore and rationale, but enhance opportunities with scored ones
      const enhancedAtlassianOpps = scoredOpportunities
        .filter(opp => opp.category === 'atlassian')
        .map(opp => ({
          opportunity: opp.opportunity,
          product: opp.product,
          justification: opp.evidenceChain.map(e => e.evidence).join('; '),
          evidence: opp.evidenceChain.length > 0 ? opp.evidenceChain[0].evidence : '',
          score: opp.score,
          confidence: opp.confidence,
          enterpriseService: opp.enterpriseService,
          expectedOutcome: opp.expectedOutcome,
          discoveryQuestions: opp.discoveryQuestions,
          implementationPhase: opp.implementationPhase,
          estimatedTimeline: opp.estimatedTimeline,
        }));

      const enhancedServiceNowOpps = scoredOpportunities
        .filter(opp => opp.category === 'servicenow')
        .map(opp => ({
          opportunity: opp.opportunity,
          product: opp.product,
          justification: opp.evidenceChain.map(e => e.evidence).join('; '),
          evidence: opp.evidenceChain.length > 0 ? opp.evidenceChain[0].evidence : '',
          score: opp.score,
          confidence: opp.confidence,
          enterpriseService: opp.enterpriseService,
          expectedOutcome: opp.expectedOutcome,
          discoveryQuestions: opp.discoveryQuestions,
          implementationPhase: opp.implementationPhase,
          estimatedTimeline: opp.estimatedTimeline,
        }));

      const enhancedConsultingOpps = scoredOpportunities
        .filter(opp => opp.category === 'consulting')
        .map(opp => ({
          opportunity: opp.opportunity,
          product: opp.product,
          justification: opp.evidenceChain.map(e => e.evidence).join('; '),
          evidence: opp.evidenceChain.length > 0 ? opp.evidenceChain[0].evidence : '',
          score: opp.score,
          confidence: opp.confidence,
          enterpriseService: opp.enterpriseService,
          expectedOutcome: opp.expectedOutcome,
          discoveryQuestions: opp.discoveryQuestions,
          implementationPhase: opp.implementationPhase,
          estimatedTimeline: opp.estimatedTimeline,
        }));

      console.log('   ✅ Opportunities enhanced with evidence-based scoring');

      return {
        fitScore: parsed.fitScore,
        rationale: parsed.rationale,
        atlassianOpportunities: enhancedAtlassianOpps.length > 0 ? enhancedAtlassianOpps : parsed.atlassianOpportunities,
        serviceNowOpportunities: enhancedServiceNowOpps.length > 0 ? enhancedServiceNowOpps : parsed.serviceNowOpportunities,
        consultingOpportunities: enhancedConsultingOpps,
        transformationSignals: parsed.transformationSignals || [],
        citations: allFitResults.map((r: any, idx: number) => ({
          number: idx + 1,
          title: r.title,
          url: r.url,
          snippet: r.content.substring(0, 200) + '...',
        })),
      };
    } catch (mapperError) {
      console.warn('⚠️ Smart mapper failed, falling back to OpenAI opportunities:', mapperError);

      return {
        ...parsed,
        citations: allFitResults.map((r: any, idx: number) => ({
          number: idx + 1,
          title: r.title,
          url: r.url,
          snippet: r.content.substring(0, 200) + '...',
        })),
      };
    }
  }

  /**
   * PHASE 4: Gap Analysis (web search)
   */
  private async performGapAnalysis(companyName: string, companyInfo: any, enterpriseFit: any) {
    console.log('🔎 PHASE 4: GAP ANALYSIS - EXPANDED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[1/4] Running 3 parallel gap analysis searches...');

    // Run web searches to find evidence of gaps and pain points
    const [
      painPointsResults,       // 6 sources: complaints, challenges, pain points
      missingToolsResults,     // 5 sources: what tools/capabilities they lack
      industryBestPractices,   // 5 sources: best practices in their industry
    ] = await Promise.all([
      // Search 1: Pain points and challenges
      this.openai.webSearch({
        query: `${companyName} challenges pain points problems issues complaints`,
        maxResults: 6,
      }).catch(() => []),

      // Search 2: Missing tools and capabilities
      this.openai.webSearch({
        query: `${companyName} needs looking for implementing adopting tools solutions`,
        maxResults: 5,
      }).catch(() => []),

      // Search 3: Industry best practices (to compare against)
      this.openai.webSearch({
        query: `${companyInfo.industry} industry best practices standards tools ${new Date().getFullYear()}`,
        maxResults: 5,
      }).catch(() => []),
    ]);

    const allGapResults = [
      ...painPointsResults,
      ...missingToolsResults,
      ...industryBestPractices,
    ];

    console.log(`   ✅ Pain points research: ${painPointsResults.length} sources`);
    console.log(`   ✅ Missing tools research: ${missingToolsResults.length} sources`);
    console.log(`   ✅ Industry best practices: ${industryBestPractices.length} sources`);
    console.log(`   📊 Total sources for gap analysis: ${allGapResults.length}`);
    console.log('');

    console.log('[2/4] Analyzing gaps with evidence...');

    const gapEvidence = `
**PAIN POINTS & CHALLENGES (${painPointsResults.length} sources):**
${painPointsResults.map((r: any) => `- ${r.title}\n  ${r.content.substring(0, 250)}...\n  URL: ${r.url}`).join('\n\n')}

**MISSING TOOLS & CAPABILITIES (${missingToolsResults.length} sources):**
${missingToolsResults.map((r: any) => `- ${r.title}\n  ${r.content.substring(0, 250)}...\n  URL: ${r.url}`).join('\n\n')}

**INDUSTRY BEST PRACTICES (${industryBestPractices.length} sources):**
${industryBestPractices.map((r: any) => `- ${r.title}\n  ${r.content.substring(0, 250)}...\n  URL: ${r.url}`).join('\n\n')}
`;

    const analysis = await this.openai.generateChatCompletion({
      messages: [
        {
          role: 'system',
          content: 'You are a business consultant identifying gaps and opportunities based on external evidence.',
        },
        {
          role: 'user',
          content: `Based on ${companyName}'s profile and external research, identify gaps with EVIDENCE:

Company Profile:
${JSON.stringify(companyInfo, null, 2)}

Northstar Integrators Fit Analysis:
${JSON.stringify(enterpriseFit, null, 2)}

**EVIDENCE FROM ${allGapResults.length} WEB SOURCES:**
${gapEvidence}

Provide JSON with:
1. **criticalGaps** (array of strings): Critical missing capabilities or pain points - cite evidence from research
2. **missingCapabilities** (array of strings): Specific tools/processes they likely lack - based on evidence
3. **opportunities** (array of strings): Opportunities to improve - from comparing against industry best practices
4. **recommendedActions** (array of objects): Each with:
   - 'action': Immediate next step
   - 'rationale': WHY this action (cite evidence)
   - 'priority': 'high', 'medium', or 'low'

Example:
{
  "criticalGaps": [
    "Lack of centralized project management - mentioned in 3 job postings for PMO roles",
    "Manual IT service desk processes - customer reviews mention slow ticket response times"
  ],
  "missingCapabilities": [
    "Enterprise agile tooling",
    "Automated CI/CD pipelines"
  ],
  "opportunities": [
    "Implement industry-standard ITSM platform (competitors using ServiceNow per market research)"
  ],
  "recommendedActions": [
    {
      "action": "Evaluate Jira for enterprise project management",
      "rationale": "Research shows distributed teams across multiple offices need better visibility",
      "priority": "high"
    }
  ]
}`,
        },
      ],
      temperature: 0.3,
      maxTokens: 700,
    });

    let parsed;
    try {
      const jsonMatch = analysis.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(analysis);
    } catch (e) {
      parsed = {
        criticalGaps: [],
        missingCapabilities: [],
        opportunities: [],
        recommendedActions: [],
      };
    }

    return {
      ...parsed,
      citations: allGapResults.map((r: any, idx: number) => ({
        number: idx + 1,
        title: r.title,
        url: r.url,
        snippet: r.content.substring(0, 200) + '...',
      })),
    };
  }

  /**
   * Score case studies by relevance
   */
  private async scoreCaseStudies(caseStudies: any[], context: string) {
    const scored = caseStudies.map(cs => {
      // Simple keyword matching for now
      const contextLower = context.toLowerCase();
      const csText = `${cs.title} ${cs.description} ${cs.industry} ${(cs.tags || []).join(' ')}`.toLowerCase();

      let score = 0;

      // Industry match
      if (cs.industry && contextLower.includes(cs.industry.toLowerCase())) {
        score += 3;
      }

      // Tag matches
      (cs.tags || []).forEach((tag: string) => {
        if (contextLower.includes(tag.toLowerCase())) {
          score += 2;
        }
      });

      // Content overlap
      const words = contextLower.split(/\s+/);
      words.forEach(word => {
        if (word.length > 4 && csText.includes(word)) {
          score += 0.5;
        }
      });

      return {
        ...cs,
        relevanceScore: Math.min(10, score),
        relevanceReason: this.generateRelevanceReason(cs, context),
      };
    });

    return scored
      .filter(cs => cs.relevanceScore > 2)
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Generate relevance explanation
   */
  private generateRelevanceReason(caseStudy: any, context: string): string {
    const reasons = [];

    if (caseStudy.industry && context.toLowerCase().includes(caseStudy.industry.toLowerCase())) {
      reasons.push(`Same industry (${caseStudy.industry})`);
    }

    (caseStudy.tags || []).forEach((tag: string) => {
      if (context.toLowerCase().includes(tag.toLowerCase())) {
        reasons.push(`Relevant to ${tag}`);
      }
    });

    return reasons.length > 0 ? reasons.join(', ') : 'General relevance to transformation needs';
  }

  /**
   * PHASE 6: Internal Service Mapping (MASSIVELY EXPANDED with evidence-based recommendations)
   */
  private async mapToInternalServices(companyInfo: any, enterpriseFit: any, gapAnalysis: any) {
    console.log('🎯 PHASE 6: SERVICE MAPPING - MASSIVELY EXPANDED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[1/7] Running 7 parallel service mapping searches for evidence...');

    // 7 parallel web searches to find evidence for service recommendations
    const [
      agileTrainingNeedsResults,     // 6 sources: What agile training similar companies needed
      atlassianImplementationResults, // 8 sources: Atlassian implementation case studies in their industry
      serviceNowImplementationResults,// 8 sources: ServiceNow implementation case studies
      industryTransformationResults,  // 6 sources: How companies in their industry transformed
      consultingNeedsResults,         // 5 sources: What consulting services similar companies used
      trainingProgramResults,         // 5 sources: Training programs for their industry
      implementationTimelineResults,  // 5 sources: Typical implementation timelines for their size
    ] = await Promise.all([
      // Search 1: Agile training needs for similar companies
      this.openai.webSearch({
        query: `${companyInfo.industry} agile training scrum master certification team training needs`,
        maxResults: 6,
      }).catch(() => []),

      // Search 2: Atlassian implementation evidence
      this.openai.webSearch({
        query: `${companyInfo.industry} Atlassian implementation Jira Confluence deployment case study ROI`,
        maxResults: 8,
      }).catch(() => []),

      // Search 3: ServiceNow implementation evidence
      this.openai.webSearch({
        query: `${companyInfo.industry} ServiceNow ITSM implementation deployment case study ROI`,
        maxResults: 8,
      }).catch(() => []),

      // Search 4: Industry transformation patterns
      this.openai.webSearch({
        query: `${companyInfo.industry} digital transformation success stories DevOps agile adoption`,
        maxResults: 6,
      }).catch(() => []),

      // Search 5: Consulting needs
      this.openai.webSearch({
        query: `${companyInfo.industry} consulting services agile transformation needs advisory`,
        maxResults: 5,
      }).catch(() => []),

      // Search 6: Training programs
      this.openai.webSearch({
        query: `${companyInfo.industry} enterprise training programs skill development upskilling`,
        maxResults: 5,
      }).catch(() => []),

      // Search 7: Implementation timelines
      this.openai.webSearch({
        query: `${companyInfo.companySize} company implementation timeline agile transformation project duration`,
        maxResults: 5,
      }).catch(() => []),
    ]);

    const allServiceResults = [
      ...agileTrainingNeedsResults,
      ...atlassianImplementationResults,
      ...serviceNowImplementationResults,
      ...industryTransformationResults,
      ...consultingNeedsResults,
      ...trainingProgramResults,
      ...implementationTimelineResults,
    ];

    console.log(`   ✅ Agile training evidence: ${agileTrainingNeedsResults.length} sources`);
    console.log(`   ✅ Atlassian implementations: ${atlassianImplementationResults.length} sources`);
    console.log(`   ✅ ServiceNow implementations: ${serviceNowImplementationResults.length} sources`);
    console.log(`   ✅ Industry transformations: ${industryTransformationResults.length} sources`);
    console.log(`   ✅ Consulting needs: ${consultingNeedsResults.length} sources`);
    console.log(`   ✅ Training programs: ${trainingProgramResults.length} sources`);
    console.log(`   ✅ Implementation timelines: ${implementationTimelineResults.length} sources`);
    console.log(`   📊 Total sources for service mapping: ${allServiceResults.length}`);
    console.log('');

    console.log('[2/7] Building evidence-based service recommendations...');

    // Build comprehensive evidence for AI analysis
    const serviceEvidence = `
**AGILE TRAINING EVIDENCE (${agileTrainingNeedsResults.length} sources):**
${agileTrainingNeedsResults.map((r: any) => `- ${r.title}\n  ${r.content.substring(0, 250)}...\n  URL: ${r.url}`).join('\n\n')}

**ATLASSIAN IMPLEMENTATION EVIDENCE (${atlassianImplementationResults.length} sources):**
${atlassianImplementationResults.map((r: any) => `- ${r.title}\n  ${r.content.substring(0, 250)}...\n  URL: ${r.url}`).join('\n\n')}

**SERVICENOW IMPLEMENTATION EVIDENCE (${serviceNowImplementationResults.length} sources):**
${serviceNowImplementationResults.map((r: any) => `- ${r.title}\n  ${r.content.substring(0, 250)}...\n  URL: ${r.url}`).join('\n\n')}

**INDUSTRY TRANSFORMATION PATTERNS (${industryTransformationResults.length} sources):**
${industryTransformationResults.map((r: any) => `- ${r.title}\n  ${r.content.substring(0, 250)}...\n  URL: ${r.url}`).join('\n\n')}

**CONSULTING NEEDS (${consultingNeedsResults.length} sources):**
${consultingNeedsResults.map((r: any) => `- ${r.title}\n  ${r.content.substring(0, 250)}...\n  URL: ${r.url}`).join('\n\n')}

**TRAINING PROGRAMS (${trainingProgramResults.length} sources):**
${trainingProgramResults.map((r: any) => `- ${r.title}\n  ${r.content.substring(0, 250)}...\n  URL: ${r.url}`).join('\n\n')}

**IMPLEMENTATION TIMELINES (${implementationTimelineResults.length} sources):**
${implementationTimelineResults.map((r: any) => `- ${r.title}\n  ${r.content.substring(0, 250)}...\n  URL: ${r.url}`).join('\n\n')}
`;

    console.log('[3/7] Creating evidence-based service mapping with AI...');

    const analysis = await this.openai.generateChatCompletion({
      messages: [
        {
          role: 'system',
          content: `You are a Northstar Integrators solutions architect creating SPECIFIC, ACTIONABLE service recommendations and implementation roadmaps. You have deep knowledge of what Northstar Integrators actually delivers.

**CRITICAL: Be extremely specific and actionable:**
- Reference exact Northstar Integrators services (e.g., "3-month SAFe transformation with certified coaching", "Jira Align implementation for 5000+ users")
- Include company-specific numbers (size, revenue, team count, locations)
- Quantify outcomes (e.g., "Reduce deployment time from 2 weeks to 2 days", "$5M cost savings annually")
- Make roadmap phases concrete with specific deliverables and timelines
- Base everything on evidence from similar company implementations`,
        },
        {
          role: 'user',
          content: `Map ${companyInfo.companyName}'s needs to SPECIFIC Northstar Integrators services with EVIDENCE from ${allServiceResults.length} sources.

Client Profile:
- Company: ${companyInfo.companyName || 'Company'}
- Industry: ${companyInfo.industry || 'N/A'}
- Size: ${companyInfo.companySize || 'N/A'}
- Revenue: ${companyInfo.financialPerformance?.annualRevenue || 'N/A'}
- Growth: ${companyInfo.financialPerformance?.growthRate || 'N/A'}

Client Needs:
${JSON.stringify({ gaps: gapAnalysis, opportunities: enterpriseFit }, null, 2)}

**EVIDENCE FROM ${allServiceResults.length} WEB SOURCES:**
${serviceEvidence}

**Your Task:**
Using the evidence above, create HIGHLY SPECIFIC service recommendations and implementation roadmap.

Provide JSON with EXTREMELY SPECIFIC details:

1. **enterpriseServices** (array of objects): Each with:
   - 'service': SPECIFIC service with duration (e.g., "6-month SAFe 6.0 transformation with 2 certified coaches", "3-month Jira Align implementation for 5000+ users")
   - 'relevance': DETAILED relevance with company-specific numbers (e.g., "With 73,000 employees across 150 offices and $35B revenue, need enterprise-scale agile coaching")
   - 'evidence': SPECIFIC quote from similar company implementations
   - 'expectedOutcome': QUANTIFIED outcome (e.g., "30% faster time-to-market, $15M annual savings, 500+ teams aligned")
   - 'timeline': Specific duration (e.g., "6 months: Months 1-2 assessment, 3-4 pilot, 5-6 rollout")

2. **atlassianServices** (array of objects): Each with:
   - 'product': SPECIFIC product + implementation scope (e.g., "Jira Align for 5000 users across 500 teams")
   - 'useCase': DETAILED use case with company-specific context
   - 'relevance': WHY with specific company numbers
   - 'evidence': SPECIFIC evidence from research
   - 'estimatedUsers': Specific user count based on company size
   - 'estimatedCost': Approximate cost if mentioned in research (e.g., "$500K-$1M implementation")
   - 'timeline': Implementation timeline (e.g., "4 months: 1 month config, 2 months pilot, 1 month rollout")

3. **serviceNowServices** (array of objects): Each with:
   - 'module': SPECIFIC module + scope (e.g., "ServiceNow ITSM for 73,000 employees handling 100K+ monthly tickets")
   - 'useCase': DETAILED use case
   - 'relevance': WHY with company numbers
   - 'evidence': SPECIFIC evidence
   - 'estimatedImpact': QUANTIFIED impact (e.g., "Reduce ticket resolution from 48h to 12h, save $10M annually")
   - 'timeline': Implementation timeline

4. **salesTeamServices** (array of objects): Each with:
   - 'service': SPECIFIC sales deliverable
   - 'rationale': WHY with context

5. **implementationRoadmap** (array of objects): ACTIONABLE phases with:
   - 'phase': Specific phase name with scope (e.g., "Phase 1: Discovery & Current State (Weeks 1-4)")
   - 'duration': SPECIFIC timeline (e.g., "4 weeks", not "2-4 weeks")
   - 'activities': SPECIFIC activities with deliverable dates (e.g., ["Week 1: Stakeholder interviews (15 executives)", "Week 2: Tool audit (Jira, Confluence, ServiceNow)", "Week 3: Gap analysis workshop"])
   - 'deliverables': CONCRETE deliverables (e.g., ["Executive readiness report with 10 recommendations", "Current state architecture diagram", "ROI model projecting $5M savings"])
   - 'evidence': Reference to timelines from similar implementations
   - 'teamRequired': Who's needed (e.g., "2 Northstar Integrators consultants, 1 technical architect, client PMO lead")
   - 'successMetrics': How to measure success (e.g., "80% stakeholder alignment, documented gaps for 500+ teams")

Example (BE THIS SPECIFIC):
{
  "enterpriseServices": [
    {
      "service": "6-month SAFe 6.0 Enterprise Transformation with 2 certified SPCs for 500 teams",
      "relevance": "Salesforce has 73,000 employees organized into 500+ agile teams across 150 global offices. With $35B revenue and 11% growth, they need enterprise-scale agile alignment to coordinate teams and improve time-to-market for their cloud products.",
      "evidence": "Research shows enterprise transformations for 50,000+ employee companies typically require 6-9 months with dedicated coaching [source 12]. Similar SaaS company reduced release cycles by 40% with SAFe [source 18].",
      "expectedOutcome": "Align 500 teams to strategic objectives, reduce time-to-market by 30%, improve predictability to 85%, enable quarterly planning for $10B project portfolio",
      "timeline": "6 months: Month 1-2 leadership training and pilot ARTs, Month 3-4 scale to 100 teams, Month 5-6 full rollout to 500 teams"
    }
  ],
  "implementationRoadmap": [
    {
      "phase": "Phase 1: Executive Alignment & Discovery (Weeks 1-4)",
      "duration": "4 weeks",
      "activities": [
        "Week 1: Executive workshops with C-suite and 15 SVPs to align on transformation goals",
        "Week 2: Current state assessment - audit existing Jira instances (20+), interview 50 team leads",
        "Week 3: Gap analysis - identify portfolio visibility gaps, measure current velocity across 500 teams",
        "Week 4: Business case development - ROI model projecting $15M annual value from improved delivery speed"
      ],
      "deliverables": [
        "Executive alignment deck with transformation roadmap and success metrics",
        "Current state report: tooling landscape, team maturity scores (1-5), identified gaps",
        "Business case: $15M projected annual value, 18-month payback period",
        "Implementation plan: phased rollout across 500 teams with risk mitigation"
      ],
      "evidence": "Similar $30B SaaS companies completed discovery in 3-4 weeks [source 23]",
      "teamRequired": "2 Northstar Integrators Senior Consultants (SAFe SPCs), 1 Atlassian Solutions Architect, Salesforce PMO Director + 3 leads",
      "successMetrics": "90% executive alignment score, documented current state for all 500 teams, approved business case with $15M value projection"
    },
    {
      "phase": "Phase 2: Pilot Implementation (Weeks 5-12)",
      "duration": "8 weeks",
      "activities": [
        "Week 5-6: Jira Align configuration for 3 pilot ARTs (Agile Release Trains) with 50 teams",
        "Week 6-7: Train 50 Scrum Masters, 15 RTEs (Release Train Engineers), 3 Solution Train Engineers",
        "Week 8-10: Run first PI Planning event for pilot ARTs, establish cadence (2-week sprints)",
        "Week 11-12: Measure pilot results - velocity, predictability, stakeholder satisfaction"
      ],
      "deliverables": [
        "Configured Jira Align instance for 3 ARTs with portfolio boards, OKR tracking, dependency mapping",
        "Trained and certified 50 Scrum Masters, 15 RTEs on SAFe 6.0 practices",
        "Completed first PI Planning with 50 teams, committed objectives for 10-week increment",
        "Pilot results report: 25% velocity improvement, 75% predictability, NPS score 8/10"
      ],
      "evidence": "Enterprise pilots typically involve 3-5 ARTs over 8-10 weeks [source 31]",
      "teamRequired": "3 Northstar Integrators SAFe coaches, 1 Jira Align specialist, pilot teams (50 people)",
      "successMetrics": "75%+ predictability in pilot, 8+ NPS from participants, working Jira Align for 50 teams"
    }
  ]
}`,
        },
      ],
      temperature: 0.2, // Lower for more specific, actionable outputs
      maxTokens: 2500, // Reduced from 4096 for speed while maintaining detail
    });

    let parsed;
    try {
      const jsonMatch = analysis.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(analysis);
    } catch (e) {
      parsed = {
        enterpriseServices: [],
        atlassianServices: [],
        serviceNowServices: [],
        salesTeamServices: [],
        implementationRoadmap: [],
      };
    }

    return {
      ...parsed,
      citations: allServiceResults.map((r: any, idx: number) => ({
        number: idx + 1,
        title: r.title,
        url: r.url,
        snippet: r.content.substring(0, 200) + '...',
      })),
    };
  }

  /**
   * Update progress
   */
  private async updateProgress(
    sessionId: string,
    step: string,
    percentage: number,
    onProgress?: (progress: ResearchProgress) => void
  ) {
    this.throwIfCancelled(sessionId);

    try {
      await this.prisma.analysis.update({
        where: { sessionId },
        data: {
          currentStep: step,
          progress: JSON.stringify({ step, percentage }),
        },
      });
    } catch (error) {
      if (this.isCancelled(sessionId) || this.isPrismaNotFoundError(error)) {
        throw new ResearchService.CancellationError();
      }
      throw error;
    }

    onProgress?.({ currentStep: step, percentage });
  }

  /**
   * Get analysis status
   */
  async getAnalysisStatus(sessionId: string): Promise<any> {
    const analysis = await this.prisma.analysis.findUnique({
      where: { sessionId },
    });

    if (!analysis) {
      throw new Error('Analysis not found');
    }

    // Safely parse JSON fields
    let progress = null;
    let result = null;

    try {
      progress = analysis.progress ? JSON.parse(analysis.progress) : null;
    } catch (error) {
      console.error('Failed to parse progress JSON:', error);
      progress = null;
    }

    try {
      result = analysis.result ? JSON.parse(analysis.result) : null;
    } catch (error) {
      console.error('Failed to parse result JSON:', error);
      result = null;
    }

    return {
      sessionId: analysis.sessionId,
      status: analysis.status,
      currentStep: analysis.currentStep,
      progress,
      result,
      error: analysis.error,
      startedAt: analysis.startedAt,
      completedAt: analysis.completedAt,
      internalKbProgress: this.internalKb.getProgress(), // Real-time InternalKnowledge progress
    };
  }

  /**
   * Get current InternalKnowledge progress (for real-time UI updates)
   */
  getInternalKnowledgeProgress(): InternalKnowledgeProgress {
    return this.internalKb.getProgress();
  }

  /**
   * List all analyses
   */
  async listAnalyses(filters?: {
    companyName?: string;
    dealId?: string;
    status?: string;
  }): Promise<any[]> {
    const analyses = await this.prisma.analysis.findMany({
      where: filters,
      orderBy: { startedAt: 'desc' },
      take: 50,
    });

    return analyses.map((analysis: any) => ({
      session_id: analysis.sessionId,
      company_name: analysis.companyName,
      meeting_title: analysis.meetingTitle || '',
      meeting_date: analysis.meetingDate || '',
      purpose_of_meeting: analysis.purposeOfMeeting || '',
      completed_at: analysis.completedAt ? analysis.completedAt.toISOString() : '',
      attendees: analysis.attendees ? JSON.parse(analysis.attendees) : [],
      dealId: analysis.dealId,
      status: analysis.status,
    }));
  }

  /**
   * Delete an analysis by session ID
   */
  async deleteAnalysis(sessionId: string): Promise<void> {
    await this.prisma.$transaction(async (tx: any) => {
      const analysis = await tx.analysis.findUnique({
        where: { sessionId },
      });

      if (!analysis) {
        throw new Error('Analysis not found');
      }

      await tx.analysis.delete({
        where: { sessionId },
      });

      if (analysis.meetingId) {
        await tx.meeting.updateMany({
          where: { meetingId: analysis.meetingId },
          data: { analysisId: null },
        });
      }
    });
  }

  /**
   * Cancel an ongoing research session
   * Marks the session for cancellation and updates DB status
   */
  async cancelResearch(sessionId: string): Promise<boolean> {
    const analysis = await this.prisma.analysis.findUnique({ where: { sessionId } });
    if (!analysis) return false;

    const cancellableStatuses = new Set(['running', 'pending', 'in_progress']);
    if (!cancellableStatuses.has(analysis.status)) {
      return false;
    }

    // Mark session as cancelled (best-effort; OpenAI calls themselves can't be aborted)
    this.cancelledSessions.add(sessionId);

    await this.prisma.$transaction(async (tx: any) => {
      const latest = await tx.analysis.findUnique({ where: { sessionId } });
      if (!latest) return;

      // Clean up any attendee research created/updated during this run (do not delete older cached research)
      if (latest.meetingId) {
        await tx.meetingAttendeeResearch.deleteMany({
          where: {
            meetingId: latest.meetingId,
            attendeeType: 'external',
            updatedAt: { gte: latest.startedAt },
          },
        });
      }

      // Remove the in-progress analysis row so the user can start again immediately.
      // (The pipeline will stop once it hits the next cancellation check / DB update.)
      await tx.analysis.delete({ where: { sessionId } });

      if (latest.meetingId) {
        await tx.meeting.updateMany({
          where: { meetingId: latest.meetingId },
          data: { analysisId: null },
        });
      }
    });

    console.log(`🛑 Research session ${sessionId} cancelled by user (analysis cleared)`);
    return true;
  }

  /**
   * Check if a session has been cancelled
   */
  isCancelled(sessionId: string): boolean {
    return this.cancelledSessions.has(sessionId);
  }

  /**
   * Link an analysis to a deal
   */
  async linkToDeal(sessionId: string, dealId: string): Promise<void> {
    const analysis = await this.prisma.analysis.findUnique({
      where: { sessionId },
    });

    if (!analysis) {
      throw new Error('Analysis not found');
    }

    // Check if deal exists
    const deal = await this.prisma.deal.findUnique({
      where: { dealId },
    });

    if (!deal) {
      throw new Error('Deal not found');
    }

    // Update analysis with new dealId
    await this.prisma.analysis.update({
      where: { sessionId },
      data: { dealId },
    });
  }

  // ===== BACKWARD COMPATIBILITY HELPER METHODS =====

  /**
   * Generate executive summary for backward compatibility - NO MARKDOWN HEADERS
   */
  private generateExecutiveSummary(companyInfo: any, competitorInfo: any, fitInfo: any): string {
    let summary = '';

    // Company Overview (flowing text, no header)
    if (companyInfo.summary) {
      summary += `${companyInfo.summary}\n\n`;
    }

    // Financial Performance (flowing text with all quarterly details)
    if (companyInfo.financialPerformance) {
      const fp = companyInfo.financialPerformance;
      let financialSection = '';

      if (fp.annualRevenue && fp.annualRevenue !== 'Not available') {
        financialSection += `${fp.annualRevenue} `;
      }

      if (fp.stockPerformance && fp.stockPerformance !== 'Not available') {
        financialSection += `${fp.stockPerformance} `;
      }

      // Quarterly breakdown
      const quarterlyParts = [];
      if (fp.q1_2024 && fp.q1_2024 !== 'Not available') {
        quarterlyParts.push(fp.q1_2024);
      }
      if (fp.q2_2024 && fp.q2_2024 !== 'Not available') {
        quarterlyParts.push(fp.q2_2024);
      }
      if (fp.q3_2024 && fp.q3_2024 !== 'Not available') {
        quarterlyParts.push(fp.q3_2024);
      }
      if (fp.q4_2024 && fp.q4_2024 !== 'Not available') {
        quarterlyParts.push(fp.q4_2024);
      }
      if (quarterlyParts.length > 0) {
        financialSection += quarterlyParts.join(' ');
      }

      if (fp.growthRate && fp.growthRate !== 'Not available') {
        financialSection += ` ${fp.growthRate}`;
      }

      if (fp.profitability && fp.profitability !== 'Not available') {
        financialSection += ` ${fp.profitability}`;
      }

      if (financialSection.trim()) {
        summary += `${financialSection.trim()}\n\n`;
      }
    }

    // Growth Trajectory (flowing text)
    if (companyInfo.growthTrajectory && typeof companyInfo.growthTrajectory === 'string' && companyInfo.growthTrajectory !== 'Not available') {
      summary += `${companyInfo.growthTrajectory}\n\n`;
    }

    // Partner Ecosystem (flowing text)
    if (companyInfo.partnerEcosystem && companyInfo.partnerEcosystem.length > 0) {
      const partners = companyInfo.partnerEcosystem.join(', ');
      summary += `Key partners include ${partners}.\n\n`;
    }

    // Recent Developments (flowing list)
    if (companyInfo.recentDevelopments && companyInfo.recentDevelopments.length > 0) {
      const developments = companyInfo.recentDevelopments.slice(0, 5).join('. ');
      summary += `Recent developments: ${developments}.\n\n`;
    }

    // Leadership (flowing text)
    if (companyInfo.leadership && typeof companyInfo.leadership === 'string' && companyInfo.leadership !== 'Not available') {
      summary += `${companyInfo.leadership}\n\n`;
    }

    // Technology Stack (flowing text)
    if (companyInfo.technologyStack && typeof companyInfo.technologyStack === 'string' && companyInfo.technologyStack !== 'Not available') {
      summary += `${companyInfo.technologyStack}\n\n`;
    }

    // Market Position (flowing text)
    if (competitorInfo.positioning) {
      summary += `${competitorInfo.positioning}\n\n`;
    }

    // Northstar Integrators Fit (flowing text)
    if (fitInfo.rationale) {
      summary += `${fitInfo.rationale} Fit Score: ${fitInfo.fitScore || 'N/A'}/10`;
    }

    return summary;
  }

  /**
   * Extract key insights for backward compatibility
   */
  private extractKeyInsights(companyInfo: any, fitInfo: any, gapInfo: any): string[] {
    const insights = [];

    if (companyInfo.uniqueDifferentiators && companyInfo.uniqueDifferentiators.length > 0) {
      insights.push(...companyInfo.uniqueDifferentiators.slice(0, 3));
    }

    if (fitInfo.transformationSignals && fitInfo.transformationSignals.length > 0) {
      insights.push(...fitInfo.transformationSignals.slice(0, 2));
    }

    if (gapInfo.opportunities && gapInfo.opportunities.length > 0) {
      insights.push(...gapInfo.opportunities.slice(0, 2));
    }

    return insights.slice(0, 5);
  }

  /**
   * Format sales opportunities for backward compatibility
   * Enhanced with InternalKnowledge AI insights for more relevant recommendations
   */
  private formatSalesOpportunities(fitInfo: any, serviceMapping: any, internalKbInsights?: string): string {
    let output = '';

    // Atlassian Opportunities - with proper markdown formatting
    if (fitInfo.atlassianOpportunities && fitInfo.atlassianOpportunities.length > 0) {
      output += '## Atlassian Opportunities\n\n';
      (fitInfo.atlassianOpportunities || []).forEach((opp: any, idx: number) => {
        if (typeof opp === 'string') {
          output += `**${idx + 1}. ${opp}**\n\n`;
        } else {
          output += `**${idx + 1}. ${opp.opportunity}**\n`;
          if (opp.justification) {
            output += `> ${opp.justification}\n\n`;
          }
          if (opp.evidence) {
            output += `*Evidence:* ${opp.evidence}\n\n`;
          }
        }
      });
    }

    // ServiceNow Opportunities
    if (fitInfo.serviceNowOpportunities && fitInfo.serviceNowOpportunities.length > 0) {
      output += '## ServiceNow Opportunities\n\n';
      (fitInfo.serviceNowOpportunities || []).forEach((opp: any, idx: number) => {
        if (typeof opp === 'string') {
          output += `**${idx + 1}. ${opp}**\n\n`;
        } else {
          output += `**${idx + 1}. ${opp.opportunity}**\n`;
          if (opp.justification) {
            output += `> ${opp.justification}\n\n`;
          }
          if (opp.evidence) {
            output += `*Evidence:* ${opp.evidence}\n\n`;
          }
        }
      });
    }

    // Northstar Integrators Services - properly extract service names from objects
    if (serviceMapping.enterpriseServices && serviceMapping.enterpriseServices.length > 0) {
      output += '## Recommended Northstar Integrators Services\n\n';
      (serviceMapping.enterpriseServices || []).forEach((svc: any, idx: number) => {
        const serviceName = typeof svc === 'string' ? svc : (svc.service || svc.name || '');
        const justification = typeof svc === 'object' ? (svc.justification || svc.rationale || '') : '';
        const teamAlignment = typeof svc === 'object' ? (svc.salesTeam || svc.team || '') : '';

        if (serviceName) {
          output += `**${idx + 1}. ${serviceName}**\n`;
          if (justification) {
            output += `> ${justification}\n`;
          }
          if (teamAlignment) {
            output += `*Aligned Sales Team:* ${teamAlignment}\n`;
          }
          output += '\n';
        }
      });
    }

    // Atlassian Products
    if (serviceMapping.atlassianServices && serviceMapping.atlassianServices.length > 0) {
      output += '## Recommended Atlassian Products\n\n';
      (serviceMapping.atlassianServices || []).forEach((prod: any, idx: number) => {
        const productName = typeof prod === 'string' ? prod : (prod.product || prod.name || '');
        const useCase = typeof prod === 'object' ? (prod.useCase || prod.purpose || '') : '';

        if (productName) {
          output += `**${idx + 1}. ${productName}**\n`;
          if (useCase) {
            output += `> ${useCase}\n`;
          }
          output += '\n';
        }
      });
    }

    // ServiceNow Products
    if (serviceMapping.serviceNowServices && serviceMapping.serviceNowServices.length > 0) {
      output += '## Recommended ServiceNow Modules\n\n';
      (serviceMapping.serviceNowServices || []).forEach((prod: any, idx: number) => {
        const moduleName = typeof prod === 'string' ? prod : (prod.module || prod.product || prod.name || '');
        const useCase = typeof prod === 'object' ? (prod.useCase || prod.purpose || '') : '';

        if (moduleName) {
          output += `**${idx + 1}. ${moduleName}**\n`;
          if (useCase) {
            output += `> ${useCase}\n`;
          }
          output += '\n';
        }
      });
    }

    // Add cleaned InternalKnowledge AI insights at the bottom if available
    if (internalKbInsights && internalKbInsights.length > 0) {
      // Clean up InternalKnowledge insights - remove AI preambles (comprehensive list)
      let cleanedInsights = internalKbInsights;
      const preamblePatterns = [
        /It seems (?:that )?there was an (?:unexpected )?error.*?(?:again\.|running it again\.)/gi,
        /Let me attempt to.*?(?:\.|:)/gi,
        /I'll attempt to.*?(?:\.|:)/gi,
        /Let's try.*?(?:approach|again|correcting it).*?\./gi,
        /I will now use.*?:/gi,
        /It looks like we're still encountering an error\..*?\./gi,
        /Let's try a different approach.*?\./gi,
        /I will now use your provided data to manually evaluate.*?\./gi,
        /Here's an analysis based on the provided research data:/gi,
        /There was an unexpected error in processing the request\./gi,
        /Let's try correcting it and running it again\./gi,
        /It seems there was an issue.*?\./gi,
        /I apologize for the error.*?\./gi,
        /Unfortunately,? there was an error.*?\./gi,
      ];

      for (const pattern of preamblePatterns) {
        cleanedInsights = cleanedInsights.replace(pattern, '');
      }

      // Extract meaningful content - look for opportunity sections
      const oppMatch = cleanedInsights.match(/(?:###?\s*)?Opportunity\s*\d+[\s\S]*/i);
      if (oppMatch) {
        cleanedInsights = oppMatch[0];
      } else {
        // Try to find content after a markdown header
        const headerMatch = cleanedInsights.match(/###?\s*[A-Z][^#\n]+\n[\s\S]*/);
        if (headerMatch) {
          cleanedInsights = headerMatch[0];
        }
      }

      cleanedInsights = cleanedInsights.trim();

      // Skip if content contains error messages or clarification requests
      const lowerInsights = cleanedInsights.toLowerCase();
      const hasErrorMessages =
        lowerInsights.includes('error in processing') ||
        lowerInsights.includes('encountering an error') ||
        lowerInsights.includes('unexpected error') ||
        lowerInsights.includes('there was an error') ||
        lowerInsights.includes('try correcting it');

      const hasClarificationRequest =
        lowerInsights.includes('too extensive for me to handle') ||
        lowerInsights.includes('break it down into smaller sections') ||
        lowerInsights.includes('could you specify which aspects') ||
        lowerInsights.includes('let me know how you\'d like to proceed') ||
        lowerInsights.includes('prioritize certain parts') ||
        lowerInsights.includes('which areas you are most interested in') ||
        lowerInsights.includes('would you like me to focus on') ||
        lowerInsights.includes('please provide more specific') ||
        lowerInsights.includes('can you clarify') ||
        lowerInsights.includes('need more information') ||
        lowerInsights.includes('data request was too extensive');

      if (!hasErrorMessages && !hasClarificationRequest && cleanedInsights.length > 100) {
        if (cleanedInsights.length > 1500) {
          cleanedInsights = cleanedInsights.substring(0, 1500) + '...';
        }
        output += '\n---\n\n## InternalKnowledge AI Insights\n\n';
        output += cleanedInsights + '\n';
      }
    }

    return output || 'No opportunities identified.';
  }

  /**
   * Format action plan for backward compatibility
   * Enhanced with InternalKnowledge AI insights for better recommendations
   */
  private formatActionPlan(gapInfo: any, serviceMapping: any, internalKbInsights?: string): string {
    let output = '';

    // Add recommended actions first
    const actions = gapInfo.recommendedActions || [];
    if (actions.length > 0) {
      output += '## Recommended Actions\n\n';
      actions.forEach((action: any, idx: number) => {
        // Handle both string and object formats
        const actionText = typeof action === 'string' ? action : (action.action || action.title || '');
        const rationale = typeof action === 'object' ? (action.rationale || action.justification || '') : '';

        if (actionText) {
          output += `**${idx + 1}. ${actionText}**\n`;
          if (rationale) {
            output += `> ${rationale}\n`;
          }
          output += '\n';
        }
      });
    }

    // Add InternalKnowledge-informed context if available - cleaned up
    if (internalKbInsights && internalKbInsights.length > 0) {
      // Clean up InternalKnowledge insights - extract meaningful opportunity content
      let cleanedInsights = internalKbInsights;

      // Remove ALL common AI preamble patterns (comprehensive list - no ^ anchor so they match anywhere)
      const preamblePatterns = [
        /It seems (?:that )?there was an (?:unexpected )?error.*?(?:again\.|running it again\.)/gi,
        /Let me attempt to.*?(?:\.|:)/gi,
        /I'll attempt to.*?(?:\.|:)/gi,
        /Let's try.*?(?:approach|again|correcting it).*?\./gi,
        /I will now use.*?:/gi,
        /It looks like we're still encountering an error\..*?\./gi,
        /Let's try a different approach.*?\./gi,
        /I will now use your provided data to manually evaluate.*?\./gi,
        /Here's an analysis based on the provided research data:/gi,
        /There was an unexpected error in processing the request\./gi,
        /Let's try correcting it and running it again\./gi,
        /It seems there was an issue.*?\./gi,
        /I apologize for the error.*?\./gi,
        /Unfortunately,? there was an error.*?\./gi,
      ];

      for (const pattern of preamblePatterns) {
        cleanedInsights = cleanedInsights.replace(pattern, '');
      }

      // First, try to extract structured opportunity sections (most valuable)
      const oppMatch = cleanedInsights.match(/(?:###?\s*)?Opportunity\s*\d+[\s\S]*/i);
      if (oppMatch) {
        cleanedInsights = oppMatch[0];
      } else {
        // Try to find "Key Observations" or "Insights" section
        const keyObsMatch = cleanedInsights.match(/###?\s*(?:Key Observations|Insights|Analysis)[\s\S]*/i);
        if (keyObsMatch) {
          cleanedInsights = keyObsMatch[0];
        } else {
          // Try to find content after a markdown header
          const headerMatch = cleanedInsights.match(/###?\s*[A-Z][^#\n]+\n[\s\S]*/);
          if (headerMatch) {
            cleanedInsights = headerMatch[0];
          }
        }
      }

      // Clean up any remaining noise
      cleanedInsights = cleanedInsights.trim();

      // Skip if content contains error messages, clarification requests, or is too short
      const lowerInsights = cleanedInsights.toLowerCase();
      const hasErrorMessages =
        lowerInsights.includes('error in processing') ||
        lowerInsights.includes('encountering an error') ||
        lowerInsights.includes('unexpected error') ||
        lowerInsights.includes('there was an error') ||
        lowerInsights.includes('try correcting it');

      // Detect AI clarification/deferral responses (not actual insights)
      const hasClarificationRequest =
        lowerInsights.includes('too extensive for me to handle') ||
        lowerInsights.includes('break it down into smaller sections') ||
        lowerInsights.includes('could you specify which aspects') ||
        lowerInsights.includes('let me know how you\'d like to proceed') ||
        lowerInsights.includes('prioritize certain parts') ||
        lowerInsights.includes('which areas you are most interested in') ||
        lowerInsights.includes('would you like me to focus on') ||
        lowerInsights.includes('please provide more specific') ||
        lowerInsights.includes('can you clarify') ||
        lowerInsights.includes('need more information') ||
        lowerInsights.includes('data request was too extensive');

      if (hasErrorMessages || hasClarificationRequest || cleanedInsights.length < 100) {
        // Don't add InternalKnowledge section if content is not meaningful
      } else {
        // Limit length for display
        if (cleanedInsights.length > 1200) {
          cleanedInsights = cleanedInsights.substring(0, 1200) + '...';
        }

        output += '\n## Insights from Past Engagements\n\n';
        output += cleanedInsights + '\n\n';
      }
    }

    if (serviceMapping.roadmap && serviceMapping.roadmap.length > 0) {
      output += '\n## Implementation Roadmap\n\n';
      serviceMapping.roadmap.forEach((phase: any, idx: number) => {
        output += `### ${phase.phase || `Phase ${idx + 1}`}\n`;
        output += `**Duration:** ${phase.duration || 'TBD'}\n\n`;

        if (phase.activities && phase.activities.length > 0) {
          output += '**Key Activities:**\n';
          phase.activities.forEach((activity: string) => {
            output += `- ${activity}\n`;
          });
          output += '\n';
        }

        if (phase.deliverables && phase.deliverables.length > 0) {
          output += '**Deliverables:**\n';
          phase.deliverables.forEach((deliverable: string) => {
            output += `- ${deliverable}\n`;
          });
          output += '\n';
        }

        if (phase.teamRequired) {
          output += `**Team Required:** ${phase.teamRequired}\n\n`;
        }

        if (phase.successMetrics) {
          output += `**Success Metrics:** ${phase.successMetrics}\n\n`;
        }

        output += '---\n\n';
      });
    }

    return output || 'No action plan available.';
  }

  /**
   * Generate meeting questionnaire for backward compatibility
   * Enhanced with InternalKnowledge AI insights to generate more relevant questions
   */
  private generateMeetingQuestionnaire(companyInfo: any, fitInfo: any, gapInfo: any, internalKbInsights?: string): string {
    let output = 'DISCOVERY QUESTIONS\n\n';
    let questionNum = 1;

    // Add InternalKnowledge-informed discovery questions at the top
    if (internalKbInsights && internalKbInsights.length > 0) {
      output += 'Based on Similar Past Engagements:\n';
      output += `${questionNum}. Based on our experience with similar companies, what challenges are you facing with agile transformation?\n`;
      questionNum++;
      output += `${questionNum}. How does your current tooling landscape compare to industry best practices we've seen?\n`;
      questionNum++;
      output += '\n';
    }

    // Add questions based on gaps
    if (gapInfo.criticalGaps && gapInfo.criticalGaps.length > 0) {
      output += 'Current Challenges:\n';
      gapInfo.criticalGaps.forEach((gap: string) => {
        output += `${questionNum}. How are you currently addressing: ${gap}?\n`;
        questionNum++;
      });
      output += '\n';
    }

    // Add Atlassian questions
    if (fitInfo.atlassianOpportunities && fitInfo.atlassianOpportunities.length > 0) {
      output += 'Atlassian Tools & Project Management:\n';
      output += `${questionNum}. What project management and collaboration tools are you currently using?\n`;
      questionNum++;
      output += `${questionNum}. How do your teams currently manage agile workflows?\n`;
      questionNum++;
      output += `${questionNum}. What challenges do you face with documentation and knowledge sharing?\n\n`;
      questionNum++;
    }

    // Add ServiceNow questions
    if (fitInfo.serviceNowOpportunities && fitInfo.serviceNowOpportunities.length > 0) {
      output += 'IT Service Management:\n';
      output += `${questionNum}. How do you currently handle service desk and incident management?\n`;
      questionNum++;
      output += `${questionNum}. What IT operations and monitoring tools are in place?\n`;
      questionNum++;
      output += `${questionNum}. What are your biggest ITSM pain points?\n\n`;
      questionNum++;
    }

    // Add transformation questions
    if (fitInfo.transformationSignals && fitInfo.transformationSignals.length > 0) {
      output += 'Digital Transformation:\n';
      output += `${questionNum}. What are your top digital transformation priorities?\n`;
      questionNum++;
      output += `${questionNum}. What timeline do you have for these initiatives?\n`;
      questionNum++;
      output += `${questionNum}. Who are the key stakeholders driving this transformation?\n\n`;
      questionNum++;
    }

    return output;
  }

  /**
   * Generate structured questionnaire for AI component
   * Enhanced with InternalKnowledge AI insights for more contextual questions
   */
  private generateStructuredQuestionnaire(companyInfo: any, fitInfo: any, gapInfo: any, serviceMapping: any, internalKbInsights?: string): any {
    const questions = [];
    const companyName = companyInfo.companyName || 'your organization';

    // Extract services and products from serviceMapping
    const enterpriseServices = serviceMapping.enterpriseServices || [];
    const atlassianServices = serviceMapping.atlassianServices || [];
    const serviceNowServices = serviceMapping.serviceNowServices || [];

    // Extract key research data for deep contextualization
    const criticalGaps = gapInfo.criticalGaps || [];
    const transformationSignals = fitInfo.transformationSignals || [];
    const atlassianOpps = fitInfo.atlassianOpportunities || [];
    const serviceNowOpps = fitInfo.serviceNowOpportunities || [];
    const recentNews = companyInfo.recentNews || [];
    const techStack = companyInfo.technologyStack || [];
    const painPoints = companyInfo.painPoints || gapInfo.missingCapabilities || [];
    const industry = companyInfo.industry || 'technology';
    const companySize = companyInfo.companySize || '';
    const employeeCount = companyInfo.employeeCount || '';
    const growthRate = companyInfo.financialPerformance?.growthRate || '';
    const latestUpdates = Array.isArray(companyInfo.companyLatestNews?.highlights)
      ? companyInfo.companyLatestNews.highlights.filter(Boolean)
      : [];

    // Extract InternalKnowledge insights for deeper context
    const internalKbContext = internalKbInsights && internalKbInsights.length > 0 ? internalKbInsights : '';

    // All products (Atlassian + ServiceNow)
    const allProducts = [...atlassianServices, ...serviceNowServices];

    // Build product focus
    const productFocus = allProducts.length > 0
      ? allProducts.slice(0, 3).map((p: any) => (typeof p === 'string' ? p : p.product || p.module || '')).filter((p: string) => p).join(', ')
      : 'Atlassian and ServiceNow solutions';

    // Build target persona
    const targetPersona = `${companyInfo.leadership || 'IT and Engineering Leadership'}, particularly those responsible for ${
      atlassianServices.length > 0 ? 'agile transformation and project management' : ''
    }${atlassianServices.length > 0 && serviceNowServices.length > 0 ? ' and ' : ''}${
      serviceNowServices.length > 0 ? 'IT service management and operations' : ''
    }.`;

    // Build research context summary for UI display
    const researchContext = `${companyName} is ${companySize || 'a company'} in the ${industry} sector. ${
      growthRate ? `Growing at ${growthRate}, t` : 'T'
    }hey face challenges including ${criticalGaps.slice(0, 2).map((g: any) => typeof g === 'string' ? g : g.gap || '').join(' and ')}. ${
      transformationSignals.length > 0
        ? `Current transformation initiatives: ${transformationSignals.slice(0, 2).map((s: any) => typeof s === 'string' ? s : s.signal || '').join(', ')}.`
        : ''
    }${latestUpdates.length > 0 ? ` Recent public updates: ${latestUpdates.slice(0, 2).join(' | ')}.` : ''}`;

    // Build Northstar Integrators value proposition for UI display
    const valueProposition = `Northstar Integrators can help ${companyName} by providing ${
      enterpriseServices.length > 0
        ? enterpriseServices.slice(0, 2).map((s: any) => (typeof s === 'string' ? s : s.service || '')).filter((s: string) => s).join(' and ')
        : 'expert consulting and implementation services'
    }. This engagement could address critical gaps in ${(gapInfo.missingCapabilities || []).slice(0, 2).join(' and ')}.`;

    // Helper to extract clean text from gap/opportunity objects
    const extractText = (item: any): string => {
      if (typeof item === 'string') return item;
      return item.gap || item.opportunity || item.signal || item.description || item.text || '';
    };

    const extractSource = (item: any): string => {
      if (typeof item === 'object' && item.source) return item.source;
      return '';
    };

    // ============================================================================
    // SECTION 1: DEEP-CONTEXT CHALLENGE QUESTIONS (Based on specific research findings)
    // ============================================================================

    if (latestUpdates.length > 0) {
      const update = latestUpdates[0];
      questions.push({
        id: questions.length + 1,
        question: `We noticed a recent public update from ${companyName}: "${update}". How is this affecting your near-term priorities and what outcomes are you aiming for in the next 1-2 quarters?`,
        category: 'Recent Updates',
        context: 'Based on public web sources; confirm details and impact with the client.',
        research_finding: update,
        northstar_connection: 'Northstar Integrators can help translate strategic updates into executable delivery plans and tooling.',
        product_focus: productFocus,
        target_persona: targetPersona,
      });
    }

    // Generate highly specific questions from critical gaps - NOT generic templates
    if (criticalGaps.length > 0) {
      criticalGaps.slice(0, 3).forEach((gap: any, index: number) => {
        const gapText = extractText(gap);
        const source = extractSource(gap);

        // Create a truly specific question that references the research finding
        let specificQuestion = '';
        let context = '';

        // Analyze the gap to create a contextual question
        const lowerGap = gapText.toLowerCase();

        if (lowerGap.includes('privacy') || lowerGap.includes('compliance') || lowerGap.includes('data security')) {
          specificQuestion = `With ${companyName}'s platform connecting to proprietary enterprise data, how are you currently helping customers navigate data residency requirements and evolving compliance frameworks like GDPR and SOC 2?`;
          context = `Research indicates: "${gapText.substring(0, 150)}..."${source ? ` [${source}]` : ''}`;
        } else if (lowerGap.includes('self-serve') || lowerGap.includes('sales-led') || lowerGap.includes('onboarding')) {
          specificQuestion = `Your current sales-led implementation model ensures quality, but have you considered how a more self-serve evaluation tier might accelerate enterprise pipeline while maintaining your high-touch experience?`;
          context = `Research indicates: "${gapText.substring(0, 150)}..."${source ? ` [${source}]` : ''}`;
        } else if (lowerGap.includes('ai') || lowerGap.includes('governance') || lowerGap.includes('accuracy') || lowerGap.includes('hallucination')) {
          specificQuestion = `As ${companyName} scales AI-powered responses across enterprise customers, what governance frameworks are you building to ensure accuracy and prevent misinformation in business-critical workflows?`;
          context = `Research indicates: "${gapText.substring(0, 150)}..."${source ? ` [${source}]` : ''}`;
        } else if (lowerGap.includes('scale') || lowerGap.includes('growth') || lowerGap.includes('rapid')) {
          specificQuestion = `With ${growthRate ? growthRate + ' growth' : 'rapid scaling'}, how is ${companyName} ensuring your internal processes and tooling can keep pace with customer and team expansion?`;
          context = `Research indicates: "${gapText.substring(0, 150)}..."${source ? ` [${source}]` : ''}`;
        } else if (lowerGap.includes('integration') || lowerGap.includes('connect') || lowerGap.includes('ecosystem')) {
          specificQuestion = `Your integration breadth is a key differentiator - what's been the biggest operational challenge in maintaining quality across ${companyName}'s growing connector ecosystem?`;
          context = `Research indicates: "${gapText.substring(0, 150)}..."${source ? ` [${source}]` : ''}`;
        } else {
          // For other gaps, create a more specific question than just "How are you addressing X?"
          specificQuestion = `Our research surfaced that "${gapText.substring(0, 80)}..." - can you share how this is impacting your team's priorities and what approaches you've considered?`;
          context = source ? `Source: ${source}` : 'Based on recent research findings';
        }

        questions.push({
          id: index + 1,
          question: specificQuestion,
          category: 'Research-Driven Insights',
          context: context,
          research_finding: gapText,
          northstar_connection: enterpriseServices.length > index
            ? `Northstar Integrators's ${extractText(enterpriseServices[index])} practice has helped similar companies address this.`
            : 'Northstar Integrators has deep expertise in enterprise transformation challenges.',
          product_focus: '',
          target_persona: targetPersona,
        });
      });
    }

    // ============================================================================
    // SECTION 2: OPPORTUNITY-DRIVEN QUESTIONS (From identified Atlassian/ServiceNow fit)
    // ============================================================================

    // Atlassian opportunity-based questions - deeply contextual
    if (atlassianOpps.length > 0) {
      atlassianOpps.slice(0, 2).forEach((opp: any, index: number) => {
        const oppText = extractText(opp);
        const evidence = typeof opp === 'object' && opp.evidence ? opp.evidence : '';
        const product = atlassianServices.length > index
          ? (typeof atlassianServices[index] === 'string' ? atlassianServices[index] : atlassianServices[index].product || '')
          : 'Confluence and Jira';

        // Create contextual questions based on the actual opportunity
        let specificQuestion = '';
        const lowerOpp = oppText.toLowerCase();

        if (lowerOpp.includes('documentation') || lowerOpp.includes('knowledge')) {
          specificQuestion = `${employeeCount ? `With ${employeeCount} employees` : 'As your team grows'}, how is ${companyName} currently scaling knowledge management to ensure engineering and product teams have consistent access to tribal knowledge and decision context?`;
        } else if (lowerOpp.includes('collaboration') || lowerOpp.includes('distributed') || lowerOpp.includes('remote')) {
          specificQuestion = `How are ${companyName}'s distributed teams currently staying aligned on roadmap priorities and cross-functional initiatives - are there friction points in how context gets shared across time zones?`;
        } else if (lowerOpp.includes('agile') || lowerOpp.includes('sprint') || lowerOpp.includes('scrum')) {
          specificQuestion = `What agile practices have been most effective at ${companyName}, and where do you see the biggest opportunities to improve velocity and predictability as the team scales?`;
        } else if (lowerOpp.includes('portfolio') || lowerOpp.includes('roadmap') || lowerOpp.includes('alignment')) {
          specificQuestion = `How does ${companyName}'s leadership currently maintain visibility into engineering capacity and strategic alignment across your growing product portfolio?`;
        } else {
          specificQuestion = `Based on ${companyName}'s need for ${oppText.substring(0, 60)}, what's currently working well and where do you see the biggest improvement opportunities?`;
        }

        questions.push({
          id: questions.length + 1,
          question: specificQuestion,
          category: 'Atlassian & Agile Transformation',
          context: evidence || `Research identified opportunity: ${oppText.substring(0, 100)}`,
          research_finding: oppText,
          northstar_connection: `Northstar Integrators is an Atlassian Platinum Partner specializing in ${product} for ${employeeCount || 'scaling'} organizations.`,
          product_focus: product,
          target_persona: targetPersona,
        });
      });
    }

    // ServiceNow opportunity-based questions
    if (serviceNowOpps.length > 0) {
      serviceNowOpps.slice(0, 2).forEach((opp: any, index: number) => {
        const oppText = extractText(opp);
        const evidence = typeof opp === 'object' && opp.evidence ? opp.evidence : '';
        const module = serviceNowServices.length > index
          ? (typeof serviceNowServices[index] === 'string' ? serviceNowServices[index] : serviceNowServices[index].module || '')
          : 'ServiceNow ITSM';

        let specificQuestion = '';
        const lowerOpp = oppText.toLowerCase();

        if (lowerOpp.includes('itsm') || lowerOpp.includes('service desk') || lowerOpp.includes('incident')) {
          specificQuestion = `As ${companyName} scales to support more enterprise customers, how are you evolving your internal IT service management to maintain the same speed and quality your customers expect from your product?`;
        } else if (lowerOpp.includes('itom') || lowerOpp.includes('operations') || lowerOpp.includes('infrastructure')) {
          specificQuestion = `With ${companyName}'s infrastructure complexity growing alongside your customer base, what visibility do you currently have into operational health and how proactive vs. reactive is your operations team?`;
        } else if (lowerOpp.includes('workflow') || lowerOpp.includes('automation')) {
          specificQuestion = `Where are the biggest manual handoffs or process bottlenecks in ${companyName}'s internal operations that could benefit from intelligent automation?`;
        } else {
          specificQuestion = `Our research identified ${oppText.substring(0, 50)} as an opportunity area - how is this currently impacting operational efficiency at ${companyName}?`;
        }

        questions.push({
          id: questions.length + 1,
          question: specificQuestion,
          category: 'IT Service Management',
          context: evidence || `Research identified opportunity: ${oppText.substring(0, 100)}`,
          research_finding: oppText,
          northstar_connection: `Northstar Integrators is a ServiceNow Elite Partner with proven ${module} implementations.`,
          product_focus: module,
          target_persona: targetPersona,
        });
      });
    }

    // ============================================================================
    // SECTION 3: TRANSFORMATION & GROWTH QUESTIONS (Based on signals detected)
    // ============================================================================

    if (transformationSignals.length > 0) {
      const signal1 = extractText(transformationSignals[0]);
      const signal2 = transformationSignals.length > 1 ? extractText(transformationSignals[1]) : '';

      questions.push({
        id: questions.length + 1,
        question: `We noticed ${companyName} is ${signal1.toLowerCase().substring(0, 80)}${signal1.length > 80 ? '...' : ''} - what's driving this initiative and what does success look like in the next 6 months?`,
        category: 'Strategic Initiatives',
        context: signal2 ? `Additional signal: ${signal2}` : 'Based on detected transformation signals',
        research_finding: signal1,
        northstar_connection: 'Northstar Integrators specializes in enterprise transformation with proven outcomes across 1000+ engagements.',
        product_focus: productFocus,
        target_persona: 'C-Suite, VP Engineering',
      });

      if (signal2) {
        questions.push({
          id: questions.length + 1,
          question: `How are ${companyName}'s ${signal2.toLowerCase().substring(0, 50)} efforts aligned with your broader technology strategy - are these driven by customer demand, operational efficiency, or competitive positioning?`,
          category: 'Strategic Initiatives',
          context: `Multiple transformation signals detected in research`,
          research_finding: signal2,
          northstar_connection: 'Northstar Integrators provides strategic advisory to ensure transformation investments deliver measurable ROI.',
          product_focus: productFocus,
          target_persona: 'VP Engineering, CTO, VP Product',
        });
      }
    }

    // ============================================================================
    // SECTION 4: Internal KB questions (if Northstar Integrators has relevant case studies/insights)
    // ============================================================================

    if (internalKbContext && internalKbContext.length > 100) {
      // Extract key themes from InternalKnowledge insights
      const lowerKmhub = internalKbContext.toLowerCase();

      if (lowerKmhub.includes('case study') || lowerKmhub.includes('similar') || lowerKmhub.includes('success')) {
        questions.push({
          id: questions.length + 1,
          question: `Northstar Integrators has worked with companies in similar situations to ${companyName} - would it be valuable to share some specific outcomes and lessons learned from those engagements?`,
          category: 'Northstar Integrators Experience',
          context: `InternalKnowledge insight: ${internalKbContext.substring(0, 200)}...`,
          research_finding: 'Based on Northstar Integrators internal knowledge base',
          northstar_connection: 'Northstar Integrators has relevant case studies and proven approaches for your situation.',
          product_focus: productFocus,
          target_persona: 'Decision Makers',
        });
      }
    }

    // ============================================================================
    // SECTION 5: CONTEXTUAL BUSINESS QUESTIONS (NOT generic templates)
    // ============================================================================

    // Growth/Scale question - contextualized to their situation
    if (growthRate || (employeeCount && parseInt(employeeCount) > 200)) {
      questions.push({
        id: questions.length + 1,
        question: `${growthRate ? `With ${growthRate} growth` : `At ${employeeCount} employees`}, what's been the biggest organizational challenge - is it maintaining engineering velocity, preserving culture, or ensuring processes don't become bottlenecks?`,
        category: 'Scaling Challenges',
        context: `${companyName} shows indicators of rapid growth requiring organizational adaptation`,
        northstar_connection: 'Northstar Integrators helps scaling organizations implement sustainable practices and tooling.',
        product_focus: 'Jira Align, SAFe Training',
        target_persona: 'VP Engineering, CTO',
      });
    }

    // Industry-specific question
    if (industry && industry.toLowerCase() !== 'technology') {
      questions.push({
        id: questions.length + 1,
        question: `In the ${industry} space, what unique compliance or operational requirements shape how ${companyName} approaches technology decisions and vendor selection?`,
        category: 'Industry Context',
        context: `${companyName} operates in ${industry} with specific requirements`,
        northstar_connection: `Northstar Integrators has experience with ${industry} sector requirements and regulations.`,
        product_focus: productFocus,
        target_persona: 'IT Leadership, Compliance',
      });
    }

    // Decision-making question - always valuable
    questions.push({
      id: questions.length + 1,
      question: `For initiatives like this at ${companyName}, who typically needs to be involved in the evaluation and what criteria matter most - is it speed to value, total cost, vendor expertise, or something else?`,
      category: 'Decision Process',
      context: 'Understanding decision criteria helps tailor the engagement approach',
      northstar_connection: 'Northstar Integrators provides flexible engagement models aligned with how you evaluate and procure.',
      product_focus: '',
      target_persona: 'All Stakeholders',
    });

    // Success metrics question - contextualized
    questions.push({
      id: questions.length + 1,
      question: `If we partnered on this, what would ${companyName}'s leadership need to see in 90 days to consider it a success - and how would that be measured?`,
      category: 'Success Criteria',
      context: 'Defining success upfront ensures alignment and measurable outcomes',
      northstar_connection: 'Northstar Integrators establishes clear KPIs and success metrics as part of every engagement.',
      product_focus: productFocus,
      target_persona: 'C-Suite, VP Engineering',
    });

    // Build key insights for display
    const insights = [
      ...(gapInfo.criticalGaps || []).slice(0, 2),
      ...(fitInfo.transformationSignals || []).slice(0, 2),
      ...(fitInfo.atlassianOpportunities || [])
        .slice(0, 1)
        .map((o: any) => (typeof o === 'string' ? o : o.opportunity || '')),
    ].filter((i) => i);

    return {
      questions,
      generatedAt: new Date().toISOString(),
      companyName: companyInfo.companyName || 'Northstar Integrators',

      // Metadata for UI display
      servicesCount: enterpriseServices.length,
      productsCount: allProducts.length,
      insightsCount: insights.length,

      // Context fields for UI
      researchContext,
      valueProposition,
      productFocus,
      targetPersona,
      insights,

      // Service and product lists
      services: enterpriseServices.map((s: any) => (typeof s === 'string' ? { name: s } : { name: s.service || '', ...s })),
      products: allProducts.map((p: any) => (typeof p === 'string' ? { name: p } : { name: p.product || p.module || '', ...p })),
    };
  }
}

// Singleton instance
let researchServiceInstance: ResearchService | null = null;

export function getResearchService(): ResearchService {
  if (!researchServiceInstance) {
    researchServiceInstance = new ResearchService();
  }
  return researchServiceInstance;
}
