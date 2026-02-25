type RedisValue = {
  value: string;
  expiresAt: number | null;
};

const sets = new Map<string, Set<string>>();
const strings = new Map<string, RedisValue>();
const hashes = new Map<string, Map<string, string>>();

function now() {
  return Date.now();
}

function getSet(key: string) {
  const existing = sets.get(key);
  if (existing) return existing;

  const created = new Set<string>();
  sets.set(key, created);
  return created;
}

function isExpired(value: RedisValue) {
  return value.expiresAt !== null && value.expiresAt <= now();
}

function purgeIfExpired(key: string) {
  const value = strings.get(key);
  if (!value) return;
  if (isExpired(value)) strings.delete(key);
}

function setExpiry(key: string, ttlSeconds: number) {
  const value = strings.get(key);
  if (!value) return 0;
  value.expiresAt = now() + ttlSeconds * 1000;
  return 1;
}

export const redis = {
  async sIsMember(key: string, member: string) {
    return getSet(key).has(member);
  },
  async sAdd(key: string, member: string) {
    const set = getSet(key);
    if (set.has(member)) return 0;
    set.add(member);
    return 1;
  },
  async sMembers(key: string) {
    return [...getSet(key)];
  },
  async sRem(key: string, member: string) {
    return getSet(key).delete(member) ? 1 : 0;
  },
  async del(...keys: string[]) {
    let deleted = 0;
    for (const key of keys) {
      deleted += Number(sets.delete(key));
      deleted += Number(strings.delete(key));
      deleted += Number(hashes.delete(key));
    }
    return deleted;
  },
  async get(key: string) {
    purgeIfExpired(key);
    return strings.get(key)?.value ?? null;
  },
  async set(key: string, value: string, options?: { EX?: number; PX?: number; NX?: boolean }) {
    purgeIfExpired(key);
    if (options?.NX && strings.has(key)) return null;

    let expiresAt: number | null = null;
    if (typeof options?.EX === 'number') expiresAt = now() + options.EX * 1000;
    if (typeof options?.PX === 'number') expiresAt = now() + options.PX;

    strings.set(key, { value, expiresAt });
    return 'OK';
  },
  async incrByFloat(key: string, increment: number) {
    purgeIfExpired(key);
    const current = Number(strings.get(key)?.value ?? '0');
    const next = current + increment;
    const existing = strings.get(key);
    strings.set(key, { value: String(next), expiresAt: existing?.expiresAt ?? null });
    return next;
  },
  async expire(key: string, ttlSeconds: number) {
    return setExpiry(key, ttlSeconds);
  },
  async hSet(key: string, values: Record<string, string>) {
    const hash = hashes.get(key) ?? new Map<string, string>();
    for (const [field, value] of Object.entries(values)) {
      hash.set(field, value);
    }
    hashes.set(key, hash);
    return hash.size;
  },
  async hGetAll(key: string) {
    const hash = hashes.get(key);
    if (!hash) return {} as Record<string, string>;
    return Object.fromEntries(hash.entries());
  },
  async keys(prefix: string) {
    const matcher = new RegExp(`^${prefix.replace('*', '.*')}$`);
    const all = new Set<string>([...sets.keys(), ...strings.keys(), ...hashes.keys()]);
    return [...all].filter((key) => matcher.test(key));
  },
};
