import { normalizeAnswerSet } from '../game/normalization.js';
import { hashAnswerSet } from '../game/antiCheat.js';
import { buildCategoryPrompt } from './ai.prompts.js';
import { categoryResponseSchema, type GenerateCategoryRequest } from './ai.validation.js';

export interface ValidatedCategory {
  title: string;
  description: string;
  answers: string[];
  language: string;
  difficulty: 'easy' | 'medium' | 'hard';
  answerHash: string;
  prompt: string;
}

function fakeProviderGenerate(_prompt: string, answerCount: number) {
  return JSON.stringify({
    title: 'Frameworks',
    description: 'Popular web frameworks',
    answers: ['React', 'Vue', 'Angular', 'Svelte', 'Next.js', 'Nuxt'].slice(0, answerCount),
    language: 'en',
    difficulty: 'medium',
  });
}

function safeJsonParse(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('INVALID_AI_PAYLOAD');
  }
}

export async function generateCategory(input: GenerateCategoryRequest): Promise<ValidatedCategory> {
  const prompt = buildCategoryPrompt(input);
  const raw = fakeProviderGenerate(prompt, input.desiredAnswers);
  const parsed = safeJsonParse(raw);
  const validated = categoryResponseSchema.parse(parsed);
  const normalizedAnswers = normalizeAnswerSet(validated.answers);

  return {
    ...validated,
    answers: normalizedAnswers,
    answerHash: hashAnswerSet(normalizedAnswers),
    prompt,
  };
}
