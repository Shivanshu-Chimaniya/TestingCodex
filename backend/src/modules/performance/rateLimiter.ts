import { redis } from '../../config/redis.js';

export type BucketIdentity = {
  ip: string;
  userId?: string;
};

type TokenBucketOptions = {
  capacity: number;
  refillPerSec: number;
};

async function consumeToken(key: string, options: TokenBucketOptions) {
  const now = Date.now();
  const state = await redis.hGetAll(key);

  const lastRefillMs = Number(state.lastRefillMs ?? now);
  const tokens = Number(state.tokens ?? options.capacity);
  const elapsedSec = Math.max(0, (now - lastRefillMs) / 1000);

  const replenished = Math.min(options.capacity, tokens + elapsedSec * options.refillPerSec);
  if (replenished < 1) {
    await redis.hSet(key, {
      tokens: String(replenished),
      lastRefillMs: String(now),
    });
    await redis.expire(key, 120);
    return false;
  }

  await redis.hSet(key, {
    tokens: String(replenished - 1),
    lastRefillMs: String(now),
  });
  await redis.expire(key, 120);
  return true;
}

export async function allowRequest(identity: BucketIdentity, namespace: string) {
  const ipKey = `ratelimit:${namespace}:ip:${identity.ip}`;
  const ipAllowed = await consumeToken(ipKey, { capacity: 120, refillPerSec: 2 });
  if (!ipAllowed) return false;

  if (!identity.userId) return true;

  const userKey = `ratelimit:${namespace}:user:${identity.userId}`;
  return consumeToken(userKey, { capacity: 80, refillPerSec: 1.5 });
}
