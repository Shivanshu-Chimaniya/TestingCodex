import { z } from 'zod';

export const generateCategoryRequestSchema = z.object({
  theme: z.string().min(3).max(80),
  language: z.string().default('en'),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  targetAnswerCount: z.number().int().min(8).max(40).default(20),
});

export const categoryResponseSchema = z.object({
  title: z.string().min(3).max(80),
  description: z.string().min(10).max(240),
  language: z.string().regex(/^[a-z]{2}$/),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  answers: z.array(z.string().min(1).max(60)).min(8).max(40),
  synonyms: z.record(z.array(z.string().min(1).max(60))).default({}),
  safety: z.object({
    safe: z.boolean(),
    reasons: z.array(z.string()).default([]),
  }),
});

export function validateCategoryPayload(input: unknown) {
  const result = categoryResponseSchema.safeParse(input);
  if (!result.success) {
    return { ok: false as const, errors: result.error.flatten() };
  }

  if (!result.data.safety.safe) {
    return { ok: false as const, errors: { policy: ['unsafe_category'] } };
  }

  return { ok: true as const, data: result.data };
}

export type GenerateCategoryRequest = z.infer<typeof generateCategoryRequestSchema>;
export type CategoryResponse = z.infer<typeof categoryResponseSchema>;
