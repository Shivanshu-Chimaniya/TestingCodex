# DevOps & Deployment Setup

## Environment variables

Backend runtime variables expected in every environment:

- `NODE_ENV`, `PORT`
- `MONGO_URI`
- `REDIS_URL`
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
- `GEMINI_API_KEY` or `OPENAI_API_KEY`
- `CORS_ORIGIN`
- `SENTRY_DSN`

Use `.env.example` as the source-of-truth template for local onboarding.

## CI/CD pipeline

The GitHub Actions workflow (`.github/workflows/ci-cd.yml`) runs:

1. lint + typecheck (`npm run typecheck`)
2. unit + integration tests (`node --test`)
3. backend + frontend builds
4. preview deployment stage on pull requests
5. manual production gate (`workflow_dispatch` + protected `production` environment)

## Production build setup

### Frontend (Vercel)

- Vercel project should define separate Preview and Production environments.
- Each environment should set API base URL and Socket URL via Vite env vars.
- PRs map to Preview deployments; merges to `main` map to Production.

### Backend (Render/Railway)

- Enable autoscaling based on:
  - CPU utilization
  - concurrent connections
- Use rolling (or blue/green) deploy strategy:
  - run new instances before draining old instances
  - keep websocket sticky sessions enabled at the load balancer

## Logging and alerting

- App logs are emitted as JSON and include correlation fields:
  - `requestId`
  - `roomId`
  - `userId`
- Security audit events are emitted to a dedicated `security_audit` stream.
- Alert events emitted by backend logger:
  - `alert.error_rate_spike`
  - `alert.socket_disconnect_storm`
  - `alert.ai_validation_failures`
