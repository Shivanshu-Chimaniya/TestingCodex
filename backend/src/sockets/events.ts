import type { LeaderboardEntry } from '../modules/game/game.types.js';

export interface RoomJoinPayload {
  roomCode: string;
  password?: string;
}

export interface RoundStartPayload {
  roomCode: string;
  durationMs?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
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

export interface ClientToServerEvents {
  'room:join': (payload: RoomJoinPayload, ack?: Ack<{ state: unknown }>) => void;
  'room:leave': (payload: { roomCode: string }, ack?: Ack<{ left: boolean }>) => void;
  'round:start': (payload: RoundStartPayload, ack?: Ack<{ countdownMs: number }>) => void;
  'round:ready': (payload: { roomCode: string }, ack?: Ack<{ ready: boolean }>) => void;
  'answer:submit': (payload: AnswerSubmitPayload, ack?: Ack<{ normalized: string; pointsAwarded: number }>) => void;
  'ping:latency': (payload: { sentAt: number }, ack?: Ack<{ sentAt: number; receivedAt: number }>) => void;
}

export interface ServerToClientEvents {
  'room:state': (state: unknown) => void;
  'room:player_joined': (payload: { userId: string; username: string }) => void;
  'room:player_left': (payload: { userId?: string }) => void;
  'round:countdown': (payload: { roomCode: string; countdownMs: number }) => void;
  'round:active': (payload: { roomCode: string; startedAt: number; endsAt: number }) => void;
  'round:tick': (payload: { roomCode: string; remainingMs: number }) => void;
  'round:end': (payload: RoundEndEvent) => void;
  'answer:accepted': (payload: AnswerAcceptedEvent) => void;
  'answer:rejected': (payload: { roomCode: string; code: string }) => void;
  'leaderboard:update': (leaderboard: LeaderboardEntry[]) => void;
  'system:error': (payload: { code: string; message?: string }) => void;
}

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
