export function calculatePoints(endsAt: number, now = Date.now()) {
  const remainingMs = Math.max(0, endsAt - now);
  const base = 60;
  const bonus = Math.min(40, Math.floor(remainingMs / 1000));
  return base + bonus;
}
