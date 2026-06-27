import { NextResponse } from "next/server";

import { getCardDetail } from "@/lib/market-data";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tokenId: string }> }
) {
  const { tokenId } = await params;
  const detail = await getCardDetail(decodeURIComponent(tokenId));

  if (detail == null) {
    return NextResponse.json({ error: "Card not found." }, { status: 404 });
  }

  return NextResponse.json(detail);
}
