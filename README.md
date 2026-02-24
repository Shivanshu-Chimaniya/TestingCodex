# PopSauce AI - Initial Backend Skeleton

This repository now includes the **first implementation slice** from the architecture doc:

- Express API with auth + room endpoints.
- Socket.io `/game` namespace with JWT auth middleware.
- Room join real-time event (`room:join`) and `room:player_joined` broadcast.
- In-memory services for users, rooms, and basic room state.

## Run

```bash
npm install
npm run dev
```

Server defaults to port `3000`.
