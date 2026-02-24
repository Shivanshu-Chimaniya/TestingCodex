import { z } from 'zod';

export const generateCategorySchema = z.object({
  theme: z.string().min(3).max(80),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  language: z.string().regex(/^[a-z]{2}$/),
  targetAnswerCount: z.number().int().min(8).max(40),
});
