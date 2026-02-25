import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import * as aiController from './ai.controller.js';

export const aiRouter = Router();

aiRouter.post('/categories/generate', authMiddleware, aiController.generateCategory);
