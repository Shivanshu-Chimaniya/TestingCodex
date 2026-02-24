import type { Server, Socket } from 'socket.io';
import * as roomService from '../modules/rooms/room.service.js';
import * as gameEngine from '../modules/game/game.engine.js';

type Ack<T> = ((value: { ok: true; data: T; seq?: number } | { ok: false; code: string; retryable?: boolean }) => void) | undefined;

const roomSeq = new Map<string, number>();

function nextSeq(roomCode: string) {
  const current = roomSeq.get(roomCode) ?? 0;
  const next = current + 1;
  roomSeq.set(roomCode, next);
  return next;
}

export function registerGameNamespace(io: Server) {
  const nsp = io.of('/game');

  nsp.on('connection', (socket: Socket) => {
    socket.on('room:join', async (payload: { roomCode: string; password?: string }, ack: Ack<{ state: unknown }>) => {
      const user = socket.data.user as { id: string; username: string } | undefined;
      if (!user) return ack?.({ ok: false, code: 'UNAUTHORIZED' });

      try {
        const room = roomService.joinRoom(payload.roomCode, user.id, payload.password);
        await socket.join(room.code);
        socket.data.roomCode = room.code;

        const state = gameEngine.getRoomState(room.code);
        const leaderboard = room.currentRoundId ? gameEngine.getLeaderboard(room.currentRoundId) : [];

        ack?.({ ok: true, data: { state }, seq: nextSeq(room.code) });
        nsp.to(room.code).emit('room:state', { seq: nextSeq(room.code), state });
        nsp.to(room.code).emit('leaderboard:update', { seq: nextSeq(room.code), leaderboard });
        nsp.to(room.code).emit('room:player_joined', { seq: nextSeq(room.code), userId: user.id, username: user.username });
      } catch (error) {
        if (!(error instanceof Error)) return ack?.({ ok: false, code: 'UNKNOWN' });
        return ack?.({ ok: false, code: error.message });
      }
    });

    socket.on('room:leave', async (_payload: unknown, ack: Ack<{ left: true }>) => {
      const roomCode = socket.data.roomCode as string | undefined;
      if (!roomCode) return ack?.({ ok: false, code: 'NOT_IN_ROOM' });

      await socket.leave(roomCode);
      socket.data.roomCode = undefined;
      ack?.({ ok: true, data: { left: true }, seq: nextSeq(roomCode) });
    });

    socket.on('round:start', (payload: { roomCode: string; categoryId: string }, ack: Ack<{ roundId: string }>) => {
      try {
        const round = gameEngine.startRound(payload.roomCode, payload.categoryId);
        ack?.({ ok: true, data: { roundId: round.id }, seq: nextSeq(payload.roomCode) });

        nsp.to(payload.roomCode).emit('round:countdown', { seq: nextSeq(payload.roomCode), seconds: 3 });
        setTimeout(() => {
          nsp.to(payload.roomCode).emit('round:active', { seq: nextSeq(payload.roomCode), roundId: round.id });

          const timer = setInterval(() => {
            const remainingMs = Math.max(0, round.durationMs - (Date.now() - (round.startedAt ?? Date.now())));
            nsp.to(payload.roomCode).emit('round:tick', { seq: nextSeq(payload.roomCode), remainingMs });

            if (remainingMs <= 0) {
              clearInterval(timer);
              gameEngine.finishRound(round.id);
              const leaderboard = gameEngine.getLeaderboard(round.id);
              nsp.to(payload.roomCode).emit('round:end', { seq: nextSeq(payload.roomCode), leaderboard });
            }
          }, 1000);
        }, 3000);
      } catch (error) {
        const code = error instanceof Error ? error.message : 'UNKNOWN';
        ack?.({ ok: false, code, retryable: true });
      }
    });

    socket.on('answer:submit', (payload: { roundId: string; answer: string }, ack: Ack<{ points: number }>) => {
      const user = socket.data.user as { id: string; username: string } | undefined;
      const roomCode = socket.data.roomCode as string | undefined;
      if (!user || !roomCode) return ack?.({ ok: false, code: 'UNAUTHORIZED' });

      const result = gameEngine.submitAnswer(payload.roundId, user.id, payload.answer);
      if (!result.ok) {
        nsp.to(socket.id).emit('answer:rejected', { seq: nextSeq(roomCode), code: result.code });
        return ack?.({ ok: false, code: result.code });
      }

      const leaderboard = gameEngine.getLeaderboard(payload.roundId);
      nsp.to(roomCode).emit('answer:accepted', { seq: nextSeq(roomCode), userId: user.id, points: result.points });
      nsp.to(roomCode).emit('leaderboard:update', { seq: nextSeq(roomCode), leaderboard });
      return ack?.({ ok: true, data: { points: result.points }, seq: nextSeq(roomCode) });
    });

    socket.on('ping:latency', (_payload: unknown, ack: Ack<{ serverTs: number }>) => {
      const roomCode = (socket.data.roomCode as string | undefined) ?? 'global';
      ack?.({ ok: true, data: { serverTs: Date.now() }, seq: nextSeq(roomCode) });
    });
  });
}
