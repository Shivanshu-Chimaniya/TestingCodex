# PopSauce AI - Backend + Frontend Architecture Slices

This repository includes implementation slices from the architecture document:

- Backend modular Socket.io + REST scaffolding (auth, rooms, game namespace).
- Frontend React + Zustand + React Query architecture under `frontend/`.
- Real-time room/game wiring patterns with sequence-aware leaderboard syncing.

## Run backend

```bash
npm install
npm run dev
```

Server defaults to port `3000`.

## Run frontend

```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0 --port 4173
```

Frontend defaults to port `4173`.

## DevOps / Deployment

- Environment template: `.env.example`
- CI/CD workflow: `.github/workflows/ci-cd.yml`
- Deployment/logging runbook: `docs/devops-deployment.md`
