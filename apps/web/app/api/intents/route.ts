import { isAddress } from "viem";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createIntentWithMatches, getIntentBoard } from "@/lib/intent-data";
import { checkIntentRateLimit } from "@/lib/redis-rate-limit";

const EmptyToUndefinedString = z.preprocess(
  (value) => (typeof value === "string" && value.trim().length === 0 ? undefined : value),
  z.string().trim().optional()
);

const OptionalMoneyString = z.preprocess(
  (value) => (typeof value === "string" && value.trim().length === 0 ? undefined : value),
  z
    .string()
    .trim()
    .regex(/^(0|[1-9]\d*)(\.\d+)?$/)
    .optional()
);

const OptionalNumber = z.preprocess(
  (value) => (typeof value === "string" && value.trim().length === 0 ? undefined : value),
  z.coerce.number().optional()
);

const BooleanField = z.preprocess(
  (value) => {
    if (value === true || value === "true" || value === "on" || value === "1") return true;
    if (value === false || value === "false" || value === "off" || value === "0") return false;
    return value;
  },
  z.boolean().default(false)
);

const CreateIntentRequestSchema = z.object({
  creatorAlias: EmptyToUndefinedString,
  creatorWallet: EmptyToUndefinedString,
  intentType: z.enum(["buy", "sell", "bundle", "trade", "watch", "quest"]).default("buy"),
  queryText: z.string().trim().min(3).max(500),
  tcg: EmptyToUndefinedString,
  characterName: EmptyToUndefinedString,
  setName: EmptyToUndefinedString,
  cardNumber: EmptyToUndefinedString,
  grader: EmptyToUndefinedString,
  grade: EmptyToUndefinedString,
  language: EmptyToUndefinedString,
  minYear: OptionalNumber.pipe(z.number().int().min(1800).max(2200).optional()),
  maxYear: OptionalNumber.pipe(z.number().int().min(1800).max(2200).optional()),
  minPriceUsd: OptionalMoneyString,
  maxPriceUsd: OptionalMoneyString,
  requiresSerialAdjacency: BooleanField,
  requiresExternalComp: BooleanField,
  minLiquidityScore: OptionalNumber.pipe(z.number().min(0).max(100).optional())
});

function clientKey(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  return forwardedFor ?? realIp ?? "local";
}

function isLikelySpam(queryText: string): boolean {
  const urlCount = (queryText.match(/https?:\/\//gi) ?? []).length;
  const repeatedCharacters = /(.)\1{12,}/.test(queryText);
  const noisyWords = /\b(seed phrase|private key|airdrop|free money|guaranteed profit)\b/i.test(queryText);
  return urlCount > 1 || repeatedCharacters || noisyWords;
}

export async function GET() {
  return NextResponse.json(await getIntentBoard());
}

export async function POST(request: Request) {
  const limited = await checkIntentRateLimit({ identifier: clientKey(request) });
  if (limited.status !== "allowed") {
    const unavailable = limited.status === "unavailable";
    return NextResponse.json(
      {
        error: unavailable
          ? "Intent creation is temporarily unavailable. Redis rate limiting is required."
          : "Too many intent submissions. Please wait before creating another intent.",
        retryAfterSeconds: limited.retryAfterSeconds
      },
      {
        status: unavailable ? 503 : 429,
        headers: {
          "Retry-After": String(limited.retryAfterSeconds)
        }
      }
    );
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = CreateIntentRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid intent input." }, { status: 400 });
  }

  if (parsed.data.creatorWallet != null && !isAddress(parsed.data.creatorWallet)) {
    return NextResponse.json({ error: "Creator wallet must be a valid EVM address." }, { status: 400 });
  }

  if (isLikelySpam(parsed.data.queryText)) {
    return NextResponse.json({ error: "Intent text looks spammy. Please make it specific and source-safe." }, { status: 400 });
  }

  const result = await createIntentWithMatches(parsed.data);
  return NextResponse.json(result, { status: 201 });
}
