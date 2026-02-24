# PopSauce AI — Production Technical Design (v1)

## 1) Product Architecture Overview

### 1.1 High-level system diagram (described)

**Clients**
- React SPA (Vercel) for players/hosts/admins.
- Connects to backend via:
  - REST (`/api/...`) for auth, room metadata, saved categories.
  - Socket.io namespace (`/game`) for real-time gameplay.

**Backend (Node.js + Express + Socket.io)**
- API Layer: Auth, rooms, categories, profile, moderation endpoints.
- Game Orchestrator: in-memory room runtime state + Redis-backed coordination.
- AI Service: Gemini/OpenAI integration for category+answer generation.
- Validation Engine: answer normalization, duplicate detection, scoring, anti-cheat.
- Worker Queue (BullMQ optional): pre-generate categories, cleanup stale rooms, analytics rollups.

**Data Layer**
- MongoDB Atlas:
  - persistent entities (users, rooms, category packs, rounds, audit logs).
- Redis:
  - socket adapter pub/sub, room ephemeral state cache, rate limiting counters, locks.

**Observability + Infra**
- Structured logs -> Datadog/ELK.
- Metrics -> Prometheus/Grafana or managed APM.
- Error tracking -> Sentry.
- Deployment: Vercel FE, Railway/Render backend (autoscaling), Mongo Atlas, Upstash/Redis Cloud.

---

### 1.2 Request/response flow

1. **User auth**
   - FE posts credentials to `/api/auth/login`.
   - BE validates, issues short-lived access JWT + refresh token.
   - FE stores access token in memory (preferred) and refresh token in httpOnly cookie.

2. **Create room**
   - Host calls `POST /api/rooms` with config (`public/private`, maxPlayers, aiModel).
   - BE writes room to Mongo + seeds runtime entry in Redis.
   - Returns room code and websocket join token.

3. **Generate category**
   - Host calls `POST /api/ai/categories/generate` or triggers socket event.
   - BE calls AI provider with strict JSON schema prompt.
   - BE validates and normalizes answers.
   - Stores generated category (optional draft) and returns category id.

4. **Start round**
   - Host emits `round:start` via socket.
   - BE checks permissions, room state, minimum players.
   - BE emits `round:countdown`, then `round:active` with sanitized payload (no full answers list unless mode allows).

---

### 1.3 Real-time event flow

**Join Flow**
- Client `socket.connect` with JWT.
- Server middleware authenticates and attaches `socket.user`.
- Client emits `room:join` (roomCode).
- Server validates membership/privacy/password and emits:
  - `room:state` (players, host, status, timer)
  - `leaderboard:update`

**Gameplay Flow**
- Client emits `answer:submit` with raw string and client timestamp.
- Server:
  1) sanitize + normalize,
  2) dedupe,
  3) validate against accepted set,
  4) compute points from server monotonic clock,
  5) persist event asynchronously,
  6) emit `answer:accepted` / `answer:rejected`.
- Server periodically emits:
  - `round:tick` (remaining ms)
  - `leaderboard:update`
  - `round:end` with summary.

**Reliability**
- Acks with timeout for critical events (`room:join`, `round:start`, `answer:submit`).
- Sequence numbers per room event to recover from packet loss.
- Re-sync endpoint `/api/rooms/:id/snapshot` on reconnect.

---

## 2) Database Schema Design (MongoDB)

### 2.1 Collections
- `users`
- `rooms`
- `room_members`
- `categories`
- `rounds`
- `answers_submitted`
- `saved_category_sets`
- `auth_sessions`
- `abuse_events`

### 2.2 Field structures (core)

**users**
- `_id`, `email`, `username`, `passwordHash`, `roles`, `createdAt`, `lastSeenAt`, `preferences`

**rooms**
- `_id`, `code`, `hostUserId`, `visibility`, `passwordHash?`, `status`, `config`, `currentRoundId`, `createdAt`, `updatedAt`

**categories**
- `_id`, `title`, `slug`, `description`, `answers[]`, `source` (`ai|manual`), `createdBy`, `difficulty`, `language`, `safetyFlags`, `isPublic`, `version`, `createdAt`

**rounds**
- `_id`, `roomId`, `categoryId`, `startedAt`, `endedAt`, `status`, `answerPoolHash`, `foundAnswers[]`, `scoreboard[]`, `configSnapshot`

**answers_submitted**
- `_id`, `roundId`, `roomId`, `userId`, `rawInput`, `normalizedInput`, `isValid`, `isDuplicate`, `serverReceivedAt`, `latencyBucketMs`, `pointsAwarded`

### 2.3 Indexing strategy
- `users.email` unique, `users.username` unique.
- `rooms.code` unique, `rooms.status + updatedAt` compound.
- `room_members.roomId + userId` unique.
- `categories.slug + language + version` unique.
- `rounds.roomId + startedAt` descending.
- `answers_submitted.roundId + normalizedInput` for duplicate checks.
- TTL index on `auth_sessions.expiresAt`.
- TTL on low-value abuse raw logs (e.g., 30 days).

### 2.4 Example documents

```json
{
  "_id": "room_01",
  "code": "Q7PK9",
  "hostUserId": "user_1",
  "visibility": "private",
  "status": "active",
  "config": {
    "roundDurationSec": 60,
    "maxPlayers": 20,
    "aiProvider": "gemini-1.5-pro"
  },
  "currentRoundId": "round_22",
  "createdAt": "2026-02-24T10:00:00.000Z"
}
```

```json
{
  "_id": "cat_900",
  "title": "JavaScript Frameworks",
  "answers": ["React", "Vue", "Angular", "Svelte", "Next.js"],
  "source": "ai",
  "difficulty": "medium",
  "language": "en",
  "isPublic": true,
  "version": 1
}
```

---

## 3) Backend Structure (Production-grade)

### 3.1 Folder structure

```txt
backend/
  src/
    app.ts
    server.ts
    config/
      env.ts
      logger.ts
      redis.ts
      mongo.ts
    modules/
      auth/
        auth.controller.ts
        auth.service.ts
        auth.repo.ts
        auth.routes.ts
        auth.schema.ts
      rooms/
        room.controller.ts
        room.service.ts
        room.repo.ts
        room.routes.ts
        room.schema.ts
      game/
        game.engine.ts
        scoring.ts
        normalization.ts
        antiCheat.ts
        game.types.ts
      ai/
        ai.controller.ts
        ai.service.ts
        ai.prompts.ts
        ai.validation.ts
        ai.routes.ts
      categories/
      leaderboard/
      moderation/
    sockets/
      index.ts
      auth.middleware.ts
      game.namespace.ts
      room.handlers.ts
      answer.handlers.ts
      events.ts
    middlewares/
      error.middleware.ts
      rateLimit.middleware.ts
      auth.middleware.ts
      validate.middleware.ts
    utils/
      crypto.ts
      time.ts
      ids.ts
    jobs/
      queues.ts
      categoryPrefetch.job.ts
      roomCleanup.job.ts
    tests/
      unit/
      integration/
      socket/
```

---

### 3.2 Route design (REST)

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/me`

- `POST /api/rooms`
- `GET /api/rooms/:code`
- `POST /api/rooms/:code/join`
- `POST /api/rooms/:code/start`
- `POST /api/rooms/:code/end`
- `GET /api/rooms/:code/snapshot`

- `POST /api/ai/categories/generate`
- `POST /api/categories/:id/save`
- `GET /api/categories/public`
- `GET /api/categories/mine`

- `GET /api/leaderboards/global`
- `GET /api/leaderboards/room/:code`

Use zod/joi for schema validation at boundary. Every handler is thin; logic in services.

---

### 3.3 Socket event architecture

**Namespace**: `/game`

**Client -> Server**
- `room:join`, `room:leave`
- `round:start`, `round:ready`
- `answer:submit`
- `ping:latency`

**Server -> Client**
- `room:state`
- `room:player_joined`, `room:player_left`
- `round:countdown`, `round:active`, `round:tick`, `round:end`
- `answer:accepted`, `answer:rejected`
- `leaderboard:update`
- `system:error`

Use a typed contract (e.g., TypeScript interfaces shared FE/BE) to prevent payload drift.

---

### 3.4 Real code example: socket auth + join

```ts
// src/sockets/auth.middleware.ts
import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export function socketAuth(socket: Socket, next: (err?: Error) => void) {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('UNAUTHORIZED'));
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as { sub: string; username: string };
    (socket.data as any).user = { id: payload.sub, username: payload.username };
    next();
  } catch {
    next(new Error('UNAUTHORIZED'));
  }
}
```

```ts
// src/sockets/room.handlers.ts
export async function onRoomJoin(io, socket, payload, ack) {
  const { roomCode } = payload;
  const user = socket.data.user;

  const room = await roomService.getByCode(roomCode);
  if (!room) return ack({ ok: false, code: 'ROOM_NOT_FOUND' });

  const allowed = await roomService.canJoin(room, user.id, payload.password);
  if (!allowed) return ack({ ok: false, code: 'FORBIDDEN' });

  await socket.join(room.code);
  await roomRuntimeService.addPresence(room.code, user.id, socket.id);

  const state = await gameEngine.getRoomState(room.code);
  ack({ ok: true, state });
  io.to(room.code).emit('room:player_joined', { userId: user.id, username: user.username });
}
```

---

### 3.5 AI integration service details

Responsibilities:
1. Build provider-agnostic request from internal `GenerateCategoryRequest`.
2. Send strict prompt + json schema.
3. Parse, validate, and normalize.
4. Apply safety filters.
5. Persist category + cache accepted answer set hash.

```ts
// src/modules/ai/ai.service.ts
export async function generateCategory(input: GenerateCategoryRequest): Promise<ValidatedCategory> {
  const prompt = buildCategoryPrompt(input);
  const raw = await providerClient.generateJSON(prompt, { temperature: 0.4 });
  const parsed = safeJsonParse(raw);
  const validated = categoryResponseSchema.parse(parsed); // zod
  const normalizedAnswers = normalizeAnswerSet(validated.answers);
  return {
    ...validated,
    answers: normalizedAnswers,
    answerHash: hashAnswerSet(normalizedAnswers),
  };
}
```

---

### 3.6 Validation logic for answers

Algorithm per submission:
1. Reject if round not active.
2. Normalize input (`trim`, lowercase, Unicode normalize NFKC, strip punctuation variants).
3. Reject if < 2 chars or spam regex triggered.
4. Check Redis `SISMEMBER round:{id}:accepted {normalized}`.
5. If not member => invalid.
6. Check Redis `SADD round:{id}:found {normalized}`:
   - if returns `0`, duplicate.
   - if `1`, first finder => award points.

```ts
const normalized = normalize(input);
if (!acceptedSet.has(normalized)) return reject('INVALID');
const isFirst = await redis.sAdd(`round:${roundId}:found`, normalized);
if (!isFirst) return reject('DUPLICATE');
const points = scoring.calculate(round, Date.now());
```

---

### 3.7 Anti-cheat strategy (practical)
- **Server-authoritative timing**: ignore client timestamps for scoring.
- **Rate caps**: max submits/sec per socket and per user across sockets.
- **Entropy heuristics**: repetitive random strings or impossible burst accuracy => flag.
- **Duplicate-socket detection**: same token on many IPs triggers soft ban.
- **Hidden honeypot answers**: fake common typo if repeatedly submitted quickly can indicate scripting.
- **Moderation pipeline**: flagged events to `abuse_events` + optional temporary mute.

---

## 4) Frontend Architecture

### 4.1 Folder structure

```txt
frontend/
  src/
    app/
      router.tsx
      providers.tsx
    pages/
      Home.tsx
      Login.tsx
      RoomLobby.tsx
      GameRoom.tsx
      Profile.tsx
    features/
      auth/
      room/
      game/
      leaderboard/
      categories/
    components/
      ui/
      game/
      leaderboard/
    services/
      api.ts
      socket.ts
    store/
      auth.store.ts
      room.store.ts
      game.store.ts
    hooks/
      useSocketEvents.ts
      useRoundTimer.ts
    styles/
      index.css
```

### 4.2 State management strategy
- **Zustand** (or Redux Toolkit if preferred) for global state slices.
- React Query for server cache (rooms list, profile, categories).
- Socket events feed store reducers directly.

### 4.3 Room UI logic
- Lobby: player list, privacy state, host controls.
- Start button enabled only for host + min players.
- UI lock during countdown.

### 4.4 Real-time updates + leaderboard syncing
- Debounced leaderboard re-renders (`requestAnimationFrame` batching).
- Use server sequence IDs to ensure in-order updates.
- On gap detection -> call `/snapshot` and hard-sync.

### 4.5 Game animation strategy
- Tailwind + Framer Motion.
- Pop animation for accepted answers.
- Micro-interactions: points fly-up, rank change pulse.
- Keep animations GPU-friendly (transform/opacity).

---

## 5) AI Category Generation System (Production-level)

### 5.1 Exact prompt (Gemini/OpenAI)

```txt
SYSTEM:
You generate category trivia packs for a real-time competitive game.
Return ONLY strict JSON matching the schema. No markdown.
Safety rules:
- No hateful, sexual, violent, self-harm, extremist, illegal-content categories.
- No personally identifying data.
Quality rules:
- Category should be globally understandable.
- Answers must be canonical, unambiguous, and <= 40 entries.
- Avoid duplicates, aliases, and spelling variants unless explicitly requested.
- Include difficulty tag and language code.

USER:
Generate one category pack using:
{
  "theme": "{{theme}}",
  "difficulty": "{{difficulty}}",
  "language": "{{language}}",
  "targetAnswerCount": {{count}}
}

JSON schema:
{
  "title": "string",
  "description": "string",
  "language": "ISO-639-1",
  "difficulty": "easy|medium|hard",
  "answers": ["string"],
  "synonyms": { "<canonical>": ["<alt1>", "<alt2>"] },
  "safety": { "safe": true, "reasons": [] }
}
```

### 5.2 Real validation code

```ts
import { z } from 'zod';

export const categoryResponseSchema = z.object({
  title: z.string().min(3).max(80),
  description: z.string().min(10).max(240),
  language: z.string().regex(/^[a-z]{2}$/),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  answers: z.array(z.string().min(1).max(60)).min(8).max(40),
  synonyms: z.record(z.array(z.string().min(1).max(60))).default({}),
  safety: z.object({
    safe: z.boolean(),
    reasons: z.array(z.string()).default([]),
  }),
});

export function validateCategoryPayload(input: unknown) {
  const result = categoryResponseSchema.safeParse(input);
  if (!result.success) {
    return { ok: false, errors: result.error.flatten() };
  }
  if (!result.data.safety.safe) {
    return { ok: false, errors: { policy: ['unsafe_category'] } };
  }
  return { ok: true, data: result.data };
}
```

### 5.3 Deduplication logic

```ts
export function normalizeAnswer(s: string): string {
  return s
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^\p{L}\p{N}\s'.-]/gu, '')
    .replace(/\s+/g, ' ');
}

export function dedupeAnswers(answers: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const a of answers) {
    const n = normalizeAnswer(a);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(a.trim());
  }
  return out;
}
```

### 5.4 Fallback if invalid JSON

1. Retry with a **repair prompt** (send validator errors).
2. If still invalid, fallback to cached pre-validated category from same theme+difficulty.
3. If cache miss, fallback to curated static seed pack.
4. Log AI failure metrics with provider/model/version.

```ts
async function robustGenerate(input) {
  const first = await callModel(input);
  const parsed = safeJsonParse(first);
  let validated = validateCategoryPayload(parsed);
  if (validated.ok) return validated.data;

  const repaired = await callModelWithRepair(input, validated.errors);
  validated = validateCategoryPayload(safeJsonParse(repaired));
  if (validated.ok) return validated.data;

  return getFallbackCategory(input.theme, input.difficulty, input.language);
}
```

---

## 6) Game Logic Design

### 6.1 Round lifecycle
1. `LOBBY` -> host triggers start.
2. `COUNTDOWN` (3–5 sec).
3. `ACTIVE` (timer running; submissions accepted).
4. `FINISHED` (all answers found OR timeout).
5. `RESULTS` (leaderboard freeze + MVP).
6. Optional auto-advance next round.

### 6.2 Scoring algorithm
- Base points = 100.
- Time multiplier = `1 + (remainingMs / roundDurationMs) * 0.75`.
- Streak bonus: +5% per streak step up to +25%.
- Hard difficulty multiplier: 1.2, medium 1.0, easy 0.9.
- Final points floored integer and capped per answer.

### 6.3 Tie-breaking
1. Total points desc.
2. Number of unique correct answers desc.
3. Earliest last-correct timestamp asc.
4. If still tied, shared rank.

### 6.4 Timeout handling
- Server owns timer; emits tick every 250ms (coalesced to 1s display client-side).
- Grace window 100ms for in-flight packets received before `endedAt`.

### 6.5 Duplicate answer handling
- First valid submission claims answer.
- Others receive duplicate message (no penalty by default).
- Optional competitive mode: repeated duplicates > N triggers small point decay.

---

## 7) Performance & Scaling

- Socket.io Redis adapter for cross-instance pub/sub.
- Sticky sessions at LB for websocket stability.
- Separate stateless API pods + stateful game-workers if load grows.
- Redis caches:
  - accepted answer sets
  - active room snapshots
  - leaderboard incremental state
- Mongo writes batched async for submissions (queue).
- Rate limiting: IP + user token bucket (REST + socket).
- Room cleanup job: auto-close empty rooms, remove stale Redis keys.
- Memory leak prevention:
  - enforce max room lifetime,
  - clear intervals/timeouts on room end,
  - weak maps / explicit destroy on disconnect.

---

## 8) Security

- Input sanitization via zod + server-side canonicalization.
- Helmet/CORS strict policies.
- JWT access short TTL (10–15 min), refresh rotation + revoke list.
- Socket auth on handshake + periodic re-auth for long sessions.
- Anti-spam:
  - max message rate,
  - repeated invalid answer cooldown,
  - chat/content moderation for room names/categories.
- Password hashing: Argon2id.
- Secrets in managed vault, never in repo.

---

## 9) DevOps & Deployment

### 9.1 Env vars
- `NODE_ENV`, `PORT`
- `MONGO_URI`
- `REDIS_URL`
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
- `GEMINI_API_KEY` / `OPENAI_API_KEY`
- `CORS_ORIGIN`
- `SENTRY_DSN`

### 9.2 CI/CD
- GitHub Actions pipeline:
  1. lint + typecheck
  2. unit + integration tests
  3. build artifacts
  4. deploy preview
  5. manual gate -> production

### 9.3 Production build setup
- FE: Vercel preview/prod environments.
- BE: Render/Railway autoscale by CPU + concurrent connections.
- Blue/green or rolling deployment for BE.

### 9.4 Logging strategy
- JSON logs with request-id + room-id + user-id correlation.
- Separate security audit stream.
- Alerting on error rate spikes, socket disconnect storm, AI validation failures.

---

## 10) Future Advanced Features

- **Ranked mode with Elo**
  - Separate MMR queue, anti-smurf checks, seasonal resets.
- **AI difficulty scaling**
  - Adaptive category complexity from player historical skill.
- **Category marketplace**
  - User-generated packs, moderation workflow, revenue split.
- **Analytics dashboard**
  - DAU/MAU, retention cohorts, room funnel, answer heatmaps, model quality KPIs.

---

## Team Implementation Plan (5 developers)

1. **Dev A (Backend Platform)**: auth, room APIs, infra libs.
2. **Dev B (Realtime/Game Engine)**: socket contract, scoring, anti-cheat.
3. **Dev C (AI + Category System)**: prompts, validators, moderation.
4. **Dev D (Frontend Experience)**: SPA flows, lobby/game UI, animations.
5. **Dev E (DevOps + QA)**: CI/CD, load tests, monitoring, chaos drills.

Deliver in milestones:
- M1: auth + rooms + realtime skeleton.
- M2: gameplay loop + leaderboard.
- M3: AI category generation + save/share.
- M4: hardening (security/scaling/observability).
- M5: beta + analytics + ranked preview.

---

## 3.8 Backend Runtime Orchestration (Deeper Production Plan)

### A) Room runtime model (authoritative in memory + Redis mirrors)
Each backend instance keeps a local `Map<roomCode, RoomRuntime>` for rooms with connected sockets on that node.
Redis holds coordination keys so any node can recover room runtime safely.

**Redis key layout**
- `room:{code}:meta` (hash): `status`, `hostUserId`, `roundId`, `version`
- `room:{code}:members` (set): active user ids
- `round:{id}:accepted` (set): normalized valid answers
- `round:{id}:found` (set): normalized answers already claimed
- `round:{id}:scores` (sorted set): `userId -> score`
- `room:{code}:events` (stream): append-only event journal (optional)

### B) Distributed locks for round transitions
Use Redlock (or single Redis lock as a baseline) for `round:start` and `round:end` so only one server instance performs the state transition.

```ts
// src/modules/game/round-transition.service.ts
const LOCK_TTL_MS = 4000;
const LOCK_RENEW_EVERY_MS = 1500; // renew well before TTL expiry

export async function withRoomLock<T>(roomCode: string, fn: () => Promise<T>): Promise<T> {
  const lockKey = `lock:room:${roomCode}:transition`;
  const token = crypto.randomUUID();
  const acquired = await redis.set(lockKey, token, { NX: true, PX: LOCK_TTL_MS });
  if (!acquired) throw new Error('ROOM_TRANSITION_IN_PROGRESS');

  const renewTimer = setInterval(async () => {
    try {
      // compare-and-pexpire so only the lock owner can renew TTL
      await redis.eval(
        `if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('PEXPIRE', KEYS[1], ARGV[2]) else return 0 end`,
        { keys: [lockKey], arguments: [token, String(LOCK_TTL_MS)] },
      );
    } catch (err) {
      logger.warn({ roomCode, err }, 'failed to renew room transition lock');
    }
  }, LOCK_RENEW_EVERY_MS);

  try {
    return await fn();
  } finally {
    clearInterval(renewTimer);
    // compare-and-delete (Lua) to avoid unlocking someone else's lock
    await redis.eval(
      `if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end`,
      { keys: [lockKey], arguments: [token] },
    );
  }
}
```

**Why this matters:** a fixed TTL without renewal can expire during slow transitions, allowing a second node to acquire the same room lock and run duplicate `round:start`/`round:end` handlers. Renewing lock ownership until `fn()` completes keeps transition execution single-writer.

### C) Idempotent command handling
Every state-changing command (`round:start`, `round:end`, `room:kick`) accepts a `commandId` (UUID from client). Store recent IDs in Redis with TTL to avoid duplicate execution from retries.

```ts
export async function ensureIdempotent(roomCode: string, commandId: string) {
  const key = `room:${roomCode}:cmd:${commandId}`;
  const ok = await redis.set(key, '1', { NX: true, EX: 60 });
  if (!ok) throw new Error('DUPLICATE_COMMAND');
}
```

### D) Persist strategy for high event throughput
- Write gameplay submissions to Kafka/BullMQ queue in near-real time.
- Worker batches inserts to `answers_submitted` every 100–250ms.
- Scoreboard remains Redis-first during active round; Mongo written on round finalize.

---

## 3.9 Backend API Contracts (Concrete examples)

### `POST /api/rooms`

**Request**
```json
{
  "visibility": "private",
  "password": "optional",
  "maxPlayers": 20,
  "roundDurationSec": 60,
  "language": "en"
}
```

**Response**
```json
{
  "room": {
    "code": "Q7PK9",
    "visibility": "private",
    "host": { "id": "u1", "username": "maya" },
    "status": "lobby"
  },
  "joinToken": "short-lived-room-jwt"
}
```

### `POST /api/ai/categories/generate`

**Request**
```json
{
  "theme": "Marvel Characters",
  "difficulty": "medium",
  "language": "en",
  "targetAnswerCount": 25
}
```

**Response**
```json
{
  "categoryId": "cat_900",
  "title": "Marvel Characters",
  "answerCount": 25,
  "answerHash": "sha256:...",
  "providerMeta": { "provider": "gemini", "model": "gemini-1.5-pro" }
}
```

---

## 3.10 Socket Acknowledgement Contract (recommended)

All critical socket events return a shared ACK envelope:

```ts
type Ack<T> =
  | { ok: true; data: T; seq?: number }
  | { ok: false; code: string; message?: string; retryable?: boolean };
```

**Example**
```ts
socket.emit('answer:submit', payload, (ack: Ack<{ points: number; rank: number }>) => {
  if (!ack.ok && ack.retryable) {
    // optional single retry strategy
  }
});
```

---

## 3.11 Anti-Cheat Implementation Snippets

### A) Sliding window rate limiter (Redis sorted set)

```ts
export async function checkAnswerRateLimit(userId: string, roomCode: string) {
  const key = `rl:answer:${roomCode}:${userId}`;
  const now = Date.now();
  const windowMs = 3_000;
  const maxEvents = 12;

  await redis.zRemRangeByScore(key, 0, now - windowMs);
  await redis.zAdd(key, { score: now, value: `${now}:${Math.random()}` });
  const count = await redis.zCard(key);
  await redis.expire(key, 5);

  if (count > maxEvents) throw new Error('RATE_LIMITED');
}
```

### B) Suspicious behavior scoring

```ts
interface SuspicionSignal {
  impossibleSpeed: boolean;
  invalidBurst: number;
  multiIpTokenReuse: boolean;
  repetitivePatternScore: number;
}

export function computeSuspicionScore(s: SuspicionSignal): number {
  let score = 0;
  if (s.impossibleSpeed) score += 40;
  score += Math.min(25, s.invalidBurst * 2);
  if (s.multiIpTokenReuse) score += 25;
  score += Math.min(20, s.repetitivePatternScore);
  return score;
}
```

Actions:
- score >= 50: temporary submit cooldown (10s)
- score >= 70: round mute + moderation event
- score >= 85: auto-kick + host/admin notification

---

## 5.5 Provider Abstraction Layer (Gemini/OpenAI)

Use provider adapters so the AI module is swappable without touching game logic.

```ts
// src/modules/ai/providers/types.ts
export interface GenerateJsonInput {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AiProvider {
  name: 'gemini' | 'openai';
  generateJson(input: GenerateJsonInput): Promise<string>;
}
```

```ts
// src/modules/ai/providers/gemini.provider.ts
export class GeminiProvider implements AiProvider {
  name = 'gemini' as const;

  async generateJson(input: GenerateJsonInput): Promise<string> {
    const res = await geminiClient.models.generateContent({
      model: 'gemini-1.5-pro',
      contents: `${input.system}\n\n${input.user}`,
      generationConfig: {
        temperature: input.temperature ?? 0.3,
        responseMimeType: 'application/json',
      },
    });
    return res.text ?? '{}';
  }
}
```

---

## 5.6 Response Guardrails Pipeline

Order of operations after model output:
1. **Parse** JSON (strict parser).
2. **Schema validate** (`zod`).
3. **Normalize** title/answers.
4. **Deduplicate** canonical answers.
5. **Policy filter** (block unsafe/ambiguous/proper-noun personal data).
6. **Quality checks** (min count, lexical diversity, uniqueness ratio).
7. **Persist + cache** only if all checks pass.

```ts
export function qualityCheck(answers: string[]) {
  const normalized = answers.map(normalizeAnswer);
  const unique = new Set(normalized).size;
  const uniquenessRatio = unique / Math.max(1, answers.length);

  if (answers.length < 8) throw new Error('LOW_ANSWER_COUNT');
  if (uniquenessRatio < 0.9) throw new Error('LOW_UNIQUENESS_RATIO');
}
```

---

## 5.7 Synonym Mapping Strategy (for fair matching)

AI can return synonyms. Convert those into canonical aliases at round start.

```ts
export function buildAliasMap(payload: {
  answers: string[];
  synonyms: Record<string, string[]>;
}) {
  const aliasToCanonical = new Map<string, string>();

  for (const canonical of payload.answers) {
    const c = normalizeAnswer(canonical);
    aliasToCanonical.set(c, c);

    for (const alt of payload.synonyms[canonical] ?? []) {
      const a = normalizeAnswer(alt);
      if (a) aliasToCanonical.set(a, c);
    }
  }

  return aliasToCanonical;
}
```

Validation during answer submit:
- normalize user input to alias form.
- map alias to canonical.
- canonical must exist in accepted answer set.

This allows matching `spider man` => `spider-man` (canonical) without exposing full alias dictionary to clients.

---

## 5.8 AI Failure Budget + Circuit Breaker

To protect gameplay from provider outages:
- Track rolling success/failure rates per provider model.
- If failure ratio > threshold (e.g., 30% over 2 mins), open breaker.
- Route to alternate provider or cached packs until half-open retry succeeds.

```ts
class CircuitBreaker {
  private failures = 0;
  private successes = 0;
  private openedAt: number | null = null;

  canCall() {
    if (!this.openedAt) return true;
    return Date.now() - this.openedAt > 30_000; // half-open cooldown
  }

  record(ok: boolean) {
    if (ok) this.successes += 1;
    else this.failures += 1;

    const total = this.successes + this.failures;
    if (total >= 20 && this.failures / total > 0.3) this.openedAt = Date.now();
  }
}
```

---

## 5.9 Category Persistence Model (versioned)

When category content is edited (moderation/creator updates), increment version and preserve immutable history.

```json
{
  "_id": "cat_900_v2",
  "rootCategoryId": "cat_900",
  "version": 2,
  "title": "Marvel Characters",
  "answers": ["Iron Man", "Thor", "Black Widow"],
  "source": "ai",
  "providerMeta": {
    "provider": "gemini",
    "model": "gemini-1.5-pro",
    "promptVersion": "2026-02-24.1"
  },
  "status": "approved",
  "createdAt": "2026-02-24T12:00:00.000Z"
}
```

Store `promptVersion` + model metadata for auditability and reproducibility.

---

## 5.10 AI Testing Matrix (must-have)

Automated tests should include:
- schema rejection for malformed responses
- normalization edge cases (Unicode accents, apostrophes, punctuation)
- dedupe collisions (`Spider-Man`, `spider man`, `SPIDERMAN`)
- safety rejection for blocked category types
- fallback path when provider returns non-JSON
- provider failover from Gemini -> OpenAI

Example test case table:

| Case | Input | Expected |
|---|---|---|
| invalid_json | `"Here is your list"` | repair attempt -> fallback |
| duplicate_aliases | `answers=["React","react "]` | single canonical answer |
| unsafe_payload | safety.safe=false | reject + policy error |
| low_count | 3 answers | reject quality gate |

