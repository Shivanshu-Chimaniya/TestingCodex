import type { Request, Response } from 'express';
import { generateCategorySchema } from './ai.schema.js';
import * as aiService from './ai.service.js';

export function generateCategory(req: Request, res: Response) {
  const parsed = generateCategorySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const category = aiService.generateCategory(parsed.data);
  return res.status(200).json({
    categoryId: category.id,
    title: category.title,
    answerCount: category.answers.length,
    answerHash: category.answerHash,
    providerMeta: { provider: 'stub', model: 'local-v1' },
  });
}
