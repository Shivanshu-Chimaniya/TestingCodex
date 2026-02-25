import { redis } from '../../config/redis.js';
import { nowMs } from '../../utils/time.js';
import { enqueueSubmission } from '../performance/submission.queue.js';
import * as roomService from '../rooms/room.service.js';
import { canSubmitAnswer } from './antiCheat.js';
import { normalizeAnswer } from './normalization.js';
import { calculatePoints } from './scoring.js';
import type {
  LeaderboardEntry,
  PlayerRoundStats,
  RoomRuntime,
  RoundDifficulty,
} from './game.types.js';

const runtimeByRoom = new Map<string, RoomRuntime>();
const MAX_POINTS_PER_ANSWER = 250;
const MAX_ROOM_LIFETIME_MS = 60 * 60 * 1000;
const INVALID_ANSWER_COOLDOWN_MS = 5000;
const INVALID_ANSWER_THRESHOLD = 3;

function getDefaultPlayerStats(): PlayerRoundStats {
  return {
    score: 0,
    uniqueCorrectAnswers: 0,
    streak: 0,
    lastCorrectAt: null,
    duplicateCount: 0,
  };
}

async function cacheRoomSnapshot(roomCode: string) {
  const state = getRoomState(roomCode);
  await redis.set(`room:${roomCode}:snapshot`, JSON.stringify(state), { EX: 60 * 30 });
}

async function cacheLeaderboard(roomCode: string) {
  const leaderboard = getLeaderboard(roomCode);
  await redis.set(`room:${roomCode}:leaderboard`, JSON.stringify(leaderboard), { EX: 60 * 30 });
}

function getRuntime(roomCode: string): RoomRuntime {
  const existing = runtimeByRoom.get(roomCode);
  if (existing) return existing;

  const runtime: RoomRuntime = {
    acceptedAnswers: new Set(['react', 'vue', 'angular', 'svelte', 'next js']),
    foundAnswers: new Set(),
    foundAnswerOwners: new Map(),
    playerStats: new Map(),
    roundStatus: 'lobby',
    countdownEndsAt: null,
    startedAt: null,
    endsAt: null,
    finishedAt: null,
    roundDurationMs: 60000,
    difficulty: 'medium',
    graceWindowMs: 100,
    competitiveMode: {
      enabled: false,
      duplicateThreshold: 3,
      duplicateDecayPoints: 5,
    },
    recentSubmissions: new Map(),
    invalidAnswerTracker: new Map(),
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
    countdownEndsAt: runtime.countdownEndsAt,
    finishedAt: runtime.finishedAt,
    roomAgeMs: Date.now() - room.createdAt,
  };
}

export function getLeaderboard(roomCode: string): LeaderboardEntry[] {
  getRoomOrThrow(roomCode);
  const runtime = getRuntime(roomCode);

  const sorted = [...runtime.playerStats.entries()].sort((a, b) => {
    const [, left] = a;
    const [, right] = b;
    if (right.score !== left.score) return right.score - left.score;
    if (right.uniqueCorrectAnswers !== left.uniqueCorrectAnswers) {
      return right.uniqueCorrectAnswers - left.uniqueCorrectAnswers;
    }

    if (left.lastCorrectAt === null && right.lastCorrectAt === null) return 0;
    if (left.lastCorrectAt === null) return 1;
    if (right.lastCorrectAt === null) return -1;
    return left.lastCorrectAt - right.lastCorrectAt;
  });

  let previous: PlayerRoundStats | null = null;
  let currentRank = 0;

  return sorted.map(([userId, stats], index) => {
    const tiesPrevious =
      previous &&
      previous.score === stats.score &&
      previous.uniqueCorrectAnswers === stats.uniqueCorrectAnswers &&
      previous.lastCorrectAt === stats.lastCorrectAt;

    currentRank = tiesPrevious ? currentRank : index + 1;
    previous = stats;

    return {
      userId,
      score: stats.score,
      uniqueCorrectAnswers: stats.uniqueCorrectAnswers,
      lastCorrectAt: stats.lastCorrectAt,
      rank: currentRank,
    };
  });
}

export async function beginCountdown(roomCode: string, countdownMs: number) {
  getRoomOrThrow(roomCode);
  const runtime = getRuntime(roomCode);
  const now = nowMs();

  runtime.roundStatus = 'countdown';
  runtime.countdownEndsAt = now + countdownMs;
  runtime.finishedAt = null;
  await cacheRoomSnapshot(roomCode);

  return {
    countdownStartedAt: now,
    countdownEndsAt: runtime.countdownEndsAt,
    countdownMs,
  };
}

export async function startRound(
  roomCode: string,
  durationMs: number,
  options?: {
    difficulty?: RoundDifficulty;
    competitiveMode?: Partial<RoomRuntime['competitiveMode']>;
  },
) {
  getRoomOrThrow(roomCode);
  const runtime = getRuntime(roomCode);
  const now = nowMs();

  runtime.foundAnswers.clear();
  runtime.foundAnswerOwners.clear();
  runtime.recentSubmissions.clear();
  runtime.invalidAnswerTracker.clear();
  runtime.playerStats.forEach((stats) => {
    stats.streak = 0;
    stats.uniqueCorrectAnswers = 0;
    stats.lastCorrectAt = null;
    stats.duplicateCount = 0;
  });

  runtime.roundStatus = 'active';
  runtime.countdownEndsAt = null;
  runtime.startedAt = now;
  runtime.roundDurationMs = durationMs;
  const endsAt = now + durationMs;
  runtime.endsAt = endsAt;
  runtime.finishedAt = null;
  runtime.difficulty = options?.difficulty ?? 'medium';
  runtime.competitiveMode = {
    ...runtime.competitiveMode,
    ...(options?.competitiveMode ?? {}),
  };

  await cacheRoomSnapshot(roomCode);

  return {
    startedAt: now,
    endsAt,
    remainingMs: durationMs,
  };
}

export async function endRound(roomCode: string, endedAt = nowMs()) {
  getRoomOrThrow(roomCode);
  const runtime = getRuntime(roomCode);

  runtime.roundStatus = 'finished';
  runtime.endsAt = endedAt;
  runtime.finishedAt = endedAt;

  await cacheRoomSnapshot(roomCode);
  await cacheLeaderboard(roomCode);

  return {
    endedAt,
    leaderboard: getLeaderboard(roomCode),
    foundAnswers: [...runtime.foundAnswers],
  };
}

export async function finalizeResults(roomCode: string) {
  getRoomOrThrow(roomCode);
  const runtime = getRuntime(roomCode);

  runtime.roundStatus = 'results';
  await cacheLeaderboard(roomCode);

  return {
    leaderboard: getLeaderboard(roomCode),
    mvp: getLeaderboard(roomCode)[0] ?? null,
  };
}

export async function submitAnswer(roomCode: string, userId: string, rawAnswer: string) {
  getRoomOrThrow(roomCode);
  const runtime = getRuntime(roomCode);

  if (runtime.roundStatus !== 'active' || !runtime.endsAt || !runtime.startedAt) {
    return { ok: false as const, code: 'ROUND_NOT_ACTIVE' };
  }

  const now = nowMs();

  const invalidState = runtime.invalidAnswerTracker.get(userId) ?? { count: 0, cooldownUntil: null };
  if (invalidState.cooldownUntil && now < invalidState.cooldownUntil) {
    return { ok: false as const, code: 'INVALID_ANSWER_COOLDOWN' };
  }
  if (now > runtime.endsAt + runtime.graceWindowMs) {
    return { ok: false as const, code: 'ROUND_ALREADY_FINISHED' };
  }

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

  const acceptedSetKey = `round:${roomCode}:accepted`;
  if (!(await redis.sIsMember(acceptedSetKey, normalized))) {
    if (!runtime.acceptedAnswers.has(normalized)) {
      invalidState.count += 1;
      if (invalidState.count >= INVALID_ANSWER_THRESHOLD) {
        invalidState.cooldownUntil = now + INVALID_ANSWER_COOLDOWN_MS;
        invalidState.count = 0;
      }
      runtime.invalidAnswerTracker.set(userId, invalidState);

      enqueueSubmission({
        roomCode,
        userId,
        rawInput: rawAnswer,
        normalizedInput: normalized,
        isValid: false,
        isDuplicate: false,
        pointsAwarded: 0,
        serverReceivedAt: new Date(now),
      });
      return { ok: false as const, code: 'INVALID_ANSWER' };
    }

    await redis.sAdd(acceptedSetKey, normalized);
  }

  const isFirst = await redis.sAdd(`round:${roomCode}:found`, normalized);
  const playerStats = runtime.playerStats.get(userId) ?? getDefaultPlayerStats();
  runtime.playerStats.set(userId, playerStats);

  if (!isFirst) {
    playerStats.duplicateCount += 1;
    if (
      runtime.competitiveMode.enabled &&
      playerStats.duplicateCount > runtime.competitiveMode.duplicateThreshold
    ) {
      playerStats.score = Math.max(0, playerStats.score - runtime.competitiveMode.duplicateDecayPoints);
    }

    enqueueSubmission({
      roomCode,
      userId,
      rawInput: rawAnswer,
      normalizedInput: normalized,
      isValid: true,
      isDuplicate: true,
      pointsAwarded: 0,
      serverReceivedAt: new Date(now),
    });

    return { ok: false as const, code: 'DUPLICATE_ANSWER' };
  }

  runtime.invalidAnswerTracker.set(userId, { count: 0, cooldownUntil: null });

  runtime.foundAnswers.add(normalized);
  runtime.foundAnswerOwners.set(normalized, userId);
  playerStats.streak += 1;
  playerStats.uniqueCorrectAnswers += 1;
  playerStats.lastCorrectAt = now;

  const pointsAwarded = calculatePoints({
    now,
    endsAt: runtime.endsAt,
    roundDurationMs: runtime.roundDurationMs,
    streak: playerStats.streak,
    difficulty: runtime.difficulty,
    perAnswerCap: MAX_POINTS_PER_ANSWER,
  });

  playerStats.score += pointsAwarded;

  enqueueSubmission({
    roomCode,
    userId,
    rawInput: rawAnswer,
    normalizedInput: normalized,
    isValid: true,
    isDuplicate: false,
    pointsAwarded,
    serverReceivedAt: new Date(now),
  });

  await cacheLeaderboard(roomCode);

  const allAnswersFound = runtime.foundAnswers.size >= runtime.acceptedAnswers.size;

  return {
    ok: true as const,
    data: {
      normalized,
      pointsAwarded,
      leaderboard: getLeaderboard(roomCode),
      allAnswersFound,
    },
  };
}

export async function clearRoomRuntime(roomCode: string) {
  runtimeByRoom.delete(roomCode);
  await redis.del(
    `round:${roomCode}:accepted`,
    `round:${roomCode}:found`,
    `room:${roomCode}:snapshot`,
    `room:${roomCode}:leaderboard`,
  );
}

export function staleRooms(maxLifetimeMs = MAX_ROOM_LIFETIME_MS) {
  const now = Date.now();
  return roomService
    .listRooms()
    .filter((room) => now - room.createdAt > maxLifetimeMs || (room.players.length === 0 && room.status !== 'active'));
}
