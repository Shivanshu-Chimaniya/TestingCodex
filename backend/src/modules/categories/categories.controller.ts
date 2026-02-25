import type { Request, Response } from 'express';
import { z } from 'zod';
import * as categoriesService from './categories.service.js';

const saveCategorySchema = z.object({
  title: z.string().min(3),
  description: z.string().default(''),
  answers: z.array(z.string().min(1)).min(3),
  isPublic: z.boolean().default(false),
});

export function saveCategory(req: Request, res: Response) {
  if (!req.auth) return res.status(401).json({ error: 'UNAUTHORIZED' });

  const parsed = saveCategorySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const category = categoriesService.saveCategory({
    ...parsed.data,
    ownerUserId: req.auth.userId,
  });

  return res.status(201).json({ category });
}

export function listPublicCategories(_req: Request, res: Response) {
  return res.status(200).json({ categories: categoriesService.getPublicCategories() });
}

export function listMyCategories(req: Request, res: Response) {
  if (!req.auth) return res.status(401).json({ error: 'UNAUTHORIZED' });
  return res.status(200).json({ categories: categoriesService.getCategoriesByOwner(req.auth.userId) });
}
