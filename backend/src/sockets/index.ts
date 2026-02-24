import { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { socketAuth } from './auth.middleware.js';
import { registerGameNamespace } from './game.namespace.js';

export function createSocketServer(server: HttpServer) {
  const io = new Server(server, {
    cors: { origin: '*' },
  });

  io.of('/game').use(socketAuth);
  registerGameNamespace(io);

  return io;
}
