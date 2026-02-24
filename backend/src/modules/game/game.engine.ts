import * as roomService from '../rooms/room.service.js';

export function getRoomState(roomCode: string) {
  const room = roomService.getRoomByCode(roomCode);
  if (!room) {
    throw new Error('ROOM_NOT_FOUND');
  }

  return {
    roomCode: room.code,
    status: room.status,
    hostUserId: room.hostUserId,
    players: room.players,
  };
}
