import { Router, Request, Response } from 'express';
import { getSalesforceService } from '../services/salesforce.service';
import { getPrismaClient } from '../config/database';
import { asyncHandler, AppError } from '../middleware/errorHandler';

const router = Router();
const publicRouter = Router();
const prisma = getPrismaClient();

const FRONTEND_BASE_URL = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');

/**
 * @route GET /api/salesforce/auth/callback
 * @desc OAuth callback from Salesforce — exchanges code for tokens, redirects to frontend
 */
publicRouter.get('/auth/callback', async (req: Request, res: Response) => {
  try {
    const sfService = getSalesforceService();
    const { code, state, error, error_description } = req.query;

    if (error) {
      console.error('Salesforce OAuth error:', error, error_description);
      return res.redirect(`${FRONTEND_BASE_URL}/app/settings?salesforce=error&message=${encodeURIComponent(String(error_description || error))}`);
    }

    if (!code || !state) {
      return res.redirect(`${FRONTEND_BASE_URL}/app/settings?salesforce=error&message=Missing+code+or+state`);
    }

    const tokenData = await sfService.exchangeCodeForToken(code as string);
    await sfService.saveTokensForUser(state as string, tokenData);

    return res.redirect(`${FRONTEND_BASE_URL}/app/settings?salesforce=connected`);
  } catch (err) {
    console.error('Salesforce OAuth callback error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.redirect(`${FRONTEND_BASE_URL}/app/settings?salesforce=error&message=${encodeURIComponent(message)}`);
  }
});

// ─── Authenticated Routes ─────────────────────────────────────────────────

/**
 * @route GET /api/salesforce/auth
 * @desc Get Salesforce OAuth authorization URL
 */
router.get(
  '/auth',
  asyncHandler(async (req, res) => {
    const sfService = getSalesforceService();

    if (!sfService.isConfigured()) {
      throw new AppError('Salesforce integration is not configured. Set SF_CLIENT_ID and SF_CLIENT_SECRET.', 503);
    }

    const userId = (req as any).user?.userId;
    if (!userId) {
      throw new AppError('User not authenticated', 401);
    }

    const authUrl = sfService.getAuthorizationUrl(userId);
    res.json({ success: true, data: { authUrl } });
  })
);

/**
 * @route GET /api/salesforce/status
 * @desc Check Salesforce connection status
 */
router.get(
  '/status',
  asyncHandler(async (req, res) => {
    const sfService = getSalesforceService();
    const userId = (req as any).user?.userId;

    const status = await sfService.getConnectionStatus(userId);

    res.json({
      success: true,
      data: {
        configured: sfService.isConfigured(),
        ...status,
      },
    });
  })
);

/**
 * @route POST /api/salesforce/disconnect
 * @desc Disconnect Salesforce (revoke tokens, clear credentials)
 */
router.post(
  '/disconnect',
  asyncHandler(async (req, res) => {
    const sfService = getSalesforceService();
    const userId = (req as any).user?.userId;

    await sfService.disconnectUser(userId);

    res.json({ success: true, message: 'Salesforce disconnected successfully' });
  })
);

/**
 * @route POST /api/salesforce/sync
 * @desc Trigger full Salesforce sync (Opportunities, Accounts, Contacts)
 */
router.post(
  '/sync',
  asyncHandler(async (req, res) => {
    const sfService = getSalesforceService();
    const userId = (req as any).user?.userId;

    const summary = await sfService.syncAll(userId);

    res.json({ success: true, data: summary });
  })
);

/**
 * @route GET /api/salesforce/opportunities
 * @desc List locally-synced Salesforce opportunities
 */
router.get(
  '/opportunities',
  asyncHandler(async (req, res) => {
    const deals = await prisma.deal.findMany({
      where: { salesforceId: { not: null } },
      orderBy: { updatedAt: 'desc' },
      include: {
        account: { select: { accountId: true, name: true, salesforceId: true } },
      },
    });

    res.json({
      success: true,
      data: deals.map((deal: any) => ({
        deal_id: deal.dealId,
        salesforce_id: deal.salesforceId,
        opportunity_name: deal.opportunityName,
        company_name: deal.companyName,
        stage: deal.stage,
        stage_name: deal.stageName,
        amount: deal.amount,
        close_date: deal.closeDate,
        probability: deal.probability,
        status: deal.status,
        owner: deal.owner,
        account: deal.account
          ? { account_id: deal.account.accountId, name: deal.account.name, salesforce_id: deal.account.salesforceId }
          : null,
        updated_at: deal.updatedAt,
      })),
    });
  })
);

/**
 * @route POST /api/salesforce/opportunities/:oppId/log-activity
 * @desc Log content as a Salesforce Task linked to an Opportunity
 */
router.post(
  '/opportunities/:oppId/log-activity',
  asyncHandler(async (req, res) => {
    const sfService = getSalesforceService();
    const userId = (req as any).user?.userId;
    const { oppId } = req.params;
    const { subject, body, type, date } = req.body;

    if (!subject || !body) {
      throw new AppError('subject and body are required', 400);
    }

    // Resolve to salesforceId — oppId can be either dealId or salesforceId
    const sfId = await resolveSalesforceId(oppId, 'deal');
    if (!sfId) {
      throw new AppError('Deal not found or not linked to Salesforce', 404);
    }

    const taskId = await sfService.logActivityToOpportunity(userId, sfId, { subject, body, type, date });

    res.json({ success: true, data: { taskId } });
  })
);

/**
 * @route POST /api/salesforce/opportunities/:oppId/attach-note
 * @desc Attach content as a Salesforce ContentNote linked to an Opportunity
 */
router.post(
  '/opportunities/:oppId/attach-note',
  asyncHandler(async (req, res) => {
    const sfService = getSalesforceService();
    const userId = (req as any).user?.userId;
    const { oppId } = req.params;
    const { title, body } = req.body;

    if (!title || !body) {
      throw new AppError('title and body are required', 400);
    }

    const sfId = await resolveSalesforceId(oppId, 'deal');
    if (!sfId) {
      throw new AppError('Deal not found or not linked to Salesforce', 404);
    }

    const noteId = await sfService.attachNoteToOpportunity(userId, sfId, { title, body });

    res.json({ success: true, data: { noteId } });
  })
);

/**
 * @route PATCH /api/salesforce/opportunities/:oppId
 * @desc Update Salesforce Opportunity fields
 */
router.patch(
  '/opportunities/:oppId',
  asyncHandler(async (req, res) => {
    const sfService = getSalesforceService();
    const userId = (req as any).user?.userId;
    const { oppId } = req.params;
    const fields = req.body;

    if (!fields || Object.keys(fields).length === 0) {
      throw new AppError('No fields provided for update', 400);
    }

    const sfId = await resolveSalesforceId(oppId, 'deal');
    if (!sfId) {
      throw new AppError('Deal not found or not linked to Salesforce', 404);
    }

    await sfService.updateOpportunityFields(userId, sfId, fields);

    res.json({ success: true, message: 'Opportunity updated in Salesforce' });
  })
);

// ─── Helpers ──────────────────────────────────────────────────────────────

async function resolveSalesforceId(id: string, type: 'deal' | 'account'): Promise<string | null> {
  if (type === 'deal') {
    // If it looks like a Salesforce ID (15 or 18 chars, alphanumeric)
    if (/^[a-zA-Z0-9]{15,18}$/.test(id) && !id.includes('-')) {
      return id;
    }
    // Otherwise look up by dealId
    const deal = await prisma.deal.findUnique({
      where: { dealId: id },
      select: { salesforceId: true },
    });
    return deal?.salesforceId || null;
  }

  if (type === 'account') {
    if (/^[a-zA-Z0-9]{15,18}$/.test(id) && !id.includes('-')) {
      return id;
    }
    const account = await prisma.account.findUnique({
      where: { accountId: id },
      select: { salesforceId: true },
    });
    return account?.salesforceId || null;
  }

  return null;
}

export { publicRouter };
export default router;
