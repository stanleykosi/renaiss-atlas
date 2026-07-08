const optionType = {
  subcommand: 1,
  string: 3
} as const;

export const atlasApplicationCommand = {
  name: "atlas",
  description: "Renaiss Atlas collector intelligence",
  type: 1,
  dm_permission: true,
  options: [
    {
      type: optionType.subcommand,
      name: "market",
      description: "Show market pulse."
    },
    {
      type: optionType.subcommand,
      name: "card",
      description: "Search a card or open card intelligence.",
      options: [
        {
          type: optionType.string,
          name: "query",
          description: "Card search text or Renaiss /card/... path.",
          required: true
        }
      ]
    },
    {
      type: optionType.subcommand,
      name: "graded",
      description: "Look up a graded cert.",
      options: [
        {
          type: optionType.string,
          name: "cert",
          description: "Certification number.",
          required: true
        }
      ]
    },
    {
      type: optionType.subcommand,
      name: "sources",
      description: "Open Atlas data and safety boundaries."
    }
  ]
} as const;

export const atlasApplicationCommands = [atlasApplicationCommand] as const;
