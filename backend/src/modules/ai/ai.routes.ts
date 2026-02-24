import { Router } from 'express';
import * as aiController from './ai.controller.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';

export const aiRouter = Router();

aiRouter.post('/categories/generate', authMiddleware, aiController.generateCategory);
