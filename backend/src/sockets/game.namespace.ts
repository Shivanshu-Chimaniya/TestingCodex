import type { Server, Socket } from 'socket.io';
import * as roomService from '../modules/rooms/room.service.js';
import * as gameEngine from '../modules/game/game.engine.js';

type Ack<T> = ((value: { ok: true; data: T } | { ok: false; code: string }) => void) | undefined;

export function registerGameNamespace(io: Server) {
  const nsp = io.of('/game');

  nsp.on('connection', (socket: Socket) => {
    socket.on('room:join', async (payload: { roomCode: string; password?: string }, ack: Ack<{ state: unknown }>) => {
      const user = socket.data.user as { id: string; username: string } | undefined;
      if (!user) return ack?.({ ok: false, code: 'UNAUTHORIZED' });

      try {
        const room = roomService.joinRoom(payload.roomCode, user.id, payload.password);
        await socket.join(room.code);
        const state = gameEngine.getRoomState(room.code);

        ack?.({ ok: true, data: { state } });
        nsp.to(room.code).emit('room:player_joined', { userId: user.id, username: user.username });
      } catch (error) {
        if (!(error instanceof Error)) return ack?.({ ok: false, code: 'UNKNOWN' });
        return ack?.({ ok: false, code: error.message });
      }
    });
  });
}
