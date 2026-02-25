import type { GenerateCategoryRequest } from './ai.validation.js';

export function buildCategoryPrompt(input: GenerateCategoryRequest) {
  return [
    'Return valid JSON only.',
    `Create a game category in language=${input.language}, difficulty=${input.difficulty}.`,
    `Theme hint: ${input.titleHint}`,
    `Generate exactly ${input.desiredAnswers} concise answers.`,
    'Output fields: title, description, answers, language, difficulty.',
  ].join('\n');
}
