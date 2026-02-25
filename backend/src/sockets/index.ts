import { Server as HttpServer } from 'node:http';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';
import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { socketAuth } from './auth.middleware.js';
import { registerGameNamespace } from './game.namespace.js';

export async function createSocketServer(server: HttpServer) {
  const io = new Server(server, {
    cors: { origin: '*' },
  });

  if (env.REDIS_URL) {
    const pubClient = createClient({ url: env.REDIS_URL });
    const subClient = pubClient.duplicate();
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    logger.info('socket.io redis adapter enabled');
  } else {
    logger.warn('socket.io redis adapter disabled (REDIS_URL missing)');
  }

  io.of('/game').use(socketAuth);
  registerGameNamespace(io);

  return io;
}
