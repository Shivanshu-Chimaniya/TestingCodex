import type { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function socketAuth(socket: Socket, next: (err?: Error) => void) {
  try {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error('UNAUTHORIZED'));

    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as { sub: string; username: string };
    socket.data.user = { id: payload.sub, username: payload.username };
    return next();
  } catch {
    return next(new Error('UNAUTHORIZED'));
  }
}
