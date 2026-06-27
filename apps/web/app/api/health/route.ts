import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "renaiss-atlas-web",
    mode: process.env["DEMO_MODE"] === "false" ? "database" : "seed",
    readOnly: true,
    generatedAt: new Date().toISOString()
  });
}
