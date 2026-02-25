import type { Request, Response } from 'express';
import * as gameEngine from '../game/game.engine.js';

export function globalLeaderboard(_req: Request, res: Response) {
  return res.status(200).json({ leaderboard: [] });
}

export function roomLeaderboard(req: Request, res: Response) {
  try {
    const leaderboard = gameEngine.getLeaderboard(req.params.code);
    return res.status(200).json({ leaderboard });
  } catch {
    return res.status(404).json({ error: 'ROOM_NOT_FOUND' });
  }
}
