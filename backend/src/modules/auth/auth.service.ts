import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import type { User } from '../../types/models.js';

const usersByEmail = new Map<string, User>();
const usersById = new Map<string, User>();
const refreshToUserId = new Map<string, string>();

function issueAccessToken(user: User) {
  return jwt.sign({ sub: user.id, username: user.username }, env.JWT_ACCESS_SECRET, {
    expiresIn: '15m',
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
  usersById.set(user.id, user);
  return user;
}

export function login(email: string, password: string) {
  const user = usersByEmail.get(email);
  if (!user || user.password !== password) {
    throw new Error('INVALID_CREDENTIALS');
  }

  const accessToken = issueAccessToken(user);
  const refreshToken = crypto.randomUUID();
  refreshToUserId.set(refreshToken, user.id);

  return { user, accessToken, refreshToken };
}

export function refresh(refreshToken: string) {
  const userId = refreshToUserId.get(refreshToken);
  if (!userId) throw new Error('INVALID_REFRESH_TOKEN');

  const user = usersById.get(userId);
  if (!user) throw new Error('INVALID_REFRESH_TOKEN');

  refreshToUserId.delete(refreshToken);
  const rotatedRefreshToken = crypto.randomUUID();
  refreshToUserId.set(rotatedRefreshToken, user.id);

  return { accessToken: issueAccessToken(user), refreshToken: rotatedRefreshToken, user };
}

export function logout(refreshToken: string) {
  refreshToUserId.delete(refreshToken);
}

export function getUserById(userId: string) {
  return usersById.get(userId) ?? null;
}
