import { NextResponse } from "next/server";

import { getHealthReport } from "@/lib/health-data";

export async function GET() {
  const report = await getHealthReport();
  return NextResponse.json(report, {
    status: report.status === "fail" ? 503 : 200
  });
}
