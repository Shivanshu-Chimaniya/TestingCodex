import { z } from 'zod';

export const createRoomSchema = z.object({
  visibility: z.enum(['public', 'private']).default('private'),
  password: z.string().min(1).optional(),
  maxPlayers: z.number().int().min(2).max(100).default(20),
  roundDurationSec: z.number().int().min(15).max(300).default(60),
  aiProvider: z.enum(['gemini', 'openai']).default('gemini'),
});

export const joinRoomSchema = z.object({
  password: z.string().optional(),
});
