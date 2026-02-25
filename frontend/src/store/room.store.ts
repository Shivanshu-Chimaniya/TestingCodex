import { create } from 'zustand';

export type LobbyPlayer = { id: string; name: string; isHost: boolean; ready: boolean };

type RoomStore = {
  roomId?: string;
  isPrivate: boolean;
  countdown: number;
  minPlayers: number;
  players: LobbyPlayer[];
  setLobbyState: (payload: Partial<Omit<RoomStore, 'setLobbyState' | 'canStart'>>) => void;
  canStart: (userId?: string) => boolean;
};

export const useRoomStore = create<RoomStore>((set, get) => ({
  roomId: undefined,
  isPrivate: false,
  countdown: 0,
  minPlayers: 2,
  players: [],
  setLobbyState: (payload) => set((state) => ({ ...state, ...payload })),
  canStart: (userId) => {
    const state = get();
    const isHost = state.players.some((p) => p.id === userId && p.isHost);
    return isHost && state.players.length >= state.minPlayers && state.countdown === 0;
  },
}));
