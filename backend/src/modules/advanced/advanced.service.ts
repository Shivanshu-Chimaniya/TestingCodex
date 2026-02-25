import { createId } from '../../utils/ids.js';

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

type RankProfile = {
  userId: string;
  elo: number;
  mmr: number;
  wins: number;
  losses: number;
  gamesPlayed: number;
  streak: number;
  queueType: 'casual' | 'ranked';
  season: number;
  joinedAt: number;
  history: Array<{ result: 'win' | 'loss'; opponentMmr: number; at: number }>;
};

type SkillRecord = {
  userId: string;
  category: string;
  attempts: number;
  accuracy: number;
  avgResponseMs: number;
  lastDifficulty: Difficulty;
};

type CategoryPack = {
  id: string;
  title: string;
  description: string;
  categoryIds: string[];
  ownerUserId: string;
  status: 'pending' | 'approved' | 'rejected';
  priceUsd: number;
  moderationNotes?: string;
  approvedBy?: string;
  revenueSplit: {
    creatorPct: number;
    platformPct: number;
  };
  createdAt: number;
};

type Purchase = {
  packId: string;
  buyerUserId: string;
  amountUsd: number;
  creatorPayoutUsd: number;
  platformFeeUsd: number;
  purchasedAt: number;
};

type RoomFunnelEvent = {
  roomCode: string;
  stage: 'created' | 'joined' | 'started' | 'completed';
  at: number;
};

type AnswerHeatmapEvent = {
  category: string;
  minuteBucket: number;
  totalAnswers: number;
  acceptedAnswers: number;
};

type ModelQualityEvent = {
  provider: string;
  suggestionAcceptedRate: number;
  hallucinationFlagRate: number;
  latencyMsP95: number;
  at: number;
};

const BASE_ELO = 1200;
const K_FACTOR = 32;
let currentSeason = 1;

const rankProfiles = new Map<string, RankProfile>();
const skillRecords = new Map<string, SkillRecord>();
const marketplacePacks = new Map<string, CategoryPack>();
const purchases: Purchase[] = [];
const activityEvents: Array<{ userId: string; at: number }> = [];
const roomFunnelEvents: RoomFunnelEvent[] = [];
const answerHeatmapEvents: AnswerHeatmapEvent[] = [];
const modelQualityEvents: ModelQualityEvent[] = [];

function getOrCreateRankProfile(userId: string): RankProfile {
  const existing = rankProfiles.get(userId);
  if (existing) return existing;

  const profile: RankProfile = {
    userId,
    elo: BASE_ELO,
    mmr: BASE_ELO,
    wins: 0,
    losses: 0,
    gamesPlayed: 0,
    streak: 0,
    queueType: 'casual',
    season: currentSeason,
    joinedAt: Date.now(),
    history: [],
  };

  rankProfiles.set(userId, profile);
  return profile;
}

function expectedScore(playerRating: number, opponentRating: number) {
  return 1 / (1 + 10 ** ((opponentRating - playerRating) / 400));
}

function calculateEloChange(playerElo: number, opponentElo: number, didWin: boolean) {
  const expected = expectedScore(playerElo, opponentElo);
  const actual = didWin ? 1 : 0;
  return Math.round(K_FACTOR * (actual - expected));
}

export function queueForRanked(userId: string, queueType: 'casual' | 'ranked') {
  const profile = getOrCreateRankProfile(userId);
  profile.queueType = queueType;
  return profile;
}

export function reportRankedMatch(input: {
  userId: string;
  opponentUserId: string;
  didWin: boolean;
}) {
  const player = getOrCreateRankProfile(input.userId);
  const opponent = getOrCreateRankProfile(input.opponentUserId);

  const delta = calculateEloChange(player.elo, opponent.elo, input.didWin);

  player.elo += delta;
  player.mmr += delta;
  player.gamesPlayed += 1;
  player.history.push({
    result: input.didWin ? 'win' : 'loss',
    opponentMmr: opponent.mmr,
    at: Date.now(),
  });

  if (input.didWin) {
    player.wins += 1;
    player.streak = player.streak >= 0 ? player.streak + 1 : 1;
  } else {
    player.losses += 1;
    player.streak = player.streak <= 0 ? player.streak - 1 : -1;
  }

  return {
    userId: player.userId,
    elo: player.elo,
    mmr: player.mmr,
    delta,
    antiSmurf: antiSmurfCheck(player),
  };
}

export function antiSmurfCheck(profile: Pick<RankProfile, 'joinedAt' | 'wins' | 'gamesPlayed' | 'mmr'>) {
  const accountAgeDays = Math.floor((Date.now() - profile.joinedAt) / (1000 * 60 * 60 * 24));
  const winRate = profile.gamesPlayed > 0 ? profile.wins / profile.gamesPlayed : 0;

  const suspicious = accountAgeDays < 14 && profile.gamesPlayed >= 8 && winRate >= 0.85 && profile.mmr >= 1500;

  return {
    suspicious,
    accountAgeDays,
    winRate,
    reasons: suspicious
      ? ['NEW_ACCOUNT_HIGH_WINRATE', 'RAPID_MMR_ASCENT']
      : [],
  };
}

export function resetSeason() {
  currentSeason += 1;

  for (const profile of rankProfiles.values()) {
    profile.elo = Math.round(BASE_ELO + (profile.elo - BASE_ELO) * 0.5);
    profile.mmr = profile.elo;
    profile.wins = 0;
    profile.losses = 0;
    profile.gamesPlayed = 0;
    profile.streak = 0;
    profile.season = currentSeason;
    profile.history = [];
  }

  return { season: currentSeason };
}

export function getRankProfile(userId: string) {
  const profile = getOrCreateRankProfile(userId);
  return {
    ...profile,
    antiSmurf: antiSmurfCheck(profile),
  };
}

export function recordSkillSignal(input: {
  userId: string;
  category: string;
  attempts: number;
  accepted: number;
  avgResponseMs: number;
}) {
  const key = `${input.userId}:${input.category.toLowerCase()}`;
  const accuracy = input.attempts > 0 ? input.accepted / input.attempts : 0;

  const record: SkillRecord = {
    userId: input.userId,
    category: input.category,
    attempts: input.attempts,
    accuracy,
    avgResponseMs: input.avgResponseMs,
    lastDifficulty: suggestDifficulty({
      userId: input.userId,
      category: input.category,
    }).difficulty,
  };

  skillRecords.set(key, record);
  return record;
}

export function suggestDifficulty(input: { userId: string; category: string }) {
  const key = `${input.userId}:${input.category.toLowerCase()}`;
  const record = skillRecords.get(key);

  if (!record) {
    return {
      difficulty: 'medium' as Difficulty,
      reason: 'NO_HISTORY_DEFAULT_MEDIUM',
    };
  }

  if (record.accuracy >= 0.9 && record.avgResponseMs <= 1800) {
    return { difficulty: 'expert' as Difficulty, reason: 'HIGH_ACCURACY_FAST_RESPONSES' };
  }
  if (record.accuracy >= 0.75 && record.avgResponseMs <= 2500) {
    return { difficulty: 'hard' as Difficulty, reason: 'CONSISTENT_AND_FAST' };
  }
  if (record.accuracy <= 0.45 || record.avgResponseMs >= 5000) {
    return { difficulty: 'easy' as Difficulty, reason: 'LOW_ACCURACY_OR_SLOW' };
  }

  return { difficulty: 'medium' as Difficulty, reason: 'BALANCED_SKILL_PROFILE' };
}

export function createMarketplacePack(input: {
  title: string;
  description: string;
  categoryIds: string[];
  ownerUserId: string;
  priceUsd: number;
  creatorPct?: number;
}) {
  const creatorPct = Math.min(90, Math.max(50, input.creatorPct ?? 70));
  const pack: CategoryPack = {
    id: createId(),
    title: input.title,
    description: input.description,
    categoryIds: input.categoryIds,
    ownerUserId: input.ownerUserId,
    status: 'pending',
    priceUsd: Number(input.priceUsd.toFixed(2)),
    revenueSplit: {
      creatorPct,
      platformPct: 100 - creatorPct,
    },
    createdAt: Date.now(),
  };

  marketplacePacks.set(pack.id, pack);
  return pack;
}

export function moderateMarketplacePack(input: {
  packId: string;
  status: 'approved' | 'rejected';
  moderatorUserId: string;
  moderationNotes?: string;
}) {
  const pack = marketplacePacks.get(input.packId);
  if (!pack) throw new Error('PACK_NOT_FOUND');

  pack.status = input.status;
  pack.approvedBy = input.moderatorUserId;
  pack.moderationNotes = input.moderationNotes;

  return pack;
}

export function purchasePack(input: { packId: string; buyerUserId: string }) {
  const pack = marketplacePacks.get(input.packId);
  if (!pack) throw new Error('PACK_NOT_FOUND');
  if (pack.status !== 'approved') throw new Error('PACK_NOT_APPROVED');

  const creatorPayoutUsd = Number((pack.priceUsd * (pack.revenueSplit.creatorPct / 100)).toFixed(2));
  const platformFeeUsd = Number((pack.priceUsd - creatorPayoutUsd).toFixed(2));

  const purchase: Purchase = {
    packId: pack.id,
    buyerUserId: input.buyerUserId,
    amountUsd: pack.priceUsd,
    creatorPayoutUsd,
    platformFeeUsd,
    purchasedAt: Date.now(),
  };

  purchases.push(purchase);
  return purchase;
}

export function listMarketplacePacks(status?: 'pending' | 'approved' | 'rejected') {
  const packs = [...marketplacePacks.values()];
  if (!status) return packs;
  return packs.filter((pack) => pack.status === status);
}

export function recordUserActivity(userId: string, at = Date.now()) {
  activityEvents.push({ userId, at });
}

export function recordRoomFunnelEvent(event: RoomFunnelEvent) {
  roomFunnelEvents.push(event);
}

export function recordAnswerHeatmapEvent(event: AnswerHeatmapEvent) {
  answerHeatmapEvents.push(event);
}

export function recordModelQualityEvent(event: Omit<ModelQualityEvent, 'at'> & { at?: number }) {
  modelQualityEvents.push({ ...event, at: event.at ?? Date.now() });
}

function uniqueUsersInWindow(windowMs: number) {
  const cutoff = Date.now() - windowMs;
  return new Set(activityEvents.filter((event) => event.at >= cutoff).map((event) => event.userId)).size;
}

function buildRetentionCohorts() {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const cohortBounds = [1, 7, 30];

  return cohortBounds.map((days) => {
    const activeUsers = new Set(activityEvents.filter((event) => event.at >= now - days * dayMs).map((event) => event.userId)).size;
    const totalUsers = rankProfiles.size || 1;
    return {
      windowDays: days,
      retainedUsers: activeUsers,
      retentionRate: Number((activeUsers / totalUsers).toFixed(3)),
    };
  });
}

function buildRoomFunnel() {
  const counts = {
    created: 0,
    joined: 0,
    started: 0,
    completed: 0,
  };

  for (const event of roomFunnelEvents) {
    counts[event.stage] += 1;
  }

  const created = counts.created || 1;
  return {
    ...counts,
    joinRate: Number((counts.joined / created).toFixed(3)),
    startRate: Number((counts.started / created).toFixed(3)),
    completionRate: Number((counts.completed / created).toFixed(3)),
  };
}

function buildAnswerHeatmaps() {
  const grouped = new Map<string, { attempts: number; accepted: number }>();

  for (const event of answerHeatmapEvents) {
    const key = `${event.category}:${event.minuteBucket}`;
    const existing = grouped.get(key) ?? { attempts: 0, accepted: 0 };
    existing.attempts += event.totalAnswers;
    existing.accepted += event.acceptedAnswers;
    grouped.set(key, existing);
  }

  return [...grouped.entries()].map(([key, value]) => {
    const [category, minuteBucket] = key.split(':');
    return {
      category,
      minuteBucket: Number(minuteBucket),
      attempts: value.attempts,
      accepted: value.accepted,
      acceptanceRate: value.attempts > 0 ? Number((value.accepted / value.attempts).toFixed(3)) : 0,
    };
  });
}

function buildModelQualityKpis() {
  if (!modelQualityEvents.length) {
    return {
      providers: [],
      overall: {
        suggestionAcceptedRate: 0,
        hallucinationFlagRate: 0,
        latencyMsP95: 0,
      },
    };
  }

  const providers = new Map<string, { count: number; acceptedRate: number; hallucinationRate: number; latencyP95: number }>();

  for (const event of modelQualityEvents) {
    const existing = providers.get(event.provider) ?? {
      count: 0,
      acceptedRate: 0,
      hallucinationRate: 0,
      latencyP95: 0,
    };

    existing.count += 1;
    existing.acceptedRate += event.suggestionAcceptedRate;
    existing.hallucinationRate += event.hallucinationFlagRate;
    existing.latencyP95 += event.latencyMsP95;

    providers.set(event.provider, existing);
  }

  const providerRows = [...providers.entries()].map(([provider, value]) => ({
    provider,
    sampleSize: value.count,
    suggestionAcceptedRate: Number((value.acceptedRate / value.count).toFixed(3)),
    hallucinationFlagRate: Number((value.hallucinationRate / value.count).toFixed(3)),
    latencyMsP95: Math.round(value.latencyP95 / value.count),
  }));

  const totals = providerRows.reduce(
    (acc, row) => {
      acc.accepted += row.suggestionAcceptedRate;
      acc.hallucination += row.hallucinationFlagRate;
      acc.latency += row.latencyMsP95;
      return acc;
    },
    { accepted: 0, hallucination: 0, latency: 0 },
  );

  return {
    providers: providerRows,
    overall: {
      suggestionAcceptedRate: Number((totals.accepted / providerRows.length).toFixed(3)),
      hallucinationFlagRate: Number((totals.hallucination / providerRows.length).toFixed(3)),
      latencyMsP95: Math.round(totals.latency / providerRows.length),
    },
  };
}

export function getAnalyticsDashboard() {
  return {
    engagement: {
      dau: uniqueUsersInWindow(24 * 60 * 60 * 1000),
      mau: uniqueUsersInWindow(30 * 24 * 60 * 60 * 1000),
      retentionCohorts: buildRetentionCohorts(),
    },
    roomFunnel: buildRoomFunnel(),
    answerHeatmaps: buildAnswerHeatmaps(),
    modelQuality: buildModelQualityKpis(),
  };
}
