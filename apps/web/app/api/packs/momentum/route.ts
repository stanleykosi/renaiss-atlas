import { NextResponse } from "next/server";

import { getPackMomentumOverview } from "@/lib/pack-data";

export async function GET() {
  return NextResponse.json(await getPackMomentumOverview());
}
