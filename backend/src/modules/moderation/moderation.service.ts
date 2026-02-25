import { canonicalizeLower } from '../../utils/sanitize.js';

const BLOCKED_TERMS = ['slur', 'hate', 'terror', 'nsfw'];

export function containsBlockedContent(input: string) {
  const normalized = canonicalizeLower(input);
  return BLOCKED_TERMS.some((term) => normalized.includes(term));
}

export function assertModeratedText(input: string, field: 'room_name' | 'category_theme') {
  if (containsBlockedContent(input)) {
    throw new Error(`${field.toUpperCase()}_MODERATION_BLOCKED`);
  }
}

export function recordAbuseEvent(input: { userId?: string; eventType: string; payload?: Record<string, unknown> }) {
  return {
    ...input,
    payload: input.payload ?? {},
    createdAt: Date.now(),
  };
}
