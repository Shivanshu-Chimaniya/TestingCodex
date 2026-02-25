import { Router } from 'express';
import * as leaderboardController from './leaderboard.controller.js';

export const leaderboardRouter = Router();

leaderboardRouter.get('/global', leaderboardController.globalLeaderboard);
leaderboardRouter.get('/room/:code', leaderboardController.roomLeaderboard);
