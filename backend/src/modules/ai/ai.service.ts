import { hashAnswerSet } from '../game/antiCheat.js';
import { logger } from '../../config/logger.js';
import { buildCategoryPrompt, buildRepairPrompt } from './ai.prompts.js';
import {
  type CategoryResponse,
  type GenerateCategoryRequest,
  validateCategoryPayload,
} from './ai.validation.js';

export interface ValidatedCategory extends CategoryResponse {
  answerHash: string;
  prompt: string;
}

const PROVIDER_META = {
  provider: 'fake-provider',
  model: 'demo-v1',
  version: '2026-02',
};

const generatedCategoryCache = new Map<string, CategoryResponse>();

const curatedSeedPacks: CategoryResponse[] = [
  {
    title: 'European Capitals',
    description: 'Capital cities of sovereign countries in Europe.',
    language: 'en',
    difficulty: 'easy',
    answers: ['Paris', 'Berlin', 'Madrid', 'Rome', 'Lisbon', 'Vienna', 'Dublin', 'Athens', 'Oslo', 'Stockholm'],
    synonyms: { Vienna: ['Wien'] },
    safety: { safe: true, reasons: [] },
  },
  {
    title: 'Planets in the Solar System',
    description: 'The eight recognized planets orbiting the Sun.',
    language: 'en',
    difficulty: 'easy',
    answers: ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'],
    synonyms: {},
    safety: { safe: true, reasons: [] },
  },
  {
    title: 'Programming Languages',
    description: 'Widely used programming languages in software development.',
    language: 'en',
    difficulty: 'medium',
    answers: ['JavaScript', 'TypeScript', 'Python', 'Java', 'C', 'C++', 'C#', 'Go', 'Rust', 'Ruby', 'PHP', 'Swift'],
    synonyms: { 'C#': ['C Sharp'], JavaScript: ['JS'] },
    safety: { safe: true, reasons: [] },
  },
];

function toCacheKey(theme: string, difficulty: string, language: string) {
  return `${theme.toLowerCase()}::${difficulty}::${language}`;
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function normalizeAnswer(s: string): string {
  return s
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^\p{L}\p{N}\s'.-]/gu, '')
    .replace(/\s+/g, ' ');
}

export function dedupeAnswers(answers: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const answer of answers) {
    const normalized = normalizeAnswer(answer);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(answer.trim());
  }
  return out;
}

function clipAndValidateOutput(category: CategoryResponse, targetAnswerCount: number) {
  const dedupedAnswers = dedupeAnswers(category.answers).slice(0, targetAnswerCount);
  return {
    ...category,
    answers: dedupedAnswers,
  };
}

function fakeProviderGenerate(input: GenerateCategoryRequest): string {
  if (input.theme.toLowerCase().includes('invalid-json')) {
    return '{"broken": true';
  }

  const matchingSeed = curatedSeedPacks.find((seed) =>
    seed.title.toLowerCase().includes(input.theme.toLowerCase()),
  );

  const base = matchingSeed ?? curatedSeedPacks.find((seed) => seed.difficulty === input.difficulty) ?? curatedSeedPacks[0];

  return JSON.stringify({
    ...base,
    difficulty: input.difficulty,
    language: input.language,
    answers: base.answers.slice(0, input.targetAnswerCount),
  });
}

async function callModel(input: GenerateCategoryRequest, _prompt: string) {
  return fakeProviderGenerate(input);
}

async function callModelWithRepair(input: GenerateCategoryRequest, _repairPrompt: string) {
  const repairedOutput = fakeProviderGenerate({ ...input, theme: input.theme.replace('invalid-json', '').trim() || 'general' });
  return repairedOutput;
}

function getFallbackCategory(input: GenerateCategoryRequest): CategoryResponse {
  const cacheKey = toCacheKey(input.theme, input.difficulty, input.language);
  const cached = generatedCategoryCache.get(cacheKey);
  if (cached) return clipAndValidateOutput(cached, input.targetAnswerCount);

  const fallback =
    curatedSeedPacks.find((category) => category.difficulty === input.difficulty && category.language === input.language) ??
    curatedSeedPacks.find((category) => category.difficulty === input.difficulty) ??
    curatedSeedPacks[0];

  return clipAndValidateOutput(
    {
      ...fallback,
      language: input.language,
      difficulty: input.difficulty,
    },
    input.targetAnswerCount,
  );
}

async function robustGenerate(input: GenerateCategoryRequest, prompt: string): Promise<CategoryResponse> {
  const first = await callModel(input, prompt);
  const parsed = safeJsonParse(first);
  let validated = validateCategoryPayload(parsed);
  if (validated.ok) {
    return clipAndValidateOutput(validated.data, input.targetAnswerCount);
  }

  const repairPrompt = buildRepairPrompt(input, validated.errors);
  const repaired = await callModelWithRepair(input, repairPrompt);
  validated = validateCategoryPayload(safeJsonParse(repaired));
  if (validated.ok) {
    return clipAndValidateOutput(validated.data, input.targetAnswerCount);
  }

  logger.warn('ai.category_generation_failed', {
    ...PROVIDER_META,
    theme: input.theme,
    difficulty: input.difficulty,
    language: input.language,
    errors: validated.errors,
  });

  return getFallbackCategory(input);
}

export async function generateCategory(input: GenerateCategoryRequest): Promise<ValidatedCategory> {
  const prompt = buildCategoryPrompt(input);
  const generated = await robustGenerate(input, prompt);
  const validated = validateCategoryPayload(generated);

  if (!validated.ok) {
    throw new Error('INVALID_AI_PAYLOAD');
  }

  const cacheKey = toCacheKey(input.theme, input.difficulty, input.language);
  generatedCategoryCache.set(cacheKey, validated.data);

  const answers = dedupeAnswers(validated.data.answers);

  return {
    ...validated.data,
    answers,
    answerHash: hashAnswerSet(answers),
    prompt,
  };
}
