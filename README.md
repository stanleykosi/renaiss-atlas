# Renaiss Atlas

Renaiss Atlas is a production-ready liquidity oracle and AI collector copilot for the Renaiss marketplace. It turns marketplace, pack, wallet, external comp, serial, bundle, and collector-intent signals into source-aware next actions.

Atlas is read-only. It does not collect private keys or seed phrases, request token approvals, execute trades, custody assets, or ask wallets to sign.

## What Is Included

- `pnpm` + Turborepo TypeScript monorepo.
- `apps/web` Next.js App Router app with Tailwind, shadcn-style primitives, market/card/wallet/intent/bundle/pack/admin views, and route handlers.
- `apps/api` Hono health service.
- `apps/worker` sync, scoring, bundle, and external comp jobs with Postgres job locks.
- `apps/discord` signed Discord interaction endpoint and `/atlas` command registration.
- `packages/core` Zod schemas, deterministic scoring, matching, bundle detection, and utilities.
- `packages/db` Postgres + Drizzle schema, migrations, repositories, and labeled local seed fixtures.
- `packages/connectors` Renaiss, gacha, SNKRDUNK, PriceCharting, exchange, queue, retry, and persistence modules.
- `packages/ai` provider abstraction, schema validation, confidence caps, safety validation, and deterministic fallback.

## Local Setup

```bash
pnpm install
cp .env.example .env
pnpm typecheck
pnpm test
pnpm dev
```

The web app runs at `http://localhost:3000`. Live mode is the default; configure `DATABASE_URL` and Redis before using writable endpoints.

## Required Commands

```bash
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm security:scan
pnpm verify:vercel-env
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm jobs:sync:renaiss
pnpm jobs:sync:gacha
pnpm jobs:sync:external
pnpm jobs:score
pnpm jobs:bundles
pnpm jobs:intents
pnpm discord:register
```

## Live Data Mode

Production deploys use live Postgres data by default and do not fall back to fixtures. For local screenshots or tests only, opt into labeled seed fixtures:

```bash
ALLOW_SEED_DATA=true
```

Do not set `ALLOW_SEED_DATA=true` on Vercel or Railway production. Fixture data remains explicitly labeled in UI and API responses when enabled locally.

## Health And Admin

- `/api/health/live` liveness check.
- `/api/health/ready` readiness check for database, Redis, Sentry, and freshness.
- `/api/health` full JSON health report.
- `/admin/sync` operator dashboard for sync runs, job locks, and data-quality warnings.
- `/api/admin/sync/jobs` accepts authenticated manual sync requests with `Authorization: Bearer $JOB_SECRET`.

Worker jobs use the existing `job_locks` table. Stale locks expire after `JOB_LOCK_TTL_SECONDS`.

## Observability

Sentry is configured through `@sentry/nextjs` with App Router instrumentation. Set:

```bash
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_ORG=
SENTRY_PROJECT=
SENTRY_AUTH_TOKEN=
SENTRY_ENVIRONMENT=production
```

Logs are structured JSON in server output and forwarded through Sentry logging when the SDK is configured.

## Security

Run:

```bash
pnpm security:scan
```

The scan checks source/config files for committed private keys, provider tokens, wallet private key env values, and prohibited approval/trade execution calls. Run it before deployments alongside lint/typecheck/tests/build/E2E.

## Deployment

See [docs/deployment.md](docs/deployment.md) for environment variables, health checks, Vercel/Railway deployment notes, job scheduling, Sentry setup, and screenshot capture.

## Screenshots

Local E2E captures seed-fixture screenshots into [docs/screenshots](docs/screenshots):

- `market.png`
- `card-detail.png`
- `admin-sync.png`
