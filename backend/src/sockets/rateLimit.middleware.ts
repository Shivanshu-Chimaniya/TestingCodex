import type { Socket } from 'socket.io';
import { allowRequest } from '../modules/performance/rateLimiter.js';

export async function socketEventAllowed(socket: Socket) {
  const ip = socket.handshake.address || 'unknown';
  const userId = (socket.data.user as { id?: string } | undefined)?.id;
  return allowRequest({ ip, userId }, 'socket');
}
