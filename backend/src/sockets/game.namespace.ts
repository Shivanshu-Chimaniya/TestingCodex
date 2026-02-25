import type { Server, Socket } from 'socket.io';
import { socketEventAllowed } from './rateLimit.middleware.js';
import { makeAnswerHandlers } from './answer.handlers.js';
import type { AnswerSubmitPayload, RoomJoinPayload, RoundStartPayload } from './events.js';
import { makeRoomHandlers } from './room.handlers.js';
import { attachSocketUser } from './auth.middleware.js';
import { logger } from '../config/logger.js';

const REAUTH_GRACE_SECONDS = 60;

function needsReauth(socket: Socket) {
  const exp = (socket.data.user as { tokenExp?: number } | undefined)?.tokenExp;
  if (!exp) return true;
  return exp - Math.floor(Date.now() / 1000) < REAUTH_GRACE_SECONDS;
}

export function registerGameNamespace(io: Server) {
  const nsp = io.of('/game');
  const roundIntervals = new Map<string, NodeJS.Timeout>();
  const socketToRooms = new WeakMap<Socket, Set<string>>();

  const roomHandlers = makeRoomHandlers(io, roundIntervals);
  const answerHandlers = makeAnswerHandlers(io);

  nsp.on('connection', (socket: Socket) => {
    socketToRooms.set(socket, new Set<string>());

    logger.withContext({ userId: socket.data.user?.id }, () => {
      logger.info('socket.connected', { socketId: socket.id });
    });

    socket.use(async (_packet, next) => {
      const allowed = await socketEventAllowed(socket);
      if (!allowed) return next(new Error('RATE_LIMITED'));
      if (needsReauth(socket)) {
        socket.emit('auth:reauth_required', { reason: 'ACCESS_TOKEN_EXPIRING' });
      }
      return next();
    });

    socket.on('auth:reauth', (payload: { token: string }, ack) => {
      try {
        attachSocketUser(socket, payload.token);
        ack?.({ ok: true, data: { reauthenticated: true } });
      } catch {
        ack?.({ ok: false, code: 'UNAUTHORIZED' });
      }
    });

    socket.on('room:join', (payload: RoomJoinPayload, ack) => {
      socketToRooms.get(socket)?.add(payload.roomCode);
      roomHandlers.onRoomJoin(socket, payload, ack);
    });

    socket.on('room:leave', (payload: { roomCode: string }, ack) => {
      socketToRooms.get(socket)?.delete(payload.roomCode);
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

    socket.on('disconnect', (reason) => {
      socketToRooms.delete(socket);
      logger.withContext({ userId: socket.data.user?.id }, () => {
        logger.trackSocketDisconnect({ socketId: socket.id, reason });
      });
    });
  });
}
