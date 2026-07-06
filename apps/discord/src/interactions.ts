import { z } from "zod";
import { InteractionResponseFlags, InteractionResponseType } from "discord-interactions";

import type { AtlasCommandName } from "./commands.js";

const SUB_COMMAND_OPTION_TYPE = 1;
const PING_INTERACTION_TYPE = 1;

export type DiscordCommandOption = {
  name: string;
  type: number;
  value?: unknown;
  options?: DiscordCommandOption[] | undefined;
};

const DiscordCommandOptionSchema: z.ZodType<DiscordCommandOption> = z.lazy(() =>
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
      .optional(),
    member: z
      .object({
        user: z
          .object({
            id: z.string().optional()
          })
          .passthrough()
          .optional()
      })
      .passthrough()
      .optional(),
    user: z
      .object({
        id: z.string().optional()
      })
      .passthrough()
      .optional()
  })
  .passthrough();

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

export function parseDiscordInteraction(input: unknown): DiscordInteraction {
  return DiscordInteractionSchema.parse(input);
}

export function isDiscordPing(interaction: DiscordInteraction): boolean {
  return interaction.type === PING_INTERACTION_TYPE;
}

export function pongResponse(): DiscordInteractionResponse {
  return { type: InteractionResponseType.PONG };
}

export function messageResponse(content: string): DiscordInteractionResponse {
  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: content.slice(0, 1900),
      flags: InteractionResponseFlags.EPHEMERAL,
      allowed_mentions: { parse: [] }
    }
  };
}

export function getDiscordUserId(interaction: DiscordInteraction): string | null {
  return interaction.member?.user?.id ?? interaction.user?.id ?? null;
}

export function getAtlasSubcommand(interaction: DiscordInteraction): {
  name: AtlasCommandName | null;
  options: DiscordCommandOption[];
} {
  const options = interaction.data?.options ?? [];
  const subcommand = options.find((option) => option.type === SUB_COMMAND_OPTION_TYPE);
  const name = subcommand?.name;
  const validName =
    name === "market" ||
    name === "card" ||
    name === "wallet" ||
    name === "intent" ||
    name === "bundle" ||
    name === "pack"
      ? name
      : null;

  return {
    name: validName,
    options: subcommand?.options ?? []
  };
}

export function stringOption(options: readonly DiscordCommandOption[], name: string): string | null {
  const value = options.find((option) => option.name === name)?.value;
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
