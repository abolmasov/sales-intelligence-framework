/**
 * Agent Routes — API endpoints for the Agent Hub.
 *
 * GET  /api/agents                   — List all agents with metadata + runtime status
 * POST /api/agents/:id/run           — Trigger an agent, returns jobId
 * GET  /api/agents/runs/:jobId/status — Poll agent run progress
 */

import { Router } from 'express';
import { randomUUID } from 'crypto';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { AGENT_METADATA, getAgentMetadata } from '../config/agentMetadata';
import { getPrismaClient } from '../config/database';
import { getLoggerService } from '../services/logger.service';
import { getResearchService } from '../services/research.service';
import {
  createBulkAnalysisJob,
  processBulkAnalysisJob,
  getBulkJobStatus,
} from '../services/bulkAnalysisJob.service';
import { processAnalysisWorkflowJob } from '../services/analysisWorkflowJob.service';
import { processWorkspacePipeline } from '../services/workspace.service';
import { getDiscoveryService } from '../services/discovery.service';

const router = Router();
const prisma = getPrismaClient();
const logger = getLoggerService();

// ---------------------------------------------------------------------------
// GET /api/agents — List all agents
// ---------------------------------------------------------------------------

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    // Fetch running job counts per agent type
    const runningJobs = await prisma.meetingAnalysisJob.groupBy({
      by: ['status'],
      where: { status: { in: ['queued', 'running'] } },
      _count: true,
    });
    const totalRunning = runningJobs.reduce((sum, g) => sum + g._count, 0);

    const agents = AGENT_METADATA.map((agent) => ({
      ...agent,
      status: 'available' as const,
      totalRuns: 0,
    }));

    res.json({
      success: true,
      data: {
        agents,
        summary: {
          total: agents.length,
          running: totalRunning,
        },
      },
    });
  })
);

// ---------------------------------------------------------------------------
// POST /api/agents/:id/run — Trigger an agent
// ---------------------------------------------------------------------------

router.post(
  '/:id/run',
  asyncHandler(async (req, res) => {
    const userId = req.user?.userId;
    if (!userId) throw new AppError('Missing authenticated user id', 401);

    const agentId = req.params.id;
    const agentMeta = getAgentMetadata(agentId);
    if (!agentMeta) throw new AppError(`Unknown agent: ${agentId}`, 404);

    const userEmail =
      (req.user as any)?.email ||
      (req.user as any)?.userPrincipalName ||
      null;
    const accessToken = req.user?.accessToken || null;

    const { dealId, accountId, meetingId, workspaceId, query } = req.body;

    let jobId: string;
    let jobType: string;

    switch (agentId) {
      // ── Transcript analysis (single meeting) ──
      case 'transcript-analysis': {
        if (!meetingId) throw new AppError('meetingId is required', 400);

        const meeting = await prisma.meeting.findUnique({ where: { meetingId } });
        if (!meeting) throw new AppError('Meeting not found', 404);
        if (!meeting.transcript) throw new AppError('This meeting has no transcript. Sync your calendar or upload a transcript first.', 400);

        const activeJob = await prisma.meetingAnalysisJob.findFirst({
          where: { meetingId, status: { in: ['queued', 'running'] } },
        });
        if (activeJob) throw new AppError('An analysis is already running for this meeting', 409);

        const job = await prisma.meetingAnalysisJob.create({
          data: {
            jobId: randomUUID(),
            meetingId,
            runTranscript: true,
            runProposal: false,
            runPpt: false,
            status: 'queued',
            transcriptStatus: 'pending',
            proposalStatus: 'skipped',
            pptStatus: 'skipped',
            requestedBy: userId,
            requestedByEmail: userEmail,
            sendEmailNotification: true,
          },
        });

        jobId = job.jobId;
        jobType = 'meeting-analysis';

        processAnalysisWorkflowJob(job.jobId, accessToken).catch((err) =>
          logger.error('Transcript analysis failed', err, { agentId, jobId: job.jobId })
        );
        break;
      }

      // ── Proposal generation (runs transcript → proposal pipeline) ──
      case 'proposal-generation': {
        if (!meetingId) throw new AppError('meetingId is required', 400);

        const meeting = await prisma.meeting.findUnique({ where: { meetingId } });
        if (!meeting) throw new AppError('Meeting not found', 404);
        if (!meeting.transcript) throw new AppError('This meeting has no transcript. A transcript is required to generate a proposal.', 400);

        const activeJob = await prisma.meetingAnalysisJob.findFirst({
          where: { meetingId, status: { in: ['queued', 'running'] } },
        });
        if (activeJob) throw new AppError('An analysis is already running for this meeting', 409);

        // Run transcript analysis first, then proposal
        const job = await prisma.meetingAnalysisJob.create({
          data: {
            jobId: randomUUID(),
            meetingId,
            runTranscript: true,
            runProposal: true,
            runPpt: false,
            status: 'queued',
            transcriptStatus: 'pending',
            proposalStatus: 'pending',
            pptStatus: 'skipped',
            requestedBy: userId,
            requestedByEmail: userEmail,
            sendEmailNotification: true,
          },
        });

        jobId = job.jobId;
        jobType = 'meeting-analysis';

        processAnalysisWorkflowJob(job.jobId, accessToken).catch((err) =>
          logger.error('Proposal generation failed', err, { agentId, jobId: job.jobId })
        );
        break;
      }

      // ── PPT generation (runs transcript → proposal → ppt pipeline) ──
      case 'pptx-generation': {
        if (!meetingId) throw new AppError('meetingId is required', 400);

        const meeting = await prisma.meeting.findUnique({ where: { meetingId } });
        if (!meeting) throw new AppError('Meeting not found', 404);
        if (!meeting.transcript) throw new AppError('This meeting has no transcript. A transcript is required to build a deck.', 400);

        const activeJob = await prisma.meetingAnalysisJob.findFirst({
          where: { meetingId, status: { in: ['queued', 'running'] } },
        });
        if (activeJob) throw new AppError('An analysis is already running for this meeting', 409);

        // Run full pipeline: transcript → proposal → ppt
        const job = await prisma.meetingAnalysisJob.create({
          data: {
            jobId: randomUUID(),
            meetingId,
            runTranscript: true,
            runProposal: true,
            runPpt: true,
            status: 'queued',
            transcriptStatus: 'pending',
            proposalStatus: 'pending',
            pptStatus: 'pending',
            requestedBy: userId,
            requestedByEmail: userEmail,
            sendEmailNotification: true,
          },
        });

        jobId = job.jobId;
        jobType = 'meeting-analysis';

        processAnalysisWorkflowJob(job.jobId, accessToken).catch((err) =>
          logger.error('Deck generation failed', err, { agentId, jobId: job.jobId })
        );
        break;
      }

      // ── Bulk analysis ──
      case 'bulk-analysis': {
        if (!dealId && !accountId) throw new AppError('dealId or accountId is required', 400);

        const result = await createBulkAnalysisJob({
          dealId: dealId || undefined,
          accountId: accountId || undefined,
          runTranscript: true,
          runProposal: false,
          runPpt: false,
          sendEmailNotification: true,
          requestedBy: userId,
          requestedByEmail: userEmail || undefined,
          accessToken,
        });

        jobId = result.bulkJobId;
        jobType = 'bulk-analysis';

        processBulkAnalysisJob(result.bulkJobId, accessToken).catch((err) =>
          logger.error('Bulk agent run failed', err, { agentId, bulkJobId: result.bulkJobId })
        );
        break;
      }

      // ── Pre-call research ──
      case 'pre-call-research': {
        if (!meetingId) throw new AppError('meetingId is required', 400);

        // Look up the meeting to get company name and attendees
        const meeting = await prisma.meeting.findUnique({
          where: { meetingId },
          include: { deal: { select: { dealId: true } }, account: { select: { accountId: true, name: true } } },
        });
        if (!meeting) throw new AppError('Meeting not found', 404);

        const companyName =
          (meeting as any).account?.name ||
          meeting.notes || // notes often stores company name
          meeting.title;
        if (!companyName) throw new AppError('Cannot determine company name from meeting. Please add account info.', 400);

        const researchService = getResearchService();
        const sessionId = randomUUID();

        researchService
          .runResearchPipeline(
            {
              companyName,
              meetingTitle: meeting.title || undefined,
              meetingId,
              dealId: (meeting as any).deal?.dealId || dealId || undefined,
              accessToken: accessToken || undefined,
            },
            sessionId,
            undefined,
            userEmail || userId
          )
          .catch((err) =>
            logger.error('Pre-call research failed', err, { agentId, sessionId })
          );

        jobId = sessionId;
        jobType = 'research';
        break;
      }

      // ── Workshop Analysis (workspace pipeline) ──
      case 'workshop-analysis': {
        if (!workspaceId) throw new AppError('workspaceId is required', 400);

        const workspace = await prisma.workspace.findUnique({ where: { workspaceId } });
        if (!workspace) throw new AppError('Workspace not found', 404);
        if (!workspace.transcriptText) throw new AppError('This workspace has no transcript or document content. Upload documents first.', 400);
        if (['analyzing', 'miro_generating', 'pptx_generating'].includes(workspace.status)) {
          throw new AppError('A pipeline is already running for this workspace', 409);
        }

        await prisma.workspace.update({
          where: { workspaceId },
          data: {
            status: 'analyzing',
            workspaceType: 'workshop_analysis',
            analysisStatus: 'pending',
            miroStatus: 'pending',
            pptxStatus: 'pending',
            errorMessage: null,
          },
        });

        jobId = workspaceId;
        jobType = 'workspace';

        processWorkspacePipeline(workspaceId, { runAnalysis: true, runMiro: true, runPptx: true }).catch((err) =>
          logger.error('Workshop analysis pipeline failed', err, { agentId, workspaceId })
        );
        break;
      }

      // ── User Story Generation (workspace pipeline) ──
      case 'user-story-generation': {
        if (!workspaceId) throw new AppError('workspaceId is required', 400);

        const workspace = await prisma.workspace.findUnique({ where: { workspaceId } });
        if (!workspace) throw new AppError('Workspace not found', 404);
        if (!workspace.transcriptText) throw new AppError('This workspace has no document content. Upload documents first.', 400);
        if (['analyzing', 'miro_generating', 'pptx_generating'].includes(workspace.status)) {
          throw new AppError('A pipeline is already running for this workspace', 409);
        }

        await prisma.workspace.update({
          where: { workspaceId },
          data: {
            status: 'analyzing',
            workspaceType: 'user_story_generation',
            analysisStatus: 'pending',
            miroStatus: 'pending',
            pptxStatus: 'pending',
            errorMessage: null,
          },
        });

        jobId = workspaceId;
        jobType = 'workspace';

        processWorkspacePipeline(workspaceId, { runAnalysis: true, runMiro: true, runPptx: true }).catch((err) =>
          logger.error('User story generation pipeline failed', err, { agentId, workspaceId })
        );
        break;
      }

      // ── Workshop Preparation (workspace pipeline with research) ──
      case 'workshop-prep': {
        if (!workspaceId) throw new AppError('workspaceId is required', 400);

        const workspace = await prisma.workspace.findUnique({ where: { workspaceId } });
        if (!workspace) throw new AppError('Workspace not found', 404);
        if (!workspace.transcriptText) throw new AppError('This workspace has no survey content. Upload survey documents first.', 400);
        if (!workspace.clientName) throw new AppError('Company name is required for workshop prep. Update the workspace with a company name.', 400);
        if (['analyzing', 'miro_generating', 'pptx_generating'].includes(workspace.status)) {
          throw new AppError('A pipeline is already running for this workspace', 409);
        }

        await prisma.workspace.update({
          where: { workspaceId },
          data: {
            status: 'analyzing',
            workspaceType: 'workshop_prep',
            analysisStatus: 'pending',
            miroStatus: 'pending',
            pptxStatus: 'pending',
            errorMessage: null,
          },
        });

        jobId = workspaceId;
        jobType = 'workspace';

        processWorkspacePipeline(workspaceId, { runAnalysis: true, runMiro: true, runPptx: true }).catch((err) =>
          logger.error('Workshop prep pipeline failed', err, { agentId, workspaceId })
        );
        break;
      }

      // ── Lead Discovery ──
      case 'discovery': {
        if (!query) throw new AppError('Search criteria (query) is required', 400);

        const discoveryService = getDiscoveryService();
        const sessionId = randomUUID();

        // Create a discovery session
        await prisma.discoverySession.create({
          data: {
            sessionId,
            requestedBy: userEmail || userId,
            title: query.substring(0, 100),
            messages: JSON.stringify([{ role: 'user', content: query }]),
          },
        });

        jobId = sessionId;
        jobType = 'discovery';

        // Fire-and-forget: run the initial discovery chat
        (async () => {
          try {
            const response = await discoveryService.chat({
              message: query,
              history: [],
              accessToken: accessToken || undefined,
            });
            const messages = [
              { role: 'user', content: query },
              { role: 'assistant', content: response.response || JSON.stringify(response) },
            ];
            await prisma.discoverySession.update({
              where: { sessionId },
              data: { messages: JSON.stringify(messages) },
            });
          } catch (err) {
            logger.error('Discovery agent failed', err as Error, { agentId, sessionId });
            const errMessages = [
              { role: 'user', content: query },
              { role: 'assistant', content: 'Sorry, an error occurred during discovery. Please try again.' },
            ];
            await prisma.discoverySession.update({
              where: { sessionId },
              data: { messages: JSON.stringify(errMessages) },
            });
          }
        })();
        break;
      }

      default: {
        throw new AppError(`Agent "${agentId}" is not yet implemented`, 501);
      }
    }

    res.json({
      success: true,
      data: {
        jobId,
        agentId,
        agentName: agentMeta.name,
        jobType,
        status: 'queued',
      },
    });
  })
);

// ---------------------------------------------------------------------------
// GET /api/agents/runs/:jobId/status — Poll run status
// ---------------------------------------------------------------------------

router.get(
  '/runs/:jobId/status',
  asyncHandler(async (req, res) => {
    const { jobId } = req.params;

    // Try meeting analysis job first
    const meetingJob = await prisma.meetingAnalysisJob.findUnique({
      where: { jobId },
      include: { meeting: { select: { title: true } } },
    });

    if (meetingJob) {
      res.json({
        success: true,
        data: {
          jobId: meetingJob.jobId,
          jobType: 'meeting-analysis',
          status: meetingJob.status,
          meetingTitle: meetingJob.meeting?.title || 'Untitled Meeting',
          transcriptStatus: meetingJob.transcriptStatus,
          proposalStatus: meetingJob.proposalStatus,
          pptStatus: meetingJob.pptStatus,
          errorMessage: meetingJob.errorMessage,
          createdAt: meetingJob.createdAt,
          completedAt: meetingJob.completedAt,
        },
      });
      return;
    }

    // Try bulk analysis job
    const bulkStatus = await getBulkJobStatus(jobId);
    if (bulkStatus) {
      res.json({
        success: true,
        data: {
          jobId,
          jobType: 'bulk-analysis',
          ...bulkStatus,
        },
      });
      return;
    }

    // Try research session
    const researchSession = await prisma.analysis.findFirst({
      where: { sessionId: jobId },
      select: { sessionId: true, status: true, currentStep: true, companyName: true },
    });

    if (researchSession) {
      const status = researchSession.status === 'completed' ? 'completed'
        : researchSession.status === 'error' ? 'failed'
        : 'running';
      res.json({
        success: true,
        data: {
          jobId,
          jobType: 'research',
          status,
          message: researchSession.currentStep || `Researching ${researchSession.companyName || ''}...`,
          companyName: researchSession.companyName,
        },
      });
      return;
    }

    // Try workspace pipeline
    const workspace = await prisma.workspace.findUnique({
      where: { workspaceId: jobId },
      select: {
        workspaceId: true,
        name: true,
        status: true,
        analysisStatus: true,
        miroStatus: true,
        pptxStatus: true,
        errorMessage: true,
        createdAt: true,
        completedAt: true,
        workspaceType: true,
      },
    });

    if (workspace) {
      const status = workspace.status === 'completed' ? 'completed'
        : workspace.status === 'error' ? 'failed'
        : workspace.status === 'cancelled' ? 'cancelled'
        : 'running';
      res.json({
        success: true,
        data: {
          jobId,
          jobType: 'workspace',
          status,
          workspaceName: workspace.name,
          workspaceType: workspace.workspaceType,
          analysisStatus: workspace.analysisStatus,
          miroStatus: workspace.miroStatus,
          pptxStatus: workspace.pptxStatus,
          errorMessage: workspace.errorMessage,
          createdAt: workspace.createdAt,
          completedAt: workspace.completedAt,
        },
      });
      return;
    }

    // Try discovery session
    const discoverySession = await prisma.discoverySession.findUnique({
      where: { sessionId: jobId },
      select: { sessionId: true, messages: true },
    });

    if (discoverySession) {
      const messages = discoverySession.messages
        ? (typeof discoverySession.messages === 'string' ? JSON.parse(discoverySession.messages) : discoverySession.messages as any[])
        : [];
      const hasResponse = Array.isArray(messages) && messages.some((m: any) => m.role === 'assistant');
      const status = hasResponse ? 'completed' : 'running';
      res.json({
        success: true,
        data: {
          jobId,
          jobType: 'discovery',
          status,
          message: hasResponse ? 'Discovery complete' : 'Searching and qualifying leads...',
        },
      });
      return;
    }

    throw new AppError('Job not found', 404);
  })
);

export default router;
