import { describe, expect, it } from "vitest";

import { getAtlasSubcommand, parseDiscordInteraction, stringOption } from "./interactions";

describe("Discord interaction parsing", () => {
  it("parses the Atlas command as a discriminated option tree", () => {
    const interaction = parseDiscordInteraction({
      id: "interaction-1",
      application_id: "discord-app",
      type: 2,
      data: {
        name: "atlas",
        options: [
          {
            name: "card",
            type: 1,
            options: [{ name: "query", type: 3, value: "  Pikachu  " }]
          }
        ]
      }
    });

    const subcommand = getAtlasSubcommand(interaction);
    expect(subcommand.name).toBe("card");
    expect(stringOption(subcommand.options, "query")).toBe("Pikachu");
    expect("application_id" in interaction).toBe(false);
  });

  it("rejects values and option kinds outside the registered Atlas command", () => {
    expect(() =>
      parseDiscordInteraction({
        type: 2,
        data: {
          name: "atlas",
          options: [
            {
              name: "card",
              type: 1,
              options: [{ name: "query", type: 3, value: 42 }]
            }
          ]
        }
      })
    ).toThrow();

    expect(() =>
      parseDiscordInteraction({
        type: 2,
        data: {
          name: "atlas",
          options: [{ name: "card", type: 7, value: "unsupported" }]
        }
      })
    ).toThrow();
  });

  it("keeps ping interactions distinct from application commands", () => {
    const ping = parseDiscordInteraction({ type: 1, extra: "ignored" });
    expect(getAtlasSubcommand(ping)).toEqual({ name: null, options: [] });
  });
});
