import { serve } from "@hono/node-server";
import pino from "pino";

import { app } from "./app.js";

const logger = pino({ name: "renaiss-atlas-api" });
const port = Number.parseInt(process.env["API_PORT"] ?? "3001", 10);

serve({ fetch: app.fetch, port });
logger.info({ port }, "api listening");
