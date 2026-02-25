import type { LeaderboardEntry } from '../modules/game/game.types.js';

export interface RoomJoinPayload {
  roomCode: string;
  password?: string;
}

export interface RoundStartPayload {
  roomCode: string;
  durationMs?: number;
}

export interface AnswerSubmitPayload {
  roomCode: string;
  answer: string;
  clientTimestamp?: number;
}

export interface AckOk<T> {
  ok: true;
  data: T;
}

export interface AckErr {
  ok: false;
  code: string;
}

export type Ack<T> = ((value: AckOk<T> | AckErr) => void) | undefined;

export interface AnswerAcceptedEvent {
  roomCode: string;
  userId: string;
  normalized: string;
  pointsAwarded: number;
  serverReceivedAt: number;
}

export interface RoundEndEvent {
  endedAt: number;
  leaderboard: LeaderboardEntry[];
  foundAnswers: string[];
}
