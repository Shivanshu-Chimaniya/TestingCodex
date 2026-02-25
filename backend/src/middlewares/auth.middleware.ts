import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        username: string;
      };
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.header('authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '');

  if (!token) {
    logger.security('auth.missing_token', { path: req.path, method: req.method });
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }

  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as { sub: string; username: string };
    req.auth = { userId: payload.sub, username: payload.username };
    logger.setContext({ userId: payload.sub });
    return next();
  } catch {
    logger.security('auth.invalid_token', { path: req.path, method: req.method });
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }
}
