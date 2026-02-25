import type { RoundDifficulty } from './game.types.js';

const BASE_POINTS = 100;
const MAX_STREAK_BONUS = 0.25;
const STREAK_STEP_BONUS = 0.05;

const DIFFICULTY_MULTIPLIER: Record<RoundDifficulty, number> = {
  easy: 0.9,
  medium: 1,
  hard: 1.2,
};

export function calculatePoints(input: {
  now: number;
  endsAt: number;
  roundDurationMs: number;
  streak: number;
  difficulty: RoundDifficulty;
  perAnswerCap: number;
}) {
  const remainingMs = Math.max(0, input.endsAt - input.now);
  const safeDuration = Math.max(1, input.roundDurationMs);
  const timeMultiplier = 1 + (remainingMs / safeDuration) * 0.75;
  const streakBonus = Math.min(MAX_STREAK_BONUS, Math.max(0, input.streak) * STREAK_STEP_BONUS);
  const difficultyMultiplier = DIFFICULTY_MULTIPLIER[input.difficulty];

  const raw = BASE_POINTS * timeMultiplier * (1 + streakBonus) * difficultyMultiplier;
  return Math.min(input.perAnswerCap, Math.floor(raw));
}
