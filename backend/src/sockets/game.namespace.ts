import type { Server, Socket } from 'socket.io';
import { makeAnswerHandlers } from './answer.handlers.js';
import type { AnswerSubmitPayload, RoomJoinPayload, RoundStartPayload } from './events.js';
import { makeRoomHandlers } from './room.handlers.js';

export function registerGameNamespace(io: Server) {
  const nsp = io.of('/game');
  const roundIntervals = new Map<string, NodeJS.Timeout>();

  const roomHandlers = makeRoomHandlers(io, roundIntervals);
  const answerHandlers = makeAnswerHandlers(io);

  nsp.on('connection', (socket: Socket) => {
    socket.on('room:join', (payload: RoomJoinPayload, ack) => roomHandlers.onRoomJoin(socket, payload, ack));

    socket.on('room:leave', (payload: { roomCode: string }, ack) => {
      socket.leave(payload.roomCode);
      nsp.to(payload.roomCode).emit('room:player_left', { userId: socket.data.user?.id });
      ack?.({ ok: true, data: { left: true } });
    });

    socket.on('round:start', (payload: RoundStartPayload, ack) => roomHandlers.onRoundStart(socket, payload, ack));

    socket.on('round:ready', (_payload: { roomCode: string }, ack) => {
      ack?.({ ok: true, data: { ready: true } });
    });

    socket.on('answer:submit', (payload: AnswerSubmitPayload, ack) => answerHandlers.onAnswerSubmit(socket, payload, ack));

    socket.on('ping:latency', (payload: { sentAt: number }, ack) => {
      ack?.({ ok: true, data: { sentAt: payload.sentAt, receivedAt: Date.now() } });
    });

    socket.on('disconnecting', () => {
      for (const roomCode of socket.rooms) {
        if (roomCode !== socket.id) {
          nsp.to(roomCode).emit('room:player_left', { userId: socket.data.user?.id });
        }
      }
    });
  });
}
