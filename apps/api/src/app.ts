import { Hono } from "hono";

export const app = new Hono();

app.get("/api/health", (context) =>
  context.json({
    status: "ok",
    service: "renaiss-atlas-api",
    mode: "scaffold"
  })
);
