import { create } from 'zustand';

export type LeaderboardEntry = { userId: string; name: string; score: number; rank: number };

type GameStore = {
  roomId?: string;
  leaderboardSeq: number;
  leaderboard: LeaderboardEntry[];
  acceptedAnswerIds: string[];
  lockInput: boolean;
  setLockInput: (locked: boolean) => void;
  markAcceptedAnswer: (answerId: string) => void;
  applyLeaderboardUpdate: (seq: number, leaderboard: LeaderboardEntry[]) => { gapDetected: boolean };
  forceSyncLeaderboard: (seq: number, leaderboard: LeaderboardEntry[]) => void;
};

export const useGameStore = create<GameStore>((set, get) => ({
  roomId: undefined,
  leaderboardSeq: 0,
  leaderboard: [],
  acceptedAnswerIds: [],
  lockInput: false,
  setLockInput: (lockInput) => set({ lockInput }),
  markAcceptedAnswer: (answerId) =>
    set((state) =>
      state.acceptedAnswerIds.includes(answerId)
        ? state
        : { acceptedAnswerIds: [...state.acceptedAnswerIds, answerId] },
    ),
  applyLeaderboardUpdate: (seq, leaderboard) => {
    const prev = get().leaderboardSeq;
    if (seq <= prev) {
      return { gapDetected: false };
    }

    if (seq !== prev + 1) {
      return { gapDetected: true };
    }

    set({ leaderboardSeq: seq, leaderboard });
    return { gapDetected: false };
  },
  forceSyncLeaderboard: (seq, leaderboard) => set({ leaderboardSeq: seq, leaderboard }),
}));
