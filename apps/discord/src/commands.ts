export const atlasCommandNames = [
  "market",
  "card",
  "wallet",
  "intent",
  "bundle",
  "pack"
] as const;

export type AtlasCommandName = (typeof atlasCommandNames)[number];

const optionType = {
  subcommand: 1,
  string: 3
} as const;

export const atlasApplicationCommand = {
  name: "atlas",
  description: "Renaiss Atlas liquidity intelligence",
  type: 1,
  dm_permission: true,
  options: [
    {
      type: optionType.subcommand,
      name: "market",
      description: "Show market health and freshness."
    },
    {
      type: optionType.subcommand,
      name: "card",
      description: "Open a card liquidity snapshot.",
      options: [
        {
          type: optionType.string,
          name: "query",
          description: "Token ID or card search text.",
          required: true
        }
      ]
    },
    {
      type: optionType.subcommand,
      name: "wallet",
      description: "Show a read-only wallet summary.",
      options: [
        {
          type: optionType.string,
          name: "address",
          description: "EVM wallet address.",
          required: true
        }
      ]
    },
    {
      type: optionType.subcommand,
      name: "intent",
      description: "Show active collector demand.",
      options: [
        {
          type: optionType.string,
          name: "query",
          description: "Optional intent search text.",
          required: false
        }
      ]
    },
    {
      type: optionType.subcommand,
      name: "bundle",
      description: "Show bundle opportunities.",
      options: [
        {
          type: optionType.string,
          name: "query",
          description: "Optional wallet, card, or bundle search text.",
          required: false
        }
      ]
    },
    {
      type: optionType.subcommand,
      name: "pack",
      description: "Show observed pack momentum.",
      options: [
        {
          type: optionType.string,
          name: "pack",
          description: "Optional pack.",
          required: false,
          choices: [
            { name: "RenaCrypt Pack", value: "renacrypt-pack" },
            { name: "OMEGA", value: "omega" }
          ]
        }
      ]
    }
  ]
} as const;

export const atlasApplicationCommands = [atlasApplicationCommand] as const;
