import { redis } from '../../config/redis.js';
import { nowMs } from '../../utils/time.js';
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

function getDefaultPlayerStats(): PlayerRoundStats {
  return {
    score: 0,
    uniqueCorrectAnswers: 0,
    streak: 0,
    lastCorrectAt: null,
    duplicateCount: 0,
  };
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

export function beginCountdown(roomCode: string, countdownMs: number) {
  getRoomOrThrow(roomCode);
  const runtime = getRuntime(roomCode);
  const now = nowMs();

  runtime.roundStatus = 'countdown';
  runtime.countdownEndsAt = now + countdownMs;
  runtime.finishedAt = null;

  return {
    countdownStartedAt: now,
    countdownEndsAt: runtime.countdownEndsAt,
    countdownMs,
  };
}

export function startRound(
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
  runtime.endsAt = now + durationMs;
  runtime.finishedAt = null;
  runtime.difficulty = options?.difficulty ?? 'medium';
  runtime.competitiveMode = {
    ...runtime.competitiveMode,
    ...(options?.competitiveMode ?? {}),
  };

  return {
    startedAt: runtime.startedAt,
    endsAt: runtime.endsAt,
    remainingMs: durationMs,
  };
}

export function endRound(roomCode: string, endedAt = nowMs()) {
  getRoomOrThrow(roomCode);
  const runtime = getRuntime(roomCode);

  runtime.roundStatus = 'finished';
  runtime.endsAt = endedAt;
  runtime.finishedAt = endedAt;

  return {
    endedAt,
    leaderboard: getLeaderboard(roomCode),
    foundAnswers: [...runtime.foundAnswers],
  };
}

export function finalizeResults(roomCode: string) {
  getRoomOrThrow(roomCode);
  const runtime = getRuntime(roomCode);

  runtime.roundStatus = 'results';

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

    return { ok: false as const, code: 'DUPLICATE_ANSWER' };
  }

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
