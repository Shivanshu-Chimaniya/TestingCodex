import type { Room } from '../../types/models.js';
import * as roomRepo from './room.repo.js';

export function createRoom(input: {
  hostUserId: string;
  visibility: 'public' | 'private';
  password?: string;
  maxPlayers: number;
}) {
  let code = roomRepo.generateRoomCode();
  while (roomRepo.roomCodeExists(code)) code = roomRepo.generateRoomCode();

  const room: Room = {
    code,
    hostUserId: input.hostUserId,
    visibility: input.visibility,
    password: input.password,
    maxPlayers: input.maxPlayers,
    status: 'lobby',
    players: [input.hostUserId],
  };

  return roomRepo.saveRoom(room);
}

export function getRoomByCode(code: string) {
  return roomRepo.findRoomByCode(code);
}

export function getByCode(code: string) {
  return getRoomByCode(code);
}

export function canJoin(room: Room, userId: string, password?: string) {
  if (room.players.includes(userId)) return true;
  if (room.visibility === 'private' && room.password !== password) return false;
  if (room.players.length >= room.maxPlayers) return false;
  return true;
}

export function joinRoom(code: string, userId: string, password?: string) {
  const room = getRoomByCode(code);
  if (!room) throw new Error('ROOM_NOT_FOUND');
  if (!canJoin(room, userId, password)) throw new Error('FORBIDDEN');
  if (room.players.includes(userId)) return room;

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

export function endRoom(code: string, userId: string) {
  const room = getRoomByCode(code);
  if (!room) throw new Error('ROOM_NOT_FOUND');
  if (room.hostUserId !== userId) throw new Error('FORBIDDEN');
  room.status = 'finished';
  return room;
}
