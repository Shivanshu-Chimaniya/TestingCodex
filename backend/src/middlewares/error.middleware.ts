import type { NextFunction, Request, Response } from 'express';

export function errorMiddleware(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof Error) {
    return res.status(400).json({ ok: false, code: error.message });
  }

  return res.status(500).json({ ok: false, code: 'INTERNAL_SERVER_ERROR' });
}
