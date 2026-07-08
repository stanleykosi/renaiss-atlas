import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "renaiss-atlas-web",
    generatedAt: new Date().toISOString()
  });
}
