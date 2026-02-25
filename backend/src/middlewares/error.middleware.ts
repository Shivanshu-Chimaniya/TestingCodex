import type { NextFunction, Request, Response } from 'express';
import { logger } from '../config/logger.js';

export function errorMiddleware(error: unknown, req: Request, res: Response, _next: NextFunction) {
  if (error instanceof Error) {
    logger.error('http.request.error', {
      path: req.originalUrl,
      method: req.method,
      code: error.message,
    });
    return res.status(400).json({ ok: false, code: error.message });
  }

  logger.error('http.request.error', {
    path: req.originalUrl,
    method: req.method,
    code: 'INTERNAL_SERVER_ERROR',
  });
  return res.status(500).json({ ok: false, code: 'INTERNAL_SERVER_ERROR' });
}
