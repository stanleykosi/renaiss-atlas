import { NextResponse } from "next/server";

import {
  isDiscordPing,
  parseDiscordInteraction,
  pongResponse,
  verifyDiscordInteractionRequest,
  type DiscordInteraction
} from "@/lib/discord/interactions";
import { handleAtlasDiscordInteraction } from "@/lib/discord/responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function appUrl(): string {
  const configured =
    process.env["NEXT_PUBLIC_APP_URL"] ??
    process.env["VERCEL_PROJECT_PRODUCTION_URL"] ??
    process.env["VERCEL_URL"];
  if (configured == null) return "http://localhost:3000";
  return configured.startsWith("http") ? configured : `https://${configured}`;
}

export function GET() {
  return NextResponse.json({
    ok: true,
    service: "renaiss-atlas-discord-interactions"
  });
}

export async function POST(request: Request) {
  const publicKey = process.env["DISCORD_PUBLIC_KEY"];
  if (publicKey == null || publicKey.length === 0) {
    return NextResponse.json({ error: "Discord public key is not configured." }, { status: 503 });
  }

  const rawBody = await request.text();
  const valid = verifyDiscordInteractionRequest({
    rawBody,
    signature: request.headers.get("x-signature-ed25519"),
    timestamp: request.headers.get("x-signature-timestamp"),
    publicKey
  });

  if (!valid) {
    return NextResponse.json({ error: "Invalid Discord signature." }, { status: 401 });
  }

  let interaction: DiscordInteraction;
  try {
    const payload: unknown = JSON.parse(rawBody);
    interaction = parseDiscordInteraction(payload);
  } catch {
    return NextResponse.json({ error: "Invalid Discord interaction payload." }, { status: 400 });
  }

  const response = isDiscordPing(interaction)
    ? pongResponse()
    : await handleAtlasDiscordInteraction(interaction, { appUrl: appUrl() });

  return NextResponse.json(response);
}
