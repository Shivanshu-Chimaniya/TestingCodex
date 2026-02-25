import type { Room } from '../../types/models.js';

const roomsByCode = new Map<string, Room>();

export function generateRoomCode() {
  return Math.random().toString(36).slice(2, 7).toUpperCase();
}

export function saveRoom(room: Room) {
  roomsByCode.set(room.code, room);
  return room;
}

export function findRoomByCode(code: string) {
  return roomsByCode.get(code) ?? null;
}

export function roomCodeExists(code: string) {
  return roomsByCode.has(code);
}
