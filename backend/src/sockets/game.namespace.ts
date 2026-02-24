import type { Server, Socket } from 'socket.io';
import * as roomService from '../modules/rooms/room.service.js';
import * as gameEngine from '../modules/game/game.engine.js';

type Ack<T> = ((value: { ok: true; data: T } | { ok: false; code: string }) => void) | undefined;

export function registerGameNamespace(io: Server) {
  const nsp = io.of('/game');
  const roundIntervals = new Map<string, NodeJS.Timeout>();

  function stopRoundTicker(roomCode: string) {
    const interval = roundIntervals.get(roomCode);
    if (interval) {
      clearInterval(interval);
      roundIntervals.delete(roomCode);
    }
  }

  nsp.on('connection', (socket: Socket) => {
    socket.on('room:join', async (payload: { roomCode: string; password?: string }, ack: Ack<{ state: unknown }>) => {
      const user = socket.data.user as { id: string; username: string } | undefined;
      if (!user) return ack?.({ ok: false, code: 'UNAUTHORIZED' });

      try {
        const room = roomService.joinRoom(payload.roomCode, user.id, payload.password);
        await socket.join(room.code);
        const state = gameEngine.getRoomState(room.code);
        const leaderboard = gameEngine.getLeaderboard(room.code);

        ack?.({ ok: true, data: { state } });
        socket.emit('room:state', state);
        socket.emit('leaderboard:update', leaderboard);
        nsp.to(room.code).emit('room:player_joined', { userId: user.id, username: user.username });
      } catch (error) {
        if (!(error instanceof Error)) return ack?.({ ok: false, code: 'UNKNOWN' });
        return ack?.({ ok: false, code: error.message });
      }
    });

    socket.on('round:start', (payload: { roomCode: string; durationMs?: number }, ack: Ack<{ countdownMs: number }>) => {
      const user = socket.data.user as { id: string } | undefined;
      if (!user) return ack?.({ ok: false, code: 'UNAUTHORIZED' });

      try {
        const room = roomService.getRoomByCode(payload.roomCode);
        if (!room) return ack?.({ ok: false, code: 'ROOM_NOT_FOUND' });
        if (room.hostUserId !== user.id) return ack?.({ ok: false, code: 'FORBIDDEN' });
        if (room.players.length < 1) return ack?.({ ok: false, code: 'NOT_ENOUGH_PLAYERS' });

        const countdownMs = 3000;
        nsp.to(room.code).emit('round:countdown', { roomCode: room.code, countdownMs });
        ack?.({ ok: true, data: { countdownMs } });

        setTimeout(() => {
          const started = gameEngine.startRound(room.code, payload.durationMs ?? 60000);
          nsp.to(room.code).emit('round:active', {
            roomCode: room.code,
            startedAt: started.startedAt,
            endsAt: started.endsAt,
          });

          stopRoundTicker(room.code);
          const ticker = setInterval(() => {
            const remainingMs = Math.max(0, started.endsAt - Date.now());
            nsp.to(room.code).emit('round:tick', { roomCode: room.code, remainingMs });

            if (remainingMs === 0) {
              stopRoundTicker(room.code);
              const ended = gameEngine.endRound(room.code);
              nsp.to(room.code).emit('round:end', ended);
            }
          }, 1000);
          roundIntervals.set(room.code, ticker);
        }, countdownMs);
      } catch (error) {
        if (!(error instanceof Error)) return ack?.({ ok: false, code: 'UNKNOWN' });
        return ack?.({ ok: false, code: error.message });
      }
    });

    socket.on(
      'answer:submit',
      (
        payload: { roomCode: string; answer: string; clientTimestamp?: number },
        ack: Ack<{ normalized: string; pointsAwarded: number }>,
      ) => {
        const user = socket.data.user as { id: string } | undefined;
        if (!user) return ack?.({ ok: false, code: 'UNAUTHORIZED' });

        const result = gameEngine.submitAnswer(payload.roomCode, user.id, payload.answer);
        if (!result.ok) {
          socket.emit('answer:rejected', { roomCode: payload.roomCode, code: result.code });
          return ack?.({ ok: false, code: result.code });
        }

        nsp.to(payload.roomCode).emit('answer:accepted', {
          roomCode: payload.roomCode,
          userId: user.id,
          normalized: result.data.normalized,
          pointsAwarded: result.data.pointsAwarded,
          serverReceivedAt: Date.now(),
        });
        nsp.to(payload.roomCode).emit('leaderboard:update', result.data.leaderboard);
        return ack?.({
          ok: true,
          data: {
            normalized: result.data.normalized,
            pointsAwarded: result.data.pointsAwarded,
          },
        });
      },
    );

    socket.on('disconnecting', () => {
      for (const roomCode of socket.rooms) {
        if (roomCode !== socket.id) {
          nsp.to(roomCode).emit('room:player_left', { userId: socket.data.user?.id });
        }
      }
    });
  });
}
