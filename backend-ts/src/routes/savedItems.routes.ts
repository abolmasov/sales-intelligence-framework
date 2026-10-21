import { Router, Request, Response } from 'express';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { getPrismaClient } from '../config/database';

const router = Router();
const prisma = getPrismaClient();

type SaveableModelType =
  | 'transcriptAnalysis'
  | 'workspace'
  | 'atlassianAssessment'
  | 'rfpResearch'
  | 'proposalEvaluation'
  | 'discoverySession';

const MODEL_CONFIG: Record<SaveableModelType, { delegate: string; pkField: string }> = {
  transcriptAnalysis: { delegate: 'transcriptAnalysis', pkField: 'analysisId' },
  workspace: { delegate: 'workspace', pkField: 'workspaceId' },
  atlassianAssessment: { delegate: 'atlassianAssessment', pkField: 'id' },
  rfpResearch: { delegate: 'rfpResearch', pkField: 'researchId' },
  proposalEvaluation: { delegate: 'proposalEvaluation', pkField: 'id' },
  discoverySession: { delegate: 'discoverySession', pkField: 'sessionId' },
};

const EXPIRY_HOURS = 48;

/**
 * PATCH /api/saved-items/:modelType/:id
 * Set isSaved for any saveable model.
 * Body: { isSaved: boolean }
 */
router.patch(
  '/:modelType/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { modelType, id } = req.params;
    const { isSaved } = req.body;

    if (typeof isSaved !== 'boolean') {
      throw new AppError('isSaved must be a boolean', 400);
    }

    const config = MODEL_CONFIG[modelType as SaveableModelType];
    if (!config) {
      throw new AppError(`Invalid model type: ${modelType}`, 400);
    }

    const delegate = (prisma as any)[config.delegate];

    const existing = await delegate.findUnique({
      where: { [config.pkField]: id },
      select: { [config.pkField]: true },
    });

    if (!existing) {
      throw new AppError('Record not found', 404);
    }

    await delegate.update({
      where: { [config.pkField]: id },
      data: { isSaved },
    });

    res.json({
      success: true,
      data: { modelType, id, isSaved },
      message: isSaved ? 'Item saved permanently' : 'Item will auto-delete after 48 hours',
    });
  })
);

export default router;
