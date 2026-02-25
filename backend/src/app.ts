import cors from 'cors';
import express from 'express';
import { errorMiddleware } from './middlewares/error.middleware.js';
import { simpleRateLimit } from './middlewares/rateLimit.middleware.js';
import { authMiddleware } from './middlewares/auth.middleware.js';
import { me } from './modules/auth/auth.controller.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { leaderboardRouter } from './modules/leaderboard/leaderboard.routes.js';
import { roomRouter } from './modules/rooms/room.routes.js';
import { aiRouter } from './modules/ai/ai.routes.js';
import { categoriesRouter } from './modules/categories/categories.routes.js';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(simpleRateLimit());

  app.get('/health', (_req, res) => {
    res.status(200).json({ ok: true });
  });

  app.use('/api/auth', authRouter);
  app.get('/api/me', authMiddleware, me);
  app.use('/api/ai', aiRouter);
  app.use('/api/categories', categoriesRouter);
  app.use('/api/leaderboards', leaderboardRouter);
  app.use('/api/rooms', roomRouter);

  app.use(errorMiddleware);

  return app;
}
