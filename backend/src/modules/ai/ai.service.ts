import crypto from 'node:crypto';
import type { Category } from '../../types/models.js';

const categories = new Map<string, Category>();

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
    const n = normalizeAnswer(answer);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(answer.trim());
  }
  return out;
}

export function generateCategory(input: {
  theme: string;
  difficulty: 'easy' | 'medium' | 'hard';
  language: string;
  targetAnswerCount: number;
}) {
  const base = [
    `${input.theme} Alpha`, `${input.theme} Beta`, `${input.theme} Gamma`, `${input.theme} Delta`, `${input.theme} Echo`,
    `${input.theme} Foxtrot`, `${input.theme} Sigma`, `${input.theme} Prime`, `${input.theme} Core`, `${input.theme} Nova`,
  ];

  const answers = dedupeAnswers(Array.from({ length: input.targetAnswerCount }, (_, i) => base[i % base.length] + ` ${i + 1}`));
  const answerHash = `sha256:${crypto.createHash('sha256').update(answers.join('|')).digest('hex')}`;

  const category: Category = {
    id: `cat_${crypto.randomUUID()}`,
    title: input.theme,
    description: `Auto-generated category for ${input.theme}`,
    language: input.language,
    difficulty: input.difficulty,
    answers,
    answerHash,
    source: 'ai',
    createdAt: new Date().toISOString(),
  };

  categories.set(category.id, category);
  return category;
}

export function getCategoryById(categoryId: string) {
  return categories.get(categoryId) ?? null;
}
