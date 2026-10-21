/**
 * Notification Service
 * Handles sending notifications via email (MS Graph) and storing for in-app display
 */

import { getPrismaClient } from '../config/database';
import { MSGraphService } from './ms-graph.service';
import { getLoggerService } from './logger.service';

const prisma = getPrismaClient();
const msGraph = new MSGraphService();
const logger = getLoggerService();

export type NotificationType =
  | 'pre_call_complete'
  | 'transcript_complete'
  | 'proposal_complete'
  | 'ppt_complete'
  | 'pipeline_complete'
  | 'pipeline_error'
  | 'bulk_analysis_complete'
  | 'bulk_analysis_error'
  | 'intelligence_complete'
  | 'survey_complete'
  | 'agent_mapping_complete'
  | 'persona_mapping_complete'
  | 'service_mapping_complete';

export interface NotificationPayload {
  type: NotificationType;
  userId: string;
  userEmail?: string;
  accessToken?: string;
  title: string;
  message: string;
  dealId?: string;
  dealName?: string;
  meetingId?: string;
  meetingTitle?: string;
  companyName?: string;
  analysisData?: Record<string, unknown>;
  sendEmail?: boolean;
  attachments?: Array<{
    name: string;
    contentType: string;
    contentBytes: string; // base64 encoded
  }>;
}

/**
 * Create and store a notification for in-app display
 */
export async function createNotification(payload: NotificationPayload): Promise<void> {
  try {
    // Store notification in database for polling/retrieval
    await prisma.notification.create({
      data: {
        notificationId: crypto.randomUUID(),
        userId: payload.userId,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        dealId: payload.dealId || null,
        meetingId: payload.meetingId || null,
        metadata: payload.analysisData ? JSON.stringify(payload.analysisData) : null,
        read: false,
        createdAt: new Date(),
      },
    });

    logger.info('Notification created', {
      type: payload.type,
      userId: payload.userId,
      title: payload.title,
    });
  } catch (error) {
    logger.error('Failed to create notification', error, { payload });
  }
}

/**
 * Send email notification with analysis results
 */
export async function sendEmailNotification(payload: NotificationPayload): Promise<boolean> {
  if (!payload.accessToken || !payload.userEmail) {
    logger.warn('Cannot send email notification: missing access token or email', {
      hasToken: !!payload.accessToken,
      hasEmail: !!payload.userEmail,
    });
    return false;
  }

  try {
    const emailBody = generateEmailBody(payload);
    let success: boolean;

    // If attachments are provided, use the attachment-enabled method
    if (payload.attachments && payload.attachments.length > 0) {
      success = await msGraph.sendEmailWithAttachments(
        payload.accessToken,
        [payload.userEmail],
        payload.title,
        emailBody,
        payload.attachments,
        true // HTML email
      );

      logger.info('Email notification sent with attachments', {
        type: payload.type,
        to: payload.userEmail,
        subject: payload.title,
        attachmentCount: payload.attachments.length,
        attachmentNames: payload.attachments.map(a => a.name),
      });
    } else {
      success = await msGraph.sendEmail(
        payload.accessToken,
        [payload.userEmail],
        payload.title,
        emailBody,
        true // HTML email
      );

      if (success) {
        logger.info('Email notification sent', {
          type: payload.type,
          to: payload.userEmail,
          subject: payload.title,
        });
      }
    }

    return success;
  } catch (error) {
    logger.error('Failed to send email notification', error, {
      type: payload.type,
      to: payload.userEmail,
    });
    return false;
  }
}

/**
 * Send both in-app and email notifications
 */
export async function sendNotification(payload: NotificationPayload): Promise<void> {
  // Always create in-app notification
  await createNotification(payload);

  // Send email if requested and credentials available
  if (payload.sendEmail && payload.accessToken && payload.userEmail) {
    await sendEmailNotification(payload);
  }
}

/**
 * Generate HTML email body based on notification type
 */
function generateEmailBody(payload: NotificationPayload): string {
  const baseStyles = `
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background: linear-gradient(135deg, #002348 0%, #00A48C 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
      .content { background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; }
      .section { background: white; padding: 15px; margin: 10px 0; border-radius: 6px; border-left: 4px solid #00A48C; }
      .section-title { color: #002348; font-weight: 600; margin-bottom: 8px; }
      .metric { display: inline-block; background: #e8f4f2; padding: 4px 12px; border-radius: 16px; margin: 4px; font-size: 14px; }
      .button { display: inline-block; background: #00A48C; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px; }
      .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
    </style>
  `;

  const header = `
    <div class="header">
      <h2 style="margin: 0;">${payload.title}</h2>
      ${payload.companyName ? `<p style="margin: 5px 0 0 0; opacity: 0.9;">${payload.companyName}</p>` : ''}
    </div>
  `;

  let content = '';
  const data = payload.analysisData || {};

  switch (payload.type) {
    case 'pre_call_complete':
      content = generatePreCallEmailContent(data, payload);
      break;
    case 'transcript_complete':
      content = generateTranscriptEmailContent(data, payload);
      break;
    case 'proposal_complete':
      content = generateProposalEmailContent(data, payload);
      break;
    case 'ppt_complete':
    case 'pipeline_complete':
      content = generatePipelineCompleteEmailContent(data, payload);
      break;
    case 'pipeline_error':
      content = generateErrorEmailContent(data, payload);
      break;
    default:
      content = `<div class="section"><p>${payload.message}</p></div>`;
  }

  const footer = `
    <div class="footer">
      <p>This is an automated notification from Sales Intelligence.</p>
      <p>View full details in the <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/app/pipeline">Sales Intelligence App</a></p>
    </div>
  `;

  return `
    <!DOCTYPE html>
    <html>
    <head>${baseStyles}</head>
    <body>
      <div class="container">
        ${header}
        <div class="content">
          ${content}
        </div>
        ${footer}
      </div>
    </body>
    </html>
  `;
}

function generatePreCallEmailContent(data: Record<string, unknown>, payload: NotificationPayload): string {
  const result = data.result as Record<string, unknown> || {};
  const companyInfo = result.company_analysis as Record<string, unknown> || {};
  const competitorInfo = result.competitor_analysis as Record<string, unknown> || {};

  return `
    <div class="section">
      <div class="section-title">Pre-Call Research Complete</div>
      <p>Your pre-call research for <strong>${payload.meetingTitle || 'the meeting'}</strong> is ready.</p>
    </div>

    ${companyInfo.summary ? `
    <div class="section">
      <div class="section-title">Company Overview</div>
      <p>${String(companyInfo.summary).substring(0, 300)}...</p>
    </div>
    ` : ''}

    ${Array.isArray(result.key_talking_points) && result.key_talking_points.length > 0 ? `
    <div class="section">
      <div class="section-title">Key Talking Points</div>
      <ul>
        ${(result.key_talking_points as string[]).slice(0, 5).map(point => `<li>${point}</li>`).join('')}
      </ul>
    </div>
    ` : ''}

    <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/app/calendar/meetings/${payload.meetingId}" class="button">
      View Full Research
    </a>
  `;
}

function generateTranscriptEmailContent(data: Record<string, unknown>, payload: NotificationPayload): string {
  const opportunityScore = data.opportunityScore as number || null;
  const sentiment = data.sentimentOverall as string || 'N/A';
  const result = data.result as Record<string, unknown> || {};
  const painPoints = result.painPoints as string[] || [];
  const nextSteps = result.nextSteps as string[] || [];

  return `
    <div class="section">
      <div class="section-title">Transcript Analysis Complete</div>
      <p>Your meeting transcript for <strong>${payload.meetingTitle || 'the meeting'}</strong> has been analyzed.</p>

      <div style="margin-top: 10px;">
        ${opportunityScore !== null ? `<span class="metric">Opportunity Score: ${opportunityScore}/100</span>` : ''}
        <span class="metric">Sentiment: ${sentiment}</span>
      </div>
    </div>

    ${painPoints.length > 0 ? `
    <div class="section">
      <div class="section-title">Pain Points Identified</div>
      <ul>
        ${painPoints.slice(0, 5).map(point => `<li>${point}</li>`).join('')}
      </ul>
    </div>
    ` : ''}

    ${nextSteps.length > 0 ? `
    <div class="section">
      <div class="section-title">Recommended Next Steps</div>
      <ul>
        ${nextSteps.slice(0, 5).map(step => `<li>${step}</li>`).join('')}
      </ul>
    </div>
    ` : ''}

    <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/app/deals/${payload.dealId}" class="button">
      View Full Analysis
    </a>
  `;
}

function generateProposalEmailContent(data: Record<string, unknown>, payload: NotificationPayload): string {
  return `
    <div class="section">
      <div class="section-title">Proposal Generated</div>
      <p>A new proposal has been generated for <strong>${payload.companyName || payload.meetingTitle || 'your deal'}</strong>.</p>
      <p>The proposal is ready for your review and can be customized before sharing with the client.</p>
    </div>

    <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/app/deals/${payload.dealId}?tab=artifacts" class="button">
      View Proposal
    </a>
  `;
}

function generatePipelineCompleteEmailContent(data: Record<string, unknown>, payload: NotificationPayload): string {
  const downloadUrl = data.pptDownloadUrl as string || null;

  return `
    <div class="section">
      <div class="section-title">Pipeline Complete!</div>
      <p>The full analysis pipeline for <strong>${payload.companyName || payload.meetingTitle || 'your meeting'}</strong> has completed.</p>
      <p>All artifacts are ready:</p>
      <ul>
        <li>Transcript Analysis</li>
        <li>Proposal Document</li>
        <li>PowerPoint Presentation</li>
      </ul>
    </div>

    ${downloadUrl ? `
    <div class="section">
      <div class="section-title">Download PowerPoint</div>
      <a href="${downloadUrl}" class="button" style="background: #002348;">
        Download PPTX
      </a>
    </div>
    ` : ''}

    <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/app/deals/${payload.dealId}?tab=artifacts" class="button">
      View All Artifacts
    </a>
  `;
}

function generateErrorEmailContent(data: Record<string, unknown>, payload: NotificationPayload): string {
  const errorMessage = data.error as string || 'An unknown error occurred';

  return `
    <div class="section" style="border-left-color: #dc3545;">
      <div class="section-title" style="color: #dc3545;">Pipeline Error</div>
      <p>There was an issue processing <strong>${payload.companyName || payload.meetingTitle || 'your analysis'}</strong>.</p>
      <p style="color: #666; font-size: 14px;">Error: ${errorMessage}</p>
    </div>

    <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/app/deals/${payload.dealId}" class="button">
      View Details
    </a>
  `;
}

/**
 * Get unread notifications for a user
 */
export async function getUnreadNotifications(userId: string): Promise<any[]> {
  try {
    const notifications = await prisma.notification.findMany({
      where: {
        userId,
        read: false,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return notifications.map(n => ({
      id: n.notificationId,
      type: n.type,
      title: n.title,
      message: n.message,
      dealId: n.dealId,
      meetingId: n.meetingId,
      metadata: n.metadata ? JSON.parse(n.metadata) : null,
      read: n.read,
      createdAt: n.createdAt,
    }));
  } catch (error) {
    logger.error('Failed to get notifications', error, { userId });
    return [];
  }
}

/**
 * Mark notifications as read
 */
export async function markNotificationsRead(userId: string, notificationIds?: string[]): Promise<void> {
  try {
    if (notificationIds && notificationIds.length > 0) {
      await prisma.notification.updateMany({
        where: {
          userId,
          notificationId: { in: notificationIds },
        },
        data: { read: true },
      });
    } else {
      // Mark all as read
      await prisma.notification.updateMany({
        where: { userId, read: false },
        data: { read: true },
      });
    }
  } catch (error) {
    logger.error('Failed to mark notifications as read', error, { userId });
  }
}

export const notificationService = {
  createNotification,
  sendEmailNotification,
  sendNotification,
  getUnreadNotifications,
  markNotificationsRead,
};
