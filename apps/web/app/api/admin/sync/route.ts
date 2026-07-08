import { NextResponse } from "next/server";

import { getAdminSyncOverview } from "@/lib/admin-sync-data";

export async function GET() {
  return NextResponse.json(await getAdminSyncOverview());
}
