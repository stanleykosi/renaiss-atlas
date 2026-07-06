import { atlasApplicationCommands, atlasCommandNames } from "./commands.js";

const applicationId = process.env["DISCORD_APPLICATION_ID"];
const botToken = process.env["DISCORD_BOT_TOKEN"];
const guildId = process.env["DISCORD_TEST_GUILD_ID"];

function registrationUrl(input: { applicationId: string; guildId?: string }) {
  if (input.guildId != null && input.guildId.length > 0) {
    return `https://discord.com/api/v10/applications/${input.applicationId}/guilds/${input.guildId}/commands`;
  }

  return `https://discord.com/api/v10/applications/${input.applicationId}/commands`;
}

async function registerCommands() {
  if (applicationId == null || applicationId.length === 0 || botToken == null || botToken.length === 0) {
    console.log(
      JSON.stringify(
        {
          service: "renaiss-atlas-discord",
          status: "skipped",
          reason: "Set DISCORD_APPLICATION_ID and DISCORD_BOT_TOKEN to register commands.",
          commands: atlasCommandNames
        },
        null,
        2
      )
    );
    return;
  }

  const scope = guildId == null || guildId.length === 0 ? "global" : "guild";
  const response = await fetch(
    registrationUrl(guildId == null || guildId.length === 0 ? { applicationId } : { applicationId, guildId }),
    {
      method: "PUT",
      headers: {
        authorization: `Bot ${botToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(atlasApplicationCommands)
    }
  );
  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`Discord command registration failed (${response.status}): ${responseText}`);
  }

  console.log(
    JSON.stringify(
      {
        service: "renaiss-atlas-discord",
        status: "registered",
        scope,
        commands: atlasCommandNames
      },
      null,
      2
    )
  );
}

await registerCommands();
