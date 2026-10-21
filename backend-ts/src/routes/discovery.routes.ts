import { Router, Request, Response } from 'express';
import { getDiscoveryService } from '../services/discovery.service';
import { getPrismaClient } from '../config/database';

const router = Router();
const prisma = getPrismaClient();

/**
 * POST /api/discovery/chat
 * Chat endpoint for lead discovery and company research.
 * Creates or appends to a session for buffer memory.
 */
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { message, sessionId } = req.body;
    const accessToken = (req as any).user?.accessToken;
    const requestedBy = (req as any).user?.email || (req as any).user?.name;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Message is required',
      });
    }

    // Load or create session
    let session: any = null;
    let history: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    if (sessionId) {
      session = await prisma.discoverySession.findUnique({
        where: { sessionId },
      });
      if (session) {
        history = (session.messages as any[]) || [];
      }
    }

    const discoveryService = getDiscoveryService();
    const result = await discoveryService.chat({
      message,
      history,
      accessToken,
    });

    // Build updated messages array
    const userMsg = { role: 'user' as const, content: message, timestamp: new Date().toISOString() };
    const assistantMsg = {
      role: 'assistant' as const,
      content: result.response,
      timestamp: new Date().toISOString(),
      accounts: result.accounts,
      sources: result.sources,
      thinking: result.thinking,
      internalKbResults: result.internalKbResults,
    };
    const updatedMessages = [...history, userMsg, assistantMsg];

    // Save to DB
    let activeSessionId = sessionId;
    if (session) {
      await prisma.discoverySession.update({
        where: { sessionId },
        data: { messages: updatedMessages as any },
      });
    } else {
      // Auto-generate title from first message
      const title = message.length > 60 ? message.substring(0, 57) + '...' : message;
      const newSession = await prisma.discoverySession.create({
        data: {
          title,
          messages: updatedMessages as any,
          requestedBy,
        },
      });
      activeSessionId = newSession.sessionId;
    }

    return res.json({
      success: true,
      data: {
        ...result,
        sessionId: activeSessionId,
      },
    });
  } catch (error: any) {
    console.error('Discovery chat error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to process discovery request',
    });
  }
});

/**
 * GET /api/discovery/sessions
 * List all sessions for the current user.
 */
router.get('/sessions', async (req: Request, res: Response) => {
  try {
    const requestedBy = (req as any).user?.email || (req as any).user?.name;

    const sessions = await prisma.discoverySession.findMany({
      where: { requestedBy },
      orderBy: { updatedAt: 'desc' },
      select: {
        sessionId: true,
        title: true,
        updatedAt: true,
        createdAt: true,
        isSaved: true,
        messages: true,
      },
    });

    const summaries = sessions.map((s) => ({
      sessionId: s.sessionId,
      title: s.title,
      updatedAt: s.updatedAt,
      createdAt: s.createdAt,
      isSaved: s.isSaved,
      messageCount: Array.isArray(s.messages) ? (s.messages as any[]).length : 0,
    }));

    return res.json({ success: true, data: summaries });
  } catch (error: any) {
    console.error('Discovery sessions list error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to list sessions',
    });
  }
});

/**
 * GET /api/discovery/sessions/:sessionId
 * Load a specific session with all messages.
 */
router.get('/sessions/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const session = await prisma.discoverySession.findUnique({
      where: { sessionId },
    });

    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    return res.json({ success: true, data: session });
  } catch (error: any) {
    console.error('Discovery session load error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to load session',
    });
  }
});

/**
 * DELETE /api/discovery/sessions/:sessionId
 * Delete a session.
 */
router.delete('/sessions/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    await prisma.discoverySession.delete({
      where: { sessionId },
    });

    return res.json({ success: true, message: 'Session deleted' });
  } catch (error: any) {
    console.error('Discovery session delete error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete session',
    });
  }
});

export default router;
