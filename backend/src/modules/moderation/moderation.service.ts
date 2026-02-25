export function recordAbuseEvent(input: { userId?: string; eventType: string; payload?: Record<string, unknown> }) {
  return {
    ...input,
    payload: input.payload ?? {},
    createdAt: Date.now(),
  };
}
