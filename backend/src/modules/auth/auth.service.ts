import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { hashPassword, verifyPassword } from '../../utils/password.js';
import * as authRepo from './auth.repo.js';

function createAccessToken(user: { id: string; username: string }) {
  return jwt.sign({ sub: user.id, username: user.username }, env.JWT_ACCESS_SECRET, {
    expiresIn: `${env.JWT_ACCESS_TTL_MINUTES}m`,
  });
}

function createRefreshToken(userId: string, sessionId: string) {
  return jwt.sign({ sub: userId, sid: sessionId, type: 'refresh', jti: crypto.randomUUID() }, env.JWT_REFRESH_SECRET, {
    expiresIn: `${env.JWT_REFRESH_TTL_DAYS}d`,
  });
}

function refreshTokenExpiresAt() {
  return Date.now() + env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000;
}

export async function register(username: string, email: string, password: string) {
  const passwordHash = await hashPassword(password);
  return authRepo.createUser({ username, email, passwordHash });
}

export async function login(email: string, password: string) {
  const user = authRepo.findUserByEmail(email);
  if (!user || !(await verifyPassword(user.passwordHash, password))) {
    throw new Error('INVALID_CREDENTIALS');
  }

  const sessionId = crypto.randomUUID();
  const accessToken = createAccessToken(user);
  const refreshToken = createRefreshToken(user.id, sessionId);
  authRepo.persistRefreshSession({
    sessionId,
    userId: user.id,
    token: refreshToken,
    expiresAt: refreshTokenExpiresAt(),
  });

  return { user, accessToken, refreshToken };
}

export function refreshAccessToken(refreshToken: string) {
  const payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as {
    sub: string;
    sid?: string;
    type?: string;
  };

  if (payload.type !== 'refresh' || !payload.sid || authRepo.isRefreshTokenRevoked(refreshToken)) {
    throw new Error('INVALID_REFRESH_TOKEN');
  }

  const session = authRepo.getRefreshSession(payload.sid);
  if (!session || session.userId !== payload.sub || session.expiresAt < Date.now()) {
    throw new Error('INVALID_REFRESH_TOKEN');
  }

  const user = authRepo.findUserById(payload.sub);
  if (!user) throw new Error('INVALID_REFRESH_TOKEN');

  const nextRefreshToken = createRefreshToken(user.id, payload.sid);
  const rotated = authRepo.rotateRefreshSession({
    sessionId: payload.sid,
    oldToken: refreshToken,
    nextToken: nextRefreshToken,
    expiresAt: refreshTokenExpiresAt(),
  });

  if (!rotated) {
    throw new Error('INVALID_REFRESH_TOKEN');
  }

  return {
    accessToken: createAccessToken(user),
    refreshToken: nextRefreshToken,
  };
}

export function logout(refreshToken: string) {
  authRepo.revokeRefreshToken(refreshToken);
}

export function getUserById(userId: string) {
  return authRepo.findUserById(userId);
}
