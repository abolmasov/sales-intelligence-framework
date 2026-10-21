/**
 * Notification Routes
 * API endpoints for managing user notifications
 */

import { Router, Request, Response } from 'express';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { notificationService } from '../services/notification.service';

const router = Router();

/**
 * GET /api/notifications
 * Get notifications for the current user
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Authentication required', 401);
    }

    const notifications = await notificationService.getUnreadNotifications(userId);

    res.json({
      success: true,
      data: notifications,
    });
  })
);

/**
 * POST /api/notifications/mark-read
 * Mark notifications as read
 */
router.post(
  '/mark-read',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Authentication required', 401);
    }

    const { notificationIds } = req.body;

    await notificationService.markNotificationsRead(
      userId,
      Array.isArray(notificationIds) ? notificationIds : undefined
    );

    res.json({
      success: true,
      message: 'Notifications marked as read',
    });
  })
);

/**
 * GET /api/notifications/unread-count
 * Get count of unread notifications
 */
router.get(
  '/unread-count',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Authentication required', 401);
    }

    const notifications = await notificationService.getUnreadNotifications(userId);

    res.json({
      success: true,
      data: { count: notifications.length },
    });
  })
);

export default router;
