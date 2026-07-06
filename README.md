# Renaiss Atlas

Renaiss Atlas is the missing liquidity intelligence layer for the collector economy: it turns marketplace, pack, wallet, external-price, serial, bundle, and collector-intent signals into clear next actions with evidence and risk labels.

Community tools are excellent at finding individual signals. Renaiss Atlas turns those signals into a source-aware action layer for the entire collector economy.

## Scaffold Status

This repository is at phase 0 from `IMPLEMENTATION_PLAN.md`.

Included:

- `pnpm` + `turbo` TypeScript monorepo.
- `apps/web` Next.js App Router shell with Tailwind CSS and shadcn-style local UI primitives.
- `apps/api` Hono scaffold with a health endpoint.
- `apps/worker` no-op job command scaffolds.
- `apps/discord` slash-command registration scaffold.
- `packages/core` strict Zod domain schemas and deterministic utilities.
- `packages/db` Postgres + Drizzle schema, migration runner, repositories, and mock-labeled demo seed fixtures.
- `packages/connectors` typed connector contract.
- `packages/ai` schema-validated AI memo output contract and prohibited phrase catalog.
- `packages/ui` optional shared UI utility package.

Product logic is intentionally deferred until the scaffold, TypeScript config, linting, tests, env validation, and README are in place.

## Safety Boundaries

Atlas is read-only. It must not request private keys, seed phrases, wallet signatures, token approvals, custody, trade execution, lending execution, or hidden wallet tracking.

AI output must be generated from backend-provided structured facts, validated against schema, source-cited, and shown with confidence, risks, and disclaimers. Mock or demo data must be clearly labeled.

## Local Setup

```bash
pnpm install
cp .env.example .env
pnpm typecheck
pnpm test
pnpm dev
```

The web app runs at `http://localhost:3000`. The Hono API scaffold uses `API_PORT=3001`.

Intent creation uses Redis REST rate limiting in production. Set `INTENT_RATE_LIMIT_REDIS_REST_URL` and `INTENT_RATE_LIMIT_REDIS_REST_TOKEN`, or the Upstash-compatible `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. Demo mode allows local intent previews without Redis.

## Commands

```bash
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm jobs:sync:renaiss
pnpm jobs:sync:gacha
pnpm jobs:score
pnpm jobs:bundles
pnpm jobs:intents
pnpm discord:register
```

The job and Discord scripts are safe scaffold commands until later implementation phases wire real logic. The DB scripts expect `DATABASE_URL`; set `DATABASE_SSL=true` for Supabase if your URL does not already include `sslmode=require`.

## Database

`packages/db` maps `DATABASE_SCHEMA.sql` into Drizzle tables and includes an idempotent SQL migration at `packages/db/migrations/0000_initial.sql`.

```bash
pnpm db:migrate
pnpm db:seed
```

`pnpm db:migrate` applies the checked-in SQL migration. It uses `IF NOT EXISTS` table/index creation and duplicate-safe enum blocks, so it is suitable for a Supabase project where the schema has already been applied.

`pnpm db:seed` inserts clearly labeled demo/mock source records, seven wallet cards, latest price rows, external comp accepted/rejected examples, pack activity for RenaCrypt and OMEGA, an active intent, two bundles, scores, an action recommendation, an AI memo, a wallet snapshot, and a quest.

## Data Sources

Planned source modules:

- Renaiss marketplace `v0`.
- Renaiss marketplace tRPC fallback.
- Renaiss gacha RSC pages.
- SNKRDUNK.
- PriceCharting.
- Exchange rates.
- Discord interactions and structured intents.
- Manual seed and clearly labeled mock data.

Every connector must capture source URL, fetched timestamp, raw source record or useful excerpt, parse status, warnings, confidence, and freshness.

## Next Implementation Phase

Phase 3 should add DB-backed service wiring and connector persistence:

- repository integration tests against disposable Postgres;
- Renaiss marketplace connector persistence into source records, cards, and prices;
- worker commands that create sync runs and data-quality events.
