import type { Request, Response } from 'express';
import { z } from 'zod';
import * as advancedService from './advanced.service.js';

const queueSchema = z.object({
  queueType: z.enum(['casual', 'ranked']),
});

const reportMatchSchema = z.object({
  opponentUserId: z.string().min(1),
  didWin: z.boolean(),
});

const skillSignalSchema = z.object({
  category: z.string().min(1),
  attempts: z.number().int().positive(),
  accepted: z.number().int().min(0),
  avgResponseMs: z.number().int().positive(),
});

const marketplaceCreateSchema = z.object({
  title: z.string().min(3),
  description: z.string().default(''),
  categoryIds: z.array(z.string().min(1)).min(1),
  priceUsd: z.number().positive(),
  creatorPct: z.number().min(50).max(90).optional(),
});

const marketplaceModerationSchema = z.object({
  packId: z.string().min(1),
  status: z.enum(['approved', 'rejected']),
  moderationNotes: z.string().optional(),
});

const marketplacePurchaseSchema = z.object({
  packId: z.string().min(1),
});

const roomFunnelEventSchema = z.object({
  roomCode: z.string().min(1),
  stage: z.enum(['created', 'joined', 'started', 'completed']),
  at: z.number().int().optional(),
});

const answerHeatmapEventSchema = z.object({
  category: z.string().min(1),
  minuteBucket: z.number().int().min(0).max(59),
  totalAnswers: z.number().int().min(0),
  acceptedAnswers: z.number().int().min(0),
});

const modelQualityEventSchema = z.object({
  provider: z.string().min(1),
  suggestionAcceptedRate: z.number().min(0).max(1),
  hallucinationFlagRate: z.number().min(0).max(1),
  latencyMsP95: z.number().int().positive(),
  at: z.number().int().optional(),
});

function requireAuth(req: Request, res: Response) {
  if (!req.auth) {
    res.status(401).json({ error: 'UNAUTHORIZED' });
    return false;
  }
  return true;
}

export function queueForRanked(req: Request, res: Response) {
  if (!requireAuth(req, res)) return;
  const parsed = queueSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const profile = advancedService.queueForRanked(req.auth!.userId, parsed.data.queueType);
  return res.status(200).json({ profile });
}

export function reportRankedMatch(req: Request, res: Response) {
  if (!requireAuth(req, res)) return;
  const parsed = reportMatchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const result = advancedService.reportRankedMatch({
    userId: req.auth!.userId,
    ...parsed.data,
  });

  return res.status(200).json({ result });
}

export function getMyRankProfile(req: Request, res: Response) {
  if (!requireAuth(req, res)) return;
  const profile = advancedService.getRankProfile(req.auth!.userId);
  return res.status(200).json({ profile });
}

export function resetRankedSeason(req: Request, res: Response) {
  if (!requireAuth(req, res)) return;
  const next = advancedService.resetSeason();
  return res.status(200).json({ season: next.season, message: 'Season reset applied' });
}

export function recordSkillSignal(req: Request, res: Response) {
  if (!requireAuth(req, res)) return;
  const parsed = skillSignalSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  if (parsed.data.accepted > parsed.data.attempts) {
    return res.status(400).json({ error: 'ACCEPTED_CANNOT_EXCEED_ATTEMPTS' });
  }

  const signal = advancedService.recordSkillSignal({
    userId: req.auth!.userId,
    ...parsed.data,
  });

  return res.status(201).json({ signal });
}

export function suggestDifficulty(req: Request, res: Response) {
  if (!requireAuth(req, res)) return;

  const category = z.string().min(1).safeParse(req.query.category);
  if (!category.success) return res.status(400).json({ error: 'MISSING_CATEGORY' });

  const recommendation = advancedService.suggestDifficulty({
    userId: req.auth!.userId,
    category: category.data,
  });

  return res.status(200).json({ recommendation });
}

export function createMarketplacePack(req: Request, res: Response) {
  if (!requireAuth(req, res)) return;
  const parsed = marketplaceCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const pack = advancedService.createMarketplacePack({
    ...parsed.data,
    ownerUserId: req.auth!.userId,
  });

  return res.status(201).json({ pack });
}

export function moderateMarketplacePack(req: Request, res: Response) {
  if (!requireAuth(req, res)) return;
  const parsed = marketplaceModerationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const pack = advancedService.moderateMarketplacePack({
      ...parsed.data,
      moderatorUserId: req.auth!.userId,
    });
    return res.status(200).json({ pack });
  } catch {
    return res.status(404).json({ error: 'PACK_NOT_FOUND' });
  }
}

export function purchaseMarketplacePack(req: Request, res: Response) {
  if (!requireAuth(req, res)) return;
  const parsed = marketplacePurchaseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const receipt = advancedService.purchasePack({
      ...parsed.data,
      buyerUserId: req.auth!.userId,
    });
    return res.status(201).json({ receipt });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
    if (message === 'PACK_NOT_FOUND') return res.status(404).json({ error: message });
    if (message === 'PACK_NOT_APPROVED') return res.status(409).json({ error: message });
    return res.status(500).json({ error: 'PURCHASE_FAILED' });
  }
}

export function listMarketplacePacks(req: Request, res: Response) {
  const status = z.enum(['pending', 'approved', 'rejected']).optional().safeParse(req.query.status);
  if (!status.success) return res.status(400).json({ error: 'INVALID_STATUS_FILTER' });

  const packs = advancedService.listMarketplacePacks(status.data);
  return res.status(200).json({ packs });
}

export function recordAnalyticsActivity(req: Request, res: Response) {
  if (!requireAuth(req, res)) return;
  advancedService.recordUserActivity(req.auth!.userId);
  return res.status(201).json({ ok: true });
}

export function recordRoomFunnelEvent(req: Request, res: Response) {
  const parsed = roomFunnelEventSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  advancedService.recordRoomFunnelEvent({
    ...parsed.data,
    at: parsed.data.at ?? Date.now(),
  });
  return res.status(201).json({ ok: true });
}

export function recordAnswerHeatmapEvent(req: Request, res: Response) {
  const parsed = answerHeatmapEventSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  if (parsed.data.acceptedAnswers > parsed.data.totalAnswers) {
    return res.status(400).json({ error: 'ACCEPTED_CANNOT_EXCEED_TOTAL' });
  }

  advancedService.recordAnswerHeatmapEvent(parsed.data);
  return res.status(201).json({ ok: true });
}

export function recordModelQualityEvent(req: Request, res: Response) {
  const parsed = modelQualityEventSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  advancedService.recordModelQualityEvent(parsed.data);
  return res.status(201).json({ ok: true });
}

export function getAnalyticsDashboard(_req: Request, res: Response) {
  const dashboard = advancedService.getAnalyticsDashboard();
  return res.status(200).json({ dashboard });
}
