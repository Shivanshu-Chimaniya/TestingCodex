import crypto from 'node:crypto';
import type { RoundRuntime } from '../../types/models.js';
import * as roomService from '../rooms/room.service.js';
import { getCategoryById } from '../ai/ai.service.js';

const rounds = new Map<string, RoundRuntime>();

function normalize(input: string): string {
  return input.trim().toLowerCase().normalize('NFKC').replace(/\s+/g, ' ');
}

export function getRoomState(roomCode: string) {
  const room = roomService.getRoomByCode(roomCode);
  if (!room) throw new Error('ROOM_NOT_FOUND');

  const currentRound = room.currentRoundId ? rounds.get(room.currentRoundId) : undefined;

  return {
    roomCode: room.code,
    status: room.status,
    hostUserId: room.hostUserId,
    players: room.players,
    currentRoundId: room.currentRoundId,
    foundCount: currentRound?.foundAnswers.size ?? 0,
  };
}

export function startRound(roomCode: string, categoryId: string) {
  const room = roomService.markActive(roomCode);
  const category = getCategoryById(categoryId);
  if (!category) throw new Error('CATEGORY_NOT_FOUND');

  const roundId = room.currentRoundId ?? crypto.randomUUID();
  room.currentRoundId = roundId;

  const runtime: RoundRuntime = {
    id: roundId,
    roomCode,
    categoryId,
    status: 'active',
    startedAt: Date.now(),
    durationMs: room.config.roundDurationSec * 1000,
    acceptedAnswers: new Set(category.answers.map((a) => normalize(a))),
    foundAnswers: new Map(),
    scores: new Map(),
  };

  rounds.set(roundId, runtime);
  return runtime;
}

export function submitAnswer(roundId: string, userId: string, rawInput: string) {
  const round = rounds.get(roundId);
  if (!round || round.status !== 'active') return { ok: false as const, code: 'ROUND_NOT_ACTIVE' };

  const normalized = normalize(rawInput);
  if (normalized.length < 2) return { ok: false as const, code: 'INVALID' };
  if (!round.acceptedAnswers.has(normalized)) return { ok: false as const, code: 'INVALID' };
  if (round.foundAnswers.has(normalized)) return { ok: false as const, code: 'DUPLICATE' };

  round.foundAnswers.set(normalized, userId);

  const elapsed = Date.now() - (round.startedAt ?? Date.now());
  const remainingMs = Math.max(0, round.durationMs - elapsed);
  const points = Math.floor(100 * (1 + (remainingMs / round.durationMs) * 0.75));

  const previous = round.scores.get(userId) ?? 0;
  round.scores.set(userId, previous + points);

  return { ok: true as const, points, remainingMs };
}

export function getLeaderboard(roundId: string) {
  const round = rounds.get(roundId);
  if (!round) return [];

  return Array.from(round.scores.entries())
    .map(([userId, points]) => ({ userId, points }))
    .sort((a, b) => b.points - a.points);
}

export function finishRound(roundId: string) {
  const round = rounds.get(roundId);
  if (!round) throw new Error('ROUND_NOT_FOUND');

  round.status = 'finished';
  round.endedAt = Date.now();
  return round;
}
