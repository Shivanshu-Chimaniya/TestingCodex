# PopSauce AI - Backend Architecture (Part 3 Completed)

This repository now includes the **third implementation slice** from the architecture doc (backend structure):

- Split socket handlers (`room.handlers`, `answer.handlers`) with typed event contracts.
- Expanded game engine internals with modular normalization, anti-cheat checks, and dynamic scoring.
- Validation + rate-limit + error middleware applied at API boundaries.
- Existing auth + room REST endpoints and `/game` Socket.io namespace remain fully wired.

## Run

```bash
npm install
npm run dev
```

Server defaults to port `3000`.
