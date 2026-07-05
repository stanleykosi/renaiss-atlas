import { NextResponse } from "next/server";
import { z } from "zod";

import { getIntentMatches } from "@/lib/intent-data";

const IntentParamsSchema = z.object({
  intentId: z.string().uuid()
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ intentId: string }> }
) {
  const awaitedParams = await params;
  const parsed = IntentParamsSchema.safeParse(awaitedParams);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid intent ID." }, { status: 400 });
  }

  const matches = await getIntentMatches(parsed.data.intentId);
  if (matches == null) {
    return NextResponse.json({ error: "Intent not found." }, { status: 404 });
  }

  return NextResponse.json({
    intentId: parsed.data.intentId,
    matches
  });
}
