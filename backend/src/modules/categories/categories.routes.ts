import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import * as categoriesController from './categories.controller.js';

export const categoriesRouter = Router();

categoriesRouter.post('/:id/save', authMiddleware, categoriesController.saveCategory);
categoriesRouter.get('/public', categoriesController.listPublicCategories);
categoriesRouter.get('/mine', authMiddleware, categoriesController.listMyCategories);
