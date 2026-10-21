import { Router, Request, Response } from 'express';
import { getPrismaClient } from '../config/database';
import { getOpenAIService } from '../services/openai.service';
import { getEnhancedTranscriptAnalysisService } from '../services/enhanced-transcript-analysis.service';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { ApiResponse, TranscriptAnalysisRequest } from '../types';
import { randomUUID } from 'crypto';
import { updatePursuitBriefFromTranscript } from '../services/pursuitBrief.service';
import { syncOpportunitiesFromAnalysis } from '../services/opportunity-sync.service';
import { scheduleTranscriptJobProcessing } from '../services/transcriptJob.service';
import { MeetingService } from '../services/meeting.service';
import { getAccessibleMeetingIdsForUser, userHasCalendarMeetingAccess, userMatchesRequestedBy } from '../utils/meetingAccess';

import pdfParse from '@cedrugs/pdf-parse';
import multer from 'multer';
import { encryptTranscript } from '../utils/transcriptCrypto';
const mammoth = require('mammoth');
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const router = Router();
const prisma = getPrismaClient();
const openai = getOpenAIService();
const enhancedAnalysisService = getEnhancedTranscriptAnalysisService();

type TranscriptStatus = 'processing' | 'completed' | 'error';
type TranscriptAnalysisRequestBody = TranscriptAnalysisRequest & {
  account_id?: string;
  meeting_id?: string;
  meeting_context?: string;
  runProposal?: boolean | string;
  run_proposal?: boolean | string;
  runPpt?: boolean | string;
  run_ppt?: boolean | string;
};

const coerceBoolean = (value: any): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
  }
  return false;
};

/**
 * POST /api/transcripts/analyze
 * Analyze a meeting transcript and capture insights/case studies
 */
router.post(
  '/analyze',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Missing authenticated user id', 401);
    }
    const request: TranscriptAnalysisRequest = req.body;

    if (!request.transcriptText) {
      throw new AppError('Transcript text is required', 400);
    }

    if (request.meetingId) {
      const existingMeeting = await MeetingService.findByIdentifiers({
        meetingId: request.meetingId,
        calendarEventId: request.meetingId,
        onlineMeetingId: request.meetingId,
        icalUid: request.meetingId,
      });
      const canAnalyzeDirect = await userHasCalendarMeetingAccess(userId, {
        meetingId: request.meetingId,
        calendarEventId: request.meetingId,
        onlineMeetingId: request.meetingId,
        icalUid: request.meetingId,
      });
      const canAnalyzeViaMeeting = existingMeeting
        ? await userHasCalendarMeetingAccess(userId, {
            meetingId: existingMeeting.meetingId,
            calendarEventId: existingMeeting.calendarEventId,
            onlineMeetingId: existingMeeting.onlineMeetingId,
            icalUid: existingMeeting.icalUid,
          })
        : false;

      const canAnalyze = canAnalyzeDirect || canAnalyzeViaMeeting;
      if (!canAnalyze) {
        throw new AppError('You do not have access to this meeting. Sync your Outlook/Teams calendar and try again.', 403);
      }
    }

    if (!request.accountId && request.dealId) {
      const linkedDeal = await prisma.deal.findUnique({
        where: { dealId: request.dealId },
        select: { accountId: true },
      });
      if (linkedDeal?.accountId) {
        request.accountId = linkedDeal.accountId;
      }
    }

    // Analyze transcript with OpenAI
    const analysis = await openai.analyzeTranscript(request.transcriptText);

    // Case study lookup disabled
    const relevantCaseStudies: any[] = [];

    // Enhance analysis with case study recommendations
    const enhancedAnalysis = {
      ...analysis,
      relevantCaseStudies,
      caseStudyCount: relevantCaseStudies.length,
    };

    // Save analysis to database
    const transcriptAnalysis = await prisma.transcriptAnalysis.create({
      data: {
        analysisId: randomUUID(),
        dealId: request.dealId,
        meetingId: request.meetingId,
        accountId: request.accountId || null,
        companyName: request.companyName,
        meetingTitle: request.meetingTitle,
        transcriptText: encryptTranscript(request.transcriptText),
        transcriptExcerpt: null,
        analysisResult: JSON.stringify(enhancedAnalysis),
        opportunityScore: analysis.opportunityScore,
        sentimentOverall: analysis.sentiment,
        sentimentShort: analysis.sentiment || null,
        successProbability: analysis.successProbability,
        analyzedAt: new Date(),
        status: 'completed',
        errorMessage: null,
        requestedBy: req.user?.email || userId,
      },
    });

    await syncOpportunitiesFromAnalysis({
      analysisId: transcriptAnalysis.analysisId,
      rawAnalysis: enhancedAnalysis,
      dealId: request.dealId,
      meetingId: request.meetingId,
    });

    // Update pursuit brief if this is linked to a deal
    if (request.dealId) {
      await updatePursuitBriefFromTranscript(request.dealId, transcriptAnalysis.analysisId);
    }

    const response: ApiResponse = {
      success: true,
      data: {
        analysisId: transcriptAnalysis.analysisId,
        analysis: enhancedAnalysis,
      },
      message: 'Transcript analyzed successfully with case study recommendations',
    };

    res.json(response);
  })
);

/**
 * POST /api/transcripts/analyze-enhanced
 * Enhanced transcript analysis integrating ML model and OpenAI
 */
router.post(
  '/extract-text',
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) {
      throw new AppError('File is required', 400);
    }

    let text = '';
    if (file.mimetype === 'application/pdf') {
      const parsed = await pdfParse(file.buffer);
      text = parsed.text || '';
    } else if (
      file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      const parsed = await mammoth.extractRawText({ buffer: file.buffer });
      text = parsed.value || '';
    } else if (file.mimetype.startsWith('text/')) {
      text = file.buffer.toString('utf-8');
    } else {
      throw new AppError('Unsupported file type. Please upload PDF, DOCX, or TXT.', 400);
    }

    if (!text.trim()) {
      throw new AppError('Unable to extract text from file. Try another file.', 400);
    }

    res.json({
      success: true,
      data: {
        text: text.trim(),
      },
    });
  })
);

router.post(
  '/analyze-enhanced',
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Missing authenticated user id', 401);
    }
    const body = req.body as TranscriptAnalysisRequestBody;
    const bearerToken = req.user?.accessToken ?? undefined;
    const requestedBy =
      (req.user as any)?.email ||
      (req.user as any)?.userPrincipalName ||
      (req.user as any)?.preferred_username ||
      null;
    const runProposalRequested = coerceBoolean(body.runProposal ?? body.run_proposal);
    const runPptRequested = coerceBoolean(body.runPpt ?? body.run_ppt);
    const shouldAutoRunProposal = runProposalRequested || runPptRequested;
    const shouldAutoRunPpt = runPptRequested;

    let transcript = '';
    const file = req.file;

    if (file) {
      const buffer = file.buffer;
      const fileType = file.mimetype;

      if (fileType === 'application/pdf') {
        const result = await pdfParse(buffer);
        transcript = result.text || '';
      } else if (
        fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ) {
        const result = await mammoth.extractRawText({ buffer });
        transcript = result.value || '';
      }
    } else if (body.transcriptText) {
      transcript = body.transcriptText;
    }

    if (!transcript || !transcript.trim()) {
      throw new AppError('Transcript text is required', 400);
    }

    const normalizedDealId =
      typeof body.dealId === 'string' ? body.dealId.trim() : undefined;
    const analysisId = randomUUID();
    const requestPayload: TranscriptAnalysisRequest = {
      transcriptText: transcript,
      dealId: normalizedDealId,
      accountId: body.accountId ?? body.account_id,
      companyName: body.companyName,
      meetingTitle: body.meetingTitle,
      meetingId: body.meetingId ?? body.meeting_id,
      meetingContext: body.meetingContext ?? body.meeting_context,
    };

    if (!requestPayload.meetingContext || !String(requestPayload.meetingContext).trim()) {
      throw new AppError('Meeting context is required.', 400);
    }

    if (requestPayload.meetingId) {
      const existingMeeting = await MeetingService.findByIdentifiers({
        meetingId: requestPayload.meetingId,
        calendarEventId: requestPayload.meetingId,
        onlineMeetingId: requestPayload.meetingId,
        icalUid: requestPayload.meetingId,
      });
      const canAnalyzeDirect = await userHasCalendarMeetingAccess(userId, {
        meetingId: requestPayload.meetingId,
        calendarEventId: requestPayload.meetingId,
        onlineMeetingId: requestPayload.meetingId,
        icalUid: requestPayload.meetingId,
      });
      const canAnalyzeViaMeeting = existingMeeting
        ? await userHasCalendarMeetingAccess(userId, {
            meetingId: existingMeeting.meetingId,
            calendarEventId: existingMeeting.calendarEventId,
            onlineMeetingId: existingMeeting.onlineMeetingId,
            icalUid: existingMeeting.icalUid,
          })
        : false;
      const canAnalyze = canAnalyzeDirect || canAnalyzeViaMeeting;
      if (!canAnalyze) {
        throw new AppError('You do not have access to this meeting. Sync your Outlook/Teams calendar and try again.', 403);
      }
    }

    if (!requestPayload.dealId) {
      throw new AppError('Deal ID is required to store transcript analysis.', 400);
    }

    const linkedDeal = await prisma.deal.findUnique({
      where: { dealId: requestPayload.dealId },
      select: { accountId: true, dealId: true },
    });
    if (!linkedDeal) {
      throw new AppError('Deal not found', 404);
    }

    if (!requestPayload.accountId && linkedDeal.accountId) {
      requestPayload.accountId = linkedDeal.accountId;
    }

    // Resolve the meeting ID to its canonical form stored in the Meeting table
    // This handles hex/base64 format mismatches for iCal UIDs
    let canonicalMeetingId = requestPayload.meetingId;
    if (requestPayload.meetingId) {
      const existingMeeting = await MeetingService.findByIdentifiers({
        meetingId: requestPayload.meetingId,
        calendarEventId: requestPayload.meetingId,
        onlineMeetingId: requestPayload.meetingId,
        icalUid: requestPayload.meetingId,
      });
      if (existingMeeting) {
        canonicalMeetingId = existingMeeting.meetingId;
        console.log(`📋 Resolved meetingId ${requestPayload.meetingId} → canonical ${canonicalMeetingId}`);
      }
    }

    console.log('📝 Storing enhanced transcript analysis payload:', {
      analysisId,
      dealId: requestPayload.dealId,
      companyName: requestPayload.companyName,
      meetingTitle: requestPayload.meetingTitle,
      transcriptLength: transcript.length,
    });

    await prisma.transcriptAnalysis.create({
      data: {
        analysisId,
        dealId: requestPayload.dealId,
        meetingId: canonicalMeetingId,
        accountId: requestPayload.accountId || null,
        companyName: requestPayload.companyName,
        meetingTitle: requestPayload.meetingTitle,
        transcriptText: encryptTranscript(transcript),
        transcriptExcerpt: null,
        analysisResult: JSON.stringify({ status: 'queued', metadata: { meetingContext: requestPayload.meetingContext } }),
        opportunityScore: null,
        sentimentOverall: null,
        successProbability: null,
        analyzedAt: new Date(),
        status: 'queued',
        errorMessage: null,
        autoProposalRequested: shouldAutoRunProposal,
        autoPptRequested: shouldAutoRunPpt,
        requestedBy,
      },
    });

    await scheduleTranscriptJobProcessing(analysisId, bearerToken || null, {
      awaitCompletion: false,
    });

    const response: ApiResponse = {
      success: true,
      data: {
        analysisId,
        status: 'queued' as TranscriptStatus,
      },
      message:
        'Transcript analysis queued. We will process it in the background and update the status when complete.',
    };

    res.json(response);
  })
);

/**
 * GET /api/transcripts/:analysisId
 * Get a specific transcript analysis
 */
router.get(
  '/:analysisId',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Missing authenticated user id', 401);
    }
    const { analysisId } = req.params;

    const analysis = await prisma.transcriptAnalysis.findUnique({
      where: { analysisId },
      include: {
        deal: true,
      },
    });

    if (!analysis) {
      throw new AppError('Transcript analysis not found', 404);
    }

    if (analysis.meetingId) {
      const meetingRecord = await prisma.meeting.findUnique({
        where: { meetingId: analysis.meetingId },
        select: {
          meetingId: true,
          calendarEventId: true,
          onlineMeetingId: true,
          icalUid: true,
        },
      });
      const canView = meetingRecord
        ? await userHasCalendarMeetingAccess(userId, {
            meetingId: meetingRecord.meetingId,
            calendarEventId: meetingRecord.calendarEventId,
            onlineMeetingId: meetingRecord.onlineMeetingId,
            icalUid: meetingRecord.icalUid,
          })
        : false;
      if (!canView) {
        throw new AppError('You do not have access to this meeting analysis.', 403);
      }
    } else if (!userMatchesRequestedBy(req.user, analysis.requestedBy)) {
      throw new AppError('You do not have access to this analysis.', 403);
    }

    // Explicitly exclude transcriptText — never send raw transcript back to client
    const { transcriptText: _omitText, transcriptExcerpt: _omitExcerpt, ...safeAnalysis } = analysis as any;
    const response: ApiResponse = {
      success: true,
      data: {
        ...safeAnalysis,
        accountId: analysis.accountId,
        transcriptLength: (analysis as any).transcriptText?.length ?? 0,
        sentiment: analysis.sentimentShort || analysis.sentimentOverall || null,
        analysisResult: analysis.analysisResult ? JSON.parse(analysis.analysisResult) : null,
        isSaved: analysis.isSaved,
        expiresAt: analysis.isSaved ? null : new Date(analysis.createdAt.getTime() + 48 * 60 * 60 * 1000).toISOString(),
      },
    };

    res.json(response);
  })
);

/**
 * POST /api/transcripts/:analysisId/cancel
 * Cancel a queued/processing transcript analysis
 */
router.post(
  '/:analysisId/cancel',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Missing authenticated user id', 401);
    }

    const { analysisId } = req.params;
    if (!analysisId) {
      throw new AppError('Missing analysisId', 400);
    }

    const analysis = await prisma.transcriptAnalysis.findUnique({
      where: { analysisId },
      select: { analysisId: true, meetingId: true, requestedBy: true, status: true, proposalJobId: true, pptJobId: true },
    });
    if (!analysis) {
      throw new AppError('Transcript analysis not found', 404);
    }

    if (analysis.meetingId) {
      const meetingRecord = await prisma.meeting.findUnique({
        where: { meetingId: analysis.meetingId },
        select: {
          meetingId: true,
          calendarEventId: true,
          onlineMeetingId: true,
          icalUid: true,
        },
      });
      const canCancel = meetingRecord
        ? await userHasCalendarMeetingAccess(userId, {
            meetingId: meetingRecord.meetingId,
            calendarEventId: meetingRecord.calendarEventId,
            onlineMeetingId: meetingRecord.onlineMeetingId,
            icalUid: meetingRecord.icalUid,
          })
        : false;
      if (!canCancel) {
        throw new AppError('You do not have access to this meeting analysis.', 403);
      }
    } else if (!userMatchesRequestedBy(req.user, analysis.requestedBy)) {
      throw new AppError('You do not have access to this analysis.', 403);
    }

    const normalizedStatus = (analysis.status || '').toLowerCase();
    const cancellable = ['queued', 'processing'].includes(normalizedStatus);
    if (!cancellable) {
      res.json({
        success: false,
        message: 'Transcript analysis is not running',
        data: { analysisId, cancelled: false },
      });
      return;
    }

    await prisma.transcriptAnalysis.update({
      where: { analysisId },
      data: {
        status: 'cancelled',
        errorMessage: 'Cancelled by user',
        analysisResult: JSON.stringify({ status: 'cancelled', error: 'Cancelled by user' }),
      },
    });

    if (analysis.proposalJobId) {
      await prisma.proposalJob.updateMany({
        where: { jobId: analysis.proposalJobId, status: { in: ['queued', 'processing'] } },
        data: { status: 'cancelled', errorMessage: 'Cancelled by user', completedAt: new Date() },
      });
    }
    if (analysis.pptJobId) {
      await prisma.pptxJob.updateMany({
        where: { jobId: analysis.pptJobId, status: { in: ['queued', 'processing'] } },
        data: { status: 'cancelled', errorMessage: 'Cancelled by user', completedAt: new Date() },
      });
    }

    res.json({
      success: true,
      message: 'Transcript analysis cancelled',
      data: { analysisId, cancelled: true },
    });
  })
);

/**
 * GET /api/transcripts/deal/:dealId
 * Get all transcript analyses for a specific deal
 */
router.get(
  '/deal/:dealId',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Missing authenticated user id', 401);
    }
    const { dealId } = req.params;

    const analyses = await prisma.transcriptAnalysis.findMany({
      where: { dealId },
      orderBy: { analyzedAt: 'desc' },
    });

    const meetingIds = analyses
      .map((analysis) => analysis.meetingId)
      .filter((id): id is string => Boolean(id));
    const accessibleMeetingIds = await getAccessibleMeetingIdsForUser(userId, meetingIds);

    const filtered = analyses.filter((analysis) => {
      if (analysis.meetingId) {
        return accessibleMeetingIds.has(analysis.meetingId);
      }
      return userMatchesRequestedBy(req.user, analysis.requestedBy);
    });

    const response: ApiResponse = {
      success: true,
      data: filtered.map((analysis: any) => {
        const { transcriptText: _t, transcriptExcerpt: _e, ...safe } = analysis;
        return {
          ...safe,
          accountId: analysis.accountId,
          transcriptLength: analysis.transcriptText?.length ?? 0,
          analysisResult: analysis.analysisResult ? JSON.parse(analysis.analysisResult) : null,
        };
      }),
    };

    res.json(response);
  })
);

/**
 * GET /api/transcripts
 * List all transcript analyses with optional filters
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Missing authenticated user id', 401);
    }
    const { dealId, companyName } = req.query;

    const filters: any = {};
    if (dealId) filters.dealId = dealId as string;
    if (companyName) filters.companyName = { contains: companyName as string };

    const analyses = await prisma.transcriptAnalysis.findMany({
      where: filters,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const meetingIds = analyses
      .map((analysis) => analysis.meetingId)
      .filter((id): id is string => Boolean(id));
    const accessibleMeetingIds = await getAccessibleMeetingIdsForUser(userId, meetingIds);

    const visible = analyses
      .filter((analysis) => {
        if (analysis.meetingId) {
          return accessibleMeetingIds.has(analysis.meetingId);
        }
        return userMatchesRequestedBy(req.user, analysis.requestedBy);
      })
      .slice(0, 50);

    const response: ApiResponse = {
      success: true,
      data: visible.map((analysis: any) => ({
        analysisId: analysis.analysisId,
        dealId: analysis.dealId,
        accountId: analysis.accountId,
        companyName: analysis.companyName,
        meetingTitle: analysis.meetingTitle,
        opportunityScore: analysis.opportunityScore,
        sentimentOverall: analysis.sentimentOverall,
        sentiment: analysis.sentimentShort,
        successProbability: analysis.successProbability,
        analyzedAt: analysis.analyzedAt,
        createdAt: analysis.createdAt,
        status: analysis.status as TranscriptStatus,
        errorMessage: analysis.errorMessage,
        isSaved: analysis.isSaved,
        expiresAt: analysis.isSaved ? null : new Date(analysis.createdAt.getTime() + 48 * 60 * 60 * 1000).toISOString(),
      })),
    };

    res.json(response);
  })
);

/**
 * PATCH /api/transcripts/:analysisId
 * Update/edit the transcript analysis result (for editable outputs feature)
 */
router.patch(
  '/:analysisId',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Missing authenticated user id', 401);
    }

    const { analysisId } = req.params;
    const { editedAnalysisResult } = req.body;

    if (!editedAnalysisResult) {
      throw new AppError('editedAnalysisResult is required', 400);
    }

    // Check if analysis exists
    const analysis = await prisma.transcriptAnalysis.findUnique({
      where: { analysisId },
    });

    if (!analysis) {
      throw new AppError('Transcript analysis not found', 404);
    }

    if (analysis.meetingId) {
      const meetingRecord = await prisma.meeting.findUnique({
        where: { meetingId: analysis.meetingId },
        select: {
          meetingId: true,
          calendarEventId: true,
          onlineMeetingId: true,
          icalUid: true,
        },
      });
      const canEdit = meetingRecord
        ? await userHasCalendarMeetingAccess(userId, {
            meetingId: meetingRecord.meetingId,
            calendarEventId: meetingRecord.calendarEventId,
            onlineMeetingId: meetingRecord.onlineMeetingId,
            icalUid: meetingRecord.icalUid,
          })
        : false;
      if (!canEdit) {
        throw new AppError('You do not have access to edit this analysis.', 403);
      }
    } else if (!userMatchesRequestedBy(req.user, analysis.requestedBy)) {
      throw new AppError('You do not have access to edit this analysis.', 403);
    }

    // Update the edited analysis result
    await prisma.transcriptAnalysis.update({
      where: { analysisId },
      data: {
        editedAnalysisResult: typeof editedAnalysisResult === 'string'
          ? editedAnalysisResult
          : JSON.stringify(editedAnalysisResult),
        lastEditedAt: new Date(),
      },
    });

    const response: ApiResponse = {
      success: true,
      message: 'Transcript analysis updated successfully',
      data: { analysisId, lastEditedAt: new Date().toISOString() },
    };

    res.json(response);
  })
);

/**
 * PATCH /api/transcripts/:analysisId/title
 * Update the title of a transcript analysis
 */
router.patch(
  '/:analysisId/title',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Missing authenticated user id', 401);
    }
    const { analysisId } = req.params;
    const { meetingTitle } = req.body;

    if (!meetingTitle || !meetingTitle.trim()) {
      throw new AppError('Meeting title is required', 400);
    }

    // Check if analysis exists
    const analysis = await prisma.transcriptAnalysis.findUnique({
      where: { analysisId },
    });

    if (!analysis) {
      throw new AppError('Transcript analysis not found', 404);
    }

    if (analysis.meetingId) {
      const meetingRecord = await prisma.meeting.findUnique({
        where: { meetingId: analysis.meetingId },
        select: {
          meetingId: true,
          calendarEventId: true,
          onlineMeetingId: true,
          icalUid: true,
        },
      });
      const canEdit = meetingRecord
        ? await userHasCalendarMeetingAccess(userId, {
            meetingId: meetingRecord.meetingId,
            calendarEventId: meetingRecord.calendarEventId,
            onlineMeetingId: meetingRecord.onlineMeetingId,
            icalUid: meetingRecord.icalUid,
          })
        : false;
      if (!canEdit) {
        throw new AppError('You do not have access to this meeting analysis.', 403);
      }
    } else if (!userMatchesRequestedBy(req.user, analysis.requestedBy)) {
      throw new AppError('You do not have access to this analysis.', 403);
    }

    // Update transcript analysis title
    await prisma.transcriptAnalysis.update({
      where: { analysisId },
      data: { meetingTitle: meetingTitle.trim() },
    });

    const response: ApiResponse = {
      success: true,
      message: 'Transcript title updated successfully',
      data: { analysisId, meetingTitle: meetingTitle.trim() },
    };

    res.json(response);
  })
);

/**
 * PATCH /api/transcripts/:analysisId/link-deal
 * Link a transcript analysis to a deal
 */
router.patch(
  '/:analysisId/link-deal',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Missing authenticated user id', 401);
    }
    const { analysisId } = req.params;
    const { dealId } = req.body;

    if (!dealId) {
      throw new AppError('Deal ID is required', 400);
    }

    // Check if analysis exists
    const analysis = await prisma.transcriptAnalysis.findUnique({
      where: { analysisId },
    });

    if (!analysis) {
      throw new AppError('Transcript analysis not found', 404);
    }

    if (analysis.meetingId) {
      const meetingRecord = await prisma.meeting.findUnique({
        where: { meetingId: analysis.meetingId },
        select: {
          meetingId: true,
          calendarEventId: true,
          onlineMeetingId: true,
          icalUid: true,
        },
      });
      const canEdit = meetingRecord
        ? await userHasCalendarMeetingAccess(userId, {
            meetingId: meetingRecord.meetingId,
            calendarEventId: meetingRecord.calendarEventId,
            onlineMeetingId: meetingRecord.onlineMeetingId,
            icalUid: meetingRecord.icalUid,
          })
        : false;
      if (!canEdit) {
        throw new AppError('You do not have access to this meeting analysis.', 403);
      }
    } else if (!userMatchesRequestedBy(req.user, analysis.requestedBy)) {
      throw new AppError('You do not have access to this analysis.', 403);
    }

    // Check if deal exists
    const deal = await prisma.deal.findUnique({
      where: { dealId },
    });

    if (!deal) {
      throw new AppError('Deal not found', 404);
    }

    // Update transcript analysis with dealId
    await prisma.transcriptAnalysis.update({
      where: { analysisId },
      data: {
        dealId,
        accountId: deal.accountId || null,
      },
    });

    await updatePursuitBriefFromTranscript(dealId, analysisId);

    const response: ApiResponse = {
      success: true,
      message: 'Transcript analysis linked to deal successfully',
      data: { analysisId, dealId },
    };

    res.json(response);
  })
);

/**
 * DELETE /api/transcripts/:analysisId
 * Delete a transcript analysis
 */
router.delete(
  '/:analysisId',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Missing authenticated user id', 401);
    }
    const { analysisId } = req.params;

    // Check if analysis exists
    const analysis = await prisma.transcriptAnalysis.findUnique({
      where: { analysisId },
    });

    if (!analysis) {
      throw new AppError('Transcript analysis not found', 404);
    }

    if (analysis.meetingId) {
      const meetingRecord = await prisma.meeting.findUnique({
        where: { meetingId: analysis.meetingId },
        select: {
          meetingId: true,
          calendarEventId: true,
          onlineMeetingId: true,
          icalUid: true,
        },
      });
      const canDelete = meetingRecord
        ? await userHasCalendarMeetingAccess(userId, {
            meetingId: meetingRecord.meetingId,
            calendarEventId: meetingRecord.calendarEventId,
            onlineMeetingId: meetingRecord.onlineMeetingId,
            icalUid: meetingRecord.icalUid,
          })
        : false;
      if (!canDelete) {
        throw new AppError('You do not have access to this meeting analysis.', 403);
      }
    } else if (!userMatchesRequestedBy(req.user, analysis.requestedBy)) {
      throw new AppError('You do not have access to this analysis.', 403);
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.transcriptAnalysis.delete({
        where: { analysisId },
      });

      await tx.meetingAnalysisJob.updateMany({
        where: { transcriptAnalysisId: analysisId },
        data: {
          transcriptAnalysisId: null,
          status: 'queued',
          transcriptStatus: 'pending',
          proposalStatus: 'pending',
          pptStatus: 'pending',
          errorMessage: null,
          completedAt: null,
        },
      });
    });

    const response: ApiResponse = {
      success: true,
      message: 'Transcript analysis deleted successfully',
      data: { analysisId },
    };

    res.json(response);
  })
);

/**
 * GET /api/transcripts/:analysisId/export-excel
 * Export transcript analysis as Excel workbook
 */
router.get(
  '/:analysisId/export-excel',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Missing authenticated user id', 401);
    }
    const { analysisId } = req.params;

    const analysis = await prisma.transcriptAnalysis.findUnique({
      where: { analysisId },
    });

    if (!analysis) {
      throw new AppError('Transcript analysis not found', 404);
    }

    if (analysis.meetingId) {
      const meetingRecord = await prisma.meeting.findUnique({
        where: { meetingId: analysis.meetingId },
        select: {
          meetingId: true,
          calendarEventId: true,
          onlineMeetingId: true,
          icalUid: true,
        },
      });
      const canView = meetingRecord
        ? await userHasCalendarMeetingAccess(userId, {
            meetingId: meetingRecord.meetingId,
            calendarEventId: meetingRecord.calendarEventId,
            onlineMeetingId: meetingRecord.onlineMeetingId,
            icalUid: meetingRecord.icalUid,
          })
        : false;
      if (!canView) {
        throw new AppError('You do not have access to this meeting analysis.', 403);
      }
    } else if (!userMatchesRequestedBy(req.user, analysis.requestedBy)) {
      throw new AppError('You do not have access to this analysis.', 403);
    }

    if (!analysis.analysisResult) {
      throw new AppError('Analysis not yet complete', 400);
    }

    let parsed: any;
    try {
      parsed = JSON.parse(analysis.analysisResult);
    } catch {
      throw new AppError('Could not parse analysis result', 500);
    }

    const excelBuffer = enhancedAnalysisService.generateExcel(parsed);

    const safeTitle = (analysis.meetingTitle || analysis.companyName || 'transcript')
      .replace(/[^a-z0-9_\- ]/gi, '_')
      .substring(0, 60);
    const filename = `${safeTitle}_analysis.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(excelBuffer);
  })
);

export default router;
