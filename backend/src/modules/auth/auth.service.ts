import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import type { User } from '../../types/models.js';

const usersByEmail = new Map<string, User>();

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

  const token = jwt.sign({ sub: user.id, username: user.username }, env.JWT_ACCESS_SECRET, {
    expiresIn: '15m',
  });

  return { user, accessToken: token };
}

export function getUserById(userId: string) {
  for (const user of usersByEmail.values()) {
    if (user.id === userId) return user;
  }
  return null;
}
