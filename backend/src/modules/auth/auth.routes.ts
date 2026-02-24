import { Router } from 'express';
import * as authController from './auth.controller.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';

export const authRouter = Router();

authRouter.post('/register', authController.register);
authRouter.post('/login', authController.login);
authRouter.post('/refresh', authController.refresh);
authRouter.post('/logout', authController.logout);
authRouter.get('/me', authMiddleware, authController.me);
