# PopSauce AI - Backend M1/M2 Skeleton

This repo now implements architecture sections **1.2** (request/response flow) and **1.3** (real-time event flow) with in-memory runtime.

## Included flows

- Auth REST:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `POST /api/auth/refresh`
  - `POST /api/auth/logout`
  - `GET /api/auth/me`
- Room REST:
  - `POST /api/rooms`
  - `GET /api/rooms/:code`
  - `POST /api/rooms/:code/join`
  - `POST /api/rooms/:code/start`
  - `POST /api/rooms/:code/end`
  - `GET /api/rooms/:code/snapshot`
- AI REST:
  - `POST /api/ai/categories/generate`
- Socket `/game` events:
  - Client -> server: `room:join`, `room:leave`, `round:start`, `answer:submit`, `ping:latency`
  - Server -> client: `room:state`, `room:player_joined`, `round:countdown`, `round:active`, `round:tick`, `round:end`, `answer:accepted`, `answer:rejected`, `leaderboard:update`
  - Critical events use ACK envelopes (`ok`, `code`, optional `seq`)

## Run

```bash
npm install
npm run dev
```
