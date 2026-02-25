import type { NextFunction, Request, Response } from 'express';

const requestsByIp = new Map<string, number[]>();

export function simpleRateLimit(maxRequestsPerMinute = 120) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip ?? 'unknown';
    const now = Date.now();

    const recent = requestsByIp.get(ip) ?? [];
    const withinWindow = recent.filter((timestamp) => now - timestamp < 60_000);

    if (withinWindow.length >= maxRequestsPerMinute) {
      return res.status(429).json({ ok: false, code: 'RATE_LIMITED' });
    }

    requestsByIp.set(ip, [...withinWindow, now]);
    return next();
  };
}
