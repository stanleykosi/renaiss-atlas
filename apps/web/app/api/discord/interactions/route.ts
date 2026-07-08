import { NextResponse } from "next/server";
import {
  getDiscordUserId,
  handleAtlasInteraction,
  isDiscordPing,
  parseDiscordInteraction,
  pongResponse,
  verifyDiscordInteractionRequest,
  type AtlasDiscordDataProvider,
  type DiscordInteraction,
  type DiscordInteractionResponse
} from "@renaiss/discord";
import {
  createDbClient,
  createDiscordEventsRepo,
  DatabaseEnvSchema
} from "@renaiss/db";

import { getBundleOverview } from "@/lib/bundle-data";
import { allowSeedData } from "@/lib/data-mode";
import { getIntentBoard } from "@/lib/intent-data";
import { getCardDetail, getMarketOverview } from "@/lib/market-data";
import { getPackMomentumOverview } from "@/lib/pack-data";
import { getWalletCopilot } from "@/lib/wallet-data";

export const runtime = "nodejs";

const provider = {
  getMarketOverview,
  getCardDetail,
  getWalletCopilot,
  getIntentBoard,
  getBundleOverview,
  getPackMomentumOverview
} satisfies AtlasDiscordDataProvider;

function appUrl(): string {
  return process.env["NEXT_PUBLIC_APP_URL"] ?? "http://localhost:3000";
}

function commandName(interaction: DiscordInteraction): string | null {
  const root = interaction.data?.name;
  const subcommand = interaction.data?.options?.find((option) => option.type === 1)?.name;
  if (root == null) return subcommand ?? null;
  return subcommand == null ? root : `${root} ${subcommand}`;
}

async function recordDiscordEvent(input: {
  interaction: DiscordInteraction;
  response: DiscordInteractionResponse;
}) {
  const env = DatabaseEnvSchema.safeParse(process.env);
  if (!env.success || allowSeedData()) return;

  const database = createDbClient(env.data.DATABASE_URL, {
    databaseSsl: env.data.DATABASE_SSL,
    max: 1
  });

  try {
    const repo = createDiscordEventsRepo(database.db);
    await repo.create({
      interactionId: input.interaction.id ?? null,
      discordUserId: getDiscordUserId(input.interaction),
      commandName: commandName(input.interaction),
      requestJson: input.interaction,
      responseJson: input.response
    });
  } catch (error) {
    console.warn("discord_event_record_failed", error);
  } finally {
    await database.close();
  }
}

export async function POST(request: Request) {
  const publicKey = process.env["DISCORD_PUBLIC_KEY"];

  if (publicKey == null || publicKey.length === 0) {
    return NextResponse.json({ error: "Discord public key is not configured." }, { status: 503 });
  }

  const rawBody = await request.text();
  const valid = await verifyDiscordInteractionRequest({
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
    interaction = parseDiscordInteraction(JSON.parse(rawBody));
  } catch {
    return NextResponse.json({ error: "Invalid Discord interaction payload." }, { status: 400 });
  }

  const response = isDiscordPing(interaction)
    ? pongResponse()
    : await handleAtlasInteraction(interaction, provider, {
        appUrl: appUrl()
      });

  await recordDiscordEvent({ interaction, response });

  return NextResponse.json(response);
}
