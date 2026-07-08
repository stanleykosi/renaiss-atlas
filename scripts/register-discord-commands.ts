import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { atlasApplicationCommands } from "../apps/web/lib/discord/commands";

function loadLocalEnv(path: string): void {
  if (!existsSync(path)) return;

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const rawValue = trimmed.slice(index + 1).trim();
    if (process.env[key] != null) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (value == null || value.trim().length === 0) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

loadLocalEnv(resolve(process.cwd(), ".env"));

const applicationId = requireEnv("DISCORD_APPLICATION_ID");
const botToken = requireEnv("DISCORD_BOT_TOKEN");
const guildId = process.env["DISCORD_GUILD_ID"];
const route =
  guildId == null || guildId.trim().length === 0
    ? `/applications/${applicationId}/commands`
    : `/applications/${applicationId}/guilds/${guildId}/commands`;

const response = await fetch(`https://discord.com/api/v10${route}`, {
  method: "PUT",
  headers: {
    authorization: `Bot ${botToken}`,
    "content-type": "application/json"
  },
  body: JSON.stringify(atlasApplicationCommands)
});

if (!response.ok) {
  throw new Error(`Discord command registration failed with ${response.status}: ${await response.text()}`);
}

console.log(`Registered ${atlasApplicationCommands.length} Discord command set(s).`);
