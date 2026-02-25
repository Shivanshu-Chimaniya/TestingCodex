import { z } from 'zod';
import { canonicalizeString } from '../../utils/sanitize.js';

export const createRoomSchema = z.object({
  name: z.string().min(3).max(40).transform(canonicalizeString).default('New Room'),
  visibility: z.enum(['public', 'private']).default('private'),
  password: z.string().min(1).optional(),
  maxPlayers: z.number().int().min(2).max(100).default(20),
});

export const joinRoomSchema = z.object({
  password: z.string().optional(),
});
