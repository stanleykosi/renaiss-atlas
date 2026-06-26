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
- `packages/core` strict env validation, source schemas, and safety guardrail constants.
- `packages/db` Drizzle/Postgres scaffold with source-record-first tables.
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

The job, seed, and Discord scripts are safe scaffold commands until the later implementation phases wire real logic.

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

Phase 1 should add the full core domain schemas and utilities:

- card, price, external comp, pack, intent, bundle, score, action, and AI memo schemas;
- money, serial, source, freshness, and hash utilities;
- focused tests for price conversion, serial parsing, source IDs, schema parsing, and freshness labels.
