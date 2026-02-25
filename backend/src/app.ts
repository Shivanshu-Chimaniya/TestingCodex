import cors from 'cors';
import express from 'express';
import { errorMiddleware } from './middlewares/error.middleware.js';
import { simpleRateLimit } from './middlewares/rateLimit.middleware.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { roomRouter } from './modules/rooms/room.routes.js';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(simpleRateLimit());

  app.get('/health', (_req, res) => {
    res.status(200).json({ ok: true });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/rooms', roomRouter);

  app.use(errorMiddleware);

  return app;
}
