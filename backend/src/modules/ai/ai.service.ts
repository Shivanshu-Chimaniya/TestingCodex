import { normalizeAnswerSet } from '../game/normalization.js';
import { hashAnswerSet } from '../game/antiCheat.js';
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

const fallbackSeedPacks: Array<{
  theme: string;
  difficulty: 'easy' | 'medium' | 'hard';
  language: string;
  payload: CategoryResponse;
}> = [
  {
    theme: 'programming languages',
    difficulty: 'easy',
    language: 'en',
    payload: {
      title: 'Programming Languages',
      description: 'Widely used programming languages in modern software development.',
      language: 'en',
      difficulty: 'easy',
      answers: ['JavaScript', 'Python', 'Java', 'C#', 'C++', 'TypeScript', 'Go', 'Ruby'],
      synonyms: {},
      safety: { safe: true, reasons: [] },
    },
  },
  {
    theme: 'countries',
    difficulty: 'medium',
    language: 'en',
    payload: {
      title: 'Countries of Europe',
      description: 'Sovereign countries that are geographically or politically in Europe.',
      language: 'en',
      difficulty: 'medium',
      answers: ['France', 'Germany', 'Italy', 'Spain', 'Portugal', 'Sweden', 'Norway', 'Poland'],
      synonyms: {},
      safety: { safe: true, reasons: [] },
    },
  },
];

const generatedCategoryCache = new Map<string, ValidatedCategory>();

function cacheKey(input: GenerateCategoryRequest) {
  return `${normalizeAnswer(input.theme)}|${input.difficulty}|${input.language}`;
}

function normalizeAnswer(s: string): string {
  return s
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^\p{L}\p{N}\s'.-]/gu, '')
    .replace(/\s+/g, ' ');
}

function dedupeAnswers(answers: string[]): string[] {
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

function qualityCheck(answers: string[]) {
  const normalized = answers.map((answer) => normalizeAnswer(answer));
  const unique = new Set(normalized).size;
  const uniquenessRatio = unique / Math.max(1, answers.length);

  if (answers.length < 8) throw new Error('LOW_ANSWER_COUNT');
  if (uniquenessRatio < 0.9) throw new Error('LOW_UNIQUENESS_RATIO');
}

function safeJsonParse(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function fakeProviderGenerate(input: GenerateCategoryRequest, _prompt: string) {
  const seed = dedupeAnswers([
    `${input.theme} One`,
    `${input.theme} Two`,
    `${input.theme} Three`,
    `${input.theme} Four`,
    `${input.theme} Five`,
    `${input.theme} Six`,
    `${input.theme} Seven`,
    `${input.theme} Eight`,
    `${input.theme} Nine`,
    `${input.theme} Ten`,
  ]).slice(0, input.targetAnswerCount);

  return JSON.stringify({
    title: input.theme,
    description: `A ${input.difficulty} category about ${input.theme} for trivia players.`,
    language: input.language,
    difficulty: input.difficulty,
    answers: seed,
    synonyms: {},
    safety: { safe: true, reasons: [] },
  });
}

async function callModel(input: GenerateCategoryRequest, prompt: string) {
  return fakeProviderGenerate(input, prompt);
}

async function callModelWithRepair(input: GenerateCategoryRequest, errors: unknown) {
  const repairPrompt = buildRepairPrompt(input, errors);
  return callModel(input, repairPrompt);
}

function toValidatedCategory(payload: CategoryResponse, prompt: string): ValidatedCategory {
  const answers = normalizeAnswerSet(dedupeAnswers(payload.answers));
  qualityCheck(answers);

  return {
    ...payload,
    answers,
    answerHash: hashAnswerSet(answers),
    prompt,
  };
}

function getFallbackCategory(input: GenerateCategoryRequest): ValidatedCategory {
  const cached = generatedCategoryCache.get(cacheKey(input));
  if (cached) return cached;

  const normalizedTheme = normalizeAnswer(input.theme);
  const matchingSeed = fallbackSeedPacks.find(
    (seed) =>
      seed.theme.includes(normalizedTheme) ||
      (seed.difficulty === input.difficulty && seed.language === input.language),
  );

  const selected = matchingSeed ?? fallbackSeedPacks[0];
  const fallback = toValidatedCategory(selected.payload, 'fallback-seed-pack');
  generatedCategoryCache.set(cacheKey(input), fallback);
  return fallback;
}

export function buildAliasMap(payload: { answers: string[]; synonyms: Record<string, string[]> }) {
  const aliasToCanonical = new Map<string, string>();

  for (const canonical of payload.answers) {
    const canonicalNorm = normalizeAnswer(canonical);
    aliasToCanonical.set(canonicalNorm, canonicalNorm);

    for (const alt of payload.synonyms[canonical] ?? []) {
      const altNorm = normalizeAnswer(alt);
      if (altNorm) aliasToCanonical.set(altNorm, canonicalNorm);
    }
  }

  return aliasToCanonical;
}

export async function generateCategory(input: GenerateCategoryRequest): Promise<ValidatedCategory> {
  const prompt = buildCategoryPrompt(input);

  const first = await callModel(input, prompt);
  const firstValidation = validateCategoryPayload(safeJsonParse(first));
  if (firstValidation.ok) {
    const category = toValidatedCategory(firstValidation.data, prompt);
    generatedCategoryCache.set(cacheKey(input), category);
    return category;
  }

  const repaired = await callModelWithRepair(input, firstValidation.errors);
  const repairedValidation = validateCategoryPayload(safeJsonParse(repaired));
  if (repairedValidation.ok) {
    const category = toValidatedCategory(repairedValidation.data, prompt);
    generatedCategoryCache.set(cacheKey(input), category);
    return category;
  }

  return getFallbackCategory(input);
}
