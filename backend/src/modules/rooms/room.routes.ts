import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import * as roomController from './room.controller.js';

export const roomRouter = Router();

roomRouter.post('/', authMiddleware, roomController.createRoom);
roomRouter.get('/:code', roomController.getRoom);
roomRouter.post('/:code/join', authMiddleware, roomController.joinRoom);
roomRouter.post('/:code/start', authMiddleware, roomController.startRoom);
roomRouter.post('/:code/end', authMiddleware, roomController.endRoom);
roomRouter.get('/:code/snapshot', roomController.roomSnapshot);
