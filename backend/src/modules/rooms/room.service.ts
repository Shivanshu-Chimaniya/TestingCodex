import type { Room } from '../../types/models.js';

const roomsByCode = new Map<string, Room>();

function generateCode() {
  return Math.random().toString(36).slice(2, 7).toUpperCase();
}

export function createRoom(input: {
  hostUserId: string;
  visibility: 'public' | 'private';
  password?: string;
  maxPlayers: number;
}) {
  let code = generateCode();
  while (roomsByCode.has(code)) code = generateCode();

  const room: Room = {
    code,
    hostUserId: input.hostUserId,
    visibility: input.visibility,
    password: input.password,
    maxPlayers: input.maxPlayers,
    status: 'lobby',
    players: [input.hostUserId],
  };
  roomsByCode.set(code, room);
  return room;
}

export function getRoomByCode(code: string) {
  return roomsByCode.get(code) ?? null;
}

export function joinRoom(code: string, userId: string, password?: string) {
  const room = getRoomByCode(code);
  if (!room) throw new Error('ROOM_NOT_FOUND');
  if (room.visibility === 'private' && room.password !== password) throw new Error('FORBIDDEN');
  if (room.players.includes(userId)) return room;
  if (room.players.length >= room.maxPlayers) throw new Error('ROOM_FULL');

  room.players.push(userId);
  return room;
}

export function startRoom(code: string, userId: string) {
  const room = getRoomByCode(code);
  if (!room) throw new Error('ROOM_NOT_FOUND');
  if (room.hostUserId !== userId) throw new Error('FORBIDDEN');
  room.status = 'active';
  return room;
}
