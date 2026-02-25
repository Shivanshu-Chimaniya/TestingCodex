import * as roomService from '../rooms/room.service.js';
import { canSubmitAnswer } from './antiCheat.js';
import { normalizeAnswer } from './normalization.js';
import { calculatePoints } from './scoring.js';
import type { LeaderboardEntry, RoomRuntime } from './game.types.js';

const runtimeByRoom = new Map<string, RoomRuntime>();

function getRuntime(roomCode: string): RoomRuntime {
  const existing = runtimeByRoom.get(roomCode);
  if (existing) return existing;

  const runtime: RoomRuntime = {
    acceptedAnswers: new Set(['react', 'vue', 'angular', 'svelte', 'next.js']),
    foundAnswers: new Set(),
    scores: new Map(),
    roundStatus: 'idle',
    startedAt: null,
    endsAt: null,
    recentSubmissions: new Map(),
  };

  runtimeByRoom.set(roomCode, runtime);
  return runtime;
}

function getRoomOrThrow(roomCode: string) {
  const room = roomService.getRoomByCode(roomCode);
  if (!room) throw new Error('ROOM_NOT_FOUND');
  return room;
}

export function getRoomState(roomCode: string) {
  const room = getRoomOrThrow(roomCode);
  const runtime = getRuntime(roomCode);

  return {
    roomCode: room.code,
    status: room.status,
    hostUserId: room.hostUserId,
    players: room.players,
    timer: runtime.endsAt,
    roundStatus: runtime.roundStatus,
  };
}

export function getLeaderboard(roomCode: string): LeaderboardEntry[] {
  getRoomOrThrow(roomCode);
  const runtime = getRuntime(roomCode);

  return [...runtime.scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([userId, score]) => ({ userId, score }));
}

export function startRound(roomCode: string, durationMs: number) {
  getRoomOrThrow(roomCode);
  const runtime = getRuntime(roomCode);
  const now = Date.now();

  runtime.foundAnswers.clear();
  runtime.recentSubmissions.clear();
  runtime.roundStatus = 'active';
  runtime.startedAt = now;
  runtime.endsAt = now + durationMs;

  return {
    startedAt: runtime.startedAt,
    endsAt: runtime.endsAt,
    remainingMs: durationMs,
  };
}

export function endRound(roomCode: string) {
  getRoomOrThrow(roomCode);
  const runtime = getRuntime(roomCode);

  runtime.roundStatus = 'ended';
  runtime.endsAt = Date.now();

  return {
    endedAt: runtime.endsAt,
    leaderboard: getLeaderboard(roomCode),
    foundAnswers: [...runtime.foundAnswers],
  };
}

export function submitAnswer(roomCode: string, userId: string, rawAnswer: string) {
  getRoomOrThrow(roomCode);
  const runtime = getRuntime(roomCode);

  if (runtime.roundStatus !== 'active' || !runtime.endsAt) {
    return { ok: false as const, code: 'ROUND_NOT_ACTIVE' };
  }

  const now = Date.now();
  const recent = runtime.recentSubmissions.get(userId) ?? [];
  const antiCheat = canSubmitAnswer(rawAnswer, recent, now);
  if (!antiCheat.ok) {
    return { ok: false as const, code: antiCheat.code };
  }

  const normalized = normalizeAnswer(antiCheat.normalized);
  runtime.recentSubmissions.set(
    userId,
    [...recent.filter((ts) => now - ts < 1000), now],
  );

  if (!runtime.acceptedAnswers.has(normalized)) {
    return { ok: false as const, code: 'INVALID_ANSWER' };
  }

  if (runtime.foundAnswers.has(normalized)) {
    return { ok: false as const, code: 'DUPLICATE_ANSWER' };
  }

  runtime.foundAnswers.add(normalized);
  const pointsAwarded = calculatePoints(runtime.endsAt, now);
  runtime.scores.set(userId, (runtime.scores.get(userId) ?? 0) + pointsAwarded);

  return {
    ok: true as const,
    data: {
      normalized,
      pointsAwarded,
      leaderboard: getLeaderboard(roomCode),
    },
  };
}
