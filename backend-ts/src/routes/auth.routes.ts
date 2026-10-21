import { Router, Request, Response } from 'express';
import jwt, { TokenExpiredError } from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { getMSGraphService } from '../services/ms-graph.service';
import { getPrismaClient } from '../config/database';
import { authMiddleware, AccessTokenPayload } from '../middleware/auth';

const router = Router();
const msGraphService = getMSGraphService();
const prisma = getPrismaClient();

export const userTokens: Record<string, any> = {};

const COOKIE_NAME = 'si_jwt';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-me';
const FRONTEND_BASE_URL = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');

const USED_AUTH_CODES_TTL_MS = 5 * 60 * 1000;
const usedAuthCodes = new Map<string, number>();

const cleanupUsedAuthCodes = () => {
  const now = Date.now();
  for (const [code, ts] of usedAuthCodes) {
    if (now - ts > USED_AUTH_CODES_TTL_MS) {
      usedAuthCodes.delete(code);
    }
  }
};

const isAuthCodeRecentlyUsed = (code: string): boolean => {
  cleanupUsedAuthCodes();
  const usedAt = usedAuthCodes.get(code);
  if (!usedAt) {
    return false;
  }
  if (Date.now() - usedAt > USED_AUTH_CODES_TTL_MS) {
    usedAuthCodes.delete(code);
    return false;
  }
  return true;
};

function issueSessionToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
}

function buildCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 8 * 60 * 60 * 1000,
  };
}

router.get('/login', (_req: Request, res: Response) => {
  if (!msGraphService.isConfigured()) {
    res.status(503).json({
      error: 'Microsoft OAuth is not configured',
    });
    return;
  }
  const state = randomBytes(16).toString('hex');
  const url = msGraphService.getAuthorizationUrl(state);
  res.redirect(url);
});

router.get('/callback', async (req: Request, res: Response) => {
  try {
    const code = req.query.code as string | undefined;
    const oauthError = req.query.error as string | undefined;

    if (oauthError) {
      res.redirect(
        `${FRONTEND_BASE_URL}?error=${encodeURIComponent(oauthError)}`
      );
      return;
    }

    if (!code) {
      res.redirect(`${FRONTEND_BASE_URL}?error=missing_code`);
      return;
    }

    if (isAuthCodeRecentlyUsed(code)) {
      res.redirect(`${FRONTEND_BASE_URL}?error=code_already_used`);
      return;
    }
    usedAuthCodes.set(code, Date.now());

    const tokenData = await msGraphService.exchangeCodeForToken(code);
    const userInfo = await msGraphService.getUserInfo(tokenData.access_token);

    const userId = userInfo.id;
    const primaryEmail = userInfo.mail || userInfo.userPrincipalName || 'user@example.com';
    const username = userInfo.userPrincipalName || primaryEmail || userId;

    await prisma.user.upsert({
      where: { userId },
      update: {
        email: primaryEmail,
        fullName: userInfo.displayName || null,
        lastLogin: new Date(),
      },
      create: {
        userId,
        username,
        email: primaryEmail,
        fullName: userInfo.displayName || null,
      },
    });

    userTokens[userId] = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      user_info: userInfo,
    };

    const jwtToken = issueSessionToken({
      userId,
      email: primaryEmail,
      accessToken: tokenData.access_token,
    });

    res.cookie(COOKIE_NAME, jwtToken, buildCookieOptions());

    const redirectParams = new URLSearchParams({
      status: 'success',
      token: jwtToken,
      userId,
    });

    const redirectUrl = `${FRONTEND_BASE_URL}/auth/callback?${redirectParams.toString()}`;
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('Auth callback error:', error);
    res.redirect(
      `${FRONTEND_BASE_URL}?error=auth_failed&error_description=${encodeURIComponent(
        error instanceof Error ? error.message : 'Unknown error'
      )}`
    );
  }
});

router.get('/me', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const accessToken = req.user?.accessToken;
    if (!accessToken) {
      res.status(401).json({ error: 'Missing session' });
      return;
    }

    const userInfo = await msGraphService.getUserInfo(accessToken);
    res.json({ success: true, data: userInfo });
  } catch (error) {
    console.error('Error getting user info:', error);
    res.status(401).json({ error: 'Invalid or expired session' });
  }
});

router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const cookieToken = req.cookies?.[COOKIE_NAME];
    const authHeader = req.headers.authorization;
    const headerToken = authHeader?.toLowerCase().startsWith('bearer ')
      ? authHeader.slice(7).trim()
      : null;
    const token = cookieToken || headerToken;

    if (!token) {
      return res.status(401).json({ error: 'Missing session' });
    }

    let decoded: AccessTokenPayload;
    try {
      decoded = jwt.verify(token, JWT_SECRET) as AccessTokenPayload;
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        decoded = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true }) as AccessTokenPayload;
      } else {
        throw error;
      }
    }

    const { userId, email } = decoded;
    const stored = userTokens[userId];
    if (!stored?.refresh_token) {
      return res.status(401).json({ error: 'No refresh token available' });
    }

    const tokenData = await msGraphService.refreshAccessToken(stored.refresh_token);
    stored.access_token = tokenData.access_token;
    stored.refresh_token = tokenData.refresh_token || stored.refresh_token;

    const newJwt = issueSessionToken({
      userId,
      email,
      accessToken: tokenData.access_token,
    });

    res.cookie(COOKIE_NAME, newJwt, buildCookieOptions());
    return res.json({ success: true, token: newJwt });
  } catch (error) {
    console.error('Token refresh error:', error);
    return res.status(401).json({
      error: 'Failed to refresh token',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/verify', authMiddleware, (_req: Request, res: Response) => {
  res.status(200).json({ success: true, message: 'Session is valid' });
});

router.get('/status', (_req: Request, res: Response): void => {
  const isConfigured = msGraphService.isConfigured();
  res.json({
    oauth_configured: isConfigured,
    message: isConfigured
      ? 'Microsoft OAuth is configured and ready'
      : 'Microsoft OAuth is NOT configured - set MS_CLIENT_ID and MS_CLIENT_SECRET',
  });
});

router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });
  res.json({ success: true });
});

export default router;
