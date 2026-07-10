import { createPublicKey, verify as verifySignature } from "node:crypto";
import { z } from "zod";

const DISCORD_ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
const PING_INTERACTION_TYPE = 1;
const APPLICATION_COMMAND_INTERACTION_TYPE = 2;
const SUB_COMMAND_OPTION_TYPE = 1;
const STRING_OPTION_TYPE = 3;

type DiscordSubcommandOption = {
  name: string;
  type: typeof SUB_COMMAND_OPTION_TYPE;
  options?: DiscordCommandOption[] | undefined;
};

type DiscordStringOption = {
  name: string;
  type: typeof STRING_OPTION_TYPE;
  value: string;
};

export type DiscordCommandOption = DiscordSubcommandOption | DiscordStringOption;

const DiscordCommandOptionSchema: z.ZodType<DiscordCommandOption> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.object({
      name: z.string(),
      type: z.literal(SUB_COMMAND_OPTION_TYPE),
      options: z.array(DiscordCommandOptionSchema).optional()
    }),
    z.object({
      name: z.string(),
      type: z.literal(STRING_OPTION_TYPE),
      value: z.string()
    })
  ])
);

const DiscordInteractionSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string().optional(),
    type: z.literal(PING_INTERACTION_TYPE)
  }),
  z.object({
    id: z.string().optional(),
    type: z.literal(APPLICATION_COMMAND_INTERACTION_TYPE),
    data: z.object({
      name: z.literal("atlas"),
      options: z.array(DiscordCommandOptionSchema).optional()
    })
  })
]);

export type DiscordInteraction = z.infer<typeof DiscordInteractionSchema>;

type DiscordPongResponse = {
  type: 1;
};

type DiscordMessageResponse = {
  type: 4;
  data: {
    content: string;
    flags: 64;
    allowed_mentions: {
      parse: [];
    };
  };
};

export type DiscordInteractionResponse = DiscordPongResponse | DiscordMessageResponse;

type AtlasDiscordSubcommand = "market" | "card" | "graded";

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
  if (interaction.type !== APPLICATION_COMMAND_INTERACTION_TYPE) {
    return { name: null, options: [] };
  }

  const options = interaction.data.options ?? [];
  const subcommand = options.find((option) => option.type === SUB_COMMAND_OPTION_TYPE);
  const name = subcommand?.name;
  const validName = name === "market" || name === "card" || name === "graded" ? name : null;

  return {
    name: validName,
    options: subcommand?.options ?? []
  };
}

export function stringOption(
  options: readonly DiscordCommandOption[],
  name: string
): string | null {
  const option = options.find(
    (candidate): candidate is DiscordStringOption =>
      candidate.type === STRING_OPTION_TYPE && candidate.name === name
  );
  if (option == null) return null;
  const value = option.value.trim();
  return value.length > 0 ? value : null;
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
