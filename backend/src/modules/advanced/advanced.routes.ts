import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import * as advancedController from './advanced.controller.js';

export const advancedRouter = Router();

advancedRouter.get('/ranked/profile', authMiddleware, advancedController.getMyRankProfile);
advancedRouter.post('/ranked/queue', authMiddleware, advancedController.queueForRanked);
advancedRouter.post('/ranked/match-report', authMiddleware, advancedController.reportRankedMatch);
advancedRouter.post('/ranked/season-reset', authMiddleware, advancedController.resetRankedSeason);

advancedRouter.post('/difficulty/skill-signal', authMiddleware, advancedController.recordSkillSignal);
advancedRouter.get('/difficulty/recommendation', authMiddleware, advancedController.suggestDifficulty);

advancedRouter.post('/marketplace/packs', authMiddleware, advancedController.createMarketplacePack);
advancedRouter.get('/marketplace/packs', advancedController.listMarketplacePacks);
advancedRouter.post('/marketplace/moderate', authMiddleware, advancedController.moderateMarketplacePack);
advancedRouter.post('/marketplace/purchase', authMiddleware, advancedController.purchaseMarketplacePack);

advancedRouter.post('/analytics/activity', authMiddleware, advancedController.recordAnalyticsActivity);
advancedRouter.post('/analytics/room-funnel', advancedController.recordRoomFunnelEvent);
advancedRouter.post('/analytics/answer-heatmap', advancedController.recordAnswerHeatmapEvent);
advancedRouter.post('/analytics/model-quality', advancedController.recordModelQualityEvent);
advancedRouter.get('/analytics/dashboard', advancedController.getAnalyticsDashboard);
