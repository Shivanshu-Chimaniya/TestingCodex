const sets = new Map<string, Set<string>>();

function getSet(key: string) {
  const existing = sets.get(key);
  if (existing) return existing;

  const created = new Set<string>();
  sets.set(key, created);
  return created;
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
};
