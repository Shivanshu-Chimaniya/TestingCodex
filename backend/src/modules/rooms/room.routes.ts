import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import * as roomController from './room.controller.js';
import { createRoomSchema, joinRoomSchema } from './room.schema.js';

export const roomRouter = Router();

roomRouter.post('/', authMiddleware, validateBody(createRoomSchema), roomController.createRoom);
roomRouter.get('/:code', roomController.getRoom);
roomRouter.post('/:code/join', authMiddleware, validateBody(joinRoomSchema), roomController.joinRoom);
roomRouter.post('/:code/start', authMiddleware, roomController.startRoom);
roomRouter.post('/:code/end', authMiddleware, roomController.endRoom);
roomRouter.get('/:code/snapshot', roomController.roomSnapshot);
