import type { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export type SocketUser = { id: string; username: string; tokenExp: number };

function decodeAccessToken(token: string) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as { sub: string; username: string; exp?: number };
}

export function attachSocketUser(socket: Socket, token: string) {
  const payload = decodeAccessToken(token);
  socket.data.user = {
    id: payload.sub,
    username: payload.username,
    tokenExp: payload.exp ?? Math.floor(Date.now() / 1000),
  } satisfies SocketUser;
}

export function socketAuth(socket: Socket, next: (err?: Error) => void) {
  try {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error('UNAUTHORIZED'));

    attachSocketUser(socket, token);
    return next();
  } catch {
    return next(new Error('UNAUTHORIZED'));
  }
}
