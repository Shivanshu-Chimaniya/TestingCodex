import * as roomService from '../rooms/room.service.js';

type RoundStatus = 'idle' | 'countdown' | 'active' | 'ended';

interface RoomRuntime {
  acceptedAnswers: Set<string>;
  foundAnswers: Set<string>;
  scores: Map<string, number>;
  roundStatus: RoundStatus;
  startedAt: number | null;
  endsAt: number | null;
}

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
  };
  runtimeByRoom.set(roomCode, runtime);
  return runtime;
}

export function getRoomState(roomCode: string) {
  const room = roomService.getRoomByCode(roomCode);
  if (!room) {
    throw new Error('ROOM_NOT_FOUND');
  }

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

export function getLeaderboard(roomCode: string) {
  getRoomState(roomCode);
  const runtime = getRuntime(roomCode);
  return [...runtime.scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([userId, score]) => ({ userId, score }));
}

export function startRound(roomCode: string, durationMs: number) {
  getRoomState(roomCode);
  const runtime = getRuntime(roomCode);
  const now = Date.now();
  runtime.foundAnswers.clear();
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
  getRoomState(roomCode);
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
  getRoomState(roomCode);
  const runtime = getRuntime(roomCode);
  if (runtime.roundStatus !== 'active') {
    return { ok: false as const, code: 'ROUND_NOT_ACTIVE' };
  }

  const normalized = rawAnswer
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\s+/g, ' ');

  if (!runtime.acceptedAnswers.has(normalized)) {
    return { ok: false as const, code: 'INVALID_ANSWER' };
  }

  if (runtime.foundAnswers.has(normalized)) {
    return { ok: false as const, code: 'DUPLICATE_ANSWER' };
  }

  runtime.foundAnswers.add(normalized);
  runtime.scores.set(userId, (runtime.scores.get(userId) ?? 0) + 100);

  return {
    ok: true as const,
    data: {
      normalized,
      pointsAwarded: 100,
      leaderboard: getLeaderboard(roomCode),
    },
  };
}
