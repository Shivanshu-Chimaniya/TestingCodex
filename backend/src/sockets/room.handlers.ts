import type { Server, Socket } from 'socket.io';
import * as gameEngine from '../modules/game/game.engine.js';
import * as roomService from '../modules/rooms/room.service.js';
import type { Ack, RoomJoinPayload, RoundStartPayload } from './events.js';

const presenceByRoom = new Map<string, Map<string, string>>();

function addPresence(roomCode: string, userId: string, socketId: string) {
  const roomPresence = presenceByRoom.get(roomCode) ?? new Map<string, string>();
  roomPresence.set(userId, socketId);
  presenceByRoom.set(roomCode, roomPresence);
}

export function makeRoomHandlers(io: Server, roundIntervals: Map<string, NodeJS.Timeout>) {
  const nsp = io.of('/game');

  function stopRoundTicker(roomCode: string) {
    const interval = roundIntervals.get(roomCode);
    if (!interval) return;
    clearInterval(interval);
    roundIntervals.delete(roomCode);
  }

  async function onRoomJoin(socket: Socket, payload: RoomJoinPayload, ack: Ack<{ state: unknown }>) {
    const user = socket.data.user as { id: string; username: string } | undefined;
    if (!user) return ack?.({ ok: false, code: 'UNAUTHORIZED' });

    try {
      const room = await roomService.getByCode(payload.roomCode);
      if (!room) return ack?.({ ok: false, code: 'ROOM_NOT_FOUND' });

      const allowed = await roomService.canJoin(room, user.id, payload.password);
      if (!allowed) return ack?.({ ok: false, code: 'FORBIDDEN' });

      await roomService.joinRoom(room.code, user.id, payload.password);
      await socket.join(room.code);
      addPresence(room.code, user.id, socket.id);

      const state = await gameEngine.getRoomState(room.code);
      ack?.({ ok: true, data: { state } });
      io.to(room.code).emit('room:player_joined', { userId: user.id, username: user.username });
    } catch (error) {
      if (error instanceof Error) {
        return ack?.({ ok: false, code: error.message });
      }
      return ack?.({ ok: false, code: 'UNKNOWN' });
    }
  }

  function onRoundStart(socket: Socket, payload: RoundStartPayload, ack: Ack<{ countdownMs: number }>) {
    const user = socket.data.user as { id: string } | undefined;
    if (!user) return ack?.({ ok: false, code: 'UNAUTHORIZED' });

    try {
      const room = roomService.getRoomByCode(payload.roomCode);
      if (!room) return ack?.({ ok: false, code: 'ROOM_NOT_FOUND' });
      if (room.hostUserId !== user.id) return ack?.({ ok: false, code: 'FORBIDDEN' });
      if (room.players.length < 1) return ack?.({ ok: false, code: 'NOT_ENOUGH_PLAYERS' });

      const countdownMs = 3000;
      gameEngine.beginCountdown(room.code, countdownMs);
      nsp.to(room.code).emit('round:countdown', { roomCode: room.code, countdownMs });
      ack?.({ ok: true, data: { countdownMs } });

      setTimeout(() => {
        const started = gameEngine.startRound(room.code, payload.durationMs ?? 60000, {
          difficulty: payload.difficulty,
        });

        nsp.to(room.code).emit('round:active', {
          roomCode: room.code,
          startedAt: started.startedAt,
          endsAt: started.endsAt,
        });

        stopRoundTicker(room.code);
        const ticker = setInterval(() => {
          const roomState = gameEngine.getRoomState(room.code);
          if (roomState.roundStatus !== 'active') {
            stopRoundTicker(room.code);
            return;
          }

          const remainingMs = Math.max(0, started.endsAt - Date.now());
          nsp.to(room.code).emit('round:tick', { roomCode: room.code, remainingMs });

          if (remainingMs === 0) {
            stopRoundTicker(room.code);
            const ended = gameEngine.endRound(room.code, started.endsAt);
            nsp.to(room.code).emit('round:end', ended);

            const results = gameEngine.finalizeResults(room.code);
            nsp.to(room.code).emit('leaderboard:update', results.leaderboard);
          }
        }, 250);
        roundIntervals.set(room.code, ticker);
      }, countdownMs);
    } catch (error) {
      if (error instanceof Error) {
        return ack?.({ ok: false, code: error.message });
      }
      return ack?.({ ok: false, code: 'UNKNOWN' });
    }
  }

  return {
    onRoomJoin,
    onRoundStart,
  };
}
