import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { logger } from '../config/logger.js';

function headerValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

export function requestContextMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = headerValue(req.headers['x-request-id']) ?? randomUUID();
  const roomId =
    headerValue(req.headers['x-room-id']) ??
    (typeof req.params.code === 'string' ? req.params.code : undefined) ??
    (typeof req.body?.roomCode === 'string' ? req.body.roomCode : undefined);

  logger.withContext({ requestId, roomId }, () => {
    res.setHeader('x-request-id', requestId);
    next();
  });
}
