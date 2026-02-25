import { create } from 'zustand';

type User = { id: string; username: string };

type AuthStore = {
  token?: string;
  user?: User;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
};

export const useAuthStore = create<AuthStore>((set) => ({
  token: undefined,
  user: undefined,
  setAuth: (token, user) => set({ token, user }),
  logout: () => set({ token: undefined, user: undefined }),
}));
