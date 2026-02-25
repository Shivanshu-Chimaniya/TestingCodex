export type RoundStatus = 'lobby' | 'countdown' | 'active' | 'finished' | 'results';
export type RoundDifficulty = 'easy' | 'medium' | 'hard';

export interface LeaderboardEntry {
  userId: string;
  score: number;
  uniqueCorrectAnswers: number;
  lastCorrectAt: number | null;
  rank: number;
}

export interface PlayerRoundStats {
  score: number;
  uniqueCorrectAnswers: number;
  streak: number;
  lastCorrectAt: number | null;
  duplicateCount: number;
}

export interface RoomRuntime {
  acceptedAnswers: Set<string>;
  foundAnswers: Set<string>;
  foundAnswerOwners: Map<string, string>;
  playerStats: Map<string, PlayerRoundStats>;
  roundStatus: RoundStatus;
  countdownEndsAt: number | null;
  startedAt: number | null;
  endsAt: number | null;
  finishedAt: number | null;
  roundDurationMs: number;
  difficulty: RoundDifficulty;
  graceWindowMs: number;
  competitiveMode: {
    enabled: boolean;
    duplicateThreshold: number;
    duplicateDecayPoints: number;
  };
  recentSubmissions: Map<string, number[]>;
}
