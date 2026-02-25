import type { GenerateCategoryRequest } from './ai.validation.js';

export function buildCategoryPrompt(input: GenerateCategoryRequest) {
  return [
    'SYSTEM:',
    'You generate category trivia packs for a real-time competitive game.',
    'Return ONLY strict JSON matching the schema. No markdown.',
    'Safety rules:',
    '- No hateful, sexual, violent, self-harm, extremist, illegal-content categories.',
    '- No personally identifying data.',
    'Quality rules:',
    '- Category should be globally understandable.',
    '- Answers must be canonical, unambiguous, and <= 40 entries.',
    '- Avoid duplicates, aliases, and spelling variants unless explicitly requested.',
    '- Include difficulty tag and language code.',
    '',
    'USER:',
    'Generate one category pack using:',
    JSON.stringify(
      {
        theme: input.theme,
        difficulty: input.difficulty,
        language: input.language,
        targetAnswerCount: input.targetAnswerCount,
      },
      null,
      2,
    ),
    '',
    'JSON schema:',
    JSON.stringify(
      {
        title: 'string',
        description: 'string',
        language: 'ISO-639-1',
        difficulty: 'easy|medium|hard',
        answers: ['string'],
        synonyms: { '<canonical>': ['<alt1>', '<alt2>'] },
        safety: { safe: true, reasons: [] },
      },
      null,
      2,
    ),
  ].join('\n');
}

export function buildRepairPrompt(input: GenerateCategoryRequest, errors: unknown) {
  return [
    buildCategoryPrompt(input),
    '',
    'Your previous response did not validate. Repair and return JSON only.',
    `Validation errors: ${JSON.stringify(errors)}`,
  ].join('\n');
}
