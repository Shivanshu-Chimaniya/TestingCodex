import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
  timeout: 10_000,
});

export type LeaderboardSnapshot = {
  seq: number;
  leaderboard: Array<{ userId: string; name: string; score: number; rank: number }>;
};

export const getLeaderboardSnapshot = async (roomId: string) => {
  const { data } = await api.get<LeaderboardSnapshot>(`/rooms/${roomId}/snapshot`);
  return data;
};
