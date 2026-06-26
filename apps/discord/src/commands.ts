export const atlasCommandNames = [
  "market",
  "card",
  "wallet",
  "intent",
  "intents",
  "bundle",
  "pack",
  "quest"
] as const;

export type AtlasCommandName = (typeof atlasCommandNames)[number];
