import type { Room } from '../../types/models.js';

const roomsByCode = new Map<string, Room>();

export function generateRoomCode() {
  return Math.random().toString(36).slice(2, 7).toUpperCase();
}

export function saveRoom(room: Room) {
  room.updatedAt = Date.now();
  roomsByCode.set(room.code, room);
  return room;
}

export function findRoomByCode(code: string) {
  return roomsByCode.get(code) ?? null;
}

export function touchRoom(code: string) {
  const room = roomsByCode.get(code);
  if (!room) return null;
  room.updatedAt = Date.now();
  return room;
}

export function deleteRoom(code: string) {
  return roomsByCode.delete(code);
}

export function listRooms() {
  return [...roomsByCode.values()];
}

export function roomCodeExists(code: string) {
  return roomsByCode.has(code);
}
