import crypto from 'node:crypto';
import type { User } from '../../types/models.js';

const usersByEmail = new Map<string, User>();
const refreshTokenHashes = new Set<string>();

export function createUser(input: { username: string; email: string; password: string }): User {
  if (usersByEmail.has(input.email)) {
    throw new Error('EMAIL_TAKEN');
  }

  const user: User = {
    id: crypto.randomUUID(),
    username: input.username,
    email: input.email,
    password: input.password,
  };

  usersByEmail.set(user.email, user);
  return user;
}

export function findUserByEmail(email: string) {
  return usersByEmail.get(email) ?? null;
}

export function findUserById(userId: string) {
  for (const user of usersByEmail.values()) {
    if (user.id === userId) return user;
  }

  return null;
}

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function persistRefreshToken(token: string) {
  refreshTokenHashes.add(hashToken(token));
}

export function hasRefreshToken(token: string) {
  return refreshTokenHashes.has(hashToken(token));
}

export function revokeRefreshToken(token: string) {
  refreshTokenHashes.delete(hashToken(token));
}
