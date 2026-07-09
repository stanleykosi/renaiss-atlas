import { createPublicKey, verify as verifySignature } from "node:crypto";
import { z } from "zod";

const DISCORD_ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
const PING_INTERACTION_TYPE = 1;
const SUB_COMMAND_OPTION_TYPE = 1;

export const DiscordCommandOptionSchema: z.ZodType<DiscordCommandOption> = z.lazy(() =>
  z
    .object({
      name: z.string(),
      type: z.number(),
      value: z.unknown().optional(),
      options: z.array(DiscordCommandOptionSchema).optional()
    })
    .passthrough()
);

export const DiscordInteractionSchema = z
  .object({
    id: z.string().optional(),
    type: z.number(),
    data: z
      .object({
        name: z.string(),
        options: z.array(DiscordCommandOptionSchema).optional()
      })
      .passthrough()
      .optional()
  })
  .passthrough();

export type DiscordCommandOption = {
  name: string;
  type: number;
  value?: unknown;
  options?: DiscordCommandOption[] | undefined;
};

export type DiscordInteraction = z.infer<typeof DiscordInteractionSchema>;

export type DiscordInteractionResponse = {
  type: number;
  data?: {
    content: string;
    flags?: number;
    allowed_mentions?: {
      parse: string[];
    };
  };
};

export type AtlasDiscordSubcommand = "market" | "card" | "graded";

export function parseDiscordInteraction(input: unknown): DiscordInteraction {
  return DiscordInteractionSchema.parse(input);
}

export function isDiscordPing(interaction: DiscordInteraction): boolean {
  return interaction.type === PING_INTERACTION_TYPE;
}

export function pongResponse(): DiscordInteractionResponse {
  return { type: 1 };
}

export function messageResponse(content: string): DiscordInteractionResponse {
  return {
    type: 4,
    data: {
      content: content.slice(0, 1900),
      flags: 64,
      allowed_mentions: { parse: [] }
    }
  };
}

export function getAtlasSubcommand(interaction: DiscordInteraction): {
  name: AtlasDiscordSubcommand | null;
  options: DiscordCommandOption[];
} {
  const options = interaction.data?.options ?? [];
  const subcommand = options.find((option) => option.type === SUB_COMMAND_OPTION_TYPE);
  const name = subcommand?.name;
  const validName = name === "market" || name === "card" || name === "graded" ? name : null;

  return {
    name: validName,
    options: subcommand?.options ?? []
  };
}

export function stringOption(options: readonly DiscordCommandOption[], name: string): string | null {
  const value = options.find((option) => option.name === name)?.value;
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function isHex(value: string): boolean {
  return value.length % 2 === 0 && /^[\da-f]+$/i.test(value);
}

export function verifyDiscordInteractionRequest(input: {
  rawBody: string;
  signature: string | null;
  timestamp: string | null;
  publicKey: string | null | undefined;
}): boolean {
  if (
    input.publicKey == null ||
    input.signature == null ||
    input.timestamp == null ||
    !isHex(input.publicKey) ||
    !isHex(input.signature)
  ) {
    return false;
  }

  const publicKeyBytes = Buffer.from(input.publicKey, "hex");
  const signatureBytes = Buffer.from(input.signature, "hex");
  if (publicKeyBytes.length !== 32 || signatureBytes.length !== 64) {
    return false;
  }

  const publicKey = createPublicKey({
    key: Buffer.concat([DISCORD_ED25519_SPKI_PREFIX, publicKeyBytes]),
    format: "der",
    type: "spki"
  });

  return verifySignature(
    null,
    Buffer.from(`${input.timestamp}${input.rawBody}`),
    publicKey,
    signatureBytes
  );
}
