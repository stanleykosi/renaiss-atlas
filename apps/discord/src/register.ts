import { atlasCommandNames } from "./commands.js";

const registration = {
  service: "renaiss-atlas-discord",
  mode: "scaffold",
  status: "skipped",
  reason: "Discord command registration is wired as a script; live API registration is deferred until secrets and command handlers are implemented.",
  commands: atlasCommandNames
};

console.log(JSON.stringify(registration, null, 2));
