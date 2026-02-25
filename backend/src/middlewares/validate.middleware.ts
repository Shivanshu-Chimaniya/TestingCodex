import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny } from 'zod';

export function validateBody(schema: ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ ok: false, code: 'VALIDATION_ERROR', issues: result.error.issues });
    }

    req.body = result.data;
    return next();
  };
}
