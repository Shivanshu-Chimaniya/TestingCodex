import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import type { Request, Response } from 'express';
import { createRoomSchema, joinRoomSchema } from './room.schema.js';
import * as roomService from './room.service.js';

export function createRoom(req: Request, res: Response) {
  const parsed = createRoomSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  if (!req.auth) return res.status(401).json({ error: 'UNAUTHORIZED' });

  try {
    const room = roomService.createRoom({
    hostUserId: req.auth.userId,
    visibility: parsed.data.visibility,
    name: parsed.data.name,
    password: parsed.data.password,
    maxPlayers: parsed.data.maxPlayers,
  });

  const websocketJoinToken = jwt.sign(
    { sub: req.auth.userId, roomCode: room.code, type: 'socket_join' },
    env.JWT_ACCESS_SECRET,
    { expiresIn: '5m' },
  );

    return res.status(201).json({ room, websocketJoinToken });
  } catch (error) {
    if (error instanceof Error && error.message === 'ROOM_NAME_MODERATION_BLOCKED') {
      return res.status(400).json({ error: 'ROOM_NAME_MODERATION_BLOCKED' });
    }
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
}

export function getRoom(req: Request, res: Response) {
  const room = roomService.getRoomByCode(req.params.code);
  if (!room) return res.status(404).json({ error: 'ROOM_NOT_FOUND' });
  return res.status(200).json({ room });
}

export function joinRoom(req: Request, res: Response) {
  const parsed = joinRoomSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  if (!req.auth) return res.status(401).json({ error: 'UNAUTHORIZED' });

  try {
    const room = roomService.joinRoom(req.params.code, req.auth.userId, parsed.data.password);
    return res.status(200).json({ room });
  } catch (error) {
    if (!(error instanceof Error)) return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
    if (error.message === 'ROOM_NOT_FOUND') return res.status(404).json({ error: error.message });
    if (error.message === 'FORBIDDEN') return res.status(403).json({ error: error.message });
    if (error.message === 'ROOM_FULL') return res.status(409).json({ error: error.message });
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
}

export function startRoom(req: Request, res: Response) {
  if (!req.auth) return res.status(401).json({ error: 'UNAUTHORIZED' });
  try {
    const room = roomService.startRoom(req.params.code, req.auth.userId);
    return res.status(200).json({ room });
  } catch (error) {
    if (!(error instanceof Error)) return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
    if (error.message === 'ROOM_NOT_FOUND') return res.status(404).json({ error: error.message });
    if (error.message === 'FORBIDDEN') return res.status(403).json({ error: error.message });
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
}

export function endRoom(req: Request, res: Response) {
  if (!req.auth) return res.status(401).json({ error: 'UNAUTHORIZED' });
  try {
    const room = roomService.endRoom(req.params.code, req.auth.userId);
    return res.status(200).json({ room });
  } catch (error) {
    if (!(error instanceof Error)) return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
    if (error.message === 'ROOM_NOT_FOUND') return res.status(404).json({ error: error.message });
    if (error.message === 'FORBIDDEN') return res.status(403).json({ error: error.message });
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
}

export function roomSnapshot(req: Request, res: Response) {
  const room = roomService.getRoomByCode(req.params.code);
  if (!room) return res.status(404).json({ error: 'ROOM_NOT_FOUND' });
  return res.status(200).json({ room, serverTs: Date.now() });
}
