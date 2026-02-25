import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import * as authRepo from './auth.repo.js';

function createAccessToken(user: { id: string; username: string }) {
  return jwt.sign({ sub: user.id, username: user.username }, env.JWT_ACCESS_SECRET, {
    expiresIn: '15m',
  });
}

function createRefreshToken(userId: string) {
  return jwt.sign({ sub: userId, type: 'refresh' }, env.JWT_REFRESH_SECRET, {
    expiresIn: '7d',
  });
}

export function register(username: string, email: string, password: string) {
  return authRepo.createUser({ username, email, password });
}

export function login(email: string, password: string) {
  const user = authRepo.findUserByEmail(email);
  if (!user || user.password !== password) {
    throw new Error('INVALID_CREDENTIALS');
  }

  const accessToken = createAccessToken(user);
  const refreshToken = createRefreshToken(user.id);
  authRepo.persistRefreshToken(refreshToken);

  return { user, accessToken, refreshToken };
}

export function refreshAccessToken(refreshToken: string) {
  const payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as { sub: string; type?: string };
  if (payload.type !== 'refresh' || !authRepo.hasRefreshToken(refreshToken)) {
    throw new Error('INVALID_REFRESH_TOKEN');
  }

  const user = authRepo.findUserById(payload.sub);
  if (!user) throw new Error('INVALID_REFRESH_TOKEN');

  return { accessToken: createAccessToken(user) };
}

export function logout(refreshToken: string) {
  authRepo.revokeRefreshToken(refreshToken);
}

export function getUserById(userId: string) {
  return authRepo.findUserById(userId);
}
