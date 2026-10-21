import { getPrismaClient } from '../config/database';
import { getOpenAIService } from './openai.service';
import { getMSGraphService } from './ms-graph.service';

const prisma = getPrismaClient();

// Keywords that indicate a proactive/outbound call
const PROACTIVE_KEYWORDS = [
  'intro',
  'introduction',
  'discovery',
  'outreach',
  'cold',
  'initial',
  'first call',
  'first meeting',
  'exploratory',
  'introductory',
  'get to know',
  'meet and greet',
  'kickoff',
  'prospecting',
  'outbound',
  'new opportunity',
  'new prospect',
];

// Keywords that indicate NOT a proactive call (existing relationship)
const NON_PROACTIVE_KEYWORDS = [
  'follow-up',
  'follow up',
  'check-in',
  'check in',
  'status',
  'review',
  'weekly',
  'monthly',
  'quarterly',
  'recurring',
  'standup',
  'stand-up',
  'sprint',
  'retrospective',
  'planning',
  'demo',
  'training',
  'workshop',
];

export interface ProactiveCallDetection {
  isProactive: boolean;
  type: string | null;
  confidence: number;
  reason: string;
}

export interface OutreachEmailDraft {
  subject: string;
  body: string;
  highlights: string[];
  valueProps: string[];
  agenda: string[];
  recipientEmails: string[];
}

export interface AttendeeInfo {
  name: string;
  email: string;
  company?: string;
  title?: string;
}

export interface FollowUpEmailDraft {
  subject: string;
  body: string;
  actionItems: string[];
  nextSteps: string[];
  recipientEmails: string[];
}

class ProactiveEmailService {
  /**
   * Detect if a meeting is a proactive/outbound call based on title and context
   */
  detectProactiveCall(meetingTitle: string, meetingNotes?: string): ProactiveCallDetection {
    const lowerTitle = meetingTitle.toLowerCase();
    const lowerNotes = (meetingNotes || '').toLowerCase();
    const combinedText = `${lowerTitle} ${lowerNotes}`;

    // Check for non-proactive indicators first (higher priority)
    for (const keyword of NON_PROACTIVE_KEYWORDS) {
      if (combinedText.includes(keyword)) {
        return {
          isProactive: false,
          type: null,
          confidence: 80,
          reason: `Contains "${keyword}" - likely existing relationship`,
        };
      }
    }

    // Check for proactive indicators
    for (const keyword of PROACTIVE_KEYWORDS) {
      if (combinedText.includes(keyword)) {
        let type = 'outreach';
        if (keyword.includes('intro')) type = 'intro';
        else if (keyword.includes('discovery')) type = 'discovery';
        else if (keyword.includes('exploratory')) type = 'exploratory';
        else if (keyword.includes('cold')) type = 'cold';

        return {
          isProactive: true,
          type,
          confidence: 85,
          reason: `Contains "${keyword}" - likely proactive outreach`,
        };
      }
    }

    // Default: unknown, but lean towards not proactive
    return {
      isProactive: false,
      type: null,
      confidence: 50,
      reason: 'No clear indicators found',
    };
  }

  /**
   * Generate an outreach email draft based on meeting context and company research
   */
  async generateOutreachEmail(params: {
    meetingTitle: string;
    companyName: string;
    attendees: AttendeeInfo[];
    companyResearch?: any;
    meetingPurpose?: string;
    senderName?: string;
  }): Promise<OutreachEmailDraft> {
    const openaiService = getOpenAIService();

    const { meetingTitle, companyName, attendees, companyResearch, meetingPurpose, senderName } = params;

    // Extract key information from research
    const researchSummary = companyResearch?.summary || companyResearch?.company_overview || '';
    const painPoints = companyResearch?.painPoints || companyResearch?.pain_points || [];
    const initiatives = companyResearch?.strategicInitiatives || companyResearch?.strategic_initiatives || [];

    // Build attendee context
    const attendeeNames = attendees.map(a => a.name).join(', ');
    const primaryAttendee = attendees[0];

    const prompt = `Generate a professional outreach email for a sales meeting.

Context:
- Meeting Title: ${meetingTitle}
- Company: ${companyName}
- Attendee(s): ${attendeeNames}
- Primary Contact: ${primaryAttendee?.name || 'Unknown'} ${primaryAttendee?.title ? `(${primaryAttendee.title})` : ''}
- Meeting Purpose: ${meetingPurpose || 'Introduction and discovery'}
- Company Research Summary: ${researchSummary.slice(0, 500)}
- Known Pain Points: ${Array.isArray(painPoints) ? painPoints.slice(0, 3).join(', ') : 'Unknown'}
- Strategic Initiatives: ${Array.isArray(initiatives) ? initiatives.slice(0, 3).join(', ') : 'Unknown'}

Generate an email with the following structure:
1. Subject line (compelling but not salesy)
2. Email body (professional, concise, ~150 words):
   - Personalized opening referencing their company
   - Brief mention of why you're reaching out
   - 2-3 potential discussion topics relevant to their business
   - Clear call to action for the meeting
3. 3 key highlights about the prospect company (for the sender's reference)
4. 3 value propositions Northstar Integrators can offer them
5. 3 suggested agenda items for the meeting

Format your response as JSON:
{
  "subject": "...",
  "body": "...",
  "highlights": ["...", "...", "..."],
  "valueProps": ["...", "...", "..."],
  "agenda": ["...", "...", "..."]
}`;

    try {
      const response = await openaiService.generateChatCompletion({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        maxTokens: 800,
      });

      // Parse the JSON response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          subject: parsed.subject || `Introduction: ${companyName} <> Northstar Integrators`,
          body: parsed.body || '',
          highlights: parsed.highlights || [],
          valueProps: parsed.valueProps || [],
          agenda: parsed.agenda || [],
          recipientEmails: attendees.filter(a => a.email).map(a => a.email),
        };
      }
    } catch (error) {
      console.error('Failed to generate outreach email:', error);
    }

    // Fallback template
    return {
      subject: `Introduction: ${companyName} <> Northstar Integrators`,
      body: `Hi ${primaryAttendee?.name || 'there'},

I hope this message finds you well. I'm reaching out ahead of our upcoming meeting to share some context on how Northstar Integrators has been helping organizations like ${companyName} with their digital transformation initiatives.

I'd love to learn more about your current priorities and explore how we might be able to support your team's goals.

Looking forward to our conversation.

Best regards,
${senderName || 'Your Name'}`,
      highlights: [
        `${companyName} - research pending`,
        'Key stakeholder meeting',
        'Discovery opportunity',
      ],
      valueProps: [
        'Agile Transformation expertise',
        'DevOps and platform engineering',
        'Atlassian and ServiceNow solutions',
      ],
      agenda: [
        'Introductions and background',
        'Current challenges and priorities',
        'Potential areas of collaboration',
      ],
      recipientEmails: attendees.filter(a => a.email).map(a => a.email),
    };
  }

  /**
   * Save email draft to meeting record
   */
  async saveEmailDraft(meetingId: string, draft: OutreachEmailDraft): Promise<void> {
    await prisma.meeting.update({
      where: { meetingId },
      data: {
        outreachEmailDraft: JSON.stringify(draft),
        outreachEmailSubject: draft.subject,
      },
    });
  }

  /**
   * Get saved email draft for a meeting
   */
  async getEmailDraft(meetingId: string): Promise<OutreachEmailDraft | null> {
    const meeting = await prisma.meeting.findUnique({
      where: { meetingId },
      select: { outreachEmailDraft: true, outreachEmailSubject: true },
    });

    if (!meeting?.outreachEmailDraft) return null;

    try {
      return JSON.parse(meeting.outreachEmailDraft);
    } catch {
      return null;
    }
  }

  /**
   * Send the outreach email via MS Graph
   */
  async sendOutreachEmail(
    accessToken: string,
    meetingId: string,
    customSubject?: string,
    customBody?: string
  ): Promise<boolean> {
    const msGraphService = getMSGraphService();

    // Get the saved draft
    const draft = await this.getEmailDraft(meetingId);
    if (!draft) {
      throw new Error('No email draft found for this meeting');
    }

    const subject = customSubject || draft.subject;
    const body = customBody || draft.body;
    const recipients = draft.recipientEmails;

    if (recipients.length === 0) {
      throw new Error('No recipient emails found');
    }

    // Send the email
    const success = await msGraphService.sendEmail(accessToken, recipients, subject, body, false);

    if (success) {
      // Mark email as sent
      await prisma.meeting.update({
        where: { meetingId },
        data: {
          outreachEmailSentAt: new Date(),
        },
      });
    }

    return success;
  }

  /**
   * Update meeting proactive status
   */
  async setProactiveStatus(
    meetingId: string,
    isProactive: boolean,
    proactiveCallType?: string
  ): Promise<void> {
    await prisma.meeting.update({
      where: { meetingId },
      data: {
        isProactiveCall: isProactive,
        proactiveCallType: proactiveCallType || null,
      },
    });
  }

  /**
   * Generate a post-call follow-up email based on transcript analysis results
   */
  async generateFollowUpEmail(params: {
    meetingTitle: string;
    companyName: string;
    attendees: AttendeeInfo[];
    analysisResult: {
      executiveSummary?: string;
      executive_summary?: string;
      Summary?: string;
      summary?: string;
      nextSteps?: any[];
      next_steps?: any[];
      NextSteps?: any[];
      actionItems?: any[];
      action_items?: any[];
      ActionItems?: any[];
      stakeholders?: any[];
      Stakeholders?: any[];
      painPoints?: any[];
      pain_points?: any[];
      PainPoints?: any[];
      keyDiscussionPoints?: any[];
      key_discussion_points?: any[];
      KeyDiscussionPoints?: any[];
      data?: any;
    };
    meetingDate?: string;
    senderName?: string;
  }): Promise<FollowUpEmailDraft> {
    const openaiService = getOpenAIService();
    const { meetingTitle, companyName, attendees, analysisResult, meetingDate, senderName } = params;

    // Normalize nested data (analysis result may have a 'data' wrapper)
    const result = analysisResult?.data || analysisResult;

    const summary =
      result.executiveSummary || result.executive_summary ||
      result.Summary || result.summary || '';

    const nextSteps = result.nextSteps || result.next_steps || result.NextSteps || [];
    const actionItems = result.actionItems || result.action_items || result.ActionItems || [];
    const stakeholders = result.stakeholders || result.Stakeholders || [];
    const painPoints = result.painPoints || result.pain_points || result.PainPoints || [];
    const keyPoints = result.keyDiscussionPoints || result.key_discussion_points || result.KeyDiscussionPoints || [];

    const attendeeNames = attendees.map(a => a.name).join(', ');
    const primaryAttendee = attendees[0];

    const formatItems = (items: any[]): string => {
      if (!Array.isArray(items) || items.length === 0) return 'None identified';
      return items.slice(0, 5).map((item: any) => {
        if (typeof item === 'string') return item;
        return item.action || item.description || item.step || item.text || JSON.stringify(item);
      }).join('\n- ');
    };

    const prompt = `Generate a professional post-call follow-up email based on meeting analysis.

Context:
- Meeting Title: ${meetingTitle}
- Company: ${companyName}
- Meeting Date: ${meetingDate || 'Recent'}
- Attendee(s): ${attendeeNames}
- Primary Contact: ${primaryAttendee?.name || 'Unknown'} ${primaryAttendee?.title ? `(${primaryAttendee.title})` : ''}

Discussion Summary:
${(typeof summary === 'string' ? summary : '').slice(0, 600)}

Key Discussion Topics:
- ${formatItems(keyPoints)}

Pain Points Identified:
- ${formatItems(painPoints)}

Action Items:
- ${formatItems(actionItems)}

Next Steps:
- ${formatItems(nextSteps)}

Generate an email with:
1. Subject line (professional, referencing the meeting)
2. Email body (professional, ~200 words):
   - Thank them for their time
   - Brief recap of key discussion topics (2-3 sentences)
   - List committed action items with owners if available
   - Confirm agreed next steps with timelines if available
   - Close with a clear next touchpoint
3. Action items list (clean, short bullet points)
4. Next steps list (clean, short bullet points with owners and timelines)

Format as JSON:
{
  "subject": "...",
  "body": "...",
  "actionItems": ["...", "..."],
  "nextSteps": ["...", "..."]
}`;

    try {
      const response = await openaiService.generateChatCompletion({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        maxTokens: 1000,
      });

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          subject: parsed.subject || `Follow-up: ${meetingTitle}`,
          body: parsed.body || '',
          actionItems: parsed.actionItems || [],
          nextSteps: parsed.nextSteps || [],
          recipientEmails: attendees.filter(a => a.email).map(a => a.email),
        };
      }
    } catch (error) {
      console.error('Failed to generate follow-up email:', error);
    }

    // Fallback template
    return {
      subject: `Follow-up: ${meetingTitle}`,
      body: `Hi ${primaryAttendee?.name || 'there'},

Thank you for taking the time to meet with us regarding ${meetingTitle}. It was a productive conversation and I appreciate you sharing your insights on ${companyName}'s current priorities.

I wanted to recap the key points from our discussion and confirm the next steps we agreed upon. Please let me know if I've missed anything or if any details need to be adjusted.

I'll follow up on the action items outlined below and look forward to our next conversation.

Best regards,
${senderName || 'Your Name'}`,
      actionItems: actionItems.slice(0, 5).map((item: any) =>
        typeof item === 'string' ? item : item.action || item.description || 'Action item'
      ),
      nextSteps: nextSteps.slice(0, 5).map((item: any) =>
        typeof item === 'string' ? item : item.action || item.description || 'Next step'
      ),
      recipientEmails: attendees.filter(a => a.email).map(a => a.email),
    };
  }

  /**
   * Save follow-up email draft to meeting record
   */
  async saveFollowUpEmailDraft(meetingId: string, draft: FollowUpEmailDraft): Promise<void> {
    await prisma.meeting.update({
      where: { meetingId },
      data: {
        followupEmailDraft: JSON.stringify(draft),
        followupEmailSubject: draft.subject,
      },
    });
  }

  /**
   * Get saved follow-up email draft for a meeting
   */
  async getFollowUpEmailDraft(meetingId: string): Promise<FollowUpEmailDraft | null> {
    const meeting = await prisma.meeting.findUnique({
      where: { meetingId },
      select: { followupEmailDraft: true, followupEmailSubject: true },
    });

    if (!meeting?.followupEmailDraft) return null;

    try {
      return JSON.parse(meeting.followupEmailDraft);
    } catch {
      return null;
    }
  }

  /**
   * Send the follow-up email via MS Graph
   */
  async sendFollowUpEmail(
    accessToken: string,
    meetingId: string,
    customSubject?: string,
    customBody?: string
  ): Promise<boolean> {
    const msGraphService = getMSGraphService();

    const draft = await this.getFollowUpEmailDraft(meetingId);
    if (!draft) {
      throw new Error('No follow-up email draft found for this meeting');
    }

    const subject = customSubject || draft.subject;
    const body = customBody || draft.body;
    const recipients = draft.recipientEmails;

    if (recipients.length === 0) {
      throw new Error('No recipient emails found');
    }

    const success = await msGraphService.sendEmail(accessToken, recipients, subject, body, false);

    if (success) {
      await prisma.meeting.update({
        where: { meetingId },
        data: { followupEmailSentAt: new Date() },
      });
    }

    return success;
  }

  /**
   * Get proactive status for a meeting
   */
  async getProactiveStatus(meetingId: string): Promise<{
    isProactive: boolean;
    proactiveCallType: string | null;
    hasEmailDraft: boolean;
    emailSentAt: Date | null;
  } | null> {
    const meeting = await prisma.meeting.findUnique({
      where: { meetingId },
      select: {
        isProactiveCall: true,
        proactiveCallType: true,
        outreachEmailDraft: true,
        outreachEmailSentAt: true,
      },
    });

    if (!meeting) return null;

    return {
      isProactive: meeting.isProactiveCall,
      proactiveCallType: meeting.proactiveCallType,
      hasEmailDraft: !!meeting.outreachEmailDraft,
      emailSentAt: meeting.outreachEmailSentAt,
    };
  }
}

// Singleton instance
let serviceInstance: ProactiveEmailService | null = null;

export function getProactiveEmailService(): ProactiveEmailService {
  if (!serviceInstance) {
    serviceInstance = new ProactiveEmailService();
  }
  return serviceInstance;
}

export default ProactiveEmailService;
