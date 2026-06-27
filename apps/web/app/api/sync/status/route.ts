import { NextResponse } from "next/server";

import { getSyncStatus } from "@/lib/market-data";

export async function GET() {
  return NextResponse.json(await getSyncStatus());
}
