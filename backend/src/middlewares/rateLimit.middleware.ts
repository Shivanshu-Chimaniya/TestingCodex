import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { allowRequest } from '../modules/performance/rateLimiter.js';

function getUserIdFromToken(req: Request) {
  const token = req.header('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return undefined;

  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as { sub?: string };
    return payload.sub;
  } catch {
    return undefined;
  }
}

export function simpleRateLimit() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const forwarded = req.header('x-forwarded-for')?.split(',')[0]?.trim();
    const ip = forwarded || req.ip || 'unknown';
    const userId = req.auth?.userId ?? getUserIdFromToken(req);

    const ok = await allowRequest({ ip, userId }, 'rest');
    if (!ok) {
      return res.status(429).json({ ok: false, code: 'RATE_LIMITED' });
    }

    return next();
  };
}
