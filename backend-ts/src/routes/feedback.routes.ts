import { Router, Request, Response } from 'express';
import getPrismaClient from '../config/database';

const router = Router();

/**
 * @route POST /api/feedback
 * @desc Submit user feedback (like/dislike + optional comment)
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const prisma = getPrismaClient();
    const { eventId, rating, comment, category, referenceId, metadata } = req.body;

    // Validate rating
    if (!rating || !['like', 'dislike'].includes(rating)) {
      return res.status(400).json({
        success: false,
        error: 'rating is required and must be "like" or "dislike"',
      });
    }

    const userId = (req as any).user?.email || (req as any).user?.userId || req.body.userId;

    const feedback = await prisma.outputFeedback.create({
      data: {
        eventId: eventId || null,
        rating,
        comment: comment || null,
        userId: userId || null,
        category: category || null,
        referenceId: referenceId || null,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });

    return res.status(201).json({
      success: true,
      data: feedback,
    });
  } catch (error) {
    console.error('Failed to submit feedback:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to submit feedback',
    });
  }
});

/**
 * @route GET /api/feedback
 * @desc Get feedback entries with pagination and filters
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const prisma = getPrismaClient();

    const limit = parseInt(req.query.limit as string, 10) || 50;
    const offset = parseInt(req.query.offset as string, 10) || 0;
    const rating = req.query.rating as string | undefined;
    const category = req.query.category as string | undefined;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const where: any = {};

    if (rating && ['like', 'dislike'].includes(rating)) {
      where.rating = rating;
    }
    if (category) {
      where.category = category;
    }
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [feedbacks, total, likeCount, dislikeCount] = await Promise.all([
      prisma.outputFeedback.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.outputFeedback.count({ where }),
      prisma.outputFeedback.count({ where: { ...where, rating: 'like' } }),
      prisma.outputFeedback.count({ where: { ...where, rating: 'dislike' } }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        feedbacks,
        total,
        likeCount,
        dislikeCount,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('Failed to get feedback:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve feedback',
    });
  }
});

export default router;
