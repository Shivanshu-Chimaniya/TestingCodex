import { Router } from 'express';
import { validateBody } from '../../middlewares/validate.middleware.js';
import { loginSchema, refreshSchema, registerSchema } from './auth.schema.js';
import * as authController from './auth.controller.js';

export const authRouter = Router();

authRouter.post('/register', validateBody(registerSchema), authController.register);
authRouter.post('/login', validateBody(loginSchema), authController.login);
authRouter.post('/refresh', validateBody(refreshSchema), authController.refresh);
