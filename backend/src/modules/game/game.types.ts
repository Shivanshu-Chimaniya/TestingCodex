export type RoundStatus = 'idle' | 'countdown' | 'active' | 'ended';

export interface LeaderboardEntry {
  userId: string;
  score: number;
}

export interface RoomRuntime {
  acceptedAnswers: Set<string>;
  foundAnswers: Set<string>;
  scores: Map<string, number>;
  roundStatus: RoundStatus;
  startedAt: number | null;
  endsAt: number | null;
  recentSubmissions: Map<string, number[]>;
}
