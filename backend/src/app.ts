import express from 'express';
import cors from 'cors';
import { authRouter } from './modules/auth/auth.routes.js';
import { roomRouter } from './modules/rooms/room.routes.js';
import { aiRouter } from './modules/ai/ai.routes.js';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.status(200).json({ ok: true });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/rooms', roomRouter);
  app.use('/api/ai', aiRouter);

  return app;
}
