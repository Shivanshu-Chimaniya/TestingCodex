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
  status: 'lobby' | 'active' | 'finished';
  players: string[];
  createdAt: number;
  updatedAt: number;
}
