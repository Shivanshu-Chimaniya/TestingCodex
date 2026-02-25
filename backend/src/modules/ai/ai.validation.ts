import { z } from 'zod';

export const generateCategoryRequestSchema = z.object({
  titleHint: z.string().min(3),
  language: z.string().default('en'),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  desiredAnswers: z.number().int().min(3).max(100).default(20),
});

export const categoryResponseSchema = z.object({
  title: z.string().min(3),
  description: z.string().default(''),
  answers: z.array(z.string().min(1)).min(3),
  language: z.string(),
  difficulty: z.enum(['easy', 'medium', 'hard']),
});

export type GenerateCategoryRequest = z.infer<typeof generateCategoryRequestSchema>;
export type CategoryResponse = z.infer<typeof categoryResponseSchema>;
