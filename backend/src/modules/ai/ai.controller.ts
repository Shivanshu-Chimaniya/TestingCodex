import type { Request, Response } from 'express';
import * as aiService from './ai.service.js';
import { generateCategoryRequestSchema } from './ai.validation.js';

export async function generateCategory(req: Request, res: Response) {
  const parsed = generateCategoryRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const category = await aiService.generateCategory(parsed.data);
  return res.status(200).json({ category });
}
