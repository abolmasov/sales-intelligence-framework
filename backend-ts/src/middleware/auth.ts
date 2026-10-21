import { NextFunction, Request, Response } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';

export interface AccessTokenPayload extends JwtPayload {
  email: string;
  accessToken: string;
  userId: string;
}

/**
 * Middleware to verify the platform JWT and expose the upstream
 * Microsoft access token on the request for downstream handlers.
 */
export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Response | void {
  const cookieToken = (req.cookies && req.cookies.si_jwt) || null;
  const authHeader = req.headers.authorization;
  const headerToken =
    authHeader && authHeader.toLowerCase().startsWith('bearer ')
      ? authHeader.slice(7).trim()
      : null;
  const token = cookieToken || headerToken;

  if (!token) {
    console.warn('[authMiddleware] Missing authorization token', {
      path: req.originalUrl,
      method: req.method,
      hasCookie: !!cookieToken,
      hasAuthHeader: !!authHeader,
      cookieKeys: Object.keys(req.cookies || {}),
    });
    return res.status(401).json({
      error: 'Missing or invalid authorization token',
    });
  }
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    console.error('[authMiddleware] JWT_SECRET not configured — server misconfiguration');
    return res.status(401).json({
      error: 'Authentication service unavailable',
    });
  }

  try {
    const decoded = jwt.verify(token, secret) as AccessTokenPayload;

    if (!decoded || !decoded.accessToken || !decoded.email) {
      console.warn('[authMiddleware] Invalid token payload', {
        path: req.originalUrl,
        method: req.method,
      });
      return res.status(401).json({
        error: 'Invalid token payload',
      });
    }

    req.user = {
      email: decoded.email,
      accessToken: decoded.accessToken,
      userId: decoded.userId,
    };

    return next();
  } catch (error) {
    const message =
      error instanceof jwt.TokenExpiredError
        ? 'Authorization token has expired'
        : 'Invalid authorization token';

    console.warn('[authMiddleware] Token validation failed', {
      path: req.originalUrl,
      method: req.method,
      message,
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(401).json({
      error: message,
    });
  }
}
