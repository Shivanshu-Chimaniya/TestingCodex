import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import type { User } from '../../types/models.js';

const usersByEmail = new Map<string, User>();


function createAccessToken(user: User) {
  return jwt.sign({ sub: user.id, username: user.username }, env.JWT_ACCESS_SECRET, {
    expiresIn: '15m',
  });
}

function createRefreshToken(user: User) {
  return jwt.sign({ sub: user.id, type: 'refresh' }, env.JWT_REFRESH_SECRET, {
    expiresIn: '7d',
  });
}

export function register(username: string, email: string, password: string): User {
  if (usersByEmail.has(email)) {
    throw new Error('EMAIL_TAKEN');
  }

  const user: User = {
    id: crypto.randomUUID(),
    username,
    email,
    password,
  };

  usersByEmail.set(email, user);
  return user;
}

export function login(email: string, password: string) {
  const user = usersByEmail.get(email);
  if (!user || user.password !== password) {
    throw new Error('INVALID_CREDENTIALS');
  }

  return {
    user,
    accessToken: createAccessToken(user),
    refreshToken: createRefreshToken(user),
  };
}

export function refreshAccessToken(refreshToken: string) {
  const payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as { sub: string; type?: string };
  if (payload.type !== 'refresh') throw new Error('INVALID_REFRESH_TOKEN');

  const user = getUserById(payload.sub);
  if (!user) throw new Error('INVALID_REFRESH_TOKEN');

  return { accessToken: createAccessToken(user) };
}

export function getUserById(userId: string) {
  for (const user of usersByEmail.values()) {
    if (user.id === userId) return user;
  }
  return null;
}
