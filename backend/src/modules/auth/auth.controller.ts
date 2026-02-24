import type { Request, Response } from 'express';
import { loginSchema, refreshSchema, registerSchema } from './auth.schema.js';
import * as authService from './auth.service.js';

export function register(req: Request, res: Response) {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const user = authService.register(parsed.data.username, parsed.data.email, parsed.data.password);
    return res.status(201).json({ user: { id: user.id, username: user.username, email: user.email } });
  } catch (error) {
    if (error instanceof Error && error.message === 'EMAIL_TAKEN') {
      return res.status(409).json({ error: 'EMAIL_TAKEN' });
    }
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
}

export function login(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const { user, accessToken, refreshToken } = authService.login(parsed.data.email, parsed.data.password);
    return res.status(200).json({ accessToken, refreshToken, user: { id: user.id, username: user.username, email: user.email } });
  } catch (error) {
    if (error instanceof Error && error.message === 'INVALID_CREDENTIALS') {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
    }
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
}

export function refresh(req: Request, res: Response) {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const { accessToken, refreshToken, user } = authService.refresh(parsed.data.refreshToken);
    return res.status(200).json({ accessToken, refreshToken, user: { id: user.id, username: user.username, email: user.email } });
  } catch {
    return res.status(401).json({ error: 'INVALID_REFRESH_TOKEN' });
  }
}

export function logout(req: Request, res: Response) {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  authService.logout(parsed.data.refreshToken);
  return res.status(204).send();
}

export function me(req: Request, res: Response) {
  if (!req.auth) return res.status(401).json({ error: 'UNAUTHORIZED' });

  const user = authService.getUserById(req.auth.userId);
  if (!user) return res.status(404).json({ error: 'USER_NOT_FOUND' });

  return res.status(200).json({ user: { id: user.id, username: user.username, email: user.email } });
}
