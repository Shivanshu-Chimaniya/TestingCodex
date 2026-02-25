import { normalizeAnswer } from './normalization.js';

export function canSubmitAnswer(rawInput: string, recentSubmissions: number[], now = Date.now()) {
  const normalized = normalizeAnswer(rawInput);

  if (normalized.length < 2) {
    return { ok: false as const, code: 'INPUT_TOO_SHORT' };
  }

  if (!/[a-z0-9]/i.test(normalized)) {
    return { ok: false as const, code: 'INVALID_FORMAT' };
  }

  const lastSecond = recentSubmissions.filter((ts) => now - ts < 1000);
  if (lastSecond.length >= 5) {
    return { ok: false as const, code: 'RATE_LIMITED' };
  }

  return { ok: true as const, normalized };
}
