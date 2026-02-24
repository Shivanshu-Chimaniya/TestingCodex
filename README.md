# PopSauce AI - Initial Backend Skeleton

This repository now includes the **first implementation slice** from the architecture doc:

- Express API with auth + room endpoints, including access + refresh token flow.
- Socket.io `/game` namespace with JWT auth middleware.
- Real-time room + gameplay events: `room:join`, `round:start`, `answer:submit`, countdown/tick/end, leaderboard sync.
- In-memory services for users, rooms, and basic room state.

## Run

```bash
npm install
npm run dev
```

Server defaults to port `3000`.
