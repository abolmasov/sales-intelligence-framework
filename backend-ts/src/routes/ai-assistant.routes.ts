import { Router, Request, Response } from 'express';
import { getAIAssistantService } from '../services/ai-assistant.service';

const router = Router();

/**
 * POST /api/ai-assistant/chat
 * Main chat endpoint for AI assistant with app context awareness
 */
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { message, history, context } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Message is required',
      });
    }

    // Get access token from authenticated user (set by authMiddleware)
    const accessToken = req.user?.accessToken;

    const aiService = getAIAssistantService();
    const result = await aiService.chat({
      message,
      history: history || [],
      accessToken,
      context, // Pass app context for awareness
    });

    return res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('AI Assistant chat error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to process chat request',
    });
  }
});

/**
 * GET /api/ai-assistant/suggestions
 * Get suggested questions based on recent activity
 */
router.get('/suggestions', async (req: Request, res: Response) => {
  try {
    const aiService = getAIAssistantService();
    const suggestions = await aiService.getSuggestions();

    return res.json({
      success: true,
      data: suggestions,
    });
  } catch (error: any) {
    console.error('AI Assistant suggestions error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get suggestions',
    });
  }
});

/**
 * POST /api/ai-assistant/feedback
 * Submit feedback on AI response (for future improvement)
 */
router.post('/feedback', async (req: Request, res: Response) => {
  try {
    const { messageId, rating, comment } = req.body;

    // TODO: Store feedback for analysis
    console.log('AI Assistant feedback:', { messageId, rating, comment });

    return res.json({
      success: true,
      message: 'Feedback received',
    });
  } catch (error: any) {
    console.error('AI Assistant feedback error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to submit feedback',
    });
  }
});

export default router;
