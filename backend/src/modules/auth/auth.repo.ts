import crypto from 'node:crypto';
import type { User } from '../../types/models.js';

const usersByEmail = new Map<string, User>();
const usersById = new Map<string, User>();
const refreshSessionById = new Map<string, { userId: string; tokenHash: string; expiresAt: number }>();
const revokedRefreshTokenHashes = new Set<string>();

export function createUser(input: { username: string; email: string; passwordHash: string }): User {
  if (usersByEmail.has(input.email)) {
    throw new Error('EMAIL_TAKEN');
  }

  const user: User = {
    id: crypto.randomUUID(),
    username: input.username,
    email: input.email,
    passwordHash: input.passwordHash,
  };

  usersByEmail.set(user.email, user);
  usersById.set(user.id, user);
  return user;
}

export function findUserByEmail(email: string) {
  return usersByEmail.get(email) ?? null;
}

export function findUserById(userId: string) {
  return usersById.get(userId) ?? null;
}

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function persistRefreshSession(input: { sessionId: string; userId: string; token: string; expiresAt: number }) {
  refreshSessionById.set(input.sessionId, {
    userId: input.userId,
    tokenHash: hashToken(input.token),
    expiresAt: input.expiresAt,
  });
}

export function getRefreshSession(sessionId: string) {
  return refreshSessionById.get(sessionId) ?? null;
}

export function rotateRefreshSession(input: { sessionId: string; oldToken: string; nextToken: string; expiresAt: number }) {
  const session = refreshSessionById.get(input.sessionId);
  if (!session) return false;

  const currentHash = hashToken(input.oldToken);
  if (session.tokenHash !== currentHash || revokedRefreshTokenHashes.has(currentHash)) {
    return false;
  }

  revokedRefreshTokenHashes.add(currentHash);
  session.tokenHash = hashToken(input.nextToken);
  session.expiresAt = input.expiresAt;
  return true;
}

export function revokeRefreshToken(token: string) {
  const tokenHash = hashToken(token);
  revokedRefreshTokenHashes.add(tokenHash);

  for (const [sessionId, session] of refreshSessionById.entries()) {
    if (session.tokenHash === tokenHash) {
      refreshSessionById.delete(sessionId);
      break;
    }
  }
}

export function isRefreshTokenRevoked(token: string) {
  return revokedRefreshTokenHashes.has(hashToken(token));
}
