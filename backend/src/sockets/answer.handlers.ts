import type { Server, Socket } from 'socket.io';
import * as gameEngine from '../modules/game/game.engine.js';
import type { Ack, AnswerSubmitPayload } from './events.js';

export function makeAnswerHandlers(io: Server) {
  const nsp = io.of('/game');

  async function onAnswerSubmit(
    socket: Socket,
    payload: AnswerSubmitPayload,
    ack: Ack<{ normalized: string; pointsAwarded: number }>,
  ) {
    const user = socket.data.user as { id: string } | undefined;
    if (!user) return ack?.({ ok: false, code: 'UNAUTHORIZED' });

    const result = await gameEngine.submitAnswer(payload.roomCode, user.id, payload.answer);
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

    if (result.data.allAnswersFound) {
      const ended = gameEngine.endRound(payload.roomCode);
      nsp.to(payload.roomCode).emit('round:end', ended);

      const results = gameEngine.finalizeResults(payload.roomCode);
      nsp.to(payload.roomCode).emit('leaderboard:update', results.leaderboard);
    }

    return ack?.({
      ok: true,
      data: {
        normalized: result.data.normalized,
        pointsAwarded: result.data.pointsAwarded,
      },
    });
  }

  return { onAnswerSubmit };
}
