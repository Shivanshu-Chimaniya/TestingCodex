import { logger } from '../config/logger.js';
import { redis } from '../config/redis.js';
import * as gameEngine from '../modules/game/game.engine.js';
import * as roomService from '../modules/rooms/room.service.js';

export async function roomCleanupJob() {
  const staleRooms = gameEngine.staleRooms();

  for (const room of staleRooms) {
    await gameEngine.clearRoomRuntime(room.code);
    roomService.deleteRoom(room.code);

    const keys = await redis.keys(`room:${room.code}:*`);
    if (keys.length) await redis.del(...keys);
  }

  if (staleRooms.length > 0) {
    logger.info('roomCleanup.job removed stale rooms', staleRooms.map((room) => room.code));
  }
}
