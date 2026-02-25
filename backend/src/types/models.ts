export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
}

export interface Room {
  code: string;
  hostUserId: string;
  visibility: 'public' | 'private';
  name: string;
  password?: string;
  maxPlayers: number;
  status: 'lobby' | 'active' | 'finished';
  players: string[];
  createdAt: number;
  updatedAt: number;
}
