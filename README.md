# Renaiss Atlas

Renaiss Atlas is a read-only liquidity intelligence and AI collector-copilot layer built around the official Renaiss OS Index API.

Atlas does not collect private keys or seed phrases, request token approvals, execute trades, custody assets, or ask wallets to sign.

## Current Product Surface

- `apps/web` Next.js App Router app.
- `apps/web/app/v1/[...path]/route.ts` backend proxy for the official Renaiss OS Index API.
- `apps/web/app/api/discord/interactions/route.ts` signed Discord interactions endpoint.
- `packages/core` official scoring, source/freshness schemas, safety constants, and utilities.
- `packages/ai` schema-validated OpenRouter Collector Brief provider. If OpenRouter is missing, unavailable, or unsafe, Atlas fails loudly instead of fabricating fallback analysis.
- Discord is supported as a Vercel-hosted interactions webhook, not a long-running gateway worker.

The production path is:

```text
Market Pulse -> Search Card -> Card Intelligence -> Graded Cert Lookup -> Collector Brief
```

## Official API

Atlas uses only:

```bash
RENAISS_OS_BASE_URL=https://api.renaissos.com
RENAISS_OS_API_KEY=
RENAISS_OS_API_SECRET=
```

`RENAISS_OS_API_KEY` and `RENAISS_OS_API_SECRET` are read only by server-side code and are never exposed to client components.

The checked-in official API spec is `OPENAPI.json`.

## Local Setup

```bash
pnpm install
cp .env.example .env
pnpm typecheck
pnpm test
pnpm dev
```

The web app runs at `http://localhost:3000`.

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
pnpm screenshots
```

## Vercel Environment

Required:

```bash
RENAISS_OS_BASE_URL=https://api.renaissos.com
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
OPENROUTER_API_KEY=
OPENROUTER_MODEL=
```

Recommended:

```bash
NEXT_PUBLIC_APP_URL=https://your-atlas-domain.example
RENAISS_OS_API_KEY=
RENAISS_OS_API_SECRET=
```

`NEXT_PUBLIC_APP_URL` can be omitted on Vercel because Atlas falls back to Vercel's deployment URL. Set it when you have a custom production domain.

Optional Discord:

```bash
DISCORD_PUBLIC_KEY=
DISCORD_APPLICATION_ID=
DISCORD_BOT_TOKEN=
DISCORD_GUILD_ID=
```

Optional Sentry:

```bash
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_ORG=
SENTRY_PROJECT=
SENTRY_AUTH_TOKEN=
SENTRY_ENVIRONMENT=production
```

The current production app is designed to run entirely on Vercel. Railway is not required unless Atlas later adds a long-running worker, database indexer, Discord gateway process, or other always-on service.

Discord interactions URL:

```text
https://your-atlas-domain.example/api/discord/interactions
```

Supported Discord commands: `/atlas market`, `/atlas card`, and `/atlas graded`.

Register commands with:

```bash
pnpm discord:register
```

## Safety

- Read-only API consumption only.
- No private keys, seed phrases, token approvals, custody, lending execution, or trade execution.
- Deterministic scoring runs before AI.
- AI output is Zod-validated, citation-checked, confidence-capped, and rejected when unsafe or unavailable.
- Scores and Collector Briefs use official Renaiss OS confidence, source counts, observation counts, last sale timestamps, trades, FMV series, and source breakdown.

## Deployment

See [docs/deployment.md](docs/deployment.md).
