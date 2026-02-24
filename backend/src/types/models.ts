export interface User {
  id: string;
  username: string;
  email: string;
  password: string;
}

export interface Room {
  code: string;
  hostUserId: string;
  visibility: 'public' | 'private';
  password?: string;
  maxPlayers: number;
  status: 'lobby' | 'countdown' | 'active' | 'finished';
  players: string[];
  config: {
    roundDurationSec: number;
    aiProvider: 'gemini' | 'openai';
  };
  currentRoundId?: string;
}

export interface Category {
  id: string;
  title: string;
  description: string;
  language: string;
  difficulty: 'easy' | 'medium' | 'hard';
  answers: string[];
  answerHash: string;
  source: 'ai' | 'manual';
  createdAt: string;
}

export interface RoundRuntime {
  id: string;
  roomCode: string;
  categoryId: string;
  status: 'countdown' | 'active' | 'finished';
  startedAt?: number;
  endedAt?: number;
  durationMs: number;
  acceptedAnswers: Set<string>;
  foundAnswers: Map<string, string>;
  scores: Map<string, number>;
}
